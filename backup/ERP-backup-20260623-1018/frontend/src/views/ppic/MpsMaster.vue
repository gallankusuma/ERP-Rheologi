<template>
  <div class="h-full flex flex-col bg-slate-100">
    <!-- Header -->
    <div class="px-6 py-3 bg-gradient-to-r from-teal-600 to-cyan-700 text-white shadow-lg">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-lg font-bold tracking-wide">🏭 MPS — Master Production Schedule</h1>
          <p class="text-xs text-teal-100">Make to Order · Weekly Timeline</p>
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

      <!-- ========== ACTIVE MPS: 5-ROW TIMELINE GRID ========== -->
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
            <button v-if="activeMps.status === 'Draft' && mpsDetails.length > 0" @click="saveAll" :disabled="saving"
              class="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 disabled:opacity-50"
              :class="isDirty ? 'ring-2 ring-blue-300' : ''">
              {{ saving ? '...' : '💾 Save' }}
            </button>
            <button v-if="activeMps.status === 'Draft' && mpsDetails.length > 0" @click="confirmMps"
              class="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-700">✓ Confirm</button>
            <button v-if="activeMps.status === 'Draft'" @click="deleteMps"
              class="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">🗑</button>
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

        <!-- ========== MAIN GRID ========== -->
        <div v-if="mpsDetails.length > 0" class="bg-white rounded-lg shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full border-collapse text-sm" style="min-width: 1600px">
              <!-- HEADER -->
              <thead>
                <tr class="bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
                  <th class="px-3 py-2.5 text-center border-r border-teal-500 w-10 sticky left-0 z-30 bg-teal-600 text-sm">No</th>
                  <th class="px-3 py-2.5 text-center border-r border-teal-500 w-[160px] min-w-[160px] sticky left-10 z-30 bg-teal-600 text-sm">REMARK</th>
                  <th class="px-3 py-2.5 text-center border-r border-teal-500 w-[130px] min-w-[130px] sticky left-[200px] z-30 bg-teal-600 text-sm">PRODUCT</th>
                  <th class="px-3 py-2.5 text-center border-r border-teal-500 w-[150px] min-w-[150px] sticky left-[330px] z-30 bg-teal-600 text-sm">TASK</th>
                  <th class="px-2 py-2.5 text-center border-r border-teal-500 w-[70px] text-sm">REMAINING</th>
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
                <!-- FOR EACH PRODUCT: 5 TASK ROWS -->
                <template v-for="(item, pIdx) in mpsDetails" :key="item.id">
                  <!-- Row 1: Forecast -->
                  <tr class="border-b border-gray-100 hover:bg-blue-50/30">
                    <!-- No (rowspan 5) -->
                    <td v-if="true" :rowspan="5" class="px-2 py-1 text-center font-bold text-gray-600 border-r bg-gray-50 sticky left-0 z-20 align-top pt-4 text-sm"
                      style="border-bottom: 3px solid #0d9488">
                      {{ pIdx + 1 }}
                    </td>
                    <!-- REMARK (rowspan 5) -->
                    <td :rowspan="5" class="px-2 py-2 border-r bg-gradient-to-b from-teal-50 to-cyan-50 sticky left-10 z-20 align-top"
                      style="border-bottom: 3px solid #0d9488">
                      <div class="space-y-1.5">
                        <div class="bg-teal-500 text-white rounded px-2 py-1.5 flex items-center justify-between">
                          <span class="text-[11px] font-bold">1st_STOCK</span>
                          <input v-model.number="item.current_stock" type="number" min="0"
                            :disabled="activeMps.status !== 'Draft'" @input="isDirty = true"
                            class="w-16 text-right bg-white/20 border-0 rounded px-1 py-0.5 text-[11px] text-white placeholder-teal-200 font-bold" placeholder="0" />
                        </div>
                        <div class="bg-teal-400 text-white rounded px-2 py-1.5">
                          <div class="flex items-center justify-between">
                            <span class="text-[11px] font-bold">Batch</span>
                            <input v-model="item.batch_no" :disabled="activeMps.status !== 'Draft'" @input="isDirty = true"
                              class="w-16 text-right bg-white/20 border-0 rounded px-1 py-0.5 text-[11px] text-white placeholder-teal-200" placeholder="—" />
                          </div>
                          <div class="flex items-center justify-between mt-0.5">
                            <span class="text-[10px]">Quantity</span>
                            <input v-model.number="item.batch_qty" type="number" min="0"
                              :disabled="activeMps.status !== 'Draft'" @input="isDirty = true"
                              class="w-16 text-right bg-white/20 border-0 rounded px-1 py-0.5 text-[11px] text-white placeholder-teal-200 font-bold" placeholder="0" />
                          </div>
                        </div>
                        <div class="bg-teal-500 text-white rounded px-2 py-1.5 flex items-center justify-between">
                          <span class="text-[11px] font-bold">LEAD_TIME</span>
                          <div class="flex items-center gap-0.5">
                            <input v-model.number="item.lead_time_weeks" type="number" min="1"
                              :disabled="activeMps.status !== 'Draft'" @input="isDirty = true"
                              class="w-8 text-right bg-white/20 border-0 rounded px-1 py-0.5 text-[11px] text-white font-bold" />
                            <span class="text-[10px]">Week</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <!-- PRODUCT (rowspan 5) - CLICKABLE for MRP -->
                    <td :rowspan="5" class="px-3 py-2 border-r sticky left-[200px] z-20 align-middle text-center bg-white cursor-pointer hover:bg-orange-50 transition-colors group/prod"
                      style="border-bottom: 3px solid #0d9488" @click="openMrp(item)">
                      <div class="text-[10px] text-teal-600 font-bold">FG-{{ pIdx + 1 }}</div>
                      <div class="font-bold text-gray-900 text-[13px] mt-1 leading-tight group-hover/prod:text-orange-700">{{ item.product_name }}</div>
                      <div class="text-[10px] text-gray-400 mt-1">{{ item.product_sku }}</div>
                      <div v-if="item.project_number" class="mt-1.5 text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded inline-block font-medium">{{ item.project_number }}</div>
                      <div v-if="item.so_number" class="mt-0.5 text-[10px] bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded inline-block font-medium">📋 {{ item.so_number }}</div>
                      <div v-if="item.client_name" class="text-[10px] text-gray-400 mt-0.5">{{ item.client_name }}</div>
                      <div class="mt-1 text-[9px] text-orange-500 font-bold opacity-0 group-hover/prod:opacity-100 transition-opacity">▼ Click for MRP</div>
                    </td>
                    <!-- TASK: Forecast -->
                    <td class="px-1 py-1 border-r sticky left-[330px] z-20 bg-white">
                      <div class="bg-blue-500 text-white rounded px-2 py-2 text-[11px] font-bold flex items-center gap-1">
                        📊 Forecast
                      </div>
                    </td>
                    <!-- REMAINING: Forecast -->
                    <td class="px-1 py-1 text-center border-r text-[11px] font-bold"
                      :class="getRemaining(item, 'forecast_qty') > 0 ? 'bg-amber-50 text-amber-700' : getRemaining(item, 'forecast_qty') < 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'">
                      {{ formatN(getRemaining(item, 'forecast_qty')) }}
                    </td>
                    <!-- TOTAL: Forecast -->
                    <td class="px-1 py-1 text-center border-r font-bold bg-blue-50 text-blue-700 text-sm">
                      {{ formatN(taskTotal(item, 'forecast_qty')) }}
                    </td>
                    <!-- UOM (rowspan 5) -->
                    <td :rowspan="5" class="px-1 py-1 text-center border-r bg-gray-50 align-middle font-semibold text-gray-600 text-[11px]"
                      style="border-bottom: 3px solid #0d9488">
                      {{ item.uom_name || 'Unit' }}
                    </td>
                    <!-- Week cells: Forecast -->
                    <td v-for="wc in weekColumns" :key="'f-'+wc.week+'-'+wc.year"
                      class="px-0 py-0.5 text-center border-r">
                      <input v-model.number="getWeekData(item, wc).forecast_qty" type="number" min="0"
                        :disabled="activeMps.status !== 'Draft'" @input="isDirty = true"
                        class="w-full border-0 bg-blue-50 text-center text-[11px] font-medium py-1.5 text-blue-800 focus:bg-blue-100 focus:ring-1 focus:ring-blue-300" />
                    </td>
                  </tr>

                  <!-- Row 2: Sales Order (Booked) -->
                  <tr class="border-b border-gray-100 hover:bg-blue-50/30">
                    <td class="px-1 py-1 border-r sticky left-[330px] z-20 bg-white">
                      <div class="bg-teal-600 text-white rounded px-2 py-2 text-[11px] font-bold flex items-center gap-1">
                        📋 Sales Order
                      </div>
                      <div v-if="item.so_number" class="mt-0.5 text-[10px] font-semibold text-teal-700 px-1 truncate" :title="item.so_number">{{ item.so_number }}</div>
                    </td>
                    <td class="px-1 py-1 text-center border-r text-[11px] font-bold"
                      :class="getRemaining(item, 'so_qty') > 0 ? 'bg-amber-50 text-amber-700' : getRemaining(item, 'so_qty') < 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'">
                      {{ formatN(getRemaining(item, 'so_qty')) }}
                    </td>
                    <td class="px-1 py-1 text-center border-r font-bold bg-teal-50 text-teal-700 text-sm">
                      {{ formatN(taskTotal(item, 'so_qty')) }}
                    </td>
                    <td v-for="wc in weekColumns" :key="'so-'+wc.week+'-'+wc.year"
                      class="px-0 py-0.5 text-center border-r">
                      <input v-model.number="getWeekData(item, wc).so_qty" type="number" min="0"
                        :disabled="activeMps.status !== 'Draft'" @input="isDirty = true"
                        class="w-full border-0 bg-teal-50 text-center text-[11px] font-medium py-1.5 text-teal-800 focus:bg-teal-100 focus:ring-1 focus:ring-teal-300" />
                    </td>
                  </tr>

                  <!-- Row 3: MPS Start Process -->
                  <tr class="border-b border-gray-100 hover:bg-blue-50/30">
                    <td class="px-1 py-1 border-r sticky left-[330px] z-20 bg-white">
                      <div class="bg-purple-600 text-white rounded px-2 py-2 text-[11px] font-bold flex items-center gap-1">
                        🏭 MPS → Start
                      </div>
                    </td>
                    <td class="px-1 py-1 text-center border-r text-[11px] font-bold"
                      :class="getRemaining(item, 'start_process_qty') > 0 ? 'bg-amber-50 text-amber-700' : getRemaining(item, 'start_process_qty') < 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'">
                      {{ formatN(getRemaining(item, 'start_process_qty')) }}
                    </td>
                    <td class="px-1 py-1 text-center border-r font-bold bg-purple-50 text-purple-700 text-sm">
                      {{ formatN(taskTotal(item, 'start_process_qty')) }}
                    </td>
                    <td v-for="wc in weekColumns" :key="'sp-'+wc.week+'-'+wc.year"
                      class="px-0 py-0.5 text-center border-r">
                      <input v-model.number="getWeekData(item, wc).start_process_qty" type="number" min="0"
                        :disabled="activeMps.status !== 'Draft'" @input="isDirty = true"
                        class="w-full border-0 bg-purple-50 text-center text-[11px] font-medium py-1.5 text-purple-800 focus:bg-purple-100 focus:ring-1 focus:ring-purple-300" />
                    </td>
                  </tr>

                  <!-- Row 4: MPS FG Quantity -->
                  <tr class="border-b border-gray-100 hover:bg-blue-50/30">
                    <td class="px-1 py-1 border-r sticky left-[330px] z-20 bg-white">
                      <div class="bg-pink-600 text-white rounded px-2 py-2 text-[11px] font-bold flex items-center gap-1">
                        🏭 MPS → FG Qty
                      </div>
                    </td>
                    <td class="px-1 py-1 text-center border-r text-[11px] font-bold"
                      :class="getRemaining(item, 'fg_qty') > 0 ? 'bg-amber-50 text-amber-700' : getRemaining(item, 'fg_qty') < 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'">
                      {{ formatN(getRemaining(item, 'fg_qty')) }}
                    </td>
                    <td class="px-1 py-1 text-center border-r font-bold bg-pink-50 text-pink-700 text-sm">
                      {{ formatN(taskTotal(item, 'fg_qty')) }}
                    </td>
                    <td v-for="wc in weekColumns" :key="'fg-'+wc.week+'-'+wc.year"
                      class="px-0 py-0.5 text-center border-r">
                      <input v-model.number="getWeekData(item, wc).fg_qty" type="number" min="0"
                        :disabled="activeMps.status !== 'Draft'" @input="isDirty = true"
                        class="w-full border-0 bg-pink-50 text-center text-[11px] font-medium py-1.5 text-pink-800 focus:bg-pink-100 focus:ring-1 focus:ring-pink-300" />
                    </td>
                  </tr>

                  <!-- Row 5: Projected On Hand (calculated) -->
                  <tr style="border-bottom: 3px solid #0d9488">
                    <td class="px-1 py-1 border-r sticky left-[330px] z-20 bg-white">
                      <div class="bg-gray-100 text-gray-700 rounded px-2 py-2 text-[11px] font-bold flex items-center gap-1 border border-gray-200">
                        📈 Projected OH
                      </div>
                    </td>
                    <td class="px-1 py-1 text-center border-r font-bold bg-gray-50 text-gray-400 text-[11px]">—</td>
                    <td class="px-1 py-1 text-center border-r font-bold bg-gray-50 text-gray-700 text-sm">
                      {{ formatN(getLastProjectedOH(item)) }}
                    </td>
                    <td v-for="(wc, wIdx) in weekColumns" :key="'poh-'+wc.week+'-'+wc.year"
                      class="px-0 py-0.5 text-center border-r">
                      <div class="py-1.5 text-[11px] font-bold rounded mx-0.5"
                        :class="getProjectedOH(item, wIdx) < 0 ? 'bg-red-100 text-red-700' : getProjectedOH(item, wIdx) > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-50 text-gray-500'">
                        {{ formatN(getProjectedOH(item, wIdx)) }}
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Actions for Confirmed MPS -->
        <div v-if="activeMps.status === 'Confirmed' && mpsDetails.length > 0" class="mt-3 bg-white rounded-lg shadow-sm p-4">
          <h3 class="text-sm font-bold text-gray-700 mb-2">⚡ Generate Work Orders</h3>
          <div class="flex flex-wrap gap-2">
            <button v-for="item in mpsDetails" :key="'wo-'+item.id"
              @click="generateWo(item)" :disabled="!!item.wo_id || generatingWo === item.id"
              class="px-3 py-1.5 rounded text-xs font-medium transition-colors"
              :class="item.wo_id ? 'bg-green-100 text-green-700 cursor-default' : 'bg-purple-600 text-white hover:bg-purple-700 cursor-pointer'">
              {{ item.wo_id ? `✓ ${item.wo_number}` : (generatingWo === item.id ? '...' : `WO → ${item.product_name?.substring(0,20)}`) }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ========== MRP MODAL ========== -->
    <div v-if="mrpOpen" class="fixed inset-0 z-50 flex items-start justify-center pt-8 bg-black/50" @click.self="mrpOpen = false">
      <div class="bg-white rounded-xl shadow-2xl w-[95vw] max-h-[85vh] flex flex-col">
        <!-- MRP Header -->
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
            <button @click="mrpOpen = false" class="p-1.5 hover:bg-white/20 rounded text-white text-lg">✕</button>
          </div>
        </div>

        <!-- MRP Content -->
        <div class="flex-1 overflow-auto">
          <div v-if="mrpLoading" class="text-center py-16 text-gray-500">Loading MRP data...</div>
          <div v-else-if="mrpMaterials.length === 0" class="text-center py-16 text-gray-500">No BOM materials found</div>
          <table v-else class="w-full border-collapse text-sm" style="min-width: 1400px">
            <thead>
              <tr class="bg-gradient-to-r from-orange-500 to-amber-500 text-white">
                <th class="px-3 py-2.5 text-center border-r border-orange-400 w-10 sticky left-0 z-30 bg-orange-500 text-sm">No</th>
                <th class="px-3 py-2.5 text-center border-r border-orange-400 w-[130px] min-w-[130px] sticky left-10 z-30 bg-orange-500 text-sm">PRODUCT</th>
                <th class="px-2 py-2.5 text-center border-r border-orange-400 w-10 sticky left-[170px] z-30 bg-orange-500 text-sm">LT</th>
                <th class="px-2 py-2.5 text-center border-r border-orange-400 w-[90px] min-w-[90px] sticky left-[210px] z-30 bg-orange-500 text-sm">1st_STOCK</th>
                <th class="px-3 py-2.5 text-center border-r border-orange-400 w-[160px] min-w-[160px] sticky left-[300px] z-30 bg-orange-500 text-sm">TASK</th>
                <th class="px-2 py-2.5 text-center border-r border-orange-400 w-[70px] text-sm">TOTAL</th>
                <th v-for="wc in mrpWeekColumns" :key="'mrp-h-'+wc.week+'-'+wc.year"
                  class="px-1 py-2.5 text-center border-r border-orange-400 w-[90px] min-w-[90px]">
                  <div class="font-bold text-sm">{{ wc.label }}</div>
                  <div class="text-[10px] text-orange-200">{{ wc.dateRange }}</div>
                </th>
              </tr>
            </thead>
            <tbody>
              <template v-for="(mat, mIdx) in mrpMaterials" :key="mat.material_id">
                <!-- Row 1: Gross Requirements -->
                <tr class="border-b border-gray-100">
                  <td :rowspan="4" class="px-2 py-1 text-center font-bold text-gray-500 border-r bg-gray-50 sticky left-0 z-20 align-top pt-4 text-sm"
                    style="border-bottom: 3px solid #f97316">{{ mIdx + 1 }}</td>
                  <td :rowspan="4" class="px-3 py-2 border-r sticky left-10 z-20 align-middle bg-white"
                    style="border-bottom: 3px solid #f97316">
                    <div class="text-[10px] text-orange-600 font-bold">{{ mat.product_type_code || 'RM' }}-{{ mIdx + 1 }}</div>
                    <div class="font-bold text-gray-900 text-[13px] leading-tight mt-1">{{ mat.material_name }}</div>
                    <div class="text-[10px] text-gray-400 mt-0.5">{{ mat.uom_name || 'KG' }}</div>
                  </td>
                  <td :rowspan="4" class="px-1 py-1 text-center border-r font-bold text-gray-700 bg-gray-50 sticky left-[170px] z-20 align-middle text-sm"
                    style="border-bottom: 3px solid #f97316">{{ mat.lead_time }}</td>
                  <td :rowspan="4" class="px-1 py-1 text-center border-r bg-orange-50 sticky left-[210px] z-20 align-middle"
                    style="border-bottom: 3px solid #f97316">
                    <input v-model.number="mat.first_stock" type="number" min="0" @input="mrpDirty = true"
                      class="w-16 text-center border border-orange-200 rounded px-1 py-1 text-[11px] font-bold" />
                  </td>
                  <td class="px-1 py-1 border-r sticky left-[300px] z-20 bg-white">
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
                <!-- Row 2: Planned Order Receipt -->
                <tr class="border-b border-gray-100">
                  <td class="px-1 py-1 border-r sticky left-[300px] z-20 bg-white">
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
                <!-- Row 3: Net Requirements -->
                <tr class="border-b border-gray-100">
                  <td class="px-1 py-1 border-r sticky left-[300px] z-20 bg-white">
                    <div class="bg-yellow-500 text-white rounded px-2 py-2 text-[11px] font-bold">⚠ Net_Req</div>
                  </td>
                  <td class="px-1 py-1 text-center border-r font-bold text-sm bg-gray-50 text-gray-400">—</td>
                  <td v-for="(wc, wIdx) in mrpWeekColumns" :key="'nr-'+mat.material_id+'-'+wc.week"
                    class="px-0 py-0.5 text-center border-r">
                    <div class="py-1.5 text-[11px] font-medium rounded mx-0.5" :class="cellCls(getMrpNetReq(mat, wIdx))">
                      {{ formatN(getMrpNetReq(mat, wIdx)) }}</div>
                  </td>
                </tr>
                <!-- Row 4: Projected On Hand -->
                <tr style="border-bottom: 3px solid #f97316">
                  <td class="px-1 py-1 border-r sticky left-[300px] z-20 bg-white">
                    <div class="bg-orange-500 text-white rounded px-2 py-2 text-[11px] font-bold">📈 Projected_OH</div>
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
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
const generatingWo = ref<number | null>(null);

// MRP state
const mrpOpen = ref(false);
const mrpLoading = ref(false);
const mrpProduct = ref<any>(null);
const mrpMaterials = ref<any[]>([]);
const mrpWeekColumns = ref<any[]>([]);
const mrpDirty = ref(false);
const savingMrp = ref(false);
const mrpDetailId = ref<number | null>(null);

const formatN = (n: number) => {
  if (n === 0) return '—';
  return new Intl.NumberFormat('id-ID').format(n);
};

// Week data helper: get or create reactive week data object
const weekDataMap = reactive<Record<string, any>>({});

const getWeekData = (item: any, wc: any): any => {
  const key = `${item.id}_${wc.year}_${wc.week}`;
  if (!weekDataMap[key]) {
    // Find from loaded data
    const found = (item.weeks || []).find((w: any) => w.week_number === wc.week && w.year === wc.year);
    weekDataMap[key] = reactive({
      mps_detail_id: item.id,
      week_number: wc.week,
      year: wc.year,
      forecast_qty: found?.forecast_qty || 0,
      so_qty: found?.so_qty || 0,
      start_process_qty: found?.start_process_qty || 0,
      fg_qty: found?.fg_qty || 0
    });
  }
  return weekDataMap[key];
};

// Task row total across all weeks
const taskTotal = (item: any, field: string): number => {
  let sum = 0;
  for (const wc of weekColumns.value) {
    sum += Number(getWeekData(item, wc)[field]) || 0;
  }
  return sum;
};

// Remaining = demand_qty - total filled in weekly cells
const getRemaining = (item: any, field: string): number => {
  const demand = Number(item.demand_qty) || 0;
  const total = taskTotal(item, field);
  return demand - total;
};

// Projected On Hand for a specific week index
const getProjectedOH = (item: any, weekIdx: number): number => {
  let oh = Number(item.current_stock) || 0;
  for (let i = 0; i <= weekIdx; i++) {
    const wc = weekColumns.value[i];
    const wd = getWeekData(item, wc);
    oh = oh + (Number(wd.fg_qty) || 0) - (Number(wd.forecast_qty) || 0) - (Number(wd.so_qty) || 0);
  }
  return oh;
};

const getLastProjectedOH = (item: any): number => {
  if (weekColumns.value.length === 0) return Number(item.current_stock) || 0;
  return getProjectedOH(item, weekColumns.value.length - 1);
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
    // Clear and rebuild week data map
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
    alert(`✓ ${res.data.pulled || 0} items pulled`);
    await openMps(activeMps.value.id);
  } catch (err: any) { alert(err?.response?.data?.error || 'Failed to pull orders'); }
  finally { pulling.value = false; }
};

const saveAll = async () => {
  if (!activeMps.value?.id) return;
  saving.value = true;
  try {
    // Save remarks
    for (const item of mpsDetails.value) {
      await api.put(`/ppic/mps/${activeMps.value.id}/details/${item.id}/remark`, {
        current_stock: item.current_stock || 0,
        batch_no: item.batch_no || null,
        batch_qty: item.batch_qty || 0,
        lead_time_weeks: item.lead_time_weeks || 1
      });
    }
    // Save week data
    const entries: any[] = [];
    for (const item of mpsDetails.value) {
      for (const wc of weekColumns.value) {
        const wd = getWeekData(item, wc);
        for (const field of ['forecast_qty', 'so_qty', 'start_process_qty', 'fg_qty']) {
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
  if (!confirm('Confirm MPS?')) return;
  if (isDirty.value) await saveAll();
  try {
    await api.post(`/ppic/mps/${activeMps.value.id}/confirm`);
    await openMps(activeMps.value.id);
    await loadMpsList();
    alert('✓ MPS Confirmed!');
  } catch (err: any) { alert(err?.response?.data?.error || 'Failed to confirm'); }
};

const generateWo = async (item: any) => {
  if (!confirm(`Generate WO for "${item.product_name}"?`)) return;
  generatingWo.value = item.id;
  try {
    const res = await api.post(`/ppic/mps/${activeMps.value.id}/details/${item.id}/generate-wo`);
    alert(`✓ ${res.data.data?.wo_number} created!`);
    await openMps(activeMps.value.id);
  } catch (err: any) { alert(err?.response?.data?.error || 'Failed'); }
  finally { generatingWo.value = null; }
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

const saveMrp = async () => {
  if (!mrpDetailId.value || !activeMps.value?.id) return;
  savingMrp.value = true;
  try {
    const entries: any[] = [];
    for (const mat of mrpMaterials.value) {
      for (const w of (mat.weeks || [])) {
        entries.push({ material_id: mat.material_id, week_number: w.week_number, year: w.year, planned_order_receipt: Number(w.planned_order_receipt) || 0 });
      }
    }
    await api.put(`/ppic/mps/${activeMps.value.id}/details/${mrpDetailId.value}/mrp`, { entries });
    mrpDirty.value = false;
    alert('✓ MRP saved!');
  } catch (err: any) { alert(err?.response?.data?.error || 'Failed to save'); }
  finally { savingMrp.value = false; }
};

const deleteMps = async () => {
  if (!confirm('Delete MPS?')) return;
  try {
    await api.delete(`/ppic/mps/${activeMps.value.id}`);
    goBack();
    await loadMpsList();
  } catch (err: any) { alert(err?.response?.data?.error || 'Failed'); }
};

onMounted(() => { loadMpsList(); });

const cellCls = (v: number) => {
  if (v < 0) return 'bg-red-100 text-red-700';
  if (v > 0) return 'bg-green-100 text-green-700';
  return 'bg-gray-50 text-gray-400';
};
</script>

<style scoped>
/* Row hover highlight */
:deep(tbody tr) {
  transition: all 0.2s ease;
}
:deep(tbody tr:hover) {
  filter: brightness(0.97);
  box-shadow: inset 0 0 0 1px rgba(13, 148, 136, 0.15);
}

/* Cell hover glow */
:deep(tbody td) {
  transition: background-color 0.15s ease, box-shadow 0.15s ease;
}
:deep(tbody td:hover) {
  box-shadow: inset 0 0 10px rgba(13, 148, 136, 0.15);
}

/* Input focus animation */
:deep(input[type="number"]) {
  transition: box-shadow 0.2s ease, background-color 0.2s ease;
}
:deep(input[type="number"]:focus) {
  box-shadow: 0 0 0 2px rgba(13, 148, 136, 0.3), inset 0 0 6px rgba(13, 148, 136, 0.1);
}

/* Negative value pulse */
@keyframes pulse-red {
  0%, 100% { background-color: rgb(254, 226, 226); }
  50% { background-color: rgb(254, 202, 202); }
}
:deep(.bg-red-100) {
  animation: pulse-red 2s ease-in-out infinite;
}
</style>
