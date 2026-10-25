# Deployment PondokConnect: Render + TiDB Cloud

Repository: https://github.com/Riaisa-Project/pondokconnect

Satu layanan Docker melayani frontend React dan API FastAPI `/api` pada origin yang sama. Database berada di TiDB Cloud; unggahan privat dan kredensial awal disimpan pada disk persisten Render. Menyiapkan atau mengunggah source tidak otomatis membuat deployment cloud.

## 1. Database TiDB Cloud

Buat database aplikasi melalui SQL console:

```sql
CREATE DATABASE IF NOT EXISTS pondokconnect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Gunakan kredensial dari panel Connect TiDB. Jika ada pembatasan jaringan, izinkan koneksi dari outbound IP layanan Render. Simpan connection string berikut pada **Environment Render** dengan nama `TIDB_DATABASE_URL`:

```text
mysql+pymysql://USERNAME:URL_ENCODED_PASSWORD@HOST.tidbcloud.com:4000/pondokconnect?charset=utf8mb4
```

Username/password dengan karakter khusus harus di-URL-encode. Awalan `mysql://` juga diterima. Ganti database sistem `/sys` dengan `/pondokconnect` setelah database aplikasi dibuat. Jangan menyimpan URL asli dalam source, issue, README, `render.yaml`, atau GitHub.

TLS otomatis memverifikasi sertifikat dan hostname. Aplikasi memakai isolasi READ COMMITTED dan memeriksa mode transaksi pessimistic untuk penguncian kuota. Variabel `tidb_txn_mode` dibaca, bukan diubah oleh aplikasi. Jika preflight melaporkan CHECK constraint OFF, tinjau dan aktifkan melalui administrator TiDB sebelum migrasi pertama:

```sql
SET GLOBAL tidb_enable_check_constraint = ON;
```

Referensi: [koneksi TiDB/PyMySQL](https://docs.pingcap.com/developer/dev-guide-sample-application-python-pymysql/), [TLS TiDB Cloud](https://docs.pingcap.com/tidbcloud/secure-connections-to-serverless-clusters/), [isolasi transaksi](https://docs.pingcap.com/tidb/stable/transaction-isolation-levels/).

## 2. Buat layanan Render

Pilih **New → Blueprint**, hubungkan repository, dan gunakan `render.yaml` di root.

| Pengaturan | Konfigurasi |
|---|---|
| Runtime | Docker; `Dockerfile` root |
| Region | Singapore |
| Instance | Satu instance, paket Starter |
| Health check | `/health` |
| Disk persisten | 1 GB pada `/var/data` |
| Unggahan privat | `/var/data/uploads` |
| Kredensial awal | `/var/data/private/admin-accounts-*.csv` |

Blueprint menggunakan layanan berbayar dengan disk persisten agar dokumen bertahan setelah redeploy. Pembuatan layanan dan biaya dilakukan melalui akun Render pemilik. [Blueprint Render](https://render.com/docs/blueprint-spec), [disk persisten](https://render.com/docs/disks).

Isi secret yang diminta:

- `TIDB_DATABASE_URL`: URL database milik deployment ini.
- `GROQ_API_KEY`: kunci provider jika OCR diaktifkan. Untuk pengisian manual saja, set `OCR_ENABLED=false` dan kosongkan key.

Blueprint sudah mengatur `DATABASE_BACKEND=tidb`, `APP_ENV=production`, `DEMO_MODE=false`, `SERVE_FRONTEND=true`, dan JWT secret acak. Render menyediakan `PORT` dan `RENDER_EXTERNAL_URL`; aplikasi menggunakannya untuk origin, CORS dan tautan status. Konfigurasi bawaan memakai domain layanan Render. Jika menambahkan domain kustom, tinjau penentuan origin dan URL publik pada backend sebelum mengalihkannya.

`BOOTSTRAP_OWNER_EMAIL` default `pengelola@pondokconnect.id` adalah ID login portal. Ubah sesuai kebutuhan sebelum startup pertama. ID admin bukan klaim alamat email resmi pesantren; aplikasi tidak mengirim email otomatis.

Startup menjalankan migrasi Alembic ke `a3c7d9e1b642`, bootstrap idempoten, lalu Uvicorn. Bootstrap ada pada startup karena disk dibutuhkan saat menulis kredensial. Gunakan satu worker/instance dengan rate limiter memory. Jika kelak menambah worker, perlukan penyimpanan limiter bersama serta evaluasi ulang disk/arsitektur.

## 3. Akun awal dan data publik

Instalasi produksi baru memasukkan 27 kecamatan dan 33 profil bersumber, tanpa profil simulasi yang alamatnya belum dikonfirmasi. Profil awal berstatus dokumen dan operasional belum dikonfirmasi; kanal pendaftaran serta konsultasi tertutup sampai diatur pengurus. Nomor izin dan kuota contoh tidak disalin.

Setiap pesantren memperoleh akun admin dengan password acak. Akun Satgas dibuat dari `BOOTSTRAP_OWNER_EMAIL`. Login pertama wajib mengganti password; reset/ganti password mencabut token lama. Bootstrap ulang mempertahankan akun, password dan perubahan profil.

Di Shell Render, cari file kredensial awal:

```bash
ls -t /var/data/private/admin-accounts-*.csv
```

Ambil melalui akses Shell/SSH yang disediakan akun Render, simpan secara privat, lalu bagikan akun kepada pengurus melalui saluran pribadi. File berizin `0600`; nilainya tidak ditampilkan pada log startup dan tidak dilayani sebagai URL publik. Jangan unggah file itu ke GitHub. Kredensial instalasi lokal tidak otomatis berlaku pada database TiDB baru.

## 4. Pengawasan dan pelaporan

Petugas mencatat bukti dokumen dan pengamatan operasional secara terpisah, lengkap dengan sumber serta tanggal. Aplikasi tidak menerbitkan IJOP. Status terdaftar berdasarkan dokumen bukan jaminan legalitas menyeluruh, kualitas pendidikan atau operasi terkini. Pengurus hanya mengatur profil dan layanan pesantrennya; detail laporan serta tindak lanjut hanya untuk Satgas.

Pelacakan publik membatasi informasi pada status dan referensi. NIK, kontak, uraian kasus dan catatan internal tidak ditampilkan. KK serta bukti laporan tersimpan privat. Backup database dan disk perlu dikelola pemilik deployment; repo berisi struktur serta data awal publik, bukan salinan data operasional.

## 5. OCR Groq opsional

`GROQ_VISION_MODEL` dapat diubah sesuai model vision yang tersedia pada akun provider. Nilai bawaan pada konfigurasi adalah `qwen/qwen3.8-27b`; periksa dukungannya sebelum mengaktifkan layanan. [Dokumentasi vision Groq](https://console.groq.com/docs/vision).

OCR menerima PNG/JPEG maksimum 5 MiB dan 20 megapiksel, meminta persetujuan sebelum pengiriman, menghapus metadata, dan tidak menyimpan gambar maupun hasil OCR. Pengguna memeriksa hasil dan memilih field sebelum menerapkannya. PDF tetap tersedia sebagai lampiran pendaftaran dengan pengisian manual. Tanpa key, formulir manual tetap berfungsi. Tes otomatis OCR memakai respons provider tiruan dan tidak mengirim dokumen pribadi.

## 6. Pemeriksaan setelah deployment

Jalankan pada Shell layanan:

```bash
python -m backend.preflight
```

Periksa database tersambung, migrasi terbaru, TLS aktif, mode pessimistic, frontend terbangun, dan demo false. Jika memakai OCR, pastikan key/model sesuai serta uji dengan gambar sintetis. Jangan gunakan dokumen orang lain tanpa persetujuan.

Buka `/health`, `/`, `/pesantren`, profil pesantren, `/masuk`, `/privasi`, dan `/status-pesantren/{slug}`. Pastikan route SPA dapat dibuka langsung, aset termuat, login awal memaksa ganti password, admin hanya mengakses pesantrennya, serta file privat tidak dapat diunduh publik. Uji restart untuk memastikan berkas disk tetap ada.

Koneksi TiDB aktual, ingress Render, dan provider OCR aktual tetap memerlukan pemeriksaan pada deployment milik pengguna. Kelulusan tes lokal/MySQL/container tidak menyatakan ketiga layanan cloud sudah diuji.

## 7. Pengecualian repository

`.gitignore` membatasi isi repository pada frontend/backend, skema/migrasi, data publik, tes dan konfigurasi web. `.dockerignore` membatasi konteks build pada input runtime. `.env`, storage, daftar akun, database dump, paper, validasi penelitian, screenshot pengujian, node_modules dan virtual environment tidak diunggah.

Jika secret pernah dibagikan di chat atau tempat publik, ganti melalui provider lalu simpan nilai baru pada Environment Render. Tidak perlu menaruh token GitHub atau key database pada kode frontend.
