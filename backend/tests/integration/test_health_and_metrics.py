import asyncio
import time
from collections.abc import AsyncIterator

import httpx
import pytest

from app.core.config import Settings
from app.main import create_app
from tests.integration.helpers import REFUSED_REDIS_URL, app_client

# Порт 1 на localhost закрыт: соединение сразу отклоняется.
REFUSED_DATABASE_URL = "postgresql+asyncpg://polymeet:polymeet@127.0.0.1:1/polymeet"


async def _ready(settings: Settings) -> httpx.Response:
    async with app_client(create_app(settings)) as client:
        return await client.get("/health/ready")


async def test_ready_when_all_dependencies_work(client: httpx.AsyncClient) -> None:
    response = await client.get("/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "db": "ok", "redis": "ok"}


async def test_ready_is_degraded_without_redis(settings: Settings) -> None:
    response = await _ready(settings.model_copy(update={"redis_url": REFUSED_REDIS_URL}))

    assert response.status_code == 200
    assert response.json() == {"status": "degraded", "db": "ok", "redis": "down"}


async def test_not_ready_without_database(settings: Settings) -> None:
    response = await _ready(settings.model_copy(update={"database_url": REFUSED_DATABASE_URL}))

    assert response.status_code == 503
    assert response.json() == {"status": "unavailable", "db": "down", "redis": "ok"}


@pytest.fixture
async def silent_tcp_port() -> AsyncIterator[int]:
    """Порт, который принимает соединения и ничего не отвечает."""
    writers: list[asyncio.StreamWriter] = []

    async def hold(_: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        writers.append(writer)

    server = await asyncio.start_server(hold, "127.0.0.1", 0)
    yield server.sockets[0].getsockname()[1]
    for writer in writers:
        writer.close()
    server.close()
    await server.wait_closed()


async def test_ready_check_is_bounded_by_timeout(settings: Settings, silent_tcp_port: int) -> None:
    hanging = settings.model_copy(update={"redis_url": f"redis://127.0.0.1:{silent_tcp_port}/0"})

    started = time.monotonic()
    response = await _ready(hanging)

    assert response.json()["redis"] == "down"
    assert time.monotonic() - started < 2.5


async def test_metrics_expose_request_duration_histogram(
    client: httpx.AsyncClient,
) -> None:
    await client.get("/health")
    await client.get("/api/openapi.json")

    response = await client.get("/metrics")

    assert response.status_code == 200
    buckets = {
        float(line.split('le="')[1].split('"')[0])
        for line in response.text.splitlines()
        if line.startswith("http_request_duration_seconds_bucket{")
        and 'handler="/api/openapi.json"' in line
    }
    assert buckets == {0.02, 0.05, 0.08, 0.1, 0.15, 0.2, 0.3, 0.5, 1, 2, float("inf")}
    assert 'handler="/health' not in response.text
    assert 'handler="/metrics"' not in response.text


async def test_metrics_endpoint_is_not_in_openapi(client: httpx.AsyncClient) -> None:
    paths = (await client.get("/api/openapi.json")).json()["paths"]

    assert "/metrics" not in paths
    assert {"/health", "/health/ready"} <= set(paths)
