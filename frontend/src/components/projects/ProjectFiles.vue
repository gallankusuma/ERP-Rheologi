<template>
  <div class="space-y-6">
    <!-- Upload Area -->
    <div 
      class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer"
      @click="triggerFileInput"
      @dragover.prevent
      @drop.prevent="handleDrop"
    >
      <input 
        type="file" 
        ref="fileInput" 
        class="hidden" 
        @change="handleFileChange"
        multiple
      >
      <div class="text-4xl mb-3">📂</div>
      <p class="text-gray-600 font-medium">Click to upload or drag and drop files here</p>
      <p class="text-xs text-gray-400 mt-1">Supported: Images, PDF, Excel, Word (Max 10MB)</p>
    </div>

    <!-- Upload Progress -->
    <div v-if="uploading" class="bg-blue-50 text-blue-700 p-3 rounded flex items-center gap-3">
      <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700"></div>
      Uploading files...
    </div>

    <!-- Files List -->
    <div v-if="files.length > 0" class="bg-white border rounded-lg overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uploaded By</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="file in files" :key="file.id" class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="flex items-center">
                <span class="text-2xl mr-3">{{ getFileIcon(file.file_type) }}</span>
                <span class="text-sm font-medium text-gray-900">{{ file.file_name }}</span>
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {{ formatSize(file.file_size) }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {{ file.uploader_name || 'Unknown' }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {{ formatDate(file.uploaded_at) }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <a 
                :href="getFileUrl(file.file_path)" 
                target="_blank"
                class="text-blue-600 hover:text-blue-900 mr-4"
              >
                Download
              </a>
              <button 
                @click="$emit('deleteFile', file.id)"
                class="text-red-600 hover:text-red-900"
              >
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Empty State -->
    <div v-else-if="!uploading" class="text-center py-10">
      <p class="text-gray-500">No files uploaded yet.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  files: any[];
}>();

const emit = defineEmits(['uploadFile', 'deleteFile']);

const fileInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);

const triggerFileInput = () => {
  fileInput.value?.click();
};

const handleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files) {
    await processFiles(Array.from(target.files));
  }
};

const handleDrop = async (event: DragEvent) => {
  if (event.dataTransfer?.files) {
    await processFiles(Array.from(event.dataTransfer.files));
  }
};

const processFiles = async (fileList: File[]) => {
  uploading.value = true;
  for (const file of fileList) {
    await emit('uploadFile', file);
  }
  uploading.value = false;
  if (fileInput.value) fileInput.value.value = '';
};

const getFileIcon = (type: string) => {
  switch (type) {
    case 'image': return '🖼️';
    case 'pdf': return '📄';
    case 'excel': return '📊';
    case 'word': return '📝';
    default: return '📁';
  }
};

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (date: string) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getFileUrl = (path: string) => {
  // Assuming backend serves uploads at /uploads
  // We need to construct the full URL
  return `http://localhost:3001/uploads/project_files/${path}`;
};
</script>
