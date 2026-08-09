Secara overall, revisi ini maju jauh. State machine Production sudah mulai konsisten, warehouse guard sudah benar, dan FG receipt sekarang memakai actual output. Tapi setelah gue trace end-to-end, belum bisa FIRM/FREEZE karena masih ada beberapa residual yang langsung berkaitan dengan blocker kita sebelumnya.

Scope Verdict
Shared WO state machine ✅ CLOSED
Execution RELEASED → IN_PROGRESS → ON_HOLD ✅ CLOSED
Execution list canonical statuses ✅ CLOSED
Warehouse wajib explicit ✅ CLOSED
Issue backend status guard ✅ CLOSED
WorkOrders UI canonical status ✅ CLOSED
FG receipt ≤ actual output ✅ CLOSED
Yield POST tidak bisa self-QC ✅ CLOSED
Exact/pinned approved BOM 🔴 P0 residual
QC completion bypass 🔴 P0 residual
Yield/QC source-of-truth 🔴 P0 residual
Issue Material UI state contract 🔴 P0 residual
FG Receipt idempotency E2E 🔴 P0 residual
MRP dashboard frontend contract 🟠 P1 residual
Production Planning persistence 🟠 P1 open
Production permissions 🟠 P1 open
🔴 P0 — QC masih bisa dibypass lewat Work Orders

Endpoint Production Execution /complete sekarang sudah bagus: dia validasi transition dan mandatory QC checkpoint.

Tapi generic:

PUT /api/workorders/:id

masih mengizinkan:

IN_PROGRESS → COMPLETED

hanya berdasarkan validateTransition(), tanpa mandatory QC validation.

Dan WorkOrders UI memang masih menyediakan option Completed.

Jadi flow ini masih mungkin:

IN_PROGRESS
→ Work Orders dropdown
→ COMPLETED
→ QC pending terlewati

Ini P0.

Minimal fix: prerequisite COMPLETED harus sama di semua entry point, bukan cuma /production/execution/:woId/complete.

🔴 P0 — Yield/QC source-of-truth belum selesai

POST Yield sekarang sudah benar. qc_status dipaksa menjadi pending; Production operator tidak menentukan hasil QC.

Tapi PUT Yield masih menerima qc_status dari request dan menulisnya langsung:

UPDATE wo_results ... qc_status=?

Artinya API masih bisa:

PUT /production/yield/123
→ { qc_status: "passed" }

Ini harus ditutup.

Lebih fundamental lagi, gue cek current QC route dan tidak menemukan Quality melakukan update ke wo_results.qc_status; Quality saat ini menyelesaikan wo_qc_checkpoints, bukan yield record. Sementara FG Receipt sekarang justru mencari:

wo_results WHERE qc_status='passed'

Jadi ada kontradiksi:

Production tidak boleh set QC passed
tetapi
Quality belum mengubah Yield menjadi passed.

Akhirnya legitimate FG Receipt bisa mentok.

Canonical flow harus menjadi:

QC/FPA result
→ update linked checkpoint
→ derive overall WO QC
→ update/derive wo_results.qc_status
→ FG Receipt allowed.

Production Yield POST/PUT tidak boleh menerima qc_status.

🔴 P0 — Exact BOM masih belum 100%

Fix-nya sudah benar untuk PPIC-generated WO: Generate Materials sekarang prioritaskan wo.bom_id.

Tapi kalau bom_id null, backend masih fallback ke:

latest ACTIVE BOM by product.

Masalahnya manual WO sekarang tidak menyimpan bom_id sama sekali saat dibuat.

Jadi:

Manual WO Product A
→ BOM v1 saat WO dibuat
→ kemudian BOM v2 dibuat
→ Generate Material
→ bisa mengambil v2.

Recipe WO berubah setelah WO dibuat.

Selain itu ACTIVE bukan berarti approved; BOM sendiri punya approval_status.

Menurut gue closure P0-nya:

setiap WO wajib pin satu exact bom_id sebelum Release.

Generate Material harus membaca hanya work_orders.bom_id.

Kalau tidak ada:

400 — Work Order has no approved BOM assigned

Jangan fallback diam-diam.

Dan BOM tersebut harus:

status = ACTIVE

- approval_status = fully approved.

🔴 P0 — Issue Material UI belum mengikuti state machine baru

Backend sekarang benar:

material issue hanya untuk:

RELEASED / IN_PROGRESS / ON_HOLD

dan warehouse_id wajib dikirim.

Tapi UI Issue Material masih filter:

Planned
planned
In Production
in_progress
in-progress
pending

RELEASED tidak ada.

Padahal flow resmi kita:

APPROVED
→ RELEASED
→ Issue Material
→ IN_PROGRESS

Jadi WO yang seharusnya siap issue justru tidak terlihat.

Ubah UI filter menjadi minimal:

released
in_progress
on_hold

case-normalized.

🔴 P0 — FG Receipt idempotency belum end-to-end

Backend sebenarnya sudah punya support:

idempotency_key

dan duplicate key akan ditolak.

Tapi frontend FG Receipt tidak pernah mengirim idempotency_key.

Untuk full receipt, quantity cap sering menyelamatkan double-click. Tetapi untuk partial receipt, misalnya actual output 1,000 dan user receipt 200, double-submit 200 masih bisa dianggap dua receipt sah karena total baru 400.

Untuk inventory transaction, ini harus deterministic.

Frontend generate satu UUID/token ketika modal Receive dibuka lalu kirim key yang sama untuk retry/double-click transaction yang sama.

🟠 P1 — Production MRP schema sudah benar, DTO belum

Developer sudah mengganti query legacy ke canonical:

bom_headers
bom_details
inventory_stocks
work_orders.quantity

Bagus.

Tapi backend sekarang mengembalikan material seperti:

id
name
sku
current_stock
required_qty
gap

dan Work Orders basic fields.

Sedangkan ProductionMRP.vue masih membaca:

material_id
material_name
material_sku
total_required
stock_available
total_shortage
uom_name
wos[]

serta:

wo_id
wo_qty
materials[]
has_shortage

Jadi database query mungkin tidak error lagi, tetapi halaman Material Readiness belum punya contract yang benar.

Karena kita tidak mau redesign UI, backend saja yang adapt DTO ke UI existing.

🟠 P1 — Production Planning masih tidak persistent

Ini belum disentuh di commit.

Daily grid Planned dan Actual masih editable di frontend, sementara load-nya hanya:

GET /production/planning/weekly

Tidak ada save contract untuk perubahan daily schedule.

Jadi angka user bisa berubah di screen lalu hilang saat refresh.

Untuk closure paling sempit: kalau grid memang calculated view, jadikan cell read-only. Kalau memang schedule operasional, baru persist daily schedule. Yang tidak boleh adalah editable tapi tidak tersimpan.

🟠 P1 — Permission Production masih mismatch

Canonical permission yang di-seed adalah:

production.planning
production.execution
production.workorders

Frontend menu juga memakai resource tersebut.

Tapi backend masih punya:

production.production-planning

untuk Planning,

production.production-execution

untuk Execution reads,

dan bahkan:

production.issue-material

untuk Issue Material GET.

Padahal resource-resource itu bukan canonical permission set.

Master Admin mungkin tidak terasa karena bypass/permission luas, tetapi regular Production role bisa melihat menu lalu API 403.

Jangan bikin permission baru. Backend tinggal mengikuti canonical existing resources.

Jadi verdict gue

Revision 626d95d = improvement besar, tapi belum clean.

Yang sudah benar jangan disentuh lagi: shared state transitions, Execution status list, mandatory warehouse backend guard, issue inventory transaction/lock, canonical WorkOrders status, actual-output FG cap, dan canonical DB schema MRP.

Sisa target dev cukup 5 P0 + 3 P1 di atas. Tidak perlu screening ulang arsitektur lain setelah itu.

Setelah revision berikutnya masuk, gue akan re-review hanya residual ini, lalu smoke Production kita:

PPIC WO → APPROVED → RELEASED → pinned BOM → Issue Material → IN_PROGRESS → process/QC → Yield → QC passed → COMPLETED → FG Receipt → Inventory

dengan negative gate: Draft cannot start, QC pending cannot complete dari endpoint mana pun, Production cannot self-pass QC, wrong/missing warehouse rejected, receipt > actual rejected, duplicate receipt rejected.
