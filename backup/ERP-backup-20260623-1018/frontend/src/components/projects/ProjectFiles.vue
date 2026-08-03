<template>
  <div>
    <!-- Toolbar -->
    <div class="bg-white border rounded-t-xl px-4 py-2.5 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <button @click="currentFolder = null; previewFile = null" class="p-1.5 rounded hover:bg-gray-100" :class="!currentFolder ? 'text-gray-300' : 'text-gray-600'" :disabled="!currentFolder" title="Back">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div class="flex items-center text-sm">
          <button @click="currentFolder = null; previewFile = null" class="text-blue-600 hover:underline font-medium">📁 All Documents</button>
          <span v-if="currentFolder" class="mx-1.5 text-gray-400">›</span>
          <span v-if="currentFolder" class="text-gray-700 font-medium">{{ getFolderName(currentFolder) }}</span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex border rounded-lg overflow-hidden">
          <button @click="viewMode = 'grid'" class="px-2.5 py-1.5" :class="viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-gray-400'" title="Grid">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 16 16"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>
          </button>
          <button @click="viewMode = 'list'" class="px-2.5 py-1.5 border-l" :class="viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-400'" title="List">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 16 16"><rect x="1" y="2" width="14" height="2" rx="0.5"/><rect x="1" y="7" width="14" height="2" rx="0.5"/><rect x="1" y="12" width="14" height="2" rx="0.5"/></svg>
          </button>
        </div>
        <button @click="previewFile = previewFile ? null : previewFile" class="px-2 py-1.5 border rounded-lg text-xs" :class="previewFile ? 'bg-blue-50 text-blue-600 border-blue-200' : 'text-gray-400'" title="Toggle preview">👁</button>
        <span class="text-xs text-gray-400">{{ visibleFiles.length }} items</span>
        <button @click="openFolderModal()" class="px-3 py-1.5 border border-dashed border-amber-300 text-amber-600 rounded-lg text-xs font-medium hover:bg-amber-50 flex items-center gap-1">📁 New Folder</button>
        <button @click="openUploadModal()" class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 flex items-center gap-1">+ Upload</button>
      </div>
    </div>

    <!-- Split Content -->
    <div class="flex border-x border-b rounded-b-xl bg-white overflow-hidden" style="min-height:450px">
      <!-- LEFT: File Explorer -->
      <div class="flex-1 overflow-y-auto p-4" style="min-width:200px">
        <!-- Root: Folders -->
        <div v-if="!currentFolder">
          <div v-if="folders.length" class="text-[10px] text-gray-400 uppercase tracking-wider mb-2 font-semibold">Folders</div>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-5">
            <div v-for="f in folders" :key="f.id" @click="currentFolder = f.id; previewFile = null"
              @contextmenu.prevent="folderCtx = f; folderCtxPos = { x: $event.clientX, y: $event.clientY }"
              class="group cursor-pointer p-3 rounded-xl border border-transparent hover:border-blue-200 hover:bg-blue-50/50 transition-all text-center relative">
              <div class="text-3xl mb-1">📁</div>
              <div class="text-xs font-medium text-gray-700 group-hover:text-blue-700 truncate">{{ f.name }}</div>
              <div class="text-[10px] text-gray-400">{{ f.file_count || 0 }} files</div>
            </div>
          </div>
          <div v-if="unfolderedFiles.length" class="text-[10px] text-gray-400 uppercase tracking-wider mb-2 font-semibold">Files</div>
        </div>

        <!-- Files Grid View -->
        <div v-if="viewMode === 'grid'" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          <div v-for="file in visibleFiles" :key="file.id"
            @click="previewFile = file"
            class="group cursor-pointer p-3 rounded-xl border transition-all text-center relative"
            :class="previewFile?.id === file.id ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-300' : 'border-transparent hover:border-blue-200 hover:bg-blue-50/30'">
            <div class="text-3xl mb-1">{{ getFileIcon(file.file_type || file.file_name) }}</div>
            <div class="text-xs font-medium text-gray-700 truncate">{{ file.file_name }}</div>
            <div class="text-[10px] text-gray-400 truncate">{{ formatSize(file.file_size) }}</div>
            <div class="text-[9px] text-gray-300 mt-0.5">{{ formatDate(file.uploaded_at) }}</div>
          </div>
        </div>

        <!-- Files List View -->
        <div v-else class="space-y-0.5">
          <div class="flex items-center gap-3 px-3 py-1 text-[10px] text-gray-400 uppercase tracking-wider font-medium border-b mb-1">
            <span class="w-6"></span><span class="flex-1">Name</span><span class="w-20 text-right">Size</span><span class="w-24 text-right">Uploaded By</span><span class="w-24 text-right">Date</span>
          </div>
          <div v-for="file in visibleFiles" :key="file.id"
            @click="previewFile = file"
            class="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors"
            :class="previewFile?.id === file.id ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-gray-50'">
            <span class="text-lg w-6">{{ getFileIcon(file.file_type || file.file_name) }}</span>
            <div class="flex-1 min-w-0"><div class="text-sm font-medium text-gray-700 truncate">{{ file.file_name }}</div></div>
            <span class="text-[10px] text-gray-400 w-20 text-right">{{ formatSize(file.file_size) }}</span>
            <span class="text-[10px] text-gray-400 w-24 text-right">{{ file.uploader_name || '-' }}</span>
            <span class="text-[10px] text-gray-400 w-24 text-right">{{ formatDate(file.uploaded_at) }}</span>
          </div>
        </div>

        <!-- Empty States -->
        <div v-if="!files.length && !currentFolder" class="text-center py-16 text-gray-300">
          <div class="text-5xl mb-3">📂</div><div class="text-sm">No documents yet</div><div class="text-xs mt-1">Click "Upload" to add files</div>
        </div>
        <div v-if="currentFolder && !visibleFiles.length" class="text-center py-16 text-gray-300">
          <div class="text-4xl mb-2">📂</div><div class="text-sm">Empty folder</div>
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
            <div v-if="isPreviewImage(previewFile.file_name)" class="w-full">
              <img :src="getDownloadUrl(previewFile.file_path)" class="max-w-full rounded-lg mx-auto" :style="{maxHeight: (previewWidth > 500 ? 400 : 220) + 'px'}" @error="($event.target as HTMLImageElement).style.display='none'" />
            </div>
            <div v-else-if="isPreviewPdf(previewFile.file_name)" class="w-full">
              <iframe :src="getDownloadUrl(previewFile.file_path)" class="w-full rounded-lg border-0" :style="{height: (previewWidth > 500 ? 400 : 220) + 'px'}"></iframe>
            </div>
            <div v-else class="text-center">
              <div class="text-6xl mb-3">{{ getFileIcon(previewFile.file_type || previewFile.file_name) }}</div>
              <div class="text-xs text-gray-400">{{ fileExt(previewFile.file_name) }} file</div>
            </div>
          </div>

          <!-- File info -->
          <div class="space-y-3">
            <div>
              <div class="text-lg font-semibold text-gray-800 leading-tight">{{ previewFile.file_name }}</div>
              <div class="text-xs text-gray-400 mt-1 font-mono">{{ previewFile.file_path || 'No path' }}</div>
            </div>
            <div class="border-t pt-3 space-y-2">
              <div class="flex justify-between text-xs"><span class="text-gray-400">Type</span><span class="px-2 py-0.5 bg-sky-100 text-sky-700 rounded font-medium">{{ previewFile.file_type || 'other' }}</span></div>
              <div class="flex justify-between text-xs"><span class="text-gray-400">Size</span><span class="text-gray-700 font-medium">{{ formatSize(previewFile.file_size) }}</span></div>
              <div class="flex justify-between text-xs"><span class="text-gray-400">Uploaded</span><span class="text-gray-700">{{ formatDate(previewFile.uploaded_at) }}</span></div>
              <div class="flex justify-between text-xs"><span class="text-gray-400">By</span><span class="text-gray-700">{{ previewFile.uploader_name || '-' }}</span></div>
            </div>

            <!-- Actions -->
            <div class="flex gap-2 pt-3 border-t">
              <a v-if="previewFile.file_path" :href="getDownloadUrl(previewFile.file_path)" target="_blank" download
                class="flex-1 py-2 bg-blue-600 text-white text-center rounded-lg text-xs font-medium hover:bg-blue-700">⬇ Download</a>
              <a v-if="previewFile.file_path" :href="getDownloadUrl(previewFile.file_path)" target="_blank"
                class="px-3 py-2 border rounded-lg text-xs text-gray-600 hover:bg-gray-50">Open</a>
              <button @click="deleteFilePreview(previewFile.id)" class="px-3 py-2 border border-red-200 rounded-lg text-xs text-red-500 hover:bg-red-50">🗑️</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Folder Context Menu -->
    <div v-if="folderCtx" class="fixed z-[60] bg-white border rounded-xl shadow-xl py-1 min-w-[160px]" :style="{top: folderCtxPos.y + 'px', left: folderCtxPos.x + 'px'}" @click.stop>
      <button @click="editFolder(folderCtx)" class="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">✏️ Rename</button>
      <button @click="deleteFolderCtx(folderCtx.id)" class="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2">🗑️ Delete Folder</button>
    </div>
    <div v-if="folderCtx" class="fixed inset-0 z-[55]" @click="folderCtx = null"></div>

    <!-- Folder Create/Edit Modal -->
    <div v-if="showFolderModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div class="px-6 py-4 border-b bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-t-2xl">
          <h3 class="text-lg font-semibold">{{ editingFolderId ? 'Rename Folder' : 'New Folder' }}</h3>
        </div>
        <form @submit.prevent="submitFolder" class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Folder Name</label>
            <input v-model="folderForm.name" type="text" required class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. Contracts, Reports..." autofocus />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Color</label>
            <div class="flex gap-2">
              <button v-for="c in folderColors" :key="c" type="button" @click="folderForm.color = c"
                class="w-7 h-7 rounded-full border-2 transition-all" :style="{backgroundColor: c}" :class="folderForm.color === c ? 'border-gray-800 scale-110' : 'border-transparent'"></button>
            </div>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" @click="showFolderModal = false" class="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" class="px-6 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600">{{ editingFolderId ? 'Save' : 'Create' }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Upload Modal -->
    <div v-if="showUploadModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div class="px-6 py-4 border-b bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-t-2xl">
          <h3 class="text-lg font-semibold">Upload Document</h3>
        </div>
        <form @submit.prevent="submitUpload" class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">File *</label>
            <div
              class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer"
              @click="($refs.fileInput as HTMLInputElement)?.click()"
              @dragover.prevent
              @drop.prevent="onDrop"
            >
              <input type="file" ref="fileInput" class="hidden" @change="onFileSelect" multiple />
              <div class="text-3xl mb-2">📂</div>
              <p v-if="!selectedFiles.length" class="text-sm text-gray-500">Click to select or drag files here</p>
              <div v-else class="space-y-1">
                <p v-for="(f, i) in selectedFiles" :key="i" class="text-sm text-gray-700 flex items-center justify-center gap-2">
                  <span>{{ getFileIcon(f.name) }}</span> {{ f.name }} <span class="text-gray-400 text-xs">({{ formatSize(f.size) }})</span>
                </p>
              </div>
            </div>
          </div>
          <div v-if="currentFolder" class="text-xs text-gray-500 bg-amber-50 px-3 py-2 rounded-lg">
            📁 Upload to: <span class="font-medium text-amber-700">{{ getFolderName(currentFolder) }}</span>
          </div>
          <div class="flex justify-end gap-3 pt-4 border-t">
            <button type="button" @click="showUploadModal = false" class="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" :disabled="!selectedFiles.length || uploading" class="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
              {{ uploading ? 'Uploading...' : 'Upload' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { api } from '@/lib/api';

const props = defineProps<{
  projectId: string | number;
}>();

const emit = defineEmits(['filesChanged']);

// State
const files = ref<any[]>([]);
const folders = ref<any[]>([]);
const currentFolder = ref<number | null>(null);
const viewMode = ref<'grid' | 'list'>('grid');
const previewFile = ref<any>(null);
const previewWidth = ref(360);

// Upload
const showUploadModal = ref(false);
const selectedFiles = ref<File[]>([]);
const uploading = ref(false);

// Folder
const showFolderModal = ref(false);
const editingFolderId = ref<number | null>(null);
const folderForm = ref({ name: '', color: '#3B82F6' });
const folderCtx = ref<any>(null);
const folderCtxPos = ref({ x: 0, y: 0 });
const folderColors = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4','#6B7280'];

// Compute base URL for downloads (strip /api suffix)
const serverBase = (() => {
  const apiUrl = (import.meta as any).env?.VITE_API_URL || '';
  return apiUrl.replace(/\/api\/?$/, '') || window.location.origin;
})();

// Computed
const unfolderedFiles = computed(() => files.value.filter(f => !f.folder_id));
const visibleFiles = computed(() => {
  if (currentFolder.value) return files.value.filter(f => f.folder_id === currentFolder.value);
  return unfolderedFiles.value;
});

// Data fetching
const fetchFiles = async () => {
  try {
    const res = await api.get(`/projects/${props.projectId}/files`);
    const data = res.data;
    files.value = Array.isArray(data) ? data : (data?.data || data?.files || []);
  } catch {
    files.value = [];
  }
};

const fetchFolders = async () => {
  try {
    const res = await api.get(`/projects/${props.projectId}/folders`);
    folders.value = res.data?.data || [];
  } catch {
    folders.value = [];
  }
};

// Folder actions
const getFolderName = (id: number) => {
  const f = folders.value.find(f => f.id === id);
  return f ? f.name : 'Folder';
};

const openFolderModal = (folder?: any) => {
  if (folder) {
    editingFolderId.value = folder.id;
    folderForm.value = { name: folder.name, color: folder.color || '#3B82F6' };
  } else {
    editingFolderId.value = null;
    folderForm.value = { name: '', color: '#3B82F6' };
  }
  showFolderModal.value = true;
};

const submitFolder = async () => {
  try {
    if (editingFolderId.value) {
      await api.put(`/projects/folders/${editingFolderId.value}`, folderForm.value);
    } else {
      await api.post(`/projects/${props.projectId}/folders`, folderForm.value);
    }
    showFolderModal.value = false;
    await fetchFolders();
  } catch (e: any) {
    alert(e.response?.data?.error || e.message);
  }
};

const editFolder = (f: any) => {
  folderCtx.value = null;
  openFolderModal(f);
};

const deleteFolderCtx = async (id: number) => {
  folderCtx.value = null;
  if (!confirm('Delete this folder? Files inside will be moved to root.')) return;
  try {
    await api.delete(`/projects/folders/${id}`);
    if (currentFolder.value === id) currentFolder.value = null;
    await fetchFolders();
    await fetchFiles();
  } catch (e: any) {
    alert(e.response?.data?.error || e.message);
  }
};

// Upload actions
const openUploadModal = () => {
  selectedFiles.value = [];
  showUploadModal.value = true;
};

const onFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files) selectedFiles.value = Array.from(target.files);
};

const onDrop = (e: DragEvent) => {
  if (e.dataTransfer?.files) selectedFiles.value = Array.from(e.dataTransfer.files);
};

const submitUpload = async () => {
  if (!selectedFiles.value.length) return;
  uploading.value = true;
  try {
    for (const file of selectedFiles.value) {
      const formData = new FormData();
      formData.append('file', file);
      if (currentFolder.value) formData.append('folder_id', String(currentFolder.value));
      await api.post(`/projects/${props.projectId}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }
    showUploadModal.value = false;
    selectedFiles.value = [];
    await fetchFiles();
    await fetchFolders();
    emit('filesChanged');
  } catch (err) {
    console.error('Upload error:', err);
    alert('Failed to upload file(s)');
  } finally {
    uploading.value = false;
  }
};

// Delete
const deleteFilePreview = async (fileId: number) => {
  if (!confirm('Delete this file?')) return;
  try {
    await api.delete(`/projects/files/${fileId}`);
    if (previewFile.value?.id === fileId) previewFile.value = null;
    await fetchFiles();
    await fetchFolders();
    emit('filesChanged');
  } catch (err) {
    console.error('Delete error:', err);
    alert('Failed to delete file');
  }
};

// URL helpers
const getDownloadUrl = (filePath: string) => {
  if (!filePath) return '#';
  return `${serverBase}/uploads/project_files/${filePath}`;
};

// File helpers
const getFileIcon = (typeOrName: string) => {
  if (!typeOrName) return '📄';
  // Check if it's a file_type value
  const typeMap: Record<string, string> = {
    image: '🖼️', pdf: '📕', excel: '📗', word: '📘', other: '📄'
  };
  if (typeMap[typeOrName]) return typeMap[typeOrName];
  // Check file extension
  const ext = typeOrName.split('.').pop()?.toLowerCase() || '';
  const extMap: Record<string, string> = {
    pdf:'📕', doc:'📘', docx:'📘', xls:'📗', xlsx:'📗', csv:'📗',
    ppt:'📙', pptx:'📙', jpg:'🖼️', jpeg:'🖼️', png:'🖼️', gif:'🖼️',
    svg:'🖼️', zip:'📦', rar:'📦', '7z':'📦', mp4:'🎬', txt:'📝', md:'📝'
  };
  return extMap[ext] || '📄';
};

const formatSize = (bytes: number | string) => {
  const b = Number(bytes);
  if (!b || isNaN(b) || b === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (date: string) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const fileExt = (name: string) => name ? (name.split('.').pop()?.toUpperCase() || '???') : 'Unknown';
const isPreviewImage = (name: string) => { if(!name) return false; const e=name.split('.').pop()?.toLowerCase()||''; return ['jpg','jpeg','png','gif','svg','webp','bmp'].includes(e); };
const isPreviewPdf = (name: string) => { if(!name) return false; return name.toLowerCase().endsWith('.pdf'); };

// Resize handle
function startResize(e: MouseEvent) {
  e.preventDefault();
  const startX = e.clientX;
  const startW = previewWidth.value;
  const onMove = (ev: MouseEvent) => {
    const delta = startX - ev.clientX;
    previewWidth.value = Math.max(280, Math.min(800, startW + delta));
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

onMounted(() => {
  fetchFiles();
  fetchFolders();
});

// Watch for projectId changes
watch(() => props.projectId, () => {
  fetchFiles();
  fetchFolders();
  currentFolder.value = null;
  previewFile.value = null;
});
</script>
