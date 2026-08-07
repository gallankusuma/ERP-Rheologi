Untuk implementasi Roles & Permissions, mohon gunakan prinsip berikut sebagai final design:

`user_level` atau `role.level` TIDAK menentukan hak akses aplikasi.

Seluruh hak akses user harus berasal dari:

User → Role → Role Permissions → Permission (resource + action)

Dengan demikian:

1. Hapus penggunaan `userLevel` / `user_level` sebagai bypass pada authorization middleware.

2. Hapus penggunaan `user_level` sebagai bypass pada frontend `hasPermission` dan router/menu guard.

3. Role biasa maupun Administrator memperoleh akses berdasarkan permission yang diberikan melalui Roles & Permissions.

4. `user_level` boleh tetap disimpan sebagai metadata/hierarki organisasi apabila diperlukan, tetapi tidak boleh digunakan untuk menentukan boleh/tidaknya membuka menu atau menjalankan API.

5. Standardisasi action permission:
   - view
   - create
   - update
   - delete
   - approve
   - approve_1
   - approve_2
   - convert
   - manage
   - export

6. Jangan menggunakan `edit` dan `update` sebagai dua action berbeda. Gunakan `update` sebagai canonical action.

7. Menu visibility, frontend route guard, dan backend mutation authorization harus membaca resource/action yang sama dari Roles & Permissions.

8. Audit seluruh penggunaan `userLevel` pada backend/frontend. Bila dipakai untuk authorization atau menu access, pindahkan ke permission yang sesuai.

Target akhir:

`Role Permissions` menjadi satu-satunya source of truth untuk akses user terhadap menu dan action aplikasi.
