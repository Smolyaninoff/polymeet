from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    display_name: str
    university: str
    faculty: str
    telegram_username: str
    bio: str
    telegram_notifications: bool
    nearby_notifications: bool
    contacts_accepted_only: bool
    show_location: bool
    notification_radius_km: int
    role: int = Field(description="Роль: 0 — обычный пользователь")
    attended_count: int = Field(description="На скольких отмеченных встречах участник был")
    marked_count: int = Field(description="На скольких встречах ему отмечали явку")
    attendance_rate: float | None = Field(
        description="Надёжность: attended_count / marked_count; `null`, пока отметок нет"
    )
    created_at: datetime


class PublicUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    display_name: str
    attended_count: int
    marked_count: int
    attendance_rate: float | None


class UserUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=2, max_length=50)
    university: str | None = Field(default=None, max_length=200)
    faculty: str | None = Field(default=None, max_length=200)
    telegram_username: str | None = Field(default=None, max_length=100)
    bio: str | None = Field(default=None, max_length=2000)
    telegram_notifications: bool | None = None
    nearby_notifications: bool | None = None
    contacts_accepted_only: bool | None = None
    show_location: bool | None = None
    notification_radius_km: int | None = Field(default=None, ge=1, le=50)
