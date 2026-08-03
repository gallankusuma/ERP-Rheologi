<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Position Rates</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Define standard compensation rates by position / jabatan for payroll calculations.</p>
      </div>
      <button @click="openAddModal" class="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md transition-all cursor-pointer">
        <span class="text-lg">+</span> Add Position Rate
      </button>
    </div>

    <!-- Table -->
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-gray-50 dark:bg-gray-750 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
              <th class="px-6 py-4">Position Name</th>
              <th class="px-6 py-4 text-right">Basic Rate / Day</th>
              <th class="px-6 py-4 text-right">Tunjangan / Day</th>
              <th class="px-6 py-4 text-right">OT Rate / Hour</th>
              <th class="px-6 py-4">Description</th>
              <th class="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700 text-sm text-gray-700 dark:text-gray-300">
            <tr v-for="r in rates" :key="r.id" class="hover:bg-gray-50 dark:hover:bg-gray-750/30 transition-colors">
              <td class="px-6 py-4 font-semibold text-gray-900 dark:text-white">{{ r.position_name }}</td>
              <td class="px-6 py-4 text-right font-bold text-emerald-600 dark:text-emerald-400">{{ fmtRp(r.basic_rate) }}</td>
              <td class="px-6 py-4 text-right text-gray-600 dark:text-gray-400">{{ fmtRp(r.tunjangan_rate) }}</td>
              <td class="px-6 py-4 text-right text-amber-600 dark:text-amber-400">{{ fmtRp(r.ot_rate) }}</td>
              <td class="px-6 py-4 text-xs text-gray-500 max-w-[200px] truncate">{{ r.description || '-' }}</td>
              <td class="px-6 py-4 text-right">
                <div class="flex gap-2 justify-end">
                  <button @click="openEditModal(r)" class="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-blue-600 rounded-lg cursor-pointer">✏️</button>
                  <button @click="deleteRate(r.id)" class="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-rose-600 rounded-lg cursor-pointer">🗑️</button>
                </div>
              </td>
            </tr>
            <tr v-if="rates.length === 0">
              <td colspan="6" class="px-6 py-12 text-center text-gray-400 dark:text-gray-500">No position rates defined yet.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 dark:border-gray-700">
        <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h3 class="text-xl font-bold text-gray-900 dark:text-white">{{ editingId ? 'Edit' : 'Add' }} Position Rate</h3>
          <button @click="closeModal" class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg cursor-pointer">✕</button>
        </div>
        <form @submit.prevent="saveRate" class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Position Name *</label>
            <input v-model="form.position_name" required placeholder="Operator Forklift" class="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-750 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Basic / Day</label>
              <input v-model.number="form.basic_rate" type="number" class="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-750 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Tunjangan</label>
              <input v-model.number="form.tunjangan_rate" type="number" class="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-750 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">OT / Hr</label>
              <input v-model.number="form.ot_rate" type="number" class="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-750 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Description</label>
            <textarea v-model="form.description" rows="2" placeholder="Optional description..." class="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-750 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"></textarea>
          </div>
          <div class="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button type="button" @click="closeModal" class="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-650 text-gray-700 dark:text-gray-200 py-3 rounded-xl font-bold transition-colors cursor-pointer">Cancel</button>
            <button type="submit" class="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-bold shadow-md transition-colors cursor-pointer">{{ editingId ? 'Update' : 'Save' }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../../lib/api';

const rates = ref<any[]>([]);
const showModal = ref(false);
const editingId = ref<number | null>(null);
const defaultForm = () => ({ position_name: '', basic_rate: 0, tunjangan_rate: 0, ot_rate: 0, description: '' });
const form = ref(defaultForm());

const fmtRp = (v: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);

const fetchRates = async () => {
  try { const res = await api.get('/hr/position-rates'); rates.value = res.data?.data || []; } catch (err) { console.error(err); }
};

const openAddModal = () => { editingId.value = null; form.value = defaultForm(); showModal.value = true; };
const openEditModal = (r: any) => {
  editingId.value = r.id;
  form.value = { position_name: r.position_name, basic_rate: r.basic_rate, tunjangan_rate: r.tunjangan_rate, ot_rate: r.ot_rate, description: r.description || '' };
  showModal.value = true;
};
const closeModal = () => { showModal.value = false; };

const saveRate = async () => {
  try {
    if (editingId.value) await api.put(`/hr/position-rates/${editingId.value}`, form.value);
    else await api.post('/hr/position-rates', form.value);
    await fetchRates(); closeModal();
  } catch (err: any) { alert(err.response?.data?.error || 'Failed to save'); }
};

const deleteRate = async (id: number) => {
  if (!confirm('Delete this position rate?')) return;
  try { await api.delete(`/hr/position-rates/${id}`); await fetchRates(); } catch { alert('Failed to delete'); }
};

onMounted(fetchRates);
</script>
