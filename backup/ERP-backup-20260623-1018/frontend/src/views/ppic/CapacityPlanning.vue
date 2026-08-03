<script setup lang="ts">
import { ref } from 'vue';

const workCenters = ref([
  {
    id: 'WC-01',
    name: 'Mixing Machine A',
    available_hours: 160,
    required_hours: 145,
    utilization: 90.6,
  },
  {
    id: 'WC-02',
    name: 'Filling Line B',
    available_hours: 160,
    required_hours: 180,
    utilization: 112.5,
  },
  {
    id: 'WC-03',
    name: 'Packaging Auto',
    available_hours: 160,
    required_hours: 120,
    utilization: 75.0,
  }
]);

</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <div>
        <h2 class="text-2xl font-bold text-slate-800">Rough Cut Capacity Planning (RCCP)</h2>
        <p class="text-slate-500 text-sm mt-1">Machine capacity vs required production load from MPS.</p>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h3 class="text-slate-500 text-sm font-medium mb-1">Total Work Centers</h3>
        <p class="text-3xl font-bold text-slate-800">12</p>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h3 class="text-slate-500 text-sm font-medium mb-1">Overloaded Machines</h3>
        <p class="text-3xl font-bold text-rose-600">1</p>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h3 class="text-slate-500 text-sm font-medium mb-1">Avg Utilization</h3>
        <p class="text-3xl font-bold text-indigo-600">86.2%</p>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div class="p-4 border-b border-slate-200 bg-slate-50">
        <h3 class="font-medium text-slate-700">Capacity Load Profile: June 2026</h3>
      </div>
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="text-slate-500 text-sm border-b border-slate-200">
            <th class="p-4 font-medium">Work Center</th>
            <th class="p-4 font-medium text-right">Available (Hrs)</th>
            <th class="p-4 font-medium text-right">Required (Hrs)</th>
            <th class="p-4 font-medium">Utilization</th>
            <th class="p-4 font-medium text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="wc in workCenters" :key="wc.id" class="border-b border-slate-100">
            <td class="p-4">
              <div class="font-medium text-slate-800">{{ wc.name }}</div>
              <div class="text-xs text-slate-500">{{ wc.id }}</div>
            </td>
            <td class="p-4 text-right font-medium text-slate-600">{{ wc.available_hours }}</td>
            <td class="p-4 text-right font-medium" :class="wc.required_hours > wc.available_hours ? 'text-rose-600' : 'text-slate-700'">
              {{ wc.required_hours }}
            </td>
            <td class="p-4 w-1/3">
              <div class="flex items-center gap-3">
                <div class="w-full bg-slate-100 rounded-full h-2.5">
                  <div 
                    class="h-2.5 rounded-full" 
                    :class="wc.utilization > 100 ? 'bg-rose-500' : (wc.utilization > 80 ? 'bg-amber-500' : 'bg-emerald-500')"
                    :style="`width: ${Math.min(wc.utilization, 100)}%`"
                  ></div>
                </div>
                <span class="text-sm font-bold" :class="wc.utilization > 100 ? 'text-rose-600' : 'text-slate-600'">{{ wc.utilization }}%</span>
              </div>
            </td>
            <td class="p-4 text-center">
              <span v-if="wc.utilization <= 100" class="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold">OK</span>
              <span v-else class="bg-rose-100 text-rose-700 px-2 py-1 rounded text-xs font-bold">OVERLOAD</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
