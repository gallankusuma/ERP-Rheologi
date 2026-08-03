<template>
  <div class="min-h-screen bg-[#f4f6fb] font-sans text-slate-600">
    <!-- Header -->
    <div class="bg-white border-b border-gray-100 sticky top-0 z-20">
      <div class="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <div class="flex items-center gap-4">
            <h1 class="text-xl font-bold text-slate-800 tracking-tight">📋 CRM Tasks</h1>
            <span class="text-sm text-slate-400">Monitor all outstanding tasks across CRM</span>
          </div>
          <button @click="loadTasks" class="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium px-3 py-2 rounded-lg transition-all">
            <svg class="w-4 h-4" :class="{ 'animate-spin': loading }" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Refresh
          </button>
        </div>
      </div>
    </div>

    <div class="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <!-- Summary Cards -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div @click="filterStatus = 'all'" class="bg-white rounded-xl p-4 border border-slate-200 cursor-pointer transition-all hover:shadow-md" :class="filterStatus === 'all' ? 'ring-2 ring-blue-500 border-blue-200' : ''">
          <div class="text-xs font-medium text-slate-500 uppercase tracking-wider">All Tasks</div>
          <div class="text-3xl font-bold text-slate-800 mt-1">{{ summary.total }}</div>
        </div>
        <div @click="filterStatus = 'open'" class="bg-white rounded-xl p-4 border border-slate-200 cursor-pointer transition-all hover:shadow-md" :class="filterStatus === 'open' ? 'ring-2 ring-amber-500 border-amber-200' : ''">
          <div class="text-xs font-medium text-amber-600 uppercase tracking-wider">To Do</div>
          <div class="text-3xl font-bold text-amber-700 mt-1">{{ summary.todo }}</div>
        </div>
        <div @click="filterStatus = 'open'" class="bg-white rounded-xl p-4 border border-slate-200 cursor-pointer transition-all hover:shadow-md" :class="filterStatus === 'in_progress' ? 'ring-2 ring-blue-500 border-blue-200' : ''">
          <div class="text-xs font-medium text-blue-600 uppercase tracking-wider">In Progress</div>
          <div class="text-3xl font-bold text-blue-700 mt-1">{{ summary.in_progress }}</div>
        </div>
        <div @click="filterStatus = 'overdue'" class="bg-white rounded-xl p-4 border border-slate-200 cursor-pointer transition-all hover:shadow-md" :class="filterStatus === 'overdue' ? 'ring-2 ring-red-500 border-red-200' : ''">
          <div class="text-xs font-medium text-red-600 uppercase tracking-wider flex items-center gap-1">
            <span class="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            Overdue
          </div>
          <div class="text-3xl font-bold text-red-700 mt-1">{{ summary.overdue }}</div>
        </div>
        <div @click="filterStatus = 'done'" class="bg-white rounded-xl p-4 border border-slate-200 cursor-pointer transition-all hover:shadow-md" :class="filterStatus === 'done' ? 'ring-2 ring-green-500 border-green-200' : ''">
          <div class="text-xs font-medium text-green-600 uppercase tracking-wider">Done</div>
          <div class="text-3xl font-bold text-green-700 mt-1">{{ summary.done }}</div>
        </div>
      </div>

      <!-- Source Breakdown -->
      <div class="flex items-center gap-4 flex-wrap">
        <span class="text-sm font-medium text-slate-500">Source:</span>
        <button v-for="src in sourceOptions" :key="src.value" @click="filterSource = src.value" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all" :class="filterSource === src.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'">
          <span>{{ src.icon }}</span>
          {{ src.label }}
          <span v-if="src.value !== 'all'" class="bg-white/20 text-[10px] px-1.5 py-0.5 rounded-full">{{ getSourceCount(src.value) }}</span>
        </button>
        <div class="ml-auto flex items-center gap-3">
          <div class="relative">
            <input v-model="searchQuery" @input="debouncedSearch" type="text" placeholder="Search tasks..." class="w-64 pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
            <svg class="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="text-center py-16">
        <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p class="text-sm text-slate-400">Loading tasks...</p>
      </div>

      <!-- Tasks Table -->
      <div v-else class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table class="min-w-full divide-y divide-slate-100">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Source</th>
              <th class="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Task</th>
              <th class="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Project / Ref</th>
              <th class="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Client</th>
              <th class="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned</th>
              <th class="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Priority</th>
              <th class="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Due Date</th>
              <th class="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th class="px-5 py-3.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 bg-white">
            <tr v-for="task in tasks" :key="task.source + '-' + task.id" class="group hover:bg-blue-50/30 transition-colors">
              <td class="px-5 py-3.5">
                <span :class="sourceClass(task.source)" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider">
                  {{ sourceIcon(task.source) }} {{ sourceLabel(task.source) }}
                </span>
              </td>
              <td class="px-5 py-3.5">
                <div class="text-sm font-medium text-slate-800 max-w-xs truncate">{{ task.title }}</div>
                <div v-if="task.description" class="text-xs text-slate-400 max-w-xs truncate mt-0.5">{{ task.description }}</div>
              </td>
              <td class="px-5 py-3.5">
                <button @click="navigateToRef(task)" class="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium truncate max-w-[180px] block text-left">
                  {{ task.ref_name || '-' }}
                </button>
                <div v-if="task.ref_code" class="text-[10px] text-slate-400 font-mono">{{ task.ref_code }}</div>
              </td>
              <td class="px-5 py-3.5 text-sm text-slate-600">{{ task.client_name || '-' }}</td>
              <td class="px-5 py-3.5 text-sm text-slate-600">{{ task.assigned_name || '-' }}</td>
              <td class="px-5 py-3.5">
                <span :class="priorityClass(task.priority)" class="px-2 py-0.5 text-xs font-semibold rounded-full">{{ task.priority }}</span>
              </td>
              <td class="px-5 py-3.5">
                <div class="text-sm" :class="isOverdue(task) ? 'text-red-600 font-semibold' : 'text-slate-600'">
                  {{ formatDate(task.due_date) }}
                </div>
                <div v-if="isOverdue(task)" class="text-[10px] text-red-500 mt-0.5">{{ daysOverdue(task.due_date) }} days overdue</div>
              </td>
              <td class="px-5 py-3.5">
                <span :class="statusClass(task.status)" class="px-2.5 py-1 text-xs font-semibold rounded-full">{{ task.status }}</span>
              </td>
              <td class="px-5 py-3.5 text-center">
                <button @click="navigateToRef(task)" class="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="View">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                </button>
              </td>
            </tr>
            <tr v-if="!tasks.length && !loading">
              <td colspan="9" class="px-5 py-16 text-center">
                <div class="text-4xl mb-2">✅</div>
                <div class="text-sm text-slate-500">No tasks found</div>
                <div class="text-xs text-slate-400 mt-1">All clear! No outstanding tasks.</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/lib/api';

const router = useRouter();
const tasks = ref<any[]>([]);
const loading = ref(true);
const filterStatus = ref('all');
const filterSource = ref('all');
const searchQuery = ref('');
const summary = ref({ total: 0, todo: 0, in_progress: 0, overdue: 0, done: 0, by_source: { project_task: 0, prospect: 0, lead: 0 } });

const sourceOptions = [
  { value: 'all', label: 'All', icon: '📊' },
  { value: 'project_task', label: 'Project', icon: '📁' },
  { value: 'prospect', label: 'Prospect', icon: '🎯' },
  { value: 'lead', label: 'Lead', icon: '💼' },
];

const loadTasks = async () => {
  loading.value = true;
  try {
    const params: any = {};
    if (filterStatus.value !== 'all') params.status = filterStatus.value;
    if (filterSource.value !== 'all') params.source = filterSource.value;
    if (searchQuery.value) params.search = searchQuery.value;

    const res = await api.get('/crm/tasks', { params });
    tasks.value = res.data?.data || [];
    summary.value = res.data?.summary || summary.value;
  } catch (err) {
    console.error('Failed to load tasks:', err);
    tasks.value = [];
  } finally {
    loading.value = false;
  }
};

const getSourceCount = (source: string) => {
  const map: any = summary.value.by_source;
  return map[source] || 0;
};

let timeout: any;
const debouncedSearch = () => {
  clearTimeout(timeout);
  timeout = setTimeout(loadTasks, 300);
};

watch([filterStatus, filterSource], () => loadTasks());

const navigateToRef = (task: any) => {
  if (task.source === 'project_task') {
    router.push(`/projects/${task.ref_id}`);
  } else if (task.source === 'prospect') {
    router.push('/project/prospects');
  } else if (task.source === 'lead') {
    router.push(`/leads/${task.ref_id}`);
  }
};

const sourceIcon = (s: string) => ({ project_task: '📁', prospect: '🎯', lead: '💼' }[s] || '📋');
const sourceLabel = (s: string) => ({ project_task: 'Project', prospect: 'Prospect', lead: 'Lead' }[s] || s);
const sourceClass = (s: string) => ({
  project_task: 'bg-blue-100 text-blue-700',
  prospect: 'bg-purple-100 text-purple-700',
  lead: 'bg-amber-100 text-amber-700',
}[s] || 'bg-slate-100 text-slate-700');

const priorityClass = (p: string) => ({
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-amber-100 text-amber-700',
  Low: 'bg-green-100 text-green-700',
}[p] || 'bg-slate-100 text-slate-700');

const statusClass = (s: string) => ({
  'To Do': 'bg-amber-100 text-amber-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  'Overdue': 'bg-red-100 text-red-700',
  'Done': 'bg-green-100 text-green-700',
}[s] || 'bg-slate-100 text-slate-700');

const isOverdue = (task: any) => {
  if (task.status === 'Done') return false;
  if (!task.due_date) return false;
  return new Date(task.due_date) < new Date(new Date().toISOString().split('T')[0]);
};

const daysOverdue = (dueDate: string) => {
  if (!dueDate) return 0;
  const diff = Date.now() - new Date(dueDate).getTime();
  return Math.floor(diff / 86400000);
};

const formatDate = (date: string) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

onMounted(loadTasks);
</script>
