# Uji E2E PSB di image produksi, di database KLONAN

Tujuan: membuktikan alur PSB (gelombang → pendaftaran → seleksi → daftar ulang →
pengumuman → OCR) jalan pada **image produksi**, tanpa menyentuh data asli.

Cara kerja (aman):
1. `mysqldump` produksi → file backup.
2. Snapshot ringkas produksi (ponpes, counts, max id, alembic) SEBELUM.
3. Buat database `pondokconnect_uji`, isi dari dump tadi.
4. Jalankan container api dari image produksi dengan `DATABASE_URL` diarahkan ke klon.
5. Jalankan `psb_production_clone.py` terhadap `http://127.0.0.1:8099`.
6. Snapshot produksi SESUDAH, diff dengan sebelum (harus identik).
7. Teardown: hapus container uji + drop database uji.

## Pakai

Di VPS (butuh docker + akses ke container produksi):

```bash
# 1. salin skrip ke VPS
scp scripts/e2e/psb_production_clone.py scripts/e2e/run_clone_test.sh oracle:/tmp/

# 2. jalankan (butuh kk-sintetis.png di /home/ubuntu/herdr-out/ — lihat catatan)
bash /tmp/run_clone_test.sh
```

`run_clone_test.sh` mengharapkan:
- container produksi bernama `pondokconnect-api-1` + `pondokconnect-db-1`
  (compose project `pondokconnect`), network `pondokconnect_default`;
- file gambar KK uji di `/home/ubuntu/herdr-out/kk-sintetis.png`
  (bisa diganti via env `KK_IMAGE` saat memanggil `psb_production_clone.py`);
- kredensial admin diambil dari `storage/private/akun-produksi.txt` di dalam
  container produksi — **nilainya tidak pernah dicetak**.

## Hasil terverifikasi (2026-11-24)

`23/23 langkah lulus`, `SEMUA LANGKAH LULUS`, dan snapshot produksi
`56d4a684f5cfdfaed081e87a5721e492` identik sebelum/sesudah (md5 sama).
Produksi: `ponpes1 pendaftaran_dibuka=0`, counts `34 users / 33 ponpes`,
alembic `cc33f7f07341` — tidak berubah.

## Catatan

- Skrip ini **hanya** untuk instance klon. Jangan arahkan ke produksi.
- `psb_production_clone.py` bisa dijalankan manual terhadap base URL apa pun:
  `E2E_BASE=http://127.0.0.1:8099 ADMIN_LINE="email" ADMIN_PASSWORD=... python3 psb_production_clone.py`.
- Kredensial: `ADMIN_LINE` + `ADMIN_PASSWORD` wajib di-set; skrip tidak pernah
  menulis nilainya ke output.