<template>
  <nav class="sticky top-0 z-30 bg-gradient-to-r from-cyan-600 via-blue-600 to-cyan-600 shadow-lg">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="flex items-center space-x-2">
          <span class="text-2xl">⚡</span>
          <span class="text-2xl">💧</span>
        </div>
        <div class="hidden sm:block">
          <p class="text-white font-bold text-lg leading-tight">AcceSelerate</p>
          <p class="text-xs text-white/80">Manufacturing ERP System</p>
        </div>
      </div>
      
      <div class="flex items-center space-x-1 text-sm">
        <!-- Menu Items with Dropdowns -->
        <div
          v-for="menu in menus"
          :key="menu.label"
          class="relative"
        >
          <button
            @click.stop="toggleMenu(menu.label)"
            class="px-3 py-2 rounded-lg transition hover:bg-white/20"
            :class="isMenuActive(menu) ? 'bg-white/30 text-white font-semibold' : 'text-white/90'"
          >
            {{ menu.label }}
            <span v-if="menu.submenus.length > 0" class="ml-1">▾</span>
          </button>
          
          <!-- Dropdown Submenu -->
          <div
            v-if="menu.submenus.length > 0 && activeMenu === menu.label"
            class="absolute left-0 mt-0 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50"
          >
            <router-link
              v-for="submenu in menu.submenus"
              :key="submenu.to"
              :to="submenu.to"
              class="block px-4 py-2 text-sm hover:bg-cyan-50 transition"
              :class="route.path === submenu.to ? 'bg-cyan-100 text-cyan-700 font-semibold' : 'text-gray-700'"
              @click="activeMenu = null"
            >
              <span v-if="submenu.status === 'active'" class="text-green-500 mr-2">✔</span>
              <span v-else-if="submenu.status === 'partial'" class="text-yellow-500 mr-2">!</span>
              <span v-else class="text-gray-300 mr-2">•</span>
              {{ submenu.label }}
            </router-link>
          </div>
        </div>
        
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
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const activeMenu = ref<string | null>(null);

// Toggle menu on click
const toggleMenu = (menuLabel: string) => {
  activeMenu.value = activeMenu.value === menuLabel ? null : menuLabel;
};

// Close menu when clicking outside
const closeMenuOnClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  // Don't close if clicking inside any menu dropdown
  if (!target.closest('nav')) {
    activeMenu.value = null;
  }
};

onMounted(() => {
  document.addEventListener('click', closeMenuOnClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', closeMenuOnClickOutside);
});

// 11 Main Menus with 80 Submenus structure

// 12 Main Menus with Project Overview included
const menus = [
  {
    label: 'Project',
    submenus: [
      { to: '/dashboard', label: '📊 Dashboard', status: 'active' },
      { to: '/project/events', label: '📅 Events', status: 'active' },
      { to: '/clients-management', label: '👥 Clients', status: 'active' },
      { to: '/projects', label: '📂 Projects', status: 'active' },
      { to: '/project/tasks', label: '✅ Tasks', status: 'active' },
      { to: '/leads', label: '🎯 Leads', status: 'active' },
      { to: '/sales', label: '💰 Sales', status: 'active' },
      { to: '/project/prospects', label: '🔍 Prospects', status: 'active' },
      { to: '/project/notes', label: '📝 Notes', status: 'active' },
      { to: '/notifications', label: '💬 Messages', status: 'active' },
      { to: '/users', label: '👨‍💼 Team', status: 'active' },
      { to: '/quality', label: '🎫 Tickets', status: 'active' },
      { to: '/finance', label: '💳 Expenses', status: 'active' },
      { to: '/project/reports', label: '📈 Reports', status: 'active' },
      { to: '/project/help', label: '❓ Help & Support', status: 'active' },
      { to: '/system-settings', label: '⚙️ Settings', status: 'active' },
    ]
  },
  {
    label: 'Dashboard',
    submenus: [
      { to: '/dashboard', label: 'Overview', status: 'active' },
      { to: '/dashboard/production', label: 'Production KPI', status: 'pending' },
      { to: '/dashboard/inventory', label: 'Inventory KPI', status: 'pending' },
      { to: '/dashboard/sales', label: 'Sales KPI', status: 'pending' },
      { to: '/dashboard/approvals', label: 'Approval Summary', status: 'pending' },
      { to: '/dashboard/alerts', label: 'Alerts', status: 'pending' },
    ]
  },
  {
    label: 'Estimator',
    submenus: [
      { to: '/estimator', label: 'Proposal', status: 'active' },
      { to: '/estimator/ahsp', label: 'AHSP', status: 'pending' },
      { to: '/estimator/masters', label: 'Satuan Dasar Harga', status: 'active' },
    ]
  },
  {
    label: 'Master Data',
    submenus: [
      { to: '/units', label: 'Units of Measure', status: 'active' },
      { to: '/items', label: 'Items', status: 'active' },
      { to: '/item-types', label: 'Item Types', status: 'active' },
      { to: '/categories', label: 'Item Categories', status: 'active' },
      { to: '/bom', label: 'Bill of Materials', status: 'active' },
      { to: '/warehouses', label: 'Warehouses', status: 'active' },
      { to: '/warehouse-locations', label: 'Warehouse Locations', status: 'active' },
      { to: '/suppliers', label: 'Vendors', status: 'active' },
      { to: '/customers', label: 'Customers', status: 'active' },
      { to: '/users', label: 'Employees', status: 'active' },
      { to: '/departments', label: 'Departments', status: 'active' },
    ]
  },
  {
    label: 'Procurement',
    submenus: [
      { to: '/procurement', label: 'Procurement Dashboard', status: 'active' },
      { to: '/procurement/pr', label: 'Purchase Request', status: 'active' },
      { to: '/procurement/pr-approval', label: 'PR Approval', status: 'pending' },
      { to: '/procurement/po', label: 'Purchase Order', status: 'active' },
      { to: '/procurement/po-approval', label: 'PO Approval', status: 'pending' },
      { to: '/procurement/grn', label: 'Goods Receipt', status: 'active' },
      { to: '/procurement/price-list', label: 'Vendor Price List', status: 'active' },
      { to: '/procurement/material-prices', label: 'Material Price Comparison', status: 'active' },
      { to: '/procurement/history', label: 'Procurement History', status: 'active' },
    ]
  },
  {
    label: 'Inventory',
    submenus: [
      { to: '/inventory/overview', label: 'Stock Overview', status: 'pending' },
      { to: '/inventory/stock-card', label: 'Stock Card', status: 'pending' },
      { to: '/inventory/transfer', label: 'Stock Transfer', status: 'pending' },
      { to: '/inventory/adjustment', label: 'Stock Adjustment', status: 'pending' },
      { to: '/inventory/opname', label: 'Stock Opname', status: 'pending' },
      { to: '/inventory/batch-tracking', label: 'Batch/Lot Tracking', status: 'pending' },
      { to: '/inventory/expiry', label: 'Expiry Monitoring', status: 'pending' },
    ]
  },
  {
    label: 'Production',
    submenus: [
      { to: '/production/planning', label: 'Production Planning', status: 'pending' },
      { to: '/production/mrp', label: 'Material Requirement', status: 'pending' },
      { to: '/workorders', label: 'Work Orders', status: 'pending' },
      { to: '/production/issue-material', label: 'Issue Material', status: 'pending' },
      { to: '/production/execution', label: 'Production Execution', status: 'pending' },
      { to: '/production/yield', label: 'Yield & Scrap', status: 'pending' },
      { to: '/production/fg-receipt', label: 'FG Receipt', status: 'pending' },
      { to: '/production/history', label: 'Production History', status: 'pending' },
    ]
  },
  {
    label: 'Quality',
    submenus: [
      { to: '/quality/test-methods', label: 'QC Test Methods', status: 'pending' },
      { to: '/quality/sampling', label: 'QC Sampling', status: 'pending' },
      { to: '/quality/results', label: 'QC Results', status: 'pending' },
      { to: '/quality/batch-release', label: 'Batch Release', status: 'pending' },
      { to: '/quality/ncr', label: 'Non-Conformance', status: 'pending' },
      { to: '/quality/rework', label: 'Rework', status: 'pending' },
      { to: '/quality/reports', label: 'QC Reports', status: 'pending' },
    ]
  },
  {
    label: 'Sales',
    submenus: [
      { to: '/sales/invoices', label: 'Invoices', status: 'active' },
      { to: '/sales/orders-list', label: 'Orders List', status: 'active' },
      { to: '/sales/store', label: 'Store', status: 'pending' },
      { to: '/sales/payments', label: 'Payments', status: 'active' },
      { to: '/sales/items', label: 'Items', status: 'pending' },
      { to: '/sales/contracts', label: 'Contracts', status: 'pending' },
    ]
  },
  {
    label: 'Finance',
    submenus: [
      { to: '/finance/cogs', label: 'COGS Calculation', status: 'pending' },
      { to: '/finance/ap', label: 'Accounts Payable', status: 'pending' },
      { to: '/finance/ar', label: 'Accounts Receivable', status: 'pending' },
      { to: '/finance/cost-analysis', label: 'Cost Analysis', status: 'pending' },
      { to: '/finance/margin', label: 'Margin Analysis', status: 'pending' },
      { to: '/finance/summary', label: 'Financial Summary', status: 'pending' },
      { to: '/finance/fund-requests', label: 'Fund Requests', status: 'pending' },
    ]
  },
  {
    label: 'Approval',
    submenus: [
      { to: '/approval/inbox', label: 'My Approval Inbox', status: 'pending' },
      { to: '/approval/history', label: 'Approval History', status: 'pending' },
      { to: '/approval/rules', label: 'Approval Rules', status: 'partial' },
      { to: '/approval/delegation', label: 'Delegation', status: 'pending' },
      { to: '/approval/escalation', label: 'Escalation Rules', status: 'pending' },
    ]
  },
  {
    label: 'Reports',
    submenus: [
      { to: '/reports/production', label: 'Production Reports', status: 'pending' },
      { to: '/reports/inventory', label: 'Inventory Reports', status: 'pending' },
      { to: '/reports/procurement', label: 'Procurement Reports', status: 'pending' },
      { to: '/reports/qc', label: 'QC Reports', status: 'pending' },
      { to: '/reports/sales', label: 'Sales Reports', status: 'pending' },
      { to: '/reports/finance', label: 'Finance Reports', status: 'pending' },
      { to: '/reports/custom', label: 'Custom Reports', status: 'pending' },
      { to: '/reports/export', label: 'Export Data', status: 'pending' },
    ]
  },
  {
    label: 'Admin',
    submenus: [
      { to: '/users', label: 'Users', status: 'active' },
      { to: '/roles', label: 'Roles & Permissions', status: 'active' },
      { to: '/admin/settings', label: 'System Settings', status: 'pending' },
      { to: '/admin/approval-config', label: 'Approval Configuration', status: 'partial' },
      { to: '/admin/audit-log', label: 'Audit Log', status: 'pending' },
      { to: '/admin/notifications', label: 'Notification Settings', status: 'pending' },
      { to: '/admin/integration', label: 'Integration Settings', status: 'pending' },
      { to: '/admin/backup', label: 'Backup & Restore', status: 'pending' },
    ]
  },
];

const isMenuActive = (menu: any) => {
  return menu.submenus.some((sub: any) => route.path === sub.to);
};

const handleLogout = () => {
  authStore.logout();
  router.push('/login');
};
</script>
