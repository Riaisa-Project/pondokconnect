import json
import re
import unicodedata
from datetime import date

from fastapi import HTTPException, Request
from sqlalchemy import exists, func, literal, or_, select
from sqlalchemy.orm import Session

from backend.config import settings
from backend.locations import location_view, reference_view
from backend.models.models import AuditLog, Kecamatan, Pendaftaran, Pengawasan, Ponpes
from backend.profiles import public_profile_view
from backend.schemas.schemas import LokasiOut, PengawasanOut, PonpesOut


def audit(db: Session, user_id: int, aksi: str, detail: dict, request: Request):
    db.add(
        AuditLog(
            user_id=user_id,
            aksi=aksi,
            detail=json.dumps(detail, ensure_ascii=False),
            ip_address=request.client.host if request.client else None,
        )
    )


def get_ponpes(db: Session, ponpes_id: int, *, lock=False) -> Ponpes:
    query = select(Ponpes).where(Ponpes.id == ponpes_id)
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    row = db.scalar(query)
    if not row:
        raise HTTPException(404, "Ponpes tidak ditemukan")
    return row


def own_ponpes(db: Session, user_id: int, *, lock=False) -> Ponpes:
    query = select(Ponpes).where(Ponpes.user_admin_id == user_id)
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    row = db.scalar(query)
    if not row:
        raise HTTPException(404, "Akun belum terhubung ke ponpes")
    return row


def occupied(db: Session, ponpes_id: int, gender: str) -> int:
    return (
        db.scalar(
            select(func.count(Pendaftaran.id)).where(
                Pendaftaran.ponpes_id == ponpes_id,
                Pendaftaran.jenis_kelamin == gender,
                Pendaftaran.status_seleksi != "ditolak",
            )
        )
        or 0
    )


def effective_status(row: Ponpes) -> str:
    if row.status_ijop == "aktif":
        today = date.today()
        if row.tanggal_ijop_selesai and row.tanggal_ijop_selesai < today:
            return "kedaluwarsa"
        if (
            not row.no_sk_ijop
            or not row.tanggal_ijop_mulai
            or not row.tanggal_ijop_selesai
            or row.tanggal_ijop_mulai > today
        ):
            return "proses_verifikasi"
    return row.status_ijop


def active_filter():
    return (
        or_(Ponpes.pendaftaran_dibuka.is_(True), Ponpes.konsultasi_dibuka.is_(True)),
        ~exists(
            select(Pengawasan.ponpes_id).where(
                Pengawasan.ponpes_id == Ponpes.id,
                Pengawasan.status_operasional == "tidak_beroperasi",
            )
        ),
    )


def public_filter():
    # Closed and unconfirmed profiles must remain discoverable for oversight
    # and reporting. Availability of services is a separate decision.
    return literal(True)


def require_service(db: Session, row: Ponpes, service: str):
    oversight = db.get(Pengawasan, row.id)
    if oversight and oversight.status_operasional == "tidak_beroperasi":
        raise HTTPException(409, "Layanan baru ditutup berdasarkan catatan operasional pesantren")
    if not getattr(row, f"{service}_dibuka"):
        raise HTTPException(409, "Layanan ini belum dibuka oleh pengurus pesantren")


def ponpes_view(db: Session, row: Ponpes, *, editing=False) -> PonpesOut:
    district = db.get(Kecamatan, row.kecamatan_id)
    oversight = db.get(Pengawasan, row.id)
    evidence = PengawasanOut.model_validate(oversight) if oversight else PengawasanOut()
    operating = evidence.status_operasional != "tidak_beroperasi"
    registration = bool(row.pendaftaran_dibuka and operating)
    consultation = bool(row.konsultasi_dibuka and operating)
    show_quota = editing or row.pendaftaran_dibuka
    return PonpesOut.model_validate(row).model_copy(
        update={
            "pengawasan": evidence,
            "lokasi": LokasiOut.model_validate(
                location_view(row, district.nama_kecamatan if district else "")
            ),
            "status_ijop": None,
            "no_sk_ijop": None,
            "tanggal_ijop_mulai": None,
            "tanggal_ijop_selesai": None,
            "pendaftaran_tersedia": registration,
            "konsultasi_tersedia": consultation,
            "layanan_tersedia": registration or consultation,
            "referensi": reference_view(row, district.nama_kecamatan if district else ""),
            "profil_publik": public_profile_view(row, district.nama_kecamatan if district else ""),
            "demo": settings.demo_mode and not row.profil_referensi,
            "kuota_putra": row.kuota_putra if show_quota else None,
            "kuota_putri": row.kuota_putri if show_quota else None,
            "sisa_kuota_putra": max(0, row.kuota_putra - occupied(db, row.id, "L")) if show_quota else None,
            "sisa_kuota_putri": max(0, row.kuota_putri - occupied(db, row.id, "P")) if show_quota else None,
            "verifikasi_url": f"{settings.public_frontend_url.rstrip('/')}/status-pesantren/{row.slug}",
        }
    )


def slugify(name: str, nspp: str) -> str:
    normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")[:140] + "-" + nspp
