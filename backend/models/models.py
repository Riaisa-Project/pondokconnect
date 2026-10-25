from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base

MYSQL = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}
ROLES = ("satgas_kemenag", "admin_ponpes", "warga")
TIPE = ("salafiyah", "khalafiyah_modern", "kombinasi")
IJOP = ("proses_verifikasi", "aktif", "kedaluwarsa", "ditolak")
SELEKSI = ("menunggu_verifikasi", "lolos_berkas", "diterima", "ditolak")
KATEGORI = ("pelecehan_seksual", "kekerasan_fisik", "perundungan_bullying", "pemerasan", "lainnya")
TINDAKAN = ("masuk_antrian", "penyelidikan_satgas", "pendampingan", "proses_hukum", "selesai", "tidak_valid")
DOKUMEN = ("belum_dikonfirmasi", "terdaftar")
OPERASIONAL = ("belum_dikonfirmasi", "beroperasi", "tidak_beroperasi")


def enum(values, name):
    return Enum(*values, name=name, create_constraint=True, validate_strings=True)


class Timestamp:
    created_at: Mapped[datetime] = mapped_column(server_default=func.current_timestamp())


class User(Timestamp, Base):
    __tablename__ = "users"
    __table_args__ = MYSQL
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nama_lengkap: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(100), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    no_hp: Mapped[str] = mapped_column(String(20))
    role: Mapped[str] = mapped_column(
        enum(ROLES, "user_role"), default="warga", server_default="warga", index=True
    )
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")


class Kecamatan(Base):
    __tablename__ = "kecamatan"
    __table_args__ = MYSQL
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nama_kecamatan: Mapped[str] = mapped_column(String(50), unique=True)


class Ponpes(Timestamp, Base):
    __tablename__ = "ponpes"
    __table_args__ = (
        CheckConstraint("kuota_putra >= 0 AND kuota_putri >= 0", name="quota_nonnegative"),
        CheckConstraint("latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180", name="coordinates"),
        CheckConstraint(
            "tanggal_ijop_selesai IS NULL OR tanggal_ijop_mulai IS NULL OR tanggal_ijop_selesai >= tanggal_ijop_mulai",
            name="date_order",
        ),
        MYSQL,
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kecamatan_id: Mapped[int] = mapped_column(ForeignKey("kecamatan.id", onupdate="CASCADE"), index=True)
    user_admin_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), unique=True
    )
    profil_referensi: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    pendaftaran_dibuka: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    konsultasi_dibuka: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    nspp: Mapped[str | None] = mapped_column(String(20), unique=True)
    nama_ponpes: Mapped[str] = mapped_column(String(150))
    slug: Mapped[str] = mapped_column(String(160), unique=True)
    nama_pengasuh: Mapped[str | None] = mapped_column(String(100))
    alamat_lengkap: Mapped[str] = mapped_column(Text)
    tipe_pesantren: Mapped[str | None] = mapped_column(enum(TIPE, "tipe_pesantren"))
    status_ijop: Mapped[str] = mapped_column(
        enum(IJOP, "status_ijop"), default="proses_verifikasi", server_default="proses_verifikasi", index=True
    )
    no_sk_ijop: Mapped[str | None] = mapped_column(String(100))
    tanggal_ijop_mulai: Mapped[date | None] = mapped_column(Date)
    tanggal_ijop_selesai: Mapped[date | None] = mapped_column(Date)
    kuota_putra: Mapped[int] = mapped_column(default=50, server_default="50")
    kuota_putri: Mapped[int] = mapped_column(default=50, server_default="50")
    deskripsi: Mapped[str | None] = mapped_column(Text)
    program_unggulan: Mapped[list[str] | None] = mapped_column(JSON)
    fasilitas: Mapped[list[str] | None] = mapped_column(JSON)
    kontak_sekretariat: Mapped[str | None] = mapped_column(String(20))
    latitude: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 8).evaluates_none(), default=Decimal("-7.1193"), server_default="-7.1193"
    )
    longitude: Mapped[Decimal | None] = mapped_column(
        Numeric(11, 8).evaluates_none(), default=Decimal("112.4150"), server_default="112.4150"
    )


class Pendaftaran(Timestamp, Base):
    __tablename__ = "pendaftaran_santri"
    __table_args__ = (
        UniqueConstraint("ponpes_id", "nik_santri"),
        Index("ix_pendaftaran_quota", "ponpes_id", "jenis_kelamin", "status_seleksi"),
        MYSQL,
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ponpes_id: Mapped[int] = mapped_column(ForeignKey("ponpes.id", ondelete="CASCADE"), index=True)
    user_pendaftar_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    nomor_registrasi: Mapped[str] = mapped_column(String(30), unique=True)
    nik_santri: Mapped[str] = mapped_column(String(16))
    nama_santri: Mapped[str] = mapped_column(String(100))
    jenis_kelamin: Mapped[str] = mapped_column(enum(("L", "P"), "jenis_kelamin"))
    nama_wali: Mapped[str] = mapped_column(String(100))
    no_hp_wali: Mapped[str] = mapped_column(String(20))
    file_kk: Mapped[str | None] = mapped_column(String(255))
    status_seleksi: Mapped[str] = mapped_column(
        enum(SELEKSI, "status_seleksi"), default="menunggu_verifikasi", server_default="menunggu_verifikasi"
    )


class Pengawasan(Timestamp, Base):
    __tablename__ = "pengawasan_pesantren"
    __table_args__ = MYSQL
    ponpes_id: Mapped[int] = mapped_column(ForeignKey("ponpes.id", ondelete="CASCADE"), primary_key=True)
    status_dokumen: Mapped[str] = mapped_column(
        enum(DOKUMEN, "pengawasan_status_dokumen"),
        default="belum_dikonfirmasi",
        server_default="belum_dikonfirmasi",
    )
    nomor_statistik: Mapped[str | None] = mapped_column(String(50))
    nomor_dokumen: Mapped[str | None] = mapped_column(String(150))
    penerbit_dokumen: Mapped[str | None] = mapped_column(String(200))
    tanggal_dokumen: Mapped[date | None] = mapped_column(Date)
    sumber_dokumen: Mapped[str | None] = mapped_column(String(1000))
    tanggal_pemeriksaan_dokumen: Mapped[date | None] = mapped_column(Date)
    catatan_dokumen: Mapped[str | None] = mapped_column(Text)
    status_operasional: Mapped[str] = mapped_column(
        enum(OPERASIONAL, "pengawasan_status_operasional"),
        default="belum_dikonfirmasi",
        server_default="belum_dikonfirmasi",
    )
    sumber_operasional: Mapped[str | None] = mapped_column(String(1000))
    tanggal_pemeriksaan_operasional: Mapped[date | None] = mapped_column(Date)
    catatan_operasional: Mapped[str | None] = mapped_column(Text)
    pemeriksa_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.current_timestamp(), onupdate=func.current_timestamp()
    )


class Pengaduan(Timestamp, Base):
    __tablename__ = "pengaduan_kekerasan"
    __table_args__ = (
        CheckConstraint(
            "mode_pelapor != 'rahasia' OR (nama_pelapor IS NULL AND kontak_pelapor IS NULL)",
            name="anonymous_identity",
        ),
        MYSQL,
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ponpes_id: Mapped[int] = mapped_column(ForeignKey("ponpes.id", ondelete="CASCADE"))
    kode_tiket: Mapped[str] = mapped_column(String(32), unique=True)
    kategori_kasus: Mapped[str] = mapped_column(enum(KATEGORI, "kategori_kasus"))
    tanggal_kejadian: Mapped[date] = mapped_column(Date)
    lokasi_kejadian: Mapped[str] = mapped_column(String(150))
    deskripsi_peristiwa: Mapped[str] = mapped_column(Text)
    bukti_lampiran: Mapped[str | None] = mapped_column(String(255))
    mode_pelapor: Mapped[str] = mapped_column(enum(("terbuka", "rahasia"), "mode_pelapor"), default="terbuka")
    nama_pelapor: Mapped[str | None] = mapped_column(String(100))
    kontak_pelapor: Mapped[str | None] = mapped_column(String(100))
    status_tindakan: Mapped[str] = mapped_column(
        enum(TINDAKAN, "status_tindakan"), default="masuk_antrian", server_default="masuk_antrian", index=True
    )


class Chat(Timestamp, Base):
    __tablename__ = "chat_konsultasi"
    __table_args__ = (Index("ix_chat_session_order", "ponpes_id", "session_id", "id"), MYSQL)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ponpes_id: Mapped[int] = mapped_column(ForeignKey("ponpes.id", ondelete="CASCADE"), index=True)
    session_id: Mapped[str] = mapped_column(String(64))
    nama_warga: Mapped[str] = mapped_column(String(100))
    kontak_warga: Mapped[str] = mapped_column(String(50))
    pesan: Mapped[str] = mapped_column(Text)
    sender_role: Mapped[str] = mapped_column(enum(("warga", "admin_ponpes"), "sender_role"))
    is_read: Mapped[bool] = mapped_column(default=False, server_default="0")


class PengaduanPerkembangan(Timestamp, Base):
    __tablename__ = "pengaduan_perkembangan"
    __table_args__ = MYSQL
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pengaduan_id: Mapped[int] = mapped_column(
        ForeignKey("pengaduan_kekerasan.id", ondelete="CASCADE"), index=True
    )
    petugas_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    status_sebelum: Mapped[str | None] = mapped_column(enum(TINDAKAN, "perkembangan_status_sebelum"))
    status_sesudah: Mapped[str] = mapped_column(enum(TINDAKAN, "perkembangan_status_sesudah"))
    catatan_internal: Mapped[str | None] = mapped_column(Text)


class AuditLog(Timestamp, Base):
    __tablename__ = "audit_logs"
    __table_args__ = MYSQL
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    aksi: Mapped[str] = mapped_column(String(100))
    detail: Mapped[str | None] = mapped_column(Text)
    ip_address: Mapped[str | None] = mapped_column(String(45))
