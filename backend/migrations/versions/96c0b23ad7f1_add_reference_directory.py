"""Public sourced references with nullable unknown facts; preserve existing services."""

import sqlalchemy as sa
from alembic import op

revision = "96c0b23ad7f1"
down_revision = "4a8c2d7e901b"
branch_labels = None
depends_on = None
COORDINATE_DEFAULTS = {"latitude": "-7.1193", "longitude": "112.4150"}


def columns():
    return [
        ("nspp", sa.String(20)),
        ("nama_pengasuh", sa.String(100)),
        ("tipe_pesantren", sa.Enum("salafiyah", "khalafiyah_modern", "kombinasi", name="tipe_pesantren")),
        ("latitude", sa.Numeric(10, 8)),
        ("longitude", sa.Numeric(11, 8)),
    ]


def upgrade():
    with op.batch_alter_table("ponpes") as batch:
        batch.add_column(sa.Column("profil_referensi", sa.Boolean(), nullable=False, server_default="0"))
        for name, kind in columns():
            batch.alter_column(
                name,
                existing_type=kind,
                existing_nullable=False,
                nullable=True,
                existing_server_default=sa.text(COORDINATE_DEFAULTS[name])
                if name in COORDINATE_DEFAULTS
                else None,
            )


def downgrade():
    count = (
        op.get_bind()
        .execute(
            sa.text(
                "SELECT COUNT(*) FROM ponpes WHERE profil_referensi = 1 OR nspp IS NULL "
                "OR nama_pengasuh IS NULL OR tipe_pesantren IS NULL OR latitude IS NULL OR longitude IS NULL"
            )
        )
        .scalar()
    )
    if count:
        raise RuntimeError(
            "Downgrade ditolak: profil rujukan/nilai kosong harus ditangani dahulu tanpa menghapus data otomatis"
        )
    with op.batch_alter_table("ponpes") as batch:
        for name, kind in columns():
            batch.alter_column(
                name,
                existing_type=kind,
                existing_nullable=True,
                nullable=False,
                existing_server_default=sa.text(COORDINATE_DEFAULTS[name])
                if name in COORDINATE_DEFAULTS
                else None,
            )
        batch.drop_column("profil_referensi")
