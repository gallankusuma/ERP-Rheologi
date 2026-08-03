#!/bin/bash
PORT=3007
BASE="http://localhost:$PORT"
TOKEN=$(node -e "const jwt=require('/var/www/erp-rheologi-dev/backend/node_modules/jsonwebtoken'); console.log(jwt.sign({userId:1},'dev-rheologi-secret-2026',{expiresIn:'1h'}))")
AUTH="Authorization: Bearer $TOKEN"

echo "=== Phase 3: Production ↔ QC Integration E2E ==="

echo ""
echo "--- Step 1: Get active WOs ---"
WOS=$(curl -s "$BASE/api/production/execution" -H "$AUTH")
WO_ID=$(echo $WOS | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data'][0]['id'] if d.get('data') and len(d['data'])>0 else '')" 2>/dev/null)
echo "  WO_ID=$WO_ID"

if [ -z "$WO_ID" ]; then
  echo "  No active WOs. Creating one..."
  # Get a product
  PROD_ID=$(mysql -u erp_user -p'ErpSecure2024!' erp_rheologi_dev -N -e "SELECT id FROM products LIMIT 1;" 2>/dev/null)
  echo "  PROD_ID=$PROD_ID"
  WO_NUM="WO-E2E-$(date +%s)"
  mysql -u erp_user -p'ErpSecure2024!' erp_rheologi_dev -e "INSERT INTO work_orders (wo_number, product_id, quantity, status) VALUES ('$WO_NUM', $PROD_ID, 100, 'in_progress');" 2>/dev/null
  WO_ID=$(mysql -u erp_user -p'ErpSecure2024!' erp_rheologi_dev -N -e "SELECT id FROM work_orders WHERE wo_number='$WO_NUM';" 2>/dev/null)
  echo "  Created WO: $WO_NUM (ID=$WO_ID)"
fi

echo ""
echo "--- Step 2: Add QC Checkpoints ---"
CP_RESP=$(curl -s -X POST "$BASE/api/production/execution/$WO_ID/qc-checkpoints" -H "$AUTH" -H "Content-Type: application/json" -d '{
  "stages": [
    {"process_stage": "Mixing", "is_mandatory": true},
    {"process_stage": "Filling", "is_mandatory": true},
    {"process_stage": "Final QC", "is_mandatory": false}
  ]
}')
echo "  Checkpoints: $CP_RESP"

echo ""
echo "--- Step 3: Get QC Checkpoints ---"
CPS=$(curl -s "$BASE/api/production/execution/$WO_ID/qc-checkpoints" -H "$AUTH")
echo "  Checkpoints: $(echo $CPS | head -c 500)"

echo ""
echo "--- Step 4: Try completing WO (should FAIL - QC pending) ---"
COMPLETE=$(curl -s -X POST "$BASE/api/production/execution/$WO_ID/complete" -H "$AUTH")
echo "  Complete attempt: $COMPLETE"

echo ""
echo "--- Step 5: Add process log with completed status (auto-trigger QC) ---"
LOG_RESP=$(curl -s -X POST "$BASE/api/production/execution/$WO_ID/logs" -H "$AUTH" -H "Content-Type: application/json" -d '{
  "process_name": "Mixing",
  "status": "completed",
  "notes": "Mixing complete - viscosity looks good"
}')
echo "  Log response: $LOG_RESP"

echo ""
echo "--- Step 6: Check checkpoints after auto-trigger ---"
CPS2=$(curl -s "$BASE/api/production/execution/$WO_ID/qc-checkpoints" -H "$AUTH")
echo "  Checkpoints: $(echo $CPS2 | head -c 500)"

echo ""
echo "--- Step 7: Manual trigger QC for Filling ---"
# Get the Filling checkpoint ID
FILL_CP_ID=$(echo $CPS2 | python3 -c "import sys,json; d=json.load(sys.stdin); cps=[c for c in d.get('data',[]) if c['process_stage']=='Filling']; print(cps[0]['id'] if cps else '')" 2>/dev/null)
echo "  Filling checkpoint ID: $FILL_CP_ID"
if [ ! -z "$FILL_CP_ID" ]; then
  TRIG=$(curl -s -X POST "$BASE/api/production/execution/$WO_ID/trigger-qc/$FILL_CP_ID" -H "$AUTH")
  echo "  Trigger response: $TRIG"
fi

echo ""
echo "--- Step 8: Verify execution shows QC counts ---"
EXEC=$(curl -s "$BASE/api/production/execution" -H "$AUTH")
echo "  Execution data: $(echo $EXEC | python3 -c "import sys,json; d=json.load(sys.stdin); wo=[w for w in d.get('data',[]) if w['id']==$WO_ID]; print(json.dumps({k:wo[0][k] for k in ['wo_number','qc_total','qc_passed','qc_pending_mandatory']} if wo else {},indent=2))" 2>/dev/null)"

echo ""
echo "============================================"
echo "E2E TEST COMPLETE"
echo "============================================"
