# scripts/ops — operasi produksi (hanya yang butuh perubahan data)

## `activate_psb_pilot.py`
Mengaktifkan PSB untuk **1 ponpes pilot** di produksi. Idempoten-ish: aman
di-rerun (gelombang kedua akan dibuat kalau dijalankan 2x — awas).

```bash
scp scripts/ops/activate_psb_pilot.py oracle:/tmp/
ssh oracle 'python3 /tmp/activate_psb_pilot.py'
```

Yang dilakukan:
1. snapshot state ponpes 1 sebelum
2. `UPDATE users SET must_change_password=0 WHERE id=1` (gerbang onboarding)
3. login `admin01` (kredensial dari `/app/storage/private/akun-produksi.txt`)
4. buka layanan pendaftaran lewat API
5. set kuota lewat API
6. buat gelombang lewat API
7. verifikasi publik + snapshot sesudah

**Jalankan backup DB dulu:**
```bash
ssh oracle 'TS=$(date +%Y%m%d-%H%M%S); sudo -n docker exec pondokconnect-db-1 \
  sh -c '\''mysqldump -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"'\'' \
  2>/dev/null | gzip > /home/ubuntu/backups/pre-$TS.sql.gz'
```

Catatan: tidak ada endpoint DELETE di backend, jadi aktivasi harus lewat API
supaya tercatat di `audit_logs`. Jangan mengubah `pendaftaran_dibuka` lewat SQL —
audit trail-nya hilang.

## `fill_identity_pilot.py`
Mengisi field identitas ponpes 1 (`al-aman-payaman`) yang kosong di produksi:
`nspp`, `nama_pengasuh`, `tipe_pesantren`.

```bash
scp scripts/ops/fill_identity_pilot.py oracle:/tmp/
ssh oracle 'python3 /tmp/fill_identity_pilot.py'
```

Sumber data (semua eksternal, bukan karangan):
- `nspp=510035240158` — dokumen Kemenag *Daftar Madrasah di Pondok Pesantren
  Lamongan* (baris 18: AL AMAN, Jl. Setitet Ringin, Payaman, Solokuro).
- `nama_pengasuh` + `tipe_pesantren=kombinasi` — alkhoirot.com (daftar pondok Lamongan).

Kenapa SQL untuk NSPP: `nspp` **sengaja tidak ada** di `PonpesUpdate` — NSPP
diberikan Kemenag, bukan diedit admin ponpes. Jadi diisi lewat SQL, sedangkan
pengasuh/tipe lewat `PUT /api/admin/ponpes/my` supaya tercatat di `audit_logs`.

Catatan: `PonpesDetail.jsx` menampilkan "NOMOR STATISTIK" untuk nilai `nspp`.
Label itu memang dipakai untuk NSPP di UI saat ini.
