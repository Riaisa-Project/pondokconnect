"""Alur PSB end-to-end: gelombang → pendaftaran → tahapan → pengumuman → daftar ulang.

Satu test menempuh jalur bahagia penuh plus dua cabang penting (kursi hangus =
gugur, dan penolakan daftar ulang sebelum pengurus membukanya) supaya celah
"daftar ulang" yang jadi alasan fitur ini ada benar-benar tertutup.
"""

import base64
from datetime import date, timedelta

PDF = {"filename": "bukti.pdf", "content_base64": base64.b64encode(b"%PDF-1.4\n%%EOF").decode()}


def reg(**changes):
    return {
        "ponpes_id": 1,
        "nik_santri": "1234567890123456",
        "nama_santri": "Santri PSB",
        "jenis_kelamin": "L",
        "nama_wali": "Wali PSB",
        "no_hp_wali": "08123456789",
        "consent": True,
        **changes,
    }


def latest_id(client, headers):
    items = client.get("/admin/pendaftaran", headers=headers).json()["items"]
    return max(row["id"] for row in items)


def test_psb_flow_from_wave_to_student_number(client, admin):
    today = date.today()
    wave = client.post(
        "/admin/gelombang",
        headers=admin,
        json={
            "ponpes_id": 1,
            "nama": "Gelombang 1 2027",
            "tanggal_buka": str(today),
            "tanggal_tutup": str(today + timedelta(days=30)),
            "biaya_pendaftaran": "150000",
            "kuota_putra": 5,
            "kuota_putri": 5,
        },
    )
    assert wave.status_code == 201, wave.text
    wave_id = wave.json()["id"]
    assert client.post(
        "/admin/gelombang",
        headers=admin,
        json={
            "ponpes_id": 1,
            "nama": "Gelombang 1 2027",
            "tanggal_buka": str(today),
            "tanggal_tutup": str(today),
        },
    ).status_code == 409
    assert client.post(
        "/admin/gelombang",
        headers=admin,
        json={
            "ponpes_id": 1,
            "nama": "Gelombang Terbalik",
            "tanggal_buka": str(today + timedelta(days=5)),
            "tanggal_tutup": str(today),
        },
    ).status_code == 422
    open_waves = client.get(f"/gelombang?ponpes_id=1&terbuka=true").json()
    assert [row["id"] for row in open_waves] == [wave_id]

    # Calon mendaftar memakai gelombang itu: biaya gelombang ikut tersalin.
    sent = client.post("/pendaftaran/kirim", json=reg(gelombang_id=wave_id, file_kk=PDF))
    assert sent.status_code == 201, sent.text
    number = sent.json()["nomor_registrasi"]
    registration_id = latest_id(client, admin)

    detail = client.get(f"/pendaftaran/lacak/{number}/rincian").json()
    assert detail["gelombang_nama"] == "Gelombang 1 2027"
    assert detail["biaya_pendaftaran"] == "150000.00"
    assert detail["tahapan"] == [] and detail["daftar_ulang"] is None

    # Pengurus mencatat tahapan seleksi; urutan ganda ditolak.
    for urutan, nama in ((1, "Verifikasi berkas"), (2, "Tes baca Al-Qur'an")):
        stage = client.post(
            f"/admin/pendaftaran/{registration_id}/tahapan",
            headers=admin,
            json={"pendaftaran_id": registration_id, "urutan": urutan, "nama": nama, "jenis": "tes"},
        )
        assert stage.status_code == 201, stage.text
    assert client.post(
        f"/admin/pendaftaran/{registration_id}/tahapan",
        headers=admin,
        json={"pendaftaran_id": registration_id, "urutan": 2, "nama": "Duplikat"},
    ).status_code == 409
    stages = client.get(f"/pendaftaran/lacak/{number}/rincian").json()["tahapan"]
    assert [s["urutan"] for s in stages] == [1, 2]
    assert (
        client.put(
            f"/admin/tahapan/{stages[1]['id']}",
            headers=admin,
            json={"status": "lulus", "jadwal_at": "2026-12-01T08:00:00", "lokasi": "Aula"},
        ).status_code
        == 200
    )
    assert client.get(f"/pendaftaran/lacak/{number}/rincian").json()["tahapan"][1]["status"] == "lulus"

    # Daftar ulang belum boleh disubmit sebelum pengurus membukanya.
    assert (
        client.post(
            f"/pendaftaran/lacak/{number}/daftar-ulang", json={"pernyataan": True}
        ).status_code
        == 409
    )
    assert (
        client.post(
            f"/admin/pendaftaran/{registration_id}/daftar-ulang",
            headers=admin,
            json={"pendaftaran_id": registration_id},
        ).status_code
        == 409
    )
    assert (
        client.put(
            f"/admin/pendaftaran/{registration_id}/status",
            headers=admin,
            json={"status_seleksi": "diterima"},
        ).status_code
        == 200
    )
    opened = client.post(
        f"/admin/pendaftaran/{registration_id}/daftar-ulang",
        headers=admin,
        json={"pendaftaran_id": registration_id, "biaya_masuk": "500000", "infaq": "100000"},
    )
    assert opened.status_code == 201, opened.text
    du_id = opened.json()["id"]
    assert opened.json()["tenggat_at"] is not None and opened.json()["status"] == "menunggu_pembayaran"
    assert (
        client.post(
            f"/admin/pendaftaran/{registration_id}/daftar-ulang",
            headers=admin,
            json={"pendaftaran_id": registration_id},
        ).status_code
        == 409
    )

    board = client.get("/admin/papan-daftar-ulang", headers=admin).json()
    assert [(row["nomor_registrasi"], row["sisa_hari_daftar_ulang"]) for row in board] == [(number, 7)]
    assert board[0]["status_seleksi"] == "daftar_ulang"

    # Wali mengirim bukti bayar + pernyataan; tanpa pernyataan ditolak.
    assert (
        client.post(f"/pendaftaran/lacak/{number}/daftar-ulang", json={"pernyataan": False}).status_code
        == 422
    )
    submitted = client.post(
        f"/pendaftaran/lacak/{number}/daftar-ulang",
        json={"pernyataan": True, "bukti_bayar": PDF, "berkas_asli": ["kartu_keluarga", "ijazah"]},
    )
    assert submitted.status_code == 200, submitted.text
    body = submitted.json()
    assert body["daftar_ulang"]["status"] == "menunggu_verifikasi"
    assert body["daftar_ulang"]["bukti_bayar"] is None, "bukti bayar tidak boleh keluar lewat jalur publik"
    assert body["has_bukti_bayar"] is True
    assert body["daftar_ulang"]["berkas_asli"] == ["kartu_keluarga", "ijazah"]
    assert body["daftar_ulang"]["pernyataan_at"] is not None
    assert client.get(f"/admin/pendaftaran/{registration_id}/bukti-bayar", headers=admin).status_code == 200

    # Menutup daftar ulang wajib nomor induk; setelah selesai kursi terkunci.
    assert (
        client.put(f"/admin/daftar-ulang/{du_id}", headers=admin, json={"status": "selesai"}).status_code
        == 422
    )
    closed = client.put(
        f"/admin/daftar-ulang/{du_id}",
        headers=admin,
        json={"status": "selesai", "nomor_induk": "2027.0001", "kamar": "Asrama A-3"},
    )
    assert closed.status_code == 200, closed.text
    detail = client.get(f"/pendaftaran/lacak/{number}/rincian").json()
    assert detail["nomor_induk"] == "2027.0001" and detail["kamar"] == "Asrama A-3"
    assert detail["sisa_hari_daftar_ulang"] is None
    assert client.get(f"/pendaftaran/kartu/{number}").content.startswith(b"%PDF")

    # Cabang kursi hangus: lewat tenggat/gugur → status gugur dan keluar dari papan.
    other = client.post("/pendaftaran/kirim", json=reg(nik_santri="2234567890123456", gelombang_id=wave_id))
    other_number = other.json()["nomor_registrasi"]
    other_id = latest_id(client, admin)
    client.put(f"/admin/pendaftaran/{other_id}/status", headers=admin, json={"status_seleksi": "diterima"})
    dropped = client.post(
        f"/admin/pendaftaran/{other_id}/daftar-ulang", headers=admin, json={"pendaftaran_id": other_id}
    ).json()
    assert (
        client.put(f"/admin/daftar-ulang/{dropped['id']}", headers=admin, json={"status": "gugur"}).status_code
        == 200
    )
    assert client.get(f"/pendaftaran/lacak/{other_number}/rincian").json()["status_seleksi"] == "gugur"
    assert [row["nomor_registrasi"] for row in client.get("/admin/papan-daftar-ulang", headers=admin).json()] == [
        number
    ]
    # Tanpa token pengurus, jalur admin tertutup.
    assert client.get("/admin/papan-daftar-ulang").status_code in (401, 403)
