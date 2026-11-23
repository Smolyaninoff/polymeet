"""Профили пользователей."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.models.user import User
from app.repositories.user_repository import UserRepository


class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self._users = UserRepository(session)
        self._session = session

    async def get(self, user_id: int) -> User:
        user = await self._users.get_by_id(user_id)
        if user is None:
            raise NotFoundError("Пользователь не найден")
        return user

    async def update(self, user: User, values: dict[str, object]) -> User:
        for name, value in values.items():
            if value is not None:
                setattr(user, name, value)
        await self._session.commit()
        await self._session.refresh(user)
        return user
