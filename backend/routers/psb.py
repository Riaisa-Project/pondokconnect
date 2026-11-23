"""Penerimaan santri baru: gelombang, tahapan seleksi, pengumuman, daftar ulang.

Alur nyata di pesantren: pengurus membuka GELOMBANG dengan jendela tanggal dan
kuota, calon mendaftar (satu form, parameter berbeda ada di baris gelombang),
hasil tiap TAHAPAN dicatat, lalu yang diterima wajib DAFTAR ULANG sebelum
tenggat — lewat tenggat berarti kursinya pindah ke cadangan.
"""

from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.auth import ponpes_only
from backend.database import get_db
from backend.limiter import limiter
from backend.models.models import (
    CONSUMING,
    DaftarUlang,
    Gelombang,
    Pendaftaran,
    SeleksiTahapan,
    User,
)
from backend.schemas.schemas import (
    DaftarUlangCreate,
    DaftarUlangKirim,
    DaftarUlangOut,
    DaftarUlangUpdate,
    GelombangCreate,
    GelombangOut,
    PendaftaranRincian,
    SeleksiTahapanCreate,
    SeleksiTahapanOut,
    SeleksiTahapanUpdate,
)
from backend.services import audit, own_ponpes
from backend.uploads import private_file, staged_attachment

router = APIRouter(tags=["Penerimaan santri baru"])


def own_registration(db: Session, user: User, registration_id: int) -> Pendaftaran:
    ponpes = own_ponpes(db, user.id)
    row = db.scalar(
        select(Pendaftaran).where(Pendaftaran.id == registration_id, Pendaftaran.ponpes_id == ponpes.id)
    )
    if not row:
        raise HTTPException(404, "Pendaftaran tidak ditemukan")
    return row


def own_tahapan(db: Session, user: User, tahapan_id: int) -> SeleksiTahapan:
    ponpes = own_ponpes(db, user.id)
    row = db.scalar(
        select(SeleksiTahapan)
        .join(Pendaftaran, Pendaftaran.id == SeleksiTahapan.pendaftaran_id)
        .where(SeleksiTahapan.id == tahapan_id, Pendaftaran.ponpes_id == ponpes.id)
    )
    if not row:
        raise HTTPException(404, "Tahapan tidak ditemukan")
    return row


def own_daftar_ulang(db: Session, user: User, daftar_ulang_id: int) -> DaftarUlang:
    ponpes = own_ponpes(db, user.id)
    row = db.scalar(
        select(DaftarUlang)
        .join(Pendaftaran, Pendaftaran.id == DaftarUlang.pendaftaran_id)
        .where(DaftarUlang.id == daftar_ulang_id, Pendaftaran.ponpes_id == ponpes.id)
    )
    if not row:
        raise HTTPException(404, "Daftar ulang tidak ditemukan")
    return row


# ---------------------------------------------------------------- publik


@router.get("/gelombang", response_model=list[GelombangOut])
def open_waves(
    ponpes_id: int = Query(gt=0),
    terbuka: bool = Query(False, description="Hanya yang sedang dibuka hari ini"),
    db: Session = Depends(get_db),
):
    query = select(Gelombang).where(Gelombang.ponpes_id == ponpes_id, Gelombang.aktif.is_(True))
    if terbuka:
        today = date.today()
        query = query.where(Gelombang.tanggal_buka <= today, Gelombang.tanggal_tutup >= today)
    return list(db.scalars(query.order_by(Gelombang.tanggal_buka)))


def rincian(db: Session, row: Pendaftaran) -> PendaftaranRincian:
    tahapan = list(
        db.scalars(
            select(SeleksiTahapan)
            .where(SeleksiTahapan.pendaftaran_id == row.id)
            .order_by(SeleksiTahapan.urutan)
        )
    )
    daftar_ulang = db.scalar(select(DaftarUlang).where(DaftarUlang.pendaftaran_id == row.id))
    wave = db.get(Gelombang, row.gelombang_id) if row.gelombang_id else None
    sisa = None
    if daftar_ulang and daftar_ulang.tenggat_at and daftar_ulang.status != "selesai":
        sisa = (daftar_ulang.tenggat_at.date() - date.today()).days
    return PendaftaranRincian.model_validate(row).model_copy(
        update={
            "gelombang_nama": wave.nama if wave else None,
            "tahapan": [SeleksiTahapanOut.model_validate(t) for t in tahapan],
            "daftar_ulang": (
                DaftarUlangOut.model_validate(daftar_ulang).model_copy(update={"bukti_bayar": None})
                if daftar_ulang
                else None
            ),
            "has_bukti_bayar": bool(daftar_ulang and daftar_ulang.bukti_bayar),
            "sisa_hari_daftar_ulang": sisa,
            "kamar": daftar_ulang.kamar if daftar_ulang else None,
        }
    )


def by_number(db: Session, number: str) -> Pendaftaran:
    row = db.scalar(select(Pendaftaran).where(Pendaftaran.nomor_registrasi == number))
    if not row:
        raise HTTPException(404, "Nomor registrasi tidak ditemukan")
    return row


@router.get("/pendaftaran/lacak/{no_reg}/rincian", response_model=PendaftaranRincian)
def track_detail(no_reg: str, db: Session = Depends(get_db)):
    return rincian(db, by_number(db, no_reg))


@router.post("/pendaftaran/lacak/{no_reg}/daftar-ulang", response_model=PendaftaranRincian)
@limiter.limit("5/minute")
def submit_daftar_ulang(
    no_reg: str, payload: DaftarUlangKirim, request: Request, db: Session = Depends(get_db)
):
    row = by_number(db, no_reg)
    if row.status_seleksi not in ("diterima", "daftar_ulang"):
        raise HTTPException(409, "Belum ada panggilan daftar ulang untuk nomor ini")
    record = db.scalar(select(DaftarUlang).where(DaftarUlang.pendaftaran_id == row.id))
    if not record:
        raise HTTPException(409, "Pengurus belum membuka daftar ulang untuk nomor ini")
    if record.status == "selesai":
        raise HTTPException(409, "Daftar ulang sudah selesai diverifikasi")
    if record.tenggat_at and record.tenggat_at < datetime.now():
        raise HTTPException(409, "Tenggat daftar ulang sudah lewat")
    with staged_attachment(payload.bukti_bayar) as filename:
        if filename:
            record.bukti_bayar = filename
        if payload.berkas_asli is not None:
            record.berkas_asli = payload.berkas_asli
        record.pernyataan_at = datetime.now()
        record.status = "menunggu_verifikasi"
        db.commit()
    return rincian(db, row)


# ---------------------------------------------------------------- pengurus


@router.get("/admin/gelombang", response_model=list[GelombangOut])
def admin_waves(user: User = Depends(ponpes_only), db: Session = Depends(get_db)):
    ponpes = own_ponpes(db, user.id)
    return list(
        db.scalars(
            select(Gelombang)
            .where(Gelombang.ponpes_id == ponpes.id)
            .order_by(Gelombang.tanggal_buka.desc())
        )
    )


def wave_payload(payload: GelombangCreate, ponpes_id: int) -> dict:
    if payload.tanggal_tutup < payload.tanggal_buka:
        raise HTTPException(422, "Tanggal tutup tidak boleh mendahului tanggal buka")
    return payload.model_dump(exclude={"ponpes_id"}) | {"ponpes_id": ponpes_id}


@router.post("/admin/gelombang", response_model=GelombangOut, status_code=201)
def create_wave(
    payload: GelombangCreate,
    request: Request,
    user: User = Depends(ponpes_only),
    db: Session = Depends(get_db),
):
    ponpes = own_ponpes(db, user.id)
    if db.scalar(
        select(Gelombang.id).where(Gelombang.ponpes_id == ponpes.id, Gelombang.nama == payload.nama)
    ):
        raise HTTPException(409, "Nama gelombang sudah dipakai")
    row = Gelombang(**wave_payload(payload, ponpes.id))
    db.add(row)
    audit(db, user.id, "create_gelombang", {"nama": payload.nama}, request)
    db.commit()
    return row


@router.put("/admin/gelombang/{gelombang_id}", response_model=GelombangOut)
def update_wave(
    gelombang_id: int,
    payload: GelombangCreate,
    request: Request,
    user: User = Depends(ponpes_only),
    db: Session = Depends(get_db),
):
    ponpes = own_ponpes(db, user.id)
    row = db.scalar(
        select(Gelombang).where(Gelombang.id == gelombang_id, Gelombang.ponpes_id == ponpes.id)
    )
    if not row:
        raise HTTPException(404, "Gelombang tidak ditemukan")
    for field, value in wave_payload(payload, ponpes.id).items():
        setattr(row, field, value)
    audit(db, user.id, "update_gelombang", {"gelombang_id": row.id}, request)
    db.commit()
    return row


@router.get("/admin/pendaftaran/{registration_id}/rincian", response_model=PendaftaranRincian)
def admin_detail(
    registration_id: int, user: User = Depends(ponpes_only), db: Session = Depends(get_db)
):
    return rincian(db, own_registration(db, user, registration_id))


@router.get("/admin/pendaftaran/{registration_id}/bukti-bayar")
def daftar_ulang_proof(
    registration_id: int, user: User = Depends(ponpes_only), db: Session = Depends(get_db)
):
    row = own_registration(db, user, registration_id)
    record = db.scalar(select(DaftarUlang).where(DaftarUlang.pendaftaran_id == row.id))
    return private_file(record.bukti_bayar if record else None)


@router.post("/admin/pendaftaran/{registration_id}/tahapan", response_model=SeleksiTahapanOut, status_code=201)
def psb_add_tahapan(
    registration_id: int,
    payload: SeleksiTahapanCreate,
    request: Request,
    user: User = Depends(ponpes_only),
    db: Session = Depends(get_db),
):
    row = own_registration(db, user, registration_id)
    if db.scalar(
        select(SeleksiTahapan.id).where(
            SeleksiTahapan.pendaftaran_id == row.id, SeleksiTahapan.urutan == payload.urutan
        )
    ):
        raise HTTPException(409, "Urutan tahapan itu sudah dipakai")
    stage = SeleksiTahapan(**payload.model_dump(exclude={"pendaftaran_id"}), pendaftaran_id=row.id)
    db.add(stage)
    audit(db, user.id, "create_tahapan", {"pendaftaran_id": row.id, "nama": payload.nama}, request)
    db.commit()
    return stage


@router.put("/admin/tahapan/{tahapan_id}", response_model=SeleksiTahapanOut)
def psb_update_tahapan(
    tahapan_id: int,
    payload: SeleksiTahapanUpdate,
    request: Request,
    user: User = Depends(ponpes_only),
    db: Session = Depends(get_db),
):
    stage = own_tahapan(db, user, tahapan_id)
    stage.status = payload.status
    for field in ("jadwal_at", "lokasi", "catatan"):
        value = getattr(payload, field)
        if value is not None:
            setattr(stage, field, value)
    audit(
        db,
        user.id,
        "update_tahapan",
        {"tahapan_id": stage.id, "status": payload.status},
        request,
    )
    db.commit()
    return stage


@router.post(
    "/admin/pendaftaran/{registration_id}/daftar-ulang", response_model=DaftarUlangOut, status_code=201
)
def psb_open_daftar_ulang_admin(
    registration_id: int,
    payload: DaftarUlangCreate,
    request: Request,
    user: User = Depends(ponpes_only),
    db: Session = Depends(get_db),
):
    row = own_registration(db, user, registration_id)
    if row.status_seleksi not in ("diterima", "daftar_ulang"):
        raise HTTPException(409, "Daftar ulang hanya untuk pendaftar yang sudah diterima")
    if db.scalar(select(DaftarUlang.id).where(DaftarUlang.pendaftaran_id == row.id)):
        raise HTTPException(409, "Daftar ulang sudah dibuka untuk pendaftar ini")
    record = DaftarUlang(
        **payload.model_dump(
            exclude={"pendaftaran_id", "status", "bukti_bayar", "pernyataan_at"}
        ),
        pendaftaran_id=row.id,
    )
    # Tenggat default 7 hari: papan pengumuman tanpa tenggat tidak menutup celah apa pun.
    if not record.tenggat_at:
        record.tenggat_at = datetime.now() + timedelta(days=7)
    row.status_seleksi = "daftar_ulang"
    db.add(record)
    audit(db, user.id, "open_daftar_ulang", {"pendaftaran_id": row.id}, request)
    db.commit()
    return record


@router.put("/admin/daftar-ulang/{daftar_ulang_id}", response_model=DaftarUlangOut)
def psb_decide_daftar_ulang_admin(
    daftar_ulang_id: int,
    payload: DaftarUlangUpdate,
    request: Request,
    user: User = Depends(ponpes_only),
    db: Session = Depends(get_db),
):
    record = own_daftar_ulang(db, user, daftar_ulang_id)
    row = db.get(Pendaftaran, record.pendaftaran_id)
    if payload.status == "selesai" and not (payload.nomor_induk or record.nomor_induk):
        raise HTTPException(422, "Nomor induk diperlukan untuk menutup daftar ulang")
    record.status = payload.status
    for field in ("nomor_induk", "kamar", "catatan"):
        value = getattr(payload, field)
        if value is not None:
            setattr(record, field, value)
    if record.status == "selesai":
        row.nomor_induk = record.nomor_induk
    if record.status == "gugur":
        # Kursi hangus: pemiliknya kembali ke cadangan, bukan memakan kuota.
        row.status_seleksi = "gugur"
    audit(
        db,
        user.id,
        "update_daftar_ulang",
        {"daftar_ulang_id": record.id, "status": record.status},
        request,
    )
    db.commit()
    return record


@router.get("/admin/papan-daftar-ulang", response_model=list[PendaftaranRincian])
def psb_get_daftar_ulang_board(user: User = Depends(ponpes_only), db: Session = Depends(get_db)):
    """Pengumuman terbuka: siapa yang dipanggil daftar ulang dan sisa tenggatnya."""
    ponpes = own_ponpes(db, user.id)
    rows = db.scalars(
        select(Pendaftaran)
        .where(
            Pendaftaran.ponpes_id == ponpes.id,
            Pendaftaran.status_seleksi.in_(("diterima", "daftar_ulang")),
        )
        .order_by(Pendaftaran.id.desc())
        .limit(200)
    )
    return [rincian(db, row) for row in rows]
