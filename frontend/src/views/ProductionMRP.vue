<template>
  <div class="min-h-screen bg-slate-50">
    <!-- Header -->
    <div class="bg-gradient-to-r from-blue-700 to-blue-900 text-white px-6 py-4 shadow-lg">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 class="text-xl font-bold tracking-wide">📦 Material Requirement Planning</h1>
          <p class="text-sm text-blue-200 mt-0.5">Kesiapan material untuk Work Orders aktif</p>
        </div>
        <div class="flex items-center gap-3">
          <select v-model="selectedYear" @change="loadDashboard"
            class="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:ring-2 focus:ring-white/30">
            <option v-for="y in yearOptions" :key="y" :value="y" class="text-gray-900">{{ y }}</option>
          </select>
          <button @click="loadDashboard" :disabled="loading"
            class="px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-semibold transition-all">
            {{ loading ? '⏳' : '🔄 Refresh' }}
          </button>
        </div>
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-20">
        <div class="text-center">
          <div class="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p class="text-gray-500">Menghitung kebutuhan material...</p>
        </div>
      </div>

      <template v-else>
        <!-- Summary Cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-500 font-medium">Work Orders Aktif</p>
                <p class="text-3xl font-bold text-blue-700 mt-1">{{ summary.totalWOs }}</p>
              </div>
              <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl">📋</div>
            </div>
          </div>
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-500 font-medium">Jenis Material</p>
                <p class="text-3xl font-bold text-indigo-700 mt-1">{{ summary.totalMaterials }}</p>
              </div>
              <div class="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-2xl">🧪</div>
            </div>
          </div>
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4" :class="summary.shortMaterials > 0 ? 'border-red-200 bg-red-50' : ''">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium" :class="summary.shortMaterials > 0 ? 'text-red-600' : 'text-gray-500'">Material Kurang</p>
                <p class="text-3xl font-bold mt-1" :class="summary.shortMaterials > 0 ? 'text-red-700' : 'text-emerald-700'">
                  {{ summary.shortMaterials }}
                </p>
              </div>
              <div class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                :class="summary.shortMaterials > 0 ? 'bg-red-100' : 'bg-emerald-100'">
                {{ summary.shortMaterials > 0 ? '🚨' : '✅' }}
              </div>
            </div>
          </div>
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4" :class="summary.woWithShortage > 0 ? 'border-orange-200 bg-orange-50' : ''">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium" :class="summary.woWithShortage > 0 ? 'text-orange-600' : 'text-gray-500'">WO Terkendala</p>
                <p class="text-3xl font-bold mt-1" :class="summary.woWithShortage > 0 ? 'text-orange-700' : 'text-emerald-700'">
                  {{ summary.woWithShortage }}
                </p>
              </div>
              <div class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                :class="summary.woWithShortage > 0 ? 'bg-orange-100' : 'bg-emerald-100'">
                {{ summary.woWithShortage > 0 ? '⚠️' : '🎯' }}
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="!materials.length && !workOrders.length" class="bg-white rounded-xl shadow-sm border border-gray-100 p-16 text-center">
          <div class="text-6xl mb-4">📭</div>
          <h3 class="text-lg font-semibold text-gray-700">Tidak ada WO aktif</h3>
          <p class="text-sm text-gray-400 mt-2">WO yang sudah Released, In Production atau On Hold akan ditampilkan di sini</p>
          <p class="text-xs text-gray-400 mt-1">Pastikan BOM produk sudah di-approve</p>
        </div>

        <div v-else class="grid grid-cols-1 lg:grid-cols-5 gap-6">

          <!-- LEFT: Material Readiness Board -->
          <div class="lg:col-span-3 space-y-4">
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-bold text-gray-800">📊 Kesiapan Material</h2>
              <div class="flex gap-2 text-xs font-semibold">
                <span class="px-2 py-1 bg-red-100 text-red-700 rounded">🔴 Kurang</span>
                <span class="px-2 py-1 bg-emerald-100 text-emerald-700 rounded">🟢 Cukup</span>
              </div>
            </div>

            <!-- Shortage Alert Banner -->
            <div v-if="shortMaterials.length > 0"
              class="bg-red-50 border border-red-200 rounded-xl p-4">
              <div class="flex items-center gap-2 mb-3">
                <span class="text-red-600 font-bold text-sm">🚨 Alert: {{ shortMaterials.length }} material perlu pengadaan segera!</span>
              </div>
              <div class="flex flex-wrap gap-2">
                <span v-for="m in shortMaterials" :key="m.material_id"
                  class="px-3 py-1 bg-red-600 text-white text-xs font-semibold rounded-full">
                  {{ m.material_name }} (kurang {{ formatN(m.total_shortage) }} {{ m.uom_name }})
                </span>
              </div>
            </div>

            <!-- Material Cards -->
            <div class="space-y-3">
              <div v-for="mat in materials" :key="mat.material_id"
                class="bg-white rounded-xl shadow-sm border overflow-hidden transition-all hover:shadow-md"
                :class="mat.total_shortage > 0 ? 'border-red-200' : 'border-emerald-200'">
                <!-- Material Header -->
                <div class="flex items-center justify-between px-4 py-3"
                  :class="mat.total_shortage > 0 ? 'bg-red-50' : 'bg-emerald-50'">
                  <div>
                    <div class="font-bold text-gray-900">{{ mat.material_name }}</div>
                    <div class="text-xs text-gray-400 font-mono mt-0.5">{{ mat.material_sku }}</div>
                  </div>
                  <div class="text-right">
                    <div class="flex items-center gap-2">
                      <div class="text-xs text-gray-500">Dibutuhkan:</div>
                      <div class="font-bold text-gray-800">{{ formatN(mat.total_required) }} {{ mat.uom_name }}</div>
                    </div>
                    <div class="flex items-center gap-2 mt-0.5">
                      <div class="text-xs text-gray-500">Stok:</div>
                      <div class="font-semibold" :class="mat.total_shortage > 0 ? 'text-red-600' : 'text-emerald-600'">
                        {{ formatN(mat.stock_available) }} {{ mat.uom_name }}
                      </div>
                    </div>
                  </div>
                  <div class="ml-4">
                    <div v-if="mat.total_shortage > 0"
                      class="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg text-center whitespace-nowrap">
                      Kurang<br>{{ formatN(mat.total_shortage) }}
                    </div>
                    <div v-else class="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg text-center">
                      ✓ Siap
                    </div>
                  </div>
                </div>
                <!-- Stock Progress Bar -->
                <div class="px-4 py-2">
                  <div class="flex items-center gap-2">
                    <div class="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div class="h-full rounded-full transition-all"
                        :class="mat.total_shortage > 0 ? 'bg-red-500' : 'bg-emerald-500'"
                        :style="{ width: Math.min((mat.stock_available / mat.total_required) * 100, 100) + '%' }">
                      </div>
                    </div>
                    <span class="text-xs text-gray-500 min-w-[2.5rem] text-right">
                      {{ Math.round(Math.min((mat.stock_available / mat.total_required) * 100, 100)) }}%
                    </span>
                  </div>
                </div>
                <!-- WOs that need this material -->
                <div class="px-4 pb-3">
                  <div class="text-xs text-gray-400 mb-1.5">Digunakan oleh:</div>
                  <div class="flex flex-wrap gap-1.5">
                    <span v-for="wo in mat.wos" :key="wo.wo_id"
                      class="px-2 py-0.5 text-xs rounded font-mono font-semibold"
                      :class="woStatusBadge(wo.status)">
                      {{ wo.wo_number }} (W{{ wo.week_number }})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- RIGHT: WO Checklist -->
          <div class="lg:col-span-2 space-y-4">
            <h2 class="text-lg font-bold text-gray-800">📋 Checklist WO</h2>
            <div class="space-y-3">
              <div v-for="wo in workOrders" :key="wo.wo_id"
                class="bg-white rounded-xl shadow-sm border overflow-hidden"
                :class="wo.has_shortage ? 'border-orange-200' : 'border-emerald-200'">
                <!-- WO Header -->
                <div class="px-4 py-3 flex items-start justify-between"
                  :class="wo.has_shortage ? 'bg-orange-50' : 'bg-emerald-50'">
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <span class="font-mono font-bold text-blue-700 text-sm">{{ wo.wo_number }}</span>
                      <span v-if="wo.week_number" class="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">
                        W{{ wo.week_number }}
                      </span>
                    </div>
                    <div class="text-sm font-semibold text-gray-800 mt-0.5 leading-tight">{{ wo.product_name }}</div>
                    <div class="text-xs text-gray-500 mt-0.5">Qty: {{ formatN(wo.wo_qty) }}</div>
                  </div>
                  <div>
                    <span class="px-2 py-1 text-xs font-bold rounded-lg"
                      :class="woStatusBadge(wo.status)">
                      {{ woStatusLabel(wo.status) }}
                    </span>
                  </div>
                </div>

                <!-- Material checklist for this WO -->
                <div class="px-4 py-3 space-y-1.5">
                  <div v-for="mat in wo.materials" :key="mat.material_id"
                    class="flex items-center gap-2 text-xs">
                    <span class="text-base">{{ mat.shortage > 0 ? '🔴' : '🟢' }}</span>
                    <span class="flex-1 text-gray-700 font-medium truncate">{{ mat.material_name }}</span>
                    <span class="text-gray-500 whitespace-nowrap">
                      {{ formatN(mat.required) }} /
                      <span :class="mat.shortage > 0 ? 'text-red-600 font-bold' : 'text-emerald-600'">
                        {{ formatN(mat.available) }}
                      </span>
                    </span>
                  </div>
                  <div v-if="!wo.materials.length" class="text-xs text-orange-400">
                    ⚠ BOM belum di-approve
                  </div>
                </div>

                <!-- Footer -->
                <div class="px-4 pb-3">
                  <div v-if="!wo.has_shortage"
                    class="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 text-center">
                    ✅ Semua material tersedia — Siap produksi!
                  </div>
                  <div v-else
                    class="text-xs font-bold text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 text-center">
                    ⚠ Material belum lengkap — Koordinasi dengan PPIC
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Last updated -->
        <div class="text-center text-xs text-gray-400 pb-4">
          Data diperbarui: {{ lastUpdated }} · Hanya menampilkan WO Planned & In Production dengan BOM approved
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api } from '../lib/api';
import { woStatusLabel, woStatusBadge } from '../utils/woStatus';

const now = new Date();
const selectedYear = ref(now.getFullYear());
const yearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
const loading = ref(false);
const lastUpdated = ref('');

const summary = ref({ totalWOs: 0, woWithShortage: 0, totalMaterials: 0, shortMaterials: 0 });
const materials = ref<any[]>([]);
const workOrders = ref<any[]>([]);

const shortMaterials = computed(() => materials.value.filter(m => m.total_shortage > 0));

const formatN = (n: number) => {
  if (!n || n === 0) return '0';
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(n);
};

const loadDashboard = async () => {
  loading.value = true;
  try {
    const res = await api.get('/production/mrp/dashboard', { params: { year: selectedYear.value } });
    const d = res.data.data;
    summary.value = d.summary || { totalWOs: 0, woWithShortage: 0, totalMaterials: 0, shortMaterials: 0 };
    materials.value = d.materials || [];
    workOrders.value = d.workOrders || [];
    lastUpdated.value = new Date().toLocaleString('id-ID');
  } catch (err) {
    console.error('Failed to load MRP dashboard:', err);
  } finally {
    loading.value = false;
  }
};

onMounted(() => { loadDashboard(); });
</script>
