<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
    <div class="max-w-7xl mx-auto space-y-6">
      <header class="mb-2">
        <h1 class="text-3xl font-bold text-slate-800">Warehouse Management</h1>
        <p class="text-slate-600">Manage warehouses, locations, allocation (FIFO/FEFO), and stock health.</p>
      </header>

      <!-- Warehouses Section -->
      <section class="bg-white rounded-lg shadow-sm p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-bold text-slate-800">Warehouses</h2>
          <button @click="showWHForm = !showWHForm" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            {{ showWHForm ? '✕ Close' : '+ New' }}
          </button>
        </div>

        <div v-if="showWHForm" class="bg-slate-50 rounded-lg p-4 mb-4 space-y-3">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input v-model="whForm.code" placeholder="Code" type="text"
                   class="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            <input v-model="whForm.name" placeholder="Name" type="text"
                   class="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            <input v-model="whForm.address" placeholder="Address" type="text"
                   class="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <div class="flex gap-3">
            <button @click="submitWarehouse" :disabled="submittingWH"
                    class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {{ submittingWH ? 'Saving...' : 'Create Warehouse' }}
            </button>
            <button @click="showWHForm = false" class="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100">
              Cancel
            </button>
          </div>
        </div>

        <div v-if="warehouses.length === 0" class="text-center py-8 text-slate-500">
          No warehouses found.
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="text-left p-3 font-semibold text-slate-700">Code</th>
                <th class="text-left p-3 font-semibold text-slate-700">Name</th>
                <th class="text-left p-3 font-semibold text-slate-700">Address</th>
                <th class="text-right p-3 font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              <tr v-for="wh in warehouses" :key="wh.id" class="hover:bg-slate-50 transition">
                <td class="p-3 font-medium">{{ wh.code }}</td>
                <td class="p-3">{{ wh.name }}</td>
                <td class="p-3">{{ wh.address || '-' }}</td>
                <td class="p-3 text-right">
                  <button @click="selectWarehouse(wh.id!)" class="text-blue-600 hover:text-blue-800 text-sm font-medium">
                    View Details
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Selected Warehouse Details -->
      <section v-if="selectedWarehouse" class="bg-white rounded-lg shadow-sm p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-bold text-slate-800">{{ selectedWarehouse.name }} - Locations</h2>
          <button @click="showLocationForm = true" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            + New Location
          </button>
        </div>

        <div v-if="locationsLoading" class="text-center py-8 text-slate-500">
          <div class="inline-block animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
        </div>

        <div v-else-if="locations.length === 0" class="text-center py-8 text-slate-500">
          No locations. Create one to start organizing inventory.
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="location in locations" :key="location.id"
               class="border border-slate-200 rounded-lg p-4 hover:shadow-md transition">
            <div class="flex justify-between items-start mb-3">
              <div>
                <p class="font-bold text-slate-800">{{ location.location_code }}</p>
                <p class="text-xs text-slate-500">{{ location.rack }}/{{ location.row }}/{{ location.bin }}</p>
              </div>
              <button @click="deleteLocation(location.id!)" class="text-red-600 hover:text-red-800 text-xs">×</button>
            </div>
            <div class="space-y-1 text-xs">
              <p v-if="location.description" class="text-slate-600">{{ location.description }}</p>
              <p class="text-slate-500">📦 {{ location.batch_count || 0 }} batches</p>
              <p class="text-slate-500">📊 {{ (location.total_quantity || 0).toFixed(2) }} units</p>
              <p v-if="location.capacity" class="text-slate-500">⚙️ Cap: {{ location.capacity }}</p>
            </div>
          </div>
        </div>

        <!-- Stock Health -->
        <div class="mt-8 pt-6 border-t border-slate-200">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-bold text-slate-800">Stock Health</h3>
            <button @click="refreshStockHealth" class="px-3 py-1 bg-slate-200 text-slate-700 rounded text-sm hover:bg-slate-300">
              Refresh
            </button>
          </div>

          <div v-if="healthLoading" class="text-center py-4 text-slate-500">Loading...</div>

          <div v-else-if="stockHealth" class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 class="font-bold text-red-700 mb-3">⚠️ Low Stock ({{ (stockHealth.low_stock || []).length }})</h4>
              <div v-if="(stockHealth.low_stock || []).length === 0" class="text-sm text-red-600">All items OK</div>
              <div v-else class="space-y-2 text-xs">
                <div v-for="item in stockHealth.low_stock" :key="item.id" class="bg-white rounded p-2">
                  <p class="font-medium">{{ item.name }}</p>
                  <p class="text-slate-600">Current: {{ (item.current_qty || 0).toFixed(0) }} / Min: {{ (item.min_qty || 0).toFixed(0) }}</p>
                </div>
              </div>
            </div>

            <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 class="font-bold text-amber-700 mb-3">📦 Expiring (30d) ({{ (stockHealth.expiring_batches || []).length }})</h4>
              <div v-if="(stockHealth.expiring_batches || []).length === 0" class="text-sm text-amber-600">All OK</div>
              <div v-else class="space-y-2 text-xs">
                <div v-for="batch in stockHealth.expiring_batches.slice(0, 5)" :key="batch.id" class="bg-white rounded p-2">
                  <p class="font-mono text-blue-600">{{ batch.batch_number }}</p>
                  <p class="text-slate-600">{{ batch.product_name }} - {{ batch.days_to_expiry }}d</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Stock Allocation -->
      <section class="bg-white rounded-lg shadow-sm p-6">
        <h2 class="text-xl font-bold text-slate-800 mb-4">Stock Allocation (FIFO/FEFO)</h2>

        <div class="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Product</label>
            <select v-model.number="allocationFilter.product_id"
                    class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="0">Select...</option>
              <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Quantity</label>
            <input v-model.number="allocationFilter.quantity" type="number" step="0.01"
                   class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Method</label>
            <select v-model="allocationFilter.method" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="FEFO">FEFO</option>
              <option value="FIFO">FIFO</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Warehouse</label>
            <select v-model.number="allocationFilter.warehouse_id" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option :value="0">Any</option>
              <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.code }}</option>
            </select>
          </div>

          <div class="flex items-end">
            <button @click="runAllocation" class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
              Allocate
            </button>
          </div>
        </div>

        <div v-if="allocationResult" class="bg-slate-50 rounded-lg p-4 mb-6">
          <div class="grid grid-cols-4 gap-4 text-sm">
            <div class="text-center">
              <p class="text-slate-500">Needed</p>
              <p class="text-2xl font-bold">{{ allocationResult.quantity_needed }}</p>
            </div>
            <div class="text-center">
              <p class="text-slate-500">Allocated</p>
              <p class="text-2xl font-bold text-green-600">{{ allocationResult.quantity_allocated }}</p>
            </div>
            <div class="text-center">
              <p class="text-slate-500">Short</p>
              <p class="text-2xl font-bold" :class="allocationResult.quantity_short > 0 ? 'text-red-600' : ''">
                {{ allocationResult.quantity_short }}
              </p>
            </div>
            <div class="text-center">
              <p class="text-slate-500">Status</p>
              <p class="text-lg font-bold px-3 py-1 rounded" :class="allocationResult.can_fulfill ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'">
                {{ allocationResult.can_fulfill ? '✓ OK' : '✗ SHORT' }}
              </p>
            </div>
          </div>
        </div>

        <div v-if="stockAllocations.length > 0" class="mt-4 overflow-x-auto">
          <table class="w-full text-xs">
            <thead class="bg-slate-100">
              <tr>
                <th class="text-left p-2">Batch</th>
                <th class="text-left p-2">Location</th>
                <th class="text-left p-2">Qty Allocated</th>
                <th class="text-left p-2">Available</th>
                <th class="text-left p-2">Exp Date</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="a in stockAllocations" :key="a.batch_id" class="hover:bg-slate-50">
                <td class="p-2 font-mono text-blue-600">{{ a.batch_number }}</td>
                <td class="p-2">{{ a.rack }}/{{ a.row }}/{{ a.bin }}</td>
                <td class="p-2 font-medium">{{ a.allocated_qty }}</td>
                <td class="p-2">{{ a.available_qty }}</td>
                <td class="p-2">{{ a.exp_date ? formatDate(a.exp_date) : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Stock Movements -->
      <section class="bg-white rounded-lg shadow-sm p-6">
        <h2 class="text-xl font-bold text-slate-800 mb-4">Recent Stock Movements</h2>
        <div v-if="stockMovements.length === 0" class="text-center py-8 text-slate-500">
          No stock movements recorded.
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="text-left p-3 font-semibold">Product</th>
                <th class="text-left p-3 font-semibold">Type</th>
                <th class="text-left p-3 font-semibold">Quantity</th>
                <th class="text-left p-3 font-semibold">Warehouse</th>
                <th class="text-left p-3 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              <tr v-for="(m, idx) in stockMovements.slice(0, 10)" :key="idx" class="hover:bg-slate-50">
                <td class="p-3">{{ m.product_name }}</td>
                <td class="p-3">
                  <span class="px-2 py-1 rounded text-xs font-medium"
                        :class="m.movement_type === 'IN'
                          ? 'bg-green-100 text-green-700'
                          : m.movement_type === 'OUT'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'">
                    {{ m.movement_type }}
                  </span>
                </td>
                <td class="p-3">{{ m.quantity }} {{ m.uom }}</td>
                <td class="p-3">{{ m.warehouse_name }}</td>
                <td class="p-3 text-xs text-slate-500">{{ new Date(m.moved_at).toLocaleDateString() }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- Location Form Modal -->
    <div v-if="showLocationForm" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div class="border-b border-slate-200 px-6 py-4">
          <h2 class="text-xl font-bold text-slate-800">New Location</h2>
        </div>

        <form @submit.prevent="submitLocation" class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Location Code *</label>
            <input v-model="locationForm.location_code" type="text" required
                   class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>

          <div class="grid grid-cols-3 gap-2">
            <input v-model="locationForm.rack" placeholder="Rack" type="text"
                   class="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            <input v-model="locationForm.row" placeholder="Row" type="text"
                   class="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            <input v-model="locationForm.bin" placeholder="Bin" type="text"
                   class="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>

          <input v-model.number="locationForm.capacity" placeholder="Capacity" type="number" step="0.01"
                 class="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm" />

          <textarea v-model="locationForm.description" placeholder="Description" rows="2"
                    class="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm"></textarea>

          <div class="flex gap-3 justify-end pt-4 border-t">
            <button type="button" @click="showLocationForm = false"
                    class="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useWarehouseStore } from '@/stores/warehouse';
import { useProductStore } from '@/stores/products';

const store = useWarehouseStore();
const productStore = useProductStore();

const warehouses = computed(() => store.warehouses || []);
const locations = computed(() => store.locations || []);
const stockHealth = computed(() => store.stockHealth);
const stockAllocations = computed(() => store.stockAllocations || []);
const stockMovements = computed(() => store.stockMovements || []);
const products = computed(() => productStore.products || []);

const showWHForm = ref(false);
const showLocationForm = ref(false);
const submittingWH = ref(false);
const selectedWarehouse = ref<any>(null);
const locationsLoading = computed(() => store.loading);
const healthLoading = computed(() => store.loading);

const whForm = ref({
  code: '',
  name: '',
  address: '',
});

const locationForm = ref({
  warehouse_id: 0,
  location_code: '',
  rack: '',
  row: '',
  bin: '',
  capacity: undefined as number | undefined,
  description: '',
});

const allocationFilter = ref({
  product_id: 0,
  quantity: 0,
  method: 'FEFO',
  warehouse_id: 0,
});

const allocationResult = ref<any>(null);

onMounted(async () => {
  await Promise.all([
    store.fetchWarehouses(),
    store.fetchStockMovements(),
    productStore.fetchProducts(),
  ]);
});

const submitWarehouse = async () => {
  if (!whForm.value.code || !whForm.value.name) return;
  submittingWH.value = true;
  try {
    await store.createWarehouse(whForm.value);
    whForm.value = { code: '', name: '', address: '' };
    showWHForm.value = false;
  } catch (error) {
    console.error('Error creating warehouse:', error);
  } finally {
    submittingWH.value = false;
  }
};

const selectWarehouse = async (warehouseId: number) => {
  selectedWarehouse.value = warehouses.value.find((w: any) => w.id === warehouseId) || null;
  if (!selectedWarehouse.value) return;
  locationForm.value.warehouse_id = warehouseId;
  await store.fetchLocations(warehouseId);
  await store.fetchStockHealth(warehouseId);
};

const submitLocation = async () => {
  if (!selectedWarehouse.value || !locationForm.value.location_code) return;
  try {
    await store.createLocation(selectedWarehouse.value.id, locationForm.value);
    showLocationForm.value = false;
    locationForm.value = {
      warehouse_id: selectedWarehouse.value.id,
      location_code: '',
      rack: '',
      row: '',
      bin: '',
      capacity: undefined,
      description: '',
    };
  } catch (error) {
    console.error('Error creating location:', error);
  }
};

const deleteLocation = async (locationId: number) => {
  if (!selectedWarehouse.value) return;
  if (confirm('Delete this location?')) {
    try {
      await store.deleteLocation(selectedWarehouse.value.id, locationId);
    } catch (error) {
      console.error('Error deleting location:', error);
    }
  }
};

const refreshStockHealth = async () => {
  if (selectedWarehouse.value) {
    await store.fetchStockHealth(selectedWarehouse.value.id);
  }
};

const runAllocation = async () => {
  if (!allocationFilter.value.product_id || !allocationFilter.value.quantity) {
    alert('Please select a product and quantity');
    return;
  }
  try {
    allocationResult.value = await store.allocateStock(
      allocationFilter.value.product_id,
      allocationFilter.value.quantity,
      allocationFilter.value.method as 'FIFO' | 'FEFO',
      allocationFilter.value.warehouse_id || undefined,
    );
  } catch (error) {
    console.error('Error allocating stock:', error);
  }
};

const formatDate = (date: string) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};
</script>
