"""Evidence-backed oversight, private case progress, independent service switches."""

import sqlalchemy as sa
from alembic import op

revision = "a3c7d9e1b642"
down_revision = "96c0b23ad7f1"
branch_labels = None
depends_on = None
MYSQL = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}
STATUSES = ("masuk_antrian", "penyelidikan_satgas", "pendampingan", "proses_hukum", "selesai", "tidak_valid")


def upgrade():
    with op.batch_alter_table("ponpes") as batch:
        batch.add_column(sa.Column("pendaftaran_dibuka", sa.Boolean(), nullable=False, server_default="0"))
        batch.add_column(sa.Column("konsultasi_dibuka", sa.Boolean(), nullable=False, server_default="0"))
    # Preserve existing service profiles without turning demo permits into
    # official oversight evidence. New references remain closed by default.
    op.execute(
        sa.text("UPDATE ponpes SET pendaftaran_dibuka = 1, konsultasi_dibuka = 1 WHERE profil_referensi = 0")
    )
    op.create_table(
        "pengawasan_pesantren",
        sa.Column(
            "ponpes_id", sa.Integer(), sa.ForeignKey("ponpes.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column(
            "status_dokumen",
            sa.Enum(
                "belum_dikonfirmasi", "terdaftar", name="pengawasan_status_dokumen", create_constraint=True
            ),
            nullable=False,
            server_default="belum_dikonfirmasi",
        ),
        sa.Column("nomor_statistik", sa.String(50)),
        sa.Column("nomor_dokumen", sa.String(150)),
        sa.Column("penerbit_dokumen", sa.String(200)),
        sa.Column("tanggal_dokumen", sa.Date()),
        sa.Column("sumber_dokumen", sa.String(1000)),
        sa.Column("tanggal_pemeriksaan_dokumen", sa.Date()),
        sa.Column("catatan_dokumen", sa.Text()),
        sa.Column(
            "status_operasional",
            sa.Enum(
                "belum_dikonfirmasi",
                "beroperasi",
                "tidak_beroperasi",
                name="pengawasan_status_operasional",
                create_constraint=True,
            ),
            nullable=False,
            server_default="belum_dikonfirmasi",
        ),
        sa.Column("sumber_operasional", sa.String(1000)),
        sa.Column("tanggal_pemeriksaan_operasional", sa.Date()),
        sa.Column("catatan_operasional", sa.Text()),
        sa.Column("pemeriksa_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
        **MYSQL,
    )
    op.create_table(
        "pengaduan_perkembangan",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "pengaduan_id",
            sa.Integer(),
            sa.ForeignKey("pengaduan_kekerasan.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("petugas_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column(
            "status_sebelum", sa.Enum(*STATUSES, name="perkembangan_status_sebelum", create_constraint=True)
        ),
        sa.Column(
            "status_sesudah",
            sa.Enum(*STATUSES, name="perkembangan_status_sesudah", create_constraint=True),
            nullable=False,
        ),
        sa.Column("catatan_internal", sa.Text()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
        **MYSQL,
    )
    op.create_index("ix_pengaduan_perkembangan_pengaduan_id", "pengaduan_perkembangan", ["pengaduan_id"])


def downgrade():
    connection = op.get_bind()
    for table in ("pengawasan_pesantren", "pengaduan_perkembangan"):
        if connection.scalar(sa.text(f"SELECT COUNT(*) FROM {table}")):
            raise RuntimeError(
                "Downgrade ditolak: catatan pengawasan/riwayat laporan tidak boleh dihapus otomatis"
            )
    if connection.scalar(
        sa.text(
            "SELECT COUNT(*) FROM ponpes WHERE (profil_referensi = 1 AND (pendaftaran_dibuka = 1 OR konsultasi_dibuka = 1)) OR (profil_referensi = 0 AND (pendaftaran_dibuka = 0 OR konsultasi_dibuka = 0))"
        )
    ):
        raise RuntimeError(
            "Downgrade ditolak: pengaturan layanan telah diubah; cadangkan dan tinjau secara manual"
        )
    op.drop_table("pengaduan_perkembangan")
    op.drop_table("pengawasan_pesantren")
    with op.batch_alter_table("ponpes") as batch:
        batch.drop_column("konsultasi_dibuka")
        batch.drop_column("pendaftaran_dibuka")
