"""Поля профиля и настройки пользователя.

Revision ID: 0005
Revises: 0004
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    for name in ("university", "faculty", "telegram_username", "bio"):
        op.add_column("users", sa.Column(name, sa.Text(), nullable=False, server_default=""))
    for name in ("telegram_notifications", "nearby_notifications", "show_location"):
        op.add_column(
            "users", sa.Column(name, sa.Boolean(), nullable=False, server_default=sa.false())
        )
    op.add_column(
        "users",
        sa.Column("contacts_accepted_only", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "users",
        sa.Column("notification_radius_km", sa.Integer(), nullable=False, server_default="10"),
    )


def downgrade() -> None:
    for name in (
        "notification_radius_km",
        "contacts_accepted_only",
        "show_location",
        "nearby_notifications",
        "telegram_notifications",
        "bio",
        "telegram_username",
        "faculty",
        "university",
    ):
        op.drop_column("users", name)
