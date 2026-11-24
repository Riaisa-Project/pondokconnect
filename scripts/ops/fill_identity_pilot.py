#!/usr/bin/env python3
"""
Isi field identitas ponpes 1 (al-aman-payaman) di PRODUKSI — Opsi A.

Sumber:
  - NSPP 510035240158  : dokumen Kemenag "Daftar Madrasah di Pondok Pesantren
                         Lamongan" (baris 18: AL AMAN, Jl. Setitet Ringin,
                         Payaman, Solokuro, Kab. Lamongan)
  - tipe "kombinasi"   : alkhoirot.com (daftar pondok Lamongan: "Kombinasi")
  - pengasuh           : alkhoirot.com (KH Ahmad Munir Abdullah)

NSPP tidak ada di PonpesUpdate (sengaja: NSPP diberikan Kemenag, bukan diedit
oleh admin ponpes) -> diisi lewat SQL, sisanya lewat API. Tidak ada password
yang dicetak.
"""
import json, subprocess, sys, urllib.request, urllib.error

BASE = "http://127.0.0.1:8000"
PUB = "https://pondokconnect.riaisa.tech"
NSPP = "510035240158"
PENGASUH = "KH. Ahmad Munir Abdullah"
TIPE = "kombinasi"

def sh(c): return subprocess.run(c, shell=True, capture_output=True, text=True)

def q(sql):
    r = sh(f'''sudo -n docker exec -i pondokconnect-db-1 sh -c 'mysql -N -B -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" 2>/dev/null' <<'SQL'
{sql}
SQL''')
    return r.stdout.strip()

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

def show(label, st, body):
    print(f"  {label}: {st} | {body[:240]}")

def fields(tag):
    r = q("SELECT CONCAT('nspp=',IFNULL(nspp,'NULL'),'|pengasuh=',IFNULL(nama_pengasuh,'NULL'),"
          "'|tipe=',IFNULL(tipe_pesantren,'NULL'),'|kec=',kecamatan_id) FROM ponpes WHERE id=1;")
    print(f"  {tag}: {r}")

print("=== SEBELUM ===")
fields("state")
print("  audit_logs:", q("SELECT COUNT(*) FROM audit_logs;"))

# --- 1. NSPP via SQL (tidak ada di PonpesUpdate) ---
print("\n=== 1. set NSPP (SQL) ===")
sh(f'''sudo -n docker exec -i pondokconnect-db-1 sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" 2>/dev/null' <<'SQL'
UPDATE ponpes SET nspp='{NSPP}' WHERE id=1 AND (nspp IS NULL OR nspp='');
SQL''')
fields("after")

# --- 2. pengasuh + tipe via API admin ---
print("\n=== 2. login admin01 ===")
LINE = sh('''sudo -n docker exec pondokconnect-api-1 grep -m1 '^admin01@pondokconnect.id' /app/storage/private/akun-produksi.txt''').stdout.strip()
if not LINE:
    print("  GAGAL: kredensial tidak ditemukan"); sys.exit(1)
email, pw = [x.strip() for x in LINE.split(" - ", 1)]
st, body = call("POST", "/api/admin/login", {"email": email, "password": pw})
print(f"  login: {st} | must_change_password={json.loads(body).get('must_change_password') if st==200 else body[:150]}")
if st != 200:
    print("  GAGAL login"); sys.exit(1)
token = json.loads(body)["access_token"]

print("\n=== 3. PUT /admin/ponpes/my (pengasuh + tipe) ===")
show("PUT", *call("PUT", "/api/admin/ponpes/my",
     {"nama_pengasuh": PENGASUH, "tipe_pesantren": TIPE}, token))

# --- 4. verifikasi publik ---
print("\n=== 4. verifikasi PUBLIK ===")
st, b = call("GET", "/api/ponpes/al-aman-payaman", base=PUB)
d = json.loads(b) if st == 200 else {}
for k in ("nspp", "nama_pengasuh", "tipe_pesantren", "kecamatan_id"):
    print(f"  {k}: {d.get(k)!r}")
print(f"  pendaftaran_dibuka: {d.get('pendaftaran_dibuka')} | kuota {d.get('kuota_putra')}/{d.get('kuota_putri')}")

print("\n=== SESUDAH ===")
fields("state")
print("  audit_logs:", q("SELECT COUNT(*) FROM audit_logs;"))
print("\n=== SELESAI ===")