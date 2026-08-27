<template>
  <div class="space-y-6">
    <section class="rounded-3xl border border-emerald-100 bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-900 p-6 text-white shadow-xl dark:border-emerald-900/40">
      <div class="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.35em] text-emerald-200">HR Command / Employee 360</p>
          <h1 class="mt-2 text-3xl font-black tracking-tight">Factory Workforce Master</h1>
          <p class="mt-2 max-w-2xl text-sm text-emerald-50/80">Master karyawan untuk kontrak, shift group, supervisor, payroll group, site, dan cost center.</p>
        </div>
        <button @click="openAddModal" class="rounded-2xl bg-white px-5 py-3 text-sm font-black text-emerald-900 shadow-lg transition hover:-translate-y-0.5 hover:bg-emerald-50">+ Add Employee</button>
      </div>

      <div class="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div v-for="stat in workforceStats" :key="stat.label" class="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
          <p class="text-xs uppercase tracking-wider text-emerald-100/70">{{ stat.label }}</p>
          <p class="mt-1 text-2xl font-black">{{ stat.value }}</p>
          <p class="mt-1 text-xs text-emerald-50/70">{{ stat.caption }}</p>
        </div>
      </div>
    </section>

    <section class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div class="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 lg:col-span-2">
        <div class="mb-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-bold uppercase tracking-wider text-emerald-600">Shift Distribution</p>
            <h2 class="text-lg font-black text-gray-900 dark:text-white">Group A-D readiness</h2>
          </div>
          <span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">{{ shiftReadyCount }} assigned</span>
        </div>
        <div class="grid grid-cols-2 gap-3 md:grid-cols-5">
          <div v-for="group in shiftGroups" :key="group.key" class="rounded-2xl bg-gray-50 p-4 dark:bg-gray-700">
            <p class="text-xs font-bold text-gray-500">{{ group.label }}</p>
            <p class="mt-1 text-2xl font-black text-gray-900 dark:text-white">{{ group.count }}</p>
            <div class="mt-3 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div class="h-full rounded-full bg-emerald-500" :style="{ width: `${group.percent}%` }"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="rounded-3xl border border-amber-100 bg-amber-50 p-5 shadow-sm dark:border-amber-900/30 dark:bg-amber-950/20">
        <p class="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Master Data Gaps</p>
        <h2 class="mt-1 text-lg font-black text-gray-900 dark:text-white">{{ masterGapCount }} needs attention</h2>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">Tanpa supervisor, payroll group, atau shift assignment, roster, approval, dan payroll rawan bocor.</p>
      </div>
    </section>

    <section class="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div class="flex flex-col gap-4 border-b border-gray-100 p-5 dark:border-gray-700 md:flex-row md:items-center md:justify-between">
        <div class="relative w-full md:w-96">
          <span class="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400">🔎</span>
          <input v-model="searchQuery" type="text" placeholder="Search name, code, position, site..." class="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
        </div>
        <div class="grid w-full grid-cols-2 gap-2 md:w-auto md:grid-cols-4">
          <select v-model="filterDept" class="filter-select">
            <option value="">All Dept</option>
            <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option>
          </select>
          <select v-model="filterType" class="filter-select">
            <option value="">All Pay Type</option>
            <option value="monthly">Monthly</option>
            <option value="daily">Daily</option>
          </select>
          <select v-model="filterShift" class="filter-select">
            <option value="">All Shift</option>
            <option value="A">Group A</option>
            <option value="B">Group B</option>
            <option value="C">Group C</option>
            <option value="D">Group D</option>
            <option value="non_shift">Non-shift</option>
          </select>
          <select v-model="filterStatus" class="filter-select">
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full min-w-[1180px] text-left text-sm">
          <thead class="border-b border-gray-100 bg-gray-50 text-xs font-black uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-700">
            <tr>
              <th class="px-5 py-4">Employee</th>
              <th class="px-5 py-4">Organization</th>
              <th class="px-5 py-4">Factory Assignment</th>
              <th class="px-5 py-4">Supervisor</th>
              <th class="px-5 py-4">Payroll</th>
              <th class="px-5 py-4">Lifecycle</th>
              <th class="px-5 py-4">Status</th>
              <th class="px-5 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr v-for="emp in filteredEmployees" :key="emp.id" class="transition hover:bg-emerald-50/40 dark:hover:bg-emerald-950/10">
              <td class="px-5 py-4">
                <div class="flex items-center gap-3">
                  <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 text-sm font-black text-emerald-700 dark:from-emerald-900/40 dark:to-teal-900/30 dark:text-emerald-300">{{ getInitials(emp.first_name) }}</div>
                  <div>
                    <p class="font-black text-gray-900 dark:text-white">{{ emp.first_name }}</p>
                    <p class="text-xs text-gray-500">{{ emp.employee_code }}</p>
                    <p class="text-xs text-gray-400">{{ emp.email || emp.phone || '-' }}</p>
                  </div>
                </div>
              </td>
              <td class="px-5 py-4">
                <p class="font-bold text-gray-900 dark:text-white">{{ emp.position || '-' }}</p>
                <p class="text-xs text-gray-500">{{ emp.department_name || 'No Department' }}</p>
                <p class="text-xs text-gray-400">{{ emp.section || emp.cost_center || '-' }}</p>
              </td>
              <td class="px-5 py-4">
                <div class="flex flex-wrap gap-2">
                  <span class="badge badge-emerald">{{ emp.work_mode === 'non_shift' ? 'Non-shift' : `Group ${emp.shift_group || '?'}` }}</span>
                  <span class="badge badge-slate">{{ emp.site || 'No site' }}</span>
                </div>
                <p class="mt-1 text-xs text-gray-500">{{ emp.work_calendar || 'Default calendar' }}</p>
              </td>
              <td class="px-5 py-4">
                <p class="font-semibold text-gray-800 dark:text-gray-100">{{ emp.supervisor_name || '-' }}</p>
                <p class="text-xs text-gray-500">{{ emp.grade || 'No grade' }}</p>
              </td>
              <td class="px-5 py-4">
                <p class="font-bold text-gray-900 dark:text-white">{{ emp.payroll_group || 'Unassigned' }}</p>
                <p class="text-xs text-gray-500">{{ emp.contract_type === 'monthly' ? 'Monthly' : 'Daily' }} • {{ fmtRp(emp.contract_type === 'monthly' ? emp.basic_salary : emp.basic_rate) }}</p>
              </td>
              <td class="px-5 py-4">
                <p class="font-semibold text-gray-900 dark:text-white">{{ labelize(emp.employment_type) }}</p>
                <p class="text-xs text-gray-500">Join {{ fmtDate(emp.hire_date) }}</p>
                <p v-if="emp.contract_end_date" class="text-xs text-amber-600">Ends {{ fmtDate(emp.contract_end_date) }}</p>
              </td>
              <td class="px-5 py-4">
                <span :class="['badge', emp.status === 'ACTIVE' ? 'badge-green' : 'badge-red']">{{ emp.status }}</span>
              </td>
              <td class="px-5 py-4 text-right">
                <button @click="openEditModal(emp)" class="rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300">Edit</button>
                <button @click="deleteEmployee(emp.id)" class="ml-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-300">Delete</button>
              </td>
            </tr>
            <tr v-if="filteredEmployees.length === 0">
              <td colspan="8" class="px-5 py-14 text-center text-gray-400">No employees found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div class="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-gray-100 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800">
        <div class="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/95 px-6 py-4 backdrop-blur dark:border-gray-700 dark:bg-gray-800/95">
          <div>
            <p class="text-xs font-bold uppercase tracking-widest text-emerald-600">Employee 360</p>
            <h3 class="text-xl font-black text-gray-900 dark:text-white">{{ editingId ? 'Edit Employee' : 'Add Employee' }}</h3>
          </div>
          <button @click="closeModal" class="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700">✕</button>
        </div>

        <form @submit.prevent="saveEmployee" class="space-y-6 p-6">
          <section-card title="Identity & Organization" subtitle="Core profile for approval, ESS, and reports.">
            <field-wrap label="NIK / Code *"><input v-model="form.employee_code" required :disabled="!!editingId" class="input" placeholder="EMP-001" /></field-wrap>
            <field-wrap label="Full Name *"><input v-model="form.first_name" required class="input" placeholder="Employee name" /></field-wrap>
            <field-wrap label="Email"><input v-model="form.email" type="email" class="input" placeholder="name@rheologi.id" /></field-wrap>
            <field-wrap label="Phone"><input v-model="form.phone" class="input" placeholder="08..." /></field-wrap>
            <field-wrap label="Department">
              <select v-model="form.department_id" class="input">
                <option value="">No Department</option>
                <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option>
              </select>
            </field-wrap>
            <field-wrap label="Position"><input v-model="form.position" class="input" placeholder="Operator / Supervisor" /></field-wrap>
          </section-card>

          <section-card title="Factory Assignment" subtitle="Foundation for shift rotation, manpower planning, and payroll grouping.">
            <field-wrap label="Work Mode">
              <select v-model="form.work_mode" class="input">
                <option value="shift">Shift</option>
                <option value="non_shift">Non-shift</option>
              </select>
            </field-wrap>
            <field-wrap label="Shift Group">
              <select v-model="form.shift_group" class="input" :disabled="form.work_mode === 'non_shift'">
                <option value="">Unassigned</option>
                <option value="A">Group A</option>
                <option value="B">Group B</option>
                <option value="C">Group C</option>
                <option value="D">Group D</option>
              </select>
            </field-wrap>
            <field-wrap label="Roster Anchor"><input v-model="form.roster_anchor_date" type="date" class="input" /></field-wrap>
            <field-wrap label="Work Calendar"><input v-model="form.work_calendar" class="input" placeholder="Factory 2-2-2-2" /></field-wrap>
            <field-wrap label="Site"><input v-model="form.site" class="input" placeholder="Plant / Office" /></field-wrap>
            <field-wrap label="Section"><input v-model="form.section" class="input" placeholder="Production Line 1" /></field-wrap>
            <field-wrap label="Cost Center"><input v-model="form.cost_center" class="input" placeholder="CC-..." /></field-wrap>
            <field-wrap label="Supervisor">
              <select v-model="form.supervisor_id" class="input">
                <option value="">No Supervisor</option>
                <option v-for="emp in supervisorOptions" :key="emp.id" :value="emp.id">{{ emp.first_name }} — {{ emp.position || emp.employee_code }}</option>
              </select>
            </field-wrap>
          </section-card>

          <section-card title="Employment Lifecycle" subtitle="Contract, probation, grade, and employee status.">
            <field-wrap label="Employment Type">
              <select v-model="form.employment_type" class="input">
                <option value="permanent">Permanent</option>
                <option value="contract">Contract</option>
                <option value="daily">Daily Worker</option>
                <option value="intern">Intern</option>
              </select>
            </field-wrap>
            <field-wrap label="Employment Status">
              <select v-model="form.employment_status" class="input">
                <option value="active">Active</option>
                <option value="probation">Probation</option>
                <option value="suspended">Suspended</option>
                <option value="resigned">Resigned</option>
              </select>
            </field-wrap>
            <field-wrap label="Hire Date"><input v-model="form.hire_date" type="date" class="input" /></field-wrap>
            <field-wrap label="Probation End"><input v-model="form.probation_end_date" type="date" class="input" /></field-wrap>
            <field-wrap label="Contract Start"><input v-model="form.contract_start_date" type="date" class="input" /></field-wrap>
            <field-wrap label="Contract End"><input v-model="form.contract_end_date" type="date" class="input" /></field-wrap>
            <field-wrap label="Grade"><input v-model="form.grade" class="input" placeholder="G1 / Staff / SPV" /></field-wrap>
            <field-wrap label="Status">
              <select v-model="form.status" class="input">
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </field-wrap>
          </section-card>

          <section-card title="Payroll & Compensation" subtitle="Base data for payroll workspace and overtime calculation.">
            <field-wrap label="Payroll Group"><input v-model="form.payroll_group" class="input" placeholder="Monthly Staff / Daily Factory" /></field-wrap>
            <field-wrap label="Salary Type">
              <select v-model="form.contract_type" required class="input">
                <option value="daily">Daily</option>
                <option value="monthly">Monthly</option>
              </select>
            </field-wrap>
            <field-wrap :label="form.contract_type === 'monthly' ? 'Monthly Salary' : 'Daily Rate'"><input v-model.number="form.basic_salary" type="number" class="input" /></field-wrap>
            <field-wrap label="Allowance / Day"><input v-model.number="form.tunjangan_rate" type="number" class="input" /></field-wrap>
            <field-wrap label="Overtime / Hour"><input v-model.number="form.ot_rate" type="number" class="input" /></field-wrap>
            <field-wrap label="Notes"><textarea v-model="form.notes" class="input min-h-[88px]" placeholder="Internal HR notes"></textarea></field-wrap>
          </section-card>

          <div class="sticky bottom-0 -mx-6 -mb-6 flex gap-3 border-t border-gray-100 bg-white/95 p-6 backdrop-blur dark:border-gray-700 dark:bg-gray-800/95">
            <button type="button" @click="closeModal" class="flex-1 rounded-2xl bg-gray-100 py-3 font-black text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200">Cancel</button>
            <button type="submit" class="flex-1 rounded-2xl bg-emerald-600 py-3 font-black text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700">{{ editingId ? 'Update Employee' : 'Save Employee' }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref } from 'vue';
import { api } from '../../lib/api';

const employees = ref<any[]>([]);
const departments = ref<any[]>([]);
const searchQuery = ref('');
const filterDept = ref('');
const filterType = ref('');
const filterShift = ref('');
const filterStatus = ref('');
const showModal = ref(false);
const editingId = ref<number | null>(null);

const FieldWrap = defineComponent({
  props: { label: { type: String, required: true } },
  setup(props, { slots }) {
    return () => h('label', { class: 'block' }, [
      h('span', { class: 'mb-1 block text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400' }, props.label),
      slots.default?.(),
    ]);
  },
});

const SectionCard = defineComponent({
  props: { title: { type: String, required: true }, subtitle: { type: String, default: '' } },
  setup(props, { slots }) {
    return () => h('section', { class: 'rounded-3xl border border-gray-100 bg-gray-50/70 p-5 dark:border-gray-700 dark:bg-gray-700/40' }, [
      h('div', { class: 'mb-4' }, [
        h('h4', { class: 'text-base font-black text-gray-900 dark:text-white' }, props.title),
        props.subtitle ? h('p', { class: 'mt-1 text-xs text-gray-500 dark:text-gray-400' }, props.subtitle) : null,
      ]),
      h('div', { class: 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4' }, slots.default?.()),
    ]);
  },
});

const defaultForm = () => ({
  employee_code: '',
  first_name: '',
  email: '',
  phone: '',
  department_id: '' as any,
  position: '',
  hire_date: new Date().toISOString().slice(0, 10),
  contract_type: 'daily',
  basic_salary: 0,
  tunjangan_rate: 0,
  ot_rate: 0,
  status: 'ACTIVE',
  employment_type: 'permanent',
  employment_status: 'active',
  contract_start_date: '',
  contract_end_date: '',
  probation_end_date: '',
  supervisor_id: '' as any,
  payroll_group: '',
  work_calendar: 'Factory 2-2-2-2',
  work_mode: 'shift',
  shift_group: '',
  roster_anchor_date: '',
  site: '',
  section: '',
  cost_center: '',
  grade: '',
  notes: '',
});
const form = ref(defaultForm());

const normalizeEmployee = (e: any) => ({
  ...e,
  employee_code: e.employee_code || e.code,
  first_name: e.first_name || e.name || e.full_name,
  basic_rate: parseFloat(e.basic_rate || 0),
  tunjangan_rate: parseFloat(e.tunjangan_rate || 0),
  ot_rate: parseFloat(e.ot_rate || 0),
  basic_salary: parseFloat(e.basic_salary ?? e.salary ?? 0),
  contract_type: e.salary_type || e.contract_type || 'daily',
  employment_type: e.employment_type || 'permanent',
  employment_status: e.employment_status || (e.status === 'ACTIVE' ? 'active' : 'inactive'),
  work_mode: e.work_mode || 'shift',
  shift_group: e.work_mode === 'non_shift' ? '' : (e.shift_group || ''),
});

const monthlyCount = computed(() => employees.value.filter(e => e.contract_type === 'monthly').length);
const dailyCount = computed(() => employees.value.filter(e => e.contract_type === 'daily').length);
const activeCount = computed(() => employees.value.filter(e => e.status === 'ACTIVE').length);
const shiftReadyCount = computed(() => employees.value.filter(e => e.work_mode === 'non_shift' || e.shift_group).length);
const masterGapCount = computed(() => employees.value.filter(e => !e.supervisor_id || !e.payroll_group || (e.work_mode !== 'non_shift' && !e.shift_group)).length);

const workforceStats = computed(() => [
  { label: 'Active Headcount', value: activeCount.value, caption: `${employees.value.length} total employees` },
  { label: 'Monthly Staff', value: monthlyCount.value, caption: 'Fixed payroll base' },
  { label: 'Daily Worker', value: dailyCount.value, caption: 'Daily rate payroll' },
  { label: 'Master Gaps', value: masterGapCount.value, caption: 'Need completion' },
]);

const shiftGroups = computed(() => {
  const total = Math.max(1, employees.value.length);
  return [
    ['A', 'Group A'],
    ['B', 'Group B'],
    ['C', 'Group C'],
    ['D', 'Group D'],
    ['non_shift', 'Non-shift'],
  ].map(([key, label]) => {
    const count = employees.value.filter(e => key === 'non_shift' ? e.work_mode === 'non_shift' : e.shift_group === key).length;
    return { key, label, count, percent: Math.round((count / total) * 100) };
  });
});

const filteredEmployees = computed(() => employees.value.filter(emp => {
  const q = searchQuery.value.toLowerCase();
  const matchSearch = !q || [emp.first_name, emp.employee_code, emp.position, emp.department_name, emp.site, emp.section, emp.cost_center]
    .some(value => String(value || '').toLowerCase().includes(q));
  const matchDept = !filterDept.value || emp.department_id === Number(filterDept.value);
  const matchType = !filterType.value || emp.contract_type === filterType.value;
  const matchShift = !filterShift.value || (filterShift.value === 'non_shift' ? emp.work_mode === 'non_shift' : emp.shift_group === filterShift.value);
  const matchStatus = !filterStatus.value || emp.status === filterStatus.value;
  return matchSearch && matchDept && matchType && matchShift && matchStatus;
}));

const supervisorOptions = computed(() => employees.value.filter(emp => emp.id !== editingId.value));
const getInitials = (name: string) => name ? name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : '??';
const fmtRp = (v: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);
const fmtDate = (v?: string) => v ? new Date(v).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const labelize = (v?: string) => String(v || '-').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const fetchEmployees = async () => {
  try {
    const res = await api.get('/hr/employees');
    employees.value = (res.data?.data || []).map(normalizeEmployee);
  } catch (err) {
    console.error('Failed to fetch employees', err);
  }
};

const fetchDepartments = async () => {
  try {
    const res = await api.get('/departments');
    departments.value = res.data?.data || res.data || [];
  } catch (err) {
    console.error('Failed to fetch departments', err);
  }
};

const openAddModal = () => {
  editingId.value = null;
  form.value = defaultForm();
  showModal.value = true;
};

const openEditModal = (emp: any) => {
  editingId.value = emp.id;
  form.value = {
    ...defaultForm(),
    employee_code: emp.employee_code || '',
    first_name: emp.first_name || '',
    email: emp.email || '',
    phone: emp.phone || '',
    department_id: emp.department_id ? String(emp.department_id) : '',
    position: emp.position || '',
    hire_date: emp.hire_date ? emp.hire_date.slice(0, 10) : '',
    contract_type: emp.contract_type || 'daily',
    basic_salary: emp.contract_type === 'monthly' ? emp.basic_salary : emp.basic_rate,
    tunjangan_rate: emp.tunjangan_rate || 0,
    ot_rate: emp.ot_rate || 0,
    status: emp.status || 'ACTIVE',
    employment_type: emp.employment_type || 'permanent',
    employment_status: emp.employment_status || 'active',
    contract_start_date: emp.contract_start_date ? emp.contract_start_date.slice(0, 10) : '',
    contract_end_date: emp.contract_end_date ? emp.contract_end_date.slice(0, 10) : '',
    probation_end_date: emp.probation_end_date ? emp.probation_end_date.slice(0, 10) : '',
    supervisor_id: emp.supervisor_id ? String(emp.supervisor_id) : '',
    payroll_group: emp.payroll_group || '',
    work_calendar: emp.work_calendar || 'Factory 2-2-2-2',
    work_mode: emp.work_mode || 'shift',
    shift_group: emp.shift_group || '',
    roster_anchor_date: emp.roster_anchor_date ? emp.roster_anchor_date.slice(0, 10) : '',
    site: emp.site || '',
    section: emp.section || '',
    cost_center: emp.cost_center || '',
    grade: emp.grade || '',
    notes: emp.notes || '',
  };
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
};

const saveEmployee = async () => {
  try {
    const payload: any = {
      code: form.value.employee_code,
      name: form.value.first_name,
      employee_code: form.value.employee_code,
      first_name: form.value.first_name,
      email: form.value.email,
      phone: form.value.phone,
      department_id: form.value.department_id ? Number(form.value.department_id) : null,
      position: form.value.position,
      hire_date: form.value.hire_date || null,
      salary_type: form.value.contract_type,
      contract_type: form.value.contract_type,
      basic_rate: form.value.contract_type === 'daily' ? form.value.basic_salary : 0,
      basic_salary: form.value.contract_type === 'monthly' ? form.value.basic_salary : 0,
      salary: form.value.contract_type === 'monthly' ? form.value.basic_salary : 0,
      tunjangan_rate: form.value.tunjangan_rate,
      ot_rate: form.value.ot_rate,
      is_active: form.value.status === 'ACTIVE',
      status: form.value.status,
      employment_type: form.value.employment_type,
      employment_status: form.value.employment_status,
      contract_start_date: form.value.contract_start_date || null,
      contract_end_date: form.value.contract_end_date || null,
      probation_end_date: form.value.probation_end_date || null,
      supervisor_id: form.value.supervisor_id ? Number(form.value.supervisor_id) : null,
      payroll_group: form.value.payroll_group,
      work_calendar: form.value.work_calendar,
      work_mode: form.value.work_mode,
      shift_group: form.value.work_mode === 'non_shift' ? null : form.value.shift_group,
      roster_anchor_date: form.value.roster_anchor_date || null,
      site: form.value.site,
      section: form.value.section,
      cost_center: form.value.cost_center,
      grade: form.value.grade,
      notes: form.value.notes,
    };
    if (editingId.value) await api.put(`/hr/employees/${editingId.value}`, payload);
    else await api.post('/hr/employees', payload);
    await fetchEmployees();
    closeModal();
  } catch (err: any) {
    alert(err.response?.data?.error || 'Gagal menyimpan data karyawan');
  }
};

const deleteEmployee = async (id: number) => {
  if (!confirm('Hapus karyawan ini?')) return;
  try {
    await api.delete(`/hr/employees/${id}`);
    await fetchEmployees();
  } catch {
    alert('Gagal menghapus');
  }
};

onMounted(() => {
  fetchEmployees();
  fetchDepartments();
});
</script>

<style scoped>
.filter-select {
  @apply rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white;
}
.input {
  @apply w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:bg-gray-100 disabled:text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-white;
}
.badge {
  @apply inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black;
}
.badge-emerald {
  @apply border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300;
}
.badge-slate {
  @apply border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300;
}
.badge-green {
  @apply border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-300;
}
.badge-red {
  @apply border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300;
}
</style>
