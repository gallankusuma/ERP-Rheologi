Yang paling parah: Production Planning sekarang seolah-olah sudah bisa membedakan WO dari MPS vs Manual, padahal backend-nya tidak memberikan data sumber tersebut.

Frontend punya filter:

All WOs | From MPS Only | Manual Only

dan badge-nya memakai:

wo.mps_number ? MPS : Manual.

Tapi endpoint yang dipakai halaman itu, /production/planning/weekly, tidak SELECT mps_detail_id, tidak JOIN mps_details, tidak JOIN mps_headers, dan tidak return mps_number sama sekali.

Artinya secara actual:

WO yang benar-benar berasal dari MPS pun bisa ditampilkan sebagai “Manual”.

Jadi concern lo valid. Itu bukan sekadar kurang informasi di UI — contract backend ↔ frontend memang mismatch.

Gue trace sumber pembentukan WO sekarang

Ada minimal dua jalur resmi:

PPIC MPS → Generate WO.
Jalur ini sebenarnya bagus secara data lineage. Saat WO dibuat, backend menyimpan mps_detail_id, week_number, created_by, dan notes MPS <number> W<week>.

Artinya secara database sebenarnya kita bisa trace:

WO → MPS Detail → MPS Header → Demand Source → SO / Project / Forecast.

Production → Work Orders → “Buat WO Manual”.
UI memang secara eksplisit menyediakan tombol Buat WO Manual.

Tapi backend manual-create cuma insert:

wo_number, product_id, bom_id, quantity, status, priority, scheduled_start/end, line_process_id

Tidak menyimpan:
source_type, source_reference, source_reason, bahkan created_by tidak ikut di INSERT.

Lebih parah lagi, frontend mengirim notes, tetapi POST backend tidak mengambil notes, sehingga alasan WO manual juga hilang.

Nah, ini sumber masalah sebenarnya bro.

Kita punya WO yang kaya lineage kalau dibuat MPS, dan WO yang hampir orphan secara business provenance kalau dibuat manual.

Kenapa Production Planning terlihat penuh banget?

Ada masalah kedua.

Query /production/planning/weekly secara eksplisit diberi comment:

“Fetch all WOs (not just active)”

dan memang tidak memfilter status operasional. Selama scheduled/actual date jatuh di bulan tersebut, WO draft, released, completed, closed, bahkan cancelled berpotensi ikut tampil. Ditambah lagi semua in_progress ikut diambil walaupun berasal dari periode lain.

Jadi halaman yang seharusnya menjadi operational production schedule bercampur antara:

current executable WO + completed WO + cancelled/closed historical WO + manual WO + MPS WO.

Wajar ketika lo buka terlihat seperti banyak WO “entah dari mana”.

Dan problem yang sama ada di menu Work Orders. Frontend mau menampilkan mps_number, tetapi backend /workorders hanya mengambil w.\* + product + line; tidak melakukan join ke MPS header.

Jadi ini bukan masalah satu halaman.

Yang gue mau minta development sekarang

P0 — Work Order Provenance / Source-of-Truth

Before continuing cross-module stabilization, make every Work Order traceable to its business origin.

Current Production Planning UI attempts to classify WOs as MPS vs Manual using mps_number, but /production/planning/weekly does not return any MPS provenance. Therefore the current MPS/Manual classification is not reliable.

Required canonical behavior:

MPS-generated WO

WO → MPS Detail → MPS Header → Demand Sources → SO / Project / Forecast

Production Planning and Work Orders APIs must return at minimum:

source_type
mps_detail_id
mps_number
mps_week_number
demand_sources[]

Demand source should expose document references such as:

SO-xxxx / Customer
Project-xxxx
Forecast-xxxx

Do not derive MPS provenance from WO notes. Use relational linkage.

Manual WO

Manual creation remains allowed only as an explicit exception.

Persist:

source_type = MANUAL
source_reason — required
created_by — required
created_at

A manually created WO without a reason must be rejected.

Existing WO records with mps_detail_id IS NULL and no deterministic upstream relation must be classified as:

LEGACY_UNKNOWN

Do not silently label them Manual because provenance is not proven.

Production Planning

Default operational view should not mix historical/cancelled WOs into the active planning board.

Default:

DRAFT / APPROVED / RELEASED / IN_PROGRESS / ON_HOLD

Historical statuses:

COMPLETED / CLOSED / CANCELLED

should be accessible through a separate status filter/history view.

Clicking a WO must expose a Source / Demand Trace, for example:

WO-20260812-012
→ MPS-2026-08
→ W33
→ SO-2026-0812-004
→ Customer ABC
→ Demand 5,000 KG

Acceptance condition:

For every WO displayed in Production Planning, reviewer must be able to answer:

Why does this WO exist?

Who/what created it?

Which demand document caused it?

Which MPS period/week owns it?

If any of these cannot be answered, that WO provenance is not accepted.

Dan gue nemu pola yang sama mulai muncul di MRP → PR. PR hasil MRP sekarang insert header/item dan source-nya pada dasarnya cuma text seperti "MRP Net Req" di notes. Itu berarti setelah masuk Procurement, kita bisa punya PR yang tahu “ini dari MRP”, tetapi belum tentu tahu MRP untuk MPS/SO/Forecast mana. PO memang punya pr_id, dan GRN punya po_id, jadi chain bagian hilir cukup bagus. Tapi chain awalnya masih putus.

Jadi review lens gue sekarang gue ubah:

Demand → Planning → Execution → Procurement → Inventory

tidak cukup cuma “angkanya nyambung”.

Setiap document wajib punya lineage yang bisa diklik balik.

Contohnya:

WO
WO → MPS → SO/Forecast/Project

PR
PR Item → MRP Requirement → MPS → WO/Demand

PO
PO → PR → MRP → MPS/Demand

GRN
GRN → PO → PR → demand

Stock
Stock Movement → GRN / WO Issue / FG Receipt / Transfer

Nah bro, ini level ketajaman yang menurut gue lebih cocok sama yang lo cari. Kalau di layar ada 50 WO, kita bukan cuma cek “50 WO muncul dengan benar”; kita harus bisa audit kenapa ada 50, siapa pembuatnya, demand-nya berapa, dan apakah seharusnya memang ada 50.
