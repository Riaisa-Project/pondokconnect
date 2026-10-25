# PondokConnect

Portal informasi pesantren Lamongan dengan direktori bersumber, pencarian dan filter kecamatan, peta interaktif Three.js/Leaflet, profil, simpan/bandingkan pesantren, pendaftaran santri, konsultasi, pelaporan, dan dashboard pengurus serta Satgas.

Pengawasan membedakan **status dokumen** dan **status operasional**, disertai sumber dan tanggal pemeriksaan. Aplikasi tidak menerbitkan IJOP. Profil bersumber tidak otomatis berarti legalitas atau operasionalnya telah dikonfirmasi.

Backend: Python 3.12, FastAPI, SQLAlchemy, MySQL 8.4/TiDB, Alembic. Frontend: React, Vite, Tailwind CSS, Three.js, Leaflet. OCR Groq opsional memakai persetujuan pengguna dan pemeriksaan hasil sebelum diterapkan ke formulir.

## Jalankan lokal

Prasyarat: Python 3.12, Node.js 22, Docker Compose, dan browser Chromium untuk tes browser.

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements-dev.txt
python3 scripts/init_env.py
docker compose up -d db
```

Tunggu database berstatus healthy pada `docker compose ps`, kemudian:

```bash
.venv/bin/alembic upgrade head
.venv/bin/python -m backend.seeds --demo
.venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload --no-access-log
```

Di terminal kedua:

```bash
cd frontend
npm ci
npm run dev
```

Buka http://127.0.0.1:5173. Dokumentasi API: http://127.0.0.1:8000/docs. Health check: http://127.0.0.1:8000/health.

`init_env.py` membuat `.env` dengan kredensial acak tanpa menimpa file yang sudah ada. Port MySQL lokal default 3307. Jika port API berubah, jalankan Vite dengan `API_PROXY_TARGET=http://127.0.0.1:PORT npm run dev`.

### Akun demo lokal

Hanya untuk seed demo baru: Satgas `satgas@kemenag.go.id` / `satgas123`; pengurus `admin@sunandrajat.id` / `admin123`. Nilai ini adalah fixture pengujian, bukan kredensial produksi. Seed demo ditolak pada mode production. Katalog demo memuat 34 profil, termasuk satu profil simulasi yang alamat nyatanya belum dikonfirmasi. Instalasi produksi hanya memasukkan 33 profil bersumber.

Untuk akun terpisah bagi setiap pengurus pada database pengembangan, lakukan bootstrap dengan ekspor privat setelah migrasi:

```bash
.venv/bin/python -m backend.bootstrap --help
```

Pada produksi, startup membuat akun pengurus masing-masing pesantren serta akun Satgas secara otomatis. Password acak hanya disimpan ke file privat; login pertama mewajibkan perubahan password. Gunakan kredensial deployment sendiri, bukan akun demo atau daftar akun dari instalasi lain.

## Deploy Render + TiDB Cloud

Ikuti [panduan deployment](docs/DEPLOYMENT.md). `render.yaml` menjalankan backend dan frontend pada satu origin dengan disk persisten. Connection string TiDB dan kunci Groq diisi melalui **Environment Render**, bukan GitHub atau source. Template tersedia pada `.env.production.example`.

```text
DATABASE_BACKEND=tidb
TIDB_DATABASE_URL=mysql+pymysql://USERNAME:URL_ENCODED_PASSWORD@HOST.tidbcloud.com:4000/pondokconnect?charset=utf8mb4
```

Gunakan database aplikasi `pondokconnect`, bukan database sistem `sys`. TLS memverifikasi sertifikat dan hostname. Aplikasi menerima awalan `mysql://` maupun `mysql+pymysql://`.

Migrasi dijalankan saat startup sebelum bootstrap. Migrasi terbaru: `a3c7d9e1b642`. `database/schema.sql` adalah snapshot struktur untuk inspeksi; **gunakan Alembic untuk membuat atau memperbarui database**. Jangan mengimpor snapshot tersebut ke database yang berisi data.

## Pengujian

```bash
.venv/bin/pytest -q
.venv/bin/ruff check backend scripts
.venv/bin/ruff format --check backend scripts
.venv/bin/python scripts/test_mysql.py
cd frontend
npm run test:unit
npm run format:check
npm run build
REFERENCE_CATALOG_FIXTURE=1 npm test
```

Suite default memakai SQLite sementara. Script MySQL memakai database `pondokconnect_test`; tes browser memakai `pondokconnect_frontend_test` dan port QA 8001/5174. Keduanya direset untuk pengujian. Jangan gunakan database aplikasi sebagai database test. Chromium lokal default `/usr/bin/chromium`, dapat diubah melalui `CHROMIUM_PATH`.

## Isi repository

- `backend/`: API, autentikasi, role/ownership, OCR, bootstrap, migrasi, data publik dan tes.
- `frontend/`: tampilan, komponen peta, formulir, dashboard, aset dan tes.
- `database/schema.sql`: struktur tanpa isi database.
- `scripts/`: penyiapan lokal, startup Render dan alat pengujian.
- `docs/API.md`, `docs/DEPLOYMENT.md`: kontrak API dan petunjuk operasi.
- Docker, Compose, Render, Alembic, template environment dan konfigurasi pemeriksaan.

Berkas penelitian/paper, daftar akun, `.env`, unggahan KK/bukti kasus, data pendaftar/pelapor, dump database, dependencies terinstal dan hasil build tidak termasuk repository. Data awal publik merupakan katalog rujukan, bukan verifikasi kondisi terkini setiap lembaga. Ilustrasi arsitektur pada kartu bukan foto dokumentasi pesantren.
