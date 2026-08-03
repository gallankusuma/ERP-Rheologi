<template>
  <div class="min-h-screen bg-slate-50">
    <!-- Header -->
    <div class="bg-gradient-to-br from-indigo-800 via-blue-700 to-cyan-600 px-6 py-5 text-white shadow-lg">
      <div class="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 class="text-2xl font-bold tracking-tight">📦 Inventory Dashboard</h1>
          <p class="text-blue-200 text-sm mt-0.5">Real-time overview stok, valuasi, dan alert</p>
        </div>
        <button @click="load" :disabled="loading" class="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold transition-all">
          {{ loading ? '⏳' : '🔄 Refresh' }}
        </button>
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-20">
        <div class="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>

      <template v-else-if="kpi">
        <!-- KPI Cards -->
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div class="col-span-2 md:col-span-1 bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col">
            <div class="text-3xl font-black text-indigo-700">{{ fmt(kpi.summary?.total_skus) }}</div>
            <div class="text-xs text-gray-500 mt-1 font-semibold uppercase tracking-wide">Total SKU</div>
            <div class="text-xs text-gray-400 mt-0.5">{{ fmt(kpi.summary?.total_warehouses) }} gudang</div>
          </div>
          <div class="col-span-2 md:col-span-1 bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col">
            <div class="text-3xl font-black text-emerald-700">{{ fmtN(kpi.summary?.total_quantity) }}</div>
            <div class="text-xs text-gray-500 mt-1 font-semibold uppercase tracking-wide">Total Qty</div>
            <div class="text-xs text-gray-400 mt-0.5">semua gudang</div>
          </div>
          <div class="col-span-2 md:col-span-1 bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col">
            <div class="text-2xl font-black text-purple-700">{{ fmtC(kpi.summary?.total_valuation) }}</div>
            <div class="text-xs text-gray-500 mt-1 font-semibold uppercase tracking-wide">Total Valuasi</div>
            <div class="text-xs text-gray-400 mt-0.5">harga pokok</div>
          </div>
          <div class="col-span-1 bg-orange-50 border border-orange-200 rounded-2xl p-5 shadow-sm flex flex-col">
            <div class="text-3xl font-black text-orange-600">{{ fmt(kpi.summary?.low_stock_count) }}</div>
            <div class="text-xs text-orange-600 mt-1 font-semibold uppercase tracking-wide">Low Stock</div>
            <div class="text-xs text-orange-400 mt-0.5">di bawah reorder</div>
          </div>
          <div class="col-span-1 bg-red-50 border border-red-200 rounded-2xl p-5 shadow-sm flex flex-col">
            <div class="text-3xl font-black text-red-600">{{ fmt(kpi.summary?.out_of_stock_count) }}</div>
            <div class="text-xs text-red-600 mt-1 font-semibold uppercase tracking-wide">Habis</div>
            <div class="text-xs text-red-400 mt-0.5">stok = 0</div>
          </div>
          <div class="col-span-1 bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm flex flex-col">
            <div class="text-3xl font-black text-amber-600">{{ fmt(kpi.expiryAlerts?.length) }}</div>
            <div class="text-xs text-amber-600 mt-1 font-semibold uppercase tracking-wide">Expiry Alert</div>
            <div class="text-xs text-amber-400 mt-0.5">≤ 90 hari</div>
          </div>
        </div>

        <!-- Row 2: Low Stock + Warehouse -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Low Stock Alerts -->
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div class="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <h3 class="font-bold text-gray-800">⚠️ Low Stock Alerts</h3>
              <span class="text-xs text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full font-semibold">{{ kpi.lowStock?.length || 0 }} item</span>
            </div>
            <div v-if="!kpi.lowStock?.length" class="p-8 text-center text-gray-400">
              <div class="text-3xl mb-2">✅</div>Semua stok aman
            </div>
            <div v-else class="divide-y divide-gray-50">
              <div v-for="item in kpi.lowStock" :key="item.sku" class="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <div class="text-sm font-semibold text-gray-900">{{ item.name }}</div>
                  <div class="text-xs text-gray-400">{{ item.sku }} · {{ item.warehouse_name }}</div>
                </div>
                <div class="text-right">
                  <div class="text-sm font-bold text-red-600">{{ fmtN(item.quantity) }}</div>
                  <div class="text-xs text-gray-400">min {{ fmtN(item.reorder_point) }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Warehouse Distribution -->
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div class="px-5 py-4 border-b border-gray-50">
              <h3 class="font-bold text-gray-800">🏭 Distribusi per Gudang</h3>
            </div>
            <div class="p-5 space-y-4">
              <div v-for="w in kpi.byWarehouse" :key="w.warehouse_name">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-sm font-semibold text-gray-700">{{ w.warehouse_name }}</span>
                  <span class="text-xs text-gray-500">{{ fmt(w.products) }} SKU</span>
                </div>
                <div class="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div class="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all"
                    :style="{ width: whPct(w.valuation) }"></div>
                </div>
                <div class="text-xs text-gray-400 mt-0.5">{{ fmtC(w.valuation) }} · {{ fmtN(w.total_qty) }} unit</div>
              </div>
              <div v-if="!kpi.byWarehouse?.length" class="text-center py-4 text-gray-400 text-sm">Tidak ada data</div>
            </div>
          </div>
        </div>

        <!-- Row 3: Top Items + Expiry Alerts -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Top Value Items -->
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div class="px-5 py-4 border-b border-gray-50">
              <h3 class="font-bold text-gray-800">💎 Top 10 Nilai Tertinggi</h3>
            </div>
            <div class="divide-y divide-gray-50">
              <div v-for="(item, i) in (kpi.topItems || [])" :key="item.sku"
                class="px-5 py-3 flex items-center gap-3 hover:bg-gray-50">
                <span class="w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold"
                  :class="i < 3 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'">{{ i + 1 }}</span>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-semibold text-gray-900 truncate">{{ item.name }}</div>
                  <div class="text-xs text-gray-400">{{ item.sku }} · {{ fmtN(item.quantity) }}</div>
                </div>
                <div class="text-sm font-bold text-purple-700">{{ fmtC(item.value) }}</div>
              </div>
              <div v-if="!kpi.topItems?.length" class="p-8 text-center text-gray-400 text-sm">Tidak ada data</div>
            </div>
          </div>

          <!-- Expiry Alerts -->
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div class="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <h3 class="font-bold text-gray-800">🗓️ Akan Kadaluarsa (≤90 hari)</h3>
              <router-link to="/inventory/expiry" class="text-xs text-indigo-600 hover:text-indigo-800 font-semibold">Lihat Semua →</router-link>
            </div>
            <div v-if="!kpi.expiryAlerts?.length" class="p-8 text-center text-gray-400">
              <div class="text-3xl mb-2">✅</div>Tidak ada yang mau kadaluarsa
            </div>
            <div v-else class="divide-y divide-gray-50">
              <div v-for="b in kpi.expiryAlerts" :key="b.batch_number"
                class="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <div class="text-sm font-semibold text-gray-900">{{ b.product_name }}</div>
                  <div class="text-xs text-gray-400">{{ b.batch_number }} · {{ b.warehouse_name }}</div>
                </div>
                <div class="text-right">
                  <div class="text-xs font-bold px-2 py-0.5 rounded-full"
                    :class="b.days_to_expiry < 0 ? 'bg-red-100 text-red-700' : b.days_to_expiry <= 30 ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'">
                    {{ b.days_to_expiry < 0 ? 'Expired' : b.days_to_expiry + 'd' }}
                  </div>
                  <div class="text-xs text-gray-400 mt-0.5">{{ b.expiry_date }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Recent Movements Mini Chart -->
        <div v-if="kpi.recentMovements?.length" class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 class="font-bold text-gray-800 mb-4">📊 Pergerakan 7 Hari Terakhir</h3>
          <div class="flex items-end gap-2 h-20">
            <div v-for="m in kpi.recentMovements" :key="m.date" class="flex-1 flex flex-col items-center gap-1">
              <div class="w-full flex flex-col items-center gap-0.5">
                <div class="w-full bg-emerald-400 rounded-t" :style="{ height: barH(m.inbound) + 'px' }" :title="`In: ${fmtN(m.inbound)}`"></div>
                <div class="w-full bg-red-300 rounded-b" :style="{ height: barH(m.outbound) + 'px' }" :title="`Out: ${fmtN(m.outbound)}`"></div>
              </div>
              <div class="text-xs text-gray-400">{{ shortDate(m.date) }}</div>
            </div>
          </div>
          <div class="flex gap-4 mt-2 text-xs">
            <span class="flex items-center gap-1"><span class="w-3 h-2 bg-emerald-400 rounded inline-block"></span>Masuk</span>
            <span class="flex items-center gap-1"><span class="w-3 h-2 bg-red-300 rounded inline-block"></span>Keluar</span>
          </div>
        </div>
      </template>

      <div v-else class="text-center py-20 text-gray-400">Gagal memuat data KPI</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../lib/api';

const loading = ref(true);
const kpi = ref<any>(null);

const fmt = (v: any) => Number(v || 0).toLocaleString('id-ID');
const fmtN = (v: any) => Number(v || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 });
const fmtC = (v: any) => 'Rp ' + Number(v || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 });

const maxWh = computed(() => Math.max(...(kpi.value?.byWarehouse || []).map((w: any) => Number(w.valuation || 0)), 1));
const whPct = (val: number) => `${Math.round((val / maxWh.value) * 100)}%`;

const maxMov = computed(() => {
  const vals = (kpi.value?.recentMovements || []).flatMap((m: any) => [Number(m.inbound), Number(m.outbound)]);
  return Math.max(...vals, 1);
});
const barH = (v: number) => Math.max(Math.round((Number(v) / maxMov.value) * 36), 2);
const shortDate = (d: string) => d ? d.slice(5) : '';

const load = async () => {
  loading.value = true;
  try {
    const res = await api.get('/inventory/kpi');
    kpi.value = res.data.data;
  } catch {
    kpi.value = null;
  } finally {
    loading.value = false;
  }
};

onMounted(load);
</script>
