import asyncio
from typing import Protocol

import structlog
from arq.connections import ArqRedis
from redis.exceptions import RedisError
from starlette.requests import Request

from app.core.redis import create_arq_pool
from app.models.enums import GeoStatus
from app.models.meeting import Meeting
from app.services.geocoding_service import GeocodingService

logger = structlog.get_logger(__name__)


class GeocodingPort(Protocol):
    async def resolve_cached(self, meeting: Meeting) -> bool:
        """Fill cached coordinates before commit; return whether a cache hit occurred."""
        ...

    async def enqueue(self, meeting_id: int) -> None:
        """Queue geocoding after the meeting has been committed."""
        ...


class NullGeocoding:
    """S06 placeholder, replaced by the real geocoder in S09."""

    async def resolve_cached(self, meeting: Meeting) -> bool:
        return False

    async def enqueue(self, meeting_id: int) -> None:
        return None


class QueuedGeocoding:
    """Resolve cache entries in the current transaction; queue misses after commit."""

    def __init__(self, service: GeocodingService, request: Request) -> None:
        self.service = service
        self.request = request

    async def resolve_cached(self, meeting: Meeting) -> bool:
        result = await self.service.lookup(meeting.address)
        if result is None:
            return False
        meeting.lat = result.lat
        meeting.lon = result.lon
        meeting.address_norm = result.address_norm
        meeting.geo_status = GeoStatus.RESOLVED
        return True

    async def enqueue(self, meeting_id: int) -> None:
        try:
            pool: ArqRedis | None = self.request.app.state.arq_pool
            if pool is None:
                settings = self.request.app.state.settings
                pool = await create_arq_pool(settings.redis_url)
                self.request.app.state.arq_pool = pool
            await asyncio.wait_for(
                pool.enqueue_job("geocode_meeting", meeting_id, _job_id=f"geo:{meeting_id}"),
                timeout=0.5,
            )
        except (RedisError, OSError, TimeoutError) as exc:
            logger.warning("geocode_enqueue_failed", meeting_id=meeting_id, error=str(exc))
