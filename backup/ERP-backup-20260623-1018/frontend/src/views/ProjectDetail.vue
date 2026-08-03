<template>
  <div class="min-h-screen bg-gray-50 flex flex-col" v-if="project">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200 sticky top-0 z-20">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div class="flex justify-between items-start">
          <div>
            <div class="flex items-center gap-2 mb-2 text-sm">
              <button @click="$router.push('/projects')" class="text-gray-500 hover:text-gray-700 font-medium">
                Projects
              </button>
              <span class="text-gray-300">/</span>
              <span class="text-gray-500">{{ project.project_number }}</span>
            </div>
            <div class="flex items-center gap-3">
              <h1 class="text-2xl font-bold text-gray-900">{{ project.title }}</h1>
               <span class="px-2.5 py-0.5 rounded-full text-xs font-medium capitalize" :class="getStatusColor(project.status)">
                {{ project.status?.replace('_', ' ') }}
              </span>
            </div>
          </div>
          
          <div class="flex gap-3">
             <button @click="openEditProject()" class="bg-white border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
              <span>✏️</span> Edit
            </button>
            <div class="relative" ref="actionsDropdownRef">
              <button @click="showActionsDropdown = !showActionsDropdown" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2">
                <span>⚡</span> Actions
              </button>
              <div v-if="showActionsDropdown" class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-30">
                <button @click="changeProjectStatus('in_progress'); showActionsDropdown=false" class="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-gray-700">▶️ Mark In Progress</button>
                <button @click="changeProjectStatus('completed'); showActionsDropdown=false" class="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-gray-700">✅ Mark Completed</button>
                <button @click="changeProjectStatus('hold'); showActionsDropdown=false" class="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-gray-700">⏸️ Put On Hold</button>
                <hr class="my-1 border-gray-200">
                <button @click="deleteProject(); showActionsDropdown=false" class="w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-red-600">🗑️ Delete Project</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <div class="mt-8 flex gap-6 overflow-x-auto no-scrollbar border-b border-gray-200">
           <button 
            v-for="tab in tabs" 
            :key="tab.id"
            class="pb-3 text-sm font-medium whitespace-nowrap transition-all border-b-2"
            :class="activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Content -->
    <main class="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      
      <!-- Overview Tab -->
      <div v-if="activeTab === 'overview'" class="space-y-6">
        <!-- Stats Grid -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <div class="text-sm text-gray-500 mb-1">Total Tasks</div>
             <div class="flex items-end justify-between">
              <div class="text-2xl font-bold text-gray-800">{{ tasks.length }}</div>
               <span class="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">{{ tasksByStatus['In Progress']?.length || 0 }} active</span>
             </div>
             <div class="w-full bg-gray-100 rounded-full h-1.5 mt-3">
                  <div class="bg-blue-500 h-1.5 rounded-full transition-all" :style="{ width: `${taskCompletionPct}%` }"></div>
              </div>
          </div>
           <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <div class="text-sm text-gray-500 mb-1">Tasks Completed</div>
             <div class="flex items-end justify-between">
              <div class="text-2xl font-bold text-gray-800">{{ tasksByStatus['Done']?.length || 0 }}/{{ tasks.length }}</div>
               <span class="text-xs text-gray-500">{{ taskCompletionPct }}% Done</span>
             </div>
              <div class="w-full bg-gray-100 rounded-full h-1.5 mt-3">
                  <div class="bg-green-500 h-1.5 rounded-full transition-all" :style="{ width: `${taskCompletionPct}%` }"></div>
              </div>
          </div>
          <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <div class="text-sm text-gray-500 mb-1">Budget</div>
             <div class="flex items-end justify-between">
              <div class="text-2xl font-bold text-gray-800">{{ formatCurrency(costSummary.total_expenses || 0) }}</div>
               <span class="text-xs text-gray-500">of {{ formatCurrency(project.price) }}</span>
             </div>
             <div class="w-full bg-gray-100 rounded-full h-1.5 mt-3">
                  <div class="bg-yellow-500 h-1.5 rounded-full transition-all" :style="{ width: `${budgetPct}%` }"></div>
              </div>
          </div>
           <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <div class="text-sm text-gray-500 mb-1">Milestones</div>
             <div class="flex items-end justify-between">
              <div class="text-2xl font-bold text-gray-800">{{ milestones.length }}</div>
               <span class="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded">{{ milestones.filter((m: any) => m.status === 'Completed').length }} done</span>
             </div>
             <div class="w-full bg-gray-100 rounded-full h-1.5 mt-3">
                  <div class="bg-emerald-500 h-1.5 rounded-full transition-all" :style="{ width: `${milestonePct}%` }"></div>
              </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div class="lg:col-span-2 space-y-6">
             <!-- Description -->
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 class="font-bold text-gray-800 mb-4">Project Description</h3>
              <p class="text-gray-600 leading-relaxed">{{ project.description || 'No description provided.' }}</p>
            </div>
            
             <!-- Recent Activity -->
             <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 class="font-bold text-gray-800 mb-4">Recent Activity</h3>
              <div class="space-y-4" v-if="recentActivity.length">
                 <div v-for="act in recentActivity" :key="act.id + '-' + act.type" class="flex gap-3">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      :class="act.type === 'task' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'">
                      {{ act.type === 'task' ? '📋' : '🏁' }}
                    </div>
                    <div>
                      <p class="text-sm text-gray-800">
                        <span class="font-medium">{{ act.title }}</span>
                        <span class="text-gray-500"> — {{ act.status }}</span>
                        <span v-if="act.assigned_name" class="text-gray-400"> · {{ act.assigned_name }}</span>
                      </p>
                      <p class="text-xs text-gray-500 mt-1">{{ timeAgo(act.updated_at) }}</p>
                    </div>
                 </div>
              </div>
              <p v-else class="text-sm text-gray-400">No activity yet. Create tasks or milestones to see activity here.</p>
            </div>
          </div>

          <div class="space-y-6">
            <!-- Details Card -->
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
               <h3 class="font-bold text-gray-800 mb-4">Details</h3>
               <dl class="space-y-4 text-sm">
                <div class="flex justify-between border-b border-gray-100 pb-2">
                  <dt class="text-gray-500">Client</dt>
                  <dd class="font-medium text-blue-600">{{ project.client_name || 'N/A' }}</dd>
                </div>
                <div class="flex justify-between border-b border-gray-100 pb-2">
                  <dt class="text-gray-500">Start Date</dt>
                  <dd class="font-medium">{{ formatDate(project.start_date) }}</dd>
                </div>
                <div class="flex justify-between border-b border-gray-100 pb-2">
                  <dt class="text-gray-500">Deadline</dt>
                  <dd class="font-medium text-red-600">{{ formatDate(project.deadline) }}</dd>
                </div>
                 <div class="flex justify-between border-b border-gray-100 pb-2">
                  <dt class="text-gray-500">Priority</dt>
                  <dd class="font-medium text-orange-600">High</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <!-- Tasks List Tab -->
      <div v-if="activeTab === 'tasks-list'">
         <div class="flex justify-between mb-6">
          <h3 class="text-lg font-bold text-gray-800">Tasks</h3>
          <button 
            @click="openTaskModal()"
            class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            + Add Task
          </button>
        </div>
        <ProjectTasksList 
          :tasks="tasks" 
          @editTask="openTaskModal" 
          @deleteTask="deleteTask"
        />
      </div>

      <!-- Tasks Kanban Tab -->
      <div v-if="activeTab === 'tasks-kanban'">
         <div class="flex justify-between mb-6">
          <h3 class="text-lg font-bold text-gray-800">Task Board</h3>
           <button 
            @click="openTaskModal()"
            class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            + Add Task
          </button>
        </div>
        <ProjectKanban 
          :tasks="tasks" 
          @editTask="openTaskModal" 
          @updateTaskStatus="updateTaskStatus"
          @deleteTask="deleteTask"
        />
      </div>

      <!-- Milestones Tab -->
      <div v-if="activeTab === 'milestones'">
        <ProjectMilestones 
          :milestones="milestones" 
          @addMilestone="openMilestoneModal" 
          @editMilestone="openMilestoneModal" 
          @deleteMilestone="deleteMilestone"
        />
      </div>

      <!-- Gantt Tab -->
      <div v-if="activeTab === 'gantt'">
        <ProjectGantt :tasks="tasks" :milestones="milestones" />
      </div>

      <!-- Notes Tab -->
      <div v-if="activeTab === 'notes'">
        <ProjectNotes />
      </div>

      <!-- Files Tab -->
      <div v-if="activeTab === 'files'">
        <ProjectFiles 
          :projectId="route.params.id as string"
        />
      </div>

       <!-- Comments Tab -->
      <div v-if="activeTab === 'comments'">
        <ProjectComments />
      </div>

      <!-- Timesheets Tab -->
      <div v-if="activeTab === 'timesheets'">
        <ProjectTimesheets />
      </div>

       <!-- Expenses Tab -->
      <div v-if="activeTab === 'expenses'">
        <ProjectExpenses />
      </div>

      <!-- Cost Control Tab -->
      <div v-if="activeTab === 'cost-control'">
        <ProjectCostControl :projectId="route.params.id as string" />
      </div>

    </main>
    
    <!-- Task Modal -->
    <TaskModal 
      v-if="showTaskModal" 
      :task="editingTask" 
      :users="users"
      @close="showTaskModal = false"
      @save="saveTask"
    />

    <!-- Milestone Modal -->
    <MilestoneModal 
      v-if="showMilestoneModal" 
      :milestone="editingMilestone" 
      @close="showMilestoneModal = false"
      @save="saveMilestone"
    />

    <!-- Edit Project Modal -->
    <div v-if="showEditProjectModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showEditProjectModal = false">
      <div class="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
          <h3 class="text-lg font-bold text-gray-900">Edit Project</h3>
        </div>
        <div class="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">Project Title *</label>
              <input v-model="editForm.title" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div class="col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea v-model="editForm.description" rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select v-model="editForm.status" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="hold">On Hold</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Budget</label>
              <input v-model="editForm.price" type="number" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input v-model="editForm.start_date" type="date" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
              <input v-model="editForm.deadline" type="date" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>
        <div class="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
          <button @click="showEditProjectModal = false" class="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100">Cancel</button>
          <button @click="saveProjectEdit" :disabled="savingProject" class="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
            {{ savingProject ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </div>
    </div>

  </div>
  <div v-else class="min-h-screen flex items-center justify-center bg-gray-50">
     <div class="text-center">
       <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
       <p class="text-gray-500">Loading Project Details...</p>
     </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/lib/api';
import ProjectKanban from '@/components/projects/ProjectKanban.vue';
import ProjectTasksList from '@/components/projects/ProjectTasksList.vue';
import TaskModal from '@/components/projects/TaskModal.vue';
import ProjectMilestones from '@/components/projects/ProjectMilestones.vue';
import MilestoneModal from '@/components/projects/MilestoneModal.vue';
import ProjectFiles from '@/components/projects/ProjectFiles.vue';
// New Components
import ProjectGantt from '@/components/projects/ProjectGantt.vue';
import ProjectNotes from '@/components/projects/ProjectNotes.vue';
import ProjectExpenses from '@/components/projects/ProjectExpenses.vue';
import ProjectTimesheets from '@/components/projects/ProjectTimesheets.vue';
import ProjectComments from '@/components/projects/ProjectComments.vue';
import ProjectCostControl from '@/components/projects/ProjectCostControl.vue';
import { formatCurrency } from '@/utils/format';

const route = useRoute();
const router = useRouter();
const project = ref<any>(null);
const activeTab = ref('overview');

const tasks = ref<any[]>([]);
const milestones = ref<any[]>([]);
const users = ref<any[]>([]);
const loadingTasks = ref(false);
const showTaskModal = ref(false);
const editingTask = ref<any>(null);
const showMilestoneModal = ref(false);
const editingMilestone = ref<any>(null);
const showEditProjectModal = ref(false);
const showActionsDropdown = ref(false);
const savingProject = ref(false);
const actionsDropdownRef = ref<HTMLElement | null>(null);
const editForm = ref({
  title: '',
  description: '',
  status: '',
  price: 0,
  start_date: '',
  deadline: ''
});

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'cost-control', label: 'Cost Control' },
  { id: 'tasks-list', label: 'Tasks List' },
  { id: 'tasks-kanban', label: 'Tasks Kanban' },
  // { id: 'milestones', label: 'Milestones' }, // disabled
  { id: 'gantt', label: 'Gantt' },
  { id: 'notes', label: 'Notes' },
  { id: 'files', label: 'Files' },
  { id: 'comments', label: 'Comments' },
  { id: 'timesheets', label: 'Timesheets' },
  { id: 'expenses', label: 'Expenses' }
];

const costSummary = ref<any>({});

const tasksByStatus = computed(() => {
  const grouped: Record<string, any[]> = {};
  tasks.value.forEach((t: any) => {
    const s = t.status || 'To Do';
    if (!grouped[s]) grouped[s] = [];
    grouped[s].push(t);
  });
  return grouped;
});

const taskCompletionPct = computed(() => {
  if (tasks.value.length === 0) return 0;
  const done = tasks.value.filter((t: any) => t.status === 'Done').length;
  return Math.round((done / tasks.value.length) * 100);
});

const budgetPct = computed(() => {
  const budget = project.value?.price || 1;
  const spent = costSummary.value?.total_expenses || 0;
  return Math.min(100, Math.round((spent / budget) * 100));
});

const milestonePct = computed(() => {
  if (milestones.value.length === 0) return 0;
  const done = milestones.value.filter((m: any) => m.status === 'Completed').length;
  return Math.round((done / milestones.value.length) * 100);
});

const recentActivity = computed(() => {
  const items: any[] = [];
  tasks.value.forEach((t: any) => items.push({ ...t, type: 'task', assigned_name: t.assigned_name || '' }));
  milestones.value.forEach((m: any) => items.push({ ...m, type: 'milestone' }));
  items.sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime());
  return items.slice(0, 6);
});

const timeAgo = (dateStr: string) => {
  if (!dateStr) return '';
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};

const loadProject = async () => {
  const projectId = route.params.id;
  try {
    const res = await api.get(`/projects/${projectId}`);
    const p = res.data;
    project.value = {
      ...p,
      title: p.title || p.project_name,
      price: p.price || p.budget,
      deadline: p.deadline || p.end_date,
      members: p.members || []
    };
  } catch (err) {
    console.error('Failed to load project:', err);
  }
};

const loadTasks = async () => {
  if (!project.value) return;
  loadingTasks.value = true;
  try {
    const res = await api.get(`/projects/${project.value.id}/tasks`);
    tasks.value = Array.isArray(res.data) ? res.data : (res.data?.data || []);
  } catch (err) {
    console.error('Failed to load tasks:', err);
    tasks.value = [];
  } finally {
    loadingTasks.value = false;
  }
};

const loadMilestones = async () => {
  if (!project.value) return;
  try {
    const res = await api.get(`/projects/${project.value.id}/milestones`);
    milestones.value = Array.isArray(res.data) ? res.data : (res.data?.data || []);
  } catch (err) {
    console.error('Failed to load milestones:', err);
    milestones.value = [];
  }
};

const loadCostSummary = async () => {
  if (!project.value) return;
  try {
    const res = await api.get(`/projects/${project.value.id}/cost-summary`);
    costSummary.value = res.data || {};
  } catch (err) {
    console.error('Failed to load cost summary:', err);
    costSummary.value = {};
  }
};

const loadMetadata = async () => {
  try {
    const res = await api.get('/users');
    const payload = res.data;
    users.value = Array.isArray(payload) ? payload : (payload?.data || []);
  } catch (err) {
    console.error('Failed to load users:', err);
    users.value = [];
  }
};

const openTaskModal = (task: any = null) => {
  editingTask.value = task;
  showTaskModal.value = true;
};

const saveTask = async (taskData: any) => {
  try {
    if (editingTask.value) {
      await api.put(`/projects/tasks/${editingTask.value.id}`, taskData);
    } else {
      await api.post(`/projects/${project.value.id}/tasks`, taskData);
    }
    showTaskModal.value = false;
    loadTasks();
    if (activeTab.value === 'milestones') loadMilestones();
  } catch (error) {
    console.error('Failed to save task:', error);
    alert('Failed to save task');
  }
};

const updateTaskStatus = async (taskId: number, newStatus: string) => {
  try {
    const task = tasks.value.find(t => t.id === taskId);
    if (task) {
      task.status = newStatus;
      await api.put(`/projects/tasks/${taskId}`, { ...task, status: newStatus });
    }
    if (activeTab.value === 'milestones') loadMilestones();
  } catch (error) {
    console.error('Failed to update task status:', error);
    loadTasks();
  }
};

const deleteTask = async (taskId: number) => {
  if (!confirm('Are you sure you want to delete this task?')) return;
  try {
    await api.delete(`/projects/tasks/${taskId}`);
    loadTasks();
    if (activeTab.value === 'milestones') loadMilestones();
  } catch (error) {
    console.error('Failed to delete task:', error);
  }
};

const openMilestoneModal = (milestone: any = null) => {
  editingMilestone.value = milestone;
  showMilestoneModal.value = true;
};

const saveMilestone = async (milestoneData: any) => {
  try {
    if (editingMilestone.value) {
      await api.put(`/projects/milestones/${editingMilestone.value.id}`, milestoneData);
    } else {
      await api.post(`/projects/${project.value.id}/milestones`, milestoneData);
    }
    showMilestoneModal.value = false;
    loadMilestones();
  } catch (error) {
    console.error('Failed to save milestone:', error);
    alert('Failed to save milestone');
  }
};

const deleteMilestone = async (milestoneId: number) => {
  if (!confirm('Are you sure you want to delete this milestone?')) return;
  try {
    await api.delete(`/projects/milestones/${milestoneId}`);
    loadMilestones();
  } catch (error) {
    console.error('Failed to delete milestone:', error);
  }
};


const getStatusColor = (status: string) => {
  switch (status) {
    case 'open': return 'bg-blue-100 text-blue-800';
    case 'in_progress': return 'bg-yellow-100 text-yellow-800';
    case 'completed': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-600';
  }
};

const formatDate = (date: string) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};


const openEditProject = () => {
  if (!project.value) return;
  editForm.value = {
    title: project.value.title || project.value.project_name || '',
    description: project.value.description || '',
    status: project.value.status || 'open',
    price: project.value.price || project.value.budget || 0,
    start_date: project.value.start_date ? project.value.start_date.split('T')[0] : '',
    deadline: (project.value.deadline || project.value.end_date || '').split('T')[0] || ''
  };
  showEditProjectModal.value = true;
};

const saveProjectEdit = async () => {
  savingProject.value = true;
  try {
    await api.put(`/projects/${project.value.id}`, editForm.value);
    showEditProjectModal.value = false;
    await loadProject();
  } catch (error) {
    console.error('Failed to save project:', error);
    alert('Failed to save project');
  } finally {
    savingProject.value = false;
  }
};

const changeProjectStatus = async (newStatus: string) => {
  try {
    await api.put(`/projects/${project.value.id}`, {
      title: project.value.title,
      description: project.value.description,
      status: newStatus,
      price: project.value.price,
      start_date: project.value.start_date,
      deadline: project.value.deadline
    });
    await loadProject();
  } catch (error) {
    console.error('Failed to change status:', error);
  }
};

const deleteProject = async () => {
  if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) return;
  try {
    await api.delete(`/projects/${project.value.id}`);
    router.push('/projects');
  } catch (error: any) {
    console.error('Failed to delete project:', error);
    alert(error?.response?.data?.error || 'Failed to delete project');
  }
};

// Simplified watch logic
watch(activeTab, (newTab) => {
  if (newTab === 'tasks-list' || newTab === 'tasks-kanban') {
    loadTasks();
  } else if (newTab === 'milestones') {
    loadMilestones();
  }
});

onMounted(() => {
  loadProject();
  loadMetadata();
});

watch(project, (newProject) => {
  if (newProject) {
    loadTasks();
    loadMilestones();
    loadCostSummary();
  }
});
</script>
