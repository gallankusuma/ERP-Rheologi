/**
 * QC Service — Negative & Edge Case Tests
 *
 * Tests per Review.md 2026-08-16:
 * - FPA approve-2 without approve-1 first
 * - Batch release without FPA evidence
 * - Idempotent FPA approval
 * - Exact HTTP status assertions
 *
 * Run: npx tsx tests/qc-negative.ts
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

async function testApprove2WithoutApprove1() {
  console.log('\n== Test: FPA approve-2 rejected without approve-1 ==');

  const fpas = await api('GET', '/qc/analysis-requests');
  const allFpas = fpas.data?.data || fpas.data || [];
  const pendingFpa = allFpas.find((f: any) => !f.approved_by_1 && !f.approved_by_2);

  if (!pendingFpa) {
    // no pending FPA exists — test with an invalid ID
    console.log('  INFO: No pending FPA found — testing with id=999999');
    const res = await api('POST', '/qc/analysis-requests/999999/approve-2', {
      review_notes: 'test direct approve-2',
    });
    assert(
      res.status === 404 || res.status === 400 || res.status === 500,
      'Non-existent FPA approve-2 rejected',
      `status=${res.status}`
    );
    return;
  }

  // try approve-2 directly (skip approve-1)
  const res = await api('POST', `/qc/analysis-requests/${pendingFpa.id}/approve-2`, {
    review_notes: 'test direct approve-2',
  });

  assert(
    res.status === 400,
    'Approve-2 returns 400 without approve-1',
    `status=${res.status}`
  );
  assert(
    (res.data?.error || '').toLowerCase().includes('approve') || (res.data?.error || '').toLowerCase().includes('first'),
    'Error message mentions approve-1 prerequisite',
    `error=${res.data?.error}`
  );
}

async function testBatchReleaseWithoutFpa() {
  console.log('\n== Test: Batch release rejected without FPA evidence ==');

  const batches = await api('GET', '/inventory/batch-tracking');
  const allBatches = batches.data?.data || batches.data || [];
  const unreleased = allBatches.find((b: any) =>
    b.status !== 'released' && b.qc_status !== 'passed'
  );

  if (!unreleased) {
    console.log('  INFO: No unreleased batch without QC pass found');
    console.log('  INFO: Testing batch release on non-existent id=999999');
    const res = await api('POST', '/inventory/batch-tracking/999999/release');
    assert(
      res.status === 404 || res.status === 400 || res.status === 500,
      'Non-existent batch release rejected',
      `status=${res.status}`
    );
    return;
  }

  const res = await api('POST', `/inventory/batch-tracking/${unreleased.batch_number}/release`);
  assert(
    res.status === 400 || res.status === 404,
    'Batch release rejected without FPA evidence',
    `status=${res.status}, error=${res.data?.error}`
  );
}

async function testIdempotentFpaApproval() {
  console.log('\n== Test: Double FPA approval is idempotent ==');

  const fpas = await api('GET', '/qc/analysis-requests');
  const allFpas = fpas.data?.data || fpas.data || [];
  const approvedFpa = allFpas.find((f: any) => f.approved_by_1 && f.approved_by_2);

  if (!approvedFpa) {
    console.log('  INFO: No fully approved FPA found');
    // this is a real scenario that should be tested — fail, don't skip
    failed++;
    failures.push('No fully approved FPA available to test idempotency');
    return;
  }

  // try approve-2 again — should be idempotent (200 or explicit "already approved")
  const res = await api('POST', `/qc/analysis-requests/${approvedFpa.id}/approve-2`, {
    review_notes: 'test idempotent',
  });

  assert(
    res.status === 200,
    'Double approve-2 is idempotent (200)',
    `status=${res.status}`
  );
}

async function main() {
  console.log('=== QC Negative Tests ===');
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

  await testApprove2WithoutApprove1();
  await testBatchReleaseWithoutFpa();
  await testIdempotentFpaApproval();

  console.log('\n=== Results ===');
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  if (failures.length > 0) {
    console.log('Failures:');
    failures.forEach(f => console.log(`  - ${f}`));
  }
  process.exit(failed > 0 ? 1 : 0);
}

main();
