import httpx

from tests.integration.helpers import AuthHeaders, CreateUser


async def test_registered_user_reads_own_profile_with_issued_token(
    client: httpx.AsyncClient,
) -> None:
    registered = await client.post(
        "/api/v1/auth/register",
        json={"email": "anya@edu.spbstu.ru", "password": "password-123", "display_name": "Аня"},
    )
    body = registered.json()

    me = await client.get(
        "/api/v1/users/me", headers={"Authorization": f"Bearer {body['access_token']}"}
    )

    assert me.status_code == 200, me.text
    assert me.json() == body["user"]
    # Явку ещё никто не отмечал: надёжность не 0, а неизвестна
    assert me.json()["attendance_rate"] is None


async def test_public_profile_hides_private_fields(
    client: httpx.AsyncClient, create_user: CreateUser, auth_headers: AuthHeaders
) -> None:
    user = await create_user(email="anya@edu.spbstu.ru", display_name="Аня")
    viewer = await create_user()
    expected = {
        "id": user.id,
        "display_name": "Аня",
        "attended_count": 0,
        "marked_count": 0,
        "attendance_rate": None,
    }

    anonymous = await client.get(f"/api/v1/users/{user.id}")
    authorized = await client.get(f"/api/v1/users/{user.id}", headers=auth_headers(viewer))

    assert (anonymous.status_code, anonymous.json()) == (200, expected)
    assert (authorized.status_code, authorized.json()) == (200, expected)


async def test_profile_of_missing_user_is_not_found(
    client: httpx.AsyncClient, create_user: CreateUser
) -> None:
    user = await create_user()

    response = await client.get(f"/api/v1/users/{user.id + 1}")

    assert response.status_code == 404
    assert response.json()["code"] == "NOT_FOUND"
