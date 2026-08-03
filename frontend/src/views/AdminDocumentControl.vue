<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Document Control</h1>
          <p class="text-gray-500 dark:text-gray-400 mt-1">Manage Legal Standing Documents</p>
        </div>
        <button @click="openUploadModal" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          + New Document
        </button>
      </div>

      <!-- Filter Bar -->
      <div class="mb-4 flex gap-3 flex-wrap">
        <input v-model="search" type="text" placeholder="Search document..." class="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm w-64 dark:bg-gray-700 dark:text-white">
        <select v-model="filterType" class="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white">
          <option value="">All Types</option>
          <option v-for="t in documentTypes" :key="t" :value="t">{{ t }}</option>
        </select>
        <select v-model="filterStatus" class="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white">
          <option value="">All Status</option>
          <option value="Active">Active</option>
          <option value="Expiring Soon">Expiring Soon</option>
          <option value="Expired">Expired</option>
          <option value="Renewed">Renewed</option>
          <option value="Pending">Pending</option>
        </select>
        <div class="ml-auto flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span class="font-medium">{{ filteredDocuments.length }}</span> documents
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-750">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Document Name</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Number & Type</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Dikeluarkan Oleh</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Issue / Expiry Date</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">File</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-for="doc in filteredDocuments" :key="doc.id" class="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
              <td class="px-4 py-4 max-w-xs">
                <div class="font-medium text-gray-900 dark:text-white text-sm">{{ doc.document_name }}</div>
                <div v-if="doc.notes" class="text-xs text-gray-400 mt-0.5 truncate" :title="doc.notes">{{ doc.notes }}</div>
              </td>
              <td class="px-4 py-4">
                <div class="text-sm text-gray-900 dark:text-white font-mono">{{ doc.document_number || '-' }}</div>
                <span class="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs rounded-full">{{ doc.document_type || 'General' }}</span>
              </td>
              <td class="px-4 py-4">
                <div class="text-sm text-gray-700 dark:text-gray-300">{{ doc.issued_by || '-' }}</div>
              </td>
              <td class="px-4 py-4">
                <div class="text-xs text-gray-500 dark:text-gray-400">Issue: {{ formatDate(doc.issue_date) }}</div>
                <div :class="['text-sm font-semibold mt-1', getExpiryTextClass(doc)]">
                  Exp: {{ formatDate(doc.expiry_date) }}
                </div>
                <div v-if="doc.expiry_date" class="text-xs mt-0.5" :class="getDaysLeftClass(doc)">
                  {{ getDaysLeftText(doc) }}
                </div>
              </td>
              <td class="px-4 py-4">
                <span :class="getStatusClass(doc.status)" class="px-2 py-1 text-xs font-semibold rounded-full">{{ doc.status }}</span>
              </td>
              <td class="px-4 py-4">
                <a v-if="doc.file_path" :href="'http://76.13.22.155:3002' + doc.file_path" target="_blank" class="text-blue-600 hover:underline flex items-center gap-1 text-sm">
                  📎 View
                </a>
                <span v-else class="text-gray-400 text-sm">-</span>
              </td>
              <td class="px-4 py-4">
                <div class="flex gap-2">
                  <button @click="editDoc(doc)" class="text-blue-600 hover:text-blue-800 font-medium text-sm">Edit</button>
                  <button @click="deleteDoc(doc.id)" class="text-red-600 hover:text-red-800 font-medium text-sm">Delete</button>
                </div>
              </td>
            </tr>
            <tr v-if="filteredDocuments.length === 0">
              <td colspan="7" class="px-6 py-8 text-center text-gray-500 dark:text-gray-400">No documents found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Upload/Edit Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div class="flex items-start justify-center min-h-screen pt-10 px-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="showModal = false"></div>
        <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
        <div class="inline-block align-top bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div class="bg-white dark:bg-gray-800 px-6 pt-5 pb-4">
            <h3 class="text-lg leading-6 font-bold text-gray-900 dark:text-white mb-5">
              {{ editingDoc ? 'Edit Document' : 'New Document' }}
            </h3>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Nama Dokumen *</label>
                <input v-model="form.document_name" type="text" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2 border focus:ring-blue-500 focus:border-blue-500">
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Nomor Dokumen</label>
                  <input v-model="form.document_number" type="text" placeholder="e.g. NIB-12345" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2 border focus:ring-blue-500 focus:border-blue-500">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Tipe Dokumen</label>
                  <input v-model="form.document_type" type="text" placeholder="e.g. NIB, ISO, BPOM" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2 border focus:ring-blue-500 focus:border-blue-500">
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Dikeluarkan Oleh</label>
                <input v-model="form.issued_by" type="text" placeholder="e.g. Kementerian Hukum dan HAM" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2 border focus:ring-blue-500 focus:border-blue-500">
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Tanggal Terbit</label>
                  <input v-model="form.issue_date" type="date" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2 border focus:ring-blue-500 focus:border-blue-500">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Tanggal Kedaluwarsa</label>
                  <input v-model="form.expiry_date" type="date" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2 border focus:ring-blue-500 focus:border-blue-500">
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Reminder (hari sebelum exp)</label>
                <input v-model.number="form.reminder_days" type="number" min="1" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2 border focus:ring-blue-500 focus:border-blue-500">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                <select v-model="form.status" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2 border focus:ring-blue-500 focus:border-blue-500">
                  <option value="Active">Active</option>
                  <option value="Expiring Soon">Expiring Soon</option>
                  <option value="Expired">Expired</option>
                  <option value="Renewed">Renewed</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Upload File (PDF / Scan)</label>
                <input type="file" @change="handleFileUpload" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  class="mt-1 block w-full text-sm text-gray-500 dark:text-gray-400
                    file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0
                    file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100">
                <div v-if="editingDoc && editingDoc.file_name" class="text-xs text-gray-400 mt-1">
                  Current: {{ editingDoc.file_name }}
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Catatan</label>
                <textarea v-model="form.notes" rows="2" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2 border focus:ring-blue-500 focus:border-blue-500"></textarea>
              </div>
            </div>
          </div>
          <div class="bg-gray-50 dark:bg-gray-750 px-6 py-3 flex flex-row-reverse gap-2">
            <button @click="saveDocument" :disabled="loading" class="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
              {{ loading ? 'Saving...' : 'Simpan' }}
            </button>
            <button @click="showModal = false" class="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
              Batal
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api } from '../lib/api';

const documents = ref<any[]>([]);
const showModal = ref(false);
const editingDoc = ref<any>(null);
const loading = ref(false);
const fileToUpload = ref<File | null>(null);
const search = ref('');
const filterType = ref('');
const filterStatus = ref('');

const form = ref({
  document_name: '',
  document_number: '',
  document_type: '',
  issued_by: '',
  issue_date: '',
  expiry_date: '',
  reminder_days: 30,
  status: 'Active',
  notes: ''
});

const documentTypes = computed(() => {
  const types = new Set(documents.value.map((d: any) => d.document_type).filter(Boolean));
  return Array.from(types).sort();
});

const filteredDocuments = computed(() => {
  return documents.value.filter((doc: any) => {
    const matchSearch = !search.value || doc.document_name.toLowerCase().includes(search.value.toLowerCase()) || (doc.issued_by || '').toLowerCase().includes(search.value.toLowerCase());
    const matchType = !filterType.value || doc.document_type === filterType.value;
    const matchStatus = !filterStatus.value || doc.status === filterStatus.value;
    return matchSearch && matchType && matchStatus;
  });
});

const fetchDocuments = async () => {
  try {
    const res = await api.get('/docs');
    documents.value = res.data.data;
  } catch (error) {
    console.error('Failed to fetch documents', error);
  }
};

onMounted(() => {
  fetchDocuments();
});

const formatDate = (d: string) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getDaysLeft = (doc: any) => {
  if (!doc.expiry_date) return null;
  const diff = new Date(doc.expiry_date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const getDaysLeftText = (doc: any) => {
  const days = getDaysLeft(doc);
  if (days === null) return '';
  if (days < 0) return `Expired ${Math.abs(days)} hari lalu`;
  if (days === 0) return 'Hari ini!';
  return `${days} hari lagi`;
};

const getDaysLeftClass = (doc: any) => {
  const days = getDaysLeft(doc);
  if (days === null) return '';
  if (days < 0) return 'text-red-600 font-bold';
  if (days <= 30) return 'text-orange-500 font-semibold';
  if (days <= 90) return 'text-yellow-600';
  return 'text-gray-400';
};

const getExpiryTextClass = (doc: any) => {
  const days = getDaysLeft(doc);
  if (days === null) return 'text-gray-500 dark:text-gray-400';
  if (days < 0) return 'text-red-600 dark:text-red-400';
  if (days <= 30) return 'text-orange-500';
  if (days <= 90) return 'text-yellow-600';
  return 'text-gray-900 dark:text-white';
};

const getStatusClass = (status: string) => {
  if (status === 'Active' || status === 'Renewed') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  if (status === 'Expiring Soon') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  if (status === 'Expired') return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
};

const openUploadModal = () => {
  editingDoc.value = null;
  form.value = {
    document_name: '',
    document_number: '',
    document_type: '',
    issued_by: '',
    issue_date: '',
    expiry_date: '',
    reminder_days: 30,
    status: 'Active',
    notes: ''
  };
  fileToUpload.value = null;
  showModal.value = true;
};

const handleFileUpload = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    fileToUpload.value = target.files[0];
  }
};

const editDoc = (doc: any) => {
  editingDoc.value = doc;
  form.value = {
    document_name: doc.document_name,
    document_number: doc.document_number || '',
    document_type: doc.document_type || '',
    issued_by: doc.issued_by || '',
    issue_date: doc.issue_date ? doc.issue_date.substring(0, 10) : '',
    expiry_date: doc.expiry_date ? doc.expiry_date.substring(0, 10) : '',
    reminder_days: doc.reminder_days,
    status: doc.status,
    notes: doc.notes || ''
  };
  fileToUpload.value = null;
  showModal.value = true;
};

const saveDocument = async () => {
  if (!form.value.document_name) {
    alert('Nama dokumen wajib diisi');
    return;
  }
  
  loading.value = true;
  const formData = new FormData();
  Object.entries(form.value).forEach(([key, value]) => {
    formData.append(key, value as string);
  });
  if (fileToUpload.value) {
    formData.append('file', fileToUpload.value);
  }

  try {
    if (editingDoc.value) {
      await api.put(`/docs/${editingDoc.value.id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    } else {
      await api.post('/docs', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    }
    showModal.value = false;
    fetchDocuments();
  } catch (error) {
    console.error('Failed to save document', error);
    alert('Gagal menyimpan dokumen');
  } finally {
    loading.value = false;
  }
};

const deleteDoc = async (id: number) => {
  if (!confirm('Yakin ingin menghapus dokumen ini?')) return;
  try {
    await api.delete(`/docs/${id}`);
    fetchDocuments();
  } catch (error) {
    console.error('Failed to delete document', error);
  }
};
</script>
