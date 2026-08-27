<template>
  <div class="space-y-6">
    <section class="rounded-3xl border border-sky-100 bg-gradient-to-br from-slate-950 via-sky-950 to-teal-900 p-6 text-white shadow-xl">
      <div class="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.35em] text-sky-200">Timekeeping Control</p>
          <h1 class="mt-2 text-3xl font-black">Attendance Monitor</h1>
          <p class="mt-2 max-w-2xl text-sm text-sky-50/80">
            Pantau planned roster vs actual attendance, missing punch, absent, off-day work, GPS, timesheet, dan overtime.
          </p>
        </div>
        <button @click="openAddModal" class="rounded-2xl bg-white px-5 py-3 text-sm font-black text-sky-900 shadow-lg transition hover:-translate-y-0.5 hover:bg-sky-50">
          + Log Attendance
        </button>
      </div>

      <div class="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <div v-for="stat in stats" :key="stat.label" class="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
          <p class="text-xs uppercase tracking-wider text-sky-100/70">{{ stat.label }}</p>
          <p class="mt-1 text-2xl font-black">{{ stat.value }}</p>
          <p class="mt-1 text-xs text-sky-50/70">{{ stat.caption }}</p>
        </div>
      </div>
    </section>

    <section class="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div class="grid grid-cols-2 gap-2 md:grid-cols-5">
          <select v-model.number="filterMonth" class="filter-select">
            <option v-for="m in 12" :key="m" :value="m">{{ monthNames[m - 1] }}</option>
          </select>
          <select v-model.number="filterYear" class="filter-select">
            <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
          </select>
          <select v-model="filterException" class="filter-select">
            <option value="">All Status</option>
            <option value="exception">Exceptions</option>
            <option value="covered">Covered</option>
            <option value="missing_attendance">Missing</option>
            <option value="absent">Absent</option>
            <option value="worked_on_off_day">Off-day Work</option>
          </select>
          <select v-model="filterShift" class="filter-select">
            <option value="">All Shift</option>
            <option value="S1">S1</option>
            <option value="S2">S2</option>
            <option value="S3">S3</option>
            <option value="OFF">OFF</option>
            <option value="REG">REG</option>
          </select>
          <button @click="load" class="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-black text-white hover:bg-sky-700">Load</button>
        </div>
        <div class="relative w-full lg:w-96">
          <span class="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400">🔎</span>
          <input v-model="searchQuery" type="text" placeholder="Search employee, code, department..." class="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
        </div>
      </div>
    </section>

    <section class="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div class="rounded-3xl border border-rose-100 bg-rose-50 p-5 dark:border-rose-900/30 dark:bg-rose-950/20 xl:col-span-1">
        <p class="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">Exception Queue</p>
        <h2 class="mt-1 text-xl font-black text-gray-900 dark:text-white">{{ exceptionRows.length }} open issues</h2>
        <div class="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
          <div v-for="row in exceptionRows.slice(0, 20)" :key="`${row.date}-${row.employee_id}`" class="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-800">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="font-black text-gray-900 dark:text-white">{{ row.employee_name }}</p>
                <p class="text-xs text-gray-500">{{ row.employee_code }} · {{ formatDate(row.date) }}</p>
              </div>
              <span :class="['rounded-full px-2.5 py-1 text-xs font-black', exceptionClass(row.exception)]">{{ exceptionLabel(row.exception) }}</span>
            </div>
            <p class="mt-2 text-xs text-gray-500">Plan {{ row.planned_shift_code }} · Actual {{ row.status }}</p>
          </div>
          <p v-if="exceptionRows.length === 0" class="rounded-2xl bg-white p-4 text-sm font-bold text-emerald-700 dark:bg-gray-800">No open exception. Cakep bro.</p>
        </div>
      </div>

      <div class="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 xl:col-span-2">
        <div class="border-b border-gray-100 p-5 dark:border-gray-700">
          <p class="text-xs font-bold uppercase tracking-wider text-sky-600">Roster vs Actual</p>
          <h2 class="text-xl font-black text-gray-900 dark:text-white">Daily Timekeeping Matrix</h2>
        </div>
        <div v-if="loading" class="py-16 text-center text-gray-500">Loading attendance monitor...</div>
        <div v-else class="max-h-[720px] overflow-auto">
          <table class="w-full min-w-[980px] text-left text-sm">
            <thead class="sticky top-0 z-10 border-b border-gray-100 bg-gray-50 text-xs font-black uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-700">
              <tr>
                <th class="px-5 py-4">Date</th>
                <th class="px-5 py-4">Employee</th>
                <th class="px-5 py-4">Plan</th>
                <th class="px-5 py-4">Actual</th>
                <th class="px-5 py-4">Punch</th>
                <th class="px-5 py-4 text-center">TS</th>
                <th class="px-5 py-4 text-center">OT</th>
                <th class="px-5 py-4">Exception</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-for="row in filteredRows" :key="`${row.date}-${row.employee_id}`" class="hover:bg-sky-50/40 dark:hover:bg-sky-950/10">
                <td class="px-5 py-4 font-bold text-gray-900 dark:text-white">{{ formatDate(row.date) }}</td>
                <td class="px-5 py-4">
                  <p class="font-black text-gray-900 dark:text-white">{{ row.employee_name }}</p>
                  <p class="text-xs text-gray-500">{{ row.employee_code }} · {{ row.department_name || '-' }}</p>
                </td>
                <td class="px-5 py-4">
                  <span :class="['rounded-full px-3 py-1 text-xs font-black', shiftClass(row.planned_shift_code)]">{{ row.planned_shift_code }}</span>
                  <p class="mt-1 text-xs text-gray-500">{{ row.shift_group ? `Group ${row.shift_group}` : row.work_mode }}</p>
                </td>
                <td class="px-5 py-4">
                  <span :class="['rounded-full px-3 py-1 text-xs font-black', statusClass(row.status)]">{{ row.status }}</span>
                  <p v-if="row.approved_request" class="mt-1 text-xs font-bold text-violet-600">
                    {{ typeLabel(row.approved_request.request_type) }} · {{ row.approved_request.request_number }}
                  </p>
                </td>
                <td class="px-5 py-4 text-xs text-gray-600 dark:text-gray-300">{{ row.check_in || '-' }} → {{ row.check_out || '-' }}</td>
                <td class="px-5 py-4 text-center font-black text-emerald-600">{{ Number(row.timesheet_value || 0).toFixed(1) }}</td>
                <td class="px-5 py-4 text-center font-black text-amber-600">{{ Number(row.overtime_hours || 0) || '-' }}</td>
                <td class="px-5 py-4">
                  <span v-if="row.exception" :class="['rounded-full px-3 py-1 text-xs font-black', exceptionClass(row.exception)]">{{ exceptionLabel(row.exception) }}</span>
                  <span v-else-if="row.approved_request" class="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700 ring-1 ring-violet-200 dark:bg-violet-950/30 dark:text-violet-300">Covered</span>
                  <span v-else class="text-xs font-bold text-emerald-600">OK</span>
                </td>
              </tr>
              <tr v-if="filteredRows.length === 0">
                <td colspan="8" class="px-5 py-16 text-center text-gray-400">No rows found.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div class="w-full max-w-xl rounded-3xl border border-gray-100 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800">
        <div class="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-700">
          <h3 class="text-xl font-black text-gray-900 dark:text-white">Log Attendance</h3>
          <button @click="closeModal" class="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700">✕</button>
        </div>
        <form @submit.prevent="saveAttendance" class="space-y-4 p-6">
          <label class="field">Employee
            <select v-model="logForm.employee_id" required class="input">
              <option value="">Select employee</option>
              <option v-for="e in allEmployees" :key="e.id" :value="e.id">{{ e.employee_code || e.code }} - {{ e.first_name || e.name }}</option>
            </select>
          </label>
          <div class="grid grid-cols-2 gap-4">
            <label class="field">Date<input v-model="logForm.date" type="date" required class="input" /></label>
            <label class="field">Status
              <select v-model="logForm.status" required class="input">
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
                <option value="half-day">Half Day</option>
                <option value="leave">Leave</option>
                <option value="sick">Sick</option>
              </select>
            </label>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <label class="field">Check In<input v-model="logForm.check_in" type="time" class="input" /></label>
            <label class="field">Check Out<input v-model="logForm.check_out" type="time" class="input" /></label>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <label class="field">Timesheet<input v-model.number="logForm.timesheet_value" type="number" step="0.5" min="0" max="1" class="input" /></label>
            <label class="field">Overtime<input v-model.number="logForm.overtime_hours" type="number" step="0.5" min="0" class="input" /></label>
          </div>
          <label class="field">Notes<textarea v-model="logForm.notes" rows="2" class="input" placeholder="Optional notes"></textarea></label>
          <div class="flex gap-3 border-t border-gray-100 pt-4 dark:border-gray-700">
            <button type="button" @click="closeModal" class="flex-1 rounded-2xl bg-gray-100 py-3 font-black text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200">Cancel</button>
            <button type="submit" class="flex-1 rounded-2xl bg-sky-600 py-3 font-black text-white hover:bg-sky-700">Save</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../../lib/api';

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const now = new Date();
const filterMonth = ref(now.getMonth() + 1);
const filterYear = ref(now.getFullYear());
const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);
const filterException = ref('');
const filterShift = ref('');
const searchQuery = ref('');
const loading = ref(false);
const rows = ref<any[]>([]);
const allEmployees = ref<any[]>([]);
const showModal = ref(false);

const defaultLogForm = () => ({
  employee_id: '',
  date: new Date().toISOString().slice(0, 10),
  status: 'present',
  timesheet_value: 1,
  overtime_hours: 0,
  check_in: '08:00',
  check_out: '17:00',
  notes: '',
});
const logForm = ref(defaultLogForm());

const exceptionRows = computed(() => rows.value.filter(row => row.exception));
const coveredRows = computed(() => rows.value.filter(row => row.approved_request && !row.exception));
const presentRows = computed(() => rows.value.filter(row => ['present', 'late', 'half-day'].includes(String(row.status).toLowerCase())));
const workingRows = computed(() => rows.value.filter(row => !['OFF'].includes(row.planned_shift_code)));
const attendanceRate = computed(() => workingRows.value.length ? Math.round(((presentRows.value.length + coveredRows.value.length) / workingRows.value.length) * 100) : 0);

const stats = computed(() => [
  { label: 'Attendance Rate', value: `${attendanceRate.value}%`, caption: 'present vs planned' },
  { label: 'Exceptions', value: exceptionRows.value.length, caption: 'needs HR action' },
  { label: 'Missing', value: rows.value.filter(r => r.exception === 'missing_attendance').length, caption: 'no actual log' },
  { label: 'Covered', value: coveredRows.value.length, caption: 'approved request' },
  { label: 'Total OT', value: rows.value.reduce((s, r) => s + Number(r.overtime_hours || 0), 0).toFixed(1), caption: 'overtime hours' },
]);

const filteredRows = computed(() => {
  const q = searchQuery.value.toLowerCase();
  return rows.value.filter(row => {
    const matchSearch = !q || [row.employee_name, row.employee_code, row.department_name, row.position, row.site, row.section].some(v => String(v || '').toLowerCase().includes(q));
    const matchException = !filterException.value
      || (filterException.value === 'exception' ? !!row.exception : filterException.value === 'covered' ? !!row.approved_request && !row.exception : row.exception === filterException.value);
    const matchShift = !filterShift.value || row.planned_shift_code === filterShift.value;
    return matchSearch && matchException && matchShift;
  });
});

const load = async () => {
  loading.value = true;
  try {
    const res = await api.get(`/hr/attendance/monitor?month=${filterMonth.value}&year=${filterYear.value}`);
    rows.value = res.data?.data?.rows || [];
  } catch (err) {
    console.error('Failed to fetch attendance monitor', err);
    rows.value = [];
  } finally {
    loading.value = false;
  }
};

const fetchEmployees = async () => {
  try {
    const res = await api.get('/hr/employees');
    allEmployees.value = res.data?.data || [];
  } catch (err) {
    console.error(err);
  }
};

const saveAttendance = async () => {
  try {
    await api.post('/hr/attendance', { logs: [{ ...logForm.value, employee_id: Number(logForm.value.employee_id) }] });
    closeModal();
    await load();
  } catch (err: any) {
    alert(err.response?.data?.error || 'Failed to save attendance');
  }
};

const openAddModal = () => {
  logForm.value = defaultLogForm();
  showModal.value = true;
};
const closeModal = () => {
  showModal.value = false;
};

const formatDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short' });
const exceptionLabel = (v?: string) => ({
  missing_attendance: 'Missing',
  absent: 'Absent',
  worked_on_off_day: 'Off-day Work',
}[String(v || '')] || 'Issue');
const typeLabel = (value: string) => ({ leave: 'Leave', permission: 'Permit', business_trip: 'SPD', medical: 'Medical' }[value] || value);

const exceptionClass = (v?: string) => ({
  missing_attendance: 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300',
  absent: 'bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300',
  worked_on_off_day: 'bg-violet-100 text-violet-800 dark:bg-violet-950/30 dark:text-violet-300',
}[String(v || '')] || 'bg-gray-100 text-gray-700');

const shiftClass = (code: string) => ({
  S1: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300',
  S2: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/30 dark:text-sky-300',
  S3: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300',
  OFF: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-700 dark:text-slate-200',
  REG: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200 dark:bg-teal-950/30 dark:text-teal-300',
}[code] || 'bg-gray-100 text-gray-700');

const statusClass = (status: string) => ({
  present: 'bg-green-50 text-green-700 ring-1 ring-green-200 dark:bg-green-950/30 dark:text-green-300',
  late: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300',
  leave: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300',
  permission: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/30 dark:text-sky-300',
  business_trip: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-950/30 dark:text-violet-300',
  absent: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/30 dark:text-rose-300',
  missing: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200 dark:bg-orange-950/30 dark:text-orange-300',
  off: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-700 dark:text-slate-200',
  sick: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200 dark:bg-purple-950/30 dark:text-purple-300',
  'half-day': 'bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200 dark:bg-fuchsia-950/30 dark:text-fuchsia-300',
}[String(status).toLowerCase()] || 'bg-gray-100 text-gray-700');

onMounted(() => {
  load();
  fetchEmployees();
});
</script>

<style scoped>
.filter-select {
  @apply rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white;
}
.field {
  @apply block text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400;
}
.input {
  @apply mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm normal-case tracking-normal text-gray-900 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white;
}
</style>
