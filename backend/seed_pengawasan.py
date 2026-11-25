"""Isi catatan pengawasan (dokumen & operasional) dari hasil pemeriksaan sumber publik.

Sumber per ponpes ada di backend/data/pengawasan_pesantren.json. Mode default
dry-run; `--apply` menulis ke database. Idempoten: baris dicocokkan lewat slug.

Catatan: pengisian ini hasil pemeriksaan sumber terbuka, bukan penerbitan izin.
"""

import argparse
import json
from datetime import date
from pathlib import Path

from sqlalchemy import select

from backend.database import SessionLocal
from backend.models.models import Pengawasan, Ponpes

DATA = Path(__file__).with_name("data") / "pengawasan_pesantren.json"
FIELDS = (
    "status_dokumen",
    "nomor_statistik",
    "nomor_dokumen",
    "penerbit_dokumen",
    "tanggal_dokumen",
    "sumber_dokumen",
    "tanggal_pemeriksaan_dokumen",
    "catatan_dokumen",
    "status_operasional",
    "sumber_operasional",
    "tanggal_pemeriksaan_operasional",
    "catatan_operasional",
)


def parse_date(value):
    return date.fromisoformat(value) if value else None


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="tulis ke database")
    args = parser.parse_args(argv)
    rows = json.loads(DATA.read_text(encoding="utf-8"))
    created = updated = skipped = 0
    with SessionLocal() as db:
        for slug, payload in rows.items():
            ponpes = db.scalar(select(Ponpes).where(Ponpes.slug == slug))
            if ponpes is None:
                print(f"lewat  {slug}: tidak ada di direktori")
                skipped += 1
                continue
            record = db.get(Pengawasan, ponpes.id)
            if record is None:
                if not args.apply:
                    print(f"baru   {slug}: {payload['status_operasional']}")
                    created += 1
                    continue
                record = Pengawasan(ponpes_id=ponpes.id)
                db.add(record)
                created += 1
            else:
                updated += 1
            for field in FIELDS:
                value = payload.get(field)
                setattr(record, field, parse_date(value) if field.startswith("tanggal_") else value)
            print(f"{'tulis ' if args.apply else 'ubah '} {slug}: dokumen={payload['status_dokumen']} operasional={payload['status_operasional']}")
        if args.apply:
            db.commit()
    print(f"selesai: {created} baru, {updated} diperbarui, {skipped} dilewat" + ("" if args.apply else " (dry-run)"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
