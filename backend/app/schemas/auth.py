from typing import Annotated, Literal

from pydantic import BaseModel, Field

from app.schemas.common import Email
from app.schemas.users import UserOut

Password = Annotated[str, Field(min_length=8, max_length=128)]
DisplayName = Annotated[str, Field(min_length=2, max_length=50, examples=["Гриша"])]


class RegisterIn(BaseModel):
    email: Email
    password: Password
    display_name: DisplayName


class LoginIn(BaseModel):
    email: Email
    password: Annotated[str, Field(min_length=1, max_length=128)]


class RefreshIn(BaseModel):
    refresh_token: Annotated[str, Field(min_length=1)]


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"]
    expires_in: int = Field(description="Срок жизни access-токена, секунды", examples=[900])
    user: UserOut


class ChangePasswordIn(BaseModel):
    current_password: Annotated[str, Field(min_length=1, max_length=128)]
    new_password: Password
