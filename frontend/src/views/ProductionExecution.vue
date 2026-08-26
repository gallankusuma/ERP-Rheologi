<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 class="text-xl font-bold text-gray-900">Production Execution</h1>
        <p class="text-sm text-gray-500 mt-0.5">Real-time work order tracking &amp; SPKP management</p>
      </div>
      <div class="flex items-center gap-2">
        <button @click="viewMode = 'cards'"
          class="px-3 py-1.5 text-sm font-semibold rounded-lg border transition-all"
          :class="viewMode === 'cards' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'">
          WO Cards
        </button>
        <button @click="viewMode = 'kanban'"
          class="px-3 py-1.5 text-sm font-semibold rounded-lg border transition-all"
          :class="viewMode === 'kanban' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'">
          SPKP Kanban
        </button>
      </div>
    </div>

    <div v-if="store.loading" class="text-center py-10">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>

    <!-- ===== WO CARDS VIEW ===== -->
    <div v-else-if="viewMode === 'cards'" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div v-for="wo in store.executionOrders" :key="wo.id"
        class="rounded-lg shadow p-5 transition-all"
        :class="[
          isStartable(wo.status) ? 'bg-gray-50 border-2 border-dashed border-gray-300 opacity-80' : 'bg-white border-l-4',
          !isStartable(wo.status) ? borderColor(wo.status) : ''
        ]">
        <div class="flex justify-between items-start mb-3">
          <div>
            <h3 class="text-lg font-bold text-gray-900">{{ wo.wo_number || 'WO-' + wo.id }}</h3>
            <p class="text-sm text-gray-600">{{ wo.product_name }} ({{ wo.sku }})</p>
            <p v-if="wo.line_process_name" class="text-xs mt-1">
              <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">
                {{ wo.line_process_name }}
                <span v-if="wo.capacity_per_hour" class="text-purple-500">· {{ wo.capacity_per_hour }}/hr</span>
              </span>
            </p>
          </div>
          <span :class="statusBadge(wo.status)" class="px-2 py-1 text-xs font-semibold rounded-full">
            {{ statusLabel(wo.status) }}
          </span>
        </div>

        <div class="grid grid-cols-4 gap-3 text-sm mb-3">
          <div>
            <p class="text-gray-500">Quantity</p>
            <p class="font-semibold">{{ wo.quantity }}</p>
          </div>
          <div>
            <p class="text-gray-500">Materials</p>
            <p class="font-semibold">{{ wo.materials_ready }}/{{ wo.materials_total }}</p>
          </div>
          <div>
            <p class="text-gray-500">Processes</p>
            <p class="font-semibold">{{ wo.process_count }}</p>
          </div>
          <div>
            <p class="text-gray-500">QC</p>
            <div v-if="wo.qc_total > 0">
              <span v-if="wo.qc_pending_mandatory === 0"
                class="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                {{ wo.qc_passed }}/{{ wo.qc_total }}
              </span>
              <span v-else
                class="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full animate-pulse">
                {{ wo.qc_passed }}/{{ wo.qc_total }}
              </span>
            </div>
            <span v-else class="text-xs text-gray-400">—</span>
          </div>
        </div>

        <div class="text-xs text-gray-400 mb-3">
          <span v-if="wo.actual_start">Started: {{ formatDateTime(wo.actual_start) }}</span>
          <span v-else>Scheduled: {{ formatDate(wo.scheduled_start) }}</span>
        </div>

        <!-- Action Buttons -->
        <div class="flex flex-wrap gap-2">
          <template v-if="isStartable(wo.status)">
            <button @click="doAction('start', wo.id)" class="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 font-semibold">
              Start Production
            </button>
            <span class="text-xs text-gray-400 italic self-center">Start WO to enable Process Logs & QC</span>
          </template>

          <template v-else-if="wo.status === 'in_progress' || wo.status === 'IN_PROGRESS'">
            <button @click="doAction('pause', wo.id)" class="px-3 py-1.5 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700">
              Pause
            </button>
            <button @click="doAction('complete', wo.id)"
              :disabled="wo.qc_pending_mandatory > 0"
              :title="wo.qc_pending_mandatory > 0 ? `Cannot complete: ${wo.qc_pending_mandatory} mandatory QC checkpoint(s) pending` : 'Complete this work order'"
              class="px-3 py-1.5 text-white text-xs rounded transition-all"
              :class="wo.qc_pending_mandatory > 0 ? 'bg-gray-400 cursor-not-allowed opacity-60' : 'bg-indigo-600 hover:bg-indigo-700'">
              {{ wo.qc_pending_mandatory > 0 ? 'QC Pending' : 'Complete' }}
            </button>
            <button @click="openLogs(wo)" class="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300">
              Process Logs
            </button>
            <button @click="openQCPanel(wo)" class="px-3 py-1.5 bg-purple-100 text-purple-700 text-xs rounded hover:bg-purple-200 font-medium">
              QC Checkpoints
            </button>
            <button @click="openSpkpKanban(wo)" class="px-3 py-1.5 bg-teal-50 text-teal-700 text-xs rounded hover:bg-teal-100 font-medium border border-teal-200">
              SPKP Kanban
            </button>
          </template>

          <template v-else-if="wo.status === 'on_hold'">
            <button @click="doAction('resume', wo.id)" class="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
              Resume
            </button>
            <button @click="openLogs(wo)" class="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300">
              Process Logs
            </button>
            <button @click="openQCPanel(wo)" class="px-3 py-1.5 bg-purple-100 text-purple-700 text-xs rounded hover:bg-purple-200 font-medium">
              QC Checkpoints
            </button>
          </template>
        </div>
      </div>
      <div v-if="!store.executionOrders.length" class="col-span-2 text-center py-12 text-gray-400">
        No active work orders
      </div>
    </div>

    <!-- ===== SPKP KANBAN FULL PAGE ===== -->
    <div v-else-if="viewMode === 'kanban'" class="space-y-4">
      <!-- WO selector -->
      <div class="flex items-center gap-3 flex-wrap">
        <select v-model="selectedWoIdForKanban" @change="onWoSelectChange"
          class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white min-w-[300px]">
          <option :value="0" disabled>Pilih Work Order...</option>
          <option v-for="wo in store.executionOrders" :key="wo.id" :value="wo.id">
            {{ wo.wo_number || 'WO-' + wo.id }} — {{ wo.product_name }} ({{ wo.sku }})
          </option>
        </select>
        <div v-if="spkpWo" class="flex items-center gap-3 text-sm">
          <span class="text-gray-500">Qty: <b class="text-gray-800">{{ spkpWo.quantity }}</b></span>
          <span class="text-gray-500">Planned: <b class="text-gray-800">{{ spkpTotalPlanned.toLocaleString() }}</b></span>
          <span v-if="spkpTotalActual > 0" class="text-gray-500">Actual: <b class="text-emerald-600">{{ spkpTotalActual.toLocaleString() }}</b></span>
          <span class="text-gray-500">Items: <b>{{ spkpList.length }}</b></span>
        </div>
        <div class="flex-1"></div>
        <div v-if="selectedWoIdForKanban > 0" class="flex items-center gap-2">
          <button @click="showSpkpAddForm = !showSpkpAddForm"
            class="px-3 py-1.5 bg-white border border-teal-300 hover:bg-teal-50 text-teal-700 text-sm font-semibold rounded-lg transition-colors">
            + Add
          </button>
          <button v-if="spkpList.length === 0" @click="generateSpkp" :disabled="spkpLoading"
            class="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
            {{ spkpLoading ? 'Generating...' : 'Generate' }}
          </button>
          <button v-if="spkpList.length > 0" @click="showRegenConfirm = true"
            class="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-sm font-semibold rounded-lg transition-colors">
            Regenerate
          </button>
        </div>
      </div>

      <!-- Board controls, the same set the Leads pipeline offers -->
      <div v-if="selectedWoIdForKanban > 0 && spkpList.length > 0"
        class="flex flex-wrap items-center gap-2">
        <div class="flex rounded-lg overflow-hidden border border-gray-300">
          <button @click="spkpViewMode = 'list'"
            :class="spkpViewMode === 'list' ? 'bg-teal-600 text-white' : 'bg-white text-gray-700'"
            class="px-3 py-2 text-sm font-medium transition-colors">List</button>
          <button @click="spkpViewMode = 'kanban'"
            :class="spkpViewMode === 'kanban' ? 'bg-teal-600 text-white' : 'bg-white text-gray-700'"
            class="px-3 py-2 text-sm font-medium transition-colors border-l border-gray-300">Kanban</button>
        </div>
        <select v-model="spkpFilterStatus" class="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
          <option value="">Semua status</option>
          <option v-for="col in spkpKanbanCols" :key="col.key" :value="col.key">{{ col.label }}</option>
        </select>
        <input v-model="spkpSearch" type="text" placeholder="Cari nomor, operator, catatan..."
          class="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        <select v-model="spkpSort" class="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
          <option value="date">Tanggal</option>
          <option value="planned">Qty terbesar</option>
          <option value="number">Nomor SPKP</option>
        </select>
        <span v-if="spkpVisible.length !== spkpList.length" class="text-xs text-gray-500">
          {{ spkpVisible.length }} dari {{ spkpList.length }}
        </span>
      </div>

      <!-- add form -->
      <div v-if="showSpkpAddForm && selectedWoIdForKanban > 0" class="p-4 bg-teal-50 rounded-xl border border-teal-100">
        <div class="flex items-end gap-3 flex-wrap">
          <div>
            <label class="block text-xs font-semibold text-gray-500 mb-1">Tanggal</label>
            <input v-model="spkpAddForm.schedule_date" type="date"
              class="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-teal-300 focus:outline-none bg-white" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-500 mb-1">Planned Qty</label>
            <input v-model.number="spkpAddForm.planned_qty" type="number" step="0.01" min="0"
              class="w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-teal-300 focus:outline-none bg-white"
              placeholder="Qty" />
          </div>
          <button @click="addSpkpManual" :disabled="!spkpAddForm.schedule_date || !spkpAddForm.planned_qty || spkpLoading"
            class="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
            Tambah
          </button>
          <button @click="showSpkpAddForm = false"
            class="px-4 py-2 border border-gray-200 text-gray-500 text-sm rounded-lg hover:bg-gray-100 transition-colors">
            Batal
          </button>
        </div>
      </div>

      <!-- no WO selected -->
      <div v-if="selectedWoIdForKanban === 0" class="py-16 text-center text-gray-400 text-sm">
        Pilih Work Order untuk melihat SPKP Kanban
      </div>

      <!-- kanban loading -->
      <div v-else-if="spkpLoading" class="py-16 text-center text-gray-400 text-sm">Memuat...</div>

      <!-- kanban empty -->
      <div v-else-if="spkpList.length === 0 && selectedWoIdForKanban > 0" class="py-16 text-center text-gray-400 text-sm">
        Belum ada SPKP — klik "Generate" atau "+ Add"
      </div>

      <!-- list view, the counterpart of the Leads list -->
      <div v-else-if="spkpViewMode === 'list'" class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SPKP</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Planned</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actual</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Operator</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-if="!spkpVisible.length">
              <td colspan="6" class="px-4 py-10 text-center text-sm text-gray-400">Tidak ada SPKP yang cocok.</td>
            </tr>
            <tr v-for="s in spkpVisible" :key="s.id" @click="openSpkpDetail(s)"
              class="hover:bg-gray-50 cursor-pointer" :class="isSpkpLate(s) ? 'bg-red-50' : ''">
              <td class="px-4 py-3 text-sm font-medium text-gray-900">{{ s.spkp_number }}</td>
              <td class="px-4 py-3 text-sm" :class="isSpkpLate(s) ? 'text-red-700 font-medium' : 'text-gray-600'">
                {{ formatSpkpDay(s.schedule_date) }} · {{ formatDate(s.schedule_date) }}
              </td>
              <td class="px-4 py-3 text-sm text-right">{{ Number(s.planned_qty || 0).toLocaleString() }}</td>
              <td class="px-4 py-3 text-sm text-right">
                <span v-if="Number(s.actual_qty) > 0">{{ Number(s.actual_qty).toLocaleString() }}</span>
                <span v-else class="text-gray-400">—</span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-600">{{ s.operator_name || '—' }}</td>
              <td class="px-4 py-3">
                <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold"
                  :style="{ background: spkpColColor(s.status) + '20', color: spkpColColor(s.status) }">
                  {{ spkpColLabel(s.status) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- kanban board full page (same style as Leads) -->
      <div v-else class="flex overflow-x-auto gap-4 pb-4">
        <div v-for="col in spkpKanbanCols" :key="col.key"
          class="flex-shrink-0 w-80 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col max-h-[calc(100vh-200px)] transition-all"
          :class="{ 'ring-2 ring-blue-400 bg-blue-50/30': spkpDragOverCol === col.key }"
          @dragover.prevent="spkpDragOverCol = col.key"
          @dragleave="spkpDragOverCol = null"
          @drop="onSpkpDrop(col.key)">
          <!-- Stage Header (same as Leads) -->
          <div class="p-4 border-b rounded-t-xl" :style="{ borderBottomColor: col.color, background: col.color + '10' }">
            <div class="flex justify-between items-center">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full" :style="{ background: col.color }"></span>
                <h3 class="font-semibold text-gray-800">{{ col.label }}</h3>
              </div>
              <span class="text-xs font-bold bg-white px-2.5 py-1 rounded-full text-gray-600 shadow-sm">
                {{ getSpkpByStatus(col.key).length }}
              </span>
            </div>
            <p class="text-xs text-gray-500 mt-1">
              Total: <b>{{ getColTotal(col.key).toLocaleString() }}</b>
            </p>
          </div>

          <!-- SPKP Cards (same card style as Leads) -->
          <div class="flex-1 overflow-y-auto p-3 space-y-3 min-h-[80px]">
            <div v-for="s in getSpkpByStatus(col.key)" :key="s.id"
              draggable="true"
              @dragstart="onSpkpDragStart($event, s)"
              @dragend="onSpkpDragEnd"
              @click="openSpkpDetail(s)"
              class="bg-white p-3 rounded-lg border-l-4 border border-gray-200 hover:shadow-lg transition-all cursor-pointer group relative"
              :class="{ 'opacity-40 scale-95': draggingSpkp?.id === s.id }"
              :style="{ borderLeftColor: col.color }">

              <!-- Top Row: SPKP Number + Actions -->
              <div class="flex justify-between items-start mb-1.5">
                <p class="font-semibold text-gray-800 text-sm flex-1 leading-tight">{{ s.spkp_number }}</p>
                <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button @click.stop="deleteSpkpItem(s)" class="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none">×</button>
                </div>
              </div>

              <!-- Date, flagged when the scheduled day has passed and nothing was produced -->
              <div class="flex items-center gap-1.5 mb-2">
                <span class="text-[10px] px-2 py-0.5 rounded font-semibold"
                  :class="isSpkpLate(s) ? 'bg-red-100 text-red-700' : 'bg-gray-50 text-gray-600'">
                  {{ formatSpkpDay(s.schedule_date) }} · {{ formatDate(s.schedule_date) }}
                </span>
                <span v-if="s.printed_at" class="text-[10px] text-gray-400" title="Sudah dicetak">Printed</span>
              </div>

              <!-- Qty (same layout as Value & Probability in Leads) -->
              <div class="flex justify-between items-center mb-2.5 pb-2 border-b border-gray-100">
                <p class="text-sm font-bold text-gray-900">Plan: {{ Number(s.planned_qty).toLocaleString() }}</p>
                <span v-if="Number(s.actual_qty) > 0"
                  class="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                  Act: {{ Number(s.actual_qty).toLocaleString() }}
                </span>
                <span v-else class="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                  Belum produksi
                </span>
              </div>

              <!-- Progress bar if actual > 0 -->
              <div v-if="Number(s.actual_qty) > 0" class="flex items-center gap-2 mb-2">
                <div class="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div class="h-full bg-emerald-500 rounded-full transition-all"
                    :style="{ width: Math.min(100, (Number(s.actual_qty) / Number(s.planned_qty || 1)) * 100) + '%' }"></div>
                </div>
                <span class="text-[10px] text-gray-500 font-medium">{{ Math.round((Number(s.actual_qty) / Number(s.planned_qty || 1)) * 100) }}%</span>
              </div>

              <!-- Bottom: Operator + Supervisor -->
              <div class="flex justify-between items-center">
                <span v-if="s.operator_name" class="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">Op: {{ s.operator_name }}</span>
                <span v-else></span>
                <div class="flex items-center gap-2 text-[10px] text-gray-400">
                  <span v-if="s.supervisor_name" class="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-[8px] font-bold flex items-center justify-center" :title="s.supervisor_name">{{ getInitials(s.supervisor_name) }}</span>
                  <span v-if="s.notes" title="Has notes">📝</span>
                </div>
              </div>

            </div>

            <!-- Drop Placeholder (same as Leads) -->
            <div v-if="getSpkpByStatus(col.key).length === 0"
              class="text-center py-8 text-gray-400 text-xs italic border-2 border-dashed border-gray-200 rounded-lg">
              {{ draggingSpkp ? 'Drop here' : 'No SPKP' }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- SPKP detail panel — the counterpart of the Leads detail panel. Editing lives here rather
         than on the card, so there is one place a card is changed and the board stays readable. -->
    <div v-if="spkpDetail" class="fixed inset-0 z-[70] flex justify-end bg-black/30" @click.self="closeSpkpDetail">
      <div class="bg-white w-full max-w-md h-full shadow-2xl flex flex-col">
        <div class="px-5 py-4 border-b flex justify-between items-start"
          :style="{ borderBottomColor: spkpColColor(spkpDetail.status) }">
          <div>
            <p class="font-bold text-gray-900">{{ spkpDetail.spkp_number }}</p>
            <p class="text-xs text-gray-500 mt-0.5">{{ spkpWo?.wo_number || '' }}</p>
          </div>
          <button @click="closeSpkpDetail" class="text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
        </div>

        <div class="flex-1 overflow-y-auto p-5 space-y-5">
          <!-- status, moved the same way a lead moves between stages -->
          <div>
            <label class="block text-xs font-semibold text-gray-500 mb-1.5">Status</label>
            <div class="flex gap-2">
              <button v-for="col in spkpKanbanCols" :key="col.key"
                @click="updateSpkpField(spkpDetail, 'status', col.key)"
                class="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                :class="spkpDetail.status === col.key ? 'text-white' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'"
                :style="spkpDetail.status === col.key ? { background: col.color, borderColor: col.color } : {}">
                {{ col.label }}
              </button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-gray-500 mb-1">Tanggal produksi</label>
            <input type="date" :value="spkpDetail.schedule_date ? String(spkpDetail.schedule_date).slice(0, 10) : ''"
              @blur="updateSpkpField(spkpDetail, 'schedule_date', ($event.target as HTMLInputElement).value)"
              class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-teal-300 focus:outline-none" />
            <p v-if="isSpkpLate(spkpDetail)" class="text-[11px] text-red-600 mt-1">
              Tanggalnya sudah lewat dan belum selesai diproduksi.
            </p>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-gray-500 mb-1">Planned</label>
              <input type="number" step="0.01" :value="spkpDetail.planned_qty"
                @blur="updateSpkpField(spkpDetail, 'planned_qty', ($event.target as HTMLInputElement).value)"
                class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-right focus:ring-1 focus:ring-teal-300 focus:outline-none" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-500 mb-1">Actual</label>
              <input type="number" step="0.01" :value="spkpDetail.actual_qty" placeholder="—"
                @blur="updateSpkpField(spkpDetail, 'actual_qty', ($event.target as HTMLInputElement).value)"
                class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-right focus:ring-1 focus:ring-teal-300 focus:outline-none" />
            </div>
          </div>

          <div v-if="Number(spkpDetail.actual_qty) > 0">
            <div class="flex justify-between text-xs text-gray-500 mb-1">
              <span>Pencapaian</span>
              <span class="font-semibold">
                {{ Math.round((Number(spkpDetail.actual_qty) / Number(spkpDetail.planned_qty || 1)) * 100) }}%
              </span>
            </div>
            <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div class="h-full bg-emerald-500 rounded-full transition-all"
                :style="{ width: Math.min(100, (Number(spkpDetail.actual_qty) / Number(spkpDetail.planned_qty || 1)) * 100) + '%' }"></div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-gray-500 mb-1">Operator</label>
              <input type="text" :value="spkpDetail.operator_name" placeholder="Nama operator"
                @blur="updateSpkpField(spkpDetail, 'operator_name', ($event.target as HTMLInputElement).value)"
                class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-teal-300 focus:outline-none" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-500 mb-1">Supervisor</label>
              <input type="text" :value="spkpDetail.supervisor_name" placeholder="Nama supervisor"
                @blur="updateSpkpField(spkpDetail, 'supervisor_name', ($event.target as HTMLInputElement).value)"
                class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-teal-300 focus:outline-none" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-gray-500 mb-1">Catatan</label>
            <textarea rows="3" :value="spkpDetail.notes" placeholder="Catatan produksi"
              @blur="updateSpkpField(spkpDetail, 'notes', ($event.target as HTMLTextAreaElement).value)"
              class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-teal-300 focus:outline-none"></textarea>
          </div>

          <div class="text-xs text-gray-400 border-t pt-3 space-y-1">
            <p v-if="spkpDetail.printed_at">Dicetak {{ formatDate(spkpDetail.printed_at) }}</p>
            <p v-else>Belum pernah dicetak</p>
            <p v-if="spkpDetail.created_at">Dibuat {{ formatDate(spkpDetail.created_at) }}</p>
          </div>
        </div>

        <div class="px-5 py-4 border-t flex justify-between">
          <button @click="deleteSpkpItem(spkpDetail); closeSpkpDetail()"
            class="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">Hapus</button>
          <button @click="closeSpkpDetail"
            class="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">Tutup</button>
        </div>
      </div>
    </div>

    <!-- Regenerate confirm -->
    <div v-if="showRegenConfirm" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" @click.self="showRegenConfirm = false">
      <div class="bg-white rounded-xl shadow-2xl w-[380px] p-6 text-center">
        <div class="text-3xl mb-3">Warning</div>
        <h3 class="font-bold text-gray-800 mb-2">Regenerate SPKP?</h3>
        <p class="text-sm text-gray-500 mb-4">Semua {{ spkpList.length }} SPKP akan dihapus dan di-generate ulang.</p>
        <div class="flex justify-center gap-3">
          <button @click="showRegenConfirm = false"
            class="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50">Batal</button>
          <button @click="doRegenSpkp" :disabled="spkpLoading"
            class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
            Regenerate
          </button>
        </div>
      </div>
    </div>

    <!-- Process Logs Modal -->
    <div v-if="showLogs" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="showLogs = false">
      <div class="bg-white rounded-xl shadow-2xl w-[600px] max-h-[90vh] overflow-y-auto">
        <div class="flex justify-between items-center px-5 py-3 border-b">
          <h3 class="font-bold text-gray-800">Process Logs — {{ selectedWo?.wo_number }}</h3>
          <button @click="showLogs = false" class="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div class="p-5 space-y-4">
          <div class="grid grid-cols-2 gap-3">
            <input v-model="logForm.process_name" placeholder="Process Name" class="border rounded px-3 py-2 text-sm" />
            <select v-model="logForm.status" class="border rounded px-3 py-2 text-sm">
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
            <input v-model="logForm.start_time" type="datetime-local" class="border rounded px-3 py-2 text-sm" />
            <input v-model="logForm.end_time" type="datetime-local" class="border rounded px-3 py-2 text-sm" />
          </div>
          <textarea v-model="logForm.notes" placeholder="Notes" class="w-full border rounded px-3 py-2 text-sm" rows="2"></textarea>
          <button @click="submitLog" class="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">Add Log</button>
          <div class="border-t pt-3 space-y-2">
            <div v-for="log in processLogs" :key="log.id" class="flex justify-between items-center bg-gray-50 rounded p-3 text-sm">
              <div>
                <span class="font-semibold">{{ log.process_name }}</span>
                <span class="text-xs text-gray-400 ml-2">{{ log.status }}</span>
                <div class="text-xs text-gray-500 mt-0.5">
                  {{ formatTime(log.start_time) }} - {{ formatTime(log.end_time) }}
                </div>
                <div v-if="log.notes" class="text-xs text-gray-400 mt-0.5">{{ log.notes }}</div>
              </div>
              <button @click="deleteLog(log.id)" class="text-red-400 hover:text-red-600 text-sm">Delete</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- QC Panel Modal -->
    <div v-if="showQCPanel" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="showQCPanel = false">
      <div class="bg-white rounded-xl shadow-2xl w-[650px] max-h-[90vh] overflow-y-auto">
        <div class="flex justify-between items-center px-5 py-3 border-b">
          <h3 class="font-bold text-gray-800">QC Checkpoints — {{ selectedWo?.wo_number }}</h3>
          <button @click="showQCPanel = false" class="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div class="p-5 space-y-4">
          <div class="grid grid-cols-2 gap-3">
            <input v-model="qcForm.checkpoint_name" placeholder="Checkpoint Name" class="border rounded px-3 py-2 text-sm" />
            <select v-model="qcForm.is_mandatory" class="border rounded px-3 py-2 text-sm">
              <option :value="true">Mandatory</option>
              <option :value="false">Optional</option>
            </select>
          </div>
          <button @click="addCheckpoint" class="px-4 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700">Add Checkpoint</button>
          <div class="border-t pt-3 space-y-2">
            <div v-for="cp in qcCheckpoints" :key="cp.id"
              class="flex justify-between items-center rounded p-3 text-sm border"
              :class="cp.status === 'passed' ? 'bg-green-50 border-green-200' : cp.status === 'failed' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'">
              <div>
                <span class="font-semibold">{{ cp.checkpoint_name }}</span>
                <span v-if="cp.is_mandatory" class="text-xs text-red-500 ml-1">(Mandatory)</span>
                <span class="text-xs ml-2 px-2 py-0.5 rounded-full"
                  :class="cp.status === 'passed' ? 'bg-green-100 text-green-700' : cp.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'">
                  {{ cp.status }}
                </span>
              </div>
              <div class="flex items-center gap-1">
                <button v-if="cp.status === 'pending'" @click="updateCheckpointStatus(cp.id, 'passed')"
                  class="px-2 py-1 bg-green-600 text-white text-xs rounded">Pass</button>
                <button v-if="cp.status === 'pending'" @click="updateCheckpointStatus(cp.id, 'failed')"
                  class="px-2 py-1 bg-red-600 text-white text-xs rounded">Fail</button>
                <button @click="deleteCheckpoint(cp.id)" class="text-red-400 hover:text-red-600 text-sm ml-2">Del</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useProductionStore } from '../stores/production';
import { api } from '../lib/api';

const store = useProductionStore();
const viewMode = ref<'cards' | 'kanban'>('cards');
const showLogs = ref(false);
const showQCPanel = ref(false);
const selectedWo = ref<any>(null);
const selectedWoId = ref<number>(0);
const logForm = ref({ process_name: '', start_time: '', end_time: '', status: 'pending', notes: '' });
const qcCheckpoints = ref<any[]>([]);
const qcForm = ref({ checkpoint_name: '', is_mandatory: true });
const processLogs = ref<any[]>([]);

onMounted(() => { store.fetchExecution(); });

const isStartable = (s: string) => ['released', 'RELEASED', 'Released'].includes(s);

const doAction = async (action: string, woId: number) => {
  try {
    await api.post(`/production/execution/${woId}/${action}`);
    await store.fetchExecution();
  } catch (e) { /* ignore */ }
};

const openLogs = async (wo: any) => {
  selectedWo.value = wo;
  selectedWoId.value = wo.id;
  showLogs.value = true;
  await loadLogs(wo.id);
};

const loadLogs = async (woId: number) => {
  try {
    const res = await api.get(`/production/execution/${woId}/process-logs`);
    processLogs.value = res.data.data || [];
  } catch { processLogs.value = []; }
};

const submitLog = async () => {
  try {
    await api.post(`/production/execution/${selectedWoId.value}/process-logs`, logForm.value);
    logForm.value = { process_name: '', start_time: '', end_time: '', status: 'pending', notes: '' };
    await loadLogs(selectedWoId.value);
  } catch (e) { /* ignore */ }
};

const deleteLog = async (logId: number) => {
  try {
    await api.delete(`/production/execution/${selectedWoId.value}/process-logs/${logId}`);
    await loadLogs(selectedWoId.value);
  } catch (e) { /* ignore */ }
};

const openQCPanel = async (wo: any) => {
  selectedWo.value = wo;
  selectedWoId.value = wo.id;
  showQCPanel.value = true;
  await loadCheckpoints(wo.id);
};

const loadCheckpoints = async (woId: number) => {
  try {
    const res = await api.get(`/production/execution/${woId}/qc-checkpoints`);
    qcCheckpoints.value = res.data.data || [];
  } catch { qcCheckpoints.value = []; }
};

const addCheckpoint = async () => {
  try {
    await api.post(`/production/execution/${selectedWoId.value}/qc-checkpoints`, qcForm.value);
    qcForm.value = { checkpoint_name: '', is_mandatory: true };
    await loadCheckpoints(selectedWoId.value);
    await store.fetchExecution();
  } catch (e) { /* ignore */ }
};

const updateCheckpointStatus = async (checkpointId: number, status: string) => {
  try {
    await api.put(`/production/execution/${selectedWoId.value}/qc-checkpoints/${checkpointId}`, { status });
    await loadCheckpoints(selectedWoId.value);
    await store.fetchExecution();
  } catch (e) { /* ignore */ }
};

const deleteCheckpoint = async (checkpointId: number) => {
  try {
    await api.delete(`/production/execution/${selectedWoId.value}/qc-checkpoints/${checkpointId}`);
    await loadCheckpoints(selectedWoId.value);
    await store.fetchExecution();
  } catch (e) { /* ignore */ }
};

const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString() : '-';
const formatDateTime = (d: string | null) => d ? new Date(d).toLocaleString() : '-';
const formatTime = (d: string | null) => d ? new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';

const statusLabel = (s: string) => ({
  released: 'Released', RELEASED: 'Released', Released: 'Released',
  in_progress: 'In Progress', IN_PROGRESS: 'In Progress',
  completed: 'Completed', COMPLETED: 'Completed',
  on_hold: 'On Hold', ON_HOLD: 'On Hold',
  DRAFT: 'Draft', Draft: 'Draft', draft: 'Draft',
}[s] || s);

const statusBadge = (s: string) => ({
  released: 'bg-cyan-100 text-cyan-800', RELEASED: 'bg-cyan-100 text-cyan-800', Released: 'bg-cyan-100 text-cyan-800',
  in_progress: 'bg-blue-100 text-blue-800', IN_PROGRESS: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800', COMPLETED: 'bg-green-100 text-green-800',
  on_hold: 'bg-orange-100 text-orange-800', ON_HOLD: 'bg-orange-100 text-orange-800',
  DRAFT: 'bg-gray-200 text-gray-700', Draft: 'bg-gray-200 text-gray-700', draft: 'bg-gray-200 text-gray-700',
}[s] || 'bg-gray-100 text-gray-800');

const borderColor = (s: string) => ({
  released: 'border-cyan-500', RELEASED: 'border-cyan-500', Released: 'border-cyan-500',
  in_progress: 'border-blue-500', IN_PROGRESS: 'border-blue-500',
  completed: 'border-green-500', COMPLETED: 'border-green-500',
  on_hold: 'border-orange-400', ON_HOLD: 'border-orange-400',
  DRAFT: 'border-gray-300', Draft: 'border-gray-300', draft: 'border-gray-300',
}[s] || 'border-gray-300');

// SPKP kanban
const selectedWoIdForKanban = ref<number>(0);
const spkpWo = ref<any>(null);
const spkpList = ref<any[]>([]);
const spkpLoading = ref(false);
const showSpkpAddForm = ref(false);
const showRegenConfirm = ref(false);
const spkpAddForm = ref({ schedule_date: '', planned_qty: 0 });

const spkpTotalPlanned = computed(() => spkpList.value.reduce((sum, s) => sum + Number(s.planned_qty || 0), 0));
const spkpTotalActual = computed(() => spkpList.value.reduce((sum, s) => sum + Number(s.actual_qty || 0), 0));

const spkpKanbanCols = [
  { key: 'draft', label: 'Draft', color: '#6b7280' },
  { key: 'released', label: 'Released', color: '#3b82f6' },
  { key: 'completed', label: 'Completed', color: '#10b981' },
];

// Board controls, matching the Leads pipeline: the same list/kanban switch, search, status
// filter and sort, so moving between the two screens does not mean learning a second set of
// habits. Filtering applies to both views, and to the column totals, so what is shown and what
// is counted never disagree.
const spkpViewMode = ref<'kanban' | 'list'>('kanban');
const spkpSearch = ref('');
const spkpFilterStatus = ref('');
const spkpSort = ref<'date' | 'planned' | 'number'>('date');
const spkpDetail = ref<any>(null);

const spkpVisible = computed(() => {
  const q = spkpSearch.value.trim().toLowerCase();
  let out = spkpList.value.filter((s: any) => {
    if (spkpFilterStatus.value && s.status !== spkpFilterStatus.value) return false;
    if (!q) return true;
    return [s.spkp_number, s.operator_name, s.supervisor_name, s.notes]
      .some((f: any) => String(f || '').toLowerCase().includes(q));
  });
  out = [...out].sort((a: any, b: any) => {
    if (spkpSort.value === 'planned') return Number(b.planned_qty || 0) - Number(a.planned_qty || 0);
    if (spkpSort.value === 'number') return String(a.spkp_number || '').localeCompare(String(b.spkp_number || ''));
    return String(a.schedule_date || '').localeCompare(String(b.schedule_date || ''));
  });
  return out;
});

const getSpkpByStatus = (status: string) => spkpVisible.value.filter((s: any) => s.status === status);
const getColTotal = (status: string) => getSpkpByStatus(status).reduce((sum: number, s: any) => sum + Number(s.planned_qty || 0), 0);

/** a scheduled day that has passed while the card is still waiting to be produced */
const isSpkpLate = (s: any) =>
  !!s.schedule_date &&
  String(s.schedule_date).slice(0, 10) < new Date().toISOString().slice(0, 10) &&
  s.status !== 'completed';

const spkpColColor = (status: string) =>
  spkpKanbanCols.find(c => c.key === status)?.color || '#9ca3af';
const spkpColLabel = (status: string) =>
  spkpKanbanCols.find(c => c.key === status)?.label || status;

const openSpkpDetail = (s: any) => { spkpDetail.value = s; };
const closeSpkpDetail = () => { spkpDetail.value = null; };

const draggingSpkp = ref<any>(null);
const spkpDragOverCol = ref<string | null>(null);

const openSpkpKanban = (wo: any) => {
  viewMode.value = 'kanban';
  selectedWoIdForKanban.value = wo.id;
  onWoSelectChange();
};

const onWoSelectChange = async () => {
  const wo = store.executionOrders.find((w: any) => w.id === selectedWoIdForKanban.value);
  spkpWo.value = wo || null;
  spkpDetail.value = null;
  showSpkpAddForm.value = false;
  if (selectedWoIdForKanban.value > 0) {
    await loadSpkp(selectedWoIdForKanban.value);
  }
};

const loadSpkp = async (woId: number) => {
  spkpLoading.value = true;
  try {
    const res = await api.get(`/production/work-orders/${woId}/spkp`);
    spkpList.value = res.data.data || [];
  } catch { spkpList.value = []; }
  spkpLoading.value = false;
};

const onSpkpDragStart = (e: DragEvent, spkp: any) => {
  draggingSpkp.value = spkp;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(spkp.id));
  }
};

const onSpkpDragEnd = () => {
  draggingSpkp.value = null;
  spkpDragOverCol.value = null;
};

const onSpkpDrop = async (newStatus: string) => {
  spkpDragOverCol.value = null;
  if (!draggingSpkp.value || draggingSpkp.value.status === newStatus) {
    draggingSpkp.value = null;
    return;
  }
  const spkp = draggingSpkp.value;
  const oldStatus = spkp.status;
  spkp.status = newStatus;
  draggingSpkp.value = null;
  try {
    await api.put(`/production/spkp/${spkp.id}`, { status: newStatus });
  } catch {
    spkp.status = oldStatus;
    alert('Gagal update status');
  }
};

const addSpkpManual = async () => {
  if (!selectedWoIdForKanban.value || !spkpAddForm.value.schedule_date || !spkpAddForm.value.planned_qty) return;
  spkpLoading.value = true;
  try {
    await api.post(`/production/work-orders/${selectedWoIdForKanban.value}/spkp`, {
      schedule_date: spkpAddForm.value.schedule_date,
      planned_qty: spkpAddForm.value.planned_qty,
    });
    spkpAddForm.value = { schedule_date: '', planned_qty: 0 };
    showSpkpAddForm.value = false;
    await loadSpkp(selectedWoIdForKanban.value);
  } catch (e: any) {
    alert(e.response?.data?.error || 'Gagal tambah SPKP');
  }
  spkpLoading.value = false;
};

const generateSpkp = async () => {
  if (!selectedWoIdForKanban.value) return;
  spkpLoading.value = true;
  try {
    await api.post(`/production/work-orders/${selectedWoIdForKanban.value}/spkp/generate`);
    await loadSpkp(selectedWoIdForKanban.value);
  } catch (e: any) {
    alert(e.response?.data?.error || 'Gagal generate SPKP');
  }
  spkpLoading.value = false;
};

const doRegenSpkp = async () => {
  if (!selectedWoIdForKanban.value) return;
  showRegenConfirm.value = false;
  spkpLoading.value = true;
  try {
    await api.delete(`/production/work-orders/${selectedWoIdForKanban.value}/spkp`);
    await api.post(`/production/work-orders/${selectedWoIdForKanban.value}/spkp/generate`);
    await loadSpkp(selectedWoIdForKanban.value);
  } catch (e: any) {
    alert(e.response?.data?.error || 'Gagal regenerate');
  }
  spkpLoading.value = false;
};

const updateSpkpField = async (s: any, field: string, value: any) => {
  const old = s[field];
  if (String(old) === String(value)) return;
  s[field] = value;
  try {
    await api.put(`/production/spkp/${s.id}`, { [field]: value });
  } catch {
    s[field] = old;
    alert('Gagal update');
  }
};

const deleteSpkpItem = async (s: any) => {
  if (!confirm(`Hapus ${s.spkp_number}?`)) return;
  try {
    await api.delete(`/production/spkp/${s.id}`);
    spkpList.value = spkpList.value.filter(x => x.id !== s.id);
  } catch { alert('Gagal hapus'); }
};

const formatSpkpDay = (d: string) => {
  if (!d) return '';
  const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  return days[new Date(d).getDay()];
};

const getInitials = (name: string) => {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
};
</script>
