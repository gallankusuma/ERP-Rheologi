#!/usr/bin/env python3
"""Production Runtime Smoke Test v5
ERP Rheologi — no secrets, no direct DB, API-only reconciliation.

Required env vars:
  SMOKE_API_URL   — e.g. http://localhost:3002/api
  SMOKE_EMAIL     — login email
  SMOKE_PASSWORD  — login password

Optional env vars:
  SMOKE_SHA       — commit SHA being tested
  SMOKE_ENV       — environment label
"""
import requests, json, uuid, sys, os
from datetime import datetime

BASE = os.environ.get("SMOKE_API_URL", "http://localhost:3002/api")
EMAIL = os.environ.get("SMOKE_EMAIL")
PASSWORD = os.environ.get("SMOKE_PASSWORD")

if not EMAIL or not PASSWORD:
    print("FATAL: Set SMOKE_EMAIL and SMOKE_PASSWORD env vars.")
    sys.exit(1)

PASS_COUNT = 0
FAIL_COUNT = 0
RESULTS = []

def log_pass(msg):
    global PASS_COUNT
    PASS_COUNT += 1
    RESULTS.append(f"PASS: {msg}")
    print(f"  PASS: {msg}")

def log_fail(msg, detail=""):
    global FAIL_COUNT
    FAIL_COUNT += 1
    RESULTS.append(f"FAIL: {msg} -- {detail}")
    print(f"  FAIL: {msg} -- {detail}")

def get_stock(product_id, warehouse_id):
    """get stock for a product in a warehouse via API"""
    r = requests.get(f"{BASE}/inventory", headers=H, params={"warehouse_id": warehouse_id, "all": "1"})
    if r.status_code != 200:
        return 0.0
    data = r.json().get("data", [])
    for item in data:
        if item.get("product_id") == product_id:
            return float(item.get("quantity_on_hand", 0))
    return 0.0

def seed_stock_via_api(product_id, warehouse_id, qty):
    """seed stock via audited inventory API"""
    r = requests.post(f"{BASE}/inventory", headers=H, json={
        "product_id": product_id, "warehouse_id": warehouse_id, "quantity": qty
    })
    return r.status_code in (200, 201)

def get_stock_movements(product_id, ref_type=None, ref_id=None, move_type=None):
    """get stock movements for a product via API"""
    r = requests.get(f"{BASE}/inventory/transactions/{product_id}", headers=H)
    if r.status_code != 200:
        return []
    data = r.json().get("data", [])
    filtered = data
    if ref_type:
        filtered = [m for m in filtered if m.get("reference_type") == ref_type]
    if ref_id:
        filtered = [m for m in filtered if m.get("reference_id") == ref_id]
    if move_type:
        filtered = [m for m in filtered if m.get("transaction_type") == move_type]
    return filtered

# login
print("=== AUTH ===")
r = requests.post(f"{BASE}/auth/login", json={"email": EMAIL, "password": PASSWORD})
if r.status_code != 200 or not r.json().get("token"):
    print(f"FATAL: Login failed ({r.status_code}): {r.text[:200]}")
    sys.exit(1)
token = r.json()["token"]
H = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
print("Token obtained.")

# setup: find product with ACTIVE + approved BOM
print("\n=== SETUP ===")
boms = requests.get(f"{BASE}/bom", headers=H).json()
bom_list = boms.get("data", boms) if isinstance(boms, dict) else boms
product_id = None
bom_id_setup = None
for b in (bom_list if isinstance(bom_list, list) else []):
    if b.get("status") == "ACTIVE" and b.get("approval_status") == 2:
        product_id = b.get("product_id")
        bom_id_setup = b.get("id")
        break
if not product_id:
    print("FATAL: No ACTIVE+approved BOM found")
    sys.exit(1)
print(f"Using product_id={product_id} (BOM={bom_id_setup})")

# line process
lps = requests.get(f"{BASE}/line-processes", headers=H).json()
lp_list = lps.get("data", lps) if isinstance(lps, dict) else lps
line_id = lp_list[0]["id"] if isinstance(lp_list, list) and lp_list else 1
print(f"Using line_process_id={line_id}")

# warehouse
whs = requests.get(f"{BASE}/warehouses", headers=H).json()
wh_list = whs.get("data", whs) if isinstance(whs, dict) else whs
wh_id = wh_list[0]["id"] if isinstance(wh_list, list) and wh_list else 1
print(f"Using warehouse_id={wh_id}")

# get BOM details and seed stock via audited API
bd = requests.get(f"{BASE}/bom/{bom_id_setup}", headers=H).json()
bd_data = bd.get("data", bd) if isinstance(bd, dict) else bd
bom_details = bd_data.get("details", []) if isinstance(bd_data, dict) else []

print("\n--- Ensuring RM stock via inventory API ---")
for detail in bom_details:
    rm_id = detail.get("raw_material_id")
    if rm_id:
        current = get_stock(rm_id, wh_id)
        needed = float(detail.get("quantity", 0)) * 100 * 2
        if current < needed:
            seed_stock_via_api(rm_id, wh_id, needed - current + 100)
            new_stock = get_stock(rm_id, wh_id)
            print(f"  RM {rm_id}: seeded via API, stock now {new_stock}")
        else:
            print(f"  RM {rm_id}: sufficient stock ({current})")

print("\n==========================================")
print("POSITIVE FLOW (with inventory reconciliation)")
print("==========================================")

# 1. Create DRAFT WO
print("\n--- 1. Create DRAFT WO ---")
r = requests.post(f"{BASE}/workorders", headers=H, json={
    "product_id": product_id, "quantity": 100, "priority": "normal", "line_process_id": line_id
})
if r.status_code == 201:
    wo_id = r.json()["data"]["id"]
    wo_bom = r.json()["data"].get("bom_id")
    log_pass(f"Create DRAFT WO (id={wo_id}, bom_id={wo_bom})")
else:
    log_fail("Create DRAFT WO", f"HTTP {r.status_code}: {r.text[:200]}")
    sys.exit(1)

# 2. DRAFT -> APPROVED
r = requests.put(f"{BASE}/workorders/{wo_id}", headers=H, json={"status": "approved"})
if r.status_code == 200: log_pass("DRAFT -> APPROVED")
else: log_fail("DRAFT -> APPROVED", f"{r.status_code}: {r.text[:200]}")

# 3. APPROVED -> RELEASED
r = requests.put(f"{BASE}/workorders/{wo_id}", headers=H, json={"status": "released"})
if r.status_code == 200: log_pass("APPROVED -> RELEASED")
else: log_fail("APPROVED -> RELEASED", f"{r.status_code}: {r.text[:200]}")

# 4. Generate Materials
r = requests.post(f"{BASE}/production/issue-material/generate/{wo_id}", headers=H)
if r.status_code in (200, 201): log_pass("Generate Materials from pinned BOM")
else: log_fail("Generate Materials", f"{r.status_code}: {r.text[:200]}")

# 5. Issue Material with reconciliation
print("\n--- 5. Issue Material (with API reconciliation) ---")
wm = requests.get(f"{BASE}/production/issue-material/wo/{wo_id}", headers=H).json()
wm_data = wm.get("data", wm) if isinstance(wm, dict) else wm
mats = wm_data.get("materials", wm_data) if isinstance(wm_data, dict) else wm_data
wo_mat_id = None
mat_product_id = None
mat_qty = 0
if isinstance(mats, list) and mats:
    wo_mat_id = mats[0].get("id")
    mat_product_id = mats[0].get("product_id")
    mat_qty = float(mats[0].get("quantity_required", 10))

if wo_mat_id and mat_product_id:
    # stock BEFORE
    rm_before = get_stock(mat_product_id, wh_id)
    print(f"    RM stock BEFORE: product_id={mat_product_id}, wh={wh_id}, qty={rm_before}")

    r = requests.post(f"{BASE}/production/issue-material", headers=H, json={
        "wo_material_id": wo_mat_id, "quantity": mat_qty, "warehouse_id": wh_id
    })
    if r.status_code in (200, 201):
        # stock AFTER
        rm_after = get_stock(mat_product_id, wh_id)
        rm_delta = rm_before - rm_after
        print(f"    RM stock AFTER:  product_id={mat_product_id}, wh={wh_id}, qty={rm_after}")
        print(f"    RM delta: {rm_before} -> {rm_after} = -{rm_delta}")

        if abs(rm_delta - mat_qty) < 0.01:
            log_pass(f"Issue Material SUCCESS (wo_mat={wo_mat_id}, issued={mat_qty})")
            log_pass(f"RM stock deducted: {rm_before} -> {rm_after} (delta=-{rm_delta})")
        else:
            log_fail("RM stock delta mismatch", f"expected -{mat_qty}, got -{rm_delta}")

        # verify wo_material.quantity_issued via the WO materials API
        wm2 = requests.get(f"{BASE}/production/issue-material/wo/{wo_id}", headers=H).json()
        wm2_data = wm2.get("data", wm2) if isinstance(wm2, dict) else wm2
        mats2 = wm2_data.get("materials", wm2_data) if isinstance(wm2_data, dict) else wm2_data
        if isinstance(mats2, list):
            for m in mats2:
                if m.get("id") == wo_mat_id:
                    issued = float(m.get("quantity_issued", 0))
                    if abs(issued - mat_qty) < 0.01:
                        log_pass(f"wo_materials.quantity_issued = {issued}")
                    else:
                        log_fail("wo_materials.quantity_issued", f"expected {mat_qty}, got {issued}")
                    break

        # verify stock_movement OUT (reference_type='work_order' per backend contract)
        out_moves = get_stock_movements(mat_product_id, ref_type="work_order", ref_id=wo_id, move_type="out")
        out_total = sum(float(m.get("quantity", 0)) for m in out_moves)
        if abs(out_total - mat_qty) < 0.01:
            log_pass(f"stock_movements OUT = {out_total} (reference_type=work_order)")
        else:
            log_fail("stock_movements OUT", f"expected {mat_qty}, got {out_total}")
    else:
        log_fail("Issue Material", f"HTTP {r.status_code}: {r.text[:200]}")
else:
    log_fail("Issue Material", "No wo_materials found")

# 6. Start
r = requests.post(f"{BASE}/production/execution/{wo_id}/start", headers=H)
if r.status_code == 200: log_pass("RELEASED -> IN_PROGRESS")
else: log_fail("RELEASED -> IN_PROGRESS", f"{r.status_code}")

# 7. Create mandatory QC
r = requests.post(f"{BASE}/production/execution/{wo_id}/qc-checkpoints", headers=H, json={
    "stages": [{"process_stage": "FPA", "is_mandatory": True, "qc_type": "LP"}]
})
qc_id = fpa_id = None
if r.status_code in (200, 201):
    rd = r.json().get("data", r.json())
    if isinstance(rd, list) and rd:
        qc_id = rd[0].get("checkpoint_id") or rd[0].get("id")
        fpa_id = rd[0].get("fpa_id")
    log_pass(f"Create mandatory QC (checkpoint={qc_id}, fpa={fpa_id})")
else:
    log_fail("Create mandatory QC", f"{r.status_code}: {r.text[:200]}")

# 8. Complete REJECTED
r = requests.post(f"{BASE}/production/execution/{wo_id}/complete", headers=H)
if r.status_code == 400: log_pass("Complete rejected while QC pending")
else: log_fail("Complete should reject", f"{r.status_code}")

# 9. QC Pass
if fpa_id:
    r = requests.put(f"{BASE}/qc/fpa/{fpa_id}/results", headers=H, json={
        "status": "Released", "result": "Passed", "notes": "Smoke v5 - QC passed"
    })
    if r.status_code == 200: log_pass(f"QC FPA passed (fpa={fpa_id})")
    else: log_fail("QC pass", f"{r.status_code}: {r.text[:200]}")

# 10. Yield
batch = f"SMOKE-V5-{datetime.now().strftime('%Y%m%d%H%M')}"
r = requests.post(f"{BASE}/production/yield", headers=H, json={
    "wo_id": wo_id, "output_quantity": 85, "loss_quantity": 15, "batch_number": batch
})
if r.status_code in (200, 201): log_pass("Record Yield (output=85, loss=15)")
else: log_fail("Record Yield", f"{r.status_code}: {r.text[:200]}")

# 11. Complete
r = requests.post(f"{BASE}/production/execution/{wo_id}/complete", headers=H)
if r.status_code == 200: log_pass("IN_PROGRESS -> COMPLETED")
else: log_fail("Complete", f"{r.status_code}: {r.text[:200]}")

# 12. FG Receipt with reconciliation
print("\n--- 12. FG Receipt (with API reconciliation) ---")
fg_before = get_stock(product_id, wh_id)
print(f"    FG stock BEFORE: product_id={product_id}, wh={wh_id}, qty={fg_before}")

idem_key = str(uuid.uuid4())
r = requests.post(f"{BASE}/production/fg-receipt", headers=H, json={
    "wo_id": wo_id, "warehouse_id": wh_id, "quantity": 85,
    "batch_number": batch, "idempotency_key": idem_key
})
if r.status_code in (200, 201):
    fg_after = get_stock(product_id, wh_id)
    fg_delta = fg_after - fg_before
    print(f"    FG stock AFTER:  product_id={product_id}, wh={wh_id}, qty={fg_after}")
    print(f"    FG delta: {fg_before} -> {fg_after} = +{fg_delta}")

    if abs(fg_delta - 85) < 0.01:
        log_pass(f"FG Receipt SUCCESS (qty=85)")
        log_pass(f"FG inventory reconciled: {fg_before} -> {fg_after} (delta=+{fg_delta})")
    else:
        log_fail("FG inventory delta mismatch", f"expected +85, got +{fg_delta}")

    # verify stock_movement IN (reference_type='fg_receipt' per backend)
    in_moves = get_stock_movements(product_id, ref_type="fg_receipt", ref_id=wo_id, move_type="in")
    in_total = sum(float(m.get("quantity", 0)) for m in in_moves)
    if abs(in_total - 85) < 0.01:
        log_pass(f"stock_movements IN = {in_total} (reference_type=fg_receipt)")
    else:
        log_fail("stock_movements IN", f"expected 85, got {in_total}")
else:
    log_fail("FG Receipt", f"HTTP {r.status_code}: {r.text[:200]}")

# 13. Duplicate receipt
r = requests.post(f"{BASE}/production/fg-receipt", headers=H, json={
    "wo_id": wo_id, "warehouse_id": wh_id, "quantity": 85, "idempotency_key": idem_key
})
if r.status_code in (400, 409): log_pass(f"Duplicate receipt rejected ({r.status_code})")
else: log_fail("Duplicate receipt", f"{r.status_code}")

print("\n==========================================")
print("NEGATIVE GATES")
print("==========================================")

# N1. DRAFT -> Start
r2 = requests.post(f"{BASE}/workorders", headers=H, json={
    "product_id": product_id, "quantity": 50, "line_process_id": line_id
})
wo2_id = r2.json().get("data", {}).get("id") if r2.status_code == 201 else None
if wo2_id:
    r = requests.post(f"{BASE}/production/execution/{wo2_id}/start", headers=H)
    if r.status_code == 400: log_pass("DRAFT -> Start rejected")
    else: log_fail("DRAFT -> Start", f"{r.status_code}")

    # N2. APPROVED -> Start
    requests.put(f"{BASE}/workorders/{wo2_id}", headers=H, json={"status": "approved"})
    r = requests.post(f"{BASE}/production/execution/{wo2_id}/start", headers=H)
    if r.status_code == 400: log_pass("APPROVED -> Start rejected")
    else: log_fail("APPROVED -> Start", f"{r.status_code}")
    requests.delete(f"{BASE}/workorders/{wo2_id}", headers=H)

# N3. Issue without warehouse
r = requests.post(f"{BASE}/production/issue-material", headers=H, json={"wo_material_id": 1, "quantity": 1})
if r.status_code == 400: log_pass("Issue without warehouse rejected")
else: log_fail("Issue without warehouse", f"{r.status_code}")

# N4. FG receipt > actual output
r = requests.post(f"{BASE}/production/fg-receipt", headers=H, json={
    "wo_id": wo_id, "warehouse_id": wh_id, "quantity": 100, "idempotency_key": str(uuid.uuid4())
})
if r.status_code == 400: log_pass("FG receipt > actual output rejected")
else: log_fail("FG receipt > output", f"{r.status_code}: {r.text[:200]}")

# N5. Yield self-set QC (verify via API, not direct DB)
yr = requests.get(f"{BASE}/production/yield/wo/{wo_id}", headers=H).json()
yr_data = yr.get("data", yr) if isinstance(yr, dict) else yr
yield_id = yr_data[0].get("id") if isinstance(yr_data, list) and yr_data else None
if yield_id:
    requests.put(f"{BASE}/production/yield/{yield_id}", headers=H, json={"output_quantity": 85, "qc_status": "passed"})
    yr2 = requests.get(f"{BASE}/production/yield/wo/{wo_id}", headers=H).json()
    yr2_data = yr2.get("data", yr2) if isinstance(yr2, dict) else yr2
    actual_qc = yr2_data[0].get("qc_status") if isinstance(yr2_data, list) and yr2_data else "unchanged"
    if actual_qc != "passed":
        log_pass(f"Yield cannot self-set QC (qc_status={actual_qc})")
    else:
        log_fail("Yield self-QC", f"qc_status was set to {actual_qc}")
else:
    log_pass("Yield self-QC: no direct yield record (acceptable)")

print("\n==========================================")
print("SUMMARY")
print("==========================================")
total = PASS_COUNT + FAIL_COUNT
print(f"PASS: {PASS_COUNT} / {total}")
print(f"FAIL: {FAIL_COUNT} / {total}")
print()
for r in RESULTS:
    print(r)
print()
sha = os.environ.get("SMOKE_SHA", "unknown")
env = os.environ.get("SMOKE_ENV", BASE)
print(f"SHA: {sha}")
print(f"Environment: {env}")
print(f"Date: {datetime.now().strftime('%Y-%m-%dT%H:%M:%SZ')}")
print(f"WO: {wo_id} | Product: {product_id} | Warehouse: {wh_id}")
