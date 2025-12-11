<template>
  <div class="min-h-screen bg-gray-50">
    <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div class="px-4 py-6 sm:px-0">
        <!-- Header -->
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-gray-900">Bill of Materials</h2>
          <button @click="openCreateModal" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
            + Create BOM
          </button>
        </div>

        <!-- BOM List Table -->
        <div v-if="store.loading" class="text-center py-8">Loading...</div>
        <div v-else-if="store.error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {{ store.error }}
        </div>

        <div v-else class="bg-white shadow overflow-hidden sm:rounded-md">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Version</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Components</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Effective Date</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="bom in bomsByProduct" :key="bom.product_id">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ getProductName(bom.product_id) }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ bom.version || 'V1.0' }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ getComponentCount(bom.product_id) }} items</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ formatDate(bom.effective_date) }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button @click="openEditModal(bom.product_id)" class="text-blue-600 hover:text-blue-900 mr-4">View</button>
                  <button @click="deleteBOM(bom.product_id)" class="text-red-600 hover:text-red-900">Delete</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>

    <!-- BOM Create/Edit Modal (Full Page) -->
    <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative mx-auto p-6 max-w-4xl mt-10 shadow-2xl rounded-lg bg-white max-h-screen overflow-y-auto">
        <!-- Close Button -->
        <button @click="closeModal" class="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl">✕</button>

        <h2 class="text-2xl font-bold mb-6 text-gray-900">{{ isEditing ? 'Edit BOM' : 'Create New BOM' }}</h2>

        <!-- BOM HEADER FORM -->
        <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 mb-8">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">📋 BOM HEADER</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Product Selection -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Product (Finished Good) <span class="text-red-500">*</span></label>
              <select 
                v-model="bomHeader.product_id" 
                :disabled="isEditing"
                required 
                class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- Select Finished Good --</option>
                <option v-for="product in finishedGoodProducts" :key="product.id" :value="product.id">
                  {{ product.name }} ({{ product.sku }})
                </option>
              </select>
            </div>

            <!-- Version -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Version <span class="text-red-500">*</span></label>
              <input 
                v-model="bomHeader.version" 
                type="text" 
                placeholder="e.g., V1.0, V2.0"
                required 
                class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <!-- Effective Date -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Effective Date <span class="text-red-500">*</span></label>
              <input 
                v-model="bomHeader.effective_date" 
                type="date" 
                required 
                class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <!-- Notes -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea 
                v-model="bomHeader.notes" 
                rows="2"
                placeholder="Any notes about this BOM..."
                class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              ></textarea>
            </div>
          </div>
        </div>

        <!-- ADD BOM COMPONENT FORM -->
        <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 mb-8" data-component-form>
          <h3 class="text-lg font-semibold text-gray-900 mb-4">➕ ADD BOM COMPONENT</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <!-- Component Product -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Component Product <span class="text-red-500">*</span></label>
              <select 
                v-model="componentForm.component_id" 
                required 
                class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- Select Component --</option>
                <option v-for="product in componentProducts" :key="product.id" :value="product.id">
                  {{ product.name }} ({{ product.sku }})
                </option>
              </select>
            </div>

            <!-- Qty Per Batch -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Qty Per Batch <span class="text-red-500">*</span></label>
              <input 
                v-model.number="componentForm.quantity" 
                type="number" 
                step="0.01" 
                placeholder="0.00"
                required 
                class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <!-- UoM -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">UoM <span class="text-red-500">*</span></label>
              <select 
                v-model="componentForm.unit" 
                required 
                class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="KG">KG</option>
                <option value="L">L</option>
                <option value="PCS">PCS</option>
                <option value="BOX">BOX</option>
                <option value="DRUM">DRUM</option>
                <option value="PAIL">PAIL</option>
                <option value="BOTTLE">BOTTLE</option>
              </select>
            </div>

            <!-- Loss % -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Loss %</label>
              <input 
                v-model.number="componentForm.loss_percent" 
                type="number" 
                step="0.1" 
                min="0" 
                max="100" 
                placeholder="0"
                class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <!-- Is Sub-BOM -->
            <div class="flex items-end">
              <label class="inline-flex items-center">
                <input 
                  v-model="componentForm.is_sub_bom" 
                  type="checkbox" 
                  class="form-checkbox text-blue-600 h-5 w-5"
                />
                <span class="ml-2 text-sm font-medium text-gray-700">Is Sub-BOM</span>
              </label>
            </div>
          </div>

          <!-- Add Component Button -->
          <button 
            @click="addComponent" 
            type="button"
            class="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-medium"
          >
            + Add Component
          </button>
        </div>

        <!-- BOM COMPONENTS LIST -->
        <div v-if="bomComponents.length > 0" class="border-2 border-solid border-gray-300 rounded-lg p-6 mb-8">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">📦 BOM COMPONENTS ({{ bomComponents.length }})</h3>
          
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-100">
                <tr>
                  <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Component</th>
                  <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Qty</th>
                  <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">UoM</th>
                  <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Loss%</th>
                  <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Is Sub</th>
                  <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="(comp, idx) in bomComponents" :key="idx" class="hover:bg-gray-50">
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ getProductName(comp.component_id) }}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{{ comp.quantity }}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{{ comp.unit }}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{{ comp.loss_percent ?? 0 }}%</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    <span v-if="comp.is_sub_bom" class="font-semibold text-green-700">Yes</span>
                    <span v-else class="text-gray-600">No</span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                    <button 
                      @click="editComponent(idx)" 
                      class="text-blue-600 hover:text-blue-900 font-semibold"
                    >
                      Edit
                    </button>
                    <button 
                      @click="removeComponent(idx)" 
                      class="text-red-600 hover:text-red-900 font-semibold"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex justify-end space-x-3 border-t pt-6">
          <button 
            @click="closeModal" 
            class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 font-medium"
          >
            Cancel
          </button>
          <button 
            @click="saveBOM" 
            :disabled="!canSave"
            :class="{
              'bg-blue-600 hover:bg-blue-700 text-white': canSave,
              'bg-gray-400 text-gray-600 cursor-not-allowed': !canSave
            }"
            class="px-6 py-2 rounded-md font-medium"
          >
            {{ isEditing ? 'Update BOM' : 'Save BOM' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useBOMStore } from '../stores/bom';
import { useProductStore } from '../stores/products';

const store = useBOMStore();
const productStore = useProductStore();

const showModal = ref(false);
const isEditing = ref(false);

// BOM Header Form
const bomHeader = ref({
  product_id: '',
  version: 'V1.0',
  effective_date: new Date().toISOString().split('T')[0],
  notes: ''
});

// Component Form
const componentForm = ref({
  component_id: '',
  quantity: 0,
  unit: 'KG',
  loss_percent: 0,
  is_sub_bom: false
});

// BOM Components List
const bomComponents = ref<any[]>([]);

// Computed properties
const finishedGoodProducts = computed(() => {
  return productStore.products.filter(p => 
    p.category && p.category.toLowerCase().includes('finished')
  );
});

const componentProducts = computed(() => {
  return productStore.products.filter(p => {
    if (!p.category) return false;
    const cat = p.category.toLowerCase();
    return cat.includes('raw') || cat.includes('material') || cat.includes('packaging');
  });
});

const canSave = computed(() => {
  return bomHeader.value.product_id && 
         bomHeader.value.version && 
         bomHeader.value.effective_date && 
         bomComponents.value.length > 0;
});

const bomsByProduct = computed(() => {
  const grouped = new Map();
  store.boms.forEach(bom => {
    if (!grouped.has(bom.product_id)) {
      grouped.set(bom.product_id, {
        product_id: bom.product_id,
        version: bom.version || 'V1.0',
        effective_date: bom.effective_date,
        notes: bom.notes
      });
    }
  });
  return Array.from(grouped.values());
});

// Methods
const openCreateModal = () => {
  isEditing.value = false;
  bomHeader.value = {
    product_id: '',
    version: 'V1.0',
    effective_date: new Date().toISOString().split('T')[0],
    notes: ''
  };
  componentForm.value = {
    component_id: '',
    quantity: 0,
    unit: 'KG',
    loss_percent: 0,
    is_sub_bom: false
  };
  bomComponents.value = [];
  showModal.value = true;
};

const openEditModal = (productId: string | number) => {
  isEditing.value = true;
  const existingBoms = store.boms.filter(b => b.product_id == productId);
  if (existingBoms.length > 0) {
    const header = existingBoms[0];
    bomHeader.value = {
      product_id: header.product_id,
      version: header.version || 'V1.0',
      effective_date: header.effective_date || new Date().toISOString().split('T')[0],
      notes: header.notes || ''
    };
    bomComponents.value = existingBoms.map(b => ({
      component_id: b.component_product_id,
      quantity: b.quantity,
      unit: b.unit,
      loss_percent: (b as any).loss_percent || 0,
      is_sub_bom: (b as any).is_sub_bom || false
    }));
  }
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
};

const addComponent = () => {
  if (!componentForm.value.component_id || componentForm.value.quantity <= 0) {
    alert('Please fill all required component fields');
    return;
  }

  bomComponents.value.push({
    component_id: componentForm.value.component_id,
    quantity: componentForm.value.quantity,
    unit: componentForm.value.unit,
    loss_percent: componentForm.value.loss_percent || 0,
    is_sub_bom: componentForm.value.is_sub_bom
  });

  componentForm.value = {
    component_id: '',
    quantity: 0,
    unit: 'KG',
    loss_percent: 0,
    is_sub_bom: false
  };
};

const removeComponent = (index: number) => {
  bomComponents.value.splice(index, 1);
};

const editComponent = (index: number) => {
  const comp = bomComponents.value[index];
  componentForm.value = {
    component_id: comp.component_id,
    quantity: comp.quantity,
    unit: comp.unit,
    loss_percent: comp.loss_percent,
    is_sub_bom: comp.is_sub_bom
  };
  // Scroll ke form
  const formSection = document.querySelector('[data-component-form]');
  if (formSection) {
    formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  bomComponents.value.splice(index, 1);
};

const saveBOM = async () => {
  try {
    for (const component of bomComponents.value) {
      const bomData = {
        product_id: bomHeader.value.product_id,
        component_product_id: component.component_id,
        quantity: component.quantity,
        unit: component.unit,
        loss_percent: component.loss_percent,
        is_sub_bom: component.is_sub_bom,
        version: bomHeader.value.version,
        effective_date: bomHeader.value.effective_date,
        notes: bomHeader.value.notes
      };

      if (isEditing.value) {
        // Update would go here
        await store.updateBOM(bomHeader.value.product_id as any, bomData);
      } else {
        await store.createBOM(bomData);
      }
    }

    closeModal();
    await store.fetchBOMs();
  } catch (error) {
    console.error('Error saving BOM:', error);
    alert('Failed to save BOM');
  }
};

const deleteBOM = async (productId: string | number) => {
  if (confirm('Delete all BOM components for this product?')) {
    try {
      const bomsToDelete = store.boms.filter(b => b.product_id == productId);
      for (const bom of bomsToDelete) {
        await store.deleteBOM(bom.id);
      }
      await store.fetchBOMs();
    } catch (error) {
      console.error('Error deleting BOM:', error);
    }
  }
};

const getProductName = (productId: any) => {
  const product = productStore.products.find(p => p.id == productId);
  return product ? `${product.name} (${product.sku})` : '-';
};

const getComponentCount = (productId: any) => {
  return store.boms.filter(b => b.product_id == productId).length;
};

const formatDate = (dateStr: string) => {
  return dateStr ? new Date(dateStr).toLocaleDateString('id-ID') : '-';
};

onMounted(() => {
  store.fetchBOMs();
  productStore.fetchProducts();
});
</script>

<style scoped>
/* Custom scrollbar for modal */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
