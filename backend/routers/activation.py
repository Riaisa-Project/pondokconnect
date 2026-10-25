"""Retired issuance-linked activation route; retained only for safe client errors."""

from fastapi import APIRouter, Depends, HTTPException

from backend.auth import satgas_only
from backend.models.models import User

router = APIRouter(prefix="/admin/kemenag", tags=["Pengawasan pesantren"])


@router.post("/ponpes/{ponpes_id}/aktifkan-layanan", include_in_schema=False)
def activate_services(ponpes_id: int, user: User = Depends(satgas_only)):
    raise HTTPException(
        410,
        "Aktivasi berbasis IJOP dihentikan. Pengurus mengatur layanan portal secara mandiri; petugas hanya mencatat pengawasan.",
    )
