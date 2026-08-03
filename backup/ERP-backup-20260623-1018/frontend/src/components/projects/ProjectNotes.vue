<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <div class="flex justify-between items-center mb-6">
      <h3 class="text-lg font-bold text-gray-800">Project Notes</h3>
      <button @click="openModal()" class="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 font-medium">+ New Note</button>
    </div>
    
    <div v-if="loading" class="text-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div 
        v-for="note in notes" 
        :key="note.id"
        class="p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        :class="colorClasses[note.color] || colorClasses.yellow"
        @click="openModal(note)"
      >
        <div class="flex justify-between items-start mb-2">
          <h4 class="font-bold text-gray-800 flex-1 line-clamp-1">{{ note.title }}</h4>
          <button @click.stop="deleteNote(note.id)" class="text-gray-400 hover:text-red-500 ml-2 shrink-0" title="Delete">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
        <p class="text-sm text-gray-600 line-clamp-3">{{ note.content || 'No content' }}</p>
        <div class="mt-3 text-xs text-gray-500 flex justify-between">
          <span>{{ formatDate(note.created_at) }}</span>
          <span>By: {{ note.author_name || 'Unknown' }}</span>
        </div>
      </div>

      <!-- Add Note Placeholder -->
      <div 
        @click="openModal()"
        class="p-4 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors h-32"
      >
        <span class="text-gray-400 font-medium">+ Add Note</span>
      </div>
    </div>

    <!-- Note Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showModal = false">
      <div class="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-yellow-50 to-white">
          <h3 class="text-lg font-bold text-gray-900">{{ editingNote ? 'Edit Note' : 'New Note' }}</h3>
        </div>
        <div class="px-6 py-5 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input v-model="form.title" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Note title" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Content</label>
            <textarea v-model="form.content" rows="5" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Write your note..."></textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Color</label>
            <div class="flex gap-2">
              <button v-for="c in colorOptions" :key="c" @click="form.color = c"
                class="w-8 h-8 rounded-full border-2 transition-transform"
                :class="[colorDots[c], form.color === c ? 'scale-125 ring-2 ring-offset-2 ring-blue-500' : '']"
              ></button>
            </div>
          </div>
        </div>
        <div class="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
          <button @click="showModal = false" class="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100">Cancel</button>
          <button @click="saveNote" :disabled="saving || !form.title.trim()" class="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '@/lib/api';

const route = useRoute();
const projectId = route.params.id as string;

const notes = ref<any[]>([]);
const loading = ref(true);
const showModal = ref(false);
const editingNote = ref<any>(null);
const saving = ref(false);
const form = ref({ title: '', content: '', color: 'yellow' });

const colorOptions = ['yellow', 'blue', 'green', 'pink', 'purple'];
const colorClasses: Record<string, string> = {
  yellow: 'border-yellow-200 bg-yellow-50',
  blue: 'border-blue-200 bg-blue-50',
  green: 'border-green-200 bg-green-50',
  pink: 'border-pink-200 bg-pink-50',
  purple: 'border-purple-200 bg-purple-50'
};
const colorDots: Record<string, string> = {
  yellow: 'bg-yellow-300 border-yellow-400',
  blue: 'bg-blue-300 border-blue-400',
  green: 'bg-green-300 border-green-400',
  pink: 'bg-pink-300 border-pink-400',
  purple: 'bg-purple-300 border-purple-400'
};

const loadNotes = async () => {
  loading.value = true;
  try {
    const res = await api.get(`/projects/${projectId}/notes`);
    notes.value = Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    console.error('Failed to load notes:', err);
    notes.value = [];
  } finally {
    loading.value = false;
  }
};

const openModal = (note: any = null) => {
  editingNote.value = note;
  form.value = note 
    ? { title: note.title, content: note.content || '', color: note.color || 'yellow' }
    : { title: '', content: '', color: 'yellow' };
  showModal.value = true;
};

const saveNote = async () => {
  if (!form.value.title.trim()) return;
  saving.value = true;
  try {
    if (editingNote.value) {
      await api.put(`/projects/notes/${editingNote.value.id}`, form.value);
    } else {
      await api.post(`/projects/${projectId}/notes`, form.value);
    }
    showModal.value = false;
    await loadNotes();
  } catch (err) {
    console.error('Failed to save note:', err);
    alert('Failed to save note');
  } finally {
    saving.value = false;
  }
};

const deleteNote = async (id: number) => {
  if (!confirm('Delete this note?')) return;
  try {
    await api.delete(`/projects/notes/${id}`);
    await loadNotes();
  } catch (err) {
    console.error('Failed to delete note:', err);
  }
};

const formatDate = (date: string) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

onMounted(loadNotes);
</script>
