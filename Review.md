Arah revisinya benar dan sangat dekat selesai, tapi belum gue kasih CRM FIRM/FREEZE karena tiga blocker lama ternyata baru sebagian tertutup.

P0 Multi-currency — backend sudah benar, frontend belum ikut. Backend sekarang sudah memisahkan pipeline_value_by_currency, won_value_by_currency, stage value per currency, dan monthly trend per currency. Tapi CrmDashboard.vue masih membaca field lama seperti data.prospects.pipeline_value, data.leads.pipeline_value, won_value, dan found.total_value, lalu semuanya diformat sebagai IDR. Jadi kontrak backend/frontend sekarang mismatch dan nilai dashboard berpotensi tampil Rp 0 atau salah. Ini tinggal frontend adjustment, bukan ubah backend lagi.
P1 Client canonical source — mayoritas sudah fix, tersisa dua titik. Client list sudah pakai sales_orders, dan Client dashboard sudah membuang client_invoices/client_orders serta hardcoded inProgress: 1. Itu bagus. Tetapi filter has_due masih memakai c.due_amount, yang merupakan kolom legacy/stale. Selain itu CRM Dashboard global masih menghitung total_revenue dan total_due langsung dari clients.total_invoiced/due_amount, bukan dari canonical invoices/payments. Jadi tinggal dua query itu yang harus diarahkan ke canonical Sales data.
P1 Sample Request — state machine sudah ada, tapi masih ada satu bypass. /status sekarang sudah bagus: Requested → In Progress → Ready for Delivery → Delivered → Feedback Received, plus Cancelled dari active states. Tetapi endpoint /feedback masih bisa langsung mengubah status menjadi Feedback Received tanpa memastikan current status adalah Delivered. Cukup tambahkan guard current.status === 'Delivered', atau gunakan validator transition yang sama.

Jadi statusnya sekarang:

Area Status
RBAC / Security ✅ FIRM / CLOSED
CRM Multi-currency backend ✅
CRM Multi-currency frontend ❌ P0 kecil
Client canonical migration 🟡 Hampir selesai
Sample Request lifecycle 🟡 Hampir selesai
New blocker Tidak ada
CI automated evidence ⚠️ Belum ada
