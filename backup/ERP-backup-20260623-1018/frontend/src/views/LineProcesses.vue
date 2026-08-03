<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">⚙️ Line Processes</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">Manage production line machines and processes</p>
      </div>
      <button
        @click="openAddModal"
        class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
      >
        + Add Line Process
      </button>
    </div>

    <!-- Search -->
    <div class="flex gap-4">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search line processes..."
        class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    <!-- Table -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-750">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Code</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Name</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Capacity/hr</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Unit</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Products</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Status</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          <tr v-if="filteredLines.length === 0">
            <td colspan="7" class="px-6 py-4 text-center text-gray-500 dark:text-gray-400">No line processes found</td>
          </tr>
          <tr v-for="line in filteredLines" :key="line.id" class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <td class="px-6 py-4 text-sm font-mono text-blue-600 dark:text-blue-400">{{ line.code || '-' }}</td>
            <td class="px-6 py-4">
              <div class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ line.name }}</div>
              <div v-if="line.description" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ line.description }}</div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 font-medium">{{ line.capacity_per_hour || '-' }}</td>
            <td class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{{ line.unit_name || line.capacity_unit || '-' }}</td>
            <td class="px-6 py-4">
              <div v-if="line.products && line.products.length" class="flex flex-wrap gap-1 max-w-xs">
                <span
                  v-for="p in line.products.slice(0, 3)"
                  :key="p.product_id"
                  class="px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-xs rounded-full font-medium"
                >
                  {{ p.product_name }}
                </span>
                <span
                  v-if="line.products.length > 3"
                  class="px-2 py-0.5 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 text-xs rounded-full"
                >
                  +{{ line.products.length - 3 }} more
                </span>
              </div>
              <span v-else class="text-sm text-gray-400">-</span>
            </td>
            <td class="px-6 py-4 text-sm">
              <span
                :class="[
                  'px-3 py-1 rounded-full text-xs font-medium',
                  line.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                ]"
              >
                {{ line.active ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td class="px-6 py-4 text-sm flex gap-2">
              <button
                @click="editLine(line)"
                class="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 text-sm font-medium"
              >
                Edit
              </button>
              <button
                @click="deleteLine(line.id)"
                class="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 text-sm font-medium"
              >
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add/Edit Modal -->
    <Dialog :is-open="showModal" @update:is-open="showModal = $event">
      <template #title>
        {{ editingLine ? 'Edit Line Process' : 'Add New Line Process' }}
      </template>

      <form @submit.prevent="saveLine" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Code</label>
            <input
              v-model="form.code"
              type="text"
              placeholder="e.g., LINE-01"
              class="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Name *</label>
            <input
              v-model="form.name"
              type="text"
              placeholder="e.g., Mixing Line A"
              class="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p v-if="formError" class="text-xs text-red-500">{{ formError }}</p>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
          <textarea
            v-model="form.description"
            placeholder="Line process description..."
            rows="2"
            class="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Capacity / Hour</label>
            <input
              v-model.number="form.capacity_per_hour"
              type="number"
              step="0.01"
              placeholder="e.g., 500"
              class="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Capacity Unit</label>
            <select
              v-model="form.capacity_unit_id"
              class="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option :value="null">-- Select Unit --</option>
              <option v-for="u in uomList" :key="u.id" :value="u.id">
                {{ u.name }}{{ u.code ? ` (${u.code})` : '' }}
              </option>
            </select>
          </div>
        </div>

        <!-- Products (from BOM) -->
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
            Products (BOM)
            <span class="text-xs text-gray-400 font-normal ml-1">— products that can run on this line</span>
          </label>
          <div class="border border-gray-300 dark:border-gray-600 rounded-lg max-h-40 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-700">
            <div v-if="bomProducts.length === 0" class="text-sm text-gray-400 text-center py-2">No BOM products found</div>
            <label
              v-for="prod in bomProducts"
              :key="prod.id"
              class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer"
            >
              <input
                type="checkbox"
                :value="prod.id"
                v-model="form.product_ids"
                class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span class="text-sm text-gray-800 dark:text-gray-200">{{ prod.name }}</span>
              <span v-if="prod.sku" class="text-xs text-gray-400 ml-auto font-mono">{{ prod.sku }}</span>
            </label>
          </div>
          <p class="text-xs text-gray-500">{{ form.product_ids.length }} product(s) selected</p>
        </div>

        <div class="flex items-center gap-2">
          <input
            id="line-active"
            v-model="form.active"
            type="checkbox"
            class="w-4 h-4 rounded border-gray-300"
          />
          <label for="line-active" class="text-sm font-medium text-gray-700 dark:text-gray-300">Active</label>
        </div>
      </form>

      <template #actions="{ close }">
        <button
          @click="close"
          class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
        >
          Cancel
        </button>
        <button
          @click="saveLine"
          :disabled="saving"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import Dialog from '../components/ui/Dialog.vue';
import { api } from '../lib/api';

interface LineProcess {
  id: number;
  name: string;
  code: string | null;
  description: string | null;
  capacity_per_hour: number | null;
  capacity_unit_id: number | null;
  capacity_unit: string | null;
  unit_name: string | null;
  unit_code: string | null;
  active: number;
  products: { product_id: number; product_name: string; sku: string }[];
}

interface UOM {
  id: number;
  name: string;
  code: string;
}

interface Product {
  id: number;
  name: string;
  sku: string;
}

const lines = ref<LineProcess[]>([]);
const uomList = ref<UOM[]>([]);
const bomProducts = ref<Product[]>([]);
const loading = ref(false);
const showModal = ref(false);
const searchQuery = ref('');
const editingLine = ref<LineProcess | null>(null);
const saving = ref(false);
const formError = ref('');
const form = ref({
  name: '',
  code: '',
  description: '',
  capacity_per_hour: null as number | null,
  capacity_unit_id: null as number | null,
  active: true,
  product_ids: [] as number[],
});

const filteredLines = computed(() => {
  return lines.value.filter((l) => {
    const q = searchQuery.value.toLowerCase();
    return (
      !q ||
      l.name.toLowerCase().includes(q) ||
      (l.code && l.code.toLowerCase().includes(q)) ||
      (l.description && l.description.toLowerCase().includes(q))
    );
  });
});

onMounted(async () => {
  await Promise.all([fetchLines(), fetchUOMs(), fetchBomProducts()]);
});

const fetchLines = async () => {
  loading.value = true;
  try {
    const res = await api.get('/line-processes');
    lines.value = res.data.data || [];
  } catch (error) {
    console.error('Error fetching line processes:', error);
  } finally {
    loading.value = false;
  }
};

const fetchUOMs = async () => {
  try {
    const res = await api.get('/units');
    uomList.value = res.data.data || [];
  } catch (error) {
    console.error('Error fetching UOMs:', error);
  }
};

const fetchBomProducts = async () => {
  try {
    // Get products that have BOM
    const res = await api.get('/bom');
    const boms = res.data.data || res.data || [];
    const productMap = new Map<number, Product>();
    for (const bom of boms) {
      if (bom.product_id && bom.product_name) {
        productMap.set(bom.product_id, {
          id: bom.product_id,
          name: bom.product_name || bom.name,
          sku: bom.sku || '',
        });
      }
    }
    bomProducts.value = Array.from(productMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error fetching BOM products:', error);
  }
};

const openAddModal = () => {
  editingLine.value = null;
  form.value = {
    name: '',
    code: '',
    description: '',
    capacity_per_hour: null,
    capacity_unit_id: null,
    active: true,
    product_ids: [],
  };
  formError.value = '';
  showModal.value = true;
};

const editLine = (line: LineProcess) => {
  editingLine.value = line;
  form.value = {
    name: line.name,
    code: line.code || '',
    description: line.description || '',
    capacity_per_hour: line.capacity_per_hour,
    capacity_unit_id: line.capacity_unit_id,
    active: !!line.active,
    product_ids: line.products ? line.products.map((p) => p.product_id) : [],
  };
  formError.value = '';
  showModal.value = true;
};

const saveLine = async () => {
  formError.value = '';
  if (!form.value.name || form.value.name.trim().length < 2) {
    formError.value = 'Name must be at least 2 characters';
    return;
  }
  saving.value = true;
  try {
    if (editingLine.value) {
      await api.put(`/line-processes/${editingLine.value.id}`, form.value);
    } else {
      await api.post('/line-processes', form.value);
    }
    showModal.value = false;
    await fetchLines();
  } catch (error) {
    console.error('Error saving line process:', error);
  } finally {
    saving.value = false;
  }
};

const deleteLine = async (id: number) => {
  if (!confirm('Are you sure you want to delete this line process?')) return;
  try {
    await api.delete(`/line-processes/${id}`);
    await fetchLines();
  } catch (error) {
    console.error('Error deleting line process:', error);
  }
};
</script>
