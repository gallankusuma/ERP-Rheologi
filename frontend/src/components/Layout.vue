<template>
  <div class="flex flex-col h-screen bg-gray-50">
    <!-- Header Navbar Horizontal -->
    <header class="bg-white border-b border-gray-200 shadow-sm">
      <div class="flex items-center justify-between px-6 py-3">
        <div class="flex items-center gap-4">
          <img src="@/assets/rheologi-logo1.svg" alt="Rheologi" class="h-10 w-auto">
          <span class="text-gray-400">|</span>
          <h1 class="text-lg font-bold text-gray-800">ERP GENERAL</h1>
        </div>
        <div class="flex items-center gap-2">
          <button class="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">Users</button>
          <button class="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">Logout</button>
        </div>
      </div>

      <!-- Main Menu Horizontal - Right Aligned -->
      <nav class="bg-blue-50 border-t-2 border-blue-300">
        <div class="flex px-6 overflow-x-auto justify-end">
          <button
            v-for="menu in mainMenus"
            :key="menu.id"
            @click="selectedMainMenu = menu.id"
            :class="[
              'px-5 py-3 text-sm font-semibold whitespace-nowrap transition-all rounded-t-lg',
              selectedMainMenu === menu.id
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-blue-700 hover:bg-blue-100 hover:text-blue-900'
            ]"
          >
            {{ menu.icon }} {{ menu.label }}
          </button>
        </div>
      </nav>
    </header>

    <!-- Main Content Area -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Vertical Sidebar Menu (Submenu) - Left Side -->
      <aside class="w-56 bg-white border-r border-gray-200 overflow-y-auto">
        <div class="p-4">
          <h2 class="text-sm font-bold text-gray-700 mb-4">MENU</h2>
          <nav class="space-y-1">
            <button
              v-for="submenu in getSubmenus()"
              :key="submenu.id"
              @click="selectSubmenu(submenu)"
              :class="[
                'w-full text-left px-4 py-2 text-sm rounded transition-colors',
                selectedSubmenu === submenu.id
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              ]"
            >
              {{ submenu.label }}
            </button>
          </nav>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 overflow-auto">
        <div class="p-8">
          <router-view :key="route.path" />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { RouterView } from 'vue-router';

const router = useRouter();
const route = useRoute();

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  submenus: Submenu[];
}

interface Submenu {
  id: string;
  label: string;
  route: string;
}

const selectedMainMenu = ref('dashboard');
const selectedSubmenu = ref('');

const mainMenus: MenuItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: '🏠',
    submenus: [
      { id: 'dashboard-main', label: 'Dashboard', route: '/' },
    ]
  },
  {
    id: 'products',
    label: 'Products',
    icon: '📦',
    submenus: [
      { id: 'product-master', label: 'Product Master', route: '/products' },
      { id: 'bom', label: 'Bill of Materials', route: '/bom' },
    ]
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: '📊',
    submenus: [
      { id: 'stock-card', label: 'Stock Card', route: '/inventory' },
      { id: 'warehouses', label: 'Warehouses', route: '/warehouses' },
    ]
  },
  {
    id: 'procurement',
    label: 'Procurement',
    icon: '🛒',
    submenus: [
      { id: 'pr', label: 'Purchase Request', route: '/procurement' },
    ]
  },
  {
    id: 'production',
    label: 'Production',
    icon: '🏭',
    submenus: [
      { id: 'workorders', label: 'Work Orders', route: '/workorders' },
      { id: 'batches', label: 'Batches', route: '/batches' },
    ]
  },
  {
    id: 'quality',
    label: 'Quality',
    icon: '✓',
    submenus: [
      { id: 'qc-testing', label: 'QC Testing', route: '/quality' },
    ]
  },
  {
    id: 'sales',
    label: 'Sales',
    icon: '📈',
    submenus: [
      { id: 'sales-orders', label: 'Sales Orders', route: '/sales' },
    ]
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: '💰',
    submenus: [
      { id: 'cogs', label: 'COGS Tracking', route: '/finance/cogs' },
      { id: 'profitability', label: 'Profitability', route: '/finance/profitability' },
      { id: 'monthly-summary', label: 'Monthly Summary', route: '/finance/summary' },
    ]
  },
  {
    id: 'masters',
    label: 'Data Master',
    icon: '⚙️',
    submenus: [
      { id: 'categories', label: 'Categories', route: '/data-master/categories' },
      { id: 'product-types', label: 'Product Types', route: '/data-master/product-types' },
      { id: 'units', label: 'Units of Measure', route: '/data-master/units' },
      { id: 'suppliers', label: 'Suppliers', route: '/data-master/suppliers' },
      { id: 'customers', label: 'Customers', route: '/data-master/customers' },
    ]
  },
];

const getSubmenus = (): Submenu[] => {
  const menu = mainMenus.find(m => m.id === selectedMainMenu.value);
  return menu?.submenus || [];
};

const selectSubmenu = (submenu: Submenu) => {
  selectedSubmenu.value = submenu.id;
  router.push(submenu.route);
};

// Watch route changes to update menu highlights
watch(() => route.path, (newPath) => {
  // Find which menu this route belongs to
  for (const menu of mainMenus) {
    const submenu = menu.submenus.find(s => s.route === newPath);
    if (submenu) {
      selectedMainMenu.value = menu.id;
      selectedSubmenu.value = submenu.id;
      break;
    }
  }
}, { immediate: true });

// Watch selectedMainMenu changes to auto-select first submenu
watch(() => selectedMainMenu.value, () => {
  const menu = mainMenus.find(m => m.id === selectedMainMenu.value);
  if (menu && menu.submenus.length > 0) {
    const firstSubmenu = menu.submenus[0];
    selectedSubmenu.value = firstSubmenu.id;
    router.push(firstSubmenu.route);
  }
});
</script>

<style scoped>
/* Custom scrollbar untuk sidebar */
aside::-webkit-scrollbar {
  width: 6px;
}

aside::-webkit-scrollbar-track {
  background: #f1f1f1;
}

aside::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 3px;
}

aside::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
