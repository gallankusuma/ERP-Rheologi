<script setup lang="ts">
import { ref, onMounted } from 'vue';
import axios from 'axios';

const items = ref<any[]>([]);
const loading = ref(true);
const activeTab = ref('FG'); // Default to Finished Goods

const tabs = [
  { id: 'FG', name: 'Finished Goods', icon: '📦' },
  { id: 'RM', name: 'Raw Materials', icon: '🧪' },
  { id: 'PM', name: 'Packaging Materials', icon: '🧻' },
];

const fetchItems = async () => {
  loading.value = true;
  try {
    const response = await axios.get(`${import.meta.env.VITE_API_URL}/ppic/items`, {
      params: { type: activeTab.value }
    });
    items.value = response.data.data;
  } catch (error) {
    console.error('Failed to fetch items:', error);
  } finally {
    loading.value = false;
  }
};

const switchTab = (tabId: string) => {
  activeTab.value = tabId;
  fetchItems();
};

onMounted(() => {
  fetchItems();
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h2 class="text-2xl font-bold text-slate-800">Item Master</h2>
      <button class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2">
        <span>+</span> Add Item
      </button>
    </div>

    <!-- Tabs -->
    <div class="flex gap-2 border-b border-slate-200">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        @click="switchTab(tab.id)"
        class="px-4 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors"
        :class="activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'"
      >
        <span>{{ tab.icon }}</span>
        {{ tab.name }}
      </button>
    </div>

    <!-- Data Table -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div v-if="loading" class="p-8 text-center text-slate-500">
        <div class="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        Loading items...
      </div>
      
      <table v-else class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
            <th class="p-4 font-semibold">SKU / Code</th>
            <th class="p-4 font-semibold">Item Name</th>
            <th class="p-4 font-semibold">Category</th>
            <th class="p-4 font-semibold">UOM</th>
            <th class="p-4 font-semibold text-right">Standard Cost</th>
            <th class="p-4 font-semibold">Status</th>
            <th class="p-4 font-semibold text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="items.length === 0">
            <td colspan="7" class="p-8 text-center text-slate-500 bg-slate-50/50">
              No items found for {{ tabs.find(t => t.id === activeTab)?.name }}
            </td>
          </tr>
          <tr v-for="item in items" :key="item.id" class="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
            <td class="p-4 text-sm font-medium text-slate-700">{{ item.sku }}</td>
            <td class="p-4">
              <div class="text-sm font-medium text-slate-800">{{ item.name }}</div>
              <div class="text-xs text-slate-500 truncate max-w-xs">{{ item.description || '-' }}</div>
            </td>
            <td class="p-4 text-sm text-slate-600">
              <span class="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs">{{ item.category_name || 'Uncategorized' }}</span>
            </td>
            <td class="p-4 text-sm text-slate-600">{{ item.uom_name || '-' }}</td>
            <td class="p-4 text-sm text-slate-700 text-right font-mono">
              Rp {{ Number(item.standard_cost || 0).toLocaleString('id-ID') }}
            </td>
            <td class="p-4">
              <span v-if="item.active" class="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-medium">Active</span>
              <span v-else class="bg-rose-100 text-rose-700 px-2.5 py-1 rounded-full text-xs font-medium">Inactive</span>
            </td>
            <td class="p-4 text-center">
              <button class="text-indigo-600 hover:text-indigo-800 p-1.5 rounded-md hover:bg-indigo-50 transition-colors" title="Edit">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
