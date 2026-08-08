Team, revisi commit `6361bb4` sudah menutup mayoritas comment terakhir. Sample Request lifecycle sudah OK dan tidak perlu disentuh lagi.

Masih tersisa 2 targeted cleanup sebelum CRM freeze:

1. CRM Dashboard multi-currency

Prospect/Lead pipeline sudah menggunakan currency map dengan benar.

Namun Client Total Revenue masih melakukan raw SUM `sales_orders.total_amount` tanpa grouping currency, lalu frontend menampilkannya sebagai IDR.

Mohon ubah Client financial total menjadi grouped by currency, sama seperti Prospect/Lead.

Recent Activity juga sudah menerima field `currency` dari backend, tetapi frontend masih menggunakan:

`formatCurrency(item.value)`

ubah menjadi:

`formatCurrency(item.value, item.currency)`

Jangan ubah flow lain.

2. Client Due / Overview consistency

Filter `has_due` saat ini mengecek adanya active Sales Order. Itu bukan definisi outstanding/due yang sama dengan Client 360.

Gunakan canonical source yang sama dengan Client 360:

Invoices
→ Sales Payments
→ Outstanding = Invoice Total - Payments

Selain itu `/clients/dashboard` sekarang tidak lagi mengembalikan object `invoices`, sementara `ClientsManagement.vue` masih menampilkan `dashboard.invoices.unpaid / partial / overdue`.

Mohon restore invoice statistics dari canonical `invoices + sales_payments`, bukan dari legacy `client_invoices`.

Target akhir:

- Client List
- Client Overview
- Client 360
- CRM Dashboard

harus membaca sumber transaksi yang konsisten.

Tidak perlu refactor atau screening scope baru. Setelah dua poin ini selesai, lanjut final CRM E2E smoke test dan freeze module.
