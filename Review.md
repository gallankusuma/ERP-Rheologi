Hasil yang dicatat tim dev bagus: WO id=28, tested SHA b38eca5, Production server, flow DRAFT → APPROVED → RELEASED → QC → Yield → COMPLETED → FG Receipt, plus beberapa negative gate berhasil.

Tapi gue belum kasih FIRM/FREEZE, karena ada satu gap runtime yang sangat spesifik.

Issue Material positive path ternyata belum PASS

Di dokumen tertulis:

Step 5 — Issue Material — PASS (stock guard enforced\*)

tetapi note-nya bilang actual request ditolak karena stock 0, requested 60.

Jadi sebenarnya yang terbukti adalah:

Insufficient Stock Guard = PASS ✅

bukan:

Successful Material Issue = PASS

Padahal positive smoke target kita adalah:

Generate Material
→ Issue Material sukses
→ RM inventory turun
→ production jalan.

Sekarang smoke lanjut ke IN_PROGRESS, QC, Yield, dan FG Receipt walaupun material issue tadi gagal. Itu boleh terjadi karena current Start WO memang soft-warning terhadap shortage, tetapi belum membuktikan transaksi material issue sukses end-to-end.

Ada gap kedua yang terkait: dokumen mencatat FG Receipt 85 berhasil, tetapi belum menunjukkan explicit reconciliation:

FG inventory before
→ receipt 85
→ FG inventory after = before + 85

Begitu juga belum ada explicit evidence:

RM inventory before
→ issue qty
→ RM inventory after = before - issue qty.

Jadi statusnya sekarang
Gate Status
Production code P0/P1 ✅ CLEAN
State machine runtime ✅ PASS
Approved BOM runtime ✅ PASS
QC pending → Complete rejection ✅ PASS
QC → Yield → Completed ✅ PASS
FG over-receipt rejection ✅ PASS
Duplicate FG receipt ✅ PASS
Production self-QC rejection ✅ PASS
Insufficient RM stock guard ✅ PASS
Successful RM Issue + stock deduction ⚠️ NOT PROVEN
FG inventory reconciliation ⚠️ NOT EXPLICITLY PROVEN

Jadi nggak perlu revisi business code lagi. Tim dev cukup rerun smoke dengan fixture stock yang cukup.

Misalnya:

RM stock before = 100
→ required issue 60
→ Issue Material 60 = 200
→ assert wo_material.quantity_issued = 60
→ assert RM inventory 100 → 40
→ assert stock movement OUT = 60.

Kemudian:

FG inventory before = X
→ Yield = 85
→ FG Receipt = 85
→ assert FG inventory X → X+85
→ assert stock movement IN = 85
→ retry same idempotency key = 400.

Kalau mau lebih solid, sekalian commit smoke_test.py atau raw smoke log ke repo; saat ini gue hanya menemukan referensi smoke_test.py di status document, bukan script-nya sendiri.

Satu catatan lain: GitHub connector masih tidak menampilkan commit status/workflow run untuk SHA yang diuji, jadi klaim CI green di dokumen belum bisa gue independently verify dari connector. Tapi itu bukan blocker utama sekarang karena kita sudah punya production runtime verification; yang kurang tinggal positive inventory transaction tadi.

Jadi verdict gue:

PRODUCTION CODE REVIEW = CLEAN ✅
PRODUCTION RUNTIME GATE = PARTIAL PASS ⚠️
FIRM/FREEZE = tinggal successful material issue + inventory reconciliation evidence
