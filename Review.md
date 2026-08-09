Feature-nya sebenarnya sudah lumayan lengkap:

Production Planning → Material Readiness/MRP → Issue Material → Production Execution → QC → Yield/Scrap → FG Receipt → History

Tapi business lifecycle-nya belum konsisten. Ada beberapa blocker yang menurut gue memang harus dibereskan sebelum kita bicara Production firm.

Priority Blocker Status
🔴 P0 WO state machine bisa dibypass dari Production Execution OPEN
🔴 P0 PPIC WO DRAFT/APPROVED/RELEASED tidak nyambung ke Execution UI OPEN
🔴 P0 BOM Production tidak pakai exact work_orders.bom_id OPEN
🔴 P0 BOM status ACTIVE vs query Production approved mismatch OPEN
🔴 P0 Issue Material bisa potong default warehouse 1 OPEN
🔴 P0 FG Receipt belum backend-enforce actual yield/QC OPEN
🔴 P0 Yield bisa mengisi qc_status='passed' manual OPEN
🟠 P1 Production MRP dashboard masih query legacy schema OPEN
🟠 P1 Planning daily Planned/Actual tidak persistent OPEN
🟠 P1 WorkOrders UI masih status legacy OPEN
🟠 P1 Production permission resources tidak konsisten OPEN
P0 paling fundamental: satu WO punya dua state machine

Backend /api/workorders sebenarnya sudah bagus dan punya canonical transition:

DRAFT → APPROVED → RELEASED → IN_PROGRESS → ON_HOLD / COMPLETED → CLOSED

dengan validation transition dan line-process prerequisite.

Tapi /api/production/execution/:woId/start sekarang langsung melakukan:

UPDATE work_orders SET status='in_progress'

tanpa melewati state machine itu. Pause/resume/complete juga direct UPDATE.

Frontend bahkan menganggap DRAFT, pending, dan planned sebagai WO yang boleh langsung Start Production.

Artinya secara API saat ini potensial:

DRAFT → IN_PROGRESS

langsung.

Itu harus ditutup.

Semua perubahan status Production harus memakai satu transition service/business rule yang sama dengan workorder.routes.ts.

PPIC → Production sekarang juga belum nyambung sempurna

PPIC menghasilkan WO sebagai:

DRAFT

dan flow yang kita sepakati adalah:

DRAFT → APPROVED → RELEASED → IN_PROGRESS

Tetapi endpoint /production/execution hanya mengambil:

in_progress
in-progress
pending
planned

Jadi WO RELEASED justru tidak muncul untuk di-Start.

ON_HOLD juga tidak masuk query tersebut, padahal UI punya tombol Resume. Akibatnya setelah Pause, WO bisa menghilang dari halaman Execution.

Target Execution harus minimal melihat:

RELEASED / IN_PROGRESS / ON_HOLD

dan Start hanya dari RELEASED.

P0 BOM / recipe integrity

Ini lebih serius dari sekadar status.

WO dari PPIC sudah menyimpan exact bom_id.

Tetapi Generate Material Production sekarang mengabaikan wo.bom_id dan mencari lagi BOM berdasarkan product:

WHERE bh.product_id = ? AND bh.status = 'approved'

Padahal canonical BOM saat create diberi:

status = 'ACTIVE'

dan approval memakai field terpisah approval_status.

Jadi ada dua risiko sekaligus.

Pertama, WO bisa bilang “No approved BOM” padahal BOM valid sebenarnya ACTIVE.

Kedua, yang jauh lebih berbahaya: kalau BOM Product A berubah setelah WO dibuat, Production bisa mengambil BOM terbaru, bukan BOM yang sebenarnya melekat ke WO.

Untuk manufacturing ERP, ini nggak boleh.

Canonical harus:

WO → work_orders.bom_id → exact BOM details

Jangan lookup recipe lagi berdasarkan product.

Manual WO juga sebaiknya saat dibuat harus memilih/resolve BOM tertentu dan menyimpan bom_id.

P0 Issue Material

Transaksi issue material sudah lumayan bagus karena menggunakan transaction + FOR UPDATE dan mencegah negative stock.

Tapi ada satu masalah besar:

backend menentukan:

warehouse_id || mat.warehouse_id || 1

Artinya kalau warehouse tidak dikirim, Warehouse ID 1 dipakai diam-diam.

Frontend tombol Issue Semua memang bisa mengirim warehouse undefined.

Jadi satu click bisa memotong gudang yang salah.

Target:

warehouse wajib explicit.

Tidak boleh fallback default warehouse untuk stock transaction.

Selain itu Issue Material backend harus cek status WO. Idealnya material issue hanya boleh untuk:

RELEASED / IN_PROGRESS / ON_HOLD

bukan Draft/Closed/Cancelled.

P0 Yield → QC → Finished Goods

Saat ini halaman Yield memungkinkan operator memasukkan sendiri:

qc_status = pending / passed / failed

Padahal Quality module sudah punya mechanism yang benar: FPA yang selesai otomatis update linked wo_qc_checkpoint menjadi passed/failed.

Jadi Production user tidak boleh menjadi source of truth QC.

qc_status seharusnya derived dari Quality/QC.

Lebih serius lagi, backend FG Receipt sekarang hanya mengecek WO status in_progress/completed. Dia tidak memvalidasi bahwa Quality passed dan tidak membatasi receipt terhadap actual output.

Limit sekarang:

alreadyReceived + quantity <= wo.quantity \* 1.1

Padahal yang benar mestinya:

Maximum FG receipt = actual accepted output dari wo_results

Contoh:

Planned = 1,000
Actual output = 820
Scrap = 180

inventory tidak boleh menerima 1,000 atau 1,100.

Yang boleh diterima maksimal:

820 FG

dan hanya setelah QC gate yang sesuai.

Frontend memang menyembunyikan tombol Receive sampai qc_status === passed, tapi itu UI-only. Backend tetap harus enforce.

FG receipt juga sudah punya konsep idempotency_key, tetapi frontend belum mengirimnya. Jadi protection tersebut belum efektif end-to-end.

Production MRP sekarang broken secara model data

Frontend Production MRP ternyata memanggil:

GET /production/mrp/dashboard

Endpoint itu masih query model legacy seperti:

boms
bom_items
inventory_transactions
wo.qty

Sedangkan canonical schema sekarang:

bom_headers
bom_details
inventory_stocks
work_orders.quantity

Jadi Production MRP / Material Readiness harus diganti ke canonical schema.

Menurut gue jangan bikin MRP kedua yang bersaing dengan PPIC. Di Production fungsi layar ini sebaiknya menjadi:

WO Material Readiness

bukan planning MRP baru.

PPIC tetap owner MRP.

Production hanya menjawab:

“Untuk WO yang sudah Release, material yang dibutuhkan berapa, sudah issue berapa, stock tersedia berapa, shortage berapa?”

Production Planning juga perlu dirapikan

Planning UI sebenarnya sudah cukup keren: dia auto-spread WO quantity ke hari kerja berdasarkan machine capacity.

Tapi angka Planned / Actual dapat diedit langsung oleh user dan tidak ada save endpoint.

Auto-extended scheduled_end juga hanya mengubah object frontend.

Refresh page → perhitungan ulang.

Jadi kita harus memilih semantic yang jelas:

kalau read-only simulation → input jangan editable.

Atau:

kalau operational schedule → simpan daily schedule ke backend.

Untuk ERP production, gue lebih condong operational schedule harus persistent.

WorkOrders UI harus ikut canonical state

UI Work Orders masih memakai:

DRAFT
Planned
In Production
On Hold
Completed

Backend state machine memakai:

DRAFT
APPROVED
RELEASED
IN_PROGRESS
ON_HOLD
COMPLETED
CLOSED
CANCELLED

Kita harus pilih satu canonical state set, dan menurut gue backend state machine yang sekarang sudah benar.

Jangan pertahankan Planned / In Production sebagai state baru. Kalau mau label UI manusiawi, boleh tampilkan:

IN_PROGRESS → "In Production"

tapi value backend tetap IN_PROGRESS.

Target Production flow yang gue mau kita lock

PPIC Confirmed MPS
→ Generate DRAFT WO
→ APPROVED
→ RELEASED
→ bind exact BOM + Line
→ Generate WO Materials
→ Issue Materials
→ IN_PROGRESS
→ Process Logs
→ In-Process / Final QC
→ Record actual Yield + Scrap
→ Mandatory QC Passed
→ COMPLETED
→ FG Receipt = actual accepted output
→ Inventory + Batch traceability
→ CLOSED

Dan negative flow nanti wajib mencakup:

Draft → Start = rejected
Approved → Start = rejected
Released without line = rejected
Issue material from wrong warehouse = impossible
Over-issue material = rejected
Insufficient stock = rollback
Complete with mandatory QC pending = rejected
Production cannot self-set QC passed
FG receipt before QC = rejected
FG receipt > actual output = rejected
Duplicate receipt = rejected
Closed WO mutation = rejected

Jadi kalau kita lock baseline ini, fokus dev Production nanti bukan redesign UI. UI existing sudah cukup bagus. Fokusnya menyatukan lifecycle, BOM source, inventory transactions, QC, yield, dan FG receipt.
