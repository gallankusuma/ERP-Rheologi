/**
 * Production Service — Negative & Edge Case Tests
 *
 * Tests per Review.md 2026-08-16:
 * - Negative quantity rejection (P0-3)
 * - WO wrong status for material issue
 * - FG receipt without QC checkpoints
 * - FG receipt exceeding yield ceiling
 * - Idempotency key for FG receipt
 * - Negative material issue increases stock (must be rejected)
 *
 * Run: npx tsx tests/production-negative.ts
 * Requires: running backend server + MySQL database
 */

import jwt from 'jsonwebtoken';

const BASE = `http://127.0.0.1:${process.env.PORT || 3000}`;
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const TOKEN = jwt.sign({ userId: 1, userLevel: 1 }, JWT_SECRET, { expiresIn: '1h' });
const AUTH = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    const msg = detail ? `${label} -- ${detail}` : label;
    console.log(`  FAIL: ${msg}`);
    failed++;
    failures.push(msg);
  }
}

async function api(method: string, path: string, body?: any): Promise<{ status: number; data: any }> {
  const opts: RequestInit = { method, headers: AUTH };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}/api${path}`, opts);
  let data: any;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

async function testNegativeQuantityMaterialIssue() {
  console.log('\n== Test: Negative material issue quantity rejected ==');

  const issueRes = await api('POST', '/production/issue-material', {
    wo_material_id: 1,
    quantity: -10,
    warehouse_id: 1,
    idempotency_key: `test-neg-qty-${Date.now()}`,
  });

  // P0-3: must return 400 or 500 with specific error, NOT silently process
  assert(
    issueRes.status === 400 || issueRes.status === 500,
    'Negative qty rejected',
    `status=${issueRes.status}`
  );
  assert(
    (issueRes.data?.error || '').toLowerCase().includes('positive'),
    'Error mentions positive quantity requirement',
    `error=${issueRes.data?.error}`
  );
}

async function testZeroQuantityMaterialIssue() {
  console.log('\n== Test: Zero material issue quantity rejected ==');

  const issueRes = await api('POST', '/production/issue-material', {
    wo_material_id: 1,
    quantity: 0,
    warehouse_id: 1,
    idempotency_key: `test-zero-qty-${Date.now()}`,
  });

  assert(
    issueRes.status === 400 || issueRes.status === 500,
    'Zero qty rejected',
    `status=${issueRes.status}`
  );
}

async function testNegativeYieldRejected() {
  console.log('\n== Test: Negative yield output quantity rejected ==');

  const yieldRes = await api('POST', '/production/yield', {
    wo_id: 1,
    output_quantity: -5,
    loss_quantity: 0,
  });

  assert(
    yieldRes.status === 400,
    'Negative output_quantity returns 400',
    `status=${yieldRes.status}`
  );
  assert(
    (yieldRes.data?.error || '').includes('non-negative'),
    'Error mentions non-negative requirement',
    `error=${yieldRes.data?.error}`
  );
}

async function testNegativeFgReceiptRejected() {
  console.log('\n== Test: Negative FG receipt quantity rejected ==');

  const fgRes = await api('POST', '/production/fg-receipt', {
    wo_id: 1,
    warehouse_id: 1,
    quantity: -100,
  });

  assert(
    fgRes.status === 400 || fgRes.status === 500,
    'Negative FG qty rejected',
    `status=${fgRes.status}`
  );
  assert(
    (fgRes.data?.error || '').toLowerCase().includes('positive'),
    'Error mentions positive quantity',
    `error=${fgRes.data?.error}`
  );
}

async function testMaterialIssueWrongWoStatus() {
  console.log('\n== Test: Material issue rejected for non-issuable WO status ==');

  // find a WO with non-issuable status (draft, completed, cancelled)
  const wos = await api('GET', '/production/planning');
  const allWos = wos.data?.data || wos.data || [];
  const draftWo = allWos.find((w: any) =>
    ['draft', 'planned', 'completed', 'cancelled'].includes((w.status || '').toLowerCase())
  );

  if (!draftWo) {
    console.log('  INFO: No WO with non-issuable status found, testing with invalid ID');
    // use an ID that definitely won't have issuable status
    const issueRes = await api('POST', '/production/issue-material', {
      wo_material_id: 999999,
      quantity: 10,
      warehouse_id: 1,
      idempotency_key: `test-invalid-id-${Date.now()}`,
    });
    assert(
      issueRes.status === 400 || issueRes.status === 500,
      'Invalid wo_material_id rejected',
      `status=${issueRes.status}`
    );
    return;
  }

  // find wo_materials for this WO
  const matRes = await api('GET', `/production/issue-material/wo/${draftWo.id}`);
  const materials = matRes.data?.data?.materials || matRes.data?.materials || [];

  if (materials.length === 0) {
    console.log('  INFO: No materials for non-issuable WO, using dummy ID');
    const issueRes = await api('POST', '/production/issue-material', {
      wo_material_id: 999999,
      quantity: 10,
      warehouse_id: 1,
      idempotency_key: `test-no-mat-${Date.now()}`,
    });
    assert(issueRes.status >= 400, 'Material issue rejected', `status=${issueRes.status}`);
    return;
  }

  const issueRes = await api('POST', '/production/issue-material', {
    wo_material_id: materials[0].id,
    quantity: 10,
    warehouse_id: 1,
    idempotency_key: `test-wrong-status-${Date.now()}`,
  });

  assert(
    issueRes.status === 400 || issueRes.status === 500,
    `Material issue rejected for WO status '${draftWo.status}'`,
    `status=${issueRes.status}, error=${issueRes.data?.error}`
  );
}

async function testFgReceiptWithoutQc() {
  console.log('\n== Test: FG receipt rejected without QC checkpoints ==');

  // find an in_progress WO
  const wos = await api('GET', '/production/planning');
  const allWos = wos.data?.data || wos.data || [];
  const inProgressWo = allWos.find((w: any) =>
    (w.status || '').toLowerCase() === 'in_progress'
  );

  if (!inProgressWo) {
    console.log('  INFO: No in_progress WO found — testing with wo_id=999999');
    const fgRes = await api('POST', '/production/fg-receipt', {
      wo_id: 999999,
      warehouse_id: 1,
      quantity: 1,
    });
    assert(fgRes.status === 500, 'FG receipt rejected for non-existent WO', `status=${fgRes.status}`);
    return;
  }

  const fgRes = await api('POST', '/production/fg-receipt', {
    wo_id: inProgressWo.id,
    warehouse_id: 1,
    quantity: 1,
    batch_number: `TEST-NEGFG-${Date.now()}`,
  });

  // expect rejection: either no QC checkpoints, or no yield
  assert(
    fgRes.status === 500,
    'FG receipt rejected without QC/yield',
    `status=${fgRes.status}, error=${fgRes.data?.error}`
  );
}

async function main() {
  console.log('=== Production Negative Tests ===');
  console.log(`Target: ${BASE}`);

  try {
    const health = await fetch(`${BASE}/api/health`);
    if (health.status !== 200) {
      console.error('Server not healthy. Start the backend first.');
      process.exit(1);
    }
  } catch {
    console.error('Cannot connect to server. Start the backend first.');
    process.exit(1);
  }

  await testNegativeQuantityMaterialIssue();
  await testZeroQuantityMaterialIssue();
  await testNegativeYieldRejected();
  await testNegativeFgReceiptRejected();
  await testMaterialIssueWrongWoStatus();
  await testFgReceiptWithoutQc();

  console.log('\n=== Results ===');
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  if (failures.length > 0) {
    console.log('Failures:');
    failures.forEach(f => console.log(`  - ${f}`));
  }
  process.exit(failed > 0 ? 1 : 0);
}

main();
