<template>
  <div class="min-h-screen bg-gray-50">
    <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div class="px-4 sm:px-0 space-y-8">
        <header class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500">Sales</p>
            <h1 class="text-2xl font-bold text-gray-900">Customers, SO, Delivery, Invoice</h1>
          </div>
          <span v-if="store.loading" class="text-sm text-gray-500">Loading...</span>
        </header>

        <div v-if="errorMsg" class="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">{{ errorMsg }}</div>
        <div v-if="successMsg" class="bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded">{{ successMsg }}</div>

        <p v-if="store.error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{{ store.error }}</p>

        <section class="bg-white shadow sm:rounded-lg p-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg font-semibold text-gray-900">Customers</h2>
            <div class="flex space-x-2">
              <input v-model="customerForm.code" placeholder="Code" class="input" />
              <input v-model="customerForm.name" placeholder="Name" class="input" />
              <button @click="submitCustomer" class="btn-primary" :disabled="submitting">Save</button>
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
                <tr v-for="customer in store.customers" :key="customer.id">
                  <td class="px-3 py-2">{{ customer.code }}</td>
                  <td class="px-3 py-2">{{ customer.name }}</td>
                  <td class="px-3 py-2">{{ customer.contact || '-' }}</td>
                  <td class="px-3 py-2">{{ customer.email || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="bg-white shadow sm:rounded-lg p-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg font-semibold text-gray-900">Sales Orders</h2>
            <div class="flex flex-wrap gap-2 items-center">
              <select v-model.number="soForm.customer_id" class="input w-40">
                <option :value="undefined" disabled>Pilih Customer</option>
                <option v-for="c in store.customers" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
              <input v-model="soForm.expected_ship_date" type="date" class="input w-40" />
              <button @click="submitSO" class="btn-primary" :disabled="submitting">Create SO</button>
            </div>
            <div class="space-y-1 mt-2">
              <div
                v-for="(item, idx) in soItems"
                :key="idx"
                class="flex flex-wrap gap-2 items-center"
              >
                <select v-model.number="item.product_id" class="input w-40">
                  <option :value="undefined" disabled>Pilih Product</option>
                  <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }} ({{ p.sku }})</option>
                </select>
                <input v-model.number="item.quantity" type="number" placeholder="Qty" class="input w-24" />
                <button class="text-sm text-red-600" @click="removeSoItem(idx)" v-if="soItems.length > 1" :disabled="submitting">Remove</button>
              </div>
              <button class="text-sm text-blue-600" @click="addSoItem" :disabled="submitting">+ Add Item</button>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 text-sm">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">SO Number</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">Customer</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">Status</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">Expected Ship</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">Items</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr v-for="so in store.salesOrders" :key="so.id">
                  <td class="px-3 py-2">{{ so.so_number }}</td>
                  <td class="px-3 py-2">{{ so.customer_name || '-' }}</td>
                  <td class="px-3 py-2">{{ so.status }}</td>
                  <td class="px-3 py-2">{{ so.expected_ship_date ? formatDate(so.expected_ship_date) : '-' }}</td>
                  <td class="px-3 py-2">{{ so.item_count }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="bg-white shadow sm:rounded-lg p-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg font-semibold text-gray-900">Deliveries</h2>
            <div class="flex space-x-2">
                <input v-model.number="doForm.so_id" type="number" placeholder="SO ID" class="input w-28" />
                <select v-model.number="doForm.warehouse_id" class="input w-32">
                  <option :value="undefined" disabled>Pilih Warehouse</option>
                  <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
                </select>
              <button @click="submitDO" class="btn-primary" :disabled="submitting">Create DO</button>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 text-sm">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">DO Number</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">SO</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">Warehouse</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">Status</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">Shipped At</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr v-for="doItem in store.deliveries" :key="doItem.id">
                  <td class="px-3 py-2">{{ doItem.do_number }}</td>
                  <td class="px-3 py-2">{{ doItem.so_number || '-' }}</td>
                  <td class="px-3 py-2">{{ doItem.warehouse_name || '-' }}</td>
                  <td class="px-3 py-2">{{ doItem.status }}</td>
                  <td class="px-3 py-2">{{ doItem.shipped_at ? formatDate(doItem.shipped_at) : '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="bg-white shadow sm:rounded-lg p-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg font-semibold text-gray-900">Invoices</h2>
            <div class="flex space-x-2 items-center">
              <input v-model.number="invForm.so_id" type="number" placeholder="SO ID" class="input w-28" />
              <input v-model.number="invForm.amount" type="number" placeholder="Amount" class="input w-28" />
              <button @click="submitInvoice" class="btn-primary" :disabled="submitting">Create Invoice</button>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 text-sm">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">Invoice</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">SO</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">Amount</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">Status</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">Issued</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr v-for="inv in store.invoices" :key="inv.id">
                  <td class="px-3 py-2">{{ inv.invoice_number }}</td>
                  <td class="px-3 py-2">{{ inv.so_number || '-' }}</td>
                  <td class="px-3 py-2">{{ inv.amount }} {{ inv.currency }}</td>
                  <td class="px-3 py-2">{{ inv.status }}</td>
                  <td class="px-3 py-2">{{ inv.issued_at ? formatDate(inv.issued_at) : '-' }}</td>
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
import { useSalesStore } from '../stores/sales';
import { useProductStore } from '../stores/products';
import { useWarehouseStore } from '../stores/warehouse';

const store = useSalesStore();
const productStore = useProductStore();
const warehouseStore = useWarehouseStore();
const formatDate = (value: string) => new Date(value).toLocaleDateString();

const customerForm = ref({ code: '', name: '' });
const soForm = ref({ customer_id: undefined as number | undefined, expected_ship_date: '' });
const soItems = ref([{ product_id: undefined as number | undefined, quantity: 1 }]);
const doForm = ref({ so_id: undefined as number | undefined, warehouse_id: undefined as number | undefined });
const invForm = ref({ so_id: undefined as number | undefined, amount: undefined as number | undefined });
const successMsg = ref('');
const errorMsg = ref('');
const products = computed(() => productStore.products || []);
const warehouses = computed(() => warehouseStore.warehouses || []);
const submitting = ref(false);

onMounted(async () => {
  await Promise.all([
    store.fetchCustomers(),
    store.fetchSalesOrders(),
    store.fetchDeliveries(),
    store.fetchInvoices(),
    productStore.fetchProducts(),
    warehouseStore.fetchWarehouses(),
  ]);
});

const submitCustomer = async () => {
  if (!customerForm.value.code || !customerForm.value.name) {
    errorMsg.value = 'Customer code dan name wajib diisi';
    return;
  }
  errorMsg.value = '';
  submitting.value = true;
  try {
    await store.createCustomer(customerForm.value);
    customerForm.value = { code: '', name: '' };
    successMsg.value = 'Customer dibuat';
  } catch (err: any) {
    errorMsg.value = err?.response?.data?.error || 'Gagal membuat customer';
  } finally {
    submitting.value = false;
  }
};

const submitSO = async () => {
  const validItems = soItems.value.filter((i) => i.product_id && i.quantity);
  if (!soForm.value.customer_id || validItems.length === 0) {
    errorMsg.value = 'Customer dan minimal satu item (product + qty) wajib diisi';
    return;
  }
  errorMsg.value = '';
  submitting.value = true;
  try {
    await store.createSalesOrder({
      customer_id: soForm.value.customer_id,
      expected_ship_date: soForm.value.expected_ship_date || undefined,
      items: validItems.map((i) => ({ product_id: i.product_id!, quantity: i.quantity! })),
    });
    soForm.value = { customer_id: undefined, expected_ship_date: '' };
    soItems.value = [{ product_id: undefined, quantity: 1 }];
    successMsg.value = 'Sales order dibuat';
  } catch (err: any) {
    errorMsg.value = err?.response?.data?.error || 'Gagal membuat sales order';
  } finally {
    submitting.value = false;
  }
};

const addSoItem = () => {
  soItems.value.push({ product_id: undefined, quantity: 1 });
};

const removeSoItem = (idx: number) => {
  if (soItems.value.length > 1) {
    soItems.value.splice(idx, 1);
  }
};

const submitDO = async () => {
  if (!doForm.value.so_id) {
    errorMsg.value = 'SO ID wajib diisi';
    return;
  }
  errorMsg.value = '';
  submitting.value = true;
  try {
    await store.createDelivery({ so_id: doForm.value.so_id, warehouse_id: doForm.value.warehouse_id });
    doForm.value = { so_id: undefined, warehouse_id: undefined };
    successMsg.value = 'Delivery order dibuat';
  } catch (err: any) {
    errorMsg.value = err?.response?.data?.error || 'Gagal membuat delivery order';
  } finally {
    submitting.value = false;
  }
};

const submitInvoice = async () => {
  if (!invForm.value.so_id || invForm.value.amount === undefined) {
    errorMsg.value = 'SO ID dan amount wajib diisi';
    return;
  }
  errorMsg.value = '';
  submitting.value = true;
  try {
    await store.createInvoice({ so_id: invForm.value.so_id, amount: invForm.value.amount });
    invForm.value = { so_id: undefined, amount: undefined };
    successMsg.value = 'Invoice dibuat';
  } catch (err: any) {
    errorMsg.value = err?.response?.data?.error || 'Gagal membuat invoice';
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
