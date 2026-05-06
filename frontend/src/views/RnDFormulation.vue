<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">🧪 Formulations</h1>
        <p class="text-sm text-gray-500 mt-1">Chemical formula & recipe management</p>
      </div>
      <button @click="openModal()" class="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium text-sm">+ New Formulation</button>
    </div>

    <div v-if="selectedIds.length" class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
      <span class="text-sm font-medium text-red-700">{{ selectedIds.length }} selected</span>
      <button @click="bulkDelete" class="px-3 py-1 bg-red-600 text-white rounded text-sm">🗑️ Delete</button>
    </div>

    <div class="bg-white rounded-xl border shadow-sm overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="px-4 py-3 text-left w-10"><input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll" /></th>
            <th class="px-4 py-3 text-left cursor-pointer hover:bg-gray-100" @click="toggleSort('formula_code')">Code {{ sortIcon('formula_code') }}</th>
            <th class="px-4 py-3 text-left cursor-pointer hover:bg-gray-100" @click="toggleSort('name')">Name {{ sortIcon('name') }}</th>
            <th class="px-4 py-3 text-left">Version</th>
            <th class="px-4 py-3 text-left">Status</th>
            <th class="px-4 py-3 text-left">Project</th>
            <th class="px-4 py-3 text-left">Created</th>
            <th class="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in sortedData" :key="item.id" class="border-b hover:bg-gray-50">
            <td class="px-4 py-3"><input type="checkbox" :checked="selectedIds.includes(item.id)" @change="toggleSelect(item.id)" /></td>
            <td class="px-4 py-3 font-mono text-xs text-emerald-600 font-medium">{{ item.formula_code }}</td>
            <td class="px-4 py-3 font-medium">{{ item.name }}</td>
            <td class="px-4 py-3"><span class="px-2 py-0.5 bg-gray-100 rounded text-xs">v{{ item.version }}</span></td>
            <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="statusClass(item.status)">{{ item.status }}</span></td>
            <td class="px-4 py-3 text-gray-600 text-xs">{{ item.project_name || '-' }}</td>
            <td class="px-4 py-3 text-gray-500 text-xs">{{ formatDate(item.created_at) }}</td>
            <td class="px-4 py-3 text-right space-x-1">
              <button @click="openModal(item)" class="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit</button>
              <button @click="deleteItem(item.id)" class="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button>
            </td>
          </tr>
          <tr v-if="!items.length"><td colspan="8" class="px-4 py-8 text-center text-gray-400">No formulations yet</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div class="px-6 py-4 border-b bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-t-2xl">
          <h3 class="text-lg font-semibold">{{ editing ? 'Edit Formulation' : 'New Formulation' }}</h3>
        </div>
        <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Formula Code *</label>
              <input v-model="form.formula_code" type="text" required class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="FRM-001" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Name *</label>
              <input v-model="form.name" type="text" required class="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Version</label>
              <input v-model="form.version" type="text" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="1.0" />
            </div>
          </div>
          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select v-model="form.status" class="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="draft">Draft</option><option value="testing">Testing</option>
                <option value="approved">Approved</option><option value="revision">Revision</option>
                <option value="obsolete">Obsolete</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">R&D Project</label>
              <select v-model="form.project_id" class="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">-- None --</option>
                <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.project_code }} - {{ p.name }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Target Specs</label>
              <input v-model="form.target_specs" type="text" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="pH 6.5-7.5, viscosity 500cP" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea v-model="form.description" rows="2" class="w-full px-3 py-2 border rounded-lg text-sm"></textarea>
          </div>

          <!-- Ingredients -->
          <div class="border rounded-lg p-4 bg-gray-50">
            <div class="flex items-center justify-between mb-3">
              <h4 class="text-sm font-semibold text-gray-700">📋 Ingredients</h4>
              <button type="button" @click="addIngredient" class="text-xs bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-700">+ Add Ingredient</button>
            </div>
            <div v-for="(ing, idx) in form.ingredients" :key="idx" class="grid grid-cols-12 gap-2 mb-2 items-end">
              <div class="col-span-4">
                <input v-model="ing.ingredient_name" type="text" placeholder="Ingredient name" class="w-full px-2 py-1.5 border rounded text-sm" />
              </div>
              <div class="col-span-2">
                <input v-model.number="ing.quantity" type="number" step="0.01" placeholder="Qty" class="w-full px-2 py-1.5 border rounded text-sm" />
              </div>
              <div class="col-span-1">
                <input v-model="ing.unit" type="text" placeholder="kg" class="w-full px-2 py-1.5 border rounded text-sm" />
              </div>
              <div class="col-span-2">
                <input v-model.number="ing.percentage" type="number" step="0.01" placeholder="%" class="w-full px-2 py-1.5 border rounded text-sm" />
              </div>
              <div class="col-span-2">
                <input v-model="ing.function_role" type="text" placeholder="Function" class="w-full px-2 py-1.5 border rounded text-sm" />
              </div>
              <div class="col-span-1 text-center">
                <button type="button" @click="form.ingredients.splice(idx, 1)" class="text-red-500 hover:text-red-700 text-lg">×</button>
              </div>
            </div>
            <p v-if="!form.ingredients.length" class="text-xs text-gray-400 text-center py-2">No ingredients added</p>
          </div>

          <div class="flex justify-end gap-3 pt-4 border-t">
            <button type="button" @click="showModal = false" class="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" :disabled="submitting" class="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
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
const projects = ref<any[]>([]);
const showModal = ref(false);
const submitting = ref(false);
const editing = ref<any>(null);
const selectedIds = ref<number[]>([]);

const { toggleSort, sortIcon, sortedData } = useTableSort(items);

const emptyForm = () => ({ formula_code: '', name: '', version: '1.0', project_id: '', status: 'draft', target_specs: '', description: '', notes: '', ingredients: [] as any[] });
const form = ref(emptyForm());

const isAllSelected = computed(() => items.value.length > 0 && items.value.every(i => selectedIds.value.includes(i.id)));
const toggleSelectAll = () => { isAllSelected.value ? selectedIds.value = [] : selectedIds.value = items.value.map(i => i.id); };
const toggleSelect = (id: number) => { selectedIds.value.includes(id) ? selectedIds.value = selectedIds.value.filter(i => i !== id) : selectedIds.value.push(id); };

const statusClass = (s: string) => ({ draft: 'bg-gray-100 text-gray-700', testing: 'bg-yellow-100 text-yellow-700', approved: 'bg-green-100 text-green-700', revision: 'bg-orange-100 text-orange-700', obsolete: 'bg-red-100 text-red-700' }[s] || 'bg-gray-100');
const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('id-ID') : '-';

const addIngredient = () => { form.value.ingredients.push({ ingredient_name: '', quantity: 0, unit: 'kg', percentage: null, function_role: '', notes: '' }); };

onMounted(async () => {
  await fetchItems();
  try { const res = await api.get('/rnd/projects'); projects.value = res.data.data || []; } catch {}
});

async function fetchItems() {
  try { const res = await api.get('/rnd/formulations'); items.value = res.data.data || []; } catch (err) { console.error(err); }
}

async function openModal(item?: any) {
  editing.value = item || null;
  if (item) {
    try {
      const res = await api.get(`/rnd/formulations/${item.id}`);
      const data = res.data.data;
      form.value = { ...data, ingredients: data.ingredients || [] };
    } catch { form.value = { ...item, ingredients: [] }; }
  } else { form.value = emptyForm(); }
  showModal.value = true;
}

async function handleSubmit() {
  submitting.value = true;
  try {
    if (editing.value) { await api.put(`/rnd/formulations/${editing.value.id}`, form.value); }
    else { await api.post('/rnd/formulations', form.value); }
    showModal.value = false;
    await fetchItems();
  } catch (err: any) { alert(err.response?.data?.error || err.message); }
  finally { submitting.value = false; }
}

async function deleteItem(id: number) {
  if (!confirm('Delete this formulation?')) return;
  try { await api.delete(`/rnd/formulations/${id}`); await fetchItems(); } catch (err: any) { alert(err.message); }
}

async function bulkDelete() {
  if (!confirm(`Delete ${selectedIds.value.length} formulations?`)) return;
  for (const id of selectedIds.value) { await api.delete(`/rnd/formulations/${id}`); }
  selectedIds.value = [];
  await fetchItems();
}
</script>
