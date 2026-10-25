import jwt
from sqlalchemy import select

from backend.config import settings
from backend.models.models import User


def test_health_checks_database(client):
    assert client.get("/health").json()["database"] == "ok"


def test_json_login_and_string_subject(client, admin):
    token = admin["Authorization"].split()[1]
    claims = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    assert isinstance(claims["sub"], str)
    assert claims["exp"] - claims["iat"] == 3600
    me = client.get("/admin/me", headers=admin)
    assert me.status_code == 200
    assert me.json()["role"] == "admin_ponpes"
    assert "password_hash" not in me.text
    assert client.post("/admin/login", data={"email": "x", "password": "y"}).status_code == 422
    assert (
        client.post("/admin/login", json={"email": "admin@sunandrajat.id", "password": "wrong"}).status_code
        == 401
    )


def test_missing_and_forged_tokens(client):
    assert client.get("/admin/me").status_code == 401
    assert client.get("/admin/me", headers={"Authorization": "Bearer bad"}).status_code == 401


def test_mandatory_change_and_revocation(client, db, admin):
    user = db.scalar(select(User).where(User.email == "admin@sunandrajat.id"))
    user.must_change_password = True
    db.commit()
    assert client.get("/admin/ponpes/my", headers=admin).status_code == 403
    assert client.get("/admin/me", headers=admin).status_code == 200
    payload = {
        "old_password": "admin123",
        "new_password": "NewSecure123!",
        "confirm_password": "NewSecure123!",
    }
    changed = client.post("/admin/change-password", json=payload, headers=admin)
    assert changed.status_code == 200, changed.text
    assert client.get("/admin/me", headers=admin).status_code == 401
    response = client.post("/admin/login", json={"email": user.email, "password": "NewSecure123!"})
    assert response.status_code == 200
    assert response.json()["must_change_password"] is False


def test_cors_and_strict_body(client):
    response = client.options(
        "/admin/login", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"}
    )
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert response.headers["access-control-allow-credentials"] == "true"
    bad = client.options(
        "/admin/login", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"}
    )
    assert "access-control-allow-origin" not in bad.headers
    assert (
        client.post("/admin/login", json={"email": "admin@sunandrajat.id", "password": 123}).status_code
        == 422
    )


def test_expired_token_and_non_string_subject_rejected(client, admin):
    token = admin["Authorization"].split()[1]
    claims = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    for invalid in ({**claims, "exp": 1}, {**claims, "sub": 1}, {**claims, "pwdv": "wrong"}):
        encoded = jwt.encode(invalid, settings.jwt_secret, algorithm="HS256")
        assert client.get("/admin/me", headers={"Authorization": f"Bearer {encoded}"}).status_code == 401


def test_warga_role_cannot_access_admin_modules(client, db):
    from backend.auth import hash_password
    from backend.tests.conftest import login

    user = User(
        email="warga@example.org",
        nama_lengkap="Warga",
        no_hp="081222333444",
        role="warga",
        password_hash=hash_password("WargaPassword123!"),
    )
    db.add(user)
    db.commit()
    auth = login(client, "warga@example.org", "WargaPassword123!")
    assert client.get("/admin/me", headers=auth).status_code == 200
    for path in (
        "/admin/pengaduan",
        "/admin/audit-logs",
        "/admin/ponpes/my",
        "/admin/pendaftaran",
        "/admin/chat",
    ):
        assert client.get(path, headers=auth).status_code == 403
