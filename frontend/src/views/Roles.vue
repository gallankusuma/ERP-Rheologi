<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">Roles & Permissions</h1>
        <p class="text-gray-500 text-sm mt-1">Manage roles and configure module access permissions</p>
      </div>
      <button
          @click="handleExport"
          class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors flex items-center gap-2"
        >
          📥 Export
        </button>
        <button
        @click="openCreateModal"
        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow transition flex items-center gap-2"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        Add Role
      </button>
    </div>

    <!-- Roles Table -->
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Code</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Name</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Level</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Description</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Permissions</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr v-for="role in roleStore.roles" :key="role.id" class="hover:bg-gray-50">
            <td class="px-6 py-4 text-sm text-gray-900 font-mono font-semibold">{{ role.code || '-' }}</td>
            <td class="px-6 py-4 text-sm text-gray-900 font-medium">{{ role.name }}</td>
            <td class="px-6 py-4 text-sm">
              <span class="bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full text-xs font-medium">
                Lv.{{ role.level ?? 0 }}
              </span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{{ role.description || '-' }}</td>
            <td class="px-6 py-4 text-sm">
              <button
                @click="openPermissionsModal(role)"
                class="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                Manage
              </button>
            </td>
            <td class="px-6 py-4 text-sm">
              <span
                :class="role.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
                class="px-2.5 py-0.5 rounded-full text-xs font-medium"
              >
                {{ role.active ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td class="px-6 py-4 text-sm space-x-2">
              <button @click="openEditModal(role)" class="text-blue-600 hover:text-blue-800 font-medium">Edit</button>
              <button @click="confirmDelete(role)" class="text-red-600 hover:text-red-800 font-medium">Delete</button>
            </td>
          </tr>
          <tr v-if="roleStore.roles.length === 0">
            <td colspan="7" class="px-6 py-8 text-center text-gray-500">No roles found</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Role Create/Edit Modal -->
    <div v-if="showRoleModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4">
        <div class="flex justify-between items-center">
          <h2 class="text-xl font-bold text-gray-900">{{ isEditing ? 'Edit Role' : 'Add Role' }}</h2>
          <button @click="closeRoleModal" class="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Code</label>
              <input v-model="form.code" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="e.g., ADM" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Level</label>
              <input v-model.number="form.level" type="number" min="0" max="10" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input v-model="form.name" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="e.g., Administrator" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea v-model="form.description" rows="2" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Role description" />
          </div>
          <div>
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="form.active" type="checkbox" class="w-4 h-4 text-blue-600 rounded" />
              <span class="text-sm font-medium text-gray-700">Active</span>
            </label>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-3 border-t">
          <button @click="closeRoleModal" class="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button @click="saveRole" :disabled="!form.code || !form.name || saving" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Permissions Checklist Modal -->
    <div v-if="showPermModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <!-- Modal Header -->
        <div class="flex justify-between items-center px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 class="text-xl font-bold text-gray-900">
              Permissions &mdash; <span class="text-blue-600">{{ permRole?.name }}</span>
            </h2>
            <p class="text-sm text-gray-500 mt-0.5">Checklist modul yang bisa diakses dan batasan aksinya</p>
          </div>
          <button @click="closePermModal" class="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <!-- Toolbar -->
        <div class="px-6 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between flex-shrink-0">
          <div class="flex items-center gap-4">
            <button @click="selectAll" class="text-xs text-blue-600 hover:text-blue-800 font-medium">Select All</button>
            <button @click="deselectAll" class="text-xs text-red-600 hover:text-red-800 font-medium">Deselect All</button>
            <span class="text-xs text-gray-500">{{ selectedCount }} / {{ totalCount }} permissions selected</span>
          </div>
        </div>

        <!-- Permission Matrix -->
        <div class="overflow-auto flex-1 px-6 py-4">
          <table class="w-full">
            <thead class="sticky top-0 bg-white z-10">
              <tr class="border-b-2 border-gray-200">
                <th class="text-left py-3 px-4 text-sm font-semibold text-gray-700 w-48">Module</th>
                <th
                  v-for="action in allActions"
                  :key="action"
                  class="text-center py-3 px-2 text-sm font-semibold text-gray-700 w-24"
                >
                  <div class="flex flex-col items-center gap-1">
                    <span class="capitalize text-xs">{{ actionLabels[action] || action }}</span>
                    <button
                      @click="toggleColumn(action)"
                      class="text-[10px] text-blue-500 hover:text-blue-700"
                      :title="'Toggle all ' + action"
                    >
                      All
                    </button>
                  </div>
                </th>
                <th class="text-center py-3 px-2 text-sm font-semibold text-gray-700 w-24">
                  <span>All</span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <template v-for="(subModules, menuName) in groupedPermissions" :key="menuName">
                <tr class="bg-gray-100/80 border-y border-gray-200">
                  <td colspan="10" class="py-2 px-4 font-bold text-gray-800 text-sm">
                    <div class="flex items-center gap-2">
                      <span class="text-base">{{ moduleIcons[menuName as string] || '📁' }}</span>
                      {{ menuName }}
                    </div>
                  </td>
                </tr>
                <tr
                  v-for="(_perms, subMenuName) in subModules"
                  :key="subMenuName"
                  class="hover:bg-blue-50/30 transition-colors"
                >
                  <td class="py-3 px-4 pl-10">
                    <span class="text-sm font-medium text-gray-700">{{ subMenuName }}</span>
                  </td>
                  <td
                    v-for="action in allActions"
                    :key="action"
                    class="text-center py-3 px-2"
                  >
                    <label
                      v-if="getPermission(menuName as string, subMenuName as string, action)"
                      class="inline-flex items-center justify-center cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        :checked="selectedPermIds.has(getPermission(menuName as string, subMenuName as string, action)!.id)"
                        @change="togglePerm(getPermission(menuName as string, subMenuName as string, action)!.id)"
                        class="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 focus:ring-2 cursor-pointer"
                      />
                    </label>
                    <span v-else class="text-gray-300">&mdash;</span>
                  </td>
                  <td class="text-center py-3 px-2">
                    <button
                      @click="toggleRow(menuName as string, subMenuName as string)"
                      class="text-xs px-2 py-1 rounded font-medium transition-colors"
                      :class="isRowFullySelected(menuName as string, subMenuName as string) ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
                    >
                      {{ isRowFullySelected(menuName as string, subMenuName as string) ? '✓ All' : 'All' }}
                    </button>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-gray-200 flex justify-between items-center flex-shrink-0 bg-gray-50">
          <p class="text-sm text-gray-500">
            <span class="font-medium text-gray-700">{{ selectedCount }}</span> permissions assigned
          </p>
          <div class="flex gap-3">
            <button @click="closePermModal" class="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button @click="savePermissions" :disabled="savingPerms" class="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
              {{ savingPerms ? 'Saving...' : 'Save Permissions' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation -->
    <div v-if="showDeleteConfirm" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 space-y-4">
        <h3 class="text-lg font-bold text-gray-900">Delete Role</h3>
        <p class="text-gray-600">Are you sure you want to delete <span class="font-semibold">{{ deleteTarget?.name }}</span>? This will also remove all permission assignments.</p>
        <div class="flex justify-end gap-3">
          <button @click="showDeleteConfirm = false" class="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button @click="doDelete" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div v-if="toast" class="fixed bottom-4 right-4 z-50 animate-fade-in">
      <div :class="toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'" class="text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-2">
        <svg v-if="toast.type === 'success'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
        <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        {{ toast.message }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { exportToCSV } from '../utils/export';
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoleStore } from '../stores/roles';
import { api } from '../lib/api';

interface Permission {
  id: number;
  resource: string;
  action: string;
  module: string;
  name: string;
  description: string;
}

const roleStore = useRoleStore();

// Role form state
const showRoleModal = ref(false);
const isEditing = ref(false);
const editingId = ref<number | null>(null);
const saving = ref(false);
const form = reactive({ code: '', name: '', description: '', level: 1, active: true });

// Permissions modal state
const showPermModal = ref(false);
const permRole = ref<any>(null);
const allPermissions = ref<Permission[]>([]);
const selectedPermIds = ref<Set<number>>(new Set());
const savingPerms = ref(false);

// Delete state
const showDeleteConfirm = ref(false);
const deleteTarget = ref<any>(null);

// Toast
const toast = ref<{ type: string; message: string } | null>(null);

const moduleIcons: Record<string, string> = {
  'Dashboard': '📊',
  'Project': '💼',
  'Projects': '💼',
  'Estimator': '📐',
  'R&D': '🔬',
  'PPIC': '🏭',
  'Procurement': '🛒',
  'Inventory': '📦',
  'Production': '⚙️',
  'Quality': '✅',
  'Sales': '💰',
  'Finance': '💳',
  'HR': '👥',
  'Approval': '✔️',
  'Reports': '📈',
  'Master Data': '🗄️',
  'Admin': '⚙️',
};

const actionLabels: Record<string, string> = {
  'view': 'View',
  'create': 'Create',
  'edit': 'Edit',
  'delete': 'Delete',
  'approve': 'Approve',
  'approve_1': 'Approve ①',
  'approve_2': 'Approve ②',
  'export': 'Export',
};

const allActions = ['view', 'create', 'edit', 'delete', 'approve', 'approve_1', 'approve_2', 'export'];

const groupedPermissions = computed(() => {
  const grouped: Record<string, Record<string, Permission[]>> = {};
  for (const p of allPermissions.value) {
    const mod = p.module || p.resource;
    const parts = mod.split(' - ');
    const menuName = parts[0]?.trim() || 'Other';
    const subMenuName = parts.slice(1).join(' - ')?.trim() || 'General';
    
    if (!grouped[menuName]) grouped[menuName] = {};
    if (!grouped[menuName][subMenuName]) grouped[menuName][subMenuName] = [];
    grouped[menuName][subMenuName].push(p);
  }
  return grouped;
});

const totalCount = computed(() => allPermissions.value.length);
const selectedCount = computed(() => selectedPermIds.value.size);

const getPermission = (menuName: string, subMenuName: string, action: string): Permission | undefined => {
  const perms = groupedPermissions.value[menuName]?.[subMenuName] || [];
  return perms.find(p => p.action === action);
};

const isRowFullySelected = (menuName: string, subMenuName: string): boolean => {
  const perms = groupedPermissions.value[menuName]?.[subMenuName] || [];
  return perms.length > 0 && perms.every(p => selectedPermIds.value.has(p.id));
};

const togglePerm = (id: number) => {
  const newSet = new Set(selectedPermIds.value);
  if (newSet.has(id)) {
    newSet.delete(id);
  } else {
    newSet.add(id);
  }
  selectedPermIds.value = newSet;
};

const toggleRow = (menuName: string, subMenuName: string) => {
  const perms = groupedPermissions.value[menuName]?.[subMenuName] || [];
  const allSelected = perms.every(p => selectedPermIds.value.has(p.id));
  const newSet = new Set(selectedPermIds.value);
  for (const p of perms) {
    if (allSelected) {
      newSet.delete(p.id);
    } else {
      newSet.add(p.id);
    }
  }
  selectedPermIds.value = newSet;
};

const toggleColumn = (action: string) => {
  const permsForAction = allPermissions.value.filter(p => p.action === action);
  const allSelected = permsForAction.every(p => selectedPermIds.value.has(p.id));
  const newSet = new Set(selectedPermIds.value);
  for (const p of permsForAction) {
    if (allSelected) {
      newSet.delete(p.id);
    } else {
      newSet.add(p.id);
    }
  }
  selectedPermIds.value = newSet;
};

const selectAll = () => {
  selectedPermIds.value = new Set(allPermissions.value.map(p => p.id));
};

const deselectAll = () => {
  selectedPermIds.value = new Set();
};

const showToast = (type: string, message: string) => {
  toast.value = { type, message };
  setTimeout(() => { toast.value = null; }, 3000);
};

// Fetch all permissions (flat list)
const fetchPermissions = async () => {
  try {
    const response = await api.get('/permissions');
    allPermissions.value = response.data.data || [];
  } catch (error) {
    console.error('Error fetching permissions:', error);
  }
};

// Fetch assigned permission IDs for a role
const fetchRolePermissions = async (roleId: number) => {
  try {
    const response = await api.get(`/roles/${roleId}`);
    const perms = response.data.data?.permissions || [];
    selectedPermIds.value = new Set(perms.map((p: any) => p.id));
  } catch (error) {
    console.error('Error fetching role permissions:', error);
    selectedPermIds.value = new Set();
  }
};

// Role CRUD
const openCreateModal = () => {
  isEditing.value = false;
  editingId.value = null;
  form.code = '';
  form.name = '';
  form.description = '';
  form.level = 1;
  form.active = true;
  showRoleModal.value = true;
};

const openEditModal = (role: any) => {
  isEditing.value = true;
  editingId.value = role.id;
  form.code = role.code || '';
  form.name = role.name;
  form.description = role.description || '';
  form.level = role.level ?? 1;
  form.active = !!role.active;
  showRoleModal.value = true;
};

const closeRoleModal = () => {
  showRoleModal.value = false;
};

const saveRole = async () => {
  saving.value = true;
  try {
    if (isEditing.value && editingId.value) {
      await roleStore.updateRole(editingId.value, {
        code: form.code,
        name: form.name,
        description: form.description,
        level: form.level,
        active: form.active,
      });
      showToast('success', 'Role updated');
    } else {
      await roleStore.createRole({
        code: form.code,
        name: form.name,
        description: form.description,
        level: form.level,
      });
      showToast('success', 'Role created');
    }
    closeRoleModal();
  } catch (error: any) {
    showToast('error', error.response?.data?.error || 'Failed to save role');
  } finally {
    saving.value = false;
  }
};

const confirmDelete = (role: any) => {
  if (role.code === 'ADM') {
    showToast('error', 'Cannot delete Admin role');
    return;
  }
  deleteTarget.value = role;
  showDeleteConfirm.value = true;
};

const doDelete = async () => {
  if (!deleteTarget.value) return;
  try {
    await roleStore.deleteRole(deleteTarget.value.id);
    showToast('success', 'Role deleted');
  } catch (error: any) {
    showToast('error', error.response?.data?.error || 'Failed to delete role');
  }
  showDeleteConfirm.value = false;
  deleteTarget.value = null;
};

// Permissions modal
const openPermissionsModal = async (role: any) => {
  permRole.value = role;
  selectedPermIds.value = new Set();
  showPermModal.value = true;
  await fetchRolePermissions(role.id);
};

const closePermModal = () => {
  showPermModal.value = false;
  permRole.value = null;
};

const savePermissions = async () => {
  if (!permRole.value) return;
  savingPerms.value = true;
  try {
    await roleStore.assignPermissions(permRole.value.id, Array.from(selectedPermIds.value));
    showToast('success', `Permissions saved for ${permRole.value.name}`);
    closePermModal();
  } catch (error: any) {
    showToast('error', error.response?.data?.error || 'Failed to save permissions');
  } finally {
    savingPerms.value = false;
  }
};

onMounted(async () => {
  await Promise.all([roleStore.fetchRoles(), fetchPermissions()]);
});

function handleExport() {
  exportToCSV(roleStore.roles, 'Roles_Export');
}

</script>

<style scoped>
@keyframes fade-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: fade-in 0.2s ease-out;
}
</style>
