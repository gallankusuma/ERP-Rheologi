<template>
  <div class="min-h-screen bg-gray-50">
    <main class="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-gray-900">Document Reversal</h2>
        <p class="text-sm text-gray-500 mt-1">Undo a posting that should never have existed</p>
      </div>

      <!-- the distinction that decides which tool is the right one -->
      <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm">
        <p class="font-medium text-amber-900 mb-1">A reversal is not a return.</p>
        <p class="text-amber-800">
          Use a <span class="font-medium">return</span> when goods really moved back — the sale or the purchase
          happened, and now some of it is coming back. Use a <span class="font-medium">reversal</span> only when the
          document itself was wrong: the wrong amount, the wrong lot, the wrong document, or posted twice.
        </p>
        <p class="text-amber-800 mt-1">
          Nothing is deleted. The original entry keeps its journal and a mirror entry is posted against it, so the
          history stays readable.
        </p>
      </div>

      <div class="flex gap-2 mb-4">
        <button v-for="t in types" :key="t.key" @click="selectType(t.key)"
          :class="type === t.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'"
          class="px-3 py-1.5 rounded-md text-sm border">{{ t.label }}</button>
      </div>

      <div v-if="loading" class="text-center py-10">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>

      <div v-else class="bg-white shadow rounded-lg overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Document</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">State</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-if="!rows.length">
              <td colspan="5" class="px-4 py-10 text-center text-sm text-gray-500">
                Nothing here can be reversed.
              </td>
            </tr>
            <tr v-for="r in rows" :key="r.id" class="hover:bg-gray-50">
              <td class="px-4 py-3 text-sm font-medium text-gray-900">{{ r.label }}</td>
              <td class="px-4 py-3 text-sm text-gray-600">{{ r.reference }}</td>
              <td class="px-4 py-3 text-sm text-right">{{ r.amount === null ? '—' : fmt(r.amount) }}</td>
              <td class="px-4 py-3 text-sm">
                <span v-if="r.blockedReason"
                  class="inline-flex px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                  {{ r.blockedReason }}
                </span>
                <span v-else class="inline-flex px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">
                  reversible
                </span>
              </td>
              <td class="px-4 py-3 text-right">
                <button @click="openConfirm(r)" :disabled="!!r.blockedReason"
                  class="px-3 py-1.5 rounded-md text-sm border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  Reverse
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- confirm -->
      <div v-if="target" class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-lg">
          <div class="px-6 py-4 border-b">
            <h3 class="text-lg font-semibold">Reverse {{ target.label }}</h3>
          </div>
          <div class="px-6 py-4 space-y-4">
            <p class="text-sm text-gray-600">{{ effectText }}</p>

            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">
                Reason <span class="text-gray-400">(required, at least 5 characters)</span>
              </label>
              <textarea v-model="reason" rows="3"
                class="w-full border-gray-300 rounded-md text-sm shadow-sm"
                placeholder="What was wrong with this posting"></textarea>
            </div>

            <div v-if="error" class="text-sm bg-red-50 border border-red-200 text-red-800 rounded-md px-3 py-2">
              {{ error }}
            </div>
            <div v-if="done" class="text-sm bg-green-50 border border-green-200 text-green-800 rounded-md px-3 py-2">
              {{ done }}
            </div>
          </div>
          <div class="px-6 py-4 border-t flex justify-end gap-2">
            <button @click="closeConfirm"
              class="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">Close</button>
            <button v-if="!done" @click="confirm" :disabled="reason.trim().length < 5 || saving"
              class="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:opacity-50">
              {{ saving ? 'Reversing…' : 'Reverse' }}
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

type DocType = 'vendor-invoice' | 'customer-invoice' | 'shipment';

interface Row {
  id: number;
  label: string;
  reference: string;
  amount: number | null;
  blockedReason: string;
}

const types: Array<{ key: DocType; label: string }> = [
  { key: 'vendor-invoice', label: 'Vendor Invoices' },
  { key: 'customer-invoice', label: 'Customer Invoices' },
  { key: 'shipment', label: 'Shipments' },
];

const type = ref<DocType>('vendor-invoice');
const rows = ref<Row[]>([]);
const loading = ref(false);
const saving = ref(false);
const target = ref<Row | null>(null);
const reason = ref('');
const error = ref('');
const done = ref('');
const idempotencyKey = ref('');

const fmt = (v: any) => Number(v || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 });

const effectText = computed(() => {
  if (type.value === 'vendor-invoice') {
    return 'The billed quantity goes back to the receipt line, the payable is cleared, and the invoice number becomes free so the corrected invoice can be posted under it.';
  }
  if (type.value === 'customer-invoice') {
    return 'The receivable is cleared and the invoice can be raised again once it is right.';
  }
  return 'The stock goes back into the lot it came from at the cost it left at, the cost of sales it created is mirrored away, and the delivery becomes free to post again.';
});

// A document is only reversible while nothing downstream has relied on it. Working this out
// here means the button is already disabled with the reason showing, rather than the server
// refusing after the click.
const loadRows = async () => {
  loading.value = true;
  rows.value = [];
  try {
    if (type.value === 'vendor-invoice') {
      const { data } = await api.get('/finance/accounts-payable');
      rows.value = (data.data || []).map((ap: any): Row => ({
        id: ap.id,
        label: ap.invoice_number || `Payable #${ap.id}`,
        reference: ap.vendor_name || ap.po_number || '—',
        amount: Number(ap.amount || 0),
        blockedReason:
          Number(ap.superseded_seq || 0) !== 0 || ap.status === 'reversed' ? 'already reversed'
          : !ap.journal_entry_id ? 'never posted to the ledger'
          : Number(ap.paid_amount || 0) > 0 ? 'paid against'
          : Number(ap.debit_note_amount || 0) > 0 ? 'has a debit note'
          : '',
      }));
    } else if (type.value === 'customer-invoice') {
      const { data } = await api.get('/finance/accounts-receivable');
      rows.value = (data.data || []).map((ar: any): Row => ({
        id: ar.invoice_id,
        label: ar.invoice_number || `Invoice #${ar.invoice_id}`,
        reference: ar.customer_name || '—',
        amount: Number(ar.amount || 0),
        blockedReason:
          Number(ar.superseded_seq || 0) !== 0 || ar.status === 'reversed' ? 'already reversed'
          : !ar.journal_entry_id ? 'never posted to the ledger'
          : Number(ar.paid_amount || 0) > 0 ? 'money received against'
          : Number(ar.credit_note_amount || 0) > 0 ? 'has a credit note'
          : '',
      }));
    } else {
      const { data } = await api.get('/sales/deliveries');
      rows.value = (data.data || []).map((d: any): Row => ({
        id: d.id,
        label: d.do_number || `Delivery #${d.id}`,
        reference: d.so_number || d.customer_name || '—',
        amount: null,
        blockedReason: d.reversed_at ? 'already reversed' : !d.posted_at ? 'not posted' : '',
      }));
    }
  } catch (e: any) {
    error.value = e?.response?.data?.error || 'Could not load the documents.';
  } finally {
    loading.value = false;
  }
};

const selectType = (t: DocType) => {
  type.value = t;
  error.value = '';
  loadRows();
};

const openConfirm = (r: Row) => {
  target.value = r;
  reason.value = '';
  error.value = '';
  done.value = '';
  // fixed when the dialog opens, so a retry after a timeout settles once
  idempotencyKey.value = `rev-${crypto.randomUUID()}`;
};

const closeConfirm = () => {
  target.value = null;
  if (done.value) loadRows();
  done.value = '';
};

const confirm = async () => {
  if (!target.value) return;
  error.value = '';
  saving.value = true;
  try {
    const { data } = await api.post(`/finance/reversals/${type.value}/${target.value.id}`, {
      reason: reason.value.trim(),
      idempotency_key: idempotencyKey.value,
    });
    const j = data?.data?.reversal_journal_id;
    done.value = j ? `Reversed. Mirror journal #${j} posted against the original.` : 'Reversed.';
  } catch (e: any) {
    error.value = e?.response?.data?.error || 'The reversal was refused.';
  } finally {
    saving.value = false;
  }
};

onMounted(loadRows);
</script>
