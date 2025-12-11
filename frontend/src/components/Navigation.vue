<template>
  <nav class="sticky top-0 z-30 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 shadow-lg">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <img :src="logoUrl" alt="Rheologi" class="h-9 w-auto" />
        <div class="hidden sm:block">
          <p class="text-white font-semibold leading-tight">Manufacturing Suite</p>
          <p class="text-xs text-slate-200/80">Ops · Inventory · Quality</p>
        </div>
      </div>
      <div class="flex items-center space-x-2 text-sm">
        <router-link
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="px-3 py-2 rounded-lg transition hover:bg-white/10"
          :class="isActive(link.to) ? 'bg-white/20 text-white font-semibold' : 'text-slate-200'"
        >
          {{ link.label }}
        </router-link>
        <button
          @click="handleLogout"
          class="ml-2 px-3 py-2 rounded-lg bg-rose-500 text-white font-semibold hover:bg-rose-600 transition"
        >
          Logout
        </button>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
// Use default Vite icon as placeholder to avoid missing asset error.
const logoUrl = '/vite.svg';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const links = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/products', label: 'Products' },
  { to: '/bom', label: 'BOM' },
  { to: '/batches', label: 'Batches' },
  { to: '/workorders', label: 'Work Orders' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/procurement', label: 'Procurement' },
  { to: '/sales', label: 'Sales' },
  { to: '/warehouses', label: 'Warehouses' },
  { to: '/quality', label: 'Quality' },
];

const isActive = (path: string) => {
  return route.path === path;
};

const handleLogout = () => {
  authStore.logout();
  router.push('/login');
};
</script>
