from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import (
    ForbiddenError,
    InvalidTransitionError,
    NotFoundError,
    ValidationAppError,
)
from app.core.pagination import decode_cursor, encode_cursor
from app.models.category import Category
from app.models.enums import GeoStatus, MeetingStatus
from app.models.meeting import Meeting
from app.models.user import User
from app.repositories.category_repository import CategoryRepository
from app.repositories.meeting_repository import MeetingRepository
from app.schemas.meetings import MeetingCreate
from app.services.application_service import promote_waitlist
from app.services.feed_cache import FeedCache
from app.services.geocoding_port import GeocodingPort
from app.services.meeting_rules import (
    can_view,
    check_capacity,
    check_starts_at,
    check_transition,
    normalize_address,
    normalize_address_hint,
    normalize_title,
)


class MeetingService:
    def __init__(
        self,
        session: AsyncSession,
        geocoding: GeocodingPort,
        feed_cache: FeedCache | None = None,
    ) -> None:
        self._session = session
        self._meetings = MeetingRepository(session)
        self._categories = CategoryRepository(session)
        self._geocoding = geocoding
        self._feed_cache = feed_cache

    async def list_categories(self) -> list[Category]:
        return await self._categories.list_all()

    async def _category(self, slug: str) -> Category:
        category = await self._categories.get_by_slug(slug)
        if category is None:
            raise ValidationAppError.for_field("category", "Категория не найдена")
        return category

    async def create(self, organizer: User, data: MeetingCreate) -> Meeting:
        title = normalize_title(data.title)
        address = normalize_address(data.address)
        check_starts_at(data.starts_at, datetime.now(UTC))
        category = await self._category(data.category)
        meeting = Meeting(
            organizer=organizer,
            category=category,
            status=MeetingStatus.DRAFT,
            geo_status=GeoStatus.PENDING,
            title=title,
            description=data.description,
            starts_at=data.starts_at,
            duration_minutes=data.duration_minutes,
            address=address,
            address_hint=normalize_address_hint(data.address_hint),
            capacity=data.capacity,
            accepted_count=0,
            auto_accept=data.auto_accept,
        )
        await self._meetings.add(meeting)
        cached = await self._geocoding.resolve_cached(meeting)
        await self._session.commit()
        if not cached:
            await self._geocoding.enqueue(meeting.id)
        return meeting

    async def get(self, meeting_id: int, viewer: User | None) -> Meeting:
        meeting = await self._meetings.get(meeting_id)
        if meeting is None or not can_view(
            meeting.status, meeting.organizer_id, viewer.id if viewer else None
        ):
            raise NotFoundError("Встреча не найдена")
        return meeting

    async def update(self, meeting_id: int, actor: User, changes: dict[str, Any]) -> Meeting:
        meeting = await self._meetings.get_for_update(meeting_id)
        if meeting is None:
            raise NotFoundError("Встреча не найдена")
        if meeting.organizer_id != actor.id:
            if meeting.status == MeetingStatus.DRAFT:
                raise NotFoundError("Встреча не найдена")
            raise ForbiddenError()
        if not changes:
            return meeting
        if meeting.status in (MeetingStatus.CANCELLED, MeetingStatus.FINISHED):
            raise InvalidTransitionError()

        values = changes.copy()
        if "title" in values:
            values["title"] = normalize_title(values["title"])
        if "address" in values:
            values["address"] = normalize_address(values["address"])
        if "address_hint" in values:
            values["address_hint"] = normalize_address_hint(values["address_hint"])
        if "starts_at" in values:
            check_starts_at(values["starts_at"], datetime.now(UTC))
        if "category" in values:
            category = await self._category(values.pop("category"))
            values["category_id"] = category.id
            meeting.category = category
        if "capacity" in values:
            check_capacity(values["capacity"], meeting.accepted_count)
        if "status" in values:
            target = MeetingStatus[values.pop("status").upper()]
            values["status"] = check_transition(
                meeting.status,
                target,
                values.get("starts_at", meeting.starts_at),
                datetime.now(UTC),
            )

        address_changed = "address" in values and values["address"] != meeting.address
        was_published = meeting.status == MeetingStatus.PUBLISHED
        old_capacity = meeting.capacity
        for field, value in values.items():
            setattr(meeting, field, value)
        if meeting.capacity > old_capacity:
            # Строка встречи заблокирована get_for_update: новые места получает лист ожидания
            await promote_waitlist(self._session, meeting)
        cached = True
        if address_changed:
            meeting.lat = None
            meeting.lon = None
            meeting.address_norm = None
            meeting.geo_status = GeoStatus.PENDING
            cached = await self._geocoding.resolve_cached(meeting)
        await self._session.commit()
        # Встреча появилась в ленте, ушла из неё или изменилась в ней: кэш ленты устарел.
        if self._feed_cache is not None and (was_published or "status" in values):
            await self._feed_cache.bump()
        if address_changed and not cached:
            await self._geocoding.enqueue(meeting.id)
        return meeting

    async def list_mine(
        self, organizer: User, cursor: str | None, limit: int
    ) -> tuple[list[Meeting], str | None]:
        after: tuple[datetime, int] | None = None
        if cursor is not None:
            parts = decode_cursor(cursor, [datetime, int])
            created_at, meeting_id = parts
            if created_at.tzinfo is None or meeting_id <= 0:
                raise ValidationAppError.for_field("cursor", "Недействительный курсор")
            after = (created_at, meeting_id)
        meetings = await self._meetings.list_by_organizer(organizer.id, after, limit)
        items = meetings[:limit]
        next_cursor = (
            encode_cursor([items[-1].created_at, items[-1].id]) if len(meetings) > limit else None
        )
        return items, next_cursor

    async def set_location(self, meeting_id: int, actor: User, lat: float, lon: float) -> Meeting:
        meeting = await self._meetings.get_for_update(meeting_id)
        if meeting is None:
            raise NotFoundError("Встреча не найдена")
        if meeting.organizer_id != actor.id:
            if meeting.status == MeetingStatus.DRAFT:
                raise NotFoundError("Встреча не найдена")
            raise ForbiddenError()
        if meeting.status in (MeetingStatus.CANCELLED, MeetingStatus.FINISHED):
            raise InvalidTransitionError()
        meeting.lat = lat
        meeting.lon = lon
        meeting.address_norm = None
        meeting.geo_status = GeoStatus.MANUAL
        await self._session.commit()
        if meeting.status == MeetingStatus.PUBLISHED and self._feed_cache is not None:
            await self._feed_cache.bump()
        return meeting
