from decimal import Decimal

from sqlalchemy import select

from backend.models.models import Ponpes
from backend.seeds import seed


def test_seeded_real_addresses_have_sources_and_distinct_campus_points(client):
    items = client.get("/ponpes/").json()["items"]
    by_slug = {p["slug"]: p for p in items}
    sunan = by_slug["sunan-drajat"]
    assert "Banjaranyar" in sunan["alamat_lengkap"]
    assert "Banjarwati" in sunan["alamat_lengkap"]
    assert sunan["lokasi"]["alamat_bersumber"] is True
    assert sunan["lokasi"]["sumber_alamat_url"] == "https://ppsd.id/hubungi-kami/"
    real = [by_slug[s] for s in ["sunan-drajat", "tarbiyatut-tholabah", "matholiul-anwar"]]
    assert len({(p["latitude"], p["longitude"]) for p in real}) == 3
    assert all(p["lokasi"]["pin_tersedia"] for p in real)
    assert all(p["lokasi"]["ketelitian"] == "kompleks_pendidikan" for p in real)
    assert all(p["demo"] for p in real)  # Real addresses do not certify demo permits.
    unknown = by_slug["al-maruf"]["lokasi"]
    assert not unknown["alamat_bersumber"]
    assert not unknown["pin_tersedia"]
    assert unknown["sumber_alamat_url"] is None


def test_location_source_does_not_follow_changed_address_or_coordinates(client, admin):
    response = client.put("/admin/ponpes/my", headers=admin, json={"latitude": -7.1})
    assert response.status_code == 200
    assert response.json()["lokasi"]["alamat_bersumber"] is True
    assert response.json()["lokasi"]["pin_tersedia"] is False
    assert response.json()["lokasi"]["sumber_koordinat_url"] is None
    changed = client.put("/admin/ponpes/my", headers=admin, json={"alamat_lengkap": "Alamat baru pengurus"})
    assert changed.status_code == 200
    assert changed.json()["lokasi"]["alamat_bersumber"] is False
    assert changed.json()["lokasi"]["sumber_alamat_url"] is None


def test_seed_upgrades_only_old_demo_locations_and_preserves_admin_changes(db):
    sunan = db.scalar(select(Ponpes).where(Ponpes.slug == "sunan-drajat"))
    sunan.alamat_lengkap = "Alamat simulasi, Paciran, Lamongan"
    sunan.latitude = Decimal("-7.1193")
    sunan.longitude = Decimal("112.4150")
    db.commit()
    seed(db)
    db.refresh(sunan)
    assert "Banjaranyar" in sunan.alamat_lengkap
    assert sunan.latitude != Decimal("-7.1193")
    sunan.alamat_lengkap = "Alamat hasil koreksi pengurus"
    sunan.latitude = Decimal("-7.111")
    sunan.longitude = Decimal("112.333")
    db.commit()
    seed(db)
    db.refresh(sunan)
    assert sunan.alamat_lengkap == "Alamat hasil koreksi pengurus"
    assert sunan.latitude == Decimal("-7.111")
    assert sunan.longitude == Decimal("112.333")
