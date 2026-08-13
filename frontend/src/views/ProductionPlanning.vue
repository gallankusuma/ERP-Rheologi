<template>
  <div class="h-full flex flex-col bg-slate-100">
    <!-- Header -->
    <div class="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-700 text-white shadow-lg">
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 class="text-base font-bold tracking-wide">🏭 Production Planning</h1>
          <p class="text-[10px] text-indigo-200">Daily Schedule · Per Machine · Work Orders per Shift</p>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <select v-model="selectedYear" @change="loadData" class="bg-white/20 border border-white/30 rounded px-2 py-1 text-xs text-white">
            <option v-for="y in yearOptions" :key="y" :value="y" class="text-gray-900">{{ y }}</option>
          </select>
          <select v-model="selectedMonth" @change="loadData" class="bg-white/20 border border-white/30 rounded px-2 py-1 text-xs text-white">
            <option v-for="(m, idx) in monthNames" :key="idx" :value="idx + 1" class="text-gray-900">{{ m }}</option>
          </select>
          <select v-model="filterMps" class="bg-white/20 border border-white/30 rounded px-2 py-1 text-xs text-white">
            <option value="" class="text-gray-900">All WOs</option>
            <option value="mps" class="text-gray-900">MPS Only</option>
            <option value="manual" class="text-gray-900">Manual Only</option>
            <option value="legacy" class="text-gray-900">Legacy/Unknown</option>
          </select>
          <label class="flex items-center gap-1 text-[10px] text-indigo-200 cursor-pointer">
            <input type="checkbox" v-model="includeHistorical" @change="loadData" class="rounded" />
            History
          </label>
          <div class="h-4 w-px bg-white/30"></div>
          <div class="flex items-center gap-1 text-xs text-indigo-100">
            <span>Cap:</span>
            <input v-model.number="machineCapacity" type="number" min="1"
              class="w-10 px-1 py-0.5 border border-white/30 rounded text-center text-xs font-bold bg-white/20 text-white" />
            <span>h/d</span>
          </div>
          <button @click="utilZoomed = !utilZoomed"
            class="px-2 py-1 text-xs font-semibold rounded border transition-colors"
            :class="utilZoomed ? 'bg-white text-indigo-700 border-white' : 'bg-white/10 text-white border-white/30 hover:bg-white/20'">
            {{ utilZoomed ? '🔍−' : '🔍+' }}
          </button>
          <div class="h-4 w-px bg-white/30"></div>
          <button @click="saveSchedule" :disabled="saving || !dirtyWoIds.length"
            class="px-3 py-1 text-xs font-bold rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            :class="dirtyWoIds.length ? 'bg-white text-indigo-700 border-white hover:bg-indigo-50' : 'bg-white/10 text-white border-white/30'">
            {{ saving ? 'Menyimpan…' : (dirtyWoIds.length ? `Simpan (${dirtyWoIds.length})` : 'Tersimpan') }}
          </button>
          <div class="flex items-center gap-2 text-[10px] text-indigo-200">
            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-sm bg-emerald-400 inline-block"></span>&lt;70%</span>
            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-sm bg-amber-400 inline-block"></span>70–90%</span>
            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-sm bg-red-400 inline-block"></span>&gt;90%</span>
          </div>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-auto p-4">
      <!-- Loading -->
      <div v-if="loading" class="text-center py-16">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>

      <template v-else>
        <!-- Empty State -->
        <div v-if="workOrders.length === 0" class="bg-white rounded-lg shadow-sm text-center py-16">
          <div class="text-5xl mb-3">📭</div>
          <h3 class="text-gray-600 font-medium">No work orders for {{ monthNames[selectedMonth - 1] }} {{ selectedYear }}</h3>
        </div>

        <!-- ========== MAIN GRID ========== -->
        <div v-else class="bg-white rounded-lg shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full border-collapse text-sm" :style="{ minWidth: (500 + dayColumns.length * 55) + 'px' }">
              <!-- HEADER -->
              <thead>
                <tr class="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                  <th class="px-2 py-2.5 text-center border-r border-indigo-500 w-10 sticky left-0 z-30 bg-indigo-600 text-xs">No</th>
                  <th class="px-2 py-2.5 text-center border-r border-indigo-500 w-[150px] min-w-[150px] sticky left-10 z-30 bg-indigo-600 text-xs">MACHINE</th>
                  <th class="px-2 py-2.5 text-center border-r border-indigo-500 w-[110px] min-w-[110px] sticky left-[160px] z-30 bg-indigo-600 text-xs">WORK ORDER</th>
                  <th class="px-2 py-2.5 text-center border-r border-indigo-500 w-[95px] min-w-[95px] sticky left-[270px] z-30 bg-indigo-600 text-xs">TASK</th>
                  <th class="px-1 py-2.5 text-center border-r border-indigo-500 w-[55px] text-xs">REMAIN</th>
                  <th class="px-1 py-2.5 text-center border-r border-indigo-500 w-[55px] text-xs">TOTAL</th>
                  <th class="px-1 py-2.5 text-center border-r border-indigo-500 w-[35px] text-xs">UOM</th>
                  <th v-for="dc in dayColumns" :key="'h-' + dc.day"
                    class="px-0 py-1.5 text-center border-r border-indigo-500 w-[55px] min-w-[55px]"
                    :class="dc.isWeekend ? 'bg-indigo-700/50' : ''">
                    <div class="font-bold text-sm leading-tight">{{ dc.day }}</div>
                    <div class="text-[9px] text-indigo-200 font-normal">{{ dc.dayName }}</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <!-- FOR EACH MACHINE GROUP -->
                <template v-for="(group, gIdx) in machineGroups" :key="group.machineId || gIdx">

                  <!-- For each WO in this machine: 2 rows (Planned + Actual) -->
                  <template v-for="(wo, wIdx) in group.workOrders" :key="wo.id">

                    <!-- ROW: Planned -->
                    <tr class="border-b border-gray-100 hover:bg-blue-50/20"
                      :class="wIdx === 0 ? 'border-t-2 border-t-indigo-200' : ''">

                      <!-- No (rowspan = total rows for this machine = WOs*2 + 3 summary rows) -->
                      <td v-if="wIdx === 0"
                        :rowspan="group.workOrders.length * 2 + 3"
                        class="px-2 py-1 text-center font-bold text-gray-600 border-r bg-gray-50 sticky left-0 z-20 align-top pt-3 text-sm"
                        style="border-bottom: 3px solid #6366f1">
                        {{ gIdx + 1 }}
                      </td>

                      <!-- MACHINE info (rowspan = same as No) -->
                      <td v-if="wIdx === 0"
                        :rowspan="group.workOrders.length * 2 + 3"
                        class="px-2 py-2 border-r bg-gradient-to-b from-indigo-50 to-purple-50 sticky left-10 z-20 align-top"
                        style="border-bottom: 3px solid #6366f1">
                        <div class="space-y-1.5">
                          <div class="bg-indigo-500 text-white rounded px-2 py-1.5">
                            <div class="text-[10px] font-bold mb-0.5">MACHINE</div>
                            <div class="text-[11px] font-bold leading-tight" :title="group.machineName">
                              {{ group.machineName || 'Not Assigned' }}
                            </div>
                            <div v-if="group.machineCode" class="text-[9px] text-indigo-200">{{ group.machineCode }}</div>
                          </div>
                          <div class="bg-indigo-400 text-white rounded px-2 py-1.5">
                            <div class="flex items-center justify-between">
                              <span class="text-[10px] font-bold">Capacity</span>
                              <span class="text-[11px] font-bold">{{ group.capacityPerHour || '-' }}/hr</span>
                            </div>
                            <div class="flex items-center justify-between mt-0.5">
                              <span class="text-[9px]">{{ group.capacityUnit || '' }}</span>
                              <span class="text-[9px] font-bold">
                                {{ group.workingHoursPerWeek ? (group.workingHoursPerWeek / 5).toFixed(0) : machineCapacity }}h/day
                              </span>
                            </div>
                            <div v-if="group.capacityPerHour && group.workingHoursPerWeek" class="text-[9px] text-indigo-200 mt-0.5 text-right">
                              Max {{ (group.capacityPerHour * group.workingHoursPerWeek / 5).toLocaleString('id') }}/day
                            </div>
                          </div>
                          <div class="bg-gray-100 rounded px-2 py-1 text-center">
                            <div class="text-[9px] text-gray-500 font-bold">{{ group.workOrders.length }} Work Order{{ group.workOrders.length > 1 ? 's' : '' }}</div>
                          </div>
                        </div>
                      </td>

                      <!-- WORK ORDER info (rowspan 2: Planned + Actual) -->
                      <td :rowspan="2"
                        class="px-2 py-2 border-r sticky left-[160px] z-20 align-middle text-center bg-white"
                        :class="wIdx === group.workOrders.length - 1 ? '' : 'border-b border-indigo-100'">
                        <div class="text-[9px] text-indigo-500 font-bold">{{ wo.wo_number || 'WO-' + wo.id }}</div>
                        <div class="font-bold text-gray-900 text-[11px] mt-0.5 leading-tight">{{ wo.product_name }}</div>
                        <div class="text-[9px] text-gray-400">{{ wo.sku }}</div>
                        <div v-if="wo.mps_number" class="mt-1">
                          <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-teal-50 border border-teal-200 text-teal-700 text-[9px] font-bold rounded-full">
                            MPS · {{ wo.mps_number }}
                          </span>
                          <div v-if="wo.wo_week_number" class="text-[9px] text-teal-500 mt-0.5">W{{ wo.wo_week_number }}</div>
                        </div>
                        <div v-else-if="wo.source_type === 'MANUAL'" class="mt-1">
                          <span class="inline-flex items-center px-1.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-600 text-[9px] font-bold rounded-full">Manual</span>
                        </div>
                        <div v-else class="mt-1">
                          <span class="inline-flex items-center px-1.5 py-0.5 bg-gray-50 border border-gray-200 text-gray-400 text-[9px] rounded-full">Legacy</span>
                        </div>
                        <button @click.stop="showTrace(wo)" class="mt-1 text-[8px] text-indigo-400 hover:text-indigo-600 underline">Trace</button>
                        <div class="mt-1 text-[9px] font-bold text-indigo-600">
                          Qty: {{ formatN(wo.quantity) }}
                        </div>
                      </td>

                      <!-- TASK: Planned -->
                      <td class="px-1 py-1 border-r sticky left-[270px] z-20 bg-white">
                        <div class="bg-blue-500 text-white rounded px-2 py-1.5 text-[10px] font-bold flex items-center gap-1">
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
                      <!-- UOM (rowspan 2) -->
                      <td :rowspan="2" class="px-1 py-1 text-center border-r bg-gray-50 align-middle font-semibold text-gray-600 text-[10px]"
                        :class="wIdx === group.workOrders.length - 1 ? '' : 'border-b border-indigo-100'">
                        {{ wo._uom || 'Kgs' }}
                      </td>
                      <!-- Day cells: Planned -->
                      <td v-for="dc in dayColumns" :key="'plan-' + wo.id + '-' + dc.day"
                        class="px-0 py-0.5 text-center border-r"
                        :class="dc.isWeekend ? 'bg-gray-50' : ''">
                        <input v-model.number="getDayData(wo, dc.day).planned" type="number" min="0"
                          @change="markDirty(wo)"
                          class="w-full border-0 text-center text-[10px] font-medium py-1.5 focus:ring-1 focus:ring-blue-300"
                          :class="dc.isWeekend ? 'bg-gray-50 text-gray-400' : 'bg-blue-50 text-blue-800 focus:bg-blue-100'" />
                      </td>
                    </tr>

                    <!-- ROW: Actual -->
                    <tr class="border-b border-gray-100 hover:bg-green-50/20"
                      :class="wIdx === group.workOrders.length - 1 ? 'border-b-2 border-b-indigo-100' : ''">
                      <!-- TASK: Actual -->
                      <td class="px-1 py-1 border-r sticky left-[270px] z-20 bg-white">
                        <div class="bg-green-500 text-white rounded px-2 py-1.5 text-[10px] font-bold flex items-center gap-1">
                          🏭 Actual
                        </div>
                      </td>
                      <!-- REMAINING -->
                      <td class="px-1 py-1 text-center border-r text-[10px] font-bold"
                        :class="getRemaining(wo, 'actual') > 0 ? 'bg-amber-50 text-amber-700' : getRemaining(wo, 'actual') < 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'">
                        {{ formatN(getRemaining(wo, 'actual')) }}
                      </td>
                      <!-- TOTAL -->
                      <td class="px-1 py-1 text-center border-r font-bold bg-green-50 text-green-700 text-xs">
                        {{ formatN(getDayTotal(wo, 'actual')) }}
                      </td>
                      <!-- Day cells: Actual -->
                      <td v-for="dc in dayColumns" :key="'act-' + wo.id + '-' + dc.day"
                        class="px-0 py-0.5 text-center border-r"
                        :class="dc.isWeekend ? 'bg-gray-50' : ''">
                        <input v-model.number="getDayData(wo, dc.day).actual" type="number" min="0"
                          @change="markDirty(wo)"
                          class="w-full border-0 text-center text-[10px] font-medium py-1.5 focus:ring-1 focus:ring-green-300"
                          :class="dc.isWeekend ? 'bg-gray-50 text-gray-400' : 'bg-green-50 text-green-800 focus:bg-green-100'" />
                      </td>
                    </tr>
                  </template>

                  <!-- MACHINE SUMMARY: Total Planned -->
                  <tr class="bg-blue-50/60 border-b border-indigo-100">
                    <td class="px-1 py-1 border-r sticky left-[270px] z-20 bg-blue-50">
                      <div class="bg-blue-700 text-white rounded px-2 py-1.5 text-[10px] font-bold flex items-center gap-1">
                        Σ Total Planned
                      </div>
                    </td>
                    <td class="px-1 py-1 text-center border-r font-bold text-blue-700 text-xs bg-blue-50">—</td>
                    <td class="px-1 py-1 text-center border-r font-bold bg-blue-100 text-blue-800 text-xs">
                      {{ formatN(getMachineDayTotal(group, 'planned', null)) }}
                    </td>
                    <td class="px-1 py-1 text-center border-r bg-blue-50 text-[9px] text-blue-400 font-bold">Kgs</td>
                    <td v-for="dc in dayColumns" :key="'mtp-' + group.machineId + '-' + dc.day"
                      class="px-0 py-0.5 text-center border-r"
                      :class="dc.isWeekend ? 'bg-gray-100' : 'bg-blue-50'">
                      <div class="py-1.5 text-[10px] font-bold text-blue-700">
                        {{ formatN(getMachineDayTotal(group, 'planned', dc.day)) || '—' }}
                      </div>
                    </td>
                  </tr>

                  <!-- MACHINE SUMMARY: Total Actual -->
                  <tr class="bg-green-50/60 border-b border-indigo-100">
                    <td class="px-1 py-1 border-r sticky left-[270px] z-20 bg-green-50">
                      <div class="bg-green-700 text-white rounded px-2 py-1.5 text-[10px] font-bold flex items-center gap-1">
                        Σ Total Actual
                      </div>
                    </td>
                    <td class="px-1 py-1 text-center border-r font-bold text-green-700 text-xs bg-green-50">—</td>
                    <td class="px-1 py-1 text-center border-r font-bold bg-green-100 text-green-800 text-xs">
                      {{ formatN(getMachineDayTotal(group, 'actual', null)) }}
                    </td>
                    <td class="px-1 py-1 text-center border-r bg-green-50 text-[9px] text-green-400 font-bold">Kgs</td>
                    <td v-for="dc in dayColumns" :key="'mta-' + group.machineId + '-' + dc.day"
                      class="px-0 py-0.5 text-center border-r"
                      :class="dc.isWeekend ? 'bg-gray-100' : 'bg-green-50'">
                      <div class="py-1.5 text-[10px] font-bold text-green-700">
                        {{ formatN(getMachineDayTotal(group, 'actual', dc.day)) || '—' }}
                      </div>
                    </td>
                  </tr>

                  <!-- MACHINE SUMMARY: Utilization % -->
                  <tr style="border-bottom: 3px solid #6366f1">
                    <td class="px-1 py-1 border-r sticky left-[270px] z-20 bg-white">
                      <div class="bg-gray-100 text-gray-700 rounded px-2 py-1.5 text-[10px] font-bold flex items-center gap-1 border border-gray-200">
                        📈 Utilization %
                      </div>
                    </td>
                    <td class="px-1 py-1 text-center border-r font-bold bg-gray-50 text-gray-400 text-[10px]">—</td>
                    <td class="px-1 py-1 text-center border-r font-bold bg-gray-50 text-gray-700 text-xs">
                      {{ getMachineAvgUtil(group) }}%
                    </td>
                    <td class="px-1 py-1 text-center border-r bg-gray-50 text-[9px] text-gray-400">—</td>
                    <td v-for="dc in dayColumns" :key="'util-' + group.machineId + '-' + dc.day"
                      class="px-0 py-0.5 text-center border-r"
                      :class="dc.isWeekend ? 'bg-gray-50' : ''">
                      <div class="py-1.5 text-[10px] font-bold rounded mx-0.5"
                        :class="getMachineUtilDay(group, dc.day) > 90 ? 'bg-red-100 text-red-700' : getMachineUtilDay(group, dc.day) > 70 ? 'bg-yellow-100 text-yellow-700' : getMachineUtilDay(group, dc.day) > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-50 text-gray-400'">
                        {{ getMachineUtilDay(group, dc.day) > 0 ? getMachineUtilDay(group, dc.day) + '%' : '—' }}
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

    <!-- Trace Modal -->
    <div v-if="traceVisible" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="traceVisible = false">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div class="px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-700 text-white flex justify-between items-center">
          <h3 class="font-bold text-sm">WO Demand Trace</h3>
          <button @click="traceVisible = false" class="text-white/80 hover:text-white text-lg">&times;</button>
        </div>
        <div class="p-5">
          <div v-if="traceLoading" class="text-center py-8">
            <div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
          </div>
          <div v-else-if="traceData">
            <!-- WO header -->
            <div class="mb-3">
              <span class="font-bold text-indigo-700">{{ traceData.wo?.wo_number }}</span>
              <span class="ml-2 px-2 py-0.5 text-xs rounded-full font-bold"
                :class="traceData.wo?.source_type === 'MPS' ? 'bg-teal-100 text-teal-700' : traceData.wo?.source_type === 'MANUAL' ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500'">
                {{ traceData.wo?.source_type || 'LEGACY_UNKNOWN' }}
              </span>
            </div>

            <!-- MPS chain -->
            <div v-if="traceData.mps" class="space-y-2">
              <div class="flex items-center gap-2 text-sm">
                <span class="text-gray-400">&rarr;</span>
                <span class="font-semibold text-teal-700">{{ traceData.mps.mps_number }}</span>
                <span class="text-xs text-gray-400">{{ traceData.mps.period }} &middot; W{{ traceData.mps.week_number }}</span>
              </div>
              <div v-if="traceData.demand_sources?.length" class="ml-6 space-y-1.5">
                <div v-for="(src, i) in traceData.demand_sources" :key="i"
                  class="flex items-center gap-2 text-sm bg-slate-50 rounded px-3 py-1.5">
                  <span class="text-gray-400">&rarr;</span>
                  <span v-if="src.type === 'SO_ITEM'" class="text-blue-700 font-semibold">{{ src.ref }}</span>
                  <span v-else-if="src.type === 'PROJECT'" class="text-purple-700 font-semibold">{{ src.ref }}</span>
                  <span v-else class="text-orange-600 font-semibold">{{ src.ref || 'Forecast' }}</span>
                  <span v-if="src.customer" class="text-xs text-gray-500">&middot; {{ src.customer }}</span>
                  <span v-if="src.name" class="text-xs text-gray-500">&middot; {{ src.name }}</span>
                  <span v-if="src.period" class="text-xs text-gray-500">&middot; {{ src.period }}</span>
                  <span v-if="src.week" class="text-xs text-gray-500">&middot; W{{ src.week }}</span>
                  <span v-if="src.quantity" class="ml-auto text-xs font-bold text-gray-600">{{ Number(src.quantity).toLocaleString('id') }}</span>
                </div>
              </div>
              <div v-else class="ml-6 text-xs text-gray-400 italic">No demand sources linked</div>
            </div>

            <!-- Manual -->
            <div v-else-if="traceData.manual" class="space-y-2">
              <div class="text-sm">
                <span class="font-semibold text-gray-700">Reason:</span>
                <span class="ml-1 text-gray-600">{{ traceData.manual.source_reason || '—' }}</span>
              </div>
              <div class="text-sm">
                <span class="font-semibold text-gray-700">Created by:</span>
                <span class="ml-1 text-gray-600">{{ traceData.manual.created_by || '—' }}</span>
              </div>
              <div class="text-xs text-gray-400">{{ traceData.manual.created_at }}</div>
            </div>

            <!-- Legacy -->
            <div v-else-if="traceData.note" class="text-sm text-gray-400 italic py-4">
              {{ traceData.note }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { api } from '../lib/api';

const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const now = new Date();
const selectedYear = ref(now.getFullYear());
const selectedMonth = ref(now.getMonth() + 1);
const yearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

const loading = ref(false);
const workOrders = ref<any[]>([]);
const filteredWorkOrders = computed(() => {
  if (filterMps.value === 'mps') return workOrders.value.filter((wo: any) => wo.source_type === 'MPS');
  if (filterMps.value === 'manual') return workOrders.value.filter((wo: any) => wo.source_type === 'MANUAL');
  if (filterMps.value === 'legacy') return workOrders.value.filter((wo: any) => !wo.source_type || wo.source_type === 'LEGACY_UNKNOWN');
  return workOrders.value;
});
const dayColumns = ref<any[]>([]);
const machineCapacity = ref(8);
const filterMps = ref('');
const utilZoomed = ref(false);
const includeHistorical = ref(false);

// trace panel
const traceVisible = ref(false);
const traceData = ref<any>(null);
const traceLoading = ref(false);

const showTrace = async (wo: any) => {
  traceVisible.value = true;
  traceLoading.value = true;
  traceData.value = null;
  try {
    const res = await api.get(`/workorders/${wo.id}/trace`);
    traceData.value = res.data.data;
  } catch (e) {
    traceData.value = { wo: { wo_number: wo.wo_number, source_type: wo.source_type }, note: 'Failed to load trace data' };
  } finally {
    traceLoading.value = false;
  }
};

// Day data map for editable cells
const dayDataMap = reactive<Record<string, any>>({});

// WOs edited since the last save.
//
// Before this, the grid had editable inputs and no save endpoint at all: the
// numbers lived in dayDataMap until loadData() ran again and recomputed them
// from capacity. Tracking WHICH rows changed keeps the save to the rows the
// operator actually touched, instead of writing every visible WO back and
// turning a suggested spread into a committed schedule nobody asked for.
const dirtyWoIds = ref<number[]>([]);
const saving = ref(false);

const markDirty = (wo: any) => {
  if (!dirtyWoIds.value.includes(wo.id)) dirtyWoIds.value.push(wo.id);
};

const saveSchedule = async () => {
  if (!dirtyWoIds.value.length || saving.value) return;
  saving.value = true;
  const pad = (n: number) => String(n).padStart(2, '0');
  const failed: string[] = [];
  try {
    for (const woId of [...dirtyWoIds.value]) {
      const wo = workOrders.value.find((w: any) => w.id === woId);
      if (!wo) continue;
      const days = dayColumns.value.map((dc: any) => {
        const cell = getDayData(wo, dc.day);
        return {
          date: `${selectedYear.value}-${pad(selectedMonth.value)}-${pad(dc.day)}`,
          planned: Number(cell.planned) || 0,
          actual: Number(cell.actual) > 0 ? Number(cell.actual) : null,
        };
      });
      try {
        await api.put(`/production/planning/daily/${woId}`, { days });
        wo.has_saved_schedule = true;
        dirtyWoIds.value = dirtyWoIds.value.filter(id => id !== woId);
      } catch (e: any) {
        // Keep this WO dirty so a partial failure stays visible and retryable,
        // rather than the button going green while one row never landed.
        failed.push(wo.wo_number || `WO#${woId}`);
      }
    }
    if (failed.length) {
      alert(`Gagal menyimpan ${failed.length} work order: ${failed.join(', ')}. Perubahannya masih tersimpan di layar — coba Simpan lagi.`);
    }
  } finally {
    saving.value = false;
  }
};

const formatN = (n: any) => {
  const num = Number(n);
  if (isNaN(num) || num === 0) return '0.00';
  return num.toFixed(2);
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
    dayDataMap[key] = reactive({ planned: 0, actual: 0, line_process: 0, fg_qty: 0 });
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

// ─── Machine group computed ───────────────────────────────────────────────────
const machineGroups = computed(() => {
  const groups: Record<string, any> = {};
  for (const wo of filteredWorkOrders.value) {
    // Use effective_line_process_id (auto-resolved from product mapping if WO has no direct assignment)
    const key = wo.effective_line_process_id || wo.line_process_id || 'unassigned';
    if (!groups[key]) {
      groups[key] = {
        machineId: key,
        machineName: wo._machine || 'Not Assigned',
        machineCode: wo._machine_code || '',
        capacityPerHour: wo._capacity_per_hour || null,
        capacityUnit: wo._uom || 'Kgs',
        workingHoursPerWeek: wo.working_hours_per_week || null,
        workOrders: []
      };
    }
    groups[key].workOrders.push(wo);
  }
  return Object.values(groups);
});

// Machine-level: sum planned or actual for a specific day (null = all days)
const getMachineDayTotal = (group: any, field: string, day: number | null): number => {
  if (day === null) {
    // total across all days
    let sum = 0;
    for (const wo of group.workOrders) sum += getDayTotal(wo, field);
    return sum;
  }
  let sum = 0;
  for (const wo of group.workOrders) {
    sum += Number(getDayData(wo, day)[field]) || 0;
  }
  return sum;
};

// Machine utilization per day
// Hours/day = workingHoursPerWeek / 5 (from master data), fallback to global machineCapacity
const getMachineHoursPerDay = (group: any): number => {
  if (group.workingHoursPerWeek) return Number(group.workingHoursPerWeek) / 5;
  return Number(machineCapacity.value) || 8;
};

const getMachineUtilDay = (group: any, day: number): number => {
  const totalPlanned = getMachineDayTotal(group, 'planned', day);
  if (!totalPlanned) return 0;
  const capPerHour = Number(group.capacityPerHour) || 0;
  if (!capPerHour) return 0;
  const capPerDay = capPerHour * getMachineHoursPerDay(group);
  return Math.min(Math.round((totalPlanned / capPerDay) * 100), 999);
};

// Average utilization across active days for a machine group
const getMachineAvgUtil = (group: any): number => {
  let count = 0, sum = 0;
  for (const dc of dayColumns.value) {
    const u = getMachineUtilDay(group, dc.day);
    if (u > 0) { sum += u; count++; }
  }
  return count > 0 ? Math.round(sum / count) : 0;
};

const loadData = async () => {
  loading.value = true;
  generateDayColumns();
  Object.keys(dayDataMap).forEach(k => delete dayDataMap[k]);
  // The cells these ids referred to have just been discarded. Keeping them
  // would let a later Save write the NEW month's numbers under an old month's
  // edit flag.
  dirtyWoIds.value = [];
  try {
    const params: any = { year: selectedYear.value, month: selectedMonth.value };
    if (includeHistorical.value) params.include_historical = '1';
    const res = await api.get('/production/planning/weekly', { params });
    const wos = res.data.data.workOrders || [];
    for (const wo of wos) {
      wo._machine = wo.line_process_name || '';
      wo._machine_code = wo.line_process_code || '';
      wo._capacity_per_hour = wo.capacity_per_hour || null;
      wo._capacity_unit = wo.capacity_unit_name || '';
      wo._working_hours_per_week = wo.working_hours_per_week || null;
      wo._uom = wo.capacity_unit_name || 'Kgs';

      // A SAVED schedule is the operator's decision and outranks the spread.
      //
      // The auto-spread below is a SEED, not a source of truth: it is what the
      // screen suggests for a WO nobody has scheduled by hand yet. Running it
      // over saved rows is exactly the behaviour the review called out — every
      // edit silently recomputed away on refresh.
      if (wo.has_saved_schedule && wo.daily_schedule) {
        for (const dc of dayColumns.value) {
          const pad = (n: number) => String(n).padStart(2, '0');
          const key = `${selectedYear.value}-${pad(selectedMonth.value)}-${pad(dc.day)}`;
          const saved = wo.daily_schedule[key];
          if (saved) {
            const cell = getDayData(wo, dc.day);
            cell.planned = Number(saved.planned) || 0;
            cell.actual = saved.actual === null ? 0 : Number(saved.actual) || 0;
          }
        }
        continue;
      }

      // Pre-fill: auto-spread WO qty across work days based on machine daily capacity
      // If qty exceeds the scheduled window, auto-extend to next available work days
      if (wo.scheduled_start && wo.quantity) {
        const parseLocal = (s: string) => { const [y, m, d] = s.substring(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
        const start = parseLocal(wo.scheduled_start);
        // Get all work days from scheduled_start onwards (auto-extend beyond scheduled_end)
        const availableWorkDays = dayColumns.value.filter(dc =>
          !dc.isWeekend && dc.date >= start
        );
        if (availableWorkDays.length > 0) {
          const capacityPerHour = Number(wo.capacity_per_hour) || 0;
          const hoursPerDay = capacityPerHour > 0
            ? Number(wo.working_hours_per_week || 40) / 5
            : 0;
          const dailyCapacity = Math.round(capacityPerHour * hoursPerDay * 100) / 100;

          if (dailyCapacity > 0) {
            // Fill each day to max capacity, carry remainder to next day
            let remaining = Number(wo.quantity);
            let lastFilledDay: Date | null = null;
            for (const dc of availableWorkDays) {
              if (remaining <= 0) break;
              const fillQty = Math.min(dailyCapacity, remaining);
              getDayData(wo, dc.day).planned = Math.round(fillQty * 100) / 100;
              remaining -= fillQty;
              lastFilledDay = dc.date;
            }

            // Auto-extend: update visual scheduled_end to the last filled day
            if (lastFilledDay && wo.scheduled_end) {
              const origEnd = parseLocal(wo.scheduled_end);
              if (lastFilledDay > origEnd) {
                const pad = (n: number) => String(n).padStart(2, '0');
                wo.scheduled_end = `${lastFilledDay.getFullYear()}-${pad(lastFilledDay.getMonth() + 1)}-${pad(lastFilledDay.getDate())}`;
                wo._auto_extended = true;
              }
            }
          } else {
            // No capacity configured: distribute evenly across originally scheduled work days
            const end = wo.scheduled_end ? parseLocal(wo.scheduled_end) : start;
            const scheduledWorkDays = availableWorkDays.filter(dc => dc.date <= end);
            if (scheduledWorkDays.length > 0) {
              const dailyQty = Math.round(Number(wo.quantity) / scheduledWorkDays.length * 100) / 100;
              for (const dc of scheduledWorkDays) {
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
:deep(tbody tr) { transition: all 0.15s ease; }
:deep(tbody tr:hover) { filter: brightness(0.97); }
:deep(input[type="number"]) {
  transition: box-shadow 0.15s ease, background-color 0.15s ease;
  -moz-appearance: textfield;
}
:deep(input[type="number"]::-webkit-inner-spin-button),
:deep(input[type="number"]::-webkit-outer-spin-button) {
  -webkit-appearance: none; margin: 0;
}
:deep(input[type="number"]:focus) {
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.3);
}
</style>
