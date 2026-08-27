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
      <!-- Summary bar -->
      <div class="flex items-center gap-3 flex-wrap">
        <div class="flex items-center gap-3 text-sm">
          <span class="text-gray-500">Total SPKP: <b class="text-gray-800">{{ boardCards.length }}</b></span>
          <span class="text-gray-500">Planned: <b class="text-gray-800">{{ boardTotalPlanned.toLocaleString() }}</b></span>
          <span v-if="boardTotalActual > 0" class="text-gray-500">Actual: <b class="text-emerald-600">{{ boardTotalActual.toLocaleString() }}</b></span>
        </div>
        <div class="flex-1"></div>
        <div class="flex items-center gap-2">
          <input v-model="spkpSearch" type="text" placeholder="Cari SPKP, WO, product..."
            class="min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <select v-model="spkpSort" class="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            <option value="date">Tanggal</option>
            <option value="planned">Qty terbesar</option>
            <option value="number">Nomor SPKP</option>
          </select>
          <div class="flex rounded-lg border border-gray-300 overflow-hidden">
            <button @click="boardAxis = 'line'"
              :class="boardAxis === 'line' ? 'bg-teal-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
              class="px-3 py-2 text-sm transition-colors">per Line</button>
            <button @click="boardAxis = 'status'"
              :class="boardAxis === 'status' ? 'bg-teal-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
              class="px-3 py-2 text-sm transition-colors border-l border-gray-300">per Status</button>
          </div>
          <button @click="showSpkpStages = true" :disabled="boardAxis === 'line'"
            :title="boardAxis === 'line' ? 'Kolom line diatur di master Line Process' : 'Atur kolom status'"
            class="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Kolom
          </button>
        </div>
      </div>

      <!-- kanban loading -->
      <div v-if="boardLoading" class="py-16 text-center text-gray-400 text-sm">Memuat...</div>

      <!-- kanban empty -->
      <div v-else-if="boardCards.length === 0" class="py-16 text-center text-gray-400 text-sm">
        Belum ada SPKP dari WO aktif manapun
      </div>

      <!-- kanban board: columns follow the chosen axis -->
      <div v-else class="flex overflow-x-auto gap-4 pb-4">
        <div v-for="col in activeColumns" :key="col.key"
          class="flex-shrink-0 w-80 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col max-h-[calc(100vh-200px)] transition-all"
          :class="{ 'ring-2 ring-blue-400 bg-blue-50/30': spkpDragOverCol === col.key }"
          @dragover.prevent="spkpDragOverCol = col.key"
          @dragleave="spkpDragOverCol = null"
          @drop="onColumnDrop(col.key)">

          <!-- Column header -->
          <div class="p-4 border-b rounded-t-xl" :style="{ borderBottomColor: col.color, background: col.color + '10' }">
            <div class="flex justify-between items-center">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full" :style="{ background: col.color }"></span>
                <h3 class="font-semibold text-gray-800">{{ col.label }}</h3>
              </div>
              <span class="text-xs font-bold bg-white px-2.5 py-1 rounded-full text-gray-600 shadow-sm">
                {{ boardCardsByStatus(col.key).length }}
              </span>
            </div>
            <p class="text-xs text-gray-500 mt-1">
              <span v-if="col.sub" class="font-mono">{{ col.sub }}</span>
              <span v-if="col.sub"> · </span>
              Plan: <b>{{ columnPlannedTotal(col.key).toLocaleString() }}</b>
            </p>
            <p class="text-xs text-gray-500 mt-1">
              Plan: <b>{{ boardColPlanned(col.key).toLocaleString() }}</b>
              <span v-if="boardColActual(col.key) > 0"> · Act: <b class="text-emerald-600">{{ boardColActual(col.key).toLocaleString() }}</b></span>
            </p>
          </div>

          <!-- Cards -->
          <div class="flex-1 overflow-y-auto p-3 space-y-3 min-h-[80px]">
            <div v-for="c in cardsOfActiveColumn(col.key)" :key="c.id"
              draggable="true"
              @dragstart="onSpkpDragStart($event, c)"
              @dragend="onSpkpDragEnd"
              @click="openSpkpDetail(c)"
              class="bg-white rounded-lg shadow p-4 border-l-4 border border-gray-200 hover:shadow-lg transition-all cursor-pointer group relative"
              :class="{ 'opacity-40 scale-95': draggingSpkp?.id === c.id }"
              :style="{ borderLeftColor: col.color }">

              <!-- row 1: SPKP number + status badge -->
              <div class="flex justify-between items-start mb-2">
                <div class="min-w-0 flex-1">
                  <h3 class="text-base font-bold text-gray-900 leading-tight">{{ c.spkp_number }}</h3>
                  <p class="text-sm text-gray-600 truncate" :title="c.product_name">{{ c.product_name || '—' }} ({{ c.wo_number || '—' }})</p>
                  <p v-if="c.current_step_name" class="text-xs mt-1">
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">
                      {{ c.current_step_order }}. {{ c.current_step_name }}
                      <span v-if="c.current_step_is_qc" class="text-amber-600">· QC</span>
                    </span>
                  </p>
                </div>
              </div>

              <!-- row 2: stats grid -->
              <div class="grid grid-cols-3 gap-2 text-sm mb-2">
                <div>
                  <p class="text-gray-500 text-xs">Planned</p>
                  <p class="font-semibold">{{ Number(c.planned_qty || 0).toLocaleString() }}</p>
                </div>
                <div>
                  <p class="text-gray-500 text-xs">Actual</p>
                  <p v-if="Number(c.actual_qty) > 0" class="font-semibold text-emerald-700">{{ Number(c.actual_qty).toLocaleString() }}</p>
                  <p v-else class="text-gray-400">—</p>
                </div>
                <div>
                  <p class="text-gray-500 text-xs">Progress</p>
                  <div v-if="Number(c.actual_qty) > 0" class="flex items-center gap-1">
                    <div class="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div class="h-full bg-emerald-500 rounded-full"
                        :style="{ width: Math.min(100, (Number(c.actual_qty) / Number(c.planned_qty || 1)) * 100) + '%' }"></div>
                    </div>
                    <span class="text-xs font-semibold text-gray-600">{{ Math.round((Number(c.actual_qty) / Number(c.planned_qty || 1)) * 100) }}%</span>
                  </div>
                  <p v-else class="text-gray-400">0%</p>
                </div>
              </div>

              <!-- row 3: date -->
              <div class="text-xs text-gray-400 mb-2" :class="isSpkpLate(c) ? 'text-red-600 font-semibold' : ''">
                {{ formatSpkpDay(c.schedule_date) }} · {{ formatDate(c.schedule_date) }}
                <span v-if="isSpkpLate(c)" class="ml-1 px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-semibold">Late</span>
              </div>

              <!-- row 4: operator/supervisor -->
              <div v-if="c.operator_name || c.supervisor_name" class="flex items-center gap-2 text-[11px] text-gray-500 border-t border-gray-100 pt-2">
                <span v-if="c.operator_name" class="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">Op: {{ c.operator_name }}</span>
                <span v-if="c.supervisor_name" class="px-2 py-0.5 bg-purple-50 text-purple-700 rounded font-medium">Spv: {{ c.supervisor_name }}</span>
              </div>
            </div>

            <!-- Drop placeholder -->
            <div v-if="boardCardsByStatus(col.key).length === 0"
              class="text-center py-8 text-gray-400 text-xs italic border-2 border-dashed border-gray-200 rounded-lg">
              {{ draggingSpkp ? 'Drop here' : 'Kosong' }}
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

          <!-- where it is on the floor, and what it is doing there -->
          <div>
            <label class="block text-xs font-semibold text-gray-500 mb-1.5">Line</label>
            <select :value="spkpDetail.line_process_id ?? ''"
              @change="placeSpkp(spkpDetail, ($event.target as HTMLSelectElement).value === '' ? null : Number(($event.target as HTMLSelectElement).value))"
              class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-teal-300 focus:outline-none">
              <option value="">Belum di-line</option>
              <option v-for="ln in boardLines" :key="ln.id" :value="ln.id">{{ ln.code }} — {{ ln.name }}</option>
            </select>
          </div>

          <div v-if="spkpDetail.line_process_id">
            <label class="block text-xs font-semibold text-gray-500 mb-1.5">Sedang di step</label>
            <div class="space-y-1">
              <button v-for="st in stepsOfLine(Number(spkpDetail.line_process_id))" :key="st.id"
                @click="placeSpkp(spkpDetail, Number(spkpDetail.line_process_id), st.id)"
                class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm border transition-colors"
                :class="Number(spkpDetail.current_step_id) === st.id
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'">
                <span class="text-xs font-bold w-5 flex-shrink-0">{{ st.step_order }}.</span>
                <span class="flex-1 truncate">{{ st.process_name }}</span>
                <span v-if="st.is_qc_checkpoint" class="text-[10px] flex-shrink-0"
                  :class="Number(spkpDetail.current_step_id) === st.id ? 'text-teal-100' : 'text-amber-600'">QC</span>
                <span v-if="st.standard_duration_minutes" class="text-[10px] flex-shrink-0 opacity-70">
                  {{ st.standard_duration_minutes }}m
                </span>
              </button>
              <button v-if="spkpDetail.current_step_id"
                @click="placeSpkp(spkpDetail, Number(spkpDetail.line_process_id), null)"
                class="w-full px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
                Kosongkan step
              </button>
            </div>
            <!-- read the time on the step against the standard for it -->
            <p v-if="stepElapsed(spkpDetail)" class="text-[11px] mt-1.5"
              :class="stepElapsed(spkpDetail)?.over ? 'text-red-600 font-medium' : 'text-gray-500'">
              Sudah {{ stepElapsed(spkpDetail)?.mins }} menit
              <span v-if="stepElapsed(spkpDetail)?.std">dari standar {{ stepElapsed(spkpDetail)?.std }} menit</span>
              <span v-if="stepElapsed(spkpDetail)?.over"> — lewat standar</span>
            </p>
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

    <!-- Board columns — the Stage Manager the Leads pipeline has, for SPKP -->
    <div v-if="showSpkpStages" class="fixed inset-0 z-[70] flex items-center justify-center bg-black/50"
      @click.self="showSpkpStages = false">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div class="px-5 py-4 border-b flex justify-between items-center">
          <div>
            <h3 class="font-bold text-gray-900">Kolom Papan SPKP</h3>
            <p class="text-xs text-gray-500 mt-0.5">Ganti nama, warna, urutan, atau tambah kolom sendiri</p>
          </div>
          <button @click="showSpkpStages = false" class="text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
        </div>

        <div class="flex-1 overflow-y-auto p-5 space-y-2">
          <div v-for="(st, idx) in spkpStages" :key="st.id"
            class="flex items-center gap-2 p-2.5 border border-gray-200 rounded-lg">
            <div class="flex flex-col">
              <button @click="moveSpkpStage(idx, -1)" :disabled="idx === 0"
                class="text-xs leading-none disabled:opacity-20 hover:text-teal-600">&#9650;</button>
              <button @click="moveSpkpStage(idx, 1)" :disabled="idx === spkpStages.length - 1"
                class="text-xs leading-none disabled:opacity-20 hover:text-teal-600">&#9660;</button>
            </div>
            <input type="color" v-model="st.color" @change="saveSpkpStage(st)"
              class="w-8 h-8 rounded cursor-pointer border border-gray-200" />
            <input type="text" v-model="st.name" @blur="saveSpkpStage(st)"
              class="flex-1 px-3 py-1.5 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-teal-300 focus:outline-none" />
            <span class="text-[10px] text-gray-400 font-mono">{{ st.stage_key }}</span>
            <span v-if="st.is_system" class="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-500">bawaan</span>
            <button v-else @click="deleteSpkpStage(st)"
              class="text-gray-300 hover:text-red-500 text-lg leading-none px-1">&times;</button>
          </div>

          <div v-if="!spkpStages.length" class="text-center py-6 text-gray-400 text-sm">Belum ada kolom</div>

          <!-- add -->
          <div class="flex items-center gap-2 pt-3 mt-3 border-t">
            <input type="color" v-model="stageForm.color"
              class="w-8 h-8 rounded cursor-pointer border border-gray-200" />
            <input type="text" v-model="stageForm.name" placeholder="Nama kolom baru" @keyup.enter="addSpkpStage"
              class="flex-1 px-3 py-1.5 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-teal-300 focus:outline-none" />
            <button @click="addSpkpStage" :disabled="!stageForm.name.trim()"
              class="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-40">
              Tambah
            </button>
          </div>

          <div v-if="stageError" class="text-sm bg-red-50 border border-red-200 text-red-800 rounded-md px-3 py-2">
            {{ stageError }}
          </div>

          <p class="text-[11px] text-gray-400 pt-1">
            Mengganti nama kolom aman — kartu menempel pada kunci kolom, bukan namanya. Kolom yang
            masih berisi SPKP tidak bisa dihapus sampai isinya dipindahkan.
          </p>
        </div>

        <div class="px-5 py-4 border-t flex justify-end">
          <button @click="showSpkpStages = false"
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

onMounted(() => { store.fetchExecution(); fetchSpkpStages(); loadBoard(); });

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
// The board's columns come from the server so the plant can shape them. Falls back to the
// three built-in ones if the call fails, because a board with no columns shows nothing at all.
interface SpkpStage { id: number; stage_key: string; name: string; color: string; sort_order: number; is_system: number }
const spkpStages = ref<SpkpStage[]>([]);
const spkpKanbanCols = computed(() =>
  spkpStages.value.map(st => ({ key: st.stage_key, label: st.name, color: st.color }))
);

const fetchSpkpStages = async () => {
  try {
    const res = await api.get('/production/spkp-stages');
    spkpStages.value = res.data?.data || [];
  } catch {
    spkpStages.value = [
      { id: 0, stage_key: 'draft', name: 'Draft', color: '#9ca3af', sort_order: 0, is_system: 1 },
      { id: 0, stage_key: 'released', name: 'Released', color: '#3b82f6', sort_order: 1, is_system: 1 },
      { id: 0, stage_key: 'completed', name: 'Completed', color: '#22c55e', sort_order: 2, is_system: 1 },
    ];
  }
};

const showSpkpStages = ref(false);
const stageForm = ref({ name: '', color: '#8b5cf6' });
const stageError = ref('');

const addSpkpStage = async () => {
  stageError.value = '';
  if (!stageForm.value.name.trim()) return;
  try {
    await api.post('/production/spkp-stages', { name: stageForm.value.name.trim(), color: stageForm.value.color });
    stageForm.value = { name: '', color: '#8b5cf6' };
    await fetchSpkpStages();
  } catch (e: any) {
    stageError.value = e?.response?.data?.error || 'Kolom gagal ditambahkan.';
  }
};

const saveSpkpStage = async (st: SpkpStage) => {
  stageError.value = '';
  try {
    await api.put(`/production/spkp-stages/${st.id}`, { name: st.name, color: st.color });
    await fetchSpkpStages();
  } catch (e: any) {
    stageError.value = e?.response?.data?.error || 'Kolom gagal disimpan.';
  }
};

const moveSpkpStage = async (idx: number, direction: -1 | 1) => {
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= spkpStages.value.length) return;
  const arr = [...spkpStages.value];
  [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
  arr.forEach((st, i) => { st.sort_order = i; });
  spkpStages.value = arr;
  try {
    await api.put('/production/spkp-stages/reorder', { order: arr.map(st => ({ id: st.id, sort_order: st.sort_order })) });
  } catch (e: any) {
    stageError.value = e?.response?.data?.error || 'Urutan gagal disimpan.';
    await fetchSpkpStages();
  }
};

const deleteSpkpStage = async (st: SpkpStage) => {
  stageError.value = '';
  try {
    await api.delete(`/production/spkp-stages/${st.id}`);
    await fetchSpkpStages();
  } catch (e: any) {
    // the server refuses a column that still holds cards, and says how many
    stageError.value = e?.response?.data?.error || 'Kolom gagal dihapus.';
  }
};

// Board controls, matching the Leads pipeline: the same list/kanban switch, search, status
// filter and sort, so moving between the two screens does not mean learning a second set of
// habits. Filtering applies to both views, and to the column totals, so what is shown and what
// is counted never disagree.
const spkpSearch = ref('');
const spkpFilterStatus = ref('');
const spkpSort = ref<'date' | 'planned' | 'number'>('date');
const spkpDetail = ref<any>(null);

const isSpkpLate = (s: any) =>
  !!s.schedule_date &&
  String(s.schedule_date).slice(0, 10) < new Date().toISOString().slice(0, 10) &&
  s.status !== 'completed';

const spkpColColor = (status: string) =>
  spkpKanbanCols.value.find((c: any) => c.key === status)?.color || '#9ca3af';
// ---------------------------------------------------------------------------
// Floor board: one column per production line, every SPKP on it whatever work order it
// belongs to. That is why the card carries the WO number — the board is no longer scoped to
// one order, it shows what is on each tank right now.
// ---------------------------------------------------------------------------

interface BoardLine { id: number; code: string; name: string; step_count: number }
interface BoardStep {
  id: number; line_process_id: number; step_order: number; process_name: string;
  standard_duration_minutes: number | null; is_qc_checkpoint: number;
}

const boardLines = ref<BoardLine[]>([]);
const boardSteps = ref<BoardStep[]>([]);
const boardCards = ref<any[]>([]);
const boardLoading = ref(false);

// An SPKP with no line still has to be somewhere, or it would vanish from the board while
// staying in the database. It gets a column of its own, ahead of the real lines.
const UNASSIGNED = -1;
const boardColumns = computed(() => [
  { id: UNASSIGNED, code: '', name: 'Belum di-line', step_count: 0 },
  ...boardLines.value,
]);

const stepsOfLine = (lineId: number) =>
  boardSteps.value.filter(st => st.line_process_id === lineId);

const loadBoard = async () => {
  boardLoading.value = true;
  try {
    const res = await api.get('/production/spkp-board');
    boardLines.value = res.data?.data?.lines || [];
    boardSteps.value = res.data?.data?.steps || [];
    boardCards.value = res.data?.data?.cards || [];
  } catch {
    boardLines.value = [];
    boardSteps.value = [];
    boardCards.value = [];
  } finally {
    boardLoading.value = false;
  }
};

// search, status filter and sort apply to the floor board too, so the same habits carry over
const boardVisible = computed(() => {
  const q = spkpSearch.value.trim().toLowerCase();
  let out = boardCards.value.filter((c: any) => {
    if (spkpFilterStatus.value && c.status !== spkpFilterStatus.value) return false;
    if (!q) return true;
    return [c.spkp_number, c.wo_number, c.product_name, c.operator_name, c.notes, c.current_step_name]
      .some((f: any) => String(f || '').toLowerCase().includes(q));
  });
  out = [...out].sort((a: any, b: any) => {
    if (spkpSort.value === 'planned') return Number(b.planned_qty || 0) - Number(a.planned_qty || 0);
    if (spkpSort.value === 'number') return String(a.spkp_number || '').localeCompare(String(b.spkp_number || ''));
    return String(a.schedule_date || '').localeCompare(String(b.schedule_date || ''));
  });
  return out;
});

const cardsOfColumn = (lineId: number) =>
  boardVisible.value.filter((c: any) =>
    lineId === UNASSIGNED ? !c.line_process_id : Number(c.line_process_id) === lineId
  );

// status-based kanban helpers
const boardCardsByStatus = (statusKey: string) =>
  boardVisible.value.filter((c: any) => c.status === statusKey);

const boardTotalPlanned = computed(() =>
  boardCards.value.reduce((sum: number, c: any) => sum + Number(c.planned_qty || 0), 0));
const boardTotalActual = computed(() =>
  boardCards.value.reduce((sum: number, c: any) => sum + Number(c.actual_qty || 0), 0));

const boardColPlanned = (statusKey: string) =>
  boardCardsByStatus(statusKey).reduce((sum: number, c: any) => sum + Number(c.planned_qty || 0), 0);
const boardColActual = (statusKey: string) =>
  boardCardsByStatus(statusKey).reduce((sum: number, c: any) => sum + Number(c.actual_qty || 0), 0);

// The same cards, grouped two ways. Columns by line answer "what is on each tank right now";
// columns by status answer "how far along is each order". Both are real questions, so the board
// switches axis rather than picking one, and everything below dispatches on this.
const boardAxis = ref<'line' | 'status'>('line');

const activeColumns = computed(() =>
  boardAxis.value === 'line'
    ? boardColumns.value.map((c: any) => ({
        key: String(c.id), label: c.name, color: c.id === -1 ? '#9ca3af' : '#14b8a6',
        sub: c.code ? `${c.code}${c.step_count ? ` · ${c.step_count} step` : ''}` : '',
      }))
    : spkpKanbanCols.value.map((c: any) => ({ key: c.key, label: c.label, color: c.color, sub: '' }))
);

const cardsOfActiveColumn = (key: string) =>
  boardAxis.value === 'line' ? cardsOfColumn(Number(key)) : boardCardsByStatus(key);

const columnPlannedTotal = (key: string) =>
  cardsOfActiveColumn(key).reduce((sum: number, c: any) => sum + Number(c.planned_qty || 0), 0);

/** dropping a card means a different thing on each axis: move it, or advance it */
const onColumnDrop = async (key: string) => {
  if (boardAxis.value === 'line') return onBoardDrop(Number(key));
  return onStatusDrop(key);
};

const onStatusDrop = async (statusKey: string) => {
  const card = draggingSpkp.value;
  spkpDragOverCol.value = null;
  draggingSpkp.value = null;
  if (!card || card.status === statusKey) return;
  try {
    await api.put(`/production/spkp/${card.id}`, { status: statusKey });
    await loadBoard();
  } catch (e: any) {
    stageError.value = e?.response?.data?.error || 'Gagal ubah status.';
  }
};


/** move a card onto a line, or along the steps of the line it is already on */
const placeSpkp = async (card: any, lineId: number | null, stepId?: number | null) => {
  const payload: any = { line_process_id: lineId === UNASSIGNED ? null : lineId };
  if (stepId !== undefined) payload.current_step_id = stepId;
  try {
    await api.put(`/production/spkp/${card.id}/placement`, payload);
    await loadBoard();
    if (spkpDetail.value?.id === card.id) {
      spkpDetail.value = boardCards.value.find((c: any) => c.id === card.id) || null;
    }
  } catch (e: any) {
    stageError.value = e?.response?.data?.error || 'Kartu gagal dipindahkan.';
  }
};

const onBoardDrop = async (lineId: number) => {
  const card = draggingSpkp.value;
  spkpDragOverCol.value = null;
  draggingSpkp.value = null;
  if (!card) return;
  const current = card.line_process_id ?? UNASSIGNED;
  if (Number(current) === Number(lineId)) return;
  await placeSpkp(card, lineId);
};

/** how long the card has been on its current step, against the standard for that step */
const stepElapsed = (card: any) => {
  if (!card.step_started_at) return null;
  const mins = Math.floor((Date.now() - new Date(card.step_started_at).getTime()) / 60000);
  const std = Number(card.current_step_minutes || 0);
  return { mins, std, over: std > 0 && mins > std };
};

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
</script>
