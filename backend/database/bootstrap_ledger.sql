-- HISTORICAL RECORD - DO NOT RUN AGAINST A LIVE DATABASE.
--
-- These rows describe the ledger as it existed under the previous migration numbering.
-- Executing this file marks migrations as applied without proving their DDL ever ran.
--
-- The same (filename, checksum) pairs are now encoded in backend/src/lib/ledgerTransition.ts,
-- which re-points a legacy ledger onto the canonical stream and refuses unknown content.
-- The file is retained so that mapping can be audited, and is used as a fixture by
-- "npm run migrate:verify" to prove the transition works.

INSERT IGNORE INTO _migration_ledger (version, filename, sha256, applied_by) VALUES (1, '001_approval_columns.sql', 'acd3f75de9e230ee484102f034df25ee41b072febadbebdd2d5c41c3198d6e48', 'manual_bootstrap');
INSERT IGNORE INTO _migration_ledger (version, filename, sha256, applied_by) VALUES (2, '002_bom_approval.sql', 'bd6c35e27c8f9726b38d07f198c04ac0a83751ab848917bdd2288065437ee89d', 'manual_bootstrap');
INSERT IGNORE INTO _migration_ledger (version, filename, sha256, applied_by) VALUES (3, '003_quality_tables.sql', '494683c58d8df487c192793e44552fa6ab0d5e84e96c26a6822d6764fb02b982', 'manual_bootstrap');
INSERT IGNORE INTO _migration_ledger (version, filename, sha256, applied_by) VALUES (4, '004_approval_delegation_escalation.sql', '38eae13a3d69547b321ccee1cad005e6d7937b9d9ecceb8455856a83877d37f0', 'manual_bootstrap');
INSERT IGNORE INTO _migration_ledger (version, filename, sha256, applied_by) VALUES (41, '0041_qc_tables.sql', '7bc5e6f9192bad15c9511f8f47e2c80afb73a42d1a360ac156aa15357016abeb', 'manual_bootstrap');
INSERT IGNORE INTO _migration_ledger (version, filename, sha256, applied_by) VALUES (5, '005_leads_project_folders.sql', '20341ae8ca8911889f2210fa064a518b42c9ff24d8538923ca8f6245503a67a5', 'manual_bootstrap');
INSERT IGNORE INTO _migration_ledger (version, filename, sha256, applied_by) VALUES (6, '006_qc_cycle2.sql', '6cc4b2b57936033838a3a38295414a7d9d78cc04345412db3570c1ed29a88e44', 'manual_bootstrap');
INSERT IGNORE INTO _migration_ledger (version, filename, sha256, applied_by) VALUES (7, '007_inventory_lot_tracking.sql', '05af06f785bce578e6da7072ad75ae396b20c831b2057da43e02a23f69400a48', 'manual_bootstrap');
INSERT IGNORE INTO _migration_ledger (version, filename, sha256, applied_by) VALUES (8, '008_vendor_to_masters.sql', 'e654b28a4d5d2a405e886e117879140d1515c629de1e73cf79e2fb7b567a22e1', 'manual_bootstrap');
INSERT IGNORE INTO _migration_ledger (version, filename, sha256, applied_by) VALUES (9, '009_cost_control.sql', 'abbee8a5996ac8cc8e98da40bbc83cf7f1a656014c6fed97261044fb967bfe9d', 'manual_bootstrap');
INSERT IGNORE INTO _migration_ledger (version, filename, sha256, applied_by) VALUES (10, '010_projects_module.sql', 'b6fbc528c8478b72c48a3ac90e18ba5a4c21b328d4955cb923ba1fd619f82f82', 'manual_bootstrap');
INSERT IGNORE INTO _migration_ledger (version, filename, sha256, applied_by) VALUES (11, '011_proposal_workflow.sql', 'e7f14aa31e5fe43614c70af538ca2035d1eb700db2421700b628c8a43e453dd5', 'manual_bootstrap');
INSERT IGNORE INTO _migration_ledger (version, filename, sha256, applied_by) VALUES (12, '012_document_folders.sql', '57724e49289e8ec7223ebf7d85da3d92414d0302e93e93a8ace04014a8392f90', 'manual_bootstrap');
INSERT IGNORE INTO _migration_ledger (version, filename, sha256, applied_by) VALUES (13, '013_fg_idempotency_key.sql', '3adeffbe6510c5abf5b52af4af3966d38a8f5cd205c301ef5eacf64130d2a305', 'manual_bootstrap');
INSERT IGNORE INTO _migration_ledger (version, filename, sha256, applied_by) VALUES (14, '014_wo_uniqueness.sql', 'd6c7694ad75a541618bae9d3e9ca7dbafda05a3733f251131c9c887b4f6e9e03', 'manual_bootstrap');
INSERT IGNORE INTO _migration_ledger (version, filename, sha256, applied_by) VALUES (15, '015_wo_material_issues.sql', 'f386aa2cc1798fa5846fbef800da236a2ac98d7f13befeaf624eae84edf0cde6', 'manual_bootstrap');
INSERT IGNORE INTO _migration_ledger (version, filename, sha256, applied_by) VALUES (16, '016_inventory_lot_identity.sql', '049424e487b787f7b98ca22d44a7bb25ab4aff7aa7f856ad1d86be642ba5faf1', 'manual_bootstrap');
INSERT IGNORE INTO _migration_ledger (version, filename, sha256, applied_by) VALUES (17, '017_canonical_lot_contract.sql', '98bc5187b3bb77f393781f8b8ab74b589738e5e9c4e343445edb672d94cac1a7', 'manual_bootstrap');
INSERT IGNORE INTO _migration_ledger (version, filename, sha256, applied_by) VALUES (18, '018_product_qc_policy.sql', '9ef1c3df1fa77341693b53d599f03977e490e4f00c4e32c503bb7daccc557f7c', 'manual_bootstrap');
INSERT IGNORE INTO _migration_ledger (version, filename, sha256, applied_by) VALUES (19, '019_schema_convergence.sql', 'fc9592dccb32ac0691b49d37c7d2eb58cd5422985571d55c3bf91a882c55ae81', 'manual_bootstrap');
INSERT IGNORE INTO _migration_ledger (version, filename, sha256, applied_by) VALUES (20, '020_consolidate_runtime_ddl.sql', 'c12eb04e4e4176774fafd9ac49815670a0341c913be2aad29e69b0c152ebe334', 'manual_bootstrap');
INSERT IGNORE INTO _migration_ledger (version, filename, sha256, applied_by) VALUES (21, '021_rnd_module.sql', 'af5809cf8a971a741e0d04b75f71994bcfbdffffc38c03ee4bf83750d96a9b16', 'manual_bootstrap');
INSERT IGNORE INTO _migration_ledger (version, filename, sha256, applied_by) VALUES (22, '022_rnd_milestones_docs.sql', '79a8e783ead877ef2e0ee705d1df7123580aad15eed7b35b5b9d10c6b0523c56', 'manual_bootstrap');
INSERT IGNORE INTO _migration_ledger (version, filename, sha256, applied_by) VALUES (23, '023_rnd_project_tasks.sql', 'c67629c6d9e9177baf0816422afe153d65a91a206f35870f223e27be9bf9de1f', 'manual_bootstrap');
INSERT IGNORE INTO _migration_ledger (version, filename, sha256, applied_by) VALUES (24, '024_upgrade_rnd_projects.sql', '0638db405f3303f18db86c74a3cca9e67e6ee66a2a2cef5032ee759204e980ec', 'manual_bootstrap');
