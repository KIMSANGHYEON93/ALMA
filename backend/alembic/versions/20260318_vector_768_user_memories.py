"""vector 768 and user_memories table

Revision ID: a1b2c3d4e5f6
Revises: 5c5690069464
Create Date: 2026-03-18 19:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import pgvector.sqlalchemy.vector

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "5c5690069464"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Drop HNSW index on messages
    op.drop_index("idx_messages_embedding", table_name="messages")
    # 2. Change vector dimension 1536 → 768
    op.alter_column(
        "messages",
        "embedding",
        type_=pgvector.sqlalchemy.vector.VECTOR(dim=768),
        existing_nullable=True,
    )
    # 3. Recreate HNSW index
    op.create_index(
        "idx_messages_embedding",
        "messages",
        ["embedding"],
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )
    # 4. Create user_memories table
    op.create_table(
        "user_memories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding", pgvector.sqlalchemy.vector.VECTOR(dim=768), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), server_default="{}"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
    )
    op.create_index("idx_user_memories_user", "user_memories", ["user_id", "category"])
    op.create_index(
        "idx_user_memories_embedding",
        "user_memories",
        ["embedding"],
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )


def downgrade() -> None:
    op.drop_index("idx_user_memories_embedding", table_name="user_memories")
    op.drop_index("idx_user_memories_user", table_name="user_memories")
    op.drop_table("user_memories")
    op.drop_index("idx_messages_embedding", table_name="messages")
    op.alter_column(
        "messages",
        "embedding",
        type_=pgvector.sqlalchemy.vector.VECTOR(dim=1536),
        existing_nullable=True,
    )
    op.create_index(
        "idx_messages_embedding",
        "messages",
        ["embedding"],
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )
