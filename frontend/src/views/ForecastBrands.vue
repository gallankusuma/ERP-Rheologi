<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">🏷️ Forecast Brands</h1>
        <p class="text-gray-600 mt-1">Manage sister company brands and C2509 conversion rates</p>
      </div>
      <button @click="openAddModal"
        class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors">
        + Add Brand
      </button>
    </div>

    <!-- Brands Table -->
    <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">No</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Brand Name</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Type</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Product</th>
            <th class="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">Conversion Rate</th>
            <th class="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">UOM</th>
            <th class="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">Status</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Notes</th>
            <th class="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr v-if="brands.length === 0">
            <td colspan="8" class="px-6 py-8 text-center text-gray-500">No brands found. Click "+ Add Brand" to create one.</td>
          </tr>
          <tr v-for="(brand, idx) in brands" :key="brand.id" class="hover:bg-gray-50 transition-colors">
            <td class="px-6 py-4 text-sm text-gray-500">{{ idx + 1 }}</td>
            <td class="px-6 py-4 text-sm font-semibold text-gray-900">{{ brand.brand_name }}</td>
            <td class="px-6 py-4 text-sm text-gray-700">{{ brand.type || 'Brand' }}</td>
            <td class="px-6 py-4 text-sm">
              <span class="inline-flex items-center px-2 py-1 rounded bg-blue-50 text-blue-700 font-medium text-xs">
                {{ brand.product_name || 'Not set' }}
              </span>
            </td>
            <td class="px-6 py-4 text-sm text-center">
              <span class="inline-flex items-center px-3 py-1 rounded-full bg-teal-100 text-teal-800 font-bold text-sm">
                {{ brand.conversion_rate }}
              </span>
            </td>
            <td class="px-6 py-4 text-sm text-center text-gray-700">{{ brand.conversion_uom }}</td>
            <td class="px-6 py-4 text-center">
              <span :class="[
                'px-2 py-1 rounded-full text-xs font-bold',
                brand.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              ]">{{ brand.is_active ? 'Active' : 'Inactive' }}</span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-600">{{ brand.notes || '-' }}</td>
            <td class="px-6 py-4 text-center">
              <div class="flex gap-2 justify-center">
                <button @click="openEditModal(brand)" class="text-blue-600 hover:text-blue-800 text-sm font-medium">Edit</button>
                <button @click="deleteBrand(brand.id)" class="text-red-500 hover:text-red-700 text-sm font-medium">Delete</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Info Card -->
    <div class="bg-teal-50 border border-teal-200 rounded-lg p-4">
      <h3 class="font-semibold text-teal-800 mb-1">💡 How Conversion Rate Works</h3>
      <p class="text-sm text-teal-700">
        The conversion rate determines how much of the <strong>linked product</strong> is needed per unit of the brand's product.
        For example, if Brand Alpha has a rate of <strong>5.0 ltr/unit</strong> linked to C2509, then a forecast of 100 units will calculate to <strong>500 ltr of C2509</strong>.
        Each brand can be linked to a <strong>different product</strong>.
      </p>
    </div>

    <!-- Add/Edit Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div class="bg-blue-600 text-white px-6 py-4 rounded-t-xl flex justify-between items-center">
          <h3 class="font-bold text-lg">{{ editingBrand ? 'Edit Brand' : 'Add Brand' }}</h3>
          <button @click="showModal = false" class="text-white/80 hover:text-white text-xl">✕</button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Brand/Product Name *</label>
            <input v-model="form.brand_name" type="text" placeholder="e.g., Brand Alpha"
              class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Type *</label>
              <select v-model="form.type"
                class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option value="Brand">Brand</option>
                <option value="Product">Product</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Product Link *</label>
              <select v-model="form.product_id"
                class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option :value="0">Select Product</option>
                <option v-for="p in products" :key="p.id" :value="p.id">
                  {{ p.name }} ({{ p.sku }})
                </option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Conversion Rate *</label>
              <input v-model.number="form.conversion_rate" type="number" step="0.01" min="0.01"
                class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">UOM</label>
              <input v-model="form.conversion_uom" type="text" placeholder="ltr"
                class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea v-model="form.notes" rows="2" placeholder="Optional notes..."
              class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"></textarea>
          </div>
          <div v-if="editingBrand" class="flex items-center gap-2">
            <input v-model="form.is_active" type="checkbox" id="is_active" class="w-4 h-4 rounded border-gray-300 text-blue-600" />
            <label for="is_active" class="text-sm text-gray-700">Active</label>
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <button @click="showModal = false"
              class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">Cancel</button>
            <button @click="saveBrand"
              class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
              {{ editingBrand ? 'Update' : 'Create' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../lib/api';

interface Brand {
  id: number;
  brand_name: string;
  type: string;
  product_id: number | null;
  product_name: string | null;
  product_sku: string | null;
  conversion_rate: number;
  conversion_uom: string;
  notes: string | null;
  is_active: boolean;
}

const brands = ref<Brand[]>([]);
const products = ref<any[]>([]);
const showModal = ref(false);
const editingBrand = ref<Brand | null>(null);
const form = ref({
  brand_name: '',
  type: 'Brand',
  product_id: 0,
  conversion_rate: 1,
  conversion_uom: 'ltr',
  notes: '',
  is_active: true
});

const fetchBrands = async () => {
  try {
    const res = await api.get('/ppic/forecast-brands');
    brands.value = Array.isArray(res.data) ? res.data : [];
  } catch (e) {
    console.error('Failed to fetch brands:', e);
  }
};

const fetchProducts = async () => {
  try {
    const res = await api.get('/projects/products-with-bom');
    products.value = Array.isArray(res.data) ? res.data : (res.data.data || []);
  } catch (e) {
    console.error('Failed to fetch products:', e);
  }
};

const openAddModal = () => {
  editingBrand.value = null;
  form.value = { brand_name: '', type: 'Brand', product_id: 0, conversion_rate: 1, conversion_uom: 'ltr', notes: '', is_active: true };
  showModal.value = true;
};

const openEditModal = (brand: Brand) => {
  editingBrand.value = brand;
  form.value = {
    brand_name: brand.brand_name,
    type: brand.type || 'Brand',
    product_id: brand.product_id || 0,
    conversion_rate: Number(brand.conversion_rate),
    conversion_uom: brand.conversion_uom || 'ltr',
    notes: brand.notes || '',
    is_active: !!brand.is_active
  };
  showModal.value = true;
};

const saveBrand = async () => {
  if (!form.value.brand_name) { alert('Brand name is required'); return; }
  if (!form.value.product_id) { alert('Please select a product'); return; }
  if (!form.value.conversion_rate || form.value.conversion_rate <= 0) { alert('Conversion rate must be > 0'); return; }
  try {
    if (editingBrand.value) {
      await api.put(`/ppic/forecast-brands/${editingBrand.value.id}`, form.value);
    } else {
      await api.post('/ppic/forecast-brands', form.value);
    }
    showModal.value = false;
    await fetchBrands();
  } catch (e: any) {
    alert(e.response?.data?.error || 'Failed to save brand');
  }
};

const deleteBrand = async (id: number) => {
  if (!confirm('Delete this brand? This may affect existing forecasts.')) return;
  try {
    await api.delete(`/ppic/forecast-brands/${id}`);
    await fetchBrands();
  } catch (e: any) {
    alert(e.response?.data?.error || 'Failed to delete');
  }
};

onMounted(async () => {
  await fetchProducts();
  await fetchBrands();
});
</script>
