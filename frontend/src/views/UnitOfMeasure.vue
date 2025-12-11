<template>
  <div class="min-h-screen bg-gray-50">
    <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div class="px-4 py-6 sm:px-0">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-gray-900">Units of Measure</h2>
          <button
            @click="openAddModal"
            class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            + Add Unit
          </button>
        </div>

        <div class="bg-white shadow overflow-hidden sm:rounded-md">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="unit in units" :key="unit.id">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ unit.code }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ unit.name }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ unit.type || '-' }}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span :class="unit.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                    {{ unit.active ? 'Active' : 'Inactive' }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button @click="editUnit(unit)" class="text-blue-600 hover:text-blue-900 mr-4">Edit</button>
                  <button @click="deleteUnit(unit.id)" class="text-red-600 hover:text-red-900">Delete</button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="units.length === 0" class="text-center py-8 text-gray-500">
            No units found
          </div>
        </div>
      </div>
    </main>

    <!-- Add/Edit Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <div class="px-6 py-4 border-b border-gray-200">
          <h3 class="text-lg font-bold text-gray-900">{{ editingId ? 'Edit Unit' : 'Add Unit' }}</h3>
        </div>
        <div class="px-6 py-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Code</label>
            <input
              v-model="form.code"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
              placeholder="e.g. PCS, KG, L"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              v-model="form.name"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
              placeholder="e.g. Piece, Kilogram"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              v-model="form.type"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
            >
              <option value="">Select Type</option>
              <option value="Weight">Weight</option>
              <option value="Volume">Volume</option>
              <option value="Length">Length</option>
              <option value="Count">Count</option>
              <option value="Time">Time</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label class="flex items-center">
              <input v-model="form.active" type="checkbox" class="rounded border-gray-300" />
              <span class="ml-2 text-sm text-gray-700">Active</span>
            </label>
          </div>
        </div>
        <div class="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            @click="showModal = false"
            class="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            @click="saveUnit"
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

interface Unit {
  id: number;
  code: string;
  name: string;
  type?: string;
  active: boolean;
}

const units = ref<Unit[]>([]);
const showModal = ref(false);
const editingId = ref<number | null>(null);
const form = ref({ code: '', name: '', type: '', active: true });

const openAddModal = () => {
  editingId.value = null;
  form.value = { code: '', name: '', type: '', active: true };
  showModal.value = true;
};

const editUnit = (unit: Unit) => {
  editingId.value = unit.id;
  form.value = { ...unit };
  showModal.value = true;
};

const saveUnit = () => {
  if (!form.value.code.trim() || !form.value.name.trim()) {
    alert('Code and Name are required');
    return;
  }

  if (editingId.value) {
    const index = units.value.findIndex(u => u.id === editingId.value);
    if (index !== -1) {
      units.value[index] = { id: editingId.value, ...form.value };
    }
  } else {
    const newId = Math.max(...units.value.map(u => u.id), 0) + 1;
    units.value.push({ id: newId, ...form.value });
  }

  showModal.value = false;
};

const deleteUnit = (id: number) => {
  if (confirm('Are you sure?')) {
    units.value = units.value.filter(u => u.id !== id);
  }
};

onMounted(() => {
  // Sample data
  units.value = [
    { id: 1, code: 'PCS', name: 'Piece', type: 'Count', active: true },
    { id: 2, code: 'KG', name: 'Kilogram', type: 'Weight', active: true },
    { id: 3, code: 'L', name: 'Liter', type: 'Volume', active: true },
    { id: 4, code: 'M', name: 'Meter', type: 'Length', active: true },
    { id: 5, code: 'BOX', name: 'Box', type: 'Count', active: true },
  ];
});
</script>
