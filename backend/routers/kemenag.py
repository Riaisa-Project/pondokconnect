import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from backend.auth import hash_password, satgas_only
from backend.database import get_db
from backend.models.models import AuditLog, Kecamatan, Pengawasan, Ponpes, User
from backend.schemas.schemas import AuditOut, PengawasanInput, PonpesCreate, PonpesOut, ResetPassword
from backend.services import audit, get_ponpes, ponpes_view, slugify

router = APIRouter(prefix="/admin", tags=["Pengawasan pesantren"])


@router.post("/kemenag/ponpes", status_code=201)
def create_ponpes(
    payload: PonpesCreate, request: Request, user: User = Depends(satgas_only), db: Session = Depends(get_db)
):
    if not db.get(Kecamatan, payload.kecamatan_id):
        raise HTTPException(404, "Kecamatan tidak ditemukan")
    if (payload.nspp and db.scalar(select(Ponpes.id).where(Ponpes.nspp == payload.nspp))) or db.scalar(
        select(User.id).where(User.email == str(payload.email_admin).lower())
    ):
        raise HTTPException(409, "NSPP atau email admin sudah terdaftar")
    temporary = secrets.token_urlsafe(18)
    account = User(
        email=str(payload.email_admin).lower(),
        nama_lengkap=payload.nama_admin,
        no_hp=payload.no_hp_admin,
        password_hash=hash_password(temporary),
        role="admin_ponpes",
        must_change_password=True,
    )
    db.add(account)
    db.flush()
    values = payload.model_dump(exclude={"email_admin", "nama_admin", "no_hp_admin"})
    row = Ponpes(
        **values,
        profil_referensi=True,
        user_admin_id=account.id,
        slug=slugify(payload.nama_ponpes, payload.nspp or secrets.token_hex(4)),
    )
    db.add(row)
    db.flush()
    audit(db, user.id, "create_ponpes", {"ponpes_id": row.id, "admin_id": account.id}, request)
    db.commit()
    return {
        "ponpes": ponpes_view(db, row),
        "email_admin": account.email,
        "temporary_password": temporary,
        "must_change_password": True,
    }


@router.get("/kemenag/ponpes")
def list_ponpes(
    q: str = Query("", max_length=150),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(satgas_only),
    db: Session = Depends(get_db),
):
    query = select(Ponpes)
    if q:
        query = query.where(
            or_(
                Ponpes.nama_ponpes.contains(q, autoescape=True),
                Ponpes.nspp.contains(q, autoescape=True),
                Ponpes.slug.contains(q, autoescape=True),
            )
        )
    rows = db.scalars(query.order_by(Ponpes.id).offset(offset).limit(limit))
    return {
        "items": [ponpes_view(db, row) for row in rows],
        "total": db.scalar(select(func.count()).select_from(query.subquery())),
        "limit": limit,
        "offset": offset,
    }


@router.get("/kemenag/ponpes/{ponpes_id}", response_model=PonpesOut)
def detail_ponpes(ponpes_id: int, user: User = Depends(satgas_only), db: Session = Depends(get_db)):
    return ponpes_view(db, get_ponpes(db, ponpes_id))


@router.put("/kemenag/ponpes/{ponpes_id}/ijop", include_in_schema=False)
def update_ijop(ponpes_id: int, user: User = Depends(satgas_only)):
    raise HTTPException(
        410,
        "Penetapan IJOP tidak tersedia. Gunakan catatan pengawasan berdasarkan dokumen dari pihak berwenang.",
    )


@router.put("/kemenag/ponpes/{ponpes_id}/pengawasan", response_model=PonpesOut)
def update_oversight(
    ponpes_id: int,
    payload: PengawasanInput,
    request: Request,
    user: User = Depends(satgas_only),
    db: Session = Depends(get_db),
):
    try:
        row = get_ponpes(db, ponpes_id, lock=True)
        record = db.get(Pengawasan, row.id)
        before = (
            {"status_dokumen": record.status_dokumen, "status_operasional": record.status_operasional}
            if record
            else {"status_dokumen": "belum_dikonfirmasi", "status_operasional": "belum_dikonfirmasi"}
        )
        if record is None:
            record = Pengawasan(ponpes_id=row.id)
            db.add(record)
        for key, value in payload.model_dump().items():
            setattr(record, key, value)
        record.pemeriksa_id = user.id
        audit(
            db,
            user.id,
            "update_pengawasan",
            {
                "ponpes_id": row.id,
                "fields": sorted(payload.model_dump()),
                "before": before,
                "after": {
                    "status_dokumen": payload.status_dokumen,
                    "status_operasional": payload.status_operasional,
                },
            },
            request,
        )
        db.flush()
        result = ponpes_view(db, row)
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise


@router.post("/kemenag/reset-password-ponpes/{ponpes_id}")
def reset_password(
    ponpes_id: int,
    payload: ResetPassword,
    request: Request,
    user: User = Depends(satgas_only),
    db: Session = Depends(get_db),
):
    row = get_ponpes(db, ponpes_id)
    account = db.scalar(
        select(User)
        .where(User.id == row.user_admin_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if not account:
        raise HTTPException(404, "Ponpes belum mempunyai akun admin")
    temporary = secrets.token_urlsafe(18)
    account.password_hash = hash_password(temporary)
    account.must_change_password = True
    # Do not copy free-form reasons into audit: they may accidentally contain secrets.
    audit(db, user.id, "reset_password_ponpes", {"ponpes_id": row.id, "admin_id": account.id}, request)
    db.commit()
    return {"email_admin": account.email, "temporary_password": temporary, "must_change_password": True}


@router.get("/audit-logs")
def audit_logs(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(satgas_only),
    db: Session = Depends(get_db),
):
    query = select(AuditLog).order_by(AuditLog.id.desc()).offset(offset).limit(limit)
    return {
        "items": [AuditOut.model_validate(row) for row in db.scalars(query)],
        "total": db.scalar(select(func.count(AuditLog.id))),
        "limit": limit,
        "offset": offset,
    }
