<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 class="text-xl font-bold text-gray-900">Work Orders</h1>
        <p class="text-sm text-gray-500 mt-0.5">Kelola jadwal & eksekusi produksi per minggu</p>
      </div>
      <button @click="openCreateModal"
        class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 shadow-sm">
        <span>＋</span> Buat WO Manual
      </button>
    </div>

    <!-- Summary Badges -->
    <div v-if="summaryWithAll.length" class="flex flex-wrap gap-2">
      <button v-for="s in summaryWithAll" :key="s.status"
        @click="filterStatus = s.status"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
        :class="filterStatus === s.status
          ? `${statusColor(s.status, true)} shadow-sm`
          : `bg-white border-gray-200 text-gray-600 hover:border-gray-300`">
        <span :class="statusDot(s.status)" class="w-2 h-2 rounded-full inline-block"></span>
        {{ s.label }}
        <span class="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px]"
          :class="filterStatus === s.status ? 'bg-white/30' : 'bg-gray-100'">{{ s.count }}</span>
      </button>
    </div>

    <!-- Search + Month Filter -->
    <div class="flex flex-wrap gap-2">
      <div class="relative flex-1 min-w-[200px]">
        <input v-model="searchQ" @input="debouncedLoad" placeholder="Cari WO, produk, SKU..."
          class="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
        <span class="absolute left-2.5 top-2.5 text-gray-400 text-sm">🔍</span>
      </div>
      <select v-model="filterMonth" @change="loadWOs"
        class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
        <option value="">Semua Bulan</option>
        <option v-for="m in months" :key="m.value" :value="m.value">{{ m.label }}</option>
      </select>
      <select v-model="filterYear" @change="loadWOs"
        class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
        <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
      </select>
    </div>

    <!-- WO Table -->
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div v-if="loading" class="py-12 text-center text-gray-400 text-sm">Memuat...</div>
      <div v-else-if="!filteredWOs.length" class="py-12 text-center text-gray-400">
        <div class="text-3xl mb-2">📋</div>
        <div class="font-medium">Tidak ada Work Order</div>
        <div class="text-xs mt-1">Buat WO manual atau generate dari MPS</div>
      </div>
      <table v-else class="w-full">
        <thead class="bg-gray-50 text-sm font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
          <tr>
            <th class="px-5 py-4 text-left">WO No.</th>
            <th class="px-5 py-4 text-left">Produk</th>
            <th class="px-5 py-4 text-left">Line / Mesin</th>
            <th class="px-5 py-4 text-right">Qty</th>
            <th class="px-5 py-4 text-center">Progress</th>
            <th class="px-5 py-4 text-center">Status</th>
            <th class="px-5 py-4 text-center">Jadwal</th>
            <th class="px-5 py-4 text-center">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="wo in filteredWOs" :key="wo.id"
            class="hover:bg-indigo-50/40 transition-colors cursor-pointer"
            @click="openDetail(wo)">
            <!-- WO Number -->
            <td class="px-5 py-4">
              <div class="font-mono font-bold text-indigo-700 text-base">{{ wo.wo_number }}</div>
              <div class="flex items-center gap-1.5 mt-0.5">
                <span v-if="wo.source_type === 'MPS'" class="inline-flex items-center px-1.5 py-0.5 bg-teal-50 border border-teal-200 text-teal-700 text-[10px] font-bold rounded-full">
                  MPS
                </span>
                <span v-else-if="wo.source_type === 'MANUAL'" class="inline-flex items-center px-1.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-600 text-[10px] font-bold rounded-full">
                  Manual
                </span>
                <span v-else class="inline-flex items-center px-1.5 py-0.5 bg-gray-50 border border-gray-200 text-gray-400 text-[10px] rounded-full">
                  Legacy
                </span>
                <span v-if="wo.mps_number" class="text-sm text-teal-600">{{ wo.mps_number }}</span>
              </div>
            </td>
            <!-- Produk -->
            <td class="px-5 py-4">
              <div class="font-semibold text-gray-900 text-base leading-snug">{{ wo.product_name }}</div>
              <div class="text-sm text-gray-400 font-mono mt-0.5">{{ wo.product_sku }}</div>
            </td>
            <!-- Line -->
            <td class="px-5 py-4">
              <div v-if="wo.line_process_name" class="text-base text-gray-700 font-medium">{{ wo.line_process_name }}</div>
              <div v-if="wo.capacity_per_hour" class="text-sm text-gray-400 mt-0.5">{{ wo.capacity_per_hour }} {{ wo.capacity_unit_name }}/hr</div>
              <div v-if="!wo.line_process_name" class="text-sm text-orange-400 flex items-center gap-1">⚠ Belum assign</div>
            </td>
            <!-- Qty -->
            <td class="px-5 py-4 text-right">
              <div class="font-bold text-gray-800 text-base">{{ formatN(wo.quantity) }}</div>
              <div v-if="wo.capacity_unit_name" class="text-sm text-gray-400">{{ wo.capacity_unit_name }}</div>
            </td>
            <!-- Progress (termasuk completed qty) -->
            <td class="px-5 py-4 text-center">
              <div class="flex flex-col items-center gap-1.5">
                <div class="text-sm text-gray-500 font-medium">
                  <span :class="wo.completed_quantity > 0 ? 'text-emerald-600 font-bold' : 'text-gray-400'">
                    {{ formatN(wo.completed_quantity || 0) }}
                  </span>
                  <span class="text-gray-300 mx-0.5">/</span>
                  <span>{{ formatN(wo.quantity) }}</span>
                </div>
                <div class="flex items-center gap-2 w-full justify-center">
                  <div class="w-24 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                    <div class="h-full rounded-full transition-all"
                      :class="progressColor(wo)"
                      :style="{ width: progressPct(wo) + '%' }"></div>
                  </div>
                  <span class="text-sm font-semibold text-gray-600 min-w-[2.5rem] text-left">{{ progressPct(wo) }}%</span>
                </div>
              </div>
            </td>
            <!-- Status -->
            <td class="px-5 py-4 text-center" @click.stop>
              <select :value="wo.status"
                @change="quickStatusChange(wo, ($event.target as HTMLSelectElement).value)"
                class="text-sm font-semibold px-3 py-1.5 rounded-lg border-0 cursor-pointer focus:ring-2 focus:ring-indigo-300"
                :class="statusBg(wo.status)">
                <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
              </select>
            </td>
            <!-- Jadwal + Minggu -->
            <td class="px-5 py-4 text-center">
              <div v-if="wo.mps_week_number" class="text-sm font-bold text-blue-600 mb-1">Minggu {{ wo.mps_week_number }}</div>
              <div v-if="wo.scheduled_start" class="text-sm text-gray-700 font-medium">
                {{ fmtDate(wo.scheduled_start) }}
              </div>
              <div v-if="wo.scheduled_end" class="text-sm text-gray-400">
                s/d {{ fmtDate(wo.scheduled_end) }}
              </div>
              <span v-if="!wo.scheduled_start && !wo.mps_week_number" class="text-gray-300 text-sm">—</span>
            </td>
            <!-- Aksi -->
            <td class="px-5 py-4 text-center" @click.stop>
              <div class="flex items-center justify-center gap-2">
                <button @click="openEdit(wo)"
                  class="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-semibold transition-colors">
                  Edit
                </button>
                <button v-if="canReschedule(wo)" @click="openReschedule(wo)"
                  class="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-sm font-semibold transition-colors">
                  Reschedule
                </button>
                <button v-if="wo.status === 'DRAFT'" @click="confirmDelete(wo)"
                  class="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-semibold transition-colors">
                  Hapus
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ===== CREATE / EDIT MODAL ===== -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="showModal = false">
      <div class="bg-white rounded-xl shadow-2xl w-[520px] max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 class="font-bold text-gray-800">{{ editingWo ? 'Edit Work Order' : 'Buat Work Order' }}</h2>
          <button @click="showModal = false" class="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div class="p-5 space-y-4">
          <!-- Product -->
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">Produk <span class="text-red-500">*</span></label>
            <select v-model="form.product_id" @change="onProductChange" :disabled="!!editingWo"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
              <option value="">Pilih Produk</option>
              <option v-for="p in productOptions" :key="p.value" :value="p.value">{{ p.label }}</option>
            </select>
          </div>
          <!-- Qty + UOM -->
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="block text-xs font-semibold text-gray-600 mb-1">Qty <span class="text-red-500">*</span></label>
              <input v-model="form.quantity" type="number" step="0.1" min="0"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div class="flex-1">
              <label class="block text-xs font-semibold text-gray-600 mb-1">Line Produksi</label>
              <select v-model="form.line_process_id"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="">Pilih Line</option>
                <option v-for="lp in lineOptions" :key="lp.value" :value="lp.value">{{ lp.label }}</option>
              </select>
            </div>
          </div>
          <!-- Status + Priority -->
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="block text-xs font-semibold text-gray-600 mb-1">Status</label>
              <select v-model="form.status"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
              </select>
            </div>
            <div class="flex-1">
              <label class="block text-xs font-semibold text-gray-600 mb-1">Prioritas</label>
              <select v-model="form.priority"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <!-- Dates -->
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="block text-xs font-semibold text-gray-600 mb-1">Tanggal Mulai</label>
              <input v-model="form.scheduled_start" type="date"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div class="flex-1">
              <label class="block text-xs font-semibold text-gray-600 mb-1">Tanggal Selesai</label>
              <input v-model="form.scheduled_end" type="date"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>
          <!-- Actual dates — hanya muncul saat edit & status bukan DRAFT -->
          <template v-if="editingWo && form.status !== 'DRAFT'">
            <div class="flex gap-3">
              <div class="flex-1">
                <label class="block text-xs font-semibold text-gray-600 mb-1">Actual Start</label>
                <input v-model="form.actual_start" type="date"
                  class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div class="flex-1">
                <label class="block text-xs font-semibold text-gray-600 mb-1">Actual End</label>
                <input v-model="form.actual_end" type="date"
                  class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1">Qty Selesai (Completed)</label>
              <input v-model="form.completed_quantity" type="number" step="0.1" min="0"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </template>
          <!-- Source Reason (create mode only) -->
          <div v-if="!editingWo">
            <label class="block text-xs font-semibold text-gray-600 mb-1">Alasan Pembuatan WO <span class="text-red-500">*</span></label>
            <textarea v-model="form.source_reason" rows="2"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              placeholder="Jelaskan alasan pembuatan WO manual ini (wajib)..."></textarea>
          </div>
          <!-- Notes (edit mode only) -->
          <div v-if="editingWo">
            <label class="block text-xs font-semibold text-gray-600 mb-1">Catatan</label>
            <textarea v-model="form.notes" rows="2"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              placeholder="Instruksi, catatan produksi..."></textarea>
          </div>
          <!-- Reschedule History (edit mode only) -->
          <div v-if="editingWo && rescheduleLog.length > 0">
            <label class="block text-xs font-semibold text-gray-600 mb-2">Riwayat Reschedule</label>
            <div class="space-y-2 max-h-[200px] overflow-y-auto">
              <div v-for="log in rescheduleLog" :key="log.id"
                class="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm">
                <div class="flex items-center justify-between mb-1">
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-purple-700">W{{ log.old_week_number }}</span>
                    <span class="text-gray-400">→</span>
                    <span class="font-bold text-indigo-700">W{{ log.new_week_number }}</span>
                    <span v-if="Number(log.old_quantity) !== Number(log.new_quantity)"
                      class="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                      Qty: {{ formatN(log.old_quantity) }} → {{ formatN(log.new_quantity) }}
                    </span>
                  </div>
                  <span class="text-[10px] text-gray-400">{{ fmtDate(log.created_at) }}</span>
                </div>
                <div class="text-xs text-gray-600">{{ log.reason }}</div>
                <div v-if="log.rescheduled_by_name" class="text-[10px] text-gray-400 mt-0.5">oleh {{ log.rescheduled_by_name }}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button @click="showModal = false"
            class="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors">
            Batal
          </button>
          <button @click="saveWO" :disabled="saving"
            class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
            <span v-if="saving" class="animate-spin">⏳</span>
            {{ editingWo ? 'Simpan Perubahan' : 'Buat WO' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ===== DELETE CONFIRM MODAL ===== -->
    <div v-if="showDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="showDeleteConfirm = false">
      <div class="bg-white rounded-xl shadow-2xl w-[380px] p-6 text-center">
        <div class="text-4xl mb-3">🗑️</div>
        <h3 class="font-bold text-gray-800 mb-1">Hapus Work Order?</h3>
        <p class="text-sm text-gray-500 mb-1">{{ deletingWo?.wo_number }}</p>
        <p class="text-xs text-orange-500 mb-4">Hanya WO DRAFT yang dapat dihapus.</p>
        <div class="flex justify-center gap-3">
          <button @click="showDeleteConfirm = false"
            class="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50">Batal</button>
          <button @click="doDelete" :disabled="saving"
            class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
            Hapus
          </button>
        </div>
      </div>
    </div>

    <!-- ===== RESCHEDULE MODAL ===== -->
    <div v-if="showRescheduleModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="showRescheduleModal = false">
      <div class="bg-white rounded-xl shadow-2xl w-[480px] overflow-hidden">
        <div class="px-5 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
          <h2 class="font-bold">Reschedule Work Order</h2>
          <p class="text-xs text-purple-200 mt-0.5">{{ rescheduleWo?.wo_number }} — {{ rescheduleWo?.product_name }}</p>
        </div>
        <div class="p-5 space-y-4">
          <div class="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm">
            <div class="flex items-center gap-4">
              <div>
                <span class="text-xs text-gray-500">Saat ini</span>
                <div class="font-bold text-purple-700">W{{ rescheduleWo?.mps_week_number || rescheduleWo?.week_number || '?' }}</div>
                <div class="text-xs text-gray-500">{{ fmtDate(rescheduleWo?.scheduled_start) }} — {{ fmtDate(rescheduleWo?.scheduled_end) }}</div>
              </div>
              <div class="text-xl text-gray-400">→</div>
              <div>
                <span class="text-xs text-gray-500">Pindah ke</span>
                <div class="font-bold text-indigo-700">W{{ rescheduleForm.new_week_number || '?' }}</div>
              </div>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-1">Minggu Baru</label>
              <input v-model.number="rescheduleForm.new_week_number" type="number" min="1" max="52"
                class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-300" />
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-1">Tahun</label>
              <input v-model.number="rescheduleForm.new_year" type="number" min="2024" max="2030"
                class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-300" />
            </div>
          </div>
          <div v-if="canChangeQty">
            <label class="block text-sm font-semibold text-gray-700 mb-1">Quantity (opsional)</label>
            <input v-model.number="rescheduleForm.new_quantity" type="number" min="0" step="0.01"
              class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-300"
              :placeholder="String(rescheduleWo?.quantity || 0)" />
          </div>
          <div v-else class="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Quantity tidak bisa diubah untuk WO berstatus RELEASED
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1">Alasan Reschedule <span class="text-red-500">*</span></label>
            <textarea v-model="rescheduleForm.reason" rows="2" placeholder="Contoh: Material delay dari supplier"
              class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-300"></textarea>
          </div>
        </div>
        <div class="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
          <button @click="showRescheduleModal = false" class="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-100">Batal</button>
          <button @click="submitReschedule" :disabled="!rescheduleForm.reason || !rescheduleForm.new_week_number || rescheduling"
            class="px-4 py-2 text-sm font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
            {{ rescheduling ? 'Memproses...' : 'Reschedule' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div v-if="toast.show" class="fixed bottom-5 right-5 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold transition-all"
      :class="toast.type === 'ok' ? 'bg-emerald-600 text-white' : toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'">
      {{ toast.message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api } from '../lib/api';

const wos = ref<any[]>([]);
const loading = ref(false);
const saving = ref(false);
const searchQ = ref('');
const filterStatus = ref('all');
const filterMonth = ref('');
const filterYear = ref(new Date().getFullYear());
const showModal = ref(false);
const showDeleteConfirm = ref(false);
const editingWo = ref<any>(null);
const deletingWo = ref<any>(null);
const allLineProcesses = ref<any[]>([]);
const allProducts = ref<any[]>([]);
const toast = ref({ show: false, message: '', type: 'ok' });

const now = new Date();
const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - 1 + i);
const months = [
  { value: '1', label: 'Januari' }, { value: '2', label: 'Februari' },
  { value: '3', label: 'Maret' }, { value: '4', label: 'April' },
  { value: '5', label: 'Mei' }, { value: '6', label: 'Juni' },
  { value: '7', label: 'Juli' }, { value: '8', label: 'Agustus' },
  { value: '9', label: 'September' }, { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' }, { value: '12', label: 'Desember' },
];

const statusOptions = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'approved', label: 'Approved' },
  { value: 'released', label: 'Released' },
  { value: 'in_progress', label: 'In Production' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const defaultForm = () => ({
  product_id: '' as any,
  quantity: 0,
  line_process_id: '' as any,
  status: 'DRAFT',
  priority: 'normal',
  scheduled_start: '',
  scheduled_end: '',
  actual_start: '',
  actual_end: '',
  completed_quantity: 0,
  notes: '',
  bom_id: null as any,
  source_reason: '',
});
const form = ref(defaultForm());

const summaryMap: Record<string, string> = {
  all: 'Semua', DRAFT: 'Draft', draft: 'Draft',
  approved: 'Approved', APPROVED: 'Approved',
  released: 'Released', RELEASED: 'Released',
  in_progress: 'In Production', IN_PROGRESS: 'In Production',
  on_hold: 'On Hold', ON_HOLD: 'On Hold',
  completed: 'Selesai', COMPLETED: 'Selesai',
  closed: 'Closed', CLOSED: 'Closed',
  cancelled: 'Dibatalkan', CANCELLED: 'Dibatalkan',
};

const summaryWithAll = computed(() => {
  const total = wos.value.length;
  const all = [{ status: 'all', label: 'Semua', count: total }];
  const counts: Record<string, number> = {};
  for (const w of wos.value) {
    counts[w.status] = (counts[w.status] || 0) + 1;
  }
  const grouped = Object.entries(counts).map(([status, count]) => ({
    status, label: summaryMap[status] || status, count
  }));
  return [...all, ...grouped];
});

const filteredWOs = computed(() => {
  let list = wos.value;
  if (filterStatus.value !== 'all') list = list.filter(w => w.status === filterStatus.value);
  if (searchQ.value) {
    const q = searchQ.value.toLowerCase();
    list = list.filter(w =>
      w.wo_number?.toLowerCase().includes(q) ||
      w.product_name?.toLowerCase().includes(q) ||
      w.product_sku?.toLowerCase().includes(q)
    );
  }
  return list;
});

const productOptions = computed(() =>
  allProducts.value.map(p => ({ value: p.id, label: `${p.name} (${p.sku || '-'})` }))
);

const lineOptions = computed(() => {
  if (!form.value.product_id) return allLineProcesses.value.map(lp => ({ value: lp.id, label: lp.name }));
  return allLineProcesses.value
    .filter(lp => lp.products?.some((pp: any) => pp.product_id === Number(form.value.product_id)))
    .map(lp => ({ value: lp.id, label: `${lp.code ? lp.code + ' — ' : ''}${lp.name}` }));
});

let debounceTimer: any;
const debouncedLoad = () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => loadWOs(), 300);
};

const loadWOs = async () => {
  loading.value = true;
  try {
    const params: any = {};
    if (filterMonth.value && filterYear.value) { params.month = filterMonth.value; params.year = filterYear.value; }
    const woRes = await api.get('/workorders', { params });
    wos.value = woRes.data.data || [];
  } catch (e) { showToast('Gagal memuat WO', 'error'); }
  loading.value = false;
};

onMounted(async () => {
  await loadWOs();
  try {
    const [lpRes, prodRes] = await Promise.all([
      api.get('/line-processes'),
      api.get('/products'),
    ]);
    allLineProcesses.value = lpRes.data.data || [];
    allProducts.value = prodRes.data.data || [];
  } catch { /* silent */ }
});

const onProductChange = () => {
  const opts = lineOptions.value;
  if (opts.length === 1) form.value.line_process_id = opts[0].value;
  else form.value.line_process_id = '';
};

const openCreateModal = () => {
  editingWo.value = null;
  form.value = defaultForm();
  showModal.value = true;
};

const openEdit = async (wo: any) => {
  editingWo.value = wo;
  form.value = {
    product_id: wo.product_id,
    quantity: wo.quantity,
    line_process_id: wo.line_process_id || '',
    status: wo.status,
    priority: wo.priority || 'normal',
    scheduled_start: wo.scheduled_start || '',
    scheduled_end: wo.scheduled_end || '',
    actual_start: wo.actual_start || '',
    actual_end: wo.actual_end || '',
    completed_quantity: wo.completed_quantity || 0,
    notes: wo.notes || '',
    bom_id: wo.bom_id || null,
    source_reason: wo.source_reason || '',
  };
  showModal.value = true;
  // load reschedule history
  try {
    const res = await api.get(`/workorders/${wo.id}/reschedule-log`);
    rescheduleLog.value = res.data.data || [];
  } catch { rescheduleLog.value = []; }
};

const openDetail = (wo: any) => openEdit(wo);

const saveWO = async () => {
  if (!form.value.product_id || !form.value.quantity) {
    showToast('Produk dan Qty wajib diisi', 'warn');
    return;
  }
  saving.value = true;
  try {
    const payload = {
      product_id: form.value.product_id,
      bom_id: form.value.bom_id,
      quantity: form.value.quantity,
      line_process_id: form.value.line_process_id || null,
      status: form.value.status,
      priority: form.value.priority,
      scheduled_start: form.value.scheduled_start || null,
      scheduled_end: form.value.scheduled_end || null,
      actual_start: form.value.actual_start || null,
      actual_end: form.value.actual_end || null,
      completed_quantity: form.value.completed_quantity || 0,
      notes: form.value.notes || null,
    };
    if (editingWo.value) {
      await api.put(`/workorders/${editingWo.value.id}`, payload);
      showToast('WO berhasil diupdate', 'ok');
    } else {
      // manual create: include source_reason
      (payload as any).source_reason = form.value.source_reason;
      await api.post('/workorders', payload);
      showToast('WO berhasil dibuat', 'ok');
    }
    showModal.value = false;
    await loadWOs();
  } catch (e: any) {
    showToast(e?.response?.data?.error || 'Gagal menyimpan WO', 'error');
  }
  saving.value = false;
};

const quickStatusChange = async (wo: any, newStatus: string) => {
  if (wo.status === newStatus) return;
  try {
    const patch: any = { status: newStatus };
    if (newStatus === 'in_progress' && !wo.actual_start) patch.actual_start = new Date().toISOString().slice(0, 10);
    if (newStatus === 'completed' && !wo.actual_end) patch.actual_end = new Date().toISOString().slice(0, 10);
    await api.patch(`/workorders/${wo.id}/status`, patch);
    wo.status = newStatus;
    await loadWOs();
    showToast(`Status → ${newStatus}`, 'ok');
  } catch (e: any) {
    showToast(e?.response?.data?.error || 'Gagal update status', 'error');
  }
};

const confirmDelete = (wo: any) => { deletingWo.value = wo; showDeleteConfirm.value = true; };
const doDelete = async () => {
  if (!deletingWo.value) return;
  saving.value = true;
  try {
    await api.delete(`/workorders/${deletingWo.value.id}`);
    showDeleteConfirm.value = false;
    deletingWo.value = null;
    showToast('WO berhasil dihapus', 'ok');
    await loadWOs();
  } catch (e: any) {
    showToast(e?.response?.data?.error || 'Gagal hapus WO', 'error');
  }
  saving.value = false;
};

// ─── Helpers ───────────────────────────────────────────────
const formatN = (n: any) => {
  const num = Number(n);
  if (!num) return '0';
  return num % 1 === 0 ? num.toLocaleString('id') : num.toFixed(1);
};
const fmtDate = (d: string) => {
  if (!d) return '';
  // Handle ISO datetime (2026-06-07T00:00:00.000Z) or plain date (2026-06-07)
  const dateStr = d.slice(0, 10); // Always take YYYY-MM-DD part
  const [y, m, day] = dateStr.split('-').map(Number);
  if (!day || !m || !y) return d;
  return `${day}/${m}/${y}`;
};
const progressPct = (wo: any) => {
  const qty = Number(wo.quantity) || 0;
  const done = Number(wo.completed_quantity) || 0;
  if (!qty) return 0;
  return Math.min(100, Math.round((done / qty) * 100));
};
const progressColor = (wo: any) => {
  const p = progressPct(wo);
  if (p >= 100) return 'bg-emerald-500';
  if (p >= 50) return 'bg-blue-500';
  if (p > 0) return 'bg-amber-400';
  return 'bg-gray-300';
};

const STATUS_STYLES: Record<string, { bg: string, dot: string, activeBg: string }> = {
  'DRAFT':         { bg: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400',    activeBg: 'bg-gray-200 text-gray-800 border-gray-400' },
  'draft':         { bg: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400',    activeBg: 'bg-gray-200 text-gray-800 border-gray-400' },
  'approved':      { bg: 'bg-blue-50 text-blue-700',  dot: 'bg-blue-500',    activeBg: 'bg-blue-100 text-blue-800 border-blue-400' },
  'APPROVED':      { bg: 'bg-blue-50 text-blue-700',  dot: 'bg-blue-500',    activeBg: 'bg-blue-100 text-blue-800 border-blue-400' },
  'released':      { bg: 'bg-cyan-50 text-cyan-700',  dot: 'bg-cyan-500',    activeBg: 'bg-cyan-100 text-cyan-800 border-cyan-400' },
  'RELEASED':      { bg: 'bg-cyan-50 text-cyan-700',  dot: 'bg-cyan-500',    activeBg: 'bg-cyan-100 text-cyan-800 border-cyan-400' },
  'in_progress':   { bg: 'bg-purple-50 text-purple-700', dot: 'bg-purple-500', activeBg: 'bg-purple-100 text-purple-800 border-purple-400' },
  'IN_PROGRESS':   { bg: 'bg-purple-50 text-purple-700', dot: 'bg-purple-500', activeBg: 'bg-purple-100 text-purple-800 border-purple-400' },
  'on_hold':       { bg: 'bg-amber-50 text-amber-700', dot: 'bg-amber-400',  activeBg: 'bg-amber-100 text-amber-800 border-amber-400' },
  'ON_HOLD':       { bg: 'bg-amber-50 text-amber-700', dot: 'bg-amber-400',  activeBg: 'bg-amber-100 text-amber-800 border-amber-400' },
  'completed':     { bg: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', activeBg: 'bg-emerald-100 text-emerald-800 border-emerald-400' },
  'COMPLETED':     { bg: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', activeBg: 'bg-emerald-100 text-emerald-800 border-emerald-400' },
  'closed':        { bg: 'bg-slate-50 text-slate-600', dot: 'bg-slate-400',  activeBg: 'bg-slate-100 text-slate-800 border-slate-400' },
  'CLOSED':        { bg: 'bg-slate-50 text-slate-600', dot: 'bg-slate-400',  activeBg: 'bg-slate-100 text-slate-800 border-slate-400' },
  'cancelled':     { bg: 'bg-red-50 text-red-600',    dot: 'bg-red-400',     activeBg: 'bg-red-100 text-red-800 border-red-400' },
  'CANCELLED':     { bg: 'bg-red-50 text-red-600',    dot: 'bg-red-400',     activeBg: 'bg-red-100 text-red-800 border-red-400' },
};
const statusBg = (s: string) => STATUS_STYLES[s]?.bg || 'bg-gray-100 text-gray-600';
const statusColor = (s: string, active: boolean) => active ? (STATUS_STYLES[s]?.activeBg || 'bg-gray-200 border-gray-400') : '';
const statusDot = (s: string) => STATUS_STYLES[s]?.dot || 'bg-gray-400';

let toastTimer: any;
const showToast = (message: string, type: 'ok' | 'error' | 'warn' = 'ok') => {
  toast.value = { show: true, message, type };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.value.show = false; }, 3500);
};

// reschedule
const showRescheduleModal = ref(false);
const rescheduleWo = ref<any>(null);
const rescheduling = ref(false);
const rescheduleForm = ref({ new_week_number: 0, new_year: new Date().getFullYear(), new_quantity: 0, reason: '' });
const rescheduleLog = ref<any[]>([]);

const canReschedule = (wo: any): boolean => {
  const s = (wo.status || '').toUpperCase();
  return ['DRAFT', 'PENDING', 'PLANNED', 'APPROVED', 'RELEASED'].includes(s);
};

const canChangeQty = computed(() => {
  if (!rescheduleWo.value) return false;
  const s = (rescheduleWo.value.status || '').toUpperCase();
  return ['DRAFT', 'PENDING', 'PLANNED', 'APPROVED'].includes(s);
});

const openReschedule = (wo: any) => {
  rescheduleWo.value = wo;
  rescheduleForm.value = {
    new_week_number: wo.mps_week_number || wo.week_number || 1,
    new_year: wo.year || new Date().getFullYear(),
    new_quantity: Number(wo.quantity) || 0,
    reason: ''
  };
  showRescheduleModal.value = true;
};

const submitReschedule = async () => {
  if (!rescheduleWo.value || !rescheduleForm.value.reason) return;
  rescheduling.value = true;
  try {
    const payload: any = {
      new_week_number: rescheduleForm.value.new_week_number,
      new_year: rescheduleForm.value.new_year,
      reason: rescheduleForm.value.reason
    };
    if (canChangeQty.value && rescheduleForm.value.new_quantity > 0) {
      payload.new_quantity = rescheduleForm.value.new_quantity;
    }
    const { data } = await api.put(`/workorders/${rescheduleWo.value.id}/reschedule`, payload);
    if (data.changed) {
      showToast(`WO ${rescheduleWo.value.wo_number} rescheduled: W${data.old.week} → W${data.new.week}`, 'ok');
    } else {
      showToast('Tidak ada perubahan', 'warn');
    }
    showRescheduleModal.value = false;
    // summaryWithAll is computed from wos, so reloading the list refreshes the counters
    await loadWOs();
  } catch (e: any) {
    showToast(e.response?.data?.error || 'Gagal reschedule', 'error');
  } finally {
    rescheduling.value = false;
  }
};
</script>
