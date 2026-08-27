<template>
  <div class="space-y-6">
    <section class="rounded-3xl border border-teal-100 bg-gradient-to-br from-slate-950 via-teal-950 to-emerald-900 p-6 text-white shadow-xl">
      <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.35em] text-teal-200">Shift & Roster Engine</p>
          <h1 class="mt-2 text-3xl font-black">Factory 2-2-2-2 Rotation</h1>
          <p class="mt-2 max-w-2xl text-sm text-teal-50/80">
            Preview manpower Group A-D, shift pagi/sore/malam, off day, dan coverage per tanggal sebelum masuk ke attendance dan payroll.
          </p>
        </div>
        <div class="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur md:grid-cols-3">
          <label class="text-xs font-bold uppercase tracking-wider text-teal-50/70">
            Start Date
            <input v-model="startDate" type="date" class="mt-1 w-full rounded-xl border border-white/10 bg-white/90 px-3 py-2 text-sm text-slate-900 outline-none" />
          </label>
          <label class="text-xs font-bold uppercase tracking-wider text-teal-50/70">
            Days
            <select v-model.number="days" class="mt-1 w-full rounded-xl border border-white/10 bg-white/90 px-3 py-2 text-sm text-slate-900 outline-none">
              <option :value="7">7</option>
              <option :value="14">14</option>
              <option :value="21">21</option>
              <option :value="31">31</option>
            </select>
          </label>
          <button @click="fetchRoster" class="col-span-2 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 shadow-lg hover:bg-emerald-300 md:col-span-1 md:self-end">
            Refresh
          </button>
        </div>
      </div>

      <div class="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div v-for="stat in stats" :key="stat.label" class="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
          <p class="text-xs uppercase tracking-wider text-teal-100/70">{{ stat.label }}</p>
          <p class="mt-1 text-2xl font-black">{{ stat.value }}</p>
          <p class="mt-1 text-xs text-teal-50/70">{{ stat.caption }}</p>
        </div>
      </div>
    </section>

    <section class="grid grid-cols-1 gap-4 lg:grid-cols-4">
      <div v-for="shift in shifts" :key="shift.code" class="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-black uppercase tracking-wider text-gray-500">{{ shift.code }}</p>
            <h2 class="mt-1 text-lg font-black text-gray-900 dark:text-white">{{ shift.name }}</h2>
          </div>
          <span :class="['rounded-2xl px-3 py-1 text-xs font-black', shiftBadge(shift.code)]">{{ shift.paid_hours }}h</span>
        </div>
        <p class="mt-3 text-sm text-gray-500 dark:text-gray-400">
          {{ shift.start_time && shift.end_time ? `${shortTime(shift.start_time)} - ${shortTime(shift.end_time)}` : 'Rest day' }}
          <span v-if="shift.crosses_midnight" class="font-semibold text-indigo-600"> · cross-midnight</span>
        </p>
      </div>
    </section>

    <section class="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div class="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-wider text-emerald-600">Rotation Calendar</p>
          <h2 class="text-xl font-black text-gray-900 dark:text-white">Roster Preview</h2>
        </div>
        <p class="text-xs text-gray-500">Pattern {{ roster?.pattern || 'FACTORY_2222' }} · Anchor {{ roster?.anchor_date || '-' }}</p>
      </div>

      <div v-if="loading" class="py-16 text-center text-gray-500">Loading roster...</div>
      <div v-else class="space-y-4">
        <article v-for="day in schedule" :key="day.date" class="rounded-3xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
          <div class="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p class="text-xs font-bold uppercase tracking-wider text-gray-500">Day {{ day.day_index + 1 }}</p>
              <h3 class="text-lg font-black text-gray-900 dark:text-white">{{ formatDate(day.date) }}</h3>
            </div>
            <div class="flex flex-wrap gap-2">
              <span v-for="(count, code) in day.coverage" :key="code" :class="['rounded-full px-3 py-1 text-xs font-black', shiftBadge(String(code))]">
                {{ code }} {{ count }}
              </span>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-3 xl:grid-cols-4">
            <div v-for="group in day.groups" :key="`${day.date}-${group.group}`" class="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-xs font-black uppercase tracking-wider text-gray-500">Group {{ group.group }}</p>
                  <h4 class="mt-1 font-black text-gray-900 dark:text-white">{{ group.shift?.name || group.shift_code }}</h4>
                </div>
                <span :class="['rounded-xl px-3 py-1 text-xs font-black', shiftBadge(group.shift_code)]">{{ group.shift_code }}</span>
              </div>
              <div class="mt-4 space-y-2">
                <div v-for="emp in group.employees.slice(0, 5)" :key="emp.id" class="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-700/60">
                  <div>
                    <p class="text-sm font-bold text-gray-900 dark:text-white">{{ emp.name }}</p>
                    <p class="text-xs text-gray-500">{{ emp.position || emp.department_name || '-' }}</p>
                  </div>
                  <span class="text-xs font-black text-gray-400">{{ emp.code }}</span>
                </div>
                <p v-if="group.employees.length > 5" class="text-xs font-bold text-gray-500">+{{ group.employees.length - 5 }} more employees</p>
                <p v-if="group.employees.length === 0" class="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">No manpower assigned</p>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../../lib/api';

const today = new Date().toISOString().slice(0, 10);
const startDate = ref(today);
const days = ref(14);
const loading = ref(false);
const roster = ref<any>(null);

const shifts = computed(() => roster.value?.shifts || []);
const schedule = computed(() => roster.value?.schedule || []);

const stats = computed(() => {
  const firstDay = schedule.value[0];
  const groupCount = firstDay?.groups?.reduce((acc: number, group: any) => acc + group.employees.length, 0) || 0;
  const nonShift = firstDay?.non_shift?.employees?.length || 0;
  const nightLoad = schedule.value.reduce((acc: number, day: any) => acc + Number(day.coverage?.S3 || 0), 0);
  return [
    { label: 'Roster Days', value: schedule.value.length, caption: 'preview range' },
    { label: 'Shift Manpower', value: groupCount, caption: 'assigned to A-D' },
    { label: 'Non-shift', value: nonShift, caption: 'office/regular' },
    { label: 'Night Load', value: nightLoad, caption: 'total S3 slots' },
  ];
});

const fetchRoster = async () => {
  loading.value = true;
  try {
    const res = await api.get(`/hr/roster/preview?start_date=${startDate.value}&days=${days.value}`);
    roster.value = res.data?.data || null;
  } catch (error) {
    console.error('Failed to fetch roster', error);
    roster.value = null;
  } finally {
    loading.value = false;
  }
};

const shortTime = (value: string) => String(value || '').slice(0, 5);
const formatDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', {
  weekday: 'long',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const shiftBadge = (code: string) => {
  const map: Record<string, string> = {
    S1: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900/40',
    S2: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:ring-sky-900/40',
    S3: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:ring-indigo-900/40',
    OFF: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-600',
  };
  return map[code] || 'bg-gray-100 text-gray-700 ring-1 ring-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:ring-gray-600';
};

onMounted(fetchRoster);
</script>
