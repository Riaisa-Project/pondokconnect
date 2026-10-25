import base64

from sqlalchemy import select

from backend.models.models import Pendaftaran, Pengaduan


def registration(**changes):
    return {
        "ponpes_id": 1,
        "nik_santri": "1234567890123456",
        "nama_santri": "Santri Test",
        "jenis_kelamin": "L",
        "nama_wali": "Wali Test",
        "no_hp_wali": "08123456789",
        **changes,
    }


def complaint(**changes):
    return {
        "ponpes_id": 1,
        "kategori_kasus": "perundungan_bullying",
        "tanggal_kejadian": "2026-01-01",
        "lokasi_kejadian": "Lokasi rahasia",
        "deskripsi_peristiwa": "Uraian kasus yang sensitif.",
        "mode_pelapor": "rahasia",
        "nama_pelapor": "Jangan Disimpan",
        "kontak_pelapor": "081222333444",
        **changes,
    }


def test_quota_duplicate_and_rejection_release(client, db, admin):
    client.put("/admin/ponpes/my", headers=admin, json={"kuota_putra": 1})
    one = client.post("/pendaftaran/kirim", json=registration())
    assert one.status_code == 201, one.text
    number = one.json()["nomor_registrasi"]
    assert number.startswith("REG-")
    row = db.scalar(select(Pendaftaran).where(Pendaftaran.nomor_registrasi == number))
    assert client.post("/pendaftaran/kirim", json=registration()).status_code == 409
    assert (
        client.post("/pendaftaran/kirim", json=registration(nik_santri="2234567890123456")).status_code == 409
    )
    assert client.put("/admin/ponpes/my", headers=admin, json={"kuota_putra": 0}).status_code == 409
    assert (
        client.put(
            f"/admin/pendaftaran/{row.id}/status", headers=admin, json={"status_seleksi": "ditolak"}
        ).status_code
        == 200
    )
    assert (
        client.post("/pendaftaran/kirim", json=registration(nik_santri="2234567890123456")).status_code == 201
    )
    assert (
        client.put(
            f"/admin/pendaftaran/{row.id}/status", headers=admin, json={"status_seleksi": "diterima"}
        ).status_code
        == 409
    )
    tracking = client.get(f"/pendaftaran/lacak/{number}")
    assert tracking.json()["status_seleksi"] == "ditolak"
    assert "nik_santri" not in tracking.text and "nama_wali" not in tracking.text
    card = client.get(f"/pendaftaran/kartu/{number}")
    assert card.status_code == 200 and card.content.startswith(b"%PDF")
    assert client.get("/pendaftaran/lacak/unknown").status_code == 404


def test_registration_ownership(client, db, admin):
    response = client.post("/pendaftaran/kirim", json=registration(ponpes_id=2))
    number = response.json()["nomor_registrasi"]
    row = db.scalar(select(Pendaftaran).where(Pendaftaran.nomor_registrasi == number))
    assert client.get("/admin/pendaftaran", headers=admin).json()["total"] == 0
    assert (
        client.put(
            f"/admin/pendaftaran/{row.id}/status", headers=admin, json={"status_seleksi": "diterima"}
        ).status_code
        == 404
    )
    assert client.get(f"/admin/pendaftaran/{row.id}/berkas", headers=admin).status_code == 404


def test_anonymity_rbac_and_tracking(client, db, admin, satgas):
    response = client.post("/pengaduan/kirim", json=complaint())
    assert response.status_code == 201, response.text
    ticket = response.json()["kode_tiket"]
    assert len(ticket) == 32
    row = db.scalar(select(Pengaduan).where(Pengaduan.kode_tiket == ticket))
    assert row.nama_pelapor is None and row.kontak_pelapor is None
    assert client.get("/admin/pengaduan", headers=admin).status_code == 403
    assert client.get(f"/admin/pengaduan/{row.id}", headers=admin).status_code == 403
    assert (
        client.put(
            f"/admin/pengaduan/{row.id}/status", headers=admin, json={"status_tindakan": "selesai"}
        ).status_code
        == 403
    )
    assert client.get("/admin/audit-logs", headers=admin).status_code == 403
    assert (
        client.put(
            f"/admin/pengaduan/{row.id}/status", headers=satgas, json={"status_tindakan": "pendampingan"}
        ).status_code
        == 200
    )
    track = client.get(f"/pengaduan/lacak/{ticket}")
    assert track.json()["status_tindakan"] == "pendampingan"
    assert set(track.json()) == {"kode_tiket", "status_tindakan", "created_at"}
    assert "Jangan Disimpan" not in client.get("/admin/pengaduan", headers=satgas).text


def test_validation_and_error_privacy(client):
    assert client.post("/pendaftaran/kirim", json=registration(nik_santri="123")).status_code == 422
    assert (
        client.post("/pengaduan/kirim", json=complaint(mode_pelapor="terbuka", nama_pelapor=None)).status_code
        == 422
    )
    assert client.post("/pengaduan/kirim", json=complaint(tanggal_kejadian="2099-01-01")).status_code == 422
    bad = client.post("/admin/change-password", json={"secret": "sensitive-password"})
    assert "sensitive-password" not in bad.text


def test_chat_session_binding_reply_and_read(client, admin):
    payload = {
        "ponpes_id": 1,
        "nama_warga": "Wali Test",
        "kontak_warga": "08122222222",
        "pesan": "Biaya pendaftaran?",
    }
    sent = client.post("/chat/kirim", json=payload)
    assert sent.status_code == 201, sent.text
    sid = sent.json()["session_id"]
    assert len(sid) == 64
    assert client.get(f"/chat/2/{sid}").status_code == 404
    assert client.post("/chat/kirim", json={**payload, "ponpes_id": 2, "session_id": sid}).status_code == 404
    assert client.post("/chat/kirim", json={**payload, "session_id": "a" * 64}).status_code == 404
    inbox = client.get("/admin/chat", headers=admin).json()
    assert inbox["items"][0]["unread_count"] == 1
    reply = client.post(
        "/admin/chat/reply", headers=admin, json={"session_id": sid, "pesan": "Silakan datang ke kantor."}
    )
    assert reply.status_code == 201
    assert len(client.get(f"/chat/1/{sid}").json()["items"]) == 2
    assert "kontak_warga" not in client.get(f"/chat/1/{sid}").text
    assert client.put("/admin/chat/read", headers=admin, json={"session_id": sid}).status_code == 200
    assert client.get("/admin/chat", headers=admin).json()["items"][0]["unread_count"] == 0
    other = client.post("/chat/kirim", json={**payload, "ponpes_id": 2}).json()["session_id"]
    assert (
        client.post(
            "/admin/chat/reply", headers=admin, json={"session_id": other, "pesan": "Bocor"}
        ).status_code
        == 404
    )


def test_private_upload_and_file_validation(client, db, admin, satgas):
    # Minimal PDF bytes; application performs signature checking, not document rendering.
    attachment = {
        "filename": "../../private.pdf",
        "content_base64": base64.b64encode(b"%PDF-1.4\n%%EOF").decode(),
    }
    response = client.post("/pendaftaran/kirim", json=registration(file_kk=attachment))
    assert response.status_code == 201, response.text
    row = db.scalar(select(Pendaftaran))
    assert ".." not in row.file_kk
    assert client.get(f"/admin/pendaftaran/{row.id}/berkas").status_code == 401
    download = client.get(f"/admin/pendaftaran/{row.id}/berkas", headers=admin)
    assert download.content.startswith(b"%PDF")
    report = client.post("/pengaduan/kirim", json=complaint(bukti_lampiran=attachment))
    assert report.status_code == 201
    case = db.scalar(select(Pengaduan))
    assert client.get(f"/admin/pengaduan/{case.id}/bukti", headers=admin).status_code == 403
    assert client.get(f"/admin/pengaduan/{case.id}/bukti", headers=satgas).content.startswith(b"%PDF")
    bad_file = {"filename": "file.pdf", "content_base64": base64.b64encode(b"<script>bad</script>").decode()}
    assert (
        client.post(
            "/pendaftaran/kirim", json=registration(nik_santri="2234567890123456", file_kk=bad_file)
        ).status_code
        == 422
    )


def test_complaint_utf8_payload_fits_mysql_text(client):
    response = client.post("/pengaduan/kirim", json=complaint(deskripsi_peristiwa="🔒" * 20000))
    assert response.status_code == 422
    assert "🔒" not in response.text


def test_date_requires_iso_calendar_date(client):
    assert client.post("/pengaduan/kirim", json=complaint(tanggal_kejadian=0)).status_code == 422
    assert (
        client.post("/pengaduan/kirim", json=complaint(tanggal_kejadian="2026-01-01T00:00:00")).status_code
        == 422
    )
