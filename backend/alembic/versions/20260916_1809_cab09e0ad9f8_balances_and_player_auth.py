"""balances and player auth

Revision ID: cab09e0ad9f8
Revises: e9a5293d1f44
Create Date: 2026-09-16 18:09:47.216564

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cab09e0ad9f8'
down_revision: Union[str, None] = 'e9a5293d1f44'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('balances',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('fingerprint', sa.String(length=64), nullable=False),
    sa.Column('username', sa.String(length=32), nullable=False),
    sa.Column('amount', sa.Numeric(precision=20, scale=2), nullable=False),
    sa.Column('observed_by', sa.String(length=32), nullable=False),
    sa.Column('server', sa.String(length=64), nullable=False),
    sa.Column('raw_message', sa.Text(), nullable=False),
    sa.Column('minecraft_timestamp', sa.String(length=16), nullable=True),
    sa.Column('observed_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_balances_fingerprint'), 'balances', ['fingerprint'], unique=True)
    op.create_index(op.f('ix_balances_username'), 'balances', ['username'], unique=False)
    op.create_index(op.f('ix_balances_observed_by'), 'balances', ['observed_by'], unique=False)
    op.create_index(op.f('ix_balances_observed_at'), 'balances', ['observed_at'], unique=False)
    op.create_index('ix_balance_user_time', 'balances', ['username', 'observed_at'], unique=False)

    op.create_table('link_codes',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('code', sa.String(length=12), nullable=False),
    sa.Column('username', sa.String(length=32), nullable=False),
    sa.Column('issued_to', sa.String(length=32), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_link_codes_code'), 'link_codes', ['code'], unique=False)
    op.create_index(op.f('ix_link_codes_username'), 'link_codes', ['username'], unique=False)
    op.create_index('ix_link_code_username', 'link_codes', ['username', 'used_at'], unique=False)

    op.create_table('player_sessions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('username', sa.String(length=32), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_player_sessions_token_hash'), 'player_sessions', ['token_hash'], unique=True)
    op.create_index(op.f('ix_player_sessions_username'), 'player_sessions', ['username'], unique=False)
    op.create_index('ix_session_user_expiry', 'player_sessions', ['username', 'expires_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_session_user_expiry', table_name='player_sessions')
    op.drop_index(op.f('ix_player_sessions_username'), table_name='player_sessions')
    op.drop_index(op.f('ix_player_sessions_token_hash'), table_name='player_sessions')
    op.drop_table('player_sessions')
    op.drop_index('ix_link_code_username', table_name='link_codes')
    op.drop_index(op.f('ix_link_codes_username'), table_name='link_codes')
    op.drop_index(op.f('ix_link_codes_code'), table_name='link_codes')
    op.drop_table('link_codes')
    op.drop_index('ix_balance_user_time', table_name='balances')
    op.drop_index(op.f('ix_balances_observed_at'), table_name='balances')
    op.drop_index(op.f('ix_balances_observed_by'), table_name='balances')
    op.drop_index(op.f('ix_balances_username'), table_name='balances')
    op.drop_index(op.f('ix_balances_fingerprint'), table_name='balances')
    op.drop_table('balances')
