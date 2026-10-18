from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import cache
from typing import Any, Literal

import anyio.to_thread
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.config import Settings
from app.core.errors import UnauthorizedError
from app.core.ids import new_id

TokenType = Literal["access", "refresh"]

JWT_ALGORITHM = "HS256"
_REQUIRED_CLAIMS = ["sub", "type", "jti", "iat", "exp"]
INVALID_TOKEN_MESSAGE = "Недействительный или просроченный токен"


@cache
def _password_hasher(time_cost: int, memory_cost: int, parallelism: int) -> PasswordHasher:
    return PasswordHasher(time_cost=time_cost, memory_cost=memory_cost, parallelism=parallelism)


async def hash_password(password: str, *, settings: Settings) -> str:
    """Argon2id-хэш. Считается в пуле потоков, чтобы не блокировать event loop."""
    hasher = _password_hasher(
        settings.argon2_time_cost, settings.argon2_memory_cost, settings.argon2_parallelism
    )
    return await anyio.to_thread.run_sync(hasher.hash, password)


def _verify(password: str, password_hash: str) -> bool:
    try:
        # Параметры (время, память, потоки) берутся из самого хэша
        return PasswordHasher().verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


async def verify_password(password: str, password_hash: str) -> bool:
    return await anyio.to_thread.run_sync(_verify, password, password_hash)


@dataclass(frozen=True, slots=True)
class TokenClaims:
    sub: str
    type: TokenType
    jti: str
    issued_at: datetime
    expires_at: datetime


def _default_ttl(type: TokenType, settings: Settings) -> timedelta:
    if type == "access":
        return timedelta(minutes=settings.jwt_access_ttl_min)
    return timedelta(days=settings.jwt_refresh_ttl_days)


def create_token(
    sub: str,
    type: TokenType,
    ttl: timedelta | None = None,
    *,
    settings: Settings,
) -> str:
    """Подписывает JWT (HS256). Без ``ttl`` срок берётся из настроек для данного типа."""
    now = datetime.now(UTC)
    claims: dict[str, Any] = {
        "sub": sub,
        "type": type,
        "jti": new_id(),
        "iat": now,
        "exp": now + (ttl if ttl is not None else _default_ttl(type, settings)),
    }
    return jwt.encode(claims, settings.jwt_secret, algorithm=JWT_ALGORITHM)


def user_id_from_subject(sub: str) -> int | None:
    """id пользователя из ``sub``: в JWT это строка, в базе — положительное число."""
    if sub.isascii() and sub.isdigit() and int(sub) > 0:
        return int(sub)
    return None


def decode_token(token: str, expected_type: TokenType, *, settings: Settings) -> TokenClaims:
    """Проверяет подпись, срок и тип токена; любая ошибка — ``UnauthorizedError``."""
    try:
        claims: dict[str, Any] = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[JWT_ALGORITHM],
            options={"require": _REQUIRED_CLAIMS},
        )
    except jwt.PyJWTError as exc:
        raise UnauthorizedError(INVALID_TOKEN_MESSAGE) from exc

    sub, jti = claims["sub"], claims["jti"]
    if claims["type"] != expected_type or not isinstance(sub, str) or not isinstance(jti, str):
        raise UnauthorizedError(INVALID_TOKEN_MESSAGE)
    return TokenClaims(
        sub=sub,
        type=expected_type,
        jti=jti,
        issued_at=datetime.fromtimestamp(claims["iat"], UTC),
        expires_at=datetime.fromtimestamp(claims["exp"], UTC),
    )
