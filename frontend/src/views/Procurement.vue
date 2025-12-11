<template>
  <div class="min-h-screen bg-gray-50">
    <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div class="px-4 sm:px-0 space-y-8">
        <header class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500">Procurement</p>
            <h1 class="text-2xl font-bold text-gray-900">Vendors, PR, PO, GR</h1>
          </div>
          <span v-if="store.loading" class="text-sm text-gray-500">Loading...</span>
        </header>

        <div v-if="errorMsg" class="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">{{ errorMsg }}</div>
        <div v-if="successMsg" class="bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded">{{ successMsg }}</div>

        <p v-if="store.error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{{ store.error }}</p>

        <section class="bg-white shadow sm:rounded-lg p-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg font-semibold text-gray-900">Vendors</h2>
            <div class="flex space-x-2">
              <input v-model="vendorForm.code" placeholder="Code" class="input" />
              <input v-model="vendorForm.name" placeholder="Name" class="input" />
              <button @click="submitVendor" class="btn-primary" :disabled="submitting">Save</button>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 text-sm">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">Code</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">Name</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">Contact</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">Email</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr v-for="vendor in store.vendors" :key="vendor.id">
                  <td class="px-3 py-2">{{ vendor.code }}</td>
                  <td class="px-3 py-2">{{ vendor.name }}</td>
                  <td class="px-3 py-2">{{ vendor.contact || '-' }}</td>
                  <td class="px-3 py-2">{{ vendor.email || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="bg-white shadow sm:rounded-lg p-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg font-semibold text-gray-900">Purchase Requests</h2>
            <div class="flex space-x-2">
              <input v-model="prForm.notes" placeholder="Notes" class="input" />
              <button @click="submitPR" class="btn-primary" :disabled="submitting">Create PR</button>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 text-sm">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">PR Number</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">Requester</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">Status</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">Notes</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr v-for="pr in store.purchaseRequests" :key="pr.id">
                  <td class="px-3 py-2">{{ pr.pr_number }}</td>
                  <td class="px-3 py-2">{{ pr.requester_name || '-' }}</td>
                  <td class="px-3 py-2">{{ pr.status }}</td>
                  <td class="px-3 py-2">{{ pr.notes || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="bg-white shadow sm:rounded-lg p-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg font-semibold text-gray-900">Purchase Orders</h2>
            <div class="space-y-2 w-full">
              <div class="flex flex-wrap gap-2 items-center">
                <select v-model.number="poForm.vendor_id" class="input w-40">
                  <option :value="undefined" disabled>Pilih Vendor</option>
                  <option v-for="v in store.vendors" :key="v.id" :value="v.id">{{ v.name }}</option>
                </select>
                <input v-model="poForm.expected_date" type="date" class="input w-40" />
                <button @click="submitPO" class="btn-primary" :disabled="submitting">Create PO</button>
              </div>
              <div class="space-y-1">
                <div
                  v-for="(item, idx) in poItems"
                  :key="idx"
                  class="flex flex-wrap gap-2 items-center"
                >
                  <select v-model.number="item.product_id" class="input w-40">
                    <option :value="undefined" disabled>Pilih Product</option>
                    <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }} ({{ p.sku }})</option>
                  </select>
                  <input v-model.number="item.quantity" type="number" placeholder="Qty" class="input w-24" />
                  <button class="text-sm text-red-600" @click="removePoItem(idx)" v-if="poItems.length > 1" :disabled="submitting">Remove</button>
                </div>
                <button class="text-sm text-blue-600" @click="addPoItem" :disabled="submitting">+ Add Item</button>
              </div>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 text-sm">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">PO Number</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">Vendor</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">Status</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">Expected Date</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">Items</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr v-for="po in store.purchaseOrders" :key="po.id">
                  <td class="px-3 py-2">{{ po.po_number }}</td>
                  <td class="px-3 py-2">{{ po.vendor_name || '-' }}</td>
                  <td class="px-3 py-2">{{ po.status }}</td>
                  <td class="px-3 py-2">{{ po.expected_date ? formatDate(po.expected_date) : '-' }}</td>
                  <td class="px-3 py-2">{{ po.item_count }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="bg-white shadow sm:rounded-lg p-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg font-semibold text-gray-900">Goods Receipts</h2>
            <div class="flex space-x-2">
              <input v-model.number="grForm.po_id" type="number" placeholder="PO ID" class="input w-32" />
              <select v-model.number="grForm.warehouse_id" class="input w-48">
                <option :value="undefined" disabled>Pilih Warehouse</option>
                <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
              </select>
              <button @click="submitGR" class="btn-primary" :disabled="submitting">Create GR</button>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 text-sm">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">GR Number</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">PO</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">Warehouse</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">Status</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">Received At</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr v-for="gr in store.goodsReceipts" :key="gr.id">
                  <td class="px-3 py-2">{{ gr.gr_number }}</td>
                  <td class="px-3 py-2">{{ gr.po_number || '-' }}</td>
                  <td class="px-3 py-2">{{ gr.warehouse_name || '-' }}</td>
                  <td class="px-3 py-2">{{ gr.status }}</td>
                  <td class="px-3 py-2">{{ gr.received_at ? formatDate(gr.received_at) : '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useProcurementStore } from '../stores/procurement';
import { useProductStore } from '../stores/products';
import { useWarehouseStore } from '../stores/warehouse';

const store = useProcurementStore();
const productStore = useProductStore();
const warehouseStore = useWarehouseStore();

const formatDate = (value: string) => new Date(value).toLocaleDateString();

const vendorForm = ref({ code: '', name: '' });
const prForm = ref({ notes: '' });
const poForm = ref({ vendor_id: undefined as number | undefined, expected_date: '' });
const poItems = ref([{ product_id: undefined as number | undefined, quantity: 1 }]);
const grForm = ref({ po_id: undefined as number | undefined, warehouse_id: undefined as number | undefined });
const successMsg = ref('');
const errorMsg = ref('');
const products = computed(() => productStore.products || []);
const warehouses = computed(() => warehouseStore.warehouses || []);
const submitting = ref(false);

onMounted(async () => {
  await Promise.all([
    store.fetchVendors(),
    store.fetchPurchaseRequests(),
    store.fetchPurchaseOrders(),
    store.fetchGoodsReceipts(),
    productStore.fetchProducts(),
    warehouseStore.fetchWarehouses(),
  ]);
});

const submitVendor = async () => {
  if (!vendorForm.value.code || !vendorForm.value.name) {
    errorMsg.value = 'Vendor code dan name wajib diisi';
    return;
  }
  errorMsg.value = '';
  submitting.value = true;
  try {
    await store.createVendor(vendorForm.value);
    vendorForm.value = { code: '', name: '' };
    successMsg.value = 'Vendor berhasil dibuat';
  } catch (err: any) {
    errorMsg.value = err?.response?.data?.error || 'Gagal membuat vendor';
  } finally {
    submitting.value = false;
  }
};

const submitPR = async () => {
  errorMsg.value = '';
  submitting.value = true;
  try {
    await store.createPurchaseRequest({ notes: prForm.value.notes || undefined });
    prForm.value = { notes: '' };
    successMsg.value = 'Purchase request dibuat';
  } catch (err: any) {
    errorMsg.value = err?.response?.data?.error || 'Gagal membuat purchase request';
  } finally {
    submitting.value = false;
  }
};

const submitPO = async () => {
  const validItems = poItems.value.filter((i) => i.product_id && i.quantity);
  if (!poForm.value.vendor_id || validItems.length === 0) {
    errorMsg.value = 'Vendor dan minimal satu item (product + qty) wajib diisi';
    return;
  }
  errorMsg.value = '';
  submitting.value = true;
  try {
    await store.createPurchaseOrder({
      vendor_id: poForm.value.vendor_id,
      expected_date: poForm.value.expected_date || undefined,
      items: validItems.map((i) => ({ product_id: i.product_id!, quantity: i.quantity! })),
    });
    poForm.value = { vendor_id: undefined, expected_date: '' };
    poItems.value = [{ product_id: undefined, quantity: 1 }];
    successMsg.value = 'Purchase order dibuat';
  } catch (err: any) {
    errorMsg.value = err?.response?.data?.error || 'Gagal membuat purchase order';
  } finally {
    submitting.value = false;
  }
};

const addPoItem = () => {
  poItems.value.push({ product_id: undefined, quantity: 1 });
};

const removePoItem = (idx: number) => {
  if (poItems.value.length > 1) {
    poItems.value.splice(idx, 1);
  }
};

const submitGR = async () => {
  if (!grForm.value.po_id) {
    errorMsg.value = 'PO ID wajib diisi';
    return;
  }
  errorMsg.value = '';
  submitting.value = true;
  try {
    await store.createGoodsReceipt({ po_id: grForm.value.po_id, warehouse_id: grForm.value.warehouse_id });
    grForm.value = { po_id: undefined, warehouse_id: undefined };
    successMsg.value = 'Goods receipt dibuat';
  } catch (err: any) {
    errorMsg.value = err?.response?.data?.error || 'Gagal membuat goods receipt';
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped>
.input {
  @apply border border-gray-300 rounded px-2 py-1 text-sm;
}
.btn-primary {
  @apply bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700;
}
</style>
