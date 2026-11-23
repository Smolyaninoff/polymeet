from app.core.errors import ForbiddenError
from app.models.chat_message import ChatMessage
from app.repositories.chat_repository import ChatRepository


class ChatService:
    def __init__(self, repository: ChatRepository) -> None:
        self.repository = repository

    async def check_access(self, meeting_id: int, user_id: int) -> None:
        if not await self.repository.can_access(meeting_id, user_id):
            raise ForbiddenError("Чат доступен организатору и принятым участникам")

    async def list_messages(self, meeting_id: int, user_id: int) -> list[tuple[ChatMessage, str]]:
        await self.check_access(meeting_id, user_id)
        return await self.repository.list_messages(meeting_id)

    async def send(self, meeting_id: int, user_id: int, body: str) -> ChatMessage:
        await self.check_access(meeting_id, user_id)
        return await self.repository.add(meeting_id, user_id, body)
