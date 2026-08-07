<template>
  <div class="min-h-screen bg-gray-50">
    <div class="w-full mx-auto px-6 sm:px-8 lg:px-12 py-6">
      <!-- Header -->
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">Prospects</h1>
          <p class="text-gray-500 mt-1 text-base">Manage potential clients & conversion pipeline</p>
        </div>
      <div class="flex gap-3">
        <button @click="batchConvertToLeads" :disabled="selectedProspects.length === 0" 
          class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
          :title="selectedProspects.length === 0 ? 'Select prospects to convert' : `Convert ${selectedProspects.length} prospects to leads`"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          Auto Generate Leads {{ selectedProspects.length > 0 ? `(${selectedProspects.length})` : '' }}
        </button>
        <button @click="openModal()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2 shadow-sm">
          <span>+</span> Add Prospect
        </button>
      </div>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div v-for="s in statCards" :key="s.label" class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">{{ s.label }}</p>
          <p class="text-3xl font-bold mt-1" :class="s.color">{{ s.value }}</p>
        </div>
      </div>

      <!-- Filters -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-wrap gap-3 mb-4">
        <input v-model="search" type="text" placeholder="Search prospects..." class="flex-1 min-w-[200px] px-4 py-2.5 border border-gray-300 rounded-lg text-base" @input="debouncedFetch" />
        <select v-model="filterTemp" @change="fetchProspects" class="px-4 py-2.5 border border-gray-300 rounded-lg text-base bg-white">
          <option value="">All Temperature</option>
          <option value="hot">🔥 Hot</option>
          <option value="warm">🌤 Warm</option>
          <option value="cold">❄️ Cold</option>
        </select>
        <select v-model="filterStatus" @change="fetchProspects" class="px-4 py-2.5 border border-gray-300 rounded-lg text-base bg-white">
          <option value="">All Status</option>
          <option v-for="st in statusOptions" :key="st" :value="st">{{ st }}</option>
        </select>
        <select v-model="filterSource" @change="fetchProspects" class="px-4 py-2.5 border border-gray-300 rounded-lg text-base bg-white">
          <option value="">All Sources</option>
          <option v-for="src in sourceOptions" :key="src" :value="src">{{ src }}</option>
        </select>
        <label class="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-base bg-white cursor-pointer select-none">
          <input type="checkbox" v-model="showArchived" @change="fetchProspects" class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
          Show Archived
        </label>
      </div>

      <!-- Table -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 border-b border-gray-200">
              <tr>
                <th class="px-3 py-3 text-center">
                  <input type="checkbox" @change="toggleSelectAll" :checked="allSelected" class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                </th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Code</th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Company</th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Contact</th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Industry</th>
                <th class="px-4 py-3 text-center text-sm font-semibold text-gray-700">Temp</th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th class="px-4 py-3 text-right text-sm font-semibold text-gray-700">Est. Value</th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Follow Up</th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Source</th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="p in prospects" :key="p.id" class="hover:bg-blue-50/40 transition-colors" :class="{ 'bg-blue-50/60': selectedProspects.includes(p.id) }">
                <td class="px-3 py-3 text-center">
                  <input v-if="p.status === 'qualified'" type="checkbox" :value="p.id" v-model="selectedProspects" class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                  <span v-else-if="p.status === 'converted'" class="text-green-500 text-sm">✓</span>
                </td>
                <td class="px-4 py-3 font-mono text-gray-600">{{ p.code }}</td>
                <td class="px-4 py-3">
                  <p class="font-medium text-gray-900">{{ p.company_name }}</p>
                  <p v-if="p.city" class="text-sm text-gray-500">{{ p.city }}</p>
                </td>
                <td class="px-4 py-3">
                  <p class="text-gray-800">{{ p.contact_name || '—' }}</p>
                  <p class="text-sm text-gray-500">{{ p.email || '' }}</p>
                </td>
                <td class="px-4 py-3 text-gray-600">{{ p.industry || '—' }}</td>
                <td class="px-4 py-3 text-center">
                  <span class="text-lg" :title="p.temperature">{{ tempIcon(p.temperature) }}</span>
                </td>
                <td class="px-4 py-3">
                  <span class="px-2.5 py-1 rounded-full text-sm font-semibold" :class="statusColor(p.status)">{{ p.status }}</span>
                </td>
                <td class="px-4 py-3 font-medium text-gray-900 text-right">{{ formatCurrency(p.estimated_value, p.currency) }}</td>
                <td class="px-4 py-3">
                  <span v-if="p.next_follow_up" class="text-sm" :class="isOverdue(p.next_follow_up) ? 'text-red-600 font-bold' : 'text-gray-600'">
                    {{ formatDate(p.next_follow_up) }}
                    <span v-if="isOverdue(p.next_follow_up)"> ⚠</span>
                  </span>
                  <span v-else class="text-sm text-gray-400">—</span>
                </td>
                <td class="px-4 py-3">
                  <span class="text-sm px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">{{ p.source }}</span>
                </td>
                <td class="px-4 py-3">
                  <div class="flex gap-1">
                    <button v-if="p.is_archived" @click="restoreProspect(p)" class="text-green-600 hover:text-green-800 text-sm font-medium" title="Restore">♻️ Restore</button>
                    <template v-else>
                      <button @click="openModal(p)" class="text-blue-600 hover:text-blue-800 text-sm font-medium" title="Edit">✏️</button>
                      <button v-if="p.status === 'qualified'" @click="convertProspect(p)" class="text-green-600 hover:text-green-800 text-sm font-medium" title="Convert to Lead">🔄</button>
                      <button @click="deleteProspect(p)" class="text-red-400 hover:text-red-600 text-sm font-medium" title="Archive">🗑</button>
                    </template>
                  </div>
                </td>
              </tr>
              <tr v-if="prospects.length === 0 && !loading">
                <td colspan="11" class="px-4 py-12 text-center text-gray-400">No prospects found. Click "Add Prospect" to get started.</td>
              </tr>
              <tr v-if="loading">
                <td colspan="11" class="px-4 py-12 text-center text-gray-400">Loading...</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="pagination.totalPages > 1" class="flex justify-between items-center px-4 py-3 border-t border-gray-200 bg-gray-50">
          <span class="text-sm text-gray-600">Showing {{ (pagination.page-1)*pagination.limit+1 }}–{{ Math.min(pagination.page*pagination.limit, pagination.total) }} of {{ pagination.total }}</span>
          <div class="flex gap-1">
            <button v-for="pg in pagination.totalPages" :key="pg" @click="goToPage(pg)"
              :class="pg === pagination.page ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border'"
              class="px-3 py-1 rounded text-sm font-medium">{{ pg }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 class="text-lg font-bold text-gray-900">{{ editingId ? 'Edit Prospect' : 'Add Prospect' }}</h3>
          <button @click="showModal = false" class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>
        <div class="px-6 py-4 overflow-y-auto flex-1">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
              <input v-model="form.company_name" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
              <input v-model="form.contact_name" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Title / Position</label>
              <input v-model="form.contact_title" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input v-model="form.email" type="email" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input v-model="form.phone" type="tel" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Industry</label>
              <input v-model="form.industry" type="text" placeholder="e.g. Cosmetics, F&B, Pharma" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input v-model="form.website" type="url" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input v-model="form.city" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <input v-model="form.country" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Source</label>
              <select v-model="form.source" class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500">
                <option v-for="src in sourceOptions" :key="src" :value="src">{{ src }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Temperature</label>
              <select v-model="form.temperature" class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500">
                <option value="hot">🔥 Hot</option>
                <option value="warm">🌤 Warm</option>
                <option value="cold">❄️ Cold</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select v-model="form.status" class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500">
                <option v-for="st in statusOptions" :key="st" :value="st">{{ st }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Estimated Value</label>
              <div class="flex gap-2">
                <select v-model="form.currency" class="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 w-24">
                  <option value="IDR">Rp</option>
                  <option value="USD">$</option>
                </select>
                <input v-model.number="form.estimated_value" type="number" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Next Follow Up</label>
              <input v-model="form.next_follow_up" type="date" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">Interest / Product Needs</label>
              <textarea v-model="form.interest" rows="2" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="What products/services are they interested in?"></textarea>
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea v-model="form.notes" rows="2" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"></textarea>
            </div>
          </div>
        </div>
        <div class="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button @click="showModal = false" class="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button @click="saveProspect" :disabled="saving || !form.company_name" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div v-if="toast" class="fixed bottom-4 right-4 z-50 animate-fade-in">
      <div :class="toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'" class="text-white px-5 py-3 rounded-lg shadow-lg">{{ toast.message }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { api } from '../lib/api';

interface Prospect {
  id: number; code: string; company_name: string; contact_name: string;
  contact_title: string; email: string; phone: string; industry: string;
  website: string; city: string; country: string; source: string;
  temperature: string; status: string; interest: string;
  estimated_value: number; currency: string; next_follow_up: string; notes: string;
  assigned_to_name: string; created_at: string; is_archived: boolean;
}

const prospects = ref<Prospect[]>([]);
const loading = ref(false);
const saving = ref(false);
const showModal = ref(false);
const editingId = ref<number | null>(null);
const search = ref('');
const filterTemp = ref('');
const filterStatus = ref('');
const filterSource = ref('');
const showArchived = ref(false);
const currentPage = ref(1);
const pagination = reactive({ total: 0, page: 1, limit: 25, totalPages: 1 });
const toast = ref<{ type: string; message: string } | null>(null);
const stats = reactive({ total: 0, active: 0, converted: 0, overdue: 0, totalValue: 0 });
const selectedProspects = ref<number[]>([]);

const allSelected = computed(() => {
  const convertable = prospects.value.filter(p => p.status === 'qualified');
  return convertable.length > 0 && convertable.every(p => selectedProspects.value.includes(p.id));
});

const statusOptions = ['new', 'contacted', 'qualified', 'disqualified', 'converted'];
const sourceOptions = ['website', 'linkedin', 'referral', 'cold_call', 'email', 'event', 'trade_show', 'social_media', 'other'];

const defaultForm = () => ({
  company_name: '', contact_name: '', contact_title: '', email: '', phone: '',
  industry: '', website: '', city: '', country: 'Indonesia',
  source: 'other', temperature: 'cold', status: 'new',
  interest: '', estimated_value: 0, currency: 'IDR', next_follow_up: '', notes: ''
});
const form = reactive(defaultForm());

const statCards = computed(() => [
  { label: 'Total', value: stats.total, color: 'text-gray-900' },
  { label: 'Active', value: stats.active, color: 'text-blue-600' },
  { label: 'Converted', value: stats.converted, color: 'text-green-600' },
  { label: 'Overdue F/U', value: stats.overdue, color: stats.overdue > 0 ? 'text-red-600' : 'text-gray-400' },
  { label: 'Pipeline Value', value: formatCurrency(stats.totalValue), color: 'text-indigo-600' },
]);

const tempIcon = (t: string) => ({ hot: '🔥', warm: '🌤️', cold: '❄️' }[t] || '❄️');

const statusColor = (s: string) => ({
  new: 'bg-gray-100 text-gray-800',
  contacted: 'bg-blue-100 text-blue-800',
  qualified: 'bg-cyan-100 text-cyan-800',
  disqualified: 'bg-red-100 text-red-800',
  converted: 'bg-green-100 text-green-800',
}[s] || 'bg-gray-100 text-gray-800');

const formatCurrency = (v: number, currency = 'IDR') => currency === 'USD'
  ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v || 0)
  : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);
const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const isOverdue = (d: string) => d && new Date(d) < new Date(new Date().toDateString());

let debounceTimer: any;
const debouncedFetch = () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(() => fetchProspects(), 300); };

const showToast = (type: string, message: string) => {
  toast.value = { type, message };
  setTimeout(() => { toast.value = null; }, 3000);
};

const fetchProspects = async () => {
  loading.value = true;
  try {
    const params: any = { page: currentPage.value, limit: 25 };
    if (search.value) params.search = search.value;
    if (filterTemp.value) params.temperature = filterTemp.value;
    if (filterStatus.value) params.status = filterStatus.value;
    if (filterSource.value) params.source = filterSource.value;
    if (showArchived.value) params.show_archived = '1';
    const { data } = await api.get('/prospects', { params });
    prospects.value = data.data || [];
    Object.assign(pagination, data.pagination || {});
  } catch (e: any) {
    console.error('Error fetching prospects:', e);
  } finally {
    loading.value = false;
  }
};

const fetchStats = async () => {
  try {
    const { data } = await api.get('/prospects/stats');
    const s = data.summary || {};
    stats.total = s.total_count || 0;
    stats.active = s.active_count || 0;
    stats.converted = s.converted_count || 0;
    stats.overdue = s.overdue_followups || 0;
    stats.totalValue = parseFloat(s.total_value) || 0;
  } catch { /* silent */ }
};

const openModal = (prospect?: Prospect) => {
  if (prospect) {
    editingId.value = prospect.id;
    Object.assign(form, {
      company_name: prospect.company_name, contact_name: prospect.contact_name || '',
      contact_title: prospect.contact_title || '', email: prospect.email || '',
      phone: prospect.phone || '', industry: prospect.industry || '',
      website: prospect.website || '', city: prospect.city || '',
      country: prospect.country || 'Indonesia', source: prospect.source || 'other',
      temperature: prospect.temperature || 'cold', status: prospect.status || 'new',
      interest: prospect.interest || '', estimated_value: prospect.estimated_value || 0,
      currency: prospect.currency || 'IDR',
      next_follow_up: prospect.next_follow_up ? prospect.next_follow_up.split('T')[0] : '',
      notes: prospect.notes || '',
    });
  } else {
    editingId.value = null;
    Object.assign(form, defaultForm());
  }
  showModal.value = true;
};

const saveProspect = async () => {
  saving.value = true;
  try {
    if (editingId.value) {
      await api.put(`/prospects/${editingId.value}`, form);
      showToast('success', 'Prospect updated');
    } else {
      await api.post('/prospects', form);
      showToast('success', 'Prospect created');
    }
    showModal.value = false;
    fetchProspects();
    fetchStats();
  } catch (e: any) {
    showToast('error', e.response?.data?.error || 'Failed to save');
  } finally {
    saving.value = false;
  }
};

const deleteProspect = async (p: Prospect) => {
  if (!confirm(`Archive prospect "${p.company_name}"? You can restore it later via "Show Archived".`)) return;
  try {
    await api.delete(`/prospects/${p.id}`);
    showToast('success', 'Prospect archived');
    fetchProspects();
    fetchStats();
  } catch (e: any) {
    showToast('error', e.response?.data?.error || 'Failed to archive');
  }
};

const restoreProspect = async (p: Prospect) => {
  try {
    await api.patch(`/prospects/${p.id}/restore`);
    showToast('success', 'Prospect restored');
    fetchProspects();
    fetchStats();
  } catch (e: any) {
    showToast('error', e.response?.data?.error || 'Failed to restore');
  }
};

const convertProspect = async (p: Prospect) => {
  if (!confirm(`Convert "${p.company_name}" to a Lead? This will mark it as converted.`)) return;
  try {
    const res = await api.post(`/prospects/${p.id}/convert-to-lead`);
    showToast('success', `✅ ${p.company_name} converted to Lead! (Lead #${res.data.data?.lead_id || ''})`);
    fetchProspects();
    fetchStats();
  } catch (e: any) {
    showToast('error', e.response?.data?.error || 'Failed to convert');
  }
};

const batchConvertToLeads = async () => {
  const count = selectedProspects.value.length;
  if (count === 0) return;
  if (!confirm(`Convert ${count} prospect(s) to Leads?\n\nThis will create Lead records for each selected prospect.`)) return;
  
  let success = 0;
  let failed = 0;
  const results: string[] = [];
  
  for (const id of selectedProspects.value) {
    const prospect = prospects.value.find(p => p.id === id);
    try {
      const res = await api.post(`/prospects/${id}/convert-to-lead`);
      success++;
      results.push(`✅ ${prospect?.company_name || id} → Lead #${res.data.data?.lead_id || ''}`);
    } catch (e: any) {
      failed++;
      results.push(`❌ ${prospect?.company_name || id}: ${e.response?.data?.error || 'Failed'}`);
    }
  }
  
  selectedProspects.value = [];
  await fetchProspects();
  await fetchStats();
  
  const msg = `Batch conversion complete!\n${success} converted, ${failed} failed.\n\n${results.join('\n')}`;
  alert(msg);
  showToast('success', `${success} prospects converted to leads!`);
};

const toggleSelectAll = () => {
  const convertable = prospects.value.filter(p => p.status === 'qualified');
  if (allSelected.value) {
    selectedProspects.value = [];
  } else {
    selectedProspects.value = convertable.map(p => p.id);
  }
};

const goToPage = (pg: number) => { currentPage.value = pg; fetchProspects(); };

onMounted(() => { fetchProspects(); fetchStats(); });
</script>

<style scoped>
@keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.animate-fade-in { animation: fade-in 0.2s ease-out; }
</style>
