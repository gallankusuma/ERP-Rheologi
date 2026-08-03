<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <div class="flex justify-between items-center mb-6">
      <h3 class="text-lg font-bold text-gray-800">Timesheets</h3>
      <button class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">Log Time</button>
    </div>
    
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Billable</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
           <!-- Mock Data -->
          <tr v-for="i in 3" :key="i">
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">John Doe</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Backend API Development</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Oct {{ 12 + i }}, 2023</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">4.5</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-green-600">Yes</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>
