from datetime import UTC, date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import httpx
import pytest
from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from app.core.config import Settings
from app.main import create_app
from app.models.enums import MeetingStatus
from app.models.user import User
from app.repositories.meeting_repository import FeedFilters, GeoCircle, MeetingRepository
from tests.integration.helpers import (
    REFUSED_REDIS_URL,
    AuthHeaders,
    CreateMeeting,
    CreateUser,
    app_client,
    read_log_records,
)

FEED = "/api/v1/meetings"
MAP = "/api/v1/meetings/map"
MOSCOW = ZoneInfo("Europe/Moscow")
# Центр поиска — Политех; 1° широты на сфере earthdistance — около 111,32 км
CENTER = (60.0070, 30.3730)
KM_PER_DEGREE_LAT = 111.32


def north_of_center(km: float) -> tuple[float, float]:
    return CENTER[0] + km / KM_PER_DEGREE_LAT, CENTER[1]


@pytest.fixture
async def organizer(create_user: CreateUser) -> User:
    return await create_user()


async def feed(client: httpx.AsyncClient, **params: Any) -> dict[str, Any]:
    response = await client.get(FEED, params=params)
    assert response.status_code == 200, response.text
    page: dict[str, Any] = response.json()
    return page


async def feed_ids(client: httpx.AsyncClient, **params: Any) -> list[int]:
    return [item["id"] for item in (await feed(client, **params))["items"]]


async def test_feed_order_and_cursor_walk_without_gaps(
    client: httpx.AsyncClient, organizer: User, create_meeting: CreateMeeting
) -> None:
    base = datetime.now(UTC).replace(microsecond=0) + timedelta(days=3)
    meetings = [
        # Время повторяется, поэтому порядок внутри одного starts_at задаёт id
        await create_meeting(organizer, starts_at=base + timedelta(hours=(i * 7) % 10))
        for i in range(30)
    ]
    expected = [m.id for m in sorted(meetings, key=lambda m: (m.starts_at, m.id))]

    first = await feed(client)
    assert [item["id"] for item in first["items"]] == expected[:20]
    assert first["next_cursor"] is not None

    seen: list[int] = []
    pages = 0
    cursor = None
    while True:
        params: dict[str, Any] = {"limit": 7}
        if cursor is not None:
            params["cursor"] = cursor
        page = await feed(client, **params)
        seen += [item["id"] for item in page["items"]]
        pages += 1
        cursor = page["next_cursor"]
        if cursor is None:
            break
    assert seen == expected
    assert pages == 5


async def test_feed_shows_only_published_future_meetings(
    client: httpx.AsyncClient, organizer: User, create_meeting: CreateMeeting
) -> None:
    visible = await create_meeting(organizer)
    for status in (MeetingStatus.DRAFT, MeetingStatus.CANCELLED, MeetingStatus.FINISHED):
        await create_meeting(organizer, status=status)
    await create_meeting(organizer, starts_at=datetime.now(UTC) - timedelta(minutes=1))

    assert await feed_ids(client) == [visible.id]


async def test_feed_filters_by_category(
    client: httpx.AsyncClient, organizer: User, create_meeting: CreateMeeting
) -> None:
    games = await create_meeting(organizer, category_id=2)
    await create_meeting(organizer, category_id=4)

    assert await feed_ids(client, category="games") == [games.id]
    assert await feed_ids(client, category="unknown") == []


async def test_feed_filters_by_local_day(
    client: httpx.AsyncClient, organizer: User, create_meeting: CreateMeeting
) -> None:
    day = date.today() + timedelta(days=10)
    late = await create_meeting(
        organizer, starts_at=datetime.combine(day, time(23, 30), tzinfo=MOSCOW)
    )
    early = await create_meeting(
        organizer, starts_at=datetime.combine(day + timedelta(days=1), time(0, 30), tzinfo=MOSCOW)
    )

    assert await feed_ids(client, date=day.isoformat()) == [late.id]
    assert await feed_ids(client, date=(day + timedelta(days=1)).isoformat()) == [early.id]


async def test_feed_filters_by_free_places(
    client: httpx.AsyncClient, organizer: User, create_meeting: CreateMeeting
) -> None:
    free = await create_meeting(organizer, capacity=3, accepted_count=2)
    await create_meeting(organizer, capacity=3, accepted_count=3)

    assert await feed_ids(client, has_free_places="true") == [free.id]
    assert len(await feed_ids(client, has_free_places="false")) == 2


async def test_feed_full_text_search_matches_other_word_form(
    client: httpx.AsyncClient, organizer: User, create_meeting: CreateMeeting
) -> None:
    chess = await create_meeting(organizer, description="Будем играть в шахматы до ночи")
    await create_meeting(organizer, description="Пробежка вдоль набережной")

    assert await feed_ids(client, q="шахматами") == [chess.id]


async def test_feed_radius_search(
    client: httpx.AsyncClient, organizer: User, create_meeting: CreateMeeting
) -> None:
    by_km = {}
    for km in (0.5, 2, 8, 15):
        lat, lon = north_of_center(km)
        by_km[km] = (await create_meeting(organizer, lat=lat, lon=lon)).id
    await create_meeting(organizer)  # без координат
    lat, lon = CENTER

    async def within(radius_km: float) -> set[int]:
        return set(await feed_ids(client, lat=lat, lon=lon, radius_km=radius_km))

    assert await within(1) == {by_km[0.5]}
    assert await within(3) == {by_km[0.5], by_km[2]}
    assert await within(10) == {by_km[0.5], by_km[2], by_km[8]}
    assert await within(50) == set(by_km.values())

    page = await feed(client, lat=lat, lon=lon, radius_km=50)
    distances = {item["id"]: item["distance_km"] for item in page["items"]}
    assert distances == {meeting_id: km for km, meeting_id in by_km.items()}
    assert all(item["distance_km"] is None for item in (await feed(client))["items"])


async def test_feed_requires_full_point(client: httpx.AsyncClient) -> None:
    response = await client.get(FEED, params={"lat": 60.0, "radius_km": 3})

    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"
    assert [error["field"] for error in response.json()["errors"]] == ["lon"]


async def test_map_returns_points_inside_bbox(
    client: httpx.AsyncClient, organizer: User, create_meeting: CreateMeeting
) -> None:
    soon = datetime.now(UTC) + timedelta(days=1)
    inside = [
        await create_meeting(organizer, lat=60.00, lon=30.30, starts_at=soon + timedelta(hours=2)),
        await create_meeting(organizer, lat=59.95, lon=30.40, starts_at=soon),
    ]
    await create_meeting(organizer, lat=59.80, lon=30.30)  # южнее области
    await create_meeting(organizer, lat=60.00, lon=30.60)  # восточнее области
    await create_meeting(organizer)  # без координат
    bbox = "30.25,59.90,30.45,60.05"

    response = await client.get(MAP, params={"bbox": bbox})
    assert response.status_code == 200, response.text
    items = response.json()
    assert [item["id"] for item in items] == [inside[1].id, inside[0].id]
    assert all(item["distance_km"] is None for item in items)

    limited = await client.get(MAP, params={"bbox": bbox, "limit": 1})
    assert [item["id"] for item in limited.json()] == [inside[1].id]

    inverted = await client.get(MAP, params={"bbox": "30.45,59.90,30.25,60.05"})
    assert inverted.status_code == 400
    assert inverted.json()["errors"][0]["field"] == "bbox"


async def _explain(engine: AsyncEngine, filters: FeedFilters) -> str:
    """План запроса ленты из репозитория при запрещённом последовательном чтении."""
    captured: list[tuple[str, Any]] = []

    def capture(_conn: Any, _cursor: Any, statement: str, parameters: Any, *_: Any) -> None:
        if "FROM meetings" in statement:
            captured.append((statement, parameters))

    event.listen(engine.sync_engine, "before_cursor_execute", capture)
    try:
        async with AsyncSession(engine) as session, session.begin():
            await session.execute(text("ANALYZE meetings"))
            await session.execute(text("SET LOCAL enable_seqscan = off"))
            await MeetingRepository(session).list_feed(filters, None, 20)
            statement, parameters = captured[-1]
            connection = await session.connection()
            plan = await connection.exec_driver_sql(f"EXPLAIN {statement}", parameters)
            return "\n".join(row[0] for row in plan)
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", capture)


async def test_feed_queries_use_indexes(
    engine: AsyncEngine, organizer: User, create_meeting: CreateMeeting
) -> None:
    # Черновики не входят в частичные индексы опубликованных встреч. На четырёх
    # строках выбор плана зависит от мелких колебаний статистики PostgreSQL.
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "INSERT INTO meetings (organizer_id, category_id, title, starts_at, "
                "duration_minutes, address, capacity) "
                "SELECT :organizer_id, 1, 'Черновик', now() + interval '1 day', "
                "90, 'Тестовый адрес', 5 FROM generate_series(1, 1000)"
            ),
            {"organizer_id": organizer.id},
        )
    for km in (0.5, 2, 8, 15):
        await create_meeting(organizer, lat=north_of_center(km)[0], lon=CENTER[1])
    now = datetime.now(UTC)

    feed_plan = await _explain(engine, FeedFilters(starts_after=now))
    geo_plan = await _explain(
        engine, FeedFilters(starts_after=now, circle=GeoCircle(*CENTER, radius_m=3000))
    )

    assert "ix_meetings_feed" in feed_plan, feed_plan
    assert "ix_meetings_geo" in geo_plan, geo_plan


def _cache_field(capsys: pytest.CaptureFixture[str]) -> list[str | None]:
    return [
        record.get("cache")
        for record in read_log_records(capsys)
        if record["event"] == "http_request"
    ]


async def test_first_page_is_cached_and_reset_on_publish(
    client: httpx.AsyncClient,
    organizer: User,
    create_meeting: CreateMeeting,
    auth_headers: AuthHeaders,
    capsys: pytest.CaptureFixture[str],
) -> None:
    shown = await create_meeting(organizer)
    draft = await create_meeting(organizer, status=MeetingStatus.DRAFT)
    read_log_records(capsys)

    assert await feed_ids(client, limit=1) == [shown.id]
    assert await feed_ids(client, limit=1) == [shown.id]
    assert _cache_field(capsys) == ["miss", "hit"]

    published = await client.patch(
        f"{FEED}/{draft.id}", json={"status": "published"}, headers=auth_headers(organizer)
    )
    assert published.status_code == 200, published.text
    page = await feed(client, limit=1)
    assert await feed_ids(client, cursor=page["next_cursor"], limit=1) == [draft.id]
    assert set(await feed_ids(client)) == {shown.id, draft.id}
    # PATCH не трогает кэш ленты, запрос с курсором кэш не использует
    assert _cache_field(capsys) == [None, "miss", None, "miss"]


async def test_feed_works_without_redis(
    settings: Settings, organizer: User, create_meeting: CreateMeeting
) -> None:
    meeting = await create_meeting(organizer)
    no_redis = settings.model_copy(update={"redis_url": REFUSED_REDIS_URL})

    async with app_client(create_app(no_redis)) as client:
        assert await feed_ids(client) == [meeting.id]
        assert await feed_ids(client) == [meeting.id]
