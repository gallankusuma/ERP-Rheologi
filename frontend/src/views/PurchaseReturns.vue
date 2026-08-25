<template>
  <div class="min-h-screen bg-gray-50">
    <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Purchase Returns</h2>
          <p class="text-sm text-gray-500 mt-1">Goods sent back to a vendor, and the debit note it raises</p>
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
          <p class="text-xs text-gray-500 uppercase">Inventory Returned</p>
          <p class="text-2xl font-bold">{{ fmt(totals.cost) }}</p>
        </div>
        <div class="bg-white shadow rounded-lg p-4">
          <p class="text-xs text-blue-600 uppercase">Accrual Reversed</p>
          <p class="text-2xl font-bold text-blue-700">{{ fmt(totals.grni) }}</p>
          <p class="text-[11px] text-gray-400 mt-1">returned before invoicing</p>
        </div>
        <div class="bg-white shadow rounded-lg p-4">
          <p class="text-xs text-amber-600 uppercase">Debit Notes</p>
          <p class="text-2xl font-bold text-amber-700">{{ fmt(totals.debitNote) }}</p>
          <p class="text-[11px] text-gray-400 mt-1">returned after invoicing</p>
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
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Receipt</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Inventory</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Accrual</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Debit Note</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-if="!returns.length">
              <td colspan="7" class="px-4 py-10 text-center text-sm text-gray-500">No purchase returns yet.</td>
            </tr>
            <tr v-for="r in returns" :key="r.id" class="hover:bg-gray-50">
              <td class="px-4 py-3 text-sm font-medium text-gray-900">{{ r.return_number }}</td>
              <td class="px-4 py-3 text-sm text-gray-600">{{ fmtDate(r.return_date) }}</td>
              <td class="px-4 py-3 text-sm text-gray-600">{{ r.vendor_name || '-' }}</td>
              <td class="px-4 py-3 text-sm text-gray-600">{{ r.grn_number || r.grn_id }}</td>
              <td class="px-4 py-3 text-sm text-right">{{ fmt(r.total_cost) }}</td>
              <td class="px-4 py-3 text-sm text-right text-blue-700">{{ fmt(r.grni_amount) }}</td>
              <td class="px-4 py-3 text-sm text-right text-amber-700">{{ fmt(r.debit_note_amount) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- create -->
      <div v-if="showForm" class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <div class="px-6 py-4 border-b flex justify-between items-center">
            <h3 class="text-lg font-semibold">New Purchase Return</h3>
            <button @click="showForm = false" class="text-gray-400 hover:text-gray-600">&times;</button>
          </div>

          <div class="px-6 py-4 space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Goods Receipt</label>
                <select v-model="form.grnId" @change="loadLines"
                  class="w-full border-gray-300 rounded-md text-sm shadow-sm">
                  <option value="">Select a receipt…</option>
                  <option v-for="g in receipts" :key="g.id" :value="g.id">
                    {{ g.grn_number }} — {{ g.po_number || '' }}
                  </option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Return Number</label>
                <input v-model="form.returnNumber" type="text"
                  class="w-full border-gray-300 rounded-md text-sm shadow-sm" placeholder="PRET-0001" />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Return Date</label>
                <input v-model="form.returnDate" type="date"
                  class="w-full border-gray-300 rounded-md text-sm shadow-sm" />
              </div>
            </div>

            <div v-if="receipt" class="text-sm text-gray-600 bg-gray-50 rounded-md px-3 py-2">
              Vendor <span class="font-medium text-gray-900">{{ receipt.vendor_name }}</span>
              · Warehouse <span class="font-medium text-gray-900">{{ receipt.warehouse_name }}</span>
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
                    <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Received</th>
                    <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Invoiced</th>
                    <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Returnable</th>
                    <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Return Qty</th>
                  </tr>
                </thead>
                <tbody class="divide-y">
                  <tr v-for="l in lines" :key="l.grn_line_id">
                    <td class="px-3 py-2">
                      <div class="font-medium text-gray-900">{{ l.product_name }}</div>
                      <div class="text-xs text-gray-500">{{ l.sku }}</div>
                    </td>
                    <td class="px-3 py-2 text-xs text-gray-600">{{ l.lot_number || '—' }}</td>
                    <td class="px-3 py-2 text-right">{{ num(l.quantity_received) }}</td>
                    <td class="px-3 py-2 text-right">{{ num(l.quantity_invoiced) }}</td>
                    <td class="px-3 py-2 text-right font-medium">{{ num(l.returnable) }}</td>
                    <td class="px-3 py-2 text-right">
                      <input v-model.number="qty[l.grn_line_id]" type="number" min="0" step="0.0001"
                        :max="Number(l.returnable)" :disabled="!l.lot_id || Number(l.returnable) <= 0"
                        class="w-28 border-gray-300 rounded-md text-sm text-right shadow-sm disabled:bg-gray-100" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- what this return will do to the books, before it is posted -->
            <div v-if="split.total > 0" class="text-sm bg-blue-50 border border-blue-200 rounded-md px-3 py-2 space-y-1">
              <div class="text-blue-900 font-medium">This return will post as:</div>
              <div v-if="split.uninvoiced > 0" class="text-blue-800">
                {{ num(split.uninvoiced) }} not yet invoiced → reverses the goods-received accrual
              </div>
              <div v-if="split.invoiced > 0" class="text-amber-800">
                {{ num(split.invoiced) }} already invoiced → raises a debit note against the vendor
              </div>
            </div>

            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Reason</label>
              <textarea v-model="form.reason" rows="2"
                class="w-full border-gray-300 rounded-md text-sm shadow-sm"
                placeholder="Why the goods are going back"></textarea>
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
const receipts = ref<any[]>([]);
const lines = ref<any[]>([]);
const receipt = ref<any>(null);
const qty = ref<Record<number, number>>({});

const loading = ref(false);
const linesLoading = ref(false);
const saving = ref(false);
const showForm = ref(false);
const error = ref('');

const form = ref({
  grnId: '' as string | number,
  returnNumber: '',
  returnDate: new Date().toISOString().slice(0, 10),
  reason: '',
  idempotencyKey: '',
});

const fmt = (v: any) => Number(v || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 });
const num = (v: any) => Number(v || 0).toLocaleString('id-ID', { maximumFractionDigits: 4 });
const fmtDate = (d: string) => (d ? new Date(d).toLocaleDateString('id-ID') : '-');

const totals = computed(() => ({
  cost: returns.value.reduce((s, r) => s + Number(r.total_cost || 0), 0),
  grni: returns.value.reduce((s, r) => s + Number(r.grni_amount || 0), 0),
  debitNote: returns.value.reduce((s, r) => s + Number(r.debit_note_amount || 0), 0),
}));

// Mirrors what the server will decide: un-invoiced quantity is consumed first and reverses the
// accrual; only what is left reaches quantity that has already been billed and needs a debit
// note. Showing it here means the consequence is visible before the return is posted.
const split = computed(() => {
  let uninvoiced = 0;
  let invoiced = 0;
  for (const l of lines.value) {
    const q = Number(qty.value[l.grn_line_id] || 0);
    if (q <= 0) continue;
    const returnedUnbilled = Number(l.quantity_returned || 0) - Number(l.quantity_returned_billed || 0);
    const pool = Math.max(Number(l.quantity_received) - Number(l.quantity_invoiced) - returnedUnbilled, 0);
    const fromUninvoiced = Math.min(q, pool);
    uninvoiced += fromUninvoiced;
    invoiced += q - fromUninvoiced;
  }
  return { uninvoiced, invoiced, total: uninvoiced + invoiced };
});

const canSubmit = computed(
  () => !!form.value.grnId && !!form.value.returnNumber.trim() && split.value.total > 0
);

const loadReturns = async () => {
  loading.value = true;
  try {
    const { data } = await api.get('/procurement/purchase-returns');
    returns.value = data.data || [];
  } finally {
    loading.value = false;
  }
};

const loadReceipts = async () => {
  const { data } = await api.get('/procurement/goods-receipts');
  receipts.value = (data.data || []).filter((g: any) => String(g.status).toUpperCase() !== 'DRAFT');
};

const loadLines = async () => {
  lines.value = [];
  receipt.value = null;
  qty.value = {};
  error.value = '';
  if (!form.value.grnId) return;
  linesLoading.value = true;
  try {
    const { data } = await api.get(`/procurement/goods-receipts/${form.value.grnId}/returnable`);
    receipt.value = data.data.receipt;
    lines.value = data.data.lines || [];
  } catch (e: any) {
    error.value = e?.response?.data?.error || 'Could not load the receipt lines.';
  } finally {
    linesLoading.value = false;
  }
};

const openForm = async () => {
  error.value = '';
  lines.value = [];
  receipt.value = null;
  qty.value = {};
  form.value = {
    grnId: '',
    returnNumber: '',
    returnDate: new Date().toISOString().slice(0, 10),
    reason: '',
    // fixed when the form opens, so re-submitting after a timeout settles once rather than
    // creating a second return
    idempotencyKey: `pret-${crypto.randomUUID()}`,
  };
  showForm.value = true;
  if (!receipts.value.length) await loadReceipts();
};

const submit = async () => {
  error.value = '';
  saving.value = true;
  try {
    const payload = {
      grn_id: Number(form.value.grnId),
      vendor_id: receipt.value?.vendor_id,
      warehouse_id: receipt.value?.warehouse_id,
      return_number: form.value.returnNumber.trim(),
      return_date: form.value.returnDate,
      reason: form.value.reason || null,
      idempotency_key: form.value.idempotencyKey,
      lines: lines.value
        .filter(l => Number(qty.value[l.grn_line_id] || 0) > 0)
        .map(l => ({ grn_line_id: l.grn_line_id, lot_id: l.lot_id, quantity: qty.value[l.grn_line_id] })),
    };
    await api.post('/procurement/purchase-returns', payload);
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
