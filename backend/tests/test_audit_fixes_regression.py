import re

from sqlalchemy import event, select

from backend.database import engine
from backend.limiter import limiter
from backend.models.models import Pendaftaran, Ponpes
from backend.services import slugify
from backend.tests.test_workflows import registration


def test_p1_rate_limit_cannot_be_bypassed_via_x_forwarded_for(client):
    limiter.enabled = True
    limiter.reset()
    try:
        for _ in range(5):
            res = client.post("/admin/login", json={"email": "wrong@pondokconnect.id", "password": "wrong"})
            assert res.status_code == 401
        res_6 = client.post("/admin/login", json={"email": "wrong@pondokconnect.id", "password": "wrong"})
        assert res_6.status_code == 429

        # Spoofed X-Forwarded-For must still be blocked by rate limit
        res_spoof = client.post(
            "/admin/login",
            headers={"X-Forwarded-For": "203.0.113.195"},
            json={"email": "wrong@pondokconnect.id", "password": "wrong"},
        )
        assert res_spoof.status_code == 429
    finally:
        limiter.reset()


def test_p2_registration_rate_limit(client):
    limiter.enabled = True
    limiter.reset()
    try:
        for i in range(5):
            payload = registration(nik_santri=f"35140000000000{i:02d}")
            res = client.post("/pendaftaran/kirim", json=payload)
            assert res.status_code == 201, res.text
        # 6th attempt within 1 minute should be rate-limited
        res_6 = client.post(
            "/pendaftaran/kirim",
            json=registration(nik_santri="3514000000000099"),
        )
        assert res_6.status_code == 429
    finally:
        limiter.reset()


def test_p3_registration_consent_required_and_persisted(client, db):
    limiter.enabled = False
    # Without consent field -> 422
    payload_no_consent = registration(nik_santri="3514111111110001")
    del payload_no_consent["consent"]
    r1 = client.post("/pendaftaran/kirim", json=payload_no_consent)
    assert r1.status_code == 422

    # With consent: False -> 422
    payload_false_consent = registration(nik_santri="3514111111110002", consent=False)
    r2 = client.post("/pendaftaran/kirim", json=payload_false_consent)
    assert r2.status_code == 422
    assert "Persetujuan penggunaan data diperlukan" in r2.text

    # With consent: True -> 201 and consent_at is saved in DB
    payload_valid = registration(nik_santri="3514111111110003", consent=True)
    r3 = client.post("/pendaftaran/kirim", json=payload_valid)
    assert r3.status_code == 201
    no_reg = r3.json()["nomor_registrasi"]

    row = db.scalar(select(Pendaftaran).where(Pendaftaran.nomor_registrasi == no_reg))
    assert row is not None
    assert row.consent_at is not None


def test_p4_stats_total_santri_diterima_counts_closed_services(client, db):
    # Take an existing ponpes and explicitly close both registration and consultation
    row = db.scalar(select(Ponpes).order_by(Ponpes.id).limit(1))
    orig_reg = row.pendaftaran_dibuka
    orig_chat = row.konsultasi_dibuka
    row.pendaftaran_dibuka = False
    row.konsultasi_dibuka = False

    santri = Pendaftaran(
        ponpes_id=row.id,
        nomor_registrasi="REG-TEST-CLOSED-PONPES",
        nik_santri="3514999999990001",
        nama_santri="Santri Closed Service",
        jenis_kelamin="L",
        nama_wali="Wali Closed Service",
        no_hp_wali="08123456789",
        status_seleksi="diterima",
    )
    db.add(santri)
    db.commit()

    try:
        res = client.get("/stats/ringkasan").json()
        assert res["total_santri_diterima"] >= 1
        district = next(k for k in res["per_kecamatan"] if k["kecamatan_id"] == row.kecamatan_id)
        assert district["santri_diterima"] >= 1
    finally:
        row.pendaftaran_dibuka = orig_reg
        row.konsultasi_dibuka = orig_chat
        db.delete(santri)
        db.commit()


def test_p5_directory_n_plus_one_eliminated(client):
    queries = []

    def count_queries(conn, cursor, statement, parameters, context, executemany):
        queries.append(statement)

    event.listen(engine, "before_cursor_execute", count_queries)
    try:
        queries.clear()
        r20 = client.get("/ponpes/?limit=20")
        assert r20.status_code == 200
        # 1 count + 1 fetch + 1 kecamatan + 1 pengawasan + 1 quota = 5 queries max
        assert len(queries) <= 5, f"Limit 20 executed {len(queries)} queries (expected <= 5)"

        queries.clear()
        r100 = client.get("/ponpes/?limit=100")
        assert r100.status_code == 200
        assert len(queries) <= 5, f"Limit 100 executed {len(queries)} queries (expected <= 5)"
    finally:
        event.remove(engine, "before_cursor_execute", count_queries)


def test_p6_chat_continuation_without_identity(client):
    limiter.enabled = False
    # 1. New chat without identity -> 422
    r1 = client.post("/chat/kirim", json={"ponpes_id": 1, "pesan": "Pesan tanpa identitas"})
    assert r1.status_code == 422

    # 2. Start new chat with identity -> 201
    r2 = client.post(
        "/chat/kirim",
        json={
            "ponpes_id": 1,
            "nama_warga": "Warga Uji",
            "kontak_warga": "08123456789",
            "pesan": "Pesan pertama",
        },
    )
    assert r2.status_code == 201
    sid = r2.json()["session_id"]

    # 3. Continuation chat with session_id without repeating identity -> 201
    r3 = client.post(
        "/chat/kirim",
        json={"ponpes_id": 1, "session_id": sid, "pesan": "Pesan lanjutan tanpa kirim ulang identitas"},
    )
    assert r3.status_code == 201
    assert r3.json()["session_id"] == sid


def test_p7_slugify_non_latin_names():
    slug_pattern = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    test_cases = [
        ("معهد الفلاح", "123456789012"),
        ("🕌✨", "123456789012"),
        ("---!@#$---", "abcdef12"),
        ("Pondok Modern Al-Ishlah", "123456789012"),
    ]
    for name, nspp in test_cases:
        slug = slugify(name, nspp)
        assert not slug.startswith("-"), f"Slug '{slug}' starts with a hyphen"
        assert not slug.endswith("-"), f"Slug '{slug}' ends with a hyphen"
        assert slug_pattern.match(slug), f"Slug '{slug}' does not match valid kebab-case pattern"


def test_p8_openapi_paginated_schemas(client):
    res = client.get("/openapi.json")
    assert res.status_code == 200
    schema = res.json()
    paths = schema["paths"]

    paginated_routes = [
        "/ponpes/",
        "/admin/kemenag/ponpes",
        "/admin/pendaftaran",
        "/admin/pengaduan",
        "/admin/chat",
        "/admin/audit-logs",
    ]
    for p in paginated_routes:
        assert "$ref" in paths[p]["get"]["responses"]["200"]["content"]["application/json"]["schema"]

    # /kecamatan/ must remain a plain list
    assert paths["/kecamatan/"]["get"]["responses"]["200"]["content"]["application/json"]["schema"] == {}


def test_p9_audit_logs_contain_actor_details(client, db, satgas, admin):
    # Trigger an audit event (change password or update services)
    client.put(
        "/admin/ponpes/my/layanan",
        headers=admin,
        json={"pendaftaran_dibuka": True, "konsultasi_dibuka": True},
    )

    logs = client.get("/admin/audit-logs", headers=satgas)
    assert logs.status_code == 200
    data = logs.json()
    assert data["total"] > 0
    first = data["items"][0]
    assert "nama_user" in first
    assert "email_user" in first
    assert first["nama_user"] is not None
    assert first["email_user"] is not None
