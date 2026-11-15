import json
import re
import unicodedata

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


def ponpes_views(db: Session, rows: list[Ponpes], *, editing=False) -> list[PonpesOut]:
    if not rows:
        return []
    district_ids = {r.kecamatan_id for r in rows if r.kecamatan_id}
    districts = (
        {d.id: d.nama_kecamatan for d in db.scalars(select(Kecamatan).where(Kecamatan.id.in_(district_ids)))}
        if district_ids
        else {}
    )
    ponpes_ids = [r.id for r in rows]
    oversights = {
        o.ponpes_id: o for o in db.scalars(select(Pengawasan).where(Pengawasan.ponpes_id.in_(ponpes_ids)))
    }
    quota_ids = [r.id for r in rows if editing or r.pendaftaran_dibuka]
    occupied_counts: dict[tuple[int, str], int] = {}
    if quota_ids:
        for pid, gender, count in db.execute(
            select(Pendaftaran.ponpes_id, Pendaftaran.jenis_kelamin, func.count(Pendaftaran.id))
            .where(Pendaftaran.ponpes_id.in_(quota_ids), Pendaftaran.status_seleksi != "ditolak")
            .group_by(Pendaftaran.ponpes_id, Pendaftaran.jenis_kelamin)
        ):
            occupied_counts[(pid, gender)] = count

    results = []
    for row in rows:
        district_name = districts.get(row.kecamatan_id, "")
        oversight = oversights.get(row.id)
        evidence = PengawasanOut.model_validate(oversight) if oversight else PengawasanOut()
        operating = evidence.status_operasional != "tidak_beroperasi"
        registration = bool(row.pendaftaran_dibuka and operating)
        consultation = bool(row.konsultasi_dibuka and operating)
        show_quota = editing or row.pendaftaran_dibuka
        occ_l = occupied_counts.get((row.id, "L"), 0)
        occ_p = occupied_counts.get((row.id, "P"), 0)
        results.append(
            PonpesOut.model_validate(row).model_copy(
                update={
                    "pengawasan": evidence,
                    "lokasi": LokasiOut.model_validate(location_view(row, district_name)),
                    "status_ijop": None,
                    "no_sk_ijop": None,
                    "tanggal_ijop_mulai": None,
                    "tanggal_ijop_selesai": None,
                    "pendaftaran_tersedia": registration,
                    "konsultasi_tersedia": consultation,
                    "layanan_tersedia": registration or consultation,
                    "referensi": reference_view(row, district_name),
                    "profil_publik": public_profile_view(row, district_name),
                    "demo": settings.demo_mode and not row.profil_referensi,
                    "kuota_putra": row.kuota_putra if show_quota else None,
                    "kuota_putri": row.kuota_putri if show_quota else None,
                    "sisa_kuota_putra": max(0, row.kuota_putra - occ_l) if show_quota else None,
                    "sisa_kuota_putri": max(0, row.kuota_putri - occ_p) if show_quota else None,
                    "verifikasi_url": f"{settings.public_frontend_url.rstrip('/')}/status-pesantren/{row.slug}",
                }
            )
        )
    return results


def ponpes_view(db: Session, row: Ponpes, *, editing=False) -> PonpesOut:
    return ponpes_views(db, [row], editing=editing)[0]


def slugify(name: str, nspp: str) -> str:
    normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    base = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")[:140]
    if not base:
        base = "ponpes"
    return f"{base}-{nspp}"
