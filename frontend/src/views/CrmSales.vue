<template>
  <div class="min-h-screen bg-gray-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <!-- Header -->
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Sales Management</h1>
          <p class="text-gray-500 mt-1">Orders, Invoices, Payments & Deliveries</p>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-1.5">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          :class="[
            'px-4 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2',
            activeTab === tab.id
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          ]"
        >
          <span>{{ tab.icon }}</span>
          {{ tab.label }}
        </button>
      </div>

      <!-- Tab Content -->
      <KeepAlive>
        <component :is="currentComponent" />
      </KeepAlive>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, defineAsyncComponent } from 'vue';

const SalesOrdersList = defineAsyncComponent(() => import('./SalesOrdersList.vue'));
const SalesInvoices = defineAsyncComponent(() => import('./SalesInvoices.vue'));
const CustomerPayments = defineAsyncComponent(() => import('./CustomerPayments.vue'));
const SalesDeliveryOrders = defineAsyncComponent(() => import('./SalesDeliveryOrders.vue'));

const tabs = [
  { id: 'orders', label: 'Orders', icon: '📋' },
  { id: 'invoices', label: 'Invoices', icon: '🧾' },
  { id: 'payments', label: 'Payments', icon: '💳' },
  { id: 'delivery', label: 'Delivery', icon: '🚚' },
];

const activeTab = ref('orders');

const currentComponent = computed(() => {
  switch (activeTab.value) {
    case 'orders': return SalesOrdersList;
    case 'invoices': return SalesInvoices;
    case 'payments': return CustomerPayments;
    case 'delivery': return SalesDeliveryOrders;
    default: return SalesOrdersList;
  }
});
</script>
