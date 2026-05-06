<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <div class="flex justify-between items-center mb-6">
      <h3 class="text-lg font-bold text-gray-800">Project Expenses</h3>
      <button class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">+ Add Expense</button>
    </div>
    
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
             <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <!-- Mock Data -->
          <tr v-for="i in 3" :key="i">
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Oct {{ 10 + i }}, 2023</td>
             <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">Server Hosting {{ i }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Infrastructure</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">$120.00</td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                Paid
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <button class="text-blue-600 hover:text-blue-900">Edit</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>
