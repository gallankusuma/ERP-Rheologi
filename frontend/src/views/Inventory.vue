<template>
  <div class="min-h-screen bg-gray-50">
    <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div class="px-4 py-6 sm:px-0">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-gray-900">Inventory Management</h2>
          <button @click="showUpdateModal = true" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
            + Update Inventory
          </button>
        </div>

        <div v-if="store.loading" class="text-center py-8">Loading...</div>
        <div v-else-if="store.error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {{ store.error }}
        </div>

        <div v-else>
          <!-- Inventory Levels -->
          <div class="bg-white shadow overflow-hidden sm:rounded-md mb-6">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">On Hand</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reserved</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Available</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="inv in store.inventory" :key="inv.id">
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ inv.product_name }}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ inv.quantity_on_hand }}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ inv.quantity_reserved }}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span :class="inv.quantity_on_hand - inv.quantity_reserved < 10 ? 'text-red-600 font-semibold' : 'text-green-600'">
                      {{ inv.quantity_on_hand - inv.quantity_reserved }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ inv.location || '-' }}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button @click="viewTransactions(inv.product_id)" class="text-blue-600 hover:text-blue-900 mr-4">History</button>
                    <button @click="editInventory(inv)" class="text-green-600 hover:text-green-900">Update</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Transaction History -->
          <div v-if="showTransactions" class="bg-white shadow sm:rounded-lg p-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-bold text-gray-900">Transaction History</h3>
              <button @click="showTransactions = false" class="text-gray-500 hover:text-gray-700">&times;</button>
            </div>
            <div v-if="store.transactions.length === 0" class="text-gray-500 text-center py-4">
              No transactions found
            </div>
            <table v-else class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">Quantity</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">Notes</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="txn in store.transactions" :key="txn.id">
                  <td class="px-4 py-2 text-sm text-gray-900">{{ new Date(txn.transaction_date).toLocaleString() }}</td>
                  <td class="px-4 py-2 text-sm">
                    <span :class="txn.transaction_type === 'in' ? 'text-green-600' : 'text-red-600'">
                      {{ txn.transaction_type === 'in' ? '+ Receipt' : '- Issue' }}
                    </span>
                  </td>
                  <td class="px-4 py-2 text-sm text-gray-900">{{ txn.quantity }}</td>
                  <td class="px-4 py-2 text-sm text-gray-500">{{ txn.notes || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>

    <!-- Update Modal -->
    <div v-if="showUpdateModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <h3 class="text-lg font-bold mb-4">Update Inventory</h3>
        <form @submit.prevent="updateInventory()">
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
            <label class="block text-sm font-medium text-gray-700">Transaction Type</label>
            <select v-model="form.transaction_type" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md">
              <option value="in">Receipt (Add Stock)</option>
              <option value="out">Issue (Remove Stock)</option>
            </select>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700">Quantity</label>
            <input v-model.number="form.quantity" type="number" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700">Location</label>
            <input v-model="form.location" type="text" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700">Notes</label>
            <textarea v-model="form.notes" rows="3" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"></textarea>
          </div>
          <div class="flex justify-end space-x-3">
            <button type="button" @click="closeModal" class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400">Cancel</button>
            <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Update</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useInventoryStore } from '../stores/inventory';
import { useProductStore } from '../stores/products';
const store = useInventoryStore();
const productStore = useProductStore();

const showUpdateModal = ref(false);
const showTransactions = ref(false);
const form = ref({
  product_id: '',
  inventory_id: 0,
  transaction_type: 'in',
  quantity: 1,
  location: '',
  notes: '',
});

onMounted(async () => {
  await Promise.all([
    store.fetchInventory(),
    productStore.fetchProducts(),
  ]);
});

const editInventory = (inv: any) => {
  form.value = {
    product_id: inv.product_id,
    inventory_id: inv.id,
    transaction_type: 'in',
    quantity: 1,
    location: inv.location || '',
    notes: '',
  };
  showUpdateModal.value = true;
};

const updateInventory = async () => {
  try {
    // Record transaction
    await store.recordTransaction(form.value.inventory_id, {
      transaction_type: form.value.transaction_type,
      quantity: form.value.quantity,
      notes: form.value.notes,
    });
    
    // Update inventory location if changed
    const inv = store.inventory.find(i => i.id === form.value.inventory_id);
    if (inv) {
      const newQty = form.value.transaction_type === 'in' 
        ? inv.quantity_on_hand + form.value.quantity 
        : inv.quantity_on_hand - form.value.quantity;
      
      await store.updateInventory(form.value.inventory_id, {
        quantity_on_hand: newQty,
        quantity_reserved: inv.quantity_reserved,
        location: form.value.location,
      });
    }
    
    closeModal();
  } catch (error) {
    console.error('Failed to update inventory:', error);
  }
};

const viewTransactions = async (productId: number) => {
  await store.fetchTransactions(productId);
  showTransactions.value = true;
};
const closeModal = () => {
  showUpdateModal.value = false;
  form.value = {
    product_id: '',
    inventory_id: 0,
    transaction_type: 'in',
    quantity: 1,
    location: '',
    notes: '',
  };
};
</script>
