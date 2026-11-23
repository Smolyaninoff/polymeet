from datetime import datetime
from typing import Annotated

from fastapi import APIRouter
from pydantic import BaseModel, Field, field_validator

from app.api.deps import CurrentUser, SessionDep
from app.repositories.chat_repository import ChatRepository
from app.services.chat_service import ChatService

router = APIRouter(prefix="/meetings/{meeting_id}/messages", tags=["chat"])


class MessageIn(BaseModel):
    body: Annotated[str, Field(min_length=1, max_length=2000)]

    @field_validator("body", mode="before")
    @classmethod
    def strip_body(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class MessageOut(BaseModel):
    id: int
    meeting_id: int
    author_id: int
    author_name: str
    body: str
    created_at: datetime


@router.get("")
async def list_chat_messages(
    meeting_id: int, user: CurrentUser, session: SessionDep
) -> list[MessageOut]:
    service = ChatService(ChatRepository(session))
    rows = await service.list_messages(meeting_id, user.id)
    return [
        MessageOut(
            id=m.id,
            meeting_id=m.meeting_id,
            author_id=m.author_id,
            author_name=name,
            body=m.body,
            created_at=m.created_at,
        )
        for m, name in rows
    ]


@router.post("", status_code=201)
async def send_chat_message(
    meeting_id: int, payload: MessageIn, user: CurrentUser, session: SessionDep
) -> MessageOut:
    service = ChatService(ChatRepository(session))
    m = await service.send(meeting_id, user.id, payload.body)
    return MessageOut(
        id=m.id,
        meeting_id=m.meeting_id,
        author_id=m.author_id,
        author_name=user.display_name,
        body=m.body,
        created_at=m.created_at,
    )
