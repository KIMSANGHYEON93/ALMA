"""add habit_pattern to insight category check

Revision ID: 80f539b47509
Revises: c4661064b1bc
Create Date: 2026-03-23 23:07:20.047359

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '80f539b47509'
down_revision: Union[str, Sequence[str], None] = 'c4661064b1bc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TABLE insights DROP CONSTRAINT IF EXISTS ck_insight_category")
    op.execute("""
        ALTER TABLE insights ADD CONSTRAINT ck_insight_category
        CHECK (category IN ('topic_trend','goal_pattern','activity_pattern','recommendation','habit_pattern'))
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("ALTER TABLE insights DROP CONSTRAINT IF EXISTS ck_insight_category")
    op.execute("""
        ALTER TABLE insights ADD CONSTRAINT ck_insight_category
        CHECK (category IN ('topic_trend','goal_pattern','activity_pattern','recommendation'))
    """)
