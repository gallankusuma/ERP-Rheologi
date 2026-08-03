<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">📊 Stability Studies</h1>
        <p class="text-sm text-gray-500 mt-1">Monitor product stability over time with scheduled checkpoints</p>
      </div>
      <button @click="openModal()" class="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-medium text-sm">+ New Study</button>
    </div>

    <div v-if="selectedIds.length" class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
      <span class="text-sm font-medium text-red-700">{{ selectedIds.length }} selected</span>
      <button @click="bulkDelete" class="px-3 py-1 bg-red-600 text-white rounded text-sm">🗑️ Delete</button>
    </div>

    <div class="bg-white rounded-xl border shadow-sm overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="px-4 py-3 w-10"><input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll" /></th>
            <th class="px-4 py-3 text-left cursor-pointer hover:bg-gray-100" @click="toggleSort('study_code')">Code {{ sortIcon('study_code') }}</th>
            <th class="px-4 py-3 text-left cursor-pointer hover:bg-gray-100" @click="toggleSort('name')">Study Name {{ sortIcon('name') }}</th>
            <th class="px-4 py-3 text-left">Formulation</th>
            <th class="px-4 py-3 text-left">Batch</th>
            <th class="px-4 py-3 text-left">Condition</th>
            <th class="px-4 py-3 text-left">Duration</th>
            <th class="px-4 py-3 text-left">Status</th>
            <th class="px-4 py-3 text-left">Progress</th>
            <th class="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in sortedData" :key="item.id" class="border-b hover:bg-gray-50">
            <td class="px-4 py-3"><input type="checkbox" :checked="selectedIds.includes(item.id)" @change="toggleSelect(item.id)" /></td>
            <td class="px-4 py-3 font-mono text-xs text-sky-600 font-medium">{{ item.study_code }}</td>
            <td class="px-4 py-3 font-medium">{{ item.name }}</td>
            <td class="px-4 py-3 text-xs text-gray-600">{{ item.formulation_name || '-' }}</td>
            <td class="px-4 py-3 font-mono text-xs">{{ item.batch_number || '-' }}</td>
            <td class="px-4 py-3 text-xs">{{ item.storage_condition }}</td>
            <td class="px-4 py-3 text-xs">{{ item.duration_months }} months</td>
            <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="statusClass(item.status)">{{ item.status }}</span></td>
            <td class="px-4 py-3">
              <div class="w-20 bg-gray-200 rounded-full h-2">
                <div class="h-2 rounded-full" :class="item.status === 'completed' ? 'bg-green-500' : 'bg-sky-500'" :style="{width: getProgress(item) + '%'}"></div>
              </div>
            </td>
            <td class="px-4 py-3 text-right space-x-1">
              <button @click="viewCheckpoints(item)" class="text-sky-600 text-xs font-medium">Checkpoints</button>
              <button @click="openModal(item)" class="text-blue-600 text-xs font-medium">Edit</button>
              <button @click="deleteItem(item.id)" class="text-red-500 text-xs font-medium">Del</button>
            </td>
          </tr>
          <tr v-if="!items.length"><td colspan="10" class="px-4 py-8 text-center text-gray-400">No stability studies yet</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Checkpoints Panel -->
    <div v-if="showCheckpoints" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto">
        <div class="px-6 py-4 border-b bg-gradient-to-r from-sky-600 to-cyan-600 text-white rounded-t-2xl flex justify-between items-center">
          <h3 class="text-lg font-semibold">📋 Checkpoints — {{ activeStudy?.study_code }}</h3>
          <button @click="showCheckpoints = false" class="text-white/70 hover:text-white text-xl">×</button>
        </div>
        <div class="p-6">
          <div class="space-y-3">
            <div v-for="cp in checkpoints" :key="cp.id" class="border rounded-lg p-4 flex items-center gap-4" :class="cp.status === 'completed' ? 'bg-green-50 border-green-200' : 'bg-white'">
              <div class="w-16 text-center">
                <div class="text-2xl font-bold" :class="cp.status === 'completed' ? 'text-green-600' : 'text-gray-400'">T{{ cp.checkpoint_month }}</div>
                <div class="text-[10px] text-gray-500">month</div>
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="cpStatusClass(cp.status)">{{ cp.status }}</span>
                  <span v-if="cp.pass_fail !== 'pending'" class="px-2 py-0.5 rounded-full text-xs font-bold" :class="cp.pass_fail === 'pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'">{{ cp.pass_fail }}</span>
                </div>
                <div class="text-xs text-gray-500">Scheduled: {{ formatDate(cp.scheduled_date) }} | Actual: {{ formatDate(cp.actual_date) }}</div>
                <div v-if="cp.notes" class="text-xs text-gray-600 mt-1">{{ cp.notes }}</div>
              </div>
              <button v-if="cp.status !== 'completed'" @click="completeCheckpoint(cp)" class="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">Complete</button>
            </div>
            <p v-if="!checkpoints.length" class="text-center text-gray-400 py-4">No checkpoints. Add when creating the study.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div class="px-6 py-4 border-b bg-gradient-to-r from-sky-600 to-cyan-600 text-white rounded-t-2xl">
          <h3 class="text-lg font-semibold">{{ editing ? 'Edit Study' : 'New Stability Study' }}</h3>
        </div>
        <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Study Code *</label>
              <input v-model="form.study_code" type="text" required class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="STB-001" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Name *</label>
              <input v-model="form.name" type="text" required class="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>
          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Formulation</label>
              <select v-model="form.formulation_id" class="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">-- None --</option>
                <option v-for="f in formulations" :key="f.id" :value="f.id">{{ f.formula_code }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Batch Number</label>
              <input v-model="form.batch_number" type="text" class="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select v-model="form.status" class="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="planned">Planned</option><option value="active">Active</option>
                <option value="completed">Completed</option><option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Storage Condition</label>
              <input v-model="form.storage_condition" type="text" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="25°C / 60% RH" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Duration (months)</label>
              <input v-model.number="form.duration_months" type="number" class="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
              <input v-model="form.start_date" type="date" class="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Protocol</label>
            <textarea v-model="form.protocol" rows="2" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Testing protocol..."></textarea>
          </div>

          <!-- Auto-generate checkpoints -->
          <div v-if="!editing" class="border rounded-lg p-4 bg-sky-50">
            <label class="flex items-center gap-2">
              <input type="checkbox" v-model="autoCheckpoints" class="rounded" />
              <span class="text-sm font-medium text-gray-700">Auto-generate checkpoints (T0, T1, T3, T6, T9, T12)</span>
            </label>
          </div>

          <div class="flex justify-end gap-3 pt-4 border-t">
            <button type="button" @click="showModal = false" class="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" :disabled="submitting" class="px-6 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {{ submitting ? 'Saving...' : editing ? 'Update' : 'Create' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api } from '../lib/api';
import { useTableSort } from '../composables/useTableSort';

const items = ref<any[]>([]);
const formulations = ref<any[]>([]);
const checkpoints = ref<any[]>([]);
const showModal = ref(false);
const showCheckpoints = ref(false);
const submitting = ref(false);
const editing = ref<any>(null);
const activeStudy = ref<any>(null);
const selectedIds = ref<number[]>([]);
const autoCheckpoints = ref(true);

const { toggleSort, sortIcon, sortedData } = useTableSort(items);

const emptyForm = () => ({ study_code: '', name: '', formulation_id: '', batch_number: '', status: 'planned', storage_condition: '25°C / 60% RH', duration_months: 12, start_date: '', protocol: '' });
const form = ref(emptyForm());

const isAllSelected = computed(() => items.value.length > 0 && items.value.every(i => selectedIds.value.includes(i.id)));
const toggleSelectAll = () => { isAllSelected.value ? selectedIds.value = [] : selectedIds.value = items.value.map(i => i.id); };
const toggleSelect = (id: number) => { selectedIds.value.includes(id) ? selectedIds.value = selectedIds.value.filter(i => i !== id) : selectedIds.value.push(id); };

const statusClass = (s: string) => ({ planned: 'bg-gray-100 text-gray-700', active: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700' }[s] || 'bg-gray-100');
const cpStatusClass = (s: string) => ({ pending: 'bg-gray-100 text-gray-600', completed: 'bg-green-100 text-green-700', skipped: 'bg-yellow-100 text-yellow-700' }[s] || 'bg-gray-100');
const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('id-ID') : '-';
const getProgress = (item: any) => {
  if (item.status === 'completed') return 100;
  if (!item.start_date || !item.duration_months) return 0;
  const start = new Date(item.start_date);
  const now = new Date();
  const months = (now.getTime() - start.getTime()) / (30 * 24 * 60 * 60 * 1000);
  return Math.min(100, Math.max(0, Math.round((months / item.duration_months) * 100)));
};

onMounted(async () => {
  await fetchItems();
  try { const res = await api.get('/rnd/formulations'); formulations.value = res.data.data || []; } catch {}
});

async function fetchItems() {
  try { const res = await api.get('/rnd/stability'); items.value = res.data.data || []; } catch (err) { console.error(err); }
}

async function viewCheckpoints(item: any) {
  activeStudy.value = item;
  try {
    const res = await api.get(`/rnd/stability/${item.id}`);
    checkpoints.value = res.data.data.checkpoints || [];
  } catch { checkpoints.value = []; }
  showCheckpoints.value = true;
}

async function completeCheckpoint(cp: any) {
  try {
    await api.put(`/rnd/stability/${activeStudy.value.id}/checkpoints/${cp.id}`, {
      actual_date: new Date().toISOString().split('T')[0],
      status: 'completed',
      pass_fail: 'pass',
    });
    await viewCheckpoints(activeStudy.value);
  } catch (err: any) { alert(err.message); }
}

function openModal(item?: any) {
  editing.value = item || null;
  form.value = item ? { ...item, start_date: item.start_date?.split('T')[0] || '' } : emptyForm();
  showModal.value = true;
}

async function handleSubmit() {
  submitting.value = true;
  try {
    const payload: any = { ...form.value };
    if (!editing.value && autoCheckpoints.value && form.value.start_date) {
      const start = new Date(form.value.start_date);
      payload.checkpoints = [0, 1, 3, 6, 9, 12].filter(m => m <= form.value.duration_months).map(m => {
        const d = new Date(start); d.setMonth(d.getMonth() + m);
        return { checkpoint_month: m, scheduled_date: d.toISOString().split('T')[0] };
      });
    }
    if (editing.value) { await api.put(`/rnd/stability/${editing.value.id}`, payload); }
    else { await api.post('/rnd/stability', payload); }
    showModal.value = false;
    await fetchItems();
  } catch (err: any) { alert(err.response?.data?.error || err.message); }
  finally { submitting.value = false; }
}

async function deleteItem(id: number) {
  if (!confirm('Delete this study?')) return;
  try { await api.delete(`/rnd/stability/${id}`); await fetchItems(); } catch (err: any) { alert(err.message); }
}

async function bulkDelete() {
  if (!confirm(`Delete ${selectedIds.value.length} studies?`)) return;
  for (const id of selectedIds.value) { await api.delete(`/rnd/stability/${id}`); }
  selectedIds.value = [];
  await fetchItems();
}
</script>
