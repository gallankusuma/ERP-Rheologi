<template>
  <div class="h-full flex flex-col bg-slate-100">
    <!-- Header -->
    <div class="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-700 text-white shadow-lg">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-lg font-bold tracking-wide">🏭 Production Planning</h1>
          <p class="text-xs text-indigo-200">Daily Schedule · Line Process · Machine Utilization</p>
        </div>
        <div class="flex items-center gap-2">
          <select v-model="selectedYear" @change="loadData" class="bg-white/20 border border-white/30 rounded px-2 py-1.5 text-sm text-white">
            <option v-for="y in yearOptions" :key="y" :value="y" class="text-gray-900">{{ y }}</option>
          </select>
          <select v-model="selectedMonth" @change="loadData" class="bg-white/20 border border-white/30 rounded px-2 py-1.5 text-sm text-white">
            <option v-for="(m, idx) in monthNames" :key="idx" :value="idx + 1" class="text-gray-900">{{ m }}</option>
          </select>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-auto p-4">
      <!-- Loading -->
      <div v-if="loading" class="text-center py-16">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>

      <template v-else>
        <!-- Machine Utilization Bar -->
        <div class="bg-white rounded-lg shadow-sm p-3 mb-3">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-xs font-bold text-gray-700">⚙️ Machine Utilization</h3>
            <div class="flex items-center gap-2 text-xs">
              <span class="text-gray-500">Capacity hrs/day:</span>
              <input v-model.number="machineCapacity" type="number" min="1"
                class="w-14 px-1.5 py-0.5 border rounded text-center text-xs font-bold" />
              <span class="flex items-center gap-1 text-gray-400"><span class="w-2 h-2 rounded bg-green-500 inline-block"></span>&lt;70%</span>
              <span class="flex items-center gap-1 text-gray-400"><span class="w-2 h-2 rounded bg-yellow-500 inline-block"></span>70-90%</span>
              <span class="flex items-center gap-1 text-gray-400"><span class="w-2 h-2 rounded bg-red-500 inline-block"></span>&gt;90%</span>
            </div>
          </div>
          <div class="flex gap-px">
            <div v-for="dc in dayColumns" :key="'util-' + dc.day" class="flex-1 min-w-0">
              <div class="h-5 bg-gray-100 rounded-sm overflow-hidden relative">
                <div class="h-full transition-all duration-300"
                  :style="{ width: Math.min(getUtilization(dc.day), 100) + '%' }"
                  :class="getUtilColor(getUtilization(dc.day))">
                </div>
                <span class="absolute inset-0 flex items-center justify-center text-[8px] font-bold"
                  :class="getUtilization(dc.day) > 50 ? 'text-white' : 'text-gray-500'">
                  {{ Math.round(getUtilization(dc.day)) || '' }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="workOrders.length === 0" class="bg-white rounded-lg shadow-sm text-center py-16">
          <div class="text-5xl mb-3">📭</div>
          <h3 class="text-gray-600 font-medium">No work orders for {{ monthNames[selectedMonth - 1] }} {{ selectedYear }}</h3>
        </div>

        <!-- ========== MAIN GRID ========== -->
        <div v-if="workOrders.length > 0" class="bg-white rounded-lg shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full border-collapse text-sm" :style="{ minWidth: (460 + dayColumns.length * 55) + 'px' }">
              <!-- HEADER -->
              <thead>
                <tr class="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                  <th class="px-2 py-2.5 text-center border-r border-indigo-500 w-10 sticky left-0 z-30 bg-indigo-600 text-xs">No</th>
                  <th class="px-2 py-2.5 text-center border-r border-indigo-500 w-[140px] min-w-[140px] sticky left-10 z-30 bg-indigo-600 text-xs">REMARK</th>
                  <th class="px-2 py-2.5 text-center border-r border-indigo-500 w-[120px] min-w-[120px] sticky left-[150px] z-30 bg-indigo-600 text-xs">PRODUCT</th>
                  <th class="px-2 py-2.5 text-center border-r border-indigo-500 w-[110px] min-w-[110px] sticky left-[270px] z-30 bg-indigo-600 text-xs">TASK</th>
                  <th class="px-1 py-2.5 text-center border-r border-indigo-500 w-[55px] text-xs">REMAIN</th>
                  <th class="px-1 py-2.5 text-center border-r border-indigo-500 w-[55px] text-xs">TOTAL</th>
                  <th class="px-1 py-2.5 text-center border-r border-indigo-500 w-[40px] text-xs">UOM</th>
                  <th v-for="dc in dayColumns" :key="'h-' + dc.day"
                    class="px-0 py-2 text-center border-r border-indigo-500 w-[55px] min-w-[55px]"
                    :class="dc.isWeekend ? 'bg-indigo-700/50' : ''">
                    <div class="font-bold text-xs">D{{ dc.day }}</div>
                    <div class="text-[9px] text-indigo-200 font-normal">{{ dc.dayName }}</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <!-- FOR EACH WO: 5 TASK ROWS -->
                <template v-for="(wo, idx) in workOrders" :key="wo.id">
                  <!-- Row 1: Planned -->
                  <tr class="border-b border-gray-100 hover:bg-blue-50/30">
                    <!-- No (rowspan 5) -->
                    <td :rowspan="5" class="px-2 py-1 text-center font-bold text-gray-600 border-r bg-gray-50 sticky left-0 z-20 align-top pt-3 text-sm"
                      style="border-bottom: 3px solid #6366f1">
                      {{ idx + 1 }}
                    </td>
                    <!-- REMARK: Machine/Line Name (rowspan 5) -->
                    <td :rowspan="5" class="px-2 py-2 border-r bg-gradient-to-b from-indigo-50 to-purple-50 sticky left-10 z-20 align-top"
                      style="border-bottom: 3px solid #6366f1">
                      <div class="space-y-1.5">
                        <div class="bg-indigo-500 text-white rounded px-2 py-1.5">
                          <div class="text-[10px] font-bold mb-0.5">MACHINE</div>
                          <div class="text-[11px] font-bold truncate" :title="wo._machine">
                            {{ wo._machine || 'Not Assigned' }}
                          </div>
                          <div v-if="wo._machine_code" class="text-[9px] text-indigo-200">{{ wo._machine_code }}</div>
                        </div>
                        <div class="bg-indigo-400 text-white rounded px-2 py-1.5">
                          <div class="flex items-center justify-between">
                            <span class="text-[10px] font-bold">Capacity</span>
                            <span class="text-[11px] font-bold">{{ wo._capacity_per_hour || '-' }}/hr</span>
                          </div>
                          <div class="flex items-center justify-between mt-0.5">
                            <span class="text-[9px]">{{ wo._capacity_unit || '' }}</span>
                            <span class="text-[9px] font-bold">{{ wo._capacity_per_day || 8 }}h/day</span>
                          </div>
                        </div>
                        <div class="bg-indigo-500 text-white rounded px-2 py-1.5 flex items-center justify-between">
                          <span class="text-[10px] font-bold">LEAD_TIME</span>
                          <div class="flex items-center gap-0.5">
                            <input v-model.number="wo._lead_time" type="number" min="1"
                              class="w-8 text-right bg-white/20 border-0 rounded px-1 py-0.5 text-[10px] text-white font-bold" />
                            <span class="text-[9px]">Day</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <!-- PRODUCT (rowspan 5) -->
                    <td :rowspan="5" class="px-2 py-2 border-r sticky left-[150px] z-20 align-middle text-center bg-white"
                      style="border-bottom: 3px solid #6366f1">
                      <div class="text-[9px] text-indigo-600 font-bold">WO-{{ idx + 1 }}</div>
                      <div class="font-bold text-gray-900 text-[12px] mt-1 leading-tight">{{ wo.product_name }}</div>
                      <div class="text-[9px] text-gray-400 mt-0.5">{{ wo.sku }}</div>
                      <div class="mt-1 text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded inline-block font-medium">
                        {{ wo.wo_number || 'WO-' + wo.id }}
                      </div>
                      <div v-if="wo.qc_total > 0" class="mt-1">
                        <span class="text-[9px] font-bold" :class="wo.qc_pending_mandatory === 0 ? 'text-green-600' : 'text-red-600'">
                          QC {{ wo.qc_passed }}/{{ wo.qc_total }}
                        </span>
                      </div>
                    </td>
                    <!-- TASK: Planned -->
                    <td class="px-1 py-1 border-r sticky left-[270px] z-20 bg-white">
                      <div class="bg-blue-500 text-white rounded px-2 py-2 text-[10px] font-bold flex items-center gap-1">
                        📋 Planned
                      </div>
                    </td>
                    <!-- REMAINING -->
                    <td class="px-1 py-1 text-center border-r text-[10px] font-bold"
                      :class="getRemaining(wo, 'planned') > 0 ? 'bg-amber-50 text-amber-700' : getRemaining(wo, 'planned') < 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'">
                      {{ formatN(getRemaining(wo, 'planned')) }}
                    </td>
                    <!-- TOTAL -->
                    <td class="px-1 py-1 text-center border-r font-bold bg-blue-50 text-blue-700 text-xs">
                      {{ formatN(getDayTotal(wo, 'planned')) }}
                    </td>
                    <!-- UOM (rowspan 5) -->
                    <td :rowspan="5" class="px-1 py-1 text-center border-r bg-gray-50 align-middle font-semibold text-gray-600 text-[10px]"
                      style="border-bottom: 3px solid #6366f1">
                      {{ wo._uom || 'Kgs' }}
                    </td>
                    <!-- Day cells: Planned -->
                    <td v-for="dc in dayColumns" :key="'plan-' + wo.id + '-' + dc.day"
                      class="px-0 py-0.5 text-center border-r"
                      :class="dc.isWeekend ? 'bg-gray-50' : ''">
                      <input v-model.number="getDayData(wo, dc.day).planned" type="number" min="0"
                        class="w-full border-0 text-center text-[10px] font-medium py-1.5 focus:ring-1 focus:ring-blue-300"
                        :class="dc.isWeekend ? 'bg-gray-50 text-gray-400' : 'bg-blue-50 text-blue-800 focus:bg-blue-100'" />
                    </td>
                  </tr>

                  <!-- Row 2: Actual Output -->
                  <tr class="border-b border-gray-100 hover:bg-blue-50/30">
                    <td class="px-1 py-1 border-r sticky left-[270px] z-20 bg-white">
                      <div class="bg-green-500 text-white rounded px-2 py-2 text-[10px] font-bold flex items-center gap-1">
                        🏭 Actual
                      </div>
                    </td>
                    <td class="px-1 py-1 text-center border-r text-[10px] font-bold"
                      :class="getRemaining(wo, 'actual') > 0 ? 'bg-amber-50 text-amber-700' : getRemaining(wo, 'actual') < 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'">
                      {{ formatN(getRemaining(wo, 'actual')) }}
                    </td>
                    <td class="px-1 py-1 text-center border-r font-bold bg-green-50 text-green-700 text-xs">
                      {{ formatN(getDayTotal(wo, 'actual')) }}
                    </td>
                    <td v-for="dc in dayColumns" :key="'act-' + wo.id + '-' + dc.day"
                      class="px-0 py-0.5 text-center border-r"
                      :class="dc.isWeekend ? 'bg-gray-50' : ''">
                      <input v-model.number="getDayData(wo, dc.day).actual" type="number" min="0"
                        class="w-full border-0 text-center text-[10px] font-medium py-1.5 focus:ring-1 focus:ring-green-300"
                        :class="dc.isWeekend ? 'bg-gray-50 text-gray-400' : 'bg-green-50 text-green-800 focus:bg-green-100'" />
                    </td>
                  </tr>

                  <!-- Row 3: Line Process (Start) -->
                  <tr class="border-b border-gray-100 hover:bg-blue-50/30">
                    <td class="px-1 py-1 border-r sticky left-[270px] z-20 bg-white">
                      <div class="bg-purple-600 text-white rounded px-2 py-2 text-[10px] font-bold flex items-center gap-1">
                        ⚙️ Line Process
                      </div>
                    </td>
                    <td class="px-1 py-1 text-center border-r text-[10px] font-bold"
                      :class="getRemaining(wo, 'line_process') > 0 ? 'bg-amber-50 text-amber-700' : getRemaining(wo, 'line_process') < 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'">
                      {{ formatN(getRemaining(wo, 'line_process')) }}
                    </td>
                    <td class="px-1 py-1 text-center border-r font-bold bg-purple-50 text-purple-700 text-xs">
                      {{ formatN(getDayTotal(wo, 'line_process')) }}
                    </td>
                    <td v-for="dc in dayColumns" :key="'lp-' + wo.id + '-' + dc.day"
                      class="px-0 py-0.5 text-center border-r"
                      :class="dc.isWeekend ? 'bg-gray-50' : ''">
                      <input v-model.number="getDayData(wo, dc.day).line_process" type="number" min="0"
                        class="w-full border-0 text-center text-[10px] font-medium py-1.5 focus:ring-1 focus:ring-purple-300"
                        :class="dc.isWeekend ? 'bg-gray-50 text-gray-400' : 'bg-purple-50 text-purple-800 focus:bg-purple-100'" />
                    </td>
                  </tr>

                  <!-- Row 4: FG Qty -->
                  <tr class="border-b border-gray-100 hover:bg-blue-50/30">
                    <td class="px-1 py-1 border-r sticky left-[270px] z-20 bg-white">
                      <div class="bg-pink-600 text-white rounded px-2 py-2 text-[10px] font-bold flex items-center gap-1">
                        📦 FG Qty
                      </div>
                    </td>
                    <td class="px-1 py-1 text-center border-r text-[10px] font-bold"
                      :class="getRemaining(wo, 'fg_qty') > 0 ? 'bg-amber-50 text-amber-700' : getRemaining(wo, 'fg_qty') < 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'">
                      {{ formatN(getRemaining(wo, 'fg_qty')) }}
                    </td>
                    <td class="px-1 py-1 text-center border-r font-bold bg-pink-50 text-pink-700 text-xs">
                      {{ formatN(getDayTotal(wo, 'fg_qty')) }}
                    </td>
                    <td v-for="dc in dayColumns" :key="'fg-' + wo.id + '-' + dc.day"
                      class="px-0 py-0.5 text-center border-r"
                      :class="dc.isWeekend ? 'bg-gray-50' : ''">
                      <input v-model.number="getDayData(wo, dc.day).fg_qty" type="number" min="0"
                        class="w-full border-0 text-center text-[10px] font-medium py-1.5 focus:ring-1 focus:ring-pink-300"
                        :class="dc.isWeekend ? 'bg-gray-50 text-gray-400' : 'bg-pink-50 text-pink-800 focus:bg-pink-100'" />
                    </td>
                  </tr>

                  <!-- Row 5: Utilization % (calculated) -->
                  <tr style="border-bottom: 3px solid #6366f1">
                    <td class="px-1 py-1 border-r sticky left-[270px] z-20 bg-white">
                      <div class="bg-gray-100 text-gray-700 rounded px-2 py-2 text-[10px] font-bold flex items-center gap-1 border border-gray-200">
                        📈 Utilization %
                      </div>
                    </td>
                    <td class="px-1 py-1 text-center border-r font-bold bg-gray-50 text-gray-400 text-[10px]">—</td>
                    <td class="px-1 py-1 text-center border-r font-bold bg-gray-50 text-gray-700 text-xs">
                      {{ getAvgUtilForWo(wo) }}%
                    </td>
                    <td v-for="dc in dayColumns" :key="'util-' + wo.id + '-' + dc.day"
                      class="px-0 py-0.5 text-center border-r"
                      :class="dc.isWeekend ? 'bg-gray-50' : ''">
                      <div class="py-1.5 text-[10px] font-bold rounded mx-0.5"
                        :class="getWoUtilDay(wo, dc.day) > 90 ? 'bg-red-100 text-red-700' : getWoUtilDay(wo, dc.day) > 70 ? 'bg-yellow-100 text-yellow-700' : getWoUtilDay(wo, dc.day) > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-50 text-gray-400'">
                        {{ getWoUtilDay(wo, dc.day) > 0 ? getWoUtilDay(wo, dc.day) + '%' : '—' }}
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { api } from '../lib/api';

const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const now = new Date();
const selectedYear = ref(now.getFullYear());
const selectedMonth = ref(now.getMonth() + 1);
const yearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

const loading = ref(false);
const workOrders = ref<any[]>([]);
const dayColumns = ref<any[]>([]);
const machineCapacity = ref(8); // Default 8 hours/day

// Day data map for editable cells
const dayDataMap = reactive<Record<string, any>>({});

const formatN = (n: number) => {
  if (n === null || n === undefined || n === 0) return '0.00';
  return n.toFixed(2);
};

// Generate day columns for selected month
const generateDayColumns = () => {
  const daysInMonth = new Date(selectedYear.value, selectedMonth.value, 0).getDate();
  const cols = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(selectedYear.value, selectedMonth.value - 1, d);
    const dayOfWeek = date.getDay();
    cols.push({
      day: d,
      dayName: dayNames[dayOfWeek],
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      date: date
    });
  }
  dayColumns.value = cols;
};

// Get or create day data for a WO + day
const getDayData = (wo: any, day: number): any => {
  const key = `${wo.id}_${day}`;
  if (!dayDataMap[key]) {
    dayDataMap[key] = reactive({
      planned: 0,
      actual: 0,
      line_process: 0,
      fg_qty: 0
    });
  }
  return dayDataMap[key];
};

// Total across all days for a field
const getDayTotal = (wo: any, field: string): number => {
  let sum = 0;
  for (const dc of dayColumns.value) {
    sum += Number(getDayData(wo, dc.day)[field]) || 0;
  }
  return sum;
};

// Remaining = WO quantity - total
const getRemaining = (wo: any, field: string): number => {
  const demand = Number(wo.quantity) || 0;
  return demand - getDayTotal(wo, field);
};

// Machine utilization for global bar (sum of all WO planned for a day / capacity)
const getUtilization = (day: number): number => {
  if (!machineCapacity.value || machineCapacity.value <= 0) return 0;
  let totalPlanned = 0;
  for (const wo of workOrders.value) {
    totalPlanned += Number(getDayData(wo, day).planned) || 0;
  }
  // Rough conversion: qty to hours (configurable later with master mesin)
  const hoursUsed = totalPlanned / 60;
  return (hoursUsed / machineCapacity.value) * 100;
};

const getUtilColor = (pct: number) => {
  if (pct >= 90) return 'bg-red-500';
  if (pct >= 70) return 'bg-yellow-500';
  return 'bg-green-500';
};

// Per-WO utilization for a specific day
const getWoUtilDay = (wo: any, day: number): number => {
  const cap = Number(wo._capacity_per_day) || Number(machineCapacity.value) || 8;
  const planned = Number(getDayData(wo, day).planned) || 0;
  if (!planned) return 0;
  const hoursUsed = planned / 60;
  return Math.round((hoursUsed / cap) * 100);
};

// Average utilization across all active days for a WO
const getAvgUtilForWo = (wo: any): number => {
  let count = 0, sum = 0;
  for (const dc of dayColumns.value) {
    const u = getWoUtilDay(wo, dc.day);
    if (u > 0) { sum += u; count++; }
  }
  return count > 0 ? Math.round(sum / count) : 0;
};

const loadData = async () => {
  loading.value = true;
  generateDayColumns();
  // Clear day data
  Object.keys(dayDataMap).forEach(k => delete dayDataMap[k]);
  try {
    const res = await api.get('/production/planning/weekly', {
      params: { year: selectedYear.value, month: selectedMonth.value }
    });
    const wos = res.data.data.workOrders || [];
    // Add editable fields
    for (const wo of wos) {
      wo._machine = wo.line_process_name || '';
      wo._machine_code = wo.line_process_code || '';
      wo._capacity_per_hour = wo.capacity_per_hour || null;
      wo._capacity_unit = wo.capacity_unit_name || '';
      wo._capacity_per_day = 8;
      wo._lead_time = 1;
      wo._uom = wo.capacity_unit_name || 'Kgs';

      // Pre-fill planned data from backend weekly distribution into daily
      if (wo.planned_weeks) {
        // Distribute weekly qty into daily
        for (const dc of dayColumns.value) {
          if (dc.isWeekend) continue;
          // Simple: distribute evenly across weekdays if WO spans this period
          if (wo.scheduled_start && wo.scheduled_end) {
            const start = new Date(wo.scheduled_start);
            const end = new Date(wo.scheduled_end);
            if (dc.date >= start && dc.date <= end) {
              // Count working days between start and end
              let workDays = 0;
              for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dow = d.getDay();
                if (dow !== 0 && dow !== 6) workDays++;
              }
              if (workDays > 0) {
                const dailyQty = Math.round(Number(wo.quantity) / workDays * 100) / 100;
                getDayData(wo, dc.day).planned = dailyQty;
              }
            }
          }
        }
      }
    }
    workOrders.value = wos;
  } catch (e: any) {
    console.error('Failed to load planning:', e);
  } finally {
    loading.value = false;
  }
};

onMounted(() => loadData());
</script>

<style scoped>
/* Row hover highlight */
:deep(tbody tr) {
  transition: all 0.15s ease;
}
:deep(tbody tr:hover) {
  filter: brightness(0.97);
}

/* Input styling */
:deep(input[type="number"]) {
  transition: box-shadow 0.15s ease, background-color 0.15s ease;
  -moz-appearance: textfield;
}
:deep(input[type="number"]::-webkit-inner-spin-button),
:deep(input[type="number"]::-webkit-outer-spin-button) {
  -webkit-appearance: none;
  margin: 0;
}
:deep(input[type="number"]:focus) {
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.3);
}

/* Negative value pulse */
@keyframes pulse-red {
  0%, 100% { background-color: rgb(254, 226, 226); }
  50% { background-color: rgb(254, 202, 202); }
}
</style>
