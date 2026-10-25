from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import get_db
from backend.models.models import Kecamatan, Pendaftaran, Ponpes
from backend.services import active_filter, public_filter

router = APIRouter(prefix="/stats", tags=["Statistik publik"])


@router.get("/ringkasan")
def summary(db: Session = Depends(get_db)):
    counts = dict(
        db.execute(
            select(Ponpes.kecamatan_id, func.count(Ponpes.id))
            .where(public_filter())
            .group_by(Ponpes.kecamatan_id)
        ).all()
    )
    accepted = dict(
        db.execute(
            select(Ponpes.kecamatan_id, func.count(Pendaftaran.id))
            .join(Pendaftaran, Pendaftaran.ponpes_id == Ponpes.id)
            .where(*active_filter(), Pendaftaran.status_seleksi == "diterima")
            .group_by(Ponpes.kecamatan_id)
        ).all()
    )
    districts = db.scalars(select(Kecamatan).order_by(Kecamatan.nama_kecamatan)).all()
    return {
        "total_ponpes": sum(counts.values()),
        "total_profil_referensi": db.scalar(
            select(func.count(Ponpes.id)).where(Ponpes.profil_referensi.is_(True))
        ),
        "total_santri_diterima": sum(accepted.values()),
        "total_kecamatan": len(districts),
        "demo": settings.demo_mode,
        "per_kecamatan": [
            {
                "kecamatan_id": k.id,
                "nama_kecamatan": k.nama_kecamatan,
                "jumlah_ponpes": counts.get(k.id, 0),
                "santri_diterima": accepted.get(k.id, 0),
            }
            for k in districts
        ],
    }
