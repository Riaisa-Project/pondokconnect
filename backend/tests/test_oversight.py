from datetime import date, timedelta

import pytest
from sqlalchemy import func, select

from backend.models.models import AuditLog, Chat, Pengaduan, Ponpes, User
from backend.tests.test_kemenag import ponpes_payload
from backend.tests.test_workflows import complaint, registration


def oversight_payload(**changes):
    today = date.today().isoformat()
    return {
        "status_dokumen": "terdaftar",
        "nomor_statistik": "919000000001",
        "nomor_dokumen": "DOK/PENGUJIAN/01",
        "penerbit_dokumen": "Penerbit dokumen pengujian",
        "tanggal_dokumen": today,
        "sumber_dokumen": "Arsip dokumen pengujian, berkas 01",
        "tanggal_pemeriksaan_dokumen": today,
        "catatan_dokumen": "Dicatat sesuai dokumen yang diperiksa.",
        "status_operasional": "beroperasi",
        "sumber_operasional": "https://example.org/pemeriksaan",
        "tanggal_pemeriksaan_operasional": today,
        "catatan_operasional": "Kegiatan diamati pada tanggal pemeriksaan.",
        **changes,
    }


def unknown_payload(**changes):
    return {"status_dokumen": "belum_dikonfirmasi", "status_operasional": "belum_dikonfirmasi", **changes}


def test_legacy_demo_facts_do_not_become_confirmed_oversight(client):
    response = client.get("/ponpes/status/sunan-drajat")
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["pengawasan"]["status_dokumen"] == "belum_dikonfirmasi"
    assert data["pengawasan"]["status_operasional"] == "belum_dikonfirmasi"
    assert data["pengawasan"]["updated_at"] is None
    for field in ("status_ijop", "no_sk_ijop", "tanggal_ijop_mulai", "tanggal_ijop_selesai"):
        assert data[field] is None
    assert "pengaduan" not in response.text


@pytest.mark.parametrize("prefix", ["", "/api"])
def test_satgas_records_sourced_oversight_without_changing_services_or_profile(client, db, satgas, prefix):
    row = db.get(Ponpes, 1)
    before = (row.user_admin_id, row.alamat_lengkap, row.profil_referensi, row.kuota_putra)
    response = client.put(
        f"{prefix}/admin/kemenag/ponpes/1/pengawasan", headers=satgas, json=oversight_payload()
    )
    assert response.status_code == 200, response.text
    data = response.json()
    for field, value in oversight_payload().items():
        assert data["pengawasan"][field] == value
    assert data["pengawasan"]["updated_at"]
    public = client.get(f"{prefix}/ponpes/status/sunan-drajat").json()
    assert public["pengawasan"] == data["pengawasan"]
    db.refresh(row)
    assert (row.user_admin_id, row.alamat_lengkap, row.profil_referensi, row.kuota_putra) == before
    assert db.scalar(select(func.count(AuditLog.id))) >= 1


@pytest.mark.parametrize(
    "field",
    [
        "nomor_statistik",
        "nomor_dokumen",
        "penerbit_dokumen",
        "tanggal_dokumen",
        "sumber_dokumen",
        "tanggal_pemeriksaan_dokumen",
        "sumber_operasional",
        "tanggal_pemeriksaan_operasional",
        "catatan_operasional",
    ],
)
def test_confirmed_status_requires_each_supporting_fact(client, satgas, field):
    payload = oversight_payload()
    del payload[field]
    assert client.put("/admin/kemenag/ponpes/1/pengawasan", headers=satgas, json=payload).status_code == 422


@pytest.mark.parametrize(
    "changes",
    [
        {"tanggal_dokumen": (date.today() + timedelta(days=1)).isoformat()},
        {"tanggal_pemeriksaan_dokumen": (date.today() + timedelta(days=1)).isoformat()},
        {"tanggal_pemeriksaan_operasional": (date.today() + timedelta(days=1)).isoformat()},
        {"tanggal_pemeriksaan_dokumen": (date.today() - timedelta(days=1)).isoformat()},
        {"tanggal_dokumen": 0},
        {"tanggal_pemeriksaan_operasional": "2026-02-30"},
        {"sumber_operasional": "javascript:alert(1)"},
        {"sumber_operasional": "   "},
        {"sumber_dokumen": "   "},
        {"penerbit_dokumen": "   "},
        {"catatan_operasional": "   "},
        {"status_dokumen": "ilegal"},
        {"status_operasional": "aktif"},
        {"catatan_internal": "Tidak boleh publik"},
    ],
)
def test_oversight_rejects_invalid_dates_unsafe_sources_and_unrecognized_facts(client, satgas, changes):
    response = client.put(
        "/admin/kemenag/ponpes/1/pengawasan", headers=satgas, json=oversight_payload(**changes)
    )
    assert response.status_code == 422, response.text


@pytest.mark.parametrize("field", ["dokumen", "operasional"])
def test_unknown_status_still_requires_date_when_source_is_recorded(client, satgas, field):
    response = client.put(
        "/admin/kemenag/ponpes/1/pengawasan",
        headers=satgas,
        json=unknown_payload(**{f"sumber_{field}": "Arsip belum diverifikasi"}),
    )
    assert response.status_code == 422, response.text


def test_replacing_oversight_with_unknown_clears_previous_confirmed_facts(client, satgas):
    path = "/admin/kemenag/ponpes/1/pengawasan"
    assert client.put(path, headers=satgas, json=oversight_payload()).status_code == 200
    response = client.put(path, headers=satgas, json=unknown_payload())
    assert response.status_code == 200, response.text
    data = response.json()["pengawasan"]
    assert data["status_dokumen"] == data["status_operasional"] == "belum_dikonfirmasi"
    for field in set(oversight_payload()) - {"status_dokumen", "status_operasional"}:
        assert data[field] is None


def test_oversight_is_satgas_only_and_requires_changed_password(client, db, admin, satgas):
    path = "/admin/kemenag/ponpes/1/pengawasan"
    assert client.put(path, json=oversight_payload()).status_code == 401
    assert client.put(path, headers=admin, json=oversight_payload()).status_code == 403
    user = db.scalar(select(User).where(User.role == "satgas_kemenag"))
    user.must_change_password = True
    db.commit()
    assert client.put(path, headers=satgas, json=oversight_payload()).status_code == 403


def test_owner_service_switches_ignore_legacy_ijop_expiry(client, db, admin):
    row = db.get(Ponpes, 1)
    row.tanggal_ijop_mulai = date(1990, 1, 1)
    row.tanggal_ijop_selesai = date(2000, 1, 1)
    db.commit()
    path = "/admin/ponpes/my/layanan"
    response = client.put(path, headers=admin, json={"pendaftaran_dibuka": True, "konsultasi_dibuka": False})
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["pendaftaran_tersedia"] is True and data["konsultasi_tersedia"] is False
    assert client.post("/pendaftaran/kirim", json=registration()).status_code == 201
    assert (
        client.post(
            "/chat/kirim",
            json={"ponpes_id": 1, "nama_warga": "Wali", "kontak_warga": "08123456789", "pesan": "Uji"},
        ).status_code
        == 409
    )
    assert (
        client.put(
            path, headers=admin, json={"pendaftaran_dibuka": False, "konsultasi_dibuka": True}
        ).status_code
        == 200
    )
    assert (
        client.post("/pendaftaran/kirim", json=registration(nik_santri="2234567890123456")).status_code == 409
    )
    assert (
        client.post(
            "/chat/kirim",
            json={"ponpes_id": 1, "nama_warga": "Wali", "kontak_warga": "08123456789", "pesan": "Uji"},
        ).status_code
        == 201
    )


def test_confirmed_not_operating_blocks_new_entries_but_preserves_tracking_and_reports(
    client, db, admin, satgas
):
    assert (
        client.put(
            "/admin/ponpes/my/layanan",
            headers=admin,
            json={"pendaftaran_dibuka": True, "konsultasi_dibuka": True},
        ).status_code
        == 200
    )
    registered = client.post("/pendaftaran/kirim", json=registration())
    assert registered.status_code == 201, registered.text
    chat = {"ponpes_id": 1, "nama_warga": "Wali", "kontak_warga": "08123456789", "pesan": "Uji"}
    sent = client.post("/chat/kirim", json=chat)
    assert sent.status_code == 201
    response = client.put(
        "/admin/kemenag/ponpes/1/pengawasan",
        headers=satgas,
        json=oversight_payload(status_operasional="tidak_beroperasi"),
    )
    assert response.status_code == 200, response.text
    assert not response.json()["pendaftaran_tersedia"] and not response.json()["konsultasi_tersedia"]
    assert (
        client.post("/pendaftaran/kirim", json=registration(nik_santri="2234567890123456")).status_code == 409
    )
    assert client.post("/chat/kirim", json=chat).status_code == 409
    assert client.get(f"/pendaftaran/lacak/{registered.json()['nomor_registrasi']}").status_code == 200
    assert client.get(f"/chat/1/{sent.json()['session_id']}").status_code == 200
    assert client.post("/pengaduan/kirim", json=complaint()).status_code == 201
    assert db.scalar(select(func.count(Chat.id))) == 1


def test_service_settings_require_owner_and_never_change_other_profiles(client, db, admin, satgas):
    before = db.get(Ponpes, 2).alamat_lengkap
    payload = {"pendaftaran_dibuka": True, "konsultasi_dibuka": False}
    assert client.put("/admin/ponpes/my/layanan", json=payload).status_code == 401
    assert client.put("/admin/ponpes/my/layanan", headers=satgas, json=payload).status_code == 403
    assert (
        client.put("/admin/ponpes/my/layanan", headers=admin, json={**payload, "ponpes_id": 2}).status_code
        == 422
    )
    assert (
        client.put(
            "/admin/ponpes/my/layanan", headers=admin, json={**payload, "pendaftaran_dibuka": "true"}
        ).status_code
        == 422
    )
    assert client.put("/admin/ponpes/my/layanan", headers=admin, json=payload).status_code == 200
    db.refresh(db.get(Ponpes, 2))
    assert db.get(Ponpes, 2).alamat_lengkap == before


def test_profile_provisioning_accepts_unknown_facts_and_defaults_closed_services(client, satgas):
    payload = ponpes_payload()
    for field in ("nspp", "nama_pengasuh", "tipe_pesantren"):
        del payload[field]
    response = client.post("/admin/kemenag/ponpes", headers=satgas, json=payload)
    assert response.status_code == 201, response.text
    data = response.json()["ponpes"]
    assert data["nspp"] is None and data["nama_pengasuh"] is None and data["tipe_pesantren"] is None
    assert data["pendaftaran_dibuka"] is False and data["konsultasi_dibuka"] is False
    assert data["pengawasan"]["status_dokumen"] == "belum_dikonfirmasi"


@pytest.mark.parametrize(
    "field,value",
    [
        ("status_ijop", "aktif"),
        ("no_sk_ijop", "TEST"),
        ("tanggal_ijop_mulai", "2020-01-01"),
        ("tanggal_ijop_selesai", "2099-01-01"),
        ("unknown_fact", "TEST"),
    ],
)
def test_profile_provisioning_rejects_ijop_and_unrecognized_fields(client, satgas, field, value):
    assert (
        client.post(
            "/admin/kemenag/ponpes", headers=satgas, json=ponpes_payload(**{field: value})
        ).status_code
        == 422
    )


def test_complaint_progress_is_private_and_satgas_can_filter_cases(client, db, satgas, admin):
    first = client.post("/pengaduan/kirim", json=complaint())
    second = client.post("/pengaduan/kirim", json=complaint(ponpes_id=2))
    assert first.status_code == second.status_code == 201
    case = db.scalar(select(Pengaduan).where(Pengaduan.kode_tiket == first.json()["kode_tiket"]))
    note = "Catatan internal sensitif untuk tindak lanjut"
    update = client.put(
        f"/admin/pengaduan/{case.id}/status",
        headers=satgas,
        json={"status_tindakan": "pendampingan", "catatan_internal": note},
    )
    assert update.status_code == 200, update.text
    detail = client.get(f"/admin/pengaduan/{case.id}", headers=satgas).json()
    events = [
        event
        for event in detail["riwayat"]
        if event["status_sebelum"] == "masuk_antrian" and event["status_sesudah"] == "pendampingan"
    ]
    assert len(events) == 1
    event = events[0]
    assert event["status_sebelum"] == "masuk_antrian"
    assert event["status_sesudah"] == "pendampingan" and event["catatan_internal"] == note
    assert event["created_at"]
    assert client.get(f"/admin/pengaduan/{case.id}", headers=admin).status_code == 403
    listed = client.get(
        "/admin/pengaduan", headers=satgas, params={"status": "pendampingan", "ponpes_id": 1, "q": "Sunan"}
    )
    assert listed.status_code == 200, listed.text
    assert listed.json()["total"] == 1
    assert "riwayat" not in listed.text and "catatan_internal" not in listed.text and note not in listed.text
    assert listed.json()["items"][0]["nama_ponpes"] == "Pondok Pesantren Sunan Drajat Paciran"
    assert (
        client.get("/admin/pengaduan", headers=satgas, params={"q": "TidakAdaPesantren"}).json()["total"] == 0
    )
    for path in (
        f"/pengaduan/lacak/{case.kode_tiket}",
        "/ponpes/status/sunan-drajat",
        "/ponpes/sunan-drajat",
        "/ponpes/",
    ):
        response = client.get(path)
        assert response.status_code == 200
        assert (
            note not in response.text
            and "catatan_internal" not in response.text
            and "riwayat" not in response.text
        )
    tracking = client.get(f"/pengaduan/lacak/{case.kode_tiket}").json()
    assert set(tracking) == {"kode_tiket", "status_tindakan", "created_at"}


def test_reference_provenance_remains_when_owner_opens_services(client, db, admin):
    from backend.reference_catalog import import_catalog

    import_catalog(db)
    row = db.scalar(select(Ponpes).where(Ponpes.slug == "al-ishlah-sendangagung"))
    owner_id = db.scalar(select(User.id).where(User.email == "admin@sunandrajat.id"))
    original = db.get(Ponpes, 1)
    original.user_admin_id = None
    db.flush()
    row.user_admin_id = owner_id
    row.kuota_putra = 3
    db.commit()
    before = client.get(f"/ponpes/{row.slug}").json()["referensi"]
    assert before is not None
    response = client.put(
        "/admin/ponpes/my/layanan",
        headers=admin,
        json={"pendaftaran_dibuka": True, "konsultasi_dibuka": True},
    )
    assert response.status_code == 200, response.text
    public = client.get(f"/ponpes/status/{row.slug}").json()
    assert public["profil_referensi"] is True and public["referensi"] == before
    assert public["pendaftaran_tersedia"] is True and public["konsultasi_tersedia"] is True
    assert public["pengawasan"]["status_dokumen"] == "belum_dikonfirmasi"
    assert client.post("/pendaftaran/kirim", json=registration(ponpes_id=row.id)).status_code == 201


def test_oversight_commit_failure_rolls_back_facts_and_audit(client, db, satgas, monkeypatch, factory):
    from fastapi.testclient import TestClient

    from backend.main import app

    before = db.scalar(select(func.count(AuditLog.id)))

    def reject_commit(_session):
        raise RuntimeError("Simulated commit failure")

    monkeypatch.setattr(factory.class_, "commit", reject_commit)
    with TestClient(app, raise_server_exceptions=False) as safe_client:
        response = safe_client.put(
            "/admin/kemenag/ponpes/1/pengawasan", headers=satgas, json=oversight_payload()
        )
    assert response.status_code == 500
    db.expire_all()
    public = client.get("/ponpes/status/sunan-drajat").json()
    assert public["pengawasan"]["status_dokumen"] == "belum_dikonfirmasi"
    assert db.scalar(select(func.count(AuditLog.id))) == before


def test_service_closure_hides_public_quota_but_owner_keeps_editor_values(client, admin):
    response = client.put(
        "/admin/ponpes/my/layanan",
        headers=admin,
        json={"pendaftaran_dibuka": False, "konsultasi_dibuka": True},
    )
    assert response.status_code == 200, response.text
    assert response.json()["kuota_putra"] == 50
    public = client.get("/ponpes/status/sunan-drajat").json()
    assert public["kuota_putra"] is None and public["sisa_kuota_putri"] is None
    own = client.get("/admin/ponpes/my", headers=admin).json()
    assert own["kuota_putra"] == 50
    assert public["layanan_tersedia"] is True
    assert client.get("/ponpes/", params={"layanan": "aktif", "q": "Sunan"}).json()["total"] == 1


@pytest.mark.parametrize("prefix", ["", "/api"])
@pytest.mark.parametrize("role", ["anonymous", "owner", "satgas"])
def test_legacy_ijop_update_authorizes_before_returning_gone(client, db, admin, satgas, prefix, role):
    headers = {"anonymous": {}, "owner": admin, "satgas": satgas}[role]
    before = db.get(Ponpes, 1).no_sk_ijop
    response = client.put(f"{prefix}/admin/kemenag/ponpes/1/ijop", headers=headers, json={})
    assert response.status_code == {"anonymous": 401, "owner": 403, "satgas": 410}[role], response.text
    db.refresh(db.get(Ponpes, 1))
    assert db.get(Ponpes, 1).no_sk_ijop == before


def test_satgas_dashboard_reports_oversight_and_followup_distributions(client, satgas):
    assert client.post("/pengaduan/kirim", json=complaint()).status_code == 201
    response = client.get("/admin/dashboard", headers=satgas)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["metrics"]["ponpes_total"] == 4
    assert data["metrics"]["pengaduan_total"] == data["metrics"]["pengaduan_terbuka"] == 1
    assert data["metrics"]["pengawasan_belum_dikonfirmasi"] == 4
    assert data["status_dokumen"] == {"belum_dikonfirmasi": 4, "terdaftar": 0}
    assert data["status_operasional"] == {"belum_dikonfirmasi": 4, "beroperasi": 0, "tidak_beroperasi": 0}
    assert data["pengaduan"] == {
        "masuk_antrian": 1,
        "penyelidikan_satgas": 0,
        "pendampingan": 0,
        "proses_hukum": 0,
        "selesai": 0,
        "tidak_valid": 0,
    }
    assert "Uraian kasus" not in response.text and "Lokasi rahasia" not in response.text
