<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Cash Advances (Kasbon)</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Track salary advance requests and repayments for payroll deduction.</p>
      </div>
      <button @click="openAddModal" class="flex items-center gap-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md transition-all cursor-pointer">
        <span class="text-lg">+</span> New Kasbon
      </button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Outstanding</p>
          <p class="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{{ fmtRp(totalOutstanding) }}</p>
        </div>
        <span class="text-3xl bg-rose-50 dark:bg-rose-900/30 p-3 rounded-2xl">💸</span>
      </div>
      <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pending Approval</p>
          <p class="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{{ pendingCount }}</p>
        </div>
        <span class="text-3xl bg-amber-50 dark:bg-amber-900/30 p-3 rounded-2xl">⏳</span>
      </div>
      <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Paid Off</p>
          <p class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{{ paidCount }}</p>
        </div>
        <span class="text-3xl bg-emerald-50 dark:bg-emerald-900/30 p-3 rounded-2xl">✅</span>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div class="p-6 border-b border-gray-100 dark:border-gray-700">
        <div class="relative w-full md:w-80">
          <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">🔍</span>
          <input v-model="searchQuery" type="text" placeholder="Search employee..." class="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 dark:text-white" />
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-gray-50 dark:bg-gray-750 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
              <th class="px-6 py-4">Date</th>
              <th class="px-6 py-4">Employee</th>
              <th class="px-6 py-4 text-right">Amount</th>
              <th class="px-6 py-4 text-right">Remaining</th>
              <th class="px-6 py-4">Deduction Type</th>
              <th class="px-6 py-4">Status</th>
              <th class="px-6 py-4">Reason</th>
              <th class="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700 text-sm text-gray-700 dark:text-gray-300">
            <tr v-for="k in filteredKasbon" :key="k.id" class="hover:bg-gray-50 dark:hover:bg-gray-750/30 transition-colors">
              <td class="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">{{ formatDate(k.advance_date || k.created_at) }}</td>
              <td class="px-6 py-4">
                <p class="font-medium text-gray-900 dark:text-white">{{ k.employee_name }}</p>
              </td>
              <td class="px-6 py-4 text-right font-bold text-rose-600 dark:text-rose-400">{{ fmtRp(k.amount) }}</td>
              <td class="px-6 py-4 text-right font-bold" :class="k.remaining_balance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'">{{ fmtRp(k.remaining_balance) }}</td>
              <td class="px-6 py-4 text-xs">{{ k.deduction_type || 'full' }}</td>
              <td class="px-6 py-4">
                <span :class="['px-2.5 py-1 rounded-full text-xs font-semibold border', statusClass(k.status)]">{{ k.status }}</span>
              </td>
              <td class="px-6 py-4 text-xs text-gray-500 max-w-[150px] truncate">{{ k.reason || '-' }}</td>
              <td class="px-6 py-4 text-right">
                <div class="flex gap-1 justify-end">
                  <button v-if="k.status === 'pending'" @click="approveKasbon(k.id)" class="p-1.5 hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 rounded-lg cursor-pointer" title="Approve">✅</button>
                  <button v-if="k.status === 'pending'" @click="rejectKasbon(k.id)" class="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-600 rounded-lg cursor-pointer" title="Reject">❌</button>
                  <button @click="deleteKasbon(k.id)" class="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-rose-600 rounded-lg cursor-pointer" title="Delete">🗑️</button>
                </div>
              </td>
            </tr>
            <tr v-if="filteredKasbon.length === 0">
              <td colspan="8" class="px-6 py-12 text-center text-gray-400 dark:text-gray-500">No cash advances found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 dark:border-gray-700">
        <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h3 class="text-xl font-bold text-gray-900 dark:text-white">New Kasbon</h3>
          <button @click="closeModal" class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg cursor-pointer">✕</button>
        </div>
        <form @submit.prevent="saveKasbon" class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Employee *</label>
            <select v-model="form.employee_id" required class="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-750 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500">
              <option value="">Select employee</option>
              <option v-for="e in allEmployees" :key="e.id" :value="e.id">{{ e.employee_code }} - {{ e.first_name }}</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Amount *</label>
              <input v-model.number="form.amount" type="number" required class="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-750 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Date</label>
              <input v-model="form.advance_date" type="date" class="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-750 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Deduction Type</label>
            <select v-model="form.deduction_type" class="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-750 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500">
              <option value="full">Full (Potong langsung)</option>
              <option value="installment">Installment (Cicilan)</option>
            </select>
          </div>
          <div v-if="form.deduction_type === 'installment'">
            <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Installment Months</label>
            <input v-model.number="form.installment_months" type="number" min="2" class="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-750 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500" />
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Reason</label>
            <textarea v-model="form.reason" rows="2" placeholder="Reason for advance..." class="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-750 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"></textarea>
          </div>
          <div class="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button type="button" @click="closeModal" class="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-650 text-gray-700 dark:text-gray-200 py-3 rounded-xl font-bold transition-colors cursor-pointer">Cancel</button>
            <button type="submit" class="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-xl font-bold shadow-md transition-colors cursor-pointer">Save Kasbon</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../../lib/api';

const kasbons = ref<any[]>([]);
const allEmployees = ref<any[]>([]);
const searchQuery = ref('');
const showModal = ref(false);

const defaultForm = () => ({ employee_id: '', amount: 0, advance_date: new Date().toISOString().slice(0, 10), deduction_type: 'full', installment_months: 3, reason: '' });
const form = ref(defaultForm());

const totalOutstanding = computed(() => kasbons.value.filter(k => k.status === 'approved').reduce((s, k) => s + parseFloat(k.remaining_balance || 0), 0));
const pendingCount = computed(() => kasbons.value.filter(k => k.status === 'pending').length);
const paidCount = computed(() => kasbons.value.filter(k => k.status === 'paid').length);

const filteredKasbon = computed(() => {
  const q = searchQuery.value.toLowerCase();
  return kasbons.value.filter(k => !q || k.employee_name?.toLowerCase().includes(q));
});

const fmtRp = (v: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);
const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

const statusClass = (s: string) => {
  const map: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400',
    approved: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400',
    paid: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400',
    rejected: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400',
  };
  return map[s] || map['pending'];
};

const fetchKasbon = async () => {
  try { const res = await api.get('/hr/salary-advances'); kasbons.value = res.data?.data || []; } catch (err) { console.error(err); }
};
const fetchEmployees = async () => {
  try { const res = await api.get('/hr/employees'); allEmployees.value = res.data?.data || []; } catch (err) { console.error(err); }
};

const openAddModal = () => { form.value = defaultForm(); showModal.value = true; };
const closeModal = () => { showModal.value = false; };

const saveKasbon = async () => {
  try {
    await api.post('/hr/salary-advances', form.value);
    await fetchKasbon(); closeModal();
  } catch (err: any) { alert(err.response?.data?.error || 'Failed to save kasbon'); }
};

const approveKasbon = async (id: number) => {
  try { await api.put(`/hr/salary-advances/${id}/approve`); await fetchKasbon(); } catch { alert('Failed to approve'); }
};
const rejectKasbon = async (id: number) => {
  try { await api.put(`/hr/salary-advances/${id}/reject`); await fetchKasbon(); } catch { alert('Failed to reject'); }
};
const deleteKasbon = async (id: number) => {
  if (!confirm('Delete this kasbon record?')) return;
  try { await api.delete(`/hr/salary-advances/${id}`); await fetchKasbon(); } catch { alert('Failed to delete'); }
};

onMounted(() => { fetchKasbon(); fetchEmployees(); });
</script>
