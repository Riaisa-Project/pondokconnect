from datetime import date

from sqlalchemy import func, select

from backend.models.models import AuditLog, Kecamatan, Ponpes, User
from backend.seeds import seed
from backend.tests.conftest import login


def ponpes_payload(**changes):
    return {
        "kecamatan_id": 1,
        "nspp": "123456789012",
        "nama_ponpes": "Ponpes Pengujian",
        "nama_pengasuh": "Pengasuh Test",
        "alamat_lengkap": "Alamat Test",
        "tipe_pesantren": "salafiyah",
        "email_admin": "pengurus@example.org",
        "nama_admin": "Pengurus",
        "no_hp_admin": "081234567890",
        **changes,
    }


def test_provision_reset_password_and_audit(client, db, satgas, admin):
    assert client.post("/admin/kemenag/ponpes", headers=admin, json=ponpes_payload()).status_code == 403
    response = client.post("/admin/kemenag/ponpes", headers=satgas, json=ponpes_payload())
    assert response.status_code == 201, response.text
    data = response.json()
    pid = data["ponpes"]["id"]
    temp = data["temporary_password"]
    auth = login(client, "pengurus@example.org", temp)
    assert client.get("/admin/ponpes/my", headers=auth).status_code == 403
    assert (
        client.post(
            "/admin/change-password",
            headers=auth,
            json={
                "old_password": temp,
                "new_password": "NewPassword123!",
                "confirm_password": "NewPassword123!",
            },
        ).status_code
        == 200
    )
    auth = login(client, "pengurus@example.org", "NewPassword123!")
    assert client.get("/admin/ponpes/my", headers=auth).json()["id"] == pid
    legal = {
        "status_ijop": "aktif",
        "no_sk_ijop": "TEST/01",
        "tanggal_ijop_mulai": "2020-01-01",
        "tanggal_ijop_selesai": "2099-01-01",
    }
    assert client.put(f"/admin/kemenag/ponpes/{pid}/ijop", headers=satgas, json=legal).status_code == 410
    verified = client.get("/ponpes/verifikasi-ijop/123456789012")
    assert verified.json()["status_ijop"] is None
    assert verified.json()["demo"] is False
    reset = client.post(
        f"/admin/kemenag/reset-password-ponpes/{pid}", headers=satgas, json={"alasan": "Lupa password"}
    )
    assert reset.status_code == 200
    assert client.get("/admin/me", headers=auth).status_code == 401
    new = login(client, "pengurus@example.org", reset.json()["temporary_password"])
    assert client.get("/admin/me", headers=new).json()["must_change_password"] is True
    logs = client.get("/admin/audit-logs", headers=satgas)
    assert logs.status_code == 200
    assert temp not in logs.text and reset.json()["temporary_password"] not in logs.text
    assert {r.aksi for r in db.scalars(select(AuditLog))} >= {
        "create_ponpes",
        "reset_password_ponpes",
    }


def test_duplicate_provision_is_atomic(client, db, satgas):
    response = client.post("/admin/kemenag/ponpes", headers=satgas, json=ponpes_payload(nspp="000000000001"))
    assert response.status_code == 409
    assert db.scalar(select(User).where(User.email == "pengurus@example.org")) is None
    invalid = ponpes_payload(kecamatan_id=9999)
    assert client.post("/admin/kemenag/ponpes", headers=satgas, json=invalid).status_code == 404
    assert db.scalar(select(func.count(User.id))) == 2


def test_public_directory_keeps_profiles_after_legacy_expiry(client, db):
    assert len(client.get("/kecamatan/").json()) == 27
    result = client.get("/ponpes/", params={"q": "Sunan"})
    assert result.json()["total"] == 1
    assert "user_admin_id" not in result.text
    row = db.scalar(select(Ponpes).where(Ponpes.slug == "sunan-drajat"))
    row.tanggal_ijop_selesai = date(2021, 1, 1)
    db.commit()
    assert client.get("/ponpes/", params={"q": "Sunan"}).json()["total"] == 1
    assert client.get("/ponpes/sunan-drajat").status_code == 200
    assert client.get("/ponpes/verifikasi-ijop/000000000001").json()["status_ijop"] is None
    stats = client.get("/stats/ringkasan").json()
    assert stats["total_ponpes"] == 4
    assert len(stats["per_kecamatan"]) == 27
    assert "pengaduan" not in str(stats)


def test_profile_cannot_promote_ijop(client, admin):
    assert client.put("/admin/ponpes/my", headers=admin, json={"status_ijop": "aktif"}).status_code == 422
    assert client.put("/admin/ponpes/my", headers=admin, json={"kuota_putra": -1}).status_code == 422
    assert client.put("/admin/ponpes/my", headers=admin, json={"kuota_putra": "1"}).status_code == 422
    assert client.put("/admin/ponpes/my", headers=admin, json={"nama_ponpes": None}).status_code == 422
    assert client.put("/admin/ponpes/my", headers=admin, json={"kuota_putra": 1}).json()["kuota_putra"] == 1


def test_seed_is_idempotent_without_password_reset(db):
    user = db.scalar(select(User).where(User.email == "admin@sunandrajat.id"))
    previous = user.password_hash
    seed(db)
    assert db.scalar(select(func.count(Kecamatan.id))) == 27
    assert db.scalar(select(func.count(Ponpes.id))) == 4
    assert db.scalar(select(func.count(User.id))) == 2
    db.refresh(user)
    assert user.password_hash == previous
