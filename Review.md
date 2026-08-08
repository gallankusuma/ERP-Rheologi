Team, mulai sekarang review aktif pindah ke **PPIC Module**.

Existing PPIC secara feature dan UI sudah cukup matang, jadi **jangan rebuild / redesign besar-besaran**. Pertahankan flow yang sudah ada:

Forecast → MPS → Capacity / Inventory Check → Production Plan → MRP → PR → Procurement

dan:

MPS Confirmed → Work Order → Production

Fokus revisi hanya pada blocker berikut.

## P0 — Release Blocker

### P0-1. MPS → MRP quantity source

MRP saat ini menghitung Gross Requirement dari `mps_week_data.fg_qty`.

Sedangkan production planning di MPS menggunakan dan menyimpan `production_qty`.

Akibatnya production plan yang sudah diisi dapat menghasilkan Gross Requirement MRP = 0 / salah.

Target:

`Gross Requirement = MPS production_qty × BOM quantity per unit`

Gunakan satu canonical production planning quantity secara konsisten di:

- MPS
- MRP per detail
- Standalone MRP
- WO generation

Jangan mempertahankan dua field dengan semantic production requirement yang berbeda tanpa definisi yang jelas.

---

### P0-2. MRP inventory & lead time

Standalone/per-detail MRP masih menggunakan:

- `first_stock = 0`
- `lead_time = 2 weeks`

sebagai default/hardcoded.

MRP harus menggunakan data aktual:

`Beginning Stock → Inventory`

dan lead time dari source procurement/vendor/material yang sudah tersedia jika memang ada.

Frontend juga sudah mengirim:

- `lead_time`
- `first_stock`
- `order_quantity`

dalam `materialSettings`, tetapi backend `/ppic/mrp` saat ini belum menyimpan setting tersebut.

Target:

MRP reload harus menghasilkan data yang sama dengan data yang disimpan.

Net Requirement harus dihitung menggunakan inventory actual, bukan selalu mulai dari 0.

---

### P0-3. SO / Project demand lineage

`Pull Orders` sudah mencoba mencegah duplicate berdasarkan `so_item_id` dan `project_id`.

Tetapi hasil grouping ke `mps_details` belum menjaga source lineage secara reliable.

Target:

Demand yang sudah masuk ke MPS tidak boleh dapat ditarik ulang ke MPS lain secara tidak sengaja.

Harus tetap dapat ditelusuri:

Sales Order / SO Item
→ MPS Detail

atau

Project
→ MPS Detail

Jika satu product berasal dari beberapa demand source, gunakan relation/detail source structure yang tetap mempertahankan semua reference. Jangan hanya menyimpan display string `so_numbers`.

---

### P0-4. MPS → Work Order API contract

Frontend MPS sudah menggunakan workflow:

- Generate WO Preview
- Generate selected weekly WO
- Sync WO
- Reset WO

Pastikan backend `/api/ppic` benar-benar menyediakan endpoint yang dipanggil frontend tersebut dan kontraknya sama.

Target flow:

Confirmed MPS
→ preview weekly production
→ select weeks
→ generate DRAFT WO per selected week
→ prevent duplicate WO
→ sync only DRAFT WO
→ reset only safe DRAFT WO

WO yang sudah Released / In Progress / Completed tidak boleh diam-diam diubah oleh MPS.

---

### P0-5. MRP → Purchase Request contract

Embedded MRP pada MPS dan Standalone MRP harus memakai backend contract yang jelas dan benar-benar tersedia.

Target:

MRP Net Requirement
→ Generate PR
→ PR Header
→ PR Items
→ Procurement

PR generation wajib:

- hanya qty > 0
- transactional / rollback jika item creation gagal
- tidak menghasilkan PR header kosong/partial tanpa explicit handling
- punya source reference ke MRP/MPS
- punya protection terhadap accidental duplicate generation

Jangan membuat dua implementasi Generate PR dengan business rule berbeda.

---

# P1 — Stabilization

### P1-1. Planning period / weekly horizon

12-week grid jangan selalu berdasarkan current week.

Forecast/MPS yang dibuat untuk period tertentu harus menghasilkan horizon berdasarkan planning period tersebut.

Contoh:

MPS October 2026

tidak boleh otomatis mulai dari week hari ini hanya karena user membukanya hari ini.

Gunakan period_year + period_month / planning start date sebagai basis.

---

### P1-2. Confirmed MPS backend lock

Saat status MPS = Confirmed:

backend harus menolak perubahan planning data melalui direct API.

Lock minimal:

- weekly data
- production qty
- demand adjustment
- buffer/remark planning fields
- remove item

Jika perlu revisi:

Confirmed → Revert to Draft → edit → Confirm kembali.

UI disable saja tidak cukup; backend harus enforce.

---

### P1-3. User identity consistency

Auth middleware memberikan:

`req.user.userId`

Pastikan PPIC tidak menggunakan:

`req.user.id`

untuk `created_by`, `confirmed_by`, WO creator, audit actor, dll.

Gunakan satu identity field secara konsisten.

---

### P1-4. Capacity calculation

MPS frontend menggunakan `line_process_id` untuk menghitung shared-machine capacity.

Pastikan backend MPS enrichment benar-benar mengirim:

- `line_process_id`
- line name
- capacity per hour
- weekly available capacity

Capacity untuk beberapa product yang memakai line yang sama harus dihitung sebagai shared load, bukan capacity per product.

---

### P1-5. Capacity Planning page

`CapacityPlanning.vue` saat ini masih menggunakan hardcoded/mock data.

Ganti dengan actual data dari:

MPS production plan

- Line Process capacity
- working calendar / available hours jika tersedia.

Jangan redesign UI; cukup connect ke real data.

---

### P1-6. PPIC Stock Reports

`StockReports.vue` saat ini masih mock data.

Connect ke actual:

Inventory
Work In Progress
Material usage
Finished Goods / production output

Jika financial valuation belum menjadi tanggung jawab PPIC/Finance, jangan fabricate value. Tampilkan hanya data yang source-nya valid.

---

## Rules selama revisi

1. Jangan redesign PPIC.
2. Jangan tambah module baru.
3. Jangan refactor security/RBAC kecuali ada direct regression.
4. Jangan mengubah Master Admin architecture.
5. Jangan menambah scope di luar P0/P1 di atas.
6. Existing Forecast/MPS/MRP UI dipertahankan sebisa mungkin.
7. Semua perubahan business-critical harus backend-enforced, bukan UI-only.
8. Gunakan transaction untuk operation lintas tabel yang harus atomic.
9. Generate PR/WO harus idempotent / duplicate-safe.
10. Pertahankan audit trail untuk action penting.

## Target E2E setelah revisi

Forecast
→ Weekly Forecast
→ Push MPS
→ Pull SO / Project Demand
→ Production Recommendation
→ Capacity Check
→ Confirm MPS
→ MRP BOM Explosion
→ Inventory Netting
→ Planned Requirement
→ Generate PR
→ Procurement receives PR

dan:

Confirmed MPS
→ Weekly WO Preview
→ Generate WO
→ Production receives correct product, BOM, qty, week, line & source reference.

Negative tests:

- edit Confirmed MPS → rejected
- pull same SO demand twice → no duplicate
- generate same WO twice → no duplicate
- generate same MRP requirement twice → duplicate protected
- PR item failure → no orphan/partial PR
- insufficient inventory → correct Net Requirement

Setelah revision selesai, jangan self-expand scope. Commit semua perubahan dan informasikan SHA terbaru untuk re-review.
