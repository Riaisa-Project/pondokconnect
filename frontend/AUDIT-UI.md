| file:baris | masalah | angka sekarang | angka yang disarankan |
|---|---|---|---|
| src/pages/Registration.jsx:104–109 | Judul promosi dan pengantar panjang untuk formulir | Judul + 2 kalimat | “Daftar santri” + “Isi data calon santri dan wali.” |
| src/pages/Registration.jsx:168 | Nomor palsu sebagai placeholder dapat disangka isian | 12 digit contoh | 0 digit contoh. Label “Nomor HP wali” sudah tersedia. |
| src/pages/Registration.jsx:174 | Petunjuk unggah panjang | 3 kalimat | 2 kalimat. “PDF, PNG, atau JPEG, maksimal 5 MiB. Berkas hanya bisa dilihat pengurus pesantren tujuan.” |
| src/index.css:115–119,1520–1527 | Kotak persetujuan dan teks kecil. Label terhubung, tanpa tinggi minimum. | Kotak 17 × 17 px, teks 12 px | Tinggi area klik label ≥44 px, teks ≥14 px |
| src/index.css:1585–1595 | Petunjuk di samping formulir kecil | 12 px | ≥14 px |
| src/index.css:1663–1667 | Tombol salin nomor registrasi kecil | Teks 10 px, tinggi minimum 34 px | Teks ≥14 px, tinggi minimum 44 px |
| src/index.css:121–133 | Pemilih berkas KK dan lampiran kecil | Teks 12 px, padding vertikal tombol 8 px per sisi, tanpa tinggi minimum | Teks ≥14 px, tinggi tombol ≥44 px |
| src/styles/showcase.css:29–35,52–54,69–70 | Label atas judul, tombol utama, catatan, dan petunjuk formulir di bawah ambang | 12 / 13 / 12 / 13,5 px | ≥14 px masing-masing |
| src/pages/Tracking.jsx:93–97 | Judul promosi dan petunjuk yang belum mencakup pendaftaran melalui PSB | Judul + 10 kata petunjuk | “Lacak status” + “Gunakan nomor registrasi atau kode tiket.” |
| src/pages/Tracking.jsx:164–169 | Placeholder registrasi tampak seperti templat sistem | 27 karakter kode contoh | 0 karakter kode contoh. “Masukkan nomor registrasi”. |
| src/pages/Tracking.jsx:310–317,337–339 | Petunjuk tahap laporan dan catatan indikator berulang | 2 kalimat per status pada baris tersebut + 1 catatan umum | 1 kalimat per status. Misalnya “Simpan kode tiket untuk melacak laporan.” Catatan “Tahap saat ini”. |
| src/index.css:1837–1838,3341–3347 | Tab pelacakan kecil, terutama di ponsel | Teks 12 px, ponsel 10 px. Tinggi ponsel sekitar 43 px untuk 1 baris. | Teks ≥14 px, tinggi minimum 44 px |
| src/index.css:1868–1894 · src/styles/showcase.css:1698–1705 | Lencana, tahapan, rincian, dan petunjuk hasil pelacakan sulit dipindai | 10–12 px | ≥14 px |
| src/pages/Tracking.jsx:192 · src/pages/PonpesDetail.jsx:77,230 | Tanggal daftar dan pemeriksaan memakai bulan tertulis melalui formatter id-ID | 7 Desember 2026 (src/lib/format.js:48–52) | 07/12/2026 (dd/mm/yyyy) |
| src/pages/Report.jsx:159–165 | Urutan tanggal pada pemilih bawaan mengikuti lokal browser | Bisa mm/dd/yyyy di lokal AS. Nilai yang dikirim yyyy-mm-dd. | Tampilan dd/mm/yyyy konsisten. Nilai yang dikirim yyyy-mm-dd. |
| src/pages/Report.jsx:168–174 | Placeholder “Contoh: area asrama” memberi kesan demo | 3 kata contoh | 0 kata contoh. Gunakan label “Lokasi kejadian”. |
| src/pages/Directory.jsx:57–62,163–165 | Judul dan petunjuk filter menyampaikan hal sederhana secara panjang | Judul 6 kata, petunjuk filter 13 kata | “Direktori pesantren”. “Sebagian profil belum memiliki tipe.” |
| src/pages/Directory.jsx:237–242 | Catatan bawah menumpuk sumber, pengawasan, layanan, dan simpanan | 4 kalimat + 1 kalimat saat demo | Maks. 2 kalimat di produksi. “Cek sumber dan status pengawasan di profil. Simpanan tersimpan di browser ini.” |
| src/index.css:1129–1134 · src/pages/Directory.jsx:143–159 | Tombol kartu dan peta terlalu kecil | Ikon 19 px + padding 9 px per sisi, sekitar 37 × 37 px | ≥44 × 44 px |
| src/index.css:1154–1172 · src/styles/showcase.css:958–960 | Hapus filter tanpa padding, tombol halaman sempit, teks hasil kecil | Teks 12 px. Tinggi minimum tombol halaman 36 px. | Teks ≥14 px, tinggi tombol ≥44 px, lebar tombol halaman ≥44 px |
| src/styles/showcase.css:918,928,935–942,2325–2336 | Tab, hitungan simpanan, label dan pemilih urutan atau layanan kecil | Teks 12–13 px. Pemilih sekitar 38 px, ponsel 34 px. | Teks ≥14 px, tinggi pemilih ≥44 px |
| src/styles/showcase.css:951–956,2342–2348 | Filter direktori kecil dan teks pencarian mengecil di ponsel | Filter 12 px, tinggi ponsel sekitar 40 px. Pencarian 14 px, ponsel 12 px. | Filter ≥14 px dan tinggi ≥44 px. Pencarian ≥14 px. |
| src/styles/showcase.css:774–785,792–803,2211–2218 | Metadata, lokasi, kuota, dan catatan kartu direktori kecil | 10–12 px | ≥14 px |
| src/styles/showcase.css:811–819,835–838,2354–2356 | Aksi Simpan dan Bandingkan kecil pada kartu dan profil | Teks 12 px. Ikon Simpan pada kartu sekitar 34 × 34 px. | Teks ≥14 px, target ≥44 × 44 px |
| src/styles/showcase.css:877–881,2373–2377 | Tombol baki perbandingan kecil | Teks 11 px, ponsel 9 px. Tinggi minimum 42 px, ponsel 35 px. | Teks ≥14 px, tinggi minimum 44 px |
| src/pages/PonpesDetail.jsx:211–213,254–256 | Judul pengantar berulang, keterangan peta bertele-tele | 2 judul pengantar, 15 kata keterangan peta | 1 judul “Tentang pesantren”. “Alamat sesuai sumber tertulis. Titik peta belum diverifikasi.” |
| src/styles/profile.css:15,42,84,217,365,442–444,491,504 | Teks navigasi, rujukan dan ringkasan profil kecil. Tombol bandingkan pendek. | Teks 12–13 px, tinggi minimum tombol 38 px | Teks ≥14 px, tinggi tombol dan tautan navigasi bagian ≥44 px |
| src/styles/showcase.css:3072–3078,3097–3099,3110–3126 | Metadata alamat dan tautan petunjuk arah kecil | Teks 10–12 px, tinggi tautan sekitar 34–36 px | Teks ≥14 px, tinggi tautan ≥44 px |
| src/pages/Home.jsx:81–90,127–130 | Judul dan slogan mengaburkan tindakan utama | Judul 3 baris, deskripsi 2 kalimat, 1 slogan tambahan | 1 judul “Cari pesantren di Lamongan”, 1 kalimat “Bandingkan pilihan, daftar, atau hubungi pengurus.”, 0 slogan tambahan |
| src/pages/Home.jsx:36–37,196–199,345–354 | FAQ sumber data dan pengantar bagian memakai frasa promosi dan penjelasan panjang | 3 kalimat pada jawaban FAQ, masing-masing 1 pengantar layanan dan FAQ | 2 kalimat sumber data. “Nama dan alamat merujuk sumber lembaga atau pemerintah. Catatan pengawasan memuat status, sumber, dan tanggal pemeriksaan.” Judul bagian “Layanan santri” dan “Pertanyaan umum”, 0 pengantar promosi. |
| src/styles/home.css:125–149,212–224,354–355,494–495 | Label statistik, kartu layanan, catatan direktori dan tautan pelacakan kecil | 12–13 px | ≥14 px |
| src/styles/showcase.css:2191–2195 | Tombol buka direktori dari beranda pendek di ponsel | Teks 12 px, tinggi minimum 43 px | Teks ≥14 px, tinggi minimum 44 px |
| src/styles/showcase.css:503–509,553–557,3526–3530 | Baris pemilih kecamatan dan zoom peta kecil di desktop | Baris 12 px, tinggi minimum 30 px. Zoom 30 × 30 px desktop, 44 × 44 px ponsel. | Teks ≥14 px, tinggi baris ≥44 px, zoom ≥44 × 44 px |
| src/styles/home.css:369–385,547–553 · src/styles/showcase.css:3475–3478 | Tab dan tombol penjelajah beranda kecil | Tab 12 px, tab peta ponsel minimum 44 px. Tombol 3D 36 × 36 px, varian kecil 32 × 32 px. Pemilih kampus minimum 32 px. | Teks ≥14 px, tinggi dan lebar tombol ikon ≥44 px, tinggi tab dan pemilih ≥44 px |
| src/styles/showcase.css:3382–3410 | Teks navigasi dan footer publik terlalu kecil | 12–13,5 px | ≥14 px |
| src/pages/Registration.jsx:230–234 · src/pages/Directory.jsx:241 · src/pages/PonpesDetail.jsx:237–241 · src/pages/Home.jsx:173–176 | Pesan simulasi bergantung pada data atau konfigurasi demo | 4 halaman prioritas menampilkan pesan bersyarat | 0 pesan demo di data produksi, pertahankan penanda untuk data simulasi |
| src/pages/Dashboard.jsx:200 · src/pages/PonpesAdmin.jsx:237 · src/pages/KemenagAdmin.jsx:424,470,497,663 | Tanggal pada tabel dan rincian pengelola memakai formatter yang sama | 7 Desember 2026 | 07/12/2026 (dd/mm/yyyy) |
| src/styles/showcase.css:2400–2403 | Tombol aksi pada tabel bandingkan kecil di ponsel | Teks 10 px, tinggi minimum 37 px | Teks ≥14 px, tinggi minimum 44 px |
