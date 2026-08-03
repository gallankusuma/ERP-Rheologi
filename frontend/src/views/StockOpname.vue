<template>
  <div class="min-h-screen bg-slate-50">
    <div class="bg-gradient-to-r from-teal-700 to-cyan-600 px-6 py-4 text-white shadow-lg">
      <div class="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 class="text-xl font-bold">📋 Stock Opname</h1>
          <p class="text-teal-200 text-sm mt-0.5">Physical counting & adjustment stok gudang</p>
        </div>
        <button @click="showCreate = true"
          class="px-4 py-2 bg-white text-teal-700 hover:bg-teal-50 rounded-xl text-sm font-bold shadow transition-all">
          + Buat Opname Baru
        </button>
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-4 py-6">

      <!-- Create Modal -->
      <Teleport to="body">
        <div v-if="showCreate" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 class="font-bold text-gray-900">Buat Sesi Opname</h3>
              <button @click="showCreate = false" class="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div class="px-6 py-5 space-y-4">
              <div>
                <label class="block text-sm font-semibold text-gray-700 mb-1.5">Gudang *</label>
                <select v-model="createForm.warehouse_id"
                  class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500">
                  <option value="">— Pilih Gudang —</option>
                  <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-semibold text-gray-700 mb-1.5">Catatan</label>
                <textarea v-model="createForm.notes" rows="3" placeholder="Alasan opname, periode, dll..."
                  class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500"></textarea>
              </div>
              <div class="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                ℹ️ Sistem akan otomatis mengisi daftar item berdasarkan stok gudang yang dipilih
              </div>
            </div>
            <div class="px-6 pb-5 flex gap-3">
              <button @click="showCreate = false"
                class="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Batal
              </button>
              <button @click="createOpname" :disabled="!createForm.warehouse_id || creating"
                class="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50">
                {{ creating ? '⏳ Membuat...' : '✅ Buat Opname' }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- Session List or Detail -->
      <template v-if="!activeSession">
        <!-- Session List -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 class="font-bold text-gray-800">Sesi Opname</h2>
            <button @click="loadSessions" class="text-sm text-gray-400 hover:text-gray-600">🔄 Refresh</button>
          </div>
          <div v-if="loading" class="p-10 text-center">
            <div class="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
          <div v-else-if="!sessions.length" class="p-10 text-center text-gray-400">
            <div class="text-4xl mb-3">📋</div>
            <p class="font-semibold">Belum ada sesi opname</p>
            <p class="text-sm mt-1">Klik "Buat Opname Baru" untuk memulai</p>
          </div>
          <div v-else class="divide-y divide-gray-50">
            <div v-for="s in sessions" :key="s.id"
              class="px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div class="flex items-start gap-4">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                  :class="s.status === 'posted' ? 'bg-emerald-100' : s.status === 'cancelled' ? 'bg-gray-100' : 'bg-blue-100'">
                  {{ s.status === 'posted' ? '✅' : s.status === 'cancelled' ? '❌' : '📝' }}
                </div>
                <div>
                  <div class="font-mono font-bold text-gray-800">{{ s.opname_number }}</div>
                  <div class="text-sm text-gray-600 mt-0.5">{{ s.warehouse_name }}</div>
                  <div class="text-xs text-gray-400 mt-0.5">
                    Oleh: {{ s.created_by_name }} · {{ fmtDate(s.created_at) }}
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-4">
                <div class="text-right">
                  <div class="text-sm font-semibold text-gray-800">
                    {{ s.counted_items }}/{{ s.item_count }} item
                  </div>
                  <div class="text-xs text-gray-400">dicounting</div>
                  <!-- Progress -->
                  <div class="w-24 h-1.5 bg-gray-100 rounded-full mt-1.5">
                    <div class="h-full bg-teal-500 rounded-full"
                      :style="{ width: s.item_count > 0 ? (s.counted_items / s.item_count * 100) + '%' : '0%' }"></div>
                  </div>
                </div>
                <span class="px-2.5 py-1 rounded-full text-xs font-bold"
                  :class="{
                    'bg-blue-100 text-blue-700': s.status === 'draft',
                    'bg-emerald-100 text-emerald-700': s.status === 'posted',
                    'bg-gray-100 text-gray-500': s.status === 'cancelled',
                  }">{{ s.status }}</span>
                <button v-if="s.status === 'draft'" @click="openSession(s)"
                  class="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold transition-all">
                  Buka
                </button>
                <button v-else @click="openSession(s)"
                  class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition-all">
                  Detail
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Active Session Detail -->
      <template v-else>
        <div class="space-y-5">
          <!-- Header -->
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4">
            <div class="flex items-center justify-between flex-wrap gap-3">
              <div class="flex items-center gap-3">
                <button @click="activeSession = null; loadSessions()"
                  class="text-gray-400 hover:text-gray-700 text-sm flex items-center gap-1">
                  ← Kembali
                </button>
                <div class="border-l border-gray-200 pl-3">
                  <div class="font-mono font-bold text-teal-700 text-lg">{{ activeSession.opname_number }}</div>
                  <div class="text-sm text-gray-600">{{ activeSession.warehouse_name }}</div>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <div class="text-sm text-gray-600">
                  {{ sessionItems.filter((i: any) => i.actual_qty !== null).length }}/{{ sessionItems.length }} dicounting
                </div>
                <span class="px-2.5 py-1 rounded-full text-xs font-bold"
                  :class="activeSession.status === 'draft' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'">
                  {{ activeSession.status }}
                </span>
                <button v-if="activeSession.status === 'draft'"
                  @click="saveItems"
                  :disabled="saving"
                  class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50">
                  {{ saving ? '⏳' : '💾 Simpan' }}
                </button>
                <button v-if="activeSession.status === 'draft'"
                  @click="postOpname"
                  :disabled="posting"
                  class="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50">
                  {{ posting ? '⏳ Posting...' : '✅ Post Adjustment' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Summary variance -->
          <div class="grid grid-cols-3 gap-4">
            <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
              <div class="text-2xl font-black text-emerald-600">{{ variances.filter(v => v > 0).length }}</div>
              <div class="text-xs text-gray-500 font-semibold uppercase mt-1">Lebih (+)</div>
            </div>
            <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
              <div class="text-2xl font-black text-red-600">{{ variances.filter(v => v < 0).length }}</div>
              <div class="text-xs text-gray-500 font-semibold uppercase mt-1">Kurang (-)</div>
            </div>
            <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
              <div class="text-2xl font-black text-gray-400">{{ variances.filter(v => v === 0).length }}</div>
              <div class="text-xs text-gray-500 font-semibold uppercase mt-1">Sesuai (=)</div>
            </div>
          </div>

          <!-- Items Table -->
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div class="px-5 py-3 border-b border-gray-100 flex gap-3">
              <input v-model="itemSearch" type="text" placeholder="Cari material..."
                class="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-400" />
              <select v-model="itemFilter" class="border border-gray-200 rounded-xl px-3 py-2 text-sm">
                <option value="all">Semua</option>
                <option value="uncounted">Belum dicounting</option>
                <option value="variance">Ada selisih</option>
              </select>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full">
                <thead class="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Material</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Qty Sistem</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Qty Aktual</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Selisih</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Catatan</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-50">
                  <tr v-for="item in filteredItems" :key="item.id"
                    class="hover:bg-gray-50"
                    :class="item.actual_qty === null ? '' : getVariance(item) !== 0 ? 'bg-amber-50/50' : 'bg-emerald-50/30'">
                    <td class="px-5 py-3">
                      <div class="text-sm font-semibold text-gray-900">{{ item.product_name }}</div>
                      <div class="text-xs text-gray-400 font-mono">{{ item.product_sku }}</div>
                    </td>
                    <td class="px-4 py-3 text-right text-sm font-mono text-gray-700">{{ fmtN(item.system_qty) }}</td>
                    <td class="px-4 py-3 text-right">
                      <input v-if="activeSession.status === 'draft'"
                        v-model.number="item.actual_qty"
                        type="number" min="0" step="0.001"
                        class="w-24 text-right border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-mono focus:ring-2 focus:ring-teal-400 focus:border-teal-400"
                        :class="item.actual_qty === null ? 'border-orange-200 bg-orange-50' : ''"
                        :placeholder="'—'" />
                      <span v-else class="text-sm font-mono">{{ item.actual_qty !== null ? fmtN(item.actual_qty) : '—' }}</span>
                    </td>
                    <td class="px-4 py-3 text-right">
                      <span v-if="item.actual_qty !== null" class="text-sm font-bold"
                        :class="getVariance(item) > 0 ? 'text-emerald-600' : getVariance(item) < 0 ? 'text-red-600' : 'text-gray-400'">
                        {{ getVariance(item) > 0 ? '+' : '' }}{{ fmtN(getVariance(item)) }}
                      </span>
                      <span v-else class="text-xs text-gray-300">—</span>
                    </td>
                    <td class="px-4 py-3">
                      <input v-if="activeSession.status === 'draft'"
                        v-model="item.notes" type="text" placeholder="catatan..."
                        class="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-teal-400" />
                      <span v-else class="text-xs text-gray-500">{{ item.notes || '—' }}</span>
                    </td>
                  </tr>
                  <tr v-if="!filteredItems.length">
                    <td colspan="5" class="px-5 py-8 text-center text-gray-400">Tidak ada item</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Toast -->
    <Teleport to="body">
      <Transition enter-active-class="transition-all duration-300" enter-from-class="opacity-0 translate-y-4"
        leave-active-class="transition-all duration-200" leave-to-class="opacity-0">
        <div v-if="toast" class="fixed bottom-6 right-6 z-50">
          <div class="flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl text-white font-semibold text-sm"
            :class="toast.type === 'success' ? 'bg-teal-600' : 'bg-red-600'">
            {{ toast.type === 'success' ? '✅' : '❌' }} {{ toast.msg }}
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api } from '../lib/api';

const loading = ref(false);
const creating = ref(false);
const saving = ref(false);
const posting = ref(false);
const showCreate = ref(false);
const sessions = ref<any[]>([]);
const warehouses = ref<any[]>([]);
const activeSession = ref<any>(null);
const sessionItems = ref<any[]>([]);
const itemSearch = ref('');
const itemFilter = ref('all');
const toast = ref<any>(null);

const createForm = ref({ warehouse_id: '', notes: '' });

const fmtN = (v: any) => Number(v || 0).toLocaleString('id-ID', { maximumFractionDigits: 3 });
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const getVariance = (item: any) => item.actual_qty !== null ? Number(item.actual_qty) - Number(item.system_qty) : 0;
const variances = computed(() => sessionItems.value.filter((i: any) => i.actual_qty !== null).map((i: any) => getVariance(i)));

const filteredItems = computed(() => {
  let items = sessionItems.value;
  if (itemSearch.value) {
    const q = itemSearch.value.toLowerCase();
    items = items.filter((i: any) => i.product_name?.toLowerCase().includes(q) || i.product_sku?.toLowerCase().includes(q));
  }
  if (itemFilter.value === 'uncounted') items = items.filter((i: any) => i.actual_qty === null);
  if (itemFilter.value === 'variance') items = items.filter((i: any) => i.actual_qty !== null && Math.abs(getVariance(i)) > 0.001);
  return items;
});

const showToast = (msg: string, type = 'success') => {
  toast.value = { msg, type };
  setTimeout(() => { toast.value = null; }, 3500);
};

const loadSessions = async () => {
  loading.value = true;
  try {
    const [sessRes, whRes] = await Promise.all([
      api.get('/inventory/opname'),
      api.get('/warehouses')
    ]);
    sessions.value = sessRes.data.data || [];
    warehouses.value = whRes.data.data || whRes.data || [];
  } catch {
    sessions.value = [];
  } finally {
    loading.value = false;
  }
};

const createOpname = async () => {
  creating.value = true;
  try {
    const res = await api.post('/inventory/opname', createForm.value);
    showToast(`Opname ${res.data.opname_number} dibuat — ${res.data.items_generated} item di-generate`);
    showCreate.value = false;
    createForm.value = { warehouse_id: '', notes: '' };
    await loadSessions();
    // Auto-open the new session
    const newSess = sessions.value.find((s: any) => s.opname_number === res.data.opname_number);
    if (newSess) await openSession(newSess);
  } catch (err: any) {
    showToast(err?.response?.data?.error || 'Gagal membuat opname', 'error');
  } finally {
    creating.value = false;
  }
};

const openSession = async (s: any) => {
  activeSession.value = s;
  try {
    const res = await api.get(`/inventory/opname/${s.id}`);
    sessionItems.value = res.data.data?.items || [];
    activeSession.value = { ...res.data.data };
    delete activeSession.value.items;
  } catch {
    showToast('Gagal memuat detail opname', 'error');
  }
};

const saveItems = async () => {
  saving.value = true;
  try {
    const updates = sessionItems.value
      .filter((i: any) => i.actual_qty !== null)
      .map((i: any) => ({ id: i.id, actual_qty: i.actual_qty, notes: i.notes }));
    await api.put(`/inventory/opname/${activeSession.value.id}/items`, { items: updates });
    showToast(`${updates.length} item disimpan`);
  } catch {
    showToast('Gagal menyimpan', 'error');
  } finally {
    saving.value = false;
  }
};

const postOpname = async () => {
  if (!confirm('Posting opname akan menyesuaikan stok gudang sesuai hasil counting. Lanjutkan?')) return;
  posting.value = true;
  try {
    await saveItems();
    const res = await api.post(`/inventory/opname/${activeSession.value.id}/post`);
    showToast(`✅ Opname posted — ${res.data.adjusted_items} item disesuaikan`);
    activeSession.value = { ...activeSession.value, status: 'posted' };
    await loadSessions();
  } catch (err: any) {
    showToast(err?.response?.data?.error || 'Gagal posting', 'error');
  } finally {
    posting.value = false;
  }
};

onMounted(loadSessions);
</script>
