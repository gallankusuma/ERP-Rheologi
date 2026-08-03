<template>
  <div class="min-h-screen bg-[#f4f6fb] font-sans text-slate-600">
    <!-- Header -->
    <div class="bg-white border-b border-gray-100 sticky top-0 z-20">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <div class="flex items-center gap-4">
            <h1 class="text-xl font-bold text-slate-800 tracking-tight">Client Categories</h1>
            <span class="text-sm text-slate-400">Manage client type categories</span>
          </div>
          <button @click="openModal()" class="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all shadow-lg shadow-blue-500/30">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
            Add Category
          </button>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Loading -->
      <div v-if="loading" class="text-center py-16">
        <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p class="text-sm text-slate-400">Loading categories...</p>
      </div>

      <!-- Table -->
      <div v-else class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table class="min-w-full divide-y divide-slate-100">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">#</th>
              <th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
              <th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Code</th>
              <th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
              <th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Color</th>
              <th class="px-6 py-4 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 bg-white">
            <tr v-for="(cat, idx) in categories" :key="cat.id" class="group hover:bg-blue-50/30 transition-colors">
              <td class="px-6 py-4 text-sm text-slate-400">{{ idx + 1 }}</td>
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" :style="{ backgroundColor: cat.color || '#3B82F6' }">
                    {{ cat.code?.substring(0, 2) }}
                  </div>
                  <span class="text-sm font-semibold text-slate-800">{{ cat.name }}</span>
                </div>
              </td>
              <td class="px-6 py-4">
                <span class="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-mono font-medium">{{ cat.code }}</span>
              </td>
              <td class="px-6 py-4 text-sm text-slate-500">{{ cat.description || '-' }}</td>
              <td class="px-6 py-4">
                <div class="flex items-center gap-2">
                  <div class="w-5 h-5 rounded-full border border-slate-200" :style="{ backgroundColor: cat.color || '#3B82F6' }"></div>
                  <span class="text-xs text-slate-400 font-mono">{{ cat.color || '#3B82F6' }}</span>
                </div>
              </td>
              <td class="px-6 py-4 text-center">
                <div class="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button @click="openModal(cat)" class="p-1.5 rounded-lg hover:bg-blue-100 text-slate-400 hover:text-blue-600 transition-colors" title="Edit">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button @click="deleteCategory(cat.id)" class="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors" title="Delete">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Empty State -->
        <div v-if="!categories.length && !loading" class="text-center py-16 text-slate-400">
          <div class="text-5xl mb-3">📂</div>
          <div class="text-sm">No categories yet</div>
          <div class="text-xs mt-1">Click "Add Category" to create one</div>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity" @click.self="showModal = false">
      <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4">
        <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h2 class="text-lg font-bold text-slate-800">{{ editingId ? 'Edit Category' : 'New Category' }}</h2>
          <button @click="showModal = false" class="text-slate-400 hover:text-slate-600 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form @submit.prevent="saveCategory" class="p-6 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <label class="text-sm font-semibold text-slate-700">Name <span class="text-red-500">*</span></label>
              <input v-model="form.name" type="text" required class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-sm" placeholder="e.g. Buyer" />
            </div>
            <div class="space-y-1">
              <label class="text-sm font-semibold text-slate-700">Code <span class="text-red-500">*</span></label>
              <input v-model="form.code" type="text" required maxlength="10" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-sm font-mono uppercase" placeholder="e.g. BUY" />
              <p class="text-xs text-slate-400">Used as prefix for client code (e.g. BUY-0001)</p>
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-sm font-semibold text-slate-700">Description</label>
            <input v-model="form.description" type="text" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-sm" placeholder="Optional description" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <label class="text-sm font-semibold text-slate-700">Color</label>
              <div class="flex items-center gap-2">
                <input v-model="form.color" type="color" class="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5" />
                <input v-model="form.color" type="text" class="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono outline-none" />
              </div>
            </div>
            <div class="space-y-1">
              <label class="text-sm font-semibold text-slate-700">Sort Order</label>
              <input v-model.number="form.sort_order" type="number" min="0" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-sm" />
            </div>
          </div>
          <div class="pt-4 border-t border-slate-100 flex gap-3 justify-end">
            <button type="button" @click="showModal = false" class="px-5 py-2 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors text-sm">Cancel</button>
            <button type="submit" :disabled="saving" class="px-5 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all text-sm disabled:opacity-50">
              {{ saving ? 'Saving...' : (editingId ? 'Update' : 'Create') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '@/lib/api';

const categories = ref<any[]>([]);
const loading = ref(true);
const showModal = ref(false);
const editingId = ref<number | null>(null);
const saving = ref(false);
const form = ref({
  name: '',
  code: '',
  description: '',
  color: '#3B82F6',
  sort_order: 0
});

const fetchCategories = async () => {
  loading.value = true;
  try {
    const res = await api.get('/clients/categories/all');
    categories.value = res.data?.data || [];
  } catch (err) {
    console.error('Failed to load categories:', err);
    categories.value = [];
  } finally {
    loading.value = false;
  }
};

const openModal = (cat?: any) => {
  if (cat) {
    editingId.value = cat.id;
    form.value = {
      name: cat.name,
      code: cat.code,
      description: cat.description || '',
      color: cat.color || '#3B82F6',
      sort_order: cat.sort_order || 0
    };
  } else {
    editingId.value = null;
    form.value = { name: '', code: '', description: '', color: '#3B82F6', sort_order: 0 };
  }
  showModal.value = true;
};

const saveCategory = async () => {
  saving.value = true;
  try {
    if (editingId.value) {
      await api.put(`/clients/categories/${editingId.value}`, form.value);
    } else {
      await api.post('/clients/categories', form.value);
    }
    showModal.value = false;
    await fetchCategories();
  } catch (err: any) {
    alert(err.response?.data?.error || 'Failed to save category');
  } finally {
    saving.value = false;
  }
};

const deleteCategory = async (id: number) => {
  if (!confirm('Delete this category?')) return;
  try {
    await api.delete(`/clients/categories/${id}`);
    await fetchCategories();
  } catch (err) {
    console.error('Failed to delete category:', err);
    alert('Failed to delete category');
  }
};

onMounted(fetchCategories);
</script>
