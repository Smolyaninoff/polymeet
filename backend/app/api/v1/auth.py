from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import RedisDep, SessionDep, SettingsDep
from app.api.errors import (
    DependencyUnavailableError,
    EmailTakenError,
    InvalidCredentialsError,
    RateLimitedError,
    UnauthorizedError,
    ValidationAppError,
    error_responses,
)
from app.api.v1.params import p95
from app.schemas.auth import AuthResponse, LoginIn, RefreshIn, RegisterIn
from app.schemas.users import UserOut
from app.services.auth_service import AuthService, AuthTokens

router = APIRouter(prefix="/auth", tags=["auth"])


def get_auth_service(session: SessionDep, redis: RedisDep, settings: SettingsDep) -> AuthService:
    return AuthService(session, redis, settings)


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]


def _auth_response(tokens: AuthTokens) -> AuthResponse:
    return AuthResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        token_type="bearer",
        expires_in=tokens.expires_in,
        user=UserOut.model_validate(tokens.user),
    )


@router.post(
    "/register",
    status_code=201,
    summary="Регистрация",
    description=p95(500, "Создаёт пользователя и сразу выдаёт пару токенов."),
    responses=error_responses(ValidationAppError, EmailTakenError),
)
async def register(payload: RegisterIn, service: AuthServiceDep) -> AuthResponse:
    tokens = await service.register(
        email=payload.email, password=payload.password, display_name=payload.display_name
    )
    return _auth_response(tokens)


@router.post(
    "/login",
    summary="Вход",
    description=p95(
        500,
        "Неверный пароль и несуществующий e-mail дают одинаковый ответ. "
        "После 5 неудачных попыток с одного IP — 429 с заголовком `Retry-After`.",
    ),
    responses=error_responses(ValidationAppError, InvalidCredentialsError, RateLimitedError),
)
async def login(payload: LoginIn, service: AuthServiceDep) -> AuthResponse:
    tokens = await service.login(email=payload.email, password=payload.password)
    return _auth_response(tokens)


@router.post(
    "/refresh",
    summary="Обновление токенов",
    description=p95(
        500,
        "Ротация: старый refresh-токен отзывается, выдаётся новая пара. "
        "Повторное использование старого токена — 401.",
    ),
    responses=error_responses(ValidationAppError, UnauthorizedError, DependencyUnavailableError),
)
async def refresh(payload: RefreshIn, service: AuthServiceDep) -> AuthResponse:
    return _auth_response(await service.refresh(payload.refresh_token))


@router.post(
    "/logout",
    status_code=204,
    summary="Выход",
    description=p95(500, "Отзывает переданный refresh-токен."),
    responses=error_responses(ValidationAppError, UnauthorizedError, DependencyUnavailableError),
)
async def logout(payload: RefreshIn, service: AuthServiceDep) -> None:
    await service.logout(payload.refresh_token)
