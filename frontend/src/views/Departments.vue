<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <h1 class="text-3xl font-bold text-gray-900">Departments Management</h1>
      <button
        @click="openCreateModal"
        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow transition"
      >
        + Add Department
      </button>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Code</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Name</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Description</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Department Head</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr v-for="dept in departmentStore.departments" :key="dept.id" class="hover:bg-gray-50">
            <td class="px-6 py-4 text-sm text-gray-900 font-medium">{{ dept.code }}</td>
            <td class="px-6 py-4 text-sm text-gray-900">{{ dept.name }}</td>
            <td class="px-6 py-4 text-sm text-gray-600">{{ dept.description || '-' }}</td>
            <td class="px-6 py-4 text-sm text-gray-600">{{ dept.head_user_name || '-' }}</td>
            <td class="px-6 py-4 text-sm">
              <span
                :class="dept.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
                class="px-3 py-1 rounded-full text-xs font-medium"
              >
                {{ dept.active ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td class="px-6 py-4 text-sm space-x-2">
              <button
                @click="openEditModal(dept)"
                class="text-blue-600 hover:text-blue-800 font-medium"
              >
                Edit
              </button>
              <button
                @click="confirmDelete(dept.id)"
                class="text-red-600 hover:text-red-800 font-medium"
              >
                Delete
              </button>
            </td>
          </tr>
          <tr v-if="departmentStore.departments.length === 0">
            <td colspan="6" class="px-6 py-8 text-center text-gray-500">
              No departments found
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
        <div class="flex justify-between items-center">
          <h2 class="text-2xl font-bold text-gray-900">
            {{ isEditing ? 'Edit Department' : 'Add Department' }}
          </h2>
          <button @click="closeModal" class="text-gray-500 hover:text-gray-700 text-2xl">×</button>
        </div>

        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Code</label>
            <input
              v-model="form.code"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., RD"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              v-model="form.name"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Research & Development"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              v-model="form.description"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Department description"
              rows="3"
            />
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

        <div class="flex gap-3 justify-end pt-4 border-t border-gray-200">
          <button
            @click="closeModal"
            class="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            @click="saveDepartment"
            :disabled="!form.code || !form.name || departmentStore.loading"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {{ departmentStore.loading ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useDepartmentStore } from '../stores/departments';

const departmentStore = useDepartmentStore();
const showModal = ref(false);
const isEditing = ref(false);
const editingId = ref<number | null>(null);

const form = reactive({
  code: '',
  name: '',
  description: '',
  active: true,
});

onMounted(() => {
  departmentStore.fetchDepartments();
});

const openCreateModal = () => {
  isEditing.value = false;
  editingId.value = null;
  form.code = '';
  form.name = '';
  form.description = '';
  form.active = true;
  showModal.value = true;
};

const openEditModal = (dept: any) => {
  isEditing.value = true;
  editingId.value = dept.id;
  form.code = dept.code;
  form.name = dept.name;
  form.description = dept.description || '';
  form.active = dept.active;
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  isEditing.value = false;
  editingId.value = null;
};

const saveDepartment = async () => {
  try {
    if (isEditing.value && editingId.value) {
      await departmentStore.updateDepartment(editingId.value, {
        code: form.code,
        name: form.name,
        description: form.description,
        active: form.active,
      });
    } else {
      await departmentStore.createDepartment({
        code: form.code,
        name: form.name,
        description: form.description,
      });
    }
    closeModal();
  } catch (error) {
    console.error('Error saving department:', error);
  }
};

const confirmDelete = async (id: number) => {
  if (confirm('Are you sure you want to delete this department?')) {
    try {
      await departmentStore.deleteDepartment(id);
    } catch (error) {
      console.error('Error deleting department:', error);
    }
  }
};
</script>
