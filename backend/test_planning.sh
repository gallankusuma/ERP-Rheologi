#!/bin/bash
TOKEN=$(node -e "const jwt=require('/var/www/erp-rheologi-dev/backend/node_modules/jsonwebtoken'); console.log(jwt.sign({userId:1},'dev-rheologi-secret-2026',{expiresIn:'1h'}))")
curl -s "http://localhost:3007/api/production/planning/weekly?year=2026&month=5" -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('Stats:', json.dumps(d['data']['stats'], indent=2))
print('WOs:', len(d['data']['workOrders']))
for w in d['data']['workOrders']:
    print('  ', w['wo_number'], w['status'], 'logs:', len(w.get('process_logs',[])), 'qc:', w['qc_total'], 'passed:', w['qc_passed'])
print('Weeks:', len(d['data']['weekColumns']))
"
