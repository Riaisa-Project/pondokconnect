import re
from datetime import date, datetime
from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)


def parse_iso_date(value):
    if type(value) is date:
        return value
    if not isinstance(value, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
        raise ValueError("Tanggal wajib menggunakan format YYYY-MM-DD")
    return date.fromisoformat(value)


IsoDate = Annotated[date, BeforeValidator(parse_iso_date)]

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Phone = Annotated[str, StringConstraints(pattern=r"^\+?[0-9][0-9 -]{6,19}$", max_length=20)]
Password = Annotated[str, StringConstraints(min_length=10, max_length=72)]
Tipe = Literal["salafiyah", "khalafiyah_modern", "kombinasi"]
Ijop = Literal["proses_verifikasi", "aktif", "kedaluwarsa", "ditolak"]
Seleksi = Literal["menunggu_verifikasi", "lolos_berkas", "diterima", "ditolak"]
Tindakan = Literal[
    "masuk_antrian", "penyelidikan_satgas", "pendampingan", "proses_hukum", "selesai", "tidak_valid"
]
SessionId = Annotated[str, StringConstraints(pattern=r"^[a-f0-9]{64}$")]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Output(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Login(Input):
    email: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def valid_login_email(cls, value):
        value = value.strip().lower()
        if re.fullmatch(r"[a-z0-9][a-z0-9+._-]*@pondokconnect\.invalid", value):
            return value
        from pydantic import TypeAdapter

        return str(TypeAdapter(EmailStr).validate_python(value))


class ChangePassword(Input):
    old_password: str = Field(min_length=1, max_length=128)
    new_password: Password
    confirm_password: Password

    @model_validator(mode="after")
    def passwords_match(self):
        if self.new_password != self.confirm_password:
            raise ValueError("Konfirmasi password tidak sama")
        if len(self.new_password.encode()) > 72:
            raise ValueError("Password maksimal 72 byte UTF-8")
        if self.new_password == self.old_password:
            raise ValueError("Password baru harus berbeda")
        return self


class UserOut(Output):
    id: int
    nama_lengkap: str
    email: str
    no_hp: str
    role: str
    must_change_password: bool


class TokenOut(Output):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 3600
    must_change_password: bool


class Legalitas(Input):
    status_ijop: Ijop
    no_sk_ijop: str | None = Field(default=None, min_length=1, max_length=100)
    tanggal_ijop_mulai: IsoDate | None = None
    tanggal_ijop_selesai: IsoDate | None = None

    @model_validator(mode="after")
    def valid_dates(self):
        start, end = self.tanggal_ijop_mulai, self.tanggal_ijop_selesai
        if start and end and end < start:
            raise ValueError("Tanggal selesai harus setelah tanggal mulai")
        if self.status_ijop == "aktif" and not (
            self.no_sk_ijop and self.no_sk_ijop.strip() and start and end and start <= date.today() <= end
        ):
            raise ValueError("IJOP aktif memerlukan SK dan tanggal izin yang sedang berlaku")
        return self


class PonpesCreate(Input):
    kecamatan_id: int = Field(gt=0)
    nspp: str | None = Field(default=None, pattern=r"^[0-9]{12}$")
    nama_ponpes: str = Field(min_length=1, max_length=150)
    nama_pengasuh: Name | None = None
    alamat_lengkap: str = Field(min_length=1, max_length=4000)
    tipe_pesantren: Tipe | None = None
    kuota_putra: int = Field(default=0, ge=0, le=100000)
    kuota_putri: int = Field(default=0, ge=0, le=100000)
    kontak_sekretariat: Phone | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    email_admin: EmailStr = Field(max_length=100)
    nama_admin: Name
    no_hp_admin: Phone


class PonpesUpdate(Input):
    deskripsi: str | None = Field(default=None, max_length=5000)
    program_unggulan: list[Name] | None = Field(default=None, max_length=20)
    fasilitas: list[Name] | None = Field(default=None, max_length=20)
    nama_ponpes: str | None = Field(default=None, min_length=1, max_length=150)
    nama_pengasuh: Name | None = None
    alamat_lengkap: str | None = Field(default=None, min_length=1, max_length=4000)
    tipe_pesantren: Tipe | None = None
    kontak_sekretariat: Phone | None = None
    kuota_putra: int | None = Field(default=None, ge=0, le=100000)
    kuota_putri: int | None = Field(default=None, ge=0, le=100000)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

    @model_validator(mode="after")
    def no_null(self):
        if not self.model_fields_set or any(getattr(self, key) is None for key in self.model_fields_set):
            raise ValueError("Isi minimal satu perubahan; null tidak diperbolehkan")
        return self


class LokasiOut(Output):
    alamat_bersumber: bool = False
    pin_tersedia: bool = False
    sumber_alamat_url: str | None = None
    sumber_koordinat_url: str | None = None
    diperiksa_pada: date | None = None
    ketelitian: str | None = None
    referensi_titik: str | None = None


PublicNote = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
SourceReference = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]


class PengawasanInput(Input):
    status_dokumen: Literal["belum_dikonfirmasi", "terdaftar"] = "belum_dikonfirmasi"
    nomor_statistik: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)] | None
    ) = None
    nomor_dokumen: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)] | None
    ) = None
    penerbit_dokumen: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)] | None
    ) = None
    tanggal_dokumen: IsoDate | None = None
    sumber_dokumen: SourceReference | None = None
    tanggal_pemeriksaan_dokumen: IsoDate | None = None
    catatan_dokumen: PublicNote | None = None
    status_operasional: Literal["belum_dikonfirmasi", "beroperasi", "tidak_beroperasi"] = "belum_dikonfirmasi"
    sumber_operasional: SourceReference | None = None
    tanggal_pemeriksaan_operasional: IsoDate | None = None
    catatan_operasional: PublicNote | None = None

    @field_validator("sumber_dokumen", "sumber_operasional")
    @classmethod
    def safe_source_reference(cls, value):
        if value is None:
            return value
        if any(ord(character) < 32 for character in value):
            raise ValueError("Sumber tidak boleh memuat karakter kontrol")
        scheme = re.match(r"^([a-z][a-z0-9+.-]*):", value, re.IGNORECASE)
        if scheme:
            kind = scheme.group(1).lower()
            if kind in {"http", "https"}:
                try:
                    parsed = urlsplit(value)
                    if (
                        not parsed.hostname
                        or parsed.username
                        or parsed.password
                        or any(character.isspace() for character in value)
                    ):
                        raise ValueError("URL sumber tidak valid")
                    parsed.port
                except ValueError:
                    raise ValueError("Gunakan URL sumber HTTP/HTTPS yang valid") from None
            elif kind in {"javascript", "data", "vbscript", "file", "blob", "mailto", "ftp"} or value[
                scheme.end() :
            ].startswith("//"):
                raise ValueError("Sumber harus berupa URL HTTP/HTTPS atau rujukan dokumen tertulis")
        if value.startswith("//"):
            raise ValueError("URL sumber harus menyertakan HTTP/HTTPS")
        return value

    @model_validator(mode="after")
    def checked_evidence(self):
        today = date.today()
        for field in ("tanggal_dokumen", "tanggal_pemeriksaan_dokumen", "tanggal_pemeriksaan_operasional"):
            value = getattr(self, field)
            if value and value > today:
                raise ValueError("Tanggal dokumen dan pemeriksaan tidak boleh di masa depan")
        for source, checked in (
            (self.sumber_dokumen, self.tanggal_pemeriksaan_dokumen),
            (self.sumber_operasional, self.tanggal_pemeriksaan_operasional),
        ):
            if bool(source) != bool(checked):
                raise ValueError("Sumber dan tanggal pemeriksaan wajib diisi bersama")
        if self.status_dokumen == "terdaftar" and not all(
            (
                self.nomor_statistik,
                self.nomor_dokumen,
                self.penerbit_dokumen,
                self.tanggal_dokumen,
                self.sumber_dokumen,
                self.tanggal_pemeriksaan_dokumen,
            )
        ):
            raise ValueError("Status terdaftar memerlukan identitas dokumen, sumber dan tanggal pemeriksaan")
        if self.tanggal_dokumen and (
            not self.tanggal_pemeriksaan_dokumen or self.tanggal_dokumen > self.tanggal_pemeriksaan_dokumen
        ):
            raise ValueError("Tanggal dokumen harus tidak melebihi tanggal pemeriksaan dokumen")
        if self.status_operasional != "belum_dikonfirmasi" and not all(
            (self.sumber_operasional, self.tanggal_pemeriksaan_operasional, self.catatan_operasional)
        ):
            raise ValueError("Status operasional memerlukan sumber, tanggal pemeriksaan dan catatan publik")
        return self


class PengawasanOut(PengawasanInput):
    model_config = ConfigDict(from_attributes=True)
    updated_at: datetime | None = None


class LayananInput(Input):
    pendaftaran_dibuka: bool
    konsultasi_dibuka: bool


class PonpesOut(Output):
    pengawasan: PengawasanOut = Field(default_factory=PengawasanOut)
    pendaftaran_dibuka: bool = False
    konsultasi_dibuka: bool = False
    pendaftaran_tersedia: bool = False
    konsultasi_tersedia: bool = False
    profil_publik: dict | None = None
    profil_referensi: bool = False
    layanan_tersedia: bool = False
    referensi: dict | None = None
    lokasi: LokasiOut = Field(default_factory=LokasiOut)
    deskripsi: str | None = None
    program_unggulan: list[str] | None = None
    fasilitas: list[str] | None = None
    id: int
    kecamatan_id: int
    nspp: str | None
    nama_ponpes: str
    slug: str
    nama_pengasuh: str | None
    alamat_lengkap: str
    tipe_pesantren: str | None
    status_ijop: str | None
    no_sk_ijop: str | None
    tanggal_ijop_mulai: date | None
    tanggal_ijop_selesai: date | None
    kuota_putra: int | None
    kuota_putri: int | None
    kontak_sekretariat: str | None
    latitude: float | None
    longitude: float | None
    sisa_kuota_putra: int | None = 0
    sisa_kuota_putri: int | None = 0
    demo: bool = True
    verifikasi_url: str = ""


class ResetPassword(Input):
    alasan: str = Field(min_length=5, max_length=500)


class Attachment(Input):
    filename: str = Field(min_length=1, max_length=120)
    content_base64: str = Field(min_length=1, max_length=6990508)


class PendaftaranCreate(Input):
    ponpes_id: int = Field(gt=0)
    nik_santri: str = Field(pattern=r"^[0-9]{16}$")
    nama_santri: Name
    jenis_kelamin: Literal["L", "P"]
    nama_wali: Name
    no_hp_wali: Phone
    file_kk: Attachment | None = None


class PendaftaranStatus(Input):
    status_seleksi: Seleksi


class PendaftaranTracking(Output):
    nomor_registrasi: str
    status_seleksi: str
    ponpes_id: int
    created_at: datetime


class PendaftaranOut(PendaftaranTracking):
    id: int
    nik_santri: str
    nama_santri: str
    jenis_kelamin: str
    nama_wali: str
    no_hp_wali: str
    has_file_kk: bool = False


class PengaduanCreate(Input):
    ponpes_id: int = Field(gt=0)
    kategori_kasus: Literal[
        "pelecehan_seksual", "kekerasan_fisik", "perundungan_bullying", "pemerasan", "lainnya"
    ]
    tanggal_kejadian: IsoDate
    lokasi_kejadian: str = Field(min_length=1, max_length=150)
    deskripsi_peristiwa: str = Field(min_length=10, max_length=20000)
    bukti_lampiran: Attachment | None = None
    mode_pelapor: Literal["terbuka", "rahasia"] = "terbuka"
    nama_pelapor: Name | None = None
    kontak_pelapor: Name | None = None

    @field_validator("deskripsi_peristiwa")
    @classmethod
    def fits_mysql_text(cls, value):
        if len(value.encode("utf-8")) > 65535:
            raise ValueError("Deskripsi maksimal 65535 byte UTF-8")
        return value

    @model_validator(mode="after")
    def identity(self):
        if self.tanggal_kejadian > date.today():
            raise ValueError("Tanggal kejadian tidak boleh di masa depan")
        if self.mode_pelapor == "rahasia":
            self.nama_pelapor = self.kontak_pelapor = None
        elif not self.nama_pelapor or not self.kontak_pelapor:
            raise ValueError("Identitas dan kontak wajib untuk laporan terbuka")
        return self


class PengaduanStatus(Input):
    status_tindakan: Tindakan
    catatan_internal: PublicNote | None = None


class PerkembanganOut(Output):
    id: int
    status_sebelum: str | None
    status_sesudah: str
    catatan_internal: str | None
    created_at: datetime


class PengaduanTracking(Output):
    kode_tiket: str
    status_tindakan: str
    created_at: datetime


class PengaduanOut(PengaduanTracking):
    nama_ponpes: str | None = None
    riwayat: list[PerkembanganOut] = Field(default_factory=list)
    id: int
    ponpes_id: int
    kategori_kasus: str
    tanggal_kejadian: date
    lokasi_kejadian: str
    deskripsi_peristiwa: str
    mode_pelapor: str
    nama_pelapor: str | None
    kontak_pelapor: str | None
    has_bukti_lampiran: bool = False


class ChatCreate(Input):
    ponpes_id: int = Field(gt=0)
    session_id: SessionId | None = None
    nama_warga: Name
    kontak_warga: str = Field(min_length=1, max_length=50)
    pesan: str = Field(min_length=1, max_length=4000)


class ChatReply(Input):
    session_id: SessionId
    pesan: str = Field(min_length=1, max_length=4000)


class ChatRead(Input):
    session_id: SessionId


class ChatOut(Output):
    id: int
    ponpes_id: int
    session_id: str
    pesan: str
    sender_role: str
    is_read: bool
    created_at: datetime


class AuditOut(Output):
    id: int
    user_id: int | None
    aksi: str
    detail: str | None
    ip_address: str | None
    created_at: datetime
