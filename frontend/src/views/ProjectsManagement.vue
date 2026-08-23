<template>
  <div class="p-6">
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-3xl font-bold text-gray-800">📂 Projects</h1>
        <p class="text-gray-600 mt-1">Manage all your projects, tasks, and teams.</p>
      </div>
      <div>
        <button 
          @click="openCreateModal"
          class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <span>+ New Project</span>
        </button>
      </div>
    </div>

    <!-- View Mode Toggle & Filters -->
    <div class="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-4 items-center justify-between">
      <div class="flex items-center gap-4 flex-1">
        <div class="relative flex-1 min-w-[200px] max-w-md">
          <span class="absolute left-3 top-2.5 text-gray-400">🔍</span>
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Search projects..." 
            class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
        </div>
        
        <select v-model="statusFilter" class="border border-gray-300 rounded-lg px-4 py-2">
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="hold">On Hold</option>
        </select>

        <select v-model="sortOrder" class="border border-gray-300 rounded-lg px-4 py-2">
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="deadline">Deadline</option>
        </select>
      </div>

      <div class="flex bg-gray-100 rounded-lg p-1">
        <button 
          @click="viewMode = 'grid'"
          class="p-2 rounded-md transition-all"
          :class="viewMode === 'grid' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'"
          title="Grid View"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
        </button>
        <button 
          @click="viewMode = 'list'"
          class="p-2 rounded-md transition-all"
          :class="viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'"
          title="List View"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
        </button>
      </div>
    </div>

    <!-- Projects Content -->
    <div v-if="loading" class="text-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      <p class="mt-4 text-gray-500">Loading projects...</p>
    </div>

    <div v-else-if="filteredProjects.length === 0" class="text-center py-12 bg-white rounded-lg shadow">
      <p class="text-xl text-gray-500">No projects found.</p>
      <button 
        @click="openCreateModal"
        class="mt-4 text-blue-600 hover:text-blue-800 font-medium"
      >
        Create your first project &rarr;
      </button>
    </div>

    <div v-else>
      <!-- Grid View -->
      <div v-if="viewMode === 'grid'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div 
          v-for="project in filteredProjects" 
          :key="project.id" 
          class="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 overflow-hidden cursor-pointer group"
          @click="goToDetail(project.id)"
        >
          <div class="p-5">
            <div class="flex justify-between items-start mb-4">
              <span 
                class="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide"
                :class="getStatusColor(project.status)"
              >
                {{ project.status?.replace('_', ' ') }}
              </span>
              <div class="text-gray-400 group-hover:text-blue-600 transition-colors">
                ➔
              </div>
            </div>
            
            <h3 class="text-xl font-bold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors line-clamp-1">
              {{ project.title }}
            </h3>
            <p class="text-gray-500 text-sm mb-4 line-clamp-2 h-10">
              {{ project.description || 'No description provided.' }}
            </p>

            <div class="flex items-center justify-between text-sm text-gray-600 mb-4">
              <div class="flex items-center gap-1">
                <span>📅</span>
                <span>{{ formatDate(project.deadline) }}</span>
              </div>
              <div class="flex items-center gap-1 font-medium">
                <span>💰</span>
                <span>{{ formatCurrency(project.price) }}</span>
              </div>
            </div>

            <!-- Progress Bar -->
            <div class="w-full bg-gray-100 rounded-full h-2 mb-2">
              <div 
                class="bg-blue-600 h-2 rounded-full transition-all duration-500"
                :style="{ width: `${project.progress || 0}%` }"
              ></div>
            </div>
            <div class="flex justify-between text-xs text-gray-500">
              <span>Progress</span>
              <span>{{ project.progress || 0 }}%</span>
            </div>
          </div>
          
          <div class="bg-gray-50 px-5 py-3 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
            <div>
              Client: <span class="font-medium text-gray-700">{{ project.client_name || 'N/A' }}</span>
            </div>
            <div>
              PM: <span class="font-medium text-gray-700">{{ project.manager_name || 'Unassigned' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- List View -->
      <div v-else class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">ID</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start / Deadline</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Progress</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th scope="col" class="relative px-6 py-3"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr 
              v-for="project in filteredProjects" 
              :key="project.id" 
              class="hover:bg-gray-50 cursor-pointer transition-colors"
              @click="goToDetail(project.id)"
            >
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#{{ project.id }}</td>
              <td class="px-6 py-4">
                <div class="text-sm font-bold text-gray-900">{{ project.title }}</div>
                <div class="text-xs text-gray-500 line-clamp-1">{{ project.description }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-blue-600 hover:underline">
                {{ project.client_name || '-' }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ formatCurrency(project.price) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                <div>{{ formatDate(project.start_date) }}</div>
                <div class="text-red-500 font-medium">{{ formatDate(project.deadline) }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap align-middle">
                <div class="flex items-center gap-3">
                   <div class="w-full bg-gray-200 rounded-full h-1.5 flex-1">
                    <div 
                      class="bg-blue-600 h-1.5 rounded-full" 
                      :style="{ width: `${project.progress || 0}%` }"
                    ></div>
                  </div>
                  <span class="text-xs font-medium text-gray-700 w-8">{{ project.progress || 0 }}%</span>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span 
                  class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full capitalize"
                  :class="getStatusColor(project.status)"
                >
                  {{ project.status?.replace('_', ' ') }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button @click.stop="openEditModal(project)" class="text-gray-400 hover:text-blue-600 mx-1" title="Edit Project">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="text-gray-400 hover:text-red-600 mx-1" title="Delete Project" @click.stop="deleteProject(project.id)">
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
        <h2 class="text-2xl font-bold mb-6">{{ editingProject ? 'Edit Project' : 'Create New Project' }}</h2>
        
        <form @submit.prevent="createProject" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Project Title</label>
              <input v-model="form.title" type="text" required class="w-full border rounded px-3 py-2">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Client <span class="text-red-500">*</span></label>
              <select v-model="form.client_id" required class="w-full border rounded px-3 py-2">
                <option :value="null" disabled>Select Client</option>
                <option v-for="client in clients" :key="client.id" :value="client.id">{{ client.name }}</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea v-model="form.description" rows="3" class="w-full border rounded px-3 py-2"></textarea>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input v-model="form.start_date" type="date" class="w-full border rounded px-3 py-2">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
              <input v-model="form.deadline" type="date" class="w-full border rounded px-3 py-2">
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Budget</label>
              <input v-model="form.price" type="number" class="w-full border rounded px-3 py-2">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Project Manager</label>
              <select v-model="form.assigned_to" class="w-full border rounded px-3 py-2">
                <option :value="null">Select Manager</option>
                <option v-for="user in users" :key="user.id" :value="user.id">{{ user.name }}</option>
              </select>
            </div>
          </div>

          <!-- Product + BOM Link (for MPS/PPIC integration) -->
          <div class="border-t pt-4 mt-2">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">🔗 Product & BOM Link (PPIC Integration)</p>
            <div class="grid grid-cols-3 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Product (BOM)</label>
                <select v-model="form.product_id" class="w-full border rounded px-3 py-2">
                  <option :value="null">-- No Product --</option>
                  <option v-for="p in products" :key="p.id" :value="p.id">📦 {{ p.sku }} - {{ p.name }}</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input v-model="form.quantity" type="number" step="0.01" class="w-full border rounded px-3 py-2" placeholder="0">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">UOM</label>
                <input v-model="form.uom" type="text" class="w-full border rounded px-3 py-2" placeholder="kg, ltr, drum...">
              </div>
            </div>
            <div v-if="selectedBom" class="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              <span class="font-semibold text-blue-700">✅ BOM Linked:</span>
              <span class="text-blue-600 ml-1">{{ selectedBom.bom_name }} (BOM #{{ selectedBom.bom_id }})</span>
              <span class="text-gray-500 ml-2">• Status: {{ selectedBom.bom_status }}</span>
            </div>
            <p v-if="form.product_id && !selectedBom" class="mt-2 text-xs text-amber-600">⚠️ Product selected but no active BOM found</p>
            <p v-if="!form.product_id" class="mt-2 text-xs text-gray-400">Only products with active BOM are shown. Link a product for MPS/MRP integration.</p>
          </div>

          <div class="flex justify-end gap-3 mt-6">
            <button type="button" @click="showCreateModal = false" class="px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
            <button type="submit" class="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">{{ editingProject ? 'Save Changes' : 'Create Project' }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-red-600"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </div>
          <h3 class="text-lg font-semibold text-gray-900">Delete Project</h3>
        </div>
        <p class="text-gray-600 mb-6">Are you sure you want to delete this project? This action cannot be undone.</p>
        <div class="flex justify-end gap-3">
          <button @click="showDeleteModal = false; deleteTargetId = null" class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">Cancel</button>
          <button @click="confirmDelete" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700" :disabled="deleting">{{ deleting ? 'Deleting...' : 'Delete' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/lib/api';
import { formatCurrency } from '@/utils/format';

const router = useRouter();
const projects = ref<any[]>([]);
const clients = ref<any[]>([]);
const users = ref<any[]>([]);
const products = ref<any[]>([]);
const loading = ref(true);
const showCreateModal = ref(false);
const showDeleteModal = ref(false);
const deleteTargetId = ref<number | null>(null);
const deleting = ref(false);
const editingProject = ref<any>(null);

const searchQuery = ref('');
const statusFilter = ref('');
const sortOrder = ref('newest');
const viewMode = ref('list'); // Default to list view to match reference

const form = ref({
  title: '',
  client_id: null as any,
  description: '',
  start_date: '',
  deadline: '',
  price: 0,
  assigned_to: null as any,
  status: 'open',
  product_id: null as any,
  quantity: 0,
  uom: ''
});

const selectedBom = computed(() => {
  if (!form.value.product_id) return null;
  return products.value.find((p: any) => p.id === form.value.product_id) || null;
});

const loadProjects = async () => {
  loading.value = true;
  try {
    const { data } = await api.get('/projects');
    projects.value = Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Failed to load projects:', error);
    projects.value = [];
  } finally {
    loading.value = false;
  }
};

const loadMetadata = async () => {
  try {
    const [clientsRes, usersRes, productsRes] = await Promise.allSettled([
      api.get('/clients'),
      api.get('/users'),
      api.get('/projects/products-with-bom')
    ]);
    if (clientsRes.status === 'fulfilled') {
      const clientsPayload = clientsRes.value.data;
      clients.value = Array.isArray(clientsPayload) ? clientsPayload 
        : Array.isArray(clientsPayload?.data) ? clientsPayload.data : [];
    }
    if (usersRes.status === 'fulfilled') {
      const usersPayload = usersRes.value.data;
      users.value = Array.isArray(usersPayload) ? usersPayload 
        : Array.isArray(usersPayload?.data) ? usersPayload.data : [];
    }
    if (productsRes.status === 'fulfilled') {
      products.value = Array.isArray(productsRes.value.data) ? productsRes.value.data : [];
    }
  } catch (error) {
    console.error('Failed to load metadata:', error);
  }
};

const createProject = async () => {
  try {
    if (editingProject.value) {
      await api.put(`/projects/${editingProject.value.id}`, form.value);
      showCreateModal.value = false;
      editingProject.value = null;
      await loadProjects();
    } else {
      const { data } = await api.post('/projects', form.value);
      showCreateModal.value = false;
      await loadProjects();
      router.push(`/projects/${data.id}`);
    }
  } catch (error: any) {
    console.error('Failed to save project:', error);
    const msg = error?.response?.data?.error || error?.response?.data?.message || 'Failed to save project';
    alert(msg);
  }
};

const openCreateModal = () => {
  editingProject.value = null;
  form.value = {
    title: '',
    client_id: null,
    description: '',
    start_date: new Date().toISOString().split('T')[0],
    deadline: '',
    price: 0,
    assigned_to: null,
    status: 'open',
    product_id: null,
    quantity: 0,
    uom: ''
  };
  showCreateModal.value = true;
};

const openEditModal = (project: any) => {
  editingProject.value = project;
  form.value = {
    title: project.title || project.project_name || '',
    client_id: project.client_id || null,
    description: project.description || '',
    start_date: project.start_date ? project.start_date.split('T')[0] : '',
    deadline: (project.deadline || project.end_date || '') ? (project.deadline || project.end_date || '').split('T')[0] : '',
    price: project.price || project.budget || 0,
    assigned_to: project.assigned_to || null,
    status: project.status || 'open',
    product_id: project.product_id || null,
    quantity: project.quantity || 0,
    uom: project.uom || ''
  };
  showCreateModal.value = true;
};

const goToDetail = (id: number) => {
  router.push(`/projects/${id}`);
};

const deleteProject = (id: number) => {
  deleteTargetId.value = id;
  showDeleteModal.value = true;
};

const confirmDelete = async () => {
  if (!deleteTargetId.value) return;
  deleting.value = true;
  try {
    await api.delete(`/projects/${deleteTargetId.value}`);
    showDeleteModal.value = false;
    deleteTargetId.value = null;
    await loadProjects();
  } catch (error: any) {
    console.error('Delete failed:', error);
    alert(error?.response?.data?.error || 'Failed to delete project');
  } finally {
    deleting.value = false;
  }
};

const filteredProjects = computed(() => {
  let result = [...projects.value];

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(p => p.title.toLowerCase().includes(q) || p.client_name?.toLowerCase().includes(q));
  }

  if (statusFilter.value) {
    result = result.filter(p => p.status === statusFilter.value);
  }

  result.sort((a, b) => {
    if (sortOrder.value === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sortOrder.value === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sortOrder.value === 'deadline') return new Date(a.deadline || '9999-12-31').getTime() - new Date(b.deadline || '9999-12-31').getTime();
    return 0;
  });

  return result;
});

const getStatusColor = (status: string) => {
  switch (status) {
    case 'open': return 'bg-blue-100 text-blue-800';
    case 'in_progress': return 'bg-yellow-100 text-yellow-800';
    case 'completed': return 'bg-green-100 text-green-800';
    case 'hold': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const formatDate = (date: string) => {
  if (!date) return 'No Date';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};



onMounted(() => {
  loadProjects();
  loadMetadata();
});
</script>
