"""Сообщения чатов встреч.

Revision ID: 0004
Revises: 0003
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "chat_messages",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("meeting_id", sa.BigInteger(), nullable=False),
        sa.Column("author_id", sa.BigInteger(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_chat_messages")),
        sa.ForeignKeyConstraint(
            ["meeting_id"],
            ["meetings.id"],
            ondelete="CASCADE",
            name=op.f("fk_chat_messages_meeting_id_meetings"),
        ),
        sa.ForeignKeyConstraint(
            ["author_id"], ["users.id"], name=op.f("fk_chat_messages_author_id_users")
        ),
        sa.CheckConstraint(
            "char_length(body) BETWEEN 1 AND 2000", name=op.f("ck_chat_messages_body_length")
        ),
    )
    op.create_index("ix_chat_messages_meeting_id_id", "chat_messages", ["meeting_id", "id"])


def downgrade() -> None:
    op.drop_index("ix_chat_messages_meeting_id_id", table_name="chat_messages")
    op.drop_table("chat_messages")
