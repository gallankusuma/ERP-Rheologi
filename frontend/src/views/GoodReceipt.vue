<template>
  <div class="min-h-screen bg-gray-50 p-6 space-y-4">
    <div class="bg-white border rounded-lg shadow-sm">
      <div class="px-6 py-4 flex items-center justify-between">
        <div>
          <p class="text-xs uppercase text-gray-500 tracking-wide">Procurement</p>
          <h1 class="text-2xl font-semibold text-gray-900">Goods Receipt (GRN)</h1>
          <p class="text-sm text-gray-600">Terima barang dari PO → Update stok</p>
        </div>
        <div class="space-x-2">
          <button @click="fetchData" class="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50">
            Refresh
          </button>
          <button @click="openCreateModal" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            + Create GRN
          </button>
        </div>
      </div>
    </div>

    <div v-if="store.error" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
      {{ store.error }}
    </div>
    <div v-if="successMsg" class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
      {{ successMsg }}
    </div>

    <div class="bg-white border rounded-lg shadow-sm overflow-hidden">
      <div class="px-6 py-3 border-b flex items-center justify-between">
        <h2 class="text-sm font-semibold text-gray-800">GRN List</h2>
        <span class="text-xs text-gray-500">GR No | PO No | Warehouse | Status | Action</span>
      </div>
      <div v-if="store.loading" class="p-8 text-center text-gray-500">Loading...</div>
      <div v-else class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GR No</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PO No</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Warehouse</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Received By</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Approval</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="gr in store.goodReceipts" :key="gr.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-semibold text-gray-900">{{ gr.gr_number }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{{ gr.po_number || '-' }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{{ gr.warehouse_name || '-' }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{{ gr.received_by_name || '-' }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{{ formatDate(gr.received_date || gr.received_at) }}</td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="statusBadgeClass(gr.status)" class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full">
                  {{ statusLabel(gr.status) }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="approvalBadgeClass(gr.approval_status)" class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full">
                  {{ approvalLabel(gr.approval_status) }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                <button
                  v-if="canApproveGRN(gr)"
                  @click="approveGRN(gr.id)"
                  class="inline-flex items-center px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                  :disabled="submitting"
                >
                  Approve
                </button>
                <button
                  v-if="canRejectGRN(gr)"
                  @click="rejectGRN(gr.id)"
                  class="inline-flex items-center px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                  :disabled="submitting"
                >
                  Reject
                </button>
                <button @click="viewGRN(gr)" class="text-blue-600 hover:text-blue-900">View</button>
                <button
                  v-if="gr.status === 'draft' || (gr.approval_status || 0) === 0"
                  @click="deleteGRN(gr.id)"
                  class="text-red-600 hover:text-red-900"
                  :disabled="submitting"
                >
                  Delete
                </button>
              </td>
            </tr>
            <tr v-if="store.goodReceipts.length === 0">
              <td colspan="7" class="px-6 py-8 text-center text-gray-500">Belum ada GRN. Klik "Create GRN" untuk mulai.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- GRN Form Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-50 z-50">
      <div class="bg-white h-screen overflow-y-auto flex flex-col">
        <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h3 class="text-lg font-semibold text-gray-900">{{ isEditing ? 'Good Receipt Detail' : 'Create Good Receipt' }}</h3>
          <button @click="closeModal" class="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div class="px-6 py-4 space-y-4">
          <!-- Header Info -->
          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">PO Number</label>
              <select
                v-model.number="form.po_id"
                class="w-full border border-gray-300 rounded-lg px-3 py-2"
                :disabled="isEditing"
                @change="onPOSelected"
              >
                <option value="">-- Pilih PO --</option>
                <option v-for="po in availablePOs" :key="po.id" :value="po.id">
                  {{ po.po_number }} ({{ po.vendor_name }})
                </option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Warehouse</label>
              <select v-model.number="form.warehouse_id" class="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="">-- Pilih Warehouse --</option>
                <option v-for="wh in warehouses" :key="wh.id" :value="wh.id">{{ wh.name }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Received Date</label>
              <input v-model="form.received_at" type="datetime-local" class="w-full border border-gray-300 rounded-lg px-3 py-2" :disabled="isEditing" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Received By</label>
              <input
                :value="authStore.user?.name || 'Current user'"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100 text-gray-700"
                disabled
              />
            </div>
          </div>

          <!-- PO Details -->
          <div v-if="selectedPO" class="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <div class="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span class="text-gray-600">Supplier:</span>
                <p class="font-semibold">{{ selectedPO.vendor_name }}</p>
              </div>
              <div>
                <span class="text-gray-600">Expected Date:</span>
                <p class="font-semibold">{{ formatDate(selectedPO.expected_date) }}</p>
              </div>
              <div>
                <span class="text-gray-600">Total Amount:</span>
                <p class="font-semibold">{{ formatCurrency(selectedPO.total_amount || 0) }}</p>
              </div>
            </div>
          </div>

          <!-- Items Table -->
          <div class="border border-gray-200 rounded-lg">
            <div class="px-4 py-3 bg-gray-50">
              <p class="text-sm font-semibold text-gray-800">Received Items</p>
              <p class="text-xs text-gray-500">Masukkan qty yang diterima untuk setiap item PO</p>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ordered</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prev Recv</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outstanding</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Received Qty</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">UoM</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Spec Check</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">QC Document</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remarks</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  <tr v-for="(item, idx) in formItems" :key="idx">
                    <td class="px-4 py-2 text-sm text-gray-900">
                      <div class="font-medium">{{ item.product_name }}</div>
                      <div class="text-xs text-gray-500">#{{ item.product_id }}</div>
                    </td>
                    <td class="px-4 py-2 text-sm text-gray-500">{{ item.po_quantity }}</td>
                    <td class="px-4 py-2 text-sm text-gray-500">{{ item.already_received }}</td>
                    <td class="px-4 py-2 text-sm font-semibold" :class="item.outstanding_qty > 0 ? 'text-orange-600' : 'text-green-600'">{{ item.outstanding_qty }}</td>
                    <td class="px-4 py-2">
                      <input
                        v-model="item.received_quantity"
                        type="number"
                        min="0"
                        :max="item.outstanding_qty"
                        step="0.01"
                        placeholder="Ketik qty..."
                        class="w-24 border-2 border-blue-400 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                        :disabled="isEditing"
                        @input="handleReceivedQtyInput(item, $event)"
                        @focus="($event.target as HTMLInputElement).select()"
                      />
                      <div v-if="(item.outstanding_qty - (item.received_quantity || 0)) > 0 && item.received_quantity > 0" class="mt-1 text-[10px] inline-block px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                        Short: {{ item.outstanding_qty - (item.received_quantity || 0) }}
                      </div>
                    </td>
                    <td class="px-4 py-2 text-sm text-gray-700">{{ item.unit_of_measure }}</td>
                    <td class="px-4 py-2 text-center">
                      <label class="inline-flex items-center cursor-pointer" :class="{ 'cursor-not-allowed': isEditing }">
                        <input
                          v-model="item.spec_checked"
                          type="checkbox"
                          class="form-checkbox h-5 w-5 text-green-600 rounded"
                          :disabled="isEditing"
                          @change="updateShortageRemark(item)"
                        />
                        <span class="ml-2 text-sm" :class="item.spec_checked ? 'text-green-700 font-semibold' : 'text-gray-500'">{{ item.spec_checked ? '✓ OK' : 'Check' }}</span>
                      </label>
                    </td>
                    <td class="px-4 py-2">
                      <div class="space-y-1">
                        <!-- Upload button (always visible unless fully approved) -->
                        <label v-if="(selectedGRN?.approval_status || 0) < 2" class="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-medium cursor-pointer hover:bg-indigo-100 transition-colors">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          Upload
                          <input type="file" accept="image/*,.pdf" class="hidden" @change="(e) => handleFileUpload(idx, e)" />
                        </label>
                        <!-- File preview -->
                        <div v-if="item.qc_file_name" class="text-xs text-green-700 flex items-center gap-1">
                          <span>✅</span>
                          <a v-if="item.qc_file_data" :href="item.qc_file_data" target="_blank" class="text-blue-600 hover:underline">{{ item.qc_file_name }}</a>
                          <span v-else>{{ item.qc_file_name }}</span>
                          <button v-if="(selectedGRN?.approval_status || 0) < 2" @click="removeFile(idx)" class="text-red-500 hover:text-red-700 ml-1" title="Remove">✕</button>
                        </div>
                        <span v-if="!item.qc_file_name" class="text-xs text-gray-400">No document</span>
                      </div>
                    </td>
                    <td class="px-4 py-2">
                      <input
                        v-model="item.remarks"
                        type="text"
                        placeholder="e.g., OK, Rusak, Kurang"
                        class="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm"
                        :disabled="isEditing"
                      />
                    </td>
                  </tr>
                  <tr v-if="formItems.length === 0">
                    <td colspan="9" class="px-4 py-4 text-center text-gray-500 text-sm">Pilih PO untuk load items.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Notes -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea v-model="form.notes" rows="3" placeholder="Catatan penerimaan, kondisi barang, dll" class="w-full border border-gray-300 rounded-lg px-3 py-2" :disabled="isEditing"></textarea>
          </div>

          <!-- Summary -->
          <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-600">Total Items in PO:</span>
              <span class="font-semibold">{{ formItems.length }}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-600">Items Received:</span>
              <span class="font-semibold">{{ itemsReceived }} / {{ formItems.length }}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-600">Spec Checked:</span>
              <span class="font-semibold" :class="itemsSpecChecked === formItems.length ? 'text-green-600' : 'text-orange-600'">{{ itemsSpecChecked }} / {{ formItems.length }}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-600">Short Items:</span>
              <span class="font-semibold text-red-600">{{ shortItems.length > 0 ? shortItems.join(', ') : 'None' }}</span>
            </div>
          </div>

          <!-- Actions / Footer -->
          <div class="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-white mt-auto">
            <div class="flex items-center gap-2">
              <button @click="closeModal" class="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                v-if="isEditing"
                @click="printGRN"
                class="px-4 py-2 text-sm bg-slate-700 text-white rounded-lg hover:bg-slate-800 flex items-center gap-2"
              >
                🖨️ Print GRN
              </button>
            </div>
            <div class="space-x-2">
              <button
                v-if="!isEditing"
                @click="saveDraft"
                class="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                :disabled="submitting"
              >
                Save as Draft
              </button>
              <button
                v-if="!isEditing"
                @click="submitGRN"
                class="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                :disabled="submitting || formItems.length === 0"
              >
                Confirm Receipt
              </button>
              <button
                v-if="isEditing && selectedGRN?.status === 'draft'"
                @click="updateGRN"
                class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                :disabled="submitting"
              >
                💾 Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useGoodReceiptStore } from '../stores/goodreceipts';
import { useWarehouseStore } from '../stores/warehouse';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';
import { useApprovalWorkflow } from '../composables/useApprovalWorkflow';
import { formatCurrency } from '../utils/format';

interface PODetail {
  id: number;
  po_number: string;
  vendor_name: string;
  expected_date: string;
  total_amount: number;
  items: any[];
}

interface GRItem {
  product_id: number;
  product_name: string;
  po_item_id: number | null;
  po_quantity: number;
  already_received: number;
  outstanding_qty: number;
  received_quantity: number;
  unit_of_measure: string;
  spec_checked: boolean;
  remarks: string;
  qc_file_name?: string;
  qc_file_data?: string;
}

const store = useGoodReceiptStore();
const warehouseStore = useWarehouseStore();
const authStore = useAuthStore();
const { canApprove, canReject } = useApprovalWorkflow('procurement.grn');

const showModal = ref(false);
const isEditing = ref(false);
const submitting = ref(false);
const successMsg = ref('');
const selectedGRN = ref<any>(null);

const form = ref({
  po_id: null as number | null,
  warehouse_id: null as number | null,
  received_at: new Date().toISOString().slice(0, 16),
  received_by: authStore.user?.id || null,
  notes: ''
});

const formItems = ref<GRItem[]>([]);
const selectedPO = ref<PODetail | null>(null);
const availablePOs = ref<any[]>([]);
const warehouses = ref<any[]>([]);

const itemsReceived = computed(() => formItems.value.filter(item => item.received_quantity > 0).length);

const itemsSpecChecked = computed(() => formItems.value.filter(item => item.spec_checked).length);

const shortItems = computed(() => {
  return formItems.value
    .filter(item => {
      const received = item.received_quantity || 0;
      return received < item.outstanding_qty;
    })
    .map(item => `${item.product_name} (${item.outstanding_qty - (item.received_quantity || 0)})`);
});

const fetchData = async () => {
  await store.fetchGoodReceipts();
  await loadAvailablePOs();
  await loadWarehouses();
};

const loadAvailablePOs = async () => {
  try {
    const response = await api.get('/procurement/purchase-orders');
    
    // P0-1: allow partial GRN — show all approved POs that still have outstanding items
    availablePOs.value = (response.data.data || []).filter((po: any) => {
      return po.approval_status === 2 && po.status !== 'RECEIVED';
    });
  } catch (error) {
    console.error('Failed to load POs:', error);
  }
};

const loadWarehouses = async () => {
  try {
    if (!warehouseStore.warehouses.length) {
      await warehouseStore.fetchWarehouses();
    }
    warehouses.value = warehouseStore.warehouses;
  } catch (error) {
    console.error('Failed to load warehouses:', error);
  }
};

const onPOSelected = async () => {
  formItems.value = [];
  selectedPO.value = null;

  if (!form.value.po_id) {
    console.log('No PO selected');
    return;
  }

  console.log('Loading PO details for ID:', form.value.po_id);

  try {
    const response = await api.get(`/procurement/purchase-orders/${form.value.po_id}`);
    console.log('PO API response:', response.data);
    
    const po = response.data.data;
    selectedPO.value = {
      id: po.id,
      po_number: po.po_number,
      vendor_name: po.vendor_name,
      expected_date: po.expected_date,
      total_amount: po.total_amount,
      items: po.items || []
    };

    console.log('Selected PO:', selectedPO.value);
    console.log('PO items array:', po.items);

    // P0-3: load PO items with po_item_id and outstanding qty
    if (po.items && po.items.length > 0) {
      console.log('Found', po.items.length, 'items in PO response');
      
      formItems.value = po.items
        .filter((item: any) => {
          const ordered = Number(item.quantity || item.qty || 0);
          const received = Number(item.received_qty || 0);
          return ordered > received;
        })
        .map((item: any) => {
          const ordered = Number(item.quantity || item.qty || 0);
          const received = Number(item.received_qty || 0);
          const outstanding = Math.max(ordered - received, 0);
          return {
            product_id: item.product_id,
            product_name: item.product_name || item.name,
            po_item_id: item.id || null,
            po_quantity: ordered,
            already_received: received,
            outstanding_qty: outstanding,
            received_quantity: 0,
            unit_of_measure: item.unit || item.uom,
            spec_checked: false,
            remarks: ''
          };
        });
      
      console.log('✅ Loaded', formItems.value.length, 'items from PO');
    } else {
      console.warn('⚠️ PO has no items - no items to load');
      alert('This PO has no items. Please check the PO.');
    }
  } catch (error: any) {
    console.error('Failed to load PO details:', error);
    alert('Failed to load PO: ' + (error.response?.data?.error || error.message));
  }
};

const validateQty = (item: GRItem) => {
  if (item.received_quantity === undefined || item.received_quantity === null) return;
  // P0-1: cap at outstanding qty, not total po_quantity
  if (item.received_quantity > item.outstanding_qty) {
    item.received_quantity = item.outstanding_qty;
  }
  if (item.received_quantity < 0) {
    item.received_quantity = 0;
  }
};

const handleReceivedQtyInput = (item: GRItem, event: Event) => {
  const target = event.target as HTMLInputElement;
  item.received_quantity = parseFloat(target.value) || 0;
  validateQty(item);
  updateShortageRemark(item);
};

const isAutoRemark = (txt: string | undefined | null) => (txt || '').startsWith('[auto]');
const updateShortageRemark = (item: GRItem) => {
  const received = item.received_quantity || 0;
  const shortage = Math.max(0, (item.outstanding_qty || 0) - received);
  if (shortage > 0 && item.spec_checked) {
    if (!item.remarks || isAutoRemark(item.remarks)) {
      item.remarks = `[auto] Short by ${shortage}`;
    }
  } else {
    if (isAutoRemark(item.remarks)) {
      item.remarks = '';
    }
  }
};

const saveDraft = async () => {
  if (!form.value.po_id) {
    alert('Pilih PO terlebih dahulu');
    return;
  }
  if (!form.value.warehouse_id) {
    alert('Pilih Warehouse terlebih dahulu');
    return;
  }

  submitting.value = true;
  try {
    await store.createGoodReceipt({
      po_id: form.value.po_id,
      warehouse_id: form.value.warehouse_id,
      received_date: toDateOnly(form.value.received_at) || undefined,
      notes: JSON.stringify({
        items: formItems.value,
        generalNotes: form.value.notes
      }),
      status: 'draft'
    });
    successMsg.value = 'GRN saved as draft';
    closeModal();
    await fetchData();
  } catch (error: any) {
    alert(error?.response?.data?.error || 'Failed to save GRN');
  } finally {
    submitting.value = false;
  }
};

const submitGRN = async () => {
  if (!form.value.po_id) {
    alert('Pilih PO terlebih dahulu');
    return;
  }
  if (!form.value.warehouse_id) {
    alert('Pilih Warehouse terlebih dahulu');
    return;
  }
  if (formItems.value.length === 0) {
    alert('Tambah items terlebih dahulu');
    return;
  }

  // Validate at least some quantities received
  const totalReceived = formItems.value.reduce((sum, item) => sum + (item.received_quantity || 0), 0);
  if (totalReceived === 0) {
    alert('❌ ERROR: Masukkan qty yang diterima untuk minimal 1 item!\n\nRECEIVED QTY harus > 0');
    return;
  }

  submitting.value = true;
  try {
    await store.createGoodReceipt({
      po_id: form.value.po_id,
      warehouse_id: form.value.warehouse_id,
      received_date: toDateOnly(form.value.received_at) || undefined,
      notes: JSON.stringify({
        items: formItems.value,
        generalNotes: form.value.notes
      }),
      status: 'received'
    });
    successMsg.value = 'GRN created & stok updated';
    closeModal();
    await fetchData();
  } catch (error: any) {
    alert(error?.response?.data?.error || 'Failed to create GRN');
  } finally {
    submitting.value = false;
  }
};

const approveGRN = async (id: number) => {
  if (!confirm('Approve GRN? Pastikan semua data sudah benar.')) return;

  submitting.value = true;
  try {
    await store.approveGoodReceipt(id);
    successMsg.value = 'GRN approved';
    await fetchData();
  } catch (error: any) {
    alert(error?.response?.data?.error || 'Failed to approve GRN');
  } finally {
    submitting.value = false;
  }
};

const rejectGRN = async (id: number) => {
  if (!confirm('Reject dan kembalikan GRN ke pending?')) return;

  submitting.value = true;
  try {
    await store.rejectGoodReceipt(id);
    successMsg.value = 'GRN rejected successfully';
    await fetchData();
  } catch (error: any) {
    alert(error?.response?.data?.error || 'Failed to reject GRN');
  } finally {
    submitting.value = false;
  }
};

const viewGRN = async (gr: any) => {
  isEditing.value = (gr.approval_status || 0) > 0;
  selectedGRN.value = gr;
  form.value = {
    po_id: gr.po_id,
    warehouse_id: gr.warehouse_id,
    received_at: toDateTimeLocal(gr.received_date || gr.received_at),
    received_by: gr.received_by || authStore.user?.id || null,
    notes: gr.notes || ''
  };

  try {
    const notes = JSON.parse(gr.notes || '{}');
    formItems.value = notes.items || [];
    selectedPO.value = await loadPOData(gr.po_id);
  } catch (error) {
    console.error('Failed to load GRN details:', error);
  }

  showModal.value = true;
};

const updateGRN = async () => {
  if (!selectedGRN.value) return;

  submitting.value = true;
  try {
    await api.put(`/procurement/goods-receipts/${selectedGRN.value.id}`, {
      warehouse_id: form.value.warehouse_id,
      received_date: toDateOnly(form.value.received_at),
      received_by: form.value.received_by || authStore.user?.id,
      status: 'draft',
      notes: JSON.stringify({ items: formItems.value, generalNotes: form.value.notes })
    });
    successMsg.value = 'GRN updated successfully';
    closeModal();
    await fetchData();
  } catch (error: any) {
    alert(error?.response?.data?.error || 'Failed to update GRN');
  } finally {
    submitting.value = false;
  }
};

const deleteGRN = async (id: number) => {
  if (!confirm('Delete this draft GRN? This action cannot be undone.')) return;

  submitting.value = true;
  try {
    await api.delete(`/procurement/goods-receipts/${id}`);
    successMsg.value = 'GRN deleted successfully';
    await fetchData();
  } catch (error: any) {
    alert(error?.response?.data?.error || 'Failed to delete GRN');
  } finally {
    submitting.value = false;
  }
};

const loadPOData = async (poId: number) => {
  try {
    const response = await api.get(`/procurement/purchase-orders/${poId}`);
    const po = response.data.data;
    return {
      id: po.id,
      po_number: po.po_number,
      vendor_name: po.vendor_name,
      expected_date: po.expected_date,
      total_amount: po.total_amount,
      items: po.items || []
    };
  } catch (error) {
    console.error('Failed to load PO:', error);
    return null;
  }
};

const openCreateModal = () => {
  isEditing.value = false;
  form.value = {
    po_id: null,
    warehouse_id: null,
    received_at: new Date().toISOString().slice(0, 16),
    received_by: authStore.user?.id || 1,
    notes: ''
  };
  formItems.value = [];
  selectedPO.value = null;
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  successMsg.value = '';
};

const toDateOnly = (value: string | null | undefined) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.includes('T') ? trimmed.split('T')[0] : trimmed;
};

const toDateTimeLocal = (value: string | null | undefined) => {
  if (!value) return new Date().toISOString().slice(0, 16);
  const trimmed = value.trim();
  if (!trimmed) return new Date().toISOString().slice(0, 16);
  return trimmed.includes('T') ? trimmed.slice(0, 16) : `${trimmed}T00:00`;
};

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('id-ID');
};



const statusBadgeClass = (status: string) => {
  const classes = {
    draft: 'bg-yellow-100 text-yellow-800',
    received: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800'
  };
  return classes[status as keyof typeof classes] || 'bg-gray-100 text-gray-800';
};

const statusLabel = (status: string) => {
  const labels = {
    draft: 'Draft',
    received: 'Received',
    approved: 'Approved'
  };
  return labels[status as keyof typeof labels] || status;
};

const approvalBadgeClass = (approval?: number) => {
  const classes: Record<number, string> = {
    [-1]: 'bg-red-100 text-red-800',
    0: 'bg-yellow-100 text-yellow-800',
    1: 'bg-blue-100 text-blue-800',
    2: 'bg-green-100 text-green-800'
  };
  return classes[approval ?? 0] || 'bg-gray-100 text-gray-800';
};

const approvalLabel = (approval?: number) => {
  if (approval === 2) return 'Approved (Manager/Director)';
  if (approval === 1) return 'Approved (Supervisor)';
  if (approval === -1) return 'Rejected';
  return 'Pending';
};

const canApproveGRN = (gr: any) => {
  return canApprove(Number(gr.approval_status || 0));
};

const canRejectGRN = (gr: any) => {
  return canReject(Number(gr.approval_status || 0));
};

const handleFileUpload = (idx: number, event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  // Max 5MB
  if (file.size > 5 * 1024 * 1024) {
    alert('File too large. Max 5MB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    formItems.value[idx].qc_file_name = file.name;
    formItems.value[idx].qc_file_data = e.target?.result as string;
  };
  reader.readAsDataURL(file);
};

const removeFile = (idx: number) => {
  formItems.value[idx].qc_file_name = undefined;
  formItems.value[idx].qc_file_data = undefined;
};

function printGRN() {
  const grNumber = selectedGRN.value?.gr_number || 'GRN';
  const poNumber = selectedGRN.value?.po_number || selectedPO.value?.po_number || '-';
  const vendor = selectedPO.value?.vendor_name || '-';
  const warehouse = warehouses.value.find((w: any) => w.id === form.value.warehouse_id)?.name || '-';
  const receivedDate = formatDate(form.value.received_at);
  const receivedBy = authStore.user?.name || '-';

  const itemRows = formItems.value.map((item, idx) => {
    const qtyMatch = Number(item.received_quantity) >= Number(item.po_quantity);
    const specOk = item.spec_checked;
    const qcDoc = item.qc_file_name || '-';
    return `
      <tr>
        <td style="text-align:center">${idx + 1}</td>
        <td><strong>${item.product_name}</strong></td>
        <td style="text-align:center">${item.po_quantity}</td>
        <td style="text-align:center">${item.received_quantity}</td>
        <td style="text-align:center">${item.unit_of_measure}</td>
        <td style="text-align:center"><span style="color:${qtyMatch ? 'green' : 'red'};font-weight:bold">${qtyMatch ? '✓ OK' : 'SHORT'}</span></td>
        <td style="text-align:center"><span style="color:${specOk ? 'green' : 'red'};font-weight:bold">${specOk ? '✓ PASS' : '✗ FAIL'}</span></td>
        <td style="font-size:10px">${qcDoc}</td>
        <td style="font-size:11px">${item.remarks || '-'}</td>
      </tr>`;
  }).join('');

  const printContent = `
    <html>
      <head>
        <title>GRN - ${grNumber}</title>
        <style>
          body { font-family: 'Arial', sans-serif; margin: 30px; font-size: 12px; color: #000; }
          * { box-sizing: border-box; }
          h1 { font-size: 20px; margin: 0; }
          h2 { font-size: 14px; margin: 0; color: #555; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #000; padding-bottom: 15px; margin-bottom: 15px; }
          .header-left h1 { letter-spacing: 1px; }
          .header-right { text-align: right; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px; padding: 10px; background: #f8f8f8; border: 1px solid #ddd; border-radius: 4px; }
          .info-item label { font-size: 10px; color: #666; text-transform: uppercase; font-weight: bold; display: block; margin-bottom: 2px; }
          .info-item span { font-size: 13px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #000; padding: 8px; font-size: 12px; vertical-align: top; }
          th { background: #f0f0f0; font-size: 11px; text-transform: uppercase; text-align: center; font-weight: bold; }
          .summary { background: #f8f8f8; border: 1px solid #ddd; padding: 15px; margin-bottom: 30px; border-radius: 4px; }
          .summary-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
          .signatures { display: flex; justify-content: space-between; margin-top: 50px; }
          .sig-box { width: 30%; text-align: center; }
          .sig-line { border-bottom: 1px solid #000; margin-top: 50px; margin-bottom: 5px; }
          .sig-label { font-size: 10px; font-weight: bold; text-transform: uppercase; }
          @media print { body { margin: 15px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <h1>GOODS RECEIPT NOTE</h1>
            <h2>Rheologi Biotech Indonesia</h2>
          </div>
          <div class="header-right">
            <div style="font-size:16px;font-weight:bold">${grNumber}</div>
            <div style="font-size:11px;color:#555">Date: ${receivedDate}</div>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-item"><label>PO Number</label><span>${poNumber}</span></div>
          <div class="info-item"><label>Supplier</label><span>${vendor}</span></div>
          <div class="info-item"><label>Warehouse</label><span>${warehouse}</span></div>
          <div class="info-item"><label>Received By</label><span>${receivedBy}</span></div>
          <div class="info-item"><label>Received Date</label><span>${receivedDate}</span></div>
          <div class="info-item"><label>Status</label><span>${selectedGRN.value?.status?.toUpperCase() || 'RECEIVED'}</span></div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:5%">No</th>
              <th style="width:25%">Item Description</th>
              <th style="width:8%">PO Qty</th>
              <th style="width:10%">Received Qty</th>
              <th style="width:7%">UoM</th>
              <th style="width:10%">Qty Status</th>
              <th style="width:10%">QC Status</th>
              <th style="width:13%">QC Document</th>
              <th style="width:12%">Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>

        <div class="summary">
          <div class="summary-row"><span>Total Items:</span><strong>${formItems.value.length}</strong></div>
          <div class="summary-row"><span>Items Received:</span><strong>${itemsReceived.value} / ${formItems.value.length}</strong></div>
          <div class="summary-row"><span>QC Passed:</span><strong style="color:${itemsSpecChecked.value === formItems.value.length ? 'green' : 'orange'}">${itemsSpecChecked.value} / ${formItems.value.length}</strong></div>
          <div class="summary-row"><span>Short Items:</span><strong style="color:${shortItems.value.length > 0 ? 'red' : 'green'}">${shortItems.value.length > 0 ? shortItems.value.join(', ') : 'None'}</strong></div>
        </div>

        <div class="signatures">
          <div class="sig-box">
            <div class="sig-label">Received By</div>
            <div class="sig-line"></div>
            <div>${receivedBy}</div>
          </div>
          <div class="sig-box">
            <div class="sig-label">Checked By (QC)</div>
            <div class="sig-line"></div>
            <div>________________</div>
          </div>
          <div class="sig-box">
            <div class="sig-label">Approved By</div>
            <div class="sig-line"></div>
            <div>________________</div>
          </div>
        </div>
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(printContent);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 300);
  }
}

onMounted(() => {
  fetchData();
});
</script>
