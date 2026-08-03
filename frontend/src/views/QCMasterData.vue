<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-semibold text-slate-800">QC Master Data</h1>
        <p class="text-sm text-slate-500 mt-1">Kelola data master untuk modul Quality Control</p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="border-b border-gray-200">
      <nav class="-mb-px flex space-x-8">
        <a 
          v-for="tab in tabs" 
          :key="tab.id"
          @click.prevent="currentTab = tab.id"
          :class="[
            currentTab === tab.id
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
            'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm cursor-pointer transition-colors'
          ]"
        >
          {{ tab.name }}
        </a>
      </nav>
    </div>

    <!-- ========== SPECIFICATIONS TAB ========== -->
    <div v-if="currentTab === 'specifications'" class="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <!-- Product Selector -->
      <div class="flex justify-between items-center mb-6">
        <div class="flex items-center gap-4">
          <h2 class="text-lg font-medium text-slate-800">Specifications</h2>
          <div class="flex items-center gap-2">
            <div class="flex rounded-md overflow-hidden border border-gray-300 text-xs">
              <button @click="specTypeFilter = ''" :class="specTypeFilter === '' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'" class="px-3 py-1.5 font-medium transition-colors">All</button>
              <button @click="specTypeFilter = 'FG'" :class="specTypeFilter === 'FG' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'" class="px-3 py-1.5 font-medium border-l transition-colors">Finished Good</button>
              <button @click="specTypeFilter = 'RM'" :class="specTypeFilter === 'RM' ? 'bg-orange-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'" class="px-3 py-1.5 font-medium border-l transition-colors">Raw Material</button>
              <button @click="specTypeFilter = 'PM'" :class="specTypeFilter === 'PM' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'" class="px-3 py-1.5 font-medium border-l transition-colors">Packaging</button>
            </div>
            <select v-model="specProductId" @change="loadSpecs" 
              class="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 min-w-[280px]">
              <option value="">-- Pilih Product ({{ filteredProductList.length }}) --</option>
              <option v-for="p in filteredProductList" :key="p.id" :value="p.id">{{ p.name }} ({{ p.sku }})</option>
            </select>
          </div>
        </div>
        <button v-if="specProductId" @click="openSpecForm()" 
          class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium flex items-center gap-2">
          + Tambah Spec
        </button>
      </div>

      <!-- No Product Selected -->
      <div v-if="!specProductId" class="py-12 text-center text-slate-400">
        <div class="text-4xl mb-2">🔬</div>
        Pilih product untuk melihat atau menambah QC Specifications
      </div>

      <!-- Loading -->
      <div v-else-if="specsLoading" class="py-12 text-center text-slate-500">Loading specs...</div>

      <!-- Specs Table -->
      <table v-else-if="specsList.length > 0" class="min-w-full divide-y divide-gray-200">
        <thead>
          <tr class="bg-slate-50">
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parameter</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
            <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Standard</th>
            <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Min</th>
            <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Max</th>
            <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">UOM</th>
            <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">QC Type</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-32">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr v-for="spec in specsList" :key="spec.id" class="hover:bg-slate-50 transition-colors">
            <td class="px-4 py-3 text-sm text-slate-700 font-medium">{{ spec.parameter_name }}</td>
            <td class="px-4 py-3 text-sm text-slate-600">{{ spec.method_name || '-' }}</td>
            <td class="px-4 py-3 text-sm text-center text-slate-700 font-semibold">{{ spec.standard_value }}</td>
            <td class="px-4 py-3 text-sm text-center text-slate-500">{{ spec.min_value ?? '-' }}</td>
            <td class="px-4 py-3 text-sm text-center text-slate-500">{{ spec.max_value ?? '-' }}</td>
            <td class="px-4 py-3 text-sm text-center text-slate-500">{{ spec.uom || '-' }}</td>
            <td class="px-4 py-3 text-sm text-center">
              <span class="px-2 py-0.5 rounded-full text-xs font-bold"
                :class="spec.qc_type === 'LP' ? 'bg-purple-100 text-purple-700' : spec.qc_type === 'FG' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'">
                {{ spec.qc_type || 'LP' }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm font-medium text-right">
              <button @click="openSpecForm(spec)" class="text-blue-600 hover:text-blue-900 mr-4">Edit</button>
              <button @click="deleteSpec(spec)" class="text-red-600 hover:text-red-900">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Empty -->
      <div v-else class="py-12 text-center text-slate-500 text-sm">
        Tidak ada specifications untuk product ini. Klik "+ Tambah Spec" untuk mulai.
      </div>
    </div>

    <!-- ========== GENERIC TABS (Parameters, Methods, Instruments, Areas) ========== -->
    <div v-else class="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-lg font-medium text-slate-800">{{ currentTabName }}</h2>
        <button @click="openForm()" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium flex items-center gap-2">
          + Tambah Data
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="py-12 text-center text-slate-500">
        Loading data...
      </div>

      <!-- Data Table -->
      <table v-else class="min-w-full divide-y divide-gray-200">
        <thead>
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
            <th v-if="currentTab === 'parameters'" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Code</th>
            <th v-if="currentTab === 'parameters'" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Type</th>
            <th v-if="currentTab === 'instruments'" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Calibration Date</th>
            <th v-if="currentTab === 'parameters' || currentTab === 'methods'" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr v-for="item in dataList" :key="item.id" class="hover:bg-slate-50 transition-colors">
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-700 font-medium">{{ item.name }}</td>
            <td v-if="currentTab === 'parameters'" class="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-mono">{{ item.code || '-' }}</td>
            <td v-if="currentTab === 'parameters'" class="px-6 py-4 whitespace-nowrap text-xs">
              <span v-if="item.param_type === 'qualitative'" class="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold">Qualitative</span>
              <span v-else class="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">Quantitative</span>
            </td>
            <td v-if="currentTab === 'instruments'" class="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
              {{ item.calibration_date ? new Date(item.calibration_date).toLocaleDateString() : '-' }}
            </td>
            <td v-if="currentTab === 'parameters' || currentTab === 'methods'" class="px-6 py-4 text-sm text-slate-600">
              {{ item.description || '-' }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
              <button @click="openForm(item)" class="text-blue-600 hover:text-blue-900 mr-4">Edit</button>
              <button @click="confirmDelete(item)" class="text-red-600 hover:text-red-900">Delete</button>
            </td>
          </tr>
          <tr v-if="dataList.length === 0">
            <td colspan="4" class="px-6 py-12 text-center text-slate-500 text-sm">
              Tidak ada data. Klik "+ Tambah Data" untuk mulai.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ========== GENERIC FORM MODAL ========== -->
    <div v-if="showForm" class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div class="p-4 border-b flex justify-between items-center bg-slate-50">
          <h2 class="text-lg font-semibold text-slate-800">{{ form.id ? 'Edit' : 'Tambah' }} {{ currentTabName }}</h2>
          <button @click="showForm = false" class="text-slate-400 hover:text-slate-600">&times;</button>
        </div>
        
        <form @submit.prevent="saveData" class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input v-model="form.name" type="text" required class="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500" />
          </div>

          <div v-if="currentTab === 'instruments'">
            <label class="block text-sm font-medium text-slate-700 mb-1">Calibration Date</label>
            <input v-model="form.calibration_date" type="date" class="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500" />
          </div>

          <div v-if="currentTab === 'parameters' || currentTab === 'methods'">
            <label class="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea v-model="form.description" rows="3" class="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"></textarea>
          </div>

          <div v-if="currentTab === 'parameters'" class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Code</label>
              <input v-model="form.code" type="text" class="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="e.g. 130, 290" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Parameter Type</label>
              <select v-model="form.param_type" class="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500">
                <option value="quantitative">Quantitative (Saplo/Duplo)</option>
                <option value="qualitative">Qualitative (Dropdown)</option>
              </select>
            </div>
          </div>

          <div class="flex justify-end gap-3 pt-4 border-t mt-6">
            <button type="button" @click="showForm = false" class="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">Cancel</button>
            <button type="submit" :disabled="saving" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50">
              {{ saving ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ========== SPEC FORM MODAL ========== -->
    <div v-if="showSpecForm" class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden">
        <div class="p-4 border-b flex justify-between items-center bg-slate-50">
          <h2 class="text-lg font-semibold text-slate-800">{{ specForm.id ? 'Edit' : 'Tambah' }} Specification</h2>
          <button @click="showSpecForm = false" class="text-slate-400 hover:text-slate-600">&times;</button>
        </div>
        
        <form @submit.prevent="saveSpec" class="p-6 space-y-4">
          <!-- Parameter -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Parameter <span class="text-red-500">*</span></label>
            <select v-model="specForm.parameter_id" required class="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500">
              <option value="">-- Pilih Parameter --</option>
              <option v-for="p in parameterList" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>

          <!-- Method -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Method</label>
            <select v-model="specForm.method_id" class="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500">
              <option value="">-- Pilih Method --</option>
              <option v-for="m in methodList" :key="m.id" :value="m.id">{{ m.name }}</option>
            </select>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <!-- Standard Value -->
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Standard <span class="text-red-500">*</span></label>
              <input v-model="specForm.standard_value" type="text" required class="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="e.g. 5000" />
            </div>
            <!-- Min -->
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Min</label>
              <input v-model="specForm.min_value" type="text" class="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="e.g. 4500" />
            </div>
            <!-- Max -->
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Max</label>
              <input v-model="specForm.max_value" type="text" class="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="e.g. 5500" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <!-- UOM -->
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">UOM</label>
              <input v-model="specForm.uom" type="text" class="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="e.g. cPs, pH, %" />
            </div>
            <!-- QC Type -->
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">QC Type <span class="text-red-500">*</span></label>
              <select v-model="specForm.qc_type" required class="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500">
                <option value="LP">LP (Line Process)</option>
                <option value="Incoming">Incoming</option>
                <option value="FG">FG (Finished Goods)</option>
              </select>
            </div>
          </div>

          <div class="flex justify-end gap-3 pt-4 border-t mt-6">
            <button type="button" @click="showSpecForm = false" class="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">Cancel</button>
            <button type="submit" :disabled="specSaving" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50">
              {{ specSaving ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';

const tabs = [
  { id: 'parameters', name: 'Parameters' },
  { id: 'methods', name: 'Methods' },
  { id: 'instruments', name: 'Instruments' },
  { id: 'areas', name: 'Sampling Areas' },
  { id: 'specifications', name: 'Specifications' }
];

const currentTab = ref('parameters');
const currentTabName = computed(() => tabs.find(t => t.id === currentTab.value)?.name || '');

// ========== GENERIC TAB STATE ==========
const dataList = ref<any[]>([]);
const loading = ref(false);
const saving = ref(false);
const showForm = ref(false);
const form = ref<any>({ id: null, name: '', description: '', calibration_date: '' });

const fetchEndpoint = computed(() => `/api/qc/${currentTab.value}`);

const loadData = async () => {
  loading.value = true;
  try {
    const res = await fetch(fetchEndpoint.value, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.ok) {
      const data = await res.json();
      dataList.value = data.data || [];
    }
  } catch (err) {
    console.error('Error loading data:', err);
  } finally {
    loading.value = false;
  }
};

watch(currentTab, (val) => {
  if (val !== 'specifications') loadData();
});

onMounted(() => {
  loadData();
  loadProductList();
  loadParameterList();
  loadMethodList();
});

const openForm = (item?: any) => {
  if (item) {
    form.value = { ...item };
    if (form.value.calibration_date) {
      form.value.calibration_date = form.value.calibration_date.split('T')[0];
    }
  } else {
    form.value = { id: null, name: '', description: '', calibration_date: '', code: '', param_type: 'quantitative' };
  }
  showForm.value = true;
};

const saveData = async () => {
  saving.value = true;
  try {
    const method = form.value.id ? 'PUT' : 'POST';
    const url = form.value.id ? `${fetchEndpoint.value}/${form.value.id}` : fetchEndpoint.value;
    const res = await fetch(url, {
      method,
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}` 
      },
      body: JSON.stringify(form.value)
    });
    if (res.ok) {
      showForm.value = false;
      loadData();
      // Refresh parameter/method lists if those tabs were edited
      if (currentTab.value === 'parameters') loadParameterList();
      if (currentTab.value === 'methods') loadMethodList();
    } else {
      alert('Failed to save data');
    }
  } catch (err) {
    console.error('Save error:', err);
  } finally {
    saving.value = false;
  }
};

const confirmDelete = async (item: any) => {
  if (!confirm(`Are you sure you want to delete ${item.name}?`)) return;
  try {
    const res = await fetch(`${fetchEndpoint.value}/${item.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.ok) {
      loadData();
    } else {
      alert('Failed to delete data. It might be in use.');
    }
  } catch (err) {
    console.error('Delete error:', err);
  }
};

// ========== SPECIFICATIONS TAB STATE ==========
const specProductId = ref<string | number>('');
const specsList = ref<any[]>([]);
const specsLoading = ref(false);
const specSaving = ref(false);
const showSpecForm = ref(false);
const specForm = ref<any>({
  id: null,
  parameter_id: '',
  method_id: '',
  standard_value: '',
  min_value: '',
  max_value: '',
  uom: '',
  qc_type: 'LP'
});

const productList = ref<any[]>([]);
const parameterList = ref<any[]>([]);
const methodList = ref<any[]>([]);
const specTypeFilter = ref('');

const filteredProductList = computed(() => {
  if (!specTypeFilter.value) return productList.value;
  return productList.value.filter(p => {
    const code = (p.type_code || p.product_type_code || '').toUpperCase();
    return code === specTypeFilter.value;
  });
});

const loadProductList = async () => {
  try {
    const res = await fetch('/api/products', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.ok) {
      const data = await res.json();
      productList.value = (data.data || []).map((p: any) => ({
        ...p,
        type_code: p.type_code || p.product_type_code || ''
      }));
    }
  } catch {}
};

const loadParameterList = async () => {
  try {
    const res = await fetch('/api/qc/parameters', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.ok) {
      const data = await res.json();
      parameterList.value = data.data || [];
    }
  } catch {}
};

const loadMethodList = async () => {
  try {
    const res = await fetch('/api/qc/methods', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.ok) {
      const data = await res.json();
      methodList.value = data.data || [];
    }
  } catch {}
};

const loadSpecs = async () => {
  if (!specProductId.value) { specsList.value = []; return; }
  specsLoading.value = true;
  try {
    const res = await fetch(`/api/qc/specs/${specProductId.value}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.ok) {
      const data = await res.json();
      specsList.value = data.data || [];
    }
  } catch {
    specsList.value = [];
  } finally {
    specsLoading.value = false;
  }
};

const openSpecForm = (spec?: any) => {
  if (spec) {
    specForm.value = {
      id: spec.id,
      parameter_id: spec.parameter_id,
      method_id: spec.method_id || '',
      standard_value: spec.standard_value || '',
      min_value: spec.min_value || '',
      max_value: spec.max_value || '',
      uom: spec.uom || '',
      qc_type: spec.qc_type || 'LP'
    };
  } else {
    specForm.value = { id: null, parameter_id: '', method_id: '', standard_value: '', min_value: '', max_value: '', uom: '', qc_type: 'LP' };
  }
  showSpecForm.value = true;
};

const saveSpec = async () => {
  specSaving.value = true;
  try {
    const isEdit = !!specForm.value.id;
    const url = isEdit ? `/api/qc/specs/${specForm.value.id}` : '/api/qc/specs';
    const body: any = {
      parameter_id: Number(specForm.value.parameter_id),
      method_id: specForm.value.method_id ? Number(specForm.value.method_id) : null,
      standard_value: specForm.value.standard_value,
      min_value: specForm.value.min_value || null,
      max_value: specForm.value.max_value || null,
      uom: specForm.value.uom || null,
      qc_type: specForm.value.qc_type || 'LP'
    };
    if (!isEdit) body.product_id = Number(specProductId.value);

    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      showSpecForm.value = false;
      loadSpecs();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to save spec');
    }
  } catch (err) {
    console.error('Save spec error:', err);
  } finally {
    specSaving.value = false;
  }
};

const deleteSpec = async (spec: any) => {
  if (!confirm(`Delete spec "${spec.parameter_name}"?`)) return;
  try {
    const res = await fetch(`/api/qc/specs/${spec.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.ok) loadSpecs();
    else alert('Failed to delete spec');
  } catch {}
};
</script>
