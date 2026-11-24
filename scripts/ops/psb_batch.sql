-- Buka layanan PSB untuk ponpes yang punya identitas resmi (NSPP).
-- Sumber NSPP: scripts/ops/nspp_batch.sql (dokumen Kemenag/Scribd, dicocokkan nama+alamat).
--
-- Kuota 50/50 adalah NILAI CONTOH (placeholder demo), sama seperti pilot
-- ponpes 1. Setiap pengurus ponpes wajib menggantinya lewat
-- PUT /api/admin/ponpes/my/layanan sebelum PSB benar-benar dipakai.
-- Tidak ada gelombang/biaya yang dikarang: pengurus tiap ponpes membuat sendiri.
-- Konsultasi dibiarkan tertutup (layanan terpisah).

UPDATE ponpes SET pendaftaran_dibuka = 1, kuota_putra = 50, kuota_putri = 50
WHERE id = 3  AND slug = 'al-ikhlas-babat'                 AND pendaftaran_dibuka = 0;
UPDATE ponpes SET pendaftaran_dibuka = 1, kuota_putra = 50, kuota_putri = 50
WHERE id = 10 AND slug = 'al-ishlah-sendangagung'          AND pendaftaran_dibuka = 0;
UPDATE ponpes SET pendaftaran_dibuka = 1, kuota_putra = 50, kuota_putri = 50
WHERE id = 21 AND slug = 'karangasem-muhammadiyah-paciran' AND pendaftaran_dibuka = 0;
UPDATE ponpes SET pendaftaran_dibuka = 1, kuota_putra = 50, kuota_putri = 50
WHERE id = 24 AND slug = 'modern-muhammadiyah-paciran'     AND pendaftaran_dibuka = 0;
-- id 26 pesantren putri: kuota putra 0, hanya putri.
UPDATE ponpes SET pendaftaran_dibuka = 1, kuota_putra = 0, kuota_putri = 50
WHERE id = 26 AND slug = 'putri-al-fathimiyah-banjarwati'  AND pendaftaran_dibuka = 0;
UPDATE ponpes SET pendaftaran_dibuka = 1, kuota_putra = 50, kuota_putri = 50
WHERE id = 33 AND slug = 'matholiul-anwar'                 AND pendaftaran_dibuka = 0;