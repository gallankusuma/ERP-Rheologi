<template>
  <div class="min-h-screen bg-[#f4f6fb]">
    <div class="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <!-- Header -->
      <div class="flex justify-between items-center mb-8">
        <div>
          <h1 class="text-3xl font-bold text-slate-800 tracking-tight">CRM Dashboard</h1>
          <p class="text-slate-500 mt-1">Sales pipeline overview & performance metrics</p>
        </div>
        <div class="flex gap-3">
          <router-link to="/project/prospects" class="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-semibold transition-colors shadow-sm">
            📋 Prospects
          </router-link>
          <router-link to="/leads" class="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-semibold transition-colors shadow-sm">
            🎯 Leads
          </router-link>
          <router-link to="/clients-management" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold transition-all shadow-lg shadow-blue-500/30">
            🏢 Clients
          </router-link>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-20">
        <div class="text-center">
          <div class="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p class="mt-3 text-slate-500 text-sm">Loading dashboard...</p>
        </div>
      </div>

      <div v-else class="space-y-6">
        <!-- Pipeline Funnel Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <!-- Prospects Card -->
          <div class="relative bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-6 text-white shadow-xl overflow-hidden group cursor-pointer hover:shadow-2xl transition-all duration-300" @click="$router.push('/project/prospects')">
            <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-8 translate-x-8 group-hover:scale-125 transition-transform duration-500"></div>
            <div class="relative z-10">
              <div class="flex items-center gap-3 mb-4">
                <div class="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <span class="text-2xl">📋</span>
                </div>
                <div>
                  <p class="text-white/80 text-sm font-medium">Prospects</p>
                  <p class="text-3xl font-bold">{{ data.prospects?.active || 0 }}</p>
                </div>
              </div>
              <div class="flex items-center justify-between text-sm">
                <div class="flex gap-3">
                  <span class="bg-white/20 px-2 py-0.5 rounded-full text-xs font-medium">🔥 {{ data.prospects?.hot || 0 }}</span>
                  <span class="bg-white/20 px-2 py-0.5 rounded-full text-xs font-medium">🌤️ {{ data.prospects?.warm || 0 }}</span>
                  <span class="bg-white/20 px-2 py-0.5 rounded-full text-xs font-medium">❄️ {{ data.prospects?.cold || 0 }}</span>
                </div>
              </div>
              <div class="mt-3 pt-3 border-t border-white/20">
                <p class="text-white/70 text-xs">Pipeline Value</p>
                <p class="text-lg font-bold">{{ formatCurrencyMap(data.prospects?.pipeline_value_by_currency) }}</p>
              </div>
            </div>
          </div>

          <!-- Leads Card -->
          <div class="relative bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-6 text-white shadow-xl overflow-hidden group cursor-pointer hover:shadow-2xl transition-all duration-300" @click="$router.push('/leads')">
            <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-8 translate-x-8 group-hover:scale-125 transition-transform duration-500"></div>
            <div class="relative z-10">
              <div class="flex items-center gap-3 mb-4">
                <div class="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <span class="text-2xl">🎯</span>
                </div>
                <div>
                  <p class="text-white/80 text-sm font-medium">Active Leads</p>
                  <p class="text-3xl font-bold">{{ data.leads?.active || 0 }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-sm">
                <span class="bg-green-400/30 px-2 py-0.5 rounded-full text-xs font-medium">✅ Won: {{ data.leads?.won || 0 }}</span>
                <span class="bg-red-400/30 px-2 py-0.5 rounded-full text-xs font-medium">❌ Lost: {{ data.leads?.lost || 0 }}</span>
              </div>
              <div class="mt-3 pt-3 border-t border-white/20">
                <p class="text-white/70 text-xs">Pipeline Value</p>
                <p class="text-lg font-bold">{{ formatCurrencyMap(data.leads?.pipeline_value_by_currency) }}</p>
              </div>
            </div>
          </div>

          <!-- Clients Card -->
          <div class="relative bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-xl overflow-hidden group cursor-pointer hover:shadow-2xl transition-all duration-300" @click="$router.push('/clients-management')">
            <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-8 translate-x-8 group-hover:scale-125 transition-transform duration-500"></div>
            <div class="relative z-10">
              <div class="flex items-center gap-3 mb-4">
                <div class="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <span class="text-2xl">🏢</span>
                </div>
                <div>
                  <p class="text-white/80 text-sm font-medium">Active Clients</p>
                  <p class="text-3xl font-bold">{{ data.clients?.active || 0 }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-sm">
                <span class="bg-white/20 px-2 py-0.5 rounded-full text-xs font-medium">Total: {{ data.clients?.total || 0 }}</span>
              </div>
              <div class="mt-3 pt-3 border-t border-white/20">
                <p class="text-white/70 text-xs">Total Revenue</p>
                <p class="text-lg font-bold">{{ formatCurrencyMap(data.clients?.total_revenue_by_currency) }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Row 2: Conversion Rates + Lead Pipeline -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Conversion Funnel -->
          <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 class="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <span class="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center text-sm">🔄</span>
              Conversion Rates
            </h3>
            <div class="space-y-6">
              <!-- Prospect → Lead -->
              <div>
                <div class="flex justify-between items-end mb-2">
                  <span class="text-sm font-medium text-slate-600">Prospect → Lead</span>
                  <span class="text-2xl font-bold" :class="getRateColor(data.conversionRates?.prospectToLead)">
                    {{ data.conversionRates?.prospectToLead || 0 }}%
                  </span>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div class="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-1000" :style="{ width: `${data.conversionRates?.prospectToLead || 0}%` }"></div>
                </div>
              </div>
              <!-- Lead → Won -->
              <div>
                <div class="flex justify-between items-end mb-2">
                  <span class="text-sm font-medium text-slate-600">Lead → Won</span>
                  <span class="text-2xl font-bold" :class="getRateColor(data.conversionRates?.leadToWon)">
                    {{ data.conversionRates?.leadToWon || 0 }}%
                  </span>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div class="h-full rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 transition-all duration-1000" :style="{ width: `${data.conversionRates?.leadToWon || 0}%` }"></div>
                </div>
              </div>
              <!-- Overall -->
              <div class="pt-4 border-t border-slate-100">
                <div class="flex justify-between items-end mb-2">
                  <span class="text-sm font-bold text-slate-700">Overall Pipeline</span>
                  <span class="text-2xl font-bold" :class="getRateColor(data.conversionRates?.overall)">
                    {{ data.conversionRates?.overall || 0 }}%
                  </span>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-1000" :style="{ width: `${data.conversionRates?.overall || 0}%` }"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Lead Pipeline Stages -->
          <div class="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 class="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <span class="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-sm">📊</span>
              Lead Pipeline
            </h3>
            <div class="flex items-end gap-2 h-48">
              <div
                v-for="stage in pipelineStages"
                :key="stage.name"
                class="flex-1 flex flex-col items-center group"
              >
                <p class="text-xs font-bold text-slate-700 mb-1">{{ getStageCount(stage.name) }}</p>
                <div
                  class="w-full rounded-t-lg transition-all duration-500 group-hover:opacity-80 relative"
                  :class="stage.color"
                  :style="{ height: getStageHeight(stage.name) + '%', minHeight: '8px' }"
                >
                  <div class="absolute inset-x-0 -top-6 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span class="bg-slate-800 text-white text-[10px] px-2 py-1 rounded font-medium whitespace-nowrap">
                      {{ getStageValue(stage.name) }}
                    </span>
                  </div>
                </div>
                <p class="text-[11px] font-semibold text-slate-500 mt-2 text-center">{{ stage.name }}</p>
              </div>
            </div>
            <div class="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
              <p class="text-sm text-slate-500">
                Total Pipeline: <strong class="text-slate-800">{{ formatCurrencyMap(data.leads?.pipeline_value_by_currency) }}</strong>
              </p>
              <p class="text-sm text-slate-500" title="Sum of Lead's own estimated value for Won deals — not confirmed Sales Order or invoiced revenue">
                Won Estimated Value: <strong class="text-emerald-600">{{ formatCurrencyMap(data.leads?.won_value_by_currency) }}</strong>
              </p>
            </div>
          </div>
        </div>

        <!-- Row 3: Recent Activity + Overdue Follow-ups -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Recent Activity -->
          <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 class="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span class="w-8 h-8 bg-cyan-50 rounded-lg flex items-center justify-center text-sm">⚡</span>
              Recent Activity
            </h3>
            <div class="space-y-1" v-if="data.recentActivity?.length">
              <div
                v-for="(item, idx) in data.recentActivity"
                :key="idx"
                class="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
                @click="goToItem(item)"
              >
                <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" :class="item.type === 'lead' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'">
                  <span class="text-lg">{{ item.type === 'lead' ? '🎯' : '📋' }}</span>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors">{{ item.company }}</p>
                  <p class="text-xs text-slate-500">
                    <span class="capitalize">{{ item.type }}</span> · {{ item.stage }} · {{ item.contact_name || '—' }}
                  </p>
                </div>
                <div class="text-right flex-shrink-0">
                  <p class="text-sm font-bold text-slate-700">{{ formatCurrency(item.value, item.currency || 'IDR') }}</p>
                  <p class="text-[10px] text-slate-400">{{ timeAgo(item.updated_at) }}</p>
                </div>
              </div>
            </div>
            <div v-else class="text-center py-8 text-slate-400 text-sm">
              No recent activity
            </div>
          </div>

          <!-- Overdue Follow-ups -->
          <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 class="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span class="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center text-sm">⏰</span>
              Overdue Follow-ups
              <span v-if="data.overdueFollowups?.length" class="ml-auto bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full">
                {{ data.overdueFollowups.length }}
              </span>
            </h3>
            <div class="space-y-1" v-if="data.overdueFollowups?.length">
              <div
                v-for="item in data.overdueFollowups"
                :key="item.id"
                class="flex items-center gap-4 p-3 rounded-xl hover:bg-red-50/50 transition-colors"
              >
                <div class="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                  <span class="text-lg">{{ tempIcon(item.temperature) }}</span>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-slate-800 truncate">{{ item.company_name }}</p>
                  <p class="text-xs text-slate-500">{{ item.contact_name || '—' }} · {{ item.code }}</p>
                </div>
                <div class="text-right flex-shrink-0">
                  <p class="text-xs font-bold text-red-600">{{ formatDate(item.next_follow_up) }}</p>
                  <p class="text-[10px] text-red-400">{{ daysOverdue(item.next_follow_up) }}d overdue</p>
                </div>
              </div>
            </div>
            <div v-else class="text-center py-8">
              <div class="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <span class="text-3xl">✅</span>
              </div>
              <p class="text-slate-500 text-sm font-medium">All follow-ups are on track!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../lib/api';

const router = useRouter();
const loading = ref(true);
const data = ref<any>({});

const pipelineStages = [
  { name: 'New', color: 'bg-slate-300' },
  { name: 'Qualified', color: 'bg-blue-400' },
  { name: 'Discussion', color: 'bg-cyan-400' },
  { name: 'Proposal', color: 'bg-amber-400' },
  { name: 'Negotiation', color: 'bg-purple-400' },
  { name: 'Won', color: 'bg-emerald-400' },
  { name: 'Lost', color: 'bg-red-300' },
];

const fetchDashboard = async () => {
  loading.value = true;
  try {
    const res = await api.get('/crm/dashboard');
    data.value = res.data?.data || {};
  } catch (err) {
    console.error('Failed to fetch CRM dashboard:', err);
  } finally {
    loading.value = false;
  }
};

const getStageCount = (stage: string): number => {
  const found = data.value.leadsByStage?.find((s: any) => s.stage === stage);
  return found?.count || 0;
};

const getStageValue = (stage: string): string => {
  const found = data.value.leadsByStage?.find((s: any) => s.stage === stage);
  return formatCurrencyMap(found?.total_value_by_currency);
};

const getStageHeight = (stage: string): number => {
  const count = getStageCount(stage);
  const total = data.value.leads?.total || 1;
  return Math.max(5, (count / total) * 100);
};

const getRateColor = (rate: number) => {
  if (rate >= 50) return 'text-emerald-600';
  if (rate >= 25) return 'text-blue-600';
  if (rate >= 10) return 'text-amber-600';
  return 'text-slate-500';
};

const formatCurrency = (val: any, currency: string = 'IDR') => {
  const num = Number(val) || 0;
  const prefix = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : 'Rp ';
  if (num >= 1e9) return prefix + (num / 1e9).toFixed(1) + 'B';
  if (num >= 1e6) return prefix + (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return prefix + (num / 1e3).toFixed(0) + 'K';
  if (currency === 'IDR') return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(num);
};

const formatCurrencyMap = (map: Record<string, number> | undefined | null): string => {
  if (!map || typeof map !== 'object') return formatCurrency(0);
  const entries = Object.entries(map).filter(([, v]) => Number(v) !== 0);
  if (entries.length === 0) return formatCurrency(0);
  return entries.map(([cur, val]) => formatCurrency(val, cur)).join(' + ');
};

const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '';

const tempIcon = (t: string) => ({ hot: '🔥', warm: '🌤️', cold: '❄️' }[t] || '❄️');

const timeAgo = (dateStr: string) => {
  if (!dateStr) return '';
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};

const daysOverdue = (d: string) => {
  if (!d) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000));
};

const goToItem = (item: any) => {
  if (item.type === 'lead') {
    router.push(`/leads/${item.id}`);
  }
};

onMounted(() => {
  fetchDashboard();
});
</script>
