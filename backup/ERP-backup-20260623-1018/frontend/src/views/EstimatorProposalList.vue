<template>
  <div class="p-6">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-800">📋 Proposal & Estimation</h1>
        <p class="text-gray-600 mt-1">Manage EPC construction proposals and cost estimations</p>
      </div>
      <button @click="showCreateModal = true" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 flex items-center gap-2">
        <span class="text-xl">+</span>
        <span>New Proposal</span>
      </button>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
      <div class="bg-white p-4 rounded-lg shadow">
        <p class="text-sm text-gray-600">Total Proposals</p>
        <p class="text-2xl font-bold text-gray-800">{{ proposals.length }}</p>
      </div>
      <div class="bg-white p-4 rounded-lg shadow">
        <p class="text-sm text-gray-600">Draft</p>
        <p class="text-2xl font-bold text-yellow-600">{{ proposals.filter(p => p.status === 'draft').length }}</p>
      </div>
      <div class="bg-white p-4 rounded-lg shadow">
        <p class="text-sm text-gray-600">In Review</p>
        <p class="text-2xl font-bold text-blue-600">{{ proposals.filter(p => p.status === 'review').length }}</p>
      </div>
      <div class="bg-white p-4 rounded-lg shadow">
        <p class="text-sm text-gray-600">Submitted</p>
        <p class="text-2xl font-bold text-purple-600">{{ proposals.filter(p => p.status === 'submitted').length }}</p>
      </div>
      <div class="bg-white p-4 rounded-lg shadow">
        <p class="text-sm text-gray-600">Deal</p>
        <p class="text-2xl font-bold text-green-600">{{ proposals.filter(p => p.status === 'deal').length }}</p>
      </div>
    </div>

    <!-- Proposals Table -->
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proposal #</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project Name</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lokasi</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revision</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Project</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="proposal in proposals" :key="proposal.id" class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
              {{ proposal.proposal_number }}
            </td>
            <td class="px-6 py-4 text-sm text-gray-900">{{ proposal.project_name }}</td>
            <td class="px-6 py-4 text-sm text-gray-600">{{ proposal.client || '-' }}</td>
            <td class="px-6 py-4 text-sm text-gray-600">{{ proposal.lokasi || '-' }}</td>
            <td class="px-6 py-4 text-sm text-gray-600">{{ proposal.revision }}</td>
            <td class="px-6 py-4 text-sm font-semibold text-gray-900">
              {{ formatCurrency(proposal.total_project) }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span :class="statusClass(proposal.status)" class="px-2 py-1 text-xs font-semibold rounded-full">
                {{ proposal.status.toUpperCase() }}
              </span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-600">{{ formatDate(proposal.created_at) }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
              <button @click="openProposal(proposal.id)" class="text-blue-600 hover:text-blue-800 mr-3">
                Open
              </button>
              <router-link v-if="proposal.project_id" :to="`/projects/${proposal.project_id}`" class="text-green-600 hover:text-green-800 mr-3">
                View Project
              </router-link>
              <button v-if="proposal.status !== 'deal'" @click="deleteProposal(proposal.id)" class="text-red-600 hover:text-red-800">
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      
      <div v-if="proposals.length === 0" class="text-center py-12 text-gray-500">
        <p class="text-lg">No proposals yet</p>
        <p class="text-sm mt-2">Create your first proposal to get started</p>
      </div>
    </div>

    <!-- Create Proposal Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" @click.self="showCreateModal = false">
      <div class="bg-white rounded-lg shadow-xl w-full mx-4 max-h-[90vh] flex flex-col" :class="wizardStep === 1 ? 'max-w-3xl' : 'max-w-6xl'">
        <div class="p-6 flex-1 overflow-y-auto">
          <!-- Step indicator -->
          <div class="flex items-center gap-3 mb-5">
            <div class="flex items-center gap-2">
              <span class="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
                :class="wizardStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'">1</span>
              <span class="text-sm font-medium" :class="wizardStep === 1 ? 'text-blue-700' : 'text-gray-500'">Jenis Pekerjaan</span>
            </div>
            <div class="h-px w-8 bg-gray-300"></div>
            <div class="flex items-center gap-2">
              <span class="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
                :class="wizardStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'">2</span>
              <span class="text-sm font-medium" :class="wizardStep === 2 ? 'text-blue-700' : 'text-gray-500'">Detail Proyek</span>
            </div>
          </div>

          <!-- Step 1: Template Wizard -->
          <div v-show="wizardStep === 1">
            <ProposalTemplateWizard 
              ref="templateWizardRef" 
              @type-selected="onTypeSelected"
              @ready="wizardReady = $event"
            />
          </div>

          <!-- Step 2: Project Details -->
          <div v-show="wizardStep === 2">
            <button @click="wizardStep = 1" class="text-sm text-blue-600 hover:text-blue-800 mb-3 flex items-center gap-1">
              ← Kembali pilih jenis pekerjaan
            </button>
            <h2 class="text-xl font-bold mb-4">Detail Proyek</h2>
          
            <form @submit.prevent="createProposal" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
                <input v-model="newProposal.project_name" type="text" required 
                  class="w-full border border-gray-300 rounded-lg px-3 py-2" 
                  placeholder="e.g., EPC Warehouse XYZ">
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Client</label>
                <div class="relative" ref="clientDropdownRef">
                  <div 
                    @click="showClientDropdown = !showClientDropdown"
                    class="w-full border border-gray-300 rounded-lg px-3 py-2 cursor-pointer flex items-center justify-between"
                    :class="selectedClientName ? 'text-gray-900' : 'text-gray-400'"
                  >
                    <span>{{ selectedClientName || 'Select client...' }}</span>
                    <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                    </svg>
                  </div>
                  <div v-if="showClientDropdown" 
                    class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden">
                    <div class="p-2 border-b border-gray-200">
                      <input 
                        v-model="clientSearch" 
                        type="text" 
                        class="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-400" 
                        placeholder="Search client..."
                        @input="filterClients"
                        ref="clientSearchInput"
                      >
                    </div>
                    <div class="max-h-40 overflow-y-auto">
                      <button
                        v-for="client in filteredClients"
                        :key="client.id"
                        type="button"
                        @click="selectClient(client)"
                        class="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-50 last:border-0 flex items-center justify-between"
                      >
                        <span class="font-medium text-gray-800">{{ client.name }}</span>
                        <span v-if="client.code" class="text-gray-400 text-xs">{{ client.code }}</span>
                      </button>
                      <div v-if="filteredClients.length === 0" class="px-3 py-3 text-sm text-gray-500 text-center">
                        No clients found
                      </div>
                    </div>
                    <div class="border-t border-gray-200 p-2">
                      <button type="button" @click="openAddClient" class="w-full text-left px-2 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded flex items-center gap-1.5">
                        <span class="text-lg leading-none">+</span> Add New Client
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Lokasi</label>
                  <input v-model="newProposal.lokasi" type="text" 
                    class="w-full border border-gray-300 rounded-lg px-3 py-2" 
                    placeholder="e.g., Cilegon">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Revision</label>
                  <input v-model="newProposal.revision" type="text" 
                    class="w-full border border-gray-300 rounded-lg px-3 py-2" 
                    placeholder="Rev-0">
                </div>
              </div>

              <div class="flex justify-end space-x-2 pt-4 border-t">
                <button type="button" @click="showCreateModal = false" 
                  class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" 
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Create & Open
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- Footer for step 1 -->
        <div v-if="wizardStep === 1" class="p-4 border-t flex justify-between">
          <button @click="showCreateModal = false" class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <div class="flex gap-2">
            <button @click="skipTemplate" class="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              Skip (Kosong)
            </button>
            <button 
              @click="wizardStep = 2" 
              :disabled="!templateWizardRef?.selectedType"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
              Lanjut →
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/lib/api';
import { formatCurrency } from '@/utils/format';
import ProposalTemplateWizard from '@/components/ProposalTemplateWizard.vue';

const router = useRouter();

interface Proposal {
  id: number;
  proposal_number: string;
  project_name: string;
  client: string;
  client_id: number | null;
  project_id: number | null;
  lokasi: string;
  revision: string;
  status: string;
  total_project: number;
  created_at: string;
  created_by_name: string;
}

interface Client {
  id: number;
  name: string;
  code?: string;
}

const proposals = ref<Proposal[]>([]);
const showCreateModal = ref(false);
const wizardStep = ref(1);
const wizardReady = ref(false);
const templateWizardRef = ref<InstanceType<typeof ProposalTemplateWizard> | null>(null);
const newProposal = ref({
  project_name: '',
  client: '',
  lokasi: '',
  revision: 'Rev-0'
});

// Client search
const clients = ref<Client[]>([]);
const filteredClients = ref<Client[]>([]);
const clientSearch = ref('');
const showClientDropdown = ref(false);
const selectedClientName = ref('');
const selectedClientId = ref<number | null>(null);
const clientDropdownRef = ref<HTMLElement | null>(null);
const clientSearchInput = ref<HTMLInputElement | null>(null);

// Auto-focus search input when dropdown opens
watch(showClientDropdown, (open) => {
  if (open) {
    filterClients();
    nextTick(() => clientSearchInput.value?.focus());
  }
});

const loadClients = async () => {
  try {
    const { data } = await api.get('/clients');
    const list = Array.isArray(data) ? data : (data.data ?? []);
    clients.value = list.map((c: any) => ({ id: c.id, name: c.company_name || c.name, code: c.code }));
  } catch {
    try {
      const { data } = await api.get('/sales/customers');
      const list = Array.isArray(data) ? data : (data.data ?? []);
      clients.value = list.map((c: any) => ({ id: c.id, name: c.name, code: c.code }));
    } catch {
      clients.value = [];
    }
  }
};

const filterClients = () => {
  const q = clientSearch.value.toLowerCase();
  if (!q) {
    filteredClients.value = clients.value.slice(0, 20);
  } else {
    filteredClients.value = clients.value.filter(
      c => c.name.toLowerCase().includes(q) || (c.code && c.code.toLowerCase().includes(q))
    ).slice(0, 20);
  }
};

const selectClient = (client: Client) => {
  selectedClientName.value = client.name;
  selectedClientId.value = client.id;
  newProposal.value.client = client.name;
  clientSearch.value = '';
  showClientDropdown.value = false;
};

const openAddClient = () => {
  showClientDropdown.value = false;
  // Open customers page in new tab so user doesn't lose form data
  window.open('/customers', '_blank');
};

// Close dropdown on click outside
const handleClickOutside = (e: MouseEvent) => {
  if (clientDropdownRef.value && !clientDropdownRef.value.contains(e.target as Node)) {
    showClientDropdown.value = false;
  }
};

const loadProposals = async () => {
  try {
    const { data } = await api.get('/estimator/proposals');
    proposals.value = data;
  } catch (error) {
    console.error('Failed to load proposals:', error);
  }
};

const createProposal = async () => {
  try {
    // Get template data from wizard
    const wizardData: any = templateWizardRef.value?.getResult?.() || {};
    
    const payload = {
      ...newProposal.value,
      client_id: selectedClientId.value || undefined,
      proposal_type: wizardData.type || null,
      design_params: wizardData.design_params || null,
      template_sections: wizardData.template_sections || [],
    };
    const { data } = await api.post('/estimator/proposals', payload);
    showCreateModal.value = false;
    
    // Reset form
    wizardStep.value = 1;
    wizardReady.value = false;
    newProposal.value = {
      project_name: '',
      client: '',
      lokasi: '',
      revision: 'Rev-0'
    };
    clientSearch.value = '';
    selectedClientName.value = '';
    selectedClientId.value = null;
    
    // Open the new proposal
    router.push(`/estimator/proposals/${data.id}`);
  } catch (error) {
    console.error('Failed to create proposal:', error);
    alert('Failed to create proposal');
  }
};

const onTypeSelected = (_type: string | null) => {
  // auto-advance handled by wizard
};

const skipTemplate = () => {
  wizardStep.value = 2;
};

const openProposal = (id: number) => {
  router.push(`/estimator/proposals/${id}`);
};

const deleteProposal = async (id: number) => {
  if (!confirm('Are you sure you want to delete this proposal?')) return;
  
  try {
    await api.delete(`/estimator/proposals/${id}`);
    await loadProposals();
  } catch (error) {
    console.error('Failed to delete proposal:', error);
    alert('Failed to delete proposal');
  }
};

const statusClass = (status: string) => {
  const classes: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    review: 'bg-blue-100 text-blue-800',
    submitted: 'bg-purple-100 text-purple-800',
    deal: 'bg-green-100 text-green-800',
    no_deal: 'bg-red-100 text-red-800',
  };
  return classes[status] || 'bg-gray-100 text-gray-800';
};



const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

onMounted(() => {
  loadProposals();
  loadClients();
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>
