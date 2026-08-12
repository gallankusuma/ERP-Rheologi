Arah revisinya jauh lebih tepat, tapi gue belum bisa kasih GREEN/FIRM. Ada beberapa P0 baru yang justru harus ditutup dulu sebelum kita lanjut.

P0 — qc_hold belum supported oleh schema inventory. Code sekarang benar secara konsep: GRN masuk inventory_stocks.status='qc_hold', lalu MPS/Production hanya membaca status='available'. Masalahnya, schema existing inventory_stocks belum punya kolom status, dan masih punya unique key (warehouse_id, product_id). Jadi sekalipun kolom status ditambah manual, satu product di warehouse yang sudah punya available tidak bisa punya row qc_hold kedua. Commit ini juga tidak membawa migration/schema ensure untuk mengubah contract tersebut. Ini deploy blocker.
P0 — Stock Transfer bisa menciptakan stok dari udara. Implementasi baru memang sudah pindah dari legacy inventory ke inventory_stocks, bagus. Tetapi jika source punya 5 dan transfer 10, code melakukan Math.max(0, 5-10) → source jadi 0, sementara destination tetap ditambah 10. Bahkan kalau source row tidak ditemukan, code hanya warning lalu tetap lanjut menambah destination. Harus lock source row + reject jika available < requested + transaction source/destination/ledger. Jangan clamp.
P0 — QC release masih best-effort, bukan atomic inventory event. Saat Incoming QC PASS, code memindahkan qc_hold → available, ini directionally correct. Tetapi kalau release gagal, error cuma di-log dan FPA tetap dianggap approved. Lebih berbahaya lagi, GRN applyGrnToInventory() sendiri juga menangkap error internal dan tidak mem-fail GRN approval. Jadi bisa terjadi GRN Approved / QC Approved tapi stock state gagal sinkron. Untuk interkoneksi ERP, ini tidak boleh best-effort.
P0 — Forecast provenance code tidak match dengan schema mps_detail_sources. Commit baru membaca mds.forecast_header_id dan menulis source_type='FORECAST', week_number, year. Tetapi ensurePpicSchema() masih mendefinisikan source_type ENUM('SO_ITEM','PROJECT') dan tidak mempunyai forecast_header_id/week_number/year. Artinya fresh DB bisa kena unknown column / invalid enum, bahkan GET MPS detail berpotensi 500. Ini harus ada versioned migration + ensure schema.
P0/P1 — BOM contract masih belum disamakan. MPS Pull Orders masih memilih BOM hanya dengan bh.status='ACTIVE', tanpa approval_status=2. Sementara Production secara eksplisit hanya mau WO release dengan BOM ACTIVE + approval_status=2. Jadi PPIC masih bisa merencanakan MRP/beli material menggunakan recipe yang akhirnya ditolak Production. Ini temuan lama yang belum closed.
P1 — PO scheduled receipt → MRP masih missed. Standalone MRP sekarang sudah benar hanya membaca Confirmed MPS. Generate PR juga sudah digate Confirmed MPS, dan Forecast juga sudah wajib Confirmed. Tetapi PPIC MRP masih belum menarik open approved PO outstanding quantity (PO qty - GRN received) berdasarkan expected delivery sebagai Planned Order Receipt. Jadi feedback loop Procurement → PPIC belum closed.

Yang sudah gue accept dari commit ini: MPS double-count FG sudah diperbaiki—beginning inventory sekarang hanya memakai canonical FG inventory, tidak menambah wo_actual_output lagi. SO pull juga sudah jauh lebih benar: pakai outstanding quantity - delivered_qty, memakai expected_ship_date, dan Draft/Open tidak lagi dianggap hard demand. Confirmed MPS-only MRP dan Confirmed Forecast gate juga sudah benar.

Jadi verdict gue sekarang:

85013fb = DIRECTION ACCEPTED, tetapi CROSS-MODULE CONTRACT masih NOT FIRM.

Comment ke development yang paling pas sekarang:

Cross-Module Review — Cycle #2 (85013fb)

Direction accepted. The major contract changes are correct, especially canonical inventory_stocks, Confirmed-MPS procurement gating, SO outstanding demand/date handling, Confirmed Forecast gating, and removal of MPS FG double-count.

Do not redesign these parts again.

Please close the remaining blockers only:

P0-1 Inventory status schema: commit the actual migration/ensure-schema for inventory_stocks.status. Existing unique (warehouse_id, product_id) cannot represent simultaneous available and qc_hold; define the canonical bucket/lot key and migrate existing rows to available.

P0-2 Stock Transfer: never clamp insufficient source stock to zero. Lock the available source row, reject insufficient/missing stock, and execute source deduction + destination addition + ledger atomically.

P0-3 GRN/QC inventory atomicity: GRN approval and Incoming QC release must not treat inventory posting as best-effort. A successful business state may not be returned when its stock transition failed.

P0-4 MPS provenance schema: align mps_detail_sources schema with the new FORECAST provenance contract (FORECAST, forecast_header_id, week/year fields). Fresh DB must boot and MPS detail must load without manual ALTER.

P0-5 BOM parity: PPIC MPS/MRP must resolve the same ACTIVE + approval_status=2 BOM contract used by Production WO release.

P1 Procurement feedback: derive MRP scheduled receipts automatically from approved/open PO outstanding quantities minus received GRN quantities, allocated by expected delivery week.

After these fixes, run one closed-loop smoke:

SO/Forecast → MPS → MRP → PR → PO → GRN → QC HOLD → Incoming QC PASS → AVAILABLE → WO Issue → Production → FG Receipt → MPS

Include negative tests for insufficient transfer, GRN/QC posting failure, Draft MPS PR attempt, Draft Forecast push, and unapproved BOM.

Ini baru cycle berikutnya yang gue minta bro. Jangan suruh mereka nambah feature lain dulu, karena sekarang kita sudah di titik data integrity lintas modul, bukan UI lagi.
