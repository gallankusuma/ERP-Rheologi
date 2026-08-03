#!/bin/bash
PORT=3002
echo "Testing QC endpoints on port $PORT (dev)"
echo "========================================="

# Test each endpoint - just check HTTP status codes (no auth needed for this check)
for ep in /api/quality/batches /api/quality/qc-tests /api/quality/qc-results /api/quality/batch-release /api/quality/test-definitions /api/quality/ncr /api/quality/rework /api/quality/sampling /api/quality/reports/summary /api/qc/parameters /api/qc/methods /api/qc/fpa /api/qc/areas /api/qc/instruments; do
  CODE=$(curl -s -o /tmp/qc_resp.txt -w '%{http_code}' http://localhost:$PORT$ep -H "Authorization: Bearer test")
  BODY=$(cat /tmp/qc_resp.txt | head -c 60)
  if [ "$CODE" = "500" ]; then
    echo "FAIL $ep => HTTP $CODE: $BODY"
  else
    echo "OK   $ep => HTTP $CODE"
  fi
done

echo ""
echo "Done. HTTP 401 = auth required (expected). HTTP 200 = success. HTTP 500 = BUG."
