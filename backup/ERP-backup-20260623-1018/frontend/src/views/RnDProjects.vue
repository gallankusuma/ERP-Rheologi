<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">🔬 R&D Projects</h1>
        <p class="text-sm text-gray-500 mt-1">Research & development project management</p>
      </div>
      <div class="flex items-center gap-2">
        <div class="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium flex items-center gap-1">📋 List</div>
        <router-link to="/rnd/kanban" class="px-3 py-2 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center gap-1">📊 Kanban</router-link>
        <button @click="openModal()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm flex items-center gap-2">
          <span>+</span> New Project
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      <div v-for="s in statusCards" :key="s.label" class="bg-white rounded-xl border p-4 shadow-sm">
        <div class="text-2xl font-bold" :class="s.color">{{ s.count }}</div>
        <div class="text-xs text-gray-500 mt-1">{{ s.label }}</div>
      </div>
    </div>

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
            <th class="px-4 py-3 text-left">Type</th>
            <th class="px-4 py-3 text-left">Status</th>
            <th class="px-4 py-3 text-left">Priority</th>
            <th class="px-4 py-3 text-left">Leader</th>
            <th class="px-4 py-3 text-left">Timeline</th>
            <th class="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in sortedData" :key="item.id" class="border-b hover:bg-gray-50 transition-colors">
            <td class="px-4 py-3"><input type="checkbox" :checked="selectedIds.includes(item.id)" @change="toggleSelect(item.id)" /></td>
            <td class="px-4 py-3"><router-link :to="`/rnd/projects/${item.id}`" class="font-mono text-xs text-indigo-600 font-medium hover:text-indigo-800 hover:underline">{{ item.project_code }}</router-link></td>
            <td class="px-4 py-3">
              <div class="font-medium">{{ item.name }}</div>
              <div class="text-[10px] text-gray-400">{{ item.category }} · {{ labelify(item.confidentiality) }}</div>
            </td>
            <td class="px-4 py-3"><span class="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-[10px]">{{ labelify(item.project_type) }}</span></td>
            <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="statusClass(item.status)">{{ item.status }}</span></td>
            <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="priorityClass(item.priority)">{{ item.priority }}</span></td>
            <td class="px-4 py-3 text-gray-600 text-xs">{{ item.leader_name || '-' }}</td>
            <td class="px-4 py-3 text-xs text-gray-500">{{ formatDate(item.start_date) }} → {{ formatDate(item.target_end_date) }}</td>
            <td class="px-4 py-3 text-right">
              <div class="flex items-center justify-end gap-2">
                <router-link :to="`/rnd/projects/${item.id}`" class="p-1.5 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100 transition-colors" title="View Project">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                </router-link>
                <button @click="openModal(item)" class="p-1.5 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors" title="Edit Project">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                </button>
                <button @click="deleteItem(item.id)" class="p-1.5 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors" title="Delete Project">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!items.length"><td colspan="9" class="px-4 py-8 text-center text-gray-400">No projects yet</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Pro Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div class="px-6 py-4 border-b bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-2xl">
          <h3 class="text-lg font-semibold">{{ editing ? 'Edit Project' : '🔬 New R&D Project' }}</h3>
          <p class="text-xs text-indigo-200 mt-0.5">Research project registration — LIMS standard</p>
        </div>
        <form @submit.prevent="handleSubmit" class="p-6 space-y-5">
          <!-- Section 1: Project Identity -->
          <div class="border-b pb-4">
            <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">📌 Project Identity</h4>
            <div class="grid grid-cols-3 gap-4">
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Project Code</label>
                <div v-if="editing" class="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 text-indigo-600 font-mono font-medium">{{ form.project_code }}</div>
                <div v-else class="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 text-gray-400 italic">Auto: RND-{{ new Date().getFullYear() }}-XXX</div>
              </div>
              <div class="col-span-2">
                <label class="block text-xs font-medium text-gray-700 mb-1">Project Name *</label>
                <input v-model="form.name" type="text" required class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. Formulation Mancozeb 80% WP" />
              </div>
            </div>
            <div class="grid grid-cols-3 gap-4 mt-3">
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Project Type</label>
                <select v-model="form.project_type" class="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="new_product">New Product Development</option>
                  <option value="reformulation">Reformulation</option>
                  <option value="cost_reduction">Cost Reduction</option>
                  <option value="process_improvement">Process Improvement</option>
                  <option value="raw_material_evaluation">Raw Material Evaluation</option>
                  <option value="custom_request">Custom Request / Toll</option>
                  <option value="regulatory">Regulatory Compliance</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Product Category</label>
                <select v-model="form.category" class="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="chemical">Chemical</option><option value="polymer">Polymer</option>
                  <option value="coating">Coating</option><option value="adhesive">Adhesive</option>
                  <option value="additive">Additive</option><option value="surfactant">Surfactant</option>
                  <option value="agrochemical">Agrochemical</option><option value="pharmaceutical">Pharmaceutical</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Target Product</label>
                <input v-model="form.target_product" type="text" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. Fungicide WP" />
              </div>
            </div>
          </div>

          <!-- Section 2: Status & Risk -->
          <div class="border-b pb-4">
            <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">⚡ Status & Classification</h4>
            <div class="grid grid-cols-4 gap-4">
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
                <label class="block text-xs font-medium text-gray-700 mb-1">Risk Level</label>
                <select v-model="form.risk_level" class="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="low">🟢 Low</option><option value="medium">🟡 Medium</option>
                  <option value="high">🔴 High</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Confidentiality</label>
                <select v-model="form.confidentiality" class="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="public">Public</option><option value="internal">Internal</option>
                  <option value="confidential">Confidential</option><option value="highly_confidential">Highly Confidential 🔒</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Section 3: Team & Timeline -->
          <div class="border-b pb-4">
            <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">👥 Team & Timeline</h4>
            <div class="grid grid-cols-3 gap-4">
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Project Leader</label>
                <select v-model="form.project_leader_id" class="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">-- Select --</option>
                  <option v-for="u in users" :key="u.id" :value="u.id">{{ u.full_name }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Department</label>
                <select v-model="form.department_id" class="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">-- Select --</option>
                  <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Budget (Rp)</label>
                <input v-model.number="form.budget" type="number" class="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4 mt-3">
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                <input v-model="form.start_date" type="date" class="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Target End Date</label>
                <input v-model="form.target_end_date" type="date" class="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>
          </div>

          <!-- Section 4: Research Scope -->
          <div>
            <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">📝 Research Scope</h4>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Target Market</label>
                <input v-model="form.target_market" type="text" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. Agriculture, Industrial" />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Regulatory Requirements</label>
                <input v-model="form.regulatory_requirements" type="text" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. SNI, ISO 9001, GMP" />
              </div>
            </div>
            <div class="mt-3">
              <label class="block text-xs font-medium text-gray-700 mb-1">Research Objectives</label>
              <textarea v-model="form.objectives" rows="2" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Define clear research objectives..."></textarea>
            </div>
            <div class="mt-3">
              <label class="block text-xs font-medium text-gray-700 mb-1">Expected Output / Deliverables</label>
              <textarea v-model="form.expected_output" rows="2" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. Approved formulation, stability data, CoA template, SDS draft"></textarea>
            </div>
            <div class="mt-3">
              <label class="block text-xs font-medium text-gray-700 mb-1">Tags</label>
              <input v-model="form.tags" type="text" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="fungicide, mancozeb, WP, agriculture (comma separated)" />
            </div>
            <div class="mt-3">
              <label class="block text-xs font-medium text-gray-700 mb-1">Notes</label>
              <textarea v-model="form.notes" rows="2" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Additional notes..."></textarea>
            </div>
          </div>

          <div class="flex justify-end gap-3 pt-4 border-t">
            <button type="button" @click="showModal = false" class="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" :disabled="submitting" class="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {{ submitting ? 'Saving...' : editing ? 'Update' : 'Create Project' }}
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
const departments = ref<any[]>([]);
const showModal = ref(false);
const submitting = ref(false);
const editing = ref<any>(null);
const selectedIds = ref<number[]>([]);

const { toggleSort, sortIcon, sortedData } = useTableSort(items);

const emptyForm = () => ({
  project_code: '', name: '', project_type: 'new_product', category: 'chemical',
  description: '', objectives: '', expected_output: '', status: 'draft', priority: 'medium',
  risk_level: 'medium', confidentiality: 'internal', regulatory_requirements: '',
  target_market: '', target_product: '', project_leader_id: '', department_id: '',
  start_date: '', target_end_date: '', budget: 0, tags: '', notes: ''
});
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
const labelify = (s: string) => s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '-';

onMounted(async () => {
  await fetchItems();
  try { const r = await api.get('/users'); users.value = r.data.data || []; } catch {}
  try { const r = await api.get('/departments'); departments.value = r.data.data || r.data || []; } catch {}
});

async function fetchItems() {
  try { const res = await api.get('/rnd/projects'); items.value = res.data.data || []; } catch (err) { console.error(err); }
}

function openModal(item?: any) {
  editing.value = item || null;
  form.value = item ? { ...emptyForm(), ...item, start_date: item.start_date?.split('T')[0] || '', target_end_date: item.target_end_date?.split('T')[0] || '' } : emptyForm();
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
  try { await api.delete(`/rnd/projects/${id}`); await fetchItems(); } catch (err: any) { alert(err?.response?.data?.error || err.message); }
}

async function bulkDelete() {
  if (!confirm(`Delete ${selectedIds.value.length} projects?`)) return;
  try {
    for (const id of selectedIds.value) { await api.delete(`/rnd/projects/${id}`); }
    selectedIds.value = [];
    await fetchItems();
  } catch (err: any) {
    alert(err?.response?.data?.error || err.message);
  }
}
</script>
