<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Employees Directory</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage employee contracts, compensation rates, and personal details.</p>
      </div>
      <button
        @click="openAddModal"
        class="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md transition-all cursor-pointer"
      >
        <span class="text-lg">+</span> Add Employee
      </button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Karyawan</p>
          <p class="text-3xl font-bold text-gray-900 dark:text-white mt-1">{{ employees.length }}</p>
        </div>
        <span class="text-3xl bg-blue-50 dark:bg-blue-900/30 p-3 rounded-2xl">👥</span>
      </div>
      <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Staff Bulanan</p>
          <p class="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{{ monthlyCount }}</p>
        </div>
        <span class="text-3xl bg-emerald-50 dark:bg-emerald-900/30 p-3 rounded-2xl">💼</span>
      </div>
      <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Harian / Kontrak</p>
          <p class="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-1">{{ dailyCount }}</p>
        </div>
        <span class="text-3xl bg-amber-50 dark:bg-amber-900/30 p-3 rounded-2xl">🛠️</span>
      </div>
      <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Karyawan Aktif</p>
          <p class="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{{ activeCount }}</p>
        </div>
        <span class="text-3xl bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-2xl">✅</span>
      </div>
    </div>

    <!-- Search & Filters + Table -->
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div class="p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div class="relative w-full md:w-80">
          <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">🔍</span>
          <input v-model="searchQuery" type="text" placeholder="Search name, code, position..." class="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
        </div>
        <div class="flex gap-2 w-full md:w-auto">
          <select v-model="filterDept" class="bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white">
            <option value="">All Departments</option>
            <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option>
          </select>
          <select v-model="filterType" class="bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white">
            <option value="">All Types</option>
            <option value="monthly">Monthly</option>
            <option value="daily">Daily</option>
          </select>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-gray-50 dark:bg-gray-750 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
              <th class="px-6 py-4">Employee</th>
              <th class="px-6 py-4">Contact</th>
              <th class="px-6 py-4">Department & Position</th>
              <th class="px-6 py-4">Salary Type</th>
              <th class="px-6 py-4 text-right">Basic Rate / Salary</th>
              <th class="px-6 py-4 text-right">Tunjangan</th>
              <th class="px-6 py-4 text-right">OT Rate / Hr</th>
              <th class="px-6 py-4">Status</th>
              <th class="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700 text-sm text-gray-700 dark:text-gray-300">
            <tr v-for="emp in filteredEmployees" :key="emp.id" class="hover:bg-gray-50 dark:hover:bg-gray-750/30 transition-colors">
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 bg-gradient-to-tr from-blue-100 to-indigo-100 text-blue-700 dark:from-blue-900/30 dark:to-indigo-900/30 dark:text-blue-400 font-bold rounded-full flex items-center justify-center text-xs">
                    {{ getInitials(emp.first_name) }}
                  </div>
                  <div>
                    <p class="font-semibold text-gray-900 dark:text-white">{{ emp.first_name }}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">{{ emp.employee_code }}</p>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4">
                <p class="text-xs">{{ emp.email || '-' }}</p>
                <p class="text-xs text-gray-500">{{ emp.phone || '-' }}</p>
              </td>
              <td class="px-6 py-4">
                <p class="font-medium text-gray-900 dark:text-white">{{ emp.position || '-' }}</p>
                <p class="text-xs text-gray-500">{{ emp.department_name || 'No Department' }}</p>
              </td>
              <td class="px-6 py-4">
                <span :class="['px-2.5 py-1 rounded-full text-xs font-semibold border', emp.contract_type === 'monthly' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30' : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30']">
                  {{ emp.contract_type === 'monthly' ? 'Bulanan' : 'Harian' }}
                </span>
              </td>
              <td class="px-6 py-4 text-right font-medium">{{ fmtRp(emp.contract_type === 'monthly' ? emp.basic_salary : emp.basic_rate) }}</td>
              <td class="px-6 py-4 text-right text-gray-500 dark:text-gray-400">{{ fmtRp(emp.tunjangan_rate) }}</td>
              <td class="px-6 py-4 text-right text-gray-500 dark:text-gray-400">{{ fmtRp(emp.ot_rate) }}</td>
              <td class="px-6 py-4">
                <span :class="['px-2.5 py-1 rounded-full text-xs font-semibold border', emp.status === 'ACTIVE' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400' : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400']">
                  {{ emp.status }}
                </span>
              </td>
              <td class="px-6 py-4 text-right">
                <div class="flex gap-2 justify-end">
                  <button @click="openEditModal(emp)" class="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-blue-600 rounded-lg cursor-pointer" title="Edit">✏️</button>
                  <button @click="deleteEmployee(emp.id)" class="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-rose-600 rounded-lg cursor-pointer" title="Delete">🗑️</button>
                </div>
              </td>
            </tr>
            <tr v-if="filteredEmployees.length === 0">
              <td colspan="9" class="px-6 py-12 text-center text-gray-400 dark:text-gray-500">No employees found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-gray-700">
        <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h3 class="text-xl font-bold text-gray-900 dark:text-white">{{ editingId ? 'Edit' : 'Add' }} Employee</h3>
          <button @click="closeModal" class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg cursor-pointer">✕</button>
        </div>
        <form @submit.prevent="saveEmployee" class="p-6 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">NIK / Code *</label>
              <input v-model="form.employee_code" required :disabled="!!editingId" placeholder="EMP-001" class="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-750 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Full Name *</label>
              <input v-model="form.first_name" required placeholder="John Doe" class="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-750 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Email</label>
              <input v-model="form.email" type="email" placeholder="john@email.com" class="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-750 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Phone</label>
              <input v-model="form.phone" placeholder="0812xxx" class="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-750 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Department</label>
              <select v-model="form.department_id" class="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-750 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">No Department</option>
                <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Position</label>
              <input v-model="form.position" placeholder="Operator" class="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-750 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Hire Date</label>
              <input v-model="form.hire_date" type="date" class="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-750 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Salary Type *</label>
              <select v-model="form.contract_type" required class="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-750 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="daily">Harian</option>
                <option value="monthly">Bulanan</option>
              </select>
            </div>
          </div>
          <div class="border-t border-gray-100 dark:border-gray-700 pt-4 mt-2">
            <h4 class="text-sm font-bold text-gray-900 dark:text-white mb-3">💰 Compensation Rates</h4>
            <div class="grid grid-cols-3 gap-4">
              <div>
                <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">{{ form.contract_type === 'monthly' ? 'Gaji Bulanan' : 'Rate / Hari' }}</label>
                <input v-model.number="form.basic_salary" type="number" class="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-750 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Tunjangan / Hari</label>
                <input v-model.number="form.tunjangan_rate" type="number" class="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-750 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Lembur / Jam</label>
                <input v-model.number="form.ot_rate" type="number" class="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-750 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Status</label>
              <select v-model="form.status" class="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-750 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>
          <div class="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button type="button" @click="closeModal" class="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-650 text-gray-700 dark:text-gray-200 py-3 rounded-xl font-bold transition-colors cursor-pointer">Cancel</button>
            <button type="submit" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold shadow-md transition-colors cursor-pointer">{{ editingId ? 'Update' : 'Save' }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../../lib/api';

const employees = ref<any[]>([]);
const departments = ref<any[]>([]);
const searchQuery = ref('');
const filterDept = ref('');
const filterType = ref('');
const showModal = ref(false);
const editingId = ref<number | null>(null);

const defaultForm = () => ({
  employee_code: '', first_name: '', email: '', phone: '', department_id: '' as any,
  position: '', hire_date: new Date().toISOString().slice(0, 10),
  contract_type: 'daily', basic_salary: 0, tunjangan_rate: 0, ot_rate: 0, status: 'ACTIVE',
});
const form = ref(defaultForm());

const monthlyCount = computed(() => employees.value.filter(e => e.contract_type === 'monthly').length);
const dailyCount = computed(() => employees.value.filter(e => e.contract_type === 'daily').length);
const activeCount = computed(() => employees.value.filter(e => e.status === 'ACTIVE').length);

const filteredEmployees = computed(() => {
  return employees.value.filter(emp => {
    const q = searchQuery.value.toLowerCase();
    const matchSearch = !q || emp.first_name?.toLowerCase().includes(q) || emp.employee_code?.toLowerCase().includes(q) || emp.position?.toLowerCase().includes(q);
    const matchDept = !filterDept.value || emp.department_id === Number(filterDept.value);
    const matchType = !filterType.value || emp.contract_type === filterType.value;
    return matchSearch && matchDept && matchType;
  });
});

const getInitials = (name: string) => name ? name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : '??';
const fmtRp = (v: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);

const fetchEmployees = async () => {
  try {
    const res = await api.get('/hr/employees');
    employees.value = (res.data?.data || []).map((e: any) => ({
      ...e,
      basic_rate: parseFloat(e.basic_rate || 0),
      tunjangan_rate: parseFloat(e.tunjangan_rate || 0),
      ot_rate: parseFloat(e.ot_rate || 0),
      basic_salary: parseFloat(e.basic_salary || 0),
      contract_type: e.salary_type || e.contract_type || 'daily',
    }));
  } catch (err) { console.error('Failed to fetch employees', err); }
};

const fetchDepartments = async () => {
  try {
    const res = await api.get('/departments');
    departments.value = res.data?.data || res.data || [];
  } catch (err) { console.error('Failed to fetch departments', err); }
};

const openAddModal = () => { editingId.value = null; form.value = defaultForm(); showModal.value = true; };
const openEditModal = (emp: any) => {
  editingId.value = emp.id;
  form.value = {
    employee_code: emp.employee_code, first_name: emp.first_name, email: emp.email || '', phone: emp.phone || '',
    department_id: emp.department_id ? String(emp.department_id) : '', position: emp.position || '',
    hire_date: emp.hire_date ? emp.hire_date.slice(0, 10) : '', contract_type: emp.contract_type || 'daily',
    basic_salary: emp.contract_type === 'monthly' ? emp.basic_salary : emp.basic_rate,
    tunjangan_rate: emp.tunjangan_rate, ot_rate: emp.ot_rate, status: emp.status || 'ACTIVE',
  };
  showModal.value = true;
};
const closeModal = () => { showModal.value = false; };

const saveEmployee = async () => {
  try {
    const payload: any = {
      code: form.value.employee_code, name: form.value.first_name, email: form.value.email, phone: form.value.phone,
      department_id: form.value.department_id ? Number(form.value.department_id) : null,
      position: form.value.position, hire_date: form.value.hire_date, salary_type: form.value.contract_type,
      basic_rate: form.value.contract_type === 'daily' ? form.value.basic_salary : 0,
      basic_salary: form.value.contract_type === 'monthly' ? form.value.basic_salary : 0,
      salary: form.value.contract_type === 'monthly' ? form.value.basic_salary : 0,
      tunjangan_rate: form.value.tunjangan_rate, ot_rate: form.value.ot_rate,
      is_active: form.value.status === 'ACTIVE',
      employee_code: form.value.employee_code, first_name: form.value.first_name,
      contract_type: form.value.contract_type, status: form.value.status,
    };
    if (editingId.value) await api.put(`/hr/employees/${editingId.value}`, payload);
    else await api.post('/hr/employees', payload);
    await fetchEmployees();
    closeModal();
  } catch (err: any) { alert(err.response?.data?.error || 'Gagal menyimpan data karyawan'); }
};

const deleteEmployee = async (id: number) => {
  if (!confirm('Hapus karyawan ini?')) return;
  try { await api.delete(`/hr/employees/${id}`); await fetchEmployees(); } catch { alert('Gagal menghapus'); }
};

onMounted(() => { fetchEmployees(); fetchDepartments(); });
</script>
