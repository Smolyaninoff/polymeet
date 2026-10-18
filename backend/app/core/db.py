from collections.abc import AsyncIterator

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from starlette.requests import Request

DEFAULT_POOL_SIZE = 20

_UNIQUE_VIOLATION = "23505"


def create_engine(url: str, *, pool_size: int = DEFAULT_POOL_SIZE) -> AsyncEngine:
    return create_async_engine(url, pool_size=pool_size, pool_pre_ping=True)


def create_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False)


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    """Сессия на запрос. Коммит делает сервис; при исключении транзакция откатывается."""
    factory: async_sessionmaker[AsyncSession] = request.app.state.session_factory
    async with factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


def is_unique_violation(exc: IntegrityError) -> bool:
    """Нарушена уникальность (SQLSTATE 23505), а не CHECK, NOT NULL или внешний ключ."""
    return getattr(exc.orig, "pgcode", None) == _UNIQUE_VIOLATION
