FINAL DATA MODEL (INTI SISTEM)
1.1 MASTER STRUKTUR (ILMU EPC)
master_discipline
field	note
id	PK
code	CIVIL
name	Civil
order_no	
master_sub_discipline
field	note
id	PK
discipline_id	FK
code	PONDASI
name	Pekerjaan Pondasi
order_no	
1.2 AHSP (UNIT PRICE ENGINE)
ahsp_headers
field	
id	PK
kode	A.2.2.15
name	Pengukuran dan Bowplank
satuan	m
version	2024
status	active
approved_at	
ahsp_items
field	
id	
ahsp_id	FK
resource_type	labor/material/equipment
resource_id	FK
koefisien	
section	A/B/C
ahsp_sub_discipline_map

| ahsp_id | sub_discipline_id |

📌 INILAH filter otomatis AHSP → sub disiplin

1.3 PROPOSAL / ESTIMATION (MAIN OBJECT)
proposals
field	
id	
project_name	
client	
lokasi	
revision	Rev-0
status	draft/review/locked
created_by	
proposal_items ⭐ (PALING PENTING)

Mirror Excel row

field	note
id	
proposal_id	
discipline_id	
sub_discipline_id	
ahsp_id	
ahsp_code_snapshot	
ahsp_name_snapshot	
unit	
qty	user input
unit_price_snapshot	dari AHSP
total_price	qty × unit_price
order_no	

📌 Snapshot = kunci audit & versioning

2️⃣ CALCULATION ENGINE (RESMI & AMAN)
2.1 UNIT PRICE
unit_price = AHSP.HSP (D + E)

2.2 LINE TOTAL
line_total = qty × unit_price

2.3 SUB-DISCIPLINE TOTAL
sum(line_total WHERE sub_discipline)

2.4 DISCIPLINE TOTAL
sum(sub_discipline_total)

2.5 PROJECT TOTAL
direct_cost
+ overhead
+ risk/contingency


📌 Tidak ada logic di UI
📌 Semua hitung via service layer

3️⃣ ONE-PAGE UI — STATE & INTERACTION
3.1 STATE MODEL
selectedDiscipline
selectedSubDiscipline
proposalItems[]
summaryTotals

3.2 INTERACTION RULE

Klik sub disiplin → filter table

Input qty → debounce → recalculation

Klik AHSP → popup detail

Add AHSP → langsung insert row

📌 Tidak reload halaman

4️⃣ VERSIONING & SNAPSHOT STRATEGY
4.1 PROPOSAL REVISION

Rev-0 → Rev-1 → Rev-2

Tidak edit data lama

Copy proposal_items → new proposal_id

4.2 SNAPSHOT RULE (WAJIB)

Disimpan saat insert:

ahsp_code

ahsp_name

unit

unit_price

📌 Kalau AHSP update → proposal lama TIDAK BERUBAH

5️⃣ APPROVAL & LOCKING (ENTERPRISE)
5.1 STATUS FLOW
DRAFT → IN_REVIEW → APPROVED → LOCKED

5.2 ROLE
Role	Action
Estimator	edit qty
1️⃣ MAPPING EXCEL → ONE PAGE UI (INI KUNCI)

Dari contoh lo:

Excel Column	Makna Sistem
NO	Auto row / display
DISIPLIN	Discipline (CIVIL, STEEL, dll)
SUB DISIPLIN	SubDiscipline (PERSIAPAN, PONDASI, dll)
URAIAN PEKERJAAN	AHSP Name
KODE	AHSP Code
VOLUME	Qty (user input)
HARGA SATUAN	Unit Price (auto dari AHSP)
JUMLAH HARGA	Qty × Unit Price (auto)

📌 Estimator TIDAK input harga
📌 Harga satuan = HSP hasil AHSP

2️⃣ ONE PAGE WIREFRAME (VERSI WEB, MIRROR EXCEL)

Bayangin ini 1 halaman penuh, scroll vertikal.

🟦 HEADER (STICKY)
PROJECT : EPC Warehouse XYZ     Rev-0 (Draft)
Client  : PT ABC
Lokasi  : Cilegon

[ Save Draft ] [ Submit Review ] [ Export Excel ] [ Lock ]

🟨 BODY — TABEL UTAMA (SEPERTI EXCEL LO)
🔹 DISCIPLINE SECTION (GROUP HEADER)
I.  CIVIL — PEKERJAAN PERSIAPAN
────────────────────────────────────────────────────────────
⬆️ ini bukan baris biasa
➡️ group header (readonly, bold)

🔹 DETAIL ROWS (AHSP BASED)
No | Uraian Pekerjaan                     | Kode    | Vol | Sat | Harga Sat | Jumlah
------------------------------------------------------------------------------------------------
1  | Papan Nama Proyek          	         | A.2.2.14| 1.00| bh  | 251.100   | 251.100
2  | Pengukuran dan Bowplank             | A.2.2.15|180.95| m  | 70.040    |12.673.856
3  | Pembuatan Direksi Keet sementara    | A.2.2.16| 9.00| m2 |1.595.067  |14.355.608
4  | Biaya Mobilisasi & Demobilisasi     | A.2.2.17| 1.00| paket|12.000.000|12.000.000
5  | Pelaporan, Administrasi & Dokumentasi| A.2.2.18|1.00| paket|4.400.000|4.400.000
6  | Sistem Manajemen K3                 | A.2.2.19| 1.00| paket|10.439.920|10.439.920
------------------------------------------------------------------------------------------------
                                     SUB TOTAL CIVIL – PERSIAPAN : 54.120.563


📌 Yang bisa di-edit user cuma: Vol
📌 Klik Uraian / Kode AHSP → popup AHSP detail
📌 Harga satuan terkunci

🟩 SUB-DISCIPLINE BERIKUTNYA (SAMA HALAMAN)
II. CIVIL — PEKERJAAN SALURAN
────────────────────────────────────────────────────────────
1  | Lap. Pasir Urug Bawah Pondasi       | A.2.3.11|101.52| m3 |206.525|20.966.418
2  | Pek. Pondasi Batu Belah ad A.4      | A.3.2.12|497.97| m3 |898.795|447.573.163
3  | Pek. Plesteran ad 1Pc : 5Ps         | A.4.4.25|2.696.81| m2|74.591|201.158.734
4  | Pek. Acian                          | A.4.4.27|2.696.81| m2|46.097|124.317.480
------------------------------------------------------------------------------------------------
                                     SUB TOTAL CIVIL – SALURAN : 794.015.795

🟥 AUTO-GROUPING LOGIC (PENTING)

Sistem otomatis:

Group by Discipline

Sub-group by SubDiscipline

Hitung:

Sub total per sub-disipline

Total per discipline

Grand total project

Estimator tidak perlu mikir struktur, hanya isi qty.

3️⃣ ADD ITEM FLOW (INLINE, BUKAN PAGE BARU)

Di bawah setiap sub-disipline:

[ + Tambah Pekerjaan (AHSP) ]


Klik →

Select AHSP (CIVIL / PEKERJAAN PERSIAPAN)
🔍 Search
✓ A.2.2.14 – Papan Nama Proyek
✓ A.2.2.15 – Pengukuran & Bowplank
✓ A.2.2.16 – Direksi Keet Sementara


➡️ Dipilih → langsung nambah baris ke tabel

4️⃣ RIGHT SIDE (OPTIONAL, STICKY SUMMARY)

Kalau layar besar:

COST SUMMARY
-------------------------
CIVIL               1.588.136.928
STEEL STRUCTURE       823.000.000
PIPING                210.000.000
ELECTRICAL            180.000.000
-------------------------
DIRECT COST         2.801.136.928
OVERHEAD               140.000.000
RISK / CONTINGENCY      60.000.000
-------------------------
TOTAL PROJECT       3.001.136.928


📌 Ini buat Finance & Management

5️⃣ BEHAVIOR RULE (ANTI KACAU, WAJIB)

✅ Qty berubah → jumlah & subtotal realtime
✅ Harga satuan snapshot dari AHSP versi aktif
❌ Tidak bisa edit harga
❌ Tidak bisa pakai AHSP beda sub-disiplin
❌ AHSP deprecated → warning

Audit log:

siapa ubah qty

sebelum & sesudah


Eng Manager	review
Finance	validate
Director	approve
System	lock
5.3 LOCK RULE

LOCKED → read-only

Edit → force create new revision

6️⃣ EXPORT ENGINE (KRITIKAL EPC)
6.1 EXPORT EXCEL

Output 1:1 seperti gambar lo:

Group by Discipline

Sub total per sub disiplin

Format angka & border

Header Page 1, Page 2 dst

📌 Ini selling point besar

6.2 EXPORT PDF

Management summary

Discipline breakdown

Legal ready

7️⃣ NON-FUNCTIONAL (BIAR TAHAN LAMA)
7.1 PERFORMANCE

AHSP cached

Price resolved sekali per proposal

Summary via pre-computed column

7.2 AUDIT LOG

| user | action | before | after | time |

7.3 SCALING

Company-wide

Multi project

Multi estimator