<template>
  <div class="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
    <!-- Row 1: Info Bar + User Menu -->
    <div class="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-gray-800 dark:to-gray-700 border-b border-cyan-200 dark:border-gray-600 px-4 md:px-6 py-2.5">
      <div class="flex items-center justify-between gap-2">
        <!-- Left: Logo + Company -->
        <div class="flex items-center gap-2 min-w-0">
          <!-- Mobile burger -->
          <button @click="mobileMenuOpen = !mobileMenuOpen" class="md:hidden p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
          <span class="text-2xl hidden sm:inline text-blue-500 font-bold">G</span>
          <span class="font-bold text-cyan-700 dark:text-cyan-400 text-sm md:text-lg truncate">Genjaya ERP</span>
          <span class="text-gray-400 dark:text-gray-500 hidden lg:inline">|</span>
          <span class="text-sm md:text-base font-semibold text-gray-700 dark:text-gray-300 hidden lg:inline truncate">{{ companyName }}</span>
        </div>
        <!-- Right: Stats + Toggle + User -->
        <div class="flex items-center gap-3 md:gap-6 text-gray-700 dark:text-gray-300 flex-shrink-0">
          <div class="hidden xl:flex items-center gap-6">
            <div class="flex items-center gap-1.5">
              <span class="text-lg">📋</span>
              <span class="text-xs">Approvals: <strong>{{ headerStats.pendingApprovals }}</strong></span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="text-lg">📦</span>
              <span class="text-xs">Stock: <strong>{{ headerStats.stockItems }}</strong></span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="text-lg">🏭</span>
              <span class="text-xs">Active WO: <strong>{{ headerStats.activeWO }}</strong></span>
            </div>
          </div>
          <span class="text-xs text-gray-500 dark:text-gray-400 hidden md:inline">{{ currentDate }}</span>
          <!-- Night Mode Toggle -->
          <button 
            @click="toggleNightMode"
            class="p-1.5 rounded-lg bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
            :title="isDark ? 'Light Mode' : 'Dark Mode'"
          >
            <span v-if="isDark" class="text-lg">☀️</span>
            <span v-else class="text-lg">🌙</span>
          </button>
          <!-- User Menu -->
          <div class="relative" @click.stop>
            <button 
              @click.stop="showUserMenu = !showUserMenu"
              class="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all flex items-center gap-1.5"
            >
              👤 <span class="hidden sm:inline">{{ authStore.user?.name || 'User' }}</span>
            </button>
            <div v-if="showUserMenu" class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
              <button @click="goToProfile" class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-600">👤 My Profile</button>
              <button @click="goToSettings" class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-600">⚙️ Settings</button>
              <button @click="goToChangePassword" class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-600">🔑 Change Password</button>
              <button @click="handleLogout" class="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">🚪 Logout</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Row 2: Horizontal Menu Tabs -->
    <nav class="bg-blue-50 dark:bg-gray-800 border-b-2 border-blue-300 dark:border-gray-700">
      <div class="flex px-2 md:px-6 overflow-x-auto scrollbar-thin justify-end">
        <div class="flex gap-0.5">
          <button
            v-for="menu in mainMenusLeft"
            :key="menu.id"
            type="button"
            @click="selectedMainMenu = menu.id"
            :class="[
              'px-3 md:px-5 py-2.5 text-xs md:text-sm font-semibold whitespace-nowrap transition-all rounded-t-lg',
              activeMenuId === menu.id
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-gray-700'
            ]"
          >
            <span class="hidden md:inline">{{ menu.icon }} </span>{{ menu.label }}
          </button>
        </div>
        <div class="flex gap-0.5">
          <button
            v-for="menu in mainMenusRight"
            :key="menu.id"
            type="button"
            @click="selectedMainMenu = menu.id"
            :class="[
              'px-3 md:px-5 py-2.5 text-xs md:text-sm font-semibold whitespace-nowrap transition-all rounded-t-lg',
              activeMenuId === menu.id
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-gray-700'
            ]"
          >
            <span class="hidden md:inline">{{ menu.icon }} </span>{{ menu.label }}
          </button>
        </div>
      </div>
    </nav>

    <!-- Main Content Area -->
    <div class="flex flex-1 overflow-hidden relative">
      <!-- Mobile overlay -->
      <div
        v-if="mobileMenuOpen"
        @click="mobileMenuOpen = false"
        class="fixed inset-0 bg-black/30 z-30 md:hidden"
      />

      <!-- Sidebar -->
      <aside
        :class="[
          'bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto transition-all duration-200 flex-shrink-0 z-40',
          // Mobile: slide-in overlay
          mobileMenuOpen ? 'fixed inset-y-0 left-0 w-64 shadow-xl md:relative md:shadow-none' : 'hidden md:block',
          // Desktop: collapse toggle
          sidebarCollapsed ? 'md:w-14' : 'md:w-56'
        ]"
      >
        <div class="p-3">
          <!-- Collapse toggle (desktop only) -->
          <div class="hidden md:flex items-center justify-between mb-3">
            <h2 v-if="!sidebarCollapsed" class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Menu</h2>
            <button
              @click="toggleSidebar"
              class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500"
              :title="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
            >
              <svg class="w-4 h-4 transition-transform" :class="{ 'rotate-180': sidebarCollapsed }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/>
              </svg>
            </button>
          </div>
          <!-- Mobile header -->
          <div class="flex items-center justify-between mb-3 md:hidden">
            <h2 class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Menu</h2>
            <button @click="mobileMenuOpen = false" class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <nav class="space-y-0.5">
            <button
              v-for="submenu in getSubmenus()"
              :key="submenu.id"
              type="button"
              @click="selectSubmenu(submenu)"
              :title="sidebarCollapsed ? submenu.label : undefined"
              :class="[
                'w-full text-left px-3 py-2 text-sm rounded transition-colors cursor-pointer',
                activeSubmenuId === submenu.id
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700',
                sidebarCollapsed ? 'md:px-2 md:text-center md:truncate' : ''
              ]"
            >
              <span v-if="sidebarCollapsed" class="hidden md:inline text-base" :title="submenu.label">{{ getSubmenuIcon(submenu.label) }}</span>
              <span :class="{ 'md:hidden': sidebarCollapsed }">{{ submenu.label }}</span>
            </button>
          </nav>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
        <div class="p-4 md:p-8">
          <!-- Breadcrumbs -->
          <nav v-if="breadcrumbs.length > 1" class="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-4">
            <template v-for="(crumb, idx) in breadcrumbs" :key="idx">
              <router-link
                v-if="crumb.route && idx < breadcrumbs.length - 1"
                :to="crumb.route"
                class="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >{{ crumb.label }}</router-link>
              <span v-else :class="{ 'text-gray-900 dark:text-gray-100 font-medium': idx === breadcrumbs.length - 1 }">{{ crumb.label }}</span>
              <span v-if="idx < breadcrumbs.length - 1" class="text-gray-300 dark:text-gray-600">/</span>
            </template>
          </nav>
          <router-view :key="route.path" />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, reactive } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useTheme } from '../composables/useTheme';
import { api } from '../lib/api';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const { isDark, toggleTheme, initTheme } = useTheme();

const companyName = import.meta.env.VITE_COMPANY_NAME || 'Manufacturing Company';

const showUserMenu = ref(false);
const mobileMenuOpen = ref(false);

// Sidebar collapse (persisted)
const sidebarCollapsed = ref(localStorage.getItem('sidebar-collapsed') === 'true');
const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value;
  localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed.value));
};

// Night mode toggle
const toggleNightMode = () => {
  toggleTheme();
};

const currentDate = ref(new Date().toLocaleDateString('id-ID', {
  weekday: 'short',
  year: 'numeric',
  month: 'short',
  day: 'numeric'
}));

// Header stats (live from API)
const headerStats = reactive({
  pendingApprovals: 0,
  stockItems: 0,
  activeWO: 0,
});

const fetchHeaderStats = async () => {
  try {
    const [notifRes, invRes, woRes] = await Promise.allSettled([
      api.get('/notifications/unread-count'),
      api.get('/inventory'),
      api.get('/workorders'),
    ]);
    if (notifRes.status === 'fulfilled') {
      headerStats.pendingApprovals = notifRes.value.data?.unreadCount ?? notifRes.value.data?.count ?? 0;
    }
    if (invRes.status === 'fulfilled') {
      const invData = invRes.value.data;
      headerStats.stockItems = Array.isArray(invData) ? invData.length : (invData?.total ?? invData?.length ?? 0);
    }
    if (woRes.status === 'fulfilled') {
      const woData = woRes.value.data;
      const woList = Array.isArray(woData) ? woData : (woData?.data ?? []);
      headerStats.activeWO = woList.filter((w: any) => w.status !== 'completed' && w.status !== 'cancelled').length;
    }
  } catch {
    // silently keep defaults
  }
};

// Breadcrumbs from route meta
const breadcrumbs = computed(() => {
  const meta = route.meta as Record<string, any>;
  if (meta.breadcrumb && Array.isArray(meta.breadcrumb)) {
    return meta.breadcrumb as Array<{ label: string; route?: string }>;
  }
  // Auto-generate from route path
  const segments = route.path.split('/').filter(Boolean);
  if (segments.length <= 1) return [];
  const crumbs: Array<{ label: string; route?: string }> = [{ label: 'Home', route: '/dashboard' }];
  let path = '';
  for (const seg of segments) {
    path += '/' + seg;
    crumbs.push({
      label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '),
      route: path,
    });
  }
  return crumbs;
});

// Close mobile menu on route change & refresh stats after login
watch(() => route.path, () => {
  mobileMenuOpen.value = false;
  if (localStorage.getItem('token') && headerStats.pendingApprovals === 0 && headerStats.stockItems === 0) {
    fetchHeaderStats();
  }
});

// Close user menu when clicking outside
let closeMenuHandler: ((e: MouseEvent) => void) | null = null;

onMounted(() => {
  initTheme();
  // Only fetch stats if user is authenticated
  if (localStorage.getItem('token')) {
    fetchHeaderStats();
  }

  closeMenuHandler = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const userMenuEl = document.querySelector('.relative');
    if (userMenuEl && !userMenuEl.contains(target)) {
      showUserMenu.value = false;
    }
  };
  document.addEventListener('click', closeMenuHandler);
});

onUnmounted(() => {
  if (closeMenuHandler) {
    document.removeEventListener('click', closeMenuHandler);
  }
});

interface Submenu {
  id: string;
  label: string;
  route?: string;
  name?: string;
}

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  submenus: Submenu[];
}

const selectedMainMenu = ref('dashboard');
const selectedSubmenu = ref('');

// Computed properties that always reflect current route
const activeMenuId = computed(() => {
  for (const menu of mainMenus) {
    if (menu.submenus.find(s => s.route === route.path)) {
      return menu.id;
    }
  }
  return selectedMainMenu.value;
});

const activeSubmenuId = computed(() => {
  for (const menu of mainMenus) {
    const sub = menu.submenus.find(s => s.route === route.path);
    if (sub) return sub.id;
  }
  return selectedSubmenu.value;
});

const mainMenus: MenuItem[] = [
  {
    id: 'projects',
    label: 'Project',
    icon: '📌',
    submenus: [
      { id: 'dashboard', label: 'Dashboard', route: '/dashboard' },
      { id: 'project-events', label: 'Events', route: '/project/events' },
      { id: 'clients', label: 'Clients', route: '/customers' },
      { id: 'projects', label: 'Projects', route: '/projects' },
      { id: 'tasks', label: 'Tasks', route: '/project/tasks' },
      { id: 'leads', label: 'Leads', route: '/leads' },
      { id: 'sales', label: 'Sales', route: '/sales' },
      { id: 'prospects', label: 'Prospects', route: '/project/prospects' },
      { id: 'notes', label: 'Notes', route: '/project/notes' },
      { id: 'messages', label: 'Messages', route: '/notifications' },
      { id: 'team', label: 'Team', route: '/users' },
      { id: 'tickets', label: 'Tickets', route: '/quality' },
      { id: 'expenses', label: 'Expenses', route: '/finance' },
      { id: 'reports', label: 'Reports', route: '/project/reports' },
      { id: 'help', label: 'Help & Support', route: '/project/help' },
      { id: 'settings', label: 'Settings', route: '/system-settings' },
    ]
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: '📊',
    submenus: [
      { id: 'dashboard-overview', label: 'Overview', route: '/dashboard' },
      { id: 'dashboard-production', label: 'Production KPI', route: '/dashboard/production' },
      { id: 'dashboard-inventory', label: 'Inventory KPI', route: '/dashboard/inventory' },
      { id: 'dashboard-sales', label: 'Sales KPI', route: '/dashboard/sales' },
      { id: 'dashboard-approvals', label: 'Approval Summary', route: '/dashboard/approvals' },
      { id: 'dashboard-alerts', label: 'Alerts', route: '/dashboard/alerts' },
    ]
  },
  {
    id: 'estimator',
    label: 'Estimator',
    icon: '🧮',
    submenus: [
      { id: 'estimator-proposals', label: 'Proposal', route: '/estimator' },
      { id: 'estimator-ahsp', label: 'AHSP', route: '/estimator/ahsp' },
      { id: 'estimator-masters', label: 'Satuan Dasar Harga', route: '/estimator/masters' },
    ]
  },
  {
    id: 'rnd',
    label: 'R&D',
    icon: '🔬',
    submenus: [
      { id: 'rnd-projects', label: 'R&D Projects', route: '/rnd/projects' },
      { id: 'rnd-kanban', label: 'Kanban Board', route: '/rnd/kanban' },
      { id: 'rnd-formulations', label: 'Formulations', route: '/rnd/formulations' },
      { id: 'rnd-lab-testing', label: 'Lab Testing', route: '/rnd/lab-testing' },
      { id: 'rnd-stability', label: 'Stability Studies', route: '/rnd/stability' },
    ]
  },
  {
    id: 'procurement',
    label: 'Procurement',
    icon: '🛒',
    submenus: [
      { id: 'procurement-dashboard', label: 'Overview', route: '/procurement', name: 'Procurement' },
      { id: 'purchase-requests', label: 'Purchase Requests', route: '/procurement/pr', name: 'ProcurementPR' },
      { id: 'purchase-orders', label: 'Purchase Orders', route: '/procurement/po', name: 'ProcurementPO' },
      { id: 'grn', label: 'Goods Receipt (GRN)', route: '/procurement/grn', name: 'ProcurementGRN' },
      { id: 'vendor-price-list', label: 'Vendor Price List', route: '/procurement/price-list', name: 'ProcurementVendorPriceList' },
      { id: 'material-price-comparison', label: 'Material Price Comparison', route: '/procurement/material-prices', name: 'MaterialPriceComparison' },
      { id: 'procurement-history', label: 'History', route: '/procurement/history', name: 'ProcurementHistory' },
    ]
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: '📦',
    submenus: [
      { id: 'inventory-dashboard', label: 'Overview', route: '/inventory', name: 'Inventory' },
      { id: 'stock-card', label: 'Stock Card', route: '/inventory/stock-card', name: 'InventoryStockCardReal' },
      { id: 'stock-transfer', label: 'Stock Transfer', route: '/inventory/transfer', name: 'InventoryTransferReal' },
      { id: 'stock-adjustment', label: 'Stock Adjustment', route: '/inventory/adjustment', name: 'InventoryAdjustmentReal' },
      { id: 'stock-opname', label: 'Stock Opname', route: '/inventory/opname', name: 'InventoryOpnameReal' },
      { id: 'batch-tracking', label: 'Batch / Lot Tracking', route: '/inventory/batch-tracking', name: 'InventoryBatchTrackingReal' },
      { id: 'expiry-monitoring', label: 'Expiry Monitoring', route: '/inventory/expiry', name: 'InventoryExpiryReal' },
      { id: 'warehouses', label: 'Warehouses', route: '/warehouses', name: 'Warehouses' },
      { id: 'warehouse-locations', label: 'Warehouse Locations', route: '/warehouse-locations', name: 'WarehouseLocations' },
    ]
  },
  {
    id: 'production',
    label: 'Production',
    icon: '🏭',
    submenus: [
      { id: 'production-planning', label: 'Planning', route: '/production/planning' },
      { id: 'mrp', label: 'Material Requirement', route: '/production/mrp' },
      { id: 'workorders', label: 'Work Orders', route: '/workorders' },
      { id: 'issue-material', label: 'Issue Material', route: '/production/issue-material' },
      { id: 'production-execution', label: 'Execution', route: '/production/execution' },
      { id: 'yield-scrap', label: 'Yield & Scrap', route: '/production/yield' },
      { id: 'fg-receipt', label: 'FG Receipt', route: '/production/fg-receipt' },
      { id: 'production-history', label: 'History', route: '/production/history' },
    ]
  },
  {
    id: 'quality',
    label: 'Quality',
    icon: '✓',
    submenus: [
      { id: 'qc-test-methods', label: 'Test Methods', route: '/quality/test-methods' },
      { id: 'qc-sampling', label: 'Sampling', route: '/quality/sampling' },
      { id: 'qc-results', label: 'Results', route: '/quality/results' },
      { id: 'batch-release', label: 'Batch Release', route: '/quality/batch-release' },
      { id: 'ncr', label: 'Non-Conformance', route: '/quality/ncr' },
      { id: 'rework', label: 'Rework', route: '/quality/rework' },
      { id: 'qc-reports', label: 'QC Reports', route: '/quality/reports' },
    ]
  },
  {
    id: 'sales',
    label: 'Sales',
    icon: '📈',
    submenus: [
      { id: 'sales-invoices', label: 'Invoices', route: '/sales/invoices' },
      { id: 'sales-orders-list', label: 'Orders List', route: '/sales/orders-list' },
      { id: 'sales-store', label: 'Store', route: '/sales/store' },
      { id: 'sales-payments', label: 'Payments', route: '/sales/payments' },
      { id: 'sales-items', label: 'Items', route: '/sales/items' },
      { id: 'sales-contracts', label: 'Contracts', route: '/sales/contracts' },
    ]
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: '💰',
    submenus: [
      { id: 'cogs', label: 'COGS Calculation', route: '/finance/cogs' },
      { id: 'ap', label: 'Accounts Payable', route: '/finance/ap' },
      { id: 'ar', label: 'Accounts Receivable', route: '/finance/ar' },
      { id: 'cost-analysis', label: 'Cost Analysis', route: '/finance/cost-analysis' },
      { id: 'margin-analysis', label: 'Margin Analysis', route: '/finance/margin' },
      { id: 'financial-summary', label: 'Financial Summary', route: '/finance/summary' },
      { id: 'fund-requests', label: 'Fund Requests', route: '/finance/fund-requests' },
    ]
  },
  {
    id: 'approval',
    label: 'Approval',
    icon: '✔️',
    submenus: [
      { id: 'approval-inbox', label: 'My Approval Inbox', route: '/approval/inbox' },
      { id: 'approval-history', label: 'Approval History', route: '/approval/history' },
      { id: 'approval-rules', label: 'Approval Rules', route: '/approval/rules' },
      { id: 'delegation', label: 'Delegation', route: '/approval/delegation' },
      { id: 'escalation', label: 'Escalation Rules', route: '/approval/escalation' },
    ]
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: '📄',
    submenus: [
      { id: 'production-reports', label: 'Production Reports', route: '/reports/production' },
      { id: 'inventory-reports', label: 'Inventory Reports', route: '/reports/inventory' },
      { id: 'procurement-reports', label: 'Procurement Reports', route: '/reports/procurement' },
      { id: 'qc-reports', label: 'QC Reports', route: '/reports/qc' },
      { id: 'sales-reports', label: 'Sales Reports', route: '/reports/sales' },
      { id: 'finance-reports', label: 'Finance Reports', route: '/reports/finance' },
      { id: 'custom-reports', label: 'Custom Reports', route: '/reports/custom' },
      { id: 'export-data', label: 'Export Data', route: '/reports/export' },
    ]
  },
  {
    id: 'master_data',
    label: 'Master Data',
    icon: '📦',
    submenus: [
      { id: 'units', label: 'Units of Measure', route: '/units', name: 'UnitOfMeasure' },
      { id: 'items', label: 'Items', route: '/items', name: 'Items' },
      { id: 'item-types', label: 'Item Types', route: '/item-types', name: 'ItemTypes' },
      { id: 'categories', label: 'Item Categories', route: '/categories', name: 'Categories' },
      { id: 'bom', label: 'Bill of Materials', route: '/bom', name: 'BOM' },
      { id: 'warehouses', label: 'Warehouses', route: '/warehouses', name: 'Warehouses' },
      { id: 'warehouse-locations', label: 'Warehouse Locations', route: '/warehouse-locations', name: 'WarehouseLocations' },
      { id: 'suppliers', label: 'Vendors', route: '/suppliers', name: 'Suppliers' },
      { id: 'customers', label: 'Customers', route: '/customers', name: 'Customers' },
      { id: 'employees', label: 'Employees', route: '/users', name: 'Users' },
      { id: 'departments', label: 'Departments', route: '/departments', name: 'Departments' },
    ]
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: '⚙️',
    submenus: [
      { id: 'users', label: 'Users', route: '/users' },
      { id: 'roles', label: 'Roles & Permissions', route: '/roles' },
      { id: 'system-settings', label: 'System Settings', route: '/admin/settings' },
      { id: 'approval-config', label: 'Approval Config', route: '/admin/approval-config' },
      { id: 'audit-log', label: 'Audit Log', route: '/admin/audit-log' },
      { id: 'notifications', label: 'Notification Settings', route: '/admin/notifications' },
      { id: 'integration', label: 'Integration Settings', route: '/admin/integration' },
      { id: 'backup', label: 'Backup & Restore', route: '/admin/backup' },
    ]
  },
];

// Split menus: left (all except last 2), right (Master Data + Admin)
const mainMenusLeft = computed(() => mainMenus.slice(0, -2).filter(menu => authStore.hasModuleAccess(menu.id)));
const mainMenusRight = computed(() => mainMenus.slice(-2).filter(menu => authStore.hasModuleAccess(menu.id)));

const getSubmenus = (): Submenu[] => {
  const menuId = selectedMainMenu.value || activeMenuId.value;
  const menu = mainMenus.find(m => m.id === menuId);
  return menu?.submenus || [];
};

// Extract first emoji or first letter as icon for collapsed sidebar
const getSubmenuIcon = (label: string): string => {
  const emojiMatch = label.match(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u);
  if (emojiMatch) return emojiMatch[0];
  return label.charAt(0).toUpperCase();
};

const selectSubmenu = async (submenu: Submenu) => {
  selectedSubmenu.value = submenu.id;
  mobileMenuOpen.value = false;

  if (!submenu.route) return;

  try {
    if (submenu.name) {
      await router.push({ name: submenu.name });
    } else {
      await router.push(submenu.route);
    }
  } catch {
    // navigation guard may cancel — ignore
  }
};

// Watch route changes to update menu highlights
watch(() => route.path, (newPath) => {
  for (const menu of mainMenus) {
    const submenu = menu.submenus.find(s => s.route === newPath);
    if (submenu) {
      selectedMainMenu.value = menu.id;
      break;
    }
  }
}, { immediate: true });

// User menu functions
const handleLogout = () => {
  authStore.logout();
  showUserMenu.value = false;
  router.push('/login');
};

const goToProfile = () => {
  showUserMenu.value = false;
  router.push('/users');
};

const goToSettings = () => {
  showUserMenu.value = false;
  router.push('/admin/settings');
};

const goToChangePassword = () => {
  showUserMenu.value = false;
  router.push('/change-password');
};

</script>

<style scoped>
/* Custom scrollbar for sidebar */
aside::-webkit-scrollbar {
  width: 6px;
}
aside::-webkit-scrollbar-track {
  background: transparent;
}
aside::-webkit-scrollbar-thumb {
  background: #c0c0c0;
  border-radius: 3px;
}
aside::-webkit-scrollbar-thumb:hover {
  background: #999;
}
.dark aside::-webkit-scrollbar-thumb {
  background: #555;
}

/* Thin scrollbar for horizontal tab menu */
.scrollbar-thin::-webkit-scrollbar {
  height: 3px;
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 2px;
}
</style>
