"""Add editable public institution content without changing existing records."""

import sqlalchemy as sa
from alembic import op

revision = "4a8c2d7e901b"
down_revision = "fbe9651fd3a2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("ponpes", sa.Column("deskripsi", sa.Text(), nullable=True))
    op.add_column("ponpes", sa.Column("program_unggulan", sa.JSON(), nullable=True))
    op.add_column("ponpes", sa.Column("fasilitas", sa.JSON(), nullable=True))


def downgrade():
    op.drop_column("ponpes", "fasilitas")
    op.drop_column("ponpes", "program_unggulan")
    op.drop_column("ponpes", "deskripsi")
