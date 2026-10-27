from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest
import respx
from arq.worker import Retry
from fastapi import FastAPI
from redis.asyncio import Redis
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.clients.nominatim import NominatimClient
from app.core.circuit_breaker import CircuitBreaker
from app.core.config import Settings
from app.main import create_app
from app.models.enums import GeoStatus
from app.models.geocode_cache import GeocodeCache
from app.models.meeting import Meeting
from app.services.geocoding_service import address_hash
from app.workers.geocoding import geocode_meeting, geocode_pending_sweep
from tests.conftest import make_settings
from tests.integration.helpers import REFUSED_REDIS_URL, AuthHeaders, CreateUser, app_client
from tests.integration.test_meetings_api import create_meeting


class ImmediateLimiter:
    async def acquire(self, key: str, rps: float) -> None:
        pass


async def _worker_context(
    engine: AsyncEngine, redis: Redis, settings: Settings, http: httpx.AsyncClient, queue: Any
) -> dict[str, Any]:
    async def no_sleep(seconds: float) -> None:
        pass

    return {
        "settings": settings,
        "session_factory": async_sessionmaker(engine, expire_on_commit=False),
        "geo_redis": redis,
        "redis": queue,
        "nominatim_client": NominatimClient(
            settings,
            http,
            ImmediateLimiter(),
            sleep=no_sleep,  # type: ignore[arg-type]
        ),
        "breaker": CircuitBreaker("worker-test", settings, redis),
        "job_try": 1,
    }


async def _meeting(engine: AsyncEngine, meeting_id: int) -> Meeting:
    async with AsyncSession(engine) as session:
        meeting = await session.get(Meeting, meeting_id)
        assert meeting is not None
        return meeting


async def test_cached_address_resolves_before_enqueue(
    client: httpx.AsyncClient,
    engine: AsyncEngine,
    redis: Redis,
    create_user: CreateUser,
    auth_headers: AuthHeaders,
) -> None:
    address = "Санкт-Петербург, Литейный 12"
    async with AsyncSession(engine) as session:
        session.add(
            GeocodeCache(
                query_hash=address_hash(address),
                query=address,
                address_norm="Литейный проспект, 12",
                lat=59.94,
                lon=30.35,
            )
        )
        await session.commit()
    response = await create_meeting(client, await create_user(), auth_headers)
    assert response.status_code == 201, response.text
    data = response.json()
    assert (data["geo_status"], data["lat"], data["lon"]) == ("resolved", 59.94, 30.35)
    assert not await redis.exists(f"arq:job:geo:{data['id']}")


async def test_worker_resolves_and_second_meeting_uses_cache(
    client: httpx.AsyncClient,
    app: FastAPI,
    engine: AsyncEngine,
    redis: Redis,
    settings: Settings,
    create_user: CreateUser,
    auth_headers: AuthHeaders,
) -> None:
    owner = await create_user()
    created = await create_meeting(client, owner, auth_headers)
    assert created.status_code == 201, created.text
    meeting_id = created.json()["id"]
    assert created.json()["geo_status"] == "pending"
    assert await redis.exists(f"arq:job:geo:{meeting_id}")
    with respx.mock:
        route = respx.get("https://nominatim.openstreetmap.org/search").mock(
            return_value=httpx.Response(
                200, json=[{"lat": "59.95", "lon": "30.34", "display_name": "Литейный, 12"}]
            )
        )
        async with httpx.AsyncClient() as http:
            ctx = await _worker_context(engine, redis, settings, http, app.state.arq_pool)
            await geocode_meeting(ctx, meeting_id)
        assert route.call_count == 1
    saved = await _meeting(engine, meeting_id)
    assert (saved.geo_status, saved.lat, saved.lon) == (GeoStatus.RESOLVED, 59.95, 30.34)
    second = await create_meeting(client, owner, auth_headers, title="Вторая встреча")
    assert second.status_code == 201
    assert second.json()["geo_status"] == "resolved"
    assert not await redis.exists(f"arq:job:geo:{second.json()['id']}")


@pytest.mark.parametrize("status_code", [503, 429])
async def test_unavailable_retries_then_fails(
    status_code: int,
    client: httpx.AsyncClient,
    app: FastAPI,
    engine: AsyncEngine,
    redis: Redis,
    settings: Settings,
    create_user: CreateUser,
    auth_headers: AuthHeaders,
) -> None:
    response = await create_meeting(client, await create_user(), auth_headers)
    meeting_id = response.json()["id"]
    with respx.mock:
        route = respx.get("https://nominatim.openstreetmap.org/search").mock(
            return_value=httpx.Response(status_code)
        )
        async with httpx.AsyncClient() as http:
            ctx = await _worker_context(engine, redis, settings, http, app.state.arq_pool)
            with pytest.raises(Retry) as retry:
                await geocode_meeting(ctx, meeting_id)
            assert retry.value.defer_score == 300_000
            assert (await _meeting(engine, meeting_id)).geo_status == GeoStatus.PENDING
            assert route.call_count == settings.geocoder_retries + 1
            ctx["job_try"] = 4
            await geocode_meeting(ctx, meeting_id)
    assert (await _meeting(engine, meeting_id)).geo_status == GeoStatus.FAILED


async def test_not_found_and_open_breaker(
    client: httpx.AsyncClient,
    app: FastAPI,
    engine: AsyncEngine,
    redis: Redis,
    settings: Settings,
    create_user: CreateUser,
    auth_headers: AuthHeaders,
) -> None:
    first = await create_meeting(client, await create_user(), auth_headers)
    first_id = first.json()["id"]
    with respx.mock:
        route = respx.get("https://nominatim.openstreetmap.org/search").mock(
            return_value=httpx.Response(200, json=[])
        )
        async with httpx.AsyncClient() as http:
            ctx = await _worker_context(engine, redis, settings, http, app.state.arq_pool)
            await geocode_meeting(ctx, first_id)
            assert route.call_count == 1
            assert (await _meeting(engine, first_id)).geo_status == GeoStatus.FAILED

            second = await create_meeting(client, await create_user(), auth_headers)
            second_id = second.json()["id"]
            for _ in range(settings.cb_fail_max):
                await ctx["breaker"].record_failure()
            with pytest.raises(Retry):
                await geocode_meeting(ctx, second_id)
            assert route.call_count == 1
            assert (await _meeting(engine, second_id)).geo_status == GeoStatus.PENDING


async def test_manual_location_and_sweep(
    client: httpx.AsyncClient,
    app: FastAPI,
    engine: AsyncEngine,
    redis: Redis,
    settings: Settings,
    create_user: CreateUser,
    auth_headers: AuthHeaders,
) -> None:
    owner, stranger = await create_user(), await create_user()
    first = await create_meeting(client, owner, auth_headers)
    meeting_id = first.json()["id"]
    path = f"/api/v1/meetings/{meeting_id}/location"
    point = {"lat": 60.0, "lon": 30.3}
    assert (await client.put(path, json=point)).status_code == 401
    assert (await client.put(path, json=point, headers=auth_headers(stranger))).status_code == 404
    assert (
        await client.put(path, json={"lat": 91, "lon": 30.3}, headers=auth_headers(owner))
    ).status_code == 400
    assert (
        await client.patch(
            f"/api/v1/meetings/{meeting_id}",
            json={"status": "published"},
            headers=auth_headers(owner),
        )
    ).status_code == 200
    version_before = int(await redis.get("feed:version") or 0)
    changed = await client.put(path, json=point, headers=auth_headers(owner))
    assert changed.status_code == 200, changed.text
    assert (changed.json()["geo_status"], changed.json()["lat"]) == ("manual", 60.0)
    assert int(await redis.get("feed:version") or 0) == version_before + 1
    async with httpx.AsyncClient() as http:
        ctx = await _worker_context(engine, redis, settings, http, app.state.arq_pool)
        await geocode_meeting(ctx, meeting_id)
    assert (await _meeting(engine, meeting_id)).geo_status == GeoStatus.MANUAL

    second = await create_meeting(client, owner, auth_headers, title="Старая встреча")
    second_id = second.json()["id"]
    await redis.delete(f"arq:job:geo:{second_id}")
    await redis.zrem("arq:queue", f"geo:{second_id}")
    async with AsyncSession(engine) as session:
        await session.execute(
            update(Meeting)
            .where(Meeting.id == second_id)
            .values(updated_at=datetime.now(UTC) - timedelta(minutes=3))
        )
        await session.commit()
    assert await geocode_pending_sweep(ctx) >= 1
    assert await redis.exists(f"arq:job:geo:{second_id}")

    cancelled = await create_meeting(client, owner, auth_headers, title="Отмена встречи")
    cancelled_id = cancelled.json()["id"]
    await client.patch(
        f"/api/v1/meetings/{cancelled_id}",
        json={"status": "cancelled"},
        headers=auth_headers(owner),
    )
    assert (
        await client.put(
            f"/api/v1/meetings/{cancelled_id}/location", json=point, headers=auth_headers(owner)
        )
    ).status_code == 409


async def test_address_change_requeues_and_worker_ignores_manual_override(
    client: httpx.AsyncClient,
    app: FastAPI,
    engine: AsyncEngine,
    redis: Redis,
    settings: Settings,
    create_user: CreateUser,
    auth_headers: AuthHeaders,
) -> None:
    owner = await create_user()
    created = await create_meeting(client, owner, auth_headers)
    meeting_id = created.json()["id"]
    changed = await client.patch(
        f"/api/v1/meetings/{meeting_id}",
        json={"address": "Санкт-Петербург, Невский 42"},
        headers=auth_headers(owner),
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["geo_status"] == "pending"
    assert await redis.exists(f"arq:job:geo:{meeting_id}")

    async def manual_override(address: str) -> Any:
        result = await client.put(
            f"/api/v1/meetings/{meeting_id}/location",
            json={"lat": 59.97, "lon": 30.31},
            headers=auth_headers(owner),
        )
        assert result.status_code == 200
        return None

    async with httpx.AsyncClient() as http:
        ctx = await _worker_context(engine, redis, settings, http, app.state.arq_pool)
        ctx["nominatim_client"].search = manual_override
        await geocode_meeting(ctx, meeting_id)
    saved = await _meeting(engine, meeting_id)
    assert (saved.geo_status, saved.lat, saved.lon) == (GeoStatus.MANUAL, 59.97, 30.31)


async def test_redis_unavailable_does_not_break_meeting_creation(
    engine: AsyncEngine,
    settings: Settings,
    create_user: CreateUser,
    auth_headers: AuthHeaders,
) -> None:
    owner = await create_user()
    degraded = make_settings(database_url=settings.database_url, redis_url=REFUSED_REDIS_URL)
    app = create_app(degraded)
    async with app_client(app) as client:
        response = await create_meeting(
            client, owner, auth_headers, address="Санкт-Петербург, Улица без Redis 99"
        )
    assert response.status_code == 201, response.text
    assert response.json()["geo_status"] == "pending"
