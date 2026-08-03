<template>
  <div class="min-h-screen bg-slate-50">
    <div class="bg-gradient-to-r from-violet-700 to-purple-600 px-6 py-4 text-white shadow-lg">
      <div class="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 class="text-xl font-bold">🔍 Batch Tracking</h1>
          <p class="text-violet-200 text-sm mt-0.5">Traceability batch material dari masuk hingga terpakai di produksi</p>
        </div>
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-4 py-6 space-y-5">
      <!-- Search -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 flex gap-3">
        <input v-model="search" @input="debouncedLoad" type="text" placeholder="Cari nomor batch, nama produk, atau SKU..."
          class="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-violet-400 focus:border-violet-400" />
        <button @click="loadBatches" class="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition-all">
          🔍 Cari
        </button>
      </div>

      <!-- List + Detail split -->
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <!-- Batch List -->
        <div class="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100">
          <div class="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 class="font-bold text-gray-800">Daftar Batch</h2>
            <span class="text-xs text-gray-400">{{ batches.length }} batch</span>
          </div>
          <div v-if="loading" class="p-8 text-center">
            <div class="w-7 h-7 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
          <div v-else class="overflow-y-auto max-h-[65vh] divide-y divide-gray-50">
            <div v-for="b in batches" :key="b.id"
              @click="selectBatch(b)"
              class="px-5 py-3.5 cursor-pointer hover:bg-violet-50 transition-colors"
              :class="selected?.id === b.id ? 'bg-violet-50 border-l-4 border-violet-500' : ''">
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="font-mono text-sm font-bold text-violet-700">{{ b.batch_number }}</div>
                  <div class="text-sm text-gray-700 mt-0.5">{{ b.product_name }}</div>
                  <div class="text-xs text-gray-400 mt-0.5">{{ b.product_sku }} · {{ b.warehouse_name || '—' }}</div>
                </div>
                <div class="text-right ml-2">
                  <div class="text-sm font-bold text-gray-800">{{ fmtN(b.quantity) }}</div>
                  <span class="text-xs px-1.5 py-0.5 rounded font-semibold"
                    :class="b.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'">
                    {{ b.status }}
                  </span>
                </div>
              </div>
              <div v-if="b.expiry_date" class="mt-1.5 text-xs"
                :class="daysLeft(b.expiry_date) < 0 ? 'text-red-600' : daysLeft(b.expiry_date) < 30 ? 'text-orange-500' : 'text-gray-400'">
                Exp: {{ b.expiry_date }} ({{ daysLeft(b.expiry_date) < 0 ? 'Expired' : daysLeft(b.expiry_date) + 'd' }})
              </div>
              <div class="text-xs text-gray-400 mt-1">{{ b.movement_count || 0 }} pergerakan</div>
            </div>
            <div v-if="!batches.length" class="p-8 text-center text-gray-400">
              <div class="text-3xl mb-2">📦</div>
              Tidak ada batch ditemukan
            </div>
          </div>
        </div>

        <!-- Batch Detail -->
        <div class="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100">
          <div v-if="!selected" class="flex flex-col items-center justify-center h-full py-20 text-gray-400">
            <div class="text-5xl mb-3">🔍</div>
            <p class="font-semibold">Pilih batch untuk melihat detail</p>
            <p class="text-sm mt-1">Klik salah satu batch di sebelah kiri</p>
          </div>
          <template v-else>
            <div class="px-5 py-4 border-b border-gray-100">
              <div class="flex items-start justify-between">
                <div>
                  <div class="font-mono font-bold text-violet-700 text-lg">{{ selected.batch_number }}</div>
                  <div class="font-semibold text-gray-900 mt-0.5">{{ selected.product_name }}</div>
                </div>
                <span class="px-3 py-1 rounded-full text-xs font-bold"
                  :class="selected.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'">
                  {{ selected.status }}
                </span>
              </div>
            </div>

            <!-- Info Grid -->
            <div class="p-5 grid grid-cols-2 gap-3">
              <div class="bg-gray-50 rounded-xl p-3">
                <div class="text-xs text-gray-500 uppercase font-semibold">Qty Tersisa</div>
                <div class="text-xl font-black text-gray-900 mt-0.5">{{ fmtN(selected.quantity) }}</div>
              </div>
              <div class="bg-gray-50 rounded-xl p-3">
                <div class="text-xs text-gray-500 uppercase font-semibold">Gudang</div>
                <div class="text-sm font-bold text-gray-800 mt-0.5">{{ selected.warehouse_name || '—' }}</div>
              </div>
              <div class="bg-gray-50 rounded-xl p-3">
                <div class="text-xs text-gray-500 uppercase font-semibold">Tgl Produksi</div>
                <div class="text-sm font-bold text-gray-800 mt-0.5">{{ selected.manufacture_date || '—' }}</div>
              </div>
              <div class="rounded-xl p-3"
                :class="selected.expiry_date && daysLeft(selected.expiry_date) < 0 ? 'bg-red-50' : selected.expiry_date && daysLeft(selected.expiry_date) < 30 ? 'bg-orange-50' : 'bg-gray-50'">
                <div class="text-xs text-gray-500 uppercase font-semibold">Kadaluarsa</div>
                <div class="text-sm font-bold mt-0.5"
                  :class="selected.expiry_date && daysLeft(selected.expiry_date) < 0 ? 'text-red-600' : 'text-gray-800'">
                  {{ selected.expiry_date || '—' }}
                </div>
              </div>
            </div>

            <!-- Movement History -->
            <div class="px-5 pb-5">
              <h4 class="font-bold text-gray-800 mb-3 flex items-center gap-2">
                📋 Riwayat Pergerakan
                <span class="text-xs text-gray-400 font-normal">({{ movements.length }} transaksi)</span>
              </h4>
              <div v-if="loadingMov" class="text-center py-4">
                <div class="w-5 h-5 border-3 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
              <div v-else-if="!movements.length" class="text-sm text-gray-400 text-center py-4">Tidak ada riwayat pergerakan</div>
              <div v-else class="space-y-2 max-h-60 overflow-y-auto pr-1">
                <div v-for="m in movements" :key="m.id"
                  class="flex items-start gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div class="mt-0.5 w-6 h-6 flex items-center justify-center rounded-full text-xs"
                    :class="m.movement_type === 'in' || m.movement_type === 'receipt' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'">
                    {{ m.movement_type === 'in' || m.movement_type === 'receipt' ? '↓' : '↑' }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold uppercase"
                        :class="m.movement_type === 'in' || m.movement_type === 'receipt' ? 'text-emerald-600' : 'text-red-600'">
                        {{ m.movement_type }}
                      </span>
                      <span class="text-sm font-bold text-gray-800">{{ fmtN(m.quantity) }}</span>
                    </div>
                    <div class="text-xs text-gray-500 truncate mt-0.5">{{ m.notes || m.reference_type || '—' }}</div>
                    <div class="text-xs text-gray-400 mt-0.5">{{ m.created_by_name || '—' }} · {{ fmtDate(m.created_at) }}</div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../lib/api';

const loading = ref(false);
const loadingMov = ref(false);
const batches = ref<any[]>([]);
const selected = ref<any>(null);
const movements = ref<any[]>([]);
const search = ref('');
let debounce: any = null;

const fmtN = (v: any) => Number(v || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 });
const fmtDate = (d: string) => d ? new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const daysLeft = (date: string) => {
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const loadBatches = async () => {
  loading.value = true;
  try {
    const q = search.value ? `?search=${encodeURIComponent(search.value)}` : '';
    const res = await api.get(`/inventory/batch-tracking${q}`);
    batches.value = res.data.data || [];
  } catch {
    batches.value = [];
  } finally {
    loading.value = false;
  }
};

const debouncedLoad = () => {
  clearTimeout(debounce);
  debounce = setTimeout(loadBatches, 400);
};

const selectBatch = async (b: any) => {
  selected.value = b;
  movements.value = [];
  loadingMov.value = true;
  try {
    const res = await api.get(`/inventory/batch-tracking/${encodeURIComponent(b.batch_number)}/movements`);
    movements.value = res.data.data || [];
  } catch {
    movements.value = [];
  } finally {
    loadingMov.value = false;
  }
};

onMounted(loadBatches);
</script>
