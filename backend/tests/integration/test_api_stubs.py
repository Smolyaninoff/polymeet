import httpx
import pytest

from app.models.user import User
from tests.api_operations import OPERATIONS, Operation
from tests.integration.helpers import AuthHeaders, CreateUser

STUBS = [op for op in OPERATIONS if not op.implemented]
ANONYMOUS_STUBS = [op for op in STUBS if op.access != "required"]
# Требование токена проверяется и у реализованных операций: зависимость идёт раньше тела.
PROTECTED = [op for op in OPERATIONS if op.access == "required"]


@pytest.fixture
async def user(create_user: CreateUser) -> User:
    return await create_user()


def _assert_not_implemented(response: httpx.Response, op: Operation) -> None:
    assert response.status_code == 501, response.text
    assert response.headers["content-type"] == "application/problem+json"
    problem = response.json()
    assert (problem["code"], problem["instance"]) == ("NOT_IMPLEMENTED", op.url)


@pytest.mark.parametrize("op", ANONYMOUS_STUBS, ids=lambda op: op.operation_id)
async def test_public_stub_answers_not_implemented(
    client: httpx.AsyncClient, op: Operation
) -> None:
    response = await client.request(op.method, op.url, **op.request)

    _assert_not_implemented(response, op)


@pytest.mark.parametrize("op", PROTECTED, ids=lambda op: op.operation_id)
async def test_protected_stub_requires_token(client: httpx.AsyncClient, op: Operation) -> None:
    response = await client.request(op.method, op.url, **op.request)

    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHORIZED"


@pytest.mark.parametrize("op", STUBS, ids=lambda op: op.operation_id)
async def test_stub_with_token_reaches_handler(
    client: httpx.AsyncClient, user: User, auth_headers: AuthHeaders, op: Operation
) -> None:
    response = await client.request(op.method, op.url, headers=auth_headers(user), **op.request)

    _assert_not_implemented(response, op)


@pytest.mark.parametrize(
    "url",
    [
        "/api/v1/meetings/map?bbox=30.25,59.90,30.45,60.05",
        "/api/v1/users/me",
        "/api/v1/users/me/meetings",
    ],
)
async def test_static_paths_are_not_captured_by_id_routes(
    client: httpx.AsyncClient, user: User, auth_headers: AuthHeaders, url: str
) -> None:
    # Если бы /meetings/{meeting_id} или /users/{user_id} перехватили путь,
    # «map» или «me» не прошли бы проверку целого id и ответ был бы 400.
    response = await client.get(url, headers=auth_headers(user))

    assert response.status_code == 501


@pytest.mark.parametrize(
    ("method", "url", "request_kwargs", "field"),
    [
        ("GET", "/api/v1/meetings", {"params": {"limit": 21}}, "limit"),
        ("GET", "/api/v1/meetings", {"params": {"radius_km": 51}}, "radius_km"),
        ("GET", "/api/v1/meetings/map", {"params": {"bbox": "30.25,59.90"}}, "bbox"),
        ("GET", "/api/v1/meetings/0", {}, "meeting_id"),
        ("GET", "/api/v1/users/me/applications", {"params": {"status": "unknown"}}, "status"),
        ("PATCH", "/api/v1/meetings/1", {"json": {"title": None}}, "title"),
        ("PATCH", "/api/v1/meetings/1", {"json": {"status": "draft"}}, "status"),
        (
            "POST",
            "/api/v1/meetings",
            {"json": {"title": "Встреча", "starts_at": "2030-10-13T18:30:00"}},
            "starts_at",
        ),
        (
            "POST",
            "/api/v1/applications/1/decision",
            {"json": {"decision": "withdrawn"}},
            "decision",
        ),
        ("POST", "/api/v1/auth/register", {"json": {"email": "no-at-sign"}}, "email"),
    ],
)
async def test_contract_rejects_invalid_input_before_handler(
    client: httpx.AsyncClient,
    user: User,
    auth_headers: AuthHeaders,
    method: str,
    url: str,
    request_kwargs: dict[str, object],
    field: str,
) -> None:
    response = await client.request(method, url, headers=auth_headers(user), **request_kwargs)

    assert response.status_code == 400
    problem = response.json()
    assert problem["code"] == "VALIDATION_ERROR"
    assert field in {error["field"] for error in problem["errors"]}
