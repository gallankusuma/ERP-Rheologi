<template>
  <div class="min-h-screen bg-gray-50">
    <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Production Execution</h2>
          <p class="text-sm text-gray-500 mt-1">Real-time work order tracking with QC checkpoints</p>
        </div>
      </div>

      <div v-if="store.loading" class="text-center py-10">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>

      <!-- WO Cards -->
      <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                  ⚙️ {{ wo.line_process_name }}
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
            <!-- QC Status Badge -->
            <div>
              <p class="text-gray-500">QC</p>
              <div v-if="wo.qc_total > 0">
                <span v-if="wo.qc_pending_mandatory === 0"
                  class="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                  🟢 {{ wo.qc_passed }}/{{ wo.qc_total }}
                </span>
                <span v-else
                  class="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full animate-pulse">
                  🔴 {{ wo.qc_passed }}/{{ wo.qc_total }}
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
            <!-- Released: only Start button -->
            <template v-if="isStartable(wo.status)">
              <button @click="doAction('start', wo.id)" class="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 font-semibold">
                ▶ Start Production
              </button>
              <span class="text-xs text-gray-400 italic self-center">Start WO to enable Process Logs & QC</span>
            </template>

            <!-- In Progress -->
            <template v-else-if="wo.status === 'in_progress' || wo.status === 'IN_PROGRESS'">
              <button @click="doAction('pause', wo.id)" class="px-3 py-1.5 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700">
                ⏸ Pause
              </button>
              <button @click="doAction('complete', wo.id)"
                :disabled="wo.qc_pending_mandatory > 0"
                :title="wo.qc_pending_mandatory > 0 ? `Cannot complete: ${wo.qc_pending_mandatory} mandatory QC checkpoint(s) pending` : 'Complete this work order'"
                class="px-3 py-1.5 text-white text-xs rounded transition-all"
                :class="wo.qc_pending_mandatory > 0 ? 'bg-gray-400 cursor-not-allowed opacity-60' : 'bg-indigo-600 hover:bg-indigo-700'">
                {{ wo.qc_pending_mandatory > 0 ? '🔒 QC Pending' : '✓ Complete' }}
              </button>
              <button @click="openLogs(wo)" class="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300">
                📋 Process Logs
              </button>
              <button @click="openQCPanel(wo)" class="px-3 py-1.5 bg-purple-100 text-purple-700 text-xs rounded hover:bg-purple-200 font-medium">
                🧪 QC Checkpoints
              </button>
            </template>

            <!-- On Hold -->
            <template v-else-if="wo.status === 'on_hold'">
              <button @click="doAction('resume', wo.id)" class="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                ▶ Resume
              </button>
              <button @click="openLogs(wo)" class="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300">
                📋 Process Logs
              </button>
              <button @click="openQCPanel(wo)" class="px-3 py-1.5 bg-purple-100 text-purple-700 text-xs rounded hover:bg-purple-200 font-medium">
                🧪 QC Checkpoints
              </button>
            </template>
          </div>
        </div>
        <div v-if="!store.executionOrders.length" class="col-span-2 text-center py-12 text-gray-400">
          No active work orders
        </div>
      </div>

      <!-- Process Logs Modal -->
      <div v-if="showLogs" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" @click.self="showLogs = false">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
          <!-- header -->
          <div class="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <div class="flex justify-between items-center">
              <div>
                <h3 class="text-lg font-bold">Process Steps — {{ selectedWo?.wo_number }}</h3>
                <p class="text-blue-200 text-xs mt-0.5">{{ selectedWo?.product_name }}</p>
              </div>
              <button @click="showLogs = false" class="text-white/70 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            <!-- progress bar -->
            <div v-if="store.processLogs.length" class="mt-3">
              <div class="flex justify-between text-xs text-blue-200 mb-1">
                <span>Progress</span>
                <span>{{ completedSteps }}/{{ store.processLogs.length }} selesai</span>
              </div>
              <div class="w-full bg-white/20 rounded-full h-2">
                <div class="bg-emerald-400 h-2 rounded-full transition-all duration-500"
                  :style="{ width: store.processLogs.length ? (completedSteps / store.processLogs.length * 100) + '%' : '0%' }"></div>
              </div>
            </div>
          </div>

          <!-- steps list -->
          <div class="flex-1 overflow-y-auto p-4 space-y-2">
            <div v-if="store.processLogs.length">
              <div v-for="(log, idx) in store.processLogs" :key="log.id"
                class="border rounded-xl p-4 transition-all"
                :class="{
                  'border-emerald-300 bg-emerald-50': log.status === 'completed',
                  'border-blue-300 bg-blue-50': log.status === 'in_progress',
                  'border-gray-200 bg-gray-50': log.status === 'pending'
                }">
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-start gap-3">
                    <!-- step number -->
                    <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                      :class="{
                        'bg-emerald-500 text-white': log.status === 'completed',
                        'bg-blue-500 text-white animate-pulse': log.status === 'in_progress',
                        'bg-gray-200 text-gray-500': log.status === 'pending'
                      }">
                      <span v-if="log.status === 'completed'">✓</span>
                      <span v-else>{{ idx + 1 }}</span>
                    </div>
                    <div>
                      <div class="font-semibold text-gray-900">{{ log.process_name }}</div>
                      <p v-if="log.notes" class="text-xs text-gray-500 mt-0.5">{{ log.notes }}</p>
                      <div class="flex gap-3 mt-1 text-xs text-gray-400">
                        <span v-if="log.start_time">Mulai: {{ formatTime(log.start_time) }}</span>
                        <span v-if="log.end_time">Selesai: {{ formatTime(log.end_time) }}</span>
                        <span v-if="log.duration_minutes">{{ log.duration_minutes }} menit</span>
                      </div>
                    </div>
                  </div>
                  <!-- action buttons -->
                  <div class="flex items-center gap-1.5 flex-shrink-0">
                    <!-- QC gate badge -->
                    <span v-if="log.has_qc_checkpoint && log.status === 'completed'"
                      class="px-2 py-1 text-[10px] font-bold rounded-full"
                      :class="log.qc_status === 'passed' ? 'bg-green-100 text-green-700' : log.qc_status === 'in_review' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'"
                      :title="'QC: ' + (log.qc_status || 'pending')">
                      🧪 {{ log.qc_status === 'passed' ? 'QC Passed' : log.qc_status === 'in_review' ? 'QC Review' : 'QC Pending' }}
                    </span>
                    <!-- QC blocking warning on next step -->
                    <span v-if="isStepBlockedByQC(idx)"
                      class="px-2 py-1 bg-red-50 text-red-600 text-[10px] font-bold rounded-full border border-red-200"
                      title="Step sebelumnya memiliki QC checkpoint yang belum passed">
                      ⛔ QC Gate
                    </span>
                    <button v-if="log.status === 'pending'"
                      @click="updateLogStatus(log.id, 'in_progress')"
                      :disabled="isStepBlockedByQC(idx)"
                      class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                      :class="isStepBlockedByQC(idx) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'">
                      ▶ Mulai
                    </button>
                    <button v-if="log.status === 'in_progress'"
                      @click="updateLogStatus(log.id, 'completed')"
                      :disabled="isStepBlockedByQC(idx)"
                      class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                      :class="isStepBlockedByQC(idx) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white'">
                      ✓ Selesai
                    </button>
                    <span v-if="log.status === 'completed' && !log.has_qc_checkpoint"
                      class="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">Done</span>
                  </div>
                </div>
              </div>
            </div>
            <p v-else class="text-center text-gray-400 py-8">Belum ada process steps. Template akan di-generate saat Start Production.</p>

            <!-- Add ad-hoc step -->
            <div class="border-t border-dashed pt-4 mt-4">
              <h4 class="text-sm font-semibold text-gray-700 mb-3">Tambah Step Manual</h4>
              <div class="grid grid-cols-2 gap-3">
                <div class="col-span-2">
                  <input v-model="logForm.process_name" placeholder="Nama proses (cth: Cek pH Tambahan)" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <input v-model="logForm.notes" placeholder="Catatan (opsional)" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <select v-model="logForm.status" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm">
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
              <button @click="addLog" :disabled="!logForm.process_name"
                class="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 disabled:opacity-50 font-semibold">
                + Tambah Step
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- QC Checkpoints Modal -->
      <Teleport to="body">
        <div v-if="showQCPanel" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" @click.self="showQCPanel = false">
          <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden" style="animation: slideUp 0.3s ease-out">
            <!-- Header -->
            <div class="px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
              <h2 class="text-lg font-bold">🧪 QC Checkpoints — {{ selectedWo?.wo_number }}</h2>
              <p class="text-sm text-purple-200 mt-0.5">{{ selectedWo?.product_name }}</p>
            </div>

            <div class="flex-1 overflow-y-auto p-4">
              <!-- Existing Checkpoints -->
              <div v-if="qcCheckpoints.length" class="space-y-2 mb-4">
                <div v-for="cp in qcCheckpoints" :key="cp.id"
                  class="border rounded-lg p-3 transition-all"
                  :class="{
                    'border-green-400 bg-green-50': cp.status === 'passed',
                    'border-red-400 bg-red-50': cp.status === 'failed',
                    'border-blue-400 bg-blue-50': cp.status === 'in_review',
                    'border-gray-200': cp.status === 'pending'
                  }">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span v-if="cp.status === 'passed'" class="text-lg">✅</span>
                      <span v-else-if="cp.status === 'failed'" class="text-lg">❌</span>
                      <span v-else-if="cp.status === 'in_review'" class="text-lg">🔍</span>
                      <span v-else class="text-lg">⏳</span>
                      <div>
                        <span class="font-semibold text-gray-900">{{ cp.process_stage }}</span>
                        <span v-if="cp.is_mandatory" class="ml-1 text-[10px] font-bold text-red-600 bg-red-100 px-1 py-0.5 rounded">MANDATORY</span>
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-medium px-2 py-1 rounded-full"
                        :class="{
                          'bg-green-200 text-green-800': cp.status === 'passed',
                          'bg-red-200 text-red-800': cp.status === 'failed',
                          'bg-blue-200 text-blue-800': cp.status === 'in_review',
                          'bg-gray-200 text-gray-600': cp.status === 'pending'
                        }">
                        {{ cp.status.toUpperCase() }}
                      </span>
                      <button v-if="cp.status === 'pending' && !cp.fpa_id"
                        @click="triggerQC(cp.id)"
                        class="px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 font-medium">
                        🧪 Trigger QC
                      </button>
                      <button v-if="cp.status === 'pending'"
                        @click="deleteCheckpoint(cp.id)"
                        class="px-2 py-1 text-red-500 hover:text-red-700 text-xs">
                        ✕
                      </button>
                    </div>
                  </div>
                  <div v-if="cp.fpa_number" class="text-xs text-gray-500 mt-1">
                    FPA: {{ cp.fpa_number }} | Status: {{ cp.fpa_status || '-' }}
                  </div>
                </div>
              </div>
              <p v-else class="text-sm text-gray-400 mb-4 text-center py-6">No QC checkpoints configured yet</p>

              <!-- Add Checkpoint -->
              <div class="border-t pt-4">
                <h4 class="text-sm font-semibold mb-3">➕ Add QC Checkpoint</h4>
                <div class="flex gap-2">
                  <input v-model="newCheckpoint.process_stage" placeholder="Stage name (e.g. Mixing, Filling, Final)"
                    class="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                  <label class="flex items-center gap-1 text-sm text-gray-700 whitespace-nowrap">
                    <input type="checkbox" v-model="newCheckpoint.is_mandatory" class="w-4 h-4 rounded text-purple-600" />
                    Mandatory
                  </label>
                  <button @click="addCheckpoint"
                    :disabled="!newCheckpoint.process_stage.trim()"
                    class="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium">
                    Add
                  </button>
                </div>

                <!-- Quick Add Buttons -->
                <div class="flex flex-wrap gap-2 mt-3">
                  <span class="text-xs text-gray-500">Quick add:</span>
                  <button v-for="stage in ['Mixing', 'Filling', 'Packaging', 'Final QC']" :key="stage"
                    @click="quickAddCheckpoint(stage)"
                    class="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded hover:bg-purple-100 hover:text-purple-700 transition-colors">
                    + {{ stage }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="px-6 py-3 bg-gray-50 border-t flex justify-between items-center">
              <div class="text-sm text-gray-500">
                <span class="font-semibold text-purple-700">{{ qcCheckpoints.filter(c => c.status === 'passed').length }}</span>/{{ qcCheckpoints.length }} passed
              </div>
              <button @click="showQCPanel = false" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
                Close
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useProductionStore } from '../stores/production';
import { api } from '../lib/api';

const store = useProductionStore();
const showLogs = ref(false);
const showQCPanel = ref(false);
const selectedWo = ref<any>(null);
const selectedWoId = ref<number>(0);
const logForm = ref({ process_name: '', start_time: '', end_time: '', status: 'pending', notes: '' });
const qcCheckpoints = ref<any[]>([]);
const newCheckpoint = ref({ process_stage: '', is_mandatory: true });

const completedSteps = computed(() => store.processLogs.filter((l: any) => l.status === 'completed').length);

onMounted(() => store.fetchExecution());

const doAction = async (action: string, woId: number) => {
  try {
    if (action === 'start') {
      const result = await store.startWO(woId);
      if (result?.material_warning) {
        alert(`⚠️ ${result.material_warning}\n\nWO started anyway.`);
      }
    }
    else if (action === 'pause') await store.pauseWO(woId);
    else if (action === 'resume') await store.resumeWO(woId);
    else if (action === 'complete') {
      try {
        await store.completeWO(woId);
      } catch (e: any) {
        const msg = e?.response?.data?.error || e?.response?.data?.detail || 'Failed to complete';
        alert(msg);
        return;
      }
    }
    await store.fetchExecution();
  } catch (e: any) {
    const msg = e?.response?.data?.error || 'Action failed';
    alert(msg);
  }
};

const isStartable = (status: string) => ['released', 'RELEASED', 'Released'].includes(status);

const openLogs = async (wo: any) => {
  selectedWo.value = wo;
  selectedWoId.value = wo.id;
  await store.fetchProcessLogs(wo.id);
  logForm.value = { process_name: '', start_time: '', end_time: '', status: 'pending', notes: '' };
  showLogs.value = true;
};

// check if a step is blocked by an unresolved QC checkpoint (uses backend-computed flag)
const isStepBlockedByQC = (stepIndex: number): boolean => {
  return !!store.processLogs[stepIndex]?.qc_blocking;
};

const updateLogStatus = async (logId: number, newStatus: string) => {
  try {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const updateData: any = { status: newStatus };
    if (newStatus === 'in_progress') updateData.start_time = now;
    if (newStatus === 'completed') updateData.end_time = now;
    const res = await api.put(`/production/execution/${selectedWoId.value}/process-logs/${logId}`, updateData);
    await store.fetchProcessLogs(selectedWoId.value);
    await store.fetchExecution();
    // show QC notification if triggered
    if (res.data?.qc_triggered) {
      alert(`QC Auto-Triggered!\nFPA: ${res.data.qc_triggered.fpa_number}\nCheckpoint updated to "in_review"`);
    }
  } catch (e: any) {
    alert(e?.response?.data?.error || 'Failed to update step');
  }
};

const addLog = async () => {
  if (!logForm.value.process_name) return;
  const res = await store.addProcessLog(selectedWoId.value, logForm.value);
  await store.fetchProcessLogs(selectedWoId.value);
  logForm.value = { process_name: '', start_time: '', end_time: '', status: 'in_progress', notes: '' };

  // If QC was triggered, show notification
  if (res?.qc_triggered) {
    alert(`🧪 QC Auto-Triggered!\nFPA: ${res.qc_triggered.fpa_number}\nCheckpoint updated to "in_review"`);
    await store.fetchExecution(); // Refresh QC counts
  }
};

const openQCPanel = async (wo: any) => {
  selectedWo.value = wo;
  selectedWoId.value = wo.id;
  await loadCheckpoints(wo.id);
  showQCPanel.value = true;
};

const loadCheckpoints = async (woId: number) => {
  try {
    const res = await api.get(`/production/execution/${woId}/qc-checkpoints`);
    qcCheckpoints.value = res.data?.data || [];
  } catch (e) { console.error(e); qcCheckpoints.value = []; }
};

const addCheckpoint = async () => {
  if (!newCheckpoint.value.process_stage.trim()) return;
  try {
    await api.post(`/production/execution/${selectedWoId.value}/qc-checkpoints`, {
      stages: [{ process_stage: newCheckpoint.value.process_stage, is_mandatory: newCheckpoint.value.is_mandatory }]
    });
    newCheckpoint.value = { process_stage: '', is_mandatory: true };
    await loadCheckpoints(selectedWoId.value);
    await store.fetchExecution();
  } catch (e: any) {
    alert(e?.response?.data?.error || 'Failed to add checkpoint');
  }
};

const quickAddCheckpoint = async (stage: string) => {
  try {
    await api.post(`/production/execution/${selectedWoId.value}/qc-checkpoints`, {
      stages: [{ process_stage: stage, is_mandatory: true }]
    });
    await loadCheckpoints(selectedWoId.value);
    await store.fetchExecution();
  } catch (e) { /* ignore duplicates */ }
};

const triggerQC = async (checkpointId: number) => {
  try {
    const res = await api.post(`/production/execution/${selectedWoId.value}/trigger-qc/${checkpointId}`);
    alert(`🧪 QC Triggered!\n${res.data?.message || 'FPA created'}`);
    await loadCheckpoints(selectedWoId.value);
    await store.fetchExecution();
  } catch (e: any) {
    alert(e?.response?.data?.error || 'Failed to trigger QC');
  }
};

const deleteCheckpoint = async (checkpointId: number) => {
  if (!confirm('Delete this QC checkpoint?')) return;
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
  released: '🚀 Released', RELEASED: '🚀 Released', Released: '🚀 Released',
  in_progress: '🔵 In Progress', IN_PROGRESS: '🔵 In Progress',
  completed: '✅ Completed', COMPLETED: '✅ Completed',
  on_hold: '⏸ On Hold', ON_HOLD: '⏸ On Hold',
  DRAFT: '📋 Draft', Draft: '📋 Draft', draft: '📋 Draft',
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
</script>

<style scoped>
@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
