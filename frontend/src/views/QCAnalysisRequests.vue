<template>
  <div class="space-y-4">
    <h1 class="text-xl font-semibold text-sky-600">Form Permintaan Analisa (FPA)</h1>

    <button @click="openForm()" class="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 shadow-sm">
      ＋ Buat FPA Baru
    </button>

    <!-- Search / Filter Section -->
    <div class="bg-white border border-gray-300 rounded p-4">
      <h2 class="font-semibold text-sm mb-3">Search</h2>
      <div class="grid grid-cols-2 gap-x-8 gap-y-2">
        <div class="flex items-center gap-2">
          <label class="text-sm w-36 shrink-0">Filter Date</label>
          <select v-model="filter.dateType" class="flex-1 px-2 py-1 border rounded text-sm">
            <option value="input">Input Date</option>
            <option value="fpa">FPA Date</option>
          </select>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-sm w-36 shrink-0">RS No.</label>
          <input v-model="filter.rsNo" type="text" class="flex-1 px-2 py-1 border rounded text-sm" />
        </div>

        <div class="flex items-center gap-2">
          <label class="text-sm w-36 shrink-0">No. Bukti FPA</label>
          <input v-model="filter.fpaNo" type="text" class="flex-1 px-2 py-1 border rounded text-sm" />
        </div>
        <div class="flex items-center gap-2">
          <label class="text-sm w-36 shrink-0">From Date</label>
          <input v-model="filter.fromDate" type="date" class="px-2 py-1 border rounded text-sm" />
          <span class="text-sm font-medium">To</span>
          <input v-model="filter.toDate" type="date" class="px-2 py-1 border rounded text-sm" />
        </div>

        <div class="flex items-center gap-2">
          <label class="text-sm w-36 shrink-0">Kode Barang</label>
          <input v-model="filter.itemCode" type="text" class="flex-1 px-2 py-1 border rounded text-sm" />
        </div>
        <div class="flex items-center gap-2">
          <label class="text-sm w-36 shrink-0">Jenis Sample</label>
          <select v-model="filter.sampleType" class="flex-1 px-2 py-1 border rounded text-sm">
            <option value="">- ALL -</option>
            <option value="RS">RS (Raw Material)</option>
            <option value="LP">LP (Line Process)</option>
          </select>
        </div>

        <div class="flex items-center gap-2">
          <label class="text-sm w-36 shrink-0">Area Sampling</label>
          <select v-model="filter.areaId" class="flex-1 px-2 py-1 border rounded text-sm">
            <option value="">Select All</option>
            <option v-for="a in areas" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-sm w-36 shrink-0">Status FPA</label>
          <select v-model="filter.status" class="flex-1 px-2 py-1 border rounded text-sm">
            <option value="">- ALL -</option>
            <option value="Sample Belum Diterima">Sample Belum Diterima</option>
            <option value="Sample Diterima">Sample Diterima</option>
            <option value="Ditunggu">Ditunggu</option>
            <option value="ACCEPTED">ACCEPTED</option>
            <option value="Resampling">Resampling/Disposisi</option>
          </select>
        </div>

        <div>
          <button @click="loadData" class="px-5 py-1.5 bg-sky-500 text-white rounded text-sm font-medium hover:bg-sky-600">Submit</button>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-sm w-36 shrink-0">Show</label>
          <select v-model="filter.limit" class="w-24 px-2 py-1 border rounded text-sm">
            <option :value="50">50</option>
            <option :value="100">100</option>
            <option :value="200">200</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Status Legend -->
    <div class="flex gap-3 text-xs font-medium">
      <span class="px-3 py-1 rounded" :style="{ background: '#fff3cd', color: '#856404' }">📌 Sample Belum Diterima</span>
      <span class="px-3 py-1 rounded" :style="{ background: '#d4edda', color: '#155724' }">📌 Sample Diterima</span>
      <span class="px-3 py-1 rounded" :style="{ background: '#fff3cd', color: '#856404' }">📌 Ditunggu</span>
      <span class="px-3 py-1 rounded" :style="{ background: '#d4edda', color: '#155724' }">📌 ACCEPTED</span>
      <span class="px-3 py-1 rounded" :style="{ background: '#f8d7da', color: '#721c24' }">📌 Resampling/Disposisi</span>
    </div>

    <!-- Data Table -->
    <div class="bg-white border border-gray-300 rounded overflow-x-auto">
      <table class="min-w-full text-sm border-collapse">
        <thead>
          <!-- Header Row 1 -->
          <tr class="bg-gray-100 border-b border-gray-300">
            <th rowspan="2" class="tbl-th w-10">No.</th>
            <th class="tbl-th">No. Bukti RS</th>
            <th class="tbl-th">Item Code</th>
            <th class="tbl-th">Batch No.</th>
            <th class="tbl-th">No. PO</th>
            <th class="tbl-th">No. Bukti FPA</th>
            <th class="tbl-th">No. Documents</th>
            <th class="tbl-th">No. FPA</th>
            <th rowspan="2" class="tbl-th">Status FPA</th>
            <th class="tbl-th">Resampling</th>
            <th rowspan="2" class="tbl-th">Approve</th>
            <th rowspan="2" class="tbl-th">Keterangan</th>
          </tr>
          <!-- Header Row 2 -->
          <tr class="bg-gray-100 border-b border-gray-300">
            <th class="tbl-th">Date RS</th>
            <th class="tbl-th">Item Name</th>
            <th class="tbl-th">Qty</th>
            <th class="tbl-th">Supplier Name</th>
            <th class="tbl-th">Date FPA</th>
            <th class="tbl-th">Sampling Point</th>
            <th class="tbl-th">Sample Ke</th>
            <th class="tbl-th">Disposisi</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(item, idx) in fpas" :key="item.id">
            <!-- WO Group Header (show when reference_number changes) -->
            <tr v-if="item.reference_number && (idx === 0 || fpas[idx - 1]?.reference_number !== item.reference_number)"
              class="bg-blue-50 border-t-2 border-blue-300">
              <td :colspan="12" class="px-3 py-2">
                <span class="font-bold text-blue-700 text-sm">🏭 {{ item.reference_number }}</span>
                <span class="text-xs text-blue-500 ml-3">{{ item.product_name || '' }}</span>
                <span class="text-xs text-gray-400 ml-2">({{ fpas.filter(f => f.reference_number === item.reference_number).length }} FPA)</span>
              </td>
            </tr>
            <!-- Data Row 1 -->
            <tr class="border-b border-gray-200 cursor-pointer hover:bg-gray-100" :class="getRowBg(item.status)" @click="openDetail(item.id)">
              <td rowspan="2" class="tbl-td text-center font-medium align-top">{{ idx + 1 }}</td>
              <td class="tbl-td">
                <span class="inline-flex items-center gap-1">
                  <span :class="getStatusDot(item.status)"></span>
                  {{ item.rs_number || '-' }}
                </span>
              </td>
              <td class="tbl-td font-mono text-xs">{{ item.product_sku || '-' }}</td>
              <td class="tbl-td">{{ item.batch_no || '-' }}</td>
              <td class="tbl-td">{{ item.po_number || '-' }}</td>
              <td class="tbl-td">{{ item.fpa_number || '-' }}</td>
              <td class="tbl-td">{{ item.document_no || '-' }}</td>
              <td class="tbl-td">{{ item.fpa_ref || '-' }}</td>
              <td rowspan="2" class="tbl-td align-top">
                <span class="text-xs font-semibold" :class="getStatusColor(item.status)">
                  {{ item.status || 'Sample Belum Diterima' }}
                </span>
              </td>
              <td class="tbl-td text-center">{{ item.resampling || 'No' }}</td>
              <td rowspan="2" class="tbl-td text-center align-top text-xs">{{ item.approve_status || 'NOT YET APPROVE' }}</td>
              <td rowspan="2" class="tbl-td align-top text-xs">{{ item.keterangan || '' }}</td>
            </tr>
            <!-- Data Row 2 -->
            <tr class="border-b border-gray-300" :class="getRowBg(item.status)">
              <td class="tbl-td text-gray-600 text-xs">{{ formatDate(item.rs_date) }}</td>
              <td class="tbl-td text-gray-700">{{ item.product_name || '-' }}</td>
              <td class="tbl-td text-right text-gray-600">{{ formatQty(item.qty) }} {{ item.uom || 'kg' }}</td>
              <td class="tbl-td text-gray-600 text-xs">{{ item.supplier_name || '-' }}</td>
              <td class="tbl-td text-gray-600 text-xs">{{ formatDate(item.fpa_date) }}</td>
              <td class="tbl-td text-gray-600">{{ item.sampling_point || item.area_name || '-' }}</td>
              <td class="tbl-td text-gray-600">{{ item.sample_ke || '-' }}</td>
              <td class="tbl-td text-gray-600 text-xs">{{ item.disposisi || '' }}</td>
            </tr>
          </template>
          <tr v-if="fpas.length === 0">
            <td colspan="12" class="px-4 py-8 text-center text-gray-500">Belum ada data FPA.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create FPA Modal -->
    <div v-if="showCreate" class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div class="p-4 border-b flex justify-between items-center bg-slate-50">
          <h2 class="text-lg font-semibold text-slate-800">Buat FPA Baru</h2>
          <button @click="showCreate = false" class="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>
        <form @submit.prevent="saveNewFPA" class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Tipe FPA</label>
            <select v-model="form.type" required class="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="RS">Raw Material (RS)</option>
              <option value="LP">Line Process (LP)</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Item / Product</label>
            <select v-model="form.product_id" required class="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">-- Select Item --</option>
              <option v-for="p in products" :key="p.id" :value="p.id">{{ p.sku }} - {{ p.name }}</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Qty</label>
              <input v-model="form.qty" type="number" step="0.01" class="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Batch No.</label>
              <input v-model="form.batch_no" type="text" class="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">No. PO</label>
              <input v-model="form.po_number" type="text" class="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Supplier</label>
              <input v-model="form.supplier_name" type="text" class="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Area Sampling</label>
            <select v-model="form.sampling_area_id" class="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">-- Optional --</option>
              <option v-for="a in areas" :key="a.id" :value="a.id">{{ a.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea v-model="form.notes" rows="2" class="w-full px-3 py-2 border rounded-lg text-sm"></textarea>
          </div>
          <div class="flex justify-end gap-3 pt-4 border-t">
            <button type="button" @click="showCreate = false" class="px-4 py-2 border rounded-lg text-slate-700 text-sm">Batal</button>
            <button type="submit" :disabled="saving" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">{{ saving ? 'Menyimpan...' : 'Buat FPA' }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Detail/Input Results Modal -->
    <div v-if="showDetail && detailData" class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div class="p-4 border-b flex justify-between items-center bg-slate-50 shrink-0">
          <div>
            <h2 class="text-lg font-semibold text-slate-800">Input Hasil Analisa QC</h2>
            <p class="text-sm text-slate-500">{{ detailData.fpa_number }} | {{ detailData.product_name }}</p>
          </div>
          <button @click="showDetail = false" class="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>
        
        <div class="p-6 overflow-y-auto flex-1 space-y-6">
          <div class="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-lg border">
            <div>
              <label class="block text-sm font-medium text-slate-700">Status</label>
              <select v-model="detailData.status" class="mt-1 w-full px-3 py-2 border rounded-lg text-sm">
                <option value="Sample Belum Diterima">Sample Belum Diterima</option>
                <option value="Sample Diterima">Sample Diterima</option>
                <option value="Ditunggu">Ditunggu</option>
                <option value="ACCEPTED">ACCEPTED</option>
                <option value="Resampling">Resampling/Disposisi</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700">Kesimpulan (Result)</label>
              <select v-model="detailData.result" class="mt-1 w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">-- Belum Ada --</option>
                <option value="Pass">Pass (Lulus Uji)</option>
                <option value="Fail">Fail (Gagal/Reject)</option>
                <option value="Hold">Hold (Ditahan)</option>
              </select>
            </div>
          </div>

          <div>
            <h3 class="font-medium text-slate-800 mb-3">Parameter Uji</h3>
            <table class="min-w-full border text-sm">
              <thead class="bg-slate-50 border-b">
                <tr>
                  <th class="px-4 py-2 text-left text-xs font-medium text-slate-500">Parameter</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-slate-500">Std Value</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-slate-500">Min/Max</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-slate-500 w-48">Actual Value</th>
                  <th class="px-4 py-2 text-center text-xs font-medium text-slate-500">Lulus?</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                <tr v-for="res in detailData.results" :key="res.id">
                  <td class="px-4 py-2">{{ res.parameter_name }}</td>
                  <td class="px-4 py-2 text-slate-600">{{ res.standard_value || '-' }}</td>
                  <td class="px-4 py-2 text-slate-600">{{ res.min_value ?? '-' }} / {{ res.max_value ?? '-' }}</td>
                  <td class="px-4 py-2">
                    <input v-model="res.actual_value" type="text" class="w-full px-2 py-1 border rounded text-sm" placeholder="Input hasil..." />
                  </td>
                  <td class="px-4 py-2 text-center">
                    <input type="checkbox" v-model="res.is_pass" class="w-4 h-4 text-blue-600 rounded border-gray-300" />
                  </td>
                </tr>
                <tr v-if="!detailData.results || detailData.results.length === 0">
                  <td colspan="5" class="px-4 py-4 text-center text-slate-500">Tidak ada parameter uji. Setting di Master Items dulu.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Catatan Analisa</label>
            <textarea v-model="detailData.notes" rows="3" class="w-full px-3 py-2 border rounded-lg text-sm"></textarea>
          </div>
        </div>

        <div class="p-4 border-t flex justify-end gap-3 shrink-0 bg-white">
          <button @click="showDetail = false" class="px-4 py-2 border rounded-lg text-slate-700 text-sm">Tutup</button>
          <button @click="saveResults" :disabled="saving" class="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700">
            {{ saving ? 'Menyimpan...' : 'Simpan Hasil' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const fpas = ref<any[]>([]);
const loading = ref(false);
const saving = ref(false);

const showCreate = ref(false);
const showDetail = ref(false);
const detailData = ref<any>(null);

const products = ref<any[]>([]);
const areas = ref<any[]>([]);

const filter = ref({
  dateType: 'input',
  fpaNo: '',
  rsNo: '',
  itemCode: '',
  areaId: '',
  sampleType: '',
  status: '',
  fromDate: '',
  toDate: '',
  limit: 100
});

const form = ref({
  type: 'RS',
  product_id: '',
  sampling_area_id: '',
  notes: '',
  qty: '',
  batch_no: '',
  po_number: '',
  supplier_name: ''
});

onMounted(async () => {
  await loadData();
  await loadHelpers();
});

const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`
});

async function loadData() {
  loading.value = true;
  try {
    const res = await fetch('/api/qc/fpa', { headers: getAuthHeaders() });
    if(res.ok) {
      const data = await res.json();
      fpas.value = data.data || [];
    }
  } catch(e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

async function loadHelpers() {
  try {
    const pRes = await fetch('/api/products', { headers: getAuthHeaders() });
    if(pRes.ok) products.value = (await pRes.json()).data || [];

    const aRes = await fetch('/api/qc/areas', { headers: getAuthHeaders() });
    if(aRes.ok) areas.value = (await aRes.json()).data || [];
  } catch(e) {
    console.error(e);
  }
}

function openForm() {
  form.value = { type: 'RS', product_id: '', sampling_area_id: '', notes: '', qty: '', batch_no: '', po_number: '', supplier_name: '' };
  showCreate.value = true;
}

async function saveNewFPA() {
  saving.value = true;
  try {
    const res = await fetch('/api/qc/fpa', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(form.value)
    });
    if(res.ok) {
      showCreate.value = false;
      await loadData();
    } else {
      alert('Failed to create FPA');
    }
  } catch(e) {
    console.error(e);
  } finally {
    saving.value = false;
  }
}

async function openDetail(id: number) {
  window.location.href = `/qc/fpa/${id}`;
}

async function saveResults() {
  saving.value = true;
  try {
    const payload = {
      status: detailData.value.status,
      result: detailData.value.result,
      notes: detailData.value.notes,
      results: detailData.value.results
    };
    const res = await fetch(`/api/qc/fpa/${detailData.value.id}/results`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    if(res.ok) {
      showDetail.value = false;
      await loadData();
    } else {
      alert('Failed to save results');
    }
  } catch(e) {
    console.error(e);
  } finally {
    saving.value = false;
  }
}

function formatDate(d: string | null) {
  if (!d) return '-';
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
}

function formatQty(q: any) {
  if (!q && q !== 0) return '-';
  return Number(q).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getStatusColor(status: string) {
  switch(status) {
    case 'Sample Belum Diterima': return 'text-yellow-700';
    case 'Sample Diterima': return 'text-green-700';
    case 'Ditunggu': return 'text-orange-600';
    case 'ACCEPTED': return 'text-green-600';
    case 'Resampling': return 'text-red-600';
    default: return 'text-yellow-700';
  }
}

function getRowBg(status: string) {
  switch(status) {
    case 'Sample Belum Diterima': return 'bg-yellow-50';
    case 'Sample Diterima': return 'bg-green-50';
    case 'ACCEPTED': return 'bg-green-50';
    case 'Resampling': return 'bg-red-50';
    default: return '';
  }
}

function getStatusDot(status: string) {
  const base = 'inline-block w-2.5 h-2.5 rounded-sm mr-1';
  switch(status) {
    case 'Sample Belum Diterima': return `${base} bg-yellow-400`;
    case 'Sample Diterima': return `${base} bg-green-500`;
    case 'Ditunggu': return `${base} bg-orange-400`;
    case 'ACCEPTED': return `${base} bg-green-600`;
    case 'Resampling': return `${base} bg-red-500`;
    default: return `${base} bg-yellow-400`;
  }
}
</script>

<style scoped>
.tbl-th {
  @apply px-3 py-2 text-left text-xs font-semibold text-gray-700 border border-gray-300 whitespace-nowrap;
}
.tbl-td {
  @apply px-3 py-1.5 border border-gray-200 whitespace-nowrap;
}
</style>
