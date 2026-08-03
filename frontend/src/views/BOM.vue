<template>
  <div class="-m-4 md:-m-8">
    <div class="px-4 md:px-6 py-4">
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-bold text-slate-800 tracking-tight">Bill of Materials</h1>
          <p class="text-sm text-slate-500 mt-0.5">{{ filteredBoms.length.toLocaleString() }} BOMs from {{ store.boms.length.toLocaleString() }} total</p>
        </div>
        <div class="flex gap-2">
          <button @click="handleExport" class="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm shadow-sm transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            Export CSV
          </button>
          <button @click="openCreateModal" class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm shadow-sm transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            Create BOM
          </button>
        </div>
      </div>

      <!-- Search & Filter Bar -->
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-5">
        <div class="flex flex-wrap gap-3 items-center">
          <div class="flex-1 min-w-[200px] relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input v-model="searchQuery" type="text" placeholder="Search BOM code, product name, process..." class="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition" />
          </div>
          <select v-model="filterSource" class="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 min-w-[130px]">
            <option value="">All Sources</option>
            <option value="ERP">ERP</option>
            <option value="JBOX">JBox</option>
          </select>
          <select v-model="filterProcess" class="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 min-w-[180px]">
            <option value="">All Process Types</option>
            <option v-for="p in processTypes" :key="p" :value="p">{{ p }}</option>
          </select>
          <select v-model="filterStatus" class="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 min-w-[150px]">
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button v-if="searchQuery || filterSource || filterProcess || filterStatus" @click="clearFilters" class="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition">
            ✕ Clear
          </button>
        </div>
      </div>

      <!-- Loading / Error -->
      <div v-if="store.loading" class="flex items-center justify-center py-20">
        <div class="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
        <span class="ml-3 text-slate-500">Loading BOMs...</span>
      </div>
      <div v-else-if="store.error" class="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl mb-4 flex items-center gap-2">
        <svg class="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>
        {{ store.error }}
      </div>

      <!-- BOM Table -->
      <div v-else class="bg-white shadow-sm border-y border-slate-200 overflow-hidden -mx-4 md:-mx-6">
        <div class="overflow-x-auto">
          <table class="w-full text-left" style="min-width: 1100px;">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200">
                <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">BOM Code</th>
                <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Product Name</th>
                <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap text-right">Batch Qty</th>
                <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Unit</th>
                <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Process Type</th>
                <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Production Line</th>
                <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap text-center">Source</th>
                <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap text-center">Status</th>
                <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="bom in paginatedBoms" :key="bom.id" class="hover:bg-indigo-50/40 transition-colors cursor-pointer group" @click="openEditModal(bom.id)">
                <td class="px-4 py-3 whitespace-nowrap">
                  <span class="text-sm font-mono text-indigo-600 font-medium">{{ bom.bom_code || '-' }}</span>
                </td>
                <td class="px-4 py-3">
                  <div class="text-sm font-medium text-slate-800 leading-tight" :title="bom.product_name">{{ bom.product_name }}</div>
                  <div v-if="bom.version" class="text-xs text-slate-400 mt-0.5">v{{ bom.version }}</div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-right">
                  <span class="text-sm font-semibold text-slate-700">{{ bom.qty ? Number(bom.qty).toLocaleString() : '-' }}</span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <span class="text-sm text-slate-600">{{ bom.unit || '-' }}</span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <span class="text-sm text-slate-600">{{ bom.process_type || '-' }}</span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <span class="text-sm text-slate-500">{{ bom.production_line || '-' }}</span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-center">
                  <span :class="getSourceClass(bom.source)" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold">
                    {{ bom.source || 'ERP' }}
                  </span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-center">
                  <span :class="getApprovalStatusClass(bom.approval_status || 0)" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold">
                    {{ getApprovalStatusText(bom.approval_status || 0) }}
                  </span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-right" @click.stop>
                  <div class="flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                    <button @click="openEditModal(bom.id)" class="p-1.5 rounded-md hover:bg-indigo-100 text-indigo-600 transition" :title="(bom.approval_status || 0) >= 2 ? 'View' : 'Edit'">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                    </button>
                    <button 
                      v-if="(bom.approval_status || 0) < 2 && canApprove(bom.approval_status || 0)"
                      @click="approveBOM(bom.id)" 
                      class="p-1.5 rounded-md hover:bg-green-100 text-green-600 transition" title="Approve"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                    </button>
                    <button 
                      v-if="(bom.approval_status || 0) >= 2 && (authStore.user?.user_level ?? 0) >= 3"
                      @click="reopenBOM(bom.id)" 
                      class="p-1.5 rounded-md hover:bg-amber-100 text-amber-600 transition" title="Reopen"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    </button>
                    <button 
                      @click="deleteBOM(bom.id)" 
                      class="p-1.5 rounded-md hover:bg-red-100 text-red-500 transition" title="Delete"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="paginatedBoms.length === 0">
                <td colspan="9" class="px-4 py-12 text-center text-slate-400">
                  <svg class="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                  No BOMs found matching your filters
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- Pagination -->
        <div v-if="totalPages > 1" class="px-5 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div class="text-sm text-slate-500">
            Showing <span class="font-medium text-slate-700">{{ ((currentPage - 1) * pageSize) + 1 }}</span> - <span class="font-medium text-slate-700">{{ Math.min(currentPage * pageSize, filteredBoms.length) }}</span> of <span class="font-medium text-slate-700">{{ filteredBoms.length.toLocaleString() }}</span>
          </div>
          <div class="flex items-center gap-1">
            <button @click="currentPage = 1" :disabled="currentPage === 1" class="px-2.5 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition bg-white">«</button>
            <button @click="currentPage = Math.max(1, currentPage - 1)" :disabled="currentPage === 1" class="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition bg-white">‹ Prev</button>
            <span class="px-3 py-1.5 text-sm font-medium text-slate-700">{{ currentPage }} / {{ totalPages }}</span>
            <button @click="currentPage = Math.min(totalPages, currentPage + 1)" :disabled="currentPage === totalPages" class="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition bg-white">Next ›</button>
            <button @click="currentPage = totalPages" :disabled="currentPage === totalPages" class="px-2.5 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition bg-white">»</button>
          </div>
        </div>
      </div>
    </div>

    <!-- BOM Create/Edit Modal (Full Page Overlay) -->
    <div v-if="showModal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto">
      <div class="bg-white w-full max-w-6xl my-4 mx-4 rounded-2xl shadow-2xl flex flex-col max-h-[95vh]">
        <!-- Modal Header -->
        <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white rounded-t-2xl flex-shrink-0">
          <div class="flex items-center gap-3">
            <h2 class="text-xl font-bold text-slate-800">
              {{ isEditing ? (isFullyApproved ? 'View BOM' : 'Edit BOM') : 'Create New BOM' }}
            </h2>
            <span v-if="isFullyApproved" class="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-semibold">
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
              Approved — Read Only
            </span>
            <span v-if="bomHeader.source === 'JBOX'" class="inline-flex items-center gap-1 bg-violet-100 text-violet-700 px-2.5 py-1 rounded-full text-xs font-semibold">JBox Import</span>
          </div>
          <button @click="closeModal" class="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <!-- BOM HEADER -->
          <div class="bg-slate-50 rounded-xl p-5 border border-slate-200">
            <h3 class="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">BOM Header Information</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1.5">BOM Code</label>
                <input v-model="bomHeader.bom_code" type="text" placeholder="e.g. 31100209001" :disabled="isFullyApproved"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-500 transition" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1.5">Product (FG) <span class="text-red-400">*</span></label>
                <select v-model="bomHeader.product_id" :disabled="isFullyApproved" @change="onBomProductChange"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 transition">
                  <option value="">-- Select Product --</option>
                  <option v-for="product in finishedGoodProducts" :key="product.id" :value="product.id">{{ product.name }} ({{ product.sku }})</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1.5">Product Name <span class="text-red-400">*</span></label>
                <input v-model="bomHeader.product_name" type="text" placeholder="e.g. Methomyl 45 WP (formulation)" :disabled="isFullyApproved"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500 transition" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1.5">Qty / Batch</label>
                <input v-model="bomHeader.qty" type="text" placeholder="e.g. 1000" :disabled="isFullyApproved"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500 transition" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1.5">Unit</label>
                <input v-model="bomHeader.unit" type="text" placeholder="e.g. Kg, Ltr" :disabled="isFullyApproved"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500 transition" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1.5">Version</label>
                <input v-model="bomHeader.version" type="text" placeholder="e.g. 1" :disabled="isFullyApproved"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500 transition" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1.5">Process Type</label>
                <input v-model="bomHeader.process_type" type="text" placeholder="e.g. Formulation & Drumming" :disabled="isFullyApproved"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500 transition" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1.5">Production Line</label>
                <input v-model="bomHeader.production_line" type="text" placeholder="e.g. Methomyl Base" :disabled="isFullyApproved"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500 transition" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1.5">Notes</label>
                <input v-model="bomHeader.notes" type="text" placeholder="Any notes..." :disabled="isFullyApproved"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500 transition" />
              </div>
            </div>
          </div>

          <!-- ADD COMPONENT -->
          <div v-if="!isFullyApproved" class="bg-indigo-50/50 rounded-xl p-5 border border-indigo-200" data-component-form>
            <h3 class="text-sm font-semibold text-indigo-600 uppercase tracking-wider mb-4">Add Component</h3>
            <div class="grid grid-cols-2 md:grid-cols-6 gap-3 mb-3">
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Item Code</label>
                <input v-model="componentForm.item_code" type="text" placeholder="32200090000" class="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 transition" />
              </div>
              <div class="md:col-span-2">
                <label class="block text-xs font-medium text-slate-600 mb-1">Description <span class="text-red-400">*</span></label>
                <input v-model="componentForm.item_description" type="text" placeholder="Methomyl Technical" class="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 transition" />
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Qty <span class="text-red-400">*</span></label>
                <input v-model.number="componentForm.quantity" type="number" step="0.01" placeholder="0" class="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 transition" />
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Unit</label>
                <input v-model="componentForm.unit" type="text" placeholder="Kgs" class="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 transition" />
              </div>
              <div class="flex items-end">
                <button @click="addComponent" type="button" class="w-full bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 font-medium text-sm transition flex items-center justify-center gap-1">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                  Add
                </button>
              </div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Use Tolerance</label>
                <select v-model="componentForm.use_tolerance" class="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">% Tolerance</label>
                <input v-model.number="componentForm.pct_tolerance" type="number" step="0.01" placeholder="0" class="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm transition" />
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Tol. Value</label>
                <input v-model.number="componentForm.tolerance_value" type="number" step="0.01" placeholder="0" class="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm transition" />
              </div>
              <div class="md:col-span-2">
                <label class="block text-xs font-medium text-slate-600 mb-1">Remark</label>
                <input v-model="componentForm.remark" type="text" placeholder="..." class="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm transition" />
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Link Product</label>
                <select v-model="componentForm.component_id" class="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm bg-white" @change="onComponentProductChange">
                  <option value="">-- Optional --</option>
                  <option v-for="product in productStore.products" :key="product.id" :value="product.id">{{ product.name }}</option>
                </select>
              </div>
            </div>
          </div>

          <!-- COMPONENTS TABLE -->
          <div v-if="bomComponents.length > 0" class="rounded-xl border border-slate-200 overflow-hidden">
            <div class="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 class="text-sm font-semibold text-slate-600 uppercase tracking-wider">Components <span class="text-indigo-600">({{ bomComponents.length }})</span></h3>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-left">
                <thead>
                  <tr class="bg-slate-50/50 border-b border-slate-100">
                    <th class="px-4 py-2.5 text-xs font-semibold text-slate-500 w-10">#</th>
                    <th class="px-4 py-2.5 text-xs font-semibold text-slate-500">Item Code</th>
                    <th class="px-4 py-2.5 text-xs font-semibold text-slate-500">Description</th>
                    <th class="px-4 py-2.5 text-xs font-semibold text-slate-500 text-right">Qty</th>
                    <th class="px-4 py-2.5 text-xs font-semibold text-slate-500">Unit</th>
                    <th class="px-4 py-2.5 text-xs font-semibold text-slate-500 text-center">Tolerance</th>
                    <th class="px-4 py-2.5 text-xs font-semibold text-slate-500">Remark</th>
                    <th v-if="!isFullyApproved" class="px-4 py-2.5 text-xs font-semibold text-slate-500 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr v-for="(comp, idx) in bomComponents" :key="idx" class="hover:bg-slate-50/70 transition-colors">
                    <td class="px-4 py-2.5 text-sm text-slate-400">{{ idx + 1 }}</td>
                    <td class="px-4 py-2.5 whitespace-nowrap"><span class="text-sm font-mono text-slate-600">{{ comp.item_code || '-' }}</span></td>
                    <td class="px-4 py-2.5">
                      <span class="text-sm text-slate-800 max-w-sm block truncate" :title="comp.item_description">{{ comp.item_description || getProductName(comp.component_id) }}</span>
                    </td>
                    <td class="px-4 py-2.5 whitespace-nowrap text-right"><span class="text-sm font-medium text-slate-700">{{ comp.quantity }}</span></td>
                    <td class="px-4 py-2.5 whitespace-nowrap"><span class="text-sm text-slate-600">{{ comp.unit || '-' }}</span></td>
                    <td class="px-4 py-2.5 whitespace-nowrap text-center">
                      <span v-if="comp.use_tolerance === 'Yes'" class="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{{ comp.pct_tolerance }}% / {{ comp.tolerance_value }}</span>
                      <span v-else class="text-xs text-slate-400">-</span>
                    </td>
                    <td class="px-4 py-2.5 text-sm text-slate-500 max-w-[150px] truncate">{{ comp.remark || '-' }}</td>
                    <td v-if="!isFullyApproved" class="px-4 py-2.5 whitespace-nowrap text-right">
                      <div class="flex items-center justify-end gap-1">
                        <button @click="editComponent(idx)" class="p-1 rounded hover:bg-indigo-100 text-indigo-600 transition" title="Edit">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button @click="removeComponent(idx)" class="p-1 rounded hover:bg-red-100 text-red-500 transition" title="Delete">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <!-- Approval -->
          <div v-if="isEditing && editingBomId" class="bg-slate-50 rounded-xl p-5 border border-slate-200">
            <h3 class="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Approval Status</h3>
            <div class="grid grid-cols-2 gap-4">
              <div class="border rounded-lg p-3 transition" :class="Number(currentBOMApprovalStatus) >= 1 ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'">
                <div class="text-xs text-slate-500 mb-1">Supervisor (Level 1)</div>
                <div v-if="Number(currentBOMApprovalStatus) >= 1" class="text-sm font-semibold text-emerald-700 flex items-center gap-1">
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                  Approved
                </div>
                <div v-else class="text-sm text-amber-600">⏳ Pending</div>
              </div>
              <div class="border rounded-lg p-3 transition" :class="Number(currentBOMApprovalStatus) >= 2 ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'">
                <div class="text-xs text-slate-500 mb-1">Manager / Director (Level 2)</div>
                <div v-if="Number(currentBOMApprovalStatus) >= 2" class="text-sm font-semibold text-emerald-700 flex items-center gap-1">
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                  Approved
                </div>
                <div v-else class="text-sm text-amber-600">⏳ Pending</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="px-6 py-4 border-t border-slate-200 flex justify-between items-center bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <div class="flex gap-2">
            <button 
              v-if="isEditing && editingBomId && (currentBOMApprovalStatus || 0) < 2 && canApprove(currentBOMApprovalStatus || 0)"
              @click="approveBOM(editingBomId)" 
              class="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium text-sm transition"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
              Approve
            </button>
            <button 
              v-if="isEditing && editingBomId && (currentBOMApprovalStatus || 0) >= 2 && (authStore.user?.user_level ?? 0) >= 3"
              @click="reopenBOM(editingBomId)" 
              class="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium text-sm transition"
            >Reopen</button>
            <button 
              v-if="isEditing && editingBomId && (currentBOMApprovalStatus || 0) !== -1 && (currentBOMApprovalStatus || 0) < 2 && (authStore.user?.user_level ?? 0) >= 2"
              @click="rejectBOM(editingBomId)" 
              class="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium text-sm transition"
            >Reject</button>
          </div>
          <div class="flex gap-2">
            <button @click="closeModal" class="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm transition">
              {{ isFullyApproved ? 'Close' : 'Cancel' }}
            </button>
            <button 
              v-if="!isFullyApproved"
              @click="saveBOM" 
              :disabled="!canSave"
              class="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg font-medium text-sm transition"
              :class="canSave ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm' : 'bg-slate-200 text-slate-400 cursor-not-allowed'"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
              {{ isEditing ? 'Update BOM' : 'Save BOM' }}
            </button>
            <div v-if="isFullyApproved" class="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg>
              Locked
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { exportToCSV } from '../utils/export';
import { ref, computed, onMounted, watch } from 'vue';
import { useBOMStore } from '../stores/bom';
import { useProductStore } from '../stores/products';
import { useAuthStore } from '../stores/auth';
import { useApprovalWorkflow } from '../composables/useApprovalWorkflow';
import { api } from '../lib/api';

const store = useBOMStore();
const productStore = useProductStore();
const authStore = useAuthStore();
const { getApprovalStatusText, getApprovalStatusClass } = useApprovalWorkflow('master_data.bom');

const showModal = ref(false);
const isEditing = ref(false);
const editingBomId = ref<number | null>(null);
const currentBOMApprovalStatus = ref<number | null>(null);

// Search & Filter
const searchQuery = ref('');
const filterSource = ref('');
const filterProcess = ref('');
const filterStatus = ref('');
const currentPage = ref(1);
const pageSize = 50;

const getSourceClass = (source: string | undefined) => {
  if (source === 'JBOX') return 'bg-violet-100 text-violet-700';
  return 'bg-sky-100 text-sky-700';
};

const clearFilters = () => {
  searchQuery.value = '';
  filterSource.value = '';
  filterProcess.value = '';
  filterStatus.value = '';
};

const processTypes = computed(() => {
  const types = new Set<string>();
  store.boms.forEach((b: any) => { if (b.process_type) types.add(b.process_type); });
  return Array.from(types).sort();
});

const filteredBoms = computed(() => {
  let result = store.boms;
  const q = searchQuery.value.toLowerCase().trim();
  if (q) {
    result = result.filter((b: any) =>
      (b.product_name || '').toLowerCase().includes(q) ||
      (b.bom_code || '').toLowerCase().includes(q) ||
      (b.process_type || '').toLowerCase().includes(q) ||
      (b.production_line || '').toLowerCase().includes(q)
    );
  }
  if (filterSource.value) {
    result = result.filter((b: any) => (b.source || 'ERP') === filterSource.value);
  }
  if (filterProcess.value) {
    result = result.filter((b: any) => b.process_type === filterProcess.value);
  }
  if (filterStatus.value) {
    result = result.filter((b: any) => {
      const s = b.approval_status || 0;
      if (filterStatus.value === 'pending') return s >= 0 && s < 2;
      if (filterStatus.value === 'approved') return s >= 2;
      if (filterStatus.value === 'rejected') return s === -1;
      return true;
    });
  }
  return result;
});

const totalPages = computed(() => Math.max(1, Math.ceil(filteredBoms.value.length / pageSize)));
const paginatedBoms = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredBoms.value.slice(start, start + pageSize);
});

watch([searchQuery, filterSource, filterProcess, filterStatus], () => { currentPage.value = 1; });

// BOM Header Form
const bomHeader = ref({
  product_id: '' as string | number,
  product_name: '',
  bom_code: '',
  qty: '',
  unit: '',
  version: '1',
  process_type: '',
  production_line: '',
  notes: '',
  source: 'ERP',
});

const finishedGoodProducts = computed(() => {
  return productStore.products.filter(p => {
    if (!p.category) return true;
    const cat = p.category.toLowerCase();
    return !cat.includes('raw') && !cat.includes('packaging') && !cat.includes('consumable');
  });
});

const onBomProductChange = () => {
  const pid = bomHeader.value.product_id;
  const product = productStore.products.find(p => p.id == pid);
  if (product && !bomHeader.value.product_name) {
    bomHeader.value.product_name = product.name;
  }
};

// Component Form
const componentForm = ref({
  component_id: '',
  item_code: '',
  item_description: '',
  quantity: 0,
  unit: '',
  use_tolerance: 'No',
  pct_tolerance: 0,
  tolerance_value: 0,
  remark: '',
});

const onComponentProductChange = () => {
  const pid = componentForm.value.component_id;
  if (!pid) return;
  const product = productStore.products.find(p => String(p.id) === String(pid));
  if (product) {
    if (!componentForm.value.item_description) componentForm.value.item_description = product.name;
    if (!componentForm.value.item_code) componentForm.value.item_code = product.sku || '';
  }
};

const bomComponents = ref<any[]>([]);

const canSave = computed(() => {
  return bomHeader.value.product_name && 
         bomComponents.value.length > 0 &&
         currentBOMApprovalStatus.value !== 2;
});

const isFullyApproved = computed(() => {
  return currentBOMApprovalStatus.value === 2;
});

const resetComponentForm = () => {
  componentForm.value = { component_id: '', item_code: '', item_description: '', quantity: 0, unit: '', use_tolerance: 'No', pct_tolerance: 0, tolerance_value: 0, remark: '' };
};

const openCreateModal = () => {
  if (productStore.products.length === 0) productStore.fetchProducts();
  isEditing.value = false;
  currentBOMApprovalStatus.value = null;
  bomHeader.value = { product_id: '', product_name: '', bom_code: '', qty: '', unit: '', version: '1', process_type: '', production_line: '', notes: '', source: 'ERP' };
  resetComponentForm();
  bomComponents.value = [];
  showModal.value = true;
};

const openEditModal = async (bomId: string | number) => {
  try {
    const response = await api.get(`/bom/${bomId}`);
    const bomData = response.data.data;
    bomHeader.value = {
      product_id: bomData.product_id || '', product_name: bomData.product_name,
      bom_code: bomData.bom_code || '', qty: bomData.qty || '', unit: bomData.unit || '',
      version: bomData.version || '1', process_type: bomData.process_type || '',
      production_line: bomData.production_line || '', notes: bomData.notes || '', source: bomData.source || 'ERP',
    };
    bomComponents.value = (bomData.details || []).map((d: any) => ({
      component_id: d.raw_material_id || '', item_code: d.item_code || d.material_sku || '',
      item_description: d.item_description || d.material_name || '', quantity: d.quantity,
      unit: d.detail_unit || d.unit_code || '', use_tolerance: d.use_tolerance || 'No',
      pct_tolerance: d.pct_tolerance || 0, tolerance_value: d.tolerance_value || 0,
      remark: d.remark || '', raw_material_id: d.raw_material_id || 0, unit_of_measure_id: d.unit_of_measure_id || null,
    }));
    editingBomId.value = Number(bomId);
    currentBOMApprovalStatus.value = bomData.approval_status || 0;
    isEditing.value = true;
    showModal.value = true;
  } catch (error) {
    console.error('Error loading BOM:', error);
    alert('Failed to load BOM');
  }
};

const closeModal = () => { showModal.value = false; currentBOMApprovalStatus.value = null; editingBomId.value = null; isEditing.value = false; };

const canApprove = (approvalStatus: number) => {
  const level = authStore.user?.user_level || 1;
  if (level >= 4) return approvalStatus < 2;
  if (level === 2 && approvalStatus === 0) return true;
  if (level === 3 && approvalStatus === 1) return true;
  return false;
};

const approveBOM = async (bomId: number | string) => {
  if (!confirm('Approve this BOM?')) return;
  try {
    const res = await api.post(`/bom/${bomId}/approve`);
    alert(res.data.message);
    await store.fetchBOMs();
    if (showModal.value && editingBomId.value) currentBOMApprovalStatus.value = res.data.approval_status;
  } catch (error: any) { alert(error.response?.data?.error || 'Failed to approve BOM'); }
};

const reopenBOM = async (bomId: number | string) => {
  if (!confirm('Reopen this BOM for editing?')) return;
  try {
    await api.post(`/bom/${bomId}/reject`);
    alert('BOM reopened'); await store.fetchBOMs();
    if (showModal.value && editingBomId.value) currentBOMApprovalStatus.value = 0;
  } catch (error: any) { alert(error.response?.data?.error || 'Failed to reopen BOM'); }
};

const rejectBOM = async (bomId: number | string) => {
  if (!confirm('Reject this BOM?')) return;
  try {
    const res = await api.post(`/bom/${bomId}/reject`);
    alert(res.data.message); await store.fetchBOMs();
    if (showModal.value && editingBomId.value) currentBOMApprovalStatus.value = res.data.approval_status;
  } catch (error: any) { alert(error.response?.data?.error || 'Failed to reject BOM'); }
};

const addComponent = () => {
  if (!componentForm.value.item_description || componentForm.value.quantity <= 0) {
    alert('Please fill Description and Qty'); return;
  }
  bomComponents.value.push({
    component_id: componentForm.value.component_id || '', item_code: componentForm.value.item_code,
    item_description: componentForm.value.item_description, quantity: componentForm.value.quantity,
    unit: componentForm.value.unit, use_tolerance: componentForm.value.use_tolerance,
    pct_tolerance: componentForm.value.pct_tolerance, tolerance_value: componentForm.value.tolerance_value,
    remark: componentForm.value.remark, raw_material_id: componentForm.value.component_id ? Number(componentForm.value.component_id) : 0,
  });
  resetComponentForm();
};

const removeComponent = (index: number) => { bomComponents.value.splice(index, 1); };

const editComponent = (index: number) => {
  const comp = bomComponents.value[index];
  componentForm.value = {
    component_id: comp.component_id || '', item_code: comp.item_code || '', item_description: comp.item_description || '',
    quantity: comp.quantity, unit: comp.unit || '', use_tolerance: comp.use_tolerance || 'No',
    pct_tolerance: comp.pct_tolerance || 0, tolerance_value: comp.tolerance_value || 0, remark: comp.remark || '',
  };
  const formSection = document.querySelector('[data-component-form]');
  if (formSection) formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  bomComponents.value.splice(index, 1);
};

const saveBOM = async () => {
  try {
    if (!bomHeader.value.product_name) { alert('Please enter product name'); return; }
    if (bomComponents.value.length === 0) { alert('Please add at least one component'); return; }
    const details = bomComponents.value.map(comp => ({
      raw_material_id: comp.raw_material_id || (comp.component_id ? Number(comp.component_id) : 0),
      item_code: comp.item_code || null, item_description: comp.item_description || null,
      quantity: Number(comp.quantity), unit: comp.unit || null, unit_of_measure_id: comp.unit_of_measure_id || null,
      use_tolerance: comp.use_tolerance || 'No', pct_tolerance: comp.pct_tolerance || 0,
      tolerance_value: comp.tolerance_value || 0, remark: comp.remark || null,
    }));
    const bomData = {
      product_id: bomHeader.value.product_id ? Number(bomHeader.value.product_id) : null,
      product_name: bomHeader.value.product_name, bom_code: bomHeader.value.bom_code || null,
      qty: bomHeader.value.qty || null, unit: bomHeader.value.unit || null,
      process_type: bomHeader.value.process_type || null, production_line: bomHeader.value.production_line || null,
      notes: bomHeader.value.notes, details,
    };
    if (isEditing.value && editingBomId.value) await api.put(`/bom/${editingBomId.value}`, bomData);
    else await api.post('/bom', bomData);
    closeModal(); await store.fetchBOMs();
  } catch (error: any) {
    const errorMsg = error.response?.data?.error || error.message || 'Failed to save BOM';
    alert(errorMsg);
  }
};

const deleteBOM = async (bomId: string | number) => {
  if (!confirm('Delete this BOM? This action cannot be undone.')) return;
  try { await api.delete(`/bom/${bomId}`); await store.fetchBOMs(); }
  catch (error) { alert('Failed to delete BOM'); }
};

const getProductName = (productId: any) => {
  if (!productId) return '-';
  const product = productStore.products.find(p => p.id == productId);
  return product ? `${product.name} (${product.sku})` : '-';
};

onMounted(() => { store.fetchBOMs(); productStore.fetchProducts(); });
function handleExport() { exportToCSV(store.boms, 'BOM_Export'); }
</script>

<style scoped>
/* Smooth scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
</style>
