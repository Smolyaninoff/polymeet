from typing import Any, ClassVar

import httpx
import structlog
from arq import cron
from arq.connections import RedisSettings

from app.clients.nominatim import NominatimClient
from app.core.circuit_breaker import CircuitBreaker
from app.core.config import get_settings
from app.core.db import create_engine, create_session_factory
from app.core.logging import configure_logging
from app.core.redis import create_redis
from app.core.slot_limiter import SlotLimiter
from app.workers.geocoding import geocode_meeting, geocode_pending_sweep

logger = structlog.get_logger(__name__)


async def ping(ctx: dict[str, Any]) -> str:
    """Служебная задача: проверка, что воркер берёт задания из очереди."""
    return "pong"


async def startup(ctx: dict[str, Any]) -> None:
    settings = get_settings()
    configure_logging(settings.log_level)
    engine = create_engine(settings.database_url)
    geo_redis = create_redis(settings.redis_url)
    http = httpx.AsyncClient()
    ctx["settings"] = settings
    ctx["engine"] = engine
    ctx["session_factory"] = create_session_factory(engine)
    ctx["geo_redis"] = geo_redis
    ctx["http"] = http
    ctx["breaker"] = CircuitBreaker("nominatim", settings, geo_redis)
    ctx["nominatim_client"] = NominatimClient(settings, http, SlotLimiter(geo_redis))
    logger.info("worker_started")


async def shutdown(ctx: dict[str, Any]) -> None:
    await ctx["http"].aclose()
    await ctx["geo_redis"].aclose()
    await ctx["engine"].dispose()
    logger.info("worker_stopped")


class WorkerSettings:
    """Настройки ARQ: ``arq app.workers.settings.WorkerSettings``."""

    functions: ClassVar[list[Any]] = [ping, geocode_meeting]
    cron_jobs: ClassVar[list[Any]] = [
        cron(geocode_pending_sweep, minute={0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55})
    ]
    redis_settings = RedisSettings.from_dsn(get_settings().redis_url)
    max_jobs = 1
    max_tries = 4
    job_timeout = 30
    keep_result = 0
    on_startup = startup
    on_shutdown = shutdown
