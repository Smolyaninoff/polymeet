"""Регистрация, вход, ротация refresh-токена и выход."""

import math
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime

import structlog
from redis.asyncio import Redis
from redis.exceptions import RedisError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.db import is_unique_violation
from app.core.errors import (
    DependencyUnavailableError,
    EmailTakenError,
    InvalidCredentialsError,
    UnauthorizedError,
    ValidationAppError,
)
from app.core.ids import new_id
from app.core.rate_limit import LoginRateLimiter
from app.core.security import (
    INVALID_TOKEN_MESSAGE,
    TokenClaims,
    create_token,
    decode_token,
    hash_password,
    user_id_from_subject,
    verify_password,
)
from app.models.user import User
from app.repositories.user_repository import UserRepository

logger = structlog.get_logger(__name__)

DISPLAY_NAME_MIN_LENGTH = 2


@dataclass(frozen=True, slots=True)
class AuthTokens:
    access_token: str
    refresh_token: str
    expires_in: int
    user: User


def normalize_email(email: str) -> str:
    return email.strip().lower()


def check_email_domain(email: str, allowed_domains: Sequence[str]) -> None:
    """Пустой список разрешает любой домен; иначе домен должен совпасть с одним из списка."""
    if allowed_domains and email.rpartition("@")[2] not in allowed_domains:
        raise ValidationAppError.for_field(
            "email", "Регистрация открыта только для адресов " + ", ".join(allowed_domains)
        )


def check_password(password: str, email: str) -> None:
    """``email`` — уже нормализованный адрес."""
    if normalize_email(password) == email:
        raise ValidationAppError.for_field("password", "Пароль не должен совпадать с e-mail")


def normalize_display_name(display_name: str) -> str:
    name = display_name.strip()
    if len(name) < DISPLAY_NAME_MIN_LENGTH:
        raise ValidationAppError.for_field(
            "display_name", f"Имя должно быть не короче {DISPLAY_NAME_MIN_LENGTH} символов"
        )
    return name


_dummy_hashes: dict[tuple[int, int, int], str] = {}


async def _dummy_password_hash(settings: Settings) -> str:
    """Хэш с теми же параметрами, что у настоящих: им проверяется пароль несуществующего
    пользователя, чтобы время ответа не выдавало, зарегистрирован ли e-mail."""
    key = (settings.argon2_time_cost, settings.argon2_memory_cost, settings.argon2_parallelism)
    if key not in _dummy_hashes:
        _dummy_hashes[key] = await hash_password(new_id(), settings=settings)
    return _dummy_hashes[key]


def _revoked_key(jti: str) -> str:
    return f"rt:revoked:{jti}"


class AuthService:
    def __init__(self, session: AsyncSession, redis: Redis, settings: Settings) -> None:
        self._session = session
        self._users = UserRepository(session)
        self._redis = redis
        self._settings = settings
        self._login_limiter = LoginRateLimiter(
            redis,
            attempts=settings.auth_rate_limit_attempts,
            window_sec=settings.auth_rate_limit_window_sec,
        )

    async def register(self, *, email: str, password: str, display_name: str) -> AuthTokens:
        email = normalize_email(email)
        check_email_domain(email, self._settings.allowed_email_domains)
        check_password(password, email)
        display_name = normalize_display_name(display_name)
        password_hash = await hash_password(password, settings=self._settings)

        # Уникальность e-mail обеспечивает индекс, без предварительной проверки.
        try:
            user = await self._users.create(
                email=email, password_hash=password_hash, display_name=display_name
            )
            await self._session.commit()
        except IntegrityError as exc:
            await self._session.rollback()
            if is_unique_violation(exc):
                raise EmailTakenError() from exc
            raise
        logger.info("user_registered", user_id=user.id)
        return self._issue_tokens(user)

    async def login(self, *, email: str, password: str, client_ip: str) -> AuthTokens:
        await self._login_limiter.check(client_ip)
        user = await self._users.get_by_email(normalize_email(email))
        password_hash = user.password_hash if user else await _dummy_password_hash(self._settings)
        password_ok = await verify_password(password, password_hash)
        if user is None or not password_ok:
            await self._login_limiter.register_failure(client_ip)
            raise InvalidCredentialsError()
        await self._login_limiter.reset(client_ip)
        return self._issue_tokens(user)

    async def refresh(self, refresh_token: str) -> AuthTokens:
        """Ротация: старый токен отзывается, выдаётся новая пара.

        Отзыв — одна атомарная операция ``SET NX``: из параллельных запросов с одним
        токеном новую пару получает ровно один, остальные — 401.
        """
        claims = decode_token(refresh_token, "refresh", settings=self._settings)
        user_id = user_id_from_subject(claims.sub)
        user = await self._users.get_by_id(user_id) if user_id else None
        if user is None:
            raise UnauthorizedError(INVALID_TOKEN_MESSAGE)
        if not await self._revoke(claims):
            logger.warning("refresh_token_reused", user_id=user.id)
            raise UnauthorizedError(INVALID_TOKEN_MESSAGE)
        return self._issue_tokens(user)

    async def logout(self, refresh_token: str) -> None:
        """Отзывает refresh-токен; повторный выход с тем же токеном не ошибка."""
        claims = decode_token(refresh_token, "refresh", settings=self._settings)
        await self._revoke(claims)

    async def _revoke(self, claims: TokenClaims) -> bool:
        """Помечает ``jti`` отозванным до истечения токена. ``False`` — уже был отозван.

        Без Redis отзыв не проверить, а безопасной деградации нет: 503.
        """
        remaining = (claims.expires_at - datetime.now(UTC)).total_seconds()
        try:
            created = await self._redis.set(
                _revoked_key(claims.jti), 1, nx=True, ex=max(1, math.ceil(remaining))
            )
        except RedisError as exc:
            logger.warning("token_revocation_unavailable", error=str(exc))
            raise DependencyUnavailableError() from exc
        return bool(created)

    def _issue_tokens(self, user: User) -> AuthTokens:
        sub = str(user.id)
        return AuthTokens(
            access_token=create_token(sub, "access", settings=self._settings),
            refresh_token=create_token(sub, "refresh", settings=self._settings),
            expires_in=self._settings.jwt_access_ttl_min * 60,
            user=user,
        )
