<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">📂 Item Categories</h1>
        <p class="text-gray-600 mt-1">Organize your items into logical categories</p>
      </div>
      <div class="flex gap-3">
        <input
          ref="fileInput"
          type="file"
          accept=".xlsx,.xls,.csv"
          class="hidden"
          @change="handleFileSelect"
        />
        <button
          @click="downloadTemplate"
          class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors flex items-center gap-2"
        >
          📋 Template
        </button>
        <button
          @click="fileInput?.click()"
          class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors flex items-center gap-2"
        >
          📤 Import
        </button>
        <button
          @click="handleExport"
          class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors flex items-center gap-2"
        >
          📥 Export
        </button>
        <button
          @click="openAddModal"
          class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
        >
          + Add Category
        </button>
      </div>
    </div>

    <!-- Search -->
    <div class="flex gap-4">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search categories..."
        class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    <!-- Bulk Delete Bar -->
    <div v-if="selectedIds.length > 0" class="flex items-center gap-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
      <span class="text-sm font-medium text-red-700">{{ selectedIds.length }} item(s) selected</span>
      <button
        @click="bulkDelete"
        class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm transition-colors"
      >
        🗑️ Delete Selected
      </button>
      <button
        @click="selectedIds = []"
        class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm"
      >
        Cancel
      </button>
    </div>

    <!-- Categories Table -->
    <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 w-10">
              <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll" class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            </th>
            <th @click="toggleSort('name')" class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none">Name <span class="text-gray-400">{{ sortIcon('name') }}</span></th>
            <th @click="toggleSort('description')" class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none">Description <span class="text-gray-400">{{ sortIcon('description') }}</span></th>
            <th @click="toggleSort('active')" class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none">Status <span class="text-gray-400">{{ sortIcon('active') }}</span></th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr v-if="filteredCategories.length === 0" class="hover:bg-gray-50">
            <td colspan="5" class="px-6 py-4 text-center text-gray-500">No categories found</td>
          </tr>
          <tr v-for="category in sortedData" :key="category.id" class="hover:bg-gray-50 transition-colors" :class="{ 'bg-blue-50': selectedIds.includes(category.id) }">
            <td class="px-4 py-4">
              <input type="checkbox" :value="category.id" v-model="selectedIds" class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            </td>
            <td class="px-6 py-4 text-sm font-medium text-gray-900">{{ category.name }}</td>
            <td class="px-6 py-4 text-sm text-gray-700">{{ category.description || '-' }}</td>
            <td class="px-6 py-4 text-sm">
              <span
                :class="[
                  'px-3 py-1 rounded-full text-xs font-medium',
                  category.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                ]"
              >
                {{ category.active ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td class="px-6 py-4 text-sm space-x-2 flex gap-2">
              <button
                @click="editCategory(category)"
                class="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm font-medium"
              >
                Edit
              </button>
              <button
                @click="deleteCategory(category.id)"
                class="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm font-medium"
              >
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add/Edit Modal -->
    <Dialog :is-open="showModal" @update:is-open="showModal = $event">
      <template #title>
        {{ editingCategory ? 'Edit Category' : 'Add New Category' }}
      </template>

      <form @submit="handleSubmit" class="space-y-4">
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-gray-700">Name *</label>
          <input
            v-model="values.name"
            type="text"
            placeholder="e.g., Raw Materials"
            class="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p v-if="errors.name" class="text-xs text-red-500">{{ errors.name }}</p>
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-gray-700">Description</label>
          <textarea
            v-model="values.description"
            placeholder="Category description..."
            rows="3"
            class="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <p v-if="errors.description" class="text-xs text-red-500">{{ errors.description }}</p>
        </div>

        <div class="flex items-center gap-2">
          <input
            id="active"
            v-model="values.active"
            type="checkbox"
            class="w-4 h-4 rounded border-gray-300"
          />
          <label for="active" class="text-sm font-medium text-gray-700">Active</label>
        </div>
      </form>

      <template #actions="{ close }">
        <button
          @click="close"
          class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
        >
          Cancel
        </button>
        <button
          @click="handleSubmit"
          :disabled="isSubmitting"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          {{ isSubmitting ? 'Saving...' : 'Save' }}
        </button>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { exportToCSV } from '../utils/export';
import { ref, computed, onMounted } from 'vue';
import { useFormValidation } from '../composables/useFormValidation';
import { categorySchema, type CategoryFormData } from '../schemas/forms';
import { useCategoryStore } from '../stores/categories';
import Dialog from '../components/ui/Dialog.vue';
import { useApi } from '@/lib/api';
import { useTableSort } from '../composables/useTableSort';

const categoryStore = useCategoryStore();
const { api } = useApi();

const showModal = ref(false);
const searchQuery = ref('');
const editingCategory = ref<any>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const selectedIds = ref<number[]>([]);

const isAllSelected = computed(() => {
  return filteredCategories.value.length > 0 && filteredCategories.value.every(c => selectedIds.value.includes(c.id));
});

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedIds.value = [];
  } else {
    selectedIds.value = filteredCategories.value.map(c => c.id);
  }
};

const bulkDelete = async () => {
  if (!confirm(`Are you sure you want to delete ${selectedIds.value.length} categories?`)) return;
  try {
    for (const id of selectedIds.value) {
      await categoryStore.deleteCategory(id);
    }
    selectedIds.value = [];
  } catch (error) {
    console.error('Error bulk deleting:', error);
  }
};

onMounted(async () => {
  await categoryStore.fetchCategories();
});

const categories = computed(() => categoryStore.categories);

const filteredCategories = computed(() => {
  return categories.value.filter((c) => {
    return (
      !searchQuery.value ||
      c.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(searchQuery.value.toLowerCase()))
    );
  });
});

const { toggleSort, sortIcon, sortedData } = useTableSort(filteredCategories);

const { handleSubmit, values, errors, isSubmitting, resetForm } = useFormValidation(
  categorySchema,
  async (formData: CategoryFormData) => {
    try {
      if (editingCategory.value) {
        await categoryStore.updateCategory(editingCategory.value.id, formData);
      } else {
        await categoryStore.createCategory(formData);
      }
      showModal.value = false;
      resetForm();
      editingCategory.value = null;
    } catch (error) {
      console.error('Error saving category:', error);
    }
  }
);

const openAddModal = () => {
  editingCategory.value = null;
  resetForm();
  Object.assign(values, { name: '', description: '', active: true });
  showModal.value = true;
};

const editCategory = (category: any) => {
  editingCategory.value = category;
  Object.assign(values, category);
  showModal.value = true;
};

const deleteCategory = async (id: number) => {
  if (!confirm('Are you sure you want to delete this category?')) return;
  try {
    await categoryStore.deleteCategory(id);
  } catch (error) {
    console.error('Error deleting category:', error);
  }
};

// Import functions
const selectedFile = ref<File | null>(null);

async function downloadTemplate() {
  try {
    const response = await api.get('/import/template/categories', {
      responseType: 'blob'
    });
    
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'template_categories.xlsx');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (err: any) {
    alert('Failed to download template');
  }
}

async function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  
  selectedFile.value = file;
  
  if (!confirm(`Import "${file.name}"?`)) {
    selectedFile.value = null;
    if (fileInput.value) fileInput.value.value = '';
    return;
  }
  
  await previewImport();
}

async function previewImport() {
  if (!selectedFile.value) return;
  
  const formData = new FormData();
  formData.append('file', selectedFile.value);
  
  try {
    const response = await api.post('/import/preview/categories', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    
    const { success, validation } = response.data;
    
    if (!success) {
      alert(`Validation failed!\n${validation.firstError?.errors?.join(', ') || 'Unknown error'}`);
      selectedFile.value = null;
      if (fileInput.value) fileInput.value.value = '';
      return;
    }
    
    if (confirm(`Ready to import ${validation.totalRows} categories. Continue?`)) {
      await performImport();
    } else {
      selectedFile.value = null;
      if (fileInput.value) fileInput.value.value = '';
    }
  } catch (err: any) {
    alert('Preview failed: ' + (err.response?.data?.error || err.message));
    selectedFile.value = null;
    if (fileInput.value) fileInput.value.value = '';
  }
}

async function performImport() {
  if (!selectedFile.value) return;
  
  const formData = new FormData();
  formData.append('file', selectedFile.value);
  
  try {
    const response = await api.post('/import/import/categories', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    
    alert(`✅ ${response.data.message}`);
    await categoryStore.fetchCategories();
    
    selectedFile.value = null;
    if (fileInput.value) fileInput.value.value = '';
  } catch (err: any) {
    alert('Import failed: ' + (err.response?.data?.error || err.message));
  }
}

function handleExport() {
  exportToCSV(categories.value, 'Categories_Export');
}

</script>
