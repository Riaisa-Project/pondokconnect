# QA — baterai API produksi

`api_battery.py` menguji API produksi **read-only** + negative case. Tidak menulis
data apa pun (satu-satunya POST adalah `/api/admin/login`).

    python3 scripts/qa/api_battery.py [base_url]
    # default base: https://pondokconnect.riaisa.tech
    # exit 0 = semua assertion lulus

Kredensial dibaca dari `storage/private/akun-produksi-20261120.txt` (admin01).
File itu **tidak** dilacak git (`.gitignore` memakai `/*` + whitelist; `storage/`
tidak di-whitelist), jadi kredensial tidak pernah ikut commit.

## Cakupan

| Blok | Isi |
|---|---|
| Publik | `/api/ponpes/`, `/api/kecamatan/`, `/api/stats`, `/api/pendaftaran` |
| Auth | login 200 + `access_token`, `password_hash` tidak bocor, `expires_in` == `exp-iat` |
| Gerbang peran | 10 endpoint admin tanpa token -> 401; token palsu -> 401 |
| Isolasi tenant | admin ponpes -> 403 pada `/pengaduan`, `/audit-logs`, `/kemenag/ponpes` |
| Header | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Cache-Control` |
| CORS | preflight origin produksi -> ACAO echo; origin asing -> tanpa ACAO |
| 404/405 | rute tak ada -> 404, metode salah -> 405 |
| Rate limit | `POST /api/ocr/kk` 3/menit -> salah satu request kena 429 |

## Hasil run 2026-11-24 (produksi)

    88/88 lulus, 0 gagal

Catatan (INFO, bukan kegagalan):

- Listing publik `/api/ponpes/` membawa 34 kolom termasuk `nspp` dan
  `alamat_lengkap`. Keduanya data publik (NSPP = registrasi Kemenag, alamat =
  direktori), bukan data pribadi santri.
- Manifest `akun-produksi-20261120.txt` hanya memuat akun `admin*`, tidak ada
  baris `satgas@kemenag.go.id`, jadi login satgas tidak diuji di sini. Password
  awal satgas di `akun-admin-dan-satgas-*.txt` sudah kedaluwarsa (401) —
  `must_change_password=0` pada DB menunjukkan password sudah diganti di login
  pertama. Rotasi itu memang bekerja.
- `Strict-Transport-Security` tidak ada di response origin. HTTPS tetap
  dipaksa Caddy; HSTS menutup celah downgrade di sisi klien.

## Yang tidak diuji di produksi (butuh tulis)

Submit pendaftaran, kirim laporan, dan gerakkan tahapan seleksi **tidak** diuji
di produksi supaya tidak meninggalkan data uji. Semuanya sudah diuji di klon
database: `scripts/e2e/psb_production_clone.py` (23/23) dan
`frontend/tests/*.spec.js` (Playwright, 43 lulus / 7 dilewati karena butuh
fixture katalog `REFERENCE_CATALOG_FIXTURE=1`).