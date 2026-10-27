import httpx
import pytest

from tests.fakes.nominatim.app import app


@pytest.mark.asyncio
async def test_fake_nominatim_control_and_stats() -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://fake") as client:
        await client.post("/_control", json={"mode": "ok"})
        first = (await client.get("/search", params={"q": "Невский 1"})).json()
        again = (await client.get("/search", params={"q": "Невский 1"})).json()
        assert first == again
        assert 59.85 <= float(first[0]["lat"]) <= 60.0
        assert 30.2 <= float(first[0]["lon"]) <= 30.5
        assert (await client.get("/search", params={"q": "несуществующий адрес"})).json() == []
        await client.post("/_control", json={"mode": "error"})
        assert (await client.get("/search", params={"q": "Невский"})).status_code == 503
        await client.post("/_control", json={"mode": "slow", "delay": 0})
        assert (await client.get("/search", params={"q": "Невский"})).status_code == 200
        stats = (await client.get("/_stats")).json()
        assert stats["count"] >= 5
        assert len(stats["timestamps"]) == stats["count"]
