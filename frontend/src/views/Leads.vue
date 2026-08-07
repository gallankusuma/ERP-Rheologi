<template>
  <div class="min-h-screen bg-gray-50">
    <div class="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <!-- Header -->
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">Leads</h1>
          <p class="text-gray-500 mt-1">Sales Pipeline & Lead Management</p>
        </div>
        <div class="flex gap-3">
          <button
            @click="viewMode = 'list'"
            :class="[viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300']"
            class="px-4 py-2 rounded-lg font-medium hover:shadow-sm transition-all"
          >
            📋 List
          </button>
          <button
            @click="viewMode = 'kanban'"
            :class="[viewMode === 'kanban' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300']"
            class="px-4 py-2 rounded-lg font-medium hover:shadow-sm transition-all"
          >
            📊 Kanban
          </button>
          <button
            @click="showStageManager = true"
            class="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 font-medium flex items-center gap-2 transition-all"
            title="Manage Pipeline Stages"
          >
            ⚙️ Stages
          </button>
          <button
            @click="openAddLeadModal()"
            class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
          >
            <span>+</span> Add Lead
          </button>
        </div>
      </div>

      <!-- List View -->
      <div v-if="viewMode === 'list'" class="space-y-4">
        <!-- Filters -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex gap-3">
          <select v-model="filterStage" class="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            <option value="">All Stages</option>
            <option v-for="s in stageNames" :key="s" :value="s">{{ s }}</option>
          </select>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search leads..."
            class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <select v-model="sortBy" class="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            <option value="created">Newest First</option>
            <option value="value-high">Highest Value</option>
            <option value="value-low">Lowest Value</option>
            <option value="updated">Recently Updated</option>
          </select>
          <label class="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white cursor-pointer select-none">
            <input type="checkbox" v-model="showArchived" @change="fetchLeads" class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            Show Archived
          </label>
        </div>

        <!-- List Table -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table class="w-full">
            <thead class="bg-gray-50 border-b border-gray-200">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-700">Company</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-700">Contact</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-700">Email</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-700">Stage</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-700">Value</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-700">Probability</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr
                v-for="lead in filteredLeads"
                :key="lead.id"
                class="hover:bg-blue-50 transition-colors cursor-pointer"
                :class="{ 'opacity-60': lead.is_archived }"
                @click="!lead.is_archived && openEditModal(lead)"
              >
                <td class="px-6 py-4">
                  <div class="flex items-center gap-2">
                    <span v-if="lead.color" class="w-3 h-3 rounded-full flex-shrink-0" :style="{ background: lead.color }"></span>
                    <p class="font-medium text-gray-900">{{ lead.company }}</p>
                    <span v-if="lead.is_archived" class="text-[10px] px-2 py-0.5 rounded bg-gray-200 text-gray-600 font-semibold">Archived</span>
                  </div>
                </td>
                <td class="px-6 py-4">
                  <p class="text-sm text-gray-600">{{ lead.contact_name }}</p>
                </td>
                <td class="px-6 py-4">
                  <p class="text-sm text-gray-600">{{ lead.email }}</p>
                </td>
                <td class="px-6 py-4">
                  <span
                    class="px-3 py-1 rounded-full text-xs font-semibold"
                    :style="{ background: (stageColorMap[lead.stage] || '#6b7280') + '20', color: stageColorMap[lead.stage] || '#6b7280' }"
                  >
                    {{ lead.stage }}
                  </span>
                </td>
                <td class="px-6 py-4">
                  <p class="font-medium text-gray-900">{{ formatNumber(lead.value) }}</p>
                </td>
                <td class="px-6 py-4">
                  <div class="flex items-center gap-2">
                    <div class="w-12 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        class="h-full rounded-full transition-all"
                        :class="getProbabilityColor(lead.probability)"
                        :style="{ width: lead.probability + '%' }"
                      ></div>
                    </div>
                    <span class="text-xs font-semibold text-gray-600">{{ lead.probability }}%</span>
                  </div>
                </td>
                <td class="px-6 py-4">
                  <div class="flex gap-2">
                    <button
                      v-if="lead.is_archived"
                      @click.stop="restoreLead(lead)"
                      class="text-green-600 hover:text-green-800 font-medium text-sm"
                    >♻️ Restore</button>
                    <template v-else>
                      <button
                        @click.stop="openEditModal(lead)"
                        class="text-blue-600 hover:text-blue-800 font-medium text-sm"
                      >Edit</button>
                      <button
                        @click.stop="deleteLead(lead.id)"
                        class="text-red-500 hover:text-red-700 font-medium text-sm"
                      >Archive</button>
                    </template>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="filteredLeads.length === 0" class="text-center py-8 text-gray-500">
            No leads found
          </div>
        </div>
      </div>

      <!-- Kanban View -->
      <div v-if="viewMode === 'kanban'" class="flex overflow-x-auto gap-4 pb-4">
        <div
          v-for="stage in stageNames"
          :key="stage"
          class="flex-shrink-0 w-80 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col max-h-[calc(100vh-200px)] transition-all"
          :class="{ 'ring-2 ring-blue-400 bg-blue-50/30': dragOverStage === stage }"
          @dragover.prevent="onDragOver(stage)"
          @dragleave="onDragLeave"
          @drop="onDrop(stage)"
        >
          <!-- Stage Header -->
          <div class="p-4 border-b rounded-t-xl" :style="{ borderBottomColor: stageColorMap[stage] || '#e5e7eb', background: (stageColorMap[stage] || '#6b7280') + '10' }">
            <div class="flex justify-between items-center">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full" :style="{ background: stageColorMap[stage] || '#6b7280' }"></span>
                <h3 class="font-semibold text-gray-800">{{ stage }}</h3>
              </div>
              <span class="text-xs font-bold bg-white px-2.5 py-1 rounded-full text-gray-600 shadow-sm">
                {{ getLeadsByStage(stage).length }}
              </span>
            </div>
            <p class="text-xs text-gray-500 mt-1">
              Total: {{ formatNumber(getTotalValueByStage(stage)) }}
            </p>
          </div>

          <!-- Lead Cards -->
          <div class="flex-1 overflow-y-auto p-3 space-y-3 min-h-[80px]">
            <div
              v-for="lead in getLeadsByStage(stage)"
              :key="lead.id"
              draggable="true"
              @dragstart="onDragStart($event, lead)"
              @dragend="onDragEnd"
              @click.stop="openDetailPanel(lead)"
              class="bg-white p-3 rounded-lg border-l-4 border border-gray-200 hover:shadow-lg transition-all cursor-pointer group relative"
              :class="{ 'opacity-40 scale-95': draggingLead?.id === lead.id }"
              :style="{ borderLeftColor: lead.color || '#e5e7eb' }"
            >
              <!-- Labels Row -->
              <div v-if="lead.labels?.length" class="flex flex-wrap gap-1 mb-2">
                <span v-for="lbl in lead.labels.slice(0, 4)" :key="lbl.id"
                  class="h-2 rounded-full w-8" :style="{ background: lbl.color }" :title="lbl.name"></span>
              </div>

              <!-- Top Row: Company + Actions -->
              <div class="flex justify-between items-start mb-1.5">
                <p class="font-semibold text-gray-800 text-sm flex-1 leading-tight">{{ lead.company }}</p>
                <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button @click.stop="openEditModal(lead)" class="text-gray-300 hover:text-blue-500 transition-colors text-xs" title="Edit">✏️</button>
                  <button @click.stop="deleteLead(lead.id)" class="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none">×</button>
                </div>
              </div>

              <!-- Contact -->
              <p class="text-xs text-gray-500 mb-2">{{ lead.contact_name }}</p>

              <!-- Value & Probability -->
              <div class="flex justify-between items-center mb-2.5 pb-2 border-b border-gray-100">
                <p class="text-sm font-bold text-gray-900">{{ formatNumber(lead.value) }}</p>
                <span class="text-xs font-semibold px-2 py-0.5 rounded" :class="getProbabilityBadge(lead.probability)">
                  {{ lead.probability }}%
                </span>
              </div>

              <!-- Due Date Badge -->
              <div v-if="lead.due_date" class="flex items-center gap-1 mb-2">
                <span class="text-[10px] px-2 py-0.5 rounded font-semibold"
                  :class="isLeadOverdue(lead.due_date) ? 'bg-red-100 text-red-700' : 'bg-yellow-50 text-yellow-700'">
                  📅 {{ formatDate(lead.due_date) }}
                </span>
              </div>

              <!-- Checklist Progress -->
              <div v-if="lead.checklist_progress?.total" class="flex items-center gap-2 mb-2">
                <div class="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div class="h-full bg-green-500 rounded-full transition-all" :style="{ width: ((lead.checklist_progress?.checked || 0) / (lead.checklist_progress?.total || 1) * 100) + '%' }"></div>
                </div>
                <span class="text-[10px] text-gray-500 font-medium">☑ {{ lead.checklist_progress?.checked || 0 }}/{{ lead.checklist_progress?.total || 0 }}</span>
              </div>

              <!-- Bottom: Source + Counts -->
              <div class="flex justify-between items-center">
                <span v-if="lead.source" class="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">{{ lead.source }}</span>
                <span v-else></span>
                <div class="flex items-center gap-2 text-[10px] text-gray-400">
                  <span v-if="lead.comment_count" title="Comments">💬 {{ lead.comment_count }}</span>
                  <span v-if="lead.attachment_count" title="Attachments">📎 {{ lead.attachment_count }}</span>
                  <span v-if="lead.assigned_name" class="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[8px] font-bold flex items-center justify-center" :title="lead.assigned_name">{{ getInitials(lead.assigned_name) }}</span>
                </div>
              </div>

              <!-- Client Link Badge -->
              <div v-if="lead.client_id" class="mt-2 flex items-center gap-1">
                <span class="text-[10px] px-2 py-0.5 rounded bg-green-50 text-green-700 font-semibold">🏢 {{ lead.client_name || 'Client #' + lead.client_id }}</span>
              </div>

              <!-- Convert to Client Button -->
              <button
                v-if="['Discussion', 'Proposal', 'Negotiation'].includes(lead.stage) && !lead.client_id"
                @click.stop="convertToClient(lead)"
                class="mt-2 w-full text-[10px] py-1.5 rounded-md bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold hover:from-green-600 hover:to-emerald-700 transition-all"
              >🔄 Convert to Client</button>
            </div>

            <!-- Drop Placeholder -->
            <div
              v-if="getLeadsByStage(stage).length === 0"
              class="text-center py-8 text-gray-400 text-xs italic border-2 border-dashed border-gray-200 rounded-lg"
            >
              {{ draggingLead ? 'Drop here' : 'No leads' }}
            </div>
          </div>
        </div>
      </div>
    </div>




    <!-- Add/Edit Lead Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showModal = false">
      <div class="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
          <h3 class="text-lg font-bold text-gray-900">{{ editingLead ? 'Edit Lead' : 'Add New Lead' }}</h3>
        </div>
        <div class="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <!-- Lead Type: explicit — a Lead is either a brand-new opportunity or tied to an
               existing Client from the start (Review.md P0 #4) -->
          <div class="bg-blue-50 rounded-lg p-3 border border-blue-100">
            <label class="block text-xs font-semibold text-blue-700 mb-2">Lead Type</label>
            <div class="flex gap-2 mb-2">
              <button type="button" @click="leadType = 'new'; formLead.client_id = null"
                class="flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-all"
                :class="leadType === 'new' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-300'"
              >🆕 New Business</button>
              <button type="button" @click="leadType = 'existing'"
                class="flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-all"
                :class="leadType === 'existing' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-300'"
              >🏢 Existing Client Opportunity</button>
            </div>
            <select
              v-if="leadType === 'existing'"
              v-model="formLead.client_id"
              @change="onClientSelect"
              class="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option :value="null">— Select a Client —</option>
              <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }} {{ c.organization ? '(' + c.organization + ')' : '' }}</option>
            </select>
            <p v-else class="text-xs text-blue-600/70">No Client yet — this Lead starts as a fresh opportunity.</p>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
              <input
                v-model="formLead.company"
                type="text"
                placeholder="Company name"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
              <input
                v-model="formLead.contact_name"
                type="text"
                placeholder="Contact name"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                v-model="formLead.email"
                type="email"
                placeholder="email@company.com"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                v-model="formLead.phone"
                type="tel"
                placeholder="Phone number"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Lead Value</label>
              <input
                v-model="formLead.value"
                type="number"
                placeholder="0"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Probability (%)</label>
              <input
                v-model="formLead.probability"
                type="number"
                min="0" max="100"
                placeholder="50"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Stage</label>
              <select v-model="formLead.stage" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option v-for="s in stageNames" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Source</label>
              <select v-model="formLead.source" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option v-for="src in sources" :key="src" :value="src">{{ src }}</option>
              </select>
            </div>
            <div class="col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                v-model="formLead.notes"
                rows="2"
                placeholder="Additional notes..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              ></textarea>
            </div>
          </div>
        </div>
        <div class="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
          <button
            @click="showModal = false"
            class="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            @click="saveLead"
            :disabled="saving"
            class="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {{ saving ? 'Saving...' : editingLead ? 'Update Lead' : 'Add Lead' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Stage Manager Modal -->
    <div v-if="showStageManager" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showStageManager = false">
      <div class="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white flex justify-between items-center">
          <h3 class="text-lg font-bold text-gray-900">⚙️ Manage Pipeline Stages</h3>
          <button @click="showStageManager = false" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <p class="px-6 pt-3 text-xs text-gray-500">The pipeline uses a fixed set of business stages for this CRM version — you can reorder them and change their colors, but not rename, add or delete them.</p>
        <div class="px-6 py-5 space-y-2 max-h-[50vh] overflow-y-auto">
          <div v-for="(stage, idx) in stagesData" :key="stage.id"
            class="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 bg-white group transition-all">
            <!-- Drag Handle -->
            <div class="flex flex-col gap-0.5 cursor-grab text-gray-300 hover:text-gray-500">
              <button @click="moveStage(idx, -1)" :disabled="idx === 0" class="text-xs leading-none disabled:opacity-20 hover:text-blue-500">▲</button>
              <button @click="moveStage(idx, 1)" :disabled="idx === stagesData.length - 1" class="text-xs leading-none disabled:opacity-20 hover:text-blue-500">▼</button>
            </div>
            <!-- Color Picker -->
            <input type="color" v-model="stage.color" @change="updateStage(stage)"
              class="w-7 h-7 rounded-full border-2 border-gray-200 cursor-pointer p-0" :title="'Stage color'" />
            <!-- Name (read-only: fixed business stage) -->
            <span class="flex-1 px-3 py-1.5 text-sm font-medium text-gray-800">{{ stage.name }}</span>
            <span class="text-gray-300 text-sm" title="Fixed business stage — cannot be renamed or deleted">🔒</span>
          </div>
          <div v-if="stagesData.length === 0" class="text-center py-6 text-gray-400 text-sm">No stages configured</div>
        </div>
      </div>
    </div>

    <!-- Loading overlay -->
    <div v-if="loading" class="fixed inset-0 bg-white/60 flex items-center justify-center z-40">
      <div class="text-center">
        <div class="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p class="mt-3 text-gray-600 text-sm">Loading leads...</p>
      </div>
    </div>

    <!-- Trello Detail Panel -->
    <LeadDetailPanel
      :lead="selectedLead"
      :visible="showDetailPanel"
      @close="showDetailPanel = false"
      @updated="fetchLeads"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api } from '../lib/api';
import LeadDetailPanel from '@/components/crm/LeadDetailPanel.vue';

interface Lead {
  id: number;
  company: string;
  contact_name: string;
  email: string;
  phone?: string;
  stage: string;
  value: number;
  probability: number;
  source: string;
  color?: string | null;
  notes?: string;
  description?: string;
  due_date?: string | null;
  created_at: string;
  updated_at?: string;
  assigned_to?: number;
  assigned_name?: string;
  client_id?: number | null;
  client_name?: string;
  converted_at?: string;
  labels?: { id: number; name: string; color: string }[];
  checklist_progress?: { total: number; checked: number };
  comment_count?: number;
  attachment_count?: number;
  is_archived?: boolean;
}

const viewMode = ref<'list' | 'kanban'>('kanban');
const filterStage = ref('');
const searchQuery = ref('');
const showArchived = ref(false);
const sortBy = ref('created');
const showModal = ref(false);
const loading = ref(false);
const saving = ref(false);
const editingLead = ref<Lead | null>(null);
const selectedLead = ref<any>({});
const showDetailPanel = ref(false);
const showStageManager = ref(false);

// Dynamic stages from API
interface StageConfig { id: number; name: string; color: string; sort_order: number; is_default: number }
const stagesData = ref<StageConfig[]>([]);
const stageNames = computed(() => stagesData.value.map(s => s.name));
const stageColorMap = computed(() => {
  const m: Record<string, string> = {};
  for (const s of stagesData.value) m[s.name] = s.color;
  return m;
});

const sources = ['Website', 'LinkedIn', 'Referral', 'Cold Call', 'Email', 'Event', 'Google', 'Facebook', 'Twitter', 'Elsewhere', 'Other'];

const emptyForm = () => ({
  company: '', contact_name: '', email: '', phone: '',
  stage: stageNames.value[0] || 'New', value: 0, probability: 10, source: 'Website',
  color: null as string | null, notes: '', client_id: null as number | null
});

const formLead = ref(emptyForm());
// explicit Lead type (Review.md P0 #4) — 'existing' requires picking a Client, 'new' keeps client_id null
const leadType = ref<'new' | 'existing'>('new');
const leads = ref<Lead[]>([]);
const clients = ref<any[]>([]);

// ========================
// Drag & Drop State
// ========================
const draggingLead = ref<Lead | null>(null);
const dragOverStage = ref<string | null>(null);

const onDragStart = (e: DragEvent, lead: Lead) => {
  draggingLead.value = lead;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(lead.id));
  }
};

const onDragEnd = () => {
  draggingLead.value = null;
  dragOverStage.value = null;
};

const onDragOver = (stage: string) => {
  dragOverStage.value = stage;
};

const onDragLeave = () => {
  dragOverStage.value = null;
};

const onDrop = async (newStage: string) => {
  dragOverStage.value = null;
  if (!draggingLead.value || draggingLead.value.stage === newStage) {
    draggingLead.value = null;
    return;
  }

  const lead = draggingLead.value;
  const oldStage = lead.stage;
  // Optimistic update
  lead.stage = newStage;
  draggingLead.value = null;

  try {
    await api.patch(`/leads/${lead.id}/stage`, { stage: newStage });
  } catch (err) {
    console.error('Failed to update stage:', err);
    lead.stage = oldStage; // rollback
  }
};



// ========================
// CRUD
// ========================
const fetchLeads = async () => {
  loading.value = true;
  try {
    const params: any = {};
    if (showArchived.value) params.show_archived = '1';
    const res = await api.get('/leads', { params });
    leads.value = res.data?.data || [];
  } catch (err) {
    console.error('Failed to fetch leads:', err);
  } finally {
    loading.value = false;
  }
};

const openAddLeadModal = () => {
  editingLead.value = null;
  formLead.value = emptyForm();
  leadType.value = 'new';
  showModal.value = true;
};

const openDetailPanel = (lead: Lead) => {
  selectedLead.value = lead;
  showDetailPanel.value = true;
};

const isLeadOverdue = (dueDate: string) => {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
};

const getInitials = (name: string) => {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
};

const openEditModal = (lead: Lead) => {
  editingLead.value = lead;
  formLead.value = {
    company: lead.company,
    contact_name: lead.contact_name || '',
    email: lead.email || '',
    phone: lead.phone || '',
    stage: lead.stage,
    value: lead.value,
    probability: lead.probability,
    source: lead.source || 'Website',
    color: lead.color || null,
    notes: lead.notes || '',
    client_id: lead.client_id || null
  };
  leadType.value = lead.client_id ? 'existing' : 'new';
  showModal.value = true;
};

const saveLead = async () => {
  if (!formLead.value.company) return;
  if (leadType.value === 'existing' && !formLead.value.client_id) {
    alert('Please select a Client for an Existing Client Opportunity.');
    return;
  }
  saving.value = true;
  try {
    if (editingLead.value) {
      await api.put(`/leads/${editingLead.value.id}`, formLead.value);
    } else {
      await api.post('/leads', formLead.value);
    }
    showModal.value = false;
    await fetchLeads();
  } catch (err) {
    console.error('Save error:', err);
    alert('Failed to save lead');
  } finally {
    saving.value = false;
  }
};

const deleteLead = async (id: number) => {
  if (!confirm('Archive this lead? You can restore it later via "Show Archived".')) return;
  try {
    await api.delete(`/leads/${id}`);
    leads.value = leads.value.filter(l => l.id !== id);
  } catch (err) {
    console.error('Archive error:', err);
  }
};

const restoreLead = async (lead: Lead) => {
  try {
    await api.patch(`/leads/${lead.id}/restore`);
    await fetchLeads();
  } catch (err) {
    console.error('Restore error:', err);
  }
};

// ========================
// Computed & Helpers
// ========================
const filteredLeads = computed(() => {
  let result = leads.value;

  if (filterStage.value) {
    result = result.filter(lead => lead.stage === filterStage.value);
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(
      lead =>
        lead.company.toLowerCase().includes(query) ||
        (lead.contact_name || '').toLowerCase().includes(query) ||
        (lead.email || '').toLowerCase().includes(query)
    );
  }

  if (sortBy.value === 'created') {
    result = [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } else if (sortBy.value === 'value-high') {
    result = [...result].sort((a, b) => b.value - a.value);
  } else if (sortBy.value === 'value-low') {
    result = [...result].sort((a, b) => a.value - b.value);
  } else if (sortBy.value === 'updated') {
    result = [...result].sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());
  }

  return result;
});

const getLeadsByStage = (stage: string) => {
  // Kanban always reflects the active pipeline — archived leads never show as cards here
  return leads.value.filter(lead => lead.stage === stage && !lead.is_archived);
};

const getTotalValueByStage = (stage: string) => {
  return getLeadsByStage(stage).reduce((sum, lead) => sum + (Number(lead.value) || 0), 0);
};


const getProbabilityColor = (probability: number) => {
  if (probability >= 80) return 'bg-green-500';
  if (probability >= 50) return 'bg-yellow-500';
  if (probability >= 20) return 'bg-orange-500';
  return 'bg-red-500';
};

const getProbabilityBadge = (probability: number) => {
  if (probability >= 80) return 'bg-green-100 text-green-800';
  if (probability >= 50) return 'bg-yellow-100 text-yellow-800';
  if (probability >= 20) return 'bg-orange-100 text-orange-800';
  return 'bg-red-100 text-red-800';
};

// matches the Rp formatting used across Prospects/Sales Order — Lead value has no currency
// field of its own (unlike Prospects), so it's always treated as IDR (Review.md P1 #10)
const formatNumber = (num: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num || 0);
};

const formatDate = (date: string) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ========================
// Client Integration
// ========================
const fetchClients = async () => {
  try {
    const res = await api.get('/clients');
    const data = res.data;
    clients.value = Array.isArray(data) ? data : (data?.data || []);
  } catch (err) {
    console.error('Failed to fetch clients:', err);
  }
};

const onClientSelect = () => {
  const cid = formLead.value.client_id;
  if (!cid) return;
  const client = clients.value.find((c: any) => c.id === cid);
  if (client) {
    formLead.value.company = client.name || client.organization || '';
    formLead.value.phone = client.phone || formLead.value.phone || '';
  }
};

const convertToClient = async (lead: Lead) => {
  // Show choice dialog
  const choice = prompt(
    `Convert "${lead.company}" to Client.\n\nChoose an option:\n1 = Convert to Client only\n2 = Convert to Client + Create Draft Sales Order\n\nEnter 1 or 2:`,
    '2'
  );
  if (!choice || !['1', '2'].includes(choice.trim())) return;

  const createSO = choice.trim() === '2';
  
  try {
    const res = await api.post(`/leads/${lead.id}/convert`, { create_so: createSO });
    if (res.data?.success) {
      let msg = `✅ Lead converted! Client ID: ${res.data.client_id}`;
      if (res.data.so_number) {
        msg += `\n📋 Sales Order ${res.data.so_number} created!`;
      }
      alert(msg);
      await fetchLeads();
    }
  } catch (err) {
    console.error('Convert error:', err);
    alert('Failed to convert lead');
  }
};

// ========================
// Stages CRUD
// ========================
const fetchStages = async () => {
  try {
    const res = await api.get('/leads/stages');
    stagesData.value = res.data?.data || [];
  } catch (err) {
    console.error('Failed to fetch stages:', err);
    // Fallback to defaults if API fails
    stagesData.value = [
      { id: 0, name: 'New', color: '#6b7280', sort_order: 0, is_default: 1 },
      { id: 0, name: 'Qualified', color: '#3b82f6', sort_order: 1, is_default: 1 },
      { id: 0, name: 'Discussion', color: '#06b6d4', sort_order: 2, is_default: 1 },
      { id: 0, name: 'Proposal', color: '#f59e0b', sort_order: 3, is_default: 1 },
      { id: 0, name: 'Negotiation', color: '#8b5cf6', sort_order: 4, is_default: 1 },
      { id: 0, name: 'Won', color: '#22c55e', sort_order: 5, is_default: 1 },
      { id: 0, name: 'Lost', color: '#ef4444', sort_order: 6, is_default: 1 },
    ];
  }
};

// only color/order are editable — stage names are fixed business stages (Review.md P0 #3)
const updateStage = async (stage: StageConfig) => {
  try {
    await api.put(`/leads/stages/${stage.id}`, { name: stage.name, color: stage.color });
  } catch (err) {
    console.error('Failed to update stage:', err);
  }
};

const moveStage = async (idx: number, direction: -1 | 1) => {
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= stagesData.value.length) return;
  const arr = [...stagesData.value];
  [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
  // Reassign sort_order
  arr.forEach((s, i) => s.sort_order = i);
  stagesData.value = arr;
  try {
    await api.put('/leads/stages/reorder', { order: arr.map(s => ({ id: s.id, sort_order: s.sort_order })) });
  } catch (err) {
    console.error('Failed to reorder stages:', err);
  }
};

onMounted(async () => {
  await fetchStages();
  fetchLeads();
  fetchClients();
});
</script>

<style scoped>
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Drag visual feedback */
[draggable="true"] {
  user-select: none;
}
[draggable="true"]:active {
  cursor: grabbing;
}
</style>
