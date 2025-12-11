<template>
  <div class="min-h-screen bg-gray-50">
    <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div class="px-4 py-6 sm:px-0">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-gray-900">Work Orders</h2>
          <button @click="showAddModal = true" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
            + Create Work Order
          </button>
        </div>

        <div v-if="store.loading" class="text-center py-8">Loading...</div>
        <div v-else-if="store.error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {{ store.error }}
        </div>

        <div v-else class="bg-white shadow overflow-hidden sm:rounded-md">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scheduled Start</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="wo in store.workOrders" :key="wo.id">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ wo.product_name }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ wo.quantity }}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span :class="statusClass(wo.status)" class="px-2 py-1 text-xs font-semibold rounded-full">
                    {{ wo.status }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ wo.priority }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ wo.scheduled_start ? new Date(wo.scheduled_start).toLocaleDateString() : '-' }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button @click="editWorkOrder(wo)" class="text-blue-600 hover:text-blue-900 mr-4">Edit</button>
                  <button @click="deleteWorkOrder(wo.id)" class="text-red-600 hover:text-red-900">Delete</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>

    <!-- Add/Edit Modal -->
    <div v-if="showAddModal || showEditModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <h3 class="text-lg font-bold mb-4">{{ showEditModal ? 'Edit' : 'Create' }} Work Order</h3>
        <form @submit.prevent="showEditModal ? updateWorkOrder() : createWorkOrder()">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700">Product</label>
            <select v-model="form.product_id" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md">
              <option value="">Select Product</option>
              <option v-for="product in productStore.products" :key="product.id" :value="product.id">
                {{ product.name }}
              </option>
            </select>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700">Quantity</label>
            <input v-model.number="form.quantity" type="number" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700">Status</label>
            <select v-model="form.status" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md">
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700">Priority</label>
            <select v-model="form.priority" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md">
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>
          <div class="flex justify-end space-x-3">
            <button type="button" @click="closeModal" class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400">Cancel</button>
            <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{{ showEditModal ? 'Update' : 'Create' }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useWorkOrderStore } from '../stores/workorders';
import { useProductStore } from '../stores/products';

const store = useWorkOrderStore();
const productStore = useProductStore();

const showAddModal = ref(false);
const showEditModal = ref(false);
const form = ref({
  id: 0,
  product_id: '',
  quantity: 1,
  status: 'pending',
  priority: 'normal',
  scheduled_start: '',
  scheduled_end: '',
});

onMounted(async () => {
  await Promise.all([
    store.fetchWorkOrders(),
    productStore.fetchProducts(),
  ]);
});

const statusClass = (status: string) => {
  const classes: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    'in-progress': 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };
  return classes[status] || 'bg-gray-100 text-gray-800';
};

const createWorkOrder = async () => {
  try {
    await store.createWorkOrder(form.value);
    closeModal();
  } catch (error) {
    console.error('Failed to create work order:', error);
  }
};

const editWorkOrder = (wo: any) => {
  form.value = { ...wo };
  showEditModal.value = true;
};

const updateWorkOrder = async () => {
  try {
    await store.updateWorkOrder(form.value.id, form.value);
    closeModal();
  } catch (error) {
    console.error('Failed to update work order:', error);
  }
};

const deleteWorkOrder = async (id: number) => {
  if (confirm('Are you sure?')) {
    try {
      await store.deleteWorkOrder(id);
    } catch (error) {
      console.error('Failed to delete work order:', error);
    }
  }
};

const closeModal = () => {
  showAddModal.value = false;
  showEditModal.value = false;
  form.value = {
    id: 0,
    product_id: '',
    quantity: 1,
    status: 'pending',
    priority: 'normal',
    scheduled_start: '',
    scheduled_end: '',
  };
};
</script>
