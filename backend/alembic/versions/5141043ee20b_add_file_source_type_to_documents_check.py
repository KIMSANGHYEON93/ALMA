"""add file source_type to documents check

Revision ID: 5141043ee20b
Revises: fe80e8ae90e3
Create Date: 2026-03-26 17:15:45.104315

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5141043ee20b'
down_revision: Union[str, Sequence[str], None] = 'fe80e8ae90e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TABLE documents DROP CONSTRAINT IF EXISTS ck_doc_source_type")
    op.execute("""
        ALTER TABLE documents ADD CONSTRAINT ck_doc_source_type
        CHECK (source_type IN ('text','url','file'))
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("ALTER TABLE documents DROP CONSTRAINT IF EXISTS ck_doc_source_type")
    op.execute("""
        ALTER TABLE documents ADD CONSTRAINT ck_doc_source_type
        CHECK (source_type IN ('text','url'))
    """)
