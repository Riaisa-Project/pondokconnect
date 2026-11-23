"""add gelombang, pendaftaran extended, seleksi_tahapan, daftar_ulang

Revision ID: cc33f7f07341
Revises: b4d8e2f1c053
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

revision: str = 'cc33f7f07341'
down_revision: Union[str, Sequence[str], None] = 'b4d8e2f1c053'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PENDAFTARAN_COLUMNS = (
    sa.Column('gelombang_id', sa.Integer(), nullable=True),
    sa.Column('jalur', sa.String(length=20), server_default='reguler', nullable=False),
    sa.Column('jenjang', sa.String(length=20), server_default='MA', nullable=False),
    sa.Column('tipe_mondok', sa.Enum('mukim', 'non_mukim', name='tipe_mondok', create_constraint=True), server_default='mukim', nullable=False),
    sa.Column('biaya_pendaftaran', sa.Numeric(precision=12, scale=2), server_default='0', nullable=False),
    sa.Column('hubungan_wali', sa.String(length=20), nullable=True),
    sa.Column('nik_wali', sa.String(length=16), nullable=True),
    sa.Column('pekerjaan_wali', sa.String(length=60), nullable=True),
    sa.Column('penghasilan_wali', sa.Enum('di_bawah_1_5', '1_5_sampai_3', '3_sampai_5', 'di_atas_5', name='penghasilan_wali', create_constraint=True), nullable=True),
    sa.Column('alamat_wali', sa.Text(), nullable=True),
    sa.Column('kontak_darurat', sa.String(length=20), nullable=True),
    sa.Column('berkas_dinyatakan', sa.JSON(), nullable=True),
    sa.Column('nomor_induk', sa.String(length=30), nullable=True),
)


def upgrade() -> None:
    op.create_table('gelombang_psb',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('ponpes_id', sa.Integer(), nullable=False),
    sa.Column('nama', sa.String(length=80), nullable=False),
    sa.Column('tanggal_buka', sa.Date(), nullable=False),
    sa.Column('tanggal_tutup', sa.Date(), nullable=False),
    sa.Column('biaya_pendaftaran', sa.Numeric(precision=12, scale=2), server_default='0', nullable=False),
    sa.Column('kuota_putra', sa.Integer(), server_default='0', nullable=False),
    sa.Column('kuota_putri', sa.Integer(), server_default='0', nullable=False),
    sa.Column('jalur', sa.JSON(), nullable=False),
    sa.Column('jenjang', sa.JSON(), nullable=False),
    sa.Column('aktif', sa.Boolean(), server_default='1', nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    sa.CheckConstraint('biaya_pendaftaran >= 0 AND kuota_putra >= 0 AND kuota_putri >= 0', name=op.f('ck_gelombang_psb_gelombang_nonnegative')),
    sa.CheckConstraint('tanggal_tutup >= tanggal_buka', name=op.f('ck_gelombang_psb_gelombang_date_order')),
    sa.ForeignKeyConstraint(['ponpes_id'], ['ponpes.id'], name=op.f('fk_gelombang_psb_ponpes_id_ponpes'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_gelombang_psb')),
    sa.UniqueConstraint('ponpes_id', 'nama', name=op.f('uq_gelombang_psb_ponpes_id')),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_index(op.f('ix_gelombang_psb_ponpes_id'), 'gelombang_psb', ['ponpes_id'], unique=False)
    op.create_table('daftar_ulang',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('pendaftaran_id', sa.Integer(), nullable=False),
    sa.Column('tenggat_at', sa.DateTime(), nullable=True),
    sa.Column('biaya_masuk', sa.Numeric(precision=12, scale=2), server_default='0', nullable=False),
    sa.Column('infaq', sa.Numeric(precision=12, scale=2), server_default='0', nullable=False),
    sa.Column('bukti_bayar', sa.String(length=255), nullable=True),
    sa.Column('berkas_asli', sa.JSON(), nullable=True),
    sa.Column('pernyataan_at', sa.DateTime(), nullable=True),
    sa.Column('nomor_induk', sa.String(length=30), nullable=True),
    sa.Column('kamar', sa.String(length=40), nullable=True),
    sa.Column('status', sa.Enum('menunggu_pembayaran', 'menunggu_verifikasi', 'selesai', 'gugur', name='daftar_ulang_status', create_constraint=True), server_default='menunggu_pembayaran', nullable=False),
    sa.Column('catatan', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    sa.ForeignKeyConstraint(['pendaftaran_id'], ['pendaftaran_santri.id'], name=op.f('fk_daftar_ulang_pendaftaran_id_pendaftaran_santri'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_daftar_ulang')),
    sa.UniqueConstraint('pendaftaran_id', name=op.f('uq_daftar_ulang_pendaftaran_id')),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_index(op.f('ix_daftar_ulang_status'), 'daftar_ulang', ['status'], unique=False)
    op.create_table('seleksi_tahapan',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('pendaftaran_id', sa.Integer(), nullable=False),
    sa.Column('urutan', sa.Integer(), server_default='1', nullable=False),
    sa.Column('nama', sa.String(length=80), nullable=False),
    sa.Column('jenis', sa.Enum('berkas', 'tes', 'wawancara', 'kesehatan', 'lainnya', name='tahapan_jenis', create_constraint=True), server_default='tes', nullable=False),
    sa.Column('jadwal_at', sa.DateTime(), nullable=True),
    sa.Column('lokasi', sa.String(length=120), nullable=True),
    sa.Column('status', sa.Enum('menunggu', 'lulus', 'tidak_lulus', name='tahapan_status', create_constraint=True), server_default='menunggu', nullable=False),
    sa.Column('catatan', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    sa.ForeignKeyConstraint(['pendaftaran_id'], ['pendaftaran_santri.id'], name=op.f('fk_seleksi_tahapan_pendaftaran_id_pendaftaran_santri'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_seleksi_tahapan')),
    sa.UniqueConstraint('pendaftaran_id', 'urutan', name=op.f('uq_seleksi_tahapan_pendaftaran_id')),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_index(op.f('ix_seleksi_tahapan_pendaftaran_id'), 'seleksi_tahapan', ['pendaftaran_id'], unique=False)
    # Batch mode keeps this workable on SQLite (copy-and-move) while degrading
    # to plain ALTER statements on MySQL/TiDB, which is the deployed target.
    with op.batch_alter_table('pendaftaran_santri') as batch:
        for column in PENDAFTARAN_COLUMNS:
            batch.add_column(column)
        batch.alter_column('status_seleksi',
                   existing_type=mysql.ENUM('menunggu_verifikasi', 'lolos_berkas', 'diterima', 'ditolak', collation='utf8mb4_unicode_ci'),
                   type_=sa.Enum('menunggu_verifikasi', 'lolos_berkas', 'diterima', 'ditolak', 'cadangan', 'daftar_ulang', 'gugur', name='status_seleksi', create_constraint=True),
                   existing_nullable=False,
                   existing_server_default=sa.text("'menunggu_verifikasi'"))
        batch.create_foreign_key(
            op.f('fk_pendaftaran_santri_gelombang_id_gelombang_psb'),
            'gelombang_psb', ['gelombang_id'], ['id'], ondelete='SET NULL',
        )
    op.create_index('ix_pendaftaran_gelombang_quota', 'pendaftaran_santri', ['gelombang_id', 'jenis_kelamin', 'status_seleksi'], unique=False)
    op.create_index(op.f('ix_pendaftaran_santri_gelombang_id'), 'pendaftaran_santri', ['gelombang_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_pendaftaran_gelombang_quota', table_name='pendaftaran_santri')
    op.drop_index(op.f('ix_pendaftaran_santri_gelombang_id'), table_name='pendaftaran_santri')
    with op.batch_alter_table('pendaftaran_santri') as batch:
        batch.drop_constraint(op.f('fk_pendaftaran_santri_gelombang_id_gelombang_psb'), type_='foreignkey')
        # SQLite refuses to drop a column that a CHECK constraint still names.
        for constraint in ('tipe_mondok', 'penghasilan_wali'):
            batch.drop_constraint(op.f(f'ck_pendaftaran_santri_{constraint}'), type_='check')
        batch.alter_column('status_seleksi',
                   existing_type=sa.Enum('menunggu_verifikasi', 'lolos_berkas', 'diterima', 'ditolak', 'cadangan', 'daftar_ulang', 'gugur', name='status_seleksi', create_constraint=True),
                   type_=sa.Enum('menunggu_verifikasi', 'lolos_berkas', 'diterima', 'ditolak', name='status_seleksi', create_constraint=True),
                   existing_nullable=False,
                   existing_server_default=sa.text("'menunggu_verifikasi'"))
        for column in reversed(PENDAFTARAN_COLUMNS):
            batch.drop_column(column.name)
    op.drop_index(op.f('ix_seleksi_tahapan_pendaftaran_id'), table_name='seleksi_tahapan')
    op.drop_table('seleksi_tahapan')
    op.drop_index(op.f('ix_daftar_ulang_status'), table_name='daftar_ulang')
    op.drop_table('daftar_ulang')
    op.drop_index(op.f('ix_gelombang_psb_ponpes_id'), table_name='gelombang_psb')
    op.drop_table('gelombang_psb')
