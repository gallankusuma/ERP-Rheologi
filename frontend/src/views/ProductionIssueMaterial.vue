<template>
  <div class="min-h-screen bg-slate-50">

    <!-- Header -->
    <div class="bg-gradient-to-r from-emerald-700 to-teal-800 text-white px-6 py-4 shadow-lg">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 class="text-xl font-bold tracking-wide">🏭 Issue Material</h1>
          <p class="text-sm text-emerald-200 mt-0.5">Pengeluaran material dari gudang ke Work Order produksi</p>
        </div>
        <button @click="loadData" :disabled="loading"
          class="px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-semibold transition-all">
          {{ loading ? '⏳' : '🔄 Refresh' }}
        </button>
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-4 py-6 space-y-6">

      <!-- WO Selector Panel -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 class="font-bold text-gray-800">📋 Pilih Work Order</h2>
          <span class="text-xs text-gray-400">{{ workOrders.length }} WO aktif</span>
        </div>
        <div v-if="loading" class="p-10 text-center">
          <div class="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
        <div v-else class="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div v-for="wo in workOrders" :key="wo.id"
            @click="selectWO(wo)"
            class="rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-md"
            :class="selectedWO?.id === wo.id
              ? 'border-emerald-500 bg-emerald-50 shadow-md'
              : 'border-gray-100 hover:border-emerald-200'">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="font-mono font-bold text-emerald-700 text-sm">{{ wo.wo_number }}</div>
                <div class="text-sm font-semibold text-gray-800 mt-0.5 leading-tight">{{ wo.product_name }}</div>
                <div class="text-xs text-gray-500 mt-1">Qty: {{ formatN(wo.quantity) }} • Minggu {{ wo.week_number || '-' }}</div>
              </div>
              <span class="text-xs px-2 py-0.5 rounded-full font-semibold ml-2"
                :class="woStatusBadge(wo.status)">
                {{ woStatusLabel(wo.status) }}
              </span>
            </div>
            <!-- Material readiness indicator -->
            <div class="mt-3">
              <div v-if="wo.materials_total > 0" class="flex items-center gap-2">
                <div class="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div class="h-full bg-emerald-500 rounded-full transition-all"
                    :style="{ width: (wo.materials_ready / wo.materials_total * 100) + '%' }"></div>
                </div>
                <span class="text-xs text-gray-500">{{ wo.materials_ready }}/{{ wo.materials_total }} issued</span>
              </div>
              <div v-else class="text-xs text-orange-500 font-medium">⚠ Material belum di-generate</div>
            </div>
          </div>
          <div v-if="!workOrders.length" class="col-span-3 text-center py-8 text-gray-400">
            <div class="text-4xl mb-2">📭</div>
            Tidak ada WO aktif (Planned / In Production)
          </div>
        </div>
      </div>

      <!-- Selected WO Detail Panel -->
      <div v-if="selectedWO" class="bg-white rounded-xl shadow-sm border border-gray-100">
        <!-- WO Header -->
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <div class="flex items-center gap-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-mono font-bold text-blue-700">{{ selectedWO.wo_number }}</span>
                <span class="text-sm font-semibold text-gray-800">— {{ selectedWO.product_name }}</span>
              </div>
              <div class="text-xs text-gray-500 mt-0.5">Qty: {{ formatN(selectedWO.quantity) }}</div>
            </div>
          </div>
          <div class="flex gap-2">
            <button @click="generateFromBOM"
              :disabled="generating"
              class="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-50">
              <span>{{ generating ? '⏳' : '🔧' }}</span>
              {{ generating ? 'Generating...' : 'Generate dari BOM' }}
            </button>
            <button @click="issueAllPending"
              :disabled="!pendingMaterials.length || issuingAll"
              class="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-50">
              <span>{{ issuingAll ? '⏳' : '✅' }}</span>
              Issue Semua ({{ pendingMaterials.length }})
            </button>
          </div>
        </div>

        <!-- Material List -->
        <div v-if="loadingMaterials" class="p-10 text-center">
          <div class="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>

        <div v-else-if="!woMaterials.length" class="p-10 text-center">
          <div class="text-4xl mb-3">📦</div>
          <p class="text-gray-600 font-semibold">Material belum di-generate</p>
          <p class="text-sm text-gray-400 mt-1">Klik "Generate dari BOM" untuk membuat daftar material dari BOM produk</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="min-w-full">
            <thead class="bg-gray-50 border-b border-gray-100">
              <tr>
                <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Material</th>
                <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Dibutuhkan</th>
                <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Stok</th>
                <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Sudah Issue</th>
                <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Sisa</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Gudang</th>
                <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <tr v-for="mat in woMaterials" :key="mat.id"
                class="hover:bg-gray-50 transition-colors"
                :class="mat.pending_qty <= 0 ? 'opacity-60' : ''">
                <td class="px-5 py-3">
                  <div class="font-semibold text-gray-900 text-sm">{{ mat.material_name }}</div>
                  <div class="text-xs text-gray-400 font-mono">{{ mat.material_sku }}</div>
                </td>
                <td class="px-4 py-3 text-right text-sm font-medium text-gray-800">{{ formatN(mat.quantity_required) }}</td>
                <td class="px-4 py-3 text-right text-sm">
                  <span :class="mat.stock_available >= mat.pending_qty ? 'text-emerald-600 font-semibold' : 'text-red-600 font-bold'">
                    {{ formatN(mat.stock_available) }}
                  </span>
                </td>
                <td class="px-4 py-3 text-right text-sm font-semibold text-emerald-600">{{ formatN(mat.quantity_issued || 0) }}</td>
                <td class="px-4 py-3 text-right text-sm">
                  <span v-if="mat.pending_qty > 0" class="font-bold text-red-600">{{ formatN(mat.pending_qty) }}</span>
                  <span v-else class="text-emerald-600 font-semibold">—</span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-500">{{ mat.warehouse_name || '—' }}</td>
                <td class="px-4 py-3 text-center">
                  <span v-if="mat.pending_qty <= 0"
                    class="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">✓ Done</span>
                  <span v-else-if="mat.stock_available < mat.pending_qty"
                    class="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">Stok Kurang</span>
                  <span v-else
                    class="px-2.5 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">Pending</span>
                </td>
                <td class="px-4 py-3 text-center">
                  <button v-if="mat.pending_qty > 0"
                    @click="openIssueModal(mat)"
                    class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all">
                    Issue
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>

    <!-- Issue Modal -->
    <Teleport to="body">
      <div v-if="issueModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 class="font-bold text-gray-900">Issue Material</h3>
            <button @click="issueModal = null" class="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
          </div>
          <div class="px-6 py-5 space-y-4">
            <div class="bg-gray-50 rounded-xl p-4">
              <div class="font-semibold text-gray-900">{{ issueModal.material_name }}</div>
              <div class="text-xs text-gray-400 font-mono mt-0.5">{{ issueModal.material_sku }}</div>
              <div class="flex justify-between mt-3 text-sm">
                <div><span class="text-gray-500">Dibutuhkan:</span> <strong>{{ formatN(issueModal.pending_qty) }}</strong></div>
                <div><span class="text-gray-500">Stok:</span>
                  <strong :class="issueModal.stock_available >= issueModal.pending_qty ? 'text-emerald-600' : 'text-red-600'">
                    {{ formatN(issueModal.stock_available) }}
                  </strong>
                </div>
              </div>
            </div>

            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-1.5">Jumlah yang Di-issue *</label>
              <input v-model.number="issueForm.quantity" type="number"
                :max="issueModal.pending_qty" :min="0.001" step="0.001"
                class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
              <div class="flex gap-2 mt-2">
                <button @click="issueForm.quantity = issueModal.pending_qty"
                  class="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg font-semibold">
                  Full ({{ formatN(issueModal.pending_qty) }})
                </button>
              </div>
            </div>

            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-1.5">Gudang Sumber</label>
              <select v-model="issueForm.warehouse_id"
                class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500">
                <option value="">— Pilih Gudang —</option>
                <option v-for="wh in warehouses" :key="wh.id" :value="wh.id">{{ wh.name }}</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-1.5">Batch Number <span class="text-gray-400">(opsional)</span></label>
              <input v-model="issueForm.batch_number" type="text" placeholder="cth: BATCH-2024-001"
                class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500" />
            </div>

            <!-- Stock warning -->
            <div v-if="issueModal.stock_available < issueModal.pending_qty"
              class="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              ⚠ Stok tidak cukup! Tersedia: {{ formatN(issueModal.stock_available) }}, Dibutuhkan: {{ formatN(issueModal.pending_qty) }}
            </div>
          </div>
          <div class="px-6 pb-5 flex gap-3">
            <button @click="issueModal = null"
              class="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Batal
            </button>
            <button @click="submitIssue"
              :disabled="submitting || !issueForm.quantity || issueForm.quantity <= 0"
              class="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50">
              {{ submitting ? '⏳ Proses...' : '✅ Konfirmasi Issue' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Toast -->
    <Teleport to="body">
      <Transition enter-active-class="transition-all duration-300" enter-from-class="opacity-0 translate-y-4"
        leave-active-class="transition-all duration-200" leave-to-class="opacity-0 translate-y-4">
        <div v-if="toast" class="fixed bottom-6 right-6 z-50">
          <div class="flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl text-white font-semibold text-sm"
            :class="toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'">
            <span>{{ toast.type === 'success' ? '✅' : '❌' }}</span>
            <span>{{ toast.msg }}</span>
            <button @click="toast = null" class="ml-2 opacity-70 hover:opacity-100">✕</button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api } from '../lib/api';
import { woStatusLabel, woStatusBadge, ISSUABLE_WO_STATUSES, normalizeWoStatus } from '../utils/woStatus';

// State
const loading = ref(false);
const loadingMaterials = ref(false);
const generating = ref(false);
const issuingAll = ref(false);
const submitting = ref(false);

const workOrders = ref<any[]>([]);
const warehouses = ref<any[]>([]);
const selectedWO = ref<any>(null);
const woMaterials = ref<any[]>([]);
const issueModal = ref<any>(null);
const toast = ref<{ msg: string; type: 'success' | 'error' } | null>(null);

const issueForm = ref({ quantity: 0, warehouse_id: '', batch_number: '' });

const pendingMaterials = computed(() => woMaterials.value.filter(m => m.pending_qty > 0));

const formatN = (n: number) => {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n);
};

const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
  toast.value = { msg, type };
  setTimeout(() => { toast.value = null; }, 4000);
};

// Load WOs + warehouses
const loadData = async () => {
  loading.value = true;
  try {
    const [woRes, whRes] = await Promise.all([
      api.get('/workorders'),
      api.get('/warehouses')
    ]);
    // Only WOs the backend will actually accept an issue for.
    //
    // This list used to mix DISPLAY LABELS into a VALUE test — 'Planned' and
    // 'In Production' are what the UI renders, never what the column holds, so
    // those two entries could not match anything and were pure noise. Worse, the
    // values it did match ('pending', 'planned') are statuses the backend now
    // REFUSES to issue against, so the screen offered WOs that could only fail,
    // while RELEASED — the one status issuing is actually for — was missing.
    //
    // Mirrors ISSUABLE_STATUSES in backend/src/utils/wo-transitions.ts.
    // normalizeWoStatus folds the legacy 'in-progress' spelling onto the
    // canonical one, so both match without listing each variant here.
    const allWOs = woRes.data.data || woRes.data || [];
    workOrders.value = allWOs.filter((w: any) =>
      ISSUABLE_WO_STATUSES.includes(normalizeWoStatus(w.status))
    );
    warehouses.value = whRes.data.data || whRes.data || [];
  } catch (err) {
    showToast('Gagal memuat data', 'error');
  } finally {
    loading.value = false;
  }
};

// Select WO and load its materials
const selectWO = async (wo: any) => {
  selectedWO.value = wo;
  await loadWOMaterials(wo.id);
};

const loadWOMaterials = async (woId: number) => {
  loadingMaterials.value = true;
  try {
    const res = await api.get(`/production/issue-material/wo/${woId}`);
    woMaterials.value = res.data.data || [];
    // Update progress on selected WO
    if (selectedWO.value) {
      selectedWO.value.materials_total = woMaterials.value.length;
      selectedWO.value.materials_ready = woMaterials.value.filter((m: any) => m.pending_qty <= 0).length;
    }
  } catch {
    showToast('Gagal memuat material WO', 'error');
  } finally {
    loadingMaterials.value = false;
  }
};

// Generate materials from BOM for selected WO
const generateFromBOM = async () => {
  if (!selectedWO.value) return;
  generating.value = true;
  try {
    await api.post(`/production/issue-material/generate/${selectedWO.value.id}`);
    showToast('✓ Material berhasil di-generate dari BOM');
    await loadWOMaterials(selectedWO.value.id);
    await loadData(); // refresh WO list progress
    // Re-select the same WO to keep it highlighted
    const refreshed = workOrders.value.find((w: any) => w.id === selectedWO.value.id);
    if (refreshed) selectedWO.value = refreshed;
  } catch (err: any) {
    showToast(err?.response?.data?.error || 'Gagal generate material dari BOM', 'error');
  } finally {
    generating.value = false;
  }
};

// Open issue modal for a single material
const openIssueModal = (mat: any) => {
  issueModal.value = mat;
  issueForm.value = {
    quantity: mat.pending_qty,
    warehouse_id: mat.warehouse_id || '',
    batch_number: ''
  };
};

// Submit issue for single material
const submitIssue = async () => {
  if (!issueModal.value || !issueForm.value.quantity) return;
  submitting.value = true;
  try {
    await api.post('/production/issue-material', {
      wo_material_id: issueModal.value.id,
      quantity: issueForm.value.quantity,
      warehouse_id: issueForm.value.warehouse_id || undefined,
      batch_number: issueForm.value.batch_number || undefined
    });
    showToast(`✓ ${issueModal.value.material_name} berhasil di-issue`);
    issueModal.value = null;
    await loadWOMaterials(selectedWO.value.id);
  } catch (err: any) {
    showToast(err?.response?.data?.error || 'Gagal issue material', 'error');
  } finally {
    submitting.value = false;
  }
};

// Issue all pending materials at once (using default qty)
const issueAllPending = async () => {
  if (!pendingMaterials.value.length) return;
  issuingAll.value = true;
  let success = 0;
  let failed = 0;
  for (const mat of pendingMaterials.value) {
    try {
      await api.post('/production/issue-material', {
        wo_material_id: mat.id,
        quantity: mat.pending_qty,
        warehouse_id: mat.warehouse_id || undefined
      });
      success++;
    } catch {
      failed++;
    }
  }
  issuingAll.value = false;
  await loadWOMaterials(selectedWO.value.id);
  if (failed === 0) showToast(`✅ ${success} material berhasil di-issue semua`);
  else showToast(`${success} berhasil, ${failed} gagal`, failed > 0 ? 'error' : 'success');
};

onMounted(() => { loadData(); });
</script>
