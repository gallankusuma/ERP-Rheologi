-- ============================================================
-- Generate AHSP entries for ALL Preliminary Design Template Items
-- Codes: CB = Civil Bangunan, CS = Civil Struktur, PP = Piping,
--        EL = Electrical, ME = Mechanical
-- ============================================================

-- =============================================
-- CIVIL BANGUNAN (CB)
-- =============================================

-- I. Pekerjaan Persiapan
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('CB.01.01', 'Mobilisasi & Demobilisasi Alat dan Material', 'ls', 0, 'active', '2024'),
('CB.01.02', 'Papan Nama Proyek', 'bh', 0, 'active', '2024'),
('CB.01.03', 'Pembuatan Direksi Keet', 'm2', 0, 'active', '2024'),
('CB.01.04', 'Pengukuran & Bouwplank (Uitzet)', 'm\'', 0, 'active', '2024'),
('CB.01.05', 'Pembersihan Lahan (Land Clearing)', 'm2', 0, 'active', '2024'),
('CB.01.06', 'Pagar Sementara Proyek (Hoarding)', 'm\'', 0, 'active', '2024'),
('CB.01.07', 'Gudang Material & Los Kerja', 'm2', 0, 'active', '2024'),
('CB.01.08', 'Instalasi Listrik & Air Kerja Sementara', 'ls', 0, 'active', '2024'),
('CB.01.09', 'K3 / Safety Equipment', 'ls', 0, 'active', '2024');

-- II. Pekerjaan Tanah
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('CB.02.01', 'Clearing & Grubbing Area', 'm2', 0, 'active', '2024'),
('CB.02.02', 'Galian Tanah Pondasi', 'm3', 0, 'active', '2024'),
('CB.02.03', 'Galian Tanah Sloof', 'm3', 0, 'active', '2024'),
('CB.02.04', 'Urugan Tanah Kembali (Backfill)', 'm3', 0, 'active', '2024'),
('CB.02.05', 'Urugan Pasir Bawah Pondasi', 'm3', 0, 'active', '2024'),
('CB.02.06', 'Urugan Sirtu / Peninggian', 'm3', 0, 'active', '2024'),
('CB.02.07', 'Pemadatan Tanah (Compaction)', 'm3', 0, 'active', '2024'),
('CB.02.08', 'Pembuangan Tanah Bekas Galian', 'm3', 0, 'active', '2024');

-- III. Pekerjaan Pondasi — Foot Plate
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('CB.03.01', 'Lantai Kerja (Lean Concrete) t=5cm', 'm3', 0, 'active', '2024'),
('CB.03.02', 'Foot Plate — Bekisting', 'm2', 0, 'active', '2024'),
('CB.03.03', 'Foot Plate — Pembesian', 'kg', 0, 'active', '2024'),
('CB.03.04', 'Foot Plate — Pengecoran', 'm3', 0, 'active', '2024');

-- III. Pekerjaan Pondasi — Bored Pile
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('CB.03.05', 'Pengeboran Bored Pile', 'm\'', 0, 'active', '2024'),
('CB.03.06', 'Pembesian Bored Pile', 'kg', 0, 'active', '2024'),
('CB.03.07', 'Pengecoran Bored Pile', 'm3', 0, 'active', '2024'),
('CB.03.08', 'Pile Cap — Bekisting', 'm2', 0, 'active', '2024'),
('CB.03.09', 'Pile Cap — Pembesian', 'kg', 0, 'active', '2024'),
('CB.03.10', 'Pile Cap — Pengecoran', 'm3', 0, 'active', '2024');

-- III. Pekerjaan Pondasi — Mini Pile
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('CB.03.11', 'Pemancangan Mini Pile', 'm\'', 0, 'active', '2024');

-- III. Pekerjaan Pondasi — Sumuran
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('CB.03.12', 'Galian Pondasi Sumuran', 'm3', 0, 'active', '2024'),
('CB.03.13', 'Pasangan Batu Kali Pondasi', 'm3', 0, 'active', '2024'),
('CB.03.14', 'Pengecoran Pondasi Sumuran', 'm3', 0, 'active', '2024');

-- IV. Pekerjaan Struktur Beton
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('CB.04.01', 'Sloof — Bekisting', 'm2', 0, 'active', '2024'),
('CB.04.02', 'Sloof — Pembesian', 'kg', 0, 'active', '2024'),
('CB.04.03', 'Sloof — Pengecoran', 'm3', 0, 'active', '2024'),
('CB.04.04', 'Kolom — Bekisting', 'm2', 0, 'active', '2024'),
('CB.04.05', 'Kolom — Pembesian', 'kg', 0, 'active', '2024'),
('CB.04.06', 'Kolom — Pengecoran', 'm3', 0, 'active', '2024'),
('CB.04.07', 'Ring Balok — Bekisting', 'm2', 0, 'active', '2024'),
('CB.04.08', 'Ring Balok — Pembesian', 'kg', 0, 'active', '2024'),
('CB.04.09', 'Ring Balok — Pengecoran', 'm3', 0, 'active', '2024'),
('CB.04.10', 'Balok Lantai — Bekisting', 'm2', 0, 'active', '2024'),
('CB.04.11', 'Balok Lantai — Pembesian', 'kg', 0, 'active', '2024'),
('CB.04.12', 'Balok Lantai — Pengecoran', 'm3', 0, 'active', '2024'),
('CB.04.13', 'Plat Lantai — Bekisting', 'm2', 0, 'active', '2024'),
('CB.04.14', 'Plat Lantai — Pembesian', 'kg', 0, 'active', '2024'),
('CB.04.15', 'Plat Lantai — Pengecoran', 'm3', 0, 'active', '2024');

-- V. Pekerjaan Dinding & Pasangan
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('CB.05.01', 'Pasangan Bata Ringan / Hebel', 'm2', 0, 'active', '2024'),
('CB.05.02', 'Plesteran Dinding', 'm2', 0, 'active', '2024'),
('CB.05.03', 'Acian Dinding', 'm2', 0, 'active', '2024'),
('CB.05.04', 'Benangan / Tali Air', 'm\'', 0, 'active', '2024'),
('CB.05.05', 'Pasangan Batu Bata (jika ada)', 'm2', 0, 'active', '2024'),
('CB.05.06', 'Dinding Partisi (jika ada)', 'm2', 0, 'active', '2024');

-- VI. Pekerjaan Atap & Rangka
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('CB.06.01', 'Rangka Atap Baja Ringan / Baja', 'm2', 0, 'active', '2024'),
('CB.06.02', 'Pemasangan Penutup Atap (Genteng/Spandek/Galvalum)', 'm2', 0, 'active', '2024'),
('CB.06.03', 'Bubungan / Ridge', 'm\'', 0, 'active', '2024'),
('CB.06.04', 'Lisplang & Talang Air', 'm\'', 0, 'active', '2024'),
('CB.06.05', 'Flashing & Sealant', 'm\'', 0, 'active', '2024'),
('CB.06.06', 'Insulation Atap (jika ada)', 'm2', 0, 'active', '2024');

-- VII. Pekerjaan Plafond
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('CB.07.01', 'Rangka Plafond Hollow / Metal Furing', 'm2', 0, 'active', '2024'),
('CB.07.02', 'Pemasangan Plafond Gypsum / Kalsiboard', 'm2', 0, 'active', '2024'),
('CB.07.03', 'List Plafond / Profil', 'm\'', 0, 'active', '2024');

-- VIII. Pekerjaan Lantai
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('CB.08.01', 'Urugan Pasir Bawah Lantai', 'm3', 0, 'active', '2024'),
('CB.08.02', 'Cor Lantai Kerja', 'm3', 0, 'active', '2024'),
('CB.08.03', 'Pemasangan Keramik Lantai', 'm2', 0, 'active', '2024'),
('CB.08.04', 'Pemasangan Keramik KM/WC', 'm2', 0, 'active', '2024'),
('CB.08.05', 'Pemasangan Keramik Dinding KM/WC', 'm2', 0, 'active', '2024'),
('CB.08.06', 'Floor Hardener (jika ada)', 'm2', 0, 'active', '2024'),
('CB.08.07', 'Waterproofing KM/WC', 'm2', 0, 'active', '2024');

-- IX. Pekerjaan Pintu & Jendela
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('CB.09.01', 'Kusen Aluminium / Kayu', 'm\'', 0, 'active', '2024'),
('CB.09.02', 'Daun Pintu Panel / Hollow', 'm2', 0, 'active', '2024'),
('CB.09.03', 'Daun Jendela Kaca', 'm2', 0, 'active', '2024'),
('CB.09.04', 'Pintu KM/WC PVC', 'bh', 0, 'active', '2024'),
('CB.09.05', 'Hardware (Handle, Engsel, Kunci)', 'set', 0, 'active', '2024'),
('CB.09.06', 'Pintu Rolling Door (jika ada)', 'm2', 0, 'active', '2024');

-- X. Pekerjaan Pengecatan
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('CB.10.01', 'Cat Dinding Dalam (Interior)', 'm2', 0, 'active', '2024'),
('CB.10.02', 'Cat Dinding Luar (Exterior)', 'm2', 0, 'active', '2024'),
('CB.10.03', 'Cat Plafond', 'm2', 0, 'active', '2024'),
('CB.10.04', 'Cat Lisplang & Talang', 'm2', 0, 'active', '2024'),
('CB.10.05', 'Cat Besi / Anti Karat', 'm2', 0, 'active', '2024');

-- XI. Pekerjaan Sanitasi & Plumbing
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('CB.11.01', 'Instalasi Pipa Air Bersih (PVC/PPR)', 'm\'', 0, 'active', '2024'),
('CB.11.02', 'Instalasi Pipa Air Kotor & Buangan', 'm\'', 0, 'active', '2024'),
('CB.11.03', 'Instalasi Pipa Vent', 'm\'', 0, 'active', '2024'),
('CB.11.04', 'Pemasangan Closet Duduk / Jongkok', 'bh', 0, 'active', '2024'),
('CB.11.05', 'Pemasangan Wastafel', 'bh', 0, 'active', '2024'),
('CB.11.06', 'Pemasangan Floor Drain', 'bh', 0, 'active', '2024'),
('CB.11.07', 'Pemasangan Kran Air', 'bh', 0, 'active', '2024'),
('CB.11.08', 'Septictank Bio / Konvensional', 'unit', 0, 'active', '2024'),
('CB.11.09', 'Bak Kontrol', 'bh', 0, 'active', '2024'),
('CB.11.10', 'Saluran Drainase Lingkungan', 'm\'', 0, 'active', '2024');

-- XII. Pekerjaan Listrik
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('CB.12.01', 'Instalasi Panel Listrik (MCB/MCCB)', 'unit', 0, 'active', '2024'),
('CB.12.02', 'Instalasi Kabel NYM / NYY', 'm\'', 0, 'active', '2024'),
('CB.12.03', 'Instalasi Conduit / Pipa PVC', 'm\'', 0, 'active', '2024'),
('CB.12.04', 'Instalasi Titik Lampu', 'titik', 0, 'active', '2024'),
('CB.12.05', 'Instalasi Stop Kontak', 'titik', 0, 'active', '2024'),
('CB.12.06', 'Instalasi Saklar', 'titik', 0, 'active', '2024'),
('CB.12.07', 'Lampu TL / LED / Downlight', 'bh', 0, 'active', '2024'),
('CB.12.08', 'Grounding System', 'set', 0, 'active', '2024'),
('CB.12.09', 'Penangkal Petir', 'set', 0, 'active', '2024');

-- XIII. Pekerjaan Lain-lain & Finishing
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('CB.13.01', 'Pekerjaan Taman & Landscape', 'm2', 0, 'active', '2024'),
('CB.13.02', 'Paving Block / Carport', 'm2', 0, 'active', '2024'),
('CB.13.03', 'Pagar & Pintu Gerbang', 'm\'', 0, 'active', '2024'),
('CB.13.04', 'Saluran Keliling Bangunan', 'm\'', 0, 'active', '2024'),
('CB.13.05', 'Railling Tangga / Balkon', 'm\'', 0, 'active', '2024'),
('CB.13.06', 'Bak Sampah / Pos Jaga (jika ada)', 'bh', 0, 'active', '2024'),
('CB.13.07', 'Pembersihan Akhir (Final Cleaning)', 'm2', 0, 'active', '2024');


-- =============================================
-- CIVIL STRUKTUR (CS)
-- =============================================

-- I. Pekerjaan Persiapan
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('CS.01.01', 'Mobilisasi & Demobilisasi', 'ls', 0, 'active', '2024'),
('CS.01.02', 'Papan Nama Proyek', 'bh', 0, 'active', '2024'),
('CS.01.03', 'Pembuatan Direksi Keet', 'm2', 0, 'active', '2024'),
('CS.01.04', 'Pengukuran & Uitzet', 'm\'', 0, 'active', '2024'),
('CS.01.05', 'Pembersihan Lahan', 'm2', 0, 'active', '2024'),
('CS.01.06', 'K3 / Safety Equipment', 'ls', 0, 'active', '2024');

-- II. Pekerjaan Tanah & Urugan
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('CS.02.01', 'Clearing & Grubbing', 'm2', 0, 'active', '2024'),
('CS.02.02', 'Galian Tanah Pondasi / Pedestal', 'm3', 0, 'active', '2024'),
('CS.02.03', 'Urugan Pasir', 'm3', 0, 'active', '2024'),
('CS.02.04', 'Urugan Sirtu / Sub-base', 'm3', 0, 'active', '2024'),
('CS.02.05', 'Pemadatan Tanah', 'm3', 0, 'active', '2024'),
('CS.02.06', 'Pembuangan Tanah Sisa', 'm3', 0, 'active', '2024');

-- III. Pekerjaan Pondasi
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('CS.03.01', 'Lantai Kerja (Lean Concrete)', 'm3', 0, 'active', '2024'),
('CS.03.02', 'Pondasi — Bekisting', 'm2', 0, 'active', '2024'),
('CS.03.03', 'Pondasi — Pembesian', 'kg', 0, 'active', '2024'),
('CS.03.04', 'Pondasi — Pengecoran', 'm3', 0, 'active', '2024'),
('CS.03.05', 'Pedestal — Bekisting', 'm2', 0, 'active', '2024'),
('CS.03.06', 'Pedestal — Pembesian', 'kg', 0, 'active', '2024'),
('CS.03.07', 'Pedestal — Pengecoran', 'm3', 0, 'active', '2024'),
('CS.03.08', 'Anchor Bolt Pemasangan', 'set', 0, 'active', '2024');

-- IV. Pekerjaan Beton (Tie Beam, Slab)
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('CS.04.01', 'Tie Beam — Bekisting', 'm2', 0, 'active', '2024'),
('CS.04.02', 'Tie Beam — Pembesian', 'kg', 0, 'active', '2024'),
('CS.04.03', 'Tie Beam — Pengecoran', 'm3', 0, 'active', '2024'),
('CS.04.04', 'Slab on Grade — Wiremesh / Pembesian', 'kg', 0, 'active', '2024'),
('CS.04.05', 'Slab on Grade — Pengecoran', 'm3', 0, 'active', '2024'),
('CS.04.06', 'Retaining Wall — Bekisting (jika ada)', 'm2', 0, 'active', '2024'),
('CS.04.07', 'Retaining Wall — Pembesian (jika ada)', 'kg', 0, 'active', '2024'),
('CS.04.08', 'Retaining Wall — Pengecoran (jika ada)', 'm3', 0, 'active', '2024');

-- V. Pekerjaan Struktur Baja
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('CS.05.01', 'Fabrikasi Baja Kolom (H-Beam/WF)', 'kg', 0, 'active', '2024'),
('CS.05.02', 'Fabrikasi Baja Rafter / Truss', 'kg', 0, 'active', '2024'),
('CS.05.03', 'Fabrikasi Bracing & Purlin', 'kg', 0, 'active', '2024'),
('CS.05.04', 'Erection Kolom Baja', 'kg', 0, 'active', '2024'),
('CS.05.05', 'Erection Rafter & Truss', 'kg', 0, 'active', '2024'),
('CS.05.06', 'Erection Bracing, Purlin, Sagrod', 'kg', 0, 'active', '2024'),
('CS.05.07', 'Baut Sambungan (High Strength Bolt)', 'set', 0, 'active', '2024'),
('CS.05.08', 'Pengelasan (Welding)', 'cm', 0, 'active', '2024'),
('CS.05.09', 'Pengecatan Baja (Primer + Finish)', 'm2', 0, 'active', '2024');

-- VI. Pekerjaan Atap & Cladding
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('CS.06.01', 'Pemasangan Atap Metal Sheet (Zincalume/Galvalum)', 'm2', 0, 'active', '2024'),
('CS.06.02', 'Pemasangan Dinding Cladding', 'm2', 0, 'active', '2024'),
('CS.06.03', 'Flashing & Accessories', 'm\'', 0, 'active', '2024'),
('CS.06.04', 'Talang & Downpipe', 'm\'', 0, 'active', '2024'),
('CS.06.05', 'Skylight / Ventilator (jika ada)', 'bh', 0, 'active', '2024');

-- VII. Pekerjaan Floor Hardener / Coating
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('CS.07.01', 'Floor Hardener Application', 'm2', 0, 'active', '2024'),
('CS.07.02', 'Epoxy Floor Coating (jika ada)', 'm2', 0, 'active', '2024'),
('CS.07.03', 'Joint Sealant / Cutting', 'm\'', 0, 'active', '2024');

-- VIII. Pekerjaan Drainage
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('CS.08.01', 'Saluran Drainase U-Ditch', 'm\'', 0, 'active', '2024'),
('CS.08.02', 'Bak Kontrol', 'bh', 0, 'active', '2024'),
('CS.08.03', 'Gorong-gorong / Culvert', 'm\'', 0, 'active', '2024'),
('CS.08.04', 'Pemasangan Grating', 'm2', 0, 'active', '2024');

-- IX. Pekerjaan Lain-lain
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('CS.09.01', 'Pekerjaan Paving / Jalan Akses', 'm2', 0, 'active', '2024'),
('CS.09.02', 'Pagar & Pintu Gerbang', 'm\'', 0, 'active', '2024'),
('CS.09.03', 'Final Cleaning', 'm2', 0, 'active', '2024');


-- =============================================
-- PIPING (PP)
-- =============================================

-- I. Pekerjaan Persiapan & Mobilisasi
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('PP.01.01', 'Mobilisasi & Demobilisasi', 'ls', 0, 'active', '2024'),
('PP.01.02', 'Survey & Pengukuran Rute Pipa', 'ls', 0, 'active', '2024'),
('PP.01.03', 'Pembuatan Shop Drawing / Isometric', 'ls', 0, 'active', '2024'),
('PP.01.04', 'K3 / Safety Equipment', 'ls', 0, 'active', '2024');

-- II. Material Pipa (Supply)
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('PP.02.01', 'Pipa Carbon Steel (Berbagai Size)', 'm\'', 0, 'active', '2024'),
('PP.02.02', 'Pipa Stainless Steel (jika ada)', 'm\'', 0, 'active', '2024'),
('PP.02.03', 'Pipa HDPE / PVC (jika ada)', 'm\'', 0, 'active', '2024'),
('PP.02.04', 'Pipa Galvanized (jika ada)', 'm\'', 0, 'active', '2024');

-- III. Material Fitting & Flange
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('PP.03.01', 'Elbow (45° / 90°)', 'bh', 0, 'active', '2024'),
('PP.03.02', 'Tee / Reducer', 'bh', 0, 'active', '2024'),
('PP.03.03', 'Flange (WN / SO / Blind)', 'bh', 0, 'active', '2024'),
('PP.03.04', 'Gasket & Bolt-Nut Set', 'set', 0, 'active', '2024'),
('PP.03.05', 'Coupling / Union', 'bh', 0, 'active', '2024');

-- IV. Material Valve
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('PP.04.01', 'Gate Valve', 'bh', 0, 'active', '2024'),
('PP.04.02', 'Ball Valve', 'bh', 0, 'active', '2024'),
('PP.04.03', 'Check Valve', 'bh', 0, 'active', '2024'),
('PP.04.04', 'Butterfly Valve', 'bh', 0, 'active', '2024'),
('PP.04.05', 'Globe Valve (jika ada)', 'bh', 0, 'active', '2024');

-- V. Material Support & Hanger
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('PP.05.01', 'Pipe Shoe / Rest', 'bh', 0, 'active', '2024'),
('PP.05.02', 'U-Bolt / Clamp', 'bh', 0, 'active', '2024'),
('PP.05.03', 'Hanger Rod Assembly', 'set', 0, 'active', '2024'),
('PP.05.04', 'Guide & Anchor', 'bh', 0, 'active', '2024'),
('PP.05.05', 'Spring Hanger (jika ada)', 'bh', 0, 'active', '2024');

-- VI. Pekerjaan Fabrikasi Pipa
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('PP.06.01', 'Cutting & Beveling', 'joint', 0, 'active', '2024'),
('PP.06.02', 'Fit-up & Alignment', 'joint', 0, 'active', '2024'),
('PP.06.03', 'Fabrikasi Spool Piece', 'joint', 0, 'active', '2024'),
('PP.06.04', 'Pre-fabrication Welding', 'dia-inch', 0, 'active', '2024');

-- VII. Pekerjaan Ereksi & Instalasi
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('PP.07.01', 'Ereksi Pipa (Elevated)', 'dia-inch', 0, 'active', '2024'),
('PP.07.02', 'Instalasi Pipa (Underground)', 'm\'', 0, 'active', '2024'),
('PP.07.03', 'Instalasi Pipa (Aboveground)', 'dia-inch', 0, 'active', '2024'),
('PP.07.04', 'Pemasangan Valve & Fitting', 'bh', 0, 'active', '2024'),
('PP.07.05', 'Pemasangan Support & Hanger', 'bh', 0, 'active', '2024');

-- VIII. Pekerjaan Pengelasan (Welding)
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('PP.08.01', 'Welding Butt Joint (SMAW/GTAW)', 'dia-inch', 0, 'active', '2024'),
('PP.08.02', 'Welding Socket Joint', 'joint', 0, 'active', '2024'),
('PP.08.03', 'Welding Branch Connection', 'joint', 0, 'active', '2024'),
('PP.08.04', 'NDT — Radiography (RT)', 'film', 0, 'active', '2024'),
('PP.08.05', 'NDT — Dye Penetrant (PT)', 'joint', 0, 'active', '2024');

-- IX. Pekerjaan Testing
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('PP.09.01', 'Hydrotest', 'line', 0, 'active', '2024'),
('PP.09.02', 'Pneumatic Test', 'line', 0, 'active', '2024'),
('PP.09.03', 'Flushing & Cleaning', 'line', 0, 'active', '2024'),
('PP.09.04', 'Service Test / Leak Test', 'line', 0, 'active', '2024');

-- X. Pekerjaan Insulation & Painting
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('PP.10.01', 'Sandblasting / Surface Preparation', 'm2', 0, 'active', '2024'),
('PP.10.02', 'Pengecatan Primer', 'm2', 0, 'active', '2024'),
('PP.10.03', 'Pengecatan Intermediate + Top Coat', 'm2', 0, 'active', '2024'),
('PP.10.04', 'Insulation Pipa (Rockwool/Calcium Silicate)', 'm\'', 0, 'active', '2024'),
('PP.10.05', 'Aluminium Cladding Insulation', 'm\'', 0, 'active', '2024'),
('PP.10.06', 'Color Coding / Labeling', 'm\'', 0, 'active', '2024');

-- XI. Pekerjaan Civil (Pipe Support Foundation)
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('PP.11.01', 'Pondasi Pipe Support', 'bh', 0, 'active', '2024'),
('PP.11.02', 'Pedestal Beton', 'bh', 0, 'active', '2024'),
('PP.11.03', 'Sleeper Beton', 'bh', 0, 'active', '2024'),
('PP.11.04', 'Galian & Urugan Pipa Underground', 'm3', 0, 'active', '2024');


-- =============================================
-- ELECTRICAL (EL)
-- =============================================

-- I. Pekerjaan Persiapan & Mobilisasi
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('EL.01.01', 'Mobilisasi & Demobilisasi', 'ls', 0, 'active', '2024'),
('EL.01.02', 'Survey Rute Kabel & Tray', 'ls', 0, 'active', '2024'),
('EL.01.03', 'Pembuatan Shop Drawing', 'ls', 0, 'active', '2024'),
('EL.01.04', 'K3 / Safety Equipment', 'ls', 0, 'active', '2024');

-- II. Panel & Switchgear
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('EL.02.01', 'Panel MDP (Main Distribution Panel)', 'unit', 0, 'active', '2024'),
('EL.02.02', 'Panel SDP (Sub Distribution Panel)', 'unit', 0, 'active', '2024'),
('EL.02.03', 'Panel Capacitor Bank', 'unit', 0, 'active', '2024'),
('EL.02.04', 'Panel ATS / AMF (jika ada)', 'unit', 0, 'active', '2024'),
('EL.02.05', 'MCC Panel (Motor Control Center)', 'unit', 0, 'active', '2024'),
('EL.02.06', 'Pemasangan & Wiring Panel', 'unit', 0, 'active', '2024');

-- III. Pekerjaan Kabel Power
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('EL.03.01', 'Kabel Power (NYY / XLPE)', 'm\'', 0, 'active', '2024'),
('EL.03.02', 'Kabel Feeder Utama', 'm\'', 0, 'active', '2024'),
('EL.03.03', 'Kabel Distribusi', 'm\'', 0, 'active', '2024'),
('EL.03.04', 'Kabel Tray Filling & Laying', 'm\'', 0, 'active', '2024'),
('EL.03.05', 'Terminasi & Jointing Kabel', 'set', 0, 'active', '2024'),
('EL.03.06', 'Cable Gland & Accessories', 'bh', 0, 'active', '2024');

-- IV. Pekerjaan Cable Tray & Conduit
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('EL.04.01', 'Cable Tray / Ladder Type', 'm\'', 0, 'active', '2024'),
('EL.04.02', 'Cable Tray Perforated', 'm\'', 0, 'active', '2024'),
('EL.04.03', 'Conduit (Rigid / Flexible)', 'm\'', 0, 'active', '2024'),
('EL.04.04', 'Support & Bracket Cable Tray', 'bh', 0, 'active', '2024'),
('EL.04.05', 'Fitting & Accessories', 'set', 0, 'active', '2024');

-- V. Pekerjaan Lighting & Receptacle
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('EL.05.01', 'Lampu LED / TL Industrial', 'bh', 0, 'active', '2024'),
('EL.05.02', 'Lampu Emergency', 'bh', 0, 'active', '2024'),
('EL.05.03', 'Lampu Explosion Proof (jika ada)', 'bh', 0, 'active', '2024'),
('EL.05.04', 'Stop Kontak Industrial', 'bh', 0, 'active', '2024'),
('EL.05.05', 'Switch / Saklar', 'bh', 0, 'active', '2024'),
('EL.05.06', 'Junction Box & Accessories', 'bh', 0, 'active', '2024');

-- VI. Pekerjaan Grounding & Lightning
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('EL.06.01', 'Grounding Rod (Copper)', 'bh', 0, 'active', '2024'),
('EL.06.02', 'Grounding Cable (BC)', 'm\'', 0, 'active', '2024'),
('EL.06.03', 'Grounding Bus Bar', 'bh', 0, 'active', '2024'),
('EL.06.04', 'Penangkal Petir (Lightning Rod)', 'set', 0, 'active', '2024'),
('EL.06.05', 'Down Conductor', 'm\'', 0, 'active', '2024'),
('EL.06.06', 'Testing & Pengukuran Tahanan', 'titik', 0, 'active', '2024');

-- VII. Pekerjaan Instrumentasi
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('EL.07.01', 'Kabel Instrumen (Shielded)', 'm\'', 0, 'active', '2024'),
('EL.07.02', 'Instrument Cable Tray', 'm\'', 0, 'active', '2024'),
('EL.07.03', 'Junction Box Instrumen', 'bh', 0, 'active', '2024'),
('EL.07.04', 'Pemasangan Instrument (Sensor, Transmitter)', 'bh', 0, 'active', '2024'),
('EL.07.05', 'Calibration', 'bh', 0, 'active', '2024');

-- VIII. Pekerjaan Testing & Commissioning
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('EL.08.01', 'Megger Test (Insulation Resistance)', 'titik', 0, 'active', '2024'),
('EL.08.02', 'Continuity Test', 'titik', 0, 'active', '2024'),
('EL.08.03', 'Relay Protection Test', 'titik', 0, 'active', '2024'),
('EL.08.04', 'Phasing & Rotation Check', 'titik', 0, 'active', '2024'),
('EL.08.05', 'Energizing & Load Test', 'titik', 0, 'active', '2024'),
('EL.08.06', 'Commissioning Report', 'ls', 0, 'active', '2024');


-- =============================================
-- MECHANICAL (ME)
-- =============================================

-- I. Pekerjaan Persiapan & Mobilisasi
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('ME.01.01', 'Mobilisasi & Demobilisasi', 'ls', 0, 'active', '2024'),
('ME.01.02', 'Survey & Layout', 'ls', 0, 'active', '2024'),
('ME.01.03', 'Pembuatan Shop Drawing', 'ls', 0, 'active', '2024'),
('ME.01.04', 'K3 / Safety Equipment', 'ls', 0, 'active', '2024');

-- II. Material & Equipment Supply
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('ME.02.01', 'Material Plat / Profil Baja', 'kg', 0, 'active', '2024'),
('ME.02.02', 'Material Baut, Mur, Washer', 'kg', 0, 'active', '2024'),
('ME.02.03', 'Welding Consumable', 'kg', 0, 'active', '2024'),
('ME.02.04', 'Equipment / Machinery Supply', 'unit', 0, 'active', '2024');

-- III. Pekerjaan Fabrikasi
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('ME.03.01', 'Cutting & Marking', 'kg', 0, 'active', '2024'),
('ME.03.02', 'Drilling & Punching', 'bh', 0, 'active', '2024'),
('ME.03.03', 'Rolling & Bending', 'kg', 0, 'active', '2024'),
('ME.03.04', 'Pengelasan Fabrikasi', 'cm', 0, 'active', '2024'),
('ME.03.05', 'Assembly / Sub-assembly', 'kg', 0, 'active', '2024'),
('ME.03.06', 'Trial Assembly (jika ada)', 'ls', 0, 'active', '2024'),
('ME.03.07', 'Quality Inspection (QC)', 'ls', 0, 'active', '2024');

-- IV. Pekerjaan Erection & Instalasi
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('ME.04.01', 'Rigging & Lifting', 'ton', 0, 'active', '2024'),
('ME.04.02', 'Setting / Alignment Equipment', 'unit', 0, 'active', '2024'),
('ME.04.03', 'Bolting & Tightening', 'set', 0, 'active', '2024'),
('ME.04.04', 'Grouting (Epoxy / Cementitious)', 'm2', 0, 'active', '2024'),
('ME.04.05', 'Shaft Alignment (jika rotating)', 'unit', 0, 'active', '2024'),
('ME.04.06', 'Piping Connection', 'joint', 0, 'active', '2024');

-- V. Pekerjaan Piping Terkait
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('ME.05.01', 'Piping Inlet / Outlet Equipment', 'joint', 0, 'active', '2024'),
('ME.05.02', 'Drain & Vent Piping', 'm\'', 0, 'active', '2024'),
('ME.05.03', 'Cooling Water Piping', 'm\'', 0, 'active', '2024'),
('ME.05.04', 'Instrument Piping (Tubing)', 'm\'', 0, 'active', '2024');

-- VI. Pekerjaan Electrical Terkait
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('ME.06.01', 'Kabel Power Motor', 'm\'', 0, 'active', '2024'),
('ME.06.02', 'Kabel Instrument / Signal', 'm\'', 0, 'active', '2024'),
('ME.06.03', 'Junction Box / Terminal Box', 'bh', 0, 'active', '2024'),
('ME.06.04', 'Local Panel (jika ada)', 'unit', 0, 'active', '2024');

-- VII. Pekerjaan Insulation & Painting
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('ME.07.01', 'Surface Preparation', 'm2', 0, 'active', '2024'),
('ME.07.02', 'Pengecatan Primer + Top Coat', 'm2', 0, 'active', '2024'),
('ME.07.03', 'Insulation (jika ada)', 'm2', 0, 'active', '2024'),
('ME.07.04', 'Fireproofing (jika ada)', 'm2', 0, 'active', '2024');

-- VIII. Testing & Commissioning
INSERT INTO ahsp_headers (kode, name, satuan, harga_satuan, status, version) VALUES
('ME.08.01', 'No-Load Test / Solo Run', 'unit', 0, 'active', '2024'),
('ME.08.02', 'Performance Test', 'unit', 0, 'active', '2024'),
('ME.08.03', 'Vibration Test', 'unit', 0, 'active', '2024'),
('ME.08.04', 'Commissioning & Handover', 'unit', 0, 'active', '2024');


-- ============================================================
-- Verify counts
-- ============================================================
SELECT 
  CASE 
    WHEN kode LIKE 'CB.%' THEN 'Civil Bangunan'
    WHEN kode LIKE 'CS.%' THEN 'Civil Struktur'
    WHEN kode LIKE 'PP.%' THEN 'Piping'
    WHEN kode LIKE 'EL.%' THEN 'Electrical'
    WHEN kode LIKE 'ME.%' THEN 'Mechanical'
  END AS work_type,
  COUNT(*) AS total
FROM ahsp_headers 
WHERE kode LIKE 'CB.%' OR kode LIKE 'CS.%' OR kode LIKE 'PP.%' OR kode LIKE 'EL.%' OR kode LIKE 'ME.%'
GROUP BY work_type
ORDER BY work_type;
