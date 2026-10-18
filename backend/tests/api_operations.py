"""Все операции контракта /api/v1: доступ и пример корректного запроса.

Таблица должна совпадать с OpenAPI (это проверяет tests/unit/test_openapi_contract.py);
при добавлении эндпоинта сюда добавляется строка. Когда заглушка заменяется реализацией,
операция помечается ``implemented=True``: проверки 501 из test_api_stubs.py её больше не касаются.
"""

from dataclasses import dataclass, field
from typing import Any, Literal

Access = Literal["none", "optional", "required"]

MEETING_IN = {
    "title": "Настолки в «Кубе»",
    "category": "games",
    "starts_at": "2030-10-13T18:30:00+03:00",
    "duration_minutes": 120,
    "address": "Санкт-Петербург, Литейный пр., 12",
    "capacity": 6,
}


@dataclass(frozen=True)
class Operation:
    operation_id: str
    method: str
    path: str
    url: str
    access: Access
    request: dict[str, Any] = field(default_factory=dict)
    implemented: bool = False


OPERATIONS = [
    Operation(
        "register",
        "POST",
        "/api/v1/auth/register",
        "/api/v1/auth/register",
        "none",
        {
            "json": {
                "email": "anya@edu.spbstu.ru",
                "password": "password-123",
                "display_name": "Аня",
            }
        },
        implemented=True,
    ),
    Operation(
        "login",
        "POST",
        "/api/v1/auth/login",
        "/api/v1/auth/login",
        "none",
        {"json": {"email": "anya@edu.spbstu.ru", "password": "password-123"}},
        implemented=True,
    ),
    Operation(
        "refresh",
        "POST",
        "/api/v1/auth/refresh",
        "/api/v1/auth/refresh",
        "none",
        {"json": {"refresh_token": "token"}},
        implemented=True,
    ),
    Operation(
        "logout",
        "POST",
        "/api/v1/auth/logout",
        "/api/v1/auth/logout",
        "none",
        {"json": {"refresh_token": "token"}},
        implemented=True,
    ),
    Operation("get_me", "GET", "/api/v1/users/me", "/api/v1/users/me", "required"),
    Operation(
        "list_my_meetings",
        "GET",
        "/api/v1/users/me/meetings",
        "/api/v1/users/me/meetings",
        "required",
        {"params": {"limit": 10}},
    ),
    Operation(
        "list_my_applications",
        "GET",
        "/api/v1/users/me/applications",
        "/api/v1/users/me/applications",
        "required",
        {"params": {"status": "waitlist"}},
    ),
    Operation("get_user", "GET", "/api/v1/users/{user_id}", "/api/v1/users/1", "optional"),
    Operation("list_categories", "GET", "/api/v1/categories", "/api/v1/categories", "none"),
    Operation(
        "list_meetings",
        "GET",
        "/api/v1/meetings",
        "/api/v1/meetings",
        "optional",
        {
            "params": {
                "category": "games",
                "date": "2030-10-13",
                "lat": 60.0,
                "lon": 30.37,
                "radius_km": 3,
                "has_free_places": "true",
                "q": "настолки",
                "limit": 20,
            }
        },
    ),
    Operation(
        "list_meetings_on_map",
        "GET",
        "/api/v1/meetings/map",
        "/api/v1/meetings/map",
        "optional",
        {"params": {"bbox": "30.25,59.90,30.45,60.05", "category": "sport"}},
    ),
    Operation(
        "create_meeting",
        "POST",
        "/api/v1/meetings",
        "/api/v1/meetings",
        "required",
        {"json": MEETING_IN},
    ),
    Operation(
        "get_meeting", "GET", "/api/v1/meetings/{meeting_id}", "/api/v1/meetings/1", "optional"
    ),
    Operation(
        "update_meeting",
        "PATCH",
        "/api/v1/meetings/{meeting_id}",
        "/api/v1/meetings/1",
        "required",
        {"json": {"status": "published", "address_hint": None}},
    ),
    Operation(
        "set_meeting_location",
        "PUT",
        "/api/v1/meetings/{meeting_id}/location",
        "/api/v1/meetings/1/location",
        "required",
        {"json": {"lat": 60.007, "lon": 30.373}},
    ),
    Operation(
        "apply_to_meeting",
        "POST",
        "/api/v1/meetings/{meeting_id}/applications",
        "/api/v1/meetings/1/applications",
        "required",
    ),
    Operation(
        "list_meeting_applications",
        "GET",
        "/api/v1/meetings/{meeting_id}/applications",
        "/api/v1/meetings/1/applications",
        "required",
        {"params": {"status": "pending"}},
    ),
    Operation(
        "withdraw_my_application",
        "DELETE",
        "/api/v1/meetings/{meeting_id}/applications/me",
        "/api/v1/meetings/1/applications/me",
        "required",
    ),
    Operation(
        "decide_application",
        "POST",
        "/api/v1/applications/{application_id}/decision",
        "/api/v1/applications/1/decision",
        "required",
        {"json": {"decision": "accepted"}},
    ),
]
