<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Attendance Tracking</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Log daily attendance, timesheet values, overtime hours, and GPS verification.</p>
      </div>
      <button @click="openAddModal" class="flex items-center gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md transition-all cursor-pointer">
        <span class="text-lg">+</span> Log Attendance
      </button>
    </div>

    <!-- Period Filter -->
    <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4 items-center">
      <div class="flex items-center gap-3">
        <label class="text-sm font-bold text-gray-600 dark:text-gray-400">Period:</label>
        <select v-model="filterMonth" class="bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500">
          <option v-for="m in 12" :key="m" :value="m">{{ monthNames[m - 1] }}</option>
        </select>
        <select v-model="filterYear" class="bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500">
          <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
        </select>
      </div>
      <div class="relative w-full md:w-80">
        <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">🔍</span>
        <input v-model="searchQuery" type="text" placeholder="Search employee name..." class="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-white" />
      </div>
      <button @click="fetchAttendance" class="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer">Load</button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Records</p>
          <p class="text-3xl font-bold text-gray-900 dark:text-white mt-1">{{ logs.length }}</p>
        </div>
        <span class="text-3xl bg-teal-50 dark:bg-teal-900/30 p-3 rounded-2xl">📋</span>
      </div>
      <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Timesheet</p>
          <p class="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{{ totalTimesheet }}</p>
        </div>
        <span class="text-3xl bg-emerald-50 dark:bg-emerald-900/30 p-3 rounded-2xl">📊</span>
      </div>
      <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total OT Hours</p>
          <p class="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-1">{{ totalOT }}</p>
        </div>
        <span class="text-3xl bg-amber-50 dark:bg-amber-900/30 p-3 rounded-2xl">⏰</span>
      </div>
      <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">GPS Verified</p>
          <p class="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">{{ gpsVerifiedCount }}</p>
        </div>
        <span class="text-3xl bg-blue-50 dark:bg-blue-900/30 p-3 rounded-2xl">📍</span>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-gray-50 dark:bg-gray-750 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
              <th class="px-6 py-4">Date</th>
              <th class="px-6 py-4">Employee</th>
              <th class="px-6 py-4">Status</th>
              <th class="px-6 py-4 text-center">Timesheet</th>
              <th class="px-6 py-4 text-center">OT Hours</th>
              <th class="px-6 py-4">Check In / Out</th>
              <th class="px-6 py-4 text-center">GPS</th>
              <th class="px-6 py-4">Notes</th>
              <th class="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700 text-sm text-gray-700 dark:text-gray-300">
            <tr v-for="log in filteredLogs" :key="log.id" class="hover:bg-gray-50 dark:hover:bg-gray-750/30 transition-colors">
              <td class="px-6 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">{{ formatDate(log.date) }}</td>
              <td class="px-6 py-4">
                <p class="font-medium text-gray-900 dark:text-white">{{ log.employee_name }}</p>
                <p class="text-xs text-gray-500">{{ log.employee_code }}</p>
              </td>
              <td class="px-6 py-4">
                <span :class="['px-2.5 py-1 rounded-full text-xs font-semibold border', statusClass(log.status)]">{{ log.status }}</span>
              </td>
              <td class="px-6 py-4 text-center font-bold text-emerald-600 dark:text-emerald-400">{{ log.timesheet_value }}</td>
              <td class="px-6 py-4 text-center font-bold text-amber-600 dark:text-amber-400">{{ log.overtime_hours > 0 ? log.overtime_hours : '-' }}</td>
              <td class="px-6 py-4">
                <p class="text-xs">{{ log.check_in || '-' }} — {{ log.check_out || '-' }}</p>
              </td>
              <td class="px-6 py-4 text-center">
                <span v-if="log.gps_verified" class="text-green-500">✅</span>
                <span v-else class="text-gray-400">—</span>
              </td>
              <td class="px-6 py-4 text-xs text-gray-500 max-w-[150px] truncate">{{ log.notes || '-' }}</td>
              <td class="px-6 py-4 text-right">
                <button @click="deleteLog(log.id)" class="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-rose-600 rounded-lg cursor-pointer" title="Delete">🗑️</button>
              </td>
            </tr>
            <tr v-if="filteredLogs.length === 0">
              <td colspan="9" class="px-6 py-12 text-center text-gray-400 dark:text-gray-500">No attendance records found for this period.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Bulk Add Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-gray-700">
        <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h3 class="text-xl font-bold text-gray-900 dark:text-white">Log Attendance</h3>
          <button @click="closeModal" class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg cursor-pointer">✕</button>
        </div>
        <form @submit.prevent="saveAttendance" class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Employee *</label>
            <select v-model="logForm.employee_id" required class="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-750 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">Select employee</option>
              <option v-for="e in allEmployees" :key="e.id" :value="e.id">{{ e.employee_code }} - {{ e.first_name }}</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Date *</label>
              <input v-model="logForm.date" type="date" required class="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-750 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Status *</label>
              <select v-model="logForm.status" required class="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-750 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="half-day">Half Day</option>
                <option value="leave">Leave</option>
                <option value="sick">Sick</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Timesheet Value</label>
              <input v-model.number="logForm.timesheet_value" type="number" step="0.5" min="0" max="1" class="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-750 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Overtime Hours</label>
              <input v-model.number="logForm.overtime_hours" type="number" step="0.5" min="0" class="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-750 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Check In</label>
              <input v-model="logForm.check_in" type="time" class="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-750 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Check Out</label>
              <input v-model="logForm.check_out" type="time" class="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-750 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Notes</label>
            <textarea v-model="logForm.notes" rows="2" placeholder="Optional notes..." class="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-750 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"></textarea>
          </div>
          <div class="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button type="button" @click="closeModal" class="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-650 text-gray-700 dark:text-gray-200 py-3 rounded-xl font-bold transition-colors cursor-pointer">Cancel</button>
            <button type="submit" class="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-xl font-bold shadow-md transition-colors cursor-pointer">Save Record</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../../lib/api';

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const now = new Date();
const filterMonth = ref(now.getMonth() + 1);
const filterYear = ref(now.getFullYear());
const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);
const searchQuery = ref('');

const logs = ref<any[]>([]);
const allEmployees = ref<any[]>([]);
const showModal = ref(false);

const defaultLogForm = () => ({
  employee_id: '', date: new Date().toISOString().slice(0, 10),
  status: 'present', timesheet_value: 1.0, overtime_hours: 0,
  check_in: '08:00', check_out: '17:00', notes: '',
});
const logForm = ref(defaultLogForm());

const totalTimesheet = computed(() => logs.value.reduce((s, l) => s + parseFloat(l.timesheet_value || 0), 0).toFixed(1));
const totalOT = computed(() => logs.value.reduce((s, l) => s + parseFloat(l.overtime_hours || 0), 0).toFixed(1));
const gpsVerifiedCount = computed(() => logs.value.filter(l => l.gps_verified).length);

const filteredLogs = computed(() => {
  const q = searchQuery.value.toLowerCase();
  return logs.value.filter(l => !q || l.employee_name?.toLowerCase().includes(q) || l.employee_code?.toLowerCase().includes(q));
});

const formatDate = (d: string) => {
  if (!d) return '-';
  const dt = new Date(d);
  return dt.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
};

const statusClass = (s: string) => {
  const map: Record<string, string> = {
    present: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400',
    absent: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400',
    leave: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400',
    sick: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400',
    'half-day': 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400',
  };
  return map[s] || map['present'];
};

const fetchAttendance = async () => {
  try {
    const res = await api.get(`/hr/attendance?month=${filterMonth.value}&year=${filterYear.value}`);
    logs.value = res.data?.data || [];
  } catch (err) { console.error('Failed to fetch attendance', err); }
};

const fetchEmployees = async () => {
  try {
    const res = await api.get('/hr/employees');
    allEmployees.value = res.data?.data || [];
  } catch (err) { console.error(err); }
};

const openAddModal = () => { logForm.value = defaultLogForm(); showModal.value = true; };
const closeModal = () => { showModal.value = false; };

const saveAttendance = async () => {
  try {
    await api.post('/hr/attendance', {
      logs: [{
        employee_id: Number(logForm.value.employee_id),
        date: logForm.value.date,
        status: logForm.value.status,
        timesheet_value: logForm.value.timesheet_value,
        overtime_hours: logForm.value.overtime_hours,
        check_in: logForm.value.check_in,
        check_out: logForm.value.check_out,
        notes: logForm.value.notes,
      }]
    });
    await fetchAttendance();
    closeModal();
  } catch (err: any) { alert(err.response?.data?.error || 'Failed to save attendance'); }
};

const deleteLog = async (id: number) => {
  if (!confirm('Delete this attendance record?')) return;
  try { await api.delete(`/hr/attendance/${id}`); await fetchAttendance(); } catch { alert('Failed to delete'); }
};

onMounted(() => { fetchAttendance(); fetchEmployees(); });
</script>
