"""Run with: uvicorn tests.fakes.nominatim.app:app --host 0.0.0.0 --port 8080."""

import asyncio
import hashlib
from datetime import UTC, datetime
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

app = FastAPI(title="Fake Nominatim")


class Control(BaseModel):
    mode: Literal["ok", "error", "slow"]
    delay: float = Field(default=3, ge=0)


_mode = "ok"
_delay = 3.0
_requests: list[str] = []


@app.get("/search")
async def search(
    q: str,
    format: str = Query(default="jsonv2"),
    limit: int = Query(default=1),
    accept_language: str = Query(default="ru", alias="accept-language"),
) -> list[dict[str, str]]:
    _requests.append(datetime.now(UTC).isoformat())
    if _mode == "slow":
        await asyncio.sleep(_delay)
    if _mode == "error":
        raise HTTPException(status_code=503, detail="fake Nominatim unavailable")
    if "несуществующий" in q.casefold():
        return []
    digest = hashlib.sha256(q.encode("utf-8")).digest()
    lat = 59.85 + int.from_bytes(digest[:4], "big") / (2**32 - 1) * 0.15
    lon = 30.20 + int.from_bytes(digest[4:8], "big") / (2**32 - 1) * 0.30
    return [{"lat": str(lat), "lon": str(lon), "display_name": q.strip()}]


@app.post("/_control")
async def control(data: Control) -> dict[str, str | float]:
    global _mode, _delay
    _mode, _delay = data.mode, data.delay
    return {"mode": _mode, "delay": _delay}


@app.get("/_stats")
async def stats() -> dict[str, object]:
    return {"count": len(_requests), "timestamps": _requests.copy()}
