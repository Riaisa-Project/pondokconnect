from sqlalchemy import select

from backend.auth import create_token
from backend.models.models import Ponpes, User
from backend.tests.test_workflows import complaint, registration


def test_content_is_editable_and_public(client, admin):
    content = {
        "deskripsi": "Profil simulasi dengan pembelajaran terpadu.",
        "program_unggulan": ["Tahfiz", "Kajian kitab"],
        "fasilitas": ["Asrama", "Perpustakaan"],
    }
    saved = client.put("/admin/ponpes/my", headers=admin, json=content)
    assert saved.status_code == 200, saved.text
    public = client.get("/ponpes/sunan-drajat").json()
    for key, value in content.items():
        assert public[key] == value
    assert client.put("/admin/ponpes/my", headers=admin, json={"deskripsi": ""}).status_code == 200
    assert client.put("/admin/ponpes/my", headers=admin, json={"fasilitas": ["A" * 101]}).status_code == 422
    assert (
        client.put("/admin/ponpes/my", headers=admin, json={"program_unggulan": ["Valid"] * 21}).status_code
        == 422
    )
    assert client.put("/admin/ponpes/my", headers=admin, json={"deskripsi": None}).status_code == 422


def test_directory_sort_by_name_and_available_quota(client, db):
    row = db.scalar(select(Ponpes).where(Ponpes.slug == "al-maruf"))
    row.kuota_putra = 77
    db.commit()
    rows = client.get("/ponpes/?sort=kuota").json()["items"]
    assert rows[0]["slug"] == "al-maruf"
    names = [p["nama_ponpes"] for p in client.get("/ponpes/?sort=nama").json()["items"]]
    assert names == sorted(names)
    assert client.get("/ponpes/?sort=invalid").status_code == 422


def test_dashboard_scopes_data_and_requires_authorized_roles(client, db, admin, satgas):
    assert client.post("/pendaftaran/kirim", json=registration()).status_code == 201
    assert (
        client.post(
            "/pendaftaran/kirim", json=registration(ponpes_id=2, nik_santri="2234567890123456")
        ).status_code
        == 201
    )
    assert client.post("/pengaduan/kirim", json=complaint()).status_code == 201
    own = client.get("/admin/dashboard", headers=admin)
    assert own.status_code == 200, own.text
    assert own.json()["metrics"]["pendaftaran_total"] == 1
    assert own.json()["seleksi"]["menunggu_verifikasi"] == 1
    assert "pengaduan" not in own.text
    all_data = client.get("/admin/dashboard", headers=satgas).json()
    assert all_data["metrics"]["pengaduan_terbuka"] == 1
    assert all_data["metrics"]["ponpes_total"] == 4
    assert all_data["status_operasional"]["belum_dikonfirmasi"] == 4
    assert "Uraian kasus" not in str(all_data)
    assert client.get("/admin/dashboard").status_code == 401
    user = User(
        nama_lengkap="Warga",
        email="warga@example.org",
        no_hp="0811111111",
        password_hash="unused",
        role="warga",
    )
    db.add(user)
    db.commit()
    assert (
        client.get("/admin/dashboard", headers={"Authorization": f"Bearer {create_token(user)}"}).status_code
        == 403
    )


def test_saved_directory_filter_uses_only_requested_public_profiles(client):
    result = client.get("/ponpes/?slugs=sunan-drajat,al-maruf").json()
    assert result["total"] == 2
    assert {p["slug"] for p in result["items"]} == {"sunan-drajat", "al-maruf"}
    assert client.get("/ponpes/?slugs=").json()["total"] == 0
    assert client.get("/ponpes/?slugs=../../admin").status_code == 422


def test_legacy_slug_from_non_latin_name_remains_filterable(client, db):
    from backend.services import slugify

    slug = slugify("مدرسة", "000000000001")
    assert slug == "-000000000001"
    row = db.scalar(select(Ponpes).where(Ponpes.id == 1))
    row.slug = slug
    db.commit()
    result = client.get(f"/ponpes/?slugs={slug}")
    assert result.status_code == 200
    assert result.json()["total"] == 1
    assert client.get(f"/ponpes/{slug}").status_code == 200
