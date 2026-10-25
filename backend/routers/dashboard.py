"""Role-scoped oversight/reporting summary; never expose case details publicly."""

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.auth import require_roles
from backend.config import settings
from backend.database import get_db
from backend.models.models import (
    DOKUMEN,
    OPERASIONAL,
    SELEKSI,
    TINDAKAN,
    Chat,
    Pendaftaran,
    Pengaduan,
    Pengawasan,
    Ponpes,
    User,
)
from backend.services import own_ponpes, ponpes_view

router = APIRouter(prefix="/admin", tags=["Dashboard pengawasan"])


@router.get("/dashboard")
def dashboard(
    user: User = Depends(require_roles("satgas_kemenag", "admin_ponpes")), db: Session = Depends(get_db)
):
    if user.role == "admin_ponpes":
        own = own_ponpes(db, user.id)
        counts = dict(
            db.execute(
                select(Pendaftaran.status_seleksi, func.count(Pendaftaran.id))
                .where(Pendaftaran.ponpes_id == own.id)
                .group_by(Pendaftaran.status_seleksi)
            ).all()
        )
        selection = {status: counts.get(status, 0) for status in SELEKSI}
        return {
            "role": user.role,
            "demo": settings.demo_mode,
            "seleksi": selection,
            "ponpes": ponpes_view(db, own, editing=True),
            "metrics": {
                "pendaftaran_total": sum(selection.values()),
                "santri_diterima": selection["diterima"],
                "pesan_belum_dibaca": db.scalar(
                    select(func.count(Chat.id)).where(
                        Chat.ponpes_id == own.id, Chat.sender_role == "warga", Chat.is_read.is_(False)
                    )
                )
                or 0,
            },
        }
    cases = dict(
        db.execute(
            select(Pengaduan.status_tindakan, func.count(Pengaduan.id)).group_by(Pengaduan.status_tindakan)
        ).all()
    )
    distribution = {status: cases.get(status, 0) for status in TINDAKAN}
    documents = dict.fromkeys(DOKUMEN, 0)
    operations = dict.fromkeys(OPERASIONAL, 0)
    for status_document, status_operation in db.execute(
        select(Pengawasan.status_dokumen, Pengawasan.status_operasional)
        .select_from(Ponpes)
        .outerjoin(Pengawasan, Pengawasan.ponpes_id == Ponpes.id)
    ):
        documents[status_document or "belum_dikonfirmasi"] += 1
        operations[status_operation or "belum_dikonfirmasi"] += 1
    unresolved = (
        db.scalar(
            select(func.count(Ponpes.id))
            .outerjoin(Pengawasan, Pengawasan.ponpes_id == Ponpes.id)
            .where(
                (Pengawasan.ponpes_id.is_(None))
                | (Pengawasan.status_dokumen == "belum_dikonfirmasi")
                | (Pengawasan.status_operasional == "belum_dikonfirmasi")
            )
        )
        or 0
    )
    return {
        "role": user.role,
        "demo": settings.demo_mode,
        "metrics": {
            "ponpes_total": sum(documents.values()),
            "pengaduan_total": sum(distribution.values()),
            "pengaduan_terbuka": sum(
                value for key, value in distribution.items() if key not in {"selesai", "tidak_valid"}
            ),
            "pengawasan_belum_dikonfirmasi": unresolved,
        },
        "pengaduan": distribution,
        "status_dokumen": documents,
        "status_operasional": operations,
    }
