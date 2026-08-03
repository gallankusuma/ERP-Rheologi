<template>
  <div class="min-h-screen bg-gray-50">
    <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div class="px-4 py-6 sm:px-0">
        <div class="flex justify-between items-center mb-4">
          <div>
            <h2 class="text-2xl font-bold text-gray-900">Stock Adjustment</h2>
            <p class="text-sm text-gray-500">Manual corrections with 2-level approval</p>
          </div>
          <button @click="openCreateModal" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
            + Create Adjustment
          </button>
        </div>

        <!-- Search & Filter Bar -->
        <div class="flex flex-col sm:flex-row gap-3 mb-5">
          <div class="relative flex-1">
            <span class="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">🔍</span>
            <input
              v-model="search"
              type="text"
              placeholder="Cari produk, SKU, gudang, nomor, atau alasan..."
              class="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
            />
          </div>
          <select v-model="filterStatus" class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none bg-white">
            <option value="all">Semua Status</option>
            <option value="0">Pending</option>
            <option value="1">Supervisor Approved</option>
            <option value="2">Fully Approved</option>
          </select>
          <span class="flex items-center text-xs text-gray-400 whitespace-nowrap self-center">
            {{ filteredAdjustments.length }} / {{ adjustments.length }} record
          </span>
        </div>

        <div v-if="loading" class="text-center py-8">Loading...</div>
        <div v-else-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{{ error }}</div>

        <div v-else class="bg-white shadow overflow-hidden sm:rounded-md">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Adj No</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Warehouse</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-if="filteredAdjustments.length === 0">
                <td colspan="7" class="px-6 py-8 text-center text-gray-500">
                  {{ search || filterStatus !== 'all' ? 'Tidak ada data yang cocok dengan pencarian.' : 'No adjustments yet. Create one to get started.' }}
                </td>
              </tr>
              <tr v-for="adj in filteredAdjustments" :key="adj.id">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ adj.reference_id || `ADJ-${adj.id}` }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ formatDate(adj.moved_at) }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{{ adj.warehouse_name }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{{ adj.product_name }} <span class="text-gray-400">({{ adj.sku }})</span></td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-right" :class="adj.quantity < 0 ? 'text-red-600' : 'text-green-600'">
                  {{ adj.quantity }} {{ adj.uom || 'units' }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                  <span :class="getApprovalStatusClass(adj.approval_status)" class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full">
                    {{ getApprovalStatusText(adj.approval_status) }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <div v-if="getApprovalMessage(adj.approval_status)" class="mb-2 text-xs text-orange-600 font-semibold">
                    ⚠️ {{ getApprovalMessage(adj.approval_status) }}
                  </div>
                  <button v-if="canApprove(adj.approval_status)" @click="approveAdjustment(adj.id)" class="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 font-medium transition">Approve</button>
                  <button v-if="canReject(adj.approval_status)" @click="rejectAdjustment(adj.id)" class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 font-medium transition">Reject</button>
                  <button v-if="(adj.approval_status || 0) === 0" @click="deleteAdjustment(adj.id)" class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 font-medium transition">Delete</button>
                  <button @click="viewAdjustment(adj)" class="text-blue-600 hover:text-blue-900">View</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>

    <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 class="text-2xl font-bold text-gray-900">
            {{ isViewMode ? 'View Stock Adjustment' : 'Create Stock Adjustment' }}
            <span v-if="isFullyApproved" class="ml-3 inline-block bg-green-600 text-white px-3 py-1 rounded-full text-sm font-semibold">✓ FULLY APPROVED (2/2)</span>
          </h2>
          <button @click="closeModal" class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>

        <div class="px-6 py-4 space-y-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Warehouse <span class="text-red-500">*</span></label>
            <select v-model="formData.warehouse_id" :disabled="isViewMode" required class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100">
              <option value="">-- Select Warehouse --</option>
              <option v-for="wh in warehouses" :key="wh.id" :value="wh.id">{{ wh.name }}</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Product <span class="text-red-500">*</span></label>
            <!-- View Mode: show product name -->
            <div v-if="isViewMode" class="block w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-100 text-sm text-gray-700">
              {{ products.find(p => String(p.id) === String(formData.product_id))?.name || '—' }}
            </div>
            <!-- Edit Mode: searchable combobox -->
            <div v-else class="relative" ref="productComboRef">
              <input
                v-model="productSearch"
                @focus="productDropdownOpen = true"
                @input="productDropdownOpen = true"
                type="text"
                placeholder="Ketik nama produk atau SKU..."
                autocomplete="off"
                class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
              <!-- Selected tag -->
              <div v-if="formData.product_id && !productDropdownOpen" class="absolute right-3 top-1/2 -translate-y-1/2">
                <span class="text-xs text-blue-600 font-semibold">
                  ✓ {{ products.find(p => String(p.id) === String(formData.product_id))?.sku }}
                </span>
              </div>
              <!-- Dropdown -->
              <div v-if="productDropdownOpen && filteredProducts.length > 0"
                class="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-52 overflow-y-auto">
                <div
                  v-for="p in filteredProducts"
                  :key="p.id"
                  @mousedown.prevent="selectProduct(p)"
                  class="px-4 py-2.5 cursor-pointer hover:bg-blue-50 flex items-center justify-between"
                  :class="String(formData.product_id) === String(p.id) ? 'bg-blue-50' : ''"
                >
                  <span class="text-sm font-medium text-gray-800">{{ p.name }}</span>
                  <span class="text-xs text-gray-400 font-mono ml-2">{{ p.sku }}</span>
                </div>
              </div>
              <div v-if="productDropdownOpen && productSearch && filteredProducts.length === 0"
                class="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl px-4 py-3 text-sm text-gray-400">
                Tidak ada produk yang cocok
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Quantity (+/-) <span class="text-red-500">*</span></label>
              <input v-model.number="formData.quantity" type="number" step="0.01" :disabled="isViewMode" required class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Unit of Measure</label>
              <input v-model="formData.uom" type="text" placeholder="kg, litre, box" :disabled="isViewMode" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100" />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Reason</label>
            <input v-model="formData.reason" type="text" placeholder="Damaged / Count / Expired / Spill" :disabled="isViewMode" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea v-model="formData.notes" rows="3" :disabled="isViewMode" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"></textarea>
          </div>

          <div v-if="isViewMode && formData.approval_status" class="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h4 class="text-sm font-semibold text-blue-900 mb-2">Approval Trail</h4>
            <div class="text-sm text-blue-800 space-y-1">
              <div v-if="formData.approved_by_supervisor_id">✓ Supervisor Approved: {{ formData.approved_at_supervisor ? formatDate(formData.approved_at_supervisor) : 'N/A' }}</div>
              <div v-if="formData.approved_by_manager_id">✓ Manager Approved: {{ formData.approved_at_manager ? formatDate(formData.approved_at_manager) : 'N/A' }}</div>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3 bg-gray-50">
          <button @click="closeModal" class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition">{{ isViewMode ? 'Close' : 'Cancel' }}</button>
          <button v-if="!isViewMode" @click="saveAdjustment" :disabled="!canSave" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition">Create Adjustment</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api } from '../lib/api';
import { useApprovalWorkflow } from '../composables/useApprovalWorkflow';

const { canApprove, canReject, getApprovalStatusText, getApprovalStatusClass, getApprovalMessage, isFullyApproved: isFullyApprovedFn } = useApprovalWorkflow('inventory.stock-adjustment');

interface StockAdjustment {
  id: number;
  reference_id: string;
  product_id: number;
  product_name: string;
  sku: string;
  warehouse_id: number;
  warehouse_name: string;
  quantity: number;
  uom: string;
  notes: string;
  approval_status: number;
  approved_by_supervisor_id?: number;
  approved_by_manager_id?: number;
  approved_at_supervisor?: string;
  approved_at_manager?: string;
  moved_at: string;
}

interface Product {
  id: number;
  name: string;
  sku: string;
}

interface Warehouse {
  id: number;
  name: string;
  code: string;
}

const adjustments = ref<StockAdjustment[]>([]);
const products = ref<Product[]>([]);
const warehouses = ref<Warehouse[]>([]);
const loading = ref(false);
const error = ref('');
const showModal = ref(false);
const isViewMode = ref(false);
const search = ref('');
const filterStatus = ref('all');
const productSearch = ref('');
const productDropdownOpen = ref(false);

const filteredProducts = computed(() => {
  if (!productSearch.value.trim()) return products.value.slice(0, 50);
  const q = productSearch.value.toLowerCase();
  return products.value.filter((p: any) =>
    (p.name || '').toLowerCase().includes(q) ||
    (p.sku || '').toLowerCase().includes(q)
  ).slice(0, 50);
});

const selectProduct = (p: any) => {
  formData.value.product_id = String(p.id);
  productSearch.value = `${p.name} (${p.sku})`;
  productDropdownOpen.value = false;
};


onMounted(() => {
  fetchAdjustments();
  fetchProducts();
  fetchWarehouses();
  document.addEventListener('click', (e) => {
    // Close product dropdown on outside click
    if (productDropdownOpen.value) {
      const target = e.target as HTMLElement;
      if (!target.closest('.relative')) productDropdownOpen.value = false;
    }
  });
});

const filteredAdjustments = computed(() => {
  let list = adjustments.value;
  if (filterStatus.value !== 'all') {
    list = list.filter((a: any) => String(a.approval_status ?? 0) === filterStatus.value);
  }
  if (search.value.trim()) {
    const q = search.value.toLowerCase().trim();
    list = list.filter((a: any) =>
      (a.product_name || '').toLowerCase().includes(q) ||
      (a.sku || '').toLowerCase().includes(q) ||
      (a.warehouse_name || '').toLowerCase().includes(q) ||
      (a.reference_id || '').toLowerCase().includes(q) ||
      (`adj-${a.id}`).toLowerCase().includes(q) ||
      (a.notes || '').toLowerCase().includes(q) ||
      (a.reason || '').toLowerCase().includes(q)
    );
  }
  return list;
});

const formData = ref({
  warehouse_id: '',
  product_id: '',
  quantity: 0,
  uom: '',
  reason: '',
  notes: '',
  approval_status: 0,
  approved_by_supervisor_id: null as number | null,
  approved_by_manager_id: null as number | null,
  approved_at_supervisor: null as string | null,
  approved_at_manager: null as string | null
});

const isFullyApproved = computed(() => isFullyApprovedFn((formData.value.approval_status || 0)));

const canSave = computed(() => {
  return formData.value.warehouse_id && formData.value.product_id && formData.value.quantity !== 0;
});

const fetchAdjustments = async () => {
  try {
    loading.value = true;
    error.value = '';
    const response = await api.get('/inventory/stock-adjustments');
    adjustments.value = response.data.data || [];
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to fetch stock adjustments';
    console.error('Error fetching stock adjustments:', err);
  } finally {
    loading.value = false;
  }
};

const fetchProducts = async () => {
  try {
    const response = await api.get('/products');
    products.value = response.data.data || [];
  } catch (err) {
    console.error('Error fetching products:', err);
  }
};

const fetchWarehouses = async () => {
  try {
    const response = await api.get('/warehouses');
    warehouses.value = response.data.data || [];
  } catch (err) {
    console.error('Error fetching warehouses:', err);
  }
};

const openCreateModal = () => {
  isViewMode.value = false;
  formData.value = {
    warehouse_id: '',
    product_id: '',
    quantity: 0,
    uom: '',
    reason: '',
    notes: '',
    approval_status: 0,
    approved_by_supervisor_id: null,
    approved_by_manager_id: null,
    approved_at_supervisor: null,
    approved_at_manager: null
  };
  showModal.value = true;
};

const viewAdjustment = (adj: StockAdjustment) => {
  isViewMode.value = true;
  formData.value = {
    warehouse_id: adj.warehouse_id.toString(),
    product_id: adj.product_id.toString(),
    quantity: adj.quantity,
    uom: adj.uom || '',
    reason: adj.notes || '',
    notes: adj.notes || '',
    approval_status: adj.approval_status || 0,
    approved_by_supervisor_id: adj.approved_by_supervisor_id || null,
    approved_by_manager_id: adj.approved_by_manager_id || null,
    approved_at_supervisor: adj.approved_at_supervisor || null,
    approved_at_manager: adj.approved_at_manager || null
  };
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  formData.value = {
    warehouse_id: '',
    product_id: '',
    quantity: 0,
    uom: '',
    reason: '',
    notes: '',
    approval_status: 0,
    approved_by_supervisor_id: null,
    approved_by_manager_id: null,
    approved_at_supervisor: null,
    approved_at_manager: null
  };
};

const saveAdjustment = async () => {
  if (!canSave.value) return;
  try {
    loading.value = true;
    await api.post('/inventory/stock-adjustments', formData.value);
    closeModal();
    await fetchAdjustments();
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to create stock adjustment';
    console.error('Error creating stock adjustment:', err);
  } finally {
    loading.value = false;
  }
};

const approveAdjustment = async (id: number) => {
  if (!confirm('Approve Stock Adjustment? Pastikan semua data sudah benar.')) return;
  try {
    loading.value = true;
    await api.post(`/api/inventory/stock-adjustments/${id}/approve`);
    await fetchAdjustments();
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to approve stock adjustment';
    console.error('Error approving stock adjustment:', err);
  } finally {
    loading.value = false;
  }
};

const rejectAdjustment = async (id: number) => {
  if (!confirm('Reject dan kembalikan Stock Adjustment ke pending?')) return;
  try {
    loading.value = true;
    await api.post(`/api/inventory/stock-adjustments/${id}/reject`);
    await fetchAdjustments();
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to reject stock adjustment';
    console.error('Error rejecting stock adjustment:', err);
  } finally {
    loading.value = false;
  }
};

const deleteAdjustment = async (id: number) => {
  if (!confirm('Delete this draft Stock Adjustment? This action cannot be undone.')) return;
  try {
    loading.value = true;
    await api.delete(`/api/inventory/stock-adjustments/${id}`);
    await fetchAdjustments();
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to delete stock adjustment';
    console.error('Error deleting stock adjustment:', err);
  } finally {
    loading.value = false;
  }
};

const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// onMounted handled above (includes fetch + click-outside listener for product combobox)

</script>
