"""Read-only, sourced institution profiles; never overwrite administrator fields."""

import json
import re
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

PROFILE_PATH = Path(__file__).parent / "data" / "ponpes_profiles.json"
SECTION_TITLES = {
    "Sekilas pesantren",
    "Sejarah & pendiri",
    "Pendidikan",
    "Program santri",
    "Fasilitas & kegiatan",
}


def checked_url(value):
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Tautan profil harus berupa URL HTTPS publik")


def validate_profiles(records):
    slugs = set()
    for record in records:
        slug = record["slug"]
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug) or slug in slugs:
            raise ValueError(f"Slug profil tidak valid/duplikat: {slug}")
        slugs.add(slug)
        for field in ["nama_ponpes", "kecamatan", "alamat_lengkap"]:
            if not isinstance(record[field], str) or not record[field].strip():
                raise ValueError(f"{slug}: identitas profil wajib lengkap")
        date.fromisoformat(record["diperiksa_pada"])
        if record.get("situs_resmi"):
            checked_url(record["situs_resmi"])
        titles = set()
        for section in record["bagian"]:
            title = section["judul"]
            if title not in SECTION_TITLES or title in titles:
                raise ValueError(f"{slug}: bagian profil tidak valid/duplikat")
            titles.add(title)
            if not section["teks"].strip() and not section["butir"]:
                raise ValueError(f"{slug}: bagian bersumber tidak boleh kosong")
            if any(not isinstance(item, str) or not item.strip() for item in section["butir"]):
                raise ValueError(f"{slug}: butir profil tidak valid")
            checked_url(section["sumber_url"])
            year = section.get("tahun_sumber")
            if year is not None and (not isinstance(year, int) or not 1800 <= year <= date.today().year):
                raise ValueError(f"{slug}: tahun sumber tidak valid")
        for contact in record["kontak"]:
            if contact["jenis"] not in {"Telepon", "Email"} or not contact["nilai"].strip():
                raise ValueError(f"{slug}: kontak profil tidak valid")
            checked_url(contact["sumber_url"])


PROFILE_RECORDS = json.loads(PROFILE_PATH.read_text())
validate_profiles(PROFILE_RECORDS)
PROFILES = {record["slug"]: record for record in PROFILE_RECORDS}


def public_profile_view(row, district):
    record = PROFILES.get(row.slug)
    if not record or (
        record["nama_ponpes"] != row.nama_ponpes
        or record["kecamatan"] != district
        or record["alamat_lengkap"] != row.alamat_lengkap
    ):
        return None
    return {key: record.get(key) for key in ["diperiksa_pada", "situs_resmi", "bagian", "kontak", "catatan"]}
