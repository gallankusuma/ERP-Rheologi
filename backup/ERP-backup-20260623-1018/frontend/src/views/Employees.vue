<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h1 class="text-3xl font-bold text-gray-900">Employees</h1>
      <button
        @click="showForm = true"
        class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
      >
        + Add Employee
      </button>
    </div>

    <!-- Employee Form Modal -->
    <div v-if="showForm" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-96 max-h-96 overflow-auto">
        <h2 class="text-xl font-bold mb-4">{{ editingId ? 'Edit' : 'Add' }} Employee</h2>
        <form @submit.prevent="saveEmployee" class="space-y-4">
          <input
            v-model="formData.employee_code"
            placeholder="Employee Code"
            class="w-full px-3 py-2 border border-gray-300 rounded"
            required
          />
          <input
            v-model="formData.first_name"
            placeholder="First Name"
            class="w-full px-3 py-2 border border-gray-300 rounded"
            required
          />
          <input
            v-model="formData.last_name"
            placeholder="Last Name"
            class="w-full px-3 py-2 border border-gray-300 rounded"
            required
          />
          <input
            v-model="formData.email"
            type="email"
            placeholder="Email"
            class="w-full px-3 py-2 border border-gray-300 rounded"
          />
          <input
            v-model="formData.phone"
            placeholder="Phone"
            class="w-full px-3 py-2 border border-gray-300 rounded"
          />
          <input
            v-model="formData.position"
            placeholder="Position"
            class="w-full px-3 py-2 border border-gray-300 rounded"
          />
          <input
            v-model="formData.hire_date"
            type="date"
            class="w-full px-3 py-2 border border-gray-300 rounded"
          />
          <select
            v-model="formData.department_id"
            class="w-full px-3 py-2 border border-gray-300 rounded"
          >
            <option value="">Select Department</option>
            <option v-for="dept in departments" :key="dept.id" :value="dept.id">
              {{ dept.name }}
            </option>
          </select>
          <div class="flex gap-2">
            <button
              type="submit"
              class="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Save
            </button>
            <button
              type="button"
              @click="closeForm"
              class="flex-1 bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Employees Table -->
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="px-6 py-3 text-left text-sm font-semibold text-gray-900">Code</th>
            <th class="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
            <th class="px-6 py-3 text-left text-sm font-semibold text-gray-900">Email</th>
            <th class="px-6 py-3 text-left text-sm font-semibold text-gray-900">Position</th>
            <th class="px-6 py-3 text-left text-sm font-semibold text-gray-900">Department</th>
            <th class="px-6 py-3 text-left text-sm font-semibold text-gray-900">Hire Date</th>
            <th class="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <tr v-for="employee in employees" :key="employee.id" class="hover:bg-gray-50">
            <td class="px-6 py-4 text-sm text-gray-900">{{ employee.employee_code }}</td>
            <td class="px-6 py-4 text-sm text-gray-900">
              {{ employee.first_name }} {{ employee.last_name }}
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">{{ employee.email }}</td>
            <td class="px-6 py-4 text-sm text-gray-900">{{ employee.position }}</td>
            <td class="px-6 py-4 text-sm text-gray-500">
              {{ getDepartmentName(employee.department_id) }}
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">
              {{ formatDate(employee.hire_date) }}
            </td>
            <td class="px-6 py-4 text-sm space-x-2">
              <button
                @click="editEmployee(employee)"
                class="text-blue-600 hover:text-blue-900"
              >
                Edit
              </button>
              <button
                @click="deleteEmployee(employee.id)"
                class="text-red-600 hover:text-red-900"
              >
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useApi } from '@/lib/api';

interface Employee {
  id: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  position?: string;
  department_id?: number;
  hire_date?: string;
}

interface Department {
  id: number;
  name: string;
}

const { api } = useApi();

const employees = ref<Employee[]>([]);
const departments = ref<Department[]>([]);
const showForm = ref(false);
const editingId = ref<number | null>(null);

const formData = ref({
  employee_code: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  position: '',
  department_id: '',
  hire_date: '',
});

onMounted(async () => {
  await fetchEmployees();
  await fetchDepartments();
});

const fetchEmployees = async () => {
  try {
    const response = await api.get('/hr/employees');
    employees.value = response.data;
  } catch (error) {
    console.error('Failed to fetch employees:', error);
  }
};

const fetchDepartments = async () => {
  try {
    const response = await api.get('/departments');
    departments.value = response.data;
  } catch (error) {
    console.error('Failed to fetch departments:', error);
  }
};

const saveEmployee = async () => {
  try {
    if (editingId.value) {
      await api.put(`/hr/employees/${editingId.value}`, formData.value);
    } else {
      await api.post('/hr/employees', formData.value);
    }
    await fetchEmployees();
    closeForm();
  } catch (error) {
    console.error('Failed to save employee:', error);
  }
};

const editEmployee = (employee: Employee) => {
  editingId.value = employee.id;
  formData.value = { 
    employee_code: employee.employee_code,
    first_name: employee.first_name,
    last_name: employee.last_name,
    email: employee.email || '',
    phone: employee.phone || '',
    position: employee.position || '',
    department_id: String(employee.department_id || ''),
    hire_date: employee.hire_date || ''
  };
  showForm.value = true;
};

const deleteEmployee = async (id: number) => {
  if (!confirm('Are you sure?')) return;
  try {
    await api.delete(`/hr/employees/${id}`);
    await fetchEmployees();
  } catch (error) {
    console.error('Failed to delete employee:', error);
  }
};

const closeForm = () => {
  showForm.value = false;
  editingId.value = null;
  formData.value = {
    employee_code: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    position: '',
    department_id: '',
    hire_date: '',
  };
};

const getDepartmentName = (deptId?: number) => {
  if (!deptId) return '-';
  const dept = departments.value.find((d) => d.id === deptId);
  return dept?.name || '-';
};

const formatDate = (date?: string) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString();
};
</script>
