Gas bro. Gue sudah review next module = Procurement, tapi bukan cuma halaman PR/PO-nya. Gue trace sebagai satu operational chain:

MRP → PR → Approval → Bidding → PO → Approval → GRN → QC HOLD → Incoming QC → AVAILABLE

Verdict awal gue: Procurement belum FIRM. Ada beberapa P0 yang bisa bikin angka planning salah, partial receipt nggak jalan, sampai stok/ledger corrupt.

Temuan utama
P0 — PO yang sudah fully approved belum tentu dianggap Scheduled Receipt oleh MRP. Frontend membuat PO dengan status: 'submitted', sementara endpoint approval PO hanya menaikkan approval_status menjadi 2; dia tidak mengubah status menjadi APPROVED. Padahal MRP hanya mengambil PO dengan business status APPROVED / PROCESSING / PARTIAL dan approval_status=2. Jadi bisa terjadi: UI bilang PO approved, tetapi PPIC/MRP tidak melihat barang itu sebagai incoming supply.
P0 — Partial GRN saat ini secara desain diblok. Backend punya rule eksplisit: satu PO tidak boleh punya GRN aktif kedua. Frontend juga menyembunyikan PO yang sudah punya satu GRN. Ini salah untuk kasus normal seperti PO 1.000 kg → supplier kirim 600 kg hari ini → 400 kg minggu depan. Sistem harus support multiple GRN against one PO sampai outstanding = 0.
P0 — purchase_order_items.received_qty tidak terlihat pernah di-update oleh flow GRN. Repo-wide reference received_qty muncul di calculation MRP/schema, bukan pada receipt posting flow. Artinya MRP bisa terus menganggap PO masih outstanding walaupun barang sebenarnya sudah diterima. Ini pasangannya masalah nomor 2: canonical PO item harus punya ordered / received / outstanding.
P0 — GRN approval tidak atomic dan ledger malah berpotensi double-post. Code lebih dulu set GRN approval_status=2, status='approved', baru setelah itu membuat stock movement, update inventory_stocks, dan create Incoming QC. Kalau inventory posting gagal, GRN sudah telanjur approved. Lebih parah, approval block membuat stock_movements inbound, lalu applyGrnToInventory() juga membuat stock movement inbound kedua untuk GRN/item yang sama. Jadi canonical ledger berpotensi mencatat 2× receipt sementara physical balance hanya 1×.
P0 — Idempotency GRN-nya tidak valid. applyGrnToInventory() mengecek inventory_transactions untuk mengetahui apakah GRN sudah diposting, tetapi di fungsi tersebut yang ditulis justru inventory_stocks dan stock_movements; tidak terlihat insert corresponding inventory_transactions. Jadi idempotency marker dan actual side effect bukan satu source-of-truth.
P0 — GRN create/delete memakai dua sumber item berbeda. Current UI membuat GRN dengan items disimpan sebagai JSON di goods_receipts.notes. Backend approval juga membaca item dari notes. Tetapi saat delete/reverse approved GRN, backend membaca grn_items. Itu mismatch parah: create/approve bisa punya 600 kg di JSON, tetapi reversal membaca tabel yang kosong/beda. Bahkan query reversal mengurangi inventory_stocks berdasarkan product+warehouse tanpa status, sehingga qc_hold dan available dapat terkena bersama-sama.
P0 — Incoming QC belum lot/GRN safe. qc_hold digabung hanya berdasarkan product_id + warehouse_id + status, bukan berdasarkan GRN/lot/batch. Saat QC PASS, release juga mengambil pool product+warehouse tersebut. Jadi kalau GRN-A dan GRN-B untuk material yang sama sama-sama HOLD, sistem tidak bisa menjamin FPA-A benar-benar merilis stok milik GRN-A. Untuk QA traceability ini nggak boleh.
P0 — QC masih punya jalur approval bypass. /fpa/:id/approve-2 memang melakukan QC HOLD → AVAILABLE, tapi backend juga masih expose /fpa/:id/approve yang langsung menandai FPA Approved/Passed tanpa menjalankan inventory release yang sama. Jadi ada dua finalization contract dengan side-effect berbeda. Harus tinggal satu canonical final approval path.
P0 — QC release sendiri belum idempotent/transaction-safe. approve-2 tidak terlihat punya FOR UPDATE, transaction, atau guard bahwa approved_by_2 sudah pernah dieksekusi. Dan ketika available row sudah ada, code menambahkan releaseQty dahulu lalu baru menghitung sisa HOLD; kalau releaseQty > holdQty, ini bisa mint stock. Rule-nya harus mutlak: release_qty <= held_qty, row-lock, one-time release.
P0 — Approved PR/PO belum immutable di backend. PUT /purchase-requests/:id tidak mengecek approval state, dan PUT /purchase-orders/:id bahkan bisa delete semua existing PO items lalu insert ulang item baru tanpa memaksa reapproval. UI memang membatasi sebagian, tetapi business contract jangan bergantung ke UI. Approved document must be immutable, atau perubahan material harus reset approval + audit revision.

Ada dua P1 yang juga gue mau mereka rapikan setelah P0: PO allocation menghitung seluruh PO yang terkait PR tanpa mengecualikan PO cancelled/rejected sehingga quantity bisa tetap “reserved”; dan halaman PR belum menampilkan source_type/MRP provenance sama sekali—operator Procurement saat ini melihat PR number/item, tetapi belum mendapat jawaban eksplisit “PR ini dibuat manual atau MRP, MPS/demand mana yang menyebabkan PR ini?”.

Comment buat development

PROCUREMENT CROSS-MODULE REVIEW — P0 HOLD

WO/Production Planning scope remains frozen. Do not redesign it.

Procurement cannot be declared FIRM yet. Stabilize the complete:

PR → PO → GRN → QC HOLD → Incoming QC → AVAILABLE

contract.

P0-1 — PO lifecycle must be canonical.
Full PO approval must transition business status to the canonical approved/open state consumed by MRP. approval_status=2 with status='submitted' is not acceptable.

P0-2 — Support partial receipts.
One PO may produce multiple GRNs. Maintain per PO item:

ordered_qty
received_qty
outstanding_qty

Reject GRN quantity only when cumulative received exceeds ordered quantity. Never block a second GRN merely because the first exists.

P0-3 — GRN posting must be one DB transaction.
GRN final approval + received_qty + qc_hold inventory + exactly one stock movement + QC request must commit together or rollback together.

Do not mark GRN approved before inventory posting succeeds.

P0-4 — Use one canonical GRN item table.
Stop using JSON notes as the operational source while reversal uses grn_items. Persist GRN lines relationally and use the exact same rows for approval, inventory posting, QC, reversal and audit.

P0-5 — Remove double stock ledger posting.
One physical GRN receipt must create exactly one canonical inbound stock movement. Add DB-level idempotency such as unique source identity per GRN item/posting.

P0-6 — Lot/GRN-specific QC HOLD.
Do not pool different GRNs into an indistinguishable product + warehouse + qc_hold balance. The held quantity must retain GRN/batch/lot provenance until QC disposition.

Required chain:

GRN Item → QC Hold Lot → Incoming FPA → QC Release → Available Lot

P0-7 — One final Incoming QC approval path only.
No endpoint may mark Incoming FPA Passed/Approved without performing the exact same validated stock release.

Release must be transactional, row-locked, idempotent and enforce:

release_qty <= held_qty.

P0-8 — Approved PR/PO immutable.
Material changes to approved PR/PO must either be rejected or create a revision that resets approval. Backend must enforce this independently from frontend controls.

Acceptance test:

PR 1000 → PO 1000 → approve PO

MRP sees scheduled receipt 1000.

GRN-1 = 600

PO outstanding becomes 400; MRP scheduled receipt becomes 400; 600 enters QC HOLD.

GRN-2 = 400

PO outstanding becomes 0.

QC PASS GRN-1 must release exactly 600 belonging to GRN-1 only.

QC PASS GRN-2 must release exactly 400 belonging to GRN-2 only.

Retrying either approval must not change inventory or ledger a second time.

QC failure on GRN-2 must never release GRN-2 stock even if GRN-1 already passed.

At every screen reviewer must be able to trace:

GRN → PO → PR → MRP/MPS → originating demand.

Kalau gue kasih status per modul sekarang: WO/Production Planning = GREEN/FREEZE, MRP→PR demand integrity = masih OPEN, dan Procurement/Incoming Material = RED karena ada beberapa P0 lifecycle + inventory integrity.

Menurut gue ini bagus kita temukan sekarang bro, karena problem Procurement-nya bukan kosmetik. Ada jalur yang bisa bikin MRP salah melihat incoming PO, partial delivery nggak bisa diproses, stock ledger double, atau QC lot A me-release stok lot B. Itu harus kita firm-kan sebelum masuk review Inventory berikutnya.
