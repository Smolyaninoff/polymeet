"""ORM-модели. Импорт здесь регистрирует их в ``Base.metadata`` для Alembic."""

from app.models.application import Application
from app.models.base import Base
from app.models.category import Category
from app.models.chat_message import ChatMessage
from app.models.geocode_cache import GeocodeCache
from app.models.meeting import Meeting
from app.models.user import User

__all__ = ["Application", "Base", "Category", "ChatMessage", "GeocodeCache", "Meeting", "User"]
