<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">🧫 Lab Testing</h1>
        <p class="text-sm text-gray-500 mt-1">Track experiments, test parameters & results</p>
      </div>
      <button @click="openModal()" class="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium text-sm">+ New Lab Test</button>
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
            <th class="px-4 py-3 text-left cursor-pointer hover:bg-gray-100" @click="toggleSort('test_code')">Code {{ sortIcon('test_code') }}</th>
            <th class="px-4 py-3 text-left cursor-pointer hover:bg-gray-100" @click="toggleSort('test_name')">Test Name {{ sortIcon('test_name') }}</th>
            <th class="px-4 py-3 text-left">Type</th>
            <th class="px-4 py-3 text-left">Formulation</th>
            <th class="px-4 py-3 text-left">Batch</th>
            <th class="px-4 py-3 text-left">Status</th>
            <th class="px-4 py-3 text-left">Result</th>
            <th class="px-4 py-3 text-left">Tester</th>
            <th class="px-4 py-3 text-left">Date</th>
            <th class="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in sortedData" :key="item.id" class="border-b hover:bg-gray-50">
            <td class="px-4 py-3"><input type="checkbox" :checked="selectedIds.includes(item.id)" @change="toggleSelect(item.id)" /></td>
            <td class="px-4 py-3 font-mono text-xs text-amber-600 font-medium">{{ item.test_code }}</td>
            <td class="px-4 py-3 font-medium">{{ item.test_name }}</td>
            <td class="px-4 py-3"><span class="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">{{ item.test_type }}</span></td>
            <td class="px-4 py-3 text-xs text-gray-600">{{ item.formulation_name || '-' }}</td>
            <td class="px-4 py-3 text-xs font-mono">{{ item.batch_number || '-' }}</td>
            <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="statusClass(item.status)">{{ item.status }}</span></td>
            <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-xs font-bold" :class="conclusionClass(item.conclusion)">{{ item.conclusion }}</span></td>
            <td class="px-4 py-3 text-gray-600 text-xs">{{ item.tester_name || '-' }}</td>
            <td class="px-4 py-3 text-gray-500 text-xs">{{ formatDate(item.test_date) }}</td>
            <td class="px-4 py-3 text-right space-x-1">
              <button @click="openModal(item)" class="text-blue-600 text-xs font-medium">Edit</button>
              <button @click="deleteItem(item.id)" class="text-red-500 text-xs font-medium">Delete</button>
            </td>
          </tr>
          <tr v-if="!items.length"><td colspan="11" class="px-4 py-8 text-center text-gray-400">No lab tests yet</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div class="px-6 py-4 border-b bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-t-2xl">
          <h3 class="text-lg font-semibold">{{ editing ? 'Edit Lab Test' : 'New Lab Test' }}</h3>
        </div>
        <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Test Code *</label>
              <input v-model="form.test_code" type="text" required class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="LAB-001" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Test Name *</label>
              <input v-model="form.test_name" type="text" required class="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>
          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Test Type</label>
              <select v-model="form.test_type" class="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="chemical">Chemical</option><option value="physical">Physical</option>
                <option value="microbiological">Microbiological</option><option value="stability">Stability</option>
                <option value="performance">Performance</option><option value="other">Other</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select v-model="form.status" class="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="scheduled">Scheduled</option><option value="in_progress">In Progress</option>
                <option value="completed">Completed</option><option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Conclusion</label>
              <select v-model="form.conclusion" class="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="pending">Pending</option><option value="pass">Pass ✅</option>
                <option value="fail">Fail ❌</option><option value="conditional">Conditional ⚠️</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Formulation</label>
              <select v-model="form.formulation_id" class="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">-- None --</option>
                <option v-for="f in formulations" :key="f.id" :value="f.id">{{ f.formula_code }} - {{ f.name }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Batch Number</label>
              <input v-model="form.batch_number" type="text" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="BATCH-001" />
            </div>
          </div>
          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Test Date</label>
              <input v-model="form.test_date" type="date" class="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Method</label>
              <input v-model="form.method" type="text" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="ASTM D-xxx" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Equipment</label>
              <input v-model="form.equipment" type="text" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Viscometer" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Parameters (JSON)</label>
            <textarea v-model="form.parameters_text" rows="3" class="w-full px-3 py-2 border rounded-lg text-sm font-mono" placeholder='[{"name":"pH","target":"6.5-7.5","actual":"6.8"}]'></textarea>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea v-model="form.notes" rows="2" class="w-full px-3 py-2 border rounded-lg text-sm"></textarea>
          </div>
          <div class="flex justify-end gap-3 pt-4 border-t">
            <button type="button" @click="showModal = false" class="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" :disabled="submitting" class="px-6 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
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
const showModal = ref(false);
const submitting = ref(false);
const editing = ref<any>(null);
const selectedIds = ref<number[]>([]);

const { toggleSort, sortIcon, sortedData } = useTableSort(items);

const emptyForm = () => ({ test_code: '', test_name: '', formulation_id: '', project_id: '', batch_number: '', test_type: 'chemical', method: '', equipment: '', status: 'scheduled', test_date: '', tested_by: '', parameters_text: '', conclusion: 'pending', notes: '' });
const form = ref(emptyForm());

const isAllSelected = computed(() => items.value.length > 0 && items.value.every(i => selectedIds.value.includes(i.id)));
const toggleSelectAll = () => { isAllSelected.value ? selectedIds.value = [] : selectedIds.value = items.value.map(i => i.id); };
const toggleSelect = (id: number) => { selectedIds.value.includes(id) ? selectedIds.value = selectedIds.value.filter(i => i !== id) : selectedIds.value.push(id); };

const statusClass = (s: string) => ({ scheduled: 'bg-gray-100 text-gray-700', in_progress: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700', failed: 'bg-red-100 text-red-700', cancelled: 'bg-gray-200 text-gray-500' }[s] || 'bg-gray-100');
const conclusionClass = (c: string) => ({ pass: 'bg-green-100 text-green-700', fail: 'bg-red-100 text-red-700', conditional: 'bg-yellow-100 text-yellow-700', pending: 'bg-gray-100 text-gray-500' }[c] || 'bg-gray-100');
const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('id-ID') : '-';

onMounted(async () => {
  await fetchItems();
  try { const res = await api.get('/rnd/formulations'); formulations.value = res.data.data || []; } catch {}
});

async function fetchItems() {
  try { const res = await api.get('/rnd/lab-tests'); items.value = res.data.data || []; } catch (err) { console.error(err); }
}

function openModal(item?: any) {
  editing.value = item || null;
  if (item) {
    form.value = { ...item, test_date: item.test_date?.split('T')[0] || '', parameters_text: item.parameters || '' };
  } else { form.value = emptyForm(); }
  showModal.value = true;
}

async function handleSubmit() {
  submitting.value = true;
  try {
    const payload = { ...form.value, parameters: form.value.parameters_text };
    if (editing.value) { await api.put(`/rnd/lab-tests/${editing.value.id}`, payload); }
    else { await api.post('/rnd/lab-tests', payload); }
    showModal.value = false;
    await fetchItems();
  } catch (err: any) { alert(err.response?.data?.error || err.message); }
  finally { submitting.value = false; }
}

async function deleteItem(id: number) {
  if (!confirm('Delete this test?')) return;
  try { await api.delete(`/rnd/lab-tests/${id}`); await fetchItems(); } catch (err: any) { alert(err.message); }
}

async function bulkDelete() {
  if (!confirm(`Delete ${selectedIds.value.length} tests?`)) return;
  for (const id of selectedIds.value) { await api.delete(`/rnd/lab-tests/${id}`); }
  selectedIds.value = [];
  await fetchItems();
}
</script>
