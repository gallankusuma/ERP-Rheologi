<template>
  <div class="space-y-6">
    <!-- Header -->
    <PageHeader title="Work Orders" icon="🏭" subtitle="Manage production work orders and scheduling">
      <template #actions>
        <button @click="showAddModal = true" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 font-medium transition-colors">
          + Create Work Order
        </button>
      </template>
    </PageHeader>

    <!-- Loading / Error -->
    <div v-if="store.loading" class="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
    <div v-else-if="store.error" class="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-4">
      {{ store.error }}
    </div>

    <!-- Work Orders Table -->
    <DataTable v-else :columns="columns" :rows="store.workOrders" :loading="false">
      <template #cell-status="{ row }">
        <StatusBadge :status="row.status" />
      </template>
      <template #cell-scheduled_start="{ row }">
        {{ row.scheduled_start ? new Date(row.scheduled_start).toLocaleDateString() : '-' }}
      </template>
      <template #cell-actions="{ row }">
        <div class="flex gap-2">
          <button @click="editWorkOrder(row)" class="px-3 py-1 rounded text-sm font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors">
            Edit
          </button>
          <button @click="promptDelete(row.id)" class="px-3 py-1 rounded text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors">
            Delete
          </button>
        </div>
      </template>
    </DataTable>

    <!-- Add/Edit Modal -->
    <Dialog :is-open="showAddModal || showEditModal" @update:is-open="closeModal" size="small">
      <template #title>{{ showEditModal ? 'Edit' : 'Create' }} Work Order</template>
      <form @submit.prevent="showEditModal ? updateWorkOrder() : createWorkOrder()" class="space-y-4">
        <FormField name="product_id" label="Product" type="select" :model-value="form.product_id" @update:model-value="onProductChange($event)" :options="bomProductOptions" select-placeholder="Select Product" required />
        <FormField name="quantity" label="Quantity" type="number" :model-value="form.quantity" @update:model-value="form.quantity = $event" required />
        <FormField name="line_process_id" label="Line Process" type="select" :model-value="form.line_process_id" @update:model-value="form.line_process_id = $event" :options="lineProcessOptions" select-placeholder="Select Line" />
        <FormField name="status" label="Status" type="select" :model-value="form.status" @update:model-value="form.status = $event" :options="statusOptions" />
        <FormField name="priority" label="Priority" type="select" :model-value="form.priority" @update:model-value="form.priority = $event" :options="priorityOptions" />
      </form>
      <template #actions="{ close }">
        <button @click="close" class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium">Cancel</button>
        <button @click="showEditModal ? updateWorkOrder() : createWorkOrder()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 font-medium">
          {{ showEditModal ? 'Update' : 'Create' }}
        </button>
      </template>
    </Dialog>

    <!-- Delete confirm -->
    <ConfirmDialog
      :is-open="showDeleteConfirm"
      title="Delete Work Order"
      message="Are you sure you want to delete this work order?"
      confirm-label="Delete"
      confirm-variant="danger"
      @confirm="confirmDelete"
      @cancel="showDeleteConfirm = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useWorkOrderStore } from '../stores/workorders';
import { useProductStore } from '../stores/products';
import { api } from '../lib/api';
import PageHeader from '../components/ui/PageHeader.vue';
import StatusBadge from '../components/ui/StatusBadge.vue';
import ConfirmDialog from '../components/ui/ConfirmDialog.vue';
import DataTable from '../components/DataTable.vue';
import Dialog from '../components/ui/Dialog.vue';
import FormField from '../components/FormField.vue';

const store = useWorkOrderStore();
const productStore = useProductStore();
const bomList = ref<any[]>([]);
const allLineProcesses = ref<any[]>([]);

// Filter line processes by selected product
const lineProcessOptions = computed(() => {
  const pid = Number(form.value.product_id);
  if (!pid) return allLineProcesses.value.filter(lp => lp.active).map(lp => ({ value: lp.id, label: `${lp.code ? lp.code + ' — ' : ''}${lp.name}${lp.capacity_per_hour ? ` (${lp.capacity_per_hour}/hr)` : ''}` }));
  // Filter: only lines that have this product associated
  return allLineProcesses.value
    .filter(lp => lp.active && lp.products?.some((p: any) => p.product_id === pid))
    .map(lp => ({ value: lp.id, label: `${lp.code ? lp.code + ' — ' : ''}${lp.name}${lp.capacity_per_hour ? ` (${lp.capacity_per_hour}/hr)` : ''}` }));
});

// Only show products that have a BOM defined — use BOM product_name for consistency
const bomProductOptions = computed(() => {
  // Group by product_id to avoid duplicates, use first BOM's product_name
  const seen = new Map<number, string>();
  for (const bom of bomList.value) {
    if (bom.product_id && !seen.has(bom.product_id)) {
      seen.set(bom.product_id, bom.product_name);
    }
  }
  return Array.from(seen.entries()).map(([id, name]) => ({ value: id, label: name }));
});

const showAddModal = ref(false);
const showEditModal = ref(false);
const showDeleteConfirm = ref(false);
const deletingId = ref<number | null>(null);
const form = ref({
  id: 0,
  product_id: '',
  quantity: 1,
  status: 'pending',
  priority: 'normal',
  line_process_id: '' as string | number,
  scheduled_start: '',
  scheduled_end: '',
});

const columns = [
  { key: 'product_name', label: 'Product' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'line_process_name', label: 'Line Process' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'scheduled_start', label: 'Scheduled Start' },
  { key: 'actions', label: 'Actions' },
];

const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
];

onMounted(async () => {
  await Promise.all([
    store.fetchWorkOrders(),
    productStore.fetchProducts(),
  ]);
  // Fetch BOMs to know which products have BOM
  try {
    const res = await api.get('/bom');
    bomList.value = res.data.data || [];
  } catch { bomList.value = []; }
  // Fetch line processes
  try {
    const res = await api.get('/line-processes');
    allLineProcesses.value = res.data.data || [];
  } catch { allLineProcesses.value = []; }
});

// When product changes, auto-select line if only one option
const onProductChange = (val: any) => {
  form.value.product_id = val;
  const opts = lineProcessOptions.value;
  if (opts.length === 1) {
    form.value.line_process_id = opts[0].value;
  } else {
    form.value.line_process_id = '';
  }
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

const promptDelete = (id: number) => {
  deletingId.value = id;
  showDeleteConfirm.value = true;
};

const confirmDelete = async () => {
  if (!deletingId.value) return;
  try {
    await store.deleteWorkOrder(deletingId.value);
  } catch (error) {
    console.error('Failed to delete work order:', error);
  }
  showDeleteConfirm.value = false;
  deletingId.value = null;
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
    line_process_id: '',
    scheduled_start: '',
    scheduled_end: '',
  };
};
</script>
