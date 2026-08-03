<script setup lang="ts">
import { ref } from 'vue';

const activeModel = ref('MA');

const forecastModels = [
  { id: 'MA', name: '1. Moving Average (MA)', short: 'MA' },
  { id: 'WMA', name: '2. Weighted Moving Average (W-MA)', short: 'W-MA' },
  { id: 'ES', name: '3. Exponential Smoothing (ES)', short: 'ES' },
  { id: 'TLA', name: '4. Trend Line Analysis (TLA)', short: 'TLA' },
  { id: 'SV', name: '5. Seasonal + Trend Line', short: 'SV' },
  { id: 'SV_ES', name: '6. Seasonal + Exponential Smoothing', short: 'SV_ES' },
];

const selectedItem = ref('');
const periods = ref(3); // For MA and WMA
const alpha = ref(0.2); // For Exponential Smoothing
const loading = ref(false);

const runForecast = async () => {
  if (!selectedItem.value) return alert('Please select an item to forecast.');
  loading.value = true;
  // Simulate API call
  setTimeout(() => {
    loading.value = false;
  }, 1000);
};

</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <div>
        <h2 class="text-2xl font-bold text-slate-800">Sales Forecast</h2>
        <p class="text-slate-500 text-sm mt-1">Predict future demand using historical data models.</p>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
      
      <!-- Configuration Panel -->
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-5 h-fit">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Target Item (FG)</label>
          <select v-model="selectedItem" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
            <option value="">-- Select Product --</option>
            <option value="1">Rheo-Active Cream 50g</option>
            <option value="2">Bio-Serum Vitality 30ml</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Forecasting Model</label>
          <div class="space-y-2">
            <label v-for="model in forecastModels" :key="model.id" class="flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors" :class="activeModel === model.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'">
              <input type="radio" :value="model.id" v-model="activeModel" class="text-indigo-600 focus:ring-indigo-500">
              <span class="text-sm font-medium" :class="activeModel === model.id ? 'text-indigo-700' : 'text-slate-600'">{{ model.name }}</span>
            </label>
          </div>
        </div>

        <div v-if="['MA', 'WMA'].includes(activeModel)">
          <label class="block text-sm font-medium text-slate-700 mb-1">Periods (n)</label>
          <input type="number" v-model="periods" min="2" max="12" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
        </div>

        <div v-if="['ES', 'SV_ES'].includes(activeModel)">
          <label class="block text-sm font-medium text-slate-700 mb-1">Smoothing Constant (α)</label>
          <input type="number" v-model="alpha" min="0.1" max="0.9" step="0.1" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
        </div>

        <button @click="runForecast" class="w-full bg-indigo-600 text-white font-medium py-2 rounded-lg hover:bg-indigo-700 transition-colors">
          Calculate Forecast
        </button>
      </div>

      <!-- Results Panel -->
      <div class="md:col-span-3 space-y-6">
        
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center h-full min-h-[400px] flex flex-col items-center justify-center">
          <template v-if="!selectedItem">
            <div class="text-6xl mb-4">📈</div>
            <h3 class="text-lg font-medium text-slate-700">No Forecast Generated</h3>
            <p class="text-slate-500 text-sm max-w-sm mt-2">Select an item and a forecasting model from the configuration panel to generate predictions.</p>
          </template>
          
          <template v-else-if="loading">
            <div class="animate-spin w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p class="text-slate-500 font-medium">Running {{ forecastModels.find(m => m.id === activeModel)?.short }} simulation...</p>
          </template>
          
          <template v-else>
            <div class="text-6xl mb-4">✨</div>
            <h3 class="text-lg font-medium text-slate-700">Forecast Ready (Simulation)</h3>
            <p class="text-slate-500 text-sm max-w-sm mt-2">Historical data processing using {{ forecastModels.find(m => m.id === activeModel)?.name }} is complete.</p>
            
            <div class="mt-8 w-full max-w-2xl bg-slate-50 rounded-lg border border-slate-200 p-4">
              <table class="w-full text-sm text-left">
                <thead>
                  <tr class="text-slate-500 border-b border-slate-200">
                    <th class="pb-2">Month</th>
                    <th class="pb-2">Actual Sales</th>
                    <th class="pb-2 text-indigo-600">Forecast</th>
                    <th class="pb-2 text-rose-500">Error</th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="border-b border-slate-100">
                    <td class="py-2">Jan 2026</td>
                    <td class="py-2 font-medium">1,250</td>
                    <td class="py-2 text-indigo-600 font-medium">-</td>
                    <td class="py-2 text-rose-500">-</td>
                  </tr>
                  <tr class="border-b border-slate-100">
                    <td class="py-2">Feb 2026</td>
                    <td class="py-2 font-medium">1,320</td>
                    <td class="py-2 text-indigo-600 font-medium">1,250</td>
                    <td class="py-2 text-rose-500">70</td>
                  </tr>
                  <tr class="border-b border-slate-100 bg-indigo-50/50">
                    <td class="py-2 font-medium text-slate-800">Next Month</td>
                    <td class="py-2 text-slate-400">?</td>
                    <td class="py-2 text-indigo-700 font-bold text-lg">1,385</td>
                    <td class="py-2 text-slate-400">-</td>
                  </tr>
                </tbody>
              </table>
              <div class="mt-4 flex justify-between items-center pt-4 border-t border-slate-200">
                <div class="text-xs text-slate-500">Mean Absolute Deviation (MAD): <span class="font-bold text-slate-700">45.2</span></div>
                <button class="text-xs bg-white border border-slate-300 px-3 py-1.5 rounded hover:bg-slate-50 font-medium text-slate-700">
                  Export to MPS →
                </button>
              </div>
            </div>
          </template>
        </div>

      </div>
    </div>
  </div>
</template>
