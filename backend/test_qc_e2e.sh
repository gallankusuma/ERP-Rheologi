#!/bin/bash
PORT=3007
BASE="http://localhost:$PORT"

# Generate JWT token using the correct secret
TOKEN=$(node -e "const jwt=require('/var/www/erp-rheologi-dev/backend/node_modules/jsonwebtoken'); console.log(jwt.sign({userId:1},'dev-rheologi-secret-2026',{expiresIn:'1h'}));")
echo "TOKEN_LEN=${#TOKEN}"

if [ ${#TOKEN} -lt 10 ]; then
  echo "FATAL: Cannot generate token"; exit 1
fi

AUTH="Authorization: Bearer $TOKEN"

echo ""
echo "=== STEP 1: Test ALL GET endpoints ==="
for ep in /api/quality/batches /api/quality/qc-tests /api/quality/qc-results /api/quality/batch-release /api/quality/test-definitions /api/quality/ncr /api/quality/rework /api/quality/sampling /api/quality/reports/summary /api/qc/parameters /api/qc/methods /api/qc/instruments /api/qc/areas /api/qc/fpa /api/qc/specs; do
  RESP=$(curl -s -w "\n%{http_code}" "$BASE$ep" -H "$AUTH")
  CODE=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | head -1 | head -c 80)
  if [ "$CODE" = "200" ]; then
    echo "  ✅ $ep => $CODE"
  else
    echo "  ❌ $ep => $CODE: $BODY"
  fi
done

echo ""
echo "=== STEP 2: Create QC Master Data ==="
# Parameter
P1=$(curl -s -X POST "$BASE/api/qc/parameters" -H "$AUTH" -H "Content-Type: application/json" -d '{"name":"Viscosity","description":"Kekentalan cairan"}')
P1_ID=$(echo $P1 | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
echo "  Parameter Viscosity => ID=$P1_ID ($P1)" | head -c 120; echo

P2=$(curl -s -X POST "$BASE/api/qc/parameters" -H "$AUTH" -H "Content-Type: application/json" -d '{"name":"pH Level","description":"Tingkat keasaman"}')
P2_ID=$(echo $P2 | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
echo "  Parameter pH => ID=$P2_ID"

# Method
M1=$(curl -s -X POST "$BASE/api/qc/methods" -H "$AUTH" -H "Content-Type: application/json" -d '{"name":"Brookfield Method","description":"Rotational viscometer"}')
M1_ID=$(echo $M1 | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
echo "  Method Brookfield => ID=$M1_ID"

# Instrument
I1=$(curl -s -X POST "$BASE/api/qc/instruments" -H "$AUTH" -H "Content-Type: application/json" -d '{"name":"Viscometer DV-II Pro","calibration_date":"2026-01-15"}')
I1_ID=$(echo $I1 | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
echo "  Instrument => ID=$I1_ID"

# Area
A1=$(curl -s -X POST "$BASE/api/qc/areas" -H "$AUTH" -H "Content-Type: application/json" -d '{"name":"Mixing Tank A"}')
A1_ID=$(echo $A1 | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
echo "  Sampling Area => ID=$A1_ID"

echo ""
echo "=== STEP 3: Get Product ==="
PROD_RESP=$(curl -s "$BASE/api/products" -H "$AUTH")
PROD_ID=$(echo $PROD_RESP | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
PROD_NAME=$(echo $PROD_RESP | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "  Product: $PROD_NAME (ID=$PROD_ID)"

echo ""
echo "=== STEP 4: Create QC Spec for Product ==="
if [ ! -z "$PROD_ID" ] && [ ! -z "$P1_ID" ]; then
  S1=$(curl -s -X POST "$BASE/api/qc/specs" -H "$AUTH" -H "Content-Type: application/json" -d "{\"product_id\":$PROD_ID,\"qc_type\":\"RS\",\"parameter_id\":$P1_ID,\"method_id\":$M1_ID,\"standard_value\":\"1500\",\"min_value\":\"1200\",\"max_value\":\"1800\",\"uom\":\"cPs\"}")
  echo "  Spec Viscosity: $(echo $S1 | head -c 100)"
  S2=$(curl -s -X POST "$BASE/api/qc/specs" -H "$AUTH" -H "Content-Type: application/json" -d "{\"product_id\":$PROD_ID,\"qc_type\":\"RS\",\"parameter_id\":$P2_ID,\"standard_value\":\"7.0\",\"min_value\":\"6.5\",\"max_value\":\"7.5\",\"uom\":\"pH\"}")
  echo "  Spec pH: $(echo $S2 | head -c 100)"
else
  echo "  SKIP - no product or parameter ID"
fi

echo ""
echo "=== STEP 5: Create FPA ==="
if [ ! -z "$PROD_ID" ]; then
  FPA=$(curl -s -X POST "$BASE/api/qc/fpa" -H "$AUTH" -H "Content-Type: application/json" -d "{\"type\":\"RS\",\"product_id\":$PROD_ID,\"sampling_area_id\":$A1_ID,\"batch_no\":\"BATCH-E2E-001\",\"quantity\":500,\"notes\":\"E2E Test FPA\"}")
  FPA_ID=$(echo $FPA | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
  FPA_NUM=$(echo $FPA | grep -o '"fpa_number":"[^"]*"' | cut -d'"' -f4)
  echo "  FPA: $FPA_NUM (ID=$FPA_ID)"
  echo "  Response: $(echo $FPA | head -c 150)"
else
  echo "  SKIP - no product"
fi

echo ""
echo "=== STEP 6: Get FPA Detail + Results ==="
if [ ! -z "$FPA_ID" ]; then
  FPA_DET=$(curl -s "$BASE/api/qc/fpa/$FPA_ID" -H "$AUTH")
  echo "  Detail: $(echo $FPA_DET | head -c 300)"
fi

echo ""
echo "=== STEP 7: Create Batch ==="
if [ ! -z "$PROD_ID" ]; then
  BATCH=$(curl -s -X POST "$BASE/api/quality/batches" -H "$AUTH" -H "Content-Type: application/json" -d "{\"product_id\":$PROD_ID,\"mfg_date\":\"2026-05-25\"}")
  BATCH_ID=$(echo $BATCH | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
  BATCH_NUM=$(echo $BATCH | grep -o '"batch_number":"[^"]*"' | cut -d'"' -f4)
  echo "  Batch: $BATCH_NUM (ID=$BATCH_ID)"
fi

echo ""
echo "=== STEP 8: Create QC Test + Result ==="
# Check existing tests
TESTS=$(curl -s "$BASE/api/quality/qc-tests" -H "$AUTH")
TEST_ID=$(echo $TESTS | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
if [ -z "$TEST_ID" ]; then
  TR=$(curl -s -X POST "$BASE/api/quality/qc-tests" -H "$AUTH" -H "Content-Type: application/json" -d '{"code":"VIS-001","name":"Viscosity Test","test_type":"chemical","test_method":"Brookfield"}')
  TEST_ID=$(echo $TR | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
  echo "  Created test: ID=$TEST_ID"
else
  echo "  Using existing test: ID=$TEST_ID"
fi

if [ ! -z "$BATCH_ID" ] && [ ! -z "$TEST_ID" ]; then
  QR=$(curl -s -X POST "$BASE/api/quality/qc-results" -H "$AUTH" -H "Content-Type: application/json" -d "{\"batch_id\":$BATCH_ID,\"test_id\":$TEST_ID,\"result\":\"1450 cPs\",\"status\":\"passed\"}")
  echo "  QC Result: $(echo $QR | head -c 120)"
fi

echo ""
echo "=== STEP 9: Create NCR ==="
NCR=$(curl -s -X POST "$BASE/api/quality/ncr" -H "$AUTH" -H "Content-Type: application/json" -d "{\"product_id\":$PROD_ID,\"category\":\"product\",\"severity\":\"minor\",\"description\":\"E2E Test - viscosity slightly out of spec\"}")
NCR_ID=$(echo $NCR | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
echo "  NCR: ID=$NCR_ID $(echo $NCR | head -c 120)"

echo ""
echo "=== STEP 10: Batch Release ==="
BR=$(curl -s "$BASE/api/quality/batch-release" -H "$AUTH")
echo "  Batch Release list: $(echo $BR | head -c 200)"

echo ""
echo "============================================"
echo "E2E TEST COMPLETE"
echo "============================================"
