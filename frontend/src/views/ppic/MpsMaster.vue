<template>
  <div class="h-full flex flex-col bg-slate-100">
    <!-- Toast notification -->
    <transition name="toast-fade">
      <div v-if="toastMsg"
        class="fixed top-4 right-4 z-[9999] max-w-sm px-4 py-3 rounded-lg shadow-xl text-sm font-medium flex items-start gap-2"
        :class="toastType === 'warn' ? 'bg-amber-50 border border-amber-300 text-amber-800' : toastType === 'error' ? 'bg-red-50 border border-red-300 text-red-800' : 'bg-green-50 border border-green-300 text-green-800'">
        <span class="mt-0.5">{{ toastType === 'warn' ? '⚠️' : toastType === 'error' ? '🚫' : '✅' }}</span>
        <span class="flex-1">{{ toastMsg }}</span>
        <button @click="toastMsg = ''" class="ml-1 opacity-60 hover:opacity-100 text-lg leading-none">×</button>
      </div>
    </transition>
    <!-- Header -->
    <div class="px-6 py-3 bg-gradient-to-r from-teal-600 to-cyan-700 text-white shadow-lg">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-lg font-bold tracking-wide">🏭 MPS — Master Production Schedule</h1>
          <p class="text-xs text-teal-100">Production Planning Recommendations · Weekly Timeline</p>
        </div>
        <div class="flex items-center gap-2">
          <select v-model="selectedYear" @change="loadMpsList" class="bg-white/20 border border-white/30 rounded px-2 py-1.5 text-sm text-white">
            <option v-for="y in yearOptions" :key="y" :value="y" class="text-gray-900">{{ y }}</option>
          </select>
          <select v-model="selectedMonth" @change="loadMpsList" class="bg-white/20 border border-white/30 rounded px-2 py-1.5 text-sm text-white">
            <option v-for="(m, idx) in monthNames" :key="idx" :value="idx + 1" class="text-gray-900">{{ m }}</option>
          </select>
          <button @click="createMps" class="px-3 py-1.5 bg-white text-teal-700 rounded font-semibold text-sm hover:bg-teal-50 transition-colors">
            + Create MPS
          </button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-auto p-4">
      <!-- MPS List -->
      <div v-if="!activeMps" class="space-y-3 max-w-2xl mx-auto">
        <div v-if="mpsList.length === 0" class="text-center py-16">
          <div class="text-5xl mb-3">📋</div>
          <h3 class="text-lg font-medium text-gray-600">Belum ada MPS untuk {{ monthNames[selectedMonth - 1] }} {{ selectedYear }}</h3>
          <button @click="createMps" class="mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg font-semibold text-sm hover:bg-teal-700">+ Create MPS</button>
        </div>
        <div v-for="mps in mpsList" :key="mps.id" @click="openMps(mps.id)"
          class="bg-white rounded-xl border-2 border-transparent hover:border-teal-400 p-5 shadow-sm hover:shadow-lg cursor-pointer transition-all">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-11 h-11 rounded-xl flex items-center justify-center text-lg shadow"
                :class="mps.status === 'Confirmed' ? 'bg-green-500 text-white' : 'bg-amber-400 text-white'">
                {{ mps.status === 'Confirmed' ? '✓' : '✎' }}
              </div>
              <div>
                <div class="font-bold text-gray-900">{{ mps.mps_number }}</div>
                <div class="text-xs text-gray-500">{{ monthNames[(mps.period_month || 1) - 1] }} {{ mps.period_year }} · {{ mps.item_count || 0 }} items</div>
              </div>
            </div>
            <span class="px-3 py-1 rounded-full text-xs font-bold"
              :class="mps.status === 'Confirmed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'">
              {{ mps.status }}
            </span>
          </div>
        </div>
      </div>

      <!-- ========== ACTIVE MPS ========== -->
      <div v-if="activeMps">
        <!-- Action Bar -->
        <div class="bg-white rounded-lg shadow-sm p-3 mb-3 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <button @click="goBack" class="p-1.5 hover:bg-gray-100 rounded text-gray-500">←</button>
            <div>
              <span class="font-bold text-gray-900">{{ activeMps.mps_number }}</span>
              <span class="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold"
                :class="activeMps.status === 'Confirmed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'">
                {{ activeMps.status }}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button v-if="activeMps.status === 'Draft'" @click="pullOrders" :disabled="pulling"
              class="px-3 py-1.5 bg-orange-500 text-white rounded text-xs font-bold hover:bg-orange-600 disabled:opacity-50">
              {{ pulling ? '...' : '📥 Pull Orders' }}
            </button>
            <button v-if="activeMps.status === 'Draft' && mpsDetails.length > 0" @click="autoRecommendAll"
              class="px-3 py-1.5 bg-violet-600 text-white rounded text-xs font-bold hover:bg-violet-700"
              title="Auto-calculate recommended production qty based on demand and inventory">
              ⚡ Auto Recommend
            </button>
            <button v-if="activeMps.status === 'Draft'" @click="showAddItemModal = true"
              class="px-3 py-1.5 bg-indigo-500 text-white rounded text-xs font-bold hover:bg-indigo-600">
              + Add Item
            </button>
            <button v-if="activeMps.status === 'Draft' && mpsDetails.length > 0" @click="saveAll" :disabled="saving"
              class="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 disabled:opacity-50"
              :class="isDirty ? 'ring-2 ring-blue-300' : ''">
              {{ saving ? '...' : '💾 Save' }}
            </button>
            <button v-if="activeMps.status === 'Draft' && mpsDetails.length > 0" @click="confirmMps"
              class="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-700">✓ Confirm</button>
            <button v-if="activeMps.status === 'Draft'" @click="deleteMps"
              class="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">🗑</button>
            <button v-if="activeMps.status === 'Confirmed'" @click="revertMps"
              class="px-3 py-1.5 bg-amber-500 text-white rounded text-xs font-bold hover:bg-amber-600">
              ↩️ Revert to Draft
            </button>
          </div>
        </div>

        <!-- ========== CAPACITY SUMMARY BAR ========== -->
        <div v-if="mpsDetails.length > 0 && weekColumns.length > 0" class="bg-white rounded-lg shadow-sm mb-3 overflow-hidden">
          <div class="flex items-center gap-2 px-3 pt-2 pb-1">
            <span class="text-sm font-bold text-gray-700">📊 Weekly Capacity vs Demand</span>
            <span class="text-xs text-gray-400">Total across all products</span>
          </div>
          <!-- Use same table width as main grid so columns align -->
          <div class="overflow-x-auto">
            <table class="w-full border-collapse" style="min-width: 1600px">
              <tbody>
                <tr>
                  <!-- Spacer: matches No(40) + INFO(160) + PRODUCT(130) + ROW(150) + TOTAL(65) + UOM(50) = 595px -->
                  <td style="width:40px; min-width:40px" class="border-r border-gray-100 bg-gray-50"></td>
                  <td style="width:160px; min-width:160px" class="border-r border-gray-100 bg-gray-50 px-3 py-2">
                    <div class="text-xs text-gray-500 font-semibold leading-tight">⚡ Max Capacity</div>
                    <div class="text-sm text-teal-600 font-bold mt-0.5">
                      {{ totalMaxCapacity > 0 ? formatN(totalMaxCapacity) + ' /wk' : '—' }}
                    </div>
                  </td>
                  <td style="width:130px; min-width:130px" class="border-r border-gray-100 bg-gray-50"></td>
                  <td style="width:150px; min-width:150px" class="border-r border-gray-100 bg-gray-50"></td>
                  <td style="width:65px; min-width:65px" class="border-r border-gray-100 bg-gray-50"></td>
                  <td style="width:50px; min-width:50px" class="border-r border-gray-100 bg-gray-50"></td>
                  <!-- Week cells — same 90px as grid -->
                  <td v-for="(wc, wIdx) in weekColumns" :key="'cap-'+wc.week+'-'+wc.year"
                    class="border-r border-gray-100 text-center py-2 px-1"
                    style="width:90px; min-width:90px">
                    <!-- Demand value -->
                    <div class="text-[12px] font-bold leading-tight"
                      :class="getCapacityStatus(wIdx) === 'over' ? 'text-red-600' : getCapacityStatus(wIdx) === 'near' ? 'text-yellow-600' : 'text-teal-700'">
                      {{ formatN(getWeekTotalDemand(wIdx)) || '—' }}
                    </div>
                    <!-- Progress bar -->
                    <div class="mx-1 h-2 rounded-full my-1 bg-gray-100 overflow-hidden">
                      <div class="h-full rounded-full transition-all duration-300"
                        :class="getCapacityStatus(wIdx) === 'over' ? 'bg-red-500' : getCapacityStatus(wIdx) === 'near' ? 'bg-yellow-400' : 'bg-teal-400'"
                        :style="`width:${getUtilizationPct(wIdx)}%`"></div>
                    </div>
                    <!-- Utilization % -->
                    <div class="text-[11px] font-semibold text-gray-500">
                      {{ getCapacityStatus(wIdx) === 'over' ? '🔴' : getCapacityStatus(wIdx) === 'near' ? '🟡' : '🟢' }}
                      {{ getUtilizationPct(wIdx) }}%
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>


        <!-- Empty State -->
        <div v-if="mpsDetails.length === 0" class="bg-white rounded-lg shadow-sm text-center py-16">
          <div class="text-5xl mb-3">📭</div>
          <h3 class="text-gray-600 font-medium">Belum ada item</h3>
          <button @click="pullOrders" class="mt-3 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-bold hover:bg-orange-600">
            📥 Pull Orders
          </button>
        </div>

        <!-- ========== MAIN GRID: 7 ROWS PER PRODUCT ========== -->
        <div v-if="mpsDetails.length > 0" class="bg-white rounded-lg shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full border-collapse text-sm" style="min-width: 1600px">
              <!-- HEADER -->
              <thead>
                <tr class="bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
                  <th class="px-3 py-2.5 text-center border-r border-teal-500 w-10 sticky left-0 z-30 bg-teal-600 text-sm">No</th>
                  <th class="px-3 py-2.5 text-center border-r border-teal-500 w-[160px] min-w-[160px] sticky left-[40px] z-30 bg-teal-600 text-sm">INFO</th>
                  <th class="px-3 py-2.5 text-center border-r border-teal-500 w-[130px] min-w-[130px] sticky left-[200px] z-30 bg-teal-600 text-sm">PRODUCT</th>
                  <th class="px-3 py-2.5 text-center border-r border-teal-500 w-[150px] min-w-[150px] sticky left-[330px] z-30 bg-teal-600 text-sm">ROW</th>
                  <th class="px-2 py-2.5 text-center border-r border-teal-500 w-[65px] text-sm">TOTAL</th>
                  <th class="px-2 py-2.5 text-center border-r border-teal-500 w-[50px] text-sm">UOM</th>
                  <th v-for="wc in weekColumns" :key="wc.week+'-'+wc.year"
                    class="px-1 py-2.5 text-center border-r border-teal-500 w-[90px] min-w-[90px]">
                    <div class="font-bold text-sm">{{ wc.label }}</div>
                    <div class="text-[10px] text-teal-200 font-normal">{{ wc.dateRange }}</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <!-- FOR EACH PRODUCT: 7 ROWS -->
                <template v-for="(item, pIdx) in mpsDetails" :key="item.id">
                  <!-- Row 1: Demand (SO) -->
                  <tr class="border-b border-gray-100 hover:bg-blue-50/30">
                    <!-- No (rowspan 8) -->
                    <td :rowspan="8" class="px-2 py-1 text-center font-bold text-gray-600 border-r bg-gray-50 sticky left-0 z-20 align-top pt-4 text-sm"
                      style="border-bottom: 3px solid #0d9488">
                      {{ pIdx + 1 }}
                    </td>
                    <!-- INFO (rowspan 8) -->
                    <td :rowspan="8" class="px-2 py-2 border-r bg-gradient-to-b from-teal-50 to-cyan-50 sticky z-20 align-top"
                      style="border-bottom: 3px solid #0d9488; left: 40px">
                      <div class="space-y-1">
                        <div class="bg-amber-500 text-white rounded px-2 py-1.5 flex items-center justify-between">
                          <span class="text-[10px] font-bold">📦 FG Stock</span>
                          <span class="text-[11px] font-bold">{{ formatN(item.fg_inventory_stock || 0) }}</span>
                        </div>
                        <div class="bg-green-500 text-white rounded px-2 py-1.5 flex items-center justify-between">
                          <span class="text-[10px] font-bold">🏭 WO Output</span>
                          <span class="text-[11px] font-bold">{{ formatN(item.wo_actual_output || 0) }}</span>
                        </div>
                        <div class="bg-purple-500 text-white rounded px-2 py-1.5">
                          <div class="flex items-center justify-between">
                            <span class="text-[10px] font-bold">⚡ Capacity</span>
                            <span class="text-[10px]">{{ item.max_weekly_capacity ? formatN(item.max_weekly_capacity) + '/wk' : '—' }}</span>
                          </div>
                          <div class="text-[9px] mt-0.5 opacity-80">{{ item.line_name || 'No line assigned' }}</div>
                        </div>
                        <div class="rounded px-2 py-1.5"
                          :class="item.material_max_producible > 0 ? 'bg-green-100 border border-green-300' : 'bg-red-100 border border-red-300'">
                          <div class="flex items-center justify-between">
                            <span class="text-[10px] font-bold" :class="item.material_max_producible > 0 ? 'text-green-700' : 'text-red-700'">
                              {{ item.material_max_producible > 0 ? '✅ Material' : '⚠️ Material' }}
                            </span>
                            <span class="text-[10px] font-bold" :class="item.material_max_producible > 0 ? 'text-green-700' : 'text-red-700'">
                              {{ item.material_max_producible > 0 ? 'max ' + formatN(item.material_max_producible) : 'Short' }}
                            </span>
                          </div>
                        </div>
                        <div v-if="item.bom_name" class="text-[9px] text-gray-500 px-1">BOM: {{ item.bom_name }}</div>
                      </div>
                    </td>
                    <!-- PRODUCT (rowspan 8) -->
                    <td :rowspan="8" class="px-3 py-2 border-r sticky z-20 align-middle text-center bg-white cursor-pointer hover:bg-orange-50 transition-colors group/prod"
                      style="border-bottom: 3px solid #0d9488; left: 200px" @click="openMrp(item)">
                      <div class="text-[10px] text-teal-600 font-bold">FG-{{ pIdx + 1 }}</div>
                      <div class="font-bold text-gray-900 text-[13px] mt-1 leading-tight group-hover/prod:text-orange-700">{{ item.product_name }}</div>
                      <div class="text-[10px] text-gray-400 mt-1">{{ item.product_sku }}</div>
                      <div v-if="item.so_numbers" class="mt-1 space-y-0.5">
                        <div v-for="soNum in item.so_numbers.split(', ')" :key="soNum"
                          class="text-[10px] bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded inline-block font-medium mr-0.5">📋 {{ soNum }}</div>
                      </div>
                      <div v-if="item.client_name" class="text-[10px] text-gray-400 mt-0.5">{{ item.client_name }}</div>
                      <div class="mt-1 text-[9px] text-orange-500 font-bold opacity-0 group-hover/prod:opacity-100 transition-opacity">▼ Click for MRP</div>
                      <!-- Delete button -->
                      <button v-if="activeMps.status === 'Draft'"
                        @click.stop="removeItem(item)"
                        class="mt-2 w-full text-[10px] text-red-400 hover:text-red-600 hover:bg-red-50 rounded py-0.5 transition-colors opacity-0 group-hover/prod:opacity-100">
                        🗑 Remove
                      </button>
                    </td>
                    <!-- ROW: Demand SO -->
                    <td class="px-1 py-1 border-r sticky z-20 bg-white" style="left: 330px">
                      <div class="bg-teal-600 text-white rounded px-2 py-2 text-[11px] font-bold flex items-center gap-1">
                        📋 Demand (SO)
                        <span v-if="item.demand_qty > 0" class="ml-auto text-[9px] bg-white/20 px-1 rounded font-normal">Ref:{{ formatN(item.demand_qty) }}</span>
                      </div>
                    </td>
                    <!-- TOTAL: compact ref display -->
                    <td class="px-1 py-1 text-center border-r bg-teal-50">
                      <div class="font-bold text-teal-700 text-sm">{{ formatN(taskTotal(item, 'so_qty')) }}</div>
                      <div v-if="item.demand_qty > 0" class="text-[9px] mt-0.5"
                        :class="taskTotal(item,'so_qty') >= item.demand_qty ? 'text-green-600' : 'text-amber-500'">
                        / {{ formatN(item.demand_qty) }}
                      </div>
                    </td>
                    <!-- UOM (rowspan 8) -->
                    <td :rowspan="8" class="px-1 py-1 text-center border-r bg-gray-50 align-middle font-semibold text-gray-600 text-[11px]"
                      style="border-bottom: 3px solid #0d9488">
                      {{ item.uom_name || 'Unit' }}
                    </td>
                    <!-- Week cells: SO Qty — always editable, show ref hint -->
                    <td v-for="wc in weekColumns" :key="'so-'+wc.week+'-'+wc.year"
                      class="px-0 py-0.5 text-center border-r relative group">
                      <input v-model.number="getWeekData(item, wc).so_qty" type="number" min="0"
                        @input="onDemandChange"
                        :placeholder="item.demand_qty > 0 ? String(Math.round(item.demand_qty / weekColumns.length)) : ''"
                        :title="item.demand_qty > 0 ? 'Ref SO per minggu ≈ ' + Math.round(item.demand_qty / weekColumns.length) : 'Masukkan qty SO demand'"
                        class="w-full border-0 bg-teal-50 text-center text-[11px] font-medium py-1.5 text-teal-800 focus:bg-teal-100 focus:ring-1 focus:ring-teal-300 placeholder:text-teal-300" />
                    </td>
                  </tr>

                  <!-- Row 2: Demand (Forecast) -->
                  <tr class="border-b border-gray-100 hover:bg-blue-50/30">
                    <td class="px-1 py-1 border-r sticky z-20 bg-white" style="left: 330px">
                      <div class="bg-blue-500 text-white rounded px-2 py-2 text-[11px] font-bold flex items-center gap-1">
                        📊 Demand (Forecast)
                      </div>
                    </td>
                    <td class="px-1 py-1 text-center border-r font-bold bg-blue-50 text-blue-700 text-sm">
                      {{ formatN(taskTotal(item, 'forecast_qty')) }}
                    </td>
                    <td v-for="wc in weekColumns" :key="'f-'+wc.week+'-'+wc.year"
                      class="px-0 py-0.5 text-center border-r">
                      <input v-model.number="getWeekData(item, wc).forecast_qty" type="number" min="0"
                        @input="onDemandChange"
                        class="w-full border-0 bg-blue-50 text-center text-[11px] font-medium py-1.5 text-blue-800 focus:bg-blue-100 focus:ring-1 focus:ring-blue-300" />
                    </td>
                  </tr>

                  <!-- Row 3: Total Demand -->
                  <tr class="border-b border-gray-100">
                    <td class="px-1 py-1 border-r sticky z-20 bg-white" style="left: 330px">
                      <div class="bg-gray-700 text-white rounded px-2 py-2 text-[11px] font-bold flex items-center gap-1">
                        📌 Total Demand (MAX)
                      </div>
                    </td>
                    <td class="px-1 py-1 text-center border-r font-bold bg-gray-100 text-gray-800 text-sm">
                      {{ formatN(totalDemandSum(item)) }}
                    </td>
                    <td v-for="wc in weekColumns" :key="'td-'+wc.week+'-'+wc.year"
                      class="px-0 py-0.5 text-center border-r">
                      <div class="py-1.5 text-[11px] font-bold bg-gray-100 text-gray-800">
                        {{ formatN(getTotalDemand(item, wc)) }}
                      </div>
                    </td>
                  </tr>

                  <!-- Row 4: Beginning Inventory -->
                  <tr class="border-b border-gray-100">
                    <td class="px-1 py-1 border-r sticky z-20 bg-white" style="left: 330px">
                      <div class="bg-amber-500 text-white rounded px-2 py-2 text-[11px] font-bold flex items-center gap-1">
                        📦 Beginning Inv
                      </div>
                    </td>
                    <td class="px-1 py-1 text-center border-r font-bold bg-amber-50 text-amber-700 text-sm">
                      {{ formatN(item.fg_inventory_stock || 0) }}
                    </td>
                    <td v-for="(wc, wIdx) in weekColumns" :key="'bi-'+wc.week+'-'+wc.year"
                      class="px-0 py-0.5 text-center border-r">
                      <div class="py-1.5 text-[11px] font-bold rounded mx-0.5"
                        :class="getBeginningInv(item, wIdx) < 0 ? 'bg-red-100 text-red-700' : 'bg-amber-50 text-amber-700'">
                        {{ formatN(getBeginningInv(item, wIdx)) }}
                      </div>
                    </td>
                  </tr>

                  <!-- Row 5: Recommended Production -->
                  <tr class="border-b border-gray-100 hover:bg-purple-50/30">
                    <td class="px-1 py-1 border-r sticky z-20 bg-white" style="left: 330px">
                      <div class="bg-purple-600 text-white rounded px-2 py-1.5 text-[11px] font-bold flex items-center justify-between gap-1">
                        <span>⭐ Rec. Production</span>
                        <div class="flex gap-1">
                          <button v-if="activeMps.status === 'Draft'"
                            @click="autoRecommendItem(item)"
                            class="bg-white text-purple-700 rounded px-1.5 py-0.5 text-[9px] font-bold hover:bg-purple-100 transition-colors"
                            title="Auto calculate recommended production">
                            AUTO
                          </button>
                          <button v-if="activeMps.status === 'Draft' && item.max_weekly_capacity > 0"
                            @click="fillMaxProduction(item)"
                            class="bg-white text-purple-700 rounded px-1.5 py-0.5 text-[9px] font-bold hover:bg-purple-100 transition-colors"
                            :title="`Fill semua minggu = ${item.max_weekly_capacity}/week`">
                            MAX
                          </button>
                        </div>
                      </div>
                    </td>
                    <td class="px-1 py-1 text-center border-r font-bold bg-purple-50 text-purple-700 text-sm">
                      {{ formatN(taskTotal(item, 'production_qty')) }}
                    </td>
                    <td v-for="(wc, wIdx) in weekColumns" :key="'rp-'+wc.week+'-'+wc.year"
                      class="px-0 py-0 text-center border-r relative">
                      <!-- Ending inv indicator strip at top -->
                      <div class="h-0.5 w-full"
                        :class="getEndingInv(item, wIdx) >= 0 ? 'bg-green-400' : 'bg-red-400'">
                      </div>
                      <input v-model.number="getWeekData(item, wc).production_qty" type="number" min="0"
                        :max="item.max_weekly_capacity > 0 ? item.max_weekly_capacity : undefined"
                        @input="clampProduction(item, wc)"
                        :title="item.max_weekly_capacity > 0
                          ? `Kapasitas mesin: ${formatN(item.max_weekly_capacity)}/wk\nMesin terpakai: ${formatN(getLineProcWeekTotal(item.line_process_id, wc))}\nEnding Inv: ${formatN(getEndingInv(item, wIdx))}`
                          : `Ending Inv: ${formatN(getEndingInv(item, wIdx))}`"
                        class="w-full border-0 text-center text-[11px] font-bold pt-1 pb-0 focus:ring-1 transition-colors"
                        :class="getCellCapacityPct(item, wc) >= 100 ? 'bg-red-100 text-red-700 focus:ring-red-400'
                          : getCellCapacityPct(item, wc) >= 75 ? 'bg-amber-50 text-amber-800 focus:ring-amber-400'
                          : getEndingInv(item, wIdx) >= 0
                            ? 'bg-green-50 text-green-700 focus:bg-green-100 focus:ring-green-300'
                            : 'bg-purple-50 text-purple-800 focus:bg-purple-100 focus:ring-purple-400'" />
                      <!-- Capacity bar at bottom of cell -->
                      <div v-if="item.max_weekly_capacity > 0" class="h-1 w-full bg-gray-200 mt-0">
                        <div class="h-full transition-all"
                          :style="{ width: getCellCapacityPct(item, wc) + '%' }"
                          :class="getCellCapacityPct(item, wc) >= 100 ? 'bg-red-500' : getCellCapacityPct(item, wc) >= 75 ? 'bg-amber-400' : 'bg-teal-400'">
                        </div>
                      </div>
                      <!-- "Sufficient" badge when no production needed -->
                      <div v-if="getEndingInv(item, wIdx) >= 0 && !getWeekData(item, wc).production_qty"
                        class="absolute inset-0 flex items-center justify-center pointer-events-none" style="top: 2px">
                        <span class="text-[8px] text-green-600 font-bold bg-green-100 rounded px-1">✓ OK</span>
                      </div>
                      <!-- OVER capacity badge -->
                      <div v-if="getCellCapacityPct(item, wc) >= 100"
                        class="absolute top-0.5 right-0.5 pointer-events-none">
                        <span class="text-[7px] text-red-600 font-bold bg-red-100 rounded px-0.5">OVER</span>
                      </div>
                    </td>
                  </tr>

                  <!-- Row 6: Material Check -->
                  <tr class="border-b border-gray-100">
                    <td class="px-1 py-1 border-r sticky z-20 bg-white" style="left: 330px">
                      <div class="bg-gray-100 text-gray-700 rounded px-2 py-2 text-[11px] font-bold flex items-center gap-1 border border-gray-200">
                        🧪 Material Check
                      </div>
                    </td>
                    <td class="px-1 py-1 text-center border-r font-bold bg-gray-50 text-gray-400 text-[11px]">—</td>
                    <td v-for="wc in weekColumns" :key="'ms-'+wc.week+'-'+wc.year"
                      class="px-0 py-0.5 text-center border-r">
                      <div class="py-1.5 text-[10px] font-bold rounded mx-0.5"
                        :class="getMaterialStatus(item, wc) === 'ok' ? 'bg-green-100 text-green-700' : getMaterialStatus(item, wc) === 'short' ? 'bg-red-100 text-red-700' : 'bg-gray-50 text-gray-400'">
                        {{ getMaterialStatus(item, wc) === 'ok' ? '✅' : getMaterialStatus(item, wc) === 'short' ? '⚠️' : '—' }}
                      </div>
                    </td>
                  </tr>

                  <!-- Row 7: Buffer Stock -->
                  <tr class="border-b border-gray-100">
                    <td class="px-1 py-1 border-r sticky z-20 bg-white" style="left: 330px">
                      <div class="bg-indigo-500 text-white rounded px-2 py-2 text-[11px] font-bold flex items-center gap-1">
                        🛡️ Buffer Stock
                      </div>
                    </td>
                    <td class="px-1 py-1 text-center border-r bg-indigo-50">
                      <input v-model.number="item.buffer_stock" type="number" min="0"
                        @change="saveBufferStock(item)"
                        class="w-full border-0 bg-indigo-50 text-center text-[11px] font-bold py-1.5 text-indigo-700 focus:bg-indigo-100 focus:ring-1 focus:ring-indigo-300" />
                    </td>
                    <td v-for="wc in weekColumns" :key="'buf-'+wc.week+'-'+wc.year"
                      class="px-0 py-0.5 text-center border-r">
                      <div class="py-1.5 text-[11px] font-semibold bg-indigo-50/50 text-indigo-600">
                        {{ formatN(item.buffer_stock || 0) }}
                      </div>
                    </td>
                  </tr>

                  <!-- Row 8: Ending Inventory -->
                  <tr style="border-bottom: 3px solid #0d9488">
                    <td class="px-1 py-1 border-r sticky z-20 bg-white" style="left: 330px">
                      <div class="bg-orange-500 text-white rounded px-2 py-2 text-[11px] font-bold flex items-center gap-1">
                        📈 Ending Inv
                      </div>
                    </td>
                    <td class="px-1 py-1 text-center border-r font-bold bg-orange-50 text-orange-700 text-sm">
                      {{ formatN(getEndingInv(item, weekColumns.length - 1)) }}
                    </td>
                    <td v-for="(wc, wIdx) in weekColumns" :key="'ei-'+wc.week+'-'+wc.year"
                      class="px-0 py-0.5 text-center border-r">
                      <div class="py-1.5 text-[11px] font-bold rounded mx-0.5"
                        :class="getEndingInv(item, wIdx) < 0 ? 'bg-red-100 text-red-700' : getEndingInv(item, wIdx) > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-50 text-gray-500'">
                        {{ formatN(getEndingInv(item, wIdx)) }}
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Actions for Confirmed MPS: Generate Work Orders -->
        <div v-if="activeMps.status === 'Confirmed' && mpsDetails.length > 0"
          class="mt-3 rounded-xl shadow-sm overflow-hidden border border-purple-100">
          <!-- Header -->
          <div class="px-5 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-base">⚡</span>
              <div>
                <h3 class="text-sm font-bold text-white">Generate Work Orders</h3>
                <p class="text-[10px] text-purple-200">Pilih produk → preview minggu → generate WO</p>
              </div>
            </div>
            <span class="text-xs text-purple-200 bg-white/10 px-2.5 py-1 rounded-full font-medium">
              {{ mpsDetails.length }} produk
            </span>
          </div>
          <!-- Product Cards Grid -->
          <div class="bg-gradient-to-br from-purple-50 to-indigo-50 p-4">
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <button v-for="item in mpsDetails" :key="'wo-'+item.id"
                @click="openGenerateWoModal(item)"
                class="group relative bg-white rounded-xl border-2 p-3 text-left transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
                :class="item.wo_id
                  ? 'border-emerald-200 hover:border-emerald-300'
                  : 'border-purple-200 hover:border-purple-400 hover:shadow-purple-100'">
                <!-- Status badge -->
                <div class="absolute -top-2 -right-2">
                  <span v-if="item.wo_id"
                    class="flex items-center gap-1 px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded-full shadow-sm">
                    ✓ WO
                  </span>
                  <span v-else
                    class="flex items-center gap-1 px-2 py-0.5 bg-purple-600 text-white text-[10px] font-bold rounded-full shadow-sm">
                    + New
                  </span>
                </div>
                <!-- Icon -->
                <div class="mb-2 w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                  :class="item.wo_id ? 'bg-emerald-100' : 'bg-purple-100 group-hover:bg-purple-200 transition-colors'">
                  {{ item.wo_id ? '✅' : '🏭' }}
                </div>
                <!-- Product name -->
                <div class="text-xs font-bold text-gray-800 leading-tight mb-1">
                  {{ item.product_name?.substring(0, 28) }}
                </div>
                <!-- SKU -->
                <div class="text-[10px] text-gray-400 mb-2 font-mono">{{ item.product_sku || '—' }}</div>
                <!-- Total production qty -->
                <div class="flex items-center justify-between">
                  <span class="text-[10px] text-gray-500">Total Prod:</span>
                  <span class="text-xs font-bold"
                    :class="item.wo_id ? 'text-emerald-600' : 'text-purple-700'">
                    {{ formatN(taskTotal(item, 'production_qty')) }}
                  </span>
                </div>
                <!-- Arrow indicator -->
                <div class="mt-2 flex items-center justify-end">
                  <span v-if="item.wo_id" class="text-[10px] text-emerald-600 font-medium">+ Tambah WO →</span>
                  <span v-else class="text-[10px] text-purple-600 font-medium group-hover:text-purple-800">Generate WO →</span>
                </div>
              </button>
            </div>
            <!-- WO Action rows — only shown if any product already has WOs -->
            <div v-if="mpsDetails.some(d => d.wo_id)" class="mt-3 pt-3 border-t border-purple-100 space-y-2">
              <!-- Sync row: update qty only -->
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-xs text-teal-600 flex items-center gap-1.5 w-52 shrink-0">
                  🔄 <span>Update qty WO (DRAFT) sesuai rec.production terbaru:</span>
                </span>
                <button
                  v-for="item in mpsDetails.filter(d => d.wo_id)" :key="'sync-'+item.id"
                  @click.stop="syncWoForDetail(item)"
                  :disabled="syncingWo === item.id || resettingWo === item.id"
                  class="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm">
                  <span v-if="syncingWo === item.id" class="animate-spin">⏳</span>
                  <span v-else>🔄</span>
                  Sync — {{ item.product_name?.substring(0, 16) }}
                </button>
              </div>
              <!-- Reset row: delete draft WOs and regenerate from rec.production -->
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-xs text-orange-600 flex items-center gap-1.5 w-52 shrink-0">
                  ♻️ <span>Hapus WO lama & buat ulang dari rec.production:</span>
                </span>
                <button
                  v-for="item in mpsDetails.filter(d => d.wo_id)" :key="'reset-'+item.id"
                  @click.stop="resetWoForDetail(item)"
                  :disabled="resettingWo === item.id || syncingWo === item.id"
                  class="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm">
                  <span v-if="resettingWo === item.id" class="animate-spin">⏳</span>
                  <span v-else>♻️</span>
                  Reset WO — {{ item.product_name?.substring(0, 14) }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========== GENERATE WO MODAL ========== -->
    <div v-if="showWoModal" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" @click.self="showWoModal = false">
      <div class="bg-white rounded-xl shadow-2xl w-[700px] max-h-[85vh] flex flex-col overflow-hidden">
        <!-- Header -->
        <div class="px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
          <h2 class="text-base font-bold">🏭 Generate Work Orders — {{ woModalItem?.product_name }}</h2>
          <p class="text-xs text-purple-200 mt-0.5">
            MPS: {{ activeMps?.mps_number }} ·
            Line: {{ woModalPreview?.line_name || '—' }} ·
            UOM: {{ woModalPreview?.uom_name || '—' }}
          </p>
        </div>

        <!-- Loading -->
        <div v-if="loadingWoPreview" class="flex-1 flex items-center justify-center py-10">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>

        <!-- Content -->
        <div v-else class="flex-1 overflow-auto p-5">
          <!-- Existing WOs -->
          <div v-if="woModalPreview?.existing_wos?.length" class="mb-4 bg-green-50 border border-green-200 rounded-lg p-3">
            <p class="text-xs font-bold text-green-700 mb-2">✅ WO Sudah Ada ({{ woModalPreview.existing_wos.length }})</p>
            <div class="flex flex-wrap gap-2">
              <span v-for="wo in woModalPreview.existing_wos" :key="wo.wo_number"
                class="px-2.5 py-1 bg-green-100 text-green-800 text-xs font-mono rounded-lg border border-green-200">
                {{ wo.wo_number }} · W{{ wo.week_number }} · Qty {{ wo.quantity?.toLocaleString('id') }}
              </span>
            </div>
          </div>

          <!-- Week Preview Table -->
          <div v-if="woModalPreview?.preview_weeks?.length" class="space-y-2">
            <div class="flex items-center justify-between mb-1">
              <p class="text-sm font-bold text-gray-700">Minggu dengan Production Qty > 0</p>
              <div class="flex gap-2">
                <button @click="selectAllWoWeeks" class="text-xs text-purple-600 hover:underline font-medium">Pilih Semua</button>
                <button @click="clearAllWoWeeks" class="text-xs text-gray-400 hover:underline">Hapus Pilihan</button>
              </div>
            </div>
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr class="bg-purple-50">
                  <th class="px-3 py-2 text-left border border-gray-200 text-xs font-bold text-gray-600 w-8">✓</th>
                  <th class="px-3 py-2 text-center border border-gray-200 text-xs font-bold text-gray-700">Minggu</th>
                  <th class="px-3 py-2 text-center border border-gray-200 text-xs font-bold text-gray-700">Tanggal</th>
                  <th class="px-3 py-2 text-center border border-gray-200 text-xs font-bold text-purple-700">Prod. Qty</th>
                  <th class="px-3 py-2 text-center border border-gray-200 text-xs font-bold text-gray-700">Line</th>
                  <th class="px-3 py-2 text-center border border-gray-200 text-xs font-bold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="wk in woModalPreview.preview_weeks" :key="wk.week_number+'-'+wk.year"
                  class="border-b border-gray-100"
                  :class="wk.already_exists ? 'opacity-50 bg-gray-50' : 'hover:bg-purple-50/30 cursor-pointer'"
                  @click="!wk.already_exists && toggleWoWeek(wk)">
                  <td class="px-3 py-2 border border-gray-200 text-center">
                    <input type="checkbox" :checked="isWoWeekSelected(wk)" :disabled="wk.already_exists"
                      @click.stop="toggleWoWeek(wk)"
                      class="w-4 h-4 accent-purple-600" />
                  </td>
                  <td class="px-3 py-2 border border-gray-200 text-center font-mono font-bold text-purple-800 text-sm">
                    W{{ wk.week_number }}/{{ wk.year }}
                  </td>
                  <td class="px-3 py-2 border border-gray-200 text-center text-xs text-gray-600">
                    {{ new Date(wk.scheduled_start).toLocaleDateString('id-ID', {day:'2-digit', month:'short'}) }}
                    – {{ new Date(wk.scheduled_end).toLocaleDateString('id-ID', {day:'2-digit', month:'short'}) }}
                  </td>
                  <td class="px-3 py-2 border border-gray-200 text-center font-bold text-purple-700">
                    {{ wk.production_qty.toLocaleString('id') }}
                  </td>
                  <td class="px-3 py-2 border border-gray-200 text-center text-xs text-gray-500">
                    {{ wk.line_name || '—' }}
                  </td>
                  <td class="px-3 py-2 border border-gray-200 text-center">
                    <span v-if="wk.already_exists" class="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold">WO Exists</span>
                    <span v-else class="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[10px] font-bold">Ready</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="text-center py-10 text-gray-400">
            <div class="text-4xl mb-2">📭</div>
            <p class="font-medium">Tidak ada production qty yang diisi</p>
            <p class="text-xs mt-1">Isi production qty di MPS grid dulu, lalu save</p>
          </div>
        </div>

        <!-- WO Result (after generate) -->
        <div v-if="woGenerateResult" class="px-5 pb-3">
          <div class="bg-green-50 border border-green-200 rounded-lg p-3">
            <p class="text-sm font-bold text-green-700 mb-2">✅ {{ woGenerateResult.message }}</p>
            <div class="flex flex-wrap gap-2">
              <span v-for="wo in woGenerateResult.data.created" :key="wo.wo_number"
                class="px-2.5 py-1 bg-white border border-green-300 text-green-800 text-xs font-mono rounded-lg">
                {{ wo.wo_number }} · W{{ wo.week_number }} · {{ wo.quantity?.toLocaleString('id') }} unit
              </span>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 bg-gray-50 border-t flex items-center justify-between">
          <p class="text-xs text-gray-500">{{ selectedWoWeeks.length }} minggu dipilih · WO akan dibuat status <strong>DRAFT</strong></p>
          <div class="flex gap-3">
            <button @click="showWoModal = false" class="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-100">Tutup</button>
            <button v-if="selectedWoWeeks.length > 0" @click="submitGenerateWo" :disabled="generatingWoModal"
              class="px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2">
              <span v-if="generatingWoModal" class="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
              {{ generatingWoModal ? 'Generating...' : `🏭 Generate ${selectedWoWeeks.length} WO` }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ========== ADD ITEM MODAL ========== -->
    <div v-if="showAddItemModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="showAddItemModal = false">
      <div class="bg-white rounded-xl shadow-2xl w-[480px] overflow-hidden">
        <div class="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 text-white">
          <h3 class="text-lg font-bold">+ Add Item to MPS</h3>
          <p class="text-xs text-indigo-200">Manual forecast / demand entry</p>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1">Product (FG — with BOM)</label>
            <div class="relative">
              <input v-model="addItemSearch" @input="searchProducts" type="text" placeholder="Search product name or SKU..."
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400" />
              <div v-if="addItemResults.length > 0" class="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto z-10">
                <div v-for="p in addItemResults" :key="p.id" @click="selectAddProduct(p)"
                  class="px-3 py-2 hover:bg-indigo-50 cursor-pointer text-sm border-b border-gray-100 last:border-0">
                  <div class="font-medium text-gray-900">{{ p.name }}</div>
                  <div class="text-[10px] text-gray-400">{{ p.sku }} · BOM: {{ p.bom_name || '—' }}</div>
                </div>
              </div>
            </div>
            <div v-if="addItemSelected" class="mt-2 bg-indigo-50 rounded-lg px-3 py-2 flex items-center justify-between">
              <div>
                <div class="text-sm font-bold text-indigo-700">{{ addItemSelected.name }}</div>
                <div class="text-[10px] text-gray-500">{{ addItemSelected.sku }}</div>
              </div>
              <button @click="addItemSelected = null; addItemSearch = ''" class="text-gray-400 hover:text-red-500">✕</button>
            </div>
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1">Forecast Quantity</label>
            <input v-model.number="addItemQty" type="number" min="0" placeholder="e.g. 10000"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400" />
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1">Target Week <span class="text-gray-400 font-normal">(optional)</span></label>
            <select v-model="addItemTargetWeek" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300">
              <option value="">Current week (default)</option>
              <option v-for="wc in weekColumns" :key="wc.week+'-'+wc.year" :value="wc.week + ':' + wc.year">
                {{ wc.label }} ({{ wc.dateRange }})
              </option>
            </select>
          </div>
        </div>
        <div class="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t">
          <button @click="showAddItemModal = false" class="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100">Cancel</button>
          <button @click="addItemToMps" :disabled="!addItemSelected || addItemQty <= 0 || addingItem"
            class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50">
            {{ addingItem ? 'Adding...' : '+ Add to MPS' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ========== MRP MODAL ========== -->
    <div v-if="mrpOpen" class="fixed inset-0 z-50 flex items-start justify-center pt-8 bg-black/50" @click.self="mrpOpen = false">
      <div class="bg-white rounded-xl shadow-2xl w-[95vw] max-h-[85vh] flex flex-col">
        <div class="px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-t-xl flex items-center justify-between">
          <div>
            <h2 class="text-base font-bold">📦 Material Requirement Planning (MRP)</h2>
            <p class="text-xs text-orange-100">BOM Explosion for {{ mrpProduct?.name }}</p>
          </div>
          <div class="flex items-center gap-2">
            <button v-if="mrpDirty" @click="saveMrp" :disabled="savingMrp"
              class="px-3 py-1.5 bg-white text-orange-700 rounded text-xs font-bold hover:bg-orange-50">
              {{ savingMrp ? '...' : '💾 Save' }}
            </button>
            <button v-if="mrpMaterials.length > 0" @click="openGeneratePrPreview"
              class="px-3 py-1.5 bg-green-500 text-white rounded text-xs font-bold hover:bg-green-600 flex items-center gap-1">
              🛒 Generate PR
            </button>
            <button @click="mrpOpen = false" class="p-1.5 hover:bg-white/20 rounded text-white text-lg">✕</button>
          </div>
        </div>
        <div class="flex-1 overflow-auto">
          <div v-if="mrpLoading" class="text-center py-16 text-gray-500">Loading MRP data...</div>
          <div v-else-if="mrpMaterials.length === 0" class="text-center py-16 text-gray-500">No BOM materials found</div>
          <table v-else class="w-full border-collapse text-sm" style="min-width: 1400px">
            <thead>
              <tr class="bg-gradient-to-r from-orange-500 to-amber-500 text-white">
                <th class="px-3 py-2.5 text-center border-r border-orange-400 w-10 sticky left-0 z-30 bg-orange-500 text-sm">No</th>
                <th class="px-3 py-2.5 text-center border-r border-orange-400 w-[150px] min-w-[150px] sticky left-10 z-30 bg-orange-500 text-sm">MATERIAL</th>
                <th class="px-2 py-2.5 text-center border-r border-orange-400 w-[70px] min-w-[70px] sticky left-[190px] z-30 bg-orange-500" title="Lead Time — berapa minggu material perlu dipesan sebelum dibutuhkan. Sumber: Vendor Price List">
                  <div class="text-[11px] font-bold">LEAD TIME</div>
                  <div class="text-[9px] text-orange-200">(weeks)</div>
                </th>
                <th class="px-2 py-2.5 text-center border-r border-orange-400 w-[90px] min-w-[90px] sticky left-[260px] z-30 bg-orange-500 text-sm">STOCK</th>
                <th class="px-3 py-2.5 text-center border-r border-orange-400 w-[160px] min-w-[160px] sticky left-[350px] z-30 bg-orange-500 text-sm">TASK</th>
                <th class="px-2 py-2.5 text-center border-r border-orange-400 w-[80px] text-sm">TOTAL</th>
                <th v-for="wc in mrpWeekColumns" :key="'mrp-h-'+wc.week+'-'+wc.year"
                  class="px-1 py-2.5 text-center border-r border-orange-400 w-[90px] min-w-[90px]">
                  <div class="font-bold text-sm">{{ wc.label }}</div>
                  <div class="text-[10px] text-orange-200">{{ wc.dateRange }}</div>
                </th>
              </tr>
            </thead>
            <tbody>
              <template v-for="(mat, mIdx) in mrpMaterials" :key="mat.material_id">
                <tr class="border-b border-gray-100">
                  <td :rowspan="4" class="px-2 py-1 text-center font-bold text-gray-500 border-r bg-gray-50 sticky left-0 z-20 align-top pt-4 text-sm"
                    style="border-bottom: 3px solid #f97316">{{ mIdx + 1 }}</td>
                  <!-- MATERIAL cell: name + UOM badge + vendor -->
                  <td :rowspan="4" class="px-3 py-2 border-r sticky left-10 z-20 align-middle bg-white"
                    style="border-bottom: 3px solid #f97316; min-width:150px">
                    <div class="text-[10px] text-orange-600 font-bold">{{ mat.product_type_code || 'RM' }}-{{ mIdx + 1 }}</div>
                    <div class="font-bold text-gray-900 text-[13px] leading-tight mt-1">{{ mat.material_name }}</div>
                    <div class="flex items-center gap-1 mt-1 flex-wrap">
                      <span class="inline-flex items-center bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                        {{ mat.uom_name || 'KG' }}
                      </span>
                      <span v-if="mat.unit_price" class="inline-flex items-center bg-green-50 text-green-700 text-[10px] px-1.5 py-0.5 rounded border border-green-200">
                        Rp {{ Number(mat.unit_price).toLocaleString('id') }}/{{ mat.uom_name || 'KG' }}
                      </span>
                    </div>
                    <div v-if="mat.vendor_name" class="text-[9px] text-gray-400 mt-0.5 truncate" :title="mat.vendor_name">
                      🏪 {{ mat.vendor_name }}
                    </div>
                  </td>
                  <!-- LEAD TIME: editable, sourced from vendor price -->
                  <td :rowspan="4" class="px-1 py-1 text-center border-r bg-amber-50 sticky left-[190px] z-20 align-middle"
                    style="border-bottom: 3px solid #f97316">
                    <div class="flex flex-col items-center gap-0.5">
                      <input v-model.number="mat.lead_time" type="number" min="1" max="52"
                        class="w-10 text-center border border-amber-300 rounded px-1 py-1 text-[12px] font-bold bg-amber-50" />
                      <div class="text-[9px] text-amber-600 font-medium">wks</div>
                      <div v-if="mat.lead_time_days" class="text-[9px] text-gray-400">({{ mat.lead_time_days }}d)</div>
                      <div v-else class="text-[9px] text-gray-300">default</div>
                    </div>
                  </td>
                  <!-- STOCK -->
                  <td :rowspan="4" class="px-1 py-1 text-center border-r bg-orange-50 sticky left-[260px] z-20 align-middle"
                    style="border-bottom: 3px solid #f97316">
                    <input v-model.number="mat.first_stock" type="number" min="0" @input="mrpDirty = true"
                      class="w-16 text-center border border-orange-200 rounded px-1 py-1 text-[11px] font-bold" />
                    <div class="text-[9px] text-gray-400 mt-0.5">{{ mat.uom_name || 'KG' }}</div>
                  </td>
                  <td class="px-1 py-1 border-r sticky left-[350px] z-20 bg-white">
                    <div class="bg-blue-500 text-white rounded px-2 py-2 text-[11px] font-bold">📊 Gross_Req</div>
                  </td>
                  <td class="px-1 py-1 text-center border-r font-bold text-sm" :class="cellCls(mrpRowTotal(mat, 'gross_requirements'))">
                    {{ formatN(mrpRowTotal(mat, 'gross_requirements')) }}</td>
                  <td v-for="(wc, wIdx) in mrpWeekColumns" :key="'gr-'+mat.material_id+'-'+wc.week"
                    class="px-0 py-0.5 text-center border-r">
                    <div class="py-1.5 text-[11px] font-medium" :class="cellCls(mat.weeks[wIdx]?.gross_requirements || 0)">
                      {{ formatN(mat.weeks[wIdx]?.gross_requirements || 0) }}</div>
                  </td>
                </tr>
                <tr class="border-b border-gray-100">
                  <td class="px-1 py-1 border-r sticky left-[350px] z-20 bg-white">
                    <div class="bg-green-500 text-white rounded px-2 py-2 text-[11px] font-bold">📥 Planned_Receipt</div>
                  </td>
                  <td class="px-1 py-1 text-center border-r font-bold text-sm" :class="cellCls(mrpRowTotal(mat, 'planned_order_receipt'))">
                    {{ formatN(mrpRowTotal(mat, 'planned_order_receipt')) }}</td>
                  <td v-for="(wc, wIdx) in mrpWeekColumns" :key="'pr-'+mat.material_id+'-'+wc.week"
                    class="px-0 py-0.5 text-center border-r">
                    <input v-model.number="mat.weeks[wIdx].planned_order_receipt" type="number" min="0"
                      @input="mrpDirty = true"
                      class="w-full border-0 bg-green-50 text-center text-[11px] font-medium py-1.5 text-green-800 focus:bg-green-100" />
                  </td>
                </tr>
                <tr class="border-b border-gray-100">
                  <td class="px-1 py-1 border-r sticky left-[350px] z-20 bg-white">
                    <div class="bg-yellow-500 text-white rounded px-2 py-2 text-[11px] font-bold">⚠️ Net_Req</div>
                  </td>
                  <td class="px-1 py-1 text-center border-r font-bold text-sm bg-gray-50 text-gray-400">—</td>
                  <td v-for="(wc, wIdx) in mrpWeekColumns" :key="'nr-'+mat.material_id+'-'+wc.week"
                    class="px-0 py-0.5 text-center border-r">
                    <div class="py-1.5 text-[11px] font-medium rounded mx-0.5" :class="cellCls(getMrpNetReq(mat, wIdx))">
                      {{ formatN(getMrpNetReq(mat, wIdx)) }}</div>
                  </td>
                </tr>
                <tr style="border-bottom: 3px solid #f97316">
                  <td class="px-1 py-1 border-r sticky left-[350px] z-20 bg-white">
                    <div class="bg-orange-600 text-white rounded px-2 py-2 text-[11px] font-bold">📦 Projected_OH</div>
                  </td>
                  <td class="px-1 py-1 text-center border-r font-bold text-sm" :class="cellCls(getMrpProjectedOH(mat, mrpWeekColumns.length - 1))">
                    {{ formatN(getMrpProjectedOH(mat, mrpWeekColumns.length - 1)) }}</td>
                  <td v-for="(wc, wIdx) in mrpWeekColumns" :key="'poh-'+mat.material_id+'-'+wc.week"
                    class="px-0 py-0.5 text-center border-r">
                    <div class="py-1.5 text-[11px] font-bold rounded mx-0.5" :class="cellCls(getMrpProjectedOH(mat, wIdx))">
                      {{ formatN(getMrpProjectedOH(mat, wIdx)) }}</div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ========== GENERATE PR PREVIEW MODAL ========== -->
    <div v-if="showPrPreview" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" @click.self="showPrPreview = false">
      <div class="bg-white rounded-xl shadow-2xl w-[680px] max-h-[85vh] flex flex-col overflow-hidden">
        <!-- Header -->
        <div class="px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white">
          <h2 class="text-base font-bold">🛒 Generate Purchase Request from MRP</h2>
          <p class="text-xs text-green-100 mt-0.5">Hanya material dengan Net Requirement > 0 yang akan di-PR</p>
        </div>
        <!-- Content -->
        <div class="flex-1 overflow-auto p-5">
          <div v-if="prPreviewItems.length === 0" class="text-center py-10 text-gray-500">
            <div class="text-4xl mb-2">✅</div>
            <p class="font-medium">Semua material sudah tercukupi</p>
            <p class="text-xs text-gray-400 mt-1">Net Requirement = 0 untuk semua material</p>
          </div>
          <div v-else>
            <!-- Needed By Week selector -->
            <div class="mb-4 flex items-center gap-3">
              <label class="text-sm font-semibold text-gray-700">Needed By Week:</label>
              <select v-model="prNeededByWeek" class="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                <option v-for="wc in mrpWeekColumns" :key="wc.week+''+wc.year" :value="wc.week+':'+wc.year">
                  {{ wc.label }} ({{ wc.dateRange }})
                </option>
              </select>
              <span class="text-xs text-gray-400">← Kapan material harus tiba</span>
            </div>
            <!-- Materials Table -->
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr class="bg-green-50">
                  <th class="px-3 py-2 text-left border border-gray-200 font-bold text-gray-700 text-xs">Material</th>
                  <th class="px-3 py-2 text-center border border-gray-200 font-bold text-gray-700 text-xs">Gross Req</th>
                  <th class="px-3 py-2 text-center border border-gray-200 font-bold text-gray-700 text-xs">Stock</th>
                  <th class="px-3 py-2 text-center border border-gray-200 font-bold text-gray-700 text-xs">Planned Receipt</th>
                  <th class="px-3 py-2 text-center border border-gray-200 font-bold text-green-700 text-xs">Net Req ✓</th>
                  <th class="px-3 py-2 text-center border border-gray-200 font-bold text-gray-700 text-xs">UOM</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in prPreviewItems" :key="item.material_id"
                  class="border-b border-gray-100 hover:bg-green-50/30">
                  <td class="px-3 py-2 border border-gray-200">
                    <div class="font-semibold text-gray-900 text-sm">{{ item.material_name }}</div>
                    <div class="text-[10px] text-gray-400">{{ item.material_sku }}</div>
                  </td>
                  <td class="px-3 py-2 text-center border border-gray-200 text-sm text-gray-700">{{ formatN(item.gross_req) }}</td>
                  <td class="px-3 py-2 text-center border border-gray-200 text-sm text-amber-700">{{ formatN(item.first_stock) }}</td>
                  <td class="px-3 py-2 text-center border border-gray-200 text-sm text-blue-700">{{ formatN(item.planned_receipt) }}</td>
                  <td class="px-3 py-2 text-center border border-gray-200 font-bold text-green-700 bg-green-50">{{ formatN(item.net_req_qty) }}</td>
                  <td class="px-3 py-2 text-center border border-gray-200 text-xs text-gray-500">{{ item.uom_name }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="bg-gray-50">
                  <td colspan="4" class="px-3 py-2 text-sm font-bold text-gray-700 text-right">Total Items:</td>
                  <td class="px-3 py-2 text-center font-bold text-green-700 text-sm">{{ prPreviewItems.length }}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        <!-- Footer -->
        <div class="px-6 py-4 bg-gray-50 border-t flex items-center justify-between">
          <p class="text-xs text-gray-500">PR akan dibuat dengan status <strong>DRAFT</strong> — perlu approval sebelum ke PO</p>
          <div class="flex gap-3">
            <button @click="showPrPreview = false" class="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-100">Batal</button>
            <button v-if="prPreviewItems.length > 0" @click="submitGeneratePr" :disabled="generatingPr"
              class="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-50">
              {{ generatingPr ? 'Generating...' : '🛒 Create PR — ' + prPreviewItems.length + ' Material' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- PR Success Toast -->
    <div v-if="prSuccessMsg" class="fixed bottom-6 right-6 z-[70] bg-green-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-bounce">
      <span class="text-xl">🛒</span>
      <div>
        <div class="font-bold text-sm">{{ prSuccessMsg }}</div>
        <div class="text-xs text-green-200 mt-0.5">Cek di menu Procurement → Purchase Requests</div>
      </div>
      <button @click="prSuccessMsg = ''" class="ml-2 text-green-200 hover:text-white">✕</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, computed } from 'vue';
import { api } from '../../lib/api';

const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const now = new Date();
const selectedYear = ref(now.getFullYear());
const selectedMonth = ref(now.getMonth() + 1);
const yearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

const mpsList = ref<any[]>([]);
const activeMps = ref<any>(null);
const mpsDetails = ref<any[]>([]);
const weekColumns = ref<any[]>([]);
const isDirty = ref(false);
const saving = ref(false);
const pulling = ref(false);
const toastMsg = ref('');
const toastType = ref<'warn'|'error'|'ok'>('warn');
let toastTimer: any = null;
const showToast = (msg: string, type: 'warn'|'error'|'ok' = 'warn') => {
  toastMsg.value = msg;
  toastType.value = type;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastMsg.value = ''; }, 4000);
};

// Add Item modal state
const showAddItemModal = ref(false);
const addItemSearch = ref('');
const addItemResults = ref<any[]>([]);
const addItemSelected = ref<any>(null);
const addItemQty = ref(0);
const addItemTargetWeek = ref('');
const addingItem = ref(false);
let searchTimeout: any = null;

const searchProducts = () => {
  clearTimeout(searchTimeout);
  if (addItemSearch.value.length < 2) { addItemResults.value = []; return; }
  searchTimeout = setTimeout(async () => {
    try {
      const res = await api.get('/projects/products-with-bom');
      const q = addItemSearch.value.toLowerCase();
      addItemResults.value = (res.data || []).filter((p: any) =>
        p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)
      ).slice(0, 10);
    } catch { addItemResults.value = []; }
  }, 300);
};

const selectAddProduct = (p: any) => {
  addItemSelected.value = p;
  addItemSearch.value = p.name;
  addItemResults.value = [];
};

const addItemToMps = async () => {
  if (!addItemSelected.value || !activeMps.value) return;
  addingItem.value = true;
  try {
    let target_week = null, target_year = null;
    if (addItemTargetWeek.value) {
      const [w, y] = addItemTargetWeek.value.split(':');
      target_week = Number(w);
      target_year = Number(y);
    }
    await api.post(`/ppic/mps/${activeMps.value.id}/add-item`, {
      product_id: addItemSelected.value.id,
      bom_id: addItemSelected.value.bom_id || null,
      quantity: addItemQty.value,
      target_week,
      target_year
    });
    showAddItemModal.value = false;
    addItemSelected.value = null;
    addItemSearch.value = '';
    addItemQty.value = 0;
    addItemTargetWeek.value = '';
    await openMps(activeMps.value.id);
  } catch (error: any) {
    alert(error.response?.data?.error || 'Failed to add item');
  } finally {
    addingItem.value = false;
  }
};

// MRP state
const mrpOpen = ref(false);
const mrpLoading = ref(false);
const mrpProduct = ref<any>(null);

// Generate PR state
const showPrPreview = ref(false);
const prPreviewItems = ref<any[]>([]);
const prNeededByWeek = ref('');
const generatingPr = ref(false);
const prSuccessMsg = ref('');
const mrpMaterials = ref<any[]>([]);
const mrpWeekColumns = ref<any[]>([]);
const mrpDirty = ref(false);
const savingMrp = ref(false);
const mrpDetailId = ref<number | null>(null);

const formatN = (n: number) => {
  if (n === 0) return '—';
  return new Intl.NumberFormat('id-ID').format(Math.round(n * 100) / 100);
};

// Week data helper
const weekDataMap = reactive<Record<string, any>>({});

const getWeekData = (item: any, wc: any): any => {
  const key = `${item.id}_${wc.year}_${wc.week}`;
  if (!weekDataMap[key]) {
    const found = (item.weeks || []).find((w: any) => w.week_number === wc.week && w.year === wc.year);
    weekDataMap[key] = reactive({
      mps_detail_id: item.id,
      week_number: wc.week,
      year: wc.year,
      forecast_qty: found?.forecast_qty || 0,
      so_qty: found?.so_qty || 0,
      start_process_qty: found?.start_process_qty || 0,
      fg_qty: found?.fg_qty || 0,
      production_qty: found?.production_qty || 0
    });
  }
  return weekDataMap[key];
};

const taskTotal = (item: any, field: string): number => {
  let sum = 0;
  for (const wc of weekColumns.value) {
    sum += Number(getWeekData(item, wc)[field]) || 0;
  }
  return sum;
};

const getTotalDemand = (item: any, wc: any): number => {
  const wd = getWeekData(item, wc);
  return Math.max(Number(wd.so_qty) || 0, Number(wd.forecast_qty) || 0);
};

const totalDemandSum = (item: any): number => {
  let sum = 0;
  for (const wc of weekColumns.value) sum += getTotalDemand(item, wc);
  return sum;
};

const getBeginningInv = (item: any, weekIdx: number): number => {
  if (weekIdx === 0) {
    return (Number(item.fg_inventory_stock) || 0) + (Number(item.wo_actual_output) || 0);
  }
  return getEndingInv(item, weekIdx - 1);
};

const getEndingInv = (item: any, weekIdx: number): number => {
  const wc = weekColumns.value[weekIdx];
  if (!wc) return 0;
  const beginInv = getBeginningInv(item, weekIdx);
  const production = Number(getWeekData(item, wc).production_qty) || 0;
  const demand = getTotalDemand(item, wc);
  return beginInv + production - demand;
};

const getMaterialStatus = (item: any, wc: any): string => {
  const prodQty = Number(getWeekData(item, wc).production_qty) || 0;
  if (prodQty === 0) return 'none';
  if (!item.bom_materials || item.bom_materials.length === 0) return 'none';
  const maxProducible = item.material_max_producible || 0;
  return prodQty <= maxProducible ? 'ok' : 'short';
};

// ========== CAPACITY SUMMARY HELPERS ==========
// Total machine capacity = unique line processes (avoid double-counting shared machines)
const totalMaxCapacity = computed(() => {
  const seen = new Set<any>();
  let total = 0;
  for (const item of mpsDetails.value) {
    const key = item.line_process_id || item.id;
    if (!seen.has(key)) {
      seen.add(key);
      total += Number(item.max_weekly_capacity) || 0;
    }
  }
  return total;
});

// Sum production_qty for all items on the same line process in a given week
const getLineProcWeekTotal = (lineProcessId: any, wc: any): number => {
  if (!lineProcessId) return 0;
  return mpsDetails.value
    .filter((d: any) => d.line_process_id === lineProcessId)
    .reduce((sum: number, d: any) => sum + (Number(getWeekData(d, wc).production_qty) || 0), 0);
};

// % of machine capacity used (capped at 100 for display)
const getCellCapacityPct = (item: any, wc: any): number => {
  if (!item.line_process_id || !item.max_weekly_capacity) return 0;
  return Math.min(Math.round((getLineProcWeekTotal(item.line_process_id, wc) / item.max_weekly_capacity) * 100), 100);
};


const getWeekTotalDemand = (weekIdx: number): number => {
  if (!weekColumns.value[weekIdx]) return 0;
  const wc = weekColumns.value[weekIdx];
  return mpsDetails.value.reduce((sum: number, item: any) => sum + getTotalDemand(item, wc), 0);
};

const getUtilizationPct = (weekIdx: number): number => {
  const cap = totalMaxCapacity.value;
  if (cap <= 0) return 0;
  return Math.min(Math.round((getWeekTotalDemand(weekIdx) / cap) * 100), 100);
};

const getCapacityStatus = (weekIdx: number): string => {
  const pct = getUtilizationPct(weekIdx);
  if (pct >= 100) return 'over';
  if (pct >= 75) return 'near';
  return 'ok';
};

// ========== AUTO RECOMMEND PRODUCTION ==========
const autoRecommendItem = (item: any) => {
  const buffer = Number(item.buffer_stock) || 0;
  for (let wIdx = 0; wIdx < weekColumns.value.length; wIdx++) {
    const wc = weekColumns.value[wIdx];
    const wd = getWeekData(item, wc);
    const demand = getTotalDemand(item, wc);
    const beginInv = getBeginningInv(item, wIdx);
    // Need to produce enough to cover demand AND maintain buffer
    let recProd = Math.max(0, (demand + buffer) - Math.max(beginInv, 0));
    if (item.max_weekly_capacity > 0) {
      recProd = Math.min(recProd, item.max_weekly_capacity);
    }
    wd.production_qty = Math.round(recProd * 100) / 100;
  }
  isDirty.value = true;
};

const autoRecommendAll = () => {
  for (const item of mpsDetails.value) {
    autoRecommendItem(item);
  }
  alert('✅ Recommended production qty filled for all products!');
};

const onDemandChange = () => {
  isDirty.value = true;
};

const saveBufferStock = async (item: any) => {
  if (!activeMps.value) return;
  try {
    await api.put(`/ppic/mps/${activeMps.value.id}/details/${item.id}/remark`, {
      buffer_stock: Number(item.buffer_stock) || 0
    });
  } catch (e) {
    console.error('Failed to save buffer stock:', e);
  }
};

const clampProduction = (item: any, wc: any) => {
  isDirty.value = true;
  const wd = getWeekData(item, wc);
  const val = Number(wd.production_qty) || 0;
  if (val < 0) { wd.production_qty = 0; return; }

  const cap = item.max_weekly_capacity || 0;
  if (cap <= 0) return; // no capacity set, allow any value

  // Per-machine total: sum of ALL products sharing the same line_process
  const lpId = item.line_process_id;
  const othersTotal = mpsDetails.value
    .filter((d: any) => d.id !== item.id && d.line_process_id === lpId && lpId)
    .reduce((sum: number, d: any) => sum + (Number(getWeekData(d, wc).production_qty) || 0), 0);
  const remaining = Math.max(0, cap - othersTotal);

  if (val > remaining) {
    wd.production_qty = Math.round(remaining * 100) / 100;
    showToast(
      `⚠️ Kapasitas mesin "${item.line_name || 'mesin'}" max ${formatN(cap)}/minggu. Slot tersisa: ${formatN(remaining)} (sudah terpakai: ${formatN(othersTotal)})`,
      'warn'
    );
  }
};

const fillMaxProduction = (item: any) => {
  const cap = item.max_weekly_capacity || 0;
  if (cap <= 0) return;
  for (let wIdx = 0; wIdx < weekColumns.value.length; wIdx++) {
    const wc = weekColumns.value[wIdx];
    const wd = getWeekData(item, wc);
    const demand = getTotalDemand(item, wc);
    const beginInv = getBeginningInv(item, wIdx);
    if (demand > 0 || beginInv < 0) {
      wd.production_qty = cap;
    } else {
      wd.production_qty = 0;
    }
  }
  isDirty.value = true;
};

// API
const loadMpsList = async () => {
  try {
    const res = await api.get('/ppic/mps', { params: { year: selectedYear.value, month: selectedMonth.value } });
    mpsList.value = res.data.data || [];
  } catch { mpsList.value = []; }
};

const openMps = async (id: number) => {
  try {
    const res = await api.get(`/ppic/mps/${id}`);
    activeMps.value = res.data.data.header;
    mpsDetails.value = res.data.data.details || [];
    weekColumns.value = res.data.data.weekColumns || [];
    Object.keys(weekDataMap).forEach(k => delete weekDataMap[k]);
    isDirty.value = false;
  } catch (err: any) { alert(err?.response?.data?.error || 'Failed to load MPS'); }
};

const goBack = () => { activeMps.value = null; mpsDetails.value = []; Object.keys(weekDataMap).forEach(k => delete weekDataMap[k]); };

const createMps = async () => {
  try {
    const res = await api.post('/ppic/mps', { period_year: selectedYear.value, period_month: selectedMonth.value, scheme: 'MTO' });
    await loadMpsList();
    if (res.data.data?.id) await openMps(res.data.data.id);
  } catch (err: any) { alert(err?.response?.data?.error || 'Failed to create MPS'); }
};

const pullOrders = async () => {
  if (!activeMps.value?.id) return;
  pulling.value = true;
  try {
    const res = await api.post(`/ppic/mps/${activeMps.value.id}/pull-orders`);
    const d = res.data;
    if (d.pulled > 0) {
      alert(`✅ ${d.pulled} produk berhasil ditarik ke MPS\n📋 Dari SO: ${d.from_so || 0} order lines\n📁 Dari Proyek: ${d.from_projects || 0} proyek`);
    } else {
      alert(`ℹ️ ${d.message}`);
    }
    await openMps(activeMps.value.id);
  } catch (err: any) { alert(err?.response?.data?.error || 'Failed to pull orders'); }
  finally { pulling.value = false; }
};

const removeItem = async (item: any) => {
  if (!confirm(`Hapus "${item.product_name}" dari MPS? Semua data mingguan akan ikut terhapus.`)) return;
  try {
    await api.delete(`/ppic/mps/${activeMps.value.id}/details/${item.id}`);
    await openMps(activeMps.value.id);
  } catch (err: any) { alert(err?.response?.data?.error || 'Failed to remove item'); }
};

const saveAll = async () => {
  if (!activeMps.value?.id) return;
  saving.value = true;
  try {
    for (const item of mpsDetails.value) {
      await api.put(`/ppic/mps/${activeMps.value.id}/details/${item.id}/remark`, {
        current_stock: item.current_stock || 0,
        batch_no: item.batch_no || null,
        batch_qty: item.batch_qty || 0,
        lead_time_weeks: item.lead_time_weeks || 1
      });
    }
    const entries: any[] = [];
    for (const item of mpsDetails.value) {
      for (const wc of weekColumns.value) {
        const wd = getWeekData(item, wc);
        for (const field of ['forecast_qty', 'so_qty', 'production_qty']) {
          entries.push({ mps_detail_id: item.id, week_number: wc.week, year: wc.year, field, value: Number(wd[field]) || 0 });
        }
      }
    }
    await api.put(`/ppic/mps/${activeMps.value.id}/week-data`, { entries });
    isDirty.value = false;
    alert('✓ Saved!');
  } catch (err: any) { alert(err?.response?.data?.error || 'Failed to save'); }
  finally { saving.value = false; }
};

const confirmMps = async () => {
  if (!confirm('Confirm MPS? Data akan dikunci.')) return;
  if (isDirty.value) await saveAll();
  try {
    await api.post(`/ppic/mps/${activeMps.value.id}/confirm`);
    await openMps(activeMps.value.id);
    await loadMpsList();
    alert('✓ MPS Confirmed!');
  } catch (err: any) { alert(err?.response?.data?.error || 'Failed to confirm'); }
};

const revertMps = async () => {
  if (!confirm('Revert MPS ke Draft? Semua data tetap tersimpan.')) return;
  try {
    await api.post(`/ppic/mps/${activeMps.value.id}/revert`);
    await openMps(activeMps.value.id);
    await loadMpsList();
    alert('✓ MPS reverted to Draft!');
  } catch (err: any) { alert(err?.response?.data?.error || 'Failed to revert'); }
};

// ========== GENERATE WO MODAL ==========
const showWoModal = ref(false);
const woModalItem = ref<any>(null);
const woModalPreview = ref<any>(null);
const loadingWoPreview = ref(false);
const selectedWoWeeks = ref<any[]>([]);
const generatingWoModal = ref(false);
const woGenerateResult = ref<any>(null);

const openGenerateWoModal = async (item: any) => {
  woModalItem.value = item;
  woModalPreview.value = null;
  selectedWoWeeks.value = [];
  woGenerateResult.value = null;
  showWoModal.value = true;
  loadingWoPreview.value = true;
  try {
    const res = await api.get(`/ppic/mps/${activeMps.value.id}/details/${item.id}/generate-wo/preview`);
    woModalPreview.value = res.data.data;
    // Auto-select weeks not already existing
    selectedWoWeeks.value = (woModalPreview.value.preview_weeks || [])
      .filter((w: any) => !w.already_exists)
      .map((w: any) => ({ week_number: w.week_number, year: w.year }));
  } catch (err: any) {
    alert(err?.response?.data?.error || 'Failed to load WO preview');
    showWoModal.value = false;
  } finally {
    loadingWoPreview.value = false;
  }
};

const isWoWeekSelected = (wk: any): boolean =>
  selectedWoWeeks.value.some(s => s.week_number === wk.week_number && s.year === wk.year);

const toggleWoWeek = (wk: any) => {
  if (wk.already_exists) return;
  const idx = selectedWoWeeks.value.findIndex(s => s.week_number === wk.week_number && s.year === wk.year);
  if (idx >= 0) selectedWoWeeks.value.splice(idx, 1);
  else selectedWoWeeks.value.push({ week_number: wk.week_number, year: wk.year });
};

const selectAllWoWeeks = () => {
  selectedWoWeeks.value = (woModalPreview.value?.preview_weeks || [])
    .filter((w: any) => !w.already_exists)
    .map((w: any) => ({ week_number: w.week_number, year: w.year }));
};

const clearAllWoWeeks = () => { selectedWoWeeks.value = []; };

const submitGenerateWo = async () => {
  if (!woModalItem.value || selectedWoWeeks.value.length === 0) return;
  generatingWoModal.value = true;
  try {
    const res = await api.post(
      `/ppic/mps/${activeMps.value.id}/details/${woModalItem.value.id}/generate-wo`,
      { selected_weeks: selectedWoWeeks.value }
    );
    woGenerateResult.value = res.data;
    // Refresh MPS and re-open preview
    await openMps(activeMps.value.id);
    // Reload preview to show updated state
    const previewRes = await api.get(`/ppic/mps/${activeMps.value.id}/details/${woModalItem.value.id}/generate-wo/preview`);
    woModalPreview.value = previewRes.data.data;
    selectedWoWeeks.value = [];
  } catch (err: any) {
    alert(err?.response?.data?.error || 'Failed to generate WOs');
  } finally {
    generatingWoModal.value = false;
  }
};

// Sync existing DRAFT WOs quantity to match current MPS week data
const syncingWo = ref<number | null>(null);
const syncWoForDetail = async (item: any) => {
  syncingWo.value = item.id;
  try {
    const res = await api.post(`/ppic/mps/${activeMps.value.id}/details/${item.id}/sync-wo`, {});
    const { updated, skipped } = res.data.data || {};
    const updCount = updated?.length || 0;
    const skipCount = skipped?.length || 0;
    if (updCount > 0) {
      showToast(`✅ Sync selesai: ${updCount} WO diupdate, ${skipCount} dilewati.`, 'ok');
    } else {
      showToast(`Tidak ada perubahan: ${skipCount} WO dilewati (qty sama / bukan DRAFT).`, 'warn');
    }
    // Refresh MPS data
    await openMps(activeMps.value.id);
  } catch (err: any) {
    showToast(err?.response?.data?.error || 'Gagal sync WO', 'error');
  } finally {
    syncingWo.value = null;
  }
};

// Reset: delete all DRAFT WOs and regenerate from current rec.production
const resettingWo = ref<number | null>(null);
const resetWoForDetail = async (item: any) => {
  const confirm1 = confirm(
    `♻️ Reset WO untuk "${item.product_name}"?\n\n` +
    `Semua WO DRAFT yang terkait akan DIHAPUS dan dibuat ulang dari rec.production terbaru.\n\n` +
    `WO yang sudah In Progress/Completed TIDAK akan terpengaruh.\n\n` +
    `Lanjutkan?`
  );
  if (!confirm1) return;
  resettingWo.value = item.id;
  try {
    const res = await api.post(`/ppic/mps/${activeMps.value.id}/details/${item.id}/reset-wo`, {});
    const { deleted, created } = res.data.data || {};
    showToast(
      `♻️ Reset selesai: ${deleted?.length || 0} WO dihapus, ${created?.length || 0} WO baru dibuat dari rec.production.`,
      'ok'
    );
    await openMps(activeMps.value.id);
  } catch (err: any) {
    showToast(err?.response?.data?.error || 'Gagal reset WO', 'error');
  } finally {
    resettingWo.value = null;
  }
};

const deleteMps = async () => {
  if (!confirm('Delete seluruh MPS ini?')) return;
  try {
    await api.delete(`/ppic/mps/${activeMps.value.id}`);
    goBack();
    await loadMpsList();
  } catch (err: any) { alert(err?.response?.data?.error || 'Failed'); }
};

// ========== MRP Functions ==========
const openMrp = async (item: any) => {
  if (!item.bom_id) { alert('No BOM linked to this product'); return; }
  mrpOpen.value = true;
  mrpLoading.value = true;
  mrpDetailId.value = item.id;
  mrpDirty.value = false;
  try {
    const res = await api.get(`/ppic/mps/${activeMps.value.id}/details/${item.id}/mrp`);
    mrpProduct.value = res.data.data.product;
    mrpMaterials.value = res.data.data.materials || [];
    mrpWeekColumns.value = res.data.data.weekColumns || [];
  } catch (err: any) { alert(err?.response?.data?.error || 'Failed to load MRP'); mrpOpen.value = false; }
  finally { mrpLoading.value = false; }
};

const mrpRowTotal = (mat: any, field: string): number => {
  return (mat.weeks || []).reduce((s: number, w: any) => s + (Number(w[field]) || 0), 0);
};

const getMrpNetReq = (mat: any, weekIdx: number): number => {
  const w = mat.weeks[weekIdx];
  if (!w) return 0;
  const gross = Number(w.gross_requirements) || 0;
  const planned = Number(w.planned_order_receipt) || 0;
  const oh = weekIdx > 0 ? getMrpProjectedOH(mat, weekIdx - 1) : (Number(mat.first_stock) || 0);
  const net = gross - planned - Math.max(oh, 0);
  return Math.max(net, 0);
};

const getMrpProjectedOH = (mat: any, weekIdx: number): number => {
  let oh = Number(mat.first_stock) || 0;
  for (let i = 0; i <= weekIdx; i++) {
    const w = mat.weeks[i];
    if (!w) continue;
    oh = oh + (Number(w.planned_order_receipt) || 0) - (Number(w.gross_requirements) || 0);
  }
  return Math.round(oh * 100) / 100;
};

// ========== Generate PR from MRP ==========
const openGeneratePrPreview = () => {
  // Calculate total net requirements across ALL weeks per material
  const items: any[] = [];
  for (const mat of mrpMaterials.value) {
    const grossReq = (mat.weeks || []).reduce((s: number, w: any) => s + (Number(w.gross_requirements) || 0), 0);
    const plannedReceipt = (mat.weeks || []).reduce((s: number, w: any) => s + (Number(w.planned_order_receipt) || 0), 0);
    const firstStock = Number(mat.first_stock) || 0;
    const netReq = Math.max(0, grossReq - plannedReceipt - firstStock);
    if (netReq > 0) {
      items.push({
        material_id: mat.material_id,
        material_name: mat.material_name,
        material_sku: mat.material_sku,
        uom_name: mat.uom_name,
        gross_req: grossReq,
        planned_receipt: plannedReceipt,
        first_stock: firstStock,
        net_req_qty: Math.ceil(netReq * 100) / 100
      });
    }
  }
  prPreviewItems.value = items;
  // Default needed_by to first week with demand
  prNeededByWeek.value = mrpWeekColumns.value.length > 0
    ? mrpWeekColumns.value[0].week + ':' + mrpWeekColumns.value[0].year
    : '';
  showPrPreview.value = true;
};

const submitGeneratePr = async () => {
  if (!mrpDetailId.value || !activeMps.value?.id) return;
  generatingPr.value = true;
  try {
    const [week, year] = (prNeededByWeek.value || '').split(':');
    const res = await api.post(
      `/ppic/mps/${activeMps.value.id}/details/${mrpDetailId.value}/mrp/generate-pr`,
      {
        material_net_reqs: prPreviewItems.value,
        needed_by_week: week ? Number(week) : null,
        needed_by_year: year ? Number(year) : null
      }
    );
    showPrPreview.value = false;
    prSuccessMsg.value = `✓ ${res.data.pr_number} — ${res.data.items_created} material berhasil di-PR!`;
    setTimeout(() => { prSuccessMsg.value = ''; }, 8000);
  } catch (err: any) {
    alert(err.response?.data?.error || 'Gagal generate PR');
  } finally {
    generatingPr.value = false;
  }
};

const saveMrp = async () => {
  if (!mrpDetailId.value || !activeMps.value?.id) return;
  savingMrp.value = true;
  try {
    const entries: any[] = [];
    const material_settings: any[] = [];
    for (const mat of mrpMaterials.value) {
      // collect per-material settings
      material_settings.push({
        material_id: mat.material_id,
        lead_time: Number(mat.lead_time) || 2,
        first_stock: Number(mat.first_stock) || 0,
        order_quantity: Number(mat.order_quantity) || 0,
      });
      for (const w of (mat.weeks || [])) {
        entries.push({ material_id: mat.material_id, week_number: w.week_number, year: w.year, planned_order_receipt: Number(w.planned_order_receipt) || 0 });
      }
    }
    await api.put(`/ppic/mps/${activeMps.value.id}/details/${mrpDetailId.value}/mrp`, { entries, material_settings });
    mrpDirty.value = false;
    alert('✓ MRP saved!');
  } catch (err: any) { alert(err?.response?.data?.error || 'Failed to save'); }
  finally { savingMrp.value = false; }
};

const cellCls = (v: number) => {
  if (v < 0) return 'bg-red-100 text-red-700';
  if (v > 0) return 'bg-green-100 text-green-700';
  return 'bg-gray-50 text-gray-400';
};

onMounted(() => { loadMpsList(); });
</script>

<style scoped>
:deep(tbody tr) { transition: background-color 0.1s; }
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
input[type="number"] { -moz-appearance: textfield; }
.toast-fade-enter-active, .toast-fade-leave-active { transition: all 0.3s ease; }
.toast-fade-enter-from, .toast-fade-leave-to { opacity: 0; transform: translateY(-8px) scale(0.97); }
</style>
