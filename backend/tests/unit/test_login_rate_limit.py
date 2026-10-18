import fakeredis
import pytest
from redis.asyncio import Redis

from app.core.errors import RateLimitedError
from app.core.rate_limit import LoginRateLimiter

ATTEMPTS = 5
WINDOW_SEC = 900
IP = "203.0.113.7"
KEY = f"rl:login:{IP}"


@pytest.fixture
def server() -> fakeredis.FakeServer:
    return fakeredis.FakeServer()


@pytest.fixture
def redis(server: fakeredis.FakeServer) -> Redis:
    return fakeredis.FakeAsyncRedis(server=server, decode_responses=True)


@pytest.fixture
def limiter(redis: Redis) -> LoginRateLimiter:
    return LoginRateLimiter(redis, attempts=ATTEMPTS, window_sec=WINDOW_SEC)


async def _fail(limiter: LoginRateLimiter, times: int, ip: str = IP) -> None:
    for _ in range(times):
        await limiter.register_failure(ip)


async def test_limit_applies_once_all_attempts_are_used(limiter: LoginRateLimiter) -> None:
    await _fail(limiter, ATTEMPTS - 1)
    await limiter.check(IP)

    await _fail(limiter, 1)
    with pytest.raises(RateLimitedError) as error:
        await limiter.check(IP)

    assert 0 < error.value.retry_after <= WINDOW_SEC
    assert error.value.headers == {"Retry-After": str(error.value.retry_after)}


async def test_window_starts_at_first_failure_and_is_not_extended(
    limiter: LoginRateLimiter, redis: Redis
) -> None:
    await _fail(limiter, 1)
    await redis.expire(KEY, 10)  # будто с первой неудачи прошло почти всё окно

    await _fail(limiter, ATTEMPTS - 1)

    assert 0 < await redis.ttl(KEY) <= 10
    with pytest.raises(RateLimitedError) as error:
        await limiter.check(IP)
    assert error.value.retry_after <= 10


async def test_reset_restores_all_attempts(limiter: LoginRateLimiter) -> None:
    await _fail(limiter, ATTEMPTS)

    await limiter.reset(IP)

    await _fail(limiter, ATTEMPTS - 1)
    await limiter.check(IP)


async def test_addresses_are_counted_separately(limiter: LoginRateLimiter) -> None:
    await _fail(limiter, ATTEMPTS)

    await limiter.check("198.51.100.1")
    with pytest.raises(RateLimitedError):
        await limiter.check(IP)


async def test_without_redis_limit_is_not_applied(
    limiter: LoginRateLimiter, server: fakeredis.FakeServer
) -> None:
    await _fail(limiter, ATTEMPTS)
    server.connected = False

    await limiter.register_failure(IP)
    await limiter.check(IP)
    await limiter.reset(IP)
