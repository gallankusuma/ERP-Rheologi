<template>
  <div class="p-6 h-[calc(100vh-120px)] flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between mb-5 shrink-0">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">🔬 R&D Projects</h1>
        <p class="text-sm text-gray-500 mt-0.5">Kanban Board — drag cards between stages</p>
      </div>
      <div class="flex items-center gap-2">
        <router-link to="/rnd/projects" class="px-3 py-2 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center gap-1">📋 List</router-link>
        <div class="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium flex items-center gap-1">📊 Kanban</div>
        <button @click="showAddCol = true" class="px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600">+ Column</button>
      </div>
    </div>

    <!-- Kanban Board -->
    <div class="flex-1 overflow-x-auto">
      <div class="flex gap-4 h-full min-w-max pb-4">
        <div v-for="col in columns" :key="col.id"
          class="w-[300px] shrink-0 bg-gray-50 rounded-xl border flex flex-col"
          @dragover.prevent="onDragOver($event, col.id)"
          @drop="onDrop($event, col.id)">
          <!-- Column Header -->
          <div class="px-4 py-3 border-b flex items-center justify-between group" :style="{borderTopColor: col.color}" style="border-top: 3px solid">
            <div class="flex items-center gap-2">
              <span class="font-semibold text-sm text-gray-800">{{ col.label }}</span>
              <span class="text-xs bg-gray-200 text-gray-600 rounded-full px-2 py-0.5">{{ getColCards(col.id).length }}</span>
            </div>
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button @click="editCol(col)" class="text-gray-400 hover:text-gray-600 text-xs">✏️</button>
              <button @click="removeCol(col.id)" class="text-gray-400 hover:text-red-500 text-xs">🗑️</button>
            </div>
          </div>
          <!-- Cards -->
          <div class="flex-1 overflow-y-auto p-3 space-y-2 min-h-[100px]" :class="{'bg-indigo-50/50 ring-2 ring-indigo-300 ring-inset rounded-b-xl': dragOverCol === col.id}">
            <div v-for="card in getColCards(col.id)" :key="card.id"
              class="bg-white rounded-lg border shadow-sm p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
              draggable="true"
              @dragstart="onDragStart($event, card)"
              @dragend="onDragEnd">
              <div class="flex items-start justify-between mb-1">
                <router-link :to="`/rnd/projects/${card.id}`" class="font-medium text-sm text-gray-800 hover:text-indigo-600 leading-tight">{{ card.name }}</router-link>
                <span class="px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ml-2" :class="priorityClass(card.priority)">{{ card.priority?.toUpperCase() }}</span>
              </div>
              <div class="text-[10px] text-gray-400 font-mono mb-2">{{ card.project_code }}</div>
              <div class="flex flex-wrap gap-1 mb-2">
                <span v-if="card.project_type" class="px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded text-[10px]">{{ labelify(card.project_type) }}</span>
                <span v-if="card.category" class="px-1.5 py-0.5 bg-sky-50 text-sky-600 rounded text-[10px]">{{ card.category }}</span>
                <span v-if="card.risk_level === 'high'" class="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[10px]">🔴 High Risk</span>
              </div>
              <div class="flex items-center justify-between text-[10px] text-gray-400">
                <span v-if="card.leader_name">👤 {{ card.leader_name }}</span>
                <span v-if="card.target_end_date">📅 {{ formatDate(card.target_end_date) }}</span>
              </div>
              <div v-if="card.budget" class="text-[10px] text-gray-500 font-medium mt-1">💰 {{ formatCurrency(card.budget) }}</div>
            </div>
            <!-- Drop zone placeholder -->
            <div v-if="!getColCards(col.id).length" class="text-center text-xs text-gray-400 py-8">
              Drop projects here
            </div>
          </div>
        </div>

        <!-- Add Column Button (end) -->
        <div class="w-[300px] shrink-0 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
          @click="showAddCol = true">
          <div class="text-center">
            <div class="text-2xl text-gray-300 mb-1">+</div>
            <div class="text-xs text-gray-400">Add Column</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Column Modal -->
    <div v-if="showAddCol" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div class="px-6 py-4 border-b"><h3 class="text-lg font-semibold text-gray-800">{{ editingCol ? 'Edit Column' : 'Add Column' }}</h3></div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Column Name *</label>
            <input v-model="colForm.label" type="text" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. In Review" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Maps to Status</label>
            <select v-model="colForm.status" class="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="draft">Draft</option><option value="active">Active</option>
              <option value="on_hold">On Hold</option><option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Color</label>
            <div class="flex gap-2 flex-wrap">
              <button v-for="c in colorOptions" :key="c" type="button" @click="colForm.color = c"
                class="w-8 h-8 rounded-lg border-2 transition-transform" :class="colForm.color === c ? 'scale-110 border-gray-800' : 'border-transparent'"
                :style="{backgroundColor: c}"></button>
            </div>
          </div>
          <div class="flex justify-end gap-3 pt-3 border-t">
            <button @click="showAddCol = false; editingCol = null" class="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button @click="saveCol" class="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">{{ editingCol ? 'Update' : 'Add' }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../lib/api';

interface Column { id: string; label: string; status: string; color: string; }

const STORAGE_KEY = 'rnd_kanban_columns';
const defaultColumns: Column[] = [
  { id: 'col-draft', label: 'Draft', status: 'draft', color: '#94a3b8' },
  { id: 'col-active', label: 'Active', status: 'active', color: '#3b82f6' },
  { id: 'col-hold', label: 'On Hold', status: 'on_hold', color: '#f59e0b' },
  { id: 'col-completed', label: 'Completed', status: 'completed', color: '#22c55e' },
  { id: 'col-cancelled', label: 'Cancelled', status: 'cancelled', color: '#ef4444' },
];

const columns = ref<Column[]>([]);
const projects = ref<any[]>([]);
const dragOverCol = ref<string | null>(null);
const dragCard = ref<any>(null);
const showAddCol = ref(false);
const editingCol = ref<Column | null>(null);
const colForm = ref({ label: '', status: 'draft', color: '#3b82f6' });

const colorOptions = ['#94a3b8','#3b82f6','#6366f1','#8b5cf6','#ec4899','#ef4444','#f59e0b','#22c55e','#14b8a6','#06b6d4'];

const priorityClass = (p: string) => ({ low:'bg-gray-100 text-gray-500', medium:'bg-blue-100 text-blue-600', high:'bg-orange-100 text-orange-600', critical:'bg-red-100 text-red-600' }[p] || 'bg-gray-100 text-gray-500');
const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('id-ID', { day:'2-digit', month:'short' }) : '';
const formatCurrency = (v: number) => v ? `Rp ${Number(v).toLocaleString('id-ID')}` : '';
const labelify = (s: string) => s ? s.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase()) : '';

const getColCards = (colId: string) => {
  const col = columns.value.find(c => c.id === colId);
  if (!col) return [];
  return projects.value.filter(p => p.status === col.status);
};

function loadColumns() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    columns.value = saved ? JSON.parse(saved) : [...defaultColumns];
  } catch { columns.value = [...defaultColumns]; }
}

function saveColumns() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(columns.value));
}

function editCol(col: Column) {
  editingCol.value = col;
  colForm.value = { label: col.label, status: col.status, color: col.color };
  showAddCol.value = true;
}

function saveCol() {
  if (!colForm.value.label.trim()) return;
  if (editingCol.value) {
    const idx = columns.value.findIndex(c => c.id === editingCol.value!.id);
    if (idx >= 0) columns.value[idx] = { ...editingCol.value, ...colForm.value };
  } else {
    columns.value.push({ id: `col-${Date.now()}`, ...colForm.value });
  }
  saveColumns();
  showAddCol.value = false;
  editingCol.value = null;
  colForm.value = { label: '', status: 'draft', color: '#3b82f6' };
}

function removeCol(id: string) {
  if (columns.value.length <= 1) return alert('Need at least 1 column');
  if (!confirm('Remove this column?')) return;
  columns.value = columns.value.filter(c => c.id !== id);
  saveColumns();
}

// Drag & Drop
function onDragStart(e: DragEvent, card: any) {
  dragCard.value = card;
  e.dataTransfer!.effectAllowed = 'move';
  e.dataTransfer!.setData('text/plain', card.id);
  (e.target as HTMLElement).style.opacity = '0.4';
}
function onDragEnd(e: DragEvent) {
  (e.target as HTMLElement).style.opacity = '1';
  dragOverCol.value = null;
  dragCard.value = null;
}
function onDragOver(e: DragEvent, colId: string) {
  e.dataTransfer!.dropEffect = 'move';
  dragOverCol.value = colId;
}
async function onDrop(_e: DragEvent, colId: string) {
  dragOverCol.value = null;
  const col = columns.value.find(c => c.id === colId);
  if (!dragCard.value || !col) return;
  if (dragCard.value.status === col.status) return;
  try {
    await api.patch(`/rnd/projects/${dragCard.value.id}/status`, { status: col.status });
    dragCard.value.status = col.status;
  } catch (err: any) { alert(err.message); }
}

onMounted(async () => {
  loadColumns();
  try { const r = await api.get('/rnd/projects'); projects.value = r.data.data || []; } catch {}
});
</script>
