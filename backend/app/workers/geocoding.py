"""ARQ geocoding job and recovery sweep."""

import time
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from arq.worker import Retry
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.clients.nominatim import GeoResult
from app.core.config import Settings
from app.models.enums import GeoStatus, MeetingStatus
from app.models.meeting import Meeting
from app.repositories.meeting_repository import MeetingRepository
from app.services.geocoding_service import GeocodingService, GeoOutcomeStatus

logger = structlog.get_logger(__name__)


async def geocode_meeting(ctx: dict[str, Any], meeting_id: int) -> None:
    """Geocode a pending meeting; never overwrite a newer address or manual point."""
    started = time.monotonic()
    attempt = int(ctx.get("job_try", 1))
    outcome = "skipped"
    settings: Settings = ctx["settings"]
    factory: async_sessionmaker[Any] = ctx["session_factory"]
    try:
        async with factory() as session:
            meeting = await session.get(Meeting, meeting_id)
            if meeting is None or meeting.geo_status != GeoStatus.PENDING:
                return
            address = meeting.address
            service = GeocodingService(
                settings, session, ctx["geo_redis"], ctx["nominatim_client"], ctx["breaker"]
            )
            result = await service.lookup(address)
            if result is not None:
                status = GeoOutcomeStatus.FOUND
                outcome = "cache_hit"
            else:
                fetched = await service.fetch_and_store(address)
                status, result = fetched.status, fetched.result
                outcome = status.value

            if status in (GeoOutcomeStatus.UNAVAILABLE, GeoOutcomeStatus.BREAKER_OPEN):
                if attempt < 4:
                    await session.rollback()
                    delays = settings.geo_retry_delays_sec
                    raise Retry(defer=delays[min(attempt - 1, len(delays) - 1)])
                status = GeoOutcomeStatus.NOT_FOUND
                outcome = "failed_after_retries"

            locked = await MeetingRepository(session).get_for_update(meeting_id)
            if (
                locked is None
                or locked.geo_status != GeoStatus.PENDING
                or locked.address != address
            ):
                outcome = "stale"
                await session.rollback()
                return
            if status == GeoOutcomeStatus.FOUND and isinstance(result, GeoResult):
                locked.lat = result.lat
                locked.lon = result.lon
                locked.address_norm = result.address_norm
                locked.geo_status = GeoStatus.RESOLVED
            else:
                locked.geo_status = GeoStatus.FAILED
            await session.commit()
    finally:
        logger.info(
            "geocode_job",
            meeting_id=meeting_id,
            outcome=outcome,
            attempt=attempt,
            duration_ms=round((time.monotonic() - started) * 1000),
        )


async def geocode_pending_sweep(ctx: dict[str, Any]) -> int:
    """Requeue up to 50 old pending meetings after a lost enqueue."""
    factory: async_sessionmaker[Any] = ctx["session_factory"]
    cutoff = datetime.now(UTC) - timedelta(minutes=2)
    async with factory() as session:
        ids = list(
            await session.scalars(
                select(Meeting.id)
                .where(
                    Meeting.status.in_((MeetingStatus.DRAFT, MeetingStatus.PUBLISHED)),
                    Meeting.geo_status == GeoStatus.PENDING,
                    Meeting.updated_at < cutoff,
                )
                .order_by(Meeting.updated_at, Meeting.id)
                .limit(50)
            )
        )
    queued = 0
    for meeting_id in ids:
        if await ctx["redis"].enqueue_job(
            "geocode_meeting", meeting_id, _job_id=f"geo:{meeting_id}"
        ):
            queued += 1
    logger.info("geocode_pending_sweep", scanned=len(ids), queued=queued)
    return queued
