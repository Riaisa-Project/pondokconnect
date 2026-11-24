-- Tipe + pengasuh untuk 3 ponpes yang cocok PERSIS dengan alkhoirot.com
-- (nama + desa/kecamatan sama). Sumber: alkhoirot.com "Daftar Nama Pondok
-- Pesantren Lamongan" (kolom Tipe, Tokoh Pendiri, Pimpinan).
--
-- Ponpes lain DILEWATI karena tidak ada padanan nama yang meyakinkan:
--   #3  al-ikhlas-babat             alkhoirot "Al Ikhlas" ada di Lamongan KOTA, bukan Babat
--   #10 al-ishlah-sendangagung      alkhoirot "Isma'iliyah Sendang Agung" - nama beda
--   #26 putri-al-fathimiyah         tidak ada entri Putri/Fathimiyah di alkhoirot
--
-- Idempoten: semua UPDATE punya guard slug. Backup DB dulu (lihat README).

UPDATE ponpes SET tipe_pesantren='khalafiyah_modern',
       nama_pengasuh='KH. Moh. Anwar Mu''rob'
 WHERE id=21 AND slug='karangasem-muhammadiyah-paciran' AND nama_pengasuh IS NULL;

UPDATE ponpes SET tipe_pesantren='khalafiyah_modern',
       nama_pengasuh='KH. Abdul Karim Zein'
 WHERE id=24 AND slug='modern-muhammadiyah-paciran' AND nama_pengasuh IS NULL;

UPDATE ponpes SET tipe_pesantren='khalafiyah_modern',
       nama_pengasuh='KH. Mahsuli Efendi'
 WHERE id=33 AND slug='matholiul-anwar' AND nama_pengasuh IS NULL;