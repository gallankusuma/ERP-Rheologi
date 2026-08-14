Progress-nya bagus, tapi Procurement belum gue kasih FIRM. Dari 8 P0 kemarin, beberapa sudah benar-benar ditutup, tapi implementasi barunya membuka beberapa gap yang cukup serius:

✅ PO lifecycle — CLOSED. Final approval sekarang mengubah status='APPROVED', jadi sudah inline dengan query Scheduled Receipt MRP. Reject juga mengembalikan ke submitted.

✅ Approved PR/PO immutable — CLOSED. Backend sekarang menolak PUT kalau approval sudah berjalan. Ini sudah nggak bergantung pada UI.

✅ Double ledger dari flow lama — substantially CLOSED. GRN final approval sekarang membuat satu inbound stock_movements per item dalam transaction, bukan dua posting seperti sebelumnya.

🔴 P0 — Partial GRN baru benar di backend, UI masih memblokir. Backend memang sudah mengizinkan multiple GRN dan menghitung received_qty, lalu PO berubah PARTIAL/RECEIVED. Tetapi GoodReceipt.vue masih membuat activeGRNPOs dan menyembunyikan PO yang sudah punya satu GRN aktif. Jadi PO 1.000 → GRN-1 600 masih tidak bisa normal dibuatkan GRN-2 400 lewat UI.

🔴 P0 — tidak ada server-side over-receipt validation. Pada final approval backend langsung melakukan received_qty += qty; tidak ada check qty <= ordered - already_received. Jadi PO 1.000 yang sudah received 600 masih berpotensi menerima GRN berikutnya 1.000 dan menjadi received 1.600. Input max di browser tidak cukup sebagai business guard.

🔴 P0 — exact PO-line lineage belum ada. GRN frontend tidak membawa po_item_id; hanya product_id. Backend lalu membuat poItemMap keyed by product_id dan menebak PO line dari materialnya. Kalau satu PO punya material yang sama pada dua line berbeda—beda price/spec/batch—mapping akan collapse. GRN line harus menunjuk exact purchase_order_item.id.

🔴 P0 — Incoming QC belum bagian dari atomic GRN transaction. Inventory, GRN status, received_qty, dan stock movement sudah transaction. Bagus. Tetapi auto-create FPA dilakukan setelah COMMIT dan bahkan dikomentari sebagai “non-critical”. Kalau FPA creation gagal, hasilnya: GRN APPROVED + received_qty updated + stock QC HOLD, tetapi tidak ada Incoming QC document. Retry approval juga langsung berhenti karena stock movement sudah ada, sehingga FPA yang hilang tidak otomatis dibuat ulang.

🔴 P0 — grn_id lot tracking belum punya schema contract. Code baru melakukan INSERT inventory_stocks(... grn_id ...), tetapi current runtime schema ensure yang gue cek hanya memastikan kolom status; tidak ada ensure grn_id. Runtime unique key juga masih (warehouse_id, product_id, status). Static schema_mysql.sql bahkan masih mendefinisikan inventory_stocks tanpa status dan tanpa grn_id, dengan unique (warehouse_id, product_id).

Ini berarti meskipun grn_id ditambah manual di production, dua QC HOLD untuk product+warehouse yang sama tetap merge karena unique key tidak memasukkan lot/GRN. ON DUPLICATE KEY UPDATE quantity = quantity + ? lalu justru menyatukan GRN-A dan GRN-B. Jadi P0 lot-specific belum solved.

🔴 P0 — QC final approval masih dua implementation, bukan satu. /fpa/:id/approve sekarang memang ikut release stock—bagus—tetapi /fpa/:id/approve-2 masih punya copy kedua dari seluruh release logic. Ini bukan delegation ke satu service/canonical function; ini dua endpoint dengan side effect yang sama.

Lebih bahaya: tidak ada guard seperti if approved_by_2 return idempotent, tidak ada row lock, dan tidak ada transaction untuk available += qty → qc_hold -= qty → stock movement → FPA approved. Jadi duplicate finalization/concurrent calls masih bisa double-release.

🔴 P0 — QC tetap belum enforce releaseQty <= holdQty. Logic masih menambahkan releaseQty ke available dulu lalu menghitung remaining. Kalau FPA quantity lebih besar dari hold quantity, sistem dapat menambah available lebih banyak dari material yang benar-benar ditahan.

🔴 P0 — MRP→PR blocker lama ternyata masih OPEN. Backend sekarang benar-benar menghitung PO outstanding sebagai ordered - received_qty dan mengirim scheduledReceipt. Tetapi frontend getNetReq() masih menghitung gross - planned_order_receipt - projectedOH; scheduled_receipt dari PO tidak dipakai. Dan /mrp/generate-pr tetap menerima total_net_requirement dari browser lalu memasukkan angka itu langsung ke PR tanpa server-side recalculation. Jadi risiko duplicate procurement yang kita bahas kemarin masih ada.

Ada satu concern tambahan dari HEAD terbaru c334228. Formula MRP sekarang memakai bom_headers.qty sebagai batch size dan bom_headers.unit, tetapi static schema repo bom_headers yang gue cek belum mendefinisikan qty atau unit. Commit message bilang data BOM sudah dipopulate, tapi commit code-nya hanya mengubah ppic.routes.ts; artinya kalau ini dilakukan langsung ke production DB, migration/data correction-nya belum reproducible dari repository.

Jadi comment gue ke development sekarang:

PROCUREMENT REVIEW CYCLE #2 — c334228

Major progress accepted. Do not redesign the fixes already implemented.

CLOSE: PO approval lifecycle, PR/PO immutability, sequential GRN double-ledger posting.

Remaining P0:

1. Partial GRN must work end-to-end, not backend-only.
   Remove frontend one-active-GRN-per-PO filtering. Display PO item ordered / received / outstanding, and only allow receiving outstanding quantity.

2. Backend must validate cumulative receive.
   new_grn_qty <= ordered_qty - received_qty under row lock. Over-receipt must return 409/400 and make zero changes.

3. GRN must carry exact po_item_id.
   Do not infer PO item from product_id.

4. FPA creation cannot be “non-critical”.
   Final GRN approval is complete only when GRN posting and Incoming QC workflow are deterministically established. Either create FPA inside the transaction or use a transactional outbox/recoverable mandatory workflow.

5. Implement real lot schema.
   Add versioned migration for grn_id/lot identity. Current (warehouse_id, product_id, status) uniqueness merges different GRNs and invalidates QC traceability.

6. One canonical QC finalization service.
   /approve and /approve-2 must call one implementation. Add transaction + row lock + idempotency key and reject release_qty > held_qty.

7. Finish MRP Procurement Integrity.
   PO scheduled_receipt must reduce Net Requirement. /mrp/generate-pr must recalculate Net Requirement server-side immediately before PR creation.

Required regression test:

PO 1000 → GRN1 600 → outstanding 400 → GRN2 max 400 → outstanding 0

plus two simultaneous GRN/QC approval requests must still produce exactly one stock effect.

Also commit all schema/data migrations required by grn_id and BOM qty/unit; production-only DB edits are not an acceptable repository contract.

Verdict gue sekarang: Procurement berubah dari RED berat menjadi AMBER, tapi belum GREEN/FIRM. Yang paling gue tahan sekarang bukan fitur lagi, tapi quantity integrity + concurrency + lot traceability + reproducible schema.

Satu lagi: HEAD saat ini belum punya connector-visible CI/status checks, jadi belum ada automated evidence untuk acceptance scenarios di atas. Setelah ini ditutup, baru aman kita freeze Procurement dan masuk Inventory.
