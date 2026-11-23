from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.application import Application
from app.models.chat_message import ChatMessage
from app.models.enums import ApplicationStatus
from app.models.meeting import Meeting
from app.models.user import User


class ChatRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def can_access(self, meeting_id: int, user_id: int) -> bool:
        meeting = await self.session.get(Meeting, meeting_id)
        if meeting is None:
            return False
        if meeting.organizer_id == user_id:
            return True
        result = await self.session.scalar(
            select(Application.id).where(
                Application.meeting_id == meeting_id,
                Application.user_id == user_id,
                Application.status == ApplicationStatus.ACCEPTED,
            )
        )
        return result is not None

    async def list_messages(self, meeting_id: int) -> list[tuple[ChatMessage, str]]:
        rows = await self.session.execute(
            select(ChatMessage, User.display_name)
            .join(User, User.id == ChatMessage.author_id)
            .where(ChatMessage.meeting_id == meeting_id)
            .order_by(ChatMessage.id.desc())
            .limit(100)
        )
        return list(reversed(list(rows.tuples().all())))

    async def add(self, meeting_id: int, user_id: int, body: str) -> ChatMessage:
        message = ChatMessage(meeting_id=meeting_id, author_id=user_id, body=body)
        self.session.add(message)
        await self.session.commit()
        await self.session.refresh(message)
        return message
