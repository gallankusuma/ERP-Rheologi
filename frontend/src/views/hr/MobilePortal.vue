<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-950">
    <!-- Not Logged In -->
    <div v-if="!employee" class="flex items-center justify-center min-h-screen p-4">
      <div class="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 w-full max-w-sm border border-gray-100 dark:border-gray-700 text-center space-y-6">
        <div class="w-20 h-20 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-lg">
          <span class="text-4xl">👷</span>
        </div>
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Employee Portal</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Login with your NIK to check in & view payslips.</p>
        </div>
        <form @submit.prevent="loginByNik" class="space-y-4">
          <input
            v-model="nikInput"
            type="text"
            placeholder="Enter your NIK / Employee Code"
            required
            class="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 dark:bg-gray-750 dark:text-white rounded-2xl text-center text-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="submit" class="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 rounded-2xl font-bold shadow-md transition-all cursor-pointer">
            🔐 Login
          </button>
        </form>
        <p v-if="loginError" class="text-rose-500 text-sm font-semibold">{{ loginError }}</p>
      </div>
    </div>

    <!-- Logged In -->
    <div v-else class="max-w-lg mx-auto p-4 space-y-6 pt-6">
      <!-- Profile Header -->
      <div class="bg-white dark:bg-gray-800 rounded-3xl shadow-sm p-6 border border-gray-100 dark:border-gray-700 text-center">
        <div class="w-16 h-16 bg-gradient-to-tr from-blue-400 to-indigo-500 rounded-full flex items-center justify-center mx-auto text-white text-xl font-bold shadow-md">
          {{ getInitials(employee.name || employee.first_name) }}
        </div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white mt-3">{{ employee.name || employee.first_name }}</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ employee.position || 'Employee' }} · {{ employee.code || employee.employee_code }}</p>
        <button @click="logout" class="mt-3 text-xs text-rose-500 hover:text-rose-700 cursor-pointer">🔓 Logout</button>
      </div>

      <!-- Quick Check-In -->
      <div class="bg-white dark:bg-gray-800 rounded-3xl shadow-sm p-6 border border-gray-100 dark:border-gray-700 space-y-4">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white">📍 Daily Check-In</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ todayFormatted }}</p>
        <div v-if="checkedIn" class="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 text-center">
          <p class="text-emerald-700 dark:text-emerald-400 font-bold text-lg">✅ Checked In!</p>
          <p class="text-emerald-600 dark:text-emerald-500 text-sm mt-1">{{ checkinTime }}</p>
        </div>
        <button
          v-if="!checkedIn"
          @click="doCheckin"
          :disabled="checkingIn"
          class="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white py-4 rounded-2xl font-bold text-lg shadow-md transition-all cursor-pointer disabled:opacity-50"
        >
          {{ checkingIn ? '⏳ Locating...' : '📍 Check In Now' }}
        </button>
      </div>

      <!-- Recent Payslips -->
      <div class="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div class="p-6 border-b border-gray-100 dark:border-gray-700">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white">💰 Recent Payslips</h3>
        </div>
        <div v-if="payslips.length === 0" class="p-8 text-center text-gray-400 dark:text-gray-500">
          No payslips available yet.
        </div>
        <div v-else class="divide-y divide-gray-100 dark:divide-gray-700">
          <div v-for="ps in payslips" :key="ps.id" class="p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-750/30 transition-colors">
            <div>
              <p class="font-semibold text-gray-900 dark:text-white text-sm">{{ monthNames[(ps.period_month || 1) - 1] }} {{ ps.period_year }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ ps.working_days || 0 }} days · OT {{ ps.total_overtime || 0 }} hrs</p>
            </div>
            <div class="text-right">
              <p class="font-bold text-blue-700 dark:text-blue-400">{{ fmtRp(ps.net_salary) }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">Gross {{ fmtRp(ps.gross_salary) }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../../lib/api';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const nikInput = ref('');
const loginError = ref('');
const employee = ref<any>(null);
const payslips = ref<any[]>([]);
const checkedIn = ref(false);
const checkinTime = ref('');
const checkingIn = ref(false);

const todayFormatted = computed(() => new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));

const getInitials = (name: string) => name ? name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : '??';
const fmtRp = (v: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);

const loginByNik = async () => {
  loginError.value = '';
  try {
    const res = await api.post('/hr/mobile/login', { nik: nikInput.value });
    employee.value = res.data?.data || res.data?.employee;
    if (employee.value) {
      localStorage.setItem('mobile_employee', JSON.stringify(employee.value));
      await fetchPayslips();
    } else {
      loginError.value = 'NIK not found. Please check your employee code.';
    }
  } catch (err: any) {
    loginError.value = err.response?.data?.error || 'Login failed';
  }
};

const logout = () => {
  employee.value = null;
  payslips.value = [];
  localStorage.removeItem('mobile_employee');
};

const fetchPayslips = async () => {
  if (!employee.value) return;
  try {
    const res = await api.get(`/hr/mobile/payslip/${employee.value.id}`);
    payslips.value = res.data?.data || [];
  } catch { payslips.value = []; }
};

const doCheckin = async () => {
  checkingIn.value = true;
  try {
    let lat = null, lng = null;
    // Try getting GPS
    if (navigator.geolocation) {
      try {
        const pos: GeolocationPosition = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch { /* GPS not available, continue without */ }
    }

    await api.post('/hr/mobile/checkin', {
      employee_id: employee.value.id,
      gps_lat: lat,
      gps_lng: lng,
    });
    checkedIn.value = true;
    checkinTime.value = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch (err: any) {
    alert(err.response?.data?.error || 'Check-in failed');
  } finally {
    checkingIn.value = false;
  }
};

onMounted(() => {
  const saved = localStorage.getItem('mobile_employee');
  if (saved) {
    try {
      employee.value = JSON.parse(saved);
      fetchPayslips();
    } catch { /* ignore */ }
  }
});
</script>
