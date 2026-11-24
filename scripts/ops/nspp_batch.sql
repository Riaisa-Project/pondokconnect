-- NSPP batch: 7 ponpes Pondok Connect yang cocok dengan dokumen Kemenag
-- "Daftar Madrasah di Pondok Pesantren Lamongan" (Scribd 495227465).
--
-- Semua baris di bawah diverifikasi: nama + desa/kecamatan di dokumen cocok
-- dengan alamat di DB. NSPP tidak ada di PonpesUpdate (sengaja: NSPP itu
-- pemberian Kemenag, bukan diedit admin ponpes), jadi diisi lewat SQL.
--
-- Pakai:
--   scp scripts/ops/nspp_batch.sql oracle:/tmp/
--   ssh oracle 'sudo docker cp /tmp/nspp_batch.sql pondokconnect-db-1:/tmp/ && \
--     sudo docker exec pondokconnect-db-1 sh -c '\''exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" pondokconnect_db < /tmp/nspp_batch.sql'\'''
--
-- Backup DB dulu (lihat README).

UPDATE ponpes SET nspp='510035240158' WHERE id=1  AND slug='al-aman-payaman';               -- AL AMAN, Payaman, Solokuro
UPDATE ponpes SET nspp='510335240163' WHERE id=3  AND slug='al-ikhlas-babat';               -- ALIKHAS, Babat
UPDATE ponpes SET nspp='510035240021' WHERE id=10 AND slug='al-ishlah-sendangagung';        -- ISMA'ILIYAH AL MUHTADIM, Sendangagung, Paciran
UPDATE ponpes SET nspp='510035240140' WHERE id=21 AND slug='karangasem-muhammadiyah-paciran';-- KARANGASEM MUHAMMADIYAH, Paciran
UPDATE ponpes SET nspp='510335240037' WHERE id=24 AND slug='modern-muhammadiyah-paciran';    -- MODERN MUHAMMADIYAH, Paciran
UPDATE ponpes SET nspp='510035240144' WHERE id=26 AND slug='putri-al-fathimiyah-banjarwati'; -- AL FATIMIYAH, Banjarwati, Paciran
UPDATE ponpes SET nspp='510035240020' WHERE id=33 AND slug='matholiul-anwar';                -- MATHOLI'ULANWAR, Simo, Karanggeneng