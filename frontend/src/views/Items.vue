<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">📦 Master Items</h1>
        <p class="text-gray-600 mt-1">Manage inventory and non-inventory items (SKU registry)</p>
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
          📋 Download Template
        </button>
        <button
          @click="triggerFileInput"
          class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors flex items-center gap-2"
        >
          📤 Import Excel
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
          + Add Item
        </button>
      </div>
    </div>

    <!-- Search Bar -->
    <div class="flex items-center gap-3">
      <div class="relative flex-1 max-w-md">
        <span class="absolute inset-y-0 left-3 flex items-center text-gray-400">🔍</span>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search by SKU, name, category, or type..."
          class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
      </div>
      <span class="text-sm text-gray-500">{{ sortedData.length }} of {{ items.length }} items</span>
    </div>

    <!-- Bulk Delete Bar -->
    <div v-if="selectedIds.length > 0" class="flex items-center gap-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
      <span class="text-sm font-medium text-red-700">{{ selectedIds.length }} item(s) selected</span>
      <button @click="bulkDelete" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm">🗑️ Delete Selected</button>
      <button @click="selectedIds = []" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm">Cancel</button>
    </div>

    <!-- Items Table -->
    <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 w-10">
              <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll" class="w-4 h-4 rounded border-gray-300 text-blue-600" />
            </th>
            <th @click="toggleSort('sku')" class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none">SKU <span class="text-gray-400">{{ sortIcon('sku') }}</span></th>
            <th @click="toggleSort('name')" class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none">Item Name <span class="text-gray-400">{{ sortIcon('name') }}</span></th>
            <th @click="toggleSort('category_name')" class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none">Category <span class="text-gray-400">{{ sortIcon('category_name') }}</span></th>
            <th @click="toggleSort('item_type')" class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none">Type <span class="text-gray-400">{{ sortIcon('item_type') }}</span></th>
            <th @click="toggleSort('unit_name')" class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none">Unit <span class="text-gray-400">{{ sortIcon('unit_name') }}</span></th>
            <th @click="toggleSort('active')" class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none">Status <span class="text-gray-400">{{ sortIcon('active') }}</span></th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr v-if="items.length === 0" class="hover:bg-gray-50">
            <td colspan="8" class="px-6 py-4 text-center text-gray-500">No items found. Click "Add Item" to create.</td>
          </tr>
          <tr v-for="item in sortedData" :key="item.id" class="hover:bg-gray-50 transition-colors" :class="{ 'bg-blue-50': selectedIds.includes(item.id) }">
            <td class="px-4 py-4">
              <input type="checkbox" :value="item.id" v-model="selectedIds" class="w-4 h-4 rounded border-gray-300 text-blue-600" />
            </td>
            <td class="px-6 py-4 text-sm font-mono font-medium text-blue-600">{{ item.sku }}</td>
            <td class="px-6 py-4 text-sm text-gray-900">{{ item.name }}</td>
            <td class="px-6 py-4 text-sm text-gray-700">{{ item.category_name || '-' }}</td>
            <td class="px-6 py-4 text-sm">
              <span :class="[
                'px-2 py-1 rounded text-xs font-medium',
                item.item_type === 'inventory' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
              ]">
                {{ item.item_type === 'inventory' ? 'Inventory' : 'Non-Inventory' }}
              </span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-700">{{ item.unit_name || item.uom || '-' }}</td>
            <td class="px-6 py-4 text-sm">
              <span :class="[
                'px-3 py-1 rounded-full text-xs font-medium',
                item.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              ]">
                {{ item.active ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td class="px-6 py-4 text-sm space-x-2 flex gap-2">
              <button
                @click="editItem(item)"
                class="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm font-medium"
              >
                Edit
              </button>
              <button
                @click="deleteItem(item.id)"
                class="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm font-medium"
              >
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Import Preview Section -->
    <div v-if="showImportPreview" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">📋 Import Preview</h3>
            <p class="text-sm text-gray-600 mt-1">{{ previewData.length }} rows ready to import</p>
          </div>
          <button @click="closeImportPreview" class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>

        <div class="p-6">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 border border-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-700">SKU</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-700">Name</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-700">Description</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-700">Category</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-700">Unit</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-700">Type</th>
                  <th class="px-4 py-3 text-right text-xs font-medium text-gray-700">Standard Cost</th>
                  <th class="px-4 py-3 text-right text-xs font-medium text-gray-700">Reorder Point</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="(row, index) in previewData.slice(0, 50)" :key="index" class="hover:bg-gray-50">
                  <td class="px-4 py-3 text-sm font-mono">{{ row.sku }}</td>
                  <td class="px-4 py-3 text-sm">{{ row.name }}</td>
                  <td class="px-4 py-3 text-sm text-gray-600">{{ row.description || '-' }}</td>
                  <td class="px-4 py-3 text-sm">{{ row.category }}</td>
                  <td class="px-4 py-3 text-sm">{{ row.unit }}</td>
                  <td class="px-4 py-3 text-sm">
                    <span :class="[
                      'px-2 py-1 rounded text-xs',
                      row.item_type === 'inventory' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                    ]">
                      {{ row.item_type }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-sm text-right">{{ Number(row.standard_cost || 0).toLocaleString() }}</td>
                  <td class="px-4 py-3 text-sm text-right">{{ row.reorder_point || 0 }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div class="flex gap-3 justify-end mt-6">
            <button
              @click="closeImportPreview"
              class="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              @click="confirmImport"
              :disabled="importing"
              class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ importing ? '⏳ Importing...' : '✅ Confirm Import' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 class="text-lg font-semibold text-gray-900">{{ editingItem ? 'Edit Item' : 'Add New Item' }}</h3>
          <button @click="closeModal" class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>
        <div v-if="editingItem" class="px-6 border-b border-gray-200 bg-gray-50">
          <nav class="-mb-px flex space-x-8">
            <button @click="modalTab = 'basic'" :class="[modalTab === 'basic' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700', 'whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm']">Basic Info</button>
            <button @click="modalTab = 'qc'" :class="[modalTab === 'qc' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700', 'whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm']">QC Specs</button>
          </nav>
        </div>
        <div v-show="modalTab === 'basic'">
        <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
              <input
                v-model="form.sku"
                type="text"
                placeholder="e.g., SKU001"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                :disabled="editingItem"
              />
              <p v-if="errors.sku" class="text-xs text-red-500 mt-1">{{ errors.sku }}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
              <input
                v-model="form.name"
                type="text"
                placeholder="Item name"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p v-if="errors.name" class="text-xs text-red-500 mt-1">{{ errors.name }}</p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <select
                v-model="form.category_id"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select Category --</option>
                <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                  {{ cat.name }}
                </option>
              </select>
              <p v-if="errors.category_id" class="text-xs text-red-500 mt-1">{{ errors.category_id }}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Item Type *</label>
              <select
                v-model="form.product_type_id"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select Type --</option>
                <option v-for="type in productTypes" :key="type.id" :value="type.id">
                  {{ type.name }}
                </option>
              </select>
              <p v-if="errors.product_type_id" class="text-xs text-red-500 mt-1">{{ errors.product_type_id }}</p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Unit of Measure *</label>
              <select
                v-model="form.unit_id"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select Unit --</option>
                <option v-for="unit in units" :key="unit.id" :value="unit.id">
                  {{ unit.code }} - {{ unit.name }}
                </option>
              </select>
              <p v-if="errors.unit_id" class="text-xs text-red-500 mt-1">{{ errors.unit_id }}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                v-model="form.is_active"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option :value="true">Active</option>
                <option :value="false">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              v-model="form.description"
              rows="3"
              placeholder="Item description"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            ></textarea>
          </div>

          <div v-if="form.item_type === 'inventory'" class="bg-blue-50 border border-blue-200 p-4 rounded-lg space-y-3">
            <h4 class="text-sm font-semibold text-blue-900">Inventory Settings</h4>
            <div class="grid grid-cols-3 gap-4">
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Min Stock Level</label>
                <input
                  v-model.number="form.min_stock"
                  type="number"
                  placeholder="0"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Max Stock Level</label>
                <input
                  v-model.number="form.max_stock"
                  type="number"
                  placeholder="0"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Reorder Point</label>
                <input
                  v-model.number="form.reorder_point"
                  type="number"
                  placeholder="0"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div class="flex gap-3 justify-end pt-4 border-t">
            <button
              type="button"
              @click="closeModal"
              class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="submitting"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:bg-gray-400"
            >
              {{ submitting ? 'Saving...' : editingItem ? 'Update' : 'Create' }}
            </button>
          </div>
        </form>
        </div>
        <div v-if="modalTab === 'qc'" class="p-6 space-y-6">
          <div class="flex justify-between items-center">
            <h4 class="text-sm font-semibold text-gray-900">Quality Control Specifications</h4>
            <button @click="showAddSpec = true" class="px-3 py-1.5 bg-blue-100 text-blue-700 rounded text-sm font-medium hover:bg-blue-200">+ Add Spec</button>
          </div>
          <div v-if="showAddSpec" class="bg-gray-50 p-4 rounded-lg border border-gray-200 grid grid-cols-2 gap-4">
            <div><label class="block text-xs font-medium text-gray-700 mb-1">Parameter</label><select v-model="newSpec.parameter_id" class="w-full px-2 py-1.5 text-sm border rounded"><option value="">-- Select --</option><option v-for="p in qcParams" :key="p.id" :value="p.id">{{ p.name }}</option></select></div>
            <div><label class="block text-xs font-medium text-gray-700 mb-1">Method</label><select v-model="newSpec.method_id" class="w-full px-2 py-1.5 text-sm border rounded"><option value="">-- Optional --</option><option v-for="m in qcMethods" :key="m.id" :value="m.id">{{ m.name }}</option></select></div>
            <div><label class="block text-xs font-medium text-gray-700 mb-1">Standard Value</label><input v-model="newSpec.standard_value" type="text" placeholder="e.g. 6.5-7.5" class="w-full px-2 py-1.5 text-sm border rounded" /></div>
            <div class="flex gap-2"><div class="flex-1"><label class="block text-xs font-medium text-gray-700 mb-1">Min</label><input v-model="newSpec.min_value" type="number" step="0.01" class="w-full px-2 py-1.5 text-sm border rounded" /></div><div class="flex-1"><label class="block text-xs font-medium text-gray-700 mb-1">Max</label><input v-model="newSpec.max_value" type="number" step="0.01" class="w-full px-2 py-1.5 text-sm border rounded" /></div></div>
            <div class="col-span-2 flex justify-end gap-2 mt-2"><button @click="showAddSpec = false" class="px-3 py-1.5 border rounded text-sm text-gray-600">Cancel</button><button @click="saveQCSpec" class="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Save</button></div>
          </div>
          <table class="min-w-full divide-y divide-gray-200 border"><thead class="bg-gray-50"><tr><th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Parameter</th><th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Method</th><th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Standard</th><th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Min/Max</th><th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Action</th></tr></thead><tbody class="divide-y divide-gray-200 bg-white"><tr v-for="spec in itemQCSpecs" :key="spec.id"><td class="px-4 py-2 text-sm text-gray-900 font-medium">{{ spec.parameter_name }}</td><td class="px-4 py-2 text-sm text-gray-600">{{ spec.method_name || '-' }}</td><td class="px-4 py-2 text-sm text-gray-600">{{ spec.standard_value || '-' }}</td><td class="px-4 py-2 text-sm text-gray-600">{{ spec.min_value ?? '-' }} / {{ spec.max_value ?? '-' }}</td><td class="px-4 py-2 text-sm text-right"><button @click="deleteQCSpec(spec.id)" class="text-red-600 hover:text-red-900">Delete</button></td></tr><tr v-if="itemQCSpecs.length === 0"><td colspan="5" class="px-4 py-6 text-center text-sm text-gray-500">No QC Specifications defined.</td></tr></tbody></table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { exportToCSV } from '../utils/export';
import { ref, computed, onMounted } from 'vue';
import { api } from '../lib/api';
import { useTableSort } from '../composables/useTableSort';

const items = ref<any[]>([]);
const categories = ref<any[]>([]);
const units = ref<any[]>([]);
const productTypes = ref<any[]>([]);
const showModal = ref(false);
const modalTab = ref('basic');
const submitting = ref(false);
const editingItem = ref<any>(null);
const errors = ref<any>({});
const selectedIds = ref<number[]>([]);
const searchQuery = ref('');
const qcParams = ref<any[]>([]);
const qcMethods = ref<any[]>([]);
const itemQCSpecs = ref<any[]>([]);
const showAddSpec = ref(false);
const newSpec = ref<any>({ parameter_id: '', method_id: '', standard_value: '', min_value: '', max_value: '' });

const isAllSelected = computed(() => items.value.length > 0 && items.value.every((i: any) => selectedIds.value.includes(i.id)));
const toggleSelectAll = () => { if (isAllSelected.value) { selectedIds.value = []; } else { selectedIds.value = items.value.map((i: any) => i.id); } };
const bulkDelete = async () => {
  if (!confirm(`Delete ${selectedIds.value.length} items? This cannot be undone.`)) return;
  try {
    for (const id of selectedIds.value) { 
      try {
        await api.delete(`/products/${id}`); 
      } catch (err: any) {
        throw new Error(err.response?.data?.error || 'Some items failed to delete');
      }
    }
    selectedIds.value = [];
  } catch (err: any) { 
    alert(err.message); 
    console.error(err); 
  } finally {
    await fetchItems();
  }
};

const filteredItems = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();
  if (!q) return items.value;
  return items.value.filter((item: any) =>
    (item.sku || '').toLowerCase().includes(q) ||
    (item.name || '').toLowerCase().includes(q) ||
    (item.category_name || '').toLowerCase().includes(q) ||
    (item.item_type || '').toLowerCase().includes(q) ||
    (item.unit_name || '').toLowerCase().includes(q) ||
    (item.description || '').toLowerCase().includes(q)
  );
});

const { toggleSort, sortIcon, sortedData } = useTableSort(filteredItems);

const form = ref({
  sku: '',
  name: '',
  category_id: '',
  product_type_id: '',
  unit_id: '',
  description: '',
  is_active: true,
  min_stock: 0,
  max_stock: 0,
  reorder_point: 0,
  item_type: 'inventory',
});

onMounted(async () => {
  await fetchItems();
  await fetchCategories();
  await fetchUnits();
  await fetchProductTypes();
  try { const pR = await api.get('/qc/parameters'); qcParams.value = pR.data.data || []; const mR = await api.get('/qc/methods'); qcMethods.value = mR.data.data || []; } catch(e) { console.error(e); }
});

async function fetchItems() {
  try {
    const res = await api.get('/products');
    items.value = res.data.data || [];
  } catch (err) {
    console.error('Error fetching items:', err);
  }
}

async function fetchCategories() {
  try {
    const res = await api.get('/categories');
    categories.value = res.data.data || [];
  } catch (err) {
    console.error('Error fetching categories:', err);
  }
}

async function fetchUnits() {
  try {
    const res = await api.get('/units');
    units.value = res.data.data || [];
  } catch (err) {
    console.error('Error fetching units:', err);
  }
}

async function fetchProductTypes() {
  try {
    const res = await api.get('/item-types');
    productTypes.value = res.data.data || [];
  } catch (err) {
    console.error('Error fetching product types:', err);
  }
}

function openAddModal() {
  editingItem.value = null;
  modalTab.value = 'basic';
  form.value = {
    sku: '',
    name: '',
    category_id: '',
    product_type_id: '',
    unit_id: '',
    description: '',
    is_active: true,
    min_stock: 0,
    max_stock: 0,
    reorder_point: 0,
    item_type: 'inventory',
  };
  errors.value = {};
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  editingItem.value = null;
  errors.value = {};
}

function editItem(item: any) {
  editingItem.value = item;
  modalTab.value = 'basic';
  fetchQCSpecs(item.id);
  form.value = {
    sku: item.sku || '',
    name: item.name || '',
    category_id: item.category_id || '',
    product_type_id: item.product_type_id || '',
    unit_id: item.unit_of_measure_id || '',
    description: item.description || '',
    is_active: item.active === 1 || item.active === true,
    min_stock: item.min_stock || 0,
    max_stock: item.max_stock || 0,
    reorder_point: item.reorder_point || 0,
    item_type: item.item_type || 'inventory',
  };
  errors.value = {};
  showModal.value = true;
}

async function handleSubmit() {
  errors.value = {};

  // Validation
  if (!form.value.sku) errors.value.sku = 'SKU is required';
  if (!form.value.name) errors.value.name = 'Item name is required';
  if (!form.value.category_id) errors.value.category_id = 'Category is required';
  if (!form.value.product_type_id) errors.value.product_type_id = 'Item type is required';
  if (!form.value.unit_id) errors.value.unit_id = 'Unit is required';

  // Duplicate Check
  const normalizeStr = (str: string) => (str || '').toLowerCase().replace(/\s+/g, '');

  if (form.value.sku) {
    const normalizedNewSku = normalizeStr(form.value.sku);
    const isDuplicateSku = items.value.some(item => {
      if (!item || !item.sku) return false;
      return normalizeStr(item.sku) === normalizedNewSku && (!editingItem.value || item.id !== editingItem.value.id);
    });
    if (isDuplicateSku) errors.value.sku = 'Warning: SKU ini sudah digunakan!';
  }

  if (form.value.name) {
    const normalizedNewName = normalizeStr(form.value.name);
    const isDuplicateName = items.value.some(item => {
      if (!item || !item.name) return false;
      return normalizeStr(item.name) === normalizedNewName && (!editingItem.value || item.id !== editingItem.value.id);
    });
    if (isDuplicateName) errors.value.name = 'Warning: Nama item ini sudah digunakan!';
  }

  if (Object.keys(errors.value).length > 0) return;

  submitting.value = true;
  try {
    const payload = {
      sku: form.value.sku,
      name: form.value.name,
      category_id: form.value.category_id,
      product_type_id: form.value.product_type_id,
      unit_id: form.value.unit_id,
      description: form.value.description,
      is_active: form.value.is_active,
      standard_cost: 0,
      reorder_point: form.value.reorder_point,
    };

    if (editingItem.value) {
      await api.put(`/products/${editingItem.value.id}`, payload);
      } else {
      await api.post('/products', payload);
    }

    closeModal();
    await fetchItems();
  } catch (err: any) {
    errors.value.submit = err.response?.data?.error || 'Failed to save item';
  } finally {
    submitting.value = false;
  }
}

async function deleteItem(id: number) {
  if (!confirm('Delete this item? This action cannot be undone.')) return;

  try {
    await api.delete(`/products/${id}`);
    await fetchItems();
  } catch (err) {
    alert('Failed to delete item');
    console.error('Error deleting item:', err);
  }
}

// QC Functions
async function fetchQCSpecs(productId: number) { try { const res = await api.get(`/qc/specs/${productId}`); itemQCSpecs.value = res.data.data || []; } catch(e) { console.error(e); } }
async function saveQCSpec() { if (!newSpec.value.parameter_id) return alert('Parameter is required'); try { await api.post('/qc/specs', { product_id: editingItem.value.id, parameter_id: newSpec.value.parameter_id, method_id: newSpec.value.method_id || null, standard_value: newSpec.value.standard_value, min_value: newSpec.value.min_value || null, max_value: newSpec.value.max_value || null }); showAddSpec.value = false; newSpec.value = { parameter_id: '', method_id: '', standard_value: '', min_value: '', max_value: '' }; await fetchQCSpecs(editingItem.value.id); } catch(e) { alert('Failed to save spec'); } }
async function deleteQCSpec(specId: number) { if(!confirm('Delete this spec?')) return; try { await api.delete(`/qc/specs/${specId}`); await fetchQCSpecs(editingItem.value.id); } catch(e) { console.error(e); } }

// Import functions
const fileInput = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const importing = ref(false);
const showImportPreview = ref(false);
const previewData = ref<any[]>([]);

async function downloadTemplate() {
  try {
    const response = await api.get('/import/template/products', {
      responseType: 'blob'
    });
    
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'template_products.xlsx');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (err: any) {
    alert('Failed to download template: ' + (err.response?.data?.error || err.message));
    console.error('Error downloading template:', err);
  }
}

function triggerFileInput() {
  fileInput.value?.click();
}

async function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  
  if (!file) return;
  
  selectedFile.value = file;
  
  // Auto preview
  await previewImport();
}

async function previewImport() {
  if (!selectedFile.value) {
    alert('Please select a file first');
    return;
  }
  
  const formData = new FormData();
  formData.append('file', selectedFile.value);
  
  try {
    const response = await api.post('/import/preview/products', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    
    const { success, validation } = response.data;
    
    if (!success) {
      const errorMsg = validation.firstError 
        ? `Error at row ${validation.firstError.rowNumber}: ${validation.firstError.errors.join(', ')}`
        : 'Validation failed';
      alert(`Import validation failed!\n\n${errorMsg}\n\nPlease fix the errors in your Excel file and try again.`);
      
      selectedFile.value = null;
      if (fileInput.value) fileInput.value.value = '';
      return;
    }
    
    // Show preview modal
    previewData.value = validation.preview || [];
    showImportPreview.value = true;
  } catch (err: any) {
    alert('Failed to preview import: ' + (err.response?.data?.error || err.message));
    console.error('Error previewing import:', err);
    selectedFile.value = null;
    if (fileInput.value) fileInput.value.value = '';
  }
}

function closeImportPreview() {
  showImportPreview.value = false;
  previewData.value = [];
  selectedFile.value = null;
  if (fileInput.value) fileInput.value.value = '';
}

async function confirmImport() {
  if (!selectedFile.value) return;
  
  const formData = new FormData();
  formData.append('file', selectedFile.value);
  
  importing.value = true;
  
  try {
    const response = await api.post('/import/import/products', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    
    alert(`✅ Success!\n\n${response.data.message || 'Import completed successfully'}`);
    
    // Close preview and refresh data
    closeImportPreview();
    await fetchItems();
  } catch (err: any) {
    alert('Failed to import: ' + (err.response?.data?.error || err.message));
    console.error('Error importing:', err);
  } finally {
    importing.value = false;
  }
}

function handleExport() {
  exportToCSV(items.value, 'Items_Export');
}

</script>
