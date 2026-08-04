Untuk CRM, reliability scope yang harus dibereskan:

P0 — wajib
Tambahkan authentication dan permission pada seluruh endpoint Prospect.
Conversion Prospect → Lead harus berada dalam satu database transaction.
Jangan hapus Prospect setelah conversion; ubah menjadi converted agar histori funnel tetap ada.
Conversion Lead → Client → Contact → Sales Order harus atomic.
Tambahkan rollback jika pembuatan Client, Contact, atau Sales Order gagal.
Validasi bahwa user hanya dapat melihat atau mengubah Prospect/Lead sesuai ownership dan role.
P1 — sebelum sign-off
Tentukan clients sebagai customer master utama.
Hentikan duplikasi fungsi customers dan clients, atau jadikan customers compatibility layer sementara.
Buat aturan state transition Prospect dan Lead.
Stage Won tidak boleh sekadar drag-and-drop tanpa conversion validation.
Gunakan soft delete/archive untuk Prospect dan Lead.
Tambahkan duplicate detection berdasarkan perusahaan, email, nomor telepon, atau identifier bisnis.
Buat nomor Prospect, Client, dan Sales Order dengan sequence yang aman terhadap concurrency.
Tambahkan audit log untuk assignment, stage change, conversion, archive, dan creation Sales Order.
Validasi file attachment berdasarkan MIME type, extension, ukuran, dan authorization.
Reliability scenarios

Tim perlu membuktikan skenario berikut:

Create Prospect
→ Assign Salesperson
→ Follow-up
→ Qualify
→ Convert to Lead
→ Update Pipeline
→ Mark Won
→ Create/Link Client
→ Optional Sales Order

Kemudian test kegagalannya:

dua user convert Prospect yang sama bersamaan;
company yang sama sudah memiliki Client;
pembuatan Contact gagal;
Sales Order item tidak valid;
request conversion dikirim dua kali;
user tanpa permission mencoba conversion;
Lead dihapus setelah memiliki Sales Order;
perubahan stage dilakukan ke nilai tidak valid.
Definition of Done CRM

CRM baru gue tandai Firm / Approved kalau:

[ ] Tidak ada endpoint CRM sensitif tanpa auth
[ ] Permission matrix diterapkan backend
[ ] Prospect conversion atomic
[ ] Lead conversion atomic
[ ] Conversion dapat di-retry dengan aman
[ ] Histori Prospect tidak hilang
[ ] Clients menjadi source of truth
[ ] Stage transition tervalidasi
[ ] Delete memakai archive/soft delete
[ ] Audit log tersedia
[ ] Migration tersedia dan repeatable
[ ] E2E Prospect → Lead → Client → SO lulus
[ ] Semua P0/P1 ditutup

Hardcoded founder access kita pisahkan sebagai Accepted Owner Risk, sehingga tidak menghentikan review modul lain. Namun semua kontrol akses operasional CRM tetap wajib berfungsi.
