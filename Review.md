✅ 1. Approved BOM pin + Release guard — CLOSED

Manual WO sekarang hanya auto-pin BOM:

status = ACTIVE

- approval_status = 2

Saat transition ke RELEASED, backend juga sudah validate:

line process ada
bom_id ada
BOM benar-benar exists
BOM product = WO product
BOM ACTIVE
approval_status = 2

Generate Material juga sudah revalidate pinned BOM sebelum explosion.

Verdict BOM: ✅ CLEAN

✅ 2. Production MRP UOM — CLOSED

Query sudah berubah menjadi canonical:

LEFT JOIN uom u
ON p.unit_of_measure_id = u.id

Jadi typo p.uom_id sudah hilang.

Verdict MRP UOM: ✅ CLEAN

🔴 3. FG Receipt QC read-model — masih ada satu mismatch

Perbaikannya secara konsep sudah benar.

GET /production/fg-receipt sekarang membaca wo_qc_checkpoints, bukan lagi wo_results.qc_status.

Tetapi query GET menghitung:

SUM(
CASE WHEN status = 'failed'
THEN 1 ELSE 0 END
) AS any_failed

lalu:

kalau ada ANY failed checkpoint
→ qc_status = failed

Sedangkan POST /fg-receipt business gate hanya memblok:

mandatory checkpoint yang belum passed.

Jadi contoh:

Mandatory QC A = passed
Optional QC B = failed

Backend POST:

mandatory_not_passed = 0
→ FG Receipt ALLOWED

tetapi GET/UI:

any_failed > 0
→ qc_status = failed
→ Receive button HIDDEN

Jadi UI dan backend masih tidak memakai rule yang sama.

Fix-nya kecil banget

Karena canonical business rule kita selama ini adalah mandatory QC gate, jangan ubah POST.

Ubah GET aggregation dari:

SUM(
CASE WHEN status = 'failed'
THEN 1 ELSE 0 END
) AS any_failed

menjadi misalnya:

SUM(
CASE
WHEN is_mandatory = 1
AND status = 'failed'
THEN 1
ELSE 0
END
) AS mandatory_failed

Lalu derive:

qc_total == 0
→ pending

mandatory_failed > 0
→ failed

mandatory_not_passed > 0
→ pending

else
→ passed

Dengan begitu GET UI dan POST transaction gate menggunakan exact business rule yang sama.

Jadi status sekarang:

Pinned Approved BOM = ✅ CLOSED
MRP UOM = ✅ CLOSED
FG Receipt QC derive = ⚠️ 1 residual

P0 = 1
P1 = 0

Gue nggak buka scope baru lagi. Cuma fix satu predicate QC itu.

Setelah itu masuk, gue cek titik tersebut sekali lagi. Kalau sesuai:

PRODUCTION CODE REVIEW = CONDITIONALLY CLEAN / TEST GATE REQUIRED ✅

Lalu kita langsung masuk Production runtime smoke:

PPIC WO → APPROVED → RELEASED → Generate Material → Issue Material → IN_PROGRESS → QC → Yield → COMPLETED → FG Receipt → Inventory
