<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Payroll Workspace</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Trace payroll from attendance, approved requests, overtime, salary advances, and saved payslips.</p>
      </div>
    </div>

    <!-- Period Selector & Calculate -->
    <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4 items-center justify-between">
      <div class="flex items-center gap-3">
        <label class="text-sm font-bold text-gray-600 dark:text-gray-400">Period:</label>
        <select v-model="periodMonth" class="bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option v-for="m in 12" :key="m" :value="m">{{ monthNames[m - 1] }}</option>
        </select>
        <select v-model="periodYear" class="bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
        </select>
      </div>
      <div class="flex gap-3">
        <button @click="calculatePayroll" class="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md transition-all cursor-pointer">
          🧮 Calculate from Attendance
        </button>
        <button v-if="payslips.length > 0" @click="saveAllPayslips" class="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md transition-all cursor-pointer">
          💾 Save All Payslips
        </button>
        <button v-if="savedPayslips.length > 0" @click="submitPayrollRequest" class="bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md transition-all cursor-pointer">
          📤 Submit Payroll Request
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="bg-white dark:bg-gray-800 p-12 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 text-center">
      <p class="text-gray-500 dark:text-gray-400 text-lg">⏳ Calculating payroll...</p>
    </div>

    <!-- Payslip Results -->
    <div v-if="payslips.length > 0 && !loading" class="space-y-4">
      <!-- Summary -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div>
            <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Employees</p>
            <p class="text-3xl font-bold text-gray-900 dark:text-white mt-1">{{ payslips.length }}</p>
          </div>
          <span class="text-3xl bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-2xl">👥</span>
        </div>
        <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div>
            <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Total Gross</p>
            <p class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{{ fmtRp(totalGross) }}</p>
          </div>
          <span class="text-3xl bg-emerald-50 dark:bg-emerald-900/30 p-3 rounded-2xl">💰</span>
        </div>
        <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div>
            <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Total Deductions</p>
            <p class="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{{ fmtRp(totalDeductions) }}</p>
          </div>
          <span class="text-3xl bg-rose-50 dark:bg-rose-900/30 p-3 rounded-2xl">📉</span>
        </div>
        <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div>
            <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Total Net Pay</p>
            <p class="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{{ fmtRp(totalNet) }}</p>
          </div>
          <span class="text-3xl bg-blue-50 dark:bg-blue-900/30 p-3 rounded-2xl">🏦</span>
        </div>
      </div>

      <!-- Payslip Table -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-gray-50 dark:bg-gray-750 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th class="px-5 py-4">Employee</th>
                <th class="px-5 py-4">Type</th>
                <th class="px-5 py-4 text-center">Payable Days</th>
                <th class="px-5 py-4 text-center">Trace</th>
                <th class="px-5 py-4 text-center">OT</th>
                <th class="px-5 py-4 text-right">Basic Pay</th>
                <th class="px-5 py-4 text-right">Allowance</th>
                <th class="px-5 py-4 text-right">OT Pay</th>
                <th class="px-5 py-4 text-right">Gross</th>
                <th class="px-5 py-4 text-right">Deduction</th>
                <th class="px-5 py-4 text-right font-bold">Net Pay</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700 text-sm text-gray-700 dark:text-gray-300">
              <tr v-for="ps in payslips" :key="ps.employee_id" class="hover:bg-gray-50 dark:hover:bg-gray-750/30 transition-colors">
                <td class="px-5 py-4">
                  <p class="font-semibold text-gray-900 dark:text-white">{{ ps.employee_name }}</p>
                  <p class="text-xs text-gray-500">{{ ps.employee_code }}</p>
                </td>
                <td class="px-5 py-4">
                  <span :class="['px-2 py-0.5 rounded-full text-xs font-semibold', ps.salary_type === 'monthly' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400']">
                    {{ ps.salary_type === 'monthly' ? 'Bulanan' : 'Harian' }}
                  </span>
                </td>
                <td class="px-5 py-4 text-center font-bold">{{ ps.working_days }}</td>
                <td class="px-5 py-4 text-center">
                  <div class="flex flex-wrap justify-center gap-1 text-[11px] font-bold">
                    <span class="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">Covered {{ ps.covered_days || ps.trace?.covered_days || 0 }}</span>
                    <span class="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700">Absent {{ ps.absent_days || ps.trace?.absent_days || 0 }}</span>
                  </div>
                </td>
                <td class="px-5 py-4 text-center">{{ ps.total_overtime > 0 ? ps.total_overtime : '-' }}</td>
                <td class="px-5 py-4 text-right">{{ fmtRp(ps.basic_pay) }}</td>
                <td class="px-5 py-4 text-right text-gray-500">{{ fmtRp(ps.allowance_pay) }}</td>
                <td class="px-5 py-4 text-right text-amber-600 dark:text-amber-400">{{ fmtRp(ps.overtime_pay) }}</td>
                <td class="px-5 py-4 text-right font-bold text-emerald-600 dark:text-emerald-400">{{ fmtRp(ps.gross_salary) }}</td>
                <td class="px-5 py-4 text-right text-rose-600 dark:text-rose-400">{{ ps.Deduction_deduction > 0 ? fmtRp(ps.Deduction_deduction) : '-' }}</td>
                <td class="px-5 py-4 text-right font-bold text-lg text-blue-700 dark:text-blue-400">{{ fmtRp(ps.net_salary) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Saved Payslips -->
    <div v-if="savedPayslips.length > 0 && payslips.length === 0" class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div class="p-6 border-b border-gray-100 dark:border-gray-700">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white">💾 Saved Payslips for {{ monthNames[periodMonth - 1] }} {{ periodYear }}</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-gray-50 dark:bg-gray-750 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
              <th class="px-6 py-4">Employee</th>
              <th class="px-6 py-4 text-right">Gross</th>
              <th class="px-6 py-4 text-right">Deductions</th>
              <th class="px-6 py-4 text-right">Net Pay</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700 text-sm text-gray-700 dark:text-gray-300">
            <tr v-for="sp in savedPayslips" :key="sp.id" class="hover:bg-gray-50 dark:hover:bg-gray-750/30 transition-colors">
              <td class="px-6 py-4 font-medium text-gray-900 dark:text-white">{{ sp.employee_name }}</td>
              <td class="px-6 py-4 text-right">{{ fmtRp(sp.gross_salary) }}</td>
              <td class="px-6 py-4 text-right text-rose-600 dark:text-rose-400">{{ fmtRp(sp.total_deductions) }}</td>
              <td class="px-6 py-4 text-right font-bold text-blue-700 dark:text-blue-400">{{ fmtRp(sp.net_salary) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Payroll Requests -->
    <div v-if="payrollRequests.length > 0" class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div class="p-6 border-b border-gray-100 dark:border-gray-700">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white">📤 Payroll Requests</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-gray-50 dark:bg-gray-750 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
              <th class="px-6 py-4">No.</th>
              <th class="px-6 py-4">Period</th>
              <th class="px-6 py-4 text-center">Employees</th>
              <th class="px-6 py-4 text-right">Total</th>
              <th class="px-6 py-4">Status</th>
              <th class="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700 text-sm text-gray-700 dark:text-gray-300">
            <tr v-for="pr in payrollRequests" :key="pr.id" class="hover:bg-gray-50 dark:hover:bg-gray-750/30 transition-colors">
              <td class="px-6 py-4 font-mono text-xs font-bold text-gray-900 dark:text-white">{{ pr.request_number }}</td>
              <td class="px-6 py-4">{{ monthNames[(pr.period_month || 1) - 1] }} {{ pr.period_year }}</td>
              <td class="px-6 py-4 text-center">{{ pr.employee_count || pr.item_count }}</td>
              <td class="px-6 py-4 text-right font-bold text-blue-600 dark:text-blue-400">{{ fmtRp(pr.total_amount) }}</td>
              <td class="px-6 py-4">
                <span :class="['px-2.5 py-1 rounded-full text-xs font-semibold border', prStatusClass(pr.status)]">{{ pr.status }}</span>
              </td>
              <td class="px-6 py-4 text-right">
                <div class="flex gap-1 justify-end">
                  <button v-if="pr.status === 'draft'" @click="submitPR(pr.id)" class="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 rounded-lg cursor-pointer" title="Submit">📤</button>
                  <button v-if="pr.status === 'submitted'" @click="approvePR(pr.id)" class="p-1.5 hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 rounded-lg cursor-pointer" title="Approve">✅</button>
                  <button v-if="['draft','rejected'].includes(pr.status)" @click="deletePR(pr.id)" class="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-600 rounded-lg cursor-pointer" title="Delete">🗑️</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../../lib/api';

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const now = new Date();
const periodMonth = ref(now.getMonth() + 1);
const periodYear = ref(now.getFullYear());
const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

const payslips = ref<any[]>([]);
const savedPayslips = ref<any[]>([]);
const payrollRequests = ref<any[]>([]);
const loading = ref(false);

const totalGross = computed(() => payslips.value.reduce((s, p) => s + (p.gross_salary || 0), 0));
const totalDeductions = computed(() => payslips.value.reduce((s, p) => s + (p.Deduction_deduction || 0), 0));
const totalNet = computed(() => payslips.value.reduce((s, p) => s + (p.net_salary || 0), 0));

const fmtRp = (v: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);

const calculatePayroll = async () => {
  loading.value = true;
  try {
    const res = await api.get(`/hr/payslips/calculate?month=${periodMonth.value}&year=${periodYear.value}`);
    payslips.value = res.data?.data || [];
  } catch (err: any) {
    alert(err.response?.data?.error || 'Failed to calculate payroll');
    payslips.value = [];
  } finally { loading.value = false; }
};

const saveAllPayslips = async () => {
  try {
    const res = await api.post('/hr/payslips/save', {
      period_month: periodMonth.value,
      period_year: periodYear.value,
      payslips: payslips.value,
    });
    alert(res.data?.message || 'Payslips saved successfully');
    payslips.value = [];
    await fetchSavedPayslips();
  } catch (err: any) { alert(err.response?.data?.error || 'Failed to save payslips'); }
};

const fetchSavedPayslips = async () => {
  try {
    const res = await api.get(`/hr/payslips?month=${periodMonth.value}&year=${periodYear.value}`);
    savedPayslips.value = res.data?.data || [];
  } catch { savedPayslips.value = []; }
};

const fetchPayrollRequests = async () => {
  try {
    const res = await api.get('/hr/payroll-requests');
    payrollRequests.value = res.data?.data || [];
  } catch { payrollRequests.value = []; }
};

const submitPayrollRequest = async () => {
  try {
    const res = await api.post('/hr/payroll-requests', {
      period_month: periodMonth.value,
      period_year: periodYear.value,
    });
    alert(res.data?.message || 'Payroll request created');
    await fetchPayrollRequests();
  } catch (err: any) { alert(err.response?.data?.error || 'Failed to create payroll request'); }
};

const submitPR = async (id: number) => {
  try { await api.put(`/hr/payroll-requests/${id}/submit`); await fetchPayrollRequests(); } catch (err: any) { alert(err.response?.data?.error || 'Failed'); }
};
const approvePR = async (id: number) => {
  try { await api.put(`/hr/payroll-requests/${id}/approve`); await fetchPayrollRequests(); } catch (err: any) { alert(err.response?.data?.error || 'Failed'); }
};
const deletePR = async (id: number) => {
  if (!confirm('Delete this payroll request?')) return;
  try { await api.delete(`/hr/payroll-requests/${id}`); await fetchPayrollRequests(); } catch { alert('Failed'); }
};

const prStatusClass = (s: string) => {
  const map: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700/30 dark:text-gray-400',
    submitted: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400',
    rejected: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400',
  };
  return map[s] || map['draft'];
};

onMounted(() => { fetchSavedPayslips(); fetchPayrollRequests(); });
</script>
