<template>
  <div class="-m-4 md:-m-8">
    <div class="px-4 md:px-6 py-4">
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
        <div>
          <h1 class="text-2xl font-bold text-slate-800 tracking-tight">🔬 Specifications</h1>
          <p class="text-sm text-slate-500 mt-0.5">{{ total.toLocaleString() }} specifications from FBox QC Online</p>
        </div>
        <div class="flex gap-2">
          <button @click="fetchData" class="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm shadow-sm transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Refresh
          </button>
        </div>
      </div>

      <!-- Search & Filters -->
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-5">
        <div class="flex flex-wrap gap-3 items-center">
          <div class="flex-1 min-w-[200px] relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input v-model="search" @input="debouncedSearch" type="text" placeholder="Search doc number, sample name..." class="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition" />
          </div>
          <select v-model="filterProcessType" @change="fetchData" class="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-teal-500 min-w-[170px]">
            <option value="">All Process Types</option>
            <option v-for="pt in processTypes" :key="pt.process_type_code" :value="pt.process_type_code">{{ pt.process_type }}</option>
          </select>
          <select v-model="filterSampleType" @change="fetchData" class="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-teal-500 min-w-[170px]">
            <option value="">All Sample Types</option>
            <option v-for="st in sampleTypes" :key="st.sample_type_code" :value="st.sample_type_code">{{ st.sample_type }}</option>
          </select>
          <select v-model="filterActive" @change="fetchData" class="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-teal-500 min-w-[120px]">
            <option value="">All Status</option>
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </select>
          <button v-if="search || filterProcessType || filterSampleType || filterActive" @click="clearFilters" class="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition">✕ Clear</button>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full"></div>
      <span class="ml-3 text-slate-500">Loading specifications...</span>
    </div>

    <!-- Table -->
    <div v-else class="bg-white shadow-sm border-y border-slate-200 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left" style="min-width: 1100px;">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200">
              <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Doc Number</th>
              <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Sample Name</th>
              <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Date</th>
              <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Process Type</th>
              <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Sample Type</th>
              <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap text-center">Samples</th>
              <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap text-center">Items</th>
              <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap text-center">Active</th>
              <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap text-center">Approved</th>
              <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap text-center">Source</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="spec in specs" :key="spec.id" class="hover:bg-teal-50/40 transition-colors cursor-pointer group" @click="openDetail(spec.id)">
              <td class="px-4 py-3 whitespace-nowrap">
                <span class="text-sm font-mono text-teal-600 font-medium">{{ spec.doc_number || '-' }}</span>
              </td>
              <td class="px-4 py-3">
                <div class="text-sm font-medium text-slate-800 leading-tight">{{ spec.sample_name || '-' }}</div>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span class="text-sm text-slate-600">{{ formatDate(spec.doc_date) }}</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span class="text-sm text-slate-600">{{ spec.process_type || '-' }}</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span class="text-xs px-2 py-0.5 rounded-full font-medium" :class="sampleTypeBadge(spec.sample_type_code)">{{ spec.sample_type || '-' }}</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-center">
                <span class="text-sm font-semibold text-slate-700">{{ spec.sample_count || 0 }}</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-center">
                <span class="text-sm font-semibold text-slate-700">{{ spec.item_count || 0 }}</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-center">
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" :class="spec.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'">
                  {{ spec.active ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-center">
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" :class="spec.approve_1 ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'">
                  {{ spec.approve_1 ? '✓ Approved' : 'Pending' }}
                </span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-center">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold" :class="spec.source === 'FBOX' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'">
                  {{ spec.source || 'FBOX' }}
                </span>
              </td>
            </tr>
            <tr v-if="specs.length === 0">
              <td colspan="10" class="px-4 py-12 text-center text-slate-400">
                <svg class="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                No specifications found
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="px-5 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50/50">
        <div class="text-sm text-slate-500">
          Showing <span class="font-medium text-slate-700">{{ ((currentPage - 1) * pageSize) + 1 }}</span> - <span class="font-medium text-slate-700">{{ Math.min(currentPage * pageSize, total) }}</span> of <span class="font-medium text-slate-700">{{ total.toLocaleString() }}</span>
        </div>
        <div class="flex items-center gap-1">
          <button @click="currentPage = 1; fetchData()" :disabled="currentPage === 1" class="px-2.5 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition bg-white">«</button>
          <button @click="currentPage = Math.max(1, currentPage - 1); fetchData()" :disabled="currentPage === 1" class="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition bg-white">‹ Prev</button>
          <span class="px-3 py-1.5 text-sm font-medium text-slate-700">{{ currentPage }} / {{ totalPages }}</span>
          <button @click="currentPage = Math.min(totalPages, currentPage + 1); fetchData()" :disabled="currentPage === totalPages" class="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition bg-white">Next ›</button>
          <button @click="currentPage = totalPages; fetchData()" :disabled="currentPage === totalPages" class="px-2.5 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition bg-white">»</button>
        </div>
      </div>
    </div>

    <!-- Detail Modal -->
    <div v-if="showDetail" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto">
      <div class="bg-white w-full max-w-6xl my-4 mx-4 rounded-2xl shadow-2xl flex flex-col max-h-[95vh]">
        <!-- Modal Header -->
        <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-t-2xl flex-shrink-0">
          <div>
            <h3 class="text-lg font-semibold">{{ detail?.doc_number }}</h3>
            <p class="text-sm text-teal-100 mt-0.5">{{ detail?.sample_name }}</p>
          </div>
          <div class="flex items-center gap-3">
            <span v-if="detail?.active" class="px-2.5 py-1 bg-white/20 rounded-full text-xs font-semibold">Active</span>
            <span v-if="detail?.approve_1" class="px-2.5 py-1 bg-white/20 rounded-full text-xs font-semibold">✓ Approved by {{ detail?.approve_1_by }}</span>
            <button @click="showDetail = false" class="p-2 hover:bg-white/20 rounded-lg transition">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <!-- Modal Body -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6">
          <!-- Header Info Cards -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="bg-slate-50 rounded-lg p-3">
              <span class="text-xs text-slate-500 block mb-1">Date</span>
              <span class="text-sm font-semibold text-slate-800">{{ formatDate(detail?.doc_date) }}</span>
            </div>
            <div class="bg-slate-50 rounded-lg p-3">
              <span class="text-xs text-slate-500 block mb-1">Process Type</span>
              <span class="text-sm font-semibold text-slate-800">{{ detail?.process_type || '-' }}</span>
            </div>
            <div class="bg-slate-50 rounded-lg p-3">
              <span class="text-xs text-slate-500 block mb-1">Sample Type</span>
              <span class="text-sm font-semibold text-slate-800">{{ detail?.sample_type || '-' }}</span>
            </div>
            <div class="bg-slate-50 rounded-lg p-3">
              <span class="text-xs text-slate-500 block mb-1">Source</span>
              <span class="text-sm font-semibold text-slate-800">{{ detail?.source || 'FBOX' }}</span>
            </div>
          </div>

          <!-- Tabs -->
          <div class="border-b border-slate-200">
            <nav class="flex gap-4 -mb-px">
              <button @click="detailTab = 'samples'" :class="detailTab === 'samples' ? 'border-teal-500 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'" class="pb-3 px-1 text-sm font-semibold border-b-2 transition">
                🧪 Samples ({{ detail?.samples?.length || 0 }})
              </button>
              <button @click="detailTab = 'items'" :class="detailTab === 'items' ? 'border-teal-500 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'" class="pb-3 px-1 text-sm font-semibold border-b-2 transition">
                📦 Items ({{ detail?.items?.length || 0 }})
              </button>
            </nav>
          </div>

          <!-- Samples Tab -->
          <div v-if="detailTab === 'samples'">
            <div v-for="(sample, sIdx) in detail?.samples" :key="sample.id" class="mb-6 border border-slate-200 rounded-xl overflow-hidden">
              <!-- Sample Header -->
              <div class="bg-slate-50 px-4 py-3 flex items-center justify-between border-b border-slate-200 cursor-pointer" @click="toggleSample(sIdx)">
                <div class="flex items-center gap-3">
                  <span class="text-sm font-mono text-teal-600 font-semibold">{{ sample.sample_code }}</span>
                  <span class="text-sm text-slate-700 font-medium">{{ cleanSampleName(sample.sample_name) }}</span>
                  <span v-if="sample.brand" class="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{{ cleanBrand(sample.brand) }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-slate-500">{{ sample.sample_point ? cleanText(sample.sample_point) : '' }}</span>
                  <span class="text-xs px-2 py-0.5 rounded-full font-medium" :class="sample.sample_type === 'Finished Goods' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'">{{ sample.sample_type }}</span>
                  <svg :class="expandedSamples.includes(sIdx) ? 'rotate-180' : ''" class="w-4 h-4 text-slate-400 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                </div>
              </div>

              <!-- Parameters Table (Expandable) -->
              <div v-if="expandedSamples.includes(sIdx)" class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-slate-100/50">
                    <tr>
                      <th class="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase w-8">#</th>
                      <th class="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Parameter</th>
                      <th class="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Method</th>
                      <th class="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Unit</th>
                      <th class="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Specification</th>
                      <th class="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Frequency</th>
                      <th class="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Setup Type</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <tr v-for="(param, pIdx) in sample.parameters" :key="param.id" class="hover:bg-teal-50/30">
                      <td class="px-4 py-2 text-slate-400">{{ pIdx + 1 }}</td>
                      <td class="px-4 py-2 font-medium text-slate-800">{{ cleanParamName(param.parameter_name) }}</td>
                      <td class="px-4 py-2 text-slate-600">{{ cleanParamName(param.method) }}</td>
                      <td class="px-4 py-2 text-slate-600">{{ param.unit }}</td>
                      <td class="px-4 py-2 text-slate-800 font-semibold">{{ param.specification }}</td>
                      <td class="px-4 py-2 text-slate-500">{{ param.frequency }}</td>
                      <td class="px-4 py-2 text-slate-500 text-xs">{{ cleanSetupType(param.setup_type) }}</td>
                    </tr>
                    <tr v-if="!sample.parameters?.length">
                      <td colspan="7" class="px-4 py-6 text-center text-slate-400 text-xs">No parameters</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div v-if="!detail?.samples?.length" class="text-center text-slate-400 py-8">No samples in this specification</div>
          </div>

          <!-- Items Tab -->
          <div v-if="detailTab === 'items'">
            <div class="border border-slate-200 rounded-xl overflow-hidden">
              <table class="w-full text-sm">
                <thead class="bg-slate-50">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase w-8">#</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Item Code</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Item Description</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Unit</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Product Link</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr v-for="(item, iIdx) in detail?.items" :key="item.id" class="hover:bg-teal-50/30">
                    <td class="px-4 py-3 text-slate-400">{{ iIdx + 1 }}</td>
                    <td class="px-4 py-3 font-mono text-sm text-teal-600 font-medium">{{ item.item_code }}</td>
                    <td class="px-4 py-3 text-slate-800 font-medium">{{ item.item_description }}</td>
                    <td class="px-4 py-3 text-slate-600">{{ item.unit }}</td>
                    <td class="px-4 py-3">
                      <span v-if="item.product_name" class="text-xs text-blue-600 font-medium">{{ item.product_name }}</span>
                      <span v-else class="text-xs text-slate-400">—</span>
                    </td>
                  </tr>
                  <tr v-if="!detail?.items?.length">
                    <td colspan="5" class="px-4 py-8 text-center text-slate-400">No items linked</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api } from '../lib/api';

const specs = ref<any[]>([]);
const loading = ref(false);
const total = ref(0);
const currentPage = ref(1);
const pageSize = 50;
const search = ref('');
const filterProcessType = ref('');
const filterSampleType = ref('');
const filterActive = ref('');
const processTypes = ref<any[]>([]);
const sampleTypes = ref<any[]>([]);

const showDetail = ref(false);
const detail = ref<any>(null);
const detailTab = ref('samples');
const expandedSamples = ref<number[]>([]);

const totalPages = computed(() => Math.ceil(total.value / pageSize));

let searchTimeout: any = null;
const debouncedSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => { currentPage.value = 1; fetchData(); }, 300);
};

const clearFilters = () => {
  search.value = '';
  filterProcessType.value = '';
  filterSampleType.value = '';
  filterActive.value = '';
  currentPage.value = 1;
  fetchData();
};

async function fetchData() {
  loading.value = true;
  try {
    const params: any = { page: currentPage.value, limit: pageSize };
    if (search.value) params.search = search.value;
    if (filterProcessType.value) params.process_type = filterProcessType.value;
    if (filterSampleType.value) params.sample_type = filterSampleType.value;
    if (filterActive.value !== '') params.active = filterActive.value;

    const res = await api.get('/rnd/specifications', { params });
    specs.value = res.data.data || [];
    total.value = res.data.total || 0;
    if (res.data.processTypes) processTypes.value = res.data.processTypes;
    if (res.data.sampleTypes) sampleTypes.value = res.data.sampleTypes;
  } catch (e: any) {
    console.error('Failed to load specs:', e);
  } finally {
    loading.value = false;
  }
}

async function openDetail(id: number) {
  try {
    const res = await api.get(`/rnd/specifications/${id}`);
    detail.value = res.data;
    detailTab.value = 'samples';
    expandedSamples.value = detail.value?.samples?.length <= 3 ? detail.value.samples.map((_: any, i: number) => i) : [0];
    showDetail.value = true;
  } catch (e: any) {
    console.error('Failed to load detail:', e);
  }
}

const toggleSample = (idx: number) => {
  const i = expandedSamples.value.indexOf(idx);
  if (i >= 0) expandedSamples.value.splice(i, 1);
  else expandedSamples.value.push(idx);
};

// Utility functions to clean scraped data
const cleanText = (t: string) => {
  if (!t) return '';
  return t.replace(/\n.*/s, '').trim();
};

const cleanSampleName = (name: string) => {
  if (!name) return '';
  return name.split('\n')[0].replace(/Brand$/i, '').trim();
};

const cleanBrand = (brand: string) => {
  if (!brand) return '';
  return brand.split('\n')[0].trim();
};

const cleanParamName = (name: string) => {
  if (!name) return '';
  // Remove numeric prefix like "50 - " if present
  return name.replace(/^\d+\s*-\s*/, '').trim();
};

const cleanSetupType = (s: string) => {
  if (!s) return '';
  // Remove any JSON-like content
  if (s.startsWith('{')) return '';
  return s.split('\n')[0].trim();
};

const formatDate = (d: string) => {
  if (!d) return '-';
  try {
    const date = new Date(d);
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
};

const sampleTypeBadge = (code: string) => {
  if (!code) return 'bg-gray-100 text-gray-600';
  if (code === 'FG') return 'bg-green-100 text-green-700';
  if (code === 'IM-FG') return 'bg-amber-100 text-amber-700';
  if (code === 'IM') return 'bg-blue-100 text-blue-700';
  return 'bg-slate-100 text-slate-700';
};

onMounted(() => {
  fetchData();
});
</script>
