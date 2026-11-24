#!/usr/bin/env python3
"""Battery API Pondok Connect — read-only + kasus negatif, aman untuk produksi.

Tidak menulis data apa pun (POST/PUT/DELETE yang mengubah state tidak dipanggil,
kecuali /admin/login yang hanya menerbitkan token). Setiap assertion memeriksa
NILAI, bukan hanya status code — field yang hilang harus gagal, bukan lolos.

Pakai:  python3 scripts/qa/api_battery.py [base_url]
Exit 0 = semua lulus.
"""
from __future__ import annotations

import json
import pathlib
import re
import sys
import time
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "https://pondokconnect.riaisa.tech").rstrip("/")
HERE = pathlib.Path(__file__).resolve().parents[2]
CRED = HERE / "storage" / "private" / "akun-produksi-20261120.txt"
ORIGIN = "https://pondokconnect.riaisa.tech"

results: list[tuple[bool, str, str]] = []
INFO: list[str] = []


def call(method: str, path: str, *, body=None, token=None, origin=None, headers=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    if data:
        req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    if origin:
        req.add_header("Origin", origin)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
            return r.status, _parse(raw, r.headers.get("content-type", "")), dict(r.headers)
    except urllib.error.HTTPError as e:
        raw = e.read()
        return e.code, _parse(raw, e.headers.get("content-type", "")), dict(e.headers)
    except Exception as e:  # noqa: BLE001
        return 0, {"error": repr(e)}, {}


def _parse(raw: bytes, ctype: str):
    if not raw:
        return None
    if "json" in ctype:
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {"_raw": raw[:200].decode("utf-8", "replace")}
    return raw.decode("utf-8", "replace")


def check(name: str, cond: bool, detail: str = "") -> None:
    results.append((bool(cond), name, detail))


def info(name: str, detail: str) -> None:
    INFO.append(f"{name}: {detail}")


def credentials() -> tuple[str, str] | None:
    if not CRED.exists():
        check("manifest kredensial produksi ada", False, f"{CRED} tidak ditemukan")
        return None
    for line in CRED.read_text(errors="replace").splitlines():
        if line.startswith("admin01@"):
            m = re.match(r"(\S+)\s*-\s*(\S+)", line)
            if m:
                return m.group(1), m.group(2)
    check("manifest kredensial terbaca", False, "baris admin01 tidak ditemukan")
    return None


SATGAS_CRED = HERE / "storage" / "private" / "akun-admin-dan-satgas-20261023.txt"


def satgas_credentials() -> tuple[str, str] | None:
    """Akun regulator (satgas_kemenag). None kalau manifest tidak ada / login gagal."""
    if not SATGAS_CRED.exists():
        return None
    for line in SATGAS_CRED.read_text(errors="replace").splitlines():
        if "satgas@kemenag.go.id" in line:
            m = re.search(r"(satgas@kemenag\.go\.id)\s*[-:|]\s*(\S+)", line)
            if m:
                return m.group(1), m.group(2)
    return None


def post_login(email: str, password: str, *, tries: int = 3):
    """POST login dengan retry saat kena rate limit (login 5/minute)."""
    for attempt in range(tries):
        st, js, _ = call("POST", "/api/admin/login", body={"email": email, "password": password})
        if st != 429:
            return st, js
        time.sleep(20)
    return 429, {"error": "rate limited"}


def login() -> str | None:
    """Token admin dari manifest. Nilai kredensial tidak pernah dicetak."""
    creds = credentials()
    if not creds:
        return None
    st, js = post_login(creds[0], creds[1])
    check("POST /api/admin/login (kredensial benar) -> 200", st == 200, f"status={st}")
    if isinstance(js, dict):
        check("login mengembalikan access_token", bool(js.get("access_token")), f"keys={sorted(js)}")
        check("login tidak membocorkan password_hash", "password_hash" not in json.dumps(js),
              f"keys={sorted(js)}")
        if "expires_in" in js and js.get("access_token"):
            import base64
            seg = js["access_token"].split(".")[1]
            payload = json.loads(base64.urlsafe_b64decode(seg + "=" * (-len(seg) % 4)))
            delta = int(payload.get("exp", 0) - payload.get("iat", 0))
            check("expires_in konsisten dengan exp-iat token", js["expires_in"] == delta,
                  f"expires_in={js['expires_in']} exp-iat={delta}")
        return js.get("access_token")
    return None


# ══════════════════════════════════════════════════════════ health & sistem
st, js, _ = call("GET", "/health")
check("GET /health -> 200", st == 200, f"status={st}")
check("health: status ok", isinstance(js, dict) and js.get("status") == "ok", str(js)[:120])
check("health: database ok", isinstance(js, dict) and js.get("database") == "ok", str(js)[:120])
st, js, _ = call("GET", "/api/health")
check("GET /api/health -> 200", st == 200, f"status={st}")

# ══════════════════════════════════════════════════════════ docs produksi tertutup
st, js, hd = call("GET", "/openapi.json")
ct = (hd.get("content-type") or "").lower()
check("GET /openapi.json bukan skema JSON di produksi", "json" not in ct, f"content-type={ct}")
check("GET /openapi.json tidak memuat daftar rute", not (isinstance(js, dict) and "paths" in js), "")
st, js, hd = call("GET", "/docs")
body = js if isinstance(js, str) else json.dumps(js)
check("GET /docs tidak menyajikan UI Swagger", "swagger" not in body.lower(), f"len={len(body)}")
st, js, hd = call("GET", "/redoc")
body = js if isinstance(js, str) else json.dumps(js)
check("GET /redoc tidak menyajikan UI ReDoc", "redoc" not in body.lower(), f"len={len(body)}")

st, js, _ = call("GET", "/api/system/features")
check("GET /api/system/features -> 200", st == 200, f"status={st}")
if isinstance(js, dict):
    check("features: demo=False di produksi", js.get("demo") is False, str(js)[:160])
    check("features: demo_accounts_available=False", js.get("demo_accounts_available") is False, str(js)[:160])
    check("features: tidak mengirim daftar akun", "accounts" not in js, f"keys={sorted(js)}")

# ══════════════════════════════════════════════════════════ statistik
st, js, _ = call("GET", "/api/stats/ringkasan")
check("GET /api/stats/ringkasan -> 200", st == 200, f"status={st}")
if isinstance(js, dict):
    check("ringkasan: total_ponpes = 33", js.get("total_ponpes") == 33, f"got={js.get('total_ponpes')}")
    check("ringkasan: total_kecamatan > 0", (js.get("total_kecamatan") or 0) > 0, f"got={js.get('total_kecamatan')}")
    check("ringkasan: per_kecamatan berisi baris", bool(js.get("per_kecamatan")), "")

# ══════════════════════════════════════════════════════════ direktori
st, js, _ = call("GET", "/api/ponpes/?limit=100")
items = js.get("items") if isinstance(js, dict) else None
check("GET /api/ponpes/?limit=100 -> 200", st == 200, f"status={st}")
check("direktori: total = 33", isinstance(js, dict) and js.get("total") == 33, f"got={js.get('total') if isinstance(js, dict) else js}")
check("direktori: 33 item", isinstance(items, list) and len(items) == 33, f"got={len(items) if items else items}")
if isinstance(items, list) and items:
    check("direktori: setiap item punya slug", all(i.get("slug") for i in items), "")
    check("direktori: setiap item punya nama_ponpes", all(i.get("nama_ponpes") for i in items), "")
    info("field publik listing", f"{len(items[0])} kolom per item, termasuk nspp/no_sk_ijop/alamat_lengkap")

st, js, _ = call("GET", "/api/ponpes/?limit=5")
check("direktori: limit=5 dihormati", isinstance(js, dict) and len(js.get("items") or []) == 5, str(js)[:120])
st, js, _ = call("GET", "/api/ponpes/?limit=1&offset=1")
check("direktori: offset bekerja", isinstance(js, dict) and len(js.get("items") or []) == 1, str(js)[:120])
st, js, _ = call("GET", "/api/ponpes/?q=aman&limit=100")
q = js.get("items") if isinstance(js, dict) else []
check("direktori: q=aman menyaring dengan benar",
      isinstance(q, list) and 0 < len(q) < 33 and all("aman" in (i.get("nama_ponpes") or "").lower() for i in q),
      f"got={len(q) if q else q}")
st, js, _ = call("GET", "/api/ponpes/?layanan=aktif&limit=100")
aktif = js.get("items") if isinstance(js, dict) else []
check("direktori: layanan=aktif -> 7 ponpes", isinstance(aktif, list) and len(aktif) == 7,
      f"got={len(aktif) if aktif else aktif}")
st, js, _ = call("GET", "/api/ponpes/?tipe=kombinasi&limit=100")
comb = js.get("items") if isinstance(js, dict) else []
check("direktori: filter tipe=kombinasi hanya tipe itu",
      isinstance(comb, list) and all(i.get("tipe_pesantren") == "kombinasi" for i in comb), f"got={len(comb)}")
st, js, _ = call("GET", "/api/ponpes/?tipe=bukan-tipe&limit=100")
check("direktori: tipe tidak valid -> 422", st == 422, f"status={st}")
st, js, _ = call("GET", "/api/ponpes/?limit=200")
check("direktori: limit > 100 -> 422", st == 422, f"status={st}")
st, js, _ = call("GET", "/api/ponpes/?q=" + "x" * 151)
check("direktori: q terlalu panjang -> 422", st == 422, f"status={st}")
st, js, _ = call("GET", "/api/ponpes/?slugs=../etc/passwd")
check("direktori: slugs tidak valid -> 422", st == 422, f"status={st}")

# ══════════════════════════════════════════════════════════ kecamatan
st, js, _ = call("GET", "/api/kecamatan/")
check("GET /api/kecamatan/ -> 200", st == 200, f"status={st}")
check("kecamatan: daftar tidak kosong", isinstance(js, list) and len(js) > 0,
      f"got={len(js) if isinstance(js, list) else js}")

# ══════════════════════════════════════════════════════════ detail 33 profil
slugs = [i["slug"] for i in items] if isinstance(items, list) else []
bad = []
for s in slugs:
    st, js, _ = call("GET", f"/api/ponpes/{s}")
    if st != 200 or not isinstance(js, dict) or not js.get("slug"):
        bad.append((s, st))
check(f"detail: {len(slugs)}/{len(slugs)} profil -> 200", not bad, f"gagal={bad[:5]}")

if slugs:
    st, js, _ = call("GET", f"/api/ponpes/{slugs[0]}")
    if isinstance(js, dict):
        for field in ("nama_ponpes", "slug", "alamat_lengkap", "kuota_putra", "kuota_putri", "deskripsi"):
            check(f"detail: mengandung {field}", js.get(field) is not None, f"got={js.get(field)!r}"[:80])
        check("detail: tidak membocorkan data admin", "user_admin_id" not in js, f"keys={sorted(js)}")
st, js, _ = call("GET", "/api/ponpes/slug-tidak-ada-999")
check("detail: slug tidak ada -> 404", st == 404, f"status={st}")
st, js, _ = call("GET", "/api/ponpes/..%2F..%2Fetc%2Fpasswd")
check("detail: path traversal ditolak", st in (404, 400, 422), f"status={st}")

if slugs:
    st, js, _ = call("GET", f"/api/ponpes/status/{slugs[0]}")
    check("GET /api/ponpes/status/{slug} -> 200", st == 200, f"status={st}")
st, js, _ = call("GET", "/api/ponpes/status/tidak-ada")
check("status operasional: slug tidak ada -> 404", st == 404, f"status={st}")

st, js, _ = call("GET", "/api/ponpes/verifikasi-ijop/510035240158")
check("verifikasi-ijop NSPP terdaftar -> 200", st == 200, f"status={st} body={str(js)[:120]}")
st, js, _ = call("GET", "/api/ponpes/verifikasi-ijop/000000000000")
check("verifikasi-ijop NSPP palsu ditolak", st in (400, 404, 422), f"status={st}")

# ══════════════════════════════════════════════════════════ pelacakan
st, js, _ = call("GET", "/api/pendaftaran/lacak/REG-202699-ZZZZ")
check("lacak pendaftaran palsu -> 404", st == 404, f"status={st}")
st, js, _ = call("GET", "/api/pendaftaran/lacak/REG-202699-ZZZZ/rincian")
check("rincian pendaftaran palsu -> 404", st == 404, f"status={st}")
st, js, _ = call("GET", "/api/pengaduan/lacak/TIKET-TIDAK-ADA")
check("lacak pengaduan palsu -> 404", st == 404, f"status={st}")

# ══════════════════════════════════════════════════════════ auth
st, js, _ = call("POST", "/api/admin/login", body={})
check("login tanpa body -> 422", st == 422, f"status={st}")
st, js = post_login("admin01@pondokconnect.id", "salah-banget-123")
check("login password salah -> 401", st == 401, f"status={st}")
st, js = post_login("tidak-ada@pondokconnect.id", "salah-banget-123")
check("login email tidak ada -> 401", st == 401, f"status={st}")

token = login()

PROTECTED = ["/api/admin/me", "/api/admin/ponpes/my", "/api/admin/pendaftaran", "/api/admin/pengaduan",
             "/api/admin/gelombang", "/api/admin/papan-daftar-ulang", "/api/admin/chat",
             "/api/admin/dashboard", "/api/admin/audit-logs", "/api/admin/kemenag/ponpes"]
for path in PROTECTED:
    st, _, _ = call("GET", path)
    check(f"{path} tanpa token -> 401", st == 401, f"status={st}")
st, _, _ = call("GET", "/api/admin/ponpes/my", token="token.palsu.saja")
check("/api/admin/ponpes/my token palsu -> 401", st == 401, f"status={st}")

# Endpoint milik admin ponpes vs satgas: gerbang role harus bekerja dua arah.
PONPES_ONLY = ["/api/admin/ponpes/my", "/api/admin/pendaftaran", "/api/admin/gelombang",
               "/api/admin/papan-daftar-ulang", "/api/admin/chat", "/api/admin/dashboard"]
SATGAS_ONLY = ["/api/admin/pengaduan", "/api/admin/audit-logs", "/api/admin/kemenag/ponpes"]

if token:
    st, js, _ = call("GET", "/api/admin/me", token=token)
    check("GET /api/admin/me -> 200", st == 200, f"status={st}")
    check("/me tidak membocorkan password_hash",
          isinstance(js, dict) and "password_hash" not in json.dumps(js),
          f"keys={sorted(js) if isinstance(js, dict) else js}")
    for path in PONPES_ONLY:
        st, _, _ = call("GET", path, token=token)
        check(f"{path} (admin ponpes) -> 200", st == 200, f"status={st}")
    for path in SATGAS_ONLY:
        st, _, _ = call("GET", path, token=token)
        check(f"{path} (admin ponpes) -> 403, bukan 200", st == 403, f"status={st}")

sat = satgas_credentials()
sat_token = None
if sat:
    st, js = post_login(sat[0], sat[1])
    if st == 200 and isinstance(js, dict):
        sat_token = js.get("access_token")
        check("login satgas_kemenag -> 200", True)
        for path in SATGAS_ONLY:
            st, _, _ = call("GET", path, token=sat_token)
            check(f"{path} (satgas) -> 200", st == 200, f"status={st}")
    else:
        info("akun satgas_kemenag", f"login gagal (status={st}); uji arah satgas dilewati")
else:
    info("akun satgas_kemenag", "manifest tidak memuat baris satgas@kemenag.go.id")

# ══════════════════════════════════════════════════════════ headers keamanan
st, _, hdrs = call("GET", "/health")
h = {k.lower(): v for k, v in hdrs.items()}
check("header X-Content-Type-Options=nosniff", h.get("x-content-type-options") == "nosniff", h.get("x-content-type-options"))
check("header X-Frame-Options=DENY", h.get("x-frame-options") == "DENY", h.get("x-frame-options"))
check("header Referrer-Policy=no-referrer", h.get("referrer-policy") == "no-referrer", h.get("referrer-policy"))
check("header Cache-Control=no-store", "no-store" in (h.get("cache-control") or ""), h.get("cache-control"))
if "max-age" in (h.get("strict-transport-security") or ""):
    check("header HSTS aktif", True, h.get("strict-transport-security"))
else:
    info("HSTS", "TIDAK ada header Strict-Transport-Security dari origin (Caddy tidak menambah default)")

# ══════════════════════════════════════════════════════════ CORS
st, _, hdrs = call("OPTIONS", "/api/ponpes/", origin=ORIGIN, headers={"Access-Control-Request-Method": "GET"})
h = {k.lower(): v for k, v in hdrs.items()}
check("CORS preflight origin produksi -> 200/204", st in (200, 204), f"status={st}")
check("CORS preflight meng-echo origin produksi", h.get("access-control-allow-origin") == ORIGIN,
      h.get("access-control-allow-origin"))
st, _, hdrs = call("OPTIONS", "/api/ponpes/", origin="https://evil.example.com",
                   headers={"Access-Control-Request-Method": "GET"})
h = {k.lower(): v for k, v in hdrs.items()}
check("CORS preflight origin asing tidak dapat ACAO", "access-control-allow-origin" not in h,
      h.get("access-control-allow-origin"))

# ══════════════════════════════════════════════════════════ 404 / 405
st, _, _ = call("GET", "/api/tidak-ada-endpoint")
check("endpoint tidak ada -> 404", st == 404, f"status={st}")
st, _, _ = call("DELETE", "/api/ponpes/")
check("metode tidak diizinkan -> 405", st == 405, f"status={st}")

# ══════════════════════════════════════════════════════════ rate limit (TERAKHIR)
st_ocr = []
for i in range(6):
    st, _, _ = call("POST", "/api/ocr/kk",
                    body={"attachment": {"filename": "bukan-gambar.jpg", "content_base64": "bm90YW5pbWFnZQ=="},
                          "consent": True})
    st_ocr.append(st)
    time.sleep(0.2)
if 429 in st_ocr:
    check("rate limit /api/ocr/kk aktif (3/min -> ada 429)", True, f"status={st_ocr}")
else:
    info("rate limit /api/ocr/kk", f"tidak ada 429 dalam 6 permintaan, status={st_ocr}")
    check("rate limit /api/ocr/kk aktif (3/min -> ada 429)", False, f"status={st_ocr}")

# ══════════════════════════════════════════════════════════ laporan
ok = sum(1 for r in results if r[0])
fail = [r for r in results if not r[0]]
for passed, name, detail in results:
    print(("  ok   " if passed else "  FAIL ") + name + (f"   [{detail}]" if detail and not passed else ""))
for line in INFO:
    print("  INFO " + line)
print(f"\n{ok}/{len(results)} lulus, {len(fail)} gagal   base={BASE}")
sys.exit(1 if fail else 0)