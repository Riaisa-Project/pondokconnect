"""Add consent_at to pendaftaran_santri.

Revision ID: b4d8e2f1c053
Revises: a3c7d9e1b642
Create Date: 2026-11-13
"""

import sqlalchemy as sa
from alembic import op

revision = "b4d8e2f1c053"
down_revision = "a3c7d9e1b642"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("pendaftaran_santri") as batch:
        batch.add_column(sa.Column("consent_at", sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table("pendaftaran_santri") as batch:
        batch.drop_column("consent_at")
