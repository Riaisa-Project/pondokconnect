#!/usr/bin/env python3
"""
Aktivasi PSB ponpes 1 (al-aman-payaman) di PRODUKSI — jalur API, bukan SQL,
kecuali satu flag gerbang (must_change_password) yang memang harus dibuka.

Alur:
  0. snapshot state ponpes 1 SEBELUM
  1. buka gerbang: must_change_password=0 utk admin01 (reversibel)
  2. login admin01 -> token
  3. PUT /api/admin/ponpes/my/layanan  {pendaftaran_dibuka:true, konsultasi_dibuka:false}
  4. PUT /api/admin/ponpes/my         {kuota_putra:50, kuota_putri:50}
  5. POST /api/admin/gelombang        gelombang 1 aktif
  6. verifikasi PUBLIK (gelombang + detail ponpes)
  7. snapshot SESUDAH + diff

Tidak ada password/token yang dicetak.
"""
import json, subprocess, sys, urllib.request, urllib.error
from datetime import date, timedelta

BASE = "http://127.0.0.1:8000"
PUB = "https://pondokconnect.riaisa.tech"
ADMIN_EMAIL = "admin01@pondokconnect.id"
QUOTA = 50
BIAYA = "250000"
NAMA_GELOMBANG = "Gelombang 1 Tahun 2026/2027"

def sh(c): return subprocess.run(c, shell=True, capture_output=True, text=True)

def q(sql):
    r = sh(f'''sudo -n docker exec -i pondokconnect-db-1 sh -c 'mysql -N -B -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" 2>/dev/null' <<'SQL'
{sql}
SQL''')
    return r.stdout.strip()

def snap():
    return q("""
SELECT CONCAT('ponpes1|', id,'|',slug,'|',pendaftaran_dibuka,'|',konsultasi_dibuka,'|',kuota_putra,'|',kuota_putri,'|',nama_pengasuh,'|',tipe_pesantren,'|',kontak_sekretariat) FROM ponpes WHERE id=1;
SELECT CONCAT('gelombang|', COUNT(*)) FROM gelombang_psb WHERE ponpes_id=1;
SELECT CONCAT('pendaftaran|', COUNT(*)) FROM pendaftaran_santri WHERE ponpes_id=1;
SELECT CONCAT('users|', COUNT(*)) FROM users;
SELECT CONCAT('audit|', COUNT(*)) FROM audit_logs;
""")

def call(method, path, body=None, token=None, base=BASE):
    h = {"Content-Type": "application/json"}
    if token: h["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
    except Exception as e:
        return 0, f"{type(e).__name__}: {e}"

def show(label, st, body, hide=()):
    b = body
    for h in hide:
        b = b.replace(h, "[REDACTED]")
    print(f"  {label}: {st} | {b[:200]}")

BEFORE = snap()
print("=== SEBELUM ===")
print(BEFORE)

# --- 1. buka gerbang password (reversibel) ---
print("\n=== 1. buka gerbang must_change_password admin01 ===")
print("  before:", q("SELECT CONCAT('must_change_password=', must_change_password) FROM users WHERE id=1;"))
sh('''sudo -n docker exec -i pondokconnect-db-1 sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" 2>/dev/null' <<'SQL'
UPDATE users SET must_change_password=0 WHERE id=1;
SQL''')
print("  after :", q("SELECT CONCAT('must_change_password=', must_change_password) FROM users WHERE id=1;"))

# --- 2. login ---
print("\n=== 2. login admin01 ===")
LINE = sh('''sudo -n docker exec pondokconnect-api-1 grep -m1 '^admin01@pondokconnect.id' /app/storage/private/akun-produksi.txt''').stdout.strip()
if not LINE:
    print("  GAGAL: baris kredensial tidak ditemukan"); sys.exit(1)
email, pw = [x.strip() for x in LINE.split(" - ", 1)]
st, body = call("POST", "/api/admin/login", {"email": email, "password": pw})
print(f"  login: {st} | must_change_password={json.loads(body).get('must_change_password') if st==200 else body[:120]}")
if st != 200:
    print("  GAGAL login"); sys.exit(1)
token = json.loads(body)["access_token"]

# --- 3. buka layanan ---
print("\n=== 3. buka layanan pendaftaran ===")
show("PUT /admin/ponpes/my/layanan", *call("PUT", "/api/admin/ponpes/my/layanan",
     {"pendaftaran_dibuka": True, "konsultasi_dibuka": False}, token))

# --- 4. set kuota ---
print("\n=== 4. set kuota ===")
show("PUT /admin/ponpes/my", *call("PUT", "/api/admin/ponpes/my",
     {"kuota_putra": QUOTA, "kuota_putri": QUOTA}, token))

# --- 5. buat gelombang ---
print("\n=== 5. buat gelombang ===")
today = date.today()
payload = {
    "ponpes_id": 1, "nama": NAMA_GELOMBANG,
    "tanggal_buka": today.isoformat(),
    "tanggal_tutup": (today + timedelta(days=68)).isoformat(),
    "biaya_pendaftaran": BIAYA,
    "kuota_putra": QUOTA, "kuota_putri": QUOTA,
    "jalur": ["reguler"], "jenjang": ["MA"], "aktif": True,
}
print("  payload:", json.dumps(payload))
show("POST /admin/gelombang", *call("POST", "/api/admin/gelombang", payload, token))

# --- 6. verifikasi publik ---
print("\n=== 6. verifikasi PUBLIK ===")
st, b = call("GET", "/api/gelombang?ponpes_id=1&terbuka=true")
print(f"  gelombang terbuka (lokal): {st} | {b[:220]}")
st2, b2 = call("GET", "/api/gelombang?ponpes_id=1&terbuka=true", base=PUB)
print(f"  gelombang terbuka (PUBLIK): {st2} | {b2[:220]}")
st3, b3 = call("GET", "/api/ponpes/al-aman-payaman")
if st3 == 200:
    d = json.loads(b3)
    print(f"  detail ponpes (publik): {st3} | pendaftaran_dibuka={d['pendaftaran_dibuka']} "
          f"pendaftaran_tersedia={d['pendaftaran_tersedia']} kuota={d['kuota_putra']}/{d['kuota_putri']} "
          f"sisa={d['sisa_kuota_putra']}/{d['sisa_kuota_putri']}")
else:
    print(f"  detail ponpes (publik): {st3} | {b3[:200]}")

# --- 7. snapshot sesudah + diff ---
print("\n=== 7. SESUDAH ===")
AFTER = snap()
print(AFTER)
print("\n=== DIFF SEBELUM -> SESUDAH ===")
bl, al = BEFORE.splitlines(), AFTER.splitlines()
for i in range(max(len(bl), len(al))):
    x = bl[i] if i < len(bl) else "(tidak ada)"
    y = al[i] if i < len(al) else "(tidak ada)"
    mark = "  =  " if x == y else "  UBAH"
    print(f"{mark} {x}")
    if x != y:
        print(f"      -> {y}")

print("\n=== SELESAI ===")