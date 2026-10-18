from typing import Any

import httpx
import pytest

from app.core.config import Settings
from app.core.security import decode_token
from app.main import create_app
from tests.integration.helpers import DEFAULT_PASSWORD, CreateUser, app_client

REGISTER = "/api/v1/auth/register"
LOGIN = "/api/v1/auth/login"


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
