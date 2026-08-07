1. crm.prospects.manage belum terlihat di permission seed ⚠️

Prospect sekarang menggunakan:

checkUserPermission(user.userId, 'crm.prospects', 'manage')

untuk menentukan siapa boleh melihat/mengedit semua Prospect.

Tapi migration CRM yang gue cek hanya membuat:

view
create
update
delete
convert

tidak ada manage.

Jadi tim harus memastikan permission ini memang ada di DB:

crm.prospects.manage

dan diberikan minimal kepada role yang memang boleh melihat semua Prospect, misalnya Sales Manager/Admin sesuai konfigurasi perusahaan.

Kalau permission itu tidak ada, semua role akan dianggap bukan manage all dan terkena ownership filter.

Ini yang paling penting dicek dulu.

2. CRM Dashboard & Tasks masih auth-only

Sekarang masih:

router.get('/dashboard', authMiddleware, ...)
router.get('/tasks', authMiddleware, ...)

Padahal ini jelas business data.

Harusnya minimal:

/crm/dashboard
→ crm.dashboard.view

/crm/tasks
→ crm.tasks.view

Ini perbaikan kecil.

3. Client Management belum ikut hardening

clients.routes.ts sekarang masih:

GET /clients
GET /clients/dashboard
GET /clients/:id
→ authMiddleware saja

Mutation-nya sudah benar:

create → crm.clients.create
update → crm.clients.update
delete → crm.clients.delete

Tapi gue jangan sarankan langsung lock seluruh /clients, karena endpoint client kemungkinan juga dipakai dropdown lintas modul.

Lebih clean:

GET /clients
GET /clients/:id
GET /clients/dashboard
→ crm.clients.view

GET /clients/lookup
→ authMiddleware
→ hanya id, code, name

Jadi Sales/Lead/SO tetap bisa mengambil dropdown Client tanpa harus memiliki akses penuh ke Client Management.

Satu cleanup kecil tambahan

Di Leads, Stage Manager mutation masih cuma:

authMiddleware

misalnya reorder/update stage.

Karena pipeline stage adalah konfigurasi bisnis, paling sederhana kasih:

crm.leads.update

Tidak perlu bikin permission engine baru.

Verdict
Area Status
RBAC architecture ✅ Firm
Level tidak menentukan akses ✅ Firm
Business GET hardening ✅ Mayoritas selesai
Prospect ✅ kecuali verify manage
Lead reads ✅
Sample Request ✅
CRM Dashboard permission ⚠️ minor
Client Management view ⚠️ minor
Reference endpoint strategy ✅ Benar
CI automated evidence ⚠️ belum ada
