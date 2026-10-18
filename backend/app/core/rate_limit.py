"""Ограничение неудачных попыток входа с одного IP: фиксированное окно в Redis.

Если Redis недоступен, лимит не применяется: вход важнее защиты от перебора.
"""

import structlog
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.errors import RateLimitedError

logger = structlog.get_logger(__name__)


class LoginRateLimiter:
    def __init__(self, redis: Redis, *, attempts: int, window_sec: int) -> None:
        self._redis = redis
        self._attempts = attempts
        self._window_sec = window_sec

    @staticmethod
    def _key(ip: str) -> str:
        return f"rl:login:{ip}"

    async def check(self, ip: str) -> None:
        """``RateLimitedError`` с ``Retry-After`` до конца окна, если попытки исчерпаны."""
        key = self._key(ip)
        try:
            async with self._redis.pipeline(transaction=True) as pipe:
                pipe.get(key)
                pipe.ttl(key)
                failures, ttl = await pipe.execute()
        except RedisError as exc:
            self._skip(ip, exc)
            return
        if failures is not None and int(failures) >= self._attempts:
            raise RateLimitedError(retry_after=ttl if ttl > 0 else self._window_sec)

    async def register_failure(self, ip: str) -> None:
        """Окно начинается с первой неудачи; следующие неудачи его не продлевают."""
        key = self._key(ip)
        try:
            async with self._redis.pipeline(transaction=True) as pipe:
                pipe.set(key, 0, ex=self._window_sec, nx=True)
                pipe.incr(key)
                await pipe.execute()
        except RedisError as exc:
            self._skip(ip, exc)

    async def reset(self, ip: str) -> None:
        try:
            await self._redis.delete(self._key(ip))
        except RedisError as exc:
            self._skip(ip, exc)

    @staticmethod
    def _skip(ip: str, exc: RedisError) -> None:
        logger.warning("login_rate_limit_unavailable", client_ip=ip, error=str(exc))
