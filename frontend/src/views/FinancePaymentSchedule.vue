<template>
  <div class="min-h-screen bg-gray-50">
    <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Payment Schedule</h2>
          <p class="text-sm text-gray-500 mt-1">Everything falling due, and what it is waiting on</p>
        </div>
        <button @click="openGenerate" :disabled="selected.length === 0"
          class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-40">
          Generate Fund Request ({{ selected.length }})
        </button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div class="bg-white shadow rounded-lg p-4">
          <p class="text-xs text-gray-500 uppercase">Falling Due</p>
          <p class="text-2xl font-bold">{{ fmt(summary.total_outstanding) }}</p>
          <p class="text-[11px] text-gray-400 mt-1">{{ summary.count }} row(s)</p>
        </div>
        <div class="bg-white shadow rounded-lg p-4">
          <p class="text-xs text-green-600 uppercase">Recognised</p>
          <p class="text-2xl font-bold text-green-700">{{ fmt(summary.recognised) }}</p>
          <p class="text-[11px] text-gray-400 mt-1">a real liability in the ledger</p>
        </div>
        <!-- the number that matters most here: planned, but nothing says we owe it yet -->
        <div class="bg-white shadow rounded-lg p-4" :class="Number(summary.not_recognised) > 0 ? 'ring-1 ring-amber-300' : ''">
          <p class="text-xs text-amber-600 uppercase">Not Yet Recognised</p>
          <p class="text-2xl font-bold text-amber-700">{{ fmt(summary.not_recognised) }}</p>
          <p class="text-[11px] text-gray-400 mt-1">a plan; no vendor invoice posted</p>
        </div>
        <div class="bg-white shadow rounded-lg p-4">
          <p class="text-xs text-red-600 uppercase">Overdue</p>
          <p class="text-2xl font-bold text-red-700">{{ fmt(summary.overdue) }}</p>
        </div>
      </div>

      <div v-if="Number(summary.not_recognised) > 0"
        class="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm">
        <p class="font-medium text-amber-900 mb-1">
          {{ fmt(summary.not_recognised) }} of this is planned, not owed.
        </p>
        <p class="text-amber-800">
          A payment schedule says what we intend to pay. A liability arises when the goods arrive
          and the vendor invoices for them. Rows marked <span class="font-medium">not recognised</span>
          have no vendor invoice posted, so they cannot be paid yet — a fund request built from them
          would be refused at approval.
        </p>
      </div>

      <div class="bg-white shadow rounded-lg p-4 mb-4">
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Year</label>
            <input v-model.number="filters.year" type="number" @change="load"
              class="w-full border-gray-300 rounded-md text-sm shadow-sm" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Range</label>
            <select v-model="filters.period" @change="load" class="w-full border-gray-300 rounded-md text-sm shadow-sm">
              <option value="monthly">Whole year</option>
              <option value="weekly">One month</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Month</label>
            <select v-model.number="filters.month" @change="load" :disabled="filters.period === 'monthly'"
              class="w-full border-gray-300 rounded-md text-sm shadow-sm disabled:bg-gray-100">
              <option v-for="m in 12" :key="m" :value="m">{{ monthName(m) }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Source</label>
            <select v-model="filters.source" @change="load" class="w-full border-gray-300 rounded-md text-sm shadow-sm">
              <option value="">All</option>
              <option value="po">PO termin</option>
              <option value="invoice">Vendor invoice</option>
              <option value="expense">Project expense</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select v-model="filters.status" @change="load" class="w-full border-gray-300 rounded-md text-sm shadow-sm">
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="overdue">Overdue</option>
              <option value="paid">Paid</option>
            </select>
          </div>
        </div>
      </div>

      <div v-if="loading" class="text-center py-10">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>

      <div v-else class="bg-white shadow rounded-lg overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 w-10">
                <input type="checkbox" :checked="allSelectable && selected.length === selectableRows.length"
                  @change="toggleAll" class="h-4 w-4 rounded border-gray-300" />
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Outstanding</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">In the ledger</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-if="!rows.length">
              <td colspan="7" class="px-4 py-10 text-center text-sm text-gray-500">Nothing falling due in this range.</td>
            </tr>
            <tr v-for="r in rows" :key="`${r.source}-${r.id}`" class="hover:bg-gray-50"
              :class="isOverdue(r) ? 'bg-red-50' : ''">
              <td class="px-4 py-3">
                <input type="checkbox" :value="key(r)" v-model="selectedKeys" :disabled="!canRequest(r)"
                  class="h-4 w-4 rounded border-gray-300 disabled:opacity-40" />
              </td>
              <td class="px-4 py-3 text-sm" :class="isOverdue(r) ? 'text-red-700 font-medium' : 'text-gray-600'">
                {{ fmtDate(r.due_date) }}
              </td>
              <td class="px-4 py-3 text-sm">
                <div class="font-medium text-gray-900">{{ r.label }}</div>
                <div class="text-xs text-gray-500">{{ r.ref_number || '—' }}</div>
              </td>
              <td class="px-4 py-3 text-sm text-gray-600">{{ r.vendor_name || '—' }}</td>
              <td class="px-4 py-3">
                <span class="inline-flex px-2 py-0.5 rounded-full text-xs" :class="sourceBadge(r.source)">
                  {{ sourceLabel(r.source) }}
                </span>
              </td>
              <td class="px-4 py-3 text-sm text-right font-medium">{{ fmt(r.outstanding) }}</td>
              <td class="px-4 py-3">
                <span v-if="r.ledger_recognised === true"
                  class="inline-flex px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">recognised</span>
                <span v-else-if="r.ledger_recognised === false"
                  class="inline-flex px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800">not recognised</span>
                <span v-else class="text-xs text-gray-400">n/a</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- generate -->
      <div v-if="showGenerate" class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div class="px-6 py-4 border-b">
            <h3 class="text-lg font-semibold">Generate Fund Request</h3>
          </div>
          <div class="px-6 py-4 space-y-4">
            <p class="text-sm text-gray-600">
              {{ selected.length }} row(s), {{ fmt(selectedTotal) }}. This raises a request for approval —
              it does not move money. The payment posts when the request is approved.
            </p>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Needed by</label>
              <input v-model="form.neededDate" type="date" class="w-full border-gray-300 rounded-md text-sm shadow-sm" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Purpose</label>
              <textarea v-model="form.purpose" rows="2" class="w-full border-gray-300 rounded-md text-sm shadow-sm"
                placeholder="Dibuat dari jadwal pembayaran"></textarea>
            </div>
            <div v-if="error" class="text-sm bg-red-50 border border-red-200 text-red-800 rounded-md px-3 py-2">
              {{ error }}
            </div>
            <div v-if="result" class="text-sm bg-green-50 border border-green-200 text-green-800 rounded-md px-3 py-2">
              {{ result.request_number }} created — {{ result.item_count }} item(s), {{ fmt(result.total_amount) }}.
            </div>
            <div v-if="skipped.length" class="text-sm bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              <p class="font-medium text-amber-900 mb-1">Left out:</p>
              <ul class="list-disc pl-5 text-amber-800 space-y-0.5">
                <li v-for="(s, i) in skipped" :key="i">{{ s }}</li>
              </ul>
            </div>
          </div>
          <div class="px-6 py-4 border-t flex justify-end gap-2">
            <button @click="closeGenerate" class="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">
              Close
            </button>
            <button v-if="!result" @click="generate" :disabled="saving"
              class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
              {{ saving ? 'Creating…' : 'Create' }}
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

interface DueRow {
  id: number;
  source: 'po' | 'expense' | 'invoice';
  label: string;
  ref_number: string | null;
  vendor_name: string | null;
  amount: string;
  outstanding: string;
  due_date: string | null;
  status: string;
  ledger_recognised: boolean | null;
}

const rows = ref<DueRow[]>([]);
const summary = ref<any>({ count: 0, total_outstanding: '0', recognised: '0', not_recognised: '0', overdue: '0' });
const selectedKeys = ref<string[]>([]);
const loading = ref(false);
const saving = ref(false);
const showGenerate = ref(false);
const error = ref('');
const result = ref<any>(null);
const skipped = ref<string[]>([]);

const now = new Date();
const filters = ref({
  year: now.getFullYear(),
  month: now.getMonth() + 1,
  period: 'monthly',
  source: '',
  status: '',
});
const form = ref({ neededDate: now.toISOString().slice(0, 10), purpose: '' });

const fmt = (v: any) => Number(v || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 });
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('id-ID') : '—');
const monthName = (m: number) => new Date(2000, m - 1, 1).toLocaleString('id-ID', { month: 'long' });
const key = (r: DueRow) => `${r.source}-${r.id}`;

const sourceLabel = (s: string) =>
  ({ po: 'PO termin', invoice: 'Invoice', expense: 'Expense' } as Record<string, string>)[s] || s;
const sourceBadge = (s: string) =>
  ({
    po: 'bg-blue-100 text-blue-800',
    invoice: 'bg-purple-100 text-purple-800',
    expense: 'bg-gray-100 text-gray-800',
  } as Record<string, string>)[s] || 'bg-gray-100 text-gray-800';

const isOverdue = (r: DueRow) =>
  !!r.due_date && r.due_date.slice(0, 10) < new Date().toISOString().slice(0, 10) && r.status !== 'paid';

// A row the ledger has never recognised cannot be paid, so offering it for a fund request
// would only produce one that is refused at approval.
const canRequest = (r: DueRow) => r.ledger_recognised !== false && Number(r.outstanding) > 0;

const selectableRows = computed(() => rows.value.filter(canRequest));
const allSelectable = computed(() => selectableRows.value.length > 0);
const selected = computed(() => rows.value.filter(r => selectedKeys.value.includes(key(r))));
const selectedTotal = computed(() => selected.value.reduce((s, r) => s + Number(r.outstanding || 0), 0));

const toggleAll = () => {
  selectedKeys.value =
    selectedKeys.value.length === selectableRows.value.length ? [] : selectableRows.value.map(key);
};

const load = async () => {
  loading.value = true;
  selectedKeys.value = [];
  try {
    const { data } = await api.get('/finance/payment-schedule', {
      params: {
        year: filters.value.year,
        month: filters.value.month,
        period: filters.value.period,
        source: filters.value.source || undefined,
        status: filters.value.status || undefined,
      },
    });
    rows.value = data.data || [];
    summary.value = data.summary || summary.value;
  } catch (e: any) {
    error.value = e?.response?.data?.error || 'Could not load the schedule.';
  } finally {
    loading.value = false;
  }
};

const openGenerate = () => {
  error.value = '';
  result.value = null;
  skipped.value = [];
  form.value = { neededDate: new Date().toISOString().slice(0, 10), purpose: '' };
  showGenerate.value = true;
};

const closeGenerate = () => {
  showGenerate.value = false;
  if (result.value) load();
};

const generate = async () => {
  error.value = '';
  saving.value = true;
  try {
    const { data } = await api.post('/finance/payment-schedule/generate-fund-request', {
      ids: selected.value.map(r => ({ id: r.id, source: r.source })),
      needed_date: form.value.neededDate,
      purpose: form.value.purpose || undefined,
    });
    result.value = data.data;
    skipped.value = data.data?.skipped || [];
  } catch (e: any) {
    error.value = e?.response?.data?.error || 'Could not create the fund request.';
    skipped.value = e?.response?.data?.skipped || [];
  } finally {
    saving.value = false;
  }
};

onMounted(load);
</script>
