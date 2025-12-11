<template>
  <div class="min-h-screen bg-gray-50">
    <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div class="px-4 py-6 sm:px-0">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-gray-900">Products</h2>
          <button
            @click="showAddModal = true"
            class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            + Add Product
          </button>
        </div>

        <div v-if="store.loading" class="text-center py-8">
          <p>Loading products...</p>
        </div>

        <div v-else-if="store.error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {{ store.error }}
        </div>

        <div v-else class="bg-white shadow overflow-hidden sm:rounded-md">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="product in store.products" :key="product.id">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ product.sku }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ product.name }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ product.category || '-' }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ product.unit_of_measure || '-' }}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span :class="product.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                    {{ product.status }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button @click="editProduct(product)" class="text-blue-600 hover:text-blue-900 mr-4">Edit</button>
                  <button @click="deleteProduct(product.id)" class="text-red-600 hover:text-red-900">Delete</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>

    <!-- Add/Edit Product Modal -->
    <div v-if="showAddModal || showEditModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative top-12 mx-auto p-6 border max-w-2xl shadow-xl rounded-lg bg-white">
        <h3 class="text-xl font-bold mb-5 text-gray-900 border-b pb-3">{{ showEditModal ? 'Edit Product' : 'Product Master Form' }}</h3>
        <form @submit.prevent="showEditModal ? updateProduct() : createProduct()" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Product Code <span class="text-red-500">*</span></label>
              <input v-model="productForm.sku" required placeholder="Auto-generated or manual" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Product Name <span class="text-red-500">*</span></label>
              <input v-model="productForm.name" required placeholder="Enter product name" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Type <span class="text-red-500">*</span></label>
            <div class="flex gap-4">
              <label class="inline-flex items-center">
                <input type="radio" v-model="productForm.product_type" value="raw_material" class="form-radio text-blue-600" />
                <span class="ml-2">Raw Material</span>
              </label>
              <label class="inline-flex items-center">
                <input type="radio" v-model="productForm.product_type" value="finished_goods" class="form-radio text-blue-600" />
                <span class="ml-2">Finished Goods</span>
              </label>
              <label class="inline-flex items-center">
                <input type="radio" v-model="productForm.product_type" value="packaging" class="form-radio text-blue-600" />
                <span class="ml-2">Packaging</span>
              </label>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select v-model="productForm.category" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                <option value="">Select Category</option>
                <option value="chemicals">Chemicals</option>
                <option value="ingredients">Ingredients</option>
                <option value="packaging_materials">Packaging Materials</option>
                <option value="finished_products">Finished Products</option>
                <option value="consumables">Consumables</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Base UoM <span class="text-red-500">*</span></label>
              <select v-model="productForm.unit_of_measure" required class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                <option value="KG">KG</option>
                <option value="L">L</option>
                <option value="PCS">PCS</option>
                <option value="BOX">BOX</option>
                <option value="DRUM">DRUM</option>
                <option value="PAIL">PAIL</option>
                <option value="BOTTLE">BOTTLE</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Density (kg/L)</label>
              <input v-model.number="productForm.density" type="number" step="0.001" placeholder="Optional" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Standard Cost per UoM</label>
              <input v-model.number="productForm.standard_cost" type="number" step="0.01" placeholder="Optional" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea v-model="productForm.description" rows="3" placeholder="Product description..." class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"></textarea>
          </div>

          <div>
            <label class="inline-flex items-center">
              <input type="checkbox" v-model="productForm.is_active" class="form-checkbox text-blue-600 h-5 w-5" />
              <span class="ml-2 text-sm font-medium text-gray-700">Active</span>
            </label>
          </div>

          <div class="flex justify-end space-x-3 pt-4 border-t">
            <button type="button" @click="closeModal" class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400">Cancel</button>
            <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{{ showEditModal ? 'Update Product' : 'Save Product' }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useProductStore } from '../stores/products';

const store = useProductStore();

const showAddModal = ref(false);
const showEditModal = ref(false);
const productForm = ref({
  id: 0,
  sku: '',
  name: '',
  description: '',
  category: '',
  product_type: 'raw_material',
  unit_of_measure: 'KG',
  density: null as number | null,
  standard_cost: null as number | null,
  status: 'active',
  is_active: true,
});

onMounted(() => {
  store.fetchProducts();
});

const createProduct = async () => {
  try {
    await store.createProduct(productForm.value);
    closeModal();
  } catch (error) {
    console.error('Failed to create product:', error);
  }
};

const editProduct = (product: any) => {
  productForm.value = { ...product };
  showEditModal.value = true;
};

const updateProduct = async () => {
  try {
    await store.updateProduct(productForm.value.id, productForm.value);
    closeModal();
  } catch (error) {
    console.error('Failed to update product:', error);
  }
};

const deleteProduct = async (id: number) => {
  if (confirm('Are you sure you want to delete this product?')) {
    try {
      await store.deleteProduct(id);
    } catch (error) {
      console.error('Failed to delete product:', error);
    }
  }
};

const closeModal = () => {
  showAddModal.value = false;
  showEditModal.value = false;
  productForm.value = {
    id: 0,
    sku: '',
    name: '',
    description: '',
    category: '',
    product_type: 'raw_material',
    unit_of_measure: 'KG',
    density: null,
    standard_cost: null,
    status: 'active',
    is_active: true,
  };
};
</script>
