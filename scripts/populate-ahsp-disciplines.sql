-- ============================================================
-- Populate Sub-Disciplines and Map AHSP Items
-- ============================================================

-- ============================================================
-- STEP 1: Create Sub-Disciplines for Civil (discipline_id=1)
-- CB sections: I-XIII map to Civil sub-disciplines
-- ============================================================
-- Civil already has: 1=Persiapan, 2=Pondasi, 3=Saluran, 4=Struktur
-- Need to add the rest for Civil Bangunan template

INSERT INTO master_sub_disciplines (discipline_id, code, name, order_no, is_active) VALUES
-- Civil Bangunan sub-disciplines (extend existing)
(1, 'TANAH', 'Pekerjaan Tanah', 5, 1),
(1, 'DINDING', 'Pekerjaan Dinding & Pasangan', 6, 1),
(1, 'ATAP', 'Pekerjaan Atap & Rangka', 7, 1),
(1, 'PLAFOND', 'Pekerjaan Plafond', 8, 1),
(1, 'LANTAI', 'Pekerjaan Lantai', 9, 1),
(1, 'PINTUJENDELA', 'Pekerjaan Pintu & Jendela', 10, 1),
(1, 'PENGECATAN', 'Pekerjaan Pengecatan', 11, 1),
(1, 'SANITASI', 'Pekerjaan Sanitasi & Plumbing', 12, 1),
(1, 'LISTRIK', 'Pekerjaan Listrik', 13, 1),
(1, 'FINISHING', 'Pekerjaan Lain-lain & Finishing', 14, 1);

-- ============================================================
-- STEP 2: Create Sub-Disciplines for Steel Structure (discipline_id=2)
-- CS sections: I-IX
-- ============================================================
INSERT INTO master_sub_disciplines (discipline_id, code, name, order_no, is_active) VALUES
(2, 'PERSIAPAN', 'Pekerjaan Persiapan', 1, 1),
(2, 'TANAH', 'Pekerjaan Tanah', 2, 1),
(2, 'PONDASI', 'Pekerjaan Pondasi & Pedestal', 3, 1),
(2, 'BETON', 'Pekerjaan Beton (Tie Beam, Slab, RW)', 4, 1),
(2, 'FABRIKASI', 'Fabrikasi & Erection Baja', 5, 1),
(2, 'CLADDING', 'Cladding & Roofing', 6, 1),
(2, 'FLOOR', 'Floor Finishing', 7, 1),
(2, 'DRAINASE', 'Drainase & Utilitas', 8, 1),
(2, 'SITEWORK', 'Site Work & Finishing', 9, 1);

-- ============================================================
-- STEP 3: Create Sub-Disciplines for Piping (discipline_id=3)
-- PP sections: I-XI
-- ============================================================
INSERT INTO master_sub_disciplines (discipline_id, code, name, order_no, is_active) VALUES
(3, 'PERSIAPAN', 'Pekerjaan Persiapan', 1, 1),
(3, 'MATERIAL_PIPE', 'Material Pipa', 2, 1),
(3, 'FITTING', 'Fitting & Accessories', 3, 1),
(3, 'VALVE', 'Valve', 4, 1),
(3, 'SUPPORT', 'Pipe Support', 5, 1),
(3, 'FABRIKASI', 'Fabrikasi', 6, 1),
(3, 'ERECTION', 'Erection & Instalasi', 7, 1),
(3, 'WELDING', 'Welding & NDT', 8, 1),
(3, 'TESTING', 'Testing & Flushing', 9, 1),
(3, 'PAINTING', 'Painting & Insulation', 10, 1),
(3, 'CIVILWORK', 'Civil Work Piping', 11, 1);

-- ============================================================
-- STEP 4: Create Sub-Disciplines for Electrical (discipline_id=4)
-- EL sections: I-VIII
-- ============================================================
INSERT INTO master_sub_disciplines (discipline_id, code, name, order_no, is_active) VALUES
(4, 'PERSIAPAN', 'Pekerjaan Persiapan', 1, 1),
(4, 'PANEL', 'Panel & Switchgear', 2, 1),
(4, 'KABEL', 'Kabel & Terminasi', 3, 1),
(4, 'TRAY', 'Cable Tray & Conduit', 4, 1),
(4, 'LIGHTING', 'Penerangan & Accessories', 5, 1),
(4, 'GROUNDING', 'Grounding & Lightning Protection', 6, 1),
(4, 'INSTRUMENT', 'Instrument & Control', 7, 1),
(4, 'COMMISSIONING', 'Testing & Commissioning', 8, 1);

-- ============================================================
-- STEP 5: Create Sub-Disciplines for Mechanical (discipline_id=5)
-- ME sections: I-VIII
-- ============================================================
INSERT INTO master_sub_disciplines (discipline_id, code, name, order_no, is_active) VALUES
(5, 'PERSIAPAN', 'Pekerjaan Persiapan', 1, 1),
(5, 'MATERIAL', 'Material Supply', 2, 1),
(5, 'FABRIKASI', 'Fabrikasi', 3, 1),
(5, 'ERECTION', 'Erection & Installation', 4, 1),
(5, 'PIPING_CONN', 'Piping Connection', 5, 1),
(5, 'ELECTRICAL_CONN', 'Electrical Connection', 6, 1),
(5, 'PAINTING', 'Painting & Insulation', 7, 1),
(5, 'COMMISSIONING', 'Testing & Commissioning', 8, 1);

-- ============================================================
-- STEP 6: Map AHSP to Sub-Disciplines
-- Using sub-query to get newly created sub_discipline IDs
-- ============================================================

-- CB.01.xx → Civil / Pekerjaan Persiapan (sub_discipline_id=1)
INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, 1 FROM ahsp_headers h WHERE h.kode LIKE 'CB.01.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

-- CB.02.xx → Civil / Pekerjaan Tanah
INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=1 AND code='TANAH' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'CB.02.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

-- CB.03.xx → Civil / Pekerjaan Pondasi (sub_discipline_id=2)
INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, 2 FROM ahsp_headers h WHERE h.kode LIKE 'CB.03.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

-- CB.04.xx → Civil / Pekerjaan Struktur (sub_discipline_id=4)
INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, 4 FROM ahsp_headers h WHERE h.kode LIKE 'CB.04.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

-- CB.05.xx → Civil / Dinding & Pasangan
INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=1 AND code='DINDING' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'CB.05.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

-- CB.06.xx → Civil / Atap & Rangka
INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=1 AND code='ATAP' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'CB.06.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

-- CB.07.xx → Civil / Plafond
INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=1 AND code='PLAFOND' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'CB.07.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

-- CB.08.xx → Civil / Lantai
INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=1 AND code='LANTAI' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'CB.08.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

-- CB.09.xx → Civil / Pintu & Jendela
INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=1 AND code='PINTUJENDELA' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'CB.09.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

-- CB.10.xx → Civil / Pengecatan
INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=1 AND code='PENGECATAN' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'CB.10.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

-- CB.11.xx → Civil / Sanitasi & Plumbing
INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=1 AND code='SANITASI' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'CB.11.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

-- CB.12.xx → Civil / Listrik
INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=1 AND code='LISTRIK' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'CB.12.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

-- CB.13.xx → Civil / Finishing
INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=1 AND code='FINISHING' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'CB.13.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

-- ============================================================
-- CS → Steel Structure (discipline_id=2)
-- ============================================================
INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=2 AND code='PERSIAPAN' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'CS.01.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=2 AND code='TANAH' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'CS.02.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=2 AND code='PONDASI' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'CS.03.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=2 AND code='BETON' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'CS.04.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=2 AND code='FABRIKASI' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'CS.05.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=2 AND code='CLADDING' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'CS.06.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=2 AND code='FLOOR' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'CS.07.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=2 AND code='DRAINASE' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'CS.08.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=2 AND code='SITEWORK' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'CS.09.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

-- ============================================================
-- PP → Piping (discipline_id=3)
-- ============================================================
INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=3 AND code='PERSIAPAN' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'PP.01.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=3 AND code='MATERIAL_PIPE' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'PP.02.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=3 AND code='FITTING' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'PP.03.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=3 AND code='VALVE' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'PP.04.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=3 AND code='SUPPORT' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'PP.05.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=3 AND code='FABRIKASI' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'PP.06.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=3 AND code='ERECTION' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'PP.07.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=3 AND code='WELDING' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'PP.08.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=3 AND code='TESTING' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'PP.09.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=3 AND code='PAINTING' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'PP.10.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=3 AND code='CIVILWORK' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'PP.11.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

-- ============================================================
-- EL → Electrical (discipline_id=4)
-- ============================================================
INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=4 AND code='PERSIAPAN' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'EL.01.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=4 AND code='PANEL' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'EL.02.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=4 AND code='KABEL' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'EL.03.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=4 AND code='TRAY' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'EL.04.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=4 AND code='LIGHTING' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'EL.05.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=4 AND code='GROUNDING' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'EL.06.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=4 AND code='INSTRUMENT' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'EL.07.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=4 AND code='COMMISSIONING' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'EL.08.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

-- ============================================================
-- ME → Mechanical (discipline_id=5)
-- ============================================================
INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=5 AND code='PERSIAPAN' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'ME.01.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=5 AND code='MATERIAL' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'ME.02.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=5 AND code='FABRIKASI' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'ME.03.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=5 AND code='ERECTION' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'ME.04.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=5 AND code='PIPING_CONN' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'ME.05.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=5 AND code='ELECTRICAL_CONN' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'ME.06.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=5 AND code='PAINTING' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'ME.07.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id)
SELECT h.id, (SELECT id FROM master_sub_disciplines WHERE discipline_id=5 AND code='COMMISSIONING' LIMIT 1)
FROM ahsp_headers h WHERE h.kode LIKE 'ME.08.%'
ON DUPLICATE KEY UPDATE sub_discipline_id=sub_discipline_id;

-- Verify
SELECT 'Sub-disciplines created:' as info, COUNT(*) as cnt FROM master_sub_disciplines WHERE discipline_id IN (1,2,3,4,5);
SELECT 'AHSP mapped:' as info, COUNT(*) as cnt FROM ahsp_sub_discipline_map WHERE ahsp_id >= 3758;
