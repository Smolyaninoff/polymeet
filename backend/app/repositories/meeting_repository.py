from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import ColumnElement, Select, func, literal_column, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.enums import MeetingStatus
from app.models.meeting import Meeting


@dataclass(frozen=True, slots=True)
class GeoCircle:
    lat: float
    lon: float
    radius_m: float


@dataclass(frozen=True, slots=True)
class BBox:
    min_lon: float
    min_lat: float
    max_lon: float
    max_lat: float


@dataclass(frozen=True, slots=True)
class FeedFilters:
    """Условия ленты и карты. ``starts_after`` — обычно текущее время."""

    starts_after: datetime
    category_id: int | None = None
    starts_between: tuple[datetime, datetime] | None = None
    has_free_places: bool = False
    query: str | None = None
    circle: GeoCircle | None = None


# Статус — константой, а не параметром: иначе планировщик не применит частичные индексы
# с условием status = 1 к обобщённому плану подготовленного запроса.
_PUBLISHED = Meeting.status == literal_column(str(int(MeetingStatus.PUBLISHED)))


def _feed_select(filters: FeedFilters, *columns: ColumnElement[float]) -> Select[*tuple[Any, ...]]:
    query = (
        select(Meeting, *columns)
        .options(joinedload(Meeting.organizer), joinedload(Meeting.category))
        .where(_PUBLISHED, Meeting.starts_at > filters.starts_after)
        .order_by(Meeting.starts_at, Meeting.id)
    )
    if filters.category_id is not None:
        query = query.where(Meeting.category_id == filters.category_id)
    if filters.starts_between is not None:
        day_start, day_end = filters.starts_between
        query = query.where(Meeting.starts_at >= day_start, Meeting.starts_at < day_end)
    if filters.has_free_places:
        query = query.where(Meeting.accepted_count < Meeting.capacity)
    if filters.query is not None:
        query = query.where(
            Meeting.search_vector.op("@@")(func.websearch_to_tsquery("russian", filters.query))
        )
    return query


class MeetingRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, meeting: Meeting) -> Meeting:
        self._session.add(meeting)
        await self._session.flush()
        return meeting

    async def get(self, meeting_id: int) -> Meeting | None:
        return await self._session.scalar(
            select(Meeting)
            .options(joinedload(Meeting.organizer), joinedload(Meeting.category))
            .where(Meeting.id == meeting_id)
        )

    async def get_for_update(self, meeting_id: int) -> Meeting | None:
        return await self._session.scalar(
            select(Meeting)
            .options(
                joinedload(Meeting.organizer, innerjoin=True),
                joinedload(Meeting.category, innerjoin=True),
            )
            .where(Meeting.id == meeting_id)
            .with_for_update(of=Meeting)
            .execution_options(populate_existing=True)
        )

    async def list_by_organizer(
        self, organizer_id: int, after: tuple[datetime, int] | None, limit: int
    ) -> list[Meeting]:
        query = (
            select(Meeting)
            .options(joinedload(Meeting.organizer), joinedload(Meeting.category))
            .where(Meeting.organizer_id == organizer_id)
            .order_by(Meeting.created_at.desc(), Meeting.id.desc())
            .limit(limit + 1)
        )
        if after is not None:
            query = query.where(tuple_(Meeting.created_at, Meeting.id) < after)
        return list(await self._session.scalars(query))

    async def list_feed(
        self, filters: FeedFilters, after: tuple[datetime, int] | None, limit: int
    ) -> list[tuple[Meeting, float | None]]:
        """До ``limit + 1`` встреч ленты с расстоянием в метрах (если задан круг)."""
        columns: list[ColumnElement[float]] = []
        circle = filters.circle
        if circle is not None:
            center = func.ll_to_earth(circle.lat, circle.lon)
            point = func.ll_to_earth(Meeting.lat, Meeting.lon)
            distance = func.earth_distance(center, point)
            columns.append(distance)
        query = _feed_select(filters, *columns).limit(limit + 1)
        if circle is not None:
            # Бокс задействует ix_meetings_geo, точное расстояние отсекает его углы.
            query = query.where(
                Meeting.lat.is_not(None),
                func.earth_box(center, circle.radius_m).op("@>")(point),
                distance <= circle.radius_m,
            )
        if after is not None:
            query = query.where(tuple_(Meeting.starts_at, Meeting.id) > after)
        rows = await self._session.execute(query)
        if circle is None:
            return [(meeting, None) for meeting in rows.scalars()]
        return [(meeting, distance_m) for meeting, distance_m in rows]

    async def list_in_bbox(self, filters: FeedFilters, bbox: BBox, limit: int) -> list[Meeting]:
        query = (
            _feed_select(filters)
            .where(
                Meeting.lat.between(bbox.min_lat, bbox.max_lat),
                Meeting.lon.between(bbox.min_lon, bbox.max_lon),
            )
            .limit(limit)
        )
        return list(await self._session.scalars(query))
