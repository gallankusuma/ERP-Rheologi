<template>
  <div class="space-y-6">
    <PageHeader title="Stock Card" icon="📊" subtitle="View all stock movements with running balance">
      <template #actions>
        <div class="flex gap-2">
          <button @click="load" :disabled="!filters.productId" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
            Refresh
          </button>
          <button @click="exportCsv" :disabled="dataState !== 'success' || rows.length === 0" class="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
            Export CSV
          </button>
        </div>
      </template>
    </PageHeader>

    <!-- Filters -->
    <div class="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product</label>
        <select v-model.number="filters.productId" @change="load" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-300">
          <option :value="0" disabled>-- Pilih Product --</option>
          <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }} ({{ p.sku }})</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Warehouse</label>
        <select v-model.number="filters.warehouseId" @change="load" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-300">
          <option :value="0">All warehouses</option>
          <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From</label>
        <input type="date" v-model="filters.from" @change="load" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-300" />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To</label>
        <input type="date" v-model="filters.to" @change="load" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-300" />
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>

    <!-- Table -->
    <div v-else class="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Date</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Product</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Type</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Reference</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Warehouse</th>
              <th class="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">IN</th>
              <th class="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">OUT</th>
              <th class="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">Balance</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Notes</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-if="rows.length === 0">
              <td colspan="9" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No stock movements found</td>
            </tr>
            <tr v-else v-for="(r, idx) in rows" :key="idx" class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td class="px-4 py-2 text-gray-900 dark:text-gray-100 whitespace-nowrap">{{ formatDate(r.moved_at) }}</td>
              <td class="px-4 py-2 text-gray-700 dark:text-gray-300">{{ r.product_name }}</td>
              <td class="px-4 py-2">
                <span :class="movementClass(r.movement_type)" class="px-2 py-0.5 rounded-full text-xs font-medium">
                  {{ formatType(r.movement_type) }}
                </span>
              </td>
              <td class="px-4 py-2 text-gray-700 dark:text-gray-300">{{ r.reference_type || '' }} {{ r.reference_id ? '#' + r.reference_id : '' }}</td>
              <td class="px-4 py-2 text-gray-700 dark:text-gray-300">{{ r.warehouse_name || '-' }}</td>
              <td class="px-4 py-2 text-right text-green-600 dark:text-green-400 font-medium">{{ isInbound(r) ? formatQty(Math.abs(Number(r.quantity))) : '' }}</td>
              <td class="px-4 py-2 text-right text-red-600 dark:text-red-400 font-medium">{{ !isInbound(r) ? formatQty(Math.abs(Number(r.quantity))) : '' }}</td>
              <td class="px-4 py-2 text-right font-semibold text-gray-900 dark:text-gray-100">{{ formatQty(r.balance_after) }}</td>
              <td class="px-4 py-2 text-gray-500 dark:text-gray-400 max-w-[200px] truncate">{{ r.notes || r.batch_number || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="rows.length > 0" class="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 text-sm text-gray-600 dark:text-gray-400">
        Total: {{ rows.length }} movements
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import { api } from '../lib/api';
import PageHeader from '../components/ui/PageHeader.vue';

interface Product { id: number; name: string; sku: string }
interface Warehouse { id: number; name: string }

const products = ref<Product[]>([]);
const warehouses = ref<Warehouse[]>([]);
const movements = ref<any[]>([]);
const rows = ref<any[]>([]);
const loading = ref(false);
const dataState = ref<'idle' | 'loading' | 'success' | 'empty' | 'error'>('idle');
const errorMessage = ref('');

const today = new Date();
const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const filters = reactive({
  productId: 0,
  warehouseId: 0,
  from: toDateInput(monthAgo),
  to: toDateInput(today),
});

onMounted(async () => {
  await Promise.all([fetchProducts(), fetchWarehouses()]);
  // don't auto-load; require product selection first
});

const fetchProducts = async () => {
  try {
    const res = await api.get('/products');
    products.value = res.data.data || [];
  } catch (e) { console.error(e); }
};

const fetchWarehouses = async () => {
  try {
    const res = await api.get('/warehouses');
    warehouses.value = res.data.data || [];
  } catch (e) { console.error(e); }
};

const openingQty = ref(0);
const closingQty = ref(0);

const load = async () => {
  if (!filters.productId) {
    dataState.value = 'idle';
    return;
  }
  loading.value = true;
  dataState.value = 'loading';
  errorMessage.value = '';
  try {
    const params: any = { product_id: filters.productId };
    if (filters.warehouseId) params.warehouse_id = filters.warehouseId;
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    const res = await api.get('/inventory/stock-card', { params });
    movements.value = res.data.data || [];
    openingQty.value = Number(res.data.opening_quantity || 0);
    closingQty.value = Number(res.data.closing_quantity || 0);
    dataState.value = movements.value.length > 0 ? 'success' : 'empty';
  } catch (e: any) {
    console.error('Error loading stock card:', e);
    const status = e?.response?.status;
    const code = e?.response?.data?.code || '';
    const msg = e?.response?.data?.error || e.message || 'Unknown error';
    errorMessage.value = `[${status || 'NETWORK'}] ${code ? code + ': ' : ''}${msg}`;
    dataState.value = 'error';
    // keep stale data visible with stale indicator, don't silently clear
  } finally {
    loading.value = false;
  }
};

const isInbound = (m: any) => {
  // server provides delta_quantity; positive = inbound
  if (m.delta_quantity !== undefined) return Number(m.delta_quantity) > 0;
  const qty = Number(m.quantity) || 0;
  return m.movement_type === 'in' || m.movement_type === 'grn' || m.movement_type === 'fg_receipt' || (m.movement_type === 'adjustment' && qty > 0);
};

// use server-computed balance_after directly
watch(movements, (mvs) => {
  rows.value = mvs.map((m: any) => {
    return { ...m, balance_after: Number(m.balance_after || 0) };
  });
}, { immediate: true });

const formatDate = (d: string) => {
  if (!d) return '-';
  const dt = new Date(d);
  return dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
};

const formatQty = (v: number) => v ? v.toLocaleString('id-ID', { maximumFractionDigits: 4 }) : '';

const formatType = (t: string) => {
  const map: Record<string, string> = {
    'in': 'IN',
    'out': 'OUT',
    'grn': 'GRN',
    'fg_receipt': 'FG Receipt',
    'issue': 'Issue Material',
    'transfer': 'Transfer',
    'adjustment': 'Adjustment',
  };
  return map[t] || t;
};

const movementClass = (t: string) => {
  if (t === 'in' || t === 'grn' || t === 'fg_receipt') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  if (t === 'out' || t === 'issue') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  if (t === 'transfer') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
};

const exportCsv = () => {
  const headers = ['Date', 'Product', 'SKU', 'Type', 'Reference', 'Warehouse', 'IN', 'OUT', 'Balance', 'Notes'];
  const lines = rows.value.map((r: any) => {
    const qty = Number(r.quantity) || 0;
    return [
      formatDate(r.moved_at),
      (r.product_name || '').replace(/,/g, ' '),
      r.sku || '',
      formatType(r.movement_type),
      `${r.reference_type || ''} #${r.reference_id || ''}`,
      r.warehouse_name || '',
      isInbound(r) ? Math.abs(qty) : '',
      !isInbound(r) ? Math.abs(qty) : '',
      r.balance_after,
      (r.notes || '').replace(/,/g, ' ').replace(/\n/g, ' '),
    ].join(',');
  });
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `stock_card_${filters.from}_${filters.to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
</script>
