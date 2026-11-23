"""Проверки работающих API, базы, очереди и тестового геокодера по HTTP."""

import os
import time
import uuid
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from redis import Redis

API = os.environ.get("E2E_API")
GEO = os.environ.get("E2E_FAKE_GEO")
pytestmark = pytest.mark.skipif(not API or not GEO, reason="Нужен тестовый стенд Compose")


@pytest.fixture
def clients():
    with (
        httpx.Client(base_url=API, timeout=10) as api,
        httpx.Client(base_url=GEO, timeout=10) as geo,
    ):
        yield api, geo


def register(api):
    response = api.post(
        "/api/v1/auth/register",
        json={
            "email": f"{uuid.uuid4().hex}@example.com",
            "password": "Password123!",
            "display_name": "Участник",
        },
    )
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def create_meeting(api, headers, address):
    response = api.post(
        "/api/v1/meetings",
        headers=headers,
        json={
            "title": "Вечер настольных игр",
            "category": "games",
            "starts_at": (datetime.now(UTC) + timedelta(days=30)).isoformat(),
            "duration_minutes": 90,
            "address": address,
            "capacity": 2,
            "auto_accept": False,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def wait_for_location(api, meeting_id, headers, timeout=25):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        response = api.get(f"/api/v1/meetings/{meeting_id}", headers=headers)
        assert response.status_code == 200, response.text
        meeting = response.json()
        if meeting["geo_status"] == "resolved":
            return meeting
        time.sleep(0.25)
    pytest.fail(f"Координаты не получены: {meeting}")


def test_meeting_and_waitlist(clients):
    api, geo = clients
    assert geo.post("/_control", json={"mode": "ok"}).status_code == 200
    owner = register(api)
    participants = [register(api) for _ in range(3)]
    created = create_meeting(api, owner, f"Политехническая 29, {uuid.uuid4().hex}")
    meeting_id = created["id"]
    meeting = wait_for_location(api, meeting_id, owner)
    published = api.patch(
        f"/api/v1/meetings/{meeting_id}", headers=owner, json={"status": "published"}
    )
    assert published.status_code == 200, published.text
    feed = api.get("/api/v1/meetings", params={"category": "games"})
    assert feed.status_code == 200
    assert meeting_id in [item["id"] for item in feed.json()["items"]]
    nearby = api.get(
        "/api/v1/meetings",
        params={"lat": meeting["lat"], "lon": meeting["lon"], "radius_km": 5},
    )
    assert nearby.status_code == 200, nearby.text
    assert meeting_id in [item["id"] for item in nearby.json()["items"]]
    for headers in participants[:2]:
        application = api.post(f"/api/v1/meetings/{meeting_id}/applications", headers=headers)
        assert application.status_code == 201, application.text
        assert application.json()["status"] == "pending"
        decision = api.post(
            f"/api/v1/applications/{application.json()['id']}/decision",
            headers=owner,
            json={"decision": "accepted"},
        )
        assert decision.status_code == 200, decision.text
    waiting = api.post(f"/api/v1/meetings/{meeting_id}/applications", headers=participants[2])
    assert waiting.status_code == 201, waiting.text
    assert waiting.json()["status"] == "waitlist"
    withdrawn = api.delete(
        f"/api/v1/meetings/{meeting_id}/applications/me", headers=participants[1]
    )
    assert withdrawn.status_code == 204, withdrawn.text
    current = api.get(f"/api/v1/meetings/{meeting_id}", headers=participants[2]).json()
    assert current["accepted_count"] == 2
    assert current["my_application"]["status"] == "accepted"


def test_geocoding_rate_and_cache(clients):
    from concurrent.futures import ThreadPoolExecutor

    api, geo = clients
    assert geo.post("/_control", json={"mode": "ok"}).status_code == 200
    owner = register(api)
    prefix = uuid.uuid4().hex
    addresses = [f"Санкт-Петербург, тестовый адрес {prefix} {i}" for i in range(6)]
    before = geo.get("/_stats").json()["count"]
    with ThreadPoolExecutor(max_workers=6) as pool:
        created = list(pool.map(lambda address: create_meeting(api, owner, address), addresses))
    resolved = [wait_for_location(api, meeting["id"], owner) for meeting in created]
    stats = geo.get("/_stats").json()
    timestamps = [datetime.fromisoformat(value) for value in stats["timestamps"][before:]]
    assert len(timestamps) == 6
    assert all(
        (later - earlier).total_seconds() >= 0.4
        for earlier, later in zip(timestamps, timestamps[1:], strict=False)
    )
    with ThreadPoolExecutor(max_workers=6) as pool:
        repeated = list(pool.map(lambda address: create_meeting(api, owner, address), addresses))
    cached = [wait_for_location(api, meeting["id"], owner) for meeting in repeated]
    assert [(m["lat"], m["lon"]) for m in cached] == [(m["lat"], m["lon"]) for m in resolved]
    assert geo.get("/_stats").json()["count"] == stats["count"]


def test_geocoder_unavailable_and_manual_location(clients):
    api, geo = clients
    owner = register(api)
    count_before = geo.get("/_stats").json()["count"]
    assert geo.post("/_control", json={"mode": "error"}).status_code == 200
    try:
        start = time.monotonic()
        prefix = uuid.uuid4().hex
        created = create_meeting(api, owner, f"Адрес при отказе {prefix} 0")
        assert time.monotonic() - start < 5
        assert created["geo_status"] == "pending"
        for i in range(1, 6):
            create_meeting(api, owner, f"Адрес при отказе {prefix} {i}")
        with Redis.from_url(os.environ["E2E_REDIS"], decode_responses=True) as redis:
            deadline = time.monotonic() + 20
            while redis.hget("cb:nominatim", "state") != "open" and time.monotonic() < deadline:
                time.sleep(0.1)
            assert redis.hget("cb:nominatim", "state") == "open"
            count_at_open = geo.get("/_stats").json()["count"]
            assert count_at_open >= count_before + 3
            time.sleep(1)
            assert geo.get("/_stats").json()["count"] == count_at_open
        manual = api.put(
            f"/api/v1/meetings/{created['id']}/location",
            headers=owner,
            json={"lat": 59.99, "lon": 30.37},
        )
        assert manual.status_code == 200, manual.text
        assert manual.json()["geo_status"] == "manual"
    finally:
        geo.post("/_control", json={"mode": "ok"})
    recovered = create_meeting(api, owner, f"Адрес после восстановления {uuid.uuid4().hex}")
    assert wait_for_location(api, recovered["id"], owner)["lat"] is not None
    manual_after = api.get(f"/api/v1/meetings/{created['id']}", headers=owner).json()
    assert manual_after["geo_status"] == "manual"
