<template>
  <div class="p-6">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">🔬 R&D Projects</h1>
        <p class="text-sm text-gray-500 mt-1">Manage research & development projects</p>
      </div>
      <button @click="openModal()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm flex items-center gap-2">
        <span>+</span> New Project
      </button>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      <div v-for="s in statusCards" :key="s.label" class="bg-white rounded-xl border p-4 shadow-sm">
        <div class="text-2xl font-bold" :class="s.color">{{ s.count }}</div>
        <div class="text-xs text-gray-500 mt-1">{{ s.label }}</div>
      </div>
    </div>

    <!-- Bulk Actions -->
    <div v-if="selectedIds.length" class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
      <span class="text-sm font-medium text-red-700">{{ selectedIds.length }} selected</span>
      <button @click="bulkDelete" class="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700">🗑️ Delete</button>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-xl border shadow-sm overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="px-4 py-3 text-left w-10"><input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll" /></th>
            <th class="px-4 py-3 text-left cursor-pointer hover:bg-gray-100" @click="toggleSort('project_code')">Code {{ sortIcon('project_code') }}</th>
            <th class="px-4 py-3 text-left cursor-pointer hover:bg-gray-100" @click="toggleSort('name')">Name {{ sortIcon('name') }}</th>
            <th class="px-4 py-3 text-left">Status</th>
            <th class="px-4 py-3 text-left">Priority</th>
            <th class="px-4 py-3 text-left">Leader</th>
            <th class="px-4 py-3 text-left">Timeline</th>
            <th class="px-4 py-3 text-left">Budget</th>
            <th class="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in sortedData" :key="item.id" class="border-b hover:bg-gray-50 transition-colors">
            <td class="px-4 py-3"><input type="checkbox" :checked="selectedIds.includes(item.id)" @change="toggleSelect(item.id)" /></td>
            <td class="px-4 py-3 font-mono text-xs text-indigo-600 font-medium">{{ item.project_code }}</td>
            <td class="px-4 py-3 font-medium">{{ item.name }}</td>
            <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="statusClass(item.status)">{{ item.status }}</span></td>
            <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="priorityClass(item.priority)">{{ item.priority }}</span></td>
            <td class="px-4 py-3 text-gray-600">{{ item.leader_name || '-' }}</td>
            <td class="px-4 py-3 text-xs text-gray-500">{{ formatDate(item.start_date) }} → {{ formatDate(item.target_end_date) }}</td>
            <td class="px-4 py-3 text-gray-700 font-medium">{{ formatCurrency(item.budget) }}</td>
            <td class="px-4 py-3 text-right space-x-1">
              <router-link :to="`/rnd/projects/${item.id}`" class="text-indigo-600 hover:text-indigo-800 text-xs font-medium">View</router-link>
              <button @click="openModal(item)" class="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit</button>
              <button @click="deleteItem(item.id)" class="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button>
            </td>
          </tr>
          <tr v-if="!items.length"><td colspan="9" class="px-4 py-8 text-center text-gray-400">No projects yet</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div class="px-6 py-4 border-b bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-2xl">
          <h3 class="text-lg font-semibold">{{ editing ? 'Edit Project' : 'New R&D Project' }}</h3>
        </div>
        <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Project Code *</label>
              <input v-model="form.project_code" type="text" required class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" placeholder="RND-001" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Name *</label>
              <input v-model="form.name" type="text" required class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Project name" />
            </div>
          </div>
          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select v-model="form.status" class="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="draft">Draft</option><option value="active">Active</option>
                <option value="on_hold">On Hold</option><option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Priority</label>
              <select v-model="form.priority" class="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="low">Low</option><option value="medium">Medium</option>
                <option value="high">High</option><option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Leader</label>
              <select v-model="form.project_leader_id" class="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">-- Select --</option>
                <option v-for="u in users" :key="u.id" :value="u.id">{{ u.full_name }}</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
              <input v-model="form.start_date" type="date" class="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Target End Date</label>
              <input v-model="form.target_end_date" type="date" class="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Budget (Rp)</label>
              <input v-model.number="form.budget" type="number" class="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Objectives</label>
            <textarea v-model="form.objectives" rows="2" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Research objectives..."></textarea>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea v-model="form.description" rows="2" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Project description..."></textarea>
          </div>
          <div class="flex justify-end gap-3 pt-4 border-t">
            <button type="button" @click="showModal = false" class="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" :disabled="submitting" class="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
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
const users = ref<any[]>([]);
const showModal = ref(false);
const submitting = ref(false);
const editing = ref<any>(null);
const selectedIds = ref<number[]>([]);

const { toggleSort, sortIcon, sortedData } = useTableSort(items);

const emptyForm = () => ({ project_code: '', name: '', description: '', objectives: '', status: 'draft', priority: 'medium', project_leader_id: '', department_id: '', start_date: '', target_end_date: '', budget: 0, notes: '' });
const form = ref(emptyForm());

const statusCards = computed(() => {
  const all = items.value;
  return [
    { label: 'Total', count: all.length, color: 'text-gray-800' },
    { label: 'Active', count: all.filter(i => i.status === 'active').length, color: 'text-green-600' },
    { label: 'Draft', count: all.filter(i => i.status === 'draft').length, color: 'text-gray-500' },
    { label: 'On Hold', count: all.filter(i => i.status === 'on_hold').length, color: 'text-yellow-600' },
    { label: 'Completed', count: all.filter(i => i.status === 'completed').length, color: 'text-blue-600' },
  ];
});

const isAllSelected = computed(() => items.value.length > 0 && items.value.every(i => selectedIds.value.includes(i.id)));
const toggleSelectAll = () => { isAllSelected.value ? selectedIds.value = [] : selectedIds.value = items.value.map(i => i.id); };
const toggleSelect = (id: number) => { selectedIds.value.includes(id) ? selectedIds.value = selectedIds.value.filter(i => i !== id) : selectedIds.value.push(id); };

const statusClass = (s: string) => ({ draft: 'bg-gray-100 text-gray-700', active: 'bg-green-100 text-green-700', on_hold: 'bg-yellow-100 text-yellow-700', completed: 'bg-blue-100 text-blue-700', cancelled: 'bg-red-100 text-red-700' }[s] || 'bg-gray-100');
const priorityClass = (p: string) => ({ low: 'bg-gray-100 text-gray-600', medium: 'bg-blue-100 text-blue-700', high: 'bg-orange-100 text-orange-700', critical: 'bg-red-100 text-red-700' }[p] || '');
const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const formatCurrency = (v: number) => v ? `Rp ${Number(v).toLocaleString('id-ID')}` : '-';

onMounted(async () => {
  await fetchItems();
  try { const res = await api.get('/users'); users.value = res.data.data || []; } catch {}
});

async function fetchItems() {
  try { const res = await api.get('/rnd/projects'); items.value = res.data.data || []; } catch (err) { console.error(err); }
}

function openModal(item?: any) {
  editing.value = item || null;
  form.value = item ? { ...item, start_date: item.start_date?.split('T')[0] || '', target_end_date: item.target_end_date?.split('T')[0] || '' } : emptyForm();
  showModal.value = true;
}

async function handleSubmit() {
  submitting.value = true;
  try {
    if (editing.value) { await api.put(`/rnd/projects/${editing.value.id}`, form.value); }
    else { await api.post('/rnd/projects', form.value); }
    showModal.value = false;
    await fetchItems();
  } catch (err: any) { alert(err.response?.data?.error || err.message); }
  finally { submitting.value = false; }
}

async function deleteItem(id: number) {
  if (!confirm('Delete this project?')) return;
  try { await api.delete(`/rnd/projects/${id}`); await fetchItems(); } catch (err: any) { alert(err.message); }
}

async function bulkDelete() {
  if (!confirm(`Delete ${selectedIds.value.length} projects?`)) return;
  for (const id of selectedIds.value) { await api.delete(`/rnd/projects/${id}`); }
  selectedIds.value = [];
  await fetchItems();
}
</script>
