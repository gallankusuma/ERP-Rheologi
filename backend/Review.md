CRM re-review untuk commit `0f6e9a9` sudah dilakukan.

Perbaikan transaction Prospect→Lead dan Lead→Client→SO sudah valid dan merupakan kemajuan besar. Namun modul belum dapat di-sign-off karena masih terdapat blocker berikut:

1. Migration `007_crm_permissions.sql` tidak menambahkan kolom `is_archived` pada `leads` dan `prospects`. Tambahkan migration schema yang benar dan repeatable. Jangan mengandalkan ALTER TABLE saat route import.

2. State machine masih dapat dilewati:
   - generic Prospect PUT dapat mengatur status `converted` tanpa membuat Lead;
   - generic Lead PUT dapat mengubah stage tanpa transition validation;
   - Prospect conversion masih menerima status `new/contacted`;
   - Lead conversion dapat dilakukan dari stage apa pun.

3. Lead stages dapat dibuat, diubah nama, dan dihapus, tetapi transition map masih hardcoded menggunakan nama stage. Tetapkan fixed system stage key atau pindahkan transition ke database berbasis stage ID.

4. Terapkan `requirePermission` dan ownership check pada seluruh read/write Lead endpoint, termasuk list, detail, create, update, stage, assignment, checklist, labels, comments, activities, dan attachments. Terapkan juga `crm.prospects:view/update` pada Prospect.

5. Ownership Prospect menggunakan `user.roleId`, tetapi JWT hanya berisi `userId` dan `userLevel`. Load `role_id` dari database pada authentication context atau masukkan claim yang tervalidasi.

6. Jangan mencatat Prospect activity ke `lead_activities`. Buat `prospect_activities` dengan FK ke `prospects`; implementasi sekarang dapat gagal diam-diam atau mengaitkan activity ke Lead yang salah.

7. Filter `is_archived = 0` pada semua Lead list/stats dan sediakan restore workflow. Jangan menggunakan `Archived` sebagai stage bisnis.

8. Buat Prospect number generation benar-benar transactional. Tambahkan unique constraint dan retry handling untuk Prospect, Client, dan SO sequence.

9. Tambahkan automated integration tests untuk:
   - concurrent Prospect conversion;
   - concurrent Lead conversion;
   - failed Contact/SO creation rollback;
   - unauthorized and cross-owner access;
   - invalid status transition;
   - archive and restore;
   - duplicate Client handling.

Status review: **Changes Required — CRM belum Firm/Approved.**
