# Kontrak API Pondok Connect — pengawasan dan pelaporan

Backend lokal default `http://127.0.0.1:8000`; frontend `http://127.0.0.1:5173` meneruskan `/api` ke backend. Produksi menggunakan satu origin. Semua endpoint juga tersedia langsung tanpa prefix `/api`. Semua POST/PUT memakai JSON, validasi menolak field asing dan tidak mengulang input sensitif dalam error. Daftar memakai `items`, `total`, `limit` (1–100), `offset`. Token lewat `Authorization: Bearer <token>`.

## Autentikasi

- `POST /admin/login`: `email`, `password`; menghasilkan token 60 menit dan `must_change_password`.
- `GET /admin/me`: profil akun tanpa hash/password.
- `POST /admin/change-password`: `old_password`, `new_password`, `confirm_password`; minimal 10 karakter, maksimal 72 byte. Perubahan/reset mencabut token lama.
- Selama password awal belum diganti, akses modul administrasi ditolak. Akun memakai email pengurus atau ID portal seperti `admin05@pondokconnect.id`; ID tersebut bukan pernyataan kontak resmi pesantren.
- `GET /system/features`: `demo`, `demo_accounts_available`, `ocr_available`, `provider`; tanpa secret.

## Direktori dan cek status publik

| Metode | Endpoint | Fungsi |
|---|---|---|
| GET | `/health` | Kesehatan API/database |
| GET | `/kecamatan/` | Pilihan kecamatan |
| GET | `/ponpes/` | Semua profil; filter `q`, `kecamatan_id`, `tipe`, `layanan=aktif`, `slugs`, `sort`, pagination |
| GET | `/ponpes/{slug}` | Profil, sumber profil/lokasi, pengawasan dan layanan |
| GET | `/ponpes/status/{slug}` | Catatan status dokumen/operasional, termasuk layanan tutup |
| GET | `/stats/ringkasan` | Agregat publik per kecamatan, tanpa data pengaduan |

Semua profil dapat ditemukan, termasuk yang belum dikonfirmasi. Filter layanan berarti ada kanal pendaftaran/konsultasi yang dibuka dan operasional tidak tercatat tutup. Status layanan tidak menyatakan izin resmi. UI penerimaan juga memeriksa sisa kuota per jenis kelamin.

`PonpesOut` menambahkan `pengawasan`, `pendaftaran_dibuka`, `konsultasi_dibuka`, `pendaftaran_tersedia`, `konsultasi_tersedia`. `layanan_tersedia` berarti setidaknya satu kanal tersedia. `pendaftaran_tersedia` menandai kanal dibuka, bukan jaminan tersedianya kursi bagi setiap kategori santri. Kuota publik bernilai null saat pendaftaran ditutup; respons profil admin sendiri tetap memberikan angka untuk editor.

`profil_referensi` mempertahankan provenance. Membuka layanan tidak menghapus sumber alamat/profil. `lokasi`, `referensi`, `profil_publik`, koordinat dan tahun sumber tetap mengikuti kecocokan data dengan snapshot katalog. Sumber alamat tidak membuktikan status pendaftaran atau operasional terkini.

Objek pengawasan awal seluruh profil berstatus `belum_dikonfirmasi` dan metadata null. Data IJOP contoh lama tidak dipromosikan menjadi fakta baru. `status_ijop`, `no_sk_ijop`, `tanggal_ijop_mulai`, `tanggal_ijop_selesai` diredaksi menjadi null dalam respons; nilai historisnya tetap tersimpan. `verifikasi_url` menunjuk `/status-pesantren/{slug}`. GET lama `/ponpes/verifikasi-ijop/{nspp}` masih tersedia sebagai alias baca catatan status, bukan pengesahan izin.

## Satgas/petugas pengawas

| Metode | Endpoint | Fungsi |
|---|---|---|
| GET | `/admin/dashboard` | Ringkasan pengawasan dan pengaduan |
| GET | `/admin/kemenag/ponpes` | Seluruh profil, pencarian `q` nama/NSPP/slug sebelum pagination |
| GET | `/admin/kemenag/ponpes/{id}` | Detail profil administrasi |
| POST | `/admin/kemenag/ponpes` | Mencatat profil dan membuat akun pengurus; bukan menerbitkan izin |
| PUT | `/admin/kemenag/ponpes/{id}/pengawasan` | Mencatat pemeriksaan berdasarkan sumber |
| POST | `/admin/kemenag/reset-password-ponpes/{id}` | Password awal baru; payload `alasan` |
| GET | `/admin/audit-logs` | Jejak aktivitas tanpa password/isi kasus |

Pembuatan profil menerima `kecamatan_id`, `nama_ponpes`, `alamat_lengkap`, `email_admin`, `nama_admin`, `no_hp_admin`. NSPP, pengasuh, tipe, kontak dan koordinat boleh belum diketahui. Kuota default 0; layanan default tutup. Tidak menerima field IJOP. Respons berisi `ponpes`, `email_admin`, `temporary_password`, `must_change_password:true`. Password baru hanya ditampilkan pada pembuatan/reset dan tidak bisa dibaca kembali dari API.

Contoh catatan pengawasan (seluruh teks contoh, bukan fakta pesantren nyata):

```json
{
  "status_dokumen": "terdaftar",
  "nomor_statistik": "NOMOR-SESUAI-DOKUMEN",
  "nomor_dokumen": "REFERENSI-DOKUMEN",
  "penerbit_dokumen": "Penerbit yang tercantum pada dokumen",
  "tanggal_dokumen": "2026-01-01",
  "sumber_dokumen": "Arsip dokumen yang diperiksa petugas",
  "tanggal_pemeriksaan_dokumen": "2026-10-23",
  "catatan_dokumen": "Catatan publik berdasarkan pemeriksaan dokumen.",
  "status_operasional": "beroperasi",
  "sumber_operasional": "Berita acara kunjungan lapangan",
  "tanggal_pemeriksaan_operasional": "2026-10-23",
  "catatan_operasional": "Catatan publik sesuai pengamatan petugas."
}
```

Status dokumen: `belum_dikonfirmasi`, `terdaftar`. Status operasional: `belum_dikonfirmasi`, `beroperasi`, `tidak_beroperasi`. Status terdaftar membutuhkan seluruh identitas dokumen, sumber dan tanggal pemeriksaan; operasional terkonfirmasi membutuhkan sumber, tanggal pemeriksaan dan catatan publik. Sumber dan tanggal harus berpasangan, termasuk untuk status belum dikonfirmasi. Sumber berupa URL HTTP/HTTPS valid atau referensi arsip tertulis; URI berbahaya ditolak. Tanggal masa depan dan dokumen yang lebih baru dari pemeriksaannya ditolak.

PUT pengawasan mengganti kedua kelompok data secara lengkap; field opsional yang tidak dikirim menjadi null. `updated_at` hanya output. Isi sumber/catatan di sini bersifat publik; identitas pelapor, isi kasus dan catatan internal tidak boleh dipindahkan ke status publik. Pembaruan tersimpan atomik dan diaudit. Tidak menerbitkan/mencabut/mengubah dokumen pihak berwenang.

Dashboard Satgas mengembalikan `metrics.ponpes_total`, `pengaduan_total`, `pengaduan_terbuka`, `pengawasan_belum_dikonfirmasi`; distribusi `pengaduan`, `status_dokumen`, `status_operasional`. Tidak memberikan status izin aktif/kedaluwarsa buatan. Dashboard admin ponpes tetap memiliki agregat seleksi/unread dan profilnya sendiri, tanpa data pengaduan.

Endpoint mutasi lama `PUT /admin/kemenag/ponpes/{id}/ijop` dan `POST /admin/kemenag/ponpes/{id}/aktifkan-layanan` mengembalikan **410** setelah pemeriksaan peran/password. Tanpa login 401; admin ponpes 403. Berlaku juga pada prefix `/api`; tombolnya telah dihapus dari alur pengguna.

## Pelaporan dan tindak lanjut

Publik `POST /pengaduan/kirim` menerima `ponpes_id`, `kategori_kasus`, `tanggal_kejadian`, `lokasi_kejadian`, `deskripsi_peristiwa`, `mode_pelapor`, serta lampiran opsional `bukti_lampiran`. Mode `terbuka` memerlukan nama/kontak; mode `rahasia` menghapus kedua field terstruktur tersebut meskipun dikirim. Isi bebas/berkas tidak dipindai untuk menghapus identitas secara otomatis. Laporan tetap dapat dikirim saat layanan pesantren tutup atau status belum dikonfirmasi.

Respons dan `GET /pengaduan/lacak/{kode_tiket}` hanya memuat tiket, status dan waktu. Status: `masuk_antrian`, `penyelidikan_satgas`, `pendampingan`, `proses_hukum`, `selesai`, `tidak_valid`. Laporan masuk tidak mengubah status dokumen/operasional.

Khusus Satgas:

- `GET /admin/pengaduan`: filter `status`, `ponpes_id`, `q` (nama ponpes), pagination; item memuat `nama_ponpes`, tanpa riwayat.
- `GET /admin/pengaduan/{id}`: detail kasus dan `riwayat` berisi `id`, `status_sebelum`, `status_sesudah`, `catatan_internal`, `created_at`.
- `PUT /admin/pengaduan/{id}/status`: `status_tindakan`, `catatan_internal` opsional; status, riwayat dan audit disimpan dalam satu transaksi. Respons tidak menyertakan riwayat.
- `GET /admin/pengaduan/{id}/bukti`: unduhan privat.

Admin ponpes tidak bisa membaca/mengubah laporan maupun bukti. Catatan internal dan riwayat tidak masuk respons tracking atau status publik. Audit hanya merekam ID serta transisi, tanpa teks catatan. Laporan lama tetap utuh; riwayat baru dicatat mulai perubahan ini.

## Layanan admin ponpes

- `GET/PUT /admin/ponpes/my`: profil/kuota milik sendiri; PUT parsial, tanpa null eksplisit.
- `PUT /admin/ponpes/my/layanan`: `{ "pendaftaran_dibuka": true, "konsultasi_dibuka": false }`; admin pemilik saja. Tidak mengubah pengawasan atau provenance.
- `GET /admin/pendaftaran`, `PUT /admin/pendaftaran/{id}/status`, `GET /admin/pendaftaran/{id}/berkas`: seleksi/KK hanya untuk ponpes sendiri.
- `GET /admin/chat`, `POST /admin/chat/reply`, `PUT /admin/chat/read`: konsultasi milik sendiri.

Publik `POST /pendaftaran/kirim` menerima identitas santri/wali dan KK opsional. NIK 16 digit unik per ponpes, kuota per gender dihitung dengan lock/transaksi; 409 jika penuh atau layanan belum dibuka. `GET /pendaftaran/lacak/{nomor}` dan `/pendaftaran/kartu/{nomor}` memberikan status/PDF bukti, tanpa NIK/kontak. Riwayat tetap tersedia ketika penerimaan ditutup.

Publik `POST /chat/kirim` memerlukan layanan konsultasi dibuka. Sesi baru menghasilkan `session_id` acak; kiriman lanjutan memakai identitas awal. `GET /chat/{ponpes_id}/{session_id}` membaca riwayat dengan `after_id`/`limit`. Layanan ditutup menghentikan kiriman baru; sesi yang sedang terbuka di browser tetap bisa membaca riwayat. Polling REST, bukan WebSocket.

Operasional yang dicatat tidak beroperasi menutup pengajuan baru untuk kedua kanal. Sakelar dan kuota tidak mengklaim adanya izin terbitan aplikasi. Mengubah kuota di bawah pendaftar aktif menghasilkan 409; akses record ponpes lain 404.

## Lampiran, OCR dan produksi

Lampiran JSON `{ "filename": "dokumen.pdf", "content_base64": "BASE64_TANPA_PREFIX" }`; maksimum 5 MiB PDF/PNG/JPEG, signature diperiksa. Bukan URL/path, tidak ada static storage publik. Body maksimum 8 MiB. Berkas KK hanya admin pemilik; bukti laporan hanya Satgas.

`POST /ocr/kk`: `{ "attachment": {...}, "consent": true }`, PNG/JPEG maksimum 5 MiB/20 MP, metadata dihapus, tiga permintaan/menit. Hasil hanya nama/NIK/gender dan kepala keluarga; tidak disimpan, wajib diperiksa pengguna. PDF/manual tetap didukung. Key hanya backend. Error tidak mengulang dokumen/key/respons mentah provider.

Skema migrasi terbaru `a3c7d9e1b642`: dua sakelar di ponpes, tabel `pengawasan_pesantren` dan `pengaduan_perkembangan`. Migrasi mempertahankan data/akun; tidak mengubah izin contoh menjadi pengawasan terkonfirmasi. Downgrade yang menghapus catatan baru atau pengaturan layanan yang telah diubah ditolak. Instalasi/deploy/TiDB/TLS dijelaskan di [DEPLOYMENT.md](DEPLOYMENT.md).
