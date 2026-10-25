import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.auth import satgas_only
from backend.database import get_db
from backend.limiter import limiter
from backend.models.models import Pengaduan, PengaduanPerkembangan, Ponpes, User
from backend.schemas.schemas import (
    PengaduanCreate,
    PengaduanOut,
    PengaduanStatus,
    PengaduanTracking,
    PerkembanganOut,
    Tindakan,
)
from backend.services import audit, get_ponpes
from backend.uploads import private_file, staged_attachment

router = APIRouter(tags=["Perlindungan santri"])


def view(row, db, *, include_history=False, institution_name=None):
    if institution_name is None:
        institution = db.get(Ponpes, row.ponpes_id)
        institution_name = institution.nama_ponpes if institution else None
    progress = []
    if include_history:
        progress = [
            PerkembanganOut.model_validate(item)
            for item in db.scalars(
                select(PengaduanPerkembangan)
                .where(PengaduanPerkembangan.pengaduan_id == row.id)
                .order_by(PengaduanPerkembangan.id)
            )
        ]
    result = PengaduanOut.model_validate(row).model_copy(
        update={
            "has_bukti_lampiran": bool(row.bukti_lampiran),
            "nama_ponpes": institution_name,
            "riwayat": progress,
        }
    )
    return result if include_history else result.model_dump(exclude={"riwayat"})


@router.post("/pengaduan/kirim", response_model=PengaduanTracking, status_code=201)
@limiter.limit("5/minute")
def report(payload: PengaduanCreate, request: Request, db: Session = Depends(get_db)):
    # Reports remain available for inactive/expired institutions as well.
    get_ponpes(db, payload.ponpes_id)
    with staged_attachment(payload.bukti_lampiran) as filename:
        row = Pengaduan(
            **payload.model_dump(exclude={"bukti_lampiran"}),
            kode_tiket=secrets.token_hex(16),
            bukti_lampiran=filename,
        )
        db.add(row)
        db.flush()
        db.add(
            PengaduanPerkembangan(pengaduan_id=row.id, status_sebelum=None, status_sesudah="masuk_antrian")
        )
        db.commit()
    return row


@router.get("/pengaduan/lacak/{kode_tiket}", response_model=PengaduanTracking)
def track(kode_tiket: str, db: Session = Depends(get_db)):
    row = db.scalar(select(Pengaduan).where(Pengaduan.kode_tiket == kode_tiket))
    if not row:
        raise HTTPException(404, "Tiket tidak ditemukan")
    return row


@router.get("/admin/pengaduan")
def reports(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    status: Tindakan | None = None,
    ponpes_id: int | None = Query(None, gt=0),
    q: str = Query("", max_length=150),
    user: User = Depends(satgas_only),
    db: Session = Depends(get_db),
):
    query = select(Pengaduan, Ponpes.nama_ponpes).join(Ponpes, Ponpes.id == Pengaduan.ponpes_id)
    if status:
        query = query.where(Pengaduan.status_tindakan == status)
    if ponpes_id:
        query = query.where(Pengaduan.ponpes_id == ponpes_id)
    if q:
        query = query.where(Ponpes.nama_ponpes.contains(q, autoescape=True))
    return {
        "items": [
            view(row, db, institution_name=name)
            for row, name in db.execute(query.order_by(Pengaduan.id.desc()).offset(offset).limit(limit))
        ],
        "total": db.scalar(select(func.count()).select_from(query.subquery())),
        "limit": limit,
        "offset": offset,
    }


def get_case(db, case_id, lock=False):
    query = select(Pengaduan).where(Pengaduan.id == case_id)
    if lock:
        query = query.with_for_update()
    row = db.scalar(query)
    if not row:
        raise HTTPException(404, "Pengaduan tidak ditemukan")
    return row


@router.get("/admin/pengaduan/{case_id}", response_model=PengaduanOut)
def detail(case_id: int, user: User = Depends(satgas_only), db: Session = Depends(get_db)):
    return view(get_case(db, case_id), db, include_history=True)


@router.put(
    "/admin/pengaduan/{case_id}/status", response_model=PengaduanOut, response_model_exclude={"riwayat"}
)
def update_status(
    case_id: int,
    payload: PengaduanStatus,
    request: Request,
    user: User = Depends(satgas_only),
    db: Session = Depends(get_db),
):
    try:
        row = get_case(db, case_id, lock=True)
        before = row.status_tindakan
        row.status_tindakan = payload.status_tindakan
        db.add(
            PengaduanPerkembangan(
                pengaduan_id=row.id,
                petugas_id=user.id,
                status_sebelum=before,
                status_sesudah=row.status_tindakan,
                catatan_internal=payload.catatan_internal,
            )
        )
        audit(
            db,
            user.id,
            "update_pengaduan_status",
            {"pengaduan_id": row.id, "before": before, "after": row.status_tindakan},
            request,
        )
        db.flush()
        result = view(row, db)
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise


@router.get("/admin/pengaduan/{case_id}/bukti")
def evidence(case_id: int, user: User = Depends(satgas_only), db: Session = Depends(get_db)):
    return private_file(get_case(db, case_id).bukti_lampiran)
