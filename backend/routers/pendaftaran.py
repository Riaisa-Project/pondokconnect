import secrets
from datetime import datetime
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from reportlab.graphics.barcode import code128
from reportlab.lib.pagesizes import A5
from reportlab.pdfgen import canvas
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.auth import ponpes_only
from backend.database import get_db
from backend.models.models import Pendaftaran, User
from backend.schemas.schemas import PendaftaranCreate, PendaftaranOut, PendaftaranStatus, PendaftaranTracking
from backend.services import audit, get_ponpes, occupied, own_ponpes, require_service
from backend.uploads import private_file, staged_attachment

router = APIRouter(tags=["Pendaftaran santri"])


def view(row: Pendaftaran):
    return PendaftaranOut.model_validate(row).model_copy(update={"has_file_kk": bool(row.file_kk)})


@router.post("/pendaftaran/kirim", status_code=201, response_model=PendaftaranTracking)
def register(payload: PendaftaranCreate, db: Session = Depends(get_db)):
    ponpes = get_ponpes(db, payload.ponpes_id, lock=True)
    require_service(db, ponpes, "pendaftaran")
    if db.scalar(
        select(Pendaftaran.id).where(
            Pendaftaran.ponpes_id == ponpes.id, Pendaftaran.nik_santri == payload.nik_santri
        )
    ):
        raise HTTPException(409, "NIK sudah terdaftar pada ponpes ini")
    capacity = ponpes.kuota_putra if payload.jenis_kelamin == "L" else ponpes.kuota_putri
    if occupied(db, ponpes.id, payload.jenis_kelamin) >= capacity:
        raise HTTPException(409, "Kuota kategori santri telah penuh")
    with staged_attachment(payload.file_kk) as filename:
        row = Pendaftaran(
            **payload.model_dump(exclude={"file_kk"}),
            file_kk=filename,
            nomor_registrasi=f"REG-{datetime.now():%Y%m}-{secrets.token_hex(8).upper()}",
        )
        db.add(row)
        db.commit()
    return row


def by_number(db, number):
    row = db.scalar(select(Pendaftaran).where(Pendaftaran.nomor_registrasi == number))
    if not row:
        raise HTTPException(404, "Nomor registrasi tidak ditemukan")
    return row


@router.get("/pendaftaran/lacak/{no_reg}", response_model=PendaftaranTracking)
def track(no_reg: str, db: Session = Depends(get_db)):
    return by_number(db, no_reg)


@router.get(
    "/pendaftaran/kartu/{no_reg}",
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
)
def registration_card(no_reg: str, db: Session = Depends(get_db)):
    row = by_number(db, no_reg)
    ponpes = get_ponpes(db, row.ponpes_id)
    stream = BytesIO()
    doc = canvas.Canvas(stream, pagesize=A5)
    doc.setTitle("Bukti Pendaftaran Pondok Connect")
    doc.setFont("Helvetica-Bold", 15)
    doc.drawString(25, 550, "PONDOK CONNECT LAMONGAN")
    doc.setFont("Helvetica", 11)
    lines = [
        "Bukti Pendaftaran Santri",
        row.nomor_registrasi,
        row.nama_santri,
        ponpes.nama_ponpes,
        f"Status: {row.status_seleksi}",
        "Hubungi sekretariat untuk jadwal daftar ulang.",
        "Kartu ini bukan bukti kelulusan seleksi.",
    ]
    y = 520
    for line in lines:
        # Fit long names without drawing outside the card.
        size = min(11, 360 / max(doc.stringWidth(line, "Helvetica", 1), 1))
        doc.setFont("Helvetica", size)
        doc.drawString(25, y, line)
        y -= 28
    code128.Code128(row.nomor_registrasi, barWidth=0.75, barHeight=45).drawOn(doc, 25, y - 55)
    doc.save()
    return Response(
        stream.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{row.nomor_registrasi}.pdf"'},
    )


@router.get("/admin/pendaftaran")
def registrations(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(ponpes_only),
    db: Session = Depends(get_db),
):
    ponpes = own_ponpes(db, user.id)
    query = select(Pendaftaran).where(Pendaftaran.ponpes_id == ponpes.id)
    return {
        "items": [
            view(row) for row in db.scalars(query.order_by(Pendaftaran.id.desc()).offset(offset).limit(limit))
        ],
        "total": db.scalar(select(func.count()).select_from(query.subquery())),
        "limit": limit,
        "offset": offset,
    }


@router.put("/admin/pendaftaran/{registration_id}/status", response_model=PendaftaranOut)
def update_status(
    registration_id: int,
    payload: PendaftaranStatus,
    request: Request,
    user: User = Depends(ponpes_only),
    db: Session = Depends(get_db),
):
    ponpes = own_ponpes(db, user.id, lock=True)
    row = db.scalar(
        select(Pendaftaran).where(Pendaftaran.id == registration_id, Pendaftaran.ponpes_id == ponpes.id)
    )
    if not row:
        raise HTTPException(404, "Pendaftaran tidak ditemukan")
    before = row.status_seleksi
    if before == "ditolak" and payload.status_seleksi != "ditolak":
        capacity = ponpes.kuota_putra if row.jenis_kelamin == "L" else ponpes.kuota_putri
        if occupied(db, ponpes.id, row.jenis_kelamin) >= capacity:
            raise HTTPException(409, "Kuota kategori santri telah penuh")
    row.status_seleksi = payload.status_seleksi
    audit(
        db,
        user.id,
        "update_pendaftaran_status",
        {"pendaftaran_id": row.id, "before": before, "after": row.status_seleksi},
        request,
    )
    db.commit()
    return view(row)


@router.get("/admin/pendaftaran/{registration_id}/berkas")
def registration_file(registration_id: int, user: User = Depends(ponpes_only), db: Session = Depends(get_db)):
    ponpes = own_ponpes(db, user.id)
    row = db.scalar(
        select(Pendaftaran).where(Pendaftaran.id == registration_id, Pendaftaran.ponpes_id == ponpes.id)
    )
    if not row:
        raise HTTPException(404, "Pendaftaran tidak ditemukan")
    return private_file(row.file_kk)
