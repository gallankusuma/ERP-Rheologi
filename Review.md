2 P0 residual + 1 P1 direct defect.

Scope Status
Generic WO → Completed QC bypass ✅ CLOSED
Yield POST self-QC ✅ CLOSED
Yield PUT self-QC ✅ CLOSED
FG backend QC gate ✅ CLOSED
Issue Material UI status ✅ CLOSED
FG idempotency frontend/backend ✅ CLOSED
Planning persistence ✅ CLOSED
Production permissions ✅ CLOSED
Pinned approved BOM 🔴 P0
FG Receipt QC read model 🔴 P0
MRP UOM query 🟠 P1
🔴 P0 — pinned BOM masih belum memastikan approved BOM

Manual WO sekarang memang sudah auto-pin BOM saat create. Itu improvement yang benar.

Tapi query-nya masih:

SELECT id
FROM bom_headers
WHERE product_id = ?
AND status = 'ACTIVE'
ORDER BY id DESC
LIMIT 1

Masalahnya canonical BOM punya field approval terpisah:

approval_status

Jadi bisa terjadi:

BOM v2
status = ACTIVE
approval_status = 0 ← belum approve

Manual WO
↓
auto-pin BOM v2
↓
RELEASED
↓
Production pakai recipe belum approved

Lebih lanjut, kalau tidak ada BOM, create WO sekarang masih boleh:

bom_id = null

dan transition ke released cuma mengecek line_process_id; belum mengecek BOM.

Generate Material memang sekarang sudah strict dan menolak kalau bom_id kosong.

Tapi itu terlalu terlambat. WO seharusnya tidak boleh RELEASED kalau recipe belum valid.

Target fix final:

SELECT id
FROM bom_headers
WHERE product_id = ?
AND status = 'ACTIVE'
AND approval_status = 2
ORDER BY id DESC
LIMIT 1

Dan saat transition:

APPROVED → RELEASED

backend wajib validate:

bom_id exists
BOM.product_id == WO.product_id
BOM.status == ACTIVE
BOM.approval_status == 2
line_process_id exists

Kalau tidak:

400 Cannot release WO without an active fully-approved BOM

Generate Material juga sebaiknya revalidate pinned BOM tersebut sebelum explosion.

🔴 P0 — QC backend sudah benar, tapi FG Receipt UI masih membaca field lama

Ini subtle tapi nyata.

Production Yield sekarang sudah tidak boleh menulis qc_status saat update. Good.

FG Receipt POST juga sudah jauh lebih benar karena sekarang source-of-truth QC-nya:

wo_qc_checkpoints

bukan wo_results.qc_status. Backend menolak kalau tidak ada QC atau mandatory QC belum pass.

Quality memang mengubah linked wo_qc_checkpoints.status menjadi passed/failed.

Tapi GET /production/fg-receipt masih return:

wr.qc_status

dan frontend masih menentukan tombol Receive dengan:

v-if="pendingQty(r) > 0 && r.qc_status === 'passed'"

Padahal wo_results.qc_status sekarang sengaja tidak lagi diubah oleh Production.

Jadi bisa terjadi:

Quality FPA = PASS
↓
wo_qc_checkpoint = passed ✅
↓
backend POST FG sebenarnya allow ✅

TAPI

wo_results.qc_status = pending
↓
FG Receipt UI = Awaiting QC
↓
button Receive tidak muncul ❌

Ini flow blocker.

Solusi paling clean: GET /fg-receipt harus derive QC dari wo_qc_checkpoints, sama persis dengan POST gate.

Misalnya return:

qc_status = passed
qc_gate_passed = true

jika:

qcTotal > 0
AND mandatory_not_passed = 0

Kalau ada mandatory failed:

qc_status = failed

Sisanya:

qc_status = pending

Frontend boleh tetap pakai:

r.qc_status === 'passed'

jadi nggak perlu redesign UI.

🟠 P1 — MRP dashboard ada typo canonical UOM

DTO MRP sekarang secara struktur sudah benar. Backend sudah return:

material_id
material_name
total_required
stock_available
total_shortage
uom_name
wos[]

dan per-WO materials[].

Tapi query material punya:

LEFT JOIN uom u ON p.uom_id = u.id

Sedangkan canonical Product schema/API pakai:

p.unit_of_measure_id

dan gue juga tidak menemukan migration yang menambahkan products.uom_id.

Jadi fix-nya simpel:

LEFT JOIN uom u
ON p.unit_of_measure_id = u.id

Kalau tidak, /production/mrp/dashboard berpotensi runtime:

Unknown column 'p.uom_id'

Yang kemarin gue minta dan sekarang sudah bagus:

QC completion bypass CLOSED — generic PUT /workorders/:id sekarang juga mengecek mandatory QC saat transition ke completed.

Issue Material CLOSED — UI sekarang pakai canonical ISSUABLE_WO_STATUSES, jadi RELEASED / IN_PROGRESS / ON_HOLD inline dengan backend.

FG idempotency CLOSED — modal membuat satu UUID per receipt transaction dan mengirim key yang sama saat retry.

Planning persistence CLOSED — sudah ada wo_daily_schedule, transactional PUT /planning/daily/:woId, dan frontend punya Save + restore saved schedule.

Permission mismatch CLOSED — Planning sekarang production.planning, Execution production.execution, dan Issue Material memakai canonical production.workorders.

Verdict sekarang

Production Revision 5bb53f5 = hampir clean.

Tinggal tiga perubahan:

P0: pin + Release hanya dengan ACTIVE + approval_status=2 BOM.
P0: /fg-receipt GET derive QC status dari wo_qc_checkpoints, jangan wo_results.qc_status.
P1: p.uom_id → p.unit_of_measure_id pada MRP dashboard.

Jangan ubah scope lain. Setelah tiga ini dipush, gue recheck hanya tiga titik tersebut.

Kalau clean, status langsung:

PRODUCTION CODE REVIEW = CONDITIONALLY CLEAN / TEST GATE REQUIRED ✅

Lalu kita bikin/run Production smoke:

DRAFT → APPROVED → RELEASED → Issue Material → IN_PROGRESS → QC → Yield → COMPLETED → FG Receipt → Inventory
