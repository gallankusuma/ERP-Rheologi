<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header (Sticky) -->
    <div class="bg-white border-b sticky top-0 z-40 shadow-sm">
      <div class="px-6 py-4">
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-4">
              <button @click="$router.back()" class="text-gray-600 hover:text-gray-800">
                ← Back
              </button>
              <div>
                <h1 class="text-xl font-bold text-gray-800">{{ proposal?.project_name || 'Loading...' }}</h1>
                <p class="text-sm text-gray-600">
                  {{ proposal?.proposal_number }} | {{ proposal?.revision }} 
                  <span :class="statusBadgeClass" class="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold">
                    {{ proposal?.status?.toUpperCase() }}
                  </span>
                </p>
              </div>
            </div>
            <div class="mt-2 flex gap-4 text-sm text-gray-600">
              <span><strong>Client:</strong> {{ proposal?.client || '-' }}</span>
              <span><strong>Lokasi:</strong> {{ proposal?.lokasi || '-' }}</span>
            </div>
            <!-- Status Stepper -->
            <div class="mt-3 flex items-center gap-1 text-xs">
              <span v-for="(step, i) in statusSteps" :key="step.key" class="flex items-center gap-1">
                <span v-if="i > 0" class="text-gray-300 mx-1">→</span>
                <span :class="[
                  'px-2 py-0.5 rounded-full font-medium',
                  proposal?.status === step.key ? step.activeClass : 
                  statusStepIndex(proposal?.status) > i ? 'bg-gray-200 text-gray-500 line-through' :
                  'bg-gray-100 text-gray-400'
                ]">{{ step.label }}</span>
              </span>
            </div>
          </div>
          
          <div class="flex gap-2">
            <button @click="viewRAB" class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
              📋 View RAB
            </button>
            <button @click="showResume = true" class="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
              📊 Resume
            </button>
            <button class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              📥 Export Excel
            </button>
            
            <!-- Status Workflow Buttons -->
            <!-- Draft → Review -->
            <button v-if="proposal?.status === 'draft'" @click="changeStatus('review')" 
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              📤 Submit to Review
            </button>
            <!-- Review → Back to Draft -->
            <button v-if="proposal?.status === 'review'" @click="changeStatus('draft')" 
              class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              ↩ Back to Draft
            </button>
            <!-- Review → Submitted -->
            <button v-if="proposal?.status === 'review'" @click="changeStatus('submitted')" 
              class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
              📨 Submit to Client
            </button>
            <!-- Submitted → Back to Review -->
            <button v-if="proposal?.status === 'submitted'" @click="changeStatus('review')" 
              class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              ↩ Back to Review
            </button>
            <!-- Submitted → Deal -->
            <button v-if="proposal?.status === 'submitted'" @click="changeStatus('deal')" 
              class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              🤝 Deal (Kontrak)
            </button>
            <!-- Submitted → No Deal -->
            <button v-if="proposal?.status === 'submitted'" @click="changeStatus('no_deal')" 
              class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
              ✗ No Deal
            </button>
            <!-- No Deal → Re-open -->
            <button v-if="proposal?.status === 'no_deal'" @click="changeStatus('draft')" 
              class="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700">
              🔄 Re-open as Draft
            </button>
            <!-- Deal → Go to Project -->
            <router-link v-if="proposal?.status === 'deal' && proposal?.project_id" 
              :to="`/projects/${proposal.project_id}`"
              class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 inline-flex items-center">
              📂 Open Project
            </router-link>
          </div>
        </div>
      </div>
    </div>

    <div class="flex">
      <!-- Main Content Area -->
      <div class="flex-1 p-6">
        <!-- Items Table (Excel-like) -->
        <div class="bg-white rounded-lg shadow overflow-x-auto">
          <!-- Add AHSP Button -->
          <div class="p-4 border-b bg-gray-50">
            <button v-if="isEditable" @click="openAHSPModal" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              + Tambah Pekerjaan (AHSP)
            </button>
            <span v-else class="text-sm text-gray-500 italic">
              {{ proposal?.status === 'deal' ? '🔒 Proposal terkunci (Deal/Kontrak)' : '📋 Proposal sudah di-submit, tidak bisa diedit' }}
            </span>
          </div>

          <!-- Table -->
          <table class="min-w-full text-sm">
            <thead class="bg-blue-600 text-white">
              <tr>
                <th class="px-3 py-2 text-left w-12">No</th>
                <th class="px-3 py-2 text-left min-w-[150px]">Disiplin</th>
                <th class="px-3 py-2 text-left min-w-[150px]">Sub-Disiplin</th>
                <th class="px-3 py-2 text-left min-w-[200px]">Deskripsi</th>
                <th class="px-3 py-2 text-left min-w-[300px]">Uraian Pekerjaan</th>
                <th class="px-3 py-2 text-left w-32">Kode</th>
                <th class="px-3 py-2 text-right w-24">Volume</th>
                <th class="px-3 py-2 text-center w-16">Sat</th>
                <th class="px-3 py-2 text-right w-32">Harga Satuan</th>
                <th class="px-3 py-2 text-right w-32">Jumlah Harga</th>
                <th class="px-3 py-2 text-center w-28">Action</th>
              </tr>
            </thead>
            <tbody>
              <!-- Data Rows -->
              <template v-for="(item, index) in items" :key="item.id">
                <!-- Section Header Row -->
                <tr v-if="item.is_section" class="bg-blue-50 border-b-2 border-blue-200">
                  <td class="px-3 py-2 font-bold text-blue-800">{{ item.ahsp_code_snapshot }}</td>
                  <td colspan="9" class="px-3 py-2 font-bold text-blue-800 text-base uppercase">
                    {{ item.ahsp_name_snapshot }}
                  </td>
                  <td class="px-3 py-2 text-center">
                    <button v-if="isEditable" @click="deleteItem(item.id)" class="text-red-400 hover:text-red-600 text-xs" title="Hapus section">
                      🗑️
                    </button>
                  </td>
                </tr>
                <!-- Normal Item Row -->
                <tr v-else class="border-b hover:bg-gray-50">
                  <td class="px-3 py-2 text-center text-gray-600">{{ getItemNumber(index) }}</td>
                <td class="px-3 py-2 font-medium text-gray-900">{{ item.discipline_name || '-' }}</td>
                <td class="px-3 py-2 text-gray-700">{{ item.sub_discipline_name || '-' }}</td>
                <td class="px-3 py-2">
                  <input 
                    v-model="item.description" 
                    @blur="updateItemDescription(item)"
                    type="text" 
                    placeholder="Tambah deskripsi..."
                    :disabled="!isEditable"
                    class="w-full border border-gray-300 rounded px-2 py-1 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-600"
                  >
                </td>
                <td class="px-3 py-2">
                  <!-- If no AHSP assigned, show assign button -->
                  <div v-if="!item.ahsp_id || item.ahsp_id === 0" class="flex items-center gap-1">
                    <span class="text-gray-400 text-xs italic flex-1">{{ item.ahsp_name_snapshot }}</span>
                    <button v-if="isEditable" @click="openAssignAHSP(item)" class="px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded border border-blue-200 hover:bg-blue-100 whitespace-nowrap" title="Cari & assign AHSP">
                      🔗 AHSP
                    </button>
                  </div>
                  <button v-else @click="viewAHSPDetail(item.ahsp_id)" class="text-blue-600 hover:underline text-left">
                    {{ item.ahsp_name_snapshot }}
                  </button>
                </td>
                <td class="px-3 py-2 text-gray-600 font-mono text-xs">{{ item.ahsp_code_snapshot }}</td>
                <td class="px-3 py-2">
                  <input 
                    v-model.number="item.qty" 
                    @blur="updateItemQty(item)"
                    type="number" 
                    step="0.001"
                    :disabled="!isEditable"
                    class="w-full text-right border border-gray-300 rounded px-2 py-1 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-600"
                  >
                </td>
                <td class="px-3 py-2 text-center text-gray-600">{{ item.unit_snapshot }}</td>
                <td class="px-3 py-2 text-right font-medium text-gray-900">{{ formatNumber(item.unit_price_snapshot) }}</td>
                <td class="px-3 py-2 text-right font-bold text-gray-900">{{ formatNumber(item.total_price) }}</td>
                <td class="px-3 py-2 text-center flex items-center justify-center gap-1">
                  <button @click="openCalculator(item)" class="w-7 h-7 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-600 flex items-center justify-center" title="Construction Calculator">
                    🧮
                  </button>
                  <button v-if="isEditable" @click="deleteItem(item.id)" class="text-red-600 hover:text-red-800">
                    🗑️
                  </button>
                </td>
              </tr>
              </template>

              <!-- Empty State -->
              <tr v-if="items.length === 0">
                <td colspan="11" class="px-3 py-8 text-center text-gray-500">
                  <p>Belum ada pekerjaan. Klik "+ Tambah Pekerjaan" untuk mulai menambahkan item</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Right Sidebar (Cost Summary - Sticky) -->
      <div class="w-80 p-6">
        <div class="bg-white rounded-lg shadow sticky top-24">
          <div class="p-4 bg-blue-600 text-white rounded-t-lg">
            <h3 class="font-bold">COST SUMMARY</h3>
          </div>
          <div class="p-4 space-y-3 text-sm">
            <!-- Discipline Totals -->
            <div v-for="disc in disciplineSummary" :key="disc.id" class="flex justify-between">
              <span class="text-gray-600">{{ disc.name }}</span>
              <span class="font-semibold">{{ formatNumber(disc.total) }}</span>
            </div>
            
            <div class="border-t pt-3 space-y-2">
              <div class="flex justify-between font-bold text-gray-900">
                <span>DIRECT COST</span>
                <span>{{ formatNumber(summary.direct_cost) }}</span>
              </div>
              <div class="flex justify-between text-gray-600">
                <span>OVERHEAD</span>
                <span>{{ formatNumber(summary.overhead) }}</span>
              </div>
              <div class="flex justify-between text-gray-600">
                <span>RISK / CONTINGENCY</span>
                <span>{{ formatNumber(summary.risk_contingency) }}</span>
              </div>
            </div>
            
            <div class="border-t-2 pt-3">
              <div class="flex justify-between text-lg font-bold text-blue-900">
                <span>TOTAL PROJECT</span>
                <span>{{ formatNumber(summary.total_project) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- AHSP Selector Modal -->
    <div v-if="showAHSPModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" @click.self="showAHSPModal = false">
      <div class="bg-white rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] flex flex-col">
        <div class="p-6 border-b">
          <h2 class="text-2xl font-bold">Tambah Pekerjaan (AHSP)</h2>
          
          <!-- Discipline Selector -->
          <div class="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Pilih Disiplin</label>
              <select 
                v-model.number="modalSelectedDisciplineId"
                @change="onModalDisciplineChange"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option :value="null" disabled>-- Pilih Disiplin --</option>
                <option 
                  v-for="disc in disciplines" 
                  :key="disc.id"
                  :value="disc.id"
                >
                  {{ disc.name }}
                </option>
              </select>
            </div>
            
            <div v-if="modalSelectedDisciplineId">
              <label class="block text-sm font-medium text-gray-700 mb-2">Pilih Sub-Disiplin</label>
              <select 
                v-model.number="modalSelectedSubDisciplineId"
                @change="onModalSubDisciplineChange"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option :value="null" disabled>-- Pilih Sub-Disiplin --</option>
                <option 
                  v-for="subDisc in modalCurrentSubDisciplines" 
                  :key="subDisc.id"
                  :value="subDisc.id"
                >
                  {{ subDisc.name }}
                </option>
              </select>
            </div>
          </div>
          
          <!-- Search -->
          <div v-if="modalSelectedSubDisciplineId" class="mt-4">
            <input 
              v-model="ahspSearch" 
              type="text" 
              placeholder="Cari kode atau nama pekerjaan..."
              class="w-full border border-gray-300 rounded-lg px-4 py-2"
            >
          </div>
        </div>
        
        <!-- AHSP List -->
        <div v-if="modalSelectedSubDisciplineId" class="flex-1 overflow-y-auto p-6">
          <table class="min-w-full text-sm">
            <thead class="bg-gray-50 sticky top-0">
              <tr>
                <th class="px-3 py-2 text-left">Kode</th>
                <th class="px-3 py-2 text-left">Uraian Pekerjaan</th>
                <th class="px-3 py-2 text-center">Satuan</th>
                <th class="px-3 py-2 text-right">Harga Satuan</th>
                <th class="px-3 py-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="ahsp in filteredAHSP" :key="ahsp.id" class="border-b hover:bg-gray-50">
                <td class="px-3 py-2 font-mono text-xs">{{ ahsp.kode }}</td>
                <td class="px-3 py-2">{{ ahsp.name }}</td>
                <td class="px-3 py-2 text-center">{{ ahsp.satuan }}</td>
                <td class="px-3 py-2 text-right">{{ formatNumber(ahsp.harga_satuan) }}</td>
                <td class="px-3 py-2 text-center">
                  <button 
                    @click="toggleAHSP(ahsp)" 
                    class="w-7 h-7 rounded-md border-2 flex items-center justify-center transition-all duration-150"
                    :class="isAhspAdded(ahsp.id) 
                      ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700' 
                      : 'border-gray-300 text-transparent hover:border-blue-400'"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          
          <div v-if="filteredAHSP.length === 0" class="text-center py-8 text-gray-500">
            No AHSP found for this sub-discipline
          </div>
        </div>
        
        <!-- Empty State when no sub-discipline selected -->
        <div v-else class="flex-1 flex items-center justify-center p-6">
          <p class="text-gray-500 text-lg">Pilih Disiplin dan Sub-Disiplin untuk menampilkan AHSP</p>
        </div>
        
        <div class="p-4 border-t flex justify-end">
          <button @click="showAHSPModal = false" class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>

    <!-- Proposal Resume Modal -->
    <ProposalResume
      v-if="showResume"
      :proposal-id="Number(proposalId)"
      :proposal-name="proposal?.project_name || ''"
      @close="showResume = false"
    />

    <!-- Construction Calculator Modal -->
    <ConstructionCalculator 
      :visible="showCalculator" 
      :item-unit="calcItem?.unit_snapshot"
      @close="showCalculator = false"
      @apply="applyCalcResult"
    />

    <!-- AHSP Detail Modal (Read-Only Analysis) -->
    <div v-if="showDetail" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" @click.self="closeDetail">
      <div class="bg-white rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[85vh] overflow-auto">
        <div class="p-4 border-b flex items-center justify-between">
          <div>
            <h2 class="text-lg font-bold">Analisa Harga Satuan Pekerjaan</h2>
            <p class="text-sm text-gray-600">{{ selectedAhspDetail?.kode }} - {{ selectedAhspDetail?.name }}</p>
          </div>
          <button class="text-gray-500 hover:text-gray-800" @click="closeDetail">✕</button>
        </div>

        <div class="p-4">
          <table class="min-w-full text-sm">
            <thead class="bg-blue-600 text-white">
              <tr>
                <th class="px-3 py-2 text-left w-14">No.</th>
                <th class="px-3 py-2 text-left">Uraian</th>
                <th class="px-3 py-2 text-left w-20">Kode</th>
                <th class="px-3 py-2 text-center w-20">Satuan</th>
                <th class="px-3 py-2 text-right w-20">Koef.</th>
                <th class="px-3 py-2 text-right w-28">Harga</th>
                <th class="px-3 py-2 text-right w-28">Jumlah</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr class="bg-gray-50">
                <td class="px-3 py-2 font-bold">A</td>
                <td class="px-3 py-2 font-bold" colspan="6">Tenaga Kerja</td>
              </tr>
              <tr v-for="(row, idx) in sectionA" :key="`A-${idx}`">
                <td class="px-3 py-2 text-center text-gray-600">{{ idx + 1 }}</td>
                <td class="px-3 py-2">{{ row.resource_name }}</td>
                <td class="px-3 py-2 text-xs font-mono">{{ row.resource_code || '-' }}</td>
                <td class="px-3 py-2 text-center">{{ row.resource_satuan }}</td>
                <td class="px-3 py-2 text-right">{{ formatDecimal(row.koefisien) }}</td>
                <td class="px-3 py-2 text-right">{{ formatNumber(row.resource_harga) }}</td>
                <td class="px-3 py-2 text-right">{{ formatNumber(row.jumlah_harga) }}</td>
              </tr>
              <tr class="bg-gray-50">
                <td class="px-3 py-2 font-bold">B</td>
                <td class="px-3 py-2 font-bold" colspan="6">Bahan</td>
              </tr>
              <tr v-for="(row, idx) in sectionB" :key="`B-${idx}`">
                <td class="px-3 py-2 text-center text-gray-600">{{ idx + 1 }}</td>
                <td class="px-3 py-2">{{ row.resource_name }}</td>
                <td class="px-3 py-2 text-xs font-mono">{{ row.resource_code || '-' }}</td>
                <td class="px-3 py-2 text-center">{{ row.resource_satuan }}</td>
                <td class="px-3 py-2 text-right">{{ formatDecimal(row.koefisien) }}</td>
                <td class="px-3 py-2 text-right">{{ formatNumber(row.resource_harga) }}</td>
                <td class="px-3 py-2 text-right">{{ formatNumber(row.jumlah_harga) }}</td>
              </tr>
              <tr class="bg-gray-50">
                <td class="px-3 py-2 font-bold">C</td>
                <td class="px-3 py-2 font-bold" colspan="6">Peralatan</td>
              </tr>
              <tr v-for="(row, idx) in sectionC" :key="`C-${idx}`">
                <td class="px-3 py-2 text-center text-gray-600">{{ idx + 1 }}</td>
                <td class="px-3 py-2">{{ row.resource_name }}</td>
                <td class="px-3 py-2 text-xs font-mono">{{ row.resource_code || '-' }}</td>
                <td class="px-3 py-2 text-center">{{ row.resource_satuan }}</td>
                <td class="px-3 py-2 text-right">{{ formatDecimal(row.koefisien) }}</td>
                <td class="px-3 py-2 text-right">{{ formatNumber(row.resource_harga) }}</td>
                <td class="px-3 py-2 text-right">{{ formatNumber(row.jumlah_harga) }}</td>
              </tr>
              <tr class="bg-gray-100 font-semibold">
                <td class="px-3 py-2">D</td>
                <td class="px-3 py-2" colspan="5">Jumlah Harga Tenaga, Bahan dan Peralatan (A+B+C)</td>
                <td class="px-3 py-2 text-right">{{ formatNumber(selectedAhspDetail?.harga_langsung || 0) }}</td>
              </tr>
              <tr class="bg-gray-100 font-semibold">
                <td class="px-3 py-2">E</td>
                <td class="px-3 py-2" colspan="5">Overhead + profit (10%)</td>
                <td class="px-3 py-2 text-right">{{ formatNumber(selectedAhspDetail?.overhead_profit || 0) }}</td>
              </tr>
              <tr class="bg-gray-200 font-bold">
                <td class="px-3 py-2">F</td>
                <td class="px-3 py-2" colspan="5">Harga Satuan Pekerjaan (D+E)</td>
                <td class="px-3 py-2 text-right">{{ formatNumber(selectedAhspDetail?.harga_satuan || 0) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="p-4 border-t flex justify-end">
          <button class="px-4 py-2 bg-gray-700 text-white rounded" @click="closeDetail">Tutup</button>
        </div>
      </div>
    </div>

    <!-- AHSP Assign Modal (for wizard-created items) -->
    <div v-if="showAssignModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" @click.self="showAssignModal = false">
      <div class="bg-white rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[85vh] flex flex-col">
        <div class="p-4 border-b">
          <h2 class="text-lg font-bold">Assign AHSP ke Pekerjaan</h2>
          <p class="text-sm text-gray-500 mt-1">
            Item: <span class="font-semibold text-gray-700">{{ assignTarget?.ahsp_name_snapshot }}</span>
          </p>
          <div class="mt-3">
            <input 
              v-model="assignSearch" 
              @input="debounceAssignSearch"
              type="text" 
              :placeholder="'Cari AHSP... (cth: ' + (assignTarget?.ahsp_name_snapshot?.split(' ').slice(0,3).join(' ') || 'galian tanah') + ')'"
              class="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              ref="assignSearchInput"
            >
          </div>
        </div>
        <div class="flex-1 overflow-y-auto">
          <div v-if="assignLoading" class="p-8 text-center text-gray-500">Mencari AHSP...</div>
          <table v-else-if="assignResults.length > 0" class="min-w-full text-sm">
            <thead class="bg-gray-50 sticky top-0">
              <tr>
                <th class="px-3 py-2 text-left w-32">Kode</th>
                <th class="px-3 py-2 text-left">Uraian Pekerjaan</th>
                <th class="px-3 py-2 text-center w-20">Satuan</th>
                <th class="px-3 py-2 text-right w-32">Harga Satuan</th>
                <th class="px-3 py-2 text-center w-20">Pilih</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="ahsp in assignResults" :key="ahsp.id" class="border-b hover:bg-blue-50 cursor-pointer" @click="confirmAssignAHSP(ahsp)">
                <td class="px-3 py-2 font-mono text-xs text-gray-600">{{ ahsp.kode }}</td>
                <td class="px-3 py-2">{{ ahsp.name }}</td>
                <td class="px-3 py-2 text-center">{{ ahsp.satuan }}</td>
                <td class="px-3 py-2 text-right font-medium">{{ formatNumber(ahsp.harga_satuan) }}</td>
                <td class="px-3 py-2 text-center">
                  <button class="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">Pilih</button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else-if="assignSearch.length >= 2" class="p-8 text-center text-gray-500">
            Tidak ada AHSP ditemukan untuk "{{ assignSearch }}"
          </div>
          <div v-else class="p-8 text-center text-gray-400">
            Ketik minimal 2 karakter untuk mencari AHSP
          </div>
        </div>
        <div class="p-3 border-t flex justify-end">
          <button @click="showAssignModal = false" class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Tutup</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/lib/api';
import ConstructionCalculator from '@/components/ConstructionCalculator.vue';
import ProposalResume from '@/components/ProposalResume.vue';

const route = useRoute();
const router = useRouter();
const proposalId = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id;

interface Proposal {
  id: number;
  proposal_number: string;
  project_name: string;
  client: string;
  lokasi: string;
  revision: string;
  status: string;
  direct_cost: number;
  overhead: number;
  risk_contingency: number;
  total_project: number;
  project_id: number | null;
}

interface Discipline {
  id: number;
  code: string;
  name: string;
  order_no: number;
}

interface SubDiscipline {
  id: number;
  discipline_id: number;
  code: string;
  name: string;
  order_no: number;
}

interface ProposalItem {
  id: number;
  proposal_id: number;
  discipline_id: number;
  sub_discipline_id: number;
  ahsp_id: number;
  ahsp_code_snapshot: string;
  ahsp_name_snapshot: string;
  unit_snapshot: string;
  unit_price_snapshot: number;
  qty: number;
  total_price: number;
  order_no: number;
  description?: string;
  discipline_name?: string;
  sub_discipline_name?: string;
  is_section?: number;
  section_label?: string;
  section_order?: number;
}

interface AHSP {
  id: number;
  kode: string;
  name: string;
  satuan: string;
  harga_satuan: number;
  harga_langsung?: number;
  overhead_profit?: number;
}

interface AhspDetailItem {
  section: string;
  koefisien: number;
  resource_name: string;
  resource_satuan: string;
  resource_harga: number;
  jumlah_harga: number;
  resource_code?: string;
}

const proposal = ref<Proposal | null>(null);
const disciplines = ref<Discipline[]>([]);
const subDisciplines = ref<SubDiscipline[]>([]);
const items = ref<ProposalItem[]>([]);
const availableAHSP = ref<AHSP[]>([]);

// Modal states for AHSP selection
const showAHSPModal = ref(false);
const modalSelectedDisciplineId = ref<number | null>(null);
const modalSelectedSubDisciplineId = ref<number | null>(null);
const ahspSearch = ref('');

// Modal states for Construction Calculator
const showCalculator = ref(false);
const showResume = ref(false);
const calcItem = ref<ProposalItem | null>(null);

// Modal states for AHSP Detail
const showDetail = ref(false);
const selectedAhspDetail = ref<AHSP | null>(null);
const detailItems = ref<AhspDetailItem[]>([]);

// Modal states for AHSP Assign (wizard items)
const showAssignModal = ref(false);
const assignTarget = ref<ProposalItem | null>(null);
const assignSearch = ref('');
const assignResults = ref<AHSP[]>([]);
const assignLoading = ref(false);
let assignSearchTimer: ReturnType<typeof setTimeout> | null = null;

const summary = ref({
  direct_cost: 0,
  overhead: 0,
  risk_contingency: 0,
  total_project: 0
});

const disciplineSummary = ref<any[]>([]);

// Computed
const statusBadgeClass = computed(() => {
  const classes: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    review: 'bg-blue-100 text-blue-800',
    submitted: 'bg-purple-100 text-purple-800',
    deal: 'bg-green-100 text-green-800',
    no_deal: 'bg-red-100 text-red-800',
  };
  return classes[proposal.value?.status || 'draft'];
});

const statusSteps = [
  { key: 'draft', label: 'Draft', activeClass: 'bg-yellow-100 text-yellow-800' },
  { key: 'review', label: 'Review', activeClass: 'bg-blue-100 text-blue-800' },
  { key: 'submitted', label: 'Submitted', activeClass: 'bg-purple-100 text-purple-800' },
  { key: 'deal', label: '🤝 Deal', activeClass: 'bg-green-100 text-green-800' },
];

const statusStepIndex = (status?: string) => {
  if (status === 'no_deal') return 3; // same level as deal
  return statusSteps.findIndex(s => s.key === status);
};

const isEditable = computed(() => {
  const s = proposal.value?.status;
  return s === 'draft' || s === 'review';
});

const modalCurrentSubDisciplines = computed(() => {
  return subDisciplines.value.filter(sd => sd.discipline_id === modalSelectedDisciplineId.value);
});

const filteredAHSP = computed(() => {
  if (!ahspSearch.value) return availableAHSP.value;
  
  const search = ahspSearch.value.toLowerCase();
  return availableAHSP.value.filter(ahsp => 
    ahsp.kode.toLowerCase().includes(search) || 
    ahsp.name.toLowerCase().includes(search)
  );
});

const sectionA = computed(() => detailItems.value.filter(i => i.section === 'A'));
const sectionB = computed(() => detailItems.value.filter(i => i.section === 'B'));
const sectionC = computed(() => detailItems.value.filter(i => i.section === 'C'));

// Get sequential item number (skipping section headers)
const getItemNumber = (index: number) => {
  let count = 0;
  for (let i = 0; i <= index; i++) {
    if (!items.value[i]?.is_section) count++;
  }
  return count;
};

// Methods
const loadProposal = async () => {
  try {
    const { data } = await api.get(`/estimator/proposals/${proposalId}`);
    proposal.value = data;
  } catch (error) {
    console.error('Failed to load proposal:', error);
  }
};

const loadDisciplines = async () => {
  try {
    const { data } = await api.get('/estimator/disciplines');
    disciplines.value = data;
    
    // Load all sub-disciplines
    for (const disc of data) {
      const { data: subs } = await api.get(`/estimator/disciplines/${disc.id}/sub-disciplines`);
      subDisciplines.value.push(...subs);
    }
  } catch (error) {
    console.error('Failed to load disciplines:', error);
  }
};

const loadItems = async () => {
  try {
    const { data } = await api.get(`/estimator/proposals/${proposalId}/items`);
    items.value = data;
  } catch (error) {
    console.error('Failed to load items:', error);
  }
};

const loadSummary = async () => {
  try {
    const { data } = await api.get(`/estimator/proposals/${proposalId}/summary`);
    disciplineSummary.value = data.discipline_totals;
    summary.value = data.proposal_totals;
  } catch (error) {
    console.error('Failed to load summary:', error);
  }
};

const openAHSPModal = () => {
  modalSelectedDisciplineId.value = null;
  modalSelectedSubDisciplineId.value = null;
  ahspSearch.value = '';
  showAHSPModal.value = true;
};

const onModalDisciplineChange = () => {
  modalSelectedSubDisciplineId.value = null;
  availableAHSP.value = [];
  ahspSearch.value = '';
};

const onModalSubDisciplineChange = async () => {
  if (!modalSelectedSubDisciplineId.value) {
    availableAHSP.value = [];
    return;
  }
  
  try {
    const { data } = await api.get(`/estimator/ahsp?sub_discipline_id=${modalSelectedSubDisciplineId.value}`);
    availableAHSP.value = data;
    ahspSearch.value = '';
  } catch (error) {
    console.error('Failed to load AHSP:', error);
  }
};

const isAhspAdded = (ahspId: number) => {
  return items.value.some(item => item.ahsp_id === ahspId);
};

const toggleAHSP = async (ahsp: AHSP) => {
  if (isAhspAdded(ahsp.id)) {
    // Remove item
    const existing = items.value.find(item => item.ahsp_id === ahsp.id);
    if (!existing) return;
    try {
      await api.delete(`/estimator/proposals/${proposalId}/items/${existing.id}`);
      await loadItems();
      await loadSummary();
    } catch (error) {
      console.error('Failed to remove AHSP:', error);
    }
  } else {
    // Add item
    try {
      await api.post(`/estimator/proposals/${proposalId}/items`, {
        ahsp_id: ahsp.id,
        discipline_id: modalSelectedDisciplineId.value,
        sub_discipline_id: modalSelectedSubDisciplineId.value,
        qty: 0
      });
      await loadItems();
      await loadSummary();
    } catch (error) {
      console.error('Failed to add AHSP:', error);
      alert('Failed to add item');
    }
  }
};

const updateItemDescription = async (item: ProposalItem) => {
  try {
    await api.put(`/estimator/proposals/${proposalId}/items/${item.id}`, {
      description: item.description || ''
    });
  } catch (error) {
    console.error('Failed to update description:', error);
  }
};

const updateItemQty = async (item: ProposalItem) => {
  try {
    await api.put(`/estimator/proposals/${proposalId}/items/${item.id}`, {
      qty: item.qty
    });
    
    // Recalculate total_price locally
    item.total_price = item.qty * item.unit_price_snapshot;
    
    await loadSummary();
  } catch (error) {
    console.error('Failed to update item:', error);
  }
};

const openCalculator = (item: ProposalItem) => {
  calcItem.value = item;
  showCalculator.value = true;
};

const applyCalcResult = async (value: number) => {
  if (calcItem.value) {
    calcItem.value.qty = value;
    await updateItemQty(calcItem.value);
  }
};

const deleteItem = async (itemId: number) => {
  if (!confirm('Delete this item?')) return;
  
  try {
    await api.delete(`/estimator/proposals/${proposalId}/items/${itemId}`);
    await loadItems();
    await loadSummary();
  } catch (error) {
    console.error('Failed to delete item:', error);
  }
};

const changeStatus = async (newStatus: string) => {
  const labels: Record<string, string> = {
    review: 'Submit to Review',
    submitted: 'Submit to Client',
    deal: 'Mark as Deal (Kontrak) — this will create a Project automatically',
    no_deal: 'Mark as No Deal',
    draft: 'Revert to Draft'
  };
  
  if (!confirm(`Are you sure you want to: ${labels[newStatus]}?`)) return;
  
  try {
    const { data } = await api.put(`/estimator/proposals/${proposalId}/status`, { status: newStatus });
    
    // Reload proposal to get updated status & project_id
    await loadProposal();
    
    if (newStatus === 'deal' && data.project_id) {
      let msg = `✅ Deal! Project created successfully.`;
      if (data.pr_number) {
        msg += `\n📋 PR ${data.pr_number} auto-created with materials from AHSP.`;
      }
      msg += `\nYou can now manage it from the Projects menu.`;
      alert(msg);
    }
  } catch (error: any) {
    const msg = error.response?.data?.error || 'Failed to update status';
    alert(`Error: ${msg}`);
  }
};

const viewRAB = () => {
  router.push(`/estimator/proposals/${proposalId}/rab`);
};

const viewAHSPDetail = async (ahspId: number) => {
  try {
    const { data } = await api.get(`/estimator/ahsp/${ahspId}`);
    selectedAhspDetail.value = data;
    detailItems.value = (data.items || []).map((row: any) => ({
      ...row,
      jumlah_harga: row.jumlah_harga ?? (Number(row.koefisien) * Number(row.resource_harga))
    }));
    showDetail.value = true;
  } catch (error) {
    console.error('Failed to load AHSP detail:', error);
    alert('Failed to load AHSP detail');
  }
};

const closeDetail = () => {
  showDetail.value = false;
  selectedAhspDetail.value = null;
  detailItems.value = [];
};

// --- AHSP Assign functions ---
const openAssignAHSP = (item: ProposalItem) => {
  assignTarget.value = item;
  assignSearch.value = '';
  assignResults.value = [];
  showAssignModal.value = true;
  // Auto-search using first few words of the item name
  const hint = item.ahsp_name_snapshot?.split(' ').slice(0, 3).join(' ') || '';
  if (hint.length >= 2) {
    assignSearch.value = hint;
    doAssignSearch(hint);
  }
};

const debounceAssignSearch = () => {
  if (assignSearchTimer) clearTimeout(assignSearchTimer);
  assignSearchTimer = setTimeout(() => {
    if (assignSearch.value.length >= 2) {
      doAssignSearch(assignSearch.value);
    } else {
      assignResults.value = [];
    }
  }, 300);
};

const doAssignSearch = async (keyword: string) => {
  assignLoading.value = true;
  try {
    const { data } = await api.get(`/estimator/ahsp?search=${encodeURIComponent(keyword)}`);
    assignResults.value = data;
  } catch (error) {
    console.error('Failed to search AHSP:', error);
  } finally {
    assignLoading.value = false;
  }
};

const confirmAssignAHSP = async (ahsp: AHSP) => {
  if (!assignTarget.value) return;
  try {
    await api.put(`/estimator/proposals/${proposalId}/items/${assignTarget.value.id}`, {
      ahsp_id: ahsp.id
    });
    showAssignModal.value = false;
    await loadItems();
    await loadSummary();
  } catch (error) {
    console.error('Failed to assign AHSP:', error);
    alert('Gagal assign AHSP');
  }
};

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value || 0);
};

const formatDecimal = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3
  }).format(value || 0);
};

onMounted(async () => {
  await Promise.all([
    loadProposal(),
    loadDisciplines(),
    loadItems(),
    loadSummary()
  ]);
});
</script>
