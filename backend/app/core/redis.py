import asyncio

from arq import create_pool
from arq.connections import ArqRedis, RedisSettings
from redis.asyncio import Redis
from starlette.requests import Request


def create_redis(url: str) -> Redis:
    client: Redis = Redis.from_url(
        url, decode_responses=True, socket_connect_timeout=1, socket_timeout=1
    )
    return client


def arq_redis_settings(url: str) -> RedisSettings:
    """Web requests must not wait through ARQ's default five connection retries."""
    settings = RedisSettings.from_dsn(url)
    settings.conn_retries = 0
    return settings


async def create_arq_pool(url: str) -> ArqRedis:
    """Bound startup and request latency if Redis accepts TCP but never replies."""
    return await asyncio.wait_for(create_pool(arq_redis_settings(url)), timeout=0.5)


async def get_redis(request: Request) -> Redis:
    redis: Redis = request.app.state.redis
    return redis
