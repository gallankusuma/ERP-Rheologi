Team, hasil review terakhir untuk revisi Roles & Permissions di commit `be834df` sudah jauh lebih baik dan secara arsitektur sudah sesuai arah yang kita mau.

Yang sudah dianggap benar:

- Access control tidak lagi bergantung pada `user_level`.
- Source of truth akses sekarang: User → Role → Role Permissions → Permission.
- Frontend menu/route guard sudah membaca permission user.
- Backend mutation sudah menggunakan permission resource/action.
- `edit` sudah distandardisasi menjadi `update`.
- Permission refresh melalui `/auth/me` sudah membantu sinkronisasi setelah perubahan role/permission.
- Perubahan RBAC terakhir tidak terlihat merusak core business flow CRM.

Untuk tahap ini, jangan lakukan refactor besar lagi pada Roles & Permissions. Fokus hanya pada hardening yang terarah.

Satu catatan yang masih perlu dibereskan:

Saat ini sebagian besar GET endpoint hanya menggunakan `authMiddleware`, sementara permission `view` lebih banyak ditegakkan di frontend.

Kita perlu membedakan dua tipe GET:

1. Business Data Endpoint
   Contoh:

- GET prospects
- GET prospect detail
- GET leads
- GET client detail
- GET CRM dashboard
- GET sales orders

Endpoint seperti ini seharusnya tetap enforce permission `resource.view` di backend.

2. Reference / Lookup Endpoint
   Contoh:

- dropdown user
- product lookup
- unit lookup
- client lookup
- category lookup
- reference data lintas modul

Endpoint lookup seperti ini boleh tetap `authMiddleware` saja jika memang dibutuhkan oleh modul lain.

Mohon jangan mengembalikan `requirePermission(view)` ke seluruh GET endpoint secara massal, karena pendekatan tersebut sebelumnya menyebabkan banyak reference data terkena 403 dan mengganggu workflow aplikasi.

Target implementasi:
`Business GET → require view permission`
`Reference GET → authenticated user`

Selain itu, mohon jangan mengubah lagi core RBAC kecuali ada bug nyata.

Untuk CRM, setelah perubahan security ini kita lanjutkan hanya dengan final functional smoke test:

Prospect
→ Lead
→ Proposal
→ Negotiation
→ Client
→ Sales Order dengan item
→ Client 360
→ CRM Dashboard

Tambahkan satu scenario Sample Request apabila memang termasuk flow CRM.

Jika flow tersebut berjalan normal tanpa regression, CRM bisa kita nyatakan Firm / Freeze dan lanjut ke final Manual Book v1.0.

Jadi prioritas sekarang:

1. Targeted backend view-permission hardening.
2. CRM final smoke test.
3. Jangan expand scope/refactor lagi di Roles & Permissions tanpa kebutuhan yang jelas.
