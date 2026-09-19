"""friends

Revision ID: a1f4c7d92e10
Revises: cab09e0ad9f8
Create Date: 2026-09-16 21:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1f4c7d92e10'
down_revision: Union[str, None] = 'cab09e0ad9f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('friends',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('owner_username', sa.String(length=32), nullable=False),
    sa.Column('friend_username', sa.String(length=32), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_friends_owner_username'), 'friends', ['owner_username'], unique=False)
    op.create_index(op.f('ix_friends_friend_username'), 'friends', ['friend_username'], unique=False)
    op.create_index('ix_friend_owner_friend', 'friends', ['owner_username', 'friend_username'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_friend_owner_friend', table_name='friends')
    op.drop_index(op.f('ix_friends_friend_username'), table_name='friends')
    op.drop_index(op.f('ix_friends_owner_username'), table_name='friends')
    op.drop_table('friends')
