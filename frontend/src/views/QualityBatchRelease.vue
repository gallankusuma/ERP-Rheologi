<template>
  <div>
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-gray-900">Batch Release</h2>
      <p class="text-sm text-gray-500 mt-1">Release, reject, or hold batches based on QC FPA results</p>
    </div>

    <div v-if="loading" class="text-center py-10"><div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>

    <div v-else>
      <!-- Summary cards -->
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        <div class="bg-white shadow rounded-lg p-4 border-l-4 border-gray-300">
          <p class="text-xs text-gray-500 uppercase">Total</p>
          <p class="text-2xl font-bold">{{ batches.length }}</p>
        </div>
        <div class="bg-white shadow rounded-lg p-4 border-l-4 border-yellow-400 cursor-pointer hover:shadow-md" @click="statusFilter = 'pending'">
          <p class="text-xs text-yellow-600 uppercase">Pending QC</p>
          <p class="text-2xl font-bold text-yellow-700">{{ batches.filter(b => !b.fpa_id || b.fpa_status !== 'Approved').length }}</p>
        </div>
        <div class="bg-white shadow rounded-lg p-4 border-l-4 border-green-400 cursor-pointer hover:shadow-md" @click="statusFilter = 'released'">
          <p class="text-xs text-green-600 uppercase">Released</p>
          <p class="text-2xl font-bold text-green-700">{{ batches.filter(b => b.status === 'released').length }}</p>
        </div>
        <div class="bg-white shadow rounded-lg p-4 border-l-4 border-orange-400 cursor-pointer hover:shadow-md" @click="statusFilter = 'on_hold'">
          <p class="text-xs text-orange-600 uppercase">On Hold</p>
          <p class="text-2xl font-bold text-orange-700">{{ batches.filter(b => b.status === 'on_hold').length }}</p>
        </div>
        <div class="bg-white shadow rounded-lg p-4 border-l-4 border-red-400 cursor-pointer hover:shadow-md" @click="statusFilter = 'rejected'">
          <p class="text-xs text-red-600 uppercase">Rejected</p>
          <p class="text-2xl font-bold text-red-700">{{ batches.filter(b => b.status === 'rejected').length }}</p>
        </div>
      </div>

      <!-- Filter -->
      <div class="mb-4 flex flex-wrap gap-2 items-center">
        <button v-for="s in filterOptions" :key="s.key"
          @click="statusFilter = s.key"
          :class="statusFilter === s.key ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-700 hover:bg-blue-50'"
          class="px-3 py-1.5 rounded-lg text-sm border transition-all">
          {{ s.label }}
        </button>
        <div class="ml-auto">
          <input v-model="search" type="text" placeholder="🔍 Search batch/product..." class="px-3 py-1.5 border rounded-lg text-sm w-56 focus:ring-blue-500 focus:border-blue-500" />
        </div>
      </div>

      <div class="bg-white shadow rounded-lg overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch No.</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">FPA Status</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tests</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Batch Status</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-for="b in filteredBatches" :key="b.id" class="hover:bg-gray-50 transition-colors">
              <td class="px-4 py-3 text-sm font-medium text-gray-900">
                {{ b.batch_number }}
                <div v-if="b.fpa_number" class="text-xs text-blue-600 cursor-pointer hover:underline" @click="goToFpa(b.fpa_id)">
                  {{ b.fpa_number }}
                </div>
              </td>
              <td class="px-4 py-3 text-sm text-gray-600">
                {{ b.product_name }}
                <div class="text-xs text-gray-400">{{ b.sku }}</div>
              </td>
              <td class="px-4 py-3 text-sm text-right font-mono">{{ b.quantity?.toLocaleString() }}</td>
              <td class="px-4 py-3 text-center">
                <span v-if="!b.fpa_id" class="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">No FPA</span>
                <span v-else :class="fpaStatusBadge(b.fpa_status)" class="px-2 py-1 rounded-full text-xs font-medium">{{ b.fpa_status }}</span>
              </td>
              <td class="px-4 py-3 text-center text-sm">
                <span v-if="b.total_tests > 0">
                  <span class="text-green-600 font-medium">{{ b.tests_passed ?? 0 }}✓</span>
                  <span v-if="b.tests_failed > 0" class="text-red-600 font-medium ml-1">{{ b.tests_failed }}✗</span>
                  <span class="text-gray-400 ml-1">/ {{ b.total_tests }}</span>
                </span>
                <span v-else class="text-gray-400">—</span>
              </td>
              <td class="px-4 py-3 text-center">
                <span :class="statusBadge(b.status)" class="px-2 py-1 rounded-full text-xs font-bold uppercase">{{ formatStatus(b.status) }}</span>
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-1">
                  <button v-if="canRelease(b)" @click="action('release', b)" class="px-2.5 py-1 bg-green-50 text-green-700 rounded-md text-xs font-medium hover:bg-green-100 border border-green-200 transition-colors">
                    ✅ Release
                  </button>
                  <button v-if="b.status !== 'on_hold'" @click="action('hold', b)" class="px-2.5 py-1 bg-yellow-50 text-yellow-700 rounded-md text-xs font-medium hover:bg-yellow-100 border border-yellow-200 transition-colors">
                    ⏸ Hold
                  </button>
                  <button v-if="b.status !== 'rejected'" @click="action('reject', b)" class="px-2.5 py-1 bg-red-50 text-red-700 rounded-md text-xs font-medium hover:bg-red-100 border border-red-200 transition-colors">
                    ❌ Reject
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!filteredBatches.length"><td colspan="7" class="text-center py-8 text-gray-400">No batches found</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Action Confirmation Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h3 class="text-lg font-bold mb-2" :class="modalAction === 'release' ? 'text-green-700' : modalAction === 'reject' ? 'text-red-700' : 'text-yellow-700'">
          {{ modalAction === 'release' ? '✅ Release Batch' : modalAction === 'reject' ? '❌ Reject Batch' : '⏸ Hold Batch' }}
        </h3>
        <p class="text-sm text-gray-600 mb-1">Batch: <strong>{{ modalBatch?.batch_number }}</strong></p>
        <p class="text-sm text-gray-600 mb-4">Product: {{ modalBatch?.product_name }}</p>
        
        <div v-if="modalAction === 'release' && !canRelease(modalBatch)" class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <p class="text-sm text-yellow-700 font-medium">⚠️ Warning: FPA belum fully approved. Release tanpa QC approval?</p>
        </div>

        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
          <textarea v-model="modalNotes" rows="3" class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500" placeholder="Catatan release/reject..."></textarea>
        </div>
        <div class="flex justify-end gap-2">
          <button @click="showModal = false" class="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
          <button @click="confirmAction" :disabled="saving"
            :class="modalAction === 'release' ? 'bg-green-600 hover:bg-green-700' : modalAction === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-500 hover:bg-yellow-600'"
            class="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50">
            {{ saving ? 'Processing...' : 'Confirm' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../lib/api';

const router = useRouter();
const loading = ref(true);
const batches = ref<any[]>([]);
const statusFilter = ref('all');
const search = ref('');
const showModal = ref(false);
const modalAction = ref('');
const modalBatch = ref<any>(null);
const modalNotes = ref('');
const saving = ref(false);

const filterOptions = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: '🟡 Pending QC' },
  { key: 'released', label: '🟢 Released' },
  { key: 'on_hold', label: '🟠 On Hold' },
  { key: 'rejected', label: '🔴 Rejected' },
];

const filteredBatches = computed(() => {
  let list = batches.value;
  if (statusFilter.value === 'pending') {
    list = list.filter(b => !b.fpa_id || b.fpa_status !== 'Approved');
  } else if (statusFilter.value !== 'all') {
    list = list.filter(b => b.status === statusFilter.value);
  }
  if (search.value) {
    const q = search.value.toLowerCase();
    list = list.filter(b => 
      b.batch_number?.toLowerCase().includes(q) || 
      b.product_name?.toLowerCase().includes(q) ||
      b.fpa_number?.toLowerCase().includes(q)
    );
  }
  return list;
});

const fpaStatusBadge = (s: string) => ({
  'bg-green-100 text-green-800': s === 'Approved',
  'bg-blue-100 text-blue-800': s === 'Sample Diterima',
  'bg-yellow-100 text-yellow-800': s === 'Pending',
  'bg-orange-100 text-orange-800': s === 'On Progress',
  'bg-red-100 text-red-800': s === 'Rejected',
});

const statusBadge = (s: string) => ({
  'bg-green-100 text-green-800': s === 'released',
  'bg-yellow-100 text-yellow-800': s === 'on_hold' || s === 'pending' || s === 'active',
  'bg-red-100 text-red-800': s === 'rejected',
  'bg-gray-100 text-gray-600': !['released', 'on_hold', 'pending', 'rejected', 'active'].includes(s),
});

const formatStatus = (s: string) => {
  if (!s) return '—';
  return s.replace(/_/g, ' ');
};

const canRelease = (b: any) => {
  if (!b) return false;
  return b.status !== 'released' && b.fpa_status === 'Approved';
};

const goToFpa = (id: number) => {
  if (id) router.push(`/qc/fpa/${id}`);
};

const load = async () => {
  loading.value = true;
  try {
    const res = await api.get('/quality/batch-release');
    batches.value = res.data.data || [];
  } catch (err) {
    console.error('Error loading batch release:', err);
  } finally {
    loading.value = false;
  }
};

const action = (type: string, batch: any) => {
  modalAction.value = type;
  modalBatch.value = batch;
  modalNotes.value = '';
  showModal.value = true;
};

const confirmAction = async () => {
  if (!modalBatch.value) return;
  saving.value = true;
  try {
    await api.post(`/quality/batch-release/${modalBatch.value.id}/${modalAction.value}`, { notes: modalNotes.value });
    showModal.value = false;
    await load();
  } catch (err) {
    alert('Action failed');
  } finally {
    saving.value = false;
  }
};

onMounted(load);
</script>
