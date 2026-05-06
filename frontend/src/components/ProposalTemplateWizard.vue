<template>
  <div class="space-y-6">
    <!-- Step 1: Choose Work Type -->
    <div v-if="step === 1">
      <h3 class="text-lg font-semibold text-gray-800 mb-3">Pilih Jenis Pekerjaan</h3>
      <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
        <button
          v-for="wt in workTypes" :key="wt.id"
          @click="selectWorkType(wt.id)"
          class="p-4 border-2 rounded-xl text-left transition-all group"
          :class="selectedType === wt.id 
            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
            : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'"
        >
          <div class="flex items-start gap-3">
            <span class="text-2xl">{{ wt.icon }}</span>
            <div>
              <h4 class="font-semibold text-gray-800">{{ wt.name }}</h4>
              <p class="text-xs text-gray-500 mt-0.5">{{ wt.desc }}</p>
            </div>
          </div>
        </button>
      </div>
    </div>

    <!-- Step 2: Design Input + Preliminary Scope -->
    <div v-if="step === 2">
      <button @click="step = 1" class="text-sm text-blue-600 hover:text-blue-800 mb-3 flex items-center gap-1">
        ← Kembali pilih jenis pekerjaan
      </button>

      <h3 class="text-lg font-semibold text-gray-800 mb-1">
        {{ currentWorkType?.icon }} {{ currentWorkType?.name }}
      </h3>
      <p class="text-sm text-gray-500 mb-4">Masukkan parameter desain & pilih scope pekerjaan</p>

      <!-- Design Parameters (collapsible) -->
      <div class="border rounded-xl overflow-hidden mb-4">
        <button @click="showDesignParams = !showDesignParams" class="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors">
          <span class="font-semibold text-gray-700 text-sm">📐 Parameter Desain</span>
          <svg class="w-4 h-4 text-gray-500 transition-transform" :class="showDesignParams ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
        <div v-show="showDesignParams" class="p-4 border-t">
          <!-- Civil Bangunan -->
          <div v-if="selectedType === 'civil_building'" class="space-y-3">
            <div class="grid grid-cols-3 gap-3">
              <div><label class="block text-xs font-medium text-gray-600 mb-1">Panjang (m)</label><input v-model.number="design.length" type="number" step="0.1" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="30"></div>
              <div><label class="block text-xs font-medium text-gray-600 mb-1">Lebar (m)</label><input v-model.number="design.width" type="number" step="0.1" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="15"></div>
              <div><label class="block text-xs font-medium text-gray-600 mb-1">Tinggi (m)</label><input v-model.number="design.height" type="number" step="0.1" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="4"></div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div><label class="block text-xs font-medium text-gray-600 mb-1">Jumlah Lantai</label><input v-model.number="design.floors" type="number" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="1"></div>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Tipe Pondasi</label>
                <select v-model="design.foundation_type" class="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="footplate">Foot Plate</option><option value="bored_pile">Bored Pile</option><option value="mini_pile">Mini Pile</option><option value="sumuran">Pondasi Sumuran</option>
                </select>
              </div>
            </div>
          </div>
          <!-- Civil Struktur -->
          <div v-if="selectedType === 'civil_structure'" class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div><label class="block text-xs font-medium text-gray-600 mb-1">Tipe Struktur</label>
                <select v-model="design.structure_type" class="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="warehouse">Gudang / Warehouse</option><option value="tank_foundation">Pondasi Tank</option><option value="retaining_wall">Retaining Wall</option><option value="pipe_rack">Pipe Rack</option><option value="platform">Platform / Mezzanine</option>
                </select>
              </div>
              <div><label class="block text-xs font-medium text-gray-600 mb-1">Luas Area (m²)</label><input v-model.number="design.area" type="number" step="0.1" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="500"></div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div><label class="block text-xs font-medium text-gray-600 mb-1">Tinggi (m)</label><input v-model.number="design.height" type="number" step="0.1" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="6"></div>
              <div><label class="block text-xs font-medium text-gray-600 mb-1">Tipe Pondasi</label>
                <select v-model="design.foundation_type" class="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="footplate">Foot Plate</option><option value="bored_pile">Bored Pile</option><option value="mini_pile">Mini Pile</option><option value="pedestal">Pedestal</option>
                </select>
              </div>
            </div>
          </div>
          <!-- Piping -->
          <div v-if="selectedType === 'piping'" class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div><label class="block text-xs font-medium text-gray-600 mb-1">Tipe Proyek</label>
                <select v-model="design.piping_type" class="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="process">Process Piping</option><option value="utility">Utility Piping</option><option value="firefighting">Fire Fighting</option><option value="plumbing">Plumbing / Sanitary</option>
                </select>
              </div>
              <div><label class="block text-xs font-medium text-gray-600 mb-1">Material Utama</label>
                <select v-model="design.pipe_material" class="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="cs">Carbon Steel</option><option value="ss">Stainless Steel</option><option value="hdpe">HDPE</option><option value="pvc">PVC</option><option value="galv">Galvanized</option>
                </select>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div><label class="block text-xs font-medium text-gray-600 mb-1">Estimasi Total Dia.Inch</label><input v-model.number="design.total_dia_inch" type="number" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="500"></div>
              <div><label class="block text-xs font-medium text-gray-600 mb-1">Estimasi Total Panjang (m)</label><input v-model.number="design.total_length" type="number" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="200"></div>
            </div>
          </div>
          <!-- Electrical -->
          <div v-if="selectedType === 'electrical'" class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div><label class="block text-xs font-medium text-gray-600 mb-1">Tipe Pekerjaan</label>
                <select v-model="design.electrical_type" class="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="full">Full Electrical</option><option value="power">Power Distribution</option><option value="lighting">Lighting & Receptacle</option><option value="instrument">Instrumentation</option><option value="grounding">Grounding & Lightning</option>
                </select>
              </div>
              <div><label class="block text-xs font-medium text-gray-600 mb-1">Kapasitas (kVA)</label><input v-model.number="design.capacity_kva" type="number" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="200"></div>
            </div>
            <div><label class="block text-xs font-medium text-gray-600 mb-1">Luas Area (m²)</label><input v-model.number="design.area" type="number" step="0.1" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="500"></div>
          </div>
          <!-- Mechanical -->
          <div v-if="selectedType === 'mechanical'" class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div><label class="block text-xs font-medium text-gray-600 mb-1">Tipe Pekerjaan</label>
                <select v-model="design.mechanical_type" class="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="hvac">HVAC / AC</option><option value="pump">Pump & Rotating Equipment</option><option value="tank">Tank Fabrication & Erection</option><option value="conveyor">Conveyor System</option><option value="steel_fab">Steel Fabrication</option>
                </select>
              </div>
              <div><label class="block text-xs font-medium text-gray-600 mb-1">Luas / Kapasitas Area</label><input v-model.number="design.area" type="number" step="0.1" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="500 m²"></div>
            </div>
          </div>
          <!-- Others -->
          <div v-if="selectedType === 'others'">
            <p class="text-sm text-gray-500">Proposal kosong tanpa template — tambah section manual di editor.</p>
          </div>
        </div>
      </div>

      <!-- Scope Breakdown with Sub-Items -->
      <div class="border rounded-xl overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 bg-gray-50">
          <span class="font-semibold text-gray-700 text-sm">📋 Scope Breakdown RAB</span>
          <div class="flex items-center gap-3">
            <button @click="expandAll" class="text-xs text-blue-600 hover:text-blue-800">Expand All</button>
            <button @click="collapseAll" class="text-xs text-blue-600 hover:text-blue-800">Collapse All</button>
            <span class="text-gray-300">|</span>
            <label class="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
              <input type="checkbox" :checked="allChecked" @change="toggleAll" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5" />
              <span>{{ allChecked ? 'Uncheck All' : 'Check All' }}</span>
            </label>
          </div>
        </div>
        <div class="divide-y max-h-[45vh] overflow-y-auto">
          <div v-for="section in templateSections" :key="section.code">
            <!-- Section Header -->
            <div class="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 cursor-pointer select-none" @click="toggleExpand(section.code)">
              <input type="checkbox" 
                :checked="isSectionChecked(section.code)" 
                :indeterminate="isSectionIndeterminate(section.code)"
                @click.stop 
                @change="toggleSectionCheck(section.code)" 
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 flex-shrink-0" />
              <svg class="w-4 h-4 text-gray-400 transition-transform flex-shrink-0" :class="expandedSections.has(section.code) ? 'rotate-90' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
              </svg>
              <span class="text-blue-700 font-mono text-xs w-8 text-right flex-shrink-0">{{ section.code }}</span>
              <span class="font-semibold text-gray-800 text-sm">{{ section.name }}</span>
              <span class="ml-auto text-xs text-gray-400">{{ getCheckedSubCount(section.code) }}/{{ section.children.length }}</span>
            </div>
            <!-- Sub-Items -->
            <div v-show="expandedSections.has(section.code)" class="bg-gray-50/50">
              <label v-for="child in section.children" :key="child.key" 
                class="flex items-center gap-2 pl-14 pr-4 py-1.5 hover:bg-blue-50/50 cursor-pointer select-none transition-colors"
                :class="checkedItems.has(child.key) ? 'text-gray-700' : 'text-gray-400'">
                <input type="checkbox" 
                  :checked="checkedItems.has(child.key)" 
                  @change="toggleItem(child.key)" 
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 flex-shrink-0" />
                <span class="text-xs font-mono text-gray-400 w-6 flex-shrink-0">{{ child.num }}</span>
                <span class="text-sm" :class="checkedItems.has(child.key) ? '' : 'line-through'">{{ child.name }}</span>
              </label>
            </div>
          </div>
        </div>
        <div class="px-4 py-2 bg-gray-50 border-t">
          <p class="text-xs text-gray-400">* Centang section & sub-item yang dibutuhkan. Item terpilih akan menjadi baris RAB di proposal.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

interface SubItem {
  key: string;
  num: string;
  name: string;
}

interface TemplateSection {
  code: string;
  name: string;
  children: SubItem[];
}

const emit = defineEmits<{
  (e: 'type-selected', type: string | null): void;
  (e: 'ready', ready: boolean): void;
}>();

const step = ref(1);
const selectedType = ref<string | null>(null);
const showDesignParams = ref(true);
const design = ref<Record<string, any>>({
  foundation_type: 'footplate',
  structure_type: 'warehouse',
  piping_type: 'process',
  pipe_material: 'cs',
  electrical_type: 'full',
  mechanical_type: 'hvac',
  floors: 1,
});

const workTypes = [
  { id: 'civil_building', icon: '🏢', name: 'Civil Bangunan', desc: 'Gedung, kantor, pabrik, rumah tinggal, ruko' },
  { id: 'civil_structure', icon: '🏗️', name: 'Civil Struktur', desc: 'Gudang, pipe rack, platform, pondasi tank' },
  { id: 'piping', icon: '🔧', name: 'Piping', desc: 'Process piping, utility, fire fighting, plumbing' },
  { id: 'electrical', icon: '⚡', name: 'Electrical', desc: 'Power, lighting, grounding, instrumentation' },
  { id: 'mechanical', icon: '⚙️', name: 'Mechanical', desc: 'HVAC, pump, tank, conveyor, steel fabrication' },
  { id: 'others', icon: '📋', name: 'Others / Custom', desc: 'Template kosong, atur sendiri breakdown-nya' },
];

const currentWorkType = computed(() => workTypes.find(w => w.id === selectedType.value));

const selectWorkType = (id: string) => {
  selectedType.value = id;
  step.value = 2;
  emit('type-selected', id);
  emit('ready', true);
};

// ---- Checked state management ----
const checkedItems = ref<Set<string>>(new Set());
const expandedSections = ref<Set<string>>(new Set());

const toggleItem = (key: string) => {
  const s = new Set(checkedItems.value);
  if (s.has(key)) s.delete(key); else s.add(key);
  checkedItems.value = s;
};

const isSectionChecked = (code: string) => {
  const sec = templateSections.value.find(s => s.code === code);
  if (!sec || sec.children.length === 0) return false;
  return sec.children.every(c => checkedItems.value.has(c.key));
};

const isSectionIndeterminate = (code: string) => {
  const sec = templateSections.value.find(s => s.code === code);
  if (!sec) return false;
  const checkedCount = sec.children.filter(c => checkedItems.value.has(c.key)).length;
  return checkedCount > 0 && checkedCount < sec.children.length;
};

const toggleSectionCheck = (code: string) => {
  const sec = templateSections.value.find(s => s.code === code);
  if (!sec) return;
  const s = new Set(checkedItems.value);
  if (isSectionChecked(code)) {
    sec.children.forEach(c => s.delete(c.key));
  } else {
    sec.children.forEach(c => s.add(c.key));
  }
  checkedItems.value = s;
};

const getCheckedSubCount = (code: string) => {
  const sec = templateSections.value.find(s => s.code === code);
  if (!sec) return 0;
  return sec.children.filter(c => checkedItems.value.has(c.key)).length;
};

const allChecked = computed(() => {
  if (templateSections.value.length === 0) return false;
  return templateSections.value.every(s => isSectionChecked(s.code));
});

const toggleAll = () => {
  const s = new Set<string>();
  if (!allChecked.value) {
    templateSections.value.forEach(sec => sec.children.forEach(c => s.add(c.key)));
  }
  checkedItems.value = s;
};

const toggleExpand = (code: string) => {
  const s = new Set(expandedSections.value);
  if (s.has(code)) s.delete(code); else s.add(code);
  expandedSections.value = s;
};

const expandAll = () => {
  expandedSections.value = new Set(templateSections.value.map(s => s.code));
};

const collapseAll = () => {
  expandedSections.value = new Set();
};

// ---- Helpers ----
const mkChildren = (code: string, items: string[]): SubItem[] =>
  items.map((name, i) => ({ key: `${code}.${i + 1}`, num: `${i + 1}.`, name }));

// ---- Template section definitions per work type ----
const templateSections = computed<TemplateSection[]>(() => {
  switch (selectedType.value) {
    case 'civil_building':
      return [
        { code: 'I', name: 'Pekerjaan Persiapan', children: mkChildren('I', [
          'Mobilisasi & Demobilisasi Alat dan Material',
          'Papan Nama Proyek',
          'Pembuatan Direksi Keet',
          'Pengukuran & Bouwplank (Uitzet)',
          'Pembersihan Lahan (Land Clearing)',
          'Pagar Sementara Proyek (Hoarding)',
          'Gudang Material & Los Kerja',
          'Instalasi Listrik & Air Kerja Sementara',
          'K3 / Safety Equipment',
        ])},
        { code: 'II', name: 'Pekerjaan Tanah', children: mkChildren('II', [
          'Clearing & Grubbing Area',
          'Galian Tanah Pondasi',
          'Galian Tanah Sloof',
          'Urugan Tanah Kembali (Backfill)',
          'Urugan Pasir Bawah Pondasi',
          'Urugan Sirtu / Peninggian',
          'Pemadatan Tanah (Compaction)',
          'Pembuangan Tanah Bekas Galian',
        ])},
        { code: 'III', name: 'Pekerjaan Pondasi', children: mkChildren('III',
          design.value.foundation_type === 'bored_pile' ? [
            'Pengeboran Bored Pile',
            'Pembesian Bored Pile',
            'Pengecoran Bored Pile',
            'Pile Cap — Bekisting',
            'Pile Cap — Pembesian',
            'Pile Cap — Pengecoran',
          ] : design.value.foundation_type === 'mini_pile' ? [
            'Pemancangan Mini Pile',
            'Pile Cap — Bekisting',
            'Pile Cap — Pembesian',
            'Pile Cap — Pengecoran',
          ] : design.value.foundation_type === 'sumuran' ? [
            'Galian Pondasi Sumuran',
            'Pasangan Batu Kali Pondasi',
            'Pengecoran Pondasi Sumuran',
          ] : [
            'Lantai Kerja (Lean Concrete) t=5cm',
            'Foot Plate — Bekisting',
            'Foot Plate — Pembesian',
            'Foot Plate — Pengecoran',
          ]
        )},
        { code: 'IV', name: 'Pekerjaan Struktur Beton', children: mkChildren('IV', [
          'Sloof — Bekisting',
          'Sloof — Pembesian',
          'Sloof — Pengecoran',
          'Kolom — Bekisting',
          'Kolom — Pembesian',
          'Kolom — Pengecoran',
          'Ring Balok — Bekisting',
          'Ring Balok — Pembesian',
          'Ring Balok — Pengecoran',
          'Balok Lantai — Bekisting',
          'Balok Lantai — Pembesian',
          'Balok Lantai — Pengecoran',
          'Plat Lantai — Bekisting',
          'Plat Lantai — Pembesian',
          'Plat Lantai — Pengecoran',
        ])},
        { code: 'V', name: 'Pekerjaan Dinding & Pasangan', children: mkChildren('V', [
          'Pasangan Bata Ringan / Hebel',
          'Plesteran Dinding',
          'Acian Dinding',
          'Benangan / Tali Air',
          'Pasangan Batu Bata (jika ada)',
          'Dinding Partisi (jika ada)',
        ])},
        { code: 'VI', name: 'Pekerjaan Atap & Rangka', children: mkChildren('VI', [
          'Rangka Atap Baja Ringan / Baja',
          'Pemasangan Penutup Atap (Genteng/Spandek/Galvalum)',
          'Bubungan / Ridge',
          'Lisplang & Talang Air',
          'Flashing & Sealant',
          'Insulation Atap (jika ada)',
        ])},
        { code: 'VII', name: 'Pekerjaan Plafond', children: mkChildren('VII', [
          'Rangka Plafond Hollow / Metal Furing',
          'Pemasangan Plafond Gypsum / Kalsiboard',
          'List Plafond / Profil',
        ])},
        { code: 'VIII', name: 'Pekerjaan Lantai', children: mkChildren('VIII', [
          'Urugan Pasir Bawah Lantai',
          'Cor Lantai Kerja',
          'Pemasangan Keramik Lantai',
          'Pemasangan Keramik KM/WC',
          'Pemasangan Keramik Dinding KM/WC',
          'Floor Hardener (jika ada)',
          'Waterproofing KM/WC',
        ])},
        { code: 'IX', name: 'Pekerjaan Pintu & Jendela', children: mkChildren('IX', [
          'Kusen Aluminium / Kayu',
          'Daun Pintu Panel / Hollow',
          'Daun Jendela Kaca',
          'Pintu KM/WC PVC',
          'Hardware (Handle, Engsel, Kunci)',
          'Pintu Rolling Door (jika ada)',
        ])},
        { code: 'X', name: 'Pekerjaan Pengecatan', children: mkChildren('X', [
          'Cat Dinding Dalam (Interior)',
          'Cat Dinding Luar (Exterior)',
          'Cat Plafond',
          'Cat Lisplang & Talang',
          'Cat Besi / Anti Karat',
        ])},
        { code: 'XI', name: 'Pekerjaan Sanitasi & Plumbing', children: mkChildren('XI', [
          'Instalasi Pipa Air Bersih (PVC/PPR)',
          'Instalasi Pipa Air Kotor & Buangan',
          'Instalasi Pipa Vent',
          'Pemasangan Closet Duduk / Jongkok',
          'Pemasangan Wastafel',
          'Pemasangan Floor Drain',
          'Pemasangan Kran Air',
          'Septictank Bio / Konvensional',
          'Bak Kontrol',
          'Saluran Drainase Lingkungan',
        ])},
        { code: 'XII', name: 'Pekerjaan Listrik', children: mkChildren('XII', [
          'Instalasi Panel Listrik (MCB/MCCB)',
          'Instalasi Kabel NYM / NYY',
          'Instalasi Conduit / Pipa PVC',
          'Instalasi Titik Lampu',
          'Instalasi Stop Kontak',
          'Instalasi Saklar',
          'Lampu TL / LED / Downlight',
          'Grounding System',
          'Penangkal Petir',
        ])},
        { code: 'XIII', name: 'Pekerjaan Lain-lain & Finishing', children: mkChildren('XIII', [
          'Pekerjaan Taman & Landscape',
          'Paving Block / Carport',
          'Pagar & Pintu Gerbang',
          'Saluran Keliling Bangunan',
          'Railling Tangga / Balkon',
          'Bak Sampah / Pos Jaga (jika ada)',
          'Pembersihan Akhir (Final Cleaning)',
        ])},
      ];

    case 'civil_structure':
      return [
        { code: 'I', name: 'Pekerjaan Persiapan', children: mkChildren('I', [
          'Mobilisasi & Demobilisasi',
          'Papan Nama Proyek',
          'Pembuatan Direksi Keet',
          'Pengukuran & Uitzet',
          'Pembersihan Lahan',
          'K3 / Safety Equipment',
        ])},
        { code: 'II', name: 'Pekerjaan Tanah & Urugan', children: mkChildren('II', [
          'Clearing & Grubbing',
          'Galian Tanah Pondasi / Pedestal',
          'Urugan Pasir',
          'Urugan Sirtu / Sub-base',
          'Pemadatan Tanah',
          'Pembuangan Tanah Sisa',
        ])},
        { code: 'III', name: 'Pekerjaan Pondasi', children: mkChildren('III', [
          'Lantai Kerja (Lean Concrete)',
          'Pondasi — Bekisting',
          'Pondasi — Pembesian',
          'Pondasi — Pengecoran',
          'Pedestal — Bekisting',
          'Pedestal — Pembesian',
          'Pedestal — Pengecoran',
          'Anchor Bolt Pemasangan',
        ])},
        { code: 'IV', name: 'Pekerjaan Beton (Tie Beam, Slab)', children: mkChildren('IV', [
          'Tie Beam — Bekisting',
          'Tie Beam — Pembesian',
          'Tie Beam — Pengecoran',
          'Slab on Grade — Wiremesh / Pembesian',
          'Slab on Grade — Pengecoran',
          'Retaining Wall — Bekisting (jika ada)',
          'Retaining Wall — Pembesian (jika ada)',
          'Retaining Wall — Pengecoran (jika ada)',
        ])},
        { code: 'V', name: 'Pekerjaan Struktur Baja', children: mkChildren('V', [
          'Fabrikasi Baja Kolom (H-Beam/WF)',
          'Fabrikasi Baja Rafter / Truss',
          'Fabrikasi Bracing & Purlin',
          'Erection Kolom Baja',
          'Erection Rafter & Truss',
          'Erection Bracing, Purlin, Sagrod',
          'Baut Sambungan (High Strength Bolt)',
          'Pengelasan (Welding)',
          'Pengecatan Baja (Primer + Finish)',
        ])},
        { code: 'VI', name: 'Pekerjaan Atap & Cladding', children: mkChildren('VI', [
          'Pemasangan Atap Metal Sheet (Zincalume/Galvalum)',
          'Pemasangan Dinding Cladding',
          'Flashing & Accessories',
          'Talang & Downpipe',
          'Skylight / Ventilator (jika ada)',
        ])},
        { code: 'VII', name: 'Pekerjaan Floor Hardener / Coating', children: mkChildren('VII', [
          'Floor Hardener Application',
          'Epoxy Floor Coating (jika ada)',
          'Joint Sealant / Cutting',
        ])},
        { code: 'VIII', name: 'Pekerjaan Drainage', children: mkChildren('VIII', [
          'Saluran Drainase U-Ditch',
          'Bak Kontrol',
          'Gorong-gorong / Culvert',
          'Pemasangan Grating',
        ])},
        { code: 'IX', name: 'Pekerjaan Lain-lain', children: mkChildren('IX', [
          'Pekerjaan Paving / Jalan Akses',
          'Pagar & Pintu Gerbang',
          'Final Cleaning',
        ])},
      ];

    case 'piping':
      return [
        { code: 'I', name: 'Pekerjaan Persiapan & Mobilisasi', children: mkChildren('I', [
          'Mobilisasi & Demobilisasi',
          'Survey & Pengukuran Rute Pipa',
          'Pembuatan Shop Drawing / Isometric',
          'K3 / Safety Equipment',
        ])},
        { code: 'II', name: 'Material Pipa (Supply)', children: mkChildren('II', [
          'Pipa Carbon Steel (Berbagai Size)',
          'Pipa Stainless Steel (jika ada)',
          'Pipa HDPE / PVC (jika ada)',
          'Pipa Galvanized (jika ada)',
        ])},
        { code: 'III', name: 'Material Fitting & Flange', children: mkChildren('III', [
          'Elbow (45° / 90°)',
          'Tee / Reducer',
          'Flange (WN / SO / Blind)',
          'Gasket & Bolt-Nut Set',
          'Coupling / Union',
        ])},
        { code: 'IV', name: 'Material Valve', children: mkChildren('IV', [
          'Gate Valve',
          'Ball Valve',
          'Check Valve',
          'Butterfly Valve',
          'Globe Valve (jika ada)',
        ])},
        { code: 'V', name: 'Material Support & Hanger', children: mkChildren('V', [
          'Pipe Shoe / Rest',
          'U-Bolt / Clamp',
          'Hanger Rod Assembly',
          'Guide & Anchor',
          'Spring Hanger (jika ada)',
        ])},
        { code: 'VI', name: 'Pekerjaan Fabrikasi Pipa', children: mkChildren('VI', [
          'Cutting & Beveling',
          'Fit-up & Alignment',
          'Fabrikasi Spool Piece',
          'Pre-fabrication Welding',
        ])},
        { code: 'VII', name: 'Pekerjaan Ereksi & Instalasi', children: mkChildren('VII', [
          'Ereksi Pipa (Elevated)',
          'Instalasi Pipa (Underground)',
          'Instalasi Pipa (Aboveground)',
          'Pemasangan Valve & Fitting',
          'Pemasangan Support & Hanger',
        ])},
        { code: 'VIII', name: 'Pekerjaan Pengelasan (Welding)', children: mkChildren('VIII', [
          'Welding Butt Joint (SMAW/GTAW)',
          'Welding Socket Joint',
          'Welding Branch Connection',
          'NDT — Radiography (RT)',
          'NDT — Dye Penetrant (PT)',
        ])},
        { code: 'IX', name: 'Pekerjaan Testing', children: mkChildren('IX', [
          'Hydrotest',
          'Pneumatic Test',
          'Flushing & Cleaning',
          'Service Test / Leak Test',
        ])},
        { code: 'X', name: 'Pekerjaan Insulation & Painting', children: mkChildren('X', [
          'Sandblasting / Surface Preparation',
          'Pengecatan Primer',
          'Pengecatan Intermediate + Top Coat',
          'Insulation Pipa (Rockwool/Calcium Silicate)',
          'Aluminium Cladding Insulation',
          'Color Coding / Labeling',
        ])},
        { code: 'XI', name: 'Pekerjaan Civil (Pipe Support Foundation)', children: mkChildren('XI', [
          'Pondasi Pipe Support',
          'Pedestal Beton',
          'Sleeper Beton',
          'Galian & Urugan Pipa Underground',
        ])},
      ];

    case 'electrical':
      return [
        { code: 'I', name: 'Pekerjaan Persiapan & Mobilisasi', children: mkChildren('I', [
          'Mobilisasi & Demobilisasi',
          'Survey Rute Kabel & Tray',
          'Pembuatan Shop Drawing',
          'K3 / Safety Equipment',
        ])},
        { code: 'II', name: 'Panel & Switchgear', children: mkChildren('II', [
          'Panel MDP (Main Distribution Panel)',
          'Panel SDP (Sub Distribution Panel)',
          'Panel Capacitor Bank',
          'Panel ATS / AMF (jika ada)',
          'MCC Panel (Motor Control Center)',
          'Pemasangan & Wiring Panel',
        ])},
        { code: 'III', name: 'Pekerjaan Kabel Power', children: mkChildren('III', [
          'Kabel Power (NYY / XLPE)',
          'Kabel Feeder Utama',
          'Kabel Distribusi',
          'Kabel Tray Filling & Laying',
          'Terminasi & Jointing Kabel',
          'Cable Gland & Accessories',
        ])},
        { code: 'IV', name: 'Pekerjaan Cable Tray & Conduit', children: mkChildren('IV', [
          'Cable Tray / Ladder Type',
          'Cable Tray Perforated',
          'Conduit (Rigid / Flexible)',
          'Support & Bracket Cable Tray',
          'Fitting & Accessories',
        ])},
        { code: 'V', name: 'Pekerjaan Lighting & Receptacle', children: mkChildren('V', [
          'Lampu LED / TL Industrial',
          'Lampu Emergency',
          'Lampu Explosion Proof (jika ada)',
          'Stop Kontak Industrial',
          'Switch / Saklar',
          'Junction Box & Accessories',
        ])},
        { code: 'VI', name: 'Pekerjaan Grounding & Lightning', children: mkChildren('VI', [
          'Grounding Rod (Copper)',
          'Grounding Cable (BC)',
          'Grounding Bus Bar',
          'Penangkal Petir (Lightning Rod)',
          'Down Conductor',
          'Testing & Pengukuran Tahanan',
        ])},
        { code: 'VII', name: 'Pekerjaan Instrumentasi', children: mkChildren('VII', [
          'Kabel Instrumen (Shielded)',
          'Instrument Cable Tray',
          'Junction Box Instrumen',
          'Pemasangan Instrument (Sensor, Transmitter)',
          'Calibration',
        ])},
        { code: 'VIII', name: 'Pekerjaan Testing & Commissioning', children: mkChildren('VIII', [
          'Megger Test (Insulation Resistance)',
          'Continuity Test',
          'Relay Protection Test',
          'Phasing & Rotation Check',
          'Energizing & Load Test',
          'Commissioning Report',
        ])},
      ];

    case 'mechanical':
      return [
        { code: 'I', name: 'Pekerjaan Persiapan & Mobilisasi', children: mkChildren('I', [
          'Mobilisasi & Demobilisasi',
          'Survey & Layout',
          'Pembuatan Shop Drawing',
          'K3 / Safety Equipment',
        ])},
        { code: 'II', name: 'Material & Equipment Supply', children: mkChildren('II', [
          'Material Plat / Profil Baja',
          'Material Baut, Mur, Washer',
          'Welding Consumable',
          'Equipment / Machinery Supply',
        ])},
        { code: 'III', name: 'Pekerjaan Fabrikasi', children: mkChildren('III', [
          'Cutting & Marking',
          'Drilling & Punching',
          'Rolling & Bending',
          'Pengelasan Fabrikasi',
          'Assembly / Sub-assembly',
          'Trial Assembly (jika ada)',
          'Quality Inspection (QC)',
        ])},
        { code: 'IV', name: 'Pekerjaan Erection & Instalasi', children: mkChildren('IV', [
          'Rigging & Lifting',
          'Setting / Alignment Equipment',
          'Bolting & Tightening',
          'Grouting (Epoxy / Cementitious)',
          'Shaft Alignment (jika rotating)',
          'Piping Connection',
        ])},
        { code: 'V', name: 'Pekerjaan Piping Terkait', children: mkChildren('V', [
          'Piping Inlet / Outlet Equipment',
          'Drain & Vent Piping',
          'Cooling Water Piping',
          'Instrument Piping (Tubing)',
        ])},
        { code: 'VI', name: 'Pekerjaan Electrical Terkait', children: mkChildren('VI', [
          'Kabel Power Motor',
          'Kabel Instrument / Signal',
          'Junction Box / Terminal Box',
          'Local Panel (jika ada)',
        ])},
        { code: 'VII', name: 'Pekerjaan Insulation & Painting', children: mkChildren('VII', [
          'Surface Preparation',
          'Pengecatan Primer + Top Coat',
          'Insulation (jika ada)',
          'Fireproofing (jika ada)',
        ])},
        { code: 'VIII', name: 'Testing & Commissioning', children: mkChildren('VIII', [
          'No-Load Test / Solo Run',
          'Performance Test',
          'Vibration Test',
          'Commissioning & Handover',
        ])},
      ];

    default:
      return [];
  }
});

// When sections change, auto-check all items and expand first 3
watch(templateSections, (sections) => {
  const allKeys = new Set<string>();
  sections.forEach(sec => sec.children.forEach(c => allKeys.add(c.key)));
  checkedItems.value = allKeys;
  expandedSections.value = new Set(sections.slice(0, 3).map(s => s.code));
}, { immediate: true });

// Public API
const getResult = () => ({
  type: selectedType.value,
  design_params: { ...design.value },
  template_sections: templateSections.value
    .filter(sec => sec.children.some(c => checkedItems.value.has(c.key)))
    .map(sec => ({
      code: sec.code,
      name: sec.name,
      description: '',
      children: sec.children
        .filter(c => checkedItems.value.has(c.key))
        .map(c => ({ num: c.num, name: c.name })),
    })),
});

defineExpose({ getResult, templateSections, selectedType });
</script>
