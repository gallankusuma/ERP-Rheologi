<template>
  <div class="space-y-6">
    <section class="rounded-3xl border border-violet-100 bg-gradient-to-br from-slate-950 via-violet-950 to-emerald-900 p-6 text-white shadow-xl">
      <div class="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.35em] text-violet-200">HR Request Center</p>
          <h1 class="mt-2 text-3xl font-black">Leave, Permit, Sick, Medical & SPD</h1>
          <p class="mt-2 max-w-2xl text-sm text-violet-50/80">
            Satu meja kontrol untuk alasan resmi attendance exception, approval personalia, medical expense, dan perjalanan dinas.
          </p>
        </div>
        <button @click="openModal" class="rounded-2xl bg-white px-5 py-3 text-sm font-black text-violet-900 shadow-lg transition hover:-translate-y-0.5 hover:bg-violet-50">
          + Create Request
        </button>
      </div>

      <div class="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <div v-for="stat in stats" :key="stat.label" class="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
          <p class="text-xs uppercase tracking-wider text-violet-100/70">{{ stat.label }}</p>
          <p class="mt-1 text-2xl font-black">{{ stat.value }}</p>
          <p class="mt-1 text-xs text-violet-50/70">{{ stat.caption }}</p>
        </div>
      </div>
    </section>

    <section class="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div class="grid grid-cols-2 gap-2 md:grid-cols-4">
          <select v-model="filterStatus" class="filter-select">
            <option value="">All Status</option>
            <option value="submitted">Submitted</option>
            <option value="in_review">In Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="paid">Paid</option>
          </select>
          <select v-model="filterType" class="filter-select">
            <option value="">All Type</option>
            <option value="leave">Leave</option>
            <option value="permission">Permit</option>
            <option value="medical">Medical</option>
            <option value="business_trip">SPD</option>
          </select>
          <select v-model.number="filterYear" class="filter-select">
            <option v-for="year in yearOptions" :key="year" :value="year">{{ year }}</option>
          </select>
          <button @click="load" class="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white hover:bg-violet-700">Load</button>
        </div>
        <div class="relative w-full lg:w-96">
          <span class="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400">🔎</span>
          <input v-model="searchQuery" type="text" placeholder="Search employee, request number, reason..." class="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
        </div>
      </div>
    </section>

    <section class="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div class="rounded-3xl border border-amber-100 bg-amber-50 p-5 dark:border-amber-900/30 dark:bg-amber-950/20">
        <p class="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Approval Queue</p>
        <h2 class="mt-1 text-xl font-black text-gray-900 dark:text-white">{{ pendingRequests.length }} waiting decision</h2>
        <div class="mt-4 max-h-[580px] space-y-3 overflow-y-auto pr-1">
          <article v-for="req in pendingRequests.slice(0, 15)" :key="req.id" class="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-800">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="font-black text-gray-900 dark:text-white">{{ req.employee_name || '-' }}</p>
                <p class="text-xs text-gray-500">{{ req.request_number }}</p>
              </div>
              <span :class="['rounded-full px-2.5 py-1 text-xs font-black', typeClass(req.request_type)]">{{ typeLabel(req.request_type) }}</span>
            </div>
            <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">{{ req.reason }}</p>
            <div class="mt-3 flex gap-2">
              <button @click="approve(req)" class="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700">Approve</button>
              <button @click="reject(req)" class="flex-1 rounded-xl bg-rose-600 px-3 py-2 text-xs font-black text-white hover:bg-rose-700">Reject</button>
            </div>
          </article>
          <p v-if="pendingRequests.length === 0" class="rounded-2xl bg-white p-4 text-sm font-bold text-emerald-700 dark:bg-gray-800">No pending request.</p>
        </div>
      </div>

      <div class="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 xl:col-span-2">
        <div class="border-b border-gray-100 p-5 dark:border-gray-700">
          <p class="text-xs font-bold uppercase tracking-wider text-violet-600">Request Ledger</p>
          <h2 class="text-xl font-black text-gray-900 dark:text-white">All HR Requests</h2>
        </div>
        <div v-if="loading" class="py-16 text-center text-gray-500">Loading request center...</div>
        <div v-else class="max-h-[720px] overflow-auto">
          <table class="w-full min-w-[1040px] text-left text-sm">
            <thead class="sticky top-0 z-10 border-b border-gray-100 bg-gray-50 text-xs font-black uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-700">
              <tr>
                <th class="px-5 py-4">Request</th>
                <th class="px-5 py-4">Employee</th>
                <th class="px-5 py-4">Period / Amount</th>
                <th class="px-5 py-4">Reason</th>
                <th class="px-5 py-4">Status</th>
                <th class="px-5 py-4">Decision</th>
                <th class="px-5 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-for="req in filteredRequests" :key="req.id" class="hover:bg-violet-50/40 dark:hover:bg-violet-950/10">
                <td class="px-5 py-4">
                  <span :class="['rounded-full px-2.5 py-1 text-xs font-black', typeClass(req.request_type)]">{{ typeLabel(req.request_type) }}</span>
                  <p class="mt-2 font-black text-gray-900 dark:text-white">{{ req.request_number }}</p>
                  <p class="text-xs text-gray-500">{{ formatDate(req.submitted_at) }}</p>
                </td>
                <td class="px-5 py-4">
                  <p class="font-black text-gray-900 dark:text-white">{{ req.employee_name || '-' }}</p>
                  <p class="text-xs text-gray-500">{{ req.employee_code || '-' }} · {{ req.department_name || '-' }}</p>
                </td>
                <td class="px-5 py-4">
                  <p class="font-bold text-gray-900 dark:text-white">{{ periodLabel(req) }}</p>
                  <p class="text-xs text-gray-500">{{ req.destination || amountLabel(req) }}</p>
                </td>
                <td class="max-w-[240px] px-5 py-4">
                  <p class="line-clamp-2 text-sm text-gray-700 dark:text-gray-300">{{ req.reason }}</p>
                  <p v-if="req.notes" class="mt-1 line-clamp-1 text-xs text-gray-500">{{ req.notes }}</p>
                </td>
                <td class="px-5 py-4">
                  <span :class="['rounded-full px-3 py-1 text-xs font-black', statusClass(req.status)]">{{ statusLabel(req.status) }}</span>
                </td>
                <td class="px-5 py-4">
                  <p class="text-xs text-gray-500">{{ req.approver_name || '-' }}</p>
                  <p class="text-xs text-gray-400">{{ req.decided_at ? formatDate(req.decided_at) : '-' }}</p>
                </td>
                <td class="px-5 py-4 text-right">
                  <div v-if="canDecide(req)" class="flex justify-end gap-2">
                    <button @click="approve(req)" class="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100">Approve</button>
                    <button @click="reject(req)" class="rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-100">Reject</button>
                  </div>
                  <span v-else class="text-xs font-bold text-gray-400">Closed</span>
                </td>
              </tr>
              <tr v-if="filteredRequests.length === 0">
                <td colspan="7" class="px-5 py-16 text-center text-gray-400">No requests found.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div class="w-full max-w-2xl rounded-3xl border border-gray-100 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800">
        <div class="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-700">
          <h3 class="text-xl font-black text-gray-900 dark:text-white">Create HR Request</h3>
          <button @click="closeModal" class="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700">✕</button>
        </div>
        <form @submit.prevent="saveRequest" class="space-y-4 p-6">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label class="field">Employee
              <select v-model="form.employee_id" required class="input">
                <option value="">Select employee</option>
                <option v-for="emp in employees" :key="emp.id" :value="emp.id">{{ emp.employee_code || emp.code }} - {{ emp.first_name || emp.name }}</option>
              </select>
            </label>
            <label class="field">Type
              <select v-model="form.request_type" required class="input">
                <option value="leave">Leave</option>
                <option value="permission">Permit</option>
                <option value="medical">Medical</option>
                <option value="business_trip">SPD</option>
              </select>
            </label>
            <label v-if="form.request_type !== 'medical'" class="field">Start Date<input v-model="form.start_date" type="date" class="input" /></label>
            <label v-if="form.request_type !== 'medical'" class="field">End Date<input v-model="form.end_date" type="date" class="input" /></label>
            <label v-if="form.request_type === 'medical'" class="field">Amount<input v-model.number="form.amount" type="number" min="0" class="input" /></label>
            <label v-if="form.request_type === 'business_trip'" class="field">Destination<input v-model="form.destination" class="input" /></label>
          </div>
          <label class="field">Reason<textarea v-model="form.reason" required rows="3" class="input" placeholder="Reason / purpose"></textarea></label>
          <label class="field">Notes<textarea v-model="form.notes" rows="2" class="input" placeholder="Optional notes"></textarea></label>
          <div class="flex gap-3 border-t border-gray-100 pt-4 dark:border-gray-700">
            <button type="button" @click="closeModal" class="flex-1 rounded-2xl bg-gray-100 py-3 font-black text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200">Cancel</button>
            <button type="submit" class="flex-1 rounded-2xl bg-violet-600 py-3 font-black text-white hover:bg-violet-700">Submit</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../../lib/api';

const now = new Date();
const filterYear = ref(now.getFullYear());
const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);
const filterStatus = ref('');
const filterType = ref('');
const searchQuery = ref('');
const loading = ref(false);
const requests = ref<any[]>([]);
const summary = ref<any>(null);
const employees = ref<any[]>([]);
const showModal = ref(false);

const defaultForm = () => ({
  employee_id: '',
  request_type: 'leave',
  start_date: new Date().toISOString().slice(0, 10),
  end_date: new Date().toISOString().slice(0, 10),
  amount: 0,
  destination: '',
  reason: '',
  notes: '',
});
const form = ref(defaultForm());

const pendingRequests = computed(() => requests.value.filter(req => ['submitted', 'in_review'].includes(String(req.status))));
const filteredRequests = computed(() => {
  const q = searchQuery.value.toLowerCase();
  return requests.value.filter(req => !q || [req.employee_name, req.employee_code, req.request_number, req.reason, req.department_name].some(v => String(v || '').toLowerCase().includes(q)));
});

const stats = computed(() => {
  const rows = summary.value?.requests || [];
  const count = (type: string, statuses?: string[]) => rows
    .filter((row: any) => row.request_type === type && (!statuses || statuses.includes(row.status)))
    .reduce((sum: number, row: any) => sum + Number(row.count || 0), 0);
  const pending = rows.filter((row: any) => ['submitted', 'in_review'].includes(row.status)).reduce((sum: number, row: any) => sum + Number(row.count || 0), 0);
  return [
    { label: 'Pending', value: pending, caption: 'need decision' },
    { label: 'Leave', value: count('leave'), caption: 'annual/other leave' },
    { label: 'Permit', value: count('permission'), caption: 'izin personal' },
    { label: 'Medical', value: count('medical'), caption: 'expense claim' },
    { label: 'SPD', value: count('business_trip'), caption: 'business trip' },
  ];
});

const load = async () => {
  loading.value = true;
  try {
    const [requestRes, summaryRes] = await Promise.all([
      api.get(`/hr/requests?year=${filterYear.value}&status=${filterStatus.value}&type=${filterType.value}`),
      api.get('/hr/requests/summary'),
    ]);
    requests.value = requestRes.data?.data || [];
    summary.value = summaryRes.data?.data || null;
  } catch (error) {
    console.error('Failed to load HR requests', error);
    requests.value = [];
  } finally {
    loading.value = false;
  }
};

const fetchEmployees = async () => {
  try {
    const res = await api.get('/hr/employees');
    employees.value = res.data?.data || [];
  } catch (error) {
    console.error(error);
  }
};

const openModal = () => {
  form.value = defaultForm();
  showModal.value = true;
};
const closeModal = () => {
  showModal.value = false;
};

const saveRequest = async () => {
  try {
    await api.post('/hr/requests', { ...form.value, employee_id: Number(form.value.employee_id) });
    closeModal();
    await load();
  } catch (error: any) {
    alert(error.response?.data?.error || 'Failed to create HR request');
  }
};

const approve = async (req: any) => {
  const notes = prompt('Approval notes (optional):') || '';
  try {
    await api.put(`/hr/requests/${req.id}/approve`, { decision_notes: notes });
    await load();
  } catch (error: any) {
    alert(error.response?.data?.error || 'Failed to approve');
  }
};

const reject = async (req: any) => {
  const notes = prompt('Reject reason:');
  if (notes === null) return;
  try {
    await api.put(`/hr/requests/${req.id}/reject`, { decision_notes: notes });
    await load();
  } catch (error: any) {
    alert(error.response?.data?.error || 'Failed to reject');
  }
};

const canDecide = (req: any) => ['submitted', 'in_review'].includes(String(req.status));
const formatDate = (value?: string) => value ? new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const amountLabel = (req: any) => req.amount ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(req.amount) : `${Number(req.requested_days || 0)} day(s)`;
const periodLabel = (req: any) => req.request_type === 'medical' ? amountLabel(req) : `${formatDate(req.start_date)} - ${formatDate(req.end_date)}`;
const statusLabel = (value: string) => String(value || '-').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const typeLabel = (value: string) => ({ leave: 'Leave', permission: 'Permit', medical: 'Medical', business_trip: 'SPD' }[value] || value);
const typeClass = (value: string) => ({
  leave: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300',
  permission: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/30 dark:text-sky-300',
  medical: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/30 dark:text-rose-300',
  business_trip: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-950/30 dark:text-violet-300',
}[value] || 'bg-gray-100 text-gray-700');
const statusClass = (value: string) => ({
  submitted: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300',
  in_review: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/30 dark:text-blue-300',
  approved: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300',
  rejected: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/30 dark:text-rose-300',
  paid: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-700 dark:text-slate-200',
}[value] || 'bg-gray-100 text-gray-700');

onMounted(() => {
  load();
  fetchEmployees();
});
</script>

<style scoped>
.filter-select {
  @apply rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white;
}
.field {
  @apply block text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400;
}
.input {
  @apply mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm normal-case tracking-normal text-gray-900 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white;
}
</style>
