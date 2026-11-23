from unittest.mock import AsyncMock, NonCallableMagicMock, create_autospec

import pytest

from app.core.errors import ForbiddenError
from app.repositories.chat_repository import ChatRepository
from app.services.chat_service import ChatService


@pytest.fixture
def repository() -> NonCallableMagicMock:
    return create_autospec(ChatRepository, instance=True)


async def test_list_returns_messages_for_authorized_user(repository: NonCallableMagicMock) -> None:
    repository.can_access = AsyncMock(return_value=True)
    repository.list_messages = AsyncMock(return_value=[])

    result = await ChatService(repository).list_messages(meeting_id=5, user_id=7)

    assert result == []
    repository.can_access.assert_awaited_once_with(5, 7)
    repository.list_messages.assert_awaited_once_with(5)


@pytest.mark.parametrize("operation", ["list", "send"])
async def test_forbidden_user_cannot_read_or_write(
    repository: NonCallableMagicMock, operation: str
) -> None:
    repository.can_access = AsyncMock(return_value=False)
    service = ChatService(repository)

    with pytest.raises(ForbiddenError):
        if operation == "list":
            await service.list_messages(meeting_id=5, user_id=7)
        else:
            await service.send(meeting_id=5, user_id=7, body="Привет")

    repository.list_messages.assert_not_awaited()
    repository.add.assert_not_awaited()


async def test_send_saves_message_only_after_permission_check(
    repository: NonCallableMagicMock,
) -> None:
    repository.can_access = AsyncMock(return_value=True)
    message = object()
    repository.add = AsyncMock(return_value=message)

    result = await ChatService(repository).send(meeting_id=5, user_id=7, body="Привет")

    assert result is message
    repository.can_access.assert_awaited_once_with(5, 7)
    repository.add.assert_awaited_once_with(5, 7, "Привет")


def test_message_text_is_trimmed() -> None:
    from app.api.v1.chat import MessageIn

    assert MessageIn(body="  Всем привет!  ").body == "Всем привет!"


@pytest.mark.parametrize("body", ["", "   ", "x" * 2001])
def test_message_rejects_empty_or_too_long_text(body: str) -> None:
    from pydantic import ValidationError

    from app.api.v1.chat import MessageIn

    with pytest.raises(ValidationError):
        MessageIn(body=body)
