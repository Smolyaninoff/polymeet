import asyncio
from collections.abc import AsyncIterator

import pytest
from alembic import command
from sqlalchemy import make_url, pool, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine

from app.core.config import Settings
from app.core.ids import new_id
from app.repositories.user_repository import UserRepository
from tests.integration.helpers import CreateUser, alembic_config

EXTENSIONS = {"citext", "cube", "earthdistance"}


@pytest.fixture
async def empty_database(engine: AsyncEngine, settings: Settings) -> AsyncIterator[Settings]:
    """Отдельная пустая база на время теста; настройки указывают на неё."""
    name = f"migrations_{new_id().lower()}"
    admin = engine.execution_options(isolation_level="AUTOCOMMIT")
    async with admin.connect() as conn:
        await conn.execute(text(f'CREATE DATABASE "{name}"'))
    url = make_url(settings.database_url).set(database=name)
    yield settings.model_copy(update={"database_url": url.render_as_string(hide_password=False)})
    async with admin.connect() as conn:
        await conn.execute(text(f'DROP DATABASE "{name}" WITH (FORCE)'))


async def _schema_state(database_url: str) -> tuple[set[str], set[str]]:
    engine = create_async_engine(database_url, poolclass=pool.NullPool)
    try:
        async with engine.connect() as conn:
            tables = set(
                await conn.scalars(
                    text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
                )
            )
            extensions = set(await conn.scalars(text("SELECT extname FROM pg_extension")))
    finally:
        await engine.dispose()
    return tables, extensions & EXTENSIONS


async def test_migrations_upgrade_downgrade_upgrade_on_empty_database(
    empty_database: Settings,
) -> None:
    config = alembic_config(empty_database)

    await asyncio.to_thread(command.upgrade, config, "head")
    assert await _schema_state(empty_database.database_url) == (
        {
            "alembic_version",
            "users",
            "categories",
            "meetings",
            "geocode_cache",
            "applications",
            "chat_messages",
        },
        EXTENSIONS,
    )

    await asyncio.to_thread(command.downgrade, config, "base")
    assert await _schema_state(empty_database.database_url) == (
        {"alembic_version"},
        set(),
    )

    await asyncio.to_thread(command.upgrade, config, "head")
    assert await _schema_state(empty_database.database_url) == (
        {
            "alembic_version",
            "users",
            "categories",
            "meetings",
            "geocode_cache",
            "applications",
            "chat_messages",
        },
        EXTENSIONS,
    )


async def test_models_match_migrations(engine: AsyncEngine, settings: Settings) -> None:
    # Автогенерация не должна находить расхождений между ORM-моделями и ревизиями.
    await asyncio.to_thread(command.check, alembic_config(settings))


async def test_required_extensions_are_installed(engine: AsyncEngine) -> None:
    async with engine.connect() as conn:
        installed = set(await conn.scalars(text("SELECT extname FROM pg_extension")))

    assert installed >= EXTENSIONS


async def test_email_is_unique_regardless_of_case(create_user: CreateUser) -> None:
    await create_user(email="Student@Example.com")

    with pytest.raises(IntegrityError, match="uq_users_email"):
        await create_user(email="student@EXAMPLE.com")


async def test_user_is_found_by_email_in_any_case(
    engine: AsyncEngine, create_user: CreateUser
) -> None:
    user = await create_user(email="Mixed.Case@Example.com")

    async with AsyncSession(engine) as session:
        found = await UserRepository(session).get_by_email("mixed.case@example.COM")

    assert found is not None
    assert found.id == user.id


@pytest.mark.parametrize(
    ("display_name", "allowed"),
    [("Я", False), ("Ян", True), ("я" * 50, True), ("я" * 51, False)],
)
async def test_display_name_length_is_checked_by_database(
    create_user: CreateUser, display_name: str, allowed: bool
) -> None:
    if allowed:
        user = await create_user(display_name=display_name)
        assert user.display_name == display_name
    else:
        with pytest.raises(IntegrityError, match="ck_users_display_name_length"):
            await create_user(display_name=display_name)


@pytest.mark.parametrize(
    ("attended", "marked", "allowed"),
    [(0, 0, True), (3, 5, True), (5, 5, True), (6, 5, False), (-1, 0, False)],
)
async def test_attendance_counters_are_checked_by_database(
    engine: AsyncEngine, create_user: CreateUser, attended: int, marked: int, allowed: bool
) -> None:
    user = await create_user()
    update = text("UPDATE users SET attended_count = :a, marked_count = :m WHERE id = :id")
    values = {"a": attended, "m": marked, "id": user.id}

    async with engine.begin() as conn:
        if allowed:
            await conn.execute(update, values)
        else:
            with pytest.raises(IntegrityError, match="ck_users_attendance_counts"):
                await conn.execute(update, values)


async def test_new_user_gets_database_defaults(create_user: CreateUser) -> None:
    first = await create_user()
    second = await create_user()

    assert isinstance(first.id, int)
    assert second.id > first.id
    assert (first.role, first.attended_count, first.marked_count) == (0, 0, 0)
    # Пока явку не отмечали, надёжность не определена
    assert first.attendance_rate is None
    assert first.created_at.tzinfo is not None
