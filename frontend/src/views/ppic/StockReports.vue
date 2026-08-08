<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { api } from '../../lib/api';

const activeTab = ref('onhand');
const loading = ref(false);
const stockData = ref<any[]>([]);

const tabs = [
  { id: 'monthly', name: 'Monthly Report' },
  { id: 'onhand', name: 'On Hand (Inventory)' },
  { id: 'used', name: 'Material Issued' },
  { id: 'wip', name: 'Work In Progress' },
];

async function loadData() {
  loading.value = true;
  try {
    const res = await api.get('/ppic/stock-reports', { params: { tab: activeTab.value }});
    stockData.value = res.data.data || [];
  } catch (err) {
    console.error('Error loading stock reports:', err);
    stockData.value = [];
  } finally {
    loading.value = false;
  }
}

function formatN(val: number) {
  return (val || 0).toLocaleString('id-ID');
}

watch(activeTab, () => loadData());
onMounted(() => loadData());
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <div>
        <h2 class="text-2xl font-bold text-slate-800">PPIC Stock Reports</h2>
        <p class="text-slate-500 text-sm mt-1">View inventory status and production process summaries.</p>
      </div>
    </div>

    <div class="flex gap-2 border-b border-slate-200">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        @click="activeTab = tab.id"
        class="px-4 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors"
        :class="activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'"
      >
        {{ tab.name }}
      </button>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div class="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
        <h3 class="font-medium text-slate-700">{{ tabs.find(t => t.id === activeTab)?.name }} - As of Today</h3>
        <span class="text-sm text-slate-500">{{ stockData.length }} items</span>
      </div>

      <div v-if="loading" class="p-8 text-center text-slate-400">Loading...</div>
      <div v-else-if="stockData.length === 0" class="p-8 text-center text-slate-400">No data available for this view.</div>

      <table v-else class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
            <th class="p-4 font-semibold">SKU / Code</th>
            <th class="p-4 font-semibold">Item Name</th>
            <th class="p-4 font-semibold text-right">Quantity</th>
            <th class="p-4 font-semibold">UOM</th>
            <th v-if="activeTab === 'wip'" class="p-4 font-semibold text-right">WO Count</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, idx) in stockData" :key="idx" class="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
            <td class="p-4 font-medium text-slate-700">{{ item.sku }}</td>
            <td class="p-4 text-slate-800 font-medium">{{ item.item }}</td>
            <td class="p-4 text-right font-medium text-slate-700">{{ formatN(Number(item.qty)) }}</td>
            <td class="p-4 text-slate-500">{{ item.uom || '-' }}</td>
            <td v-if="activeTab === 'wip'" class="p-4 text-right text-slate-600">{{ item.wo_count || 0 }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="bg-slate-50">
            <td colspan="2" class="p-4 text-right font-bold text-slate-700">Total Quantity:</td>
            <td class="p-4 text-right font-bold text-indigo-700">
              {{ formatN(stockData.reduce((acc: number, val: any) => acc + Number(val.qty || 0), 0)) }}
            </td>
            <td></td>
            <td v-if="activeTab === 'wip'"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
</template>
