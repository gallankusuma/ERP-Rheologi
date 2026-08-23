<template>
  <div class="space-y-6">
    <!-- Header -->
    <PageHeader title="Stock Overview" icon="📦" subtitle="Manage warehouse inventory levels and transactions">
      <template #actions>
        <div class="flex gap-2">
          <button @click="downloadTemplate" class="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium transition-colors text-sm">
            📥 Download Template
          </button>
          <button @click="showImportModal = true" class="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium transition-colors text-sm">
            📤 Import Stock
          </button>
          <button @click="showUpdateModal = true" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 font-medium transition-colors text-sm">
            + Update Stock
          </button>
        </div>
      </template>
    </PageHeader>

    <!-- KPIs -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <StatCard title="Total SKU (With Stock)" :value="totalSku" icon="📊" color="primary" />
      <StatCard title="Total Qty On Hand" :value="formatNumber(totalOnHand)" icon="🏭" color="success" />
      <StatCard title="Low Stock (< Reorder)" :value="lowStock.length" icon="⚠️" :color="lowStock.length ? 'warning' : 'success'" />
      <StatCard title="Out of Stock" :value="outOfStock" icon="🚫" :color="outOfStock > 0 ? 'danger' : 'success'" />
    </div>

    <!-- Search + Warehouse Filter -->
    <div class="flex flex-col md:flex-row gap-3">
      <div class="flex-1">
        <FilterBar v-model="search" search-placeholder="Search product or SKU..." />
      </div>
      <select v-model="selectedWarehouse" class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300">
        <option value="">All Warehouses</option>
        <option v-for="wh in warehouses" :key="wh.id" :value="wh.id">{{ wh.name }}</option>
      </select>
    </div>

    <!-- Loading / Error -->
    <div v-if="store.loading" class="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
    <div v-else-if="store.error" class="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-4">
      {{ store.error }}
    </div>

    <template v-else>
      <!-- Inventory Table -->
      <DataTable :columns="columns" :rows="filtered" :loading="false">
        <template #cell-available="{ row }">
          <StatusBadge
            :status="String(row.quantity_on_hand - row.quantity_reserved)"
            :variant="availabilityVariant(row)"
            size="md"
          />
        </template>
        <template #cell-location="{ row }">
          {{ row.location || '-' }}
        </template>
        <template #cell-actions="{ row }">
          <div class="flex gap-2">
            <button @click="viewTransactions(row.product_id)" class="px-3 py-1 rounded text-sm font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors">
              History
            </button>
            <button @click="editInventory(row)" class="px-3 py-1 rounded text-sm font-medium bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50 transition-colors">
              Update
            </button>
          </div>
        </template>
      </DataTable>

      <!-- Transaction History -->
      <div v-if="showTransactions" class="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">Transaction History</h3>
          <button @click="showTransactions = false" class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl">&times;</button>
        </div>
        <div v-if="store.transactions.length === 0" class="text-gray-500 dark:text-gray-400 text-center py-4">
          No transactions found
        </div>
        <DataTable v-else :columns="txnColumns" :rows="store.transactions">
          <template #cell-transaction_date="{ value }">
            {{ new Date(value).toLocaleString() }}
          </template>
          <template #cell-transaction_type="{ value }">
            <span :class="value === 'in' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
              {{ value === 'in' ? '+ Receipt' : '- Issue' }}
            </span>
          </template>
          <template #cell-notes="{ value }">
            {{ value || '-' }}
          </template>
        </DataTable>
      </div>
    </template>

    <!-- Update Modal -->
    <Dialog :is-open="showUpdateModal" @update:is-open="showUpdateModal = $event" size="small">
      <template #title>Update Inventory</template>
      <form @submit.prevent="updateInventory()" class="space-y-4">
        <FormField name="product_id" label="Product" type="select" :model-value="form.product_id" @update:model-value="form.product_id = $event" :options="productStore.products.map(p => ({ value: p.id, label: p.name }))" select-placeholder="Select Product" required />
        <FormField name="transaction_type" label="Transaction Type" type="select" :model-value="form.transaction_type" @update:model-value="form.transaction_type = $event" :options="[{ value: 'in', label: 'Receipt (Add Stock)' }, { value: 'out', label: 'Issue (Remove Stock)' }]" required />
        <FormField name="quantity" label="Quantity" type="number" :model-value="form.quantity" @update:model-value="form.quantity = $event" required />
        <FormField name="location" label="Location" :model-value="form.location" @update:model-value="form.location = $event" />
        <FormField name="notes" label="Notes" type="textarea" :model-value="form.notes" @update:model-value="form.notes = $event" :rows="3" />
      </form>
      <template #actions="{ close }">
        <button @click="close" class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium">Cancel</button>
        <button @click="updateInventory()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 font-medium">Update</button>
      </template>
    </Dialog>

    <!-- Import Modal -->
    <Teleport to="body">
      <div v-if="showImportModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg">
          <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h3 class="font-bold text-gray-900 dark:text-gray-100">📤 Import Initial Stock</h3>
            <button @click="closeImport" class="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>
          <div class="px-6 py-5 space-y-4">
            <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-3 text-sm text-blue-700 dark:text-blue-300">
              <p class="font-semibold mb-1">Format kolom Excel/CSV:</p>
              <p><b>sku</b> — SKU produk (wajib)</p>
              <p><b>warehouse_code</b> — Kode gudang (default: WH-001)</p>
              <p><b>quantity</b> — Jumlah stok (wajib)</p>
              <p><b>batch_number</b> — Nomor batch (opsional)</p>
              <p><b>mode</b> — "replace" (timpa) atau "add" (tambah)</p>
            </div>

            <div>
              <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Upload File</label>
              <input ref="fileInput" type="file" accept=".xlsx,.xls,.csv"
                @change="handleFileSelect"
                class="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-700" />
            </div>

            <!-- Preview -->
            <div v-if="importPreview" class="space-y-2">
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {{ importPreview.totalRows }} baris ditemukan
                </span>
                <span v-if="importPreview.validRows === importPreview.totalRows" class="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">Semua valid</span>
                <span v-else class="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">{{ importPreview.invalidRows.length }} error</span>
              </div>
              <div v-if="importPreview.firstError" class="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg p-2 text-xs text-red-700 dark:text-red-400">
                Baris {{ importPreview.firstError.rowNumber }}: {{ importPreview.firstError.errors.join(', ') }}
              </div>
              <div v-if="importPreview.preview?.length" class="overflow-x-auto rounded-lg border border-gray-200">
                <table class="min-w-full text-xs">
                  <thead class="bg-gray-50">
                    <tr>
                      <th v-for="col in Object.keys(importPreview.preview[0])" :key="col" class="px-2 py-1 text-left font-semibold text-gray-600">{{ col }}</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    <tr v-for="(row, idx) in importPreview.preview" :key="idx">
                      <td v-for="col in Object.keys(row)" :key="col" class="px-2 py-1 text-gray-700">{{ row[col] }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Import result -->
            <div v-if="importResult" class="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-700 dark:text-emerald-300 font-semibold">
              {{ importResult }}
            </div>
          </div>
          <div class="px-6 pb-5 flex gap-3">
            <button @click="closeImport"
              class="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">Tutup</button>
            <button @click="executeImport" :disabled="!importFile || importing || (importPreview && importPreview.validRows !== importPreview.totalRows)"
              class="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50">
              {{ importing ? '⏳ Importing...' : '🚀 Import' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { useInventoryStore } from '../stores/inventory';
import { useProductStore } from '../stores/products';
import { api } from '../lib/api';
import PageHeader from '../components/ui/PageHeader.vue';
import StatCard from '../components/ui/StatCard.vue';
import FilterBar from '../components/ui/FilterBar.vue';
import StatusBadge from '../components/ui/StatusBadge.vue';
import DataTable from '../components/DataTable.vue';
import Dialog from '../components/ui/Dialog.vue';
import FormField from '../components/FormField.vue';

const store = useInventoryStore();
const productStore = useProductStore();

const showUpdateModal = ref(false);
const showTransactions = ref(false);
const showImportModal = ref(false);
const importFile = ref<File | null>(null);
const importPreview = ref<any>(null);
const importResult = ref('');
const importing = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const search = ref('');
const form = ref({
  product_id: '',
  inventory_id: 0,
  transaction_type: 'in',
  quantity: 1,
  location: '',
  notes: '',
});

const selectedWarehouse = ref('');
const warehouses = ref<any[]>([]);

const columns = [
  { key: 'product_name', label: 'Product' },
  { key: 'sku', label: 'SKU' },
  { key: 'warehouse_name', label: 'Warehouse' },
  { key: 'quantity_on_hand', label: 'On Hand' },
  { key: 'reorder_point', label: 'Reorder Point' },
  { key: 'actions', label: 'Action' },
];

const formatNumber = (val: number) => val.toLocaleString('id-ID');

const txnColumns = [
  { key: 'transaction_date', label: 'Date' },
  { key: 'transaction_type', label: 'Type' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'notes', label: 'Notes' },
];

onMounted(async () => {
  await Promise.all([
    store.fetchInventory(),
    productStore.fetchProducts(),
    fetchWarehouses(),
  ]);
});

const fetchWarehouses = async () => {
  try {
    const res = await api.get('/warehouses');
    warehouses.value = res.data.data || res.data || [];
  } catch (e) { console.error(e); }
};

watch(selectedWarehouse, async () => {
  const params = selectedWarehouse.value ? `?warehouse_id=${selectedWarehouse.value}` : '';
  try {
    const res = await api.get(`/inventory${params}`);
    store.inventory = res.data.data || [];
  } catch (e) { console.error(e); }
});

const filtered = computed(() => {
  const term = search.value.toLowerCase();
  return store.inventory.filter((inv) =>
    !term || (inv.product_name || '').toLowerCase().includes(term) || (inv.sku || '').toLowerCase().includes(term)
  );
});

const totalSku = computed(() => store.inventory.length);
const totalOnHand = computed(() => store.inventory.reduce((sum, inv) => sum + Number(inv.quantity_on_hand || 0), 0));
const lowStock = computed(() => store.inventory.filter((inv) => Number(inv.quantity_on_hand || 0) > 0 && Number(inv.quantity_on_hand || 0) < Number(inv.reorder_point || 10)));
const outOfStock = computed(() => store.inventory.filter((inv) => Number(inv.quantity_on_hand || 0) === 0).length);

const availabilityVariant = (inv: any): 'success' | 'warning' | 'danger' => {
  const available = Number(inv.quantity_on_hand || 0) - Number(inv.quantity_reserved || 0);
  if (available <= 0) return 'danger';
  if (available < 10) return 'warning';
  return 'success';
};

const editInventory = (inv: any) => {
  form.value = {
    product_id: inv.product_id,
    inventory_id: inv.id,
    transaction_type: 'in',
    quantity: 1,
    location: inv.location || '',
    notes: '',
  };
  showUpdateModal.value = true;
};

const updateInventory = async () => {
  try {
    await store.recordTransaction(form.value.inventory_id, {
      transaction_type: form.value.transaction_type,
      quantity: form.value.quantity,
      notes: form.value.notes,
    });
    
    const inv = store.inventory.find(i => i.id === form.value.inventory_id);
    if (inv) {
      const newQty = form.value.transaction_type === 'in' 
        ? inv.quantity_on_hand + form.value.quantity 
        : inv.quantity_on_hand - form.value.quantity;
      
      await store.updateInventory(form.value.inventory_id, {
        quantity_on_hand: newQty,
        quantity_reserved: inv.quantity_reserved,
        location: form.value.location,
      });
    }
    
    closeModal();
  } catch (error) {
    console.error('Failed to update inventory:', error);
  }
};

const viewTransactions = async (productId: number) => {
  await store.fetchTransactions(productId);
  showTransactions.value = true;
};

const closeModal = () => {
  showUpdateModal.value = false;
  form.value = {
    product_id: '',
    inventory_id: 0,
    transaction_type: 'in',
    quantity: 1,
    location: '',
    notes: '',
  };
};

const downloadTemplate = () => {
  window.open('/api/import/template/inventory', '_blank');
};

const handleFileSelect = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  importFile.value = file;
  importResult.value = '';

  // preview
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/import/preview/inventory', formData);
    importPreview.value = res.data.validation || res.data;
  } catch (err: any) {
    importPreview.value = { totalRows: 0, validRows: 0, invalidRows: [], firstError: { rowNumber: 0, errors: [err.response?.data?.error || err.message] } };
  }
};

const executeImport = async () => {
  if (!importFile.value) return;
  importing.value = true;
  importResult.value = '';
  try {
    const formData = new FormData();
    formData.append('file', importFile.value);
    const res = await api.post('/import/import/inventory', formData);
    importResult.value = res.data.message || `Berhasil import ${res.data.importedCount} item`;
    await store.fetchInventory();
  } catch (err: any) {
    importResult.value = 'Error: ' + (err.response?.data?.error || err.message);
  } finally {
    importing.value = false;
  }
};

const closeImport = () => {
  showImportModal.value = false;
  importFile.value = null;
  importPreview.value = null;
  importResult.value = '';
  if (fileInput.value) fileInput.value.value = '';
};
</script>
