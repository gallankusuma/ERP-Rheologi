# PPIC ↔ Inventory ↔ Production/QC — Canonical Active Review

Terakhir diverifikasi: 20 Agustus 2026 pukul 22:14 WIB, workspace lokal.

Target review: `a0e225dbb1aa9e33e4bf37e7d0b818b5d7b7543e` **ditambah uncommitted working tree**. SHA tersebut sendirian tidak mereproduksi kode yang diuji.

Status: **RED — belum near-FIRM dan belum production-ready**.

Dokumen ini adalah replacement snapshot. Review berikutnya harus memperbarui status/evidence di sini, bukan menambahkan blok review baru di bawahnya.

## Bukti verifikasi terbaru

- Backend production build: **PASS** (`npm run build`).
- Frontend production build: **FAIL** (`npm run build`) dengan 10 TypeScript error: sembilan blocker lama tetap ada—field `has_qc_checkpoint`, `qc_status`, dan `qc_blocking` belum ada pada tipe process log (`frontend/src/views/ProductionExecution.vue:183-209,406`), serta `loadSummary` tidak ditemukan (`frontend/src/views/WorkOrders.vue:739`)—ditambah satu error baru karena `totalEst` dideklarasikan tetapi tidak dipakai (`frontend/src/views/PurchaseRequests.vue:1504`).
- Mobile TypeScript check: **PASS** (`npx tsc --noEmit`). Mobile ESLint: **PASS** (`npm run lint`). Mobile parity register: **PASS** (`npm run parity:check`).
- Migration/schema: **TIDAK DIJALANKAN** karena runner mempunyai blocker statis dan tidak tersedia database disposable yang terverifikasi. Port MySQL `3306` juga tidak listening.
- Aplikasi/API lokal: **TIDAK TERSEDIA**; port `3000`, `3001`, dan `5173` tidak listening.
- Smoke/acceptance test: **TIDAK DIJALANKAN**; test saat ini dapat menyentuh database yang dikonfigurasi dan belum mengisolasi fixture.
- Screenshot/manual: **BELUM DIBUAT** karena near-FIRM gate belum terpenuhi.

## Delta terbaru yang diterima

- Migration CLI dan checksum ledger sudah mulai dibentuk melalui `backend/src/scripts/migrate.ts` dan `backend/src/lib/migrationRunner.ts`.
- Startup sekarang mencoba memanggil versioned migration melalui `backend/src/config/database.ts:1207-1210`.
- Backend yang sempat gagal compile sudah diperbaiki dan build kembali PASS.
- Canonical QC finalization sudah lebih baik: `backend/src/services/qc.service.ts:391-560` melakukan row lock, exact `lot_id`, validasi held quantity, stock movement, FPA finalization, dan checkpoint sync dalam satu transaction.
- Endpoint web Stock Card sekarang mempunyai deny-by-default API guard `inventory.stock-card.view` (`backend/src/routes/inventory.routes.ts:754`).
- Posting stock opname sekarang berada dalam transaction, mengunci session dan stock row, serta menolak resulting quantity negatif (`backend/src/routes/inventory.routes.ts:567-626`).
- Approval PR/PO dan final posting GRN mulai dipindahkan dari route ke `backend/src/services/procurement.service.ts`; PR/PO sudah memakai transaction + row lock, sedangkan final GRN sudah mengunci GRN/PO items, mewajibkan exact `po_item_id`, membuat canonical lot, stock QC hold, movement, PO status, dan Incoming FPA dalam satu transaction (`backend/src/services/procurement.service.ts:41-176,258-467`).
- Edit/delete/reject GRN yang sudah posted sekarang ditolak (`backend/src/routes/procurement.routes.ts:1720-1725,1748-1751,1885-1889`).

Perbaikan di atas diterima, tetapi belum menutup P0 di bawah.

## Active P0/P1 findings

### SCHEMA-P0-6 — Migration runner belum dapat menjalankan migration stream repository

**Jenis:** implementation bug + architecture/release debt.

**Evidence:**

- `backend/src/lib/migrationRunner.ts:16-22` memberi semua file tanpa prefix angka versi `0`. Directory aktif masih mempunyai 11 migration tanpa versi dan dua file versi `004`, sehingga order/identity migration ambigu.
- `backend/src/lib/migrationRunner.ts:28-34` memecah SQL dengan `split(';')`. Ini memecah body procedure pada `backend/database/migrations/017_canonical_lot_contract.sql:41-57`, `019_schema_convergence.sql:38-147`, dan `add_approval_columns.sql:9-31` menjadi statement SQL invalid.
- `backend/src/lib/migrationRunner.ts:136-148` melakukan generic best-effort skip, termasuk `duplicate entry`, lalu `:157-160` tetap merekam migration sebagai applied. Konflik data/constraint dapat disamarkan sebagai sukses.
- Runner memakai `_migration_ledger` (`backend/src/lib/migrationRunner.ts:37-48`), tetapi migration 019 membuat ledger kedua `schema_migrations` dan self-record `MANUAL_APPLY` (`backend/database/migrations/019_schema_convergence.sql:7-14,156-158`). Ini dua sumber kebenaran.
- `backend/src/config/database.ts:1212-1220` hanya mencatat migration error, kemudian tetap release connection dan menjalankan seed. Aplikasi dapat start pada schema parsial.
- Migration 020 mengklaim mengonsolidasikan seluruh runtime DDL (`backend/database/migrations/020_consolidate_runtime_ddl.sql:1-4`), tetapi tidak memuat seluruh sample request, R&D, dan QC schema yang masih terlihat pada `backend/src/config/database.ts:278-740`.

**Target contract:**

- Owner tunggal: `MigrationRunner` pada satu directory versioned.
- Tolak file tanpa versi dan versi duplikat **sebelum DDL pertama**; outcome CLI harus exit `1` tanpa ledger mutation.
- Refactor procedure migration menjadi SQL yang kompatibel dengan runner, atau gunakan parser delimiter-aware. Jangan split SQL secara generik pada `;`.
- Hanya satu ledger dengan unique version + filename + SHA-256. Hapus self-record/manual placeholder.
- Tidak boleh skip berdasarkan substring error. Setiap migration harus explicit-idempotent; conflict preflight menghasilkan error deterministik dan tidak dicatat applied.
- Startup harus fail-closed: migration error mencegah seed dan server listen. API health harus melaporkan schema version/checksum yang diterapkan.

**Acceptance:** clean install, upgrade legacy fixture, rerun tanpa perubahan, checksum mismatch, duplicate version, procedure migration, dan injected failure di tengah migration semuanya harus memberi hasil deterministik pada database disposable. Setelah failure, schema/ledger postcondition harus sesuai kontrak dan server tidak boleh listen.

### PPIC-PROD-P0-1 — WO belum memiliki immutable planning/BOM/component snapshot

**Jenis:** architecture/design debt.

**Evidence:**

- Generate WO hanya menyimpan `bom_id` dan field header pada `backend/src/routes/ppic.routes.ts:985-989`.
- Material WO diexplode kemudian dari BOM live dan status BOM live pada `backend/src/routes/production.routes.ts:627-653`. Perubahan BOM historis dapat mengubah requirement WO yang sudah dibuat.

**Target contract:**

- Owner: PPIC `GenerateWorkOrdersService`.
- Dalam satu transaction, lock MPS detail + week + revision, lalu simpan planning revision, BOM revision, component lines, quantity, UOM/conversion, scrap/rounding rule, process/line version, dan calculation hash.
- WO hanya boleh `DRAFT -> RELEASED` bila snapshot lengkap. Snapshot immutable; perubahan planning membuat WO baru yang `SUPERSEDES` WO lama.
- Idempotency scope: `(mps_detail_id, year, week_number, planning_revision_hash)` dengan unique constraint.
- Exact API: `201` untuk create, replay request identik mengembalikan stored `200/201`, payload berbeda pada key/scope sama `409`, invalid state `422`, permission `403`.

**Acceptance:** ubah BOM/MPS setelah WO dibuat dan buktikan material requirement WO lama tidak berubah; dua generate paralel menghasilkan satu WO/snapshot; rollback meninggalkan nol WO/snapshot parsial.

### PPIC-PROD-P0-2 — Reset WO masih destructive

**Jenis:** implementation bug + audit/history debt.

**Evidence:**

- Endpoint reset berada di `backend/src/routes/ppic.routes.ts:1053-1054`.
- Guard hanya menghitung `wo_materials.quantity_issued > 0` pada `:1096`; checkpoint, FPA, yield/scrap, schedule, dan history lain tidak menjadi authoritative guard.
- WO DRAFT dihapus fisik pada `:1108`, sehingga cascade dapat menghilangkan bukti historis.

**Target contract:**

- Hapus operasi delete dari business flow. Gunakan state `CANCELLED` atau `SUPERSEDED`, reason wajib, actor/timestamp, previous/new WO relation, dan immutable history.
- State terminal tidak boleh diedit atau diaktifkan ulang. Compensation dibuat sebagai event baru, bukan mutation/destructive cleanup.
- Exact API: transition valid `200`, replay identik stored `200`, dependent activity `409`, invalid/terminal transition `422`, permission `403`.

**Acceptance:** WO dengan schedule/checkpoint/FPA/yield/material issue tidak pernah kehilangan row; supersession paralel hanya menghasilkan satu successor; audit dan reconciliation tetap lengkap.

### PPIC-PROD-P0-3 — Material issue belum memakai exact lot identity dan stored replay

**Jenis:** implementation bug.

**Evidence:**

- UI meminta batch sebagai free text pada `frontend/src/views/ProductionIssueMaterial.vue:209-211`, bukan memilih `inventory_lots.id`.
- Backend mencari stock dengan `batch_number` pada `backend/src/services/production.service.ts:73-85`; jika batch number tidak unik, row pertama menjadi ambigu.
- Duplicate idempotency hanya menjadi error pada `backend/src/services/production.service.ts:41-49`, bukan replay response asli.
- Bulk issue tidak mengirim batch/lot pada `frontend/src/views/ProductionIssueMaterial.vue:394-413`, sementara service mewajibkannya; flow bulk secara desain akan gagal atau menghasilkan partial UI outcome tanpa recovery contract.
- WO row dibaca tanpa `FOR UPDATE` setelah lock material pada `backend/src/services/production.service.ts:52-63`; lock order/state check belum menjadi kontrak konsisten untuk semua transition WO.

**Target contract:**

- Request wajib membawa exact `lot_id`; server memvalidasi lot/product/warehouse/status/expiry dan mengunci WO -> WO material -> lot balance dalam urutan tetap.
- Idempotency scope: `(WO_MATERIAL_ISSUE, user/tenant, key)` dengan payload hash, HTTP status/body, issue ID, movement ID, dan timestamp tersimpan.
- Replay identik mengembalikan response yang sama tanpa stock effect; key sama dengan payload berbeda `409`.
- Bulk harus satu atomic command dengan pilihan lot per line, atau eksplisit per-line result + resumable key; tidak boleh silent catch.

**Acceptance:** exact lot A/B dengan batch text sama, retry setelah timeout, payload mismatch, dua issue paralel pada lot sama, insufficient stock, expired/held lot, RBAC deny, dan rollback harus memverifikasi exact DB before/after.

### PROD-QC-P0-4 — FG receipt/QC sudah exact-lot, tetapi retry dan batch aggregate belum tuntas

**Jenis:** implementation bug + integration debt.

**Evidence:**

- Satu FG receipt memang membuat lot baru berdasarkan receipt event pada `backend/src/services/production.service.ts:208-245`; ini diterima.
- Duplicate FG idempotency masih dilempar sebagai error pada `backend/src/services/production.service.ts:160-169`, dan route memetakan banyak domain error ke generic `400/500` melalui substring pada `backend/src/routes/production.routes.ts:1257-1261`.
- Jika `batch_number` sudah ada, `backend/src/services/production.service.ts:254-264` tidak meng-update aggregate quantity/status atau mengikat batch ke seluruh receipt lot. Partial receipt berikutnya dapat tidak tercermin pada batch header.
- Exact-lot final QC transaction sudah tersedia pada `backend/src/services/qc.service.ts:391-560`, tetapi belum ada persisted HTTP replay record untuk final approve/retest/reject.

**Target contract:**

- Owner receipt: Production; owner disposition/release: QC; owner balance/movement: Inventory service yang dipanggil dalam transaction yang sama.
- Setiap receipt event mempunyai satu immutable lot. Batch header harus derived/reconciled dari lot children, bukan sumber quantity kedua.
- Persist idempotency outcome untuk FG receipt dan QC finalization. Exact domain mapping: validation `422`, conflict/mismatch `409`, not found `404`, permission `403`, internal `500`; replay mengembalikan original response.
- Approve/reject/retest hanya mengubah exact lot; sibling lot dalam batch sama harus tetap tidak berubah.

**Acceptance:** dua partial FG receipt dengan batch text sama menghasilkan dua lot; retry/concurrency menghasilkan satu effect per intent; approve lot A tidak mengubah lot B; reject/retest mempunyai compensation/audit/reconciliation yang exact.

### PPIC-PROC-P0-5 — MRP → PR masih browser-authoritative

**Jenis:** architecture boundary violation.

**Evidence:**

- Endpoint menerima `material_net_reqs` dari request pada `backend/src/routes/ppic.routes.ts:1437-1445`.
- Duplicate detection masih bergantung pada `notes LIKE` pada `:1454-1465`.
- Quantity PR langsung berasal dari browser pada `:1490-1515`; tidak ada lock/recompute authoritative MRP result dan PR item tidak memiliki exact MRP result-line FK.

**Target contract:**

- Frontend hanya mengirim selected MRP result IDs + idempotency key.
- Backend transaction mengunci MPS/MRP revision, recompute demand, on-hand, reservation, open PO/GRN, lead time, conversion, dan rounding; lalu membuat PR dengan immutable calculation snapshot.
- Unique lineage per MRP result line mencegah duplicate procurement. Key sama/payload sama replay; revision berubah atau result sudah dikonsumsi `409`.

**Acceptance:** scheduled receipt/partial GRN, concurrent generate, stale browser quantity, cancelled/reversed PO, duplicate retry, dan historical master-data change harus memiliki exact PR quantity dan DB postcondition.

### INV-PROC-P0-13 — Principal Procurement dapat dipalsukan atau dinaikkan menjadi admin ID 1

**Jenis:** implementation bug + RBAC/audit boundary violation.

**Evidence:**

- Create GRN mempercayai `received_by` dari request, lalu fallback ke authenticated user atau literal admin `1` (`backend/src/routes/procurement.routes.ts:1653-1668`). User dengan permission create dapat mencatat user lain sebagai penerima; principal tidak lagi server-authoritative.
- Jika receiver tidak ditemukan, route menggantinya dengan admin ID `1` dan tetap membuat GRN (`backend/src/routes/procurement.routes.ts:1668-1672`).
- Lebih kritis, approval GRN mengganti authenticated user yang tidak ditemukan menjadi admin ID `1`, kemudian permission dicek terhadap admin tersebut (`backend/src/routes/procurement.routes.ts:1843-1859`). Token/principal stale dapat memperoleh otoritas approval admin dan audit merekam actor yang salah.

**Target contract:**

- Owner tunggal identity: auth middleware menghasilkan immutable `actor_user_id`; service Procurement hanya menerima actor tersebut. Business payload tidak boleh memilih `received_by`/approver.
- Principal yang tidak mempunyai row user aktif harus fail closed dengan `401 AUTH_PRINCIPAL_INVALID` (atau `403 USER_INACTIVE` untuk user nonaktif), tanpa mutation. Delegasi penerimaan harus menjadi command terpisah dengan permission khusus, delegatee aktif, reason, dan audit actor/delegatee.
- Seluruh menu/action/API tetap deny-by-default; database permission lookup tidak boleh dilakukan ulang memakai fallback actor.

**Acceptance:** missing/deleted/inactive user, forged `received_by`, user biasa, approver tahap 1/2, dan admin valid harus mempunyai exact HTTP outcome. Untuk seluruh denial, before/after GRN, approval, stock, lot, movement, FPA, PO quantity/status, dan audit harus identik; tidak ada row yang mencatat admin `1` kecuali admin itu benar-benar authenticated.

### INV-PROC-P0-14 — Approval retry dan rejected-resubmit belum merupakan state machine atomik

**Jenis:** implementation bug + state-machine/idempotency debt.

**Evidence:**

- `resolveApprovalTarget()` mengembalikan `null` untuk status final (`backend/src/services/procurement.service.ts:25-29`), lalu PR dan PO melempar `Insufficient permissions` sebelum cabang replay idempoten dapat dijalankan (`:50-64,125-138`). Retry setelah response hilang menghasilkan `403`, bukan stored success.
- GRN memiliki pola sama: target dihitung dan ditolak sebelum final transaction (`backend/src/services/procurement.service.ts:228-231`), sehingga retry final approval yang sudah sukses tidak pernah mencapai check idempotency di `:267-270`.
- Calling approve pada GRN `REJECTED` secara implisit mengubahnya ke pending dalam transaction terpisah (`backend/src/services/procurement.service.ts:208-225`). Jika permission/final posting berikutnya gagal, rejection sudah hilang. Tidak ada explicit `REJECTED -> RESUBMITTED` command, reason, atau audit boundary.
- Approval tahap 1 GRN memakai `dbRun` tanpa `FOR UPDATE` (`backend/src/services/procurement.service.ts:233-252`), sehingga dua approver paralel tidak mempunyai serialized transition contract.
- Permission `approve` langsung mengisi actor supervisor dan manager dengan user yang sama pada PR/PO/GRN (`backend/src/services/procurement.service.ts:79-91,152-163,286-297`) tanpa explicit emergency override/reason; segregation of duties belum fail closed.

**Target contract:**

- Owner tunggal: `ProcurementApprovalService`, dengan state machine eksplisit `PENDING -> STAGE_1 -> FINAL` dan `PENDING/STAGE_1 -> REJECTED -> RESUBMITTED -> PENDING`. `FINAL` immutable; resubmit/reversal adalah command terpisah.
- Setiap command mengunci document row terlebih dahulu dan melakukan transition, actor history, domain effects, audit, serta idempotency outcome dalam satu transaction.
- Idempotency scope `(tenant, command_type, document_id, key)` menyimpan payload hash + exact HTTP status/body. Replay identik mengembalikan stored success; key sama/payload berbeda `409 IDEMPOTENCY_MISMATCH`; invalid transition `422`; permission `403`.
- Supervisor dan manager harus actor berbeda. Override satu actor hanya lewat permission khusus, reason wajib, dan immutable audit.

**Acceptance:** retry setelah timeout untuk PR/PO/GRN final menghasilkan satu transition/effect dan response semula; dua approval tahap yang paralel terserialisasi; rejected approval tidak berubah tanpa explicit resubmit; injected failure setelah resubmit/approval meninggalkan state lama; same-user tahap 1+2 ditolak kecuali audited override.

### INV-PROC-P0-15 — Partial receipt multi-line masih gagal pada final posting

**Jenis:** implementation bug pada contract UI ↔ Procurement service.

**Evidence:**

- UI memuat seluruh outstanding PO lines ke `formItems` dengan default `received_quantity: 0` (`frontend/src/views/GoodReceipt.vue:462-488`).
- Submit hanya mensyaratkan total seluruh line lebih dari nol, lalu mengirim semua line termasuk yang tidak diterima (`frontend/src/views/GoodReceipt.vue:566-597`).
- Final posting mengiterasi semua line dan melempar error bila satu line mempunyai quantity `<= 0` (`backend/src/services/procurement.service.ts:327-338`). PO dua line yang hanya menerima line A akan rollback karena line B bernilai nol, walaupun partial receipt adalah flow wajib.
- Setelah create saja, UI menampilkan `GRN created & stok updated` (`frontend/src/views/GoodReceipt.vue:589-603`), padahal stock baru berubah pada final approval. Operator dapat menganggap inventory sudah tersedia sebelum QC/approval.

**Target contract:**

- Request create GRN membawa explicit selected receipt lines saja: exact `po_item_id`, positive decimal quantity, batch/expiry/source attributes, dan immutable line snapshot. Server menolak duplicate line, zero/negative, foreign PO line, over-receipt, serta missing lineage dengan typed `422/409`.
- Create hanya menghasilkan GRN non-posted (`201`, no stock effect). Final approval mem-post exact selected lines dalam transaction; response/UI membedakan `GRN_CREATED`, `GRN_STAGE_1_APPROVED`, `GRN_POSTED_QC_HOLD`, dan `GRN_POSTED_AVAILABLE`.

**Acceptance:** PO multi-line menerima hanya A, partial quantity A, kemudian B pada GRN berikutnya; zero/negative/duplicate/foreign line; two concurrent receipts pada line sama; retry create/final; dan rollback QC-spec failure. Assert exact PO received quantity/status, GRN lines, lots, hold/available balances, movements, FPA, and HTTP before/after.

### INV-PROC-P0-16 — Satu stock movement dianggap cukup untuk “memulihkan” GRN sebagai posted

**Jenis:** architecture/operational recovery bug.

**Evidence:**

- Bila ditemukan minimal satu `stock_movements` untuk reference GRN, service langsung menandai header GRN final/approved dan return idempoten (`backend/src/services/procurement.service.ts:273-283`). Check ini tidak membuktikan seluruh GRN lines mempunyai `grn_items`, canonical lots, inventory balance, PO received quantity/status, Incoming FPA/QC policy outcome, maupun audit.
- Pada legacy/partial-failure data, satu movement dari banyak line dapat membuat dokumen terlihat posted walaupun side effect lain hilang. Ini menutup discrepancy, bukan merekonsiliasinya.

**Target contract:**

- Idempotency harus memakai immutable command/outcome row dengan unique scope dan payload hash, bukan keberadaan salah satu child effect.
- Recovery/reconciliation service harus memverifikasi invariant lengkap per GRN line dan exact lot; mismatch menghasilkan `409 GRN_RECONCILIATION_REQUIRED` tanpa mutation. Repair hanya melalui explicit audited reconciliation/compensation command.

**Acceptance:** fixture dengan (a) movement saja, (b) satu dari dua line posted, (c) lot tanpa FPA, (d) PO quantity mismatch, dan (e) complete outcome harus menghasilkan deterministic report. Hanya complete stored outcome boleh replay `200`; semua partial fixture tidak boleh mengubah header/balance secara diam-diam.

### INV-PROC-P1-17 — Error contract Procurement masih substring/generic

**Evidence:** route approval PR/PO/GRN memetakan error berdasarkan substring (`backend/src/routes/procurement.routes.ts:625-629,1522-1526,1863-1870`). `QC_SPEC_REQUIRED`, invalid/empty GRN line, dan lineage validation dari service jatuh ke generic `500`, walaupun merupakan deterministic validation/configuration outcome.

**Target:** service melempar typed domain error; satu mapper menghasilkan exact `401/403/404/409/422/500` + stable code + request ID. Frontend menampilkan code/recovery action, bukan menebak string.

**Acceptance:** not found, invalid state, permission, over-receipt conflict, missing QC spec, invalid line, retry replay, payload mismatch, dan injected internal failure harus memberi code/status exact tanpa substring coupling.

### INV-PROC-P1-18 — QR print Procurement mengirim metadata ke pihak ketiga dan bukan audit signature

**Evidence:** print PR, PO, dan GRN menyisipkan image dari `api.qrserver.com` dengan document number, nama actor/approver, tanggal, atau status di query string (`frontend/src/views/PurchaseRequests.vue:1511,1615-1622`; `frontend/src/views/PurchaseOrders.vue:2109,2121`; `frontend/src/views/GoodReceipt.vue:927-937`). Metadata keluar ke layanan publik saat print; QR plaintext juga dapat dibuat ulang siapa pun dan tidak membuktikan approval authoritative.

**Target:** generate QR secara lokal atau melalui service internal. Payload harus opaque/signed verification token yang menunjuk immutable audit record dan mengecek document hash/state/version; jangan memasukkan PII/business metadata ke URL pihak ketiga. Print harus tetap deterministik/offline dan signature label hanya tampil bila audit approval benar-benar ada.

**Acceptance:** network pihak ketiga diblokir tanpa merusak print; QR tampered/expired/superseded ditolak; unapproved document tidak mempunyai approval QR; scan valid menampilkan immutable actor/time/document hash dari owner audit service.

### INV-PROC-P0-9 — Stock Card running balance bukan authoritative dan menghasilkan saldo yang salah

**Jenis:** implementation bug + reconciliation/read-model design debt.

**Evidence:**

- Filter default mengizinkan seluruh produk (`frontend/src/views/StockCard.vue:110-115`), tetapi frontend memakai satu accumulator `balance` untuk semua produk, warehouse, lot, dan UOM (`:159-168`).
- Movement receipt yang benar-benar ditulis Procurement memakai type `inbound` (`backend/src/services/procurement.service.ts:384-397`), sedangkan classifier frontend hanya menganggap `in`, `grn`, `fg_receipt`, dan adjustment positif sebagai inbound (`frontend/src/views/StockCard.vue:154-157`). Receipt GRN dapat ditampilkan sebagai OUT.
- `qc_release` adalah perubahan hold -> available tanpa physical quantity effect (`backend/src/services/qc.service.ts:459-500`), tetapi frontend memasukkannya sebagai OUT karena generic fallback pada `frontend/src/views/StockCard.vue:163-167`.
- Request stock adjustment disimpan pada `stock_movements` dengan `approval_status = 0` sebelum mempunyai stock effect (`backend/src/routes/inventory.routes.ts:330-379`). Endpoint Stock Card mengambil seluruh row tanpa posted/approval filter (`:779-802`), sehingga pending atau rejected adjustment ikut mengubah running balance.
- Filter `from/to` diterapkan sebelum query mengembalikan movement (`backend/src/routes/inventory.routes.ts:768-775`), tetapi response tidak mempunyai authoritative opening balance. Frontend memulai setiap window dari nol (`frontend/src/views/StockCard.vue:159-160`).
- Query hanya `ORDER BY sm.moved_at ASC` (`backend/src/routes/inventory.routes.ts:801`), sehingga movement dengan timestamp sama tidak mempunyai deterministic tie-breaker. Response juga belum mengembalikan `lot_id`, balance-after, physical/availability effect, cursor, atau reconciliation delta.

**Target contract:**

- Owner tunggal read-model: `InventoryLedgerQueryService`. Client tidak boleh menebak movement semantics atau menghitung authoritative balance sendiri.
- Hanya immutable **posted** inventory events yang mempunyai physical/availability effect. Adjustment request harus berada pada tabel workflow terpisah atau dieksklusi sampai approval final dan posting atomik selesai.
- Endpoint `GET /inventory/stock-card` wajib menghasilkan `opening_quantity`, movement `delta_quantity`, `balance_after`, `closing_quantity`, `physical_effect`, `availability_effect`, `lot_id`, batch/source/expiry lineage, `as_of`, dan cursor; partition balance menurut product + warehouse + lot dengan ordering `(moved_at, id)`.
- Gunakan decimal database/string contract, bukan JavaScript floating-point sebagai sumber kebenaran. Invalid filter `422`, permission `403`, resource tidak ada `404`, sukses `200`.
- Result set dan opening/closing harus berasal dari satu consistent snapshot. Rekonsiliasi wajib membuktikan closing per partition sama dengan inventory balance authoritative atau mengembalikan explicit non-zero reconciliation delta.

**Acceptance:** dua produk dengan UOM berbeda tidak pernah digabung; opening sebelum periode benar; `inbound`, `outbound`, transfer, `qc_release`, pending/rejected/approved adjustment, reversal, partial GRN, timestamp sama, pagination, serta lot A/B mempunyai exact HTTP dan exact DB/read-model before/after. Sum opening + posted effects harus sama dengan closing dan authoritative balance.

### INV-PROC-P0-10 — Stock opname transaction masih mengoreksi lot secara ambigu dan tidak mempunyai count cutoff

**Jenis:** implementation bug + canonical lineage/concurrency debt.

**Evidence:**

- Auto-populate opname menyalin hanya `product_id` dan `quantity` dari setiap `inventory_stocks` row, tanpa `lot_id`, status, batch, expiry, atau snapshot version (`backend/src/routes/inventory.routes.ts:511-517`). Beberapa lot produk yang sama menjadi beberapa item yang tidak dapat dibedakan secara domain.
- Posting mencari semua stock available berdasarkan product + warehouse, tanpa `lot_id`, kemudian hanya memakai row pertama (`backend/src/routes/inventory.routes.ts:591-610`). Count lot B dapat mengurangi atau menambah lot A dan merusak supplier/expiry/source lineage.
- `diff` dihitung dari snapshot saat session dibuat (`:588`) lalu ditambahkan ke current stock saat posting. Tidak ada freeze/cutoff/version check terhadap receipt, issue, QC release, transfer, atau adjustment yang terjadi antara snapshot, physical count, dan post.
- Item diambil tanpa deterministic `ORDER BY` (`:582-585`), sehingga dua opname paralel dapat mengunci lot dalam urutan berbeda. Request post juga belum mempunyai persisted idempotency outcome.
- Session dapat dipost ketika hanya sebagian item mempunyai `actual_qty`; tidak ada explicit transition `counting -> counted` atau kontrak apakah partial cycle count diizinkan (`:582-589`).

**Target contract:**

- Owner tunggal: `InventoryOpnameService`. State machine minimum `DRAFT -> COUNTING -> COUNTED -> POSTED`; terminal POSTED immutable. Koreksi menggunakan reversal/compensating adjustment yang mereferensikan posting asli.
- `stock_opname_items` wajib menyimpan exact `lot_id`, warehouse, status, batch/expiry snapshot, system quantity, count quantity, counted actor/time, dan snapshot/cutoff version; unique `(opname_id, lot_id, status)` dan FK ke canonical lot.
- Finalize count menentukan immutable cutoff. Jika movement relevan terjadi setelah snapshot/cutoff tanpa reconciliation rule eksplisit, post harus rollback dan menghasilkan `409 OPNAME_STALE`, bukan menambahkan `actual - old_snapshot` ke current stock.
- Atomic boundary mencakup session transition, exact lot balances, immutable adjustment movements, audit, dan idempotency outcome. Lock order tetap: session -> item/lot ascending -> inventory balance. Tidak boleh memilih generic row pertama.
- Exact API: incomplete count `422 OPNAME_INCOMPLETE`, stale/conflict `409`, not found `404`, permission `403`, create/post sukses `201/200`, replay key+payload identik stored `200`, key sama dengan payload berbeda `409`.

**Acceptance:** produk dengan lot A/B harus mengubah exact lot yang dihitung; count status held dan available tidak tercampur; movement paralel setelah snapshot menghasilkan deterministic conflict/no mutation; dua post paralel dan retry setelah timeout menghasilkan satu effect; uncounted item tidak boleh silently skipped; reversal menjaga audit dan exact lot reconciliation.

### INV-PROC-P1-11 — Mobile Stock Card masih memakai legacy endpoint tanpa permission/lineage parity

**Evidence:** mobile memanggil `/inventory/transactions/:productId` (`ERP-Mobile-Apps-main/frontend/src/api/client.ts:217-218`). Endpoint legacy hanya memakai authentication (`backend/src/routes/inventory.routes.ts:913`), tidak mempunyai `inventory.stock-card.view`, dan response tidak membawa lot/batch/opening/balance contract (`:920-935`). Mobile kemudian menghitung balance dari nol pada `ERP-Mobile-Apps-main/frontend/src/utils/stock-card.ts:61-110`.

**Target:** web dan mobile wajib memakai satu canonical `InventoryLedgerQueryService` dan permission catalog yang sama. Legacy endpoint harus diberi deny-by-default permission kemudian dideprecate/dihapus setelah client migration. Direct screen/menu guard tidak menggantikan API authorization.

**Acceptance:** role tanpa permission memperoleh exact `403` pada web dan mobile; payload yang sama memberi opening/movements/closing/lineage yang sama; pagination/retry tidak mengubah running balance.

### INV-PROC-P1-12 — Kegagalan Stock Card API disamarkan sebagai ledger kosong

**Evidence:** `frontend/src/views/StockCard.vue:136-151` menangkap error, hanya mencatat ke console, lalu mengosongkan movements. Kondisi `403`, `500`, timeout, atau network failure ditampilkan seperti valid empty result dan tetap dapat menyesatkan operator/export.

**Target:** UI state eksplisit `loading | success | empty | stale | error`, tampilkan error contract/request ID dan retry. Data terakhir hanya boleh ditampilkan dengan label stale; export dinonaktifkan kecuali response authoritative terakhir sukses.

**Acceptance:** simulasi `403`, `422`, `500`, timeout, malformed payload, dan retry sukses harus menghasilkan UI state yang berbeda dari legitimate empty `200`, tanpa silent skip.

### RELEASE-P0-7 — Test suite belum aman sebagai acceptance evidence

**Jenis:** test/release debt.

**Evidence:**

- Test memakai server/database yang sedang dikonfigurasi dan token default user `1`/secret `secret`: `backend/tests/procurement-negative.ts:14-22`, `production-negative.ts:12-20`, `qc-negative.ts:10-18`.
- Procurement test membuat business object dan menghapus GRN melalui API, termasuk posted flow: `backend/tests/procurement-negative.ts:53-126` dan cleanup lain.
- Production/QC memakai existing rows atau magic ID `999999`: `backend/tests/production-negative.ts:134-208`, `qc-negative.ts:49-129`.

**Target contract:**

- Test wajib menolak start kecuali database name/prefix dan explicit disposable marker tervalidasi.
- Semua fixture dibuat sendiri, scoped per run, dan dibuang dengan database/schema disposable; jangan delete posted business records pada database bersama.
- Assertions wajib exact HTTP + exact DB before/after, termasuk negative, permission, retry, concurrency, rollback, audit, lineage, dan reconciliation.

**Acceptance:** test berjalan dua kali bersih pada migrated disposable DB, gagal aman saat diarahkan ke database non-test, serta meninggalkan nol perubahan pada business database.

### PPIC-P1-8 — Beberapa contract masih silent/generic

**Evidence:** save week-data melewati field asing dengan `continue` pada `backend/src/routes/ppic.routes.ts:703-704`, audit dilakukan setelah transaction pada `:728`, dan beberapa endpoint masih menentukan HTTP status lewat substring error.

**Target:** whitelist field harus menolak payload asing `422`; audit mandatory berada dalam transaction/outbox yang sama; domain error harus typed dan dipetakan satu kali ke exact HTTP contract.

## Urutan revisi yang harus dikerjakan

1. Migration foundation: strict ordering, delimiter-safe execution, satu ledger, fail-closed startup, disposable migration tests.
2. Procurement approval/GRN boundary: authoritative actor, explicit state machine + SoD, stored replay, exact partial lines, full reconciliation, dan typed errors.
3. Authoritative Inventory Stock Card: posted-event semantics, opening/running/closing balance server-side, exact lot lineage, deterministic ordering, dan web/mobile parity.
4. Lot-aware stock opname: immutable count cutoff, exact lot item, deterministic locks, stored replay, reversal, dan stale conflict.
5. Immutable WO snapshot dan supersession tanpa delete.
6. Exact `lot_id` material issue + stored replay + bulk recovery.
7. FG/QC stored replay, batch-derived reconciliation, exact HTTP/domain errors.
8. Backend-authoritative MRP → PR dengan immutable calculation lineage.
9. Isolated cross-module acceptance suite dan reconciliation checks.

Jangan menggabungkan seluruh dirty working tree menjadi satu commit. Setiap checkpoint di atas harus dapat dibuild, dimigrasikan pada database disposable, diuji, dan direview secara independen.

---

## Delta Review 21 Aug 2026 — Homework Revision Check

### Scope dan evidence

- Tested commit: `a0e225d` dengan dirty working tree; tidak ada commit baru setelah 14 Aug 2026.
- Delta terbaru yang direview: migration runner, Procurement approval/GRN, Inventory ledger/Stock Card/opname, Production issue/FG receipt, dan PPIC MPS/WO/MRP.
- Backend `npm run build:ci`: **PASS**.
- Frontend `npm run build`: **FAIL**; detail ada pada `RELEASE-P1-21`.
- Migration tidak dijalankan karena database yang terkonfigurasi belum dibuktikan disposable. Tidak ada business data yang disentuh.
- Finance/GL implementation belum mempunyai delta perilaku yang berarti; blueprint target berada di `docs/architecture/finance-general-ledger-blueprint.md`, tetapi posting service, subledger-to-GL atomicity, immutable reversal, dan period-close contract belum diimplementasikan.

### Perbaikan yang arahnya benar

- Runtime `ensure*` DDL yang besar sudah dipindahkan dari `backend/src/config/database.ts` ke migration bernomor, dan startup sekarang memanggil migration runner yang checksum-aware.
- Principal `received_by` pada create GRN sekarang berasal dari authenticated token (`backend/src/routes/procurement.routes.ts:1661-1663`), sehingga fallback admin ID 1 sudah dihapus pada flow tersebut.
- Final posting GRN sudah memakai satu transaction untuk header, PO received quantity, exact receipt lot, inventory balance, movement, dan Incoming FPA (`backend/src/services/procurement.service.ts:332-559`).
- Stock Card web sudah memakai balance dari backend dan tidak lagi menghitung running balance sendiri (`frontend/src/views/StockCard.vue:147-173`).
- Material issue dan FG receipt sudah menulis `lot_id`; FG receipt mewajibkan idempotency key pada request (`backend/src/services/production.service.ts:117-129,246-257`).
- MPS menampilkan stok FG `available` sebagai beginning inventory live dan tidak lagi menambahkan output WO dua kali (`backend/src/routes/ppic.routes.ts:195-207`, `frontend/src/views/ppic/MpsMaster.vue:1246-1252`). Ini memperbaiki live view, tetapi belum memenuhi immutable planning snapshot.

### MIG-P0-18 — Migration foundation masih mempunyai dua authority dan baseline silent drift

**Jenis:** architecture/release blocker.

**Evidence:**

- Startup tetap membaca dan mengeksekusi `database/schema_mysql.sql` di luar ledger/versioning, memecah SQL hanya dengan `;`, lalu mengabaikan semua error selain mencetak warning (`backend/src/config/database.ts:82-107`). Migration runner baru dijalankan sesudahnya pada `:109-119`; schema dapat berubah sebagian sebelum fail-closed gate.
- Jika baseline file tidak ditemukan, startup tetap melanjutkan memakai database yang ada (`backend/src/config/database.ts:105-107`).
- Runner hanya memindai `backend/database/migrations` (`backend/src/config/database.ts:109-112`, `backend/src/scripts/migrate.ts:8`), sementara migration aktif lain tetap berada di `backend/migrations`, termasuk `finance_gl_foundation.sql`, `012_lineage_fk_columns.sql`, dan `013_crm_rbac_permission_catalog.sql`.
- Parser memperlakukan seluruh angka prefix sebagai version (`backend/src/lib/migrationRunner.ts:21-25`), sehingga `0041_qc_tables.sql` menjadi version 41 dan dieksekusi setelah migration 028, bukan sebagai pengganti 004 pada urutan QC awal.
- Ledger hanya unique pada filename, bukan version (`backend/src/lib/migrationRunner.ts:80-90`). Rename file yang sudah applied dapat membuat version yang sama dicatat dua kali walaupun in-memory validator hanya memeriksa file yang sedang ada.

**Target contract:**

- Satu canonical migration stream dan satu immutable ledger. Baseline hanya boleh dijalankan saat database kosong dengan marker eksplisit, harus checksum/versioned, dan setiap SQL error harus menghentikan startup.
- Pindahkan atau retire seluruh file `backend/migrations`; Finance GL schema wajib menjadi migration bernomor dalam stream yang sama.
- Perbaiki version 0041 melalui migration mapping yang aman terhadap environment yang mungkin sudah apply; jangan rename applied history tanpa ledger reconciliation.
- Unique ledger pada `version` dan `filename`, checksum immutable, serta explicit repair procedure untuk partial MySQL DDL.

**Acceptance:** fresh install, upgrade dari snapshot sebelum 019, checksum mismatch, renamed migration, duplicate version, missing baseline, DELIMITER procedure, dan injected failure statement harus diuji dua kali pada database disposable. Startup harus fail closed dan schema hash akhir harus identik.

### INV-PROC-P0-19 — Approval/GRN masih memakai status sebagai idempotency dan masih dapat menyembuhkan partial posting secara palsu

**Jenis:** carry-over `INV-PROC-P0-14` dan `INV-PROC-P0-16`; belum closed.

**Evidence:**

- PR/PO mengembalikan sukses untuk status final sebelum memverifikasi permission atau command identity (`backend/src/services/procurement.service.ts:72-80,161-168`). Tidak ada idempotency key, payload hash, actor/scope, atau stored HTTP outcome pada signature command.
- GRN rejected masih otomatis diubah kembali ke pending dalam transaction terpisah sebelum approval final (`backend/src/services/procurement.service.ts:256-274`). Jika command berikutnya gagal, state rejected sudah hilang.
- GRN masih dianggap lengkap hanya karena ada minimal satu stock movement, kemudian header dipaksa final (`backend/src/services/procurement.service.ts:353-363`). Satu effect parsial tidak membuktikan semua GRN lines, lot, balance, PO quantity, FPA, dan audit konsisten.
- Emergency `approve` tetap mengisi supervisor dan manager dengan actor yang sama (`backend/src/services/procurement.service.ts:113-125,201-212,366-377`) tanpa reason/override record immutable.

**Target contract:**

- Owner: `ProcurementApprovalService`; command wajib mempunyai scope `(tenant, command_type, document_id, idempotency_key)`, payload hash, actor, exact HTTP status/body, dan immutable transition history.
- Permission diverifikasi pada command baru dan replay diverifikasi terhadap actor/scope/payload; status final saja tidak pernah cukup untuk replay.
- `REJECTED -> RESUBMITTED -> PENDING` menjadi command atomik terpisah dengan reason. Final posted immutable; recovery mismatch menghasilkan `409 GRN_RECONCILIATION_REQUIRED` tanpa mutation.
- Emergency override wajib permission khusus, reason, dan audit; bukan implicit bypass SoD.

**Acceptance:** lost-response replay, unauthorized caller pada dokumen final, same-key/different-payload, rejected approval failure, dual approver race, movement-only fixture, one-of-two-line fixture, dan missing FPA fixture harus mempunyai exact HTTP dan exact no-partial-effect assertions.

### INV-PROC-P0-20 — GRN line dapat diduplikasi atau mengganti product dari PO item

**Jenis:** quantity/lineage integrity bug baru pada revised posting path.

**Evidence:**

- Create GRN menyimpan `notes` JSON mentah dari browser sebagai sumber item (`backend/src/routes/procurement.routes.ts:1652,1684-1689`); notes dan status tetap dapat diedit sampai final approval (`:1705-1723`).
- Final posting membuang line zero secara diam-diam (`backend/src/services/procurement.service.ts:390-394`) alih-alih menerima selected lines yang sudah tervalidasi saat create.
- PO items dibuat menjadi `Map`, tetapi tidak ada duplicate `po_item_id` set (`backend/src/services/procurement.service.ts:400-408,417-450`). Dua line dengan `po_item_id` sama masing-masing mengecek `alreadyReceived` snapshot yang sama lalu keduanya menambah `received_qty`, sehingga cumulative over-receipt dapat lolos.
- Service memastikan `po_item_id` ada di PO, tetapi tidak memastikan `item.product_id === poItem.product_id` (`backend/src/services/procurement.service.ts:426-450`). Browser dapat mengkredit quantity PO item A sambil membuat lot dan stock untuk product B.
- Quantity memakai JavaScript `Number` untuk decimal business quantity (`backend/src/services/procurement.service.ts:390-443`).

**Target contract:**

- Create GRN menulis normalized immutable draft lines, bukan notes sebagai write authority. Unique `(grn_id, po_item_id)`, FK exact, CHECK quantity > 0, dan product harus diturunkan dari PO item oleh server.
- Request hanya membawa selected `po_item_id`, decimal quantity string, batch/expiry attributes, dan idempotency key. Lock PO header/items ascending lalu recompute cumulative outstanding di transaction.
- Submit membekukan line snapshot; edit sesudah stage 1 harus melalui explicit withdraw/resubmit.

**Acceptance:** duplicate line 6+6 atas outstanding 10, forged product, zero/negative, decimal precision, foreign PO item, concurrent GRNs, edit setelah stage 1, dan retry harus membuktikan satu exact lot/effect per valid line dan rollback total untuk invalid request.

### INV-PROC-P0-21 — Stock Card revised service masih menghitung pending adjustment sebagai stock dan pagination merusak balance

**Jenis:** authoritative ledger implementation bug.

**Evidence:**

- Pending adjustment ditulis dengan `movement_type='adjustment'`, `reference_type='stock_adjustment'`, dan `approval_status=0` (`backend/src/routes/inventory.routes.ts:350-370`). Filter ledger hanya mengecualikan literal `reference_type='ADJUSTMENT'` (`backend/src/services/inventory-ledger.service.ts:91-103,133-135`), sehingga row pending/rejected tetap masuk.
- Classifier tidak mengenal `movement_type='adjustment'`; unknown type memakai generic positive fallback dan `Math.abs` (`backend/src/services/inventory-ledger.service.ts:24-31`). Adjustment negatif dapat ditampilkan dan dijumlahkan sebagai inbound positif.
- Opening dan page movement dibaca lewat query/koneksi terpisah tanpa consistent snapshot (`backend/src/services/inventory-ledger.service.ts:73-114,144-169`). Movement concurrent dapat masuk di antara kedua query.
- Ketika `offset > 0`, running balance dimulai dari opening periode dan tidak memasukkan row yang dilewati; `balance_after` dan `closing_quantity` page kedua salah (`backend/src/services/inventory-ledger.service.ts:138-142,171-208`).
- Balance dijumlahkan sebagai JavaScript `Number`, dan belum dipartisi authoritative per product + warehouse + lot (`backend/src/services/inventory-ledger.service.ts:64-71,171-211`).

**Target contract:**

- Registry movement type harus closed/typed; unknown type fail reconciliation, bukan fallback. Hanya immutable event dengan `posting_status='POSTED'` yang mempunyai effect.
- Pisahkan adjustment workflow dari stock movement atau tulis movement hanya saat final approval. Gunakan exact effect columns/versioned event type.
- Satu repeatable-read snapshot menghasilkan opening, page rows, balance-before-cursor, balance-after, full-window closing, as-of DB timestamp, dan reconciliation delta. Cursor `(moved_at,id)`, bukan offset running balance.
- Decimal string/DB arithmetic dan partition key `(product_id, warehouse_id, lot_id, stock_status)`.

**Acceptance:** pending/rejected/approved negative adjustment, qc_release neutral, unknown type, same timestamp, second page, concurrent post during read, lot A/B, dan filtered date range harus reconcile ke authoritative inventory balances dengan delta nol.

### INV-PROC-P1-22 — Stock Card UI default selalu gagal lalu menyamar sebagai empty

**Evidence:**

- UI menawarkan default `All products` (`frontend/src/views/StockCard.vue:19-23`), tetapi tidak mengirim `product_id` ketika nilai 0 (`:139-148`), sedangkan API mewajibkannya dan merespons 422 (`backend/src/routes/inventory.routes.ts:780-784`). Initial load karena itu gagal.
- Error 403/422/500/timeout tetap diubah menjadi array kosong dan balance nol (`frontend/src/views/StockCard.vue:151-155`); export tetap aktif (`:6-11,203-228`).

**Target/acceptance:** pilih product wajib atau implementasikan server partitioned multi-product response. UI wajib state `loading/success/empty/stale/error`, tampilkan stable code/request ID, disable export kecuali authoritative response sukses, dan bedakan legitimate empty 200 dari 422/403/500/timeout.

### INV-PROC-P0-23 — Lot-aware opname belum memiliki immutable count cutoff

**Jenis:** concurrency/lineage bug; `INV-PROC-P0-10` masih open.

**Evidence:**

- Migration 028 hanya menambah nullable columns; belum ada FK `lot_id`/`inventory_stock_id`, unique opname-line constraint, snapshot version, atau idempotency outcome (`backend/database/migrations/028_lot_aware_opname.sql:5-32`).
- Header opname dan auto-populated lines dibuat lewat `dbRun` terpisah, sehingga bukan satu transaction (`backend/src/routes/inventory.routes.ts:502-519`).
- Update count tidak mengunci session, tidak memvalidasi item milik session, dan tidak menulis counted actor/time (`backend/src/routes/inventory.routes.ts:553-561`).
- Post memilih hanya item yang `actual_qty IS NOT NULL`, sehingga uncounted item diam-diam dilewati (`backend/src/routes/inventory.routes.ts:585-589`).
- `cutoff_at` baru dibuat saat post, tetapi system quantity berasal dari waktu create dan tidak ada pemeriksaan movement di antaranya (`backend/src/routes/inventory.routes.ts:512-519,582-613`). Service menambahkan `actual - old_system_qty` ke current stock; receipt/issue paralel dapat menghasilkan koreksi salah.
- Legacy fallback masih memilih available row pertama tanpa lot (`backend/src/routes/inventory.routes.ts:615-635`). Movement opname tidak menyimpan reference opname atau posting/idempotency outcome (`:637-648`).

**Target contract:**

- Owner: `InventoryOpnameService`, state `DRAFT -> COUNTING -> COUNTED -> POSTED`; create snapshot, count finalization/cutoff, dan post adalah explicit transactions.
- Exact `(opname_id, inventory_stock_id, lot_id, status_snapshot)` unique/FK; counted actor/time dan balance version wajib.
- Post menolak incomplete `422 OPNAME_INCOMPLETE`; movement setelah snapshot yang tidak direkonsiliasi menghasilkan `409 OPNAME_STALE`. Tidak ada generic legacy-row fallback pada new command.
- Atomic post mencakup ordered locks, exact lot balance, immutable adjustment movement, audit, and stored replay; reversal adalah compensating event.

**Acceptance:** incomplete count, lot A/B, available/qc_hold, movement setelah snapshot, deleted lot, double post, timeout replay, parallel sessions, dan reversal harus mempunyai deterministic HTTP serta exact before/after.

### PPIC-PROD-P0-24 — Material issue/return masih mengizinkan ambiguous lot dan idempotency parameter tidak digunakan

**Jenis:** exact-lot/retry contract masih open.

**Evidence:**

- `lotId` tetap optional; jika absent atau batch lookup gagal, service memilih available row pertama (`backend/src/services/production.service.ts:23-32,67-92`).
- Lock order adalah WO material lalu WO (`backend/src/services/production.service.ts:43-52`), kebalikan dari contract global `WO -> WO material -> lot balance`; flow lain dapat membentuk deadlock cycle.
- `idempotencyKey` diterima oleh issue dan return tetapi tidak pernah dibaca/disimpan (`backend/src/services/production.service.ts:23-32,144-152`). Retry tetap membuat deduction/return kedua.
- Return menambahkan quantity ke available row pertama atau membuat stock tanpa lot; movement juga tidak membawa `lot_id` atau reference ke original issue event (`backend/src/services/production.service.ts:184-206`). Lineage exact lot hilang dan return dapat mengkredit lot lain.

**Target contract:**

- Exact `lot_id` mandatory. Command scope `(tenant, WO_MATERIAL_ISSUE|RETURN, wo_material_id, key)` menyimpan payload hash dan exact outcome.
- Lock order konsisten `WO -> WO material -> inventory lot/balance`. Issue event immutable mereferensikan movement; return/reversal wajib memilih original issue allocation dan exact lot, serta tidak melebihi remaining returnable quantity.
- Typed HTTP `404/409/422/403`; bulk command atomic atau explicit resumable per-line outcome.

**Acceptance:** missing/wrong/held/expired lot, two-lot requirement, parallel issue, retry after timeout, same-key mismatch, partial return, over-return, return after terminal WO, dan reversal harus reconcile material issue ledger ke WO/WIP exact lot.

### PPIC-PROD-P0-25 — FG idempotency/QC gate/batch aggregate belum exact

**Jenis:** Production ↔ QC gate masih open.

**Evidence:**

- FG replay hanya mencari global `stock_movements.idempotency_key` dan return sukses tanpa payload hash/stored response (`backend/src/services/production.service.ts:246-257`). Migration 013 juga membuat key global (`backend/database/migrations/013_fg_idempotency_key.sql:4-7`), walaupun migration 019 menambah scope columns yang belum digunakan.
- Mandatory checkpoint dengan `status NULL` lolos sebagai tidak pending karena SQL `status NOT IN ('passed')` menghasilkan NULL/false (`backend/src/services/production.service.ts:259-273`).
- Untuk batch number yang sudah ada, receipt berikutnya tidak meng-update quantity/status atau menghubungkan seluruh child lots (`backend/src/services/production.service.ts:341-350`).
- Route masih memetakan error melalui substring menjadi generic 400/500 (`backend/src/routes/production.routes.ts:1456-1460`).

**Target contract:**

- Stored replay scope `(tenant, FG_RECEIPT, wo_id, key)` + payload hash + original status/body. Same key/different payload `409`.
- Mandatory checkpoint dianggap passed hanya bila normalized status tepat `PASSED`; NULL/unknown/failure memblokir. FG final FPA/release tetap exact per receipt lot.
- Batch header adalah derived/reconciled projection dari receipt lots; tidak menjadi quantity authority kedua.
- Typed Production/QC domain errors dan satu mapper.

**Acceptance:** NULL checkpoint, failed/retest, two partial receipts dengan batch text sama, key collision lintas WO, same-key mismatch, concurrent receipts, missing spec rollback, dan approve sibling lot harus membuktikan one-effect/exact-lot behavior.

### PPIC-PROD-P0-26 — MPS live beginning inventory belum snapshot; WO reset dan snapshot masih tidak valid

**Jenis:** planning history/state-machine bug; carry-over P0 tetap open.

**Evidence:**

- MPS detail membaca jumlah `available` inventory secara live setiap GET tanpa warehouse, as-of, atau cutoff (`backend/src/routes/ppic.routes.ts:195-200`); frontend memakai nilai live itu sebagai beginning inventory minggu pertama (`frontend/src/views/ppic/MpsMaster.vue:1246-1252`). Receipt/shipment historis mengubah beginning inventory MPS lama.
- `current_stock` masih editable melalui remark endpoint (`backend/src/routes/ppic.routes.ts:659-684`), sehingga ada dua kandidat beginning stock.
- WO header dibuat sebelum component snapshot; kegagalan BOM material generation ditangkap dan hanya dicatat, sehingga transaction tetap commit WO tanpa materials (`backend/src/routes/ppic.routes.ts:997-1035`). `INSERT IGNORE` juga dapat silently skip material (`:1023-1028`).
- Reset membatalkan WO lama lalu membuat WO baru dengan `(mps_detail_id, week_number, year)` sama (`backend/src/routes/ppic.routes.ts:1151-1188`), tetapi migration 014 memberi unique constraint persis pada tiga field itu (`backend/database/migrations/014_wo_uniqueness.sql:4-8`). Row CANCELLED tetap memblokir replacement; transaction rollback/500.
- Sync WO masih mengubah quantity DRAFT in-place tanpa immutable revision/supersession (`backend/src/routes/ppic.routes.ts:1060-1090`).

**Target contract:**

- Pada confirm MPS, simpan immutable beginning snapshot per product/warehouse/status dengan cutoff/as-of dan source inventory ledger version. Current available tetap live projection terpisah.
- WO release memerlukan immutable planning/BOM/component/routing/capacity snapshot. Tidak ada catch-and-continue untuk mandatory component generation.
- Supersession membuat WO revision baru dengan `supersedes_wo_id`; unique hanya untuk satu active revision, bukan melarang historical CANCELLED/SUPERSEDED rows.
- Posted FG dan shipped DO mempengaruhi current projection; tidak menulis ulang historical MPS opening.

**Acceptance:** FG receipt/shipment setelah confirm tidak mengubah snapshot lama; replan membuat revision baru; missing/changed BOM rollback release; reset setelah cancellation berhasil tanpa menghapus history; concurrent generate/revert/sync terserialisasi.

### PPIC-PROC-P0-27 — Backend-authoritative MRP → PR masih mempunyai browser bypass dan race

**Jenis:** canonical owner violation; `PPIC-PROC-P0-5` belum closed.

**Evidence:**

- Embedded endpoint membaca agregat `mrp_week_data`, tetapi header check, duplicate PR check, dan result read dilakukan di luar transaction/row lock (`backend/src/routes/ppic.routes.ts:1486-1517`); dua request paralel dapat sama-sama membuat PR.
- Browser masih memilih `material_ids` serta `needed_by_week/year`; endpoint tidak menerima exact immutable MRP result-line IDs atau revision hash (`backend/src/routes/ppic.routes.ts:1483-1524,1535-1547`).
- PR transaction hanya membungkus insert header/items dan tidak mengunci/recompute MPS, BOM, inventory, reservations, open PO/partial GRN, lead time, dan rounding (`backend/src/routes/ppic.routes.ts:1561-1580`).
- Endpoint kedua `/mrp/generate-pr` tetap menerima seluruh `materials` termasuk `total_net_requirement` dari browser (`backend/src/routes/ppic.routes.ts:1882-1889`, `backend/src/services/ppic.service.ts:9-29,60-70`). Ini menjadi bypass canonical calculation.

**Target contract:**

- Satu `MrpToProcurementService`; frontend hanya mengirim immutable result-line IDs + revision + idempotency key.
- Transaction mengunci MPS/revision/result consumption rows, memvalidasi current authoritative calculation, membuat PR header/items/snapshot, dan menandai exact result lines consumed.
- Unique per result line/revision serta stored replay. Stale revision/consumed result `409`, invalid selection `422`.
- Hapus/deprecate browser-authoritative endpoint setelah client migration; jangan biarkan dua write paths.

**Acceptance:** parallel generate, stale inventory/PO receipt, cancelled/reversed PO, altered BOM, browser-forged quantity, partial selection, retry, and same-key mismatch harus menghasilkan exact quantity serta satu PR lineage per result revision.

### RBAC-P1-20 — Permission catalog dan Inventory API belum parity

**Evidence:**

- Opname post membutuhkan action `inventory.stock-opname/approve` (`backend/src/routes/inventory.routes.ts:569`), tetapi migration 027 hanya membuat view/create/update/delete untuk module tersebut (`backend/database/migrations/027_consolidate_permissions.sql:124-127`). Non-admin tidak dapat diberi permission post secara reproducible.
- Detail opname, batch movements, single inventory item, dan legacy transactions endpoint hanya memakai authentication tanpa module permission (`backend/src/routes/inventory.routes.ts:528,690,810,912`). Mobile legacy Stock Card tetap dapat bypass canonical view permission.
- Finance General Ledger catalog masih generic view/create/update/delete (`backend/database/migrations/027_consolidate_permissions.sql:173-176`); belum ada submit/approve/post/reverse/period-close/reopen/report permissions yang diperlukan blueprint GL.

**Target/acceptance:** permission catalog harus mendefinisikan action command yang sama dengan route; menu/frontend/API deny-by-default. Test role matrix membuktikan exact 403 untuk direct URL/API dan tidak ada auth-only legacy bypass.

### RELEASE-P1-21 — Frontend production build gagal

**Evidence hasil `npm run build`:**

- `frontend/src/views/ProductionExecution.vue:183-187,209,406`: interface process row belum mempunyai `has_qc_checkpoint`, `qc_status`, dan `qc_blocking` yang dipakai template.
- `frontend/src/views/PurchaseRequests.vue:1504`: `totalEst` tidak digunakan.
- `frontend/src/views/WorkOrders.vue:739`: `loadSummary` tidak didefinisikan.

**Target/acceptance:** sinkronkan response DTO/frontend types, hapus dead variable, dan pulihkan summary loader. Backend dan frontend production build harus PASS pada SHA yang sama sebelum smoke test atau near-FIRM claim.

### Status acceptance gate setelah revisi

- Inventory ↔ Procurement: **belum near-FIRM**. Actor GRN dan atomic posting membaik, tetapi migration authority, stored idempotency, exact normalized GRN lines, Stock Card, opname cutoff, RBAC, dan test evidence masih open.
- Production ↔ QC: **belum near-FIRM**. Exact lot mulai ditulis dan FG key diwajibkan, tetapi material issue/return fallback, FG replay, NULL QC gate, batch reconciliation, WO snapshot, serta frontend build masih open.
- PPIC → Inventory → Production carry-over: **belum closed**. Live FG beginning inventory bukan immutable MPS snapshot.
- Finance/General Ledger: **design blueprint tersedia, implementation gate belum dimulai**; jangan menganggap permission entry atau layar GL sebagai accounting integration yang selesai.

### Urutan homework berikutnya

1. Perbaiki migration single authority dan buktikan fresh/upgrade disposable migration.
2. Normalisasi GRN draft lines + unique/FK/product derivation, lalu stored idempotency/state machine/reconciliation.
3. Tutup Stock Card event semantics/pagination snapshot dan perbaiki UI error/default filter.
4. Implementasikan OpnameService dengan immutable cutoff dan exact lot.
5. Exact-lot issue/return + stored replay, lalu FG/QC NULL gate dan batch-derived reconciliation.
6. Immutable MPS/WO snapshots + revision/supersession; perbaiki reset unique model.
7. Satukan MRP-to-PR authoritative command dan matikan browser bypass.
8. Perbaiki frontend build, kemudian jalankan acceptance suite hanya pada database disposable.

---

## Delta Review 23 Agustus 2026 — Finance/GL, Costing, dan Integration Posting

### Scope dan evidence run

- Tested code identity: `a0e225dbb1aa9e33e4bf37e7d0b818b5d7b7543e` (`fix(procurement): P0 cycle 2 - all 7 blockers fixed`, 14 Agustus 2026). Seluruh revisi sesudahnya masih berada pada dirty worktree: 145 path berubah (`58 M`, `17 D`, `70 ??`), jadi hasil ini belum merepresentasikan immutable commit/release candidate.
- Backend production TypeScript build: **PASS** (`npm run build --workspace=backend`).
- Frontend production build: **FAIL** pada `ProductionExecution.vue`, `PurchaseRequests.vue`, dan `WorkOrders.vue`; detail di `RELEASE-P1-35`.
- Disposable migration verifier: **BLOCKED sebelum database dibuat** karena MySQL `127.0.0.1:3306` tidak tersedia (`ECONNREFUSED`). Port API `3000` dan frontend `5173` juga tidak listen. Tidak ada business database/data yang disentuh.
- Smoke test, browser screenshot, dan manual: **tidak dijalankan** karena kedua seam belum memenuhi near-FIRM gate.

### FIN-MIG-P0-28 — Stream migration baru tidak dapat meng-upgrade ledger lama dan fresh Finance schema juga tidak reproducible

**Jenis:** release-blocking migration architecture/implementation bug.

**Evidence:**

- Ledger yang disiapkan untuk database lama merekam version `1 = 001_approval_columns.sql`, `9 = 009_cost_control.sql`, `21 = 021_rnd_module.sql`, dan `41 = 0041_qc_tables.sql` (`backend/database/bootstrap_ledger.sql:1,5,10,22`). Directory baru memakai version yang sama untuk file berbeda, antara lain `001_production_schema_adoption.sql`, `009_runtime_ddl_consolidation.sql`, `021_approval_columns.sql`, dan `041_rnd_module.sql`.
- Runner secara eksplisit menghentikan release ketika version telah tercatat dengan filename berbeda (`backend/src/lib/migrationRunner.ts:259-266`). Tidak ada immutable bridge/mapping migration dari ledger lama ke stream baru.
- Pre-ledger database dengan tabel apa pun langsung diberi checksum baseline saat ini tanpa membandingkan schema aktual (`backend/src/lib/schemaBootstrap.ts:98-121`). Verifier upgrade hanya dijalankan bila operator memasok `--from-dump` (`backend/src/scripts/migrate-verify.ts:240-305,308-349`), sedangkan fingerprint hanya mencakup columns/indexes dan mengabaikan FK, CHECK, triggers, views, dan seed/config (`:50-65`). Ini dapat memberi label `legacy_adopted` pada schema yang tidak ekuivalen.
- Fresh Finance config juga deterministically invalid: `account_roles.account_id` adalah `NOT NULL` (`backend/database/migrations/052_accounting_config.sql:23-42`), tetapi seed memasukkan subquery akun `1111`, `1112`, `1120`, `1140` dan seterusnya yang tidak dibuat oleh baseline/current migrations (`:141-167`; migration 051 hanya menambah subset akun pada `backend/database/migrations/051_gl_foundation_upgrade.sql:46-62`).
- Permission migration memakai column `group_name` dan tidak mengisi `resource` (`backend/database/migrations/053_finance_permissions.sql:2-31`), padahal schema canonical mewajibkan `permissions.resource NOT NULL` (`backend/database/schema_mysql.sql:30-39`) dan convergence hanya menambah `module` serta `name` (`backend/database/migrations/047_consolidate_permissions.sql:5-10`).

**Target contract:** owner tunggal `SchemaMigrationService`; file/version/checksum yang pernah direlease immutable dan tidak boleh dinomori ulang. Buat explicit ledger-transition release yang memetakan exact old checksum ke canonical version atau menolak `409/SCHEMA_UNSUPPORTED`; jangan adopsi hanya berdasarkan jumlah tabel. Atomic boundary adalah satu migration file + ledger row setelah seluruh statement sukses, dengan advisory lock. Seed COA/config harus idempotent tetapi fail-fast bila prerequisite tidak ada; permission catalog harus memakai `(resource, action)` canonical. Tambahkan FK/CHECK/trigger/seed fingerprint serta manifest release.

**Acceptance:** pada MySQL 8 dan MariaDB disposable: fresh baseline → latest; exact production `--no-data` dump + old ledger → latest; rerun no-op; checksum drift; renamed-version conflict; missing COA prerequisite; migration 053 permission schema; FK/CHECK/trigger comparison; injected mid-file failure; dan rollback/recovery runbook. Semua harus memakai commit SHA yang sama dan tidak menyentuh business database.

### FIN-GL-P0-29 — Fiscal-period lock tidak menegakkan soft-close dan mempunyai close-vs-post race

**Jenis:** accounting state-machine/concurrency bug.

**Evidence:**

- `getOpenPeriod` hanya menolak `closed`, sehingga `soft_closed` tetap dianggap open untuk semua caller (`backend/src/services/fiscal-period.service.ts:16-41`), bertentangan dengan contract comment bahwa soft-close memblokir manual journal (`:61-62`).
- `postJournal` membaca status periode, lalu baru melakukan `FOR UPDATE` melalui fungsi lain (`backend/src/services/accounting-posting.service.ts:424-427`). `lockPeriod` mengembalikan row tanpa memvalidasi status setelah lock (`backend/src/services/fiscal-period.service.ts:44-59`). Jika close commit di antara dua query, journal tetap diposting ke periode yang sudah closed.
- System journal memakai urutan yang sama (`backend/src/services/accounting-posting.service.ts:589-591`).

**Target contract:** owner `FiscalPeriodService/AccountingPostingService`. Satu command `lockPostingPeriod(business_date, journal_type, correction_authority)` harus `SELECT ... FOR UPDATE` dan memvalidasi status dari row yang sudah terkunci: MANUAL hanya `OPEN`; SYSTEM normal hanya `OPEN`; controlled correction pada `SOFT_CLOSED` memerlukan permission, reason, dan close-run linkage; `CLOSED` selalu `409 PERIOD_CLOSED`. Period close memakai lock row yang sama, immutable transition `OPEN -> SOFT_CLOSED -> CLOSED`, optimistic version, stored idempotency scope `(company, PERIOD_COMMAND, period_id, key)`, dan audit actor/reason.

**Acceptance:** manual/system post pada setiap status, post-vs-soft-close dan post-vs-close barrier concurrency, retry lost response, stale version, unauthorized reopen, serta same-key/different-payload. Assert exact `200/201/403/409/422` dan journal/period before-after.

### FIN-GL-P0-30 — Account-role resolver dapat memilih akun scoped yang tidak cocok

**Jenis:** canonical account ownership/config resolution bug.

**Evidence:**

- Resolver menginisialisasi `best = matches[0]` sebagai fallback walaupun row pertama dapat mempunyai warehouse/category/vendor scope (`backend/src/services/account-role.service.ts:57-59`).
- Scope hanya dibandingkan jika mapping dan request sama-sama membawa nilai; missing request dimension tidak membuat scoped row mismatch (`:64-83`). `project_id` dan `cost_center_id` bahkan tidak ikut scoring, meski dibaca dari database (`:34-36`).
- Loop berhenti pada positive match pertama, bukan membandingkan specificity seluruh kandidat (`:85-88`); schema juga hanya mempunyai lookup index tanpa exclusion/uniqueness untuk overlapping effective rules (`backend/database/migrations/052_accounting_config.sql:23-43`).

**Target contract:** owner `AccountRoleService`; tidak ada generic fallback ambigu. Kandidat scoped valid hanya bila seluruh non-null dimension sama dengan command context; pilih specificity tertinggi, lalu priority, dan jika tie hasilnya `409 ACCOUNT_ROLE_AMBIGUOUS`. Missing mapping `422 ACCOUNT_ROLE_NOT_FOUND`. Simpan approved/effective-dated config version/hash pada `accounting_events`; database mencegah exact duplicate/overlap yang ambigu. Account resolution dan journal insert berada dalam satu posting transaction.

**Acceptance:** generic + warehouse-specific, wrong/missing warehouse, category/vendor/project/cost-center combinations, equal-priority tie, expired/future mapping, inactive account, serta historical replay setelah mapping berubah harus menghasilkan akun dan snapshot deterministik.

### FIN-INT-P0-31 — Pergerakan stok dapat commit tanpa financial effect yang wajib

**Jenis:** cross-module atomicity/valuation bug.

**Evidence:**

- GRN membuat lot, QC-hold stock, movement, PO receipt quantity, dan cost layer, tetapi jurnal hanya dibuat bila `poUnitPrice > 0` (`backend/src/services/procurement.service.ts:450-519,562-565`). Zero/missing price menjadi stock final-cost nol tanpa GRNI atau explicit free-of-charge policy. Perkalian juga dilakukan lebih dulu dengan JavaScript `qty * poUnitPrice` sebelum dibungkus Decimal (`:520`).
- FG receipt membuat stock dan provisional cost layer, tetapi Dr FG/Cr WIP hanya dibuat bila `fgTotalCost > 0` (`backend/src/services/production.service.ts:448-491,529-535`).
- QC release memindahkan hold ke available terlebih dahulu dan hanya membuat reclassification bila cost layer ditemukan (`backend/src/services/qc.service.ts:456-510,547-558`). Missing layer diam-diam melepaskan barang tanpa GL.
- Material return menambah physical stock dan hanya menjurnal bila latest issue cost ada dan positif (`backend/src/services/production.service.ts:257-290,322-334`).

**Target contract:** `AccountingPostingService` menjadi participant wajib pada setiap posted inventory event. Atomic boundary yang sama harus mencakup source transition, exact balance/movement, cost layer/allocation, accounting event, balanced journal, audit, dan stored idempotency outcome. Missing price/cost/account/period adalah rollback total dengan `422 VALUATION_REQUIRED`/`409 PERIOD_CLOSED`; free-of-charge harus explicit approved posting profile dengan zero-value statistical event, bukan silent skip. Gunakan decimal string end-to-end dan DB precision/checks.

**Acceptance:** zero price, free goods, missing/zero layer, missing role, closed period, partial GRN, partial FG, QC release, return, concurrent retry, forced journal failure, dan lost response harus membuktikan all-or-nothing serta reconciliation `stock value = cost layers = GL inventory control`.

### PROD-COST-P0-32 — Material return masih kehilangan exact lot, original allocation, idempotency, dan cost layer

**Jenis:** carry-over P0 belum closed; exact lineage/reversal bug.

**Evidence:**

- Return command tidak menerima/mewajibkan `lotId`; idempotency key optional dan tidak pernah dicari/disimpan (`backend/src/services/production.service.ts:217-234`).
- Stock dikembalikan ke row available pertama berdasarkan product+warehouse atau dibuat tanpa lot (`:257-273`); movement juga tidak menyimpan `lot_id` atau original issue/allocation reference (`:275-280`).
- Nilai return memakai `unit_cost` issue terbaru untuk `wo_material_id`, bukan exact issue yang dikompensasi (`:282-291`). Cost layer quantity/allocation tidak pernah direstore; physical stock menjadi lebih besar dari valuated quantity.
- Fallback key berbasis `Date.now()` membuat retry selalu command baru (`:320-332`).

**Target contract:** owner `ProductionMaterialService`; transition immutable `ISSUED -> PARTIALLY_RETURNED -> RETURNED` per issue allocation. Request wajib `original_issue_id`, exact `lot_id`, decimal qty string, warehouse, reason, idempotency key. Lock order `WO -> WO material -> original issue/allocation -> lot balance -> cost layer`; satu transaction membuat compensating movement, menambah kembali exact layer remaining, mengurangi WIP/batch material cost, membalik GL, dan menyimpan outcome. Unique `(company, MATERIAL_RETURN, original_issue_id, key)` + payload hash; `returned_qty <= issue_qty - prior_returns` CHECK/reconciliation. Terminal WO/reversed issue menolak `409`.

**Acceptance:** two lots/one material, two issue prices, partial/second/over return, wrong warehouse/lot, missing layer, retry/lost response/same-key mismatch, concurrent returns, terminal WO, dan GL failure; assert exact lot balance, allocation, WIP, cost sheet, journal, and audit.

### PROD-COST-P0-33 — Batch cost sheet dan multi-layer allocation menulis ownership/quantity yang salah

**Jenis:** manufacturing cost data-model and implementation bug.

**Evidence:**

- Saat RM issue, batch sheet diberi `batchNumber` dari raw-material stock dan `fgProductId` dari material component (`backend/src/services/production.service.ts:148-154`). Ini menjadikan RM batch/product sebagai identity sheet FG.
- FG receipt lalu meng-update sheet memakai FG `batchNumber`; update tidak memeriksa affected rows dan dapat menyentuh nol row (`backend/src/services/inventory-costing.service.ts:307-327`).
- Allocation query tidak memilih `quantity_allocated` (`backend/src/services/inventory-costing.service.ts:95-103`), tetapi update menghitung nilai baru dari `layer.quantity_allocated || 0` (`:130-139`), sehingga allocation kedua dapat meng-overwrite cumulative quantity.
- Jika satu issue mengambil beberapa layer, service hanya mengembalikan `lastAllocationId` dan caller hanya menghubungkan row terakhir ke journal (`:112-175,178-183`; `backend/src/services/production.service.ts:197-201`).
- Migration hanya memberi FK allocation→layer; lot/product/warehouse/source/journal/WO/FG references dan quantity/cost CHECK belum ada (`backend/database/migrations/054_inventory_cost_layers.sql:5-63,65-98`).

**Target contract:** owner `ManufacturingCostService`. Satu batch cost aggregate identity adalah `(company, wo_id, fg_receipt_batch/lot revision)`, bukan RM batch. Material cost berasal dari immutable issue allocations linked many-to-one ke WO cost sheet; service mengembalikan semua allocation IDs dan menjurnal total exact. DB wajib FK lineage, `quantity_received = remaining + allocated`, non-negative CHECK, unique source event, and journal linkage. Finalization `OPEN -> PROVISIONAL -> FINAL`; FINAL immutable dan perubahan biaya melalui variance event/revaluation.

**Acceptance:** multi-component/multi-RM-lot, two cost layers same lot, partial issue/return, two partial FG receipts, different FG batch text, labor/overhead, concurrent allocation, finalization/revaluation, dan retry. Reconcile every layer/allocation/sheet/WIP/FG/GL to zero delta.

### INV-PROC-P0-34 — Normalized GRN line authority masih belum diperbaiki

**Jenis:** carry-over `INV-PROC-P0-20` tetap open.

**Evidence:**

- Final posting masih membaca line dari JSON `goods_receipts.notes` (`backend/src/services/procurement.service.ts:384-392`).
- Service memvalidasi `po_item_id` berada di PO, tetapi tidak memastikan `item.product_id === poItem.product_id`; client product tetap dipakai untuk `grn_items`, lot, stock, cost, dan GL (`:421-471,503-538`).
- Tidak ada duplicate `po_item_id` set. Dua line yang menunjuk PO item sama membaca snapshot `received_qty` yang sama dari Map, masing-masing dapat lolos ceiling lalu menambah quantity (`:404-447,495-499`).
- Quantity dan price memakai JavaScript `Number` (`:394-397,421-443,450-457`).

**Target contract:** owner `GoodsReceiptService`; immutable normalized `grn_lines` adalah authority, dengan unique `(grn_id, po_item_id)`, FK PO item, server-derived product/vendor/UOM/currency, decimal quantity, and cost snapshot. Submit membekukan lines; final post mengunci PO+items ascending, recompute outstanding, dan satu transaction membuat exact source line/lot/FPA/cost/GL. Idempotency scope `(company, GRN_POST, grn_id, key)` + payload hash/outcome; invalid lineage `422`, stale/concurrent ceiling `409`, no mutation.

**Acceptance:** forged product, duplicate 6+6 atas outstanding 10, foreign PO line, decimal boundary, partial concurrent GRNs, changed notes after submit, zero price policy, same-key mismatch, and forced downstream failure.

### FIN-RBAC-P0-35 — GL financial data read paths auth-only dan permission catalog/route/UI tidak parity

**Jenis:** deny-by-default/RBAC architecture bug.

**Evidence:**

- COA, fiscal periods, journal list/detail, trial balance, income statement, balance sheet, cash flow, dan dashboard hanya memakai `authMiddleware` (`backend/src/routes/gl.routes.ts:20,48,124,185,214,391,449,552,602,671`). Semua authenticated user dapat membaca data Finance.
- COA mutations memeriksa `finance.general-ledger:create|update|delete` (`:58-106`), sedangkan migration baru mendefinisikan `finance.coa:view|create|update|deactivate` (`backend/database/migrations/053_finance_permissions.sql:10-13`).
- Frontend selalu menampilkan Add/Edit/Delete dan Submit/Approve/Post/Reverse tanpa permission state (`frontend/src/views/GeneralLedger.vue:133-135,171-174,232-235`); tombol Delete melakukan physical delete (`:780-785`).

**Target contract:** canonical permission owner `AuthorizationService` + `permissions(resource,action)`. Setiap API mempunyai exact permission: `finance.coa:*`, `finance.general-ledger:view|create|submit|approve|post|reverse|period_close`, `finance.general-ledger:report|export`; default deny untuk legacy route juga. Menu/action visibility memakai permission payload yang sama tetapi API tetap authority. COA menggunakan deactivate, bukan delete. Role grants versioned/audited; no user-level/admin implicit bypass.

**Acceptance:** matrix Maker/Approver/Poster/Controller/Auditor/non-Finance untuk menu, direct URL, dan direct API; exact 401/403; maker cannot approve/post; report/export isolation; deactivated account; legacy PUT post/void; permission migration on fresh/upgrade schema.

### FIN-GL-P0-36 — COA dapat mengubah klasifikasi historis dan layar menampilkan balance authority palsu

**Jenis:** historical immutability/canonical balance bug.

**Evidence:**

- PUT COA mengizinkan perubahan `account_type`, `normal_balance`, `is_header`, dan parent tanpa memeriksa historical journal lines (`backend/src/routes/gl.routes.ts:88-99`). Semua report mengelompokkan historical journal dengan atribut COA saat ini (`:456-517,557-573`), sehingga edit master hari ini menulis ulang penyajian laporan periode lama.
- UI menampilkan `chart_of_accounts.current_balance` sebagai “Current Balance” (`frontend/src/views/GeneralLedger.vue:138-166`), tetapi posting service tidak pernah meng-update column tersebut; source code Finance hanya menulis journal lines.
- UI menawarkan Opening Balance (`:519-522,721-725,763-771`), tetapi create route tidak membaca/menjurnal `opening_balance` (`backend/src/routes/gl.routes.ts:58-80`). User mendapat success walau nilai tidak diterapkan.

**Target contract:** posted journal lines adalah satu balance authority. Attributes yang mempengaruhi financial statements dibekukan setelah first posting atau effective-dated melalui COA revision/mapping; historical report menyimpan/resolve revision as-of. Opening balance hanya melalui approved OPENING journal in an open opening period. Hapus `current_balance` sebagai writable/display authority atau jadikan rebuildable projection dengan watermark/reconciliation. COA command transactional, audited, idempotent; conflicting historical edit `409 COA_IN_USE`.

**Acceptance:** edit used/unused account, as-of report before/after allowed rename, type/normal-balance change, header conversion, opening journal approve/post/reverse, projection rebuild, and stale projection UI. Historical totals must remain identical.

### FIN-E2E-P0-37 — GRNI sudah dikredit tetapi AP clearing, shipment/COGS, AR/revenue belum mempunyai posting owner

**Jenis:** incomplete end-to-end accounting design; balance sheet akan divergen setelah flow nyata.

**Evidence:**

- GRN sekarang mengkredit role `GRNI` (`backend/src/services/procurement.service.ts:516-560`).
- Di seluruh backend, `postSystemJournal` hanya dipanggil oleh Procurement GRN, Production material/return/FG, dan QC release (`backend/src/services/procurement.service.ts:549`; `backend/src/services/production.service.ts:185,322,516`; `backend/src/services/qc.service.ts:547`). Tidak ada vendor-invoice event yang mendebit GRNI/credit AP, tidak ada payment clearing, dan tidak ada shipment Dr COGS/Cr FG maupun invoice/receipt AR/revenue event. Migration 052 hanya menyebut profile/roles tersebut sebagai schema/comment/seed (`backend/database/migrations/052_accounting_config.sql:45-76,141-167`).

**Target contract:** `PayablesPostingService` owns `VENDOR_INVOICE MATCHED -> APPROVED -> POSTED -> REVERSED` with 3-way match per PO/GRN line, GRNI clearing, price/tax/rounding variance and AP subledger. `SalesAccountingService` owns shipment/delivery/invoice/receipt transitions: exact lot allocation + Dr COGS/Cr FG at shipment policy; Dr AR/Cr revenue+tax at invoice/recognition; cash/AR at receipt. Every transition shares source transaction/outbox boundary or same modular-monolith transaction, scoped idempotency, immutable snapshots, reversal links, dimensions, and subledger↔GL reconciliation.

**Acceptance:** partial receipt/invoice, invoice before/after GRN, price variance, return/debit note, payment retry/reversal, partial shipment, exact-lot COGS, delivery cancellation/return, invoice/credit note, receipt allocation, closed period, and AP/AR/GRNI/inventory/GL reconciliation.

### FIN-IDEM-P1-38 — Manual journal commands belum mempunyai stable stored replay contract

**Evidence:**

- Submit/approve route membuat fallback key dengan `Date.now()` (`backend/src/routes/gl.routes.ts:289-310`), tetapi `submitJournal` dan `approveJournal` sama sekali tidak memanggil idempotency store (`backend/src/services/accounting-posting.service.ts:328-384`). Retry setelah success menjadi `409 INVALID_STATUS_TRANSITION`, bukan original response.
- Legacy post/void dan frontend post/reverse juga menghasilkan key baru per click/retry (`backend/src/routes/gl.routes.ts:337-378`; `frontend/src/views/GeneralLedger.vue:886-907`).
- `checkIdempotency` melakukan unlocked check-before-insert (`backend/src/services/accounting-posting.service.ts:187-230`); concurrent identical requests dapat berakhir unique-key error/500, bukan deterministic replay. Journal idempotency juga global per key, bukan company+command scope (`backend/database/migrations/051_gl_foundation_upgrade.sql:112-113`).

**Target contract:** semua commands require client-stable key; claim row at command start using unique `(company, scope, aggregate_id, key)` and payload hash/actor, then store exact status/body in same transaction. Concurrent duplicate waits/reloads original outcome; same-key mismatch `409 IDEMPOTENCY_MISMATCH`. Submit/approve/post/reverse scopes terpisah. No timestamp fallback.

**Acceptance:** sequential and concurrent retry, lost response, same key/different journal/payload/actor, permission change between replay, legacy route, DB timeout before/after commit, and duplicate accounting event.

### FIN-REPORT-P1-39 — Trial balance/cash flow dan frontend amount calculation belum accounting-grade

**Evidence:**

- Trial balance menjumlahkan closing balance ke debit/credit berdasarkan `normal_balance`, bukan menyajikan debit/credit ending balance berdasarkan sign atau membandingkan total posted debits/credits (`backend/src/routes/gl.routes.ts:396-435`). Contra/abnormal balance dapat membuat summary salah.
- Cash flow mempunyai hardcoded account-code fallback bila role mapping kosong (`:609-626`) dan hanya group by `reference_type`, belum klasifikasi operating/investing/financing atau controlled indirect-method reconciliation (`:628-659`).
- Report totals dan UI journal balance memakai JavaScript `Number` (`backend/src/routes/gl.routes.ts:418-435,519-528,580-592`; `frontend/src/views/GeneralLedger.vue:805-807,925-931`), berisiko precision loss pada skala besar.

**Target contract:** `FinancialReportingService` membaca posted immutable lines as-of DB cutoff, menggunakan SQL DECIMAL/string, explicit report mapping/effective version, comparative period, retained current earnings, and report watermark. Missing mapping adalah fail/reconciliation warning, bukan hardcoded fallback. TB menyediakan total movement debit=credit dan signed closing; cash flow mempunyai auditable classification and opening+movement=closing reconciliation.

**Acceptance:** contra balances, reversal, opening entries, prior/current earnings, multi-period close, large decimals, unmapped cash account, FX, report during concurrent posting, and cross-foot tests for TB/BS/PL/CF.

### PROD-QC-P1-40 — FG batch aggregate masih dapat release terlalu cepat atau tidak mengakumulasi receipt

**Evidence:**

- Sibling query memakai `status NOT IN ... OR result NOT IN ...`; SQL NULL menghasilkan UNKNOWN dan row dengan status/result NULL dapat tidak terhitung sebagai unresolved (`backend/src/services/qc.service.ts:560-571`). Aggregate kedua hanya mengecek status dan mempunyai masalah NULL yang sama (`:592-604`).
- Batch update menggunakan `batch_number` saja tanpa product/WO/lot dimension (`:573-575,603-604`).
- FG receipt hanya membuat batch bila belum ada; receipt berikutnya dengan batch text sama tidak menambah quantity atau child-lot linkage (`backend/src/services/production.service.ts:538-547`).

**Target contract:** batch header adalah derived projection dari exact FG receipt lots. Unresolved berarti hanya explicit normalized `APPROVED/PASSED` yang resolved; NULL/unknown/retest/rejected blocks. Aggregate key minimal `(product_id, production_batch_id)` dengan child-lot FK, receipt quantity sum, version/watermark; release only after all required child FPAs pass. Rejection/retest/reversal recompute atomically. Idempotent QC finalize stored per FPA command.

**Acceptance:** NULL sibling, pending/retest/rejected/cancelled sibling, two products with same batch text, two partial receipts, concurrent final approvals, reversal after release, and exact batch-vs-child-lot reconciliation.

### RELEASE-P1-41 — Frontend production build masih gagal

**Evidence hasil run 23 Agustus 2026:**

- `frontend/src/views/ProductionExecution.vue:183-187,209,406`: DTO type belum mempunyai `has_qc_checkpoint`, `qc_status`, `qc_blocking`.
- `frontend/src/views/PurchaseRequests.vue:1504`: `totalEst` declared tetapi tidak digunakan.
- `frontend/src/views/WorkOrders.vue:739`: `loadSummary` tidak didefinisikan.
- Backend build PASS; frontend `vue-tsc && vite build` berhenti pada typecheck. Ini sama dengan carry-over build blocker dan belum diperbaiki revisi terbaru.

**Target/acceptance:** sinkronkan generated/shared API DTO dengan UI, hapus dead variable, dan implement/rename summary loader. Backend+frontend production build, lint relevan, dan route chunk load harus PASS pada commit SHA yang sama sebelum smoke/browser/manual.

### Status acceptance gate setelah delta 23 Agustus

- Inventory ↔ Procurement: **belum near-FIRM** — migration stream, normalized GRN line ownership, optional valuation journal, Stock Card/opname carry-over, RBAC, dan runtime evidence masih open.
- Production ↔ Quality Control: **belum near-FIRM** — material return exact lot/cost, batch cost ownership, optional FG/QC journal, NULL sibling release, reconciliation, serta frontend build masih open.
- PPIC → Inventory → Production: **carry-over P0 tetap open**; MPS beginning-inventory snapshot dan delivery projection belum mendapat evidence implementasi baru dalam delta ini.
- Finance/General Ledger: **belum near-FIRM** — posting core adalah langkah maju, tetapi schema tidak reproducible, period/account mapping unsafe, RBAC/report/history/idempotency belum firm, dan AP/AR/COGS lifecycle belum tersambung.
- Screenshot/manual coverage: **0 / tidak dimulai**, sesuai gate; jangan dokumentasikan UI sebagai selesai sebelum schema, build, app availability, smoke, permission, audit, dan reconciliation PASS pada SHA yang sama.

### Prioritas homework terkecil yang menghasilkan modular monolith andal

1. Bekukan/repair migration history tanpa renumber; buat fresh + exact old-ledger dump verifier PASS, termasuk Finance migrations 051–054.
2. Tutup atomic valuation invariant: tidak ada posted stock event tanpa exact cost event+journal atau explicit approved zero-value policy.
3. Implement exact issue-allocation return/reversal dan perbaiki batch cost sheet ownership/reconciliation.
4. Perbaiki GRN normalized lines dan stored idempotency; baru ulang Procurement→QC smoke.
5. Perbaiki fiscal-period locking, deterministic account-role resolution, GL RBAC, dan historical COA rules.
6. Sambungkan AP/GRNI dan shipment/COGS/AR/revenue dengan reversal/reconciliation sebelum menyebut Finance terintegrasi.
7. Perbaiki frontend build; hidupkan aplikasi+disposable DB; jalankan negative/retry/concurrency/reconciliation suite dan capture UI hanya setelah near-FIRM.

## Delta 25 Agustus 2026 — Three-way match pada vendor invoice

Menutup bagian match/variance dari **FIN-E2E-P0-37**. Sebelumnya invoice vendor dipercaya apa adanya: tidak ada pembanding terhadap pesanan maupun penerimaan, sehingga vendor bisa menagih barang yang tidak pernah datang, menagih satu penerimaan dua kali, atau memakai harga yang tidak pernah disepakati, dan semuanya tetap terposting.

**Kontrol yang sekarang berlaku** (`backend/src/services/payables.service.ts`):

- Baris invoice merujuk `grn_lines`; `product_id` dan `po_item_id` dibaca dari baris penerimaan, bukan dari request, jadi invoice tidak bisa mengganti nama barang yang ditagihkan.
- `quantity_invoiced` per baris penerimaan dikunci `FOR UPDATE` dan diperbarui di bawah lock yang sama dengan pemeriksaannya, sehingga dua invoice yang berlomba pada satu penerimaan terserialisasi, bukan sama-sama lolos terhadap snapshot yang sama.
- Menagih melebihi yang diterima `409 OVER_BILLED_QUANTITY`; penerimaan vendor lain `409 VENDOR_MISMATCH`; baris tidak dikenal `404 GRN_LINE_NOT_FOUND`; total baris tidak sama dengan header `422 INVOICE_TOTAL_MISMATCH`.
- Selisih harga di luar toleransi `422 PRICE_VARIANCE_EXCEEDED`, dan hanya lewat bila ada alasan yang diotorisasi; otorisasi diambil dari user yang login, tidak boleh ditunjuk lewat body request.
- Toleransi dikonfigurasi di `accounting_settings` (persen atau nominal, mana yang lebih besar). Tanpa konfigurasi, toleransi nol — fail closed.

**Cacat akuntansi yang ikut diperbaiki:** posting lama mendebit GRNI sebesar nilai invoice, padahal GRNI dikredit saat penerimaan sebesar harga PO. Setiap kali keduanya berbeda, selisihnya mengendap di GRNI selamanya dan akun itu tidak akan pernah bisa direkonsiliasi. Sekarang GRNI dibersihkan tepat sebesar yang diakrualkan, selisihnya masuk `PURCHASE_PRICE_VARIANCE` (5600) sebagai baris jurnal tersendiri.

Invoice tanpa baris penerimaan — jasa, aset, pembelian non-inventory — tetap bisa diposting tetapi ditandai `match_status = 'unmatched'`, jadi liability yang tidak diperiksa terlihat, bukan menyamar sebagai yang sudah diperiksa.

**Acceptance:** `npm run test:three-way-match` — 20/20 pada database disposable, termasuk pembuktian bahwa invoice yang ditolak tidak meninggalkan payable, bahwa GRNI bersih tepat sebesar akrual, dan bahwa setiap jurnal yang ditulis balance.

**Belum tertutup dari FIN-E2E-P0-37:** retur/nota debit dan reversal invoice.

## Delta 25 Agustus 2026 — Retur pembelian dan retur penjualan

Menutup sisa **FIN-E2E-P0-37**. Sebelumnya retur tidak bisa dicatat sama sekali di kedua sisi: barang bergerak balik secara fisik dan tidak ada apa pun di sistem yang mengatakannya, sehingga stok salah, cost layer salah, dan saldo vendor/pelanggan bertahan pada angka yang kedua pihak sudah tidak menyetujuinya.

Retur **bukan penghapusan transaksi asal**. Penerimaan tetap terjadi, pengiriman tetap terjadi, dan keduanya menyimpan jurnalnya. Retur adalah event tersendiri dengan posting sendiri, jadi tidak ada yang perlu diedit setelah terjadi.

### Retur pembelian (`postPurchaseReturn`)

Ke mana nilainya pergi ditentukan oleh **apakah barang sudah ditagih**, dan itu bukan soal pendapat — baris penerimaan sudah mencatat persis berapa yang sudah ditagihkan:

| Kondisi | Posting |
|---|---|
| Belum ditagih | `Dr GRNI` `Cr Persediaan` — akrual dibalik |
| Sudah ditagih | `Dr Hutang Usaha` `Cr Persediaan` — nota debit |

Retur mengonsumsi kuantitas yang belum ditagih lebih dulu, karena itu yang benar-benar terjadi: barang ditolak sebelum ada yang menagihnya. Selisih antara nilai persediaan dan yang diakrualkan masuk `PURCHASE_PRICE_VARIANCE`.

Satu baris penerimaan bisa ditagih oleh beberapa invoice, jadi nota debit menyebut **payable mana** yang dikurangi lewat `purchase_return_ap_allocations`, dikonsumsi dari invoice terlama, masing-masing pada harga yang invoice itu benar-benar kenakan.

**Interaksi dengan 3-way match:** `grn_lines` sekarang membawa dua total, bukan satu — `quantity_returned` dan `quantity_returned_billed`. Barang yang dikembalikan sebelum ditagih **berhenti bisa ditagih**; tanpa pemisahan ini vendor tetap bebas menagih barang yang sudah kita kirim balik. Barang yang dikembalikan setelah ditagih tetap bisa ditagih, karena uangnya memang sudah terhutang dan kembali sebagai nota debit.

### Retur penjualan (`postSalesReturn`)

Barang dan uang ditangani terpisah, sengaja:

| Sisi | Posting |
|---|---|
| Barang, bila layak jual lagi | `Dr Persediaan FG` `Cr HPP` — ke lot asalnya, pada biaya layer itu |
| Barang rusak | tidak ada — barangnya memang hilang, biayanya tetap di HPP |
| Uang | `Dr Pendapatan` + `Dr PPN Keluaran` `Cr Piutang` — nota kredit |

Menulis barang rusak kembali ke persediaan akan melebih-lebihkan apa yang kita miliki, jadi `restocked = false` hanya menerbitkan nota kredit.

### Penolakan

`OVER_RETURN_QUANTITY` 409 (lebih dari yang diterima/dikirim), `VENDOR_MISMATCH` 409, `RETURN_ALREADY_PAID` 409 dan `CREDIT_NOTE_EXCEEDS_RECEIVABLE` 409 — uang yang sudah dibayar/diterima harus kembali sebagai refund, bukan nota debit/kredit.

**Acceptance:** `npm run test:returns` — 21/21 pada database disposable. Pembuktian terkuatnya: setelah kedua jenis retur dijalankan, `reconcileInventory` masih **balanced** — rak, valuasi, dan ledger tetap sepakat.

**Status FIN-E2E-P0-37:** match, variance, GRNI clearing, AP/AR subledger, dan retur dua sisi tertutup. Sisa: **reversal** dokumen yang sudah diposting.
