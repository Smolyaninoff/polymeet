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


async def test_profile_update_is_persisted_and_private(
    client: httpx.AsyncClient, create_user: CreateUser, auth_headers: AuthHeaders
) -> None:
    user = await create_user()
    headers = auth_headers(user)
    updated = await client.patch(
        "/api/v1/users/me",
        headers=headers,
        json={"display_name": "Новое имя", "university": "Политех", "show_location": True},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["university"] == "Политех"
    assert (await client.get("/api/v1/users/me", headers=headers)).json()["show_location"] is True
    assert "university" not in (await client.get(f"/api/v1/users/{user.id}")).json()
    assert (
        await client.patch("/api/v1/users/me", json={"display_name": "Чужое"})
    ).status_code == 401


async def test_change_password_requires_current_password(
    client: httpx.AsyncClient, create_user: CreateUser, auth_headers: AuthHeaders
) -> None:
    user = await create_user(email="change@example.com", password="old-password-123")
    path = "/api/v1/auth/change-password"
    wrong = await client.post(
        path,
        headers=auth_headers(user),
        json={"current_password": "wrong", "new_password": "new-password-456"},
    )
    assert wrong.status_code == 401
    changed = await client.post(
        path,
        headers=auth_headers(user),
        json={"current_password": "old-password-123", "new_password": "new-password-456"},
    )
    assert changed.status_code == 204, changed.text
    old_login = await client.post(
        "/api/v1/auth/login", json={"email": user.email, "password": "old-password-123"}
    )
    new_login = await client.post(
        "/api/v1/auth/login", json={"email": user.email, "password": "new-password-456"}
    )
    assert old_login.status_code == 401
    assert new_login.status_code == 200
