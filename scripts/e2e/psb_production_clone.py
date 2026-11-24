"""Uji end-to-end PSB terhadap instance produksi yang DI-KLONING (bukan produksi).

Dijalankan di VPS pada http://127.0.0.1:8099 (container api dari image produksi,
database klon pondokconnect_uji). Kredensial admin dibaca dari manifest di dalam
container produksi; nilainya tidak pernah dicetak.

Setiap langkah mencetak PASS/FAIL + kode HTTP; keluar 1 kalau ada yang gagal.
"""
from __future__ import annotations

import base64
import io
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import date, timedelta

BASE = os.environ.get("E2E_BASE", "http://127.0.0.1:8099")
ADMIN_LINE = os.environ.get("ADMIN_LINE", "")
PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
KK_PATH = os.environ.get("KK_IMAGE", "/home/ubuntu/herdr-out/kk-sintetis.png")

FAILS: list[str] = []
STEPS: list[str] = []
LAST = {"body": None}


def call(method: str, path: str, body=None, token=None, raw=False):
    url = BASE.rstrip("/") + path
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            payload = r.read()
            LAST["body"] = None if raw else json.loads(payload or b"{}")
            return r.status, (payload if raw else LAST["body"])
    except urllib.error.HTTPError as e:
        payload = e.read()
        try:
            parsed = json.loads(payload or b"{}")
        except json.JSONDecodeError:
            parsed = {"raw": payload[:300].decode("utf-8", "replace")}
        LAST["body"] = parsed
        return e.code, parsed


def step(name: str, ok: bool, detail: str = ""):
    tag = "PASS" if ok else "FAIL"
    line = f"[{tag}] {name}" + (f"  ({detail})" if detail else "")
    if not ok and LAST["body"] is not None:
        line += " :: " + json.dumps(LAST["body"], default=str)[:400]
    print(line, flush=True)
    STEPS.append(line)
    if not ok:
        FAILS.append(line)


def main() -> int:
    if not ADMIN_LINE:
        print("FATAL: ADMIN_LINE kosong", file=sys.stderr)
        return 2
    email = ADMIN_LINE.split()[0].strip()

    # 0. login admin produksi (kredensial dari manifest)
    st, body = call("POST", "/api/admin/login", {"email": email, "password": PASSWORD})
    token = body.get("access_token") if isinstance(body, dict) else None
    step("login admin ponpes", st == 200 and bool(token), f"HTTP {st}")

    # 1. buka layanan pendaftaran + kuota (via API admin, bukan SQL)
    st, body = call(
        "PUT",
        "/api/admin/ponpes/my/layanan",
        {"pendaftaran_dibuka": True, "konsultasi_dibuka": True},
        token,
    )
    step("buka layanan pendaftaran", st == 200, f"HTTP {st}")
    st, body = call("PUT", "/api/admin/ponpes/my", {"kuota_putra": 5, "kuota_putri": 5}, token)
    step("set kuota 5/5", st == 200, f"HTTP {st}")

    # 2. gelombang lewat API admin
    nama = f"UJI ZEUS {date.today():%Y%m%d}"
    today = date.today()
    wave = {
        "ponpes_id": 1,
        "nama": nama,
        "tanggal_buka": (today - timedelta(days=1)).isoformat(),
        "tanggal_tutup": (today + timedelta(days=30)).isoformat(),
        "biaya_pendaftaran": 250000,
        "kuota_putra": 5,
        "kuota_putri": 5,
        "jalur": ["reguler"],
        "jenjang": ["MA"],
        "aktif": True,
    }
    st, body = call("POST", "/api/admin/gelombang", wave, token)
    wave_id = body.get("id") if isinstance(body, dict) else None
    step("buat gelombang", st == 201 and bool(wave_id), f"HTTP {st}")
    if not wave_id:
        return finish()
    st, body = call("GET", "/api/gelombang?ponpes_id=1&terbuka=true")
    found = isinstance(body, list) and any(w.get("id") == wave_id for w in body)
    step("gelombang terbuka tampil di publik", st == 200 and found, f"HTTP {st}")

    # 3. pendaftaran publik dengan KK (attachment base64)
    with open(KK_PATH, "rb") as f:
        kk_b64 = base64.b64encode(f.read()).decode()
    daftar = {
        "ponpes_id": 1,
        "nik_santri": "3172010000000003",
        "nama_santri": "SANTRI UJI ZEUS",
        "jenis_kelamin": "L",
        "nama_wali": "WALI UJI ZEUS",
        "no_hp_wali": "081234567890",
        "consent": True,
        "gelombang_id": wave_id,
        "file_kk": {"filename": "kk-uji.png", "content_base64": kk_b64},
    }
    st, body = call("POST", "/api/pendaftaran/kirim", daftar)
    no_reg = body.get("nomor_registrasi") if isinstance(body, dict) else None
    step("pendaftaran santri (KK)", st == 201 and bool(no_reg), f"HTTP {st} {no_reg or body}")

    # 4. lacak rincian publik + kartu PDF
    st, body = call("GET", f"/api/pendaftaran/lacak/{no_reg}/rincian")
    step(
        "lacak rincian (publik)",
        st == 200 and body.get("gelombang_nama") == nama,
        f"HTTP {st} gelombang={body.get('gelombang_nama')}",
    )
    st, body = call("GET", f"/api/pendaftaran/kartu/{no_reg}", raw=True)
    step("kartu pendaftaran PDF", st == 200 and body[:4] == b"%PDF", f"HTTP {st} {len(body)}B")

    # 5. id internal hanya diperoleh admin (rincian publik tidak memuatnya)
    st, body = call("GET", "/api/admin/pendaftaran?limit=50", token=token)
    items = body.get("items") if isinstance(body, dict) else None
    reg_id = next((i["id"] for i in (items or []) if i.get("nomor_registrasi") == no_reg), None)
    step(
        "admin melihat pendaftaran baru",
        st == 200 and bool(reg_id) and (body.get("total") or 0) >= 1,
        f"HTTP {st} total={body.get('total')} id={reg_id}",
    )
    if not reg_id:
        return finish()

    # 5. admin: diterima + tahapan seleksi
    st, body = call("PUT", f"/api/admin/pendaftaran/{reg_id}/status", {"status_seleksi": "diterima"}, token)
    step("status -> diterima", st == 200, f"HTTP {st}")
    st, body = call(
        "POST",
        f"/api/admin/pendaftaran/{reg_id}/tahapan",
        {"pendaftaran_id": reg_id, "urutan": 1, "nama": "Wawancara", "jenis": "wawancara"},
        token,
    )
    tahapan_id = body.get("id") if isinstance(body, dict) else None
    step("tambah tahapan seleksi", st == 201 and bool(tahapan_id), f"HTTP {st}")
    st, body = call("PUT", f"/api/admin/tahapan/{tahapan_id}", {"status": "lulus"}, token)
    step("tahapan -> lulus", st == 200 and body.get("status") == "lulus", f"HTTP {st}")

    # 6. admin buka daftar ulang
    st, body = call(
        "POST",
        f"/api/admin/pendaftaran/{reg_id}/daftar-ulang",
        {"pendaftaran_id": reg_id, "biaya_masuk": 500000, "infaq": 150000},
        token,
    )
    du_id = body.get("id") if isinstance(body, dict) else None
    step("buka daftar ulang", st == 201 and bool(du_id), f"HTTP {st}")
    st, body = call("GET", f"/api/pendaftaran/lacak/{no_reg}/rincian")
    du = body.get("daftar_ulang") or {}
    step(
        "lacak: status menunggu_pembayaran + sisa hari",
        st == 200 and du.get("status") == "menunggu_pembayaran" and (body.get("sisa_hari_daftar_ulang") or 0) > 0,
        f"HTTP {st} status={du.get('status')} sisa={body.get('sisa_hari_daftar_ulang')}",
    )

    # 7. santri mengirim bukti bayar + pernyataan
    st, body = call(
        "POST",
        f"/api/pendaftaran/lacak/{no_reg}/daftar-ulang",
        {
            "pernyataan": True,
            "bukti_bayar": {"filename": "bukti-uji.png", "content_base64": kk_b64},
            "berkas_asli": ["kk-uji.png"],
        },
    )
    step(
        "daftar ulang -> menunggu_verifikasi",
        st == 200 and (body.get("daftar_ulang") or {}).get("status") == "menunggu_verifikasi",
        f"HTTP {st} status={(body.get('daftar_ulang') or {}).get('status')}",
    )
    st, body = call("POST", f"/api/pendaftaran/lacak/{no_reg}/daftar-ulang", {"pernyataan": False})
    step("pernyataan wajib (422)", st == 422, f"HTTP {st}")

    # 8. admin lihat bukti + papan pengumuman
    st, body = call("GET", f"/api/admin/pendaftaran/{reg_id}/bukti-bayar", token=token, raw=True)
    step("admin unduh bukti bayar", st == 200 and body[:4] == b"\x89PNG", f"HTTP {st} {len(body)}B")
    st, body = call("GET", "/api/admin/papan-daftar-ulang", token=token)
    listed = isinstance(body, list) and any(r.get("nomor_registrasi") == no_reg for r in body)
    step("papan daftar ulang memuat nomor", st == 200 and listed, f"HTTP {st} n={len(body) if isinstance(body, list) else '-'}")

    # 9. admin tutup daftar ulang
    st, body = call(
        "PUT",
        f"/api/admin/daftar-ulang/{du_id}",
        {"status": "selesai", "nomor_induk": "UJI-2026-001", "kamar": "A-01"},
        token,
    )
    step(
        "daftar ulang -> selesai + nomor induk",
        st == 200 and body.get("status") == "selesai" and body.get("nomor_induk") == "UJI-2026-001",
        f"HTTP {st}",
    )
    st, body = call("GET", f"/api/pendaftaran/lacak/{no_reg}/rincian")
    step(
        "lacak setelah selesai",
        st == 200 and (body.get("daftar_ulang") or {}).get("status") == "selesai" and body.get("nomor_induk") == "UJI-2026-001",
        f"HTTP {st} nomor_induk={body.get('nomor_induk')}",
    )

    # 10. admin: daftar pendaftaran + OCR KK
    st, body = call("GET", "/api/admin/pendaftaran?limit=5", token=token)
    total = body.get("total") if isinstance(body, dict) else None
    step("admin daftar pendaftaran", st == 200 and (total or 0) >= 1, f"HTTP {st} total={total}")
    st, body = call(
        "POST",
        "/api/ocr/kk",
        {"attachment": {"filename": "kk-uji.png", "content_base64": kk_b64}, "consent": True},
    )
    anggota = (body or {}).get("members") or []
    step(
        "OCR KK (Groq) pada instance uji",
        st == 200 and len(anggota) >= 1,
        f"HTTP {st} anggota={len(anggota)} kepala={(body or {}).get('kepala_keluarga')}",
    )
    st, body = call(
        "POST",
        "/api/ocr/kk",
        {"attachment": {"filename": "kk-uji.png", "content_base64": kk_b64}, "consent": False},
    )
    step("OCR tanpa persetujuan ditolak", st == 422, f"HTTP {st}")

    print(f"\nRingkas: {len(STEPS) - len(FAILS)}/{len(STEPS)} langkah lulus")
    return finish()


def finish() -> int:
    if FAILS:
        print(f"\nGAGAL: {len(FAILS)} langkah")
        for line in FAILS:
            print(" -", line)
        return 1
    print("\nSEMUA LANGKAH LULUS")
    return 0


if __name__ == "__main__":
    sys.exit(main())