<template>
  <div class="min-h-screen bg-gray-50">
    <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div class="px-4 py-6 sm:px-0">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-gray-900">Suppliers</h2>
          <button
            @click="openAddModal"
            class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            + Add Supplier
          </button>
        </div>

        <div class="bg-white shadow overflow-hidden sm:rounded-md">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">City</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="supplier in suppliers" :key="supplier.id">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ supplier.code }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ supplier.name }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ supplier.contact_person || '-' }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ supplier.city || '-' }}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span :class="supplier.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                    {{ supplier.active ? 'Active' : 'Inactive' }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button @click="editSupplier(supplier)" class="text-blue-600 hover:text-blue-900 mr-4">Edit</button>
                  <button @click="deleteSupplier(supplier.id)" class="text-red-600 hover:text-red-900">Delete</button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="suppliers.length === 0" class="text-center py-8 text-gray-500">
            No suppliers found
          </div>
        </div>
      </div>
    </main>

    <!-- Add/Edit Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
        <div class="px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <h3 class="text-lg font-bold text-gray-900">{{ editingId ? 'Edit Supplier' : 'Add Supplier' }}</h3>
        </div>
        <div class="px-6 py-4 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Code</label>
              <input
                v-model="form.code"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
                placeholder="Supplier code"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                v-model="form.name"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
                placeholder="Supplier name"
              />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
              <input
                v-model="form.contact_person"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
                placeholder="Contact person name"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                v-model="form.email"
                type="email"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
                placeholder="Email address"
              />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                v-model="form.phone"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
                placeholder="Phone number"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                v-model="form.city"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
                placeholder="City"
              />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea
              v-model="form.address"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
              placeholder="Full address"
              rows="2"
            ></textarea>
          </div>
          <div>
            <label class="flex items-center">
              <input v-model="form.active" type="checkbox" class="rounded border-gray-300" />
              <span class="ml-2 text-sm text-gray-700">Active</span>
            </label>
          </div>
        </div>
        <div class="px-6 py-4 border-t border-gray-200 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button
            @click="showModal = false"
            class="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            @click="saveSupplier"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {{ editingId ? 'Update' : 'Add' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

interface Supplier {
  id: number;
  code: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  city?: string;
  address?: string;
  active: boolean;
}

const suppliers = ref<Supplier[]>([]);
const showModal = ref(false);
const editingId = ref<number | null>(null);
const form = ref({ code: '', name: '', contact_person: '', email: '', phone: '', city: '', address: '', active: true });

const openAddModal = () => {
  editingId.value = null;
  form.value = { code: '', name: '', contact_person: '', email: '', phone: '', city: '', address: '', active: true };
  showModal.value = true;
};

const editSupplier = (supplier: Supplier) => {
  editingId.value = supplier.id;
  form.value = { ...supplier };
  showModal.value = true;
};

const saveSupplier = () => {
  if (!form.value.code.trim() || !form.value.name.trim()) {
    alert('Code and Name are required');
    return;
  }

  if (editingId.value) {
    const index = suppliers.value.findIndex(s => s.id === editingId.value);
    if (index !== -1) {
      suppliers.value[index] = { id: editingId.value, ...form.value };
    }
  } else {
    const newId = Math.max(...suppliers.value.map(s => s.id), 0) + 1;
    suppliers.value.push({ id: newId, ...form.value });
  }

  showModal.value = false;
};

const deleteSupplier = (id: number) => {
  if (confirm('Are you sure?')) {
    suppliers.value = suppliers.value.filter(s => s.id !== id);
  }
};

onMounted(() => {
  // Sample data
  suppliers.value = [
    { id: 1, code: 'SUP001', name: 'PT Supplier A', contact_person: 'John Doe', email: 'john@suppliera.com', phone: '+62812345678', city: 'Jakarta', active: true },
    { id: 2, code: 'SUP002', name: 'PT Supplier B', contact_person: 'Jane Smith', email: 'jane@supplierb.com', phone: '+62877123456', city: 'Surabaya', active: true },
    { id: 3, code: 'SUP003', name: 'CV Supplier C', contact_person: 'Bob Johnson', email: 'bob@supplierc.com', phone: '+62821987654', city: 'Bandung', active: true },
  ];
});
</script>
