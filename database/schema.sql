-- Schema snapshot after Alembic a3c7d9e1b642 (23 October 2026).
-- Structure only; apply migrations with Alembic rather than importing this inspection snapshot.

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
DROP TABLE IF EXISTS `alembic_version`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `alembic_version` (
  `version_num` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`version_num`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `aksi` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `detail` text COLLATE utf8mb4_unicode_ci,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_audit_logs_user_id` (`user_id`),
  CONSTRAINT `fk_audit_logs_user_id_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `chat_konsultasi`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chat_konsultasi` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ponpes_id` int NOT NULL,
  `session_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nama_warga` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kontak_warga` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `pesan` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `sender_role` enum('warga','admin_ponpes') COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_chat_konsultasi_ponpes_id` (`ponpes_id`),
  KEY `ix_chat_session_order` (`ponpes_id`,`session_id`,`id`),
  CONSTRAINT `fk_chat_konsultasi_ponpes_id_ponpes` FOREIGN KEY (`ponpes_id`) REFERENCES `ponpes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `kecamatan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kecamatan` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nama_kecamatan` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_kecamatan_nama_kecamatan` (`nama_kecamatan`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `pendaftaran_santri`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pendaftaran_santri` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ponpes_id` int NOT NULL,
  `user_pendaftar_id` int DEFAULT NULL,
  `nomor_registrasi` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nik_santri` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nama_santri` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `jenis_kelamin` enum('L','P') COLLATE utf8mb4_unicode_ci NOT NULL,
  `nama_wali` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `no_hp_wali` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_kk` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status_seleksi` enum('menunggu_verifikasi','lolos_berkas','diterima','ditolak') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'menunggu_verifikasi',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pendaftaran_santri_nomor_registrasi` (`nomor_registrasi`),
  UNIQUE KEY `uq_pendaftaran_santri_ponpes_id` (`ponpes_id`,`nik_santri`),
  KEY `fk_pendaftaran_santri_user_pendaftar_id_users` (`user_pendaftar_id`),
  KEY `ix_pendaftaran_quota` (`ponpes_id`,`jenis_kelamin`,`status_seleksi`),
  KEY `ix_pendaftaran_santri_ponpes_id` (`ponpes_id`),
  CONSTRAINT `fk_pendaftaran_santri_ponpes_id_ponpes` FOREIGN KEY (`ponpes_id`) REFERENCES `ponpes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pendaftaran_santri_user_pendaftar_id_users` FOREIGN KEY (`user_pendaftar_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `pengaduan_kekerasan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pengaduan_kekerasan` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ponpes_id` int NOT NULL,
  `kode_tiket` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kategori_kasus` enum('pelecehan_seksual','kekerasan_fisik','perundungan_bullying','pemerasan','lainnya') COLLATE utf8mb4_unicode_ci NOT NULL,
  `tanggal_kejadian` date NOT NULL,
  `lokasi_kejadian` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `deskripsi_peristiwa` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `bukti_lampiran` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mode_pelapor` enum('terbuka','rahasia') COLLATE utf8mb4_unicode_ci NOT NULL,
  `nama_pelapor` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kontak_pelapor` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status_tindakan` enum('masuk_antrian','penyelidikan_satgas','pendampingan','proses_hukum','selesai','tidak_valid') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'masuk_antrian',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pengaduan_kekerasan_kode_tiket` (`kode_tiket`),
  KEY `fk_pengaduan_kekerasan_ponpes_id_ponpes` (`ponpes_id`),
  KEY `ix_pengaduan_kekerasan_status_tindakan` (`status_tindakan`),
  CONSTRAINT `fk_pengaduan_kekerasan_ponpes_id_ponpes` FOREIGN KEY (`ponpes_id`) REFERENCES `ponpes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ck_pengaduan_kekerasan_anonymous_identity` CHECK (((`mode_pelapor` <> _utf8mb4'rahasia') or ((`nama_pelapor` is null) and (`kontak_pelapor` is null))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `pengaduan_perkembangan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pengaduan_perkembangan` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pengaduan_id` int NOT NULL,
  `petugas_id` int DEFAULT NULL,
  `status_sebelum` enum('masuk_antrian','penyelidikan_satgas','pendampingan','proses_hukum','selesai','tidak_valid') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status_sesudah` enum('masuk_antrian','penyelidikan_satgas','pendampingan','proses_hukum','selesai','tidak_valid') COLLATE utf8mb4_unicode_ci NOT NULL,
  `catatan_internal` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_pengaduan_perkembangan_petugas_id_users` (`petugas_id`),
  KEY `ix_pengaduan_perkembangan_pengaduan_id` (`pengaduan_id`),
  CONSTRAINT `fk_pengaduan_perkembangan_pengaduan_id_pengaduan_kekerasan` FOREIGN KEY (`pengaduan_id`) REFERENCES `pengaduan_kekerasan` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pengaduan_perkembangan_petugas_id_users` FOREIGN KEY (`petugas_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `pengawasan_pesantren`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pengawasan_pesantren` (
  `ponpes_id` int NOT NULL,
  `status_dokumen` enum('belum_dikonfirmasi','terdaftar') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'belum_dikonfirmasi',
  `nomor_statistik` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nomor_dokumen` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `penerbit_dokumen` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tanggal_dokumen` date DEFAULT NULL,
  `sumber_dokumen` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tanggal_pemeriksaan_dokumen` date DEFAULT NULL,
  `catatan_dokumen` text COLLATE utf8mb4_unicode_ci,
  `status_operasional` enum('belum_dikonfirmasi','beroperasi','tidak_beroperasi') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'belum_dikonfirmasi',
  `sumber_operasional` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tanggal_pemeriksaan_operasional` date DEFAULT NULL,
  `catatan_operasional` text COLLATE utf8mb4_unicode_ci,
  `pemeriksa_id` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ponpes_id`),
  KEY `fk_pengawasan_pesantren_pemeriksa_id_users` (`pemeriksa_id`),
  CONSTRAINT `fk_pengawasan_pesantren_pemeriksa_id_users` FOREIGN KEY (`pemeriksa_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_pengawasan_pesantren_ponpes_id_ponpes` FOREIGN KEY (`ponpes_id`) REFERENCES `ponpes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `ponpes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ponpes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `kecamatan_id` int NOT NULL,
  `user_admin_id` int DEFAULT NULL,
  `nspp` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nama_ponpes` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nama_pengasuh` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `alamat_lengkap` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `tipe_pesantren` enum('salafiyah','khalafiyah_modern','kombinasi') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status_ijop` enum('proses_verifikasi','aktif','kedaluwarsa','ditolak') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'proses_verifikasi',
  `no_sk_ijop` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tanggal_ijop_mulai` date DEFAULT NULL,
  `tanggal_ijop_selesai` date DEFAULT NULL,
  `kuota_putra` int NOT NULL DEFAULT '50',
  `kuota_putri` int NOT NULL DEFAULT '50',
  `kontak_sekretariat` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT '-7.11930000',
  `longitude` decimal(11,8) DEFAULT '112.41500000',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deskripsi` text COLLATE utf8mb4_unicode_ci,
  `program_unggulan` json DEFAULT NULL,
  `fasilitas` json DEFAULT NULL,
  `profil_referensi` tinyint(1) NOT NULL DEFAULT '0',
  `pendaftaran_dibuka` tinyint(1) NOT NULL DEFAULT '0',
  `konsultasi_dibuka` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ponpes_slug` (`slug`),
  UNIQUE KEY `uq_ponpes_nspp` (`nspp`),
  UNIQUE KEY `uq_ponpes_user_admin_id` (`user_admin_id`),
  KEY `ix_ponpes_kecamatan_id` (`kecamatan_id`),
  KEY `ix_ponpes_status_ijop` (`status_ijop`),
  CONSTRAINT `fk_ponpes_kecamatan_id_kecamatan` FOREIGN KEY (`kecamatan_id`) REFERENCES `kecamatan` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_ponpes_user_admin_id_users` FOREIGN KEY (`user_admin_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `ck_ponpes_coordinates` CHECK (((`latitude` between -(90) and 90) and (`longitude` between -(180) and 180))),
  CONSTRAINT `ck_ponpes_date_order` CHECK (((`tanggal_ijop_selesai` is null) or (`tanggal_ijop_mulai` is null) or (`tanggal_ijop_selesai` >= `tanggal_ijop_mulai`))),
  CONSTRAINT `ck_ponpes_quota_nonnegative` CHECK (((`kuota_putra` >= 0) and (`kuota_putri` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nama_lengkap` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `no_hp` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('satgas_kemenag','admin_ponpes','warga') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'warga',
  `must_change_password` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `ix_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
