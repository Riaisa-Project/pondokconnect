"""Import sourced real institutions without inventing portal services or legal facts."""

import argparse
import json
import re
from datetime import date
from decimal import Decimal
from pathlib import Path
from urllib.parse import urlparse

from sqlalchemy import select

from backend.database import SessionLocal
from backend.models.models import Kecamatan, Ponpes

CATALOG_PATH = Path(__file__).parent / "data" / "ponpes_reference_catalog.json"
REFERENCE_CATALOG = json.loads(CATALOG_PATH.read_text())


def validate_records(records, districts):
    seen = set()
    for item in records:
        slug = item.get("slug", "")
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug) or len(slug) > 160 or slug in seen:
            raise ValueError(f"Slug katalog tidak valid/duplikat: {slug}")
        seen.add(slug)
        if item.get("kecamatan") not in districts:
            raise ValueError(f"Kecamatan di luar katalog Lamongan: {item.get('kecamatan')}")
        for key, limit in [("nama_ponpes", 150), ("alamat_lengkap", 4000), ("deskripsi", 5000)]:
            if not isinstance(item.get(key), str) or not item[key].strip() or len(item[key]) > limit:
                raise ValueError(f"{slug}: {key} tidak valid")
        for key in ["sumber_alamat_url", "sumber_profil_url", "website_url", "sumber_koordinat_url"]:
            if value := item.get(key):
                url = urlparse(value)
                if url.scheme != "https" or not url.hostname or url.username or url.password:
                    raise ValueError(f"{slug}: URL sumber tidak valid")
        if not item.get("sumber_alamat_url"):
            raise ValueError(f"{slug}: sumber alamat wajib")
        date.fromisoformat(item["diperiksa_pada"])
        lat, lng = item.get("latitude"), item.get("longitude")
        if (lat is None) != (lng is None):
            raise ValueError(f"{slug}: pasangan koordinat tidak lengkap")
        if lat is not None:
            if not (-90 <= Decimal(str(lat)) <= 90 and -180 <= Decimal(str(lng)) <= 180):
                raise ValueError(f"{slug}: koordinat tidak valid")
            if not item.get("sumber_koordinat_url") or not item.get("referensi_titik"):
                raise ValueError(f"{slug}: titik harus punya sumber dan keterangan")


def import_catalog(db, records=None):
    records = REFERENCE_CATALOG if records is None else records
    districts = {d.nama_kecamatan: d for d in db.scalars(select(Kecamatan))}
    validate_records(records, districts)
    result = {"added": 0, "preserved": 0, "conflicts": 0}
    for item in records:
        existing = db.scalar(select(Ponpes).where(Ponpes.slug == item["slug"]))
        if existing:
            result["preserved" if existing.profil_referensi else "conflicts"] += 1
            continue
        db.add(
            Ponpes(
                profil_referensi=True,
                nspp=None,
                nama_ponpes=item["nama_ponpes"],
                slug=item["slug"],
                kecamatan_id=districts[item["kecamatan"]].id,
                nama_pengasuh=None,
                alamat_lengkap=item["alamat_lengkap"],
                tipe_pesantren=None,
                status_ijop="proses_verifikasi",
                no_sk_ijop=None,
                kuota_putra=0,
                kuota_putri=0,
                kontak_sekretariat=None,
                latitude=Decimal(str(item["latitude"])) if item.get("latitude") is not None else None,
                longitude=Decimal(str(item["longitude"])) if item.get("longitude") is not None else None,
                deskripsi=item["deskripsi"],
                program_unggulan=None,
                fasilitas=None,
            )
        )
        result["added"] += 1
    db.flush()
    return result


def main():
    parser = argparse.ArgumentParser(description="Impor direktori pesantren bersumber; default dry-run")
    parser.add_argument("--apply", action="store_true", help="Simpan tambahan ke database")
    args = parser.parse_args()
    with SessionLocal() as db:
        result = import_catalog(db)
        if args.apply:
            db.commit()
        else:
            db.rollback()
        print(json.dumps({"applied": args.apply, **result}, ensure_ascii=False))


if __name__ == "__main__":
    main()
