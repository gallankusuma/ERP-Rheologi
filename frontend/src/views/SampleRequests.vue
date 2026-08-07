<template>
  <div class="space-y-6">
    <header class="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <div>
        <h1 class="text-2xl font-bold text-slate-800">Sample Requests</h1>
        <p class="text-sm text-slate-500 mt-1">Manage sample requests from Sales to RnD</p>
      </div>
      <button @click="openCreateModal" class="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2 shadow-sm shadow-primary-500/20">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        New Request
      </button>
    </header>

    <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-600 uppercase tracking-wider">
              <th class="p-4">Request #</th>
              <th class="p-4">Client</th>
              <th class="p-4">Product</th>
              <th class="p-4">Target Date</th>
              <th class="p-4">Status</th>
              <th class="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="req in requests" :key="req.id" class="hover:bg-slate-50/50 transition-colors cursor-pointer" @click="viewDetails(req)">
              <td class="p-4 font-medium text-slate-900">{{ req.request_number }}</td>
              <td class="p-4 text-slate-600">{{ req.client_name }}</td>
              <td class="p-4 text-slate-600">
                <div class="font-medium text-slate-900">{{ req.product_name }}</div>
                <div class="text-xs text-slate-400 mt-1">{{ req.quantity }} {{ req.unit }}</div>
              </td>
              <td class="p-4 text-slate-600">{{ formatDate(req.target_delivery_date) }}</td>
              <td class="p-4">
                <span :class="['px-3 py-1 rounded-full text-xs font-medium border', getStatusClass(req.status)]">
                  {{ req.status }}
                </span>
              </td>
              <td class="p-4 text-right space-x-2" @click.stop>
                <button @click="viewDetails(req)" class="text-slate-400 hover:text-primary-600 transition-colors" title="View Details">
                  <svg class="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                </button>
                <button @click="openStatusModal(req)" class="text-slate-400 hover:text-orange-500 transition-colors" title="Update Status">
                  <svg class="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                </button>
              </td>
            </tr>
            <tr v-if="requests.length === 0">
              <td colspan="6" class="p-8 text-center text-slate-500">No sample requests found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" @click="showModal = false"></div>
      <div class="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div class="flex items-center justify-between px-8 py-6 border-b border-slate-100">
          <h3 class="text-lg font-bold text-slate-800">New Sample Request</h3>
          <button @click="showModal = false" class="text-slate-400 hover:text-slate-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <form @submit.prevent="saveRequest" class="p-8 overflow-y-auto space-y-6">
          <div class="grid grid-cols-2 gap-6">
            <div class="space-y-2">
              <label class="text-sm font-semibold text-slate-700">Client <span class="text-red-500">*</span></label>
              <select v-model="form.client_id" required class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none">
                <option value="">Select Client</option>
                <option v-for="client in clients" :key="client.id" :value="client.id">{{ client.name }}</option>
              </select>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-semibold text-slate-700">Target Delivery Date <span class="text-red-500">*</span></label>
              <input type="date" v-model="form.target_delivery_date" required class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-primary-100 outline-none" />
            </div>
          </div>
          
          <div class="space-y-2">
            <label class="text-sm font-semibold text-slate-700">Product Name <span class="text-red-500">*</span></label>
            <select v-model="form.product_name" required class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-primary-100 outline-none">
              <option value="">Select BOM / Product</option>
              <option v-for="bom in boms" :key="bom.id" :value="bom.product_name">{{ bom.product_name }} (v{{ bom.version }})</option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-6">
            <div class="space-y-2">
              <label class="text-sm font-semibold text-slate-700">Quantity <span class="text-red-500">*</span></label>
              <input type="number" v-model="form.quantity" required min="1" class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-primary-100 outline-none" />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-semibold text-slate-700">Unit</label>
              <input type="text" v-model="form.unit" placeholder="pcs, gr, ml" class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-primary-100 outline-none" />
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-sm font-semibold text-slate-700">Specifications / Requirements</label>
            <textarea v-model="form.specifications" rows="4" placeholder="Viscosity, color, pH, specific packaging, etc." class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-primary-100 outline-none resize-none"></textarea>
          </div>
        </form>

        <div class="px-8 py-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 mt-auto rounded-b-2xl">
          <button @click="showModal = false" type="button" class="px-6 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors font-medium">Cancel</button>
          <button @click="saveRequest" class="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-sm shadow-primary-500/20">Submit Request</button>
        </div>
      </div>
    </div>

    <!-- Status/Feedback Modal -->
    <div v-if="showStatusModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" @click="showStatusModal = false"></div>
      <div class="relative w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col">
        <div class="flex items-center justify-between px-8 py-6 border-b border-slate-100">
          <h3 class="text-lg font-bold text-slate-800">Update Status</h3>
          <button @click="showStatusModal = false" class="text-slate-400 hover:text-slate-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div class="p-8 space-y-6">
          <div class="space-y-2">
            <label class="text-sm font-semibold text-slate-700">Status</label>
            <select v-model="statusForm.status" class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-primary-100 outline-none">
              <option value="Requested">Requested</option>
              <option value="In Progress">In Progress (RnD)</option>
              <option value="Ready for Delivery">Ready for Delivery</option>
              <option value="Delivered">Delivered</option>
              <option value="Feedback Received">Feedback Received</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          
          <div class="space-y-2" v-if="['Ready for Delivery', 'Delivered'].includes(statusForm.status)">
            <label class="text-sm font-semibold text-slate-700">Delivery Tracking / Resi</label>
            <input type="text" v-model="statusForm.delivery_tracking" placeholder="Resi JNE/Tiki etc" class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-primary-100 outline-none" />
          </div>

          <div class="space-y-2" v-if="statusForm.status === 'Feedback Received' || selectedReq?.status === 'Feedback Received'">
            <label class="text-sm font-semibold text-slate-700">Client Feedback</label>
            <textarea v-model="statusForm.client_feedback" rows="4" placeholder="Client comments..." class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-primary-100 outline-none resize-none"></textarea>
          </div>
        </div>

        <div class="px-8 py-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
          <button @click="showStatusModal = false" class="px-6 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100 font-medium">Cancel</button>
          <button @click="updateStatus" class="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium">Save Status</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/lib/api';

const router = useRouter();

const requests = ref<any[]>([]);
const clients = ref<any[]>([]);
const boms = ref<any[]>([]);
const showModal = ref(false);
const showStatusModal = ref(false);
const selectedReq = ref<any>(null);

const form = ref({
  client_id: '',
  sales_user_id: 1, // Will be overridden by backend or user context ideally
  product_name: '',
  specifications: '',
  quantity: 1,
  unit: 'pcs',
  target_delivery_date: ''
});

const statusForm = ref({
  status: '',
  delivery_tracking: '',
  client_feedback: ''
});

const fetchRequests = async () => {
  try {
    const res = await api.get('/sample-requests');
    requests.value = res.data?.data || [];
  } catch (error) {
    console.error(error);
  }
};

const fetchClients = async () => {
  try {
    const res = await api.get('/clients');
    clients.value = res.data?.data || [];
  } catch (error) {
    console.error(error);
  }
};

const fetchBoms = async () => {
  try {
    const res = await api.get('/bom');
    boms.value = res.data?.data || [];
  } catch (error) {
    console.error(error);
  }
};

const openCreateModal = () => {
  form.value = {
    client_id: '',
    sales_user_id: 1, 
    product_name: '',
    specifications: '',
    quantity: 1,
    unit: 'pcs',
    target_delivery_date: ''
  };
  showModal.value = true;
};

const saveRequest = async () => {
  if (!form.value.client_id || !form.value.product_name) {
    alert("Please fill required fields");
    return;
  }
  
  // Dummy user context if needed, wait backend accepts sales_user_id
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  form.value.sales_user_id = currentUser?.id || 1;

  try {
    await api.post('/sample-requests', form.value);
    showModal.value = false;
    fetchRequests();
  } catch (error: any) {
    alert(error.response?.data?.error || "Error saving request");
  }
};

const openStatusModal = (req: any) => {
  selectedReq.value = req;
  statusForm.value = {
    status: req.status || 'Requested',
    delivery_tracking: req.delivery_tracking || '',
    client_feedback: req.client_feedback || ''
  };
  showStatusModal.value = true;
};

const updateStatus = async () => {
  try {
    if (statusForm.value.status === 'Feedback Received' && statusForm.value.client_feedback) {
      await api.put(`/sample-requests/${selectedReq.value.id}/feedback`, { client_feedback: statusForm.value.client_feedback });
    } else {
      await api.put(`/sample-requests/${selectedReq.value.id}/status`, { 
        status: statusForm.value.status, 
        delivery_tracking: statusForm.value.delivery_tracking 
      });
    }
    showStatusModal.value = false;
    fetchRequests();
  } catch (error: any) {
    alert(error.response?.data?.error || "Error updating status");
  }
};

const viewDetails = (req: any) => {
  router.push(`/sample-requests/${req.id}`);
};

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-GB');
};

const getStatusClass = (status: string) => {
  switch (status) {
    case 'Requested': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'In Progress': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    case 'Ready for Delivery': return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'Delivered': return 'bg-teal-50 text-teal-700 border-teal-200';
    case 'Feedback Received': return 'bg-green-50 text-green-700 border-green-200';
    case 'Cancelled': return 'bg-red-50 text-red-700 border-red-200';
    default: return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

onMounted(() => {
  fetchRequests();
  fetchClients();
  fetchBoms();
});
</script>
