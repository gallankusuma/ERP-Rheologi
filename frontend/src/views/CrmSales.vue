<template>
  <div class="min-h-screen bg-gray-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <!-- Header -->
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Sales Management</h1>
          <p class="text-gray-500 mt-1">Sales Orders & Monitoring</p>
        </div>
      </div>

      <!-- Tab Content -->
      <SalesOrdersList />
    </div>
  </div>
</template>

<script setup lang="ts">
import SalesOrdersList from './SalesOrdersList.vue';
</script>

