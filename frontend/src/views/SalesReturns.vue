<template>
  <div class="min-h-screen bg-gray-50">
    <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Sales Returns</h2>
          <p class="text-sm text-gray-500 mt-1">Goods taken back from a customer, and the credit note it raises</p>
        </div>
        <button @click="openForm"
          class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">+ New Return</button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div class="bg-white shadow rounded-lg p-4">
          <p class="text-xs text-gray-500 uppercase">Returns</p>
          <p class="text-2xl font-bold">{{ returns.length }}</p>
        </div>
        <div class="bg-white shadow rounded-lg p-4">
          <p class="text-xs text-gray-500 uppercase">Credit Notes</p>
          <p class="text-2xl font-bold">{{ fmt(totals.credit) }}</p>
        </div>
        <div class="bg-white shadow rounded-lg p-4">
          <p class="text-xs text-green-600 uppercase">Cost Returned to Stock</p>
          <p class="text-2xl font-bold text-green-700">{{ fmt(totals.cogs) }}</p>
          <p class="text-[11px] text-gray-400 mt-1">restocked goods only</p>
        </div>
        <div class="bg-white shadow rounded-lg p-4">
          <p class="text-xs text-gray-500 uppercase">Output Tax Reversed</p>
          <p class="text-2xl font-bold">{{ fmt(totals.tax) }}</p>
        </div>
      </div>

      <div v-if="loading" class="text-center py-10">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>

      <div v-else class="bg-white shadow rounded-lg overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Return No</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Delivery</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cost Back</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credit Note</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-if="!returns.length">
              <td colspan="6" class="px-4 py-10 text-center text-sm text-gray-500">No sales returns yet.</td>
            </tr>
            <tr v-for="r in returns" :key="r.id" class="hover:bg-gray-50">
              <td class="px-4 py-3 text-sm font-medium text-gray-900">{{ r.return_number }}</td>
              <td class="px-4 py-3 text-sm text-gray-600">{{ fmtDate(r.return_date) }}</td>
              <td class="px-4 py-3 text-sm text-gray-600">{{ r.customer_name || '-' }}</td>
              <td class="px-4 py-3 text-sm text-gray-600">{{ r.do_number || r.delivery_id }}</td>
              <td class="px-4 py-3 text-sm text-right text-green-700">{{ fmt(r.cogs_reversed) }}</td>
              <td class="px-4 py-3 text-sm text-right">{{ fmt(r.credit_note_gross) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- create -->
      <div v-if="showForm" class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
          <div class="px-6 py-4 border-b flex justify-between items-center">
            <h3 class="text-lg font-semibold">New Sales Return</h3>
            <button @click="showForm = false" class="text-gray-400 hover:text-gray-600">&times;</button>
          </div>

          <div class="px-6 py-4 space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Delivery</label>
                <select v-model="form.deliveryId" @change="loadLines"
                  class="w-full border-gray-300 rounded-md text-sm shadow-sm">
                  <option value="">Select a delivery…</option>
                  <option v-for="d in deliveries" :key="d.id" :value="d.id">
                    {{ d.do_number }} — {{ d.so_number || '' }}
                  </option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Return Number</label>
                <input v-model="form.returnNumber" type="text"
                  class="w-full border-gray-300 rounded-md text-sm shadow-sm" placeholder="SRET-0001" />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Return Date</label>
                <input v-model="form.returnDate" type="date"
                  class="w-full border-gray-300 rounded-md text-sm shadow-sm" />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Output Tax to Reverse</label>
                <input v-model.number="form.taxAmount" type="number" min="0" step="0.01"
                  class="w-full border-gray-300 rounded-md text-sm text-right shadow-sm" />
              </div>
            </div>

            <div v-if="delivery" class="text-sm text-gray-600 bg-gray-50 rounded-md px-3 py-2">
              Customer <span class="font-medium text-gray-900">{{ delivery.customer_name }}</span>
              · Warehouse <span class="font-medium text-gray-900">{{ delivery.warehouse_name }}</span>
              · Credit note against
              <span class="font-medium text-gray-900">{{ delivery.invoice_number || 'no invoice yet' }}</span>
            </div>

            <div v-if="linesLoading" class="text-center py-6">
              <div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>

            <div v-else-if="lines.length" class="border rounded-md overflow-hidden">
              <table class="min-w-full text-sm">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Lot</th>
                    <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Delivered</th>
                    <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Returnable</th>
                    <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Return Qty</th>
                    <th class="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Resaleable</th>
                    <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                  </tr>
                </thead>
                <tbody class="divide-y">
                  <tr v-for="l in lines" :key="l.delivery_item_id">
                    <td class="px-3 py-2">
                      <div class="font-medium text-gray-900">{{ l.product_name }}</div>
                      <div class="text-xs text-gray-500">{{ l.sku }} · cost {{ fmt(l.unit_cost) }}</div>
                    </td>
                    <td class="px-3 py-2 text-xs text-gray-600">{{ l.lot_number || '—' }}</td>
                    <td class="px-3 py-2 text-right">{{ num(l.quantity_delivered) }}</td>
                    <td class="px-3 py-2 text-right font-medium">{{ num(l.returnable) }}</td>
                    <td class="px-3 py-2 text-right">
                      <input v-model.number="row[l.delivery_item_id].qty" type="number" min="0" step="0.0001"
                        :max="Number(l.returnable)" :disabled="Number(l.returnable) <= 0"
                        class="w-24 border-gray-300 rounded-md text-sm text-right shadow-sm disabled:bg-gray-100" />
                    </td>
                    <td class="px-3 py-2 text-center">
                      <input v-model="row[l.delivery_item_id].restocked" type="checkbox"
                        class="h-4 w-4 rounded border-gray-300" />
                    </td>
                    <td class="px-3 py-2 text-right">
                      <input v-model.number="row[l.delivery_item_id].unitPrice" type="number" min="0" step="0.01"
                        class="w-28 border-gray-300 rounded-md text-sm text-right shadow-sm" />
                    </td>
                  </tr>
                </tbody>
              </table>
              <p class="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-t">
                Leave <span class="font-medium">Resaleable</span> unticked for damaged goods: they are not written
                back into stock, but the customer is still credited.
              </p>
            </div>

            <div v-if="preview.creditNet > 0 || preview.cogs > 0"
              class="text-sm bg-blue-50 border border-blue-200 rounded-md px-3 py-2 space-y-1">
              <div class="text-blue-900 font-medium">This return will post as:</div>
              <div v-if="preview.cogs > 0" class="text-green-800">
                {{ fmt(preview.cogs) }} of cost back into stock, reversing cost of sales
              </div>
              <div class="text-blue-800">
                Credit note {{ fmt(preview.creditNet) }} + tax {{ fmt(form.taxAmount || 0) }}
                = <span class="font-medium">{{ fmt(preview.creditNet + Number(form.taxAmount || 0)) }}</span>
              </div>
            </div>

            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Reason</label>
              <textarea v-model="form.reason" rows="2"
                class="w-full border-gray-300 rounded-md text-sm shadow-sm"
                placeholder="Why the goods came back"></textarea>
            </div>

            <div v-if="error" class="text-sm bg-red-50 border border-red-200 text-red-800 rounded-md px-3 py-2">
              {{ error }}
            </div>
          </div>

          <div class="px-6 py-4 border-t flex justify-end gap-2">
            <button @click="showForm = false"
              class="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">Cancel</button>
            <button @click="submit" :disabled="!canSubmit || saving"
              class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
              {{ saving ? 'Posting…' : 'Post Return' }}
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api } from '../lib/api';

const returns = ref<any[]>([]);
const deliveries = ref<any[]>([]);
const lines = ref<any[]>([]);
const delivery = ref<any>(null);
const row = ref<Record<number, { qty: number; restocked: boolean; unitPrice: number }>>({});

const loading = ref(false);
const linesLoading = ref(false);
const saving = ref(false);
const showForm = ref(false);
const error = ref('');

const form = ref({
  deliveryId: '' as string | number,
  returnNumber: '',
  returnDate: new Date().toISOString().slice(0, 10),
  taxAmount: 0,
  reason: '',
  idempotencyKey: '',
});

const fmt = (v: any) => Number(v || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 });
const num = (v: any) => Number(v || 0).toLocaleString('id-ID', { maximumFractionDigits: 4 });
const fmtDate = (d: string) => (d ? new Date(d).toLocaleDateString('id-ID') : '-');

const totals = computed(() => ({
  credit: returns.value.reduce((s, r) => s + Number(r.credit_note_gross || 0), 0),
  cogs: returns.value.reduce((s, r) => s + Number(r.cogs_reversed || 0), 0),
  tax: returns.value.reduce((s, r) => s + Number(r.credit_note_tax || 0), 0),
}));

// Only restocked goods put cost back; damaged goods are credited but stay in cost of sales,
// because the goods really are gone.
const preview = computed(() => {
  let cogs = 0;
  let creditNet = 0;
  for (const l of lines.value) {
    const r = row.value[l.delivery_item_id];
    const q = Number(r?.qty || 0);
    if (q <= 0) continue;
    if (r.restocked) cogs += q * Number(l.unit_cost || 0);
    creditNet += q * Number(r.unitPrice || 0);
  }
  return { cogs, creditNet };
});

const canSubmit = computed(() => {
  if (!form.value.deliveryId || !form.value.returnNumber.trim()) return false;
  return lines.value.some(l => Number(row.value[l.delivery_item_id]?.qty || 0) > 0);
});

const loadReturns = async () => {
  loading.value = true;
  try {
    const { data } = await api.get('/sales/sales-returns');
    returns.value = data.data || [];
  } finally {
    loading.value = false;
  }
};

const loadDeliveries = async () => {
  const { data } = await api.get('/sales/deliveries');
  deliveries.value = data.data || [];
};

const loadLines = async () => {
  lines.value = [];
  delivery.value = null;
  row.value = {};
  error.value = '';
  if (!form.value.deliveryId) return;
  linesLoading.value = true;
  try {
    const { data } = await api.get(`/sales/deliveries/${form.value.deliveryId}/returnable`);
    delivery.value = data.data.delivery;
    lines.value = data.data.lines || [];
    for (const l of lines.value) {
      row.value[l.delivery_item_id] = { qty: 0, restocked: true, unitPrice: 0 };
    }
  } catch (e: any) {
    error.value = e?.response?.data?.error || 'Could not load the delivery lines.';
  } finally {
    linesLoading.value = false;
  }
};

const openForm = async () => {
  error.value = '';
  lines.value = [];
  delivery.value = null;
  row.value = {};
  form.value = {
    deliveryId: '',
    returnNumber: '',
    returnDate: new Date().toISOString().slice(0, 10),
    taxAmount: 0,
    reason: '',
    // fixed when the form opens, so re-submitting after a timeout settles once
    idempotencyKey: `sret-${crypto.randomUUID()}`,
  };
  showForm.value = true;
  if (!deliveries.value.length) await loadDeliveries();
};

const submit = async () => {
  error.value = '';
  saving.value = true;
  try {
    const payload = {
      delivery_id: Number(form.value.deliveryId),
      customer_id: delivery.value?.customer_id,
      warehouse_id: delivery.value?.warehouse_id,
      invoice_id: delivery.value?.invoice_id || null,
      return_number: form.value.returnNumber.trim(),
      return_date: form.value.returnDate,
      tax_amount: form.value.taxAmount || 0,
      reason: form.value.reason || null,
      idempotency_key: form.value.idempotencyKey,
      lines: lines.value
        .filter(l => Number(row.value[l.delivery_item_id]?.qty || 0) > 0)
        .map(l => ({
          delivery_item_id: l.delivery_item_id,
          quantity: row.value[l.delivery_item_id].qty,
          restocked: row.value[l.delivery_item_id].restocked,
          unit_price: row.value[l.delivery_item_id].unitPrice || 0,
        })),
    };
    await api.post('/sales/sales-returns', payload);
    showForm.value = false;
    await loadReturns();
  } catch (e: any) {
    error.value = e?.response?.data?.error || 'The return could not be posted.';
  } finally {
    saving.value = false;
  }
};

onMounted(loadReturns);
</script>
