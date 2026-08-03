#!/bin/bash
PORT=3007
BASE="http://localhost:$PORT"

TOKEN=$(node -e "const jwt=require('/var/www/erp-rheologi-dev/backend/node_modules/jsonwebtoken'); console.log(jwt.sign({userId:1},'dev-rheologi-secret-2026',{expiresIn:'1h'}))")
echo "TOKEN_LEN=${#TOKEN}"

AUTH="Authorization: Bearer $TOKEN"

echo ""
echo "=== Test 1: Check endpoint exists ==="
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/ppic/mrp/generate-pr" -H "$AUTH" -H "Content-Type: application/json" -d '{}')
echo "  POST /api/ppic/mrp/generate-pr (empty body) => HTTP $CODE"

echo ""
echo "=== Test 2: Generate PR with test materials ==="
RESP=$(curl -s -X POST "$BASE/api/ppic/mrp/generate-pr" -H "$AUTH" -H "Content-Type: application/json" -d '{
  "materials": [
    {"material_id": 221, "material_name": "Test Material A", "uom_name": "Kgs", "total_net_requirement": 150.5, "lead_time": 2},
    {"material_id": 222, "material_name": "Test Material B", "uom_name": "Ltr", "total_net_requirement": 75, "lead_time": 3}
  ],
  "year": 2026,
  "notes": "E2E Test - MRP to PR generation"
}')
echo "  Response: $RESP"

# Extract PR info
PR_ID=$(echo $RESP | grep -o '"pr_id":[0-9]*' | cut -d: -f2)
PR_NUM=$(echo $RESP | grep -o '"pr_number":"[^"]*"' | cut -d'"' -f4)
echo "  PR_ID=$PR_ID, PR_NUMBER=$PR_NUM"

echo ""
echo "=== Test 3: Verify PR exists in procurement ==="
if [ ! -z "$PR_ID" ]; then
  PR_DATA=$(curl -s "$BASE/api/procurement/purchase-requests/$PR_ID" -H "$AUTH")
  echo "  PR Data: $(echo $PR_DATA | head -c 300)"
  
  echo ""
  echo "=== Test 4: Verify PR Items ==="
  # Check if items were created
  ITEMS=$(mysql -u erp_user -p'ErpSecure2024!' erp_rheologi_dev -e "SELECT * FROM purchase_request_items WHERE purchase_request_id=$PR_ID;" 2>/dev/null)
  echo "  Items: $ITEMS"
fi

echo ""
echo "=== DONE ==="
