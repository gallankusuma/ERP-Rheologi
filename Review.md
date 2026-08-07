P0-1 — Convert Lead masih bisa membuat Sales Order kosong

Frontend masih menawarkan:

Convert Client + Create Draft Sales Order

tetapi request-nya hanya:

{ create_so: true }

tanpa so_items.

Backend langsung membuat header Sales Order, lalu item hanya dibuat kalau so_items tersedia.

Ini bertentangan dengan endpoint Sales Order normal yang mewajibkan minimal satu item.

Jadi sistem masih dapat menghasilkan:

SO-20260807-0001
Status: Draft
Total: nilai Lead
Items: 0

Menurut gue fix paling bersih:

Lead Convert → Client saja → redirect/prefill ke form Sales Order → user pilih item → Save SO.

Jangan create SO header otomatis sebelum ada item.

P0-2 — Multi-currency rusak saat Prospect → Lead → SO

Tim baru menambahkan currency IDR/USD pada Prospect. Itu bagus.

Tapi saat Prospect dikonversi ke Lead, currency tidak ikut dimasukkan ke tabel Lead.

Frontend Lead bahkan masih menyatakan semua Lead dianggap IDR:

currency: 'IDR'

secara formatting.

Lebih serius lagi, conversion Lead → Sales Order hardcode:

'draft', 'IDR'

Contoh:

Prospect value = USD 10,000
↓ convert
Lead value = 10,000 tetapi dianggap IDR
↓ convert
SO = IDR 10,000

Itu bukan sekadar UI issue—nilai bisnis berubah makna.

Harus ada:

prospects.currency
→ leads.currency
→ sales_orders.currency

dan formatter Lead membaca currency record masing-masing.

P0-3 — Client 360 belum memakai transaksi Sales sebagai source of truth

Client Detail masih membaca:

client_invoices
client_orders

Sedangkan modul Sales menggunakan:

sales_orders
invoices

Artinya Client 360 dapat mengatakan:

Orders = 0
Invoices = 0

padahal Sales module mempunyai SO dan Invoice nyata.

Ini harus disatukan.

Saran:

Client Master = clients

Client 360 Orders
→ sales_orders WHERE client_id = ?

Client 360 Invoices
→ canonical invoice/AR table

Client 360 Revenue
→ berasal dari transaksi Sales/Finance

client_orders dan client_invoices jangan menjadi transaksi paralel kalau fungsinya sama.

P1 — Masih perlu dirapikan
1. Create Lead masih dapat melompati state machine

Backend POST /leads masih menerima stage dari payload dan menyimpannya:

stage || 'New'

UI Add Lead juga masih menyediakan dropdown Stage.

Jadi user bisa create:

New Lead langsung → Proposal

tanpa pernah melewati Qualified/Discussion.

Kalau lifecycle harus ketat, Lead baru harus selalu New.

Kalau business memang mengizinkan opportunity existing masuk di stage tertentu, buat aturan eksplisit berdasarkan lead_type, jangan generic bebas.

2. CRM Dashboard belum memasukkan Proposal ke funnel visualization

Backend dashboard masih mengurutkan:

New
Qualified
Discussion
Negotiation
Won
Lost

belum memasukkan Proposal.

Frontend pipelineStages juga masih:

New
Qualified
Discussion
Negotiation
Won
Lost

Jadi Proposal sudah hidup di Kanban Lead tetapi hilang dari CRM Dashboard.

3. Proposal masih baru berupa stage, belum proposal workflow untuk New Business

Client area memang punya client_proposals, tetapi datanya berbasis client_id.

Untuk New Business:

Prospect
→ Lead
→ Proposal
→ Negotiation
→ Won
→ Client

Client belum ada saat Proposal dibuat.

Jadi kalau ERP memang harus membuat/track quotation/proposal sebelum deal menang, perlu:

Proposal
→ lead_id
→ status Draft/Sent/Accepted/Rejected/Expired
→ amount
→ validity
→ version
→ attachment/document

Kalau proposal memang dibuat di luar ERP dan stage hanya tracking, itu boleh—tapi harus diputuskan secara business requirement dan ditulis begitu di manual.

Verdict sekarang
CRM Area	Status
Prospect	✅ Firm
Prospect → Lead	✅ Firm
Lead Pipeline	✅ Hampir Firm
Proposal Stage	✅ Implemented
Lead collaboration	✅ Firm
Archive/Restore	✅ Firm
Lead → Client	✅ Flow reachable
Lead → Sales Order	❌ P0
Multi-currency	❌ P0
Client 360 transaction consistency	❌ P0
Dashboard pipeline	⚠️ P1