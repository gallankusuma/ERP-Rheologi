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

    <!-- Tab: Documents (Split Panel — Explorer + Preview) -->
    <div v-if="activeTab === 'documents'">
      <!-- Toolbar -->
      <div class="bg-white border rounded-t-xl px-4 py-2.5 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <button @click="docCurrentFolder = null; previewDoc = null" class="p-1.5 rounded hover:bg-gray-100" :class="!docCurrentFolder ? 'text-gray-300' : 'text-gray-600'" :disabled="!docCurrentFolder" title="Back">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div class="flex items-center text-sm">
            <button @click="docCurrentFolder = null" class="text-blue-600 hover:underline font-medium">📁 All Documents</button>
            <span v-if="docCurrentFolder" class="mx-1.5 text-gray-400">›</span>
            <span v-if="docCurrentFolder" class="text-gray-700 font-medium">{{ docFolderLabel(docCurrentFolder) }}</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <div class="flex border rounded-lg overflow-hidden">
            <button @click="docViewMode = 'grid'" class="px-2.5 py-1.5" :class="docViewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-gray-400'" title="Grid"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 16 16"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg></button>
            <button @click="docViewMode = 'list'" class="px-2.5 py-1.5 border-l" :class="docViewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-400'" title="List"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 16 16"><rect x="1" y="2" width="14" height="2" rx="0.5"/><rect x="1" y="7" width="14" height="2" rx="0.5"/><rect x="1" y="12" width="14" height="2" rx="0.5"/></svg></button>
          </div>
          <button @click="previewDoc = previewDoc ? null : previewDoc" class="px-2 py-1.5 border rounded-lg text-xs" :class="previewDoc ? 'bg-blue-50 text-blue-600 border-blue-200' : 'text-gray-400'" title="Toggle preview">👁</button>
          <span class="text-xs text-gray-400">{{ filteredDocs.length }} items</span>
          <button @click="showDocModal = true; docForm = emptyDoc()" class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 flex items-center gap-1">+ Upload</button>
        </div>
      </div>

      <!-- Split Content -->
      <div class="flex border-x border-b rounded-b-xl bg-white overflow-hidden" style="min-height:450px">
        <!-- LEFT: File Explorer -->
        <div class="flex-1 overflow-y-auto p-4" style="min-width:200px">
          <!-- Root: Folders + Recent -->
          <div v-if="!docCurrentFolder">
            <div class="text-[10px] text-gray-400 uppercase tracking-wider mb-2 font-semibold">Folders</div>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-5">
              <div v-for="f in docFolders" :key="f.id" @click="docCurrentFolder = f.id"
                class="group cursor-pointer p-3 rounded-xl border border-transparent hover:border-blue-200 hover:bg-blue-50/50 transition-all text-center">
                <div class="text-3xl mb-1">📁</div>
                <div class="text-xs font-medium text-gray-700 group-hover:text-blue-700 truncate">{{ f.label }}</div>
                <div class="text-[10px] text-gray-400">{{ f.count }} files</div>
              </div>
            </div>
            <div v-if="documents.length" class="text-[10px] text-gray-400 uppercase tracking-wider mb-2 font-semibold">Recent Files</div>
          </div>

          <!-- Files (grid or list) -->
          <div v-if="docViewMode === 'grid'" :class="docCurrentFolder ? '' : ''" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            <div v-for="d in (docCurrentFolder ? filteredDocs : documents.slice(0,20))" :key="d.id"
              @click="previewDoc = d"
              class="group cursor-pointer p-3 rounded-xl border transition-all text-center relative"
              :class="previewDoc?.id === d.id ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-300' : 'border-transparent hover:border-blue-200 hover:bg-blue-50/30'">
              <div class="text-3xl mb-1">{{ fileIcon(d.file_name) }}</div>
              <div class="text-xs font-medium text-gray-700 truncate">{{ d.title }}</div>
              <div class="text-[10px] text-gray-400 truncate">{{ d.file_name || 'No file' }}</div>
              <div class="text-[9px] text-gray-300 mt-0.5">v{{ d.version }}</div>
            </div>
          </div>
          <div v-else class="space-y-0.5">
            <div class="flex items-center gap-3 px-3 py-1 text-[10px] text-gray-400 uppercase tracking-wider font-medium border-b mb-1">
              <span class="w-6"></span><span class="flex-1">Name</span><span class="w-16 text-right">Type</span><span class="w-16 text-right">Version</span><span class="w-20 text-right">Date</span>
            </div>
            <div v-for="d in (docCurrentFolder ? filteredDocs : documents.slice(0,20))" :key="d.id"
              @click="previewDoc = d"
              class="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors"
              :class="previewDoc?.id === d.id ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-gray-50'">
              <span class="text-lg w-6">{{ fileIcon(d.file_name) }}</span>
              <div class="flex-1 min-w-0"><div class="text-sm font-medium text-gray-700 truncate">{{ d.title }}</div><div class="text-[10px] text-gray-400 truncate">{{ d.file_name }}</div></div>
              <span class="text-[10px] text-gray-400 w-16 text-right">{{ d.doc_type }}</span>
              <span class="text-[10px] text-gray-400 w-16 text-right">v{{ d.version }}</span>
              <span class="text-[10px] text-gray-400 w-20 text-right">{{ formatDate(d.created_at) }}</span>
            </div>
          </div>
          <div v-if="!documents.length && !docCurrentFolder" class="text-center py-16 text-gray-300">
            <div class="text-5xl mb-3">📂</div><div class="text-sm">No documents yet</div><div class="text-xs mt-1">Click "Upload" to add files</div>
          </div>
          <div v-if="docCurrentFolder && !filteredDocs.length" class="text-center py-16 text-gray-300">
            <div class="text-4xl mb-2">📂</div><div class="text-sm">Empty folder</div>
          </div>
        </div>

        <!-- Resize Handle -->
        <div v-if="previewDoc" class="w-1.5 shrink-0 cursor-col-resize bg-gray-200 hover:bg-blue-400 active:bg-blue-500 transition-colors relative group" @mousedown="startResize">
          <div class="absolute inset-y-0 -left-1 -right-1"></div>
          <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-gray-400 group-hover:bg-white transition-colors"></div>
        </div>

        <!-- RIGHT: Preview Panel -->
        <div v-if="previewDoc" class="shrink-0 bg-gray-50/50 overflow-y-auto" :style="{width: previewWidth + 'px'}">
          <div class="p-5">
            <!-- Preview area -->
            <div class="bg-white border rounded-xl p-4 mb-4 text-center flex items-center justify-center" :style="{minHeight: previewWidth > 400 ? '300px' : '180px'}">
              <div v-if="isPreviewImage(previewDoc.file_name)" class="w-full">
                <img :src="apiBase + previewDoc.file_path" class="max-w-full rounded-lg mx-auto" :style="{maxHeight: (previewWidth > 500 ? 400 : 220) + 'px'}" @error="($event.target as HTMLImageElement).style.display='none'" />
              </div>
              <div v-else-if="isPreviewPdf(previewDoc.file_name)" class="w-full">
                <iframe :src="apiBase + previewDoc.file_path" class="w-full rounded-lg border-0" :style="{height: (previewWidth > 500 ? 400 : 220) + 'px'}"></iframe>
              </div>
              <div v-else class="text-center">
                <div class="text-6xl mb-3">{{ fileIcon(previewDoc.file_name) }}</div>
                <div class="text-xs text-gray-400">{{ fileExt(previewDoc.file_name) }} file</div>
              </div>
            </div>

            <!-- File info -->
            <div class="space-y-3">
              <div>
                <div class="text-lg font-semibold text-gray-800 leading-tight">{{ previewDoc.title }}</div>
                <div class="text-xs text-gray-400 mt-1 font-mono">{{ previewDoc.file_name || 'No file attached' }}</div>
              </div>

              <div class="border-t pt-3 space-y-2">
                <div class="flex justify-between text-xs"><span class="text-gray-400">Type</span><span class="px-2 py-0.5 bg-sky-100 text-sky-700 rounded font-medium">{{ docFolderLabel(previewDoc.doc_type) }}</span></div>
                <div class="flex justify-between text-xs"><span class="text-gray-400">Version</span><span class="text-gray-700 font-medium">v{{ previewDoc.version }}</span></div>
                <div class="flex justify-between text-xs"><span class="text-gray-400">Uploaded</span><span class="text-gray-700">{{ formatDate(previewDoc.created_at) }}</span></div>
                <div class="flex justify-between text-xs"><span class="text-gray-400">By</span><span class="text-gray-700">{{ previewDoc.uploader_name || '-' }}</span></div>
                <div v-if="previewDoc.description" class="pt-2 border-t">
                  <div class="text-[10px] text-gray-400 uppercase mb-1 font-medium">Description</div>
                  <p class="text-xs text-gray-600">{{ previewDoc.description }}</p>
                </div>
              </div>

              <!-- Actions -->
              <div class="flex gap-2 pt-3 border-t">
                <a v-if="previewDoc.file_path" :href="apiBase + previewDoc.file_path" target="_blank"
                  class="flex-1 py-2 bg-blue-600 text-white text-center rounded-lg text-xs font-medium hover:bg-blue-700">⬇ Download</a>
                <a v-if="previewDoc.file_path" :href="apiBase + previewDoc.file_path" target="_blank"
                  class="px-3 py-2 border rounded-lg text-xs text-gray-600 hover:bg-gray-50">Open</a>
                <button @click="deleteDoc(previewDoc.id); previewDoc = null" class="px-3 py-2 border border-red-200 rounded-lg text-xs text-red-500 hover:bg-red-50">🗑️</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab: Kanban -->
    <div v-if="activeTab === 'kanban'" class="overflow-x-auto">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-gray-800">📊 Task Board</h3>
        <div class="flex gap-2">
          <button @click="showAddKCol = true" class="px-3 py-1.5 border border-dashed rounded-lg text-xs text-gray-500 hover:border-indigo-400">+ Column</button>
          <button @click="showTaskModal = true; editingTask = null; taskForm = emptyTask()" class="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm">+ Task</button>
        </div>
      </div>
      <div class="flex gap-4 min-w-max pb-4">
        <div v-for="col in kCols" :key="col.id" class="w-[280px] shrink-0 bg-gray-50 rounded-xl border flex flex-col" @dragover.prevent="kDragOver = col.id" @drop="dropTask(col.id)">
          <div class="px-3 py-2.5 border-b flex items-center justify-between group" :style="{borderTopColor: col.color}" style="border-top:3px solid">
            <div class="flex items-center gap-2"><span class="font-semibold text-xs">{{ col.label }}</span><span class="text-[10px] bg-gray-200 rounded-full px-1.5">{{ getTaskCol(col.id).length }}</span></div>
            <button @click="removeKCol(col.id)" class="text-gray-400 hover:text-red-500 text-[10px] opacity-0 group-hover:opacity-100">✕</button>
          </div>
          <div class="flex-1 p-2 space-y-2 min-h-[80px]" :class="{'bg-indigo-50/50 ring-2 ring-indigo-300 ring-inset rounded-b-xl': kDragOver === col.id}">
            <div v-for="t in getTaskCol(col.id)" :key="t.id" class="bg-white rounded-lg border p-2.5 cursor-grab active:cursor-grabbing hover:shadow-md text-xs" draggable="true" @dragstart="kDragCard = t; ($event.target as HTMLElement).style.opacity='0.4'" @dragend="($event.target as HTMLElement).style.opacity='1'; kDragOver=null; kDragCard=null">
              <div class="font-medium text-gray-800 mb-1">{{ t.title }}</div>
              <div v-if="t.description" class="text-gray-400 text-[10px] mb-1 line-clamp-2">{{ t.description }}</div>
              <div class="flex items-center justify-between">
                <span class="px-1.5 py-0.5 rounded text-[9px] font-bold" :class="priClass(t.priority)">{{ t.priority }}</span>
                <span v-if="t.assigned_name" class="text-gray-400 text-[10px]">👤 {{ t.assigned_name }}</span>
              </div>
              <div class="flex gap-1 mt-1.5"><button @click="editTask(t)" class="text-blue-500 text-[10px]">Edit</button><button @click="deleteTask(t.id)" class="text-red-400 text-[10px]">Del</button></div>
            </div>
            <div v-if="!getTaskCol(col.id).length" class="text-center text-[10px] text-gray-300 py-6">Drop tasks here</div>
          </div>
        </div>
        <div class="w-[280px] shrink-0 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center cursor-pointer hover:border-indigo-300" @click="showAddKCol = true">
          <span class="text-xs text-gray-400">+ Add Column</span>
        </div>
      </div>
    </div>

    <!-- Task Modal -->
    <div v-if="showTaskModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div class="px-6 py-4 border-b bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-2xl"><h3 class="font-semibold">{{ editingTask ? 'Edit' : 'Add' }} Task</h3></div>
        <form @submit.prevent="submitTask" class="p-6 space-y-3">
          <div><label class="block text-xs font-medium text-gray-700 mb-1">Title *</label><input v-model="taskForm.title" required class="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="block text-xs font-medium text-gray-700 mb-1">Status</label><select v-model="taskForm.status" class="w-full px-3 py-2 border rounded-lg text-sm"><option v-for="c in kCols" :key="c.id" :value="c.id">{{ c.label }}</option></select></div>
            <div><label class="block text-xs font-medium text-gray-700 mb-1">Priority</label><select v-model="taskForm.priority" class="w-full px-3 py-2 border rounded-lg text-sm"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>
          </div>
          <div><label class="block text-xs font-medium text-gray-700 mb-1">Description</label><textarea v-model="taskForm.description" rows="2" class="w-full px-3 py-2 border rounded-lg text-sm"></textarea></div>
          <div><label class="block text-xs font-medium text-gray-700 mb-1">Due Date</label><input v-model="taskForm.due_date" type="date" class="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div class="flex justify-end gap-3 pt-3 border-t"><button type="button" @click="showTaskModal=false" class="px-4 py-2 border rounded-lg text-sm">Cancel</button><button type="submit" class="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm">Save</button></div>
        </form>
      </div>
    </div>

    <!-- Add Kanban Column Modal -->
    <div v-if="showAddKCol" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h3 class="font-semibold">Add Column</h3>
        <input v-model="newKColLabel" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Column name" />
        <div class="flex gap-2 flex-wrap"><button v-for="c in kColorOpts" :key="c" @click="newKColColor=c" class="w-7 h-7 rounded border-2" :class="newKColColor===c?'border-gray-800 scale-110':'border-transparent'" :style="{backgroundColor:c}"></button></div>
        <div class="flex justify-end gap-3"><button @click="showAddKCol=false" class="px-4 py-2 border rounded-lg text-sm">Cancel</button><button @click="addKCol" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">Add</button></div>
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
  { id: 'kanban', icon: '📊', label: 'Kanban' },
  { id: 'documents', icon: '📁', label: 'Documents' },
];

const emptyMs = () => ({ title:'', description:'', phase:'formulation_design', status:'pending', due_date:'', deliverables:'' });
const emptyDoc = () => ({ title:'', doc_type:'other', version:'1.0', description:'' });
const msForm = ref(emptyMs());
const docForm = ref(emptyDoc());

// Document Explorer state
const docViewMode = ref<'grid'|'list'>('grid');
const docCurrentFolder = ref<string|null>(null);

const docTypeLabels: Record<string, string> = {
  protocol: 'Protocols', lab_report: 'Lab Reports', certificate: 'Certificates',
  sds: 'SDS / MSDS', specification: 'Specifications', approval_letter: 'Approvals',
  photo: 'Photos', raw_data: 'Raw Data', regulatory: 'Regulatory', other: 'Other'
};
const docFolders = computed(() => {
  const types = Object.keys(docTypeLabels);
  return types.map(t => ({ id: t, label: docTypeLabels[t], count: documents.value.filter(d => d.doc_type === t).length }))
    .filter(f => f.count > 0);
});
const filteredDocs = computed(() => docCurrentFolder.value ? documents.value.filter(d => d.doc_type === docCurrentFolder.value) : documents.value);
const docFolderLabel = (id: string) => docTypeLabels[id] || id;
const fileIcon = (name: string) => {
  if (!name) return '📄';
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = { pdf:'📕', doc:'📘', docx:'📘', xls:'📗', xlsx:'📗', csv:'📗', ppt:'📙', pptx:'📙', jpg:'🖼️', jpeg:'🖼️', png:'🖼️', gif:'🖼️', svg:'🖼️', zip:'📦', rar:'📦', '7z':'📦', mp4:'🎬', avi:'🎬', mov:'🎬', txt:'📝', md:'📝' };
  return map[ext] || '📄';
};

// Preview helpers
const previewDoc = ref<any>(null);
const previewWidth = ref(360);
const isPreviewImage = (name: string) => { if(!name) return false; const e=name.split('.').pop()?.toLowerCase()||''; return ['jpg','jpeg','png','gif','svg','webp','bmp'].includes(e); };
const isPreviewPdf = (name: string) => { if(!name) return false; return name.toLowerCase().endsWith('.pdf'); };
const fileExt = (name: string) => name ? (name.split('.').pop()?.toUpperCase() || '???') : 'Unknown';

function startResize(e: MouseEvent) {
  e.preventDefault();
  const startX = e.clientX;
  const startW = previewWidth.value;
  const onMove = (ev: MouseEvent) => {
    const delta = startX - ev.clientX;
    previewWidth.value = Math.max(280, Math.min(800, startW + delta));
  };
  const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.body.style.cursor = ''; document.body.style.userSelect = ''; };
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

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
  await fetchMs(); await fetchDocs(); await fetchTasks(); loadKCols();
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

// ====== Kanban per-project ======
interface KCol { id: string; label: string; color: string; }
const KCOL_KEY = 'rnd_proj_kanban_cols';
const kDefaultCols: KCol[] = [
  { id:'todo', label:'To Do', color:'#94a3b8' },
  { id:'in_progress', label:'In Progress', color:'#3b82f6' },
  { id:'review', label:'Review', color:'#f59e0b' },
  { id:'done', label:'Done', color:'#22c55e' },
];
const kCols = ref<KCol[]>([]);
const tasks = ref<any[]>([]);
const showTaskModal = ref(false);
const showAddKCol = ref(false);
const editingTask = ref<any>(null);
const kDragCard = ref<any>(null);
const kDragOver = ref<string|null>(null);
const newKColLabel = ref('');
const newKColColor = ref('#3b82f6');
const kColorOpts = ['#94a3b8','#3b82f6','#6366f1','#8b5cf6','#ec4899','#ef4444','#f59e0b','#22c55e','#14b8a6'];

const emptyTask = () => ({ title:'', description:'', status:'todo', priority:'medium', due_date:'' });
const taskForm = ref(emptyTask());

const priClass = (p:string) => ({low:'bg-gray-100 text-gray-500',medium:'bg-blue-100 text-blue-600',high:'bg-orange-100 text-orange-600',critical:'bg-red-100 text-red-600'}[p]||'bg-gray-100');

function loadKCols() { try { const s=localStorage.getItem(KCOL_KEY); kCols.value=s?JSON.parse(s):[...kDefaultCols]; } catch { kCols.value=[...kDefaultCols]; } }
function saveKCols() { localStorage.setItem(KCOL_KEY, JSON.stringify(kCols.value)); }
const getTaskCol = (colId:string) => tasks.value.filter(t => t.status === colId);
function addKCol() { if(!newKColLabel.value.trim()) return; kCols.value.push({id:`k-${Date.now()}`,label:newKColLabel.value,color:newKColColor.value}); saveKCols(); showAddKCol.value=false; newKColLabel.value=''; }
function removeKCol(id:string) { if(kCols.value.length<=1) return; if(!confirm('Remove column?')) return; kCols.value=kCols.value.filter(c=>c.id!==id); saveKCols(); }

async function fetchTasks() { try { const r = await api.get(`/rnd/projects/${projectId}/tasks`); tasks.value = r.data.data||[]; } catch {} }
function editTask(t:any) { editingTask.value=t; taskForm.value={...t,due_date:t.due_date?.split('T')[0]||''}; showTaskModal.value=true; }
async function submitTask() {
  try {
    if(editingTask.value) await api.put(`/rnd/tasks/${editingTask.value.id}`, taskForm.value);
    else await api.post(`/rnd/projects/${projectId}/tasks`, taskForm.value);
    showTaskModal.value=false; await fetchTasks();
  } catch(e:any) { alert(e.response?.data?.error||e.message); }
}
async function deleteTask(id:number) { if(!confirm('Delete task?')) return; await api.delete(`/rnd/tasks/${id}`); await fetchTasks(); }
async function dropTask(colId:string) {
  kDragOver.value=null;
  if(!kDragCard.value || kDragCard.value.status===colId) return;
  try { await api.patch(`/rnd/tasks/${kDragCard.value.id}/status`, {status:colId}); kDragCard.value.status=colId; } catch(e:any) { alert(e.message); }
}
</script>
