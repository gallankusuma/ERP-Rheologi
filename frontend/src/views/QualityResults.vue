<template>
  <div class="min-h-screen bg-gray-50">
    <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">QC Results</h2>
          <p class="text-sm text-gray-500 mt-1">Read-only view of FPA analysis results</p>
        </div>
      </div>

      <!-- Filters -->
      <div class="bg-white shadow rounded-lg p-4 mb-4 flex flex-wrap gap-4 items-end">
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Status</label>
          <select v-model="filters.status" @change="load" class="px-3 py-2 border rounded-md text-sm w-36">
            <option value="">All</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Search</label>
          <input v-model="search" placeholder="Product, batch or FPA..." class="px-3 py-2 border rounded-md text-sm w-48" />
        </div>
      </div>

      <div v-if="loading" class="text-center py-10"><div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>

      <div v-else class="bg-white shadow rounded-lg overflow-x-auto">
        <table class="w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase">FPA</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase">Product</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase">Batch</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase">Parameter</th>
              <th class="px-4 py-3 text-right text-sm font-medium text-gray-500 uppercase">Value</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase">Spec</th>
              <th class="px-4 py-3 text-center text-sm font-medium text-gray-500 uppercase">Result</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase">Analyst</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase">Date</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-for="r in filteredResults" :key="r.id" class="hover:bg-gray-50">
              <td class="px-4 py-3 text-gray-600">{{ r.fpa_number || '-' }}</td>
              <td class="px-4 py-3 text-gray-900">{{ r.product_name || '-' }}</td>
              <td class="px-4 py-3 text-gray-600">{{ r.batch_number || '-' }}</td>
              <td class="px-4 py-3 text-gray-600">{{ r.test_name || r.test_code || '-' }}</td>
              <td class="px-4 py-3 text-right font-mono">{{ r.actual_value ?? '-' }}</td>
              <td class="px-4 py-3 text-gray-400">
                <template v-if="r.param_type === 'qualitative'">{{ r.standard_value || '-' }}</template>
                <template v-else>{{ formatSpec(r.min_value, r.max_value) }} {{ r.uom || '' }}</template>
              </td>
              <td class="px-4 py-3 text-center">
                <span :class="resultBadge(r.result_status)" class="px-2 py-1 rounded-full text-xs font-medium">
                  {{ r.result_status || 'pending' }}
                </span>
              </td>
              <td class="px-4 py-3 text-gray-600">{{ r.tested_by_name || '-' }}</td>
              <td class="px-4 py-3 text-gray-400">{{ formatDate(r.created_at) }}</td>
            </tr>
            <tr v-if="!filteredResults.length"><td colspan="9" class="text-center py-8 text-gray-400">No results found</td></tr>
          </tbody>
        </table>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { api } from '../lib/api';

const loading = ref(true);
const results = ref<any[]>([]);
const search = ref('');
const filters = ref({ status: '' });

const filteredResults = computed(() => {
  let list = results.value;
  if (filters.value.status) list = list.filter(r => r.result_status === filters.value.status);
  if (search.value) {
    const q = search.value.toLowerCase();
    list = list.filter(r =>
      (r.product_name || '').toLowerCase().includes(q) ||
      (r.batch_number || '').toLowerCase().includes(q) ||
      (r.fpa_number || '').toLowerCase().includes(q)
    );
  }
  return list;
});

const resultBadge = (r: string) => ({
  'bg-green-100 text-green-800': r === 'passed',
  'bg-red-100 text-red-800': r === 'failed',
  'bg-yellow-100 text-yellow-800': r === 'pending' || !r,
});

const formatDate = (d: string) => d ? new Date(d).toLocaleDateString() : '-';

const formatSpec = (min: number | null, max: number | null) => {
  if (min != null && max != null) return `${min}–${max}`;
  if (min != null) return `≥${min}`;
  if (max != null) return `≤${max}`;
  return '-';
};

const load = async () => {
  loading.value = true;
  try {
    const res = await api.get('/quality/qc-results');
    results.value = res.data.data || res.data || [];
  } catch { results.value = []; }
  loading.value = false;
};

onMounted(load);
</script>
