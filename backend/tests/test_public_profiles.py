from copy import deepcopy

import pytest
from sqlalchemy import select

from backend.models.models import Ponpes


def test_public_detail_adds_sourced_profile_without_replacing_admin_content(client, db):
    row = db.scalar(select(Ponpes).where(Ponpes.slug == "sunan-drajat"))
    row.deskripsi = "Catatan pengurus yang harus tetap tersimpan."
    db.commit()
    data = client.get("/ponpes/sunan-drajat").json()
    profile = data.get("profil_publik")
    assert profile is not None
    assert profile["situs_resmi"] == "https://ppsd.id/"
    assert profile["bagian"]
    assert all(section["sumber_url"].startswith("https://") for section in profile["bagian"])
    assert data["deskripsi"] == "Catatan pengurus yang harus tetap tersimpan."
    assert data["demo"] is True


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("alamat_lengkap", "Alamat baru dari pengurus"),
        ("nama_ponpes", "Nama lembaga sudah berubah"),
        ("kecamatan_id", 1),
    ],
)
def test_source_profile_is_hidden_after_identity_or_address_changes(client, db, field, value):
    row = db.scalar(select(Ponpes).where(Ponpes.slug == "sunan-drajat"))
    assert client.get("/ponpes/sunan-drajat").json().get("profil_publik") is not None
    setattr(row, field, value)
    db.commit()
    assert client.get("/ponpes/sunan-drajat").json()["profil_publik"] is None


def test_unknown_academic_institution_never_inherits_another_pesantren_profile(client):
    profile = client.get("/ponpes/al-maruf").json().get("profil_publik")
    assert profile is not None
    assert profile["bagian"] == []
    assert profile["situs_resmi"] is None
    assert profile["kontak"] == []
    assert profile["catatan"]


def test_profile_catalog_rejects_unsafe_links_and_duplicate_sections():
    from backend.profiles import validate_profiles

    record = {
        "slug": "uji-profil",
        "nama_ponpes": "Pesantren Uji",
        "kecamatan": "Paciran",
        "alamat_lengkap": "Alamat uji",
        "diperiksa_pada": "2026-10-15",
        "situs_resmi": None,
        "bagian": [
            {
                "judul": "Pendidikan",
                "teks": "Pendidikan uji.",
                "butir": [],
                "sumber_url": "https://example.org/profil",
                "tahun_sumber": None,
            }
        ],
        "kontak": [],
        "catatan": None,
    }
    validate_profiles([record])
    unsafe = deepcopy(record)
    unsafe["bagian"][0]["sumber_url"] = "javascript:alert(1)"
    with pytest.raises(ValueError):
        validate_profiles([unsafe])
    duplicate = deepcopy(record)
    duplicate["bagian"] *= 2
    with pytest.raises(ValueError):
        validate_profiles([duplicate])


def test_every_reference_has_its_own_profile_and_source_year_is_preserved(client, db):
    from backend.reference_catalog import REFERENCE_CATALOG, import_catalog

    import_catalog(db)
    db.commit()
    for item in REFERENCE_CATALOG:
        data = client.get(f"/ponpes/{item['slug']}").json()
        profile = data.get("profil_publik")
        assert profile is not None, item["slug"]
        assert profile["bagian"], item["slug"]
        assert data["layanan_tersedia"] is False
    historic = client.get("/ponpes/al-musaaadah-tikung").json()["profil_publik"]
    assert any(section["tahun_sumber"] == 2023 for section in historic["bagian"])
