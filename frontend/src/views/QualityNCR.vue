<template>
  <div class="min-h-screen bg-gray-50">
    <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Non-Conformance Reports (NCR)</h2>
          <p class="text-sm text-gray-500 mt-1">Track, investigate, and resolve quality non-conformances</p>
        </div>
        <button @click="showCreate = true" class="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700">+ Raise NCR</button>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-6">
        <div class="bg-white shadow rounded-lg p-4">
          <p class="text-xs text-gray-500 uppercase">Total</p>
          <p class="text-2xl font-bold">{{ store.ncrs.length }}</p>
        </div>
        <div class="bg-white shadow rounded-lg p-4">
          <p class="text-xs text-red-600 uppercase">Open</p>
          <p class="text-2xl font-bold text-red-700">{{ store.ncrs.filter(n => n.status === 'open').length }}</p>
        </div>
        <div class="bg-white shadow rounded-lg p-4">
          <p class="text-xs text-yellow-600 uppercase">Investigating</p>
          <p class="text-2xl font-bold text-yellow-700">{{ store.ncrs.filter(n => n.status === 'investigating').length }}</p>
        </div>
        <div class="bg-white shadow rounded-lg p-4">
          <p class="text-xs text-blue-600 uppercase">Auto-Generated</p>
          <p class="text-2xl font-bold text-blue-700">{{ store.ncrs.filter(n => n.source_type === 'fpa_reject').length }}</p>
        </div>
        <div class="bg-white shadow rounded-lg p-4">
          <p class="text-xs text-green-600 uppercase">Closed</p>
          <p class="text-2xl font-bold text-green-700">{{ store.ncrs.filter(n => n.status === 'closed').length }}</p>
        </div>
      </div>

      <!-- Filter -->
      <div class="flex gap-3 mb-4">
        <select v-model="filterStatus" class="px-3 py-2 border rounded-md text-sm bg-white">
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="corrective_action">Corrective Action</option>
          <option value="closed">Closed</option>
        </select>
        <select v-model="filterSource" class="px-3 py-2 border rounded-md text-sm bg-white">
          <option value="">All Sources</option>
          <option value="manual">Manual</option>
          <option value="fpa_reject">Auto (FPA Reject)</option>
        </select>
        <input v-model="searchText" type="text" placeholder="Search NCR number or product..." class="px-3 py-2 border rounded-md text-sm flex-1" />
      </div>

      <div v-if="store.loading" class="text-center py-10"><div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>

      <div v-else class="bg-white shadow rounded-lg overflow-x-auto">
        <table class="w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">NCR #</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Product</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Category</th>
              <th class="px-4 py-3 text-center text-sm font-medium text-gray-500">Source</th>
              <th class="px-4 py-3 text-center text-sm font-medium text-gray-500">Severity</th>
              <th class="px-4 py-3 text-center text-sm font-medium text-gray-500">Status</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Description</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Raised</th>
              <th class="px-4 py-3 text-right text-sm font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-for="n in filteredNCRs" :key="n.id" class="hover:bg-gray-50">
              <td class="px-4 py-3 font-medium">
                <router-link :to="`/quality/ncr/${n.id}`" class="text-blue-600 hover:underline">{{ n.ncr_number }}</router-link>
              </td>
              <td class="px-4 py-3 text-gray-900">{{ n.product_name }}</td>
              <td class="px-4 py-3 text-gray-600 capitalize">{{ n.category }}</td>
              <td class="px-4 py-3 text-center">
                <span v-if="n.source_type === 'fpa_reject'" class="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">Auto</span>
                <span v-else class="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Manual</span>
              </td>
              <td class="px-4 py-3 text-center">
                <span :class="severityBadge(n.severity)" class="px-2 py-1 rounded-full text-xs font-medium">{{ n.severity }}</span>
              </td>
              <td class="px-4 py-3 text-center">
                <span :class="statusBadge(n.status)" class="px-2 py-1 rounded-full text-xs font-medium">{{ n.status }}</span>
              </td>
              <td class="px-4 py-3 text-gray-600 max-w-xs truncate">{{ n.description }}</td>
              <td class="px-4 py-3 text-gray-400">{{ formatDate(n.created_at) }}</td>
              <td class="px-4 py-3 text-right space-x-1">
                <router-link :to="`/quality/ncr/${n.id}`" class="text-blue-600 hover:underline text-xs">Detail</router-link>
                <button v-if="n.status !== 'closed'" @click="openAddAction(n)" class="text-purple-600 hover:underline text-xs">Add Action</button>
              </td>
            </tr>
            <tr v-if="!filteredNCRs.length"><td colspan="9" class="text-center py-8 text-gray-400">No NCRs found</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Create NCR Modal -->
      <div v-if="showCreate" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <h3 class="text-lg font-bold mb-4">Raise NCR</h3>
          <form @submit.prevent="createNCR" class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700">Product</label>
                <select v-model.number="form.product_id" required class="mt-1 w-full px-3 py-2 border rounded-md text-sm">
                  <option value="">Select</option>
                  <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">Category</label>
                <select v-model="form.category" class="mt-1 w-full px-3 py-2 border rounded-md text-sm">
                  <option value="material">Material</option>
                  <option value="process">Process</option>
                  <option value="product">Product</option>
                  <option value="supplier">Supplier</option>
                  <option value="customer">Customer</option>
                </select>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Severity</label>
              <select v-model="form.severity" class="mt-1 w-full px-3 py-2 border rounded-md text-sm">
                <option value="critical">Critical</option>
                <option value="major">Major</option>
                <option value="minor">Minor</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Description</label>
              <textarea v-model="form.description" required rows="3" class="mt-1 w-full px-3 py-2 border rounded-md text-sm"></textarea>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Root Cause (optional)</label>
              <textarea v-model="form.root_cause" rows="2" class="mt-1 w-full px-3 py-2 border rounded-md text-sm"></textarea>
            </div>
            <div class="flex justify-end gap-3 pt-2">
              <button type="button" @click="showCreate = false" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm">Cancel</button>
              <button type="submit" class="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700">Raise NCR</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Add Action Modal -->
      <div v-if="showAction" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
          <h3 class="text-lg font-bold mb-4">Add CAPA Action</h3>
          <form @submit.prevent="submitAction" class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700">Action Type</label>
              <select v-model="actionForm.action_type" class="mt-1 w-full px-3 py-2 border rounded-md text-sm">
                <option value="corrective">Corrective</option>
                <option value="preventive">Preventive</option>
                <option value="containment">Containment</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Description</label>
              <textarea v-model="actionForm.description" required rows="3" class="mt-1 w-full px-3 py-2 border rounded-md text-sm"></textarea>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Due Date</label>
              <input v-model="actionForm.due_date" type="date" class="mt-1 w-full px-3 py-2 border rounded-md text-sm" />
            </div>
            <div class="flex justify-end gap-3 pt-2">
              <button type="button" @click="showAction = false" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm">Cancel</button>
              <button type="submit" class="px-4 py-2 bg-purple-600 text-white rounded-md text-sm hover:bg-purple-700">Add</button>
            </div>
          </form>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useQualityStore } from '../stores/quality';
import { api } from '../lib/api';

const store = useQualityStore();
const products = ref<any[]>([]);
const showCreate = ref(false);
const showAction = ref(false);
const actionNCRId = ref<number>(0);
const filterStatus = ref('');
const filterSource = ref('');
const searchText = ref('');

const form = ref({ product_id: '', category: 'process', severity: 'minor', description: '', root_cause: '' });
const actionForm = ref({ action_type: 'corrective', description: '', due_date: '' });

const filteredNCRs = computed(() => {
  return store.ncrs.filter((n: any) => {
    if (filterStatus.value && n.status !== filterStatus.value) return false;
    if (filterSource.value && (n.source_type || 'manual') !== filterSource.value) return false;
    if (searchText.value) {
      const q = searchText.value.toLowerCase();
      if (!(n.ncr_number || '').toLowerCase().includes(q) && !(n.product_name || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });
});

const severityBadge = (s: string) => ({
  'bg-red-100 text-red-800': s === 'critical',
  'bg-yellow-100 text-yellow-800': s === 'major',
  'bg-blue-100 text-blue-800': s === 'minor',
});

const statusBadge = (s: string) => ({
  'bg-red-100 text-red-800': s === 'open',
  'bg-yellow-100 text-yellow-800': s === 'investigating',
  'bg-blue-100 text-blue-800': s === 'corrective_action',
  'bg-green-100 text-green-800': s === 'closed',
});

const formatDate = (d: string) => d ? new Date(d).toLocaleDateString() : '-';

const openAddAction = (n: any) => {
  actionNCRId.value = n.id;
  actionForm.value = { action_type: 'corrective', description: '', due_date: '' };
  showAction.value = true;
};

onMounted(async () => {
  await store.fetchNCRs();
  try { products.value = (await api.get('/products')).data.data || []; } catch {}
});

const createNCR = async () => {
  await store.createNCR(form.value);
  showCreate.value = false;
  form.value = { product_id: '', category: 'process', severity: 'minor', description: '', root_cause: '' };
};

const submitAction = async () => {
  await store.addNCRAction(actionNCRId.value, actionForm.value);
  showAction.value = false;
  await store.fetchNCRs();
};
</script>
