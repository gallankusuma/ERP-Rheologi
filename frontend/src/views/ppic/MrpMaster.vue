<template>
  <div class="h-full flex flex-col bg-slate-100">
    <!-- Header -->
    <div class="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-lg font-bold tracking-wide">📦 Material Requirement Planning (MRP) .........YEAR: {{ selectedYear }}</h1>
          <p class="text-xs text-orange-100">Aggregated from all active MPS</p>
        </div>
        <div class="flex items-center gap-2">
          <div class="relative">
            <span class="text-sm font-medium mr-1">Filter:</span>
            <input v-model="filterText" type="text" placeholder="Type to filter..."
              class="bg-white/20 border border-white/30 rounded px-3 py-1.5 text-sm text-white placeholder-orange-200 w-48" />
          </div>
          <select v-model="selectedYear" @change="loadMrp" class="bg-white/20 border border-white/30 rounded px-2 py-1.5 text-sm text-white">
            <option v-for="y in yearOptions" :key="y" :value="y" class="text-gray-900">{{ y }}</option>
          </select>
          <button v-if="isDirty" @click="saveAll" :disabled="saving"
            class="px-3 py-1.5 bg-white text-orange-700 rounded font-semibold text-sm hover:bg-orange-50 disabled:opacity-50"
            :class="isDirty ? 'ring-2 ring-white/50' : ''">
            {{ saving ? '...' : '💾 Save' }}
          </button>
          <button v-if="materialsWithNetReq.length > 0" @click="openGeneratePRModal"
            class="px-3 py-1.5 bg-emerald-600 text-white rounded font-semibold text-sm hover:bg-emerald-700 shadow-md transition-all duration-200 hover:shadow-lg hover:scale-105">
            🛒 Generate PR ({{ materialsWithNetReq.length }})
          </button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-auto p-4">
      <!-- Loading / Empty -->
      <div v-if="loading" class="text-center py-16 text-gray-500">Loading MRP data...</div>
      <div v-else-if="filteredMaterials.length === 0" class="text-center py-16">
        <div class="text-5xl mb-3">📭</div>
        <h3 class="text-lg font-medium text-gray-600">No MRP data</h3>
        <p class="text-sm text-gray-400 mt-1">Create an MPS with FG quantities to generate MRP</p>
      </div>

      <!-- ========== MAIN MRP GRID ========== -->
      <div v-else class="bg-white rounded-lg shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full border-collapse text-sm" style="min-width: 1600px">
            <thead>
              <tr class="bg-gradient-to-r from-orange-500 to-amber-500 text-white">
                <th class="px-3 py-2.5 text-center border-r border-orange-400 w-10 sticky left-0 z-30 bg-orange-500 text-sm">No</th>
                <th class="px-3 py-2.5 text-center border-r border-orange-400 w-[150px] min-w-[150px] sticky left-10 z-30 bg-orange-500 text-sm">REMARK</th>
                <th class="px-3 py-2.5 text-center border-r border-orange-400 w-[130px] min-w-[130px] sticky left-[190px] z-30 bg-orange-500 text-sm">PRODUCT</th>
                <th class="px-3 py-2.5 text-center border-r border-orange-400 w-[170px] min-w-[170px] sticky left-[320px] z-30 bg-orange-500 text-sm">TASK</th>
                <th class="px-3 py-2.5 text-center border-r border-orange-400 w-[70px] text-sm">TOTAL</th>
                <th class="px-2 py-2.5 text-center border-r border-orange-400 w-[50px] text-sm">UOM</th>
                <th v-for="wc in weekColumns" :key="'h-'+wc.week+'-'+wc.year"
                  class="px-1 py-2.5 text-center border-r border-orange-400 w-[90px] min-w-[90px]">
                  <div class="font-bold text-sm">{{ wc.label }}</div>
                  <div class="text-[10px] text-orange-200">{{ wc.dateRange }}</div>
                </th>
              </tr>
            </thead>
            <tbody>
              <template v-for="(mat, mIdx) in filteredMaterials" :key="mat.material_id">
                <!-- Row 1: Gross Requirements -->
                <tr class="border-b border-gray-100">
                  <td :rowspan="5" class="px-2 py-1 text-center font-bold text-gray-500 border-r bg-gray-50 sticky left-0 z-20 align-top pt-4 text-sm"
                    style="border-bottom: 3px solid #f97316">{{ mIdx + 1 }}</td>
                  <!-- REMARK (rowspan 5) -->
                  <td :rowspan="5" class="px-2 py-2 border-r bg-gradient-to-b from-orange-50 to-amber-50 sticky left-10 z-20 align-top"
                    style="border-bottom: 3px solid #f97316">
                    <div class="space-y-1.5">
                      <div class="bg-orange-500 text-white rounded px-2 py-1.5 flex items-center justify-between">
                        <span class="text-[11px] font-bold">LEAD_TIME</span>
                        <div class="flex items-center gap-0.5">
                          <input v-model.number="mat.lead_time" type="number" min="1" @input="isDirty = true"
                            class="w-8 text-right bg-white/20 border-0 rounded px-0.5 py-0.5 text-[11px] text-white font-bold" />
                          <span class="text-[10px]">Week</span>
                        </div>
                      </div>
                      <div class="bg-orange-400 text-white rounded px-2 py-1.5 flex items-center justify-between">
                        <span class="text-[11px] font-bold">1st_STOCK</span>
                        <input v-model.number="mat.first_stock" type="number" min="0" @input="isDirty = true"
                          class="w-16 text-right bg-white/20 border-0 rounded px-1 py-0.5 text-[11px] text-white font-bold" placeholder="0" />
                      </div>
                      <div class="bg-orange-500 text-white rounded px-2 py-1.5 flex items-center justify-between">
                        <span class="text-[11px] font-bold">ORDER_QTY</span>
                        <input v-model.number="mat.order_quantity" type="number" min="0" @input="isDirty = true"
                          class="w-16 text-right bg-white/20 border-0 rounded px-1 py-0.5 text-[11px] text-white font-bold" placeholder="0" />
                      </div>
                    </div>
                  </td>
                  <!-- PRODUCT (rowspan 5) -->
                  <td :rowspan="5" class="px-3 py-2 border-r sticky left-[190px] z-20 align-middle text-center bg-white"
                    style="border-bottom: 3px solid #f97316">
                    <div class="text-[10px] text-orange-600 font-bold">{{ mat.product_type_code || 'RM' }}-{{ mIdx + 1 }}</div>
                    <div class="font-bold text-gray-900 text-[13px] mt-1 leading-tight">{{ mat.material_name }}</div>
                    <div class="text-[10px] text-gray-400 mt-0.5">{{ mat.uom_name || 'Kgs' }}</div>
                  </td>
                  <!-- TASK: Gross Requirements -->
                  <td class="px-1 py-1 border-r sticky left-[320px] z-20 bg-white">
                    <div class="bg-blue-500 text-white rounded px-2 py-2 text-[11px] font-bold">📊 Gross_Requirements</div>
                  </td>
                  <td class="px-1 py-1 text-center border-r font-bold text-sm" :class="cellCls(rowTotal(mat, 'gross_requirements'))">
                    {{ formatN(rowTotal(mat, 'gross_requirements')) }}</td>
                  <!-- UOM rowspan 5 -->
                  <td :rowspan="5" class="px-1 py-1 text-center border-r bg-gray-50 align-middle font-semibold text-gray-600 text-[11px]"
                    style="border-bottom: 3px solid #f97316">
                    {{ mat.uom_name || 'Kgs' }}
                  </td>
                  <td v-for="(wc, wIdx) in weekColumns" :key="'gr-'+mat.material_id+'-'+wc.week"
                    class="px-0 py-0.5 text-center border-r">
                    <div class="py-1 text-[11px] font-medium" :class="cellCls(mat.weeks[wIdx]?.gross_requirements || 0)">
                      {{ formatN(mat.weeks[wIdx]?.gross_requirements || 0) }}</div>
                  </td>
                </tr>

                <!-- Row 2: Planned Order Release -->
                <tr class="border-b border-gray-100">
                  <td class="px-1 py-1 border-r sticky left-[320px] z-20 bg-white">
                    <div class="bg-green-600 text-white rounded px-2 py-2 text-[11px] font-bold">📤 Planned_Order_RELEASE</div>
                  </td>
                  <td class="px-1 py-1 text-center border-r font-bold text-sm" :class="cellCls(rowTotal(mat, 'planned_order_release'))">
                    {{ formatN(rowTotal(mat, 'planned_order_release')) }}</td>
                  <td v-for="(wc, wIdx) in weekColumns" :key="'rel-'+mat.material_id+'-'+wc.week"
                    class="px-0 py-0.5 text-center border-r">
                    <input v-model.number="mat.weeks[wIdx].planned_order_release" type="number" min="0"
                      @input="isDirty = true"
                      class="w-full border-0 bg-green-50 text-center text-[11px] font-medium py-1.5 text-green-800 focus:bg-green-100" />
                  </td>
                </tr>

                <!-- Row 3: Planned Order Received -->
                <tr class="border-b border-gray-100">
                  <td class="px-1 py-1 border-r sticky left-[320px] z-20 bg-white">
                    <div class="bg-green-500 text-white rounded px-2 py-2 text-[11px] font-bold">📥 Planned_Order_RECEIVED</div>
                  </td>
                  <td class="px-1 py-1 text-center border-r font-bold text-sm" :class="cellCls(rowTotal(mat, 'planned_order_receipt'))">
                    {{ formatN(rowTotal(mat, 'planned_order_receipt')) }}</td>
                  <td v-for="(wc, wIdx) in weekColumns" :key="'rec-'+mat.material_id+'-'+wc.week"
                    class="px-0 py-0.5 text-center border-r">
                    <input v-model.number="mat.weeks[wIdx].planned_order_receipt" type="number" min="0"
                      @input="isDirty = true"
                      class="w-full border-0 bg-green-50 text-center text-[11px] font-medium py-1.5 text-green-800 focus:bg-green-100" />
                  </td>
                </tr>

                <!-- Row 4: Net Requirements (calculated) -->
                <tr class="border-b border-gray-100">
                  <td class="px-1 py-1 border-r sticky left-[320px] z-20 bg-white">
                    <div class="bg-yellow-500 text-white rounded px-2 py-2 text-[11px] font-bold">⚠ Net_Requirements</div>
                  </td>
                  <td class="px-1 py-1 text-center border-r font-bold text-sm bg-gray-50 text-gray-400">—</td>
                  <td v-for="(wc, wIdx) in weekColumns" :key="'nr-'+mat.material_id+'-'+wc.week"
                    class="px-0 py-0.5 text-center border-r">
                    <div class="py-1 text-[11px] font-medium rounded mx-0.5" :class="cellCls(getNetReq(mat, wIdx))">
                      {{ formatN(getNetReq(mat, wIdx)) }}</div>
                  </td>
                </tr>

                <!-- Row 5: Projected On Hand (calculated) -->
                <tr style="border-bottom: 3px solid #f97316">
                  <td class="px-1 py-1 border-r sticky left-[320px] z-20 bg-white">
                    <div class="bg-orange-500 text-white rounded px-2 py-2 text-[11px] font-bold">📈 Projected_On_Hand</div>
                  </td>
                  <td class="px-1 py-1 text-center border-r font-bold text-sm" :class="cellCls(getProjectedOH(mat, weekColumns.length - 1))">
                    {{ formatN(getProjectedOH(mat, weekColumns.length - 1)) }}</td>
                  <td v-for="(wc, wIdx) in weekColumns" :key="'poh-'+mat.material_id+'-'+wc.week"
                    class="px-0 py-0.5 text-center border-r">
                    <div class="py-1 text-[11px] font-bold rounded mx-0.5" :class="cellCls(getProjectedOH(mat, wIdx))">
                      {{ formatN(getProjectedOH(mat, wIdx)) }}</div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <!-- Generate PR Modal -->
  <Teleport to="body">
    <div v-if="showPRModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" @click.self="showPRModal = false">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in">
        <!-- Modal Header -->
        <div class="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <h2 class="text-lg font-bold">🛒 Generate Purchase Request from MRP</h2>
          <p class="text-sm text-emerald-100 mt-0.5">Select materials to include in the Purchase Request</p>
        </div>

        <!-- Material List -->
        <div class="flex-1 overflow-y-auto p-4">
          <div class="flex items-center justify-between mb-3">
            <label class="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
              <input type="checkbox" :checked="allSelected" @change="toggleAll" class="w-4 h-4 rounded border-gray-300 text-emerald-600" />
              Select All ({{ selectedPRMaterials.length }}/{{ prMaterialList.length }})
            </label>
            <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Year: {{ selectedYear }}</span>
          </div>

          <div class="space-y-2">
            <div v-for="mat in prMaterialList" :key="mat.material_id"
              class="border rounded-lg p-3 transition-all duration-200 cursor-pointer"
              :class="selectedPRMaterials.includes(mat.material_id) ? 'border-emerald-400 bg-emerald-50 shadow-sm' : 'border-gray-200 hover:border-gray-300'"
              @click="toggleMaterial(mat.material_id)">
              <div class="flex items-center gap-3">
                <input type="checkbox" :checked="selectedPRMaterials.includes(mat.material_id)"
                  class="w-4 h-4 rounded border-gray-300 text-emerald-600 pointer-events-none" />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">{{ mat.product_type_code || 'RM' }}</span>
                    <span class="font-semibold text-gray-900 text-sm truncate">{{ mat.material_name }}</span>
                  </div>
                  <div class="text-xs text-gray-500 mt-0.5">Lead Time: {{ mat.lead_time }} weeks</div>
                </div>
                <div class="text-right">
                  <div class="font-bold text-orange-600 text-sm">{{ formatN(mat.total_net_requirement) }}</div>
                  <div class="text-xs text-gray-400">{{ mat.uom_name || 'Kgs' }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Notes -->
          <div class="mt-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea v-model="prNotes" rows="2" placeholder="Additional notes for this Purchase Request..."
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"></textarea>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="px-6 py-4 bg-gray-50 border-t flex items-center justify-between">
          <div class="text-sm text-gray-600">
            <span class="font-semibold text-emerald-700">{{ selectedPRMaterials.length }}</span> materials selected
          </div>
          <div class="flex gap-2">
            <button @click="showPRModal = false"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button @click="generatePR" :disabled="generatingPR || selectedPRMaterials.length === 0"
              class="px-5 py-2 text-sm font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all duration-200">
              {{ generatingPR ? '⏳ Generating...' : '🛒 Generate PR' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Success Toast -->
  <Teleport to="body">
    <div v-if="prSuccess" class="fixed top-4 right-4 z-50 animate-in">
      <div class="bg-emerald-600 text-white rounded-xl shadow-2xl p-4 max-w-sm">
        <div class="flex items-start gap-3">
          <div class="text-2xl">✅</div>
          <div>
            <h3 class="font-bold">PR Created!</h3>
            <p class="text-sm text-emerald-100 mt-0.5">{{ prSuccess.message }}</p>
            <a :href="'/procurement/purchase-requests'" 
              class="inline-block mt-2 text-sm font-semibold underline text-white hover:text-emerald-200">
              → Open Procurement
            </a>
          </div>
          <button @click="prSuccess = null" class="text-emerald-200 hover:text-white ml-2">✕</button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Toast Notification -->
  <Teleport to="body">
    <Transition enter-active-class="transition-all duration-300" enter-from-class="opacity-0 translate-y-4"
      leave-active-class="transition-all duration-200" leave-to-class="opacity-0 translate-y-4">
      <div v-if="toast" class="fixed bottom-6 right-6 z-50">
        <div class="flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl text-white font-semibold text-sm"
          :class="toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'">
          <span>{{ toast.type === 'success' ? '✅' : '❌' }}</span>
          <span>{{ toast.msg }}</span>
          <button @click="toast = null" class="ml-2 opacity-70 hover:opacity-100">✕</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api } from '../../lib/api';

const now = new Date();
const selectedYear = ref(now.getFullYear());
const yearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
const filterText = ref('');
const loading = ref(false);
const saving = ref(false);
const isDirty = ref(false);
const showPRModal = ref(false);
const generatingPR = ref(false);
const selectedPRMaterials = ref<number[]>([]);
const prNotes = ref('');
const prSuccess = ref<any>(null);

// Toast notification
const toast = ref<{ msg: string; type: 'success'|'error' } | null>(null);
const showToast = (msg: string, type: 'success'|'error' = 'success') => {
  toast.value = { msg, type };
  setTimeout(() => { toast.value = null; }, 4000);
};

const materials = ref<any[]>([]);
const weekColumns = ref<any[]>([]);

const filteredMaterials = computed(() => {
  if (!filterText.value) return materials.value;
  const q = filterText.value.toLowerCase();
  return materials.value.filter((m: any) =>
    (m.material_name || '').toLowerCase().includes(q) ||
    (m.material_sku || '').toLowerCase().includes(q) ||
    (m.product_type_code || '').toLowerCase().includes(q)
  );
});

const formatN = (n: number) => {
  if (n === 0) return '—';
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n);
};

const cellCls = (v: number) => {
  if (v < 0) return 'bg-red-100 text-red-700';
  if (v > 0) return 'bg-green-100 text-green-700';
  return 'bg-gray-50 text-gray-400';
};

const rowTotal = (mat: any, field: string): number => {
  return (mat.weeks || []).reduce((s: number, w: any) => s + (Number(w[field]) || 0), 0);
};

const getNetReq = (mat: any, weekIdx: number): number => {
  const w = mat.weeks[weekIdx];
  if (!w) return 0;
  const gross = Number(w.gross_requirements) || 0;
  const received = Number(w.planned_order_receipt) || 0;
  const prevOH = weekIdx > 0 ? getProjectedOH(mat, weekIdx - 1) : (Number(mat.first_stock) || 0);
  const net = gross - received - Math.max(prevOH, 0);
  return Math.max(net, 0);
};

const getProjectedOH = (mat: any, weekIdx: number): number => {
  let oh = Number(mat.first_stock) || 0;
  for (let i = 0; i <= weekIdx; i++) {
    const w = mat.weeks[i];
    if (!w) continue;
    oh = oh + (Number(w.planned_order_receipt) || 0) - (Number(w.gross_requirements) || 0);
  }
  return Math.round(oh * 100) / 100;
};

const loadMrp = async () => {
  loading.value = true;
  try {
    const res = await api.get('/ppic/mrp', { params: { year: selectedYear.value } });
    materials.value = res.data.data?.materials || [];
    weekColumns.value = res.data.data?.weekColumns || [];
    isDirty.value = false;
  } catch (err: any) {
    console.error('Failed to load MRP:', err);
    materials.value = [];
  }
  finally { loading.value = false; }
};

const saveAll = async () => {
  saving.value = true;
  try {
    const entries: any[] = [];
    const materialSettings: any[] = [];
    for (const mat of materials.value) {
      // Collect material settings
      materialSettings.push({
        material_id: mat.material_id,
        lead_time: mat.lead_time || 2,
        first_stock: mat.first_stock || 0,
        order_quantity: mat.order_quantity || 0
      });
      // Collect planned orders
      for (const w of (mat.weeks || [])) {
        entries.push({
          material_id: mat.material_id,
          week_number: w.week_number,
          year: w.year,
          planned_order_release: Number(w.planned_order_release) || 0,
          planned_order_receipt: Number(w.planned_order_receipt) || 0
        });
      }
    }
    await api.put('/ppic/mrp', { entries, materialSettings, year: selectedYear.value });
    isDirty.value = false;
    showToast('✓ MRP berhasil disimpan');
  } catch (err: any) {
    showToast(err?.response?.data?.error || 'Gagal menyimpan MRP', 'error');
  } finally { saving.value = false; }
};

// --- Generate PR Logic ---
const materialsWithNetReq = computed(() => {
  return materials.value.filter((mat: any) => {
    const totalNet = (mat.weeks || []).reduce((sum: number, _: any, wIdx: number) => sum + getNetReq(mat, wIdx), 0);
    return totalNet > 0;
  });
});

const prMaterialList = computed(() => {
  return materialsWithNetReq.value.map((mat: any) => {
    const totalNet = (mat.weeks || []).reduce((sum: number, _: any, wIdx: number) => sum + getNetReq(mat, wIdx), 0);
    return {
      material_id: mat.material_id,
      material_name: mat.material_name,
      material_sku: mat.material_sku,
      uom_name: mat.uom_name || 'Kgs',
      product_type_code: mat.product_type_code,
      lead_time: mat.lead_time || 2,
      total_net_requirement: Math.round(totalNet * 100) / 100
    };
  });
});

const allSelected = computed(() => {
  return prMaterialList.value.length > 0 && selectedPRMaterials.value.length === prMaterialList.value.length;
});

const openGeneratePRModal = () => {
  selectedPRMaterials.value = prMaterialList.value.map(m => m.material_id);
  prNotes.value = '';
  prSuccess.value = null;
  showPRModal.value = true;
};

const toggleAll = () => {
  if (allSelected.value) {
    selectedPRMaterials.value = [];
  } else {
    selectedPRMaterials.value = prMaterialList.value.map(m => m.material_id);
  }
};

const toggleMaterial = (id: number) => {
  const idx = selectedPRMaterials.value.indexOf(id);
  if (idx >= 0) {
    selectedPRMaterials.value.splice(idx, 1);
  } else {
    selectedPRMaterials.value.push(id);
  }
};

const generatePR = async () => {
  if (selectedPRMaterials.value.length === 0) return;
  generatingPR.value = true;
  try {
    const selectedMats = prMaterialList.value.filter(m => selectedPRMaterials.value.includes(m.material_id));
    const res = await api.post('/ppic/mrp/generate-pr', {
      materials: selectedMats,
      year: selectedYear.value,
      notes: prNotes.value
    });
    showPRModal.value = false;
    prSuccess.value = res.data;
    showToast(`🛒 ${res.data.message}`);
    // Auto-dismiss after 8s
    setTimeout(() => { prSuccess.value = null; }, 8000);
  } catch (err: any) {
    showToast(err?.response?.data?.error || 'Gagal generate PR', 'error');
  } finally {
    generatingPR.value = false;
  }
};

onMounted(() => { loadMrp(); });
</script>

<style scoped>
/* Row hover highlight */
:deep(tbody tr) {
  transition: all 0.2s ease;
}
:deep(tbody tr:hover) {
  filter: brightness(0.97);
  box-shadow: inset 0 0 0 1px rgba(249, 115, 22, 0.2);
}

/* Cell hover glow */
:deep(tbody td) {
  transition: background-color 0.15s ease, box-shadow 0.15s ease;
}
:deep(tbody td:hover) {
  box-shadow: inset 0 0 10px rgba(249, 115, 22, 0.15);
}

/* Input focus animation */
:deep(input[type="number"]) {
  transition: box-shadow 0.2s ease, background-color 0.2s ease;
}
:deep(input[type="number"]:focus) {
  box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.3), inset 0 0 6px rgba(249, 115, 22, 0.1);
}

/* Task badge hover */
:deep(.bg-blue-500:hover),
:deep(.bg-green-600:hover),
:deep(.bg-green-500:hover),
:deep(.bg-yellow-500:hover),
:deep(.bg-orange-500:hover) {
  filter: brightness(1.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* Negative value pulse */
@keyframes pulse-red {
  0%, 100% { background-color: rgb(254, 226, 226); }
  50% { background-color: rgb(254, 202, 202); }
}
:deep(.bg-red-100) {
  animation: pulse-red 2s ease-in-out infinite;
}

/* Modal animation */
.animate-in {
  animation: slideUp 0.3s ease-out;
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
