Team,

Saya sudah melakukan review terhadap integrasi modul Production, Inventory, PPIC, dan QC di branch `main`.

Secara flow, modul sudah mencakup Planning → MRP → Work Order → Material Issue → Production Execution → QC → Yield/Scrap → FG Receipt → Production History. Namun, implementasi saat ini belum aman untuk dinyatakan production-ready dan belum disarankan digunakan untuk transaksi operasional nyata.

## P0 — Blocking Security Issues

2. Hapus seluruh file credential dan backup dari repository, termasuk `CREDENTIALS.txt`, backup ZIP, database dump, dan binlog.
3. Rotate seluruh password, JWT secret, database credential, API key, dan deployment credential yang pernah tersimpan dalam repository.
4. Rewrite Git history karena menghapus file melalui commit biasa tidak menghilangkan credential dari history.
5. Tambahkan secret scanning pada CI dan pre-commit hook.

## P0 — Transaction and Inventory Integrity

1. Material issue harus dijalankan dalam satu database transaction:
   - lock inventory row;
   - validate available stock;
   - create issue transaction;
   - update WO material issued quantity;
   - update stock balance;
   - commit atau rollback seluruh proses.

2. Sistem tidak boleh mengizinkan stock balance negatif.

3. FG receipt harus dijalankan dalam transaction dan wajib memvalidasi:
   - WO sudah completed;
   - mandatory QC sudah passed;
   - batch sudah approved/released;
   - total receipt tidak melebihi recorded output;
   - request bersifat idempotent agar double-click atau retry tidak menggandakan stok.

## P1 — Manufacturing Logic

1. Terapkan WO state machine yang konsisten:
   `draft → approved → released → in_progress → on_hold → completed → closed`.

2. Start WO hanya boleh dilakukan jika:
   - BOM version sudah dikunci;
   - WO sudah approved/released;
   - line process sudah dipilih;
   - material availability sudah tervalidasi;
   - required QC checkpoints sudah dibuat.

3. Complete WO hanya boleh dilakukan jika:
   - seluruh mandatory process selesai;
   - mandatory QC passed;
   - yield dan scrap sudah direkam;
   - material reconciliation sudah selesai.

4. Jangan hard-delete WO yang sudah memiliki transaksi. Gunakan cancellation/void workflow dan audit trail.

## P1 — MRP and Traceability

1. Perbaiki query MRP karena inventory saat ini dapat terduplikasi untuk material yang mempunyai stok di beberapa warehouse.
2. Definisikan apakah availability menggunakan satu warehouse produksi atau gabungan warehouse.
3. Pisahkan on-hand, reserved, allocated, issued, incoming PO, dan available-to-promise.
4. Tambahkan recursive BOM explosion atau nyatakan dengan jelas bahwa implementasi hanya mendukung single-level BOM.
5. Buat tabel transaksi `wo_material_issues`. Satu WO material harus dapat menggunakan beberapa batch/lot dan beberapa partial issue.
6. Setiap issue harus menyimpan warehouse, location, batch, quantity, operator, timestamp, dan reversal reference.

## P1 — Schema and Migration

1. Satukan seluruh perubahan database dalam versioned migration.
2. Normalisasi status menjadi satu format dan satu vocabulary.
3. Ubah `actual_start` dan `actual_end` dari `DATE` menjadi `DATETIME` atau `TIMESTAMP`.
4. Pastikan clean database dapat dibangun hanya dengan menjalankan migration resmi.
5. Hilangkan SQL check/fix ad-hoc dari repository utama atau pindahkan ke folder maintenance yang terdokumentasi.

## P1 — Authorization

Tambahkan permission middleware untuk minimal:

- create/update/release WO;
- start, pause, resume, dan complete production;
- issue dan reverse material;
- record yield;
- receive finished goods;
- trigger/approve QC;
- cancel atau delete transaksi.

Authentication saja tidak cukup untuk transaksi produksi dan inventory.

## Acceptance Criteria

Perubahan dapat dinyatakan siap diuji ketika:

- tidak ada credential atau secret di repository dan history;
- database baru dapat dibuat dari migration tanpa manual SQL;
- stock tidak dapat negatif;
- issue dan receipt rollback sepenuhnya saat terjadi error;
- material consumption dapat ditelusuri sampai lot bahan baku;
- FG receipt tidak dapat melebihi output yang disetujui;
- batch tidak dapat released sebelum QC approval;
- seluruh WO state transition tervalidasi;
- tersedia automated integration test untuk satu complete production cycle;
- build, lint, migration, dan test wajib lolos di CI.

Status review: **Changes required — do not go live before P0 items are resolved.**
