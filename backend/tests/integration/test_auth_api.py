import asyncio
from typing import Any

import httpx
import pytest
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.config import Settings
from app.core.security import create_token, decode_token
from app.main import create_app
from tests.integration.helpers import DEFAULT_PASSWORD, REFUSED_REDIS_URL, CreateUser, app_client

REGISTER = "/api/v1/auth/register"
LOGIN = "/api/v1/auth/login"
REFRESH = "/api/v1/auth/refresh"
LOGOUT = "/api/v1/auth/logout"


def _registration(**overrides: Any) -> dict[str, Any]:
    return {
        "email": "anya@edu.spbstu.ru",
        "password": "password-123",
        "display_name": "Аня",
        **overrides,
    }


async def test_register_creates_user_and_issues_token_pair(
    client: httpx.AsyncClient, settings: Settings
) -> None:
    response = await client.post(
        REGISTER, json=_registration(email="Anya@EDU.spbstu.ru", display_name="  Аня  ")
    )

    assert response.status_code == 201, response.text
    body = response.json()
    user = body["user"]
    assert (user["email"], user["display_name"]) == ("anya@edu.spbstu.ru", "Аня")
    assert (body["token_type"], body["expires_in"]) == ("bearer", settings.jwt_access_ttl_min * 60)
    access = decode_token(body["access_token"], "access", settings=settings)
    refresh = decode_token(body["refresh_token"], "refresh", settings=settings)
    assert access.sub == refresh.sub == str(user["id"])


async def test_register_same_email_in_other_case_is_conflict(client: httpx.AsyncClient) -> None:
    first = await client.post(REGISTER, json=_registration(email="anya@edu.spbstu.ru"))
    second = await client.post(REGISTER, json=_registration(email="ANYA@edu.spbstu.ru"))

    assert first.status_code == 201
    assert second.status_code == 409
    assert second.json()["code"] == "EMAIL_TAKEN"


@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"password": "ANYA@edu.spbstu.ru"}, "password"),
        ({"display_name": "  Я  "}, "display_name"),
    ],
)
async def test_register_rejects_by_business_rules(
    client: httpx.AsyncClient, overrides: dict[str, str], field: str
) -> None:
    response = await client.post(REGISTER, json=_registration(**overrides))

    assert response.status_code == 400
    problem = response.json()
    assert problem["code"] == "VALIDATION_ERROR"
    assert [error["field"] for error in problem["errors"]] == [field]
    # Ничего не записано: тот же e-mail регистрируется без конфликта
    retry = await client.post(REGISTER, json=_registration())
    assert retry.status_code == 201


async def test_register_only_from_allowed_domains(settings: Settings) -> None:
    restricted = settings.model_copy(update={"allowed_email_domains": ["edu.spbstu.ru"]})

    async with app_client(create_app(restricted)) as client:
        foreign = await client.post(REGISTER, json=_registration(email="anya@gmail.com"))
        allowed = await client.post(REGISTER, json=_registration(email="anya@EDU.spbstu.ru"))

    assert foreign.status_code == 400
    assert [error["field"] for error in foreign.json()["errors"]] == ["email"]
    assert allowed.status_code == 201


async def test_login_accepts_email_in_any_case(
    client: httpx.AsyncClient, create_user: CreateUser, settings: Settings
) -> None:
    user = await create_user(email="anya@edu.spbstu.ru")

    response = await client.post(
        LOGIN, json={"email": "Anya@Edu.SPbSTU.ru", "password": DEFAULT_PASSWORD}
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["user"]["id"] == user.id
    assert decode_token(body["access_token"], "access", settings=settings).sub == str(user.id)


async def test_wrong_password_and_unknown_email_get_identical_answer(
    client: httpx.AsyncClient, create_user: CreateUser
) -> None:
    await create_user(email="anya@edu.spbstu.ru")

    wrong_password = await client.post(
        LOGIN, json={"email": "anya@edu.spbstu.ru", "password": "not-the-password"}
    )
    unknown_email = await client.post(
        LOGIN, json={"email": "nobody@edu.spbstu.ru", "password": "not-the-password"}
    )

    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json()
    assert wrong_password.json()["code"] == "INVALID_CREDENTIALS"


async def _login(client: httpx.AsyncClient, create_user: CreateUser) -> dict[str, Any]:
    user = await create_user()
    response = await client.post(LOGIN, json={"email": user.email, "password": DEFAULT_PASSWORD})
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


async def test_refresh_rotates_pair_and_old_token_is_rejected(
    client: httpx.AsyncClient, create_user: CreateUser, settings: Settings
) -> None:
    tokens = await _login(client, create_user)

    rotated = await client.post(REFRESH, json={"refresh_token": tokens["refresh_token"]})
    reused = await client.post(REFRESH, json={"refresh_token": tokens["refresh_token"]})

    assert rotated.status_code == 200, rotated.text
    new = rotated.json()
    assert new["refresh_token"] != tokens["refresh_token"]
    assert new["user"] == tokens["user"]
    assert decode_token(new["access_token"], "access", settings=settings).sub == str(
        tokens["user"]["id"]
    )
    assert reused.status_code == 401
    assert reused.json()["code"] == "UNAUTHORIZED"
    # Новый токен из ротации работает
    next_rotation = await client.post(REFRESH, json={"refresh_token": new["refresh_token"]})
    assert next_rotation.status_code == 200


async def test_parallel_refresh_with_one_token_succeeds_once(
    client: httpx.AsyncClient, create_user: CreateUser
) -> None:
    tokens = await _login(client, create_user)

    responses = await asyncio.gather(
        *(client.post(REFRESH, json={"refresh_token": tokens["refresh_token"]}) for _ in range(5))
    )

    assert sorted(response.status_code for response in responses) == [200, 401, 401, 401, 401]


@pytest.mark.parametrize("case", ["access_instead_of_refresh", "deleted_user"])
async def test_refresh_rejects_token_that_cannot_be_rotated(
    client: httpx.AsyncClient,
    engine: AsyncEngine,
    create_user: CreateUser,
    settings: Settings,
    case: str,
) -> None:
    user = await create_user()
    token = create_token(
        str(user.id),
        "access" if case == "access_instead_of_refresh" else "refresh",
        settings=settings,
    )
    if case == "deleted_user":
        async with engine.begin() as conn:
            await conn.execute(text("DELETE FROM users WHERE id = :id"), {"id": user.id})

    response = await client.post(REFRESH, json={"refresh_token": token})

    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHORIZED"


async def test_logout_revokes_refresh_token_until_it_expires(
    client: httpx.AsyncClient, redis: Redis, create_user: CreateUser, settings: Settings
) -> None:
    tokens = await _login(client, create_user)
    jti = decode_token(tokens["refresh_token"], "refresh", settings=settings).jti

    logout = await client.post(LOGOUT, json={"refresh_token": tokens["refresh_token"]})
    repeated = await client.post(LOGOUT, json={"refresh_token": tokens["refresh_token"]})
    refresh = await client.post(REFRESH, json={"refresh_token": tokens["refresh_token"]})

    assert (logout.status_code, logout.content) == (204, b"")
    assert repeated.status_code == 204
    assert refresh.status_code == 401
    # Отметка об отзыве живёт столько же, сколько сам токен, и не копится бесконечно
    ttl = await redis.ttl(f"rt:revoked:{jti}")
    assert settings.jwt_refresh_ttl_days * 86400 - 60 < ttl <= settings.jwt_refresh_ttl_days * 86400


async def test_without_redis_login_works_but_token_revocation_is_unavailable(
    settings: Settings, create_user: CreateUser
) -> None:
    user = await create_user()
    no_redis = settings.model_copy(update={"redis_url": REFUSED_REDIS_URL})

    async with app_client(create_app(no_redis)) as client:
        login = await client.post(LOGIN, json={"email": user.email, "password": DEFAULT_PASSWORD})
        refresh_token = login.json()["refresh_token"]
        refresh = await client.post(REFRESH, json={"refresh_token": refresh_token})
        logout = await client.post(LOGOUT, json={"refresh_token": refresh_token})

    assert login.status_code == 200, login.text
    assert refresh.status_code == logout.status_code == 503
    assert refresh.json()["code"] == logout.json()["code"] == "DEPENDENCY_UNAVAILABLE"
