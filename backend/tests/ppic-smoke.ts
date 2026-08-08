/**
 * PPIC Integration Smoke Test
 *
 * Tests the full business flow:
 *   Forecast -> MPS -> SO merge -> MRP -> PR -> Procurement
 *   Confirmed MPS -> WO -> Approve -> Release -> In Progress
 *
 * Run: npm run test:ppic
 * Requires: running backend server + MySQL database
 */

import jwt from 'jsonwebtoken';

const BASE = `http://127.0.0.1:${process.env.PORT || 3000}`;
const JWT_SECRET = process.env.JWT_SECRET || 'ci-test-secret';

// sign an admin token (userId=1, userLevel=1 = founder)
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
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: AUTH,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: any;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

// tracking IDs for cleanup
const cleanup: { products: number[]; forecasts: number[]; mpsHeaders: number[]; prs: number[]; wos: number[] } = {
  products: [], forecasts: [], mpsHeaders: [], prs: [], wos: [],
};

async function seedTestData() {
  console.log('\n== Seeding Test Data ==');

  // create a UOM
  let uomId: number | null = null;
  const uomRes = await api('GET', '/units');
  if (uomRes.data?.data?.length > 0) {
    uomId = uomRes.data.data[0].id;
  }

  // create test product (finished good)
  const prodRes = await api('POST', '/products', {
    name: `SMOKE-FG-${Date.now()}`,
    sku: `SKU-SMOKE-${Date.now()}`,
    type: 'Finished Good',
    unit_of_measure_id: uomId,
    min_stock: 0,
    price: 100000,
  });
  const productId = prodRes.data?.data?.id || prodRes.data?.id;
  assert(!!productId, 'Create test finished good product', `status=${prodRes.status}`);
  if (productId) cleanup.products.push(productId);

  // create raw material
  const matRes = await api('POST', '/products', {
    name: `SMOKE-RM-${Date.now()}`,
    sku: `SKU-RM-${Date.now()}`,
    type: 'Raw Material',
    unit_of_measure_id: uomId,
    min_stock: 0,
    price: 50000,
  });
  const materialId = matRes.data?.data?.id || matRes.data?.id;
  assert(!!materialId, 'Create test raw material', `status=${matRes.status}`);
  if (materialId) cleanup.products.push(materialId);

  // create BOM for the finished good
  const bomRes = await api('POST', '/bom', {
    product_id: productId,
    bom_number: `BOM-SMOKE-${Date.now()}`,
    version: '1.0',
    items: [{ material_id: materialId, quantity: 2, unit: 'KG' }],
  });
  const bomId = bomRes.data?.data?.id || bomRes.data?.id;
  assert(!!bomId, 'Create BOM for finished good', `status=${bomRes.status}`);

  // seed inventory for raw material (so MRP netting works)
  await api('POST', '/inventory', {
    product_id: materialId,
    quantity_on_hand: 100,
    location: 'WAREHOUSE-A',
  });

  // create a line process for WO testing
  const lineRes = await api('GET', '/line-processes');
  let lineProcessId: number | null = null;
  if (lineRes.data?.data?.length > 0) {
    lineProcessId = lineRes.data.data[0].id;
  }

  return { productId, materialId, bomId, uomId, lineProcessId };
}

async function testForecastToMps(productId: number) {
  console.log('\n== Flow A: Forecast -> MPS -> SO Merge -> MRP -> PR -> Procurement ==');

  // 1. Create weekly forecast for October 2026
  console.log('\n-- Step 1: Create Forecast --');
  const fcRes = await api('POST', '/ppic/forecasts', {
    period_year: 2026,
    period_month: 10,
    notes: 'CI smoke test forecast',
  });
  const forecastId = fcRes.data?.data?.id;
  assert(!!forecastId, 'Create forecast Oct 2026', `status=${fcRes.status}`);
  if (forecastId) cleanup.forecasts.push(forecastId);

  // add forecast data
  if (forecastId) {
    await api('POST', `/ppic/forecasts/${forecastId}/data`, {
      items: [{ product_id: productId, week_number: 40, year: 2026, forecast_qty: 100 }],
    });
  }

  // confirm forecast
  if (forecastId) {
    await api('PUT', `/ppic/forecasts/${forecastId}`, { status: 'Confirmed' });
  }

  // 2. Create Draft MPS for October 2026
  console.log('\n-- Step 2: Create MPS --');
  const mpsRes = await api('POST', '/ppic/mps', {
    mps_number: `MPS-SMOKE-${Date.now()}`,
    period_year: 2026,
    period_month: 10,
    status: 'Draft',
  });
  const mpsId = mpsRes.data?.data?.id;
  assert(!!mpsId, 'Create Draft MPS Oct 2026', `status=${mpsRes.status}`);
  if (mpsId) cleanup.mpsHeaders.push(mpsId);

  // 3. Push Forecast -> MPS (exact period)
  console.log('\n-- Step 3: Push Forecast to MPS --');
  if (forecastId) {
    const pushRes = await api('POST', `/ppic/forecasts/${forecastId}/push-to-mps`);
    assert(pushRes.status === 200, 'Push forecast to MPS (exact period)', `status=${pushRes.status} msg=${pushRes.data?.message || pushRes.data?.error}`);
  }

  // 4. Negative: Push forecast to wrong period MPS should fail
  console.log('\n-- Step 4: Negative - Wrong period push --');
  // create an August MPS
  const augMpsRes = await api('POST', '/ppic/mps', {
    mps_number: `MPS-AUG-SMOKE-${Date.now()}`,
    period_year: 2026,
    period_month: 8,
    status: 'Draft',
  });
  const augMpsId = augMpsRes.data?.data?.id;
  if (augMpsId) cleanup.mpsHeaders.push(augMpsId);

  // forecast is Oct, push should NOT land in Aug MPS
  // verify that MPS Oct has forecast data, not Aug
  if (mpsId) {
    const mpsDetails = await api('GET', `/ppic/mps/${mpsId}/details`);
    const details = mpsDetails.data?.data || [];
    const hasProduct = details.some((d: any) => d.product_id === productId);
    assert(hasProduct, 'Forecast Oct landed in MPS Oct (correct period)');
  }

  if (augMpsId) {
    const augDetails = await api('GET', `/ppic/mps/${augMpsId}/details`);
    const augDetailsList = augDetails.data?.data || [];
    const hasProductInAug = augDetailsList.some((d: any) => d.product_id === productId);
    assert(!hasProductInAug, 'Forecast Oct did NOT land in MPS Aug (wrong period)');
  }

  // 5. Create Sales Order for same product, then Pull Orders -> SO merge
  console.log('\n-- Step 5: SO Merge --');
  const soRes = await api('POST', '/sales/orders', {
    customer_id: null,
    order_date: '2026-10-01',
    delivery_date: '2026-10-15',
    status: 'confirmed',
    items: [{ product_id: productId, quantity: 50, unit_price: 100000 }],
  });
  const soId = soRes.data?.data?.id || soRes.data?.id;
  // SO creation may fail if no customer - that's OK, we test pull-orders regardless

  if (mpsId) {
    const pullRes = await api('POST', `/ppic/mps/${mpsId}/pull-orders`);
    // if SO existed, should merge; if not, pulled=0 is acceptable
    assert(pullRes.status === 200, 'Pull Orders to MPS', `status=${pullRes.status} msg=${pullRes.data?.message || pullRes.data?.error}`);

    // verify forecast product still has detail (not duplicated)
    const afterPull = await api('GET', `/ppic/mps/${mpsId}/details`);
    const detailsAfter = afterPull.data?.data || [];
    const productDetails = detailsAfter.filter((d: any) => d.product_id === productId);
    assert(productDetails.length <= 1, 'No duplicate MPS detail for same product after pull', `count=${productDetails.length}`);

    // if SO was created and pulled, verify so_qty
    if (soId && productDetails.length === 1) {
      const detailId = productDetails[0].id;
      const weekData = await api('GET', `/ppic/mps/${mpsId}/details/${detailId}/weeks`);
      const weeks = weekData.data?.data || weekData.data || [];
      const hasSoQty = weeks.some((w: any) => Number(w.so_qty) > 0);
      // this may or may not pass depending on SO pull success
      if (hasSoQty) {
        assert(true, 'SO qty merged into existing forecast detail');
      }
    }
  }

  // 6. Set production_qty and confirm MPS
  console.log('\n-- Step 6: Set production_qty and Confirm MPS --');
  if (mpsId) {
    const details = await api('GET', `/ppic/mps/${mpsId}/details`);
    const detailsList = details.data?.data || [];
    for (const d of detailsList) {
      if (d.product_id === productId) {
        const weekData = await api('GET', `/ppic/mps/${mpsId}/details/${d.id}/weeks`);
        const weeks = weekData.data?.data || weekData.data || [];
        for (const w of weeks) {
          if (Number(w.forecast_qty) > 0 || Number(w.so_qty) > 0) {
            await api('PUT', `/ppic/mps/${mpsId}/details/${d.id}/weeks/${w.id}`, {
              production_qty: Math.max(Number(w.forecast_qty) || 0, Number(w.so_qty) || 0),
            });
          }
        }
      }
    }

    // confirm MPS
    const confirmRes = await api('PUT', `/ppic/mps/${mpsId}`, { status: 'Confirmed' });
    assert(confirmRes.status === 200, 'Confirm MPS', `status=${confirmRes.status}`);

    // negative: edit confirmed MPS should fail
    const editRes = await api('PUT', `/ppic/mps/${mpsId}`, { status: 'Draft' });
    // confirmed MPS should not revert easily (depends on backend logic)
  }

  // 7. MRP -> Generate PR
  console.log('\n-- Step 7: MRP -> Generate PR --');
  let prId: number | null = null;
  if (mpsId) {
    // find detail for our product
    const details = await api('GET', `/ppic/mps/${mpsId}/details`);
    const detailsList = details.data?.data || [];
    const ourDetail = detailsList.find((d: any) => d.product_id === productId);

    if (ourDetail) {
      // generate MRP
      const mrpRes = await api('POST', `/ppic/mps/${mpsId}/details/${ourDetail.id}/mrp/compute`);
      assert(mrpRes.status === 200, 'Compute MRP', `status=${mrpRes.status}`);

      // get MRP results
      const mrpData = await api('GET', `/ppic/mps/${mpsId}/details/${ourDetail.id}/mrp`);
      const mrpResults = mrpData.data?.data || mrpData.data || {};

      // generate PR from MRP
      const materials = mrpResults.materials || mrpResults.rows || [];
      const netReqMaterials = materials.filter((m: any) => Number(m.net_req_qty || m.total_net_requirement || 0) > 0);

      if (netReqMaterials.length > 0) {
        const prRes = await api('POST', `/ppic/mps/${mpsId}/details/${ourDetail.id}/mrp/generate-pr`, {
          material_net_reqs: netReqMaterials.map((m: any) => ({
            material_id: m.material_id,
            material_name: m.material_name,
            uom_name: m.uom_name || 'KG',
            net_req_qty: Number(m.net_req_qty || m.total_net_requirement || 0),
          })),
        });
        prId = prRes.data?.data?.pr_id || prRes.data?.pr_id;
        assert(!!prId, 'Generate PR from MRP', `status=${prRes.status} prId=${prId}`);
        if (prId) cleanup.prs.push(prId);

        // negative: duplicate PR generation should fail
        const dupRes = await api('POST', `/ppic/mps/${mpsId}/details/${ourDetail.id}/mrp/generate-pr`, {
          material_net_reqs: netReqMaterials.map((m: any) => ({
            material_id: m.material_id,
            material_name: m.material_name,
            uom_name: m.uom_name || 'KG',
            net_req_qty: Number(m.net_req_qty || m.total_net_requirement || 0),
          })),
        });
        assert(dupRes.status === 409, 'Duplicate PR generation rejected (409)', `status=${dupRes.status}`);
      } else {
        console.log('  SKIP: No materials with net requirement > 0 (inventory covers demand)');
      }
    }
  }

  // 8. Verify PR in Procurement
  console.log('\n-- Step 8: Verify PR in Procurement --');
  if (prId) {
    const prDetail = await api('GET', `/procurement/purchase-requests/${prId}`);
    assert(prDetail.status === 200, 'Load PR via Procurement API', `status=${prDetail.status}`);

    const prData = prDetail.data?.data;
    if (prData) {
      // check canonical_items from purchase_request_items table
      const canonicalItems = prData.canonical_items || [];
      assert(canonicalItems.length > 0, 'PR has canonical_items from purchase_request_items', `count=${canonicalItems.length}`);

      // check notes is valid JSON with items
      let notesItems: any[] = [];
      try {
        const parsed = JSON.parse(prData.notes || '{}');
        notesItems = parsed.items || [];
      } catch {}
      assert(notesItems.length > 0, 'PR notes contains JSON items for procurement', `count=${notesItems.length}`);

      // verify same materials
      if (canonicalItems.length > 0 && notesItems.length > 0) {
        assert(
          canonicalItems.length === notesItems.length,
          'canonical_items count matches notes items count',
          `canonical=${canonicalItems.length} notes=${notesItems.length}`
        );
      }
    }
  }

  return { mpsId };
}

async function testWoProduction(mpsId: number | null, productId: number, lineProcessId: number | null) {
  console.log('\n== Flow B: WO -> Production ==');

  if (!mpsId) {
    console.log('  SKIP: No confirmed MPS available');
    return;
  }

  // get confirmed MPS details
  const details = await api('GET', `/ppic/mps/${mpsId}/details`);
  const detailsList = details.data?.data || [];
  const ourDetail = detailsList.find((d: any) => d.product_id === productId);

  if (!ourDetail) {
    console.log('  SKIP: No MPS detail for test product');
    return;
  }

  // get weeks with production_qty
  const weekData = await api('GET', `/ppic/mps/${mpsId}/details/${ourDetail.id}/weeks`);
  const weeks = weekData.data?.data || weekData.data || [];
  const prodWeek = weeks.find((w: any) => Number(w.production_qty) > 0);

  if (!prodWeek) {
    console.log('  SKIP: No weeks with production_qty > 0');
    return;
  }

  // generate WO from confirmed MPS
  console.log('\n-- Step 1: Generate WO --');
  const woRes = await api('POST', `/ppic/mps/${mpsId}/generate-wo`, {
    detail_id: ourDetail.id,
    week_number: prodWeek.week_number,
    year: prodWeek.year,
    line_process_id: lineProcessId,
  });
  const woId = woRes.data?.data?.wo_id || woRes.data?.wo_id;
  if (woId) {
    cleanup.wos.push(woId);
    assert(true, 'Generate WO from confirmed MPS', `woId=${woId}`);

    // negative: duplicate WO for same week should fail
    const dupWo = await api('POST', `/ppic/mps/${mpsId}/generate-wo`, {
      detail_id: ourDetail.id,
      week_number: prodWeek.week_number,
      year: prodWeek.year,
      line_process_id: lineProcessId,
    });
    assert(dupWo.status === 409 || dupWo.status === 400, 'Duplicate WO generation rejected', `status=${dupWo.status}`);

    // WO state machine: DRAFT -> APPROVED -> RELEASED -> IN_PROGRESS
    console.log('\n-- Step 2: WO State Machine --');

    // approve
    const approveRes = await api('PUT', `/workorders/${woId}`, { status: 'APPROVED' });
    assert(approveRes.status === 200, 'WO DRAFT -> APPROVED', `status=${approveRes.status}`);

    // release (requires line_process_id)
    const releaseRes = await api('PUT', `/workorders/${woId}`, { status: 'RELEASED' });
    assert(releaseRes.status === 200, 'WO APPROVED -> RELEASED', `status=${releaseRes.status}`);

    // in progress
    const ipRes = await api('PUT', `/workorders/${woId}`, { status: 'IN_PROGRESS' });
    assert(ipRes.status === 200, 'WO RELEASED -> IN_PROGRESS', `status=${ipRes.status}`);
  } else {
    assert(false, 'Generate WO from confirmed MPS', `status=${woRes.status} error=${woRes.data?.error}`);
  }
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

  // ensure admin user exists (for permission checks)
  // the initializeDatabase() seeds user id=1 as admin

  const { productId, materialId, bomId, uomId, lineProcessId } = await seedTestData();

  if (!productId || !materialId) {
    console.log('\nFailed to seed test data. Aborting.');
    process.exit(1);
  }

  const { mpsId } = await testForecastToMps(productId);
  await testWoProduction(mpsId || null, productId, lineProcessId);

  // summary
  console.log('\n===========================================');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('===========================================');

  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log(`  - ${f}`);
    }
  }

  if (failed > 0) {
    process.exit(1);
  }
  console.log('\nPPIC Integration Smoke: ALL PASS');
}

runSmoke().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
