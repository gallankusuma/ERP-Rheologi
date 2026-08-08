<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">📊 Sales Forecast Integration</h1>
        <p class="text-gray-500 text-sm mt-1">Calculate product demand from sister company brand forecasts</p>
      </div>
      <div class="flex gap-2">
        <router-link to="/forecast-brands"
          class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium inline-block">
          ⚙️ Manage Brands
        </router-link>
      </div>
    </div>

    <!-- View Toggle -->
    <div class="bg-white rounded-xl border p-4">
      <div class="flex items-center gap-3 flex-wrap">
        <!-- View Mode Toggle -->
        <div class="flex bg-gray-100 rounded-lg p-1">
          <button @click="viewMode = 'monthly'; loadMonthlyData()"
            class="px-4 py-2 text-sm font-bold rounded-md transition-all"
            :class="viewMode === 'monthly' ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'">
            📅 Monthly (Yearly)
          </button>
          <button @click="viewMode = 'weekly'; loadForecasts()"
            class="px-4 py-2 text-sm font-bold rounded-md transition-all"
            :class="viewMode === 'weekly' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'">
            📊 Weekly (Detail)
          </button>
        </div>

        <div class="h-6 w-px bg-gray-300"></div>

        <div class="flex items-center gap-2">
          <label class="text-sm font-medium text-gray-700">Year:</label>
          <select v-model="selectedYear" @change="viewMode === 'monthly' ? loadMonthlyData() : loadForecasts()"
            class="border rounded-lg px-3 py-1.5 text-sm">
            <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
          </select>
        </div>

        <div v-if="viewMode === 'weekly'" class="flex items-center gap-2">
          <label class="text-sm font-medium text-gray-700">Month:</label>
          <select v-model="selectedMonth" @change="loadForecasts"
            class="border rounded-lg px-3 py-1.5 text-sm">
            <option v-for="m in 12" :key="m" :value="m">{{ monthNames[m-1] }}</option>
          </select>
        </div>

        <div v-if="viewMode === 'weekly' && productOptions.length > 0" class="flex items-center gap-2">
          <label class="text-sm font-medium text-gray-700">Product:</label>
          <select v-model="selectedProductId" class="border rounded-lg px-3 py-1.5 text-sm min-w-[200px]">
            <option :value="0">All Products</option>
            <option v-for="p in productOptions" :key="p.id" :value="p.id">{{ p.name }} ({{ p.sku }})</option>
          </select>
        </div>

        <template v-if="viewMode === 'weekly' && activeForecast">
          <span :class="['px-3 py-1 rounded-full text-xs font-bold', activeForecast.status === 'Draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800']">{{ activeForecast.status }}</span>
          <span class="text-sm text-gray-500">{{ activeForecast.forecast_number }}</span>
        </template>

        <div class="ml-auto flex gap-2">
          <template v-if="viewMode === 'monthly'">
            <button v-if="monthlyDirty" @click="saveMonthlyData"
              class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">💾 Save Monthly</button>
            <button @click="distributeToWeeks"
              class="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium">📤 Distribute to Weeks</button>
            <button @click="pushMonthlyToMps"
              class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">🔗 Push to MPS</button>
          </template>
          <template v-if="viewMode === 'weekly'">
            <button v-if="!activeForecast" @click="createForecast"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">+ New Forecast</button>
            <template v-if="activeForecast">
              <button v-if="gridBrands.length === 0" @click="generateGrid"
                class="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium">🔄 Generate Grid</button>
              <button v-if="isDirty && activeForecast.status === 'Draft'" @click="saveData"
                class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">💾 Save</button>
              <button v-if="activeForecast.status === 'Draft'" @click="confirmForecast"
                class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">✅ Confirm</button>
              <button v-if="activeForecast.status === 'Confirmed'" @click="revertDraft"
                class="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm font-medium">↩️ Revert to Draft</button>
              <button v-if="activeForecast.status === 'Confirmed' && gridBrands.length > 0" @click="pushToMps"
                class="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium">🔗 Push to MPS</button>
            </template>
          </template>
        </div>
      </div>
    </div>

    <!-- ==================== MONTHLY VIEW ==================== -->
    <template v-if="viewMode === 'monthly'">
      <div v-if="monthlyBrands.length > 0" class="bg-white rounded-xl border overflow-auto" style="max-height: 75vh;">
        <table class="min-w-max w-full text-sm">
          <thead class="bg-gradient-to-r from-teal-700 to-teal-600 text-white sticky top-0 z-30">
            <tr>
              <th class="px-3 py-2 text-left text-[11px] font-bold sticky left-0 z-40 bg-teal-700 min-w-[50px]">No</th>
              <th class="px-3 py-2 text-left text-[11px] font-bold sticky left-[50px] z-40 bg-teal-700 min-w-[180px]">BRAND</th>
              <th class="px-3 py-2 text-left text-[11px] font-bold sticky left-[230px] z-40 bg-teal-700 min-w-[120px]">ROW</th>
              <th class="px-3 py-2 text-center text-[11px] font-bold min-w-[80px]">TOTAL</th>
              <th v-for="m in 12" :key="'mh-'+m" class="px-2 py-2 text-center text-[11px] font-bold min-w-[90px]">{{ monthNames[m-1].substring(0, 3) }}</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(brand, idx) in monthlyBrands" :key="brand.id">
              <tr class="border-b border-gray-100 hover:bg-blue-50/30">
                <td rowspan="2" class="px-3 py-2 border-r sticky left-0 z-20 bg-white text-center font-bold text-gray-500">{{ idx + 1 }}</td>
                <td rowspan="2" class="px-3 py-2 border-r sticky left-[50px] z-20 bg-white">
                  <div class="font-bold text-gray-900 text-sm">{{ brand.brand_name }}</div>
                  <div class="text-[10px] text-teal-600 font-medium mt-1">Rate: {{ brand.conversion_rate }} {{ brand.conversion_uom }}/unit</div>
                  <div class="text-[10px] text-blue-500 font-medium">→ {{ brand.product_name || 'No product' }}</div>
                </td>
                <td class="px-2 py-1 border-r sticky left-[230px] z-20 bg-white">
                  <div class="bg-blue-600 text-white rounded px-2 py-1.5 text-[11px] font-bold text-center">📦 Forecast Qty</div>
                </td>
                <td class="px-2 py-1 text-center border-r font-bold bg-blue-50 text-blue-700">{{ formatN(monthlyBrandTotal(brand, 'forecast_qty')) }}</td>
                <td v-for="m in 12" :key="'fq-'+brand.id+'-'+m" class="px-0 py-0.5 text-center border-r">
                  <input v-model.number="getMonthData(brand, m).forecast_qty" type="number" min="0"
                    @input="onMonthlyChange(brand, m)"
                    class="w-full text-center py-1.5 text-sm border-0 focus:ring-2 focus:ring-blue-400 rounded bg-transparent text-gray-900" />
                </td>
              </tr>
              <tr class="border-b-2 border-gray-200 hover:bg-orange-50/30">
                <td class="px-2 py-1 border-r sticky left-[230px] z-20 bg-white">
                  <div class="bg-orange-500 text-white rounded px-2 py-1.5 text-[11px] font-bold text-center">🧪 Product Needed</div>
                </td>
                <td class="px-2 py-1 text-center border-r font-bold bg-orange-50 text-orange-700">{{ formatN(monthlyBrandTotal(brand, 'product_qty')) }}</td>
                <td v-for="m in 12" :key="'pq-'+brand.id+'-'+m" class="px-2 py-1.5 text-center border-r text-orange-600 font-semibold bg-orange-50/50 text-sm">
                  {{ formatN(getMonthData(brand, m).product_qty) }}
                </td>
              </tr>
            </template>
            <tr class="bg-gradient-to-r from-green-600 to-green-500 text-white font-bold sticky bottom-0 z-20">
              <td colspan="3" class="px-3 py-3 text-right text-sm sticky left-0 z-30 bg-green-600">🟢 TOTAL PRODUCT NEEDED</td>
              <td class="px-2 py-3 text-center text-lg">{{ formatN(monthlyGrandTotal) }}</td>
              <td v-for="m in 12" :key="'mt-'+m" class="px-2 py-3 text-center text-sm">{{ formatN(monthlyColTotal(m)) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="bg-white rounded-xl border p-12 text-center">
        <p class="text-gray-500 text-lg">No active brands. Add brands via "Manage Brands".</p>
      </div>
    </template>

    <!-- ==================== WEEKLY VIEW ==================== -->
    <template v-if="viewMode === 'weekly'">
      <div v-if="activeForecast && filteredBrands.length > 0" class="bg-white rounded-xl border overflow-auto" style="max-height: 75vh;">
        <table class="min-w-max w-full text-sm">
          <thead class="bg-gradient-to-r from-teal-700 to-teal-600 text-white sticky top-0 z-30">
            <tr>
              <th class="px-3 py-2 text-left text-[11px] font-bold sticky left-0 z-40 bg-teal-700 min-w-[50px]">No</th>
              <th class="px-3 py-2 text-left text-[11px] font-bold sticky left-[50px] z-40 bg-teal-700 min-w-[180px]">BRAND</th>
              <th class="px-3 py-2 text-left text-[11px] font-bold sticky left-[230px] z-40 bg-teal-700 min-w-[140px]">ROW</th>
              <th class="px-3 py-2 text-center text-[11px] font-bold min-w-[80px]">TOTAL</th>
              <th v-for="wc in weekColumns" :key="'h-'+wc.week+'-'+wc.year" class="px-2 py-2 text-center text-[10px] font-bold min-w-[80px]">
                <div>W{{ wc.week }}</div>
                <div class="font-normal text-teal-200">{{ wc.start?.substring(5) }}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(brand, idx) in filteredBrands" :key="brand.id">
              <tr class="border-b border-gray-100 hover:bg-blue-50/30">
                <td rowspan="2" class="px-3 py-2 border-r sticky left-0 z-20 bg-white text-center font-bold text-gray-500">{{ idx + 1 }}</td>
                <td rowspan="2" class="px-3 py-2 border-r sticky left-[50px] z-20 bg-white">
                  <div class="font-bold text-gray-900 text-sm">{{ brand.brand_name }}</div>
                  <div class="text-[10px] text-teal-600 font-medium mt-1">Rate: {{ brand.conversion_rate }} {{ brand.conversion_uom }}/unit</div>
                  <div class="text-[10px] text-blue-500 font-medium">→ {{ brand.product_name || 'No product' }}</div>
                </td>
                <td class="px-2 py-1 border-r sticky left-[230px] z-20 bg-white">
                  <div class="bg-blue-600 text-white rounded px-2 py-1.5 text-[11px] font-bold text-center">📦 Forecast Qty</div>
                </td>
                <td class="px-2 py-1 text-center border-r font-bold bg-blue-50 text-blue-700">{{ formatN(brandTotal(brand, 'forecast_qty')) }}</td>
                <td v-for="wc in weekColumns" :key="'fq-'+brand.id+'-'+wc.week+'-'+wc.year" class="px-0 py-0.5 text-center border-r">
                  <input v-model.number="getWeekData(brand, wc).forecast_qty" type="number" min="0"
                    :disabled="activeForecast.status !== 'Draft'" @input="onForecastChange(brand, wc)"
                    class="w-full text-center py-1.5 text-sm border-0 focus:ring-2 focus:ring-blue-400 rounded bg-transparent"
                    :class="activeForecast.status !== 'Draft' ? 'text-gray-500' : 'text-gray-900'" />
                </td>
              </tr>
              <tr class="border-b-2 border-gray-200 hover:bg-orange-50/30">
                <td class="px-2 py-1 border-r sticky left-[230px] z-20 bg-white">
                  <div class="bg-orange-500 text-white rounded px-2 py-1.5 text-[11px] font-bold text-center">🧪 Product Needed</div>
                </td>
                <td class="px-2 py-1 text-center border-r font-bold bg-orange-50 text-orange-700">{{ formatN(brandTotal(brand, 'product_qty')) }}</td>
                <td v-for="wc in weekColumns" :key="'cq-'+brand.id+'-'+wc.week+'-'+wc.year"
                  class="px-2 py-1.5 text-center border-r text-orange-600 font-semibold bg-orange-50/50 text-sm">
                  {{ formatN(getWeekData(brand, wc).product_qty) }}
                </td>
              </tr>
            </template>
            <tr class="bg-gradient-to-r from-green-600 to-green-500 text-white font-bold sticky bottom-0 z-20">
              <td colspan="3" class="px-3 py-3 text-right text-sm sticky left-0 z-30 bg-green-600">🟢 TOTAL PRODUCT NEEDED</td>
              <td class="px-2 py-3 text-center text-lg">{{ formatN(grandTotal) }}</td>
              <td v-for="wc in weekColumns" :key="'total-'+wc.week+'-'+wc.year" class="px-2 py-3 text-center text-sm">{{ formatN(weekTotal(wc)) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="activeForecast && gridBrands.length === 0" class="bg-white rounded-xl border p-12 text-center">
        <p class="text-gray-500 text-lg">No grid data yet.</p>
        <p class="text-gray-400 text-sm mt-2">Add brands first via "Manage Brands", then click "Generate Grid".</p>
      </div>
      <div v-if="!activeForecast" class="bg-white rounded-xl border p-12 text-center">
        <p class="text-gray-500 text-lg">No forecast for {{ monthNames[selectedMonth-1] }} {{ selectedYear }}.</p>
        <p class="text-gray-400 text-sm mt-2">Click "+ New Forecast" to create one, or use Monthly View to input data and distribute.</p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api } from '../../lib/api';

const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const now = new Date();
const selectedYear = ref(now.getFullYear());
const selectedMonth = ref(now.getMonth() + 1);
const yearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
const viewMode = ref<'monthly' | 'weekly'>('monthly');

// Weekly state
const activeForecast = ref<any>(null);
const gridBrands = ref<any[]>([]);
const weekColumns = ref<any[]>([]);
const isDirty = ref(false);
const allBrands = ref<any[]>([]);
const selectedProductId = ref(0);

// Monthly state
const monthlyBrands = ref<any[]>([]);
const monthlyDirty = ref(false);

const formatN = (v: number) => {
  if (!v && v !== 0) return '-';
  return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
};

const productOptions = computed(() => {
  const map = new Map<number, { id: number; name: string; sku: string }>();
  for (const b of gridBrands.value) {
    if (b.product_id && !map.has(b.product_id)) {
      map.set(b.product_id, { id: b.product_id, name: b.product_name || 'Unknown', sku: b.product_sku || '' });
    }
  }
  return Array.from(map.values());
});

const filteredBrands = computed(() => {
  if (!selectedProductId.value) return gridBrands.value;
  return gridBrands.value.filter((b: any) => b.product_id === selectedProductId.value);
});

// ==================== MONTHLY LOGIC ====================
const getMonthData = (brand: any, month: number): any => {
  if (!brand._monthMap) brand._monthMap = {};
  if (!brand._monthMap[month]) {
    // months can be an object keyed by month number or an array
    const months = brand.months || {};
    let md: any = null;
    if (Array.isArray(months)) {
      md = months.find((m: any) => m.month === month);
    } else {
      md = months[month] || months[String(month)];
    }
    brand._monthMap[month] = { forecast_qty: md?.forecast_qty || 0, product_qty: md?.product_qty || 0 };
  }
  return brand._monthMap[month];
};

const onMonthlyChange = (brand: any, month: number) => {
  const md = getMonthData(brand, month);
  const rate = Number(brand.conversion_rate) || 1;
  md.product_qty = Math.round(Number(md.forecast_qty || 0) * rate * 100) / 100;
  monthlyDirty.value = true;
};

const monthlyBrandTotal = (brand: any, field: string): number => {
  let t = 0; for (let m = 1; m <= 12; m++) t += Number(getMonthData(brand, m)[field] || 0); return t;
};

const monthlyColTotal = (month: number): number => {
  let t = 0; for (const b of monthlyBrands.value) t += Number(getMonthData(b, month).product_qty || 0); return t;
};

const monthlyGrandTotal = computed(() => {
  let t = 0; for (let m = 1; m <= 12; m++) t += monthlyColTotal(m); return t;
});

const loadMonthlyData = async () => {
  try {
    const res = await api.get('/ppic/forecast-monthly', { params: { year: selectedYear.value } });
    const data = res.data?.data || res.data;
    monthlyBrands.value = (data.brands || []).map((b: any) => ({ ...b, _monthMap: null }));
    monthlyDirty.value = false;
  } catch (e) { console.error('Failed to load monthly data:', e); }
};

const saveMonthlyData = async () => {
  try {
    const payload: any[] = [];
    for (const brand of monthlyBrands.value) {
      for (let m = 1; m <= 12; m++) {
        const md = getMonthData(brand, m);
        if (Number(md.forecast_qty) > 0) {
          payload.push({ brand_id: brand.id, month: m, forecast_qty: Number(md.forecast_qty) });
        }
      }
    }
    await api.put('/ppic/forecast-monthly', { year: selectedYear.value, data: payload });
    monthlyDirty.value = false;
    alert('✅ Monthly forecast saved!');
  } catch (e: any) { alert(e.response?.data?.error || 'Failed to save'); }
};

const distributeToWeeks = async () => {
  if (monthlyDirty.value) { alert('Save monthly data first!'); return; }
  if (!confirm(`Distribute monthly forecast for ${selectedYear.value} to weekly forecasts?\n\nThis will:\n• Create weekly forecast headers (if not exist)\n• Divide monthly qty evenly across weeks\n• Overwrite existing weekly forecast values`)) return;
  try {
    const res = await api.post('/ppic/forecast-monthly/distribute', { year: selectedYear.value });
    alert(`✅ ${res.data.message}`);
  } catch (e: any) { alert(e.response?.data?.error || 'Failed to distribute'); }
};

const pushMonthlyToMps = async () => {
  if (monthlyDirty.value) { alert('Save monthly data first!'); return; }
  const monthStr = prompt(`Push forecast for which month? (1-12)\nYear: ${selectedYear.value}\n\nEnter month number:`);
  if (!monthStr) return;
  const month = Number(monthStr);
  if (!month || month < 1 || month > 12) { alert('Invalid month. Enter 1-12.'); return; }
  const periodLabel = `${selectedYear.value}-${String(month).padStart(2, '0')}`;
  if (!confirm(`Push monthly forecast ${periodLabel} to MPS?\n\nThis will update the "Demand (Forecast)" row in the Draft MPS for ${periodLabel}.`)) return;
  try {
    const res = await api.post('/ppic/forecast-monthly/push-to-mps', { year: selectedYear.value, month });
    const d = res.data;
    alert(`${d.message}\n\nProducts matched: ${d.products_matched}\nNew products added: ${d.products_created}\nWeeks updated: ${d.weeks_updated}`);
  } catch (e: any) { alert(e.response?.data?.error || 'Failed to push to MPS'); }
};

// ==================== WEEKLY LOGIC ====================
const getWeekData = (brand: any, wc: any) => {
  const key = `${wc.week}:${wc.year}`;
  if (!brand.weeks) brand.weeks = {};
  if (!brand.weeks[key]) brand.weeks[key] = { forecast_qty: 0, product_qty: 0 };
  return brand.weeks[key];
};

const onForecastChange = (brand: any, wc: any) => {
  const wd = getWeekData(brand, wc);
  const rate = Number(brand.conversion_rate) || 1;
  wd.product_qty = Math.round(Number(wd.forecast_qty || 0) * rate * 100) / 100;
  isDirty.value = true;
};

const brandTotal = (brand: any, field: string): number => {
  let t = 0; for (const wc of weekColumns.value) t += Number(getWeekData(brand, wc)[field] || 0); return t;
};

const weekTotal = (wc: any): number => {
  let t = 0; for (const b of filteredBrands.value) t += Number(getWeekData(b, wc).product_qty || 0); return t;
};

const grandTotal = computed(() => {
  let t = 0; for (const wc of weekColumns.value) t += weekTotal(wc); return t;
});

const loadForecasts = async () => {
  try {
    const res = await api.get('/ppic/forecasts', { params: { year: selectedYear.value, month: selectedMonth.value } });
    const list = Array.isArray(res.data) ? res.data : [];
    if (list.length > 0) { activeForecast.value = list[0]; await loadForecastDetail(list[0].id); }
    else { activeForecast.value = null; gridBrands.value = []; weekColumns.value = []; }
  } catch (e) { console.error(e); }
};

const loadForecastDetail = async (id: number) => {
  try {
    const res = await api.get(`/ppic/forecasts/${id}`);
    activeForecast.value = res.data.header;
    gridBrands.value = res.data.brands || [];
    weekColumns.value = res.data.weekColumns || [];
    isDirty.value = false;
  } catch (e) { console.error(e); }
};

const createForecast = async () => {
  try {
    const res = await api.post('/ppic/forecasts', { period_year: selectedYear.value, period_month: selectedMonth.value });
    await loadForecasts();
    alert('Created ' + res.data.forecast_number);
  } catch (e: any) { alert(e.response?.data?.error || 'Failed to create forecast'); }
};

const generateGrid = async () => {
  if (!activeForecast.value) return;
  try {
    await api.post(`/ppic/forecasts/${activeForecast.value.id}/generate-grid`);
    await loadForecastDetail(activeForecast.value.id);
    alert('Grid generated!');
  } catch (e: any) { alert(e.response?.data?.error || 'Failed to generate grid'); }
};

const saveData = async () => {
  if (!activeForecast.value) return;
  try {
    const data: any[] = [];
    for (const brand of gridBrands.value) {
      for (const wc of weekColumns.value) {
        const wd = getWeekData(brand, wc);
        data.push({ brand_id: brand.id, week_number: wc.week, year: wc.year, forecast_qty: Number(wd.forecast_qty) || 0 });
      }
    }
    await api.put(`/ppic/forecasts/${activeForecast.value.id}/week-data`, { data });
    isDirty.value = false;
    alert('Forecast saved!');
  } catch (e: any) { alert(e.response?.data?.error || 'Failed to save'); }
};

const confirmForecast = async () => {
  if (!activeForecast.value) return;
  if (isDirty.value) { alert('Save changes first!'); return; }
  if (!confirm('Confirm this forecast? It will be locked for editing.')) return;
  try {
    await api.put(`/ppic/forecasts/${activeForecast.value.id}/status`, { status: 'Confirmed' });
    await loadForecasts();
  } catch (e: any) { alert(e.response?.data?.error || 'Failed'); }
};

const revertDraft = async () => {
  if (!activeForecast.value) return;
  try {
    await api.put(`/ppic/forecasts/${activeForecast.value.id}/status`, { status: 'Draft' });
    await loadForecasts();
  } catch (e: any) { alert(e.response?.data?.error || 'Failed'); }
};

const loadBrands = async () => {
  try {
    const res = await api.get('/ppic/forecast-brands');
    allBrands.value = Array.isArray(res.data) ? res.data : [];
  } catch (e) { console.error(e); }
};

const pushToMps = async () => {
  if (!activeForecast.value) return;
  if (!confirm('Push forecast data to MPS? This will update the "Demand (Forecast)" row in the active MPS.')) return;
  try {
    const res = await api.post(`/ppic/forecasts/${activeForecast.value.id}/push-to-mps`);
    const data = res.data;
    alert(`✅ ${data.message}\n\nProducts matched: ${data.products_matched}\nNew products added: ${data.products_created}\nWeeks updated: ${data.weeks_updated}`);
  } catch (e: any) { alert(e.response?.data?.error || 'Failed to push to MPS'); }
};

onMounted(async () => {
  await loadBrands();
  if (viewMode.value === 'monthly') await loadMonthlyData();
  else await loadForecasts();
});
</script>
