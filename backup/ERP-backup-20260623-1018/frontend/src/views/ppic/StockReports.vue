<script setup lang="ts">
import { ref } from 'vue';

const activeTab = ref('monthly'); // 'monthly', 'onhand', 'used', 'wip'

const tabs = [
  { id: 'monthly', name: 'Monthly Report', icon: '📅' },
  { id: 'onhand', name: 'On Process (On Hand)', icon: '📦' },
  { id: 'used', name: 'On Process (Used)', icon: '🔄' },
  { id: 'wip', name: 'On Process (WIP)', icon: '⏳' },
];

const mockData = ref([
  { item: 'Rheo-Active Cream 50g', sku: 'FG-001', qty: 1500, uom: 'pcs', val: 75000000 },
  { item: 'Bio-Serum Vitality 30ml', sku: 'FG-002', qty: 850, uom: 'pcs', val: 102000000 },
  { item: 'Water Purified', sku: 'RM-001', qty: 2500, uom: 'L', val: 12500000 },
  { item: 'Jar 50g', sku: 'PM-001', qty: 5000, uom: 'pcs', val: 25000000 },
]);

</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <div>
        <h2 class="text-2xl font-bold text-slate-800">PPIC Stock Reports</h2>
        <p class="text-slate-500 text-sm mt-1">View inventory status and production process summaries.</p>
      </div>
      <button class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2">
        <span>⬇️</span> Export PDF
      </button>
    </div>

    <!-- Tabs -->
    <div class="flex gap-2 border-b border-slate-200">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        @click="activeTab = tab.id"
        class="px-4 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors"
        :class="activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'"
      >
        <span>{{ tab.icon }}</span>
        {{ tab.name }}
      </button>
    </div>

    <!-- Data Table -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div class="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
        <h3 class="font-medium text-slate-700">{{ tabs.find(t => t.id === activeTab)?.name }} - As of Today</h3>
        <div class="flex gap-2">
          <input type="month" class="border border-slate-300 rounded-md text-sm px-2 py-1" value="2026-05">
        </div>
      </div>
      
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
            <th class="p-4 font-semibold">SKU / Code</th>
            <th class="p-4 font-semibold">Item Name</th>
            <th class="p-4 font-semibold text-right">Quantity</th>
            <th class="p-4 font-semibold">UOM</th>
            <th class="p-4 font-semibold text-right">Estimated Value</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, idx) in mockData" :key="idx" class="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
            <td class="p-4 text-sm font-medium text-slate-700">{{ item.sku }}</td>
            <td class="p-4 text-sm text-slate-800 font-medium">{{ item.item }}</td>
            <td class="p-4 text-sm text-right font-medium text-slate-700">{{ item.qty.toLocaleString() }}</td>
            <td class="p-4 text-sm text-slate-500">{{ item.uom }}</td>
            <td class="p-4 text-sm text-right font-mono text-slate-600">
              Rp {{ item.val.toLocaleString('id-ID') }}
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="bg-slate-50">
            <td colspan="4" class="p-4 text-right font-bold text-slate-700">Total Value:</td>
            <td class="p-4 text-right font-bold text-indigo-700 font-mono">
              Rp {{ mockData.reduce((acc, val) => acc + val.val, 0).toLocaleString('id-ID') }}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
</template>
