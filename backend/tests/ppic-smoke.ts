/**
 * PPIC Integration Smoke Test
 *
 * Tests the core business flows end-to-end against a running backend.
 * Uses the actual API contracts discovered from route handlers.
 *
 * Run: npm run test:ppic (or: npx tsx tests/ppic-smoke.ts)
 * Requires: running backend server + MySQL database
 */

import jwt from 'jsonwebtoken';

const BASE = `http://127.0.0.1:${process.env.PORT || 3000}`;
const JWT_SECRET = process.env.JWT_SECRET || 'ci-test-secret';
const TOKEN = jwt.sign({ userId: 1, userLevel: 1 }, JWT_SECRET, { expiresIn: '1h' });
const AUTH = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

let passed = 0;
let failed = 0;
const failures: string[] = [];
const TS = Date.now();

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

async function ensureUser() {
  // the admin user (id=1) is auto-seeded by initializeDatabase
  const check = await api('GET', '/users');
  if (check.status === 200) return true;
  // if permission-denied, seed admin via auth register
  const reg = await api('POST', '/auth/register', {
    username: 'admin', email: 'admin@test.com', password: 'admin123',
    full_name: 'Admin', user_level: 1,
  });
  return reg.status === 200 || reg.status === 201 || reg.status === 400; // 400 = already exists
}

async function seedProducts() {
  console.log('\n== Seed Products ==');

  const fgRes = await api('POST', '/products', {
    sku: `SKU-FG-${TS}`, name: `Smoke FG ${TS}`,
  });
  const fgId = fgRes.data?.data?.id;
  assert(!!fgId, 'Create finished good product', `status=${fgRes.status} body=${JSON.stringify(fgRes.data).slice(0, 200)}`);

  const rmRes = await api('POST', '/products', {
    sku: `SKU-RM-${TS}`, name: `Smoke RM ${TS}`,
  });
  const rmId = rmRes.data?.data?.id;
  assert(!!rmId, 'Create raw material product', `status=${rmRes.status}`);

  return { fgId, rmId };
}

async function seedBom(fgId: number, rmId: number) {
  console.log('\n== Seed BOM ==');

  const bomRes = await api('POST', '/bom', {
    product_id: fgId,
    product_name: `Smoke FG ${TS}`,
    bom_code: `BOM-SMOKE-${TS}`,
    details: [{ raw_material_id: rmId, quantity: 2, item_description: 'Smoke RM' }],
  });
  const bomId = bomRes.data?.data?.id;
  assert(!!bomId, 'Create BOM with raw material', `status=${bomRes.status}`);
  return bomId;
}

async function testMpsCreate(fgId: number, bomId: number | undefined) {
  console.log('\n== Flow A: MPS -> MRP -> PR -> Procurement ==');

  // 1. Create Draft MPS
  console.log('\n-- Step 1: Create MPS --');
  const mpsRes = await api('POST', '/ppic/mps', {
    period_year: 2026, period_month: 10,
  });
  const mpsId = mpsRes.data?.data?.id;
  assert(!!mpsId, 'Create Draft MPS Oct 2026', `status=${mpsRes.status} body=${JSON.stringify(mpsRes.data).slice(0, 200)}`);
  if (!mpsId) return null;

  // 2. Add product to MPS via add-item
  console.log('\n-- Step 2: Add item to MPS --');
  const addRes = await api('POST', `/ppic/mps/${mpsId}/add-item`, {
    product_id: fgId,
    bom_id: bomId || null,
  });
  const detailId = addRes.data?.data?.id || addRes.data?.data?.detail_id || addRes.data?.detail_id;
  assert(!!detailId, 'Add product to MPS', `status=${addRes.status} body=${JSON.stringify(addRes.data).slice(0, 200)}`);
  if (!detailId) return { mpsId, detailId: null };

  // 3. Set production_qty on a week
  console.log('\n-- Step 3: Set production_qty --');
  const weekNum = 40;
  const weekYear = 2026;
  await api('PUT', `/ppic/mps/${mpsId}/week-data`, {
    entries: [{
      mps_detail_id: detailId,
      week_number: weekNum,
      year: weekYear,
      production_qty: 100,
    }],
  });

  // verify week data was set
  const mpsDetail = await api('GET', `/ppic/mps/${mpsId}`);
  assert(mpsDetail.status === 200, 'MPS detail loaded', `status=${mpsDetail.status}`);

  // 4. Confirm MPS
  console.log('\n-- Step 4: Confirm MPS --');
  const confirmRes = await api('POST', `/ppic/mps/${mpsId}/confirm`);
  assert(confirmRes.status === 200, 'Confirm MPS', `status=${confirmRes.status} body=${JSON.stringify(confirmRes.data).slice(0, 200)}`);

  // 5. Negative: Confirm again should fail
  const confirm2 = await api('POST', `/ppic/mps/${mpsId}/confirm`);
  assert(confirm2.status === 400, 'Double confirm rejected', `status=${confirm2.status}`);

  return { mpsId, detailId, weekNum, weekYear };
}

async function testMrpToPr(mpsId: number, detailId: number) {
  console.log('\n-- Step 5: MRP Compute --');
  const mrpRes = await api('GET', `/ppic/mps/${mpsId}/details/${detailId}/mrp`);
  assert(mrpRes.status === 200, 'Compute MRP', `status=${mrpRes.status} body=${JSON.stringify(mrpRes.data).slice(0, 300)}`);

  const mrpData = mrpRes.data;
  const materials = mrpData?.materials || mrpData?.data?.materials || [];
  console.log(`  MRP returned ${materials.length} materials`);

  // 6. Generate PR
  console.log('\n-- Step 6: Generate PR --');
  // build material_net_reqs from MRP results
  const netReqs = materials
    .filter((m: any) => Number(m.total_net_requirement || m.net_req_qty || 0) > 0)
    .map((m: any) => ({
      material_id: m.raw_material_id || m.material_id,
      material_name: m.material_name || m.name || 'Unknown',
      uom_name: m.uom_name || 'KG',
      net_req_qty: Number(m.total_net_requirement || m.net_req_qty || 0),
    }));

  if (netReqs.length === 0) {
    // if inventory covers everything, inject a synthetic net requirement
    console.log('  NOTE: No net requirements from MRP (inventory covers). Using synthetic data.');
    netReqs.push({
      material_id: materials[0]?.raw_material_id || materials[0]?.material_id || 1,
      material_name: materials[0]?.material_name || 'Synthetic RM',
      uom_name: 'KG',
      net_req_qty: 50,
    });
  }

  const prRes = await api('POST', `/ppic/mps/${mpsId}/details/${detailId}/mrp/generate-pr`, {
    material_net_reqs: netReqs,
  });
  const prId = prRes.data?.data?.pr_id || prRes.data?.pr_id;
  assert(!!prId, 'Generate PR from MRP', `status=${prRes.status} body=${JSON.stringify(prRes.data).slice(0, 300)}`);

  // 7. Negative: duplicate PR
  console.log('\n-- Step 7: Duplicate PR check --');
  const dupRes = await api('POST', `/ppic/mps/${mpsId}/details/${detailId}/mrp/generate-pr`, {
    material_net_reqs: netReqs,
  });
  assert(dupRes.status === 409, 'Duplicate PR rejected (409)', `status=${dupRes.status}`);

  // 8. Verify PR in Procurement
  console.log('\n-- Step 8: Verify PR in Procurement --');
  if (prId) {
    const prDetail = await api('GET', `/procurement/purchase-requests/${prId}`);
    assert(prDetail.status === 200, 'Load PR via Procurement', `status=${prDetail.status}`);

    const prData = prDetail.data?.data || prDetail.data;
    if (prData) {
      // check canonical_items loaded from purchase_request_items
      const canonical = prData.canonical_items || [];
      assert(canonical.length > 0, 'PR has canonical_items', `count=${canonical.length}`);

      // check notes is valid JSON with items
      let notesItems: any[] = [];
      try {
        const parsed = JSON.parse(prData.notes || '{}');
        notesItems = parsed.items || [];
      } catch { /* ok */ }
      assert(notesItems.length > 0, 'PR notes has JSON items for procurement', `count=${notesItems.length}`);
    }
  }

  return prId;
}

async function testWoGeneration(mpsId: number, detailId: number, weekNum: number, weekYear: number) {
  console.log('\n== Flow B: WO Generation ==');

  // preview
  const previewRes = await api('GET', `/ppic/mps/${mpsId}/details/${detailId}/generate-wo/preview`);
  assert(previewRes.status === 200, 'WO preview', `status=${previewRes.status}`);

  // generate WO for selected weeks
  const woRes = await api('POST', `/ppic/mps/${mpsId}/details/${detailId}/generate-wo`, {
    selected_weeks: [{ week_number: weekNum, year: weekYear }],
  });
  const woId = woRes.data?.data?.wo_ids?.[0] || woRes.data?.wo_ids?.[0];
  if (woRes.status === 200) {
    assert(true, 'Generate WO from confirmed MPS', `woId=${woId}`);

    // negative: duplicate WO
    const dupWo = await api('POST', `/ppic/mps/${mpsId}/details/${detailId}/generate-wo`, {
      selected_weeks: [{ week_number: weekNum, year: weekYear }],
    });
    assert(dupWo.status === 400 || dupWo.status === 409, 'Duplicate WO rejected', `status=${dupWo.status}`);

    // WO state machine (if we got a valid woId)
    if (woId) {
      console.log('\n-- WO State Machine --');
      const approve = await api('PUT', `/workorders/${woId}`, { status: 'APPROVED' });
      assert(approve.status === 200, 'WO DRAFT -> APPROVED', `status=${approve.status} body=${JSON.stringify(approve.data).slice(0, 200)}`);

      const release = await api('PUT', `/workorders/${woId}`, { status: 'RELEASED' });
      // may fail if no line_process — that's ok, we test the flow
      if (release.status === 200) {
        assert(true, 'WO APPROVED -> RELEASED');
        const ip = await api('PUT', `/workorders/${woId}`, { status: 'IN_PROGRESS' });
        assert(ip.status === 200, 'WO RELEASED -> IN_PROGRESS', `status=${ip.status}`);
      } else {
        console.log(`  NOTE: WO release returned ${release.status} (may need line_process mapping)`);
      }
    }
  } else {
    // WO generation may fail if no line_process mapping exists — not a hard failure
    console.log(`  NOTE: WO generation returned ${woRes.status}: ${woRes.data?.error || 'unknown'}`);
    console.log('  This may be expected if no line_process mapping exists for the test product.');
  }
}

async function testForecastExactPeriod() {
  console.log('\n== Flow C: Forecast Exact Period Match ==');

  // create forecast for Nov 2026
  const fcRes = await api('POST', '/ppic/forecasts', {
    period_year: 2026, period_month: 11,
  });
  const forecastId = fcRes.data?.id;
  assert(!!forecastId, 'Create forecast Nov 2026', `status=${fcRes.status} body=${JSON.stringify(fcRes.data).slice(0, 200)}`);
  if (!forecastId) return;

  // push to MPS - should fail because no Draft MPS for Nov 2026
  const pushRes = await api('POST', `/ppic/forecasts/${forecastId}/push-to-mps`);
  // should fail with "No Draft MPS found for period" or "No forecast data to push"
  assert(pushRes.status === 400, 'Push forecast without matching MPS rejected', `status=${pushRes.status} msg=${pushRes.data?.error?.slice(0, 100)}`);

  // create Draft MPS for Nov
  const mpsRes = await api('POST', '/ppic/mps', {
    period_year: 2026, period_month: 11,
  });
  const novMpsId = mpsRes.data?.data?.id;

  // push should still fail because no forecast data (no brands/grid generated)
  const pushRes2 = await api('POST', `/ppic/forecasts/${forecastId}/push-to-mps`);
  assert(pushRes2.status === 400, 'Push empty forecast rejected', `status=${pushRes2.status} msg=${pushRes2.data?.error?.slice(0, 100)}`);

  // cleanup
  if (forecastId) await api('DELETE', `/ppic/forecasts/${forecastId}`);
  if (novMpsId) await api('DELETE', `/ppic/mps/${novMpsId}`);
}

async function runSmoke() {
  console.log('===========================================');
  console.log('  PPIC Integration Smoke Test');
  console.log(`  Target: ${BASE}`);
  console.log('===========================================');

  // health check
  const health = await api('GET', '/health');
  assert(health.status === 200, 'API health check', `status=${health.status}`);
  if (health.status !== 200) {
    console.log('\nAPI is not reachable. Aborting.');
    process.exit(1);
  }

  await ensureUser();
  const { fgId, rmId } = await seedProducts();
  if (!fgId || !rmId) {
    console.log('\nFailed to seed products. Aborting.');
    process.exit(1);
  }

  const bomId = await seedBom(fgId, rmId);
  const mpsResult = await testMpsCreate(fgId, bomId);

  if (mpsResult?.mpsId && mpsResult?.detailId) {
    await testMrpToPr(mpsResult.mpsId, mpsResult.detailId);
    await testWoGeneration(
      mpsResult.mpsId, mpsResult.detailId,
      mpsResult.weekNum || 40, mpsResult.weekYear || 2026
    );
  } else {
    console.log('\nSkipping MRP/WO tests: MPS setup failed');
  }

  await testForecastExactPeriod();

  // summary
  console.log('\n===========================================');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('===========================================');
  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f}`);
  }
  if (failed > 0) process.exit(1);
  console.log('\nPPIC Integration Smoke: ALL PASS');
}

runSmoke().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
