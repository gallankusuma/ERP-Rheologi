<template>
  <transition name="slide">
    <div v-if="visible" class="fixed inset-0 z-50 flex justify-end" @click.self="$emit('close')">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="$emit('close')"></div>
      
      <!-- Panel -->
      <div class="relative w-full max-w-[680px] bg-gray-50 shadow-2xl overflow-y-auto flex flex-col" @click.stop>
        <!-- Header -->
        <div class="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4">
          <div class="flex justify-between items-start">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-xs px-2 py-0.5 rounded-full font-semibold" :style="{ background: (stageColorHex + '20'), color: stageColorHex }">{{ lead.stage }}</span>
                <span v-if="isOverdue" class="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">⏰ Overdue</span>
              </div>
              <h2 class="text-xl font-bold text-gray-900 truncate">{{ lead.company }}</h2>
              <p class="text-sm text-gray-500 mt-0.5">{{ lead.contact_name }} · {{ lead.email }}</p>
            </div>
            <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>

        <div class="flex-1 px-6 py-5 space-y-6">
          <!-- Quick Info Bar -->
          <div class="grid grid-cols-3 gap-3">
            <div class="bg-white rounded-lg p-3 border border-gray-200 text-center">
              <p class="text-xs text-gray-500 mb-1">Value</p>
              <p class="text-lg font-bold text-gray-900">{{ formatNumber(lead.value, lead.currency) }}</p>
            </div>
            <div class="bg-white rounded-lg p-3 border border-gray-200 text-center">
              <p class="text-xs text-gray-500 mb-1">Probability</p>
              <p class="text-lg font-bold" :class="lead.probability >= 70 ? 'text-green-600' : lead.probability >= 40 ? 'text-yellow-600' : 'text-red-600'">{{ lead.probability }}%</p>
            </div>
            <div class="bg-white rounded-lg p-3 border border-gray-200 text-center cursor-pointer hover:border-blue-300" @click="showDueDatePicker = !showDueDatePicker">
              <p class="text-xs text-gray-500 mb-1">Due Date</p>
              <p class="text-sm font-bold" :class="isOverdue ? 'text-red-600' : 'text-gray-900'">{{ lead.due_date ? formatDate(lead.due_date) : '+ Set' }}</p>
            </div>
          </div>

          <!-- Due Date Picker -->
          <div v-if="showDueDatePicker" class="bg-white rounded-lg p-4 border border-blue-200 shadow-sm">
            <label class="text-xs font-semibold text-gray-600 block mb-2">📅 Due Date</label>
            <div class="flex gap-2">
              <input type="date" v-model="dueDateValue" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              <button @click="saveDueDate" class="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Save</button>
              <button @click="removeDueDate" class="px-3 py-2 text-red-500 border border-gray-300 rounded-lg text-sm hover:bg-red-50">✕</button>
            </div>
          </div>

          <!-- Labels -->
          <div class="bg-white rounded-lg p-4 border border-gray-200">
            <div class="flex justify-between items-center mb-3">
              <h3 class="text-sm font-bold text-gray-700">🏷️ Labels</h3>
              <button @click="showLabelPicker = !showLabelPicker" class="text-xs text-blue-600 hover:text-blue-800 font-medium">+ Add</button>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <span v-for="label in assignedLabels" :key="label.id"
                class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-white cursor-pointer hover:opacity-80"
                :style="{ background: label.color }"
                @click="removeLabel(label.id)"
                :title="'Click to remove'">
                {{ label.name }} ×
              </span>
              <span v-if="!assignedLabels.length" class="text-xs text-gray-400">No labels</span>
            </div>
            <!-- Label Picker -->
            <div v-if="showLabelPicker" class="mt-3 pt-3 border-t border-gray-100">
              <div class="flex flex-wrap gap-1.5">
                <button v-for="label in availableLabels" :key="label.id"
                  @click="toggleLabel(label)"
                  class="px-2.5 py-1 rounded-full text-xs font-semibold transition-all"
                  :class="isLabelAssigned(label.id) ? 'text-white ring-2 ring-offset-1 ring-gray-400' : 'text-white opacity-60 hover:opacity-100'"
                  :style="{ background: label.color }">
                  {{ label.name }}
                </button>
              </div>
            </div>
          </div>

          <!-- Members (multi-assign) -->
          <div class="bg-white rounded-lg p-4 border border-gray-200">
            <div class="flex justify-between items-center mb-3">
              <h3 class="text-sm font-bold text-gray-700">👥 Assigned To</h3>
              <button @click="showAssignDropdown = !showAssignDropdown" class="text-xs text-blue-600 hover:text-blue-800 font-medium">{{ showAssignDropdown ? 'Done' : '+ Add' }}</button>
            </div>
            <!-- assigned user chips -->
            <div class="flex flex-wrap gap-1.5 mb-2" v-if="assignedUserIds.length > 0">
              <span v-for="uid in assignedUserIds" :key="uid"
                class="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                {{ getUserName(uid) }}
                <button @click="removeAssignee(uid)" class="text-blue-400 hover:text-red-500 ml-0.5">&times;</button>
              </span>
            </div>
            <p v-else class="text-xs text-gray-400 mb-2">No one assigned</p>
            <!-- dropdown for adding -->
            <div v-if="showAssignDropdown" class="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
              <label v-for="u in users" :key="u.id"
                class="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                <input type="checkbox" :value="u.id" v-model="assignedUserIds" @change="saveAssignment"
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                {{ u.full_name || u.name }}
              </label>
            </div>
          </div>

          <!-- Description -->
          <div class="bg-white rounded-lg p-4 border border-gray-200">
            <div class="flex justify-between items-center mb-3">
              <h3 class="text-sm font-bold text-gray-700">📝 Description</h3>
              <button @click="editingDesc = !editingDesc" class="text-xs text-blue-600 hover:text-blue-800 font-medium">{{ editingDesc ? 'Cancel' : 'Edit' }}</button>
            </div>
            <div v-if="editingDesc">
              <textarea v-model="descValue" rows="4" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none" placeholder="Add a description..."></textarea>
              <button @click="saveDescription" class="mt-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Save</button>
            </div>
            <p v-else class="text-sm text-gray-600 whitespace-pre-wrap">{{ lead.description || 'No description yet. Click Edit to add one.' }}</p>
          </div>

          <!-- Checklists -->
          <div v-for="cl in checklists" :key="cl.id" class="bg-white rounded-lg p-4 border border-gray-200">
            <div class="flex justify-between items-center mb-3">
              <h3 class="text-sm font-bold text-gray-700">☑️ {{ cl.title }}</h3>
              <button @click="deleteChecklist(cl.id)" class="text-xs text-red-500 hover:text-red-700">Delete</button>
            </div>
            <!-- Progress -->
            <div class="flex items-center gap-2 mb-3" v-if="cl.items?.length">
              <div class="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div class="h-full bg-green-500 rounded-full transition-all" :style="{ width: checklistPct(cl) + '%' }"></div>
              </div>
              <span class="text-xs text-gray-500 font-medium">{{ cl.items.filter((i:any) => i.is_checked).length }}/{{ cl.items.length }}</span>
            </div>
            <!-- Items -->
            <div class="space-y-1.5">
              <div v-for="item in cl.items" :key="item.id" class="flex items-center gap-2 group">
                <input type="checkbox" :checked="item.is_checked" @change="toggleCheckItem(item)" class="rounded text-blue-600 w-4 h-4 cursor-pointer" />
                <span class="text-sm flex-1" :class="item.is_checked ? 'line-through text-gray-400' : 'text-gray-700'">{{ item.text }}</span>
                <button @click="deleteCheckItem(item.id, cl)" class="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 text-xs">✕</button>
              </div>
            </div>
            <!-- Add Item -->
            <div class="mt-2 flex gap-2">
              <input v-model="newItemTexts[cl.id]" @keydown.enter="addCheckItem(cl)" type="text" placeholder="Add item..." class="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs" />
              <button @click="addCheckItem(cl)" class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium">Add</button>
            </div>
          </div>
          <!-- Add Checklist Button -->
          <button @click="addChecklist" class="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:text-blue-600 hover:border-blue-300 font-medium transition-colors">
            + Add Checklist
          </button>

          <!-- Attachments -->
          <div class="bg-white rounded-lg p-4 border border-gray-200">
            <div class="flex justify-between items-center mb-3">
              <h3 class="text-sm font-bold text-gray-700">📎 Attachments ({{ attachments.length }})</h3>
              <label class="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer">
                + Upload
                <input type="file" class="hidden" @change="uploadFile" multiple />
              </label>
            </div>
            <div v-if="attachments.length" class="space-y-2">
              <!-- Image Previews Grid -->
              <div v-if="imageAttachments.length" class="grid grid-cols-3 gap-2 mb-3">
                <a v-for="f in imageAttachments" :key="'img-' + f.id"
                  :href="getFileUrl(f.file_path)" target="_blank"
                  class="relative aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all group cursor-pointer">
                  <img :src="getFileUrl(f.file_path)" :alt="f.file_name"
                    class="w-full h-full object-cover" @error="handleImgError" />
                  <div class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                    <span class="text-white opacity-0 group-hover:opacity-100 text-xs font-bold">🔍 Preview</span>
                  </div>
                  <button @click.prevent.stop="deleteAttachment(f.id)"
                    class="absolute top-1 right-1 w-5 h-5 bg-white/80 hover:bg-red-500 hover:text-white text-gray-500 rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-all">✕</button>
                  <p class="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] px-1.5 py-0.5 truncate">{{ f.file_name }}</p>
                </a>
              </div>

              <!-- Non-image file list -->
              <div v-for="f in nonImageAttachments" :key="f.id" class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 group">
                <a :href="getFileUrl(f.file_path)" target="_blank"
                  class="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 hover:ring-2 hover:ring-blue-300 transition-all"
                  :class="fileIconClass(f.file_type)" :title="'Open ' + f.file_name">
                  {{ fileIcon(f.file_type) }}
                </a>
                <div class="flex-1 min-w-0">
                  <a :href="getFileUrl(f.file_path)" target="_blank" class="text-sm font-medium text-gray-800 truncate block hover:text-blue-600 transition-colors">{{ f.file_name }}</a>
                  <p class="text-[10px] text-gray-400">{{ formatFileSize(f.file_size) }} · {{ f.uploader_name || 'Unknown' }} · {{ timeAgo(f.created_at) }}</p>
                </div>
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a :href="getFileUrl(f.file_path)" target="_blank" download
                    class="text-gray-400 hover:text-blue-500 text-xs" title="Download">⬇️</a>
                  <button @click="deleteAttachment(f.id)"
                    class="text-gray-300 hover:text-red-500 text-xs" title="Delete">✕</button>
                </div>
              </div>
            </div>
            <p v-else class="text-xs text-gray-400 text-center py-4">No attachments yet. Upload files to get started.</p>
            <div v-if="uploading" class="mt-2 flex items-center gap-2">
              <div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span class="text-xs text-blue-600">Uploading...</span>
            </div>
          </div>

          <!-- Activity & Comments -->
          <div class="bg-white rounded-lg p-4 border border-gray-200">
            <div class="flex gap-2 mb-4">
              <button @click="activityTab = 'comments'" class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                :class="activityTab === 'comments' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'">💬 Comments</button>
              <button @click="activityTab = 'activity'" class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                :class="activityTab === 'activity' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'">📋 Activity</button>
            </div>

            <!-- Comments -->
            <div v-if="activityTab === 'comments'">
              <div class="flex gap-3 mb-4">
                <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">{{ currentUserInitials }}</div>
                <div class="flex-1">
                  <textarea v-model="newComment" rows="2" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none" placeholder="Write a comment..." @keydown.ctrl.enter="postComment"></textarea>
                  <button @click="postComment" :disabled="!newComment.trim()" class="mt-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 disabled:opacity-50 font-medium">Post</button>
                </div>
              </div>
              <div class="space-y-3">
                <div v-for="c in comments" :key="c.id" class="flex gap-3 group">
                  <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    :class="avatarColor(c.user_name)">{{ initials(c.user_name) }}</div>
                  <div class="flex-1 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div class="flex justify-between items-center mb-1">
                      <span class="text-xs font-bold text-gray-800">{{ c.user_name || 'Unknown' }}</span>
                      <div class="flex items-center gap-1">
                        <span class="text-[10px] text-gray-400">{{ timeAgo(c.created_at) }}</span>
                        <button @click="deleteComment(c.id)" class="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 text-xs">✕</button>
                      </div>
                    </div>
                    <p class="text-sm text-gray-700 whitespace-pre-wrap">{{ c.content }}</p>
                  </div>
                </div>
                <p v-if="!comments.length" class="text-xs text-gray-400 text-center py-4">No comments yet</p>
              </div>
            </div>

            <!-- Activity Log -->
            <div v-if="activityTab === 'activity'" class="space-y-3">
              <div v-for="a in activities" :key="a.id" class="flex gap-3">
                <div class="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-600 shrink-0 mt-0.5">
                  {{ actionIcon(a.action) }}
                </div>
                <div>
                  <p class="text-sm text-gray-700"><span class="font-medium">{{ a.user_name || 'System' }}</span> {{ a.details }}</p>
                  <p class="text-[10px] text-gray-400 mt-0.5">{{ timeAgo(a.created_at) }}</p>
                </div>
              </div>
              <p v-if="!activities.length" class="text-xs text-gray-400 text-center py-4">No activity yet</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { api } from '@/lib/api';

const props = defineProps<{ lead: any; visible: boolean }>();
const emit = defineEmits(['close', 'updated']);

// Data
const checklists = ref<any[]>([]);
const assignedLabels = ref<any[]>([]);
const availableLabels = ref<any[]>([]);
const comments = ref<any[]>([]);
const activities = ref<any[]>([]);
const attachments = ref<any[]>([]);
const users = ref<any[]>([]);
const newItemTexts = ref<Record<number, string>>({});
const newComment = ref('');
const activityTab = ref<'comments' | 'activity'>('comments');
const showLabelPicker = ref(false);
const showDueDatePicker = ref(false);
const editingDesc = ref(false);
const descValue = ref('');
const dueDateValue = ref('');
const assignedUserIds = ref<number[]>([]);
const showAssignDropdown = ref(false);
const uploading = ref(false);
const currentUserInitials = ref('ME');

// Computed
const stageColors = ref<Record<string, string>>({});
const stageColorHex = computed(() => stageColors.value[props.lead?.stage] || '#6b7280');

const isOverdue = computed(() => {
  if (!props.lead?.due_date) return false;
  return new Date(props.lead.due_date) < new Date(new Date().toDateString());
});

const imageAttachments = computed(() => attachments.value.filter(f => f.file_type === 'image'));
const nonImageAttachments = computed(() => attachments.value.filter(f => f.file_type !== 'image'));

// Build the full URL for file preview/download
const getFileUrl = (filePath: string) => {
  // The API base URL is like https://dev.rheologi.id/api
  // Uploads are served at /uploads/lead_attachments/<filename>
  const apiBase = (import.meta as any).env?.VITE_API_URL || '';
  if (apiBase) {
    // Strip /api from the end to get the base domain
    const base = apiBase.replace(/\/api\/?$/, '');
    return `${base}/uploads/lead_attachments/${filePath}`;
  }
  // Fallback: relative path
  return `/uploads/lead_attachments/${filePath}`;
};

const handleImgError = (e: Event) => {
  const img = e.target as HTMLImageElement;
  img.style.display = 'none';
};

// Watchers
watch(() => props.visible, async (v) => {
  if (v && props.lead) {
    descValue.value = props.lead.description || '';
    dueDateValue.value = props.lead.due_date || '';
    assignedUserIds.value = (props.lead.assignees || []).map((a: any) => a.id);
    // fallback for leads without assignees array yet
    if (!assignedUserIds.value.length && props.lead.assigned_to) {
      assignedUserIds.value = [props.lead.assigned_to];
    }
    assignedLabels.value = props.lead.labels || [];
    await loadAllData();
  }
});

const loadAllData = async () => {
  const id = props.lead.id;
  const [checkRes, labelRes, commentRes, actRes, attachRes, userRes, stagesRes] = await Promise.allSettled([
    api.get(`/leads/${id}/checklists`),
    api.get('/leads/labels'),
    api.get(`/leads/${id}/comments`),
    api.get(`/leads/${id}/activities`),
    api.get(`/leads/${id}/attachments`),
    api.get('/users'),
    api.get('/leads/stages')
  ]);
  checklists.value = checkRes.status === 'fulfilled' ? (checkRes.value.data || []) : [];
  availableLabels.value = labelRes.status === 'fulfilled' ? (labelRes.value.data || []) : [];
  comments.value = commentRes.status === 'fulfilled' ? (commentRes.value.data || []) : [];
  activities.value = actRes.status === 'fulfilled' ? (actRes.value.data || []) : [];
  attachments.value = attachRes.status === 'fulfilled' ? (attachRes.value.data || []) : [];
  const uData = userRes.status === 'fulfilled' ? userRes.value.data : [];
  users.value = Array.isArray(uData) ? uData : (uData?.data || []);
  // Load stage colors
  if (stagesRes.status === 'fulfilled') {
    const stages = stagesRes.value.data?.data || [];
    const m: Record<string, string> = {};
    for (const s of stages) m[s.name] = s.color;
    stageColors.value = m;
  }
};

// Label functions
const isLabelAssigned = (labelId: number) => assignedLabels.value.some(l => l.id === labelId);
const toggleLabel = async (label: any) => {
  if (isLabelAssigned(label.id)) {
    await removeLabel(label.id);
  } else {
    try {
      await api.post(`/leads/${props.lead.id}/labels`, { label_id: label.id });
      assignedLabels.value.push(label);
      emit('updated');
    } catch (e) { console.error(e); }
  }
};
const removeLabel = async (labelId: number) => {
  try {
    await api.delete(`/leads/${props.lead.id}/labels/${labelId}`);
    assignedLabels.value = assignedLabels.value.filter(l => l.id !== labelId);
    emit('updated');
  } catch (e) { console.error(e); }
};

// Checklist functions
const addChecklist = async () => {
  try {
    const res = await api.post(`/leads/${props.lead.id}/checklists`, { title: 'Checklist' });
    checklists.value.push({ ...res.data, items: [] });
  } catch (e) { console.error(e); }
};
const deleteChecklist = async (id: number) => {
  try {
    await api.delete(`/leads/checklists/${id}`);
    checklists.value = checklists.value.filter(c => c.id !== id);
    emit('updated');
  } catch (e) { console.error(e); }
};
const addCheckItem = async (cl: any) => {
  const text = newItemTexts.value[cl.id]?.trim();
  if (!text) return;
  try {
    const res = await api.post(`/leads/checklists/${cl.id}/items`, { text });
    cl.items.push(res.data);
    newItemTexts.value[cl.id] = '';
    emit('updated');
  } catch (e) { console.error(e); }
};
const toggleCheckItem = async (item: any) => {
  item.is_checked = item.is_checked ? 0 : 1;
  try {
    await api.patch(`/leads/checklists/items/${item.id}`, { is_checked: item.is_checked });
    emit('updated');
  } catch (e) { item.is_checked = item.is_checked ? 0 : 1; }
};
const deleteCheckItem = async (itemId: number, cl: any) => {
  try {
    await api.delete(`/leads/checklists/items/${itemId}`);
    cl.items = cl.items.filter((i: any) => i.id !== itemId);
    emit('updated');
  } catch (e) { console.error(e); }
};
const checklistPct = (cl: any) => {
  if (!cl.items?.length) return 0;
  return Math.round((cl.items.filter((i: any) => i.is_checked).length / cl.items.length) * 100);
};

// Due date
const saveDueDate = async () => {
  try {
    await api.patch(`/leads/${props.lead.id}/due-date`, { due_date: dueDateValue.value || null });
    props.lead.due_date = dueDateValue.value;
    showDueDatePicker.value = false;
    emit('updated');
  } catch (e) { console.error(e); }
};
const removeDueDate = async () => {
  dueDateValue.value = '';
  await saveDueDate();
};

// Description
const saveDescription = async () => {
  try {
    await api.patch(`/leads/${props.lead.id}/description`, { description: descValue.value });
    props.lead.description = descValue.value;
    editingDesc.value = false;
  } catch (e) { console.error(e); }
};

// Assignment (multi)
const getUserName = (uid: number) => {
  const u = users.value.find(u => u.id === uid);
  return u?.full_name || u?.name || `User #${uid}`;
};

const saveAssignment = async () => {
  try {
    const res = await api.patch(`/leads/${props.lead.id}/assign`, { assigned_to: assignedUserIds.value });
    props.lead.assignees = res.data.assignees || [];
    props.lead.assigned_to = assignedUserIds.value.length > 0 ? assignedUserIds.value[0] : null;
    const u = users.value.find(u => u.id === props.lead.assigned_to);
    props.lead.assigned_name = u?.full_name || u?.name || null;
    emit('updated');
  } catch (e) { console.error(e); }
};

const removeAssignee = async (uid: number) => {
  assignedUserIds.value = assignedUserIds.value.filter(id => id !== uid);
  await saveAssignment();
};

// Comments
const postComment = async () => {
  if (!newComment.value.trim()) return;
  try {
    const res = await api.post(`/leads/${props.lead.id}/comments`, { content: newComment.value });
    comments.value.push(res.data);
    newComment.value = '';
    emit('updated');
  } catch (e) { console.error(e); }
};
const deleteComment = async (id: number) => {
  try {
    await api.delete(`/leads/comments/${id}`);
    comments.value = comments.value.filter(c => c.id !== id);
    emit('updated');
  } catch (e) { console.error(e); }
};

// Attachments
const uploadFile = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  uploading.value = true;
  try {
    const fd = new FormData();
    fd.append('file', file);
    const res = await api.post(`/leads/${props.lead.id}/attachments`, fd);
    attachments.value.unshift(res.data);
    emit('updated');
  } catch (err) { console.error(err); alert('Upload failed'); }
  finally { uploading.value = false; (e.target as HTMLInputElement).value = ''; }
};
const deleteAttachment = async (id: number) => {
  try {
    await api.delete(`/leads/attachments/${id}`);
    attachments.value = attachments.value.filter(a => a.id !== id);
    emit('updated');
  } catch (e) { console.error(e); }
};

// Helpers
// reads the Lead's own currency instead of assuming IDR (Review.md P0-2)
const formatNumber = (n: number, currency = 'IDR') => currency === 'USD'
  ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n || 0)
  : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);
const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
const timeAgo = (d: string) => {
  if (!d) return '';
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};
const initials = (name: string) => name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';
const avatarColors = ['bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700', 'bg-green-100 text-green-700', 'bg-pink-100 text-pink-700', 'bg-orange-100 text-orange-700'];
const avatarColor = (name: string) => { const h = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0); return avatarColors[h % avatarColors.length]; };
const actionIcon = (a: string) => { const m: Record<string,string> = { created: '✨', updated: '✏️', stage_changed: '📊', assigned: '👤', due_date_set: '📅', attachment_added: '📎', converted: '🔄' }; return m[a] || '📝'; };
const fileIcon = (t: string) => { const m: Record<string,string> = { pdf: 'PDF', image: 'IMG', excel: 'XLS', word: 'DOC' }; return m[t] || 'FILE'; };
const fileIconClass = (t: string) => { const m: Record<string,string> = { pdf: 'bg-red-100 text-red-600', image: 'bg-green-100 text-green-600', excel: 'bg-emerald-100 text-emerald-600', word: 'bg-blue-100 text-blue-600' }; return m[t] || 'bg-gray-100 text-gray-600'; };
const formatFileSize = (b: number) => { if (!b) return ''; if (b < 1024) return b + 'B'; if (b < 1048576) return (b/1024).toFixed(1) + 'KB'; return (b/1048576).toFixed(1) + 'MB'; };

try {
  const userStr = localStorage.getItem('user');
  if (userStr) { const u = JSON.parse(userStr); currentUserInitials.value = initials(u.full_name || u.name || 'ME'); }
} catch {}
</script>

<style scoped>
.slide-enter-active, .slide-leave-active { transition: all 0.3s ease; }
.slide-enter-from .relative, .slide-leave-to .relative { transform: translateX(100%); }
.slide-enter-from .absolute, .slide-leave-to .absolute { opacity: 0; }
</style>
