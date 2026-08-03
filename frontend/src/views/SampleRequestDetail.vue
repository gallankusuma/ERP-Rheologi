<template>
  <div class="p-6" v-if="request">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <div class="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <router-link to="/sample-requests" class="hover:text-indigo-600">Sample Requests</router-link>
          <span>/</span><span>{{ request.request_number }}</span>
        </div>
        <h1 class="text-2xl font-bold text-gray-900">{{ request.product_name }}</h1>
        <div class="flex items-center gap-3 mt-2 flex-wrap">
          <span class="px-3 py-1 rounded-full text-xs font-medium border" :class="getStatusClass(request.status)">{{ request.status }}</span>
          <span class="text-sm text-gray-500">Client: <strong>{{ request.client_name }}</strong></span>
          <span class="text-sm text-gray-500">{{ request.quantity }} {{ request.unit }}</span>
          <span class="text-sm text-gray-500">Target: {{ formatDate(request.target_delivery_date) }}</span>
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

    <!-- ========================== TAB: COMMENTS ========================== -->
    <div v-if="activeTab === 'comments'">
      <div class="bg-white rounded-xl border p-6">
        <h3 class="font-semibold text-gray-800 mb-4">Discussion & Comments</h3>
        
        <div v-if="!comments.length" class="text-center text-gray-400 py-8">No comments yet. Start the discussion!</div>
        
        <div class="space-y-4 mb-6">
          <div v-for="c in comments" :key="c.id" class="flex gap-3">
            <div class="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold shrink-0">
              {{ getInitials(c.user_name) }}
            </div>
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="font-medium text-sm text-gray-800">{{ c.user_name || 'User' }}</span>
                <span class="text-xs text-gray-400">{{ timeAgo(c.created_at) }}</span>
              </div>
              <p class="text-sm text-gray-700 whitespace-pre-wrap">{{ c.content }}</p>
            </div>
            <button @click="deleteComment(c.id)" class="text-gray-300 hover:text-red-500 text-xs shrink-0">✕</button>
          </div>
        </div>

        <div class="border-t pt-4">
          <div class="flex gap-3">
            <div class="w-9 h-9 rounded-full bg-indigo-500 text-white flex items-center justify-center text-sm font-bold shrink-0">
              {{ getInitials(currentUser?.full_name) }}
            </div>
            <div class="flex-1">
              <textarea v-model="newComment" rows="3" class="w-full px-4 py-3 border rounded-xl text-sm resize-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none" placeholder="Leave a comment.." @keydown.ctrl.enter="postComment"></textarea>
              <div class="flex justify-between items-center mt-2">
                <span class="text-xs text-gray-400">Ctrl + Enter to post</span>
                <button @click="postComment" :disabled="!newComment.trim()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-40">Post Comment</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========================== TAB: FILES (Document Manager Style) ========================== -->
    <div v-if="activeTab === 'files'">
      <!-- Subtabs per category -->
      <div class="flex gap-4 mb-4">
        <button v-for="cat in categories" :key="cat.id" @click="activeCategory = cat.id"
          class="px-4 py-2 rounded-lg text-sm font-medium transition-all"
          :class="activeCategory === cat.id ? cat.activeClass : 'bg-white border text-gray-500 hover:bg-gray-50'">
          {{ cat.icon }} {{ cat.label }}
          <span class="ml-1 text-xs opacity-70">({{ getCatFiles(cat.id).length }})</span>
        </button>
      </div>

      <!-- Toolbar -->
      <div class="bg-white border rounded-t-xl px-4 py-2.5 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="flex border rounded-lg overflow-hidden">
            <button @click="viewMode = 'grid'" class="px-2.5 py-1.5" :class="viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-gray-400'" title="Grid">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 16 16"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>
            </button>
            <button @click="viewMode = 'list'" class="px-2.5 py-1.5 border-l" :class="viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-400'" title="List">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 16 16"><rect x="1" y="2" width="14" height="2" rx="0.5"/><rect x="1" y="7" width="14" height="2" rx="0.5"/><rect x="1" y="12" width="14" height="2" rx="0.5"/></svg>
            </button>
          </div>
          <span class="text-xs text-gray-400">{{ getCatFiles(activeCategory).length }} items</span>
        </div>
        <label :class="activeCatObj.btnClass" class="px-3 py-1.5 text-white rounded-lg text-xs font-medium cursor-pointer flex items-center gap-1 hover:opacity-90">
          + Upload
          <input type="file" :accept="activeCategory === 'foto' ? 'image/*' : '*'" multiple class="hidden" @change="uploadFiles($event, activeCategory)" />
        </label>
      </div>

      <!-- Split Content -->
      <div class="flex border-x border-b rounded-b-xl bg-white overflow-hidden" style="min-height:450px">
        <!-- LEFT: File Explorer -->
        <div class="flex-1 overflow-y-auto p-4" style="min-width:200px">
          <!-- Grid View -->
          <div v-if="viewMode === 'grid'" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <div v-for="f in getCatFiles(activeCategory)" :key="f.id"
              @click="previewFile = f"
              class="group cursor-pointer p-3 rounded-xl border transition-all text-center relative"
              :class="previewFile?.id === f.id ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-300' : 'border-transparent hover:border-blue-200 hover:bg-blue-50/30'">
              <!-- Thumbnail for images -->
              <div v-if="isImage(f.file_name)" class="w-full h-24 mb-2 rounded-lg overflow-hidden bg-gray-100">
                <img :src="getFileUrl(f)" class="w-full h-full object-cover" @error="($event.target as HTMLImageElement).style.display='none'" />
              </div>
              <div v-else class="text-3xl mb-1">{{ fileIcon(f.file_name) }}</div>
              <div class="text-xs font-medium text-gray-700 truncate">{{ f.file_name }}</div>
              <div class="text-[10px] text-gray-400 mt-0.5">{{ formatFileSize(f.file_size) }}</div>
            </div>
          </div>
          <!-- List View -->
          <div v-else class="space-y-0.5">
            <div class="flex items-center gap-3 px-3 py-1 text-[10px] text-gray-400 uppercase tracking-wider font-medium border-b mb-1">
              <span class="w-6"></span><span class="flex-1">Name</span><span class="w-16 text-right">Size</span><span class="w-20 text-right">Date</span><span class="w-16 text-right">By</span>
            </div>
            <div v-for="f in getCatFiles(activeCategory)" :key="f.id"
              @click="previewFile = f"
              class="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors"
              :class="previewFile?.id === f.id ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-gray-50'">
              <span class="text-lg w-6">{{ fileIcon(f.file_name) }}</span>
              <div class="flex-1 min-w-0"><div class="text-sm font-medium text-gray-700 truncate">{{ f.file_name }}</div></div>
              <span class="text-[10px] text-gray-400 w-16 text-right">{{ formatFileSize(f.file_size) }}</span>
              <span class="text-[10px] text-gray-400 w-20 text-right">{{ formatDate(f.created_at) }}</span>
              <span class="text-[10px] text-gray-400 w-16 text-right truncate">{{ f.uploader_name || '-' }}</span>
            </div>
          </div>
          <!-- Empty state -->
          <div v-if="!getCatFiles(activeCategory).length" class="text-center py-16 text-gray-300">
            <div class="text-5xl mb-3">{{ activeCatObj.icon }}</div>
            <div class="text-sm">No {{ activeCatObj.label.toLowerCase() }} uploaded yet</div>
            <div class="text-xs mt-1">Click "Upload" to add files</div>
          </div>
        </div>

        <!-- Resize Handle -->
        <div v-if="previewFile" class="w-1.5 shrink-0 cursor-col-resize bg-gray-200 hover:bg-blue-400 active:bg-blue-500 transition-colors relative group" @mousedown="startResize">
          <div class="absolute inset-y-0 -left-1 -right-1"></div>
          <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-gray-400 group-hover:bg-white transition-colors"></div>
        </div>

        <!-- RIGHT: Preview Panel -->
        <div v-if="previewFile" class="shrink-0 bg-gray-50/50 overflow-y-auto" :style="{width: previewWidth + 'px'}">
          <div class="p-5">
            <!-- Preview area -->
            <div class="bg-white border rounded-xl p-4 mb-4 text-center flex items-center justify-center" :style="{minHeight: previewWidth > 400 ? '300px' : '180px'}">
              <div v-if="isImage(previewFile.file_name)" class="w-full">
                <img :src="getFileUrl(previewFile)" class="max-w-full rounded-lg mx-auto" :style="{maxHeight: (previewWidth > 500 ? 400 : 220) + 'px'}" @error="($event.target as HTMLImageElement).style.display='none'" />
              </div>
              <div v-else-if="isPdf(previewFile.file_name)" class="w-full">
                <iframe :src="getFileUrl(previewFile)" class="w-full rounded-lg border-0" :style="{height: (previewWidth > 500 ? 400 : 220) + 'px'}"></iframe>
              </div>
              <div v-else class="text-center">
                <div class="text-6xl mb-3">{{ fileIcon(previewFile.file_name) }}</div>
                <div class="text-xs text-gray-400">{{ fileExt(previewFile.file_name) }} file</div>
              </div>
            </div>

            <!-- File info -->
            <div class="space-y-3">
              <div>
                <div class="text-lg font-semibold text-gray-800 leading-tight">{{ previewFile.file_name }}</div>
              </div>
              <div class="border-t pt-3 space-y-2">
                <div class="flex justify-between text-xs"><span class="text-gray-400">Category</span><span class="px-2 py-0.5 bg-sky-100 text-sky-700 rounded font-medium">{{ catLabel(previewFile.category) }}</span></div>
                <div class="flex justify-between text-xs"><span class="text-gray-400">Size</span><span class="text-gray-700 font-medium">{{ formatFileSize(previewFile.file_size) }}</span></div>
                <div class="flex justify-between text-xs"><span class="text-gray-400">Uploaded</span><span class="text-gray-700">{{ formatDate(previewFile.created_at) }}</span></div>
                <div class="flex justify-between text-xs"><span class="text-gray-400">By</span><span class="text-gray-700">{{ previewFile.uploader_name || '-' }}</span></div>
              </div>

              <!-- Actions -->
              <div class="flex gap-2 pt-3 border-t">
                <a :href="getFileUrl(previewFile)" download
                  class="flex-1 py-2 bg-blue-600 text-white text-center rounded-lg text-xs font-medium hover:bg-blue-700">⬇ Download</a>
                <a :href="getFileUrl(previewFile)" target="_blank"
                  class="px-3 py-2 border rounded-lg text-xs text-gray-600 hover:bg-gray-50">Open</a>
                <button @click="deleteFile(previewFile.id)" class="px-3 py-2 border border-red-200 rounded-lg text-xs text-red-500 hover:bg-red-50">🗑️</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../lib/api';

const route = useRoute();
const requestId = route.params.id;
const request = ref<any>(null);
const comments = ref<any[]>([]);
const files = ref<any[]>([]);
const newComment = ref('');
const activeTab = ref('comments');
const activeCategory = ref('foto');
const viewMode = ref('grid');
const previewFile = ref<any>(null);
const previewWidth = ref(400);
const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || '';
const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

const tabs = [
  { id: 'comments', icon: '💬', label: 'Comments' },
  { id: 'files', icon: '📁', label: 'Files' },
];

const categories = [
  { id: 'foto', icon: '📷', label: 'Foto', activeClass: 'bg-indigo-600 text-white', btnClass: 'bg-indigo-600' },
  { id: 'tanda_terima', icon: '📄', label: 'Tanda Terima', activeClass: 'bg-emerald-600 text-white', btnClass: 'bg-emerald-600' },
  { id: 'coa', icon: '🧪', label: 'COA', activeClass: 'bg-amber-600 text-white', btnClass: 'bg-amber-600' },
];

const activeCatObj = computed(() => categories.find(c => c.id === activeCategory.value) || categories[0]);
const getCatFiles = (cat: string) => files.value.filter(f => f.category === cat);

const getFileUrl = (f: any) => apiBase + f.file_path;
const catLabel = (c: string) => ({ foto: 'Foto', tanda_terima: 'Tanda Terima', coa: 'COA' }[c] || c);

const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const formatFileSize = (bytes: number) => {
  if (!bytes) return '0 B';
  const k = 1024; const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};
const getInitials = (name: string) => name ? name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : '?';
const timeAgo = (d: string) => {
  if (!d) return '';
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};
const getStatusClass = (s: string) => ({
  'Requested': 'bg-blue-50 text-blue-700 border-blue-200',
  'In Progress': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'Ready for Delivery': 'bg-orange-50 text-orange-700 border-orange-200',
  'Delivered': 'bg-teal-50 text-teal-700 border-teal-200',
  'Feedback Received': 'bg-green-50 text-green-700 border-green-200',
  'Cancelled': 'bg-red-50 text-red-700 border-red-200',
}[s] || 'bg-slate-50 text-slate-700 border-slate-200');

const isImage = (n: string) => /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(n || '');
const isPdf = (n: string) => /\.pdf$/i.test(n || '');
const fileExt = (n: string) => (n || '').split('.').pop()?.toUpperCase() || '';
const fileIcon = (n: string) => {
  const ext = fileExt(n).toLowerCase();
  if (['jpg','jpeg','png','gif','webp','svg','bmp'].includes(ext)) return '🖼️';
  if (ext === 'pdf') return '📕';
  if (['doc','docx'].includes(ext)) return '📘';
  if (['xls','xlsx'].includes(ext)) return '📗';
  if (['ppt','pptx'].includes(ext)) return '📙';
  if (ext === 'zip' || ext === 'rar') return '📦';
  return '📄';
};

// Resize logic
let resizing = false;
const startResize = (e: MouseEvent) => {
  resizing = true;
  const startX = e.clientX;
  const startW = previewWidth.value;
  const onMove = (ev: MouseEvent) => { if (resizing) previewWidth.value = Math.max(250, Math.min(700, startW + startX - ev.clientX)); };
  const onUp = () => { resizing = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
};

onMounted(async () => {
  try { const r = await api.get(`/sample-requests/${requestId}`); request.value = r.data.data; } catch (e) { console.error(e); }
  await fetchComments();
  await fetchFiles();
});

async function fetchComments() {
  try { const r = await api.get(`/sample-requests/${requestId}/comments`); comments.value = r.data.data || []; } catch {}
}

async function fetchFiles() {
  try { const r = await api.get(`/sample-requests/${requestId}/files`); files.value = r.data.data || []; } catch {}
}

async function postComment() {
  if (!newComment.value.trim()) return;
  try {
    await api.post(`/sample-requests/${requestId}/comments`, { content: newComment.value });
    newComment.value = '';
    await fetchComments();
  } catch (e: any) { alert(e.response?.data?.error || e.message); }
}

async function deleteComment(id: number) {
  if (!confirm('Delete this comment?')) return;
  try { await api.delete(`/sample-requests/comments/${id}`); await fetchComments(); } catch (e: any) { alert(e.message); }
}

async function uploadFiles(event: Event, category: string) {
  const input = event.target as HTMLInputElement;
  const fileList = input.files;
  if (!fileList?.length) return;
  for (let i = 0; i < fileList.length; i++) {
    const fd = new FormData();
    fd.append('file', fileList[i]);
    fd.append('category', category);
    try {
      await api.post(`/sample-requests/${requestId}/files`, fd);
    } catch (e: any) { alert(e.response?.data?.error || e.message); }
  }
  input.value = '';
  await fetchFiles();
}

async function deleteFile(id: number) {
  if (!confirm('Delete this file?')) return;
  try {
    await api.delete(`/sample-requests/files/${id}`);
    if (previewFile.value?.id === id) previewFile.value = null;
    await fetchFiles();
  } catch (e: any) { alert(e.message); }
}
</script>
