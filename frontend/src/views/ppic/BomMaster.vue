<script setup lang="ts">
import { ref, onMounted } from 'vue';
import axios from 'axios';

const boms = ref<any[]>([]);
const loading = ref(true);

const fetchBoms = async () => {
  loading.value = true;
  try {
    const response = await axios.get(`${import.meta.env.VITE_API_URL}/ppic/boms`);
    boms.value = response.data.data;
  } catch (error) {
    console.error('Failed to fetch BOMs:', error);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchBoms();
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h2 class="text-2xl font-bold text-slate-800">Bill of Materials (BOM)</h2>
      <button class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2">
        <span>+</span> Create BOM
      </button>
    </div>

    <!-- Data Table -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div v-if="loading" class="p-8 text-center text-slate-500">
        <div class="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        Loading BOMs...
      </div>
      
      <table v-else class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
            <th class="p-4 font-semibold">BOM ID</th>
            <th class="p-4 font-semibold">Finished Good (FG)</th>
            <th class="p-4 font-semibold">Version</th>
            <th class="p-4 font-semibold">Status</th>
            <th class="p-4 font-semibold text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="boms.length === 0">
            <td colspan="5" class="p-8 text-center text-slate-500 bg-slate-50/50">
              No BOMs found
            </td>
          </tr>
          <tr v-for="bom in boms" :key="bom.id" class="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
            <td class="p-4 text-sm font-medium text-indigo-600">BOM-{{ String(bom.id).padStart(4, '0') }}</td>
            <td class="p-4">
              <div class="text-sm font-medium text-slate-800">{{ bom.product_name || bom.product_sku }}</div>
              <div class="text-xs text-slate-500">{{ bom.notes || 'No description' }}</div>
            </td>
            <td class="p-4 text-sm text-slate-600">v{{ bom.version || 1 }}</td>
            <td class="p-4">
              <span v-if="bom.status === 'ACTIVE'" class="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-medium">Active</span>
              <span v-else-if="bom.status === 'DRAFT'" class="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full text-xs font-medium">Draft</span>
              <span v-else class="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-xs font-medium">{{ bom.status }}</span>
            </td>
            <td class="p-4 text-center">
              <button class="text-indigo-600 hover:text-indigo-800 p-1.5 rounded-md hover:bg-indigo-50 transition-colors" title="View Details">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
