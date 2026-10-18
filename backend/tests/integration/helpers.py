"""Общие помощники интеграционных тестов: типы фикстур, клиент, Alembic, логи."""

import io
import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import timedelta
from pathlib import Path
from typing import Annotated, Any, Protocol

import httpx
import pytest
from alembic.config import Config
from asgi_lifespan import LifespanManager
from fastapi import APIRouter, FastAPI, Query
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser, OptionalUser
from app.core.config import Settings
from app.core.logging import bind_request_context
from app.models.user import User

BACKEND_DIR = Path(__file__).resolve().parents[2]
DEFAULT_PASSWORD = "correct-horse-42"
# Порт 1 на localhost закрыт: соединение сразу отклоняется.
REFUSED_REDIS_URL = "redis://127.0.0.1:1/0"


class CreateUser(Protocol):
    """Фикстура ``create_user``: пользователь создаётся прямо в БД, минуя /auth."""

    async def __call__(
        self,
        email: str | None = None,
        password: str = DEFAULT_PASSWORD,
        display_name: str | None = None,
        role: int = 0,
    ) -> User: ...


class AuthHeaders(Protocol):
    """Фикстура ``auth_headers``: заголовок с access-токеном для пользователя."""

    def __call__(self, user: User, ttl: timedelta | None = None) -> dict[str, str]: ...


@asynccontextmanager
async def app_client(app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    """HTTP-клиент к приложению в памяти, с выполнением lifespan."""
    async with LifespanManager(app) as manager:
        # Ошибки приложения приходят ответом 500, как от настоящего сервера.
        transport = httpx.ASGITransport(app=manager.app, raise_app_exceptions=False)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            yield client


def alembic_config(settings: Settings) -> Config:
    # Вывод команд Alembic (например, check) не нужен в отчёте pytest
    config = Config(str(BACKEND_DIR / "alembic.ini"), stdout=io.StringIO())
    config.attributes["settings"] = settings
    return config


def read_log_records(capsys: pytest.CaptureFixture[str]) -> list[dict[str, Any]]:
    """Строки STDOUT с начала теста (или прошлого чтения); каждая обязана быть JSON."""
    return [json.loads(line) for line in capsys.readouterr().out.splitlines() if line.strip()]


class _EchoIn(BaseModel):
    name: str = Field(min_length=2)
    age: int = Field(ge=0)


def add_probe_routes(app: FastAPI) -> None:
    """Служебные маршруты /_probe/* для проверки обработчиков, middleware и авторизации."""
    router = APIRouter(prefix="/_probe")

    @router.post("/echo")
    async def echo(
        payload: _EchoIn, limit: Annotated[int, Query(ge=1, le=20)] = 10
    ) -> dict[str, Any]:
        return {"name": payload.name, "limit": limit}

    @router.get("/boom")
    async def boom() -> None:
        raise RuntimeError("secret internal detail")

    @router.get("/me")
    async def me(user: CurrentUser) -> dict[str, int]:
        return {"id": user.id}

    @router.get("/maybe-me")
    async def maybe_me(user: OptionalUser) -> dict[str, int | None]:
        return {"id": user.id if user else None}

    @router.get("/items/{item_id}")
    async def item(item_id: int, user: CurrentUser) -> dict[str, Any]:
        bind_request_context(cache="hit")
        return {"item_id": item_id, "user_id": user.id}

    app.include_router(router)
