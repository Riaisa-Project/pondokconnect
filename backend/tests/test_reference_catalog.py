from datetime import date

import pytest
from sqlalchemy import select

from backend.models.models import Kecamatan, Ponpes
from backend.tests.test_workflows import registration


def reference_row(db):
    district = db.scalar(select(Kecamatan).where(Kecamatan.nama_kecamatan == "Laren"))
    row = Ponpes(
        nama_ponpes="Pesantren Rujukan Pengujian",
        slug="rujukan-pengujian",
        kecamatan_id=district.id,
        profil_referensi=True,
        nspp=None,
        nama_pengasuh=None,
        alamat_lengkap="Desa Pengujian, Laren, Lamongan",
        tipe_pesantren=None,
        status_ijop="proses_verifikasi",
        kuota_putra=0,
        kuota_putri=0,
        latitude=None,
        longitude=None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def test_reference_is_public_without_fabricated_service_facts(client, db):
    row = reference_row(db)
    response = client.get("/ponpes/rujukan-pengujian")
    assert response.status_code == 200
    data = response.json()
    assert data["profil_referensi"] is True
    assert data["layanan_tersedia"] is False
    assert data["nspp"] is None and data["nama_pengasuh"] is None
    assert data["tipe_pesantren"] is None and data["latitude"] is None
    assert data["kuota_putra"] is None and data["sisa_kuota_putri"] is None
    assert data["no_sk_ijop"] is None
    assert not data["lokasi"]["pin_tersedia"]
    assert data["verifikasi_url"].endswith("/status-pesantren/rujukan-pengujian")
    assert client.get("/ponpes/").json()["total"] == 5
    assert client.get("/ponpes/", params={"layanan": "aktif"}).json()["total"] == 4
    stats = client.get("/stats/ringkasan").json()
    assert stats["total_ponpes"] == 5 and stats["total_profil_referensi"] == 1
    assert (
        next(d for d in stats["per_kecamatan"] if d["kecamatan_id"] == row.kecamatan_id)["jumlah_ponpes"] == 1
    )


def test_reference_cannot_receive_registration_or_chat_even_if_legal_fields_change(client, db):
    row = reference_row(db)
    row.status_ijop = "aktif"
    row.no_sk_ijop = "TEST-ONLY"
    row.tanggal_ijop_mulai = date(2020, 1, 1)
    row.tanggal_ijop_selesai = date(2099, 1, 1)
    row.kuota_putra = 20
    db.commit()
    assert client.post("/pendaftaran/kirim", json=registration(ponpes_id=row.id)).status_code == 409
    assert (
        client.post(
            "/chat/kirim",
            json={
                "ponpes_id": row.id,
                "nama_warga": "Pengujian",
                "kontak_warga": "08123456789",
                "pesan": "Pertanyaan",
            },
        ).status_code
        == 409
    )
    data = client.get("/ponpes/rujukan-pengujian").json()
    assert data["layanan_tersedia"] is False


def test_catalog_import_is_idempotent_preserves_edits_and_skips_slug_collisions(db):
    from backend.reference_catalog import import_catalog

    item = dict(
        slug="referensi-test",
        nama_ponpes="Pesantren Referensi Test",
        kecamatan="Laren",
        alamat_lengkap="Alamat dari sumber",
        deskripsi="Deskripsi berdasarkan sumber.",
        sumber_alamat_url="https://example.org/kontak",
        diperiksa_pada="2026-10-15",
    )
    assert import_catalog(db, [item])["added"] == 1
    db.commit()
    row = db.scalar(select(Ponpes).where(Ponpes.slug == item["slug"]))
    assert row.profil_referensi and row.nspp is None and row.latitude is None
    row.alamat_lengkap = "Koreksi pengurus"
    db.commit()
    assert import_catalog(db, [item])["added"] == 0
    db.commit()
    db.refresh(row)
    assert row.alamat_lengkap == "Koreksi pengurus"
    assert import_catalog(db, [dict(item, slug="sunan-drajat")])["conflicts"] == 1
    with pytest.raises(ValueError):
        import_catalog(db, [dict(item, slug="kabupaten-lain", kecamatan="Widang")])


def test_full_catalog_has_sources_and_stale_reference_provenance_is_removed(client, db):
    from backend.reference_catalog import REFERENCE_CATALOG, import_catalog

    assert len(REFERENCE_CATALOG) >= 25
    assert len({item["kecamatan"] for item in REFERENCE_CATALOG}) >= 15
    result = import_catalog(db)
    db.commit()
    assert result["added"] == len(REFERENCE_CATALOG)
    data = client.get("/ponpes/al-ishlah-sendangagung").json()
    assert data["referensi"]["sumber_url"].startswith("https://")
    assert data["lokasi"]["alamat_bersumber"] is True
    assert data["lokasi"]["pin_tersedia"] is False
    assert data["latitude"] is None and data["nspp"] is None
    assert data["demo"] is False
    assert client.get("/ponpes/").json()["total"] == len(REFERENCE_CATALOG) + 4
    historic = client.get("/ponpes/al-musaaadah-tikung").json()
    assert historic["referensi"]["tahun_sumber"] == 2023
    row = db.scalar(select(Ponpes).where(Ponpes.slug == "al-ishlah-sendangagung"))
    row.alamat_lengkap = "Alamat dikoreksi pengurus"
    db.commit()
    changed = client.get("/ponpes/al-ishlah-sendangagung").json()
    assert changed["referensi"] is None
    assert changed["lokasi"]["alamat_bersumber"] is False


def test_sourced_school_points_compare_exactly_after_database_roundtrip(client, db):
    from backend.reference_catalog import import_catalog

    import_catalog(db)
    db.commit()
    data = client.get("/ponpes/karangasem-muhammadiyah-paciran").json()
    assert data["latitude"] == -6.8763
    assert data["lokasi"]["pin_tersedia"] is True
    assert data["lokasi"]["ketelitian"] == "kompleks_pendidikan"
    assert "60730167" in data["lokasi"]["sumber_koordinat_url"]
