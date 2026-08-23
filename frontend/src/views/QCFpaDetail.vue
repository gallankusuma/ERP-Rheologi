<template>
  <div class="space-y-4 max-w-[1600px] mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <button @click="$router.push('/qc/fpa')" class="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 flex items-center gap-1">← Back</button>
        <h1 class="text-xl font-bold text-teal-700">LP On Process</h1>
      </div>
      <div class="flex gap-2">
        <button @click="printFPA" class="px-3 py-1.5 bg-cyan-600 text-white rounded-lg text-xs hover:bg-cyan-700">🖨️ Print FPA</button>
        <button class="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs hover:bg-teal-700" @click="saveGeneral">💾 Save Changes</button>
      </div>
    </div>

    <div v-if="loading" class="text-center py-10 text-gray-500">Loading...</div>

    <template v-if="!loading && fpa.id">
      <!-- General Information — 2-column grid like screenshot -->
      <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div class="p-4 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2">
          <div class="flex items-center gap-1">
            <label class="text-xs text-gray-500 w-24 shrink-0">No Bukti</label>
            <input :value="fpa.fpa_number" readonly class="flex-1 px-2 py-1 border rounded text-sm bg-gray-50 font-semibold" />
          </div>
          <div class="flex items-center gap-1">
            <label class="text-xs text-gray-500 w-24 shrink-0">Date</label>
            <input :value="formatDate(fpa.created_at)" readonly class="flex-1 px-2 py-1 border rounded text-sm bg-gray-50" />
          </div>
          <div class="flex items-center gap-1">
            <label class="text-xs text-gray-500 w-24 shrink-0">Jenis Ref</label>
            <select v-model="fpa.type" class="flex-1 px-2 py-1 border rounded text-sm">
              <option value="LP">LP</option>
              <option value="INC">Incoming</option>
            </select>
          </div>
          <div class="flex items-center gap-1">
            <label class="text-xs text-gray-500 w-24 shrink-0">WO No.</label>
            <input :value="fpa.wo_number || fpa.reference_number || ''" readonly class="flex-1 px-2 py-1 border rounded text-sm bg-gray-50" />
          </div>
          <div class="flex items-center gap-1">
            <label class="text-xs text-gray-500 w-24 shrink-0">No LP</label>
            <input :value="fpa.fpa_number" readonly class="flex-1 px-2 py-1 border rounded text-sm bg-gray-50" />
          </div>
          <div class="flex items-center gap-1">
            <label class="text-xs text-gray-500 w-24 shrink-0">No Item Code</label>
            <input :value="fpa.product_sku || ''" readonly class="flex-1 px-2 py-1 border rounded text-sm bg-gray-50" />
          </div>
          <div class="flex items-center gap-1">
            <label class="text-xs text-gray-500 w-24 shrink-0">Item Name</label>
            <input :value="fpa.product_name" readonly class="flex-1 px-2 py-1 border rounded text-sm bg-gray-50 font-medium" />
          </div>
          <div class="flex items-center gap-1">
            <label class="text-xs text-gray-500 w-24 shrink-0">Qty LP</label>
            <input :value="formatN(fpa.quantity)" readonly class="flex-1 px-2 py-1 border rounded text-sm bg-gray-50" />
          </div>
          <div class="flex items-center gap-1">
            <label class="text-xs text-gray-500 w-24 shrink-0">Batch No.</label>
            <input :value="fpa.batch_no || ''" readonly class="flex-1 px-2 py-1 border rounded text-sm bg-gray-50 font-bold text-purple-700" />
          </div>
          <div class="flex items-center gap-1">
            <label class="text-xs text-gray-500 w-24 shrink-0">Jenis Proses</label>
            <select v-model="fpa.process_type" class="flex-1 px-2 py-1 border rounded text-sm">
              <option value="">— Select —</option>
              <option value="Formulasi Liquid">Formulasi Liquid</option>
              <option value="Formulasi Powder">Formulasi Powder</option>
              <option value="Packing">Packing</option>
            </select>
          </div>
          <div class="flex items-center gap-1">
            <label class="text-xs text-gray-500 w-24 shrink-0">Jenis Sample</label>
            <select v-model="fpa.sample_type" class="flex-1 px-2 py-1 border rounded text-sm">
              <option value="">— Select —</option>
              <option value="Raw Material">Raw Material</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Intermediate Finished Goods">Intermediate Finished Goods</option>
              <option value="Finished Goods">Finished Goods</option>
              <option value="Packaging">Packaging</option>
            </select>
          </div>
          <div class="flex items-center gap-1">
            <label class="text-xs text-gray-500 w-24 shrink-0">Tanggal Proses</label>
            <input :value="formatDate(fpa.process_date || fpa.created_at)" readonly class="flex-1 px-2 py-1 border rounded text-sm bg-gray-50" />
          </div>
          <div class="flex items-center gap-1">
            <label class="text-xs text-gray-500 w-24 shrink-0">Area Sampling</label>
            <input :value="fpa.area_name || ''" readonly class="flex-1 px-2 py-1 border rounded text-sm bg-gray-50" />
          </div>
          <div class="flex items-center gap-1">
            <label class="text-xs text-gray-500 w-24 shrink-0">Qty Sampling</label>
            <input v-model.number="fpa.sampling_qty" type="number" step="0.01" class="w-20 px-2 py-1 border rounded text-sm" />
            <select v-model="fpa.sampling_unit" class="w-16 px-1 py-1 border rounded text-sm">
              <option value="ltr">ltr</option>
              <option value="Kgs">Kgs</option>
              <option value="g">g</option>
              <option value="mL">mL</option>
            </select>
          </div>
          <div class="flex items-center gap-1">
            <label class="text-xs text-gray-500 w-24 shrink-0">Unit</label>
            <input :value="fpa.sampling_unit || 'ltr'" readonly class="flex-1 px-2 py-1 border rounded text-sm bg-gray-50" />
          </div>
        </div>
        <div class="px-4 pb-3 flex items-center gap-4">
          <div class="flex items-center gap-2">
            <label class="text-xs font-semibold text-gray-600">Status</label>
            <span class="px-2 py-0.5 rounded-full text-xs font-bold" :class="statusColor(fpa.status)">{{ fpa.status }}</span>
          </div>
          <div class="flex items-center gap-2">
            <label class="text-xs font-semibold text-gray-600">Finish</label>
            <span class="text-sm" :class="fpa.data_complete ? 'text-green-600 font-bold' : 'text-gray-400'">{{ fpa.data_complete ? 'Yes' : 'No' }}</span>
          </div>
        </div>
        <!-- Disposition Panel (show when failed/rejected) -->
        <div v-if="(fpa.result === 'Failed' || fpa.status === 'Rejected') && !isDisposed" class="px-4 pb-3">
          <div class="bg-red-50 border border-red-200 rounded-lg p-3">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-sm font-bold text-red-700">⚠️ QC Failed — Select Disposition</span>
            </div>
            <div class="flex gap-2 flex-wrap">
              <button @click="applyDisposition('rework')" class="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-bold hover:bg-orange-600">🔧 Rework</button>
              <button @click="applyDisposition('use_as_is')" class="px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-xs font-bold hover:bg-yellow-600">✅ Use As Is</button>
              <button @click="applyDisposition('reject_vendor')" class="px-3 py-1.5 bg-purple-500 text-white rounded-lg text-xs font-bold hover:bg-purple-600">📦 Vendor Claim</button>
              <button @click="applyDisposition('disposal')" class="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700">🗑️ Disposal</button>
            </div>
            <input v-model="dispositionNotes" placeholder="Disposition notes (optional)" class="mt-2 w-full px-3 py-1.5 border rounded text-sm" />
          </div>
        </div>
        <div v-if="fpa.disposition && fpa.disposition !== 'Pending'" class="px-4 pb-3">
          <div class="bg-gray-50 border rounded-lg p-3 flex items-center gap-3">
            <span class="text-xs font-bold text-gray-500">Disposition:</span>
            <span class="px-2 py-0.5 rounded text-xs font-bold" :class="dispositionColor(fpa.disposition)">{{ fpa.disposition }}</span>
          </div>
        </div>
      </div>

      <!-- Status Filter Tabs -->
      <div class="flex gap-2 flex-wrap">
        <button v-for="f in statusFilters" :key="f.id" @click="activeFilter = f.id"
          class="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
          :class="activeFilter === f.id ? f.active : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'">
          {{ f.icon }} {{ f.label }}
        </button>
      </div>

      <!-- Main Table — Sampling Points (FPA Runs) -->
      <div class="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="bg-gray-100 border-b">
                <th class="px-2 py-2 text-left w-8">No</th>
                <th class="px-2 py-2 text-left w-20">Action</th>
                <th class="px-2 py-2 text-left min-w-[110px]">No FPA</th>
                <th class="px-2 py-2 text-center w-20">Status FPA</th>
                <th class="px-2 py-2 text-center w-16">Resampling</th>
                <th class="px-2 py-2 text-center w-20">Sampling Ke</th>
                <th class="px-2 py-2 text-left min-w-[100px]">DOC Spesifikasi</th>
                <th class="px-2 py-2 text-left min-w-[120px]">Keterangan</th>
                <th class="px-2 py-2 text-center min-w-[110px]">Approve #1</th>
                <th class="px-2 py-2 text-center min-w-[110px]">Approve #2</th>
                <th class="px-2 py-2 text-center w-14">Finish</th>
                <th class="px-2 py-2 text-left min-w-[100px]">Catatan Analisa</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="(sp, idx) in filteredPoints" :key="sp.id">
                <!-- Sampling Point Row -->
                <tr class="border-b hover:bg-blue-50/30 cursor-pointer" @click="toggleExpand(sp.id)">
                  <td class="px-2 py-2 font-bold">{{ idx + 1 }}</td>
                  <td class="px-2 py-2">
                    <div class="flex items-center gap-1">
                      <button class="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded hover:bg-blue-100" @click.stop="toggleExpand(sp.id)">
                        {{ expandedIds.has(sp.id) ? '▼' : '▶' }}
                      </button>
                      <button v-if="sp.status === 'Pending'" @click.stop="receiveSample(sp.id)" class="text-[10px] text-white bg-blue-500 px-1.5 py-0.5 rounded hover:bg-blue-600">📥</button>
                      <button v-if="canApproveSp1(sp)" @click.stop="approveSp(sp.id, 1)" class="text-[10px] text-white bg-emerald-500 px-1.5 py-0.5 rounded hover:bg-emerald-600" title="Approve #1">✅1</button>
                      <button v-if="canApproveSp2(sp)" @click.stop="approveSp(sp.id, 2)" class="text-[10px] text-white bg-green-600 px-1.5 py-0.5 rounded hover:bg-green-700" title="Approve #2">✅2</button>
                    </div>
                  </td>
                  <td class="px-2 py-2">
                    <div class="font-bold text-gray-800">{{ sp.fpa_number }}</div>
                    <div class="text-[10px] text-gray-400">{{ formatDate(sp.approved_at_1 || '') }}</div>
                  </td>
                  <td class="px-2 py-2 text-center">
                    <span class="px-1.5 py-0.5 rounded-full text-[10px] font-bold" :class="statusColor(sp.status)">{{ sp.status }}</span>
                  </td>
                  <td class="px-2 py-2 text-center">
                    <span :class="sp.needs_resampling ? 'text-orange-600 font-bold' : 'text-gray-400'">{{ sp.needs_resampling ? 'Yes' : 'No' }}</span>
                  </td>
                  <td class="px-2 py-2 text-center">
                    <span v-if="sp.needs_resampling" class="text-orange-600">Perlu Resampling</span>
                    <span v-else>Resampling Ke {{ sp.sampling_run }}</span>
                  </td>
                  <td class="px-2 py-2 text-gray-600">{{ sp.specification_doc || fpa.specification_doc || '—' }}</td>
                  <td class="px-2 py-2">
                    <!-- Alert badges for approval status -->
                    <div v-if="!sp.approved_by_1" class="text-[10px] text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-1 py-0.5 mb-0.5">NOT YET APPROVE #1</div>
                    <div v-if="!sp.approved_by_2" class="text-[10px] text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-1 py-0.5">NOT YET APPROVE #2</div>
                  </td>
                  <td class="px-2 py-2 text-center">
                    <span v-if="sp.approver1_name" class="text-green-700 font-bold text-[10px]">{{ sp.approver1_name }}</span>
                    <span v-else class="text-gray-300">—</span>
                  </td>
                  <td class="px-2 py-2 text-center">
                    <span v-if="sp.approver2_name" class="text-green-700 font-bold text-[10px]">{{ sp.approver2_name }}</span>
                    <span v-else class="text-gray-300">—</span>
                  </td>
                  <td class="px-2 py-2 text-center">
                    <span :class="sp.data_complete ? 'text-green-600 font-bold' : 'text-gray-400'">{{ sp.data_complete ? 'Yes' : 'No' }}</span>
                  </td>
                  <td class="px-2 py-2">
                    <div class="flex items-center gap-1">
                      <span class="text-gray-600 truncate max-w-[80px]">{{ sp.analysis_notes || '' }}</span>
                      <button v-if="sp.status === 'Approved'" @click.stop="printCOA(sp)" class="text-[10px] text-white bg-teal-600 px-1.5 py-0.5 rounded hover:bg-teal-700 whitespace-nowrap">Print COA</button>
                      <button @click.stop="showCOA(sp)" class="text-[10px] text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded hover:bg-teal-100 whitespace-nowrap">Show on COA</button>
                    </div>
                  </td>
                </tr>

                <!-- Expanded: Parameter Sub-table -->
                <tr v-if="expandedIds.has(sp.id)" :key="'detail-' + sp.id">
                  <td colspan="12" class="p-0">
                    <div class="bg-gray-50 border-t border-b-2 border-blue-200">
                      <table class="w-full text-xs">
                        <thead>
                          <tr class="bg-blue-50/70">
                            <th class="px-2 py-1.5 text-left w-8">#</th>
                            <th class="px-2 py-1.5 text-left min-w-[160px]">Parameter</th>
                            <th class="px-2 py-1.5 text-center w-16">Spek</th>
                            <th class="px-2 py-1.5 text-center w-16">Saplo</th>
                            <th class="px-2 py-1.5 text-center w-16">Duplo</th>
                            <th class="px-2 py-1.5 text-center w-20">Hasil / Satuan</th>
                            <th class="px-2 py-1.5 text-left min-w-[100px]">Keterangan</th>
                            <th class="px-2 py-1.5 text-center w-16">Sesuai Spek</th>
                            <th class="px-2 py-1.5 text-left min-w-[120px]">Nama Alat</th>
                            <th class="px-2 py-1.5 text-left min-w-[100px]">Nama Analis</th>
                            <th class="px-2 py-1.5 text-center w-16">Print COA</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="(r, rIdx) in sp.results" :key="r.id" class="border-b border-gray-200 hover:bg-white/60"
                            :class="r.is_pass === 0 ? 'bg-red-50/50' : r.is_pass === 1 ? 'bg-green-50/30' : ''">
                            <td class="px-2 py-1 text-gray-400">{{ rIdx + 1 }}</td>
                            <td class="px-2 py-1">
                              <div class="font-semibold text-gray-800">{{ r.parameter_code || '' }} - {{ r.parameter_name }}</div>
                            </td>
                            <td class="px-2 py-1 text-center text-gray-600">
                              <template v-if="r.min_value != null && r.max_value != null">{{ r.min_value }} - {{ r.max_value }}</template>
                              <template v-else-if="r.standard_value">{{ r.standard_value }}</template>
                              <template v-else>—</template>
                            </td>
                            <!-- Saplo -->
                            <td class="px-1 py-1">
                              <template v-if="r.param_type !== 'qualitative'">
                                <input v-model.number="r.saplo" type="number" step="0.01" :disabled="!canEditSp(sp)"
                                  class="w-full px-1 py-0.5 border rounded text-center text-xs disabled:bg-gray-100" @input="autoCalcHasil(r)" />
                              </template>
                              <template v-else><span class="text-gray-300 block text-center">—</span></template>
                            </td>
                            <!-- Duplo -->
                            <td class="px-1 py-1">
                              <template v-if="r.param_type !== 'qualitative'">
                                <input v-model.number="r.duplo" type="number" step="0.01" :disabled="!canEditSp(sp)"
                                  class="w-full px-1 py-0.5 border rounded text-center text-xs disabled:bg-gray-100" @input="autoCalcHasil(r)" />
                              </template>
                              <template v-else><span class="text-gray-300 block text-center">—</span></template>
                            </td>
                            <!-- Hasil -->
                            <td class="px-1 py-1 text-center">
                              <template v-if="r.param_type === 'qualitative'">
                                <select v-model="r.actual_value" :disabled="!canEditSp(sp)" class="w-full px-1 py-0.5 border rounded text-xs disabled:bg-gray-100">
                                  <option value="">—</option><option value="Sesuai Spek">Sesuai Spek</option><option value="Tidak Sesuai">Tidak Sesuai</option>
                                </select>
                              </template>
                              <template v-else>
                                <span class="font-bold" :class="r.actual_value ? 'text-gray-800' : 'text-gray-300'">{{ r.actual_value || '—' }}</span>
                                <span class="text-gray-400 ml-0.5">{{ r.uom || '' }}</span>
                              </template>
                            </td>
                            <!-- Keterangan -->
                            <td class="px-1 py-1">
                              <input v-model="r.notes" :disabled="!canEditSp(sp)" class="w-full px-1 py-0.5 border rounded text-xs disabled:bg-gray-100" />
                            </td>
                            <!-- Sesuai Spek -->
                            <td class="px-1 py-1 text-center">
                              <span v-if="r.is_pass === 1" class="text-green-600 font-bold">✅Spek</span>
                              <span v-else-if="r.is_pass === 0" class="text-red-600 font-bold">❌BSS</span>
                              <span v-else class="text-gray-300">—</span>
                            </td>
                            <!-- Nama Alat -->
                            <td class="px-1 py-1">
                              <select v-model="r.instrument_id" :disabled="!canEditSp(sp)" class="w-full px-1 py-0.5 border rounded text-xs disabled:bg-gray-100">
                                <option :value="null">—</option>
                                <option v-for="inst in fpa.instruments" :key="inst.id" :value="inst.id">{{ inst.name }}</option>
                              </select>
                            </td>
                            <!-- Nama Analis -->
                            <td class="px-1 py-1">
                              <select v-model="r.analyst_id" :disabled="!canEditSp(sp)" class="w-full px-1 py-0.5 border rounded text-xs disabled:bg-gray-100">
                                <option :value="null">—</option>
                                <option v-for="an in fpa.analysts" :key="an.id" :value="an.id">{{ an.name }}</option>
                              </select>
                            </td>
                            <!-- Show on COA toggle -->
                            <td class="px-1 py-1 text-center">
                              <button @click="r._showCoa = !r._showCoa" class="text-[10px] px-1.5 py-0.5 rounded"
                                :class="r._showCoa !== false ? 'bg-teal-100 text-teal-700 font-bold' : 'bg-gray-100 text-gray-400'">
                                {{ r._showCoa !== false ? '✅ Show' : '— Hide' }}
                              </button>
                            </td>
                          </tr>
                          <tr v-if="!sp.results?.length">
                            <td colspan="11" class="text-center py-3 text-gray-400">No parameters</td>
                          </tr>
                        </tbody>
                      </table>
                      <!-- Save button per sampling point -->
                      <div class="px-3 py-2 flex items-center gap-2 border-t bg-white/60">
                        <button v-if="canEditSp(sp)" @click="saveSpResults(sp)"
                          class="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700">
                          💾 Save Parameters
                        </button>
                        <button v-if="canEditSp(sp)" @click="createResample(sp.id)"
                          class="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-bold hover:bg-orange-600">
                          🔄 Resampling
                        </button>
                        <span class="text-[10px] text-gray-400 ml-auto">FPA: {{ sp.fpa_number }} | Run #{{ sp.sampling_run }}</span>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
              <tr v-if="!filteredPoints.length">
                <td colspan="12" class="text-center py-6 text-gray-400">No sampling points found for this filter</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <!-- Log History -->
      <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mt-4">
        <button @click="showAuditLog = !showAuditLog" class="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition">
          <span class="font-semibold text-sm text-gray-700">📜 Log History</span>
          <span class="text-xs text-gray-400">{{ auditLogs.length }} events {{ showAuditLog ? '▲' : '▼' }}</span>
        </button>
        <div v-if="showAuditLog" class="p-4">
          <div v-if="!auditLogs.length" class="text-center py-4 text-gray-400 text-sm">No events recorded yet</div>
          <div v-else class="space-y-2">
            <div v-for="log in auditLogs" :key="log.id" class="flex items-start gap-3 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
              <span class="text-lg">{{ eventIcon(log.event_type) }}</span>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-sm text-gray-800">{{ eventLabel(log.event_type) }}</span>
                  <span class="text-xs text-gray-400">{{ formatDate(log.created_at) }}</span>
                </div>
                <div class="text-xs text-gray-500">by {{ log.actor_name || 'System' }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../lib/api';

const route = useRoute();
const loading = ref(true);
const fpa = ref<any>({});
const expandedIds = ref(new Set<number>());
const activeFilter = ref('all');

const fpaId = computed(() => route.params.id);

const statusFilters = [
  { id: 'all', label: 'Semua', icon: '📋', active: 'bg-gray-700 text-white border-gray-700' },
  { id: 'Pending', label: 'Sampel Belum Diterima', icon: '🟡', active: 'bg-yellow-500 text-white border-yellow-500' },
  { id: 'Sample Diterima', label: 'Sampel Diterima', icon: '🔵', active: 'bg-blue-500 text-white border-blue-500' },
  { id: 'On Progress', label: 'On Progress', icon: '🟠', active: 'bg-orange-500 text-white border-orange-500' },
  { id: 'Approved', label: 'Approved', icon: '🟢', active: 'bg-green-600 text-white border-green-600' },
  { id: 'Rejected', label: 'BS', icon: '🔴', active: 'bg-red-500 text-white border-red-500' },
  { id: 'Resampling', label: 'BS(Resampling)', icon: '🟣', active: 'bg-purple-500 text-white border-purple-500' },
];

const filteredPoints = computed(() => {
  const pts = fpa.value.samplingPoints || [];
  if (activeFilter.value === 'all') return pts;
  return pts.filter((sp: any) => sp.status === activeFilter.value);
});

const canEditSp = (sp: any) => sp.status && sp.status !== 'Approved' && sp.status !== 'Rejected' && sp.status !== 'Pending';
const canApproveSp1 = (sp: any) => sp.data_complete && !sp.approved_by_1 && sp.status !== 'Pending' && sp.status !== 'Approved' && sp.status !== 'Rejected';
const canApproveSp2 = (sp: any) => !!sp.approved_by_1 && !sp.approved_by_2 && sp.status !== 'Approved' && sp.status !== 'Rejected';

const toggleExpand = (id: number) => {
  const s = new Set(expandedIds.value);
  s.has(id) ? s.delete(id) : s.add(id);
  expandedIds.value = s;
};

const autoCalcHasil = (r: any) => {
  if (r.param_type === 'qualitative') return;
  const s = Number(r.saplo), d = Number(r.duplo);
  if (!isNaN(s) && !isNaN(d) && (s > 0 || d > 0)) {
    const avg = Math.round(((s + d) / 2) * 100) / 100;
    r.actual_value = String(avg);
    if (r.min_value != null && r.max_value != null) {
      r.is_pass = (avg >= r.min_value && avg <= r.max_value) ? 1 : 0;
    }
  }
};

const loadFpa = async () => {
  loading.value = true;
  try {
    const { data } = await api.get(`/qc/fpa/${fpaId.value}`);
    if (data.success) {
      fpa.value = data.data;
      // Auto-expand the first sampling point
      if (data.data.samplingPoints?.length) {
        expandedIds.value = new Set([data.data.samplingPoints[0].id]);
      }
    }
  } catch (e) { console.error(e); }
  finally { loading.value = false; }
};

const saveGeneral = async () => {
  try {
    await api.put(`/qc/fpa/${fpaId.value}/general`, {
      sampling_qty: fpa.value.sampling_qty,
      sampling_unit: fpa.value.sampling_unit,
      sampling_point: fpa.value.sampling_point,
      process_type: fpa.value.process_type,
      sample_type: fpa.value.sample_type,
      specification_doc: fpa.value.specification_doc,
    });
    alert('✅ General info saved');
  } catch { alert('Failed to save'); }
};

const saveSpResults = async (sp: any) => {
  try {
    const results = (sp.results || []).map((r: any) => ({
      id: r.id,
      instrument_id: r.instrument_id || null,
      actual_value: r.actual_value || null,
      saplo: r.saplo ?? null,
      duplo: r.duplo ?? null,
      analyst_id: r.analyst_id || null,
      notes: r.notes || null,
      is_pass: r.is_pass,
    }));
    await api.put(`/qc/fpa/${sp.id}/results`, {
      results,
      status: 'On Progress',
      analysis_notes: sp.analysis_notes,
      data_complete: sp.data_complete,
    });
    alert('✅ Parameters saved');
    await loadFpa();
  } catch { alert('Failed to save'); }
};

const receiveSample = async (id: number) => {
  try {
    await api.put(`/qc/fpa/${id}/receive-sample`);
    alert('✅ Sample received');
    await loadFpa();
  } catch { alert('Failed'); }
};

const approveSp = async (id: number, level: number) => {
  if (!confirm(`Approve #${level}?`)) return;
  try {
    await api.put(`/qc/fpa/${id}/approve-${level}`);
    alert(`✅ Approve #${level} completed`);
    await loadFpa();
  } catch { alert('Failed'); }
};

const createResample = async (id: number) => {
  if (!confirm('Create new resampling run?')) return;
  try {
    const { data } = await api.post(`/qc/fpa/${id}/new-run`);
    if (data.success) {
      alert(`✅ ${data.message}`);
      await loadFpa();
    }
  } catch { alert('Failed'); }
};

const printFPA = () => window.print();
const printCOA = (sp: any) => { alert(`Print COA for ${sp.fpa_number}`); };
const showCOA = (sp: any) => { alert(`Show on COA: ${sp.fpa_number}`); };

// disposition
const dispositionNotes = ref('');
const isDisposed = computed(() => fpa.value.disposition && fpa.value.disposition !== 'Pending');

const applyDisposition = async (action: string) => {
  const labels: Record<string, string> = { rework: 'Rework', use_as_is: 'Use As Is', reject_vendor: 'Vendor Claim', disposal: 'Disposal' };
  if (!confirm(`Apply disposition "${labels[action]}"? This action cannot be undone.`)) return;
  try {
    const { data } = await api.put(`/qc/fpa/${fpaId.value}/disposition`, {
      action,
      notes: dispositionNotes.value
    });
    if (data.success) {
      alert(`Disposition "${labels[action]}" applied.${data.ncr_id ? ' NCR #' + data.ncr_id + ' created.' : ''}${data.rework_id ? ' Rework #' + data.rework_id + ' created.' : ''}`);
      await loadFpa();
      loadAuditLog();
    }
  } catch (e: any) {
    alert(e.response?.data?.error || 'Failed to apply disposition');
  }
};

const dispositionColor = (d: string) => ({
  'Rework': 'bg-orange-100 text-orange-700',
  'Use As Is': 'bg-yellow-100 text-yellow-700',
  'Vendor Claim': 'bg-purple-100 text-purple-700',
  'Disposal': 'bg-red-100 text-red-700',
}[d] || 'bg-gray-100 text-gray-600');

const statusColor = (s: string) => ({
  'Pending': 'bg-yellow-100 text-yellow-700',
  'Sample Diterima': 'bg-blue-100 text-blue-700',
  'On Progress': 'bg-orange-100 text-orange-700',
  'Approved': 'bg-green-100 text-green-700',
  'Rejected': 'bg-red-100 text-red-700',
  'Resampling': 'bg-purple-100 text-purple-700',
  'Review': 'bg-cyan-100 text-cyan-700',
}[s] || 'bg-gray-100 text-gray-600');

const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const formatN = (n: any) => { const v = Number(n); return isNaN(v) ? '—' : v.toLocaleString('id-ID', { maximumFractionDigits: 2 }); };

const showAuditLog = ref(false);
const auditLogs = ref<any[]>([]);

const loadAuditLog = async () => {
  try {
    const { data } = await api.get(`/qc/fpa/${fpaId.value}/audit-log`);
    if (data.success) auditLogs.value = data.data;
  } catch { /* silent */ }
};

const eventIcon = (t: string) => ({
  fpa_created: '📋', sample_received: '📦', results_saved: '🔬',
  data_complete: '✅', approve_l1: '👤', approve_l2: '👥',
  rejected: '❌', resampled: '🔄', disposition: '⚖️', status_changed: '🔃',
}[t] || '📝');

const eventLabel = (t: string) => ({
  fpa_created: 'FPA Created', sample_received: 'Sample Received', results_saved: 'Results Saved',
  data_complete: 'Data Complete', approve_l1: 'Approve #1', approve_l2: 'Approve #2',
  rejected: 'Rejected', resampled: 'Resampled', disposition: 'Disposition', status_changed: 'Status Changed',
}[t] || t);

onMounted(() => { loadFpa(); loadAuditLog(); });
watch(fpaId, () => { loadFpa(); loadAuditLog(); });
</script>
