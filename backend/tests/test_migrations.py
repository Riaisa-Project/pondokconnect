"""Run migrations only against temporary SQLite files, never the configured DB."""

import os
import subprocess
import sys

import pytest
from sqlalchemy import create_engine, inspect, text


def migrate(url, *arguments):
    environment = {**os.environ, "DATABASE_URL": url, "APP_ENV": "test"}
    return subprocess.run(
        [sys.executable, "-m", "alembic", *arguments],
        env=environment,
        capture_output=True,
        text=True,
    )


def test_empty_oversight_migration_roundtrip_and_schema_match(tmp_path):
    url = f"sqlite:///{tmp_path / 'roundtrip.db'}"
    for args in (("upgrade", "head"), ("check",), ("downgrade", "base"), ("upgrade", "head")):
        result = migrate(url, *args)
        assert result.returncode == 0, result.stdout + result.stderr
    engine = create_engine(url)
    try:
        with engine.connect() as connection:
            assert connection.scalar(text("SELECT version_num FROM alembic_version")) == "a3c7d9e1b642"
        assert {"pengawasan_pesantren", "pengaduan_perkembangan"} <= set(inspect(engine).get_table_names())
    finally:
        engine.dispose()


@pytest.mark.parametrize("recorded_table", ["pengawasan_pesantren", "pengaduan_perkembangan"])
def test_upgrade_preserves_accounts_profile_and_legacy_data_without_promoting_oversight(
    tmp_path, recorded_table
):
    url = f"sqlite:///{tmp_path / 'preservation.db'}"
    result = migrate(url, "upgrade", "96c0b23ad7f1")
    assert result.returncode == 0, result.stderr
    engine = create_engine(url)
    try:
        with engine.begin() as connection:
            connection.execute(text("INSERT INTO kecamatan (id,nama_kecamatan) VALUES (1,'Pengujian')"))
            connection.execute(
                text(
                    "INSERT INTO users (id,nama_lengkap,email,password_hash,no_hp,role) VALUES (1,'Pengurus','migrasi@example.org','unchanged-test-hash','','admin_ponpes')"
                )
            )
            connection.execute(
                text(
                    "INSERT INTO ponpes (id,kecamatan_id,nama_ponpes,slug,alamat_lengkap,profil_referensi) "
                    "VALUES (2,1,'Profil rujukan','profil-rujukan','Alamat bersumber',1)"
                )
            )
            connection.execute(
                text(
                    "INSERT INTO ponpes (id,kecamatan_id,user_admin_id,nama_ponpes,slug,alamat_lengkap,nspp,status_ijop,no_sk_ijop,tanggal_ijop_mulai,tanggal_ijop_selesai,kuota_putra,kuota_putri) VALUES (1,1,1,'Profil tersimpan','profil-tersimpan','Alamat pengurus','919000000001','aktif','LEGACY/01','2020-01-01','2099-01-01',7,9)"
                )
            )
        result = migrate(url, "upgrade", "head")
        assert result.returncode == 0, result.stderr
        with engine.connect() as connection:
            row = connection.execute(
                text(
                    "SELECT user_admin_id,alamat_lengkap,no_sk_ijop,kuota_putra,pendaftaran_dibuka,konsultasi_dibuka FROM ponpes WHERE id=1"
                )
            ).one()
            assert tuple(row) == (1, "Alamat pengurus", "LEGACY/01", 7, 1, 1)
            assert (
                connection.scalar(text("SELECT password_hash FROM users WHERE id=1")) == "unchanged-test-hash"
            )
            assert connection.scalar(text("SELECT count(*) FROM pengawasan_pesantren")) == 0
            reference_flags = connection.execute(
                text("SELECT pendaftaran_dibuka,konsultasi_dibuka FROM ponpes WHERE id=2")
            ).one()
            assert tuple(reference_flags) == (0, 0)
        with engine.begin() as connection:
            if recorded_table == "pengawasan_pesantren":
                connection.execute(
                    text(
                        "INSERT INTO pengawasan_pesantren (ponpes_id,status_dokumen,status_operasional) VALUES (1,'belum_dikonfirmasi','belum_dikonfirmasi')"
                    )
                )
            else:
                connection.execute(
                    text(
                        "INSERT INTO pengaduan_kekerasan (id,ponpes_id,kode_tiket,kategori_kasus,tanggal_kejadian,"
                        "lokasi_kejadian,deskripsi_peristiwa,mode_pelapor) VALUES "
                        "(1,1,'0123456789abcdef0123456789abcdef','lainnya','2026-01-01','Lokasi uji','Laporan uji','rahasia')"
                    )
                )
                connection.execute(
                    text(
                        "INSERT INTO pengaduan_perkembangan (pengaduan_id,status_sesudah,catatan_internal) "
                        "VALUES (1,'masuk_antrian','Catatan tindak lanjut pengujian')"
                    )
                )
        result = migrate(url, "downgrade", "96c0b23ad7f1")
        assert result.returncode != 0, "Downgrade must preserve recorded oversight"
        with engine.connect() as connection:
            assert connection.scalar(text(f"SELECT count(*) FROM {recorded_table}")) == 1
            assert (
                connection.scalar(text("SELECT password_hash FROM users WHERE id=1")) == "unchanged-test-hash"
            )
    finally:
        engine.dispose()
