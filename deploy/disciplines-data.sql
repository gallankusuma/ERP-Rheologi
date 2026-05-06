-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: erp_manufacturing
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Dumping data for table `master_disciplines`
--

LOCK TABLES `master_disciplines` WRITE;
/*!40000 ALTER TABLE `master_disciplines` DISABLE KEYS */;
INSERT INTO `master_disciplines` (`id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (1,'CIVIL','Civil',1,1,'2026-03-31 04:04:25','2026-03-31 04:04:25');
INSERT INTO `master_disciplines` (`id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (2,'STEEL','Steel Structure',2,1,'2026-03-31 04:04:25','2026-03-31 04:04:25');
INSERT INTO `master_disciplines` (`id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (3,'PIPING','Piping',3,1,'2026-03-31 04:04:25','2026-03-31 04:04:25');
INSERT INTO `master_disciplines` (`id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (4,'ELECTRICAL','Electrical',4,1,'2026-03-31 04:04:25','2026-03-31 04:04:25');
INSERT INTO `master_disciplines` (`id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (5,'MECHANICAL','Mechanical',5,1,'2026-03-31 04:04:25','2026-03-31 04:04:25');
INSERT INTO `master_disciplines` (`id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (6,'UMUM','Bidang Umum',0,1,'2026-04-14 05:12:26','2026-04-14 05:12:26');
INSERT INTO `master_disciplines` (`id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (7,'CK','Cipta Karya & Perumahan',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_disciplines` (`id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (8,'BM','Bina Marga',0,1,'2026-04-14 06:38:50','2026-04-14 06:38:50');
/*!40000 ALTER TABLE `master_disciplines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `master_sub_disciplines`
--

LOCK TABLES `master_sub_disciplines` WRITE;
/*!40000 ALTER TABLE `master_sub_disciplines` DISABLE KEYS */;
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (1,1,'PERSIAPAN','Pekerjaan Persiapan',1,1,'2026-03-31 04:04:25','2026-03-31 04:04:25');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (2,1,'PONDASI','Pekerjaan Pondasi',2,1,'2026-03-31 04:04:25','2026-03-31 04:04:25');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (3,1,'SALURAN','Pekerjaan Saluran',3,1,'2026-03-31 04:04:25','2026-03-31 04:04:25');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (4,1,'STRUKTUR','Pekerjaan Struktur',4,1,'2026-03-31 04:04:25','2026-03-31 04:04:25');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (5,6,'PER','Persiapan',0,1,'2026-04-14 05:12:26','2026-04-14 05:12:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (6,6,'DEW','Dewatering (normatif)',0,1,'2026-04-14 05:12:26','2026-04-14 05:12:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (7,6,'TAN','Tanah',0,1,'2026-04-14 05:12:26','2026-04-14 05:12:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (8,6,'BET','Beton',0,1,'2026-04-14 05:12:26','2026-04-14 05:12:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (9,6,'AIR','Air tanah',0,1,'2026-04-14 05:12:26','2026-04-14 05:12:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (10,7,'PER','Persiapan',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (11,7,'GAL','Galian tanah',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (12,7,'TIM','Timbunan dan pemadatan (termasuk perataan dan perapihan)',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (13,7,'ANG','Angkutan material dan/atau hasil galian',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (14,7,'GEO','Geotekstil dan geomembran',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (15,7,'PEM','Pembongkaran',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (16,7,'RAN','Rangka atap',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (17,7,'STR','Struktur beton',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (18,7,'STR','Struktur baja',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (19,7,'STR','Struktur beton pracetak',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (20,7,'STR','Struktur beton prategang',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (21,7,'STR','Struktur kayu',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (22,7,'DIN','Dinding penahan tanah',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (23,7,'PEN','Penutup atap',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (24,7,'INS','Insulasi',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (25,7,'AKS','Aksesoris atap',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (26,7,'WAT','Waterproofing',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (27,7,'LAN','Langit-langit (plafon)',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (28,7,'DIN','Dinding',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (29,7,'PLE','Plesteran dan acian',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (30,7,'PEN','Pengecatan dan pelituran',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (31,7,'PEN','Penutup lantai',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (32,7,'PEN','Penutup dinding',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (33,7,'PIN','Pintu dan jendela',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (34,7,'KAC','Kaca',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (35,7,'BES','Besi dan aluminium',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (36,7,'KAY','Kayu',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (37,7,'MON','Monumen dan ornamen',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (38,7,'SIG','Signage',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (39,7,'SAN','Sanitair',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (40,7,'PEN','Penanaman tanaman',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (41,7,'PEM','Pemeliharaan tanaman',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (42,7,'SIS','Sistem distribusi jaringan listrik',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (43,7,'SIS','Sistem proteksi petir',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (44,7,'SIS','Sistem pencahayaan',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (45,7,'SIS','Sistem elektronik',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (46,7,'SIS','Sistem tata udara',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (47,7,'SIS','Sistem proteksi kebakaran',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (48,7,'SIS','Sistem air minum',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (49,7,'SIS','Sistem air limbah',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (50,7,'BAK','Bak kontrol',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (51,7,'SIS','Sistem perpipaan dalam gedung',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (52,7,'AKS','Aksesories pipa',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (53,7,'SIS','Sistem air hujan',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (54,7,'JAL','Jalan paving block',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (55,7,'JAL','Jalan beton',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (56,7,'JAL','Jalan aspal',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (57,7,'SAL','Saluran u-ditch',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (58,7,'SAL','Saluran buis beton',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (59,7,'SAL','Saluran box culvert',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (60,7,'PIP','Pipa pvc',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (61,7,'PIP','Pipa galvanis',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (62,7,'PIP','Pipa hdpe/pe',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (63,7,'PIP','Pipa dci (ductile cast iron)',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (64,7,'PIP','Pipa baja karbon',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (65,7,'PIP','Pipa beton',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (66,7,'AKS','Aksesoris pipa',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (67,7,'PRO','Produksi panel risha',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (68,7,'PEN','Pengepakkan dan pengiriman panel lengkap dengan aksesories risha',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (69,7,'PER','Perakitan panel risha',0,1,'2026-04-14 06:33:26','2026-04-14 06:33:26');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (70,8,'DRA','Drainase',0,1,'2026-04-14 06:38:50','2026-04-14 06:38:50');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (71,8,'TAN','Tanah dan geosintetik',0,1,'2026-04-14 06:38:50','2026-04-14 06:38:50');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (72,8,'PRE','Preventif',0,1,'2026-04-14 06:38:50','2026-04-14 06:38:50');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (73,8,'PER','Perkerasan berbutir dan perkerasan beton semen',0,1,'2026-04-14 06:38:50','2026-04-14 06:38:50');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (74,8,'PER','Perkerasan aspal',0,1,'2026-04-14 06:38:50','2026-04-14 06:38:50');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (75,8,'STR','Struktur',0,1,'2026-04-14 06:38:50','2026-04-14 06:38:50');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (76,8,'REH','Rehabilitasi jembatan',0,1,'2026-04-14 06:38:50','2026-04-14 06:38:50');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (77,8,'HAR','Harian dan pekerjaan lain-lain',0,1,'2026-04-14 06:38:50','2026-04-14 06:38:50');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (78,8,'PEM','Pemeliharaan',0,1,'2026-04-14 06:38:50','2026-04-14 06:38:50');
INSERT INTO `master_sub_disciplines` (`id`, `discipline_id`, `code`, `name`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES (79,8,'JAL','Jalan bebas hambatan dan jalan tol',0,1,'2026-04-14 06:38:50','2026-04-14 06:38:50');
/*!40000 ALTER TABLE `master_sub_disciplines` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-04-18 15:01:22
