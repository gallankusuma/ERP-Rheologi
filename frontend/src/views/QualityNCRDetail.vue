<template>
  <div class="min-h-screen bg-gray-50">
    <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <!-- header -->
      <div class="flex items-center gap-3 mb-6">
        <button @click="$router.push('/quality/ncr')" class="text-gray-400 hover:text-gray-700">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div class="flex-1">
          <h2 class="text-2xl font-bold text-gray-900">{{ ncr?.ncr_number || 'NCR Detail' }}</h2>
          <p class="text-sm text-gray-500 mt-0.5">
            {{ ncr?.product_name || '' }}
            <span v-if="ncr?.batch_number" class="ml-2 text-gray-400">Batch: {{ ncr.batch_number }}</span>
          </p>
        </div>
        <span :class="severityBadge(ncr?.severity)" class="px-3 py-1 rounded-full text-xs font-semibold">{{ ncr?.severity }}</span>
        <span :class="statusBadge(ncr?.status)" class="px-3 py-1 rounded-full text-xs font-semibold">{{ ncr?.status }}</span>
      </div>

      <div v-if="loading" class="text-center py-16">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>

      <div v-else-if="ncr" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- left: details -->
        <div class="lg:col-span-2 space-y-6">
          <!-- description card -->
          <div class="bg-white shadow rounded-lg p-5">
            <h3 class="text-sm font-semibold text-gray-500 uppercase mb-3">Description</h3>
            <p class="text-sm text-gray-800 whitespace-pre-line">{{ ncr.description }}</p>
            <div v-if="ncr.root_cause" class="mt-4">
              <h4 class="text-xs text-gray-500 uppercase mb-1">Root Cause</h4>
              <p class="text-sm text-gray-700">{{ ncr.root_cause }}</p>
            </div>
            <div v-if="ncr.corrective_action" class="mt-4">
              <h4 class="text-xs text-gray-500 uppercase mb-1">Corrective Action</h4>
              <p class="text-sm text-gray-700">{{ ncr.corrective_action }}</p>
            </div>
            <div v-if="ncr.preventive_action" class="mt-4">
              <h4 class="text-xs text-gray-500 uppercase mb-1">Preventive Action</h4>
              <p class="text-sm text-gray-700">{{ ncr.preventive_action }}</p>
            </div>
          </div>

          <!-- source FPA card -->
          <div v-if="ncr.sourceFpa" class="bg-white shadow rounded-lg p-5">
            <h3 class="text-sm font-semibold text-gray-500 uppercase mb-3">Source FPA (Rejected)</h3>
            <div class="flex items-center gap-4">
              <div>
                <router-link :to="`/qc/fpa/${ncr.sourceFpa.id}`" class="text-blue-600 hover:underline font-medium text-sm">
                  {{ ncr.sourceFpa.fpa_number }}
                </router-link>
                <p class="text-xs text-gray-400 mt-0.5">{{ ncr.sourceFpa.type }} | {{ formatDate(ncr.sourceFpa.created_at) }}</p>
              </div>
              <span :class="{
                'bg-red-100 text-red-800': ncr.sourceFpa.result === 'Failed',
                'bg-green-100 text-green-800': ncr.sourceFpa.result === 'Passed',
                'bg-gray-100 text-gray-600': !ncr.sourceFpa.result || ncr.sourceFpa.result === 'Pending',
              }" class="px-2 py-1 rounded-full text-xs font-medium">{{ ncr.sourceFpa.result || ncr.sourceFpa.status }}</span>
            </div>
          </div>

          <!-- CAPA Actions -->
          <div class="bg-white shadow rounded-lg p-5">
            <div class="flex justify-between items-center mb-3">
              <h3 class="text-sm font-semibold text-gray-500 uppercase">CAPA Actions</h3>
              <button v-if="ncr.status !== 'closed'" @click="showAddAction = true" class="text-xs px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700">+ Add Action</button>
            </div>
            <div v-if="!ncr.actions?.length" class="text-center py-6 text-gray-400 text-sm">No CAPA actions recorded</div>
            <div v-else class="space-y-3">
              <div v-for="a in ncr.actions" :key="a.id" class="border rounded-lg p-3 flex items-start gap-3">
                <div class="flex-shrink-0 mt-1">
                  <span v-if="a.status === 'completed'" class="inline-block w-5 h-5 rounded-full bg-green-500 text-white text-center text-xs leading-5">&#10003;</span>
                  <span v-else class="inline-block w-5 h-5 rounded-full border-2 border-gray-300"></span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-medium px-2 py-0.5 rounded" :class="{
                      'bg-blue-100 text-blue-700': a.action_type === 'corrective',
                      'bg-green-100 text-green-700': a.action_type === 'preventive',
                      'bg-orange-100 text-orange-700': a.action_type === 'containment',
                    }">{{ a.action_type }}</span>
                    <span v-if="a.due_date" class="text-xs text-gray-400">Due: {{ formatDate(a.due_date) }}</span>
                  </div>
                  <p class="text-sm text-gray-800 mt-1">{{ a.description }}</p>
                  <p v-if="a.action_by_name" class="text-xs text-gray-400 mt-1">By: {{ a.action_by_name }}</p>
                </div>
                <button
                  v-if="a.status !== 'completed' && ncr.status !== 'closed'"
                  @click="completeAction(a.id)"
                  class="text-xs text-green-600 hover:underline flex-shrink-0"
                >Complete</button>
              </div>
            </div>
          </div>

          <!-- linked rework orders -->
          <div v-if="ncr.reworks?.length" class="bg-white shadow rounded-lg p-5">
            <h3 class="text-sm font-semibold text-gray-500 uppercase mb-3">Linked Rework Orders</h3>
            <div class="space-y-3">
              <div v-for="rw in ncr.reworks" :key="rw.id" class="border rounded-lg p-3">
                <div class="flex items-center justify-between">
                  <div>
                    <router-link :to="`/quality/rework`" class="text-orange-600 hover:underline font-medium text-sm">{{ rw.rework_number }}</router-link>
                    <span :class="reworkStatusBadge(rw.status)" class="ml-2 px-2 py-0.5 rounded-full text-xs font-medium">{{ rw.status?.replace('_', ' ') }}</span>
                  </div>
                  <span class="text-xs text-gray-400">Qty: {{ rw.quantity }}</span>
                </div>
                <p v-if="rw.description" class="text-sm text-gray-600 mt-1 truncate">{{ rw.description }}</p>
                <!-- re-test FPA -->
                <div v-if="rw.retest_fpa_number" class="mt-2 pl-3 border-l-2 border-blue-200">
                  <p class="text-xs text-gray-500">Re-test FPA:
                    <router-link :to="`/qc/fpa/${rw.retest_fpa_id}`" class="text-blue-600 hover:underline">{{ rw.retest_fpa_number }}</router-link>
                    <span :class="{
                      'text-green-600': rw.retest_fpa_result === 'Passed',
                      'text-red-600': rw.retest_fpa_result === 'Failed',
                      'text-gray-500': !rw.retest_fpa_result,
                    }" class="ml-1 font-medium">{{ rw.retest_fpa_result || rw.retest_fpa_status || 'Pending' }}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- right: metadata + actions -->
        <div class="space-y-6">
          <div class="bg-white shadow rounded-lg p-5 space-y-3">
            <h3 class="text-sm font-semibold text-gray-500 uppercase">Details</h3>
            <div class="grid grid-cols-2 gap-2 text-sm">
              <span class="text-gray-500">Category</span><span class="text-gray-900 capitalize">{{ ncr.category }}</span>
              <span class="text-gray-500">Severity</span><span class="text-gray-900 capitalize">{{ ncr.severity }}</span>
              <span class="text-gray-500">Source</span><span class="text-gray-900 capitalize">{{ ncr.source_type || 'manual' }}</span>
              <span class="text-gray-500">Reported By</span><span class="text-gray-900">{{ ncr.reporter_name || '-' }}</span>
              <span class="text-gray-500">Created</span><span class="text-gray-900">{{ formatDate(ncr.created_at) }}</span>
            </div>
          </div>

          <!-- status actions -->
          <div v-if="ncr.status !== 'closed'" class="bg-white shadow rounded-lg p-5">
            <h3 class="text-sm font-semibold text-gray-500 uppercase mb-3">Actions</h3>
            <div class="space-y-2">
              <button v-if="ncr.status === 'open'"
                @click="updateNCRStatus('investigating')"
                class="w-full px-4 py-2 bg-yellow-500 text-white rounded-md text-sm hover:bg-yellow-600">
                Start Investigation
              </button>
              <button v-if="ncr.status === 'investigating'"
                @click="updateNCRStatus('corrective_action')"
                class="w-full px-4 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600">
                Move to Corrective Action
              </button>
              <button
                @click="closeNCR"
                class="w-full px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700">
                Close NCR
              </button>
              <p v-if="closeError" class="text-xs text-red-600 mt-1">{{ closeError }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- add CAPA action modal -->
      <div v-if="showAddAction" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
          <h3 class="text-lg font-bold mb-4">Add CAPA Action</h3>
          <form @submit.prevent="submitAction" class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700">Action Type</label>
              <select v-model="actionForm.action_type" class="mt-1 w-full px-3 py-2 border rounded-md text-sm">
                <option value="corrective">Corrective</option>
                <option value="preventive">Preventive</option>
                <option value="containment">Containment</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Description</label>
              <textarea v-model="actionForm.description" required rows="3" class="mt-1 w-full px-3 py-2 border rounded-md text-sm"></textarea>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Due Date</label>
              <input v-model="actionForm.due_date" type="date" class="mt-1 w-full px-3 py-2 border rounded-md text-sm" />
            </div>
            <div class="flex justify-end gap-3 pt-2">
              <button type="button" @click="showAddAction = false" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm">Cancel</button>
              <button type="submit" class="px-4 py-2 bg-purple-600 text-white rounded-md text-sm hover:bg-purple-700">Add</button>
            </div>
          </form>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useQualityStore } from '../stores/quality';

const route = useRoute();
const store = useQualityStore();

const ncr = ref<any>(null);
const loading = ref(true);
const showAddAction = ref(false);
const closeError = ref('');
const actionForm = ref({ action_type: 'corrective', description: '', due_date: '' });

const severityBadge = (s: string) => ({
  'bg-red-100 text-red-800': s === 'critical',
  'bg-yellow-100 text-yellow-800': s === 'major',
  'bg-blue-100 text-blue-800': s === 'minor',
});

const statusBadge = (s: string) => ({
  'bg-red-100 text-red-800': s === 'open',
  'bg-yellow-100 text-yellow-800': s === 'investigating',
  'bg-blue-100 text-blue-800': s === 'corrective_action',
  'bg-green-100 text-green-800': s === 'closed',
});

const reworkStatusBadge = (s: string) => ({
  'bg-orange-100 text-orange-800': s === 'pending',
  'bg-blue-100 text-blue-800': s === 'in_progress',
  'bg-green-100 text-green-800': s === 'completed',
  'bg-red-100 text-red-800': s === 'cancelled',
});

const formatDate = (d: string) => d ? new Date(d).toLocaleDateString() : '-';

const loadNCR = async () => {
  loading.value = true;
  try {
    ncr.value = await store.fetchNCRDetail(Number(route.params.id));
  } catch (e) {
    console.error('Failed to load NCR:', e);
  } finally {
    loading.value = false;
  }
};

const updateNCRStatus = async (status: string) => {
  try {
    await store.updateNCR(ncr.value.id, { status });
    await loadNCR();
  } catch (e: any) {
    console.error('Failed to update NCR status:', e);
  }
};

const closeNCR = async () => {
  closeError.value = '';
  try {
    await store.closeNCR(ncr.value.id);
    await loadNCR();
  } catch (e: any) {
    closeError.value = e.response?.data?.error || 'Failed to close NCR';
  }
};

const completeAction = async (actionId: number) => {
  try {
    await store.completeNCRAction(ncr.value.id, actionId);
    await loadNCR();
  } catch (e: any) {
    console.error('Failed to complete action:', e);
  }
};

const submitAction = async () => {
  await store.addNCRAction(ncr.value.id, actionForm.value);
  showAddAction.value = false;
  actionForm.value = { action_type: 'corrective', description: '', due_date: '' };
  await loadNCR();
};

onMounted(loadNCR);
</script>
