import re
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.auth import ponpes_only
from backend.database import get_db
from backend.models.models import Kecamatan, Pendaftaran, Ponpes, User
from backend.schemas.schemas import LayananInput, PonpesOut, PonpesUpdate, Tipe
from backend.services import active_filter, audit, occupied, own_ponpes, ponpes_view, public_filter

router = APIRouter(tags=["Direktori ponpes"])


@router.get("/kecamatan/")
def kecamatan(db: Session = Depends(get_db)):
    return [
        {"id": k.id, "nama_kecamatan": k.nama_kecamatan}
        for k in db.scalars(select(Kecamatan).order_by(Kecamatan.nama_kecamatan))
    ]


@router.get("/ponpes/")
def directory(
    q: str = Query("", max_length=150),
    kecamatan_id: int | None = Query(None, gt=0),
    tipe: Tipe | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    sort: Literal["nama", "kuota", "terbaru"] = "nama",
    layanan: Literal["aktif"] | None = None,
    slugs: str | None = Query(None, max_length=16100),
    db: Session = Depends(get_db),
):
    query = select(Ponpes).where(public_filter())
    if layanan == "aktif":
        query = query.where(*active_filter())
    if q:
        query = query.where(Ponpes.nama_ponpes.contains(q, autoescape=True))
    if kecamatan_id:
        query = query.where(Ponpes.kecamatan_id == kecamatan_id)
    if tipe:
        query = query.where(Ponpes.tipe_pesantren == tipe)
    if slugs is not None:
        requested = slugs.split(",") if slugs else []
        if len(requested) > 100 or any(not re.fullmatch(r"[a-z0-9-]{1,160}", slug) for slug in requested):
            raise HTTPException(422, "Pilihan pesantren tidak valid; maksimal 100 slug")
        query = query.where(Ponpes.slug.in_(requested))
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    if sort == "kuota":
        reserved = (
            select(Pendaftaran.ponpes_id, func.count(Pendaftaran.id).label("reserved"))
            .where(Pendaftaran.status_seleksi != "ditolak")
            .group_by(Pendaftaran.ponpes_id)
            .subquery()
        )
        query = query.outerjoin(reserved, Ponpes.id == reserved.c.ponpes_id).order_by(
            (Ponpes.kuota_putra + Ponpes.kuota_putri - func.coalesce(reserved.c.reserved, 0)).desc(),
            Ponpes.id,
        )
    elif sort == "terbaru":
        query = query.order_by(Ponpes.created_at.desc(), Ponpes.id.desc())
    else:
        query = query.order_by(Ponpes.nama_ponpes, Ponpes.id)
    return {
        "items": [ponpes_view(db, p) for p in db.scalars(query.offset(offset).limit(limit))],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/ponpes/status/{slug}", response_model=PonpesOut)
def oversight_status(slug: str, db: Session = Depends(get_db)):
    row = db.scalar(select(Ponpes).where(Ponpes.slug == slug))
    if not row:
        raise HTTPException(404, "Pesantren tidak ditemukan")
    return ponpes_view(db, row)


@router.get("/ponpes/verifikasi-ijop/{nspp}", response_model=PonpesOut, deprecated=True)
def verify_ijop(nspp: str, db: Session = Depends(get_db)):
    row = db.scalar(select(Ponpes).where(Ponpes.nspp == nspp))
    if not row:
        raise HTTPException(404, "NSPP tidak ditemukan")
    return ponpes_view(db, row)


@router.get("/ponpes/{slug}", response_model=PonpesOut)
def detail(slug: str, db: Session = Depends(get_db)):
    row = db.scalar(select(Ponpes).where(Ponpes.slug == slug, public_filter()))
    if not row:
        raise HTTPException(404, "Pesantren tidak ditemukan")
    return ponpes_view(db, row)


@router.get("/admin/ponpes/my", response_model=PonpesOut, tags=["Admin ponpes"])
def my_profile(user: User = Depends(ponpes_only), db: Session = Depends(get_db)):
    return ponpes_view(db, own_ponpes(db, user.id), editing=True)


@router.put("/admin/ponpes/my", response_model=PonpesOut, tags=["Admin ponpes"])
def update_profile(
    payload: PonpesUpdate, request: Request, user: User = Depends(ponpes_only), db: Session = Depends(get_db)
):
    row = own_ponpes(db, user.id, lock=True)
    changes = payload.model_dump(exclude_unset=True)
    for field, gender in [("kuota_putra", "L"), ("kuota_putri", "P")]:
        if field in changes and changes[field] < occupied(db, row.id, gender):
            raise HTTPException(409, "Kuota tidak boleh lebih kecil daripada pendaftaran aktif")
    for key, value in changes.items():
        setattr(row, key, value)
    audit(db, user.id, "update_ponpes_profile", {"ponpes_id": row.id, "fields": sorted(changes)}, request)
    db.commit()
    return ponpes_view(db, row, editing=True)


@router.put("/admin/ponpes/my/layanan", response_model=PonpesOut, tags=["Admin ponpes"])
def update_services(
    payload: LayananInput, request: Request, user: User = Depends(ponpes_only), db: Session = Depends(get_db)
):
    row = own_ponpes(db, user.id, lock=True)
    for field, value in payload.model_dump().items():
        setattr(row, field, value)
    audit(db, user.id, "update_ponpes_services", {"ponpes_id": row.id, **payload.model_dump()}, request)
    db.commit()
    return ponpes_view(db, row, editing=True)
