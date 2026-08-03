<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-900">
    <!-- Back nav + Header -->
    <div class="bg-gradient-to-r from-teal-600 to-cyan-700 text-white px-6 py-4 shadow-lg">
      <div class="flex items-center gap-3 mb-2">
        <button @click="router.push('/line-processes')"
          class="flex items-center gap-1.5 text-teal-100 hover:text-white text-sm transition-colors">
          ← Kembali ke List
        </button>
      </div>
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold tracking-wide">
            🏭 {{ line?.code ? `[${line.code}]` : '' }} {{ line?.name || 'Line Process Detail' }}
          </h1>
          <p class="text-teal-100 text-xs mt-0.5">{{ line?.description || 'Machine / Line Process Master Data' }}</p>
        </div>
        <div class="flex items-center gap-3">
          <span :class="line?.active ? 'bg-green-400/20 text-green-100 border border-green-400/40' : 'bg-red-400/20 text-red-100 border border-red-400/40'"
            class="px-3 py-1 rounded-full text-xs font-semibold">
            {{ line?.active ? '● Active' : '○ Inactive' }}
          </span>
          <button v-if="activeTab !== 'documents'" @click="saveGeneral"
            :disabled="saving"
            class="px-4 py-2 bg-white text-teal-700 rounded-lg font-semibold text-sm hover:bg-teal-50 transition-colors disabled:opacity-50 shadow">
            {{ saving ? 'Saving...' : '💾 Save' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-24 text-gray-400">
      <span class="animate-pulse text-lg">Loading...</span>
    </div>

    <div v-else-if="line">
      <!-- Tab Bar -->
      <div class="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6">
        <div class="flex gap-0">
          <button v-for="tab in tabs" :key="tab.key"
            @click="activeTab = tab.key"
            :class="activeTab === tab.key
              ? 'border-b-2 border-teal-600 text-teal-700 dark:text-teal-400 font-semibold bg-teal-50/50 dark:bg-teal-900/10'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'"
            class="px-5 py-3.5 text-sm transition-all border-b-2 border-transparent">
            {{ tab.label }}
          </button>
        </div>
      </div>

      <div class="max-w-4xl mx-auto px-6 py-6 space-y-6">

        <!-- ==================== TAB: GENERAL ==================== -->
        <div v-if="activeTab === 'general'" class="space-y-5">
          <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
            <h2 class="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
              📋 Informasi Umum
            </h2>
            <div class="grid grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Code</label>
                <input v-model="form.code" type="text" placeholder="e.g., LINE-01"
                  class="px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Name *</label>
                <input v-model="form.name" type="text" required placeholder="e.g., Homogenizer Tank 01"
                  class="px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
            </div>
            <div class="mt-4 flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</label>
              <textarea v-model="form.description" rows="3" placeholder="Deskripsi mesin / line proses..."
                class="px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
            </div>
            <div class="mt-4 flex items-center gap-2">
              <input id="lp-active" v-model="form.active" type="checkbox" class="w-4 h-4 rounded border-gray-300 accent-teal-600" />
              <label for="lp-active" class="text-sm font-medium text-gray-700 dark:text-gray-300">Active</label>
            </div>
          </div>

          <!-- Products -->
          <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
            <h2 class="font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
              📦 Products on This Line
              <span class="text-xs text-gray-400 font-normal ml-1">— produk yang dapat diproses di mesin ini</span>
            </h2>
            <div class="border border-gray-200 dark:border-slate-600 rounded-lg max-h-52 overflow-y-auto bg-gray-50 dark:bg-slate-700 p-2">
              <div v-if="bomProducts.length === 0" class="text-sm text-gray-400 text-center py-3">No BOM products found</div>
              <label v-for="prod in bomProducts" :key="prod.id"
                class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-600 cursor-pointer">
                <input type="checkbox" :value="prod.id" v-model="form.product_ids"
                  class="w-4 h-4 rounded border-gray-300 accent-teal-600" />
                <span class="text-sm text-gray-800 dark:text-gray-200">{{ prod.name }}</span>
                <span v-if="prod.sku" class="text-xs text-gray-400 ml-auto font-mono">{{ prod.sku }}</span>
              </label>
            </div>
            <p class="text-xs text-gray-500 mt-1.5">{{ form.product_ids.length }} product(s) selected</p>
          </div>
        </div>

        <!-- ==================== TAB: SHIFTS & CAPACITY ==================== -->
        <div v-if="activeTab === 'capacity'" class="space-y-5">
          <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
            <h2 class="font-semibold text-gray-800 dark:text-gray-100 mb-5 flex items-center gap-2">⚙️ Shift & Jam Kerja</h2>
            <div class="grid grid-cols-3 gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Shifts / Hari</label>
                <select v-model.number="form.shifts_per_day"
                  class="px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                  <option :value="1">1 Shift (pagi)</option>
                  <option :value="2">2 Shift (pagi + sore)</option>
                  <option :value="3">3 Shift (24 jam)</option>
                </select>
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Jam / Shift</label>
                <input v-model.number="form.hours_per_shift" type="number" step="0.5" min="1" max="12" placeholder="8"
                  class="px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Hari Kerja / Minggu</label>
                <input v-model.number="form.working_days_per_week" type="number" step="1" min="1" max="7" placeholder="5"
                  class="px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
            </div>

            <!-- Computed summary -->
            <div class="mt-5 grid grid-cols-3 gap-3">
              <div class="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-3 text-center border border-teal-100 dark:border-teal-800">
                <div class="text-xl font-bold text-teal-700 dark:text-teal-400">{{ hoursPerDay.toFixed(1) }}</div>
                <div class="text-xs text-teal-600 dark:text-teal-500 font-medium">jam / hari</div>
              </div>
              <div class="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-3 text-center border border-teal-100 dark:border-teal-800">
                <div class="text-xl font-bold text-teal-700 dark:text-teal-400">{{ hoursPerWeek.toFixed(0) }}</div>
                <div class="text-xs text-teal-600 dark:text-teal-500 font-medium">jam / minggu</div>
              </div>
              <div class="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center border border-purple-100 dark:border-purple-800">
                <div class="text-xl font-bold text-purple-700 dark:text-purple-400">{{ dailyCapacity.toLocaleString('id') }}</div>
                <div class="text-xs text-purple-600 dark:text-purple-500 font-medium">{{ line.unit_name || 'unit' }} / hari (kapasitas)</div>
              </div>
            </div>
          </div>

          <!-- Throughput -->
          <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
            <h2 class="font-semibold text-gray-800 dark:text-gray-100 mb-4">📊 Kapasitas Produksi</h2>
            <div class="grid grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Capacity / Hour</label>
                <div class="flex gap-2">
                  <input v-model.number="form.capacity_per_hour" type="number" step="0.01" placeholder="e.g., 800"
                    class="flex-1 px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  <span class="px-3 py-2 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 rounded-lg text-sm border border-gray-200 dark:border-slate-600">
                    {{ line.unit_name || '?' }}
                  </span>
                </div>
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Capacity Unit</label>
                <select v-model="form.capacity_unit_id"
                  class="px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                  <option :value="null">-- Pilih Unit --</option>
                  <option v-for="u in uomList" :key="u.id" :value="u.id">{{ u.name }}{{ u.code ? ` (${u.code})` : '' }}</option>
                </select>
              </div>
            </div>
            <!-- Max weekly capacity display -->
            <div class="mt-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-center justify-between">
              <span class="text-sm text-amber-800 dark:text-amber-400 font-medium">📦 Max Kapasitas / Minggu</span>
              <span class="font-bold text-amber-700 dark:text-amber-300 text-lg">
                {{ weeklyCapacity.toLocaleString('id') }} {{ line.unit_name || '' }} / wk
              </span>
            </div>
          </div>
        </div>

        <!-- ==================== TAB: ENERGY & SPECS ==================== -->
        <div v-if="activeTab === 'energy'" class="space-y-5">
          <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
            <h2 class="font-semibold text-gray-800 dark:text-gray-100 mb-4">🔧 Spesifikasi Mesin</h2>
            <div class="grid grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipe Mesin</label>
                <input v-model="form.machine_type" type="text" placeholder="e.g., Homogenizer, Mixer, Reactor"
                  class="px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Manufacturer</label>
                <input v-model="form.manufacturer" type="text" placeholder="e.g., Silverson, IKA"
                  class="px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tahun Instalasi</label>
                <input v-model.number="form.installation_year" type="number" min="1990" :max="new Date().getFullYear()" placeholder="2020"
                  class="px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Daya Listrik (kW)</label>
                <input v-model.number="form.power_kw" type="number" step="0.1" placeholder="e.g., 11.5"
                  class="px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
            </div>
          </div>

          <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
            <h2 class="font-semibold text-gray-800 dark:text-gray-100 mb-4">⚡ Energi & Utilitas</h2>
            <div class="flex flex-col gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Catatan Energi</label>
                <textarea v-model="form.energy_notes" rows="3"
                  placeholder="e.g., Konsumsi listrik rata-rata 8 kWh/batch, peak load saat start-up..."
                  class="px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Utilitas yang Dibutuhkan</label>
                <textarea v-model="form.utilities" rows="3"
                  placeholder="e.g., Steam 3 bar, Compressed Air 6 bar, Cooling Water, Nitrogen..."
                  class="px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
              </div>
            </div>
            <!-- Energy card if power_kw is set -->
            <div v-if="form.power_kw && form.power_kw > 0" class="mt-5 grid grid-cols-3 gap-3">
              <div class="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-center">
                <div class="text-xl font-bold text-yellow-700 dark:text-yellow-400">{{ form.power_kw }} kW</div>
                <div class="text-xs text-yellow-600 font-medium">Daya Terpasang</div>
              </div>
              <div class="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-center">
                <div class="text-xl font-bold text-yellow-700 dark:text-yellow-400">
                  {{ (form.power_kw * hoursPerDay).toFixed(1) }} kWh
                </div>
                <div class="text-xs text-yellow-600 font-medium">Estimasi / Hari</div>
              </div>
              <div class="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-center">
                <div class="text-xl font-bold text-yellow-700 dark:text-yellow-400">
                  {{ (form.power_kw * hoursPerWeek).toFixed(0) }} kWh
                </div>
                <div class="text-xs text-yellow-600 font-medium">Estimasi / Minggu</div>
              </div>
            </div>
          </div>
        </div>

        <!-- ==================== TAB: DOCUMENTS ==================== -->
        <div v-if="activeTab === 'documents'" class="space-y-5">
          <!-- Add document form -->
          <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
            <h2 class="font-semibold text-gray-800 dark:text-gray-100 mb-4">📎 Tambah Dokumen</h2>
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1.5 col-span-2">
                <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Judul Dokumen *</label>
                <input v-model="docForm.title" type="text" placeholder="e.g., Manual Operasi Homogenizer v2.0"
                  class="px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipe Dokumen</label>
                <select v-model="docForm.doc_type"
                  class="px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                  <option value="manual">📖 Manual</option>
                  <option value="certificate">🏆 Certificate</option>
                  <option value="sop">📋 SOP</option>
                  <option value="spec">📐 Spec Sheet</option>
                  <option value="drawing">📏 Drawing</option>
                  <option value="other">📄 Other</option>
                </select>
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Link / URL (opsional)</label>
                <input v-model="docForm.file_url" type="url" placeholder="https://..."
                  class="px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div class="flex flex-col gap-1.5 col-span-2">
                <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Catatan</label>
                <input v-model="docForm.notes" type="text" placeholder="Catatan singkat..."
                  class="px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
            </div>
            <div class="mt-4 flex justify-end">
              <button @click="addDocument" :disabled="savingDoc"
                class="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 shadow">
                {{ savingDoc ? 'Saving...' : '+ Tambah Dokumen' }}
              </button>
            </div>
          </div>

          <!-- Document list -->
          <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <h2 class="font-semibold text-gray-800 dark:text-gray-100">Daftar Dokumen</h2>
              <span class="text-xs text-gray-400">{{ documents.length }} dokumen</span>
            </div>
            <div v-if="documents.length === 0" class="px-6 py-10 text-center text-gray-400 text-sm">
              Belum ada dokumen. Tambahkan di atas.
            </div>
            <div v-else>
              <div v-for="doc in documents" :key="doc.id"
                class="px-6 py-3.5 border-b border-gray-50 dark:border-slate-700 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-slate-700/40">
                <div class="text-2xl mt-0.5">{{ docTypeIcon(doc.doc_type) }}</div>
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-sm text-gray-900 dark:text-gray-100">{{ doc.title }}</div>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span class="text-xs text-gray-400 capitalize bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">{{ doc.doc_type }}</span>
                    <span v-if="doc.notes" class="text-xs text-gray-400">{{ doc.notes }}</span>
                  </div>
                  <a v-if="doc.file_url" :href="doc.file_url" target="_blank"
                    class="text-xs text-teal-600 hover:text-teal-700 dark:text-teal-400 hover:underline mt-0.5 block truncate max-w-xs">
                    🔗 {{ doc.file_url }}
                  </a>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <span class="text-xs text-gray-300">{{ new Date(doc.created_at).toLocaleDateString('id') }}</span>
                  <button @click="deleteDocument(doc.id)"
                    class="px-2.5 py-1 text-xs bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded font-medium transition-colors">
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Save success toast -->
    <transition name="toast-fade">
      <div v-if="toastMsg"
        class="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold flex items-center gap-2 bg-teal-600 text-white">
        ✅ {{ toastMsg }}
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { api } from '../lib/api';

const router = useRouter();
const route = useRoute();

const line = ref<any>(null);
const loading = ref(true);
const saving = ref(false);
const savingDoc = ref(false);
const toastMsg = ref('');
const activeTab = ref('general');
const uomList = ref<any[]>([]);
const bomProducts = ref<any[]>([]);
const documents = ref<any[]>([]);

const tabs = [
  { key: 'general', label: '📋 General' },
  { key: 'capacity', label: '⚙️ Shifts & Capacity' },
  { key: 'energy', label: '⚡ Energy & Specs' },
  { key: 'documents', label: '📎 Documents' },
];

const form = ref({
  name: '',
  code: '',
  description: '',
  capacity_per_hour: null as number | null,
  capacity_unit_id: null as number | null,
  working_hours_per_week: 40,
  shifts_per_day: 1,
  hours_per_shift: 8,
  working_days_per_week: 5,
  machine_type: '',
  manufacturer: '',
  installation_year: null as number | null,
  power_kw: null as number | null,
  energy_notes: '',
  utilities: '',
  active: true,
  product_ids: [] as number[],
});

const docForm = ref({
  title: '',
  doc_type: 'other',
  file_url: '',
  notes: '',
});

// ========== Computed ==========
const hoursPerDay = computed(() =>
  (form.value.shifts_per_day || 1) * (form.value.hours_per_shift || 8)
);
const hoursPerWeek = computed(() =>
  hoursPerDay.value * (form.value.working_days_per_week || 5)
);
const dailyCapacity = computed(() =>
  Math.round((form.value.capacity_per_hour || 0) * hoursPerDay.value * 100) / 100
);
const weeklyCapacity = computed(() =>
  Math.round((form.value.capacity_per_hour || 0) * hoursPerWeek.value * 100) / 100
);

// ========== Load ==========
onMounted(async () => {
  await Promise.all([loadLine(), loadUOMs(), loadBomProducts()]);
});

const loadLine = async () => {
  loading.value = true;
  try {
    const res = await api.get(`/line-processes/${route.params.id}`);
    line.value = res.data.data;
    documents.value = res.data.data.documents || [];
    populateForm(res.data.data);
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
};

const populateForm = (d: any) => {
  form.value = {
    name: d.name || '',
    code: d.code || '',
    description: d.description || '',
    capacity_per_hour: d.capacity_per_hour ?? null,
    capacity_unit_id: d.capacity_unit_id ?? null,
    working_hours_per_week: d.working_hours_per_week || 40,
    shifts_per_day: d.shifts_per_day || 1,
    hours_per_shift: d.hours_per_shift || 8,
    working_days_per_week: d.working_hours_per_week
      ? Math.round(d.working_hours_per_week / (d.hours_per_shift || 8) / (d.shifts_per_day || 1))
      : 5,
    machine_type: d.machine_type || '',
    manufacturer: d.manufacturer || '',
    installation_year: d.installation_year ?? null,
    power_kw: d.power_kw ?? null,
    energy_notes: d.energy_notes || '',
    utilities: d.utilities || '',
    active: !!d.active,
    product_ids: (d.products || []).map((p: any) => p.product_id),
  };
};

const loadUOMs = async () => {
  try {
    const res = await api.get('/units');
    uomList.value = res.data.data || [];
  } catch {}
};

const loadBomProducts = async () => {
  try {
    const res = await api.get('/bom');
    const boms = res.data.data || res.data || [];
    const map = new Map<number, any>();
    for (const bom of boms) {
      if (bom.product_id && !map.has(bom.product_id)) {
        map.set(bom.product_id, { id: bom.product_id, name: bom.product_name || bom.name, sku: bom.sku || '' });
      }
    }
    bomProducts.value = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  } catch {}
};

// ========== Save ==========
const saveGeneral = async () => {
  saving.value = true;
  try {
    // Recalculate working_hours_per_week from shifts
    const wh = hoursPerWeek.value;
    const payload = {
      ...form.value,
      working_hours_per_week: wh,
    };
    await api.put(`/line-processes/${route.params.id}`, payload);
    // Update local line data
    const res = await api.get(`/line-processes/${route.params.id}`);
    line.value = res.data.data;
    showToast('Data berhasil disimpan');
  } catch (e: any) {
    alert(e?.response?.data?.error || 'Gagal menyimpan');
  } finally {
    saving.value = false;
  }
};

// ========== Documents ==========
const docTypeIcon = (type: string) => {
  const icons: Record<string, string> = { manual: '📖', certificate: '🏆', sop: '📋', spec: '📐', drawing: '📏', other: '📄' };
  return icons[type] || '📄';
};

const addDocument = async () => {
  if (!docForm.value.title.trim()) return;
  savingDoc.value = true;
  try {
    await api.post(`/line-processes/${route.params.id}/documents`, docForm.value);
    const res = await api.get(`/line-processes/${route.params.id}/documents`);
    documents.value = res.data.data || [];
    docForm.value = { title: '', doc_type: 'other', file_url: '', notes: '' };
    showToast('Dokumen ditambahkan');
  } catch (e: any) {
    alert(e?.response?.data?.error || 'Gagal menambahkan dokumen');
  } finally {
    savingDoc.value = false;
  }
};

const deleteDocument = async (docId: number) => {
  if (!confirm('Hapus dokumen ini?')) return;
  try {
    await api.delete(`/line-processes/${route.params.id}/documents/${docId}`);
    documents.value = documents.value.filter(d => d.id !== docId);
    showToast('Dokumen dihapus');
  } catch {}
};

// ========== Toast ==========
let toastTimer: any = null;
const showToast = (msg: string) => {
  toastMsg.value = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastMsg.value = ''; }, 3000);
};
</script>

<style scoped>
.toast-fade-enter-active, .toast-fade-leave-active { transition: all 0.3s ease; }
.toast-fade-enter-from, .toast-fade-leave-to { opacity: 0; transform: translateY(10px); }
</style>
