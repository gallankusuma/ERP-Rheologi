1. Tambahkan workflow .github/workflows/ci.yml

Karena repo sekarang belum punya lockfile package-lock.json, untuk sementara pakai npm install. Setelah lockfile ditambahkan, ganti ke npm ci supaya dependency build reproducible. GitHub sendiri merekomendasikan setup-node dan penggunaan package-manager install/build commands di workflow Node.js.

Contoh awal yang cocok dengan repo kita:

name: ERP CI

on:
push:
branches: - main
pull_request:
branches: - main

jobs:
backend-build:
name: Backend Build
runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install backend dependencies
        working-directory: backend
        run: npm install

      - name: Build backend
        working-directory: backend
        run: npm run build

frontend-build:
name: Frontend Build
runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install frontend dependencies
        working-directory: frontend
        run: npm install

      - name: Build frontend
        working-directory: frontend
        run: npm run build

Backend npm run build menjalankan TypeScript tsc, sedangkan frontend menjalankan vue-tsc && vite build, jadi bahkan versi pertama ini sudah menangkap banyak regression compile/type-contract.

Setelah file itu masuk ke main, setiap commit akan mulai punya:

✓ Backend Build
✓ Frontend Build

atau:

✗ Backend Build
✓ Frontend Build

Itulah yang tadi tidak ada.

2. Tambahkan lint setelah build sudah stabil

Karena kedua project juga punya lint command, next step:

      - name: Lint backend
        working-directory: backend
        run: npm run lint

dan frontend:

      - name: Lint frontend
        working-directory: frontend
        run: npm run lint

Tapi gue sarankan jangan langsung jadikan lint blocker pertama kalau existing repo punya banyak legacy lint warning. Kita bisa mulai:

Build = blocking
Lint = observability

lalu setelah lint debt dibersihkan:

Build = blocking
Lint = blocking
Smoke = blocking 3. Yang lebih penting: bikin PPIC Integration Smoke

Ini yang akhirnya membuktikan business flow kita.

Backend lo menggunakan MySQL dan membaca environment seperti:

DB_HOST
DB_USER
DB_PASSWORD
DB_NAME

dengan default DB erp_manufacturing.

GitHub Actions bisa menjalankan database sebagai service container sementara untuk setiap CI job; service tersebut dibuat fresh untuk job dan dibuang setelah selesai.

Kita bisa bikin:

ppic-smoke:
name: PPIC Integration Smoke
runs-on: ubuntu-latest

services:
mysql:
image: mysql:8.0
env:
MYSQL_ROOT_PASSWORD: root
MYSQL_DATABASE: erp_manufacturing
ports: - 3306:3306
options: >-
--health-cmd="mysqladmin ping -h localhost -proot"
--health-interval=10s
--health-timeout=5s
--health-retries=10

env:
DB_HOST: 127.0.0.1
DB_USER: root
DB_PASSWORD: root
DB_NAME: erp_manufacturing
JWT_SECRET: ci-test-secret
NODE_ENV: test

Lalu workflow:

steps:

- uses: actions/checkout@v4

- uses: actions/setup-node@v4
  with:
  node-version: 22

- name: Install backend
  working-directory: backend
  run: npm install

- name: Initialize database
  run: |
  mysql \
   -h 127.0.0.1 \
   -u root \
   -proot \
   erp_manufacturing \
   < backend/database/schema_mysql.sql

- name: Build backend
  working-directory: backend
  run: npm run build

- name: Start backend
  working-directory: backend
  run: |
  npm start > /tmp/backend.log 2>&1 &
  echo $! > /tmp/backend.pid

- name: Wait for API
  run: |
  for i in {1..30}; do
  if curl -fsS http://127.0.0.1:3000/api/health; then
  exit 0
  fi
  sleep 2
  done

  cat /tmp/backend.log
  exit 1

- name: PPIC smoke test
  working-directory: backend
  run: npm run test:ppic

4. Jangan pakai test_mrp_pr.sh sekarang apa adanya

Ini penting.

Repo kita memang sudah punya:

backend/test_mrp_pr.sh

tapi script sekarang mengandung hal-hal seperti:

/var/www/erp-rheologi-dev/backend/node_modules/jsonwebtoken

kemudian database credential hardcoded:

erp_user
ErpSecure2024!
erp_rheologi_dev

serta fixed material:

material_id 221
material_id 222

dan port:

3007

Jangan masukkan script ini apa adanya ke GitHub Actions.

Kita harus ubah menjadi test portable.

Idealnya:

backend/
└── tests/
└── ppic-smoke.ts

dan package.json:

"scripts": {
"test:ppic": "tsx tests/ppic-smoke.ts"
} 5. Isi ppic-smoke.ts harus test business flow kita

Ini bagian paling penting.

Bukan hanya:

GET endpoint → 200

Tapi benar-benar:

Seed Test Product
↓
Seed BOM
↓
Seed Raw Material Inventory
↓
Create Forecast October
↓
Create MPS October
↓
Push Forecast
↓
Pull Sales Order
↓
Verify forecast_qty + so_qty
↓
Set production_qty
↓
Confirm MPS
↓
Generate MRP
↓
Verify Gross Requirement
↓
Verify Inventory Netting
↓
Generate PR
↓
Open PR via Procurement
↓
Verify same Material + Qty

Kemudian branch kedua:

Confirmed MPS
↓
Generate WO Preview
↓
Generate selected week
↓
Verify line_process_id
↓
Approve WO
↓
Release WO
↓
In Progress

Dan negative tests:

✓ Forecast Oct tidak masuk MPS Aug
✓ Pull SO kedua kali tidak duplicate
✓ Edit Confirmed MPS rejected
✓ Generate PR kedua rejected
✓ Generate WO kedua rejected
✓ WO tanpa line mapping rejected
✓ Failed PR item creation rollback header

Kalau ada satu assertion gagal:

PPIC Integration Smoke ❌

GitHub commit otomatis merah.

6. Tambahkan lockfile

Ini juga gue sarankan.

Saat ini gue cek:

backend/package-lock.json → tidak ada
frontend/package-lock.json → tidak ada

Jadi dependency yang ter-install bisa bergeser antar hari.

Di developer machine:

cd backend
npm install

cd ../frontend
npm install

Commit:

backend/package-lock.json
frontend/package-lock.json

Setelah itu CI ubah:

npm install

menjadi:

npm ci

Ini bikin environment dev, CI, dan production jauh lebih deterministic. GitHub Node.js workflow guidance juga menggunakan npm ci ketika lockfile tersedia.

7. Setelah CI pertama sukses, protect main

Setelah job tersebut pernah jalan sukses, masuk:

GitHub Repo → Settings → Branches / Rules → main

lalu aktifkan:

Require status checks to pass before merging

dan pilih:

Backend Build
Frontend Build
PPIC Integration Smoke

GitHub branch protection memang bisa mewajibkan status checks lolos sebelum perubahan boleh masuk ke protected branch.

Jadi developer tidak bisa lagi:

push code rusak
↓
merge
↓
production error

Flow berubah menjadi:

Developer Revision
↓
Pull Request
↓
Backend Build ──────┐
Frontend Build ─────┤
PPIC Smoke ─────────┤
↓
ALL GREEN
↓
MERGE
↓
main
Untuk ERP lo, target akhirnya begini
GitHub Push / PR
│
┌──────────────┼──────────────┐
▼ ▼ ▼
Backend Build Frontend Build PPIC Smoke
│ │ │
PASS PASS PASS
└──────────────┼──────────────┘
▼
CI GREEN
│
▼
Eligible to Merge
│
▼
MAIN

Nah, kalau PPIC Integration Smoke green pada SHA terbaru, baru gue punya evidence yang jauh lebih kuat untuk bilang:

PPIC MODULE = FIRM / FREEZE ✅

Bukan berdasarkan commit message atau code inspection saja, tapi GitHub sendiri punya repeatable automated evidence bahwa build + business integration flow lolos.

Menurut gue urutan implementasinya: buat ci.yml → commit lockfiles → buat portable ppic-smoke.ts → tambahkan MySQL integration job → protect main. Jangan bikin deployment CI/CD dulu; kita bereskan CI quality gate lebih dulu.
