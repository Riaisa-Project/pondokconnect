"""Sourced public locations for the existing demo directory, never demo permits.

Provenance applies only while the stored identity/address/coordinates match the
reviewed snapshot. Updating a profile cannot inherit stale verification metadata.
The catalog is local: API reads never depend on external websites/geocoders.
"""

import json
from decimal import Decimal
from pathlib import Path

from backend.reference_catalog import REFERENCE_CATALOG

LOCATIONS = json.loads((Path(__file__).parent / "data" / "ponpes_locations.json").read_text())
REFERENCE_LOCATIONS = {item["slug"]: {"nspp_demo": None, **item} for item in REFERENCE_CATALOG}
REFERENCE_LOCATIONS.update({slug: {**item, "nspp_demo": None} for slug, item in LOCATIONS.items()})
DEMO_COORDINATES = (Decimal("-7.1193"), Decimal("112.4150"))


def matching_location(row, district: str):
    location = (REFERENCE_LOCATIONS if row.profil_referensi else LOCATIONS).get(row.slug)
    if not location or (not row.profil_referensi and row.nspp != location["nspp_demo"]):
        location = REFERENCE_LOCATIONS.get(row.slug)
    if location and (row.nama_ponpes == location["nama_ponpes"] and district == location["kecamatan"]):
        return location
    return None


def fill_demo_location(row, district: str):
    """Upgrade only the original placeholder; preserve manually entered locations."""
    location = matching_location(row, district)
    if not location or row.alamat_lengkap != f"Alamat simulasi, {district}, Lamongan":
        return
    row.alamat_lengkap = location["alamat_lengkap"]
    if (row.latitude, row.longitude) == DEMO_COORDINATES:
        row.latitude = Decimal(location["latitude"])
        row.longitude = Decimal(location["longitude"])


def location_view(row, district: str) -> dict:
    location = matching_location(row, district)
    address_matches = bool(location and row.alamat_lengkap == location["alamat_lengkap"])
    pin_matches = bool(
        address_matches
        and location.get("latitude") is not None
        and location.get("longitude") is not None
        and (row.latitude, row.longitude)
        == (Decimal(str(location["latitude"])), Decimal(str(location["longitude"])))
    )
    return {
        "alamat_bersumber": address_matches,
        "pin_tersedia": pin_matches,
        "sumber_alamat_url": location["sumber_alamat_url"] if address_matches else None,
        "sumber_koordinat_url": location["sumber_koordinat_url"] if pin_matches else None,
        "diperiksa_pada": location["diperiksa_pada"] if address_matches else None,
        "ketelitian": location.get("ketelitian", "kompleks_pendidikan") if pin_matches else None,
        "referensi_titik": location["referensi_titik"] if pin_matches else None,
    }


def reference_view(row, district: str):
    location = matching_location(row, district)
    if not row.profil_referensi or not location or row.alamat_lengkap != location["alamat_lengkap"]:
        return None
    return {
        "sumber_url": location.get("sumber_profil_url") or location["sumber_alamat_url"],
        "diperiksa_pada": location["diperiksa_pada"],
        "tahun_sumber": location.get("tahun_sumber"),
        "deskripsi_bersumber": row.deskripsi == location.get("deskripsi"),
    }
