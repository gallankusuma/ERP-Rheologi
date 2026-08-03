<template>
  <div class="min-h-screen bg-gray-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <!-- Header -->
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">Notes</h1>
          <p class="text-gray-500 mt-1">Internal notes, reminders & team knowledge base</p>
        </div>
        <button @click="openModal()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2 shadow-sm">
          <span class="text-lg">+</span> New Note
        </button>
      </div>

      <!-- Toolbar -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex flex-wrap gap-3 mb-5 items-center">
        <div class="relative flex-1 min-w-[200px]">
          <span class="absolute left-3 top-2.5 text-gray-400">🔍</span>
          <input v-model="search" type="text" placeholder="Search notes..." class="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" @input="debouncedFetch" />
        </div>
        <select v-model="filterCategory" @change="fetchNotes" class="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
          <option value="">All Categories</option>
          <option v-for="c in categories" :key="c.value" :value="c.value">{{ c.icon }} {{ c.label }}</option>
        </select>
        <select v-model="filterLinked" @change="fetchNotes" class="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
          <option value="">All Links</option>
          <option value="client">🏢 Client</option>
          <option value="prospect">🎯 Prospect</option>
          <option value="project">📁 Project</option>
        </select>
        <button @click="filterPinned = !filterPinned; fetchNotes()" :class="filterPinned ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-white text-gray-600 border-gray-300'" class="px-3 py-2 border rounded-lg text-sm font-medium transition-colors">
          📌 Pinned
        </button>
      </div>

      <!-- Pinned Section -->
      <div v-if="pinnedNotes.length > 0 && !filterPinned" class="mb-6">
        <h2 class="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">📌 Pinned</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div v-for="note in pinnedNotes" :key="note.id" @click="openModal(note)" class="note-card group" :class="colorClasses(note.color)">
            <div class="flex justify-between items-start mb-2">
              <h3 class="font-semibold text-gray-900 text-sm line-clamp-1 flex-1">{{ note.title || 'Untitled' }}</h3>
              <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button @click.stop="togglePin(note)" class="p-1 rounded hover:bg-black/10 text-amber-500" title="Unpin">📌</button>
                <button @click.stop="deleteNote(note)" class="p-1 rounded hover:bg-black/10 text-red-400" title="Delete">🗑</button>
              </div>
            </div>
            <p class="text-xs text-gray-700 line-clamp-4 whitespace-pre-line mb-3">{{ note.content }}</p>
            <div class="flex items-center justify-between mt-auto pt-2 border-t border-black/5">
              <div class="flex gap-1.5 items-center">
                <span class="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" :class="categoryBadge(note.category)">{{ categoryLabel(note.category) }}</span>
                <span v-if="note.linked_type" class="text-[10px] px-1.5 py-0.5 rounded bg-white/60 text-gray-600 font-medium">{{ linkedIcon(note.linked_type) }} {{ note.linked_name || note.linked_type }}</span>
              </div>
              <span class="text-[10px] text-gray-500">{{ timeAgo(note.updated_at) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- All Notes Grid -->
      <div v-if="unpinnedNotes.length > 0 || filterPinned">
        <h2 v-if="pinnedNotes.length > 0 && !filterPinned" class="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">All Notes</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div v-for="note in displayNotes" :key="note.id" @click="openModal(note)" class="note-card group" :class="colorClasses(note.color)">
            <div class="flex justify-between items-start mb-2">
              <h3 class="font-semibold text-gray-900 text-sm line-clamp-1 flex-1">{{ note.title || 'Untitled' }}</h3>
              <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button @click.stop="togglePin(note)" class="p-1 rounded hover:bg-black/10" :class="note.is_pinned ? 'text-amber-500' : 'text-gray-400'" :title="note.is_pinned ? 'Unpin' : 'Pin'">📌</button>
                <button @click.stop="deleteNote(note)" class="p-1 rounded hover:bg-black/10 text-red-400" title="Delete">🗑</button>
              </div>
            </div>
            <p class="text-xs text-gray-700 line-clamp-5 whitespace-pre-line mb-3">{{ note.content }}</p>
            <div class="flex items-center justify-between mt-auto pt-2 border-t border-black/5">
              <div class="flex gap-1.5 items-center flex-wrap">
                <span class="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" :class="categoryBadge(note.category)">{{ categoryLabel(note.category) }}</span>
                <span v-if="note.linked_type" class="text-[10px] px-1.5 py-0.5 rounded bg-white/60 text-gray-600 font-medium">{{ linkedIcon(note.linked_type) }} {{ note.linked_name || note.linked_type }}</span>
              </div>
              <span class="text-[10px] text-gray-500 whitespace-nowrap">{{ timeAgo(note.updated_at) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="notes.length === 0 && !loading" class="text-center py-20">
        <p class="text-5xl mb-4">📝</p>
        <p class="text-gray-500 text-lg">No notes yet</p>
        <p class="text-gray-400 text-sm mt-1">Click "New Note" to create your first note</p>
      </div>
    </div>

    <!-- Note Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="showModal = false">
      <div class="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        <!-- Color strip -->
        <div class="h-2 flex-shrink-0" :class="stripColor(form.color)"></div>
        <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <input v-model="form.title" type="text" placeholder="Note title (optional)" class="text-lg font-bold text-gray-900 bg-transparent border-none outline-none w-full placeholder-gray-300" />
          <button @click="showModal = false" class="text-gray-400 hover:text-gray-600 text-2xl ml-3">&times;</button>
        </div>

        <div class="px-6 py-4 overflow-y-auto flex-1 space-y-4">
          <textarea v-model="form.content" rows="8" placeholder="Write your note here..." class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm leading-relaxed resize-none"></textarea>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Color</label>
              <div class="flex gap-2">
                <button v-for="c in colorOptions" :key="c.value" @click="form.color = c.value" class="w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center text-xs" :class="[c.bg, form.color === c.value ? 'border-gray-800 scale-110 shadow-md' : 'border-transparent hover:scale-105']">
                  {{ form.color === c.value ? '✓' : '' }}
                </button>
              </div>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Category</label>
              <select v-model="form.category" class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm">
                <option v-for="c in categories" :key="c.value" :value="c.value">{{ c.icon }} {{ c.label }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Link To</label>
              <select v-model="form.linked_type" class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm">
                <option value="">None</option>
                <option value="client">🏢 Client</option>
                <option value="prospect">🎯 Prospect</option>
                <option value="project">📁 Project</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Link Name</label>
              <input v-model="form.linked_name" type="text" placeholder="e.g. PT Cosmetica" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" :disabled="!form.linked_type" />
            </div>
          </div>
        </div>

        <div class="px-6 py-3 border-t border-gray-100 flex justify-between items-center bg-gray-50">
          <span v-if="editingId" class="text-xs text-gray-400">Last updated: {{ form.updated_at ? timeAgo(form.updated_at) : '' }}</span>
          <span v-else></span>
          <div class="flex gap-2">
            <button @click="showModal = false" class="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 text-sm">Cancel</button>
            <button @click="saveNote" :disabled="saving || !form.content" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
              {{ saving ? 'Saving...' : editingId ? 'Update' : 'Save' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div v-if="toast" class="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div :class="toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'" class="text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium">{{ toast.message }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api } from '../lib/api';

interface Note {
  id: number; title: string; content: string; color: string;
  is_pinned: number; category: string; linked_type: string;
  linked_id: number; linked_name: string; author_name: string;
  created_at: string; updated_at: string;
}

const notes = ref<Note[]>([]);
const loading = ref(false);
const saving = ref(false);
const showModal = ref(false);
const editingId = ref<number | null>(null);
const search = ref('');
const filterCategory = ref('');
const filterLinked = ref('');
const filterPinned = ref(false);
const toast = ref<{ type: string; message: string } | null>(null);

const categories = [
  { value: 'general', label: 'General', icon: '📋' },
  { value: 'meeting', label: 'Meeting', icon: '🤝' },
  { value: 'followup', label: 'Follow Up', icon: '📞' },
  { value: 'idea', label: 'Idea', icon: '💡' },
  { value: 'reminder', label: 'Reminder', icon: '⏰' },
  { value: 'important', label: 'Important', icon: '⭐' },
];

const colorOptions = [
  { value: 'yellow', bg: 'bg-amber-200' },
  { value: 'green', bg: 'bg-emerald-200' },
  { value: 'blue', bg: 'bg-sky-200' },
  { value: 'purple', bg: 'bg-violet-200' },
  { value: 'pink', bg: 'bg-pink-200' },
  { value: 'white', bg: 'bg-gray-100' },
];

const defaultForm = () => ({
  title: '', content: '', color: 'yellow', category: 'general',
  linked_type: '', linked_id: null as number | null, linked_name: '', updated_at: '',
});
const form = ref(defaultForm());

const pinnedNotes = computed(() => notes.value.filter(n => n.is_pinned));
const unpinnedNotes = computed(() => notes.value.filter(n => !n.is_pinned));
const displayNotes = computed(() => filterPinned.value ? pinnedNotes.value : unpinnedNotes.value);

const colorClasses = (c: string) => ({
  yellow: 'bg-amber-50 border-amber-200 hover:border-amber-400',
  green: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400',
  blue: 'bg-sky-50 border-sky-200 hover:border-sky-400',
  purple: 'bg-violet-50 border-violet-200 hover:border-violet-400',
  pink: 'bg-pink-50 border-pink-200 hover:border-pink-400',
  white: 'bg-white border-gray-200 hover:border-gray-400',
}[c] || 'bg-amber-50 border-amber-200');

const stripColor = (c: string) => ({
  yellow: 'bg-amber-400', green: 'bg-emerald-400', blue: 'bg-sky-400',
  purple: 'bg-violet-400', pink: 'bg-pink-400', white: 'bg-gray-300',
}[c] || 'bg-amber-400');

const categoryBadge = (c: string) => ({
  general: 'bg-gray-200 text-gray-700', meeting: 'bg-blue-100 text-blue-700',
  followup: 'bg-cyan-100 text-cyan-700', idea: 'bg-amber-100 text-amber-700',
  reminder: 'bg-red-100 text-red-700', important: 'bg-yellow-100 text-yellow-800',
}[c] || 'bg-gray-200 text-gray-700');

const categoryLabel = (c: string) => categories.find(x => x.value === c)?.label || c;
const linkedIcon = (t: string) => ({ client: '🏢', prospect: '🎯', project: '📁' }[t] || '🔗');

const timeAgo = (d: string) => {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};

let debounceTimer: any;
const debouncedFetch = () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(fetchNotes, 300); };

const showToast = (type: string, message: string) => {
  toast.value = { type, message }; setTimeout(() => { toast.value = null; }, 2500);
};

const fetchNotes = async () => {
  loading.value = true;
  try {
    const params: any = {};
    if (search.value) params.search = search.value;
    if (filterCategory.value) params.category = filterCategory.value;
    if (filterLinked.value) params.linked_type = filterLinked.value;
    if (filterPinned.value) params.pinned = '1';
    const { data } = await api.get('/notes', { params });
    notes.value = data.data || [];
  } catch { /* silent */ } finally { loading.value = false; }
};

const openModal = (note?: Note) => {
  if (note) {
    editingId.value = note.id;
    form.value = {
      title: note.title || '', content: note.content || '', color: note.color || 'yellow',
      category: note.category || 'general', linked_type: note.linked_type || '',
      linked_id: note.linked_id || null, linked_name: note.linked_name || '',
      updated_at: note.updated_at || '',
    };
  } else {
    editingId.value = null;
    form.value = defaultForm();
  }
  showModal.value = true;
};

const saveNote = async () => {
  saving.value = true;
  try {
    if (editingId.value) {
      await api.put(`/notes/${editingId.value}`, form.value);
      showToast('success', 'Note updated');
    } else {
      await api.post('/notes', form.value);
      showToast('success', 'Note created');
    }
    showModal.value = false;
    fetchNotes();
  } catch (e: any) {
    showToast('error', e.response?.data?.error || 'Failed to save');
  } finally { saving.value = false; }
};

const togglePin = async (note: Note) => {
  try {
    await api.patch(`/notes/${note.id}/pin`);
    fetchNotes();
  } catch { /* silent */ }
};

const deleteNote = async (note: Note) => {
  if (!confirm('Delete this note?')) return;
  try {
    await api.delete(`/notes/${note.id}`);
    showToast('success', 'Note deleted');
    fetchNotes();
  } catch (e: any) {
    showToast('error', 'Failed to delete');
  }
};

onMounted(fetchNotes);
</script>

<style scoped>
.note-card {
  @apply rounded-xl border-2 p-4 cursor-pointer transition-all duration-200 flex flex-col min-h-[160px];
}
.note-card:hover {
  @apply shadow-lg -translate-y-0.5;
}
.line-clamp-1 { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
.line-clamp-4 { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.line-clamp-5 { display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden; }
@keyframes slide-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.animate-slide-up { animation: slide-up 0.2s ease-out; }
</style>
