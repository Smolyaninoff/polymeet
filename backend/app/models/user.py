from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Identity,
    Integer,
    SmallInteger,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import CITEXT
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("char_length(display_name) BETWEEN 2 AND 50", name="display_name_length"),
        CheckConstraint("attended_count BETWEEN 0 AND marked_count", name="attendance_counts"),
    )
    # Значения по умолчанию задаёт БД; RETURNING сразу подгружает их в объект.
    __mapper_args__ = {"eager_defaults": True}

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    email: Mapped[str] = mapped_column(CITEXT, unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    display_name: Mapped[str] = mapped_column(Text)
    university: Mapped[str] = mapped_column(Text, server_default="")
    faculty: Mapped[str] = mapped_column(Text, server_default="")
    telegram_username: Mapped[str] = mapped_column(Text, server_default="")
    bio: Mapped[str] = mapped_column(Text, server_default="")
    telegram_notifications: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    nearby_notifications: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    contacts_accepted_only: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    show_location: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    notification_radius_km: Mapped[int] = mapped_column(Integer, server_default="10")
    role: Mapped[int] = mapped_column(SmallInteger, server_default="0")
    # Надёжность участника (README, ER): на скольких отмеченных встречах он был.
    # Отметка явки в эту фазу не входит, счётчики пока остаются нулевыми.
    attended_count: Mapped[int] = mapped_column(Integer, server_default="0")
    marked_count: Mapped[int] = mapped_column(Integer, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    @property
    def attendance_rate(self) -> float | None:
        """Доля посещённых среди отмеченных встреч; ``None``, пока отметок нет."""
        return self.attended_count / self.marked_count if self.marked_count else None
