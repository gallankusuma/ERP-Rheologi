🔴 1. Forecast → MPS masih bisa salah period

Weekly forecast sudah period-based, tetapi ketika Push to MPS tidak menemukan Draft MPS pada period yang sama, backend masih fallback ke:

latest Draft MPS

Jadi misalnya:

Forecast October 2026
→ tidak ada MPS October
→ ada MPS August Draft
→ forecast October bisa masuk ke MPS August.

Itu salah secara planning period.

Monthly lebih berat lagi. UI Monthly adalah Yearly Jan–Dec, lalu tombol Push to MPS mengirim hanya { year }. Backend kemudian mengambil satu latest Draft MPS dan mendistribusikan semua monthly forecast tahun tersebut ke MPS itu.

Target fix:

Forecast YYYY-MM → MPS YYYY-MM

exact period only, tidak boleh fallback ke MPS period lain.

Untuk Monthly push, harus pilih/resolve bulan tertentu, bukan seluruh tahun dimasukkan ke satu MPS.

🔴 2. Forecast + Sales Order untuk product yang sama belum merge

Ini penting banget.

Flow normal kita bisa:

Forecast Product A
→ Push to MPS
→ MPS Detail Product A sudah ada

lalu:

Sales Order Product A
→ Pull Orders

Tapi pull-orders sekarang mengambil daftar product yang sudah ada di MPS, lalu membuang semua incoming demand dengan product_id tersebut:

newItems = allItems.filter(product belum ada di MPS)

Artinya SO nyata untuk Product A bisa tidak pernah masuk ke so_qty hanya karena Forecast Product A sudah lebih dulu membuat detail.

Padahal MPS frontend memang didesain punya dua row:

forecast_qty
dan
so_qty

dan planning demand memilih max(SO, Forecast) untuk menghindari double count.

Jadi fix yang benar:

jangan skip berdasarkan product existing.

Kalau product sudah ada:

pakai existing mps_detail
insert lineage SO/Project ke mps_detail_sources
update/add so_qty pada week yang sesuai.

Kalau product belum ada:

baru create mps_detail.

Duplicate prevention tetap berdasarkan SO item/project source ID, bukan berdasarkan product ID.

🔴 3. MRP → PR → Procurement masih beda canonical item source

MRP Generate PR sekarang secara database bagus:

purchase_requests

- purchase_request_items

dan transactional.

Masalahnya Procurement existing masih menggunakan format lama:

purchase_requests.notes = JSON { items:[...] }

PR detail frontend menjalankan parseNotes(pr.notes) dan mengambil parsed.items. Kalau notes bukan JSON, items menjadi kosong.

Bidding backend juga parse:

JSON.parse(pr.notes)
→ notesData.items

untuk membuat bid items. Jadi PR dari MRP yang item-nya hanya masuk purchase_request_items bisa menghasilkan header PR tetapi Procurement melihat/bidding tanpa material items.

Target fix:

purchase_request_items harus menjadi canonical item source.

Untuk PR detail/bidding:

load purchase_request_items
join products + UOM
expose sebagai items ke frontend.

Kalau masih perlu support PR lama yang item-nya JSON di notes, boleh fallback untuk backward compatibility:

purchase_request_items → primary
notes.items → fallback legacy

Jangan sebaliknya.

Yang sekarang gue anggap sudah benar:

Flow Status
Forecast period grid ✅
MPS period grid ✅
SO/Project source lineage structure ✅
production_qty → MRP ✅
BOM explosion ✅
Inventory netting ✅
MRP material settings persistence ✅
MRP PR transaction ✅
PR duplicate protection ✅
Confirmed MPS lock ✅
Capacity actual data ✅
Stock Report actual data ✅
Selected-week WO ✅
WO duplicate protection ✅
WO line mapping ✅
Missing production line guard ✅
WO UOM preview ✅
WO → Production state machine ✅

Untuk WO → Production, flow yang benar adalah:

MPS Confirmed
→ Generate DRAFT WO
→ Approved
→ Released
→ In Progress
→ Completed
→ Closed

Production state machine memang menormalisasi DRAFT uppercase sehingga PPIC-generated WO aman, dan released/in_progress membutuhkan line process.

Jadi gue koreksi smoke test kita: bukan Draft → Released langsung, tetapi:

DRAFT → APPROVED → RELEASED → IN_PROGRESS.

Verdict

PPIC core calculation: ✅ CLEAN
WO → Production: ✅ CLEAN
Forecast → MPS: ❌ integration blocker
SO demand merge into forecasted product: ❌ integration blocker
MRP PR → Procurement item handoff: ❌ integration blocker

Jadi kali ini gue memang belum mau bilang freeze, bro. Tiga ini bukan scope tambahan; ini gue temukan karena lo minta gue make sure flow-nya benar end-to-end, dan kalau dilewatkan sistem bisa kelihatan sukses di UI tetapi planning/procurement datanya salah.

Tim cukup perbaiki 3 kelompok ini saja. Setelah revisi, gue re-check hanya 3 ini, lalu final smoke:

Monthly/Weekly Forecast → exact-period MPS → SO merge → Production Qty → MRP → PR → Procurement sees same materials

dan:

Confirmed MPS → WO → Approved → Released → In Progress.
