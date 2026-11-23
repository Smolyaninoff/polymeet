import httpx

from app.models.enums import ApplicationStatus
from tests.integration.helpers import AuthHeaders, CreateMeeting, CreateUser


async def test_chat_is_persistent_and_only_available_to_participants(
    client: httpx.AsyncClient,
    create_user: CreateUser,
    create_meeting: CreateMeeting,
    auth_headers: AuthHeaders,
) -> None:
    organizer = await create_user()
    participant = await create_user()
    stranger = await create_user()
    meeting = await create_meeting(organizer, auto_accept=True)
    path = f"/api/v1/meetings/{meeting.id}/messages"
    assert (await client.get(path)).status_code == 401
    assert (await client.get(path, headers=auth_headers(stranger))).status_code == 403
    application = await client.post(
        f"/api/v1/meetings/{meeting.id}/applications", headers=auth_headers(participant)
    )
    assert application.status_code == 201
    assert application.json()["status"] == ApplicationStatus.ACCEPTED.name.lower()
    sent = await client.post(path, headers=auth_headers(participant), json={"body": "  Привет!  "})
    assert sent.status_code == 201, sent.text
    assert sent.json()["body"] == "Привет!"
    loaded = await client.get(path, headers=auth_headers(organizer))
    assert loaded.status_code == 200
    assert loaded.json()[0]["id"] == sent.json()["id"]
    assert loaded.json()[0]["author_id"] == participant.id
    assert (
        await client.post(path, headers=auth_headers(organizer), json={"body": "   "})
    ).status_code == 400
    assert (
        await client.delete(
            f"/api/v1/meetings/{meeting.id}/applications/me", headers=auth_headers(participant)
        )
    ).status_code == 204
    assert (await client.get(path, headers=auth_headers(participant))).status_code == 403
