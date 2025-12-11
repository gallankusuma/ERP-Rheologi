<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <h1 class="text-3xl font-bold text-gray-900">Roles Management</h1>
      <button
        @click="openCreateModal"
        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow transition"
      >
        + Add Role
      </button>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Code</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Name</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Level</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Description</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr v-for="role in roleStore.roles" :key="role.id" class="hover:bg-gray-50">
            <td class="px-6 py-4 text-sm text-gray-900 font-medium">{{ role.code }}</td>
            <td class="px-6 py-4 text-sm text-gray-900">{{ role.name }}</td>
            <td class="px-6 py-4 text-sm text-gray-600">
              <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">
                Level {{ role.level }}
              </span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-600">{{ role.description || '-' }}</td>
            <td class="px-6 py-4 text-sm">
              <span
                :class="role.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
                class="px-3 py-1 rounded-full text-xs font-medium"
              >
                {{ role.active ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td class="px-6 py-4 text-sm space-x-2">
              <button
                @click="openEditModal(role)"
                class="text-blue-600 hover:text-blue-800 font-medium"
              >
                Edit
              </button>
              <button
                @click="confirmDelete(role.id)"
                class="text-red-600 hover:text-red-800 font-medium"
              >
                Delete
              </button>
            </td>
          </tr>
          <tr v-if="roleStore.roles.length === 0">
            <td colspan="6" class="px-6 py-8 text-center text-gray-500">
              No roles found
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-auto">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 space-y-4 my-8">
        <div class="flex justify-between items-center">
          <h2 class="text-2xl font-bold text-gray-900">
            {{ isEditing ? 'Edit Role' : 'Add Role' }}
          </h2>
          <button @click="closeModal" class="text-gray-500 hover:text-gray-700 text-2xl">×</button>
        </div>

        <!-- Role Details Tab -->
        <div class="space-y-3 border-b pb-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Code</label>
            <input
              v-model="form.code"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., ADMIN"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              v-model="form.name"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Administrator"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Level</label>
              <input
                v-model.number="form.level"
                type="number"
                min="0"
                max="5"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0-5"
              />
              <p class="text-xs text-gray-500 mt-1">0: Operator, 1: Officer, 2: Supervisor, 3: Manager, 4: Director, 5: Administrator</p>
            </div>

            <div>
              <label class="flex items-center space-x-2">
                <input
                  v-model="form.active"
                  type="checkbox"
                  class="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span class="text-sm font-medium text-gray-700">Active</span>
              </label>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              v-model="form.description"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Role description"
              rows="2"
            />
          </div>
        </div>

        <!-- Permissions Section -->
        <div v-if="isEditing" class="space-y-3">
          <h3 class="text-lg font-semibold text-gray-900">Role Permissions</h3>
          <p class="text-sm text-gray-600">Select permissions for this role</p>
          
          <div class="grid grid-cols-2 gap-4 max-h-60 overflow-y-auto border border-gray-200 p-4 rounded-lg">
            <label v-for="perm in availablePermissions" :key="perm.id" class="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                :checked="selectedPermissions.includes(perm.id)"
                @change="(e) => togglePermission(perm.id, (e.target as any).checked)"
                class="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span class="text-sm text-gray-700">{{ perm.name }}</span>
            </label>
          </div>
        </div>

        <div class="flex gap-3 justify-end pt-4 border-t border-gray-200">
          <button
            @click="closeModal"
            class="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            @click="saveRole"
            :disabled="!form.code || !form.name || roleStore.loading"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {{ roleStore.loading ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRoleStore } from '../stores/roles';
import { api } from '../lib/api';

const roleStore = useRoleStore();
const showModal = ref(false);
const isEditing = ref(false);
const editingId = ref<number | null>(null);
const availablePermissions = ref<any[]>([]);
const selectedPermissions = ref<number[]>([]);

const form = reactive({
  code: '',
  name: '',
  description: '',
  level: 1,
  active: true,
});

onMounted(async () => {
  await roleStore.fetchRoles();
  await fetchPermissions();
});

const fetchPermissions = async () => {
  try {
    const response = await api.get('/permissions');
    availablePermissions.value = response.data.data || [];
  } catch (error) {
    console.error('Error fetching permissions:', error);
  }
};

const openCreateModal = () => {
  isEditing.value = false;
  editingId.value = null;
  form.code = '';
  form.name = '';
  form.description = '';
  form.level = 1;
  form.active = true;
  selectedPermissions.value = [];
  showModal.value = true;
};

const openEditModal = (role: any) => {
  isEditing.value = true;
  editingId.value = role.id;
  form.code = role.code;
  form.name = role.name;
  form.description = role.description || '';
  form.level = role.level;
  form.active = role.active;
  selectedPermissions.value = [];
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  isEditing.value = false;
  editingId.value = null;
};

const togglePermission = (permissionId: number, checked: boolean) => {
  if (checked) {
    if (!selectedPermissions.value.includes(permissionId)) {
      selectedPermissions.value.push(permissionId);
    }
  } else {
    selectedPermissions.value = selectedPermissions.value.filter(id => id !== permissionId);
  }
};

const saveRole = async () => {
  try {
    if (isEditing.value && editingId.value) {
      await roleStore.updateRole(editingId.value, {
        code: form.code,
        name: form.name,
        description: form.description,
        level: form.level,
        active: form.active,
      });

      // Assign permissions if any are selected
      if (selectedPermissions.value.length > 0) {
        await roleStore.assignPermissions(editingId.value, selectedPermissions.value);
      }
    } else {
      await roleStore.createRole({
        code: form.code,
        name: form.name,
        description: form.description,
        level: form.level,
      });
    }
    closeModal();
  } catch (error) {
    console.error('Error saving role:', error);
  }
};

const confirmDelete = async (id: number) => {
  if (confirm('Are you sure you want to delete this role?')) {
    try {
      await roleStore.deleteRole(id);
    } catch (error) {
      console.error('Error deleting role:', error);
    }
  }
};
</script>
