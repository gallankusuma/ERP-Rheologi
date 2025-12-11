📄 ERP Manufacturing & Distribution Specification
Version 1.0 — Biochemical Small Enterprise ERP
Author: Mismerak (Gallan)
Last Updated: {{ auto today }}
#️⃣ 1. Company Overview
Company Size: Small (20–80 employees)
Industry: Biochemical Manufacturing, Distribution, Sales
Core Business Processes:

Production (Batch-based biochemical products)

Warehouse & Distribution

Procurement

Sales (B2B / Distributor Model)

Key Compliance Needs:

Batch Lot Traceability

QC/QA Documentation

Production Logs

Material Cost & Yield Control

#️⃣ 2. ERP System Objectives
ERP ini dibangun untuk:

Menyatukan seluruh proses bisnis dalam satu platform

Mengurangi input manual / spreadsheet

Memenuhi traceability batch dari RM → WIP → FG

Mempercepat alur approval dan dokumentasi

Menyediakan dashboard KPI bagi plant management

Mempersiapkan scale-up process ke medium company

#️⃣ 3. Technology Stack (Preferred)
Layer	Technology
Backend	Laravel 11 / Node.js (NestJS)
Frontend	React.js / Livewire 3
Database	MySQL / MariaDB
Authentication	JWT + RBAC
Infrastructure	Docker-ready engine
Integration	REST API + Webhooks
CI/CD	GitHub Actions (optional)

Copilot boleh memberikan alternatif dengan argumentasi.

#️⃣ 4. Core ERP Modules
## 4.1 Product Management
Features
Product Master

Product Categories

UoM (Unit of Measure)

Packaging options

Material Safety Data (optional)

Bill of Materials (BOM)
Multi-level structure

Raw materials + active biochemical content

Packaging BOM

Versioning support

Standard & actual material cost

## 4.2 Inventory & Warehouse
Features
Multi-Warehouse support

Warehouse Location (Rack → Row → Bin optional)

Stock Card Movement

FIFO / FEFO

Real-time stock

Stock Transactions
Material Receipt (GRN)

Material Issue to Production

Transfer Warehouse

Stock Adjustment

Stock Opname

Traceability
Batch/Lot number auto generation

RM → WIP → FG mapping

## 4.3 Procurement
Flow
PR → PO → Approval → GRN → Invoice (optional AP)

Features
Vendor Master

Purchase Request (PR)

Purchase Order (PO)

PO Approval Routing

GRN linked to PO

Price History

Lead Time Monitoring

## 4.4 Production / Manufacturing
A. Production Planning (MRP-lite)
Check RM availability

Work Order creation

Routing / Work Center
-Machine requirement per process

Operator assignment

B. Shopfloor Execution
Issue RM

Batch number creation

Process logs:

Mixing

Reaction

Heating/Cooling

Dilution

QC Testing

Packaging

C. Data Recording
Actual material usage

Output yield (KG / Litre)

Loss/waste %

QC results

Batch Release Approval

## 4.5 Sales & Distribution
Features
Customer Master

Sales Order

Price List

Delivery Order & Shipment

Stock deduction from FG warehouse

Sales Invoice

Basic AR monitoring

## 4.6 Finance (Simplified)
Features
COGS per batch (based on actual usage)

PO → AP

Shipment → AR

Profitability per product

Monthly Cost Summary

Note: No full accounting ledger, only operational finance.

## 4.7 Human Resources (Lite)
Features
Employee database

Departments & Role

Shift schedule

Attendance log (manual or integrated)

Overtime form + approval

## 4.8 System Administration
Features
Users & Roles (RBAC)

Permission Matrix

Approval Rules Engine

Audit Log per action

Notification Center

Dashboard KPI

KPI Ideas
Production Plan vs Actual

RM Stock Aging

Material Consumption Variance

Sales Performance

Outstanding Approvals

#️⃣ 5. Data Model Requirements
Copilot harus menghasilkan ERD dengan tabel berikut:

Master
products

product_categories

uom

BOM
bom_headers

bom_details

Warehouse
warehouses

warehouse_locations

inventory_stocks

stock_movements

Procurement
vendors

purchase_requests

purchase_orders

purchase_order_items

goods_receipts

Production
work_orders

wo_materials

wo_process_logs

wo_results

batches

QC
qc_tests

qc_results

Sales
customers

sales_orders

so_items

deliveries

invoices

System
users

roles

permissions

approval_rules

audit_log

#️⃣ 6. Critical Business Rules
No WO can start if RM availability < requirement.

Every batch must have complete RM → WIP → FG traceability.

QC must approve before shipment is allowed.

FIFO/FEFO enforced on all stock movements.

Actual RM usage must update batch COGS.

Approval flow must be dynamic per department.

#️⃣ 7. Required Output From Copilot
Copilot diminta menghasilkan:

A. Application Blueprint
Suggested architecture

Modular folder structure

Sequence diagrams

B. Database Schema
SQL migration files

Seeder templates

ERD diagram

C. Backend Code
Models

Controllers

Request validators

Service layer

Repository pattern

API Endpoints

D. Frontend
Page layout structure

CRUD components (React / Livewire)

Table, form, modal scaffolding

E. Documentation
API documentation

Permission matrix

Approval flow documentation

F. DevOps (Optional)
Docker compose

GitHub Actions pipeline

Environment variables template

#️⃣ 8. Final Instruction to Copilot
“Generate the ERP architecture, schema, and initial codebase based on all specifications above. If any detail is ambiguous, propose 2–3 options with pros & cons. Prioritize modularity, manufacturing flow accuracy, and full traceability.”

#️⃣ 9. Appendix (Optional Enhancements)
Future modules (not mandatory now):
Asset Management

Maintenance (Preventive / Breakdown)

CRM

Accounting Ledger

Lab QC Advanced

Regulatory Document Management

🔥 File .md ini sudah siap dipakai.
Mau gue buatin juga:
✅ ERD Diagram (gambar PNG / Mermaid)
✅ User Story lengkap versi Agile
✅ Folder structure Laravel / NestJS
✅ Prompt khusus untuk generate code awal

Mau lanjut yang mana bro?






You said:
lanjut semuanya secara berurut bro



ChatGPT said:

Thought for 29s
Gaskeun bro, kita lanjut semua, berurutan dan dalam format .md yang siap lo taruh di repo.
Gue bagi jadi 4 file biar rapi:

ERD (Mermaid)

User Stories (Agile)

Folder Structure (Laravel 11 + Livewire)

Prompt Bootstrap untuk Copilot (generate code awal)

1️⃣ ERD – docs/requirements/erp-erd.md
markdown
Copy code
# ERP Manufacturing & Distribution – ERD (Biochemical)

## Overview

Dokumen ini mendefinisikan Entity Relationship Diagram (ERD) untuk ERP manufaktur & distribusi berbasis batch untuk produk biochemical.

Gunakan diagram ini sebagai dasar pembuatan:
- Database migrations
- Eloquent models / Entities
- Repository / Service layer

## Mermaid ERD

```mermaid
erDiagram

    PRODUCT_CATEGORY ||--o{ PRODUCT : "has many"
    UOM ||--o{ PRODUCT : "default uom"
    UOM ||--o{ BOM_DETAIL : "component uom"

    PRODUCT {
        bigint id PK
        string sku
        string name
        bigint product_category_id FK
        bigint uom_id FK
        string type  // FG, RM, PKG
        decimal standard_cost
        boolean is_active
    }

    PRODUCT_CATEGORY {
        bigint id PK
        string name
        string code
    }

    UOM {
        bigint id PK
        string name
        string symbol
        decimal conversion_factor
    }

    BOM_HEADER ||--o{ BOM_DETAIL : "has many"
    PRODUCT ||--o{ BOM_HEADER : "has bom"

    BOM_HEADER {
        bigint id PK
        bigint product_id FK
        string version
        boolean is_active
        text notes
    }

    BOM_DETAIL {
        bigint id PK
        bigint bom_header_id FK
        bigint component_product_id FK
        bigint uom_id FK
        decimal qty_per_batch
        boolean is_active
    }

    WAREHOUSE ||--o{ WAREHOUSE_LOCATION : "has many"
    WAREHOUSE_LOCATION ||--o{ INVENTORY_STOCK : "has many"
    PRODUCT ||--o{ INVENTORY_STOCK : "has many"
    BATCH ||--o{ INVENTORY_STOCK : "per batch"

    WAREHOUSE {
        bigint id PK
        string code
        string name
        string type   // RM, FG, PKG, MIX
    }

    WAREHOUSE_LOCATION {
        bigint id PK
        bigint warehouse_id FK
        string code
        string description
    }

    INVENTORY_STOCK {
        bigint id PK
        bigint product_id FK
        bigint warehouse_location_id FK
        bigint batch_id FK
        decimal qty_on_hand
        decimal qty_reserved
    }

    STOCK_MOVEMENT {
        bigint id PK
        bigint product_id FK
        bigint batch_id FK
        bigint from_location_id FK
        bigint to_location_id FK
        string type // GRN, ISSUE, TRANSFER, ADJ, SALE
        decimal qty
        datetime movement_date
        string reference_type // PO, WO, SO, DO, ADJ
        bigint reference_id
    }

    VENDOR ||--o{ PURCHASE_ORDER : "supplies"
    PURCHASE_ORDER ||--o{ PURCHASE_ORDER_ITEM : "has items"
    PURCHASE_ORDER ||--o{ GOODS_RECEIPT : "receives"
    GOODS_RECEIPT ||--o{ STOCK_MOVEMENT : "generates"

    VENDOR {
        bigint id PK
        string code
        string name
        string contact_person
        string email
        string phone
        string tax_id
        boolean is_active
    }

    PURCHASE_REQUEST {
        bigint id PK
        string pr_number
        bigint requested_by_user_id FK
        datetime requested_at
        string status // DRAFT, PENDING, APPROVED, REJECTED
    }

    PURCHASE_ORDER {
        bigint id PK
        string po_number
        bigint vendor_id FK
        datetime po_date
        string status // DRAFT, OPEN, PARTIAL, CLOSED, CANCELLED
        decimal total_amount
    }

    PURCHASE_ORDER_ITEM {
        bigint id PK
        bigint purchase_order_id FK
        bigint product_id FK
        decimal qty
        decimal unit_price
        decimal line_total
    }

    GOODS_RECEIPT {
        bigint id PK
        string grn_number
        bigint purchase_order_id FK
        datetime receipt_date
        string status // DRAFT, POSTED
    }

    WORK_ORDER ||--o{ WO_MATERIAL : "requires"
    WORK_ORDER ||--o{ WO_PROCESS_LOG : "has logs"
    WORK_ORDER ||--o{ WO_RESULT : "outputs"
    WORK_ORDER ||--o{ BATCH : "creates"

    WORK_ORDER {
        bigint id PK
        string wo_number
        bigint product_id FK
        decimal planned_qty
        datetime scheduled_start
        datetime scheduled_end
        string status // PLANNED, RELEASED, IN_PROGRESS, QC, CLOSED, CANCELLED
    }

    WO_MATERIAL {
        bigint id PK
        bigint work_order_id FK
        bigint product_id FK
        decimal planned_qty
        decimal actual_qty
    }

    WO_PROCESS_LOG {
        bigint id PK
        bigint work_order_id FK
        string step_name
        datetime started_at
        datetime finished_at
        text notes
    }

    WO_RESULT {
        bigint id PK
        bigint work_order_id FK
        bigint product_id FK
        bigint batch_id FK
        decimal qty_output
        decimal qty_scrap
    }

    BATCH ||--o{ QC_RESULT : "tested"
    PRODUCT ||--o{ BATCH : "has batches"

    BATCH {
        bigint id PK
        string batch_number
        bigint product_id FK
        datetime mfg_date
        datetime exp_date
        string status // OPEN, UNDER_QC, RELEASED, BLOCKED
    }

    QC_TEST ||--o{ QC_RESULT : "definition"

    QC_TEST {
        bigint id PK
        string code
        string name
        string method
        string unit
        decimal min_value
        decimal max_value
    }

    QC_RESULT {
        bigint id PK
        bigint batch_id FK
        bigint qc_test_id FK
        decimal result_value
        boolean is_pass
        datetime tested_at
        bigint tested_by_user_id FK
    }

    CUSTOMER ||--o{ SALES_ORDER : "places"
    SALES_ORDER ||--o{ SO_ITEM : "has items"
    SALES_ORDER ||--o{ DELIVERY : "fulfilled by"
    DELIVERY ||--o{ INVOICE : "billed in"

    CUSTOMER {
        bigint id PK
        string code
        string name
        string contact_person
        string email
        string phone
        string tax_id
        boolean is_active
    }

    SALES_ORDER {
        bigint id PK
        string so_number
        bigint customer_id FK
        datetime so_date
        string status // DRAFT, OPEN, PARTIAL, CLOSED, CANCELLED
        decimal total_amount
    }

    SO_ITEM {
        bigint id PK
        bigint sales_order_id FK
        bigint product_id FK
        decimal qty
        decimal unit_price
        decimal line_total
    }

    DELIVERY {
        bigint id PK
        string do_number
        bigint sales_order_id FK
        datetime delivery_date
        string status // DRAFT, SHIPPED, DELIVERED
    }

    INVOICE {
        bigint id PK
        string invoice_number
        bigint sales_order_id FK
        datetime invoice_date
        decimal total_amount
        string status // DRAFT, OPEN, PAID, OVERDUE
    }

    USER ||--o{ AUDIT_LOG : "performs"
    ROLE ||--o{ USER : "assigned"
    PERMISSION ||--o{ ROLE : "granted"
    APPROVAL_RULE ||--o{ APPROVAL_RULE_STEP : "has steps"

    USER {
        bigint id PK
        string name
        string email
        string password
        boolean is_active
    }

    ROLE {
        bigint id PK
        string name
        string code
    }

    PERMISSION {
        bigint id PK
        string name
        string code
    }

    AUDIT_LOG {
        bigint id PK
        bigint user_id FK
        string action
        string entity_type
        bigint entity_id
        json meta
        datetime created_at
    }

    APPROVAL_RULE {
        bigint id PK
        string module
        string name
        boolean is_active
    }

    APPROVAL_RULE_STEP {
        bigint id PK
        bigint approval_rule_id FK
        int step_order
        string approver_type // ROLE, USER
        bigint approver_id
    }
Notes
Detail kolom bisa disempurnakan saat pembuatan migration.

Relasi reference_type & reference_id di stock_movements digunakan sebagai polymorphic link ke dokumen sumber.

Batch digunakan sebagai kunci traceability dari RM → WIP → FG.

yaml
Copy code

---

## 2️⃣ User Stories – `docs/requirements/erp-user-stories.md`

```markdown
# ERP Manufacturing & Distribution – User Stories

## Format

- **Sebagai** [peran]
- **Saya ingin** [tujuan]
- **Sehingga** [manfaat bisnis]

---

## 1. Product Management

1. Sebagai **R&D / Product Engineer**, saya ingin mencatat master produk (RM, FG, PKG) sehingga seluruh departemen menggunakan data produk yang konsisten.
2. Sebagai **Planner**, saya ingin mengelola BOM per produk dan versi sehingga perubahan formula bisa dilacak.
3. Sebagai **Planner**, saya ingin melihat komponen BOM dalam bentuk list yang jelas sehingga bisa menghitung kebutuhan material untuk tiap batch.
4. Sebagai **QC**, saya ingin menandai produk mana yang wajib memiliki data QC method sehingga tidak ada produk yang diproduksi tanpa referensi QC.

---

## 2. Inventory & Warehouse

1. Sebagai **Warehouse Supervisor**, saya ingin melihat stok per warehouse dan per lokasi sehingga saya tahu posisi fisik barang.
2. Sebagai **Storeman**, saya ingin melakukan penerimaan barang (GRN) dan mengaitkannya ke PO sehingga stok dan pembelian tercatat selaras.
3. Sebagai **Storeman**, saya ingin melakukan transfer stok antar lokasi/warehouse sehingga pergerakan material tercatat dengan benar.
4. Sebagai **Inventory Controller**, saya ingin melihat kartu stok (stock card) per produk sehingga saya bisa audit pergerakan barang.
5. Sebagai **Inventory Controller**, saya ingin melakukan stock opname dan adjustment sehingga selisih fisik vs sistem bisa diperbaiki dan terekam.

---

## 3. Procurement

1. Sebagai **User Dept**, saya ingin membuat Purchase Request (PR) untuk material yang dibutuhkan sehingga proses pembelian terdokumentasi dari awal.
2. Sebagai **Procurement**, saya ingin mengubah PR menjadi PO sehingga pengadaan menjadi lebih cepat dan terkontrol.
3. Sebagai **Manager**, saya ingin menyetujui atau menolak PO melalui workflow approval sehingga pembelian besar tidak terjadi tanpa otorisasi.
4. Sebagai **Procurement**, saya ingin melihat history harga per vendor dan produk sehingga saya bisa melakukan negosiasi yang lebih baik.
5. Sebagai **Finance**, saya ingin melihat summary PO yang sudah diterima (GRN) sehingga saya tahu estimasi AP.

---

## 4. Production / Manufacturing

1. Sebagai **Planner**, saya ingin membuat Work Order (WO) berdasarkan forecast / SO sehingga produksi terencana.
2. Sebagai **Planner**, saya ingin sistem mengecek ketersediaan material terhadap BOM sebelum WO dirilis sehingga tidak ada WO yang jalan tanpa material cukup.
3. Sebagai **Production Supervisor**, saya ingin mengupdate status WO (PLANNED → RELEASED → IN_PROGRESS → QC → CLOSED) sehingga semua pihak tahu progress produksi.
4. Sebagai **Production Operator**, saya ingin mencatat pemakaian material aktual di WO sehingga perbedaan antara rencana vs realisasi tercatat.
5. Sebagai **Production Supervisor**, saya ingin mencatat yield dan scrap per batch sehingga efisiensi proses dapat dianalisa.
6. Sebagai **QC**, saya ingin menginput hasil QC untuk setiap batch produksi sehingga hanya batch yang lulus yang bisa dijual atau dikirim.
7. Sebagai **QA / QC Head**, saya ingin menyetujui/menolak release batch sehingga kontrol kualitas tetap terjaga.

---

## 5. Sales & Distribution

1. Sebagai **Sales**, saya ingin membuat Sales Order (SO) berdasarkan permintaan customer sehingga sistem memiliki visibility demand.
2. Sebagai **CS / Sales Admin**, saya ingin mengaitkan SO ke Delivery Order (DO) sehingga pengiriman bisa dilacak.
3. Sebagai **Warehouse**, saya ingin melakukan picking dan shipping berdasarkan DO sehingga stok berkurang sesuai pengiriman nyata.
4. Sebagai **Finance**, saya ingin membuat invoice dari SO/DO sehingga penagihan ke customer konsisten dengan barang yang dikirim.
5. Sebagai **Sales Manager**, saya ingin melihat laporan penjualan by product, customer, dan bulan sehingga dapat memantau performa penjualan.

---

## 6. Finance (Simplified)

1. Sebagai **Cost Controller**, saya ingin menghitung COGS per batch berdasarkan pemakaian material aktual sehingga margin produk lebih akurat.
2. Sebagai **Finance**, saya ingin melihat daftar invoice yang belum dibayar sehingga saya bisa follow up penagihan.
3. Sebagai **Management**, saya ingin melihat summary margin kotor per produk dan per customer sehingga bisa mengambil keputusan harga dan strategi pasar.

---

## 7. HR Lite

1. Sebagai **HR**, saya ingin mencatat data karyawan beserta department & jabatan sehingga modul approval dan otorisasi dapat berjalan dengan benar.
2. Sebagai **HR**, saya ingin mengatur shift dan jam kerja sehingga produksi dan warehouse memiliki jadwal kerja terstruktur.
3. Sebagai **Leader**, saya ingin mengajukan dan menyetujui lembur (overtime) sehingga beban kerja ekstra tercatat resmi.
4. Sebagai **Management**, saya ingin melihat rekap lembur dan kehadiran sehingga biaya tenaga kerja bisa dikendalikan.

---

## 8. System Administration & Approval

1. Sebagai **System Admin**, saya ingin mengelola user, role, dan permission sehingga akses data dan fitur dapat dikontrol.
2. Sebagai **System Admin**, saya ingin mendefinisikan aturan approval per modul (PR, PO, WO, SO, Batch Release) sehingga alur persetujuan fleksibel.
3. Sebagai **Auditor**, saya ingin melihat audit log per user dan per dokumen sehingga setiap perubahan data penting bisa ditelusuri.
4. Sebagai **User**, saya ingin menerima notifikasi (in-app / email) saat ada dokumen yang perlu saya approve sehingga proses tidak tertunda.

---

## 9. Reporting & Dashboard

1. Sebagai **Plant Manager**, saya ingin melihat dashboard produksi (plan vs actual, yield, scrap) sehingga bisa memantau efisiensi pabrik.
2. Sebagai **Warehouse Supervisor**, saya ingin melihat laporan aging stok sehingga bisa mengurangi risiko expired.
3. Sebagai **Sales Manager**, saya ingin melihat tren penjualan sehingga dapat merencanakan target dan promosi.
4. Sebagai **Top Management**, saya ingin melihat KPI utama (sales, margin, on-time delivery, reject rate) dalam satu dashboard sehingga bisa melihat kondisi perusahaan secara cepat.
3️⃣ Folder Structure Laravel – docs/architecture/laravel-structure.md
markdown
Copy code
# ERP – Laravel 11 + Livewire – Suggested Folder Structure

Struktur ini menggabungkan pendekatan **domain-driven-ish** dengan standar Laravel, supaya tetap familiar tapi rapi untuk ERP.

Root project (monolith):

```text
erp-app/
├─ app/
│  ├─ Domain/
│  │  ├─ Product/
│  │  │  ├─ Models/
│  │  │  ├─ Services/
│  │  │  ├─ Repositories/
│  │  │  └─ Actions/
│  │  ├─ Inventory/
│  │  ├─ Procurement/
│  │  ├─ Production/
│  │  ├─ Sales/
│  │  ├─ Finance/
│  │  ├─ HR/
│  │  └─ Core/        # User, Role, Approval, Audit
│  ├─ Http/
│  │  ├─ Controllers/
│  │  │  ├─ Web/
│  │  │  └─ Api/V1/
│  │  ├─ Middleware/
│  │  └─ Requests/
│  ├─ Models/         # Bisa redirect ke Domain atau model umum
│  ├─ Policies/
│  ├─ Providers/
│  └─ Console/
│
├─ bootstrap/
├─ config/
│  ├─ auth.php
│  ├─ permission.php
│  ├─ domains.php     # (opsional) konfigurasi domain/module
│  └─ ...
│
├─ database/
│  ├─ migrations/
│  │  ├─ 2025_xx_xx_create_products_tables.php
│  │  ├─ 2025_xx_xx_create_inventory_tables.php
│  │  ├─ 2025_xx_xx_create_procurement_tables.php
│  │  ├─ 2025_xx_xx_create_production_tables.php
│  │  ├─ 2025_xx_xx_create_sales_tables.php
│  │  ├─ 2025_xx_xx_create_finance_tables.php
│  │  └─ 2025_xx_xx_create_core_tables.php
│  ├─ seeders/
│  │  ├─ MasterDataSeeder.php
│  │  ├─ RolesAndPermissionsSeeder.php
│  │  └─ DemoDataSeeder.php
│  └─ factories/
│
├─ public/
│  ├─ index.php
│  ├─ build/          # Vite build assets
│  └─ storage/
│
├─ resources/
│  ├─ views/
│  │  ├─ layouts/
│  │  ├─ components/
│  │  ├─ dashboard/
│  │  ├─ product/
│  │  ├─ inventory/
│  │  ├─ procurement/
│  │  ├─ production/
│  │  ├─ sales/
│  │  ├─ finance/
│  │  └─ hr/
│  ├─ js/
│  │  ├─ app.js
│  │  └─ pages/       # kalau pakai Inertia / React
│  └─ css/
│
├─ routes/
│  ├─ web.php         # UI & Livewire routes
│  ├─ api.php         # REST API v1
│  ├─ domains/
│  │  ├─ product.php
│  │  ├─ inventory.php
│  │  ├─ procurement.php
│  │  ├─ production.php
│  │  ├─ sales.php
│  │  └─ finance.php
│
├─ tests/
│  ├─ Feature/
│  └─ Unit/
│
├─ docker/
│  ├─ nginx.conf
│  └─ php-fpm.conf
│
├─ docker-compose.yml
├─ vite.config.js
├─ package.json
├─ composer.json
└─ README.md
Domain Layer Example
text
Copy code
app/Domain/Inventory/
├─ Models/
│  ├─ Warehouse.php
│  ├─ WarehouseLocation.php
│  ├─ InventoryStock.php
│  └─ StockMovement.php
├─ Services/
│  ├─ InventoryService.php
│  └─ StockMovementService.php
├─ Repositories/
│  ├─ InventoryRepository.php
│  └─ StockMovementRepository.php
└─ Actions/
   ├─ CreateStockAdjustment.php
   ├─ TransferStock.php
   └─ ReceiveGoodsFromPO.php
Controller Organization
App\Http\Controllers\Api\V1\Product\ProductController

App\Http\Controllers\Api\V1\Inventory\StockController

App\Http\Controllers\Api\V1\Procurement\PurchaseOrderController

App\Http\Controllers\Api\V1\Production\WorkOrderController

etc.

Livewire / View Organization
Livewire components di app/Livewire/... (atau App\Http\Livewire):

Livewire/Product/ProductList

Livewire/Product/ProductForm

Livewire/Inventory/StockCard

Livewire/Production/WorkOrderBoard

Struktur ini bisa diupdate Copilot sesuai preferensi, tapi baseline-nya sudah mengarah ke modular ERP.

less
Copy code

---

## 4️⃣ Prompt Bootstrap Copilot – `docs/prompts/erp-bootstrap-prompt.md`

```markdown
# Prompt – Bootstrap Code Generation ERP (Copilot / GPT-Coder)

Gunakan prompt ini di GitHub Copilot Chat / VSCode / Cursor AI, dsb.

---

## Prompt

You are a senior Laravel 11 architect helping me build a modular ERP for a small biochemical manufacturing & distribution company.

We already have:

1. A functional specification document:  
   - `docs/requirements/erp-manufacturing.md`

2. An ERD in Mermaid:  
   - `docs/requirements/erp-erd.md`

3. Detailed user stories:  
   - `docs/requirements/erp-user-stories.md`

4. A suggested folder structure for Laravel + Livewire:  
   - `docs/architecture/laravel-structure.md`

### Your Tasks

1. **Align Architecture**
   - Propose a refined architecture based on the provided docs.
   - Confirm if the `app/Domain/*` structure is suitable for this ERP.
   - Suggest any improvements (e.g., modules, packages, bounded contexts).

2. **Generate Database Migrations**
   - Create Laravel migration files for the following domains:
     - Product & BOM
     - Inventory & Warehouse
     - Procurement
     - Production & Batch
     - QC
     - Sales
     - Core (User, Role, Permission, Approval, Audit)
   - Use `bigIncrements` / `foreignId` conventions.
   - Add relevant indexes and foreign keys.
   - Follow naming conventions consistent with Laravel best practices.

3. **Generate Eloquent Models**
   - For each table in the ERD, generate a corresponding Eloquent model.
   - Place them inside `app/Domain/<Domain>/Models`.
   - Define relationships (hasMany, belongsTo, etc.) based on the ERD.
   - Use casts and accessors where appropriate (e.g., `status`, `meta` JSON).

4. **Service & Repository Layer**
   - For each domain, create:
     - Repository classes for data access.
     - Service classes for business operations.
   - Examples:
     - `InventoryService::transferStock(...)`
     - `WorkOrderService::releaseWorkOrder(...)`
     - `QcService::recordBatchResult(...)`

5. **API Controllers & Routes**
   - Create versioned REST API controllers under `App\Http\Controllers\Api\V1\...`:
     - ProductController
     - BomController
     - WarehouseController
     - StockController
     - PurchaseOrderController
     - GoodsReceiptController
     - WorkOrderController
     - BatchController
     - QcController
     - SalesOrderController
   - Define routes in `routes/api.php` or domain-specific route files.
   - Implement standard CRUD + key business actions:
     - Release WO, Close WO
     - Approve/Reject documents
     - Post GRN
     - Post DO / Shipment
     - Release batch after QC

6. **Livewire Components for Web UI (Initial)**
   - Scaffold Livewire components for:
     - Product list & form
     - Warehouse stock overview
     - Work Order list & detail
     - Batch QC result entry
   - Use simple tables and forms first; we will style later.

7. **Approval Workflow & Audit Log**
   - Implement an approval engine based on:
     - `approval_rules`
     - `approval_rule_steps`
   - Provide a generic trait or service to:
     - Register an approval request for any module (PR, PO, WO, SO, Batch Release).
     - Progress through approval steps.
     - Record actions in `audit_log`.

8. **Seeding & Demo Data**
   - Provide seeders for:
     - Master data (UOM, product categories, example warehouses).
     - Roles & permissions (Admin, Planner, Production, Warehouse, Sales, Finance, QC).
     - One or two example products, BOMs, and WOs.

### Guidelines

- Use Laravel 11 conventions and typed properties where possible.
- Use PHP 8.2+ features (readonly, enums where appropriate for status).
- Keep business logic in Services, not in Controllers.
- Keep validation in Form Request classes.
- Design for **traceability** and **manufacturing flow accuracy** first, styling comes later.
- If something from the specification is ambiguous, propose 2–3 reasonable options and briefly explain pros/cons before generating code.

### Output Style

- Work in **small, focused steps**:
  - First: propose architecture and migration list.
  - Then: generate migrations in batches.
  - Then: models and relationships.
  - Then: services and controllers.
- At each step, summarize what was generated.

Start by summarizing your understanding of the ERP domain and proposing the final folder structure and domain bounda
WIRE FRAME
+------------------------------------------------------+
|               PRODUCT MASTER FORM                    |
+------------------------------------------------------+
| Product Code: [___________auto/manual___________]    |
| Product Name: [__________________________________]   |
| Type:         ( ) Raw Material ( ) Finished Goods     |
|               ( ) Packaging                           |
| Category:     [ Select Category ▼ ]                   |
| Base UoM:     [ KG ▼ ]                                |
| Density:      [ ____ ] kg/L (optional)                |
| Standard Cost:[ ____ ] /UoM (optional)                |
| Description:                                          |
|  --------------------------------------------------   |
| |                                                  |  |
| |                                                  |  |
|  --------------------------------------------------   |
| Active:       [x]                                    |
+------------------------------------------------------+
|  [ Cancel ]                       [ Save Product ]    |
+------------------------------------------------------+

BOM Header
+------------------------------------------------------+
|                BOM HEADER FORM                       |
+------------------------------------------------------+
| Product:         [ Select Finished Good ▼ ]          |
| Version:         [ V1.0 ]                             |
| Effective Date:  [ YYYY-MM-DD ]                       |
| Notes:                                               |
|  --------------------------------------------------   |
| |                                                  |  |
| |                                                  |  |
|  --------------------------------------------------   |
+------------------------------------------------------+
|             [ Save Header ] [ Cancel ]               |
+------------------------------------------------------+

Add BOM Component
+------------------------------------------------------+
|              ADD BOM COMPONENT                       |
+------------------------------------------------------+
| Component Product:   [ Select Product ▼ ]            |
| Qty Per Batch:       [ ___ ]                         |
| UoM:                 [ KG ▼ ]                        |
| Loss %:              [ 0 ]                           |
| Sub-BOM:             [ ] Is Sub-BOM                  |
+------------------------------------------------------+
|  [ Cancel ]                        [ Add Component ]  |
+------------------------------------------------------+

TABLE VIEW:
+---------------------------------------------------------------+
| Component     | Qty | UoM | Loss% | Is Sub |   Actions        |
+---------------------------------------------------------------+
| Caustic Soda  |  25 | KG  |  0    |   No   | Edit | Delete    |
| Solvent A     |  55 | L   |  2%   |   No   | Edit | Delete    |
| Bio-Active X  |   5 | KG  |  0    |  Yes   | Edit | Delete    |
+---------------------------------------------------------------+

    Goods Receipt (GRN)
    +--------------------------------------------------------------+
|                   GOODS RECEIPT (GRN)                        |
+--------------------------------------------------------------+
| PO Number:     [ Select PO ▼ ]                              |
| Vendor:        [ auto-filled ]                               |
| Receipt Date:  [ YYYY-MM-DD ]                                |
| Reference Doc: [ Upload File ]                               |
+--------------------------------------------------------------+
| Items:                                                    +  |
+--------------------------------------------------------------+
| Product         | Received Qty | UoM | Batch# | Exp Date     |
|--------------------------------------------------------------|
| [Select ▼]      | [___]        |KG   |[____]  |[YYYY-MM-DD]  |
| [Select ▼]      | [___]        |KG   |[____]  |[YYYY-MM-DD]  |
+--------------------------------------------------------------+
| [ Add Row ]                                             |
+--------------------------------------------------------------+
|         [ Cancel ]                [ Post GRN ]              |
+--------------------------------------------------------------+


Stock Transfer
+--------------------------------------------------------------+
|                     STOCK TRANSFER                           |
+--------------------------------------------------------------+
| From Location: [ Warehouse A - Rack R1 ]                     |
| To Location:   [ Warehouse B - Rack C2 ]                     |
| Transfer Date: [ YYYY-MM-DD ]                               |
| Notes: [ optional ]                                         |
+--------------------------------------------------------------+
| Product        | Qty | Batch |                                |
|--------------------------------------------------------------|
| [Select ▼]     |[__]|[__]                                  |
+--------------------------------------------------------------+
| [ Add Item ]                                               |
+--------------------------------------------------------------+
| [ Cancel ]                           [ Transfer Stock ]       |
+--------------------------------------------------------------+

Purchase Request (PR)
+--------------------------------------------------------------+
|                    PURCHASE REQUEST (PR)                     |
+--------------------------------------------------------------+
| Requester:    [ auto user ]                                 |
| Department:   [ auto dept ]                                 |
| Request Date: [ YYYY-MM-DD ]                                |
| Needed By:    [ YYYY-MM-DD ]                                |
| Reason:       [__________________________________________]  |
+--------------------------------------------------------------+
| Items:                                               +       |
+--------------------------------------------------------------+
| Product         | Qty Req | UoM | Notes                       |
|--------------------------------------------------------------|
| [Select ▼]      | [___]   |KG   | [_________ ]               |
+--------------------------------------------------------------+
| [ Add Row ]                                             |
+--------------------------------------------------------------+
| [ Submit PR ]                                          |
+--------------------------------------------------------------+

Purchase Order (PO)
+--------------------------------------------------------------+
|                         PURCHASE ORDER                       |
+--------------------------------------------------------------+
| Vendor:          [ Select Vendor ▼ ]                         |
| PO Date:         [ YYYY-MM-DD ]                              |
| Payment Terms:   [ __________ ]                              |
| Delivery Terms:  [ __________ ]                              |
+--------------------------------------------------------------+
| Items:                                                        |
+--------------------------------------------------------------+
| Product   | Qty | Price | Line Total | Actions                |
|--------------------------------------------------------------|
| [Select]  | 100 | 10.00 | 1000.00    | Edit / Delete         |
+--------------------------------------------------------------+
|              Total Amount:  1000.00                           |
+--------------------------------------------------------------+
| [ Cancel ]                    [ Submit for Approval ]         |
+--------------------------------------------------------------+

