"""initial seven domain tables

Revision ID: fbe9651fd3a2
Revises:
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "fbe9651fd3a2"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "kecamatan",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nama_kecamatan", sa.String(length=50), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_kecamatan")),
        sa.UniqueConstraint("nama_kecamatan", name=op.f("uq_kecamatan_nama_kecamatan")),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
        mysql_engine="InnoDB",
    )
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nama_lengkap", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=100), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("no_hp", sa.String(length=20), nullable=False),
        sa.Column(
            "role",
            sa.Enum("satgas_kemenag", "admin_ponpes", "warga", name="user_role", create_constraint=True),
            server_default="warga",
            nullable=False,
        ),
        sa.Column("must_change_password", sa.Boolean(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
        mysql_engine="InnoDB",
    )
    op.create_index(op.f("ix_users_role"), "users", ["role"], unique=False)
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("aksi", sa.String(length=100), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_audit_logs_user_id_users"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_logs")),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
        mysql_engine="InnoDB",
    )
    op.create_index(op.f("ix_audit_logs_user_id"), "audit_logs", ["user_id"], unique=False)
    op.create_table(
        "ponpes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("kecamatan_id", sa.Integer(), nullable=False),
        sa.Column("user_admin_id", sa.Integer(), nullable=True),
        sa.Column("nspp", sa.String(length=20), nullable=False),
        sa.Column("nama_ponpes", sa.String(length=150), nullable=False),
        sa.Column("slug", sa.String(length=160), nullable=False),
        sa.Column("nama_pengasuh", sa.String(length=100), nullable=False),
        sa.Column("alamat_lengkap", sa.Text(), nullable=False),
        sa.Column(
            "tipe_pesantren",
            sa.Enum(
                "salafiyah", "khalafiyah_modern", "kombinasi", name="tipe_pesantren", create_constraint=True
            ),
            nullable=False,
        ),
        sa.Column(
            "status_ijop",
            sa.Enum(
                "proses_verifikasi",
                "aktif",
                "kedaluwarsa",
                "ditolak",
                name="status_ijop",
                create_constraint=True,
            ),
            server_default="proses_verifikasi",
            nullable=False,
        ),
        sa.Column("no_sk_ijop", sa.String(length=100), nullable=True),
        sa.Column("tanggal_ijop_mulai", sa.Date(), nullable=True),
        sa.Column("tanggal_ijop_selesai", sa.Date(), nullable=True),
        sa.Column("kuota_putra", sa.Integer(), server_default="50", nullable=False),
        sa.Column("kuota_putri", sa.Integer(), server_default="50", nullable=False),
        sa.Column("kontak_sekretariat", sa.String(length=20), nullable=True),
        sa.Column("latitude", sa.Numeric(precision=10, scale=8), server_default="-7.1193", nullable=False),
        sa.Column("longitude", sa.Numeric(precision=11, scale=8), server_default="112.4150", nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.CheckConstraint("kuota_putra >= 0 AND kuota_putri >= 0", name=op.f("ck_ponpes_quota_nonnegative")),
        sa.CheckConstraint(
            "latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180",
            name=op.f("ck_ponpes_coordinates"),
        ),
        sa.CheckConstraint(
            "tanggal_ijop_selesai IS NULL OR tanggal_ijop_mulai IS NULL OR tanggal_ijop_selesai >= tanggal_ijop_mulai",
            name=op.f("ck_ponpes_date_order"),
        ),
        sa.ForeignKeyConstraint(
            ["kecamatan_id"],
            ["kecamatan.id"],
            name=op.f("fk_ponpes_kecamatan_id_kecamatan"),
            onupdate="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_admin_id"], ["users.id"], name=op.f("fk_ponpes_user_admin_id_users"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ponpes")),
        sa.UniqueConstraint("nspp", name=op.f("uq_ponpes_nspp")),
        sa.UniqueConstraint("slug", name=op.f("uq_ponpes_slug")),
        sa.UniqueConstraint("user_admin_id", name=op.f("uq_ponpes_user_admin_id")),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
        mysql_engine="InnoDB",
    )
    op.create_index(op.f("ix_ponpes_kecamatan_id"), "ponpes", ["kecamatan_id"], unique=False)
    op.create_index(op.f("ix_ponpes_status_ijop"), "ponpes", ["status_ijop"], unique=False)
    op.create_table(
        "chat_konsultasi",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ponpes_id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.String(length=64), nullable=False),
        sa.Column("nama_warga", sa.String(length=100), nullable=False),
        sa.Column("kontak_warga", sa.String(length=50), nullable=False),
        sa.Column("pesan", sa.Text(), nullable=False),
        sa.Column(
            "sender_role",
            sa.Enum("warga", "admin_ponpes", name="sender_role", create_constraint=True),
            nullable=False,
        ),
        sa.Column("is_read", sa.Boolean(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(
            ["ponpes_id"], ["ponpes.id"], name=op.f("fk_chat_konsultasi_ponpes_id_ponpes"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_chat_konsultasi")),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
        mysql_engine="InnoDB",
    )
    op.create_index(op.f("ix_chat_konsultasi_ponpes_id"), "chat_konsultasi", ["ponpes_id"], unique=False)
    op.create_index(
        "ix_chat_session_order", "chat_konsultasi", ["ponpes_id", "session_id", "id"], unique=False
    )
    op.create_table(
        "pendaftaran_santri",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ponpes_id", sa.Integer(), nullable=False),
        sa.Column("user_pendaftar_id", sa.Integer(), nullable=True),
        sa.Column("nomor_registrasi", sa.String(length=30), nullable=False),
        sa.Column("nik_santri", sa.String(length=16), nullable=False),
        sa.Column("nama_santri", sa.String(length=100), nullable=False),
        sa.Column(
            "jenis_kelamin", sa.Enum("L", "P", name="jenis_kelamin", create_constraint=True), nullable=False
        ),
        sa.Column("nama_wali", sa.String(length=100), nullable=False),
        sa.Column("no_hp_wali", sa.String(length=20), nullable=False),
        sa.Column("file_kk", sa.String(length=255), nullable=True),
        sa.Column(
            "status_seleksi",
            sa.Enum(
                "menunggu_verifikasi",
                "lolos_berkas",
                "diterima",
                "ditolak",
                name="status_seleksi",
                create_constraint=True,
            ),
            server_default="menunggu_verifikasi",
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(
            ["ponpes_id"],
            ["ponpes.id"],
            name=op.f("fk_pendaftaran_santri_ponpes_id_ponpes"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_pendaftar_id"],
            ["users.id"],
            name=op.f("fk_pendaftaran_santri_user_pendaftar_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_pendaftaran_santri")),
        sa.UniqueConstraint("nomor_registrasi", name=op.f("uq_pendaftaran_santri_nomor_registrasi")),
        sa.UniqueConstraint("ponpes_id", "nik_santri", name=op.f("uq_pendaftaran_santri_ponpes_id")),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
        mysql_engine="InnoDB",
    )
    op.create_index(
        "ix_pendaftaran_quota",
        "pendaftaran_santri",
        ["ponpes_id", "jenis_kelamin", "status_seleksi"],
        unique=False,
    )
    op.create_index(
        op.f("ix_pendaftaran_santri_ponpes_id"), "pendaftaran_santri", ["ponpes_id"], unique=False
    )
    op.create_table(
        "pengaduan_kekerasan",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ponpes_id", sa.Integer(), nullable=False),
        sa.Column("kode_tiket", sa.String(length=32), nullable=False),
        sa.Column(
            "kategori_kasus",
            sa.Enum(
                "pelecehan_seksual",
                "kekerasan_fisik",
                "perundungan_bullying",
                "pemerasan",
                "lainnya",
                name="kategori_kasus",
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("tanggal_kejadian", sa.Date(), nullable=False),
        sa.Column("lokasi_kejadian", sa.String(length=150), nullable=False),
        sa.Column("deskripsi_peristiwa", sa.Text(), nullable=False),
        sa.Column("bukti_lampiran", sa.String(length=255), nullable=True),
        sa.Column(
            "mode_pelapor",
            sa.Enum("terbuka", "rahasia", name="mode_pelapor", create_constraint=True),
            nullable=False,
        ),
        sa.Column("nama_pelapor", sa.String(length=100), nullable=True),
        sa.Column("kontak_pelapor", sa.String(length=100), nullable=True),
        sa.Column(
            "status_tindakan",
            sa.Enum(
                "masuk_antrian",
                "penyelidikan_satgas",
                "pendampingan",
                "proses_hukum",
                "selesai",
                "tidak_valid",
                name="status_tindakan",
                create_constraint=True,
            ),
            server_default="masuk_antrian",
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.CheckConstraint(
            "mode_pelapor != 'rahasia' OR (nama_pelapor IS NULL AND kontak_pelapor IS NULL)",
            name=op.f("ck_pengaduan_kekerasan_anonymous_identity"),
        ),
        sa.ForeignKeyConstraint(
            ["ponpes_id"],
            ["ponpes.id"],
            name=op.f("fk_pengaduan_kekerasan_ponpes_id_ponpes"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_pengaduan_kekerasan")),
        sa.UniqueConstraint("kode_tiket", name=op.f("uq_pengaduan_kekerasan_kode_tiket")),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
        mysql_engine="InnoDB",
    )
    op.create_index(
        op.f("ix_pengaduan_kekerasan_status_tindakan"),
        "pengaduan_kekerasan",
        ["status_tindakan"],
        unique=False,
    )


def downgrade() -> None:
    # Drop children before parents; MySQL removes their indexes with each table.
    # Dropping FK-supporting indexes first is rejected by InnoDB.
    for table in (
        "pengaduan_kekerasan",
        "pendaftaran_santri",
        "chat_konsultasi",
        "ponpes",
        "audit_logs",
        "users",
        "kecamatan",
    ):
        op.drop_table(table)
