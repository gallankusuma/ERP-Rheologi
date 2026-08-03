<template>
  <div class="min-h-screen bg-slate-50">
    <div class="bg-gradient-to-r from-rose-700 to-orange-600 px-6 py-4 text-white shadow-lg">
      <div class="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 class="text-xl font-bold">🗓️ Expiry Monitoring</h1>
          <p class="text-rose-200 text-sm mt-0.5">Pantau tanggal kadaluarsa batch material</p>
        </div>
        <div class="flex items-center gap-3">
          <select v-model="daysFilter" @change="load"
            class="px-3 py-1.5 rounded-lg bg-white/20 border border-white/30 text-sm text-white focus:outline-none">
            <option value="30">≤ 30 hari</option>
            <option value="60">≤ 60 hari</option>
            <option value="90">≤ 90 hari</option>
            <option value="180">≤ 180 hari</option>
            <option value="9999">Semua</option>
          </select>
          <button @click="load" class="px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-semibold">🔄 Refresh</button>
        </div>
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <!-- Stats -->
      <div v-if="stats" class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div class="bg-red-600 rounded-2xl p-4 text-white shadow">
          <div class="text-3xl font-black">{{ stats.expired }}</div>
          <div class="text-red-200 text-xs font-semibold mt-1 uppercase">Sudah Kadaluarsa</div>
        </div>
        <div class="bg-orange-500 rounded-2xl p-4 text-white shadow">
          <div class="text-3xl font-black">{{ stats.critical }}</div>
          <div class="text-orange-200 text-xs font-semibold mt-1 uppercase">Kritis ≤30 hari</div>
        </div>
        <div class="bg-amber-400 rounded-2xl p-4 text-white shadow">
          <div class="text-3xl font-black">{{ stats.warning }}</div>
          <div class="text-amber-100 text-xs font-semibold mt-1 uppercase">Peringatan ≤90 hari</div>
        </div>
        <div class="bg-emerald-500 rounded-2xl p-4 text-white shadow">
          <div class="text-3xl font-black">{{ stats.ok }}</div>
          <div class="text-emerald-200 text-xs font-semibold mt-1 uppercase">Aman > 90 hari</div>
        </div>
      </div>

      <!-- Filter -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 flex gap-3 flex-wrap">
        <input v-model="search" type="text" placeholder="Cari batch / produk..."
          class="flex-1 min-w-48 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-rose-400 focus:border-rose-400" />
        <div class="flex gap-2">
          <button v-for="s in ['all','expired','critical','warning','ok']" :key="s"
            @click="statusFilter = s"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            :class="statusFilter === s
              ? 'bg-rose-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'">
            {{ s === 'all' ? 'Semua' : s === 'expired' ? '🔴 Expired' : s === 'critical' ? '🟠 Kritis' : s === 'warning' ? '🟡 Warning' : '🟢 Aman' }}
          </button>
        </div>
      </div>

      <!-- Table -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div v-if="loading" class="p-10 text-center">
          <div class="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
        <div v-else-if="!filtered.length" class="p-10 text-center text-gray-400">
          <div class="text-4xl mb-2">✅</div>
          Tidak ada batch yang perlu diperhatikan
        </div>
        <div v-else class="overflow-x-auto">
          <table class="min-w-full">
            <thead class="bg-gray-50 border-b border-gray-100">
              <tr>
                <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Batch</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Produk</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Gudang</th>
                <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Qty</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tgl Produksi</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Kadaluarsa</th>
                <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Sisa</th>
                <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <tr v-for="b in filtered" :key="b.id" class="hover:bg-gray-50 transition-colors">
                <td class="px-5 py-3 font-mono text-sm font-bold text-gray-700">{{ b.batch_number }}</td>
                <td class="px-4 py-3">
                  <div class="text-sm font-semibold text-gray-900">{{ b.product_name }}</div>
                  <div class="text-xs text-gray-400">{{ b.product_sku }}</div>
                </td>
                <td class="px-4 py-3 text-sm text-gray-600">{{ b.warehouse_name || '—' }}</td>
                <td class="px-4 py-3 text-right text-sm font-semibold text-gray-800">{{ fmtN(b.quantity) }}</td>
                <td class="px-4 py-3 text-sm text-gray-500">{{ b.manufacture_date || '—' }}</td>
                <td class="px-4 py-3 text-sm font-semibold"
                  :class="b.expiry_status === 'expired' ? 'text-red-600' : b.expiry_status === 'critical' ? 'text-orange-600' : 'text-gray-700'">
                  {{ b.expiry_date }}
                </td>
                <td class="px-4 py-3 text-center">
                  <span class="text-sm font-bold"
                    :class="b.days_to_expiry < 0 ? 'text-red-600' : b.days_to_expiry <= 30 ? 'text-orange-600' : b.days_to_expiry <= 90 ? 'text-amber-600' : 'text-emerald-600'">
                    {{ b.days_to_expiry < 0 ? `${Math.abs(b.days_to_expiry)}h lalu` : b.days_to_expiry + ' hari' }}
                  </span>
                </td>
                <td class="px-4 py-3 text-center">
                  <span class="px-2.5 py-1 rounded-full text-xs font-bold"
                    :class="{
                      'bg-red-100 text-red-700': b.expiry_status === 'expired',
                      'bg-orange-100 text-orange-700': b.expiry_status === 'critical',
                      'bg-amber-100 text-amber-700': b.expiry_status === 'warning',
                      'bg-emerald-100 text-emerald-700': b.expiry_status === 'ok',
                    }">
                    {{ b.expiry_status === 'expired' ? '🔴 Expired' : b.expiry_status === 'critical' ? '🟠 Kritis' : b.expiry_status === 'warning' ? '🟡 Warning' : '🟢 Aman' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
            {{ filtered.length }} batch ditampilkan
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api } from '../lib/api';

const loading = ref(true);
const batches = ref<any[]>([]);
const stats = ref<any>(null);
const daysFilter = ref('90');
const statusFilter = ref('all');
const search = ref('');

const fmtN = (v: any) => Number(v || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 });

const filtered = computed(() => {
  let res = batches.value;
  if (statusFilter.value !== 'all') res = res.filter(b => b.expiry_status === statusFilter.value);
  if (search.value) {
    const q = search.value.toLowerCase();
    res = res.filter(b => b.batch_number?.toLowerCase().includes(q) || b.product_name?.toLowerCase().includes(q));
  }
  return res;
});

const load = async () => {
  loading.value = true;
  try {
    const res = await api.get(`/inventory/expiry?days=${daysFilter.value}`);
    batches.value = res.data.data?.batches || [];
    stats.value = res.data.data?.stats || null;
  } catch {
    batches.value = [];
  } finally {
    loading.value = false;
  }
};

onMounted(load);
</script>
