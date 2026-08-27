<template>
  <div class="space-y-6">
    <section class="relative overflow-hidden rounded-3xl border border-emerald-100 bg-slate-950 text-white shadow-xl">
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.35),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(14,165,233,0.25),transparent_30%)]"></div>
      <div class="absolute right-0 top-0 h-full w-1/2 opacity-20">
        <div class="h-full w-full bg-[linear-gradient(135deg,transparent_0_48%,rgba(255,255,255,0.24)_49%,transparent_51%)] bg-[length:28px_28px]"></div>
      </div>
      <div class="relative grid gap-6 p-6 lg:grid-cols-[1.35fr_0.65fr] lg:p-8">
        <div>
          <div class="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.28em] text-emerald-100">
            <span class="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.9)]"></span>
            Human Resources Command Center
          </div>
          <h1 class="max-w-3xl text-3xl font-black leading-tight md:text-5xl">
            Workforce scheduling, attendance, and payroll control for factory operations.
          </h1>
          <p class="mt-4 max-w-3xl text-sm leading-6 text-slate-200 md:text-base">
            Dibangun mengikuti blueprint HR pabrik: Employee Master → Shift Group A-D → Roster → Attendance → Leave/OT → Payroll.
            Fokusnya bukan cuma data karyawan, tapi menjawab siapa masuk, siapa kurang, apa exception-nya, dan apa yang harus diproses HR hari ini.
          </p>
          <div class="mt-6 flex flex-wrap gap-3">
            <router-link to="/hr/employees" class="rounded-2xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-950/20 hover:bg-emerald-300">
              Open Employee Master
            </router-link>
            <router-link to="/hr/attendance" class="rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white backdrop-blur hover:bg-white/15">
              Review Attendance
            </router-link>
            <router-link to="/hr/payroll" class="rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white backdrop-blur hover:bg-white/15">
              Payroll Workspace
            </router-link>
          </div>
        </div>

        <div class="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs uppercase tracking-[0.2em] text-slate-300">Today Factory Pulse</p>
              <p class="mt-1 text-2xl font-black">{{ todayLabel }}</p>
            </div>
            <div class="rounded-2xl bg-emerald-300/15 p-3 text-3xl">🏭</div>
          </div>
          <div class="mt-5 space-y-3">
            <div v-for="item in factoryPulse" :key="item.label" class="rounded-2xl bg-slate-950/45 p-4">
              <div class="flex items-center justify-between text-sm">
                <span class="text-slate-300">{{ item.label }}</span>
                <span class="font-black text-white">{{ item.value }}</span>
              </div>
              <div class="mt-3 h-2 rounded-full bg-white/10">
                <div class="h-2 rounded-full" :class="item.barClass" :style="{ width: `${item.progress}%` }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div v-for="card in kpiCards" :key="card.label" class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{{ card.label }}</p>
            <p class="mt-2 text-3xl font-black text-slate-950 dark:text-white">{{ card.value }}</p>
            <p class="mt-1 text-xs font-medium" :class="card.tone">{{ card.caption }}</p>
          </div>
          <div class="rounded-2xl p-3 text-2xl" :class="card.iconClass">{{ card.icon }}</div>
        </div>
      </div>
    </section>

    <section class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">Shift Operations</p>
            <h2 class="mt-1 text-2xl font-black text-slate-950 dark:text-white">3 Shift + 4 Group Rotation</h2>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Baseline 2-2-2-2; nanti pattern bisa dibuat configurable per site/department.</p>
          </div>
          <span class="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200">Foundation build</span>
        </div>

        <div class="mt-5 grid gap-3 md:grid-cols-4">
          <div v-for="group in shiftGroups" :key="group.code" class="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <div class="flex items-center justify-between">
              <span class="rounded-xl px-3 py-1 text-sm font-black" :class="group.badge">{{ group.code }}</span>
              <span class="text-xs font-bold text-slate-400">Day {{ group.day }}</span>
            </div>
            <p class="mt-4 text-2xl font-black text-slate-900 dark:text-white">{{ group.shift }}</p>
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ group.window }}</p>
            <div class="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
              {{ group.note }}
            </div>
          </div>
        </div>
      </div>

      <div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.2em] text-rose-600">Work Queue</p>
            <h2 class="mt-1 text-2xl font-black text-slate-950 dark:text-white">Exceptions & Approvals</h2>
          </div>
          <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200">{{ totalQueue }} open</span>
        </div>

        <div class="mt-5 space-y-3">
          <button v-for="item in workQueue" :key="item.title" type="button" @click="go(item.route)" class="w-full rounded-2xl border border-slate-200 p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50/60 dark:border-slate-700 dark:hover:bg-emerald-950/10">
            <div class="flex items-start gap-3">
              <span class="rounded-2xl p-3 text-xl" :class="item.iconClass">{{ item.icon }}</span>
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-3">
                  <p class="font-black text-slate-900 dark:text-white">{{ item.title }}</p>
                  <span class="rounded-full px-2.5 py-1 text-xs font-black" :class="item.countClass">{{ item.count }}</span>
                </div>
                <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ item.description }}</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </section>

    <section class="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">Implementation Roadmap</p>
        <h2 class="mt-1 text-2xl font-black text-slate-950 dark:text-white">HR V2 vertical slice</h2>
        <div class="mt-5 space-y-4">
          <div v-for="step in roadmap" :key="step.title" class="flex gap-4">
            <div class="flex flex-col items-center">
              <span class="flex h-8 w-8 items-center justify-center rounded-full text-xs font-black" :class="step.stateClass">{{ step.number }}</span>
              <span class="mt-2 h-full w-px bg-slate-200 dark:bg-slate-700"></span>
            </div>
            <div class="pb-4">
              <p class="font-black text-slate-900 dark:text-white">{{ step.title }}</p>
              <p class="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{{ step.description }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.2em] text-violet-600">Module Coverage</p>
            <h2 class="mt-1 text-2xl font-black text-slate-950 dark:text-white">Blueprint to screen map</h2>
          </div>
          <span class="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700 ring-1 ring-violet-100">MVP focus</span>
        </div>
        <div class="mt-5 grid gap-3 md:grid-cols-2">
          <router-link v-for="module in moduleCards" :key="module.title" :to="module.route" class="rounded-2xl border border-slate-200 p-4 transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md dark:border-slate-700">
            <div class="flex items-start gap-3">
              <span class="rounded-2xl p-3 text-xl" :class="module.iconClass">{{ module.icon }}</span>
              <div>
                <p class="font-black text-slate-900 dark:text-white">{{ module.title }}</p>
                <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ module.description }}</p>
                <p class="mt-3 text-xs font-bold" :class="module.statusClass">{{ module.status }}</p>
              </div>
            </div>
          </router-link>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../../lib/api';

type Employee = {
  id: number;
  status?: string;
  is_active?: boolean | number;
  contract_type?: string;
  salary_type?: string;
  department_name?: string;
};

type AttendanceLog = {
  id: number;
  status?: string;
  attendance_date?: string;
  date?: string;
  check_in_time?: string;
  check_in?: string;
  check_out_time?: string;
  check_out?: string;
};

const router = useRouter();
const employees = ref<Employee[]>([]);
const attendance = ref<AttendanceLog[]>([]);
const payrollRequests = ref<any[]>([]);
const essRequests = ref<any[]>([]);

const todayLabel = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
}).format(new Date());

const normalizeDate = (value?: string) => value ? value.slice(0, 10) : '';
const todayIso = new Date().toISOString().slice(0, 10);

const activeEmployees = computed(() => employees.value.filter((employee) => {
  if (employee.status) return String(employee.status).toUpperCase() === 'ACTIVE';
  return employee.is_active === true || employee.is_active === 1 || employee.is_active == null;
}));

const todayLogs = computed(() => attendance.value.filter((log) => normalizeDate(log.attendance_date || log.date) === todayIso));
const presentToday = computed(() => todayLogs.value.filter((log) => ['present', 'late', 'half-day', 'half_day'].includes(String(log.status || '').toLowerCase())).length);
const missingOut = computed(() => todayLogs.value.filter((log) => (log.check_in_time || log.check_in) && !(log.check_out_time || log.check_out)).length);
const absentToday = computed(() => todayLogs.value.filter((log) => String(log.status || '').toLowerCase() === 'absent').length);
const attendanceRate = computed(() => activeEmployees.value.length ? Math.round((presentToday.value / activeEmployees.value.length) * 100) : 0);
const pendingPayroll = computed(() => payrollRequests.value.filter((request) => !['approved', 'posted', 'locked', 'rejected'].includes(String(request.status || '').toLowerCase())).length);
const pendingEss = computed(() => essRequests.value.filter((request) => ['draft', 'submitted', 'in_review'].includes(String(request.status || '').toLowerCase())).length);
const totalQueue = computed(() => missingOut.value + absentToday.value + pendingPayroll.value + pendingEss.value + 6);

const kpiCards = computed(() => [
  {
    label: 'Active Headcount',
    value: activeEmployees.value.toLocaleString('id-ID'),
    caption: `${employees.value.length} total employee records`,
    icon: '👥',
    iconClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300',
    tone: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    label: 'Attendance Rate',
    value: `${attendanceRate.value}%`,
    caption: `${presentToday.value} present from today logs`,
    icon: '🕒',
    iconClass: 'bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300',
    tone: attendanceRate.value >= 90 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400',
  },
  {
    label: 'Open Exceptions',
    value: (missingOut.value + absentToday.value).toLocaleString('id-ID'),
    caption: `${missingOut.value} missing checkout · ${absentToday.value} absent`,
    icon: '⚠️',
    iconClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
    tone: 'text-amber-600 dark:text-amber-400',
  },
  {
    label: 'Payroll Queue',
    value: pendingPayroll.value.toLocaleString('id-ID'),
    caption: 'Runs waiting review / approval',
    icon: '💳',
    iconClass: 'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300',
    tone: 'text-violet-600 dark:text-violet-400',
  },
]);

const factoryPulse = computed(() => [
  { label: 'Actual presence', value: `${presentToday.value}/${Math.max(activeEmployees.value.length, 1)}`, progress: Math.min(100, attendanceRate.value), barClass: 'bg-emerald-300' },
  { label: 'Attendance exceptions', value: `${missingOut.value + absentToday.value}`, progress: Math.min(100, (missingOut.value + absentToday.value) * 12), barClass: 'bg-amber-300' },
  { label: 'Pending HR requests', value: `${pendingEss.value}`, progress: Math.min(100, pendingEss.value * 16), barClass: 'bg-sky-300' },
]);

const shiftGroups = [
  { code: 'Group A', day: 1, shift: 'Pagi', window: '06:00 - 14:00', note: 'Primary morning coverage', badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  { code: 'Group B', day: 1, shift: 'Sore', window: '14:00 - 22:00', note: 'Afternoon production crew', badge: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200' },
  { code: 'Group C', day: 1, shift: 'Malam', window: '22:00 - 06:00', note: 'Cross-midnight business date', badge: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' },
  { code: 'Group D', day: 1, shift: 'OFF', window: 'Rest day', note: 'Replacement pool validation', badge: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200' },
];

const workQueue = computed(() => [
  {
    title: 'Attendance exceptions',
    description: 'Missing punch, absent, late, early-out, and correction queue.',
    count: missingOut.value + absentToday.value,
    route: '/hr/attendance',
    icon: '🧭',
    iconClass: 'bg-amber-50 text-amber-700',
    countClass: 'bg-amber-100 text-amber-700',
  },
  {
    title: 'Employee master gaps',
    description: 'Contract, department, position, payroll group, and shift assignment completeness.',
    count: Math.max(0, employees.value.length - activeEmployees.value.length),
    route: '/hr/employees',
    icon: '🧩',
    iconClass: 'bg-emerald-50 text-emerald-700',
    countClass: 'bg-emerald-100 text-emerald-700',
  },
  {
    title: 'Payroll preparation',
    description: 'Draft, submitted, and review payroll periods before approval.',
    count: pendingPayroll.value,
    route: '/hr/payroll',
    icon: '🧾',
    iconClass: 'bg-violet-50 text-violet-700',
    countClass: 'bg-violet-100 text-violet-700',
  },
  {
    title: 'ESS requests',
    description: 'Leave, permit, medical, and business trip requests from employee portal.',
    count: pendingEss.value,
    route: '/hr/mobile-portal',
    icon: '📲',
    iconClass: 'bg-sky-50 text-sky-700',
    countClass: 'bg-sky-100 text-sky-700',
  },
]);

const roadmap = [
  { number: '01', title: 'Command Center', description: 'KPI, alert, exception queue, and blueprint-driven navigation.', stateClass: 'bg-emerald-500 text-white' },
  { number: '02', title: 'Employee 360 + Organization', description: 'Effective-dated employment assignment, group, supervisor, payroll group, document expiry.', stateClass: 'bg-emerald-500 text-white' },
  { number: '03', title: 'Shift & Roster Engine', description: 'Shift definition, Group A-D, rotation pattern, roster preview, publish, version, lock.', stateClass: 'bg-slate-900 text-white dark:bg-white dark:text-slate-950' },
  { number: '04', title: 'Request Center + Time-to-Payroll', description: 'Leave, permit, sick, medical, SPD approval and payroll traceability.', stateClass: 'bg-slate-900 text-white dark:bg-white dark:text-slate-950' },
];

const moduleCards = [
  { title: 'Employee Master', description: 'Identity, assignment, department, compensation base.', route: '/hr/employees', status: 'HR V2 active', icon: '👤', iconClass: 'bg-emerald-50 text-emerald-700', statusClass: 'text-emerald-600' },
  { title: 'Shift & Roster', description: 'Shift definition, Group A-D, 2-2-2-2 rotation preview.', route: '/hr/shift-roster', status: 'V1 preview active', icon: '🗓️', iconClass: 'bg-teal-50 text-teal-700', statusClass: 'text-teal-600' },
  { title: 'Attendance', description: 'Daily logs, GPS, timesheet, OT hour capture.', route: '/hr/attendance', status: 'Existing · needs exception engine', icon: '🕒', iconClass: 'bg-sky-50 text-sky-700', statusClass: 'text-sky-600' },
  { title: 'Request Center', description: 'Leave, permit, medical, sick, SPD approval ledger.', route: '/hr/requests', status: 'V1 approval active', icon: '🧾', iconClass: 'bg-violet-50 text-violet-700', statusClass: 'text-violet-600' },
  { title: 'Payroll', description: 'Request, calculate, save payslip, approval base.', route: '/hr/payroll', status: 'Existing · needs traceability', icon: '💳', iconClass: 'bg-violet-50 text-violet-700', statusClass: 'text-violet-600' },
  { title: 'ESS / Mobile Portal', description: 'Leave, permit, medical, SPD, attendance self-service.', route: '/hr/mobile-portal', status: 'Existing · ready for mobile sync', icon: '📲', iconClass: 'bg-amber-50 text-amber-700', statusClass: 'text-amber-600' },
];

function go(route: string) {
  router.push(route);
}

async function fetchOptional<T = any>(url: string): Promise<T[]> {
  try {
    const response = await api.get(url);
    return response.data?.data || response.data || [];
  } catch (error) {
    console.warn(`HR Command Center optional endpoint failed: ${url}`, error);
    return [];
  }
}

async function load() {
  const [employeeRows, attendanceRows, payrollRows, requestRows] = await Promise.all([
    fetchOptional<Employee>('/hr/employees'),
    fetchOptional<AttendanceLog>('/hr/attendance'),
    fetchOptional<any>('/hr/payroll-requests'),
    fetchOptional<any>('/hr/me/requests?limit=50'),
  ]);
  employees.value = employeeRows;
  attendance.value = attendanceRows;
  payrollRequests.value = payrollRows;
  essRequests.value = requestRows;
}

onMounted(load);
</script>
