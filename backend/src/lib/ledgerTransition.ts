import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Migrations released under the earlier numbering. A ledger row is recognised only when the
// filename AND the exact checksum of that release both match, so unknown historical content
// is refused rather than silently re-labelled onto a canonical version.
// canonical === null means the migration was retired because another file subsumes it.

interface ReleasedMigration {
  released: string;
  sha256: string;
  canonical: string | null;
}

const RELEASED_MIGRATIONS: ReleasedMigration[] = [
  { released: '001_approval_columns.sql', sha256: 'acd3f75de9e230ee484102f034df25ee41b072febadbebdd2d5c41c3198d6e48', canonical: '021_approval_columns.sql' },
  { released: '002_bom_approval.sql', sha256: 'bd6c35e27c8f9726b38d07f198c04ac0a83751ab848917bdd2288065437ee89d', canonical: '022_bom_approval.sql' },
  { released: '003_quality_tables.sql', sha256: '494683c58d8df487c192793e44552fa6ab0d5e84e96c26a6822d6764fb02b982', canonical: '023_quality_tables.sql' },
  { released: '004_approval_delegation_escalation.sql', sha256: '38eae13a3d69547b321ccee1cad005e6d7937b9d9ecceb8455856a83877d37f0', canonical: '024_approval_delegation_escalation.sql' },
  { released: '0041_qc_tables.sql', sha256: '7bc5e6f9192bad15c9511f8f47e2c80afb73a42d1a360ac156aa15357016abeb', canonical: null },
  { released: '005_leads_project_folders.sql', sha256: '20341ae8ca8911889f2210fa064a518b42c9ff24d8538923ca8f6245503a67a5', canonical: '025_leads_project_folders.sql' },
  { released: '006_qc_cycle2.sql', sha256: '6cc4b2b57936033838a3a38295414a7d9d78cc04345412db3570c1ed29a88e44', canonical: '026_qc_cycle2.sql' },
  { released: '007_inventory_lot_tracking.sql', sha256: '05af06f785bce578e6da7072ad75ae396b20c831b2057da43e02a23f69400a48', canonical: '027_inventory_lot_tracking.sql' },
  { released: '008_vendor_to_masters.sql', sha256: 'e654b28a4d5d2a405e886e117879140d1515c629de1e73cf79e2fb7b567a22e1', canonical: '028_vendor_to_masters.sql' },
  { released: '009_cost_control.sql', sha256: 'abbee8a5996ac8cc8e98da40bbc83cf7f1a656014c6fed97261044fb967bfe9d', canonical: '029_cost_control.sql' },
  { released: '010_projects_module.sql', sha256: 'b6fbc528c8478b72c48a3ac90e18ba5a4c21b328d4955cb923ba1fd619f82f82', canonical: '010_projects_module.sql' },
  { released: '011_proposal_workflow.sql', sha256: 'e7f14aa31e5fe43614c70af538ca2035d1eb700db2421700b628c8a43e453dd5', canonical: '031_proposal_workflow.sql' },
  { released: '012_document_folders.sql', sha256: '57724e49289e8ec7223ebf7d85da3d92414d0302e93e93a8ace04014a8392f90', canonical: '032_document_folders.sql' },
  { released: '013_fg_idempotency_key.sql', sha256: '3adeffbe6510c5abf5b52af4af3966d38a8f5cd205c301ef5eacf64130d2a305', canonical: '033_fg_idempotency_key.sql' },
  { released: '014_wo_uniqueness.sql', sha256: 'd6c7694ad75a541618bae9d3e9ca7dbafda05a3733f251131c9c887b4f6e9e03', canonical: '034_wo_uniqueness.sql' },
  { released: '015_wo_material_issues.sql', sha256: 'f386aa2cc1798fa5846fbef800da236a2ac98d7f13befeaf624eae84edf0cde6', canonical: '035_wo_material_issues.sql' },
  { released: '016_inventory_lot_identity.sql', sha256: '049424e487b787f7b98ca22d44a7bb25ab4aff7aa7f856ad1d86be642ba5faf1', canonical: '036_inventory_lot_identity.sql' },
  { released: '017_canonical_lot_contract.sql', sha256: '98bc5187b3bb77f393781f8b8ab74b589738e5e9c4e343445edb672d94cac1a7', canonical: '037_canonical_lot_contract.sql' },
  { released: '018_product_qc_policy.sql', sha256: '9ef1c3df1fa77341693b53d599f03977e490e4f00c4e32c503bb7daccc557f7c', canonical: '038_product_qc_policy.sql' },
  { released: '019_schema_convergence.sql', sha256: 'fc9592dccb32ac0691b49d37c7d2eb58cd5422985571d55c3bf91a882c55ae81', canonical: '039_schema_convergence.sql' },
  { released: '020_consolidate_runtime_ddl.sql', sha256: 'c12eb04e4e4176774fafd9ac49815670a0341c913be2aad29e69b0c152ebe334', canonical: '009_runtime_ddl_consolidation.sql' },
  { released: '021_rnd_module.sql', sha256: 'af5809cf8a971a741e0d04b75f71994bcfbdffffc38c03ee4bf83750d96a9b16', canonical: '041_rnd_module.sql' },
  { released: '022_rnd_milestones_docs.sql', sha256: '79a8e783ead877ef2e0ee705d1df7123580aad15eed7b35b5b9d10c6b0523c56', canonical: '042_rnd_milestones_docs.sql' },
  { released: '023_rnd_project_tasks.sql', sha256: 'c67629c6d9e9177baf0816422afe153d65a91a206f35870f223e27be9bf9de1f', canonical: '043_rnd_project_tasks.sql' },
  { released: '024_upgrade_rnd_projects.sql', sha256: '0638db405f3303f18db86c74a3cca9e67e6ee66a2a2cef5032ee759204e980ec', canonical: '044_upgrade_rnd_projects.sql' },
];

export interface TransitionResult {
  transitioned: string[];
  retired: string[];
  errors: string[];
}

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

async function ensureAudit(conn: any) {
  await conn.query(
    `CREATE TABLE IF NOT EXISTS _migration_transitions (
      id INT PRIMARY KEY AUTO_INCREMENT,
      old_version INT NOT NULL,
      old_filename VARCHAR(255) NOT NULL,
      old_sha256 VARCHAR(64) NOT NULL,
      new_version INT NULL,
      new_filename VARCHAR(255) NULL,
      new_sha256 VARCHAR(64) NULL,
      outcome VARCHAR(20) NOT NULL,
      transitioned_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

function versionOf(filename: string): number {
  const m = filename.match(/^(\d+)[_-]/);
  return m ? parseInt(m[1], 10) : -1;
}

/**
 * Re-point ledger rows written under the previous numbering onto the canonical stream.
 * Every row is validated before anything is mutated, so a partial transition cannot occur.
 */
export async function applyLedgerTransition(conn: any, migrationDir: string): Promise<TransitionResult> {
  const result: TransitionResult = { transitioned: [], retired: [], errors: [] };

  const present = new Set(fs.readdirSync(migrationDir).filter(f => f.endsWith('.sql')));
  const [rows]: any = await conn.query('SELECT version, filename, sha256 FROM _migration_ledger WHERE version > 0');

  const stale = rows.filter((r: any) => !present.has(r.filename));
  if (stale.length === 0) return result;

  const planned: Array<{ row: any; target: string | null; newSha: string | null }> = [];

  for (const row of stale) {
    const known = RELEASED_MIGRATIONS.find(m => m.released === row.filename);
    if (!known) {
      result.errors.push(
        `SCHEMA_UNSUPPORTED: ledger records "${row.filename}" (version ${row.version}), which is not a known release of this repository`
      );
      continue;
    }
    if (known.sha256 !== row.sha256) {
      result.errors.push(
        `SCHEMA_UNSUPPORTED: "${row.filename}" was applied with checksum ${row.sha256.substring(0, 12)}..., which is not the released content ${known.sha256.substring(0, 12)}...`
      );
      continue;
    }
    if (known.canonical === null) {
      planned.push({ row, target: null, newSha: null });
      continue;
    }
    if (!present.has(known.canonical)) {
      result.errors.push(
        `SCHEMA_UNSUPPORTED: "${row.filename}" maps to "${known.canonical}", which is missing from the migration directory`
      );
      continue;
    }
    const newSha = sha256(fs.readFileSync(path.join(migrationDir, known.canonical), 'utf-8'));
    planned.push({ row, target: known.canonical, newSha });
  }

  if (result.errors.length > 0) return result;

  await ensureAudit(conn);

  // retire first, then remap in two phases: the old and new version spaces overlap, so
  // writing a final version directly can collide with a row that has not moved yet
  for (const p of planned.filter(x => x.target === null)) {
    await conn.query('DELETE FROM _migration_ledger WHERE filename = ?', [p.row.filename]);
    await conn.query(
      'INSERT INTO _migration_transitions (old_version, old_filename, old_sha256, outcome) VALUES (?, ?, ?, ?)',
      [p.row.version, p.row.filename, p.row.sha256, 'RETIRED']
    );
    result.retired.push(p.row.filename);
  }

  const remaps = planned.filter(x => x.target !== null);

  // park every row in a version range no real migration can occupy
  for (let i = 0; i < remaps.length; i++) {
    await conn.query('UPDATE _migration_ledger SET version = ? WHERE filename = ?', [-(i + 1), remaps[i].row.filename]);
  }

  for (let i = 0; i < remaps.length; i++) {
    const p = remaps[i];
    const newVersion = versionOf(p.target as string);
    await conn.query('UPDATE _migration_ledger SET version = ?, filename = ?, sha256 = ? WHERE version = ?', [
      newVersion,
      p.target,
      p.newSha,
      -(i + 1),
    ]);
    await conn.query(
      'INSERT INTO _migration_transitions (old_version, old_filename, old_sha256, new_version, new_filename, new_sha256, outcome) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [p.row.version, p.row.filename, p.row.sha256, newVersion, p.target, p.newSha, 'REMAPPED']
    );
    result.transitioned.push(`${p.row.filename} -> ${p.target}`);
  }

  return result;
}
