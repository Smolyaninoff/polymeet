from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    __table_args__ = (
        CheckConstraint("char_length(body) BETWEEN 1 AND 2000", name="body_length"),
        Index("ix_chat_messages_meeting_id_id", "meeting_id", "id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    meeting_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("meetings.id", ondelete="CASCADE")
    )
    author_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
