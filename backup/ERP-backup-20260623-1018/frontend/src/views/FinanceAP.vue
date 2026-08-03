<template>
  <div class="min-h-screen bg-gray-50">
    <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Accounts Payable</h2>
          <p class="text-sm text-gray-500 mt-1">Outstanding payables from purchase orders and payment tracking</p>
        </div>
        <button @click="showAdd = true" class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">+ Create AP</button>
      </div>

      <!-- Summary -->
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div class="bg-white shadow rounded-lg p-4">
          <p class="text-xs text-gray-500 uppercase">Total Payable</p>
          <p class="text-2xl font-bold">{{ fmt(totals.total) }}</p>
        </div>
        <div class="bg-white shadow rounded-lg p-4">
          <p class="text-xs text-green-600 uppercase">Paid</p>
          <p class="text-2xl font-bold text-green-700">{{ fmt(totals.paid) }}</p>
        </div>
        <div class="bg-white shadow rounded-lg p-4">
          <p class="text-xs text-red-600 uppercase">Outstanding</p>
          <p class="text-2xl font-bold text-red-700">{{ fmt(totals.outstanding) }}</p>
        </div>
        <div class="bg-white shadow rounded-lg p-4">
          <p class="text-xs text-yellow-600 uppercase">Overdue</p>
          <p class="text-2xl font-bold text-yellow-700">{{ overdue.length }}</p>
        </div>
      </div>

      <!-- Filter -->
      <div class="mb-4 flex gap-2">
        <button v-for="s in ['all','open','partial','paid','overdue']" :key="s"
          @click="filter = s" :class="filter === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'" class="px-3 py-1.5 rounded-md text-sm border">
          {{ s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1) }}
        </button>
      </div>

      <div v-if="store.loading" class="text-center py-10"><div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>

      <div v-else class="bg-white shadow rounded-lg overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO #</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Outstanding</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-for="a in filtered" :key="a.id" class="hover:bg-gray-50" :class="isOverdue(a) ? 'bg-red-50' : ''">
              <td class="px-4 py-3 text-sm font-medium text-gray-900">{{ a.po_number }}</td>
              <td class="px-4 py-3 text-sm text-gray-600">{{ a.vendor_name }}</td>
              <td class="px-4 py-3 text-sm text-gray-600">{{ a.invoice_number || '-' }}</td>
              <td class="px-4 py-3 text-sm" :class="isOverdue(a) ? 'text-red-600 font-medium' : 'text-gray-500'">{{ fmtDate(a.due_date) }}</td>
              <td class="px-4 py-3 text-sm text-right font-mono">{{ fmt(a.amount) }}</td>
              <td class="px-4 py-3 text-sm text-right font-mono text-green-600">{{ fmt(a.paid_amount) }}</td>
              <td class="px-4 py-3 text-sm text-right font-mono text-red-600 font-medium">{{ fmt(a.amount - (a.paid_amount || 0)) }}</td>
              <td class="px-4 py-3 text-center">
                <span :class="statusBadge(a.status)" class="px-2 py-1 rounded-full text-xs font-medium">{{ a.status }}</span>
              </td>
              <td class="px-4 py-3 text-right">
                <button v-if="a.status !== 'paid'" @click="openPay(a)" class="text-green-600 hover:underline text-xs">Pay</button>
              </td>
            </tr>
            <tr v-if="!filtered.length"><td colspan="9" class="text-center py-8 text-gray-400">No payables</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Pay Modal -->
      <div v-if="payTarget" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
          <h3 class="text-lg font-bold mb-4">Record Payment</h3>
          <p class="text-sm text-gray-600 mb-2">{{ payTarget.po_number }} — {{ payTarget.vendor_name }}</p>
          <p class="text-sm text-gray-500 mb-3">Outstanding: <span class="font-medium text-red-600">{{ fmt(payTarget.amount - (payTarget.paid_amount || 0)) }}</span></p>
          <div>
            <label class="block text-sm font-medium text-gray-700">Payment Amount</label>
            <input v-model.number="payAmount" type="number" step="0.01" min="0.01" class="mt-1 w-full px-3 py-2 border rounded-md text-sm" />
          </div>
          <div class="flex justify-end gap-3 pt-4">
            <button @click="payTarget = null" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm">Cancel</button>
            <button @click="confirmPay" class="px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700">Record Payment</button>
          </div>
        </div>
      </div>

      <!-- Add Modal -->
      <div v-if="showAdd" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
          <h3 class="text-lg font-bold mb-4">Create AP Record</h3>
          <form @submit.prevent="createAP" class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700">PO ID</label>
              <input v-model.number="form.po_id" type="number" required class="mt-1 w-full px-3 py-2 border rounded-md text-sm" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div><label class="block text-sm font-medium text-gray-700">Invoice #</label><input v-model="form.invoice_number" class="mt-1 w-full px-3 py-2 border rounded-md text-sm" /></div>
              <div><label class="block text-sm font-medium text-gray-700">Due Date</label><input v-model="form.due_date" type="date" class="mt-1 w-full px-3 py-2 border rounded-md text-sm" /></div>
            </div>
            <div><label class="block text-sm font-medium text-gray-700">Amount</label><input v-model.number="form.amount" type="number" step="0.01" required class="mt-1 w-full px-3 py-2 border rounded-md text-sm" /></div>
            <div class="flex justify-end gap-3 pt-2">
              <button type="button" @click="showAdd = false" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm">Cancel</button>
              <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">Save</button>
            </div>
          </form>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useFinanceStore } from '../stores/finance';

const store = useFinanceStore();
const filter = ref('all');
const showAdd = ref(false);
const payTarget = ref<any>(null);
const payAmount = ref(0);
const form = ref({ po_id: '', invoice_number: '', due_date: '', amount: 0 });

const fmt = (v: number) => v ? Number(v).toLocaleString('id-ID') : '0';
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString() : '-';

const isOverdue = (a: any) => a.status !== 'paid' && a.due_date && new Date(a.due_date) < new Date();
const overdue = computed(() => store.ap.filter(a => isOverdue(a)));

const totals = computed(() => ({
  total: store.ap.reduce((s, a) => s + Number(a.amount || 0), 0),
  paid: store.ap.reduce((s, a) => s + Number(a.paid_amount || 0), 0),
  outstanding: store.ap.reduce((s, a) => s + Number(a.amount || 0) - Number(a.paid_amount || 0), 0),
}));

const statusBadge = (s: string) => ({
  'bg-green-100 text-green-800': s === 'paid',
  'bg-yellow-100 text-yellow-800': s === 'partial',
  'bg-red-100 text-red-800': s === 'open' || s === 'overdue',
});

const filtered = computed(() => {
  if (filter.value === 'all') return store.ap;
  if (filter.value === 'overdue') return overdue.value;
  return store.ap.filter(a => a.status === filter.value);
});

const openPay = (a: any) => { payTarget.value = a; payAmount.value = a.amount - (a.paid_amount || 0); };
const confirmPay = async () => { await store.payAP(payTarget.value.id, payAmount.value); payTarget.value = null; };

onMounted(() => store.fetchAP());

const createAP = async () => { await store.createAP(form.value); showAdd.value = false; };
</script>
