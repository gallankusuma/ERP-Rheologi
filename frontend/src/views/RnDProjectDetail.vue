<template>
  <div class="p-6" v-if="project">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <div class="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <router-link to="/rnd/projects" class="hover:text-indigo-600">R&D Projects</router-link>
          <span>/</span><span>{{ project.project_code }}</span>
        </div>
        <h1 class="text-2xl font-bold text-gray-900">{{ project.name }}</h1>
        <div class="flex items-center gap-3 mt-2">
          <span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="statusClass(project.status)">{{ project.status }}</span>
          <span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="priorityClass(project.priority)">{{ project.priority }}</span>
          <span class="text-xs text-gray-500">Leader: {{ project.leader_name || '-' }}</span>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="border-b mb-6 flex gap-6">
      <button v-for="t in tabs" :key="t.id" @click="activeTab = t.id"
        class="pb-3 text-sm font-medium border-b-2 transition-colors"
        :class="activeTab === t.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'">
        {{ t.icon }} {{ t.label }}
      </button>
    </div>

    <!-- Tab: Overview -->
    <div v-if="activeTab === 'overview'" class="grid grid-cols-2 gap-6">
      <div class="bg-white rounded-xl border p-5 space-y-3">
        <h3 class="font-semibold text-gray-800">📋 Details</h3>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div><span class="text-gray-500">Start:</span> {{ formatDate(project.start_date) }}</div>
          <div><span class="text-gray-500">Target:</span> {{ formatDate(project.target_end_date) }}</div>
          <div><span class="text-gray-500">Budget:</span> {{ formatCurrency(project.budget) }}</div>
          <div><span class="text-gray-500">Spent:</span> {{ formatCurrency(project.spent) }}</div>
        </div>
        <div v-if="project.objectives" class="text-sm"><span class="text-gray-500 font-medium">Objectives:</span><p class="mt-1 text-gray-700">{{ project.objectives }}</p></div>
        <div v-if="project.description" class="text-sm"><span class="text-gray-500 font-medium">Description:</span><p class="mt-1 text-gray-700">{{ project.description }}</p></div>
      </div>
      <div class="bg-white rounded-xl border p-5">
        <h3 class="font-semibold text-gray-800 mb-3">📊 Milestone Progress</h3>
        <div class="mb-3">
          <div class="flex justify-between text-xs text-gray-500 mb-1"><span>{{ completedMilestones }}/{{ milestones.length }} completed</span><span>{{ milestonePercent }}%</span></div>
          <div class="w-full bg-gray-200 rounded-full h-3"><div class="bg-indigo-600 h-3 rounded-full transition-all" :style="{width: milestonePercent+'%'}"></div></div>
        </div>
        <div class="space-y-2 mt-4">
          <div v-for="m in milestones.slice(0,5)" :key="m.id" class="flex items-center gap-2 text-sm">
            <span :class="m.status==='completed'?'text-green-500':'text-gray-300'">{{ m.status==='completed'?'✅':'⬜' }}</span>
            <span :class="m.status==='completed'?'line-through text-gray-400':'text-gray-700'">{{ m.title }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab: Milestones -->
    <div v-if="activeTab === 'milestones'">
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-semibold text-gray-800">🎯 Research Milestones</h3>
        <button @click="showMilestoneModal = true; editingMs = null; msForm = emptyMs()" class="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm">+ Add Milestone</button>
      </div>
      <div class="space-y-3">
        <div v-for="(m, idx) in milestones" :key="m.id" class="bg-white rounded-xl border p-4 flex items-start gap-4">
          <div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            :class="m.status==='completed'?'bg-green-100 text-green-700':m.status==='in_progress'?'bg-blue-100 text-blue-700':'bg-gray-100 text-gray-500'">
            {{ idx+1 }}
          </div>
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <span class="font-medium">{{ m.title }}</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">{{ phaseLabel(m.phase) }}</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-medium" :class="msStatusClass(m.status)">{{ m.status }}</span>
            </div>
            <p v-if="m.description" class="text-xs text-gray-500 mb-1">{{ m.description }}</p>
            <div class="flex gap-4 text-xs text-gray-400">
              <span>Due: {{ formatDate(m.due_date) }}</span>
              <span v-if="m.completed_date">Done: {{ formatDate(m.completed_date) }}</span>
              <span v-if="m.assigned_name">👤 {{ m.assigned_name }}</span>
            </div>
            <div v-if="m.deliverables" class="mt-2 text-xs text-gray-600 bg-gray-50 rounded p-2">📎 {{ m.deliverables }}</div>
          </div>
          <div class="flex gap-1 shrink-0">
            <button v-if="m.status!=='completed'" @click="completeMs(m)" class="text-green-600 text-xs font-medium hover:underline">✓ Done</button>
            <button @click="editMs(m)" class="text-blue-600 text-xs font-medium hover:underline">Edit</button>
            <button @click="deleteMs(m.id)" class="text-red-500 text-xs font-medium hover:underline">Del</button>
          </div>
        </div>
        <p v-if="!milestones.length" class="text-center text-gray-400 py-8">No milestones yet. Click "+ Add Milestone" to start tracking.</p>
      </div>
    </div>

    <!-- Tab: Documents -->
    <div v-if="activeTab === 'documents'">
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-semibold text-gray-800">📁 Documents</h3>
        <button @click="showDocModal = true; docForm = emptyDoc()" class="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm">+ Upload Document</button>
      </div>
      <div class="bg-white rounded-xl border overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 border-b"><tr>
            <th class="px-4 py-3 text-left">Title</th><th class="px-4 py-3 text-left">Type</th>
            <th class="px-4 py-3 text-left">File</th><th class="px-4 py-3 text-left">Version</th>
            <th class="px-4 py-3 text-left">Uploaded</th><th class="px-4 py-3 text-right">Actions</th>
          </tr></thead>
          <tbody>
            <tr v-for="d in documents" :key="d.id" class="border-b hover:bg-gray-50">
              <td class="px-4 py-3 font-medium">{{ d.title }}</td>
              <td class="px-4 py-3"><span class="px-2 py-0.5 bg-sky-100 text-sky-700 rounded text-xs">{{ d.doc_type }}</span></td>
              <td class="px-4 py-3 text-xs text-gray-500">{{ d.file_name || '-' }}</td>
              <td class="px-4 py-3 text-xs">v{{ d.version }}</td>
              <td class="px-4 py-3 text-xs text-gray-500">{{ d.uploader_name }} · {{ formatDate(d.created_at) }}</td>
              <td class="px-4 py-3 text-right space-x-2">
                <a v-if="d.file_path" :href="apiBase + d.file_path" target="_blank" class="text-blue-600 text-xs font-medium">Download</a>
                <button @click="deleteDoc(d.id)" class="text-red-500 text-xs font-medium">Delete</button>
              </td>
            </tr>
            <tr v-if="!documents.length"><td colspan="6" class="px-4 py-8 text-center text-gray-400">No documents uploaded</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Milestone Modal -->
    <div v-if="showMilestoneModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div class="px-6 py-4 border-b bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-2xl">
          <h3 class="text-lg font-semibold">{{ editingMs ? 'Edit' : 'Add' }} Milestone</h3>
        </div>
        <form @submit.prevent="submitMs" class="p-6 space-y-4">
          <div><label class="block text-xs font-medium text-gray-700 mb-1">Title *</label>
            <input v-model="msForm.title" required class="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div class="grid grid-cols-2 gap-4">
            <div><label class="block text-xs font-medium text-gray-700 mb-1">Phase</label>
              <select v-model="msForm.phase" class="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="literature_review">Literature Review</option><option value="formulation_design">Formulation Design</option>
                <option value="trial_batch">Trial Batch</option><option value="lab_testing">Lab Testing</option>
                <option value="scale_up">Scale Up</option><option value="stability_study">Stability Study</option>
                <option value="documentation">Documentation</option><option value="regulatory">Regulatory</option>
                <option value="production_transfer">Production Transfer</option>
              </select></div>
            <div><label class="block text-xs font-medium text-gray-700 mb-1">Due Date</label>
              <input v-model="msForm.due_date" type="date" class="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          </div>
          <div><label class="block text-xs font-medium text-gray-700 mb-1">Deliverables</label>
            <input v-model="msForm.deliverables" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Expected outputs..." /></div>
          <div><label class="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea v-model="msForm.description" rows="2" class="w-full px-3 py-2 border rounded-lg text-sm"></textarea></div>
          <div class="flex justify-end gap-3 pt-4 border-t">
            <button type="button" @click="showMilestoneModal=false" class="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" class="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">Save</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Document Upload Modal -->
    <div v-if="showDocModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div class="px-6 py-4 border-b bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-t-2xl">
          <h3 class="text-lg font-semibold">Upload Document</h3>
        </div>
        <form @submit.prevent="submitDoc" class="p-6 space-y-4">
          <div><label class="block text-xs font-medium text-gray-700 mb-1">Title *</label>
            <input v-model="docForm.title" required class="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div class="grid grid-cols-2 gap-4">
            <div><label class="block text-xs font-medium text-gray-700 mb-1">Document Type</label>
              <select v-model="docForm.doc_type" class="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="protocol">Protocol</option><option value="lab_report">Lab Report</option>
                <option value="certificate">Certificate</option><option value="sds">SDS/MSDS</option>
                <option value="specification">Specification</option><option value="approval_letter">Approval Letter</option>
                <option value="photo">Photo</option><option value="raw_data">Raw Data</option>
                <option value="regulatory">Regulatory</option><option value="other">Other</option>
              </select></div>
            <div><label class="block text-xs font-medium text-gray-700 mb-1">Version</label>
              <input v-model="docForm.version" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="1.0" /></div>
          </div>
          <div><label class="block text-xs font-medium text-gray-700 mb-1">File</label>
            <input type="file" @change="onFileChange" class="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label class="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea v-model="docForm.description" rows="2" class="w-full px-3 py-2 border rounded-lg text-sm"></textarea></div>
          <div class="flex justify-end gap-3 pt-4 border-t">
            <button type="button" @click="showDocModal=false" class="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" class="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium">Upload</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../lib/api';

const route = useRoute();
const projectId = route.params.id;
const project = ref<any>(null);
const milestones = ref<any[]>([]);
const documents = ref<any[]>([]);
const activeTab = ref('overview');
const showMilestoneModal = ref(false);
const showDocModal = ref(false);
const editingMs = ref<any>(null);
const selectedFile = ref<File|null>(null);
const apiBase = import.meta.env.VITE_API_URL?.replace('/api','') || '';

const tabs = [
  { id: 'overview', icon: '📋', label: 'Overview' },
  { id: 'milestones', icon: '🎯', label: 'Milestones' },
  { id: 'documents', icon: '📁', label: 'Documents' },
];

const emptyMs = () => ({ title:'', description:'', phase:'formulation_design', status:'pending', due_date:'', deliverables:'' });
const emptyDoc = () => ({ title:'', doc_type:'other', version:'1.0', description:'' });
const msForm = ref(emptyMs());
const docForm = ref(emptyDoc());

const completedMilestones = computed(() => milestones.value.filter(m => m.status==='completed').length);
const milestonePercent = computed(() => milestones.value.length ? Math.round(completedMilestones.value/milestones.value.length*100) : 0);

const statusClass = (s:string) => ({draft:'bg-gray-100 text-gray-700',active:'bg-green-100 text-green-700',on_hold:'bg-yellow-100 text-yellow-700',completed:'bg-blue-100 text-blue-700',cancelled:'bg-red-100 text-red-700'}[s]||'bg-gray-100');
const priorityClass = (p:string) => ({low:'bg-gray-100 text-gray-600',medium:'bg-blue-100 text-blue-700',high:'bg-orange-100 text-orange-700',critical:'bg-red-100 text-red-700'}[p]||'');
const msStatusClass = (s:string) => ({pending:'bg-gray-100 text-gray-600',in_progress:'bg-blue-100 text-blue-700',completed:'bg-green-100 text-green-700',skipped:'bg-yellow-100 text-yellow-700'}[s]||'bg-gray-100');
const formatDate = (d:string) => d ? new Date(d).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) : '-';
const formatCurrency = (v:number) => v ? `Rp ${Number(v).toLocaleString('id-ID')}` : '-';
const phaseLabel = (p:string) => p?.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) || '';

onMounted(async () => {
  try { const r = await api.get(`/rnd/projects/${projectId}`); project.value = r.data.data; } catch {}
  await fetchMs(); await fetchDocs();
});

async function fetchMs() { try { const r = await api.get(`/rnd/projects/${projectId}/milestones`); milestones.value = r.data.data||[]; } catch {} }
async function fetchDocs() { try { const r = await api.get(`/rnd/documents?project_id=${projectId}`); documents.value = r.data.data||[]; } catch {} }

function editMs(m:any) { editingMs.value=m; msForm.value={...m,due_date:m.due_date?.split('T')[0]||''}; showMilestoneModal.value=true; }
async function submitMs() {
  try {
    if(editingMs.value) await api.put(`/rnd/milestones/${editingMs.value.id}`, msForm.value);
    else await api.post(`/rnd/projects/${projectId}/milestones`, msForm.value);
    showMilestoneModal.value=false; await fetchMs();
  } catch(e:any) { alert(e.response?.data?.error||e.message); }
}
async function completeMs(m:any) {
  await api.put(`/rnd/milestones/${m.id}`, {...m, status:'completed', completed_date: new Date().toISOString().split('T')[0]});
  await fetchMs();
}
async function deleteMs(id:number) { if(!confirm('Delete milestone?')) return; await api.delete(`/rnd/milestones/${id}`); await fetchMs(); }

function onFileChange(e:Event) { selectedFile.value = (e.target as HTMLInputElement).files?.[0]||null; }
async function submitDoc() {
  const fd = new FormData();
  fd.append('project_id', String(projectId));
  fd.append('title', docForm.value.title);
  fd.append('doc_type', docForm.value.doc_type);
  fd.append('version', docForm.value.version);
  fd.append('description', docForm.value.description);
  if(selectedFile.value) fd.append('file', selectedFile.value);
  try { await api.post('/rnd/documents', fd, {headers:{'Content-Type':'multipart/form-data'}}); showDocModal.value=false; selectedFile.value=null; await fetchDocs(); }
  catch(e:any) { alert(e.response?.data?.error||e.message); }
}
async function deleteDoc(id:number) { if(!confirm('Delete document?')) return; await api.delete(`/rnd/documents/${id}`); await fetchDocs(); }
</script>
