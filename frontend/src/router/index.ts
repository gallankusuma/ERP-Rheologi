import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import Dashboard from '../views/Dashboard.vue';
import Login from '../views/Login.vue';
import { getResourceForPath } from '../config/menuPermissions';

const placeholderComponent = () => import('../views/PlaceholderPage.vue');

const placeholderMeta: Array<{path: string; name: string; title: string}> = [
  // Dashboard — all moved to real routes below

  // Master Data removed from placeholder, now active routes below

  // Procurement — all moved to real routes below

  // Inventory — real routes exist, so exclude placeholders for these paths

  // Production — all moved to real routes below

  // Quality — all moved to real routes below

  // Sales — all moved to real routes below

  // Finance — all moved to real routes below

  // Approval — all moved to real routes below

  // Reports — all moved to real routes below

  // Admin — all moved to real routes below
];

const placeholderRoutes: RouteRecordRaw[] = placeholderMeta.map((item) => ({
  path: item.path,
  name: item.name,
  component: placeholderComponent,
  meta: {
    requiresAuth: true,
    title: item.title,
    description: 'Placeholder page — coming soon',
  },
}));

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard,
    meta: { requiresAuth: true },
  },
  {
    path: '/ppic',
    component: () => import('../views/ppic/PpicLayout.vue'),
    meta: { requiresAuth: true },
    redirect: '/ppic/forecast',
    children: [
      {
        path: 'forecast',
        name: 'PpicForecast',
        component: () => import('../views/ppic/SalesForecast.vue'),
        meta: { title: 'PPIC - Sales Forecast' },
      },
      {
        path: 'mps',
        name: 'PpicMps',
        component: () => import('../views/ppic/MpsMaster.vue'),
        meta: { title: 'PPIC - MPS' },
      },
      {
        path: 'mrp',
        name: 'PpicMrp',
        component: () => import('../views/ppic/MrpMaster.vue'),
        meta: { title: 'PPIC - MRP' },
      },
      {
        path: 'capacity',
        name: 'PpicCapacity',
        component: () => import('../views/ppic/CapacityPlanning.vue'),
        meta: { title: 'PPIC - Capacity Planning' },
      },
      {
        path: 'reports',
        name: 'PpicReports',
        component: () => import('../views/ppic/StockReports.vue'),
        meta: { title: 'PPIC - Stock Reports' },
      }
    ]
  },
  {
    path: '/dashboard',
    name: 'DashboardHome',
    component: Dashboard,
    meta: { requiresAuth: true },
  },
  {
    path: '/projects',
    name: 'ProjectsManagement',
    component: () => import('../views/ProjectsManagement.vue'),
    meta: { requiresAuth: true, title: 'Projects' },
  },
  {
    path: '/projects/:id',
    name: 'ProjectDetail',
    component: () => import('../views/ProjectDetail.vue'),
    meta: { requiresAuth: true, title: 'Project Details', breadcrumb: [{ label: 'Projects', route: '/projects' }, { label: 'Detail' }] },
  },
  // CRM Module
  {
    path: '/crm',
    name: 'CrmDashboard',
    component: () => import('../views/CrmDashboard.vue'),
    meta: { requiresAuth: true, title: 'CRM Dashboard' },
  },
  {
    path: '/crm/sales',
    name: 'CrmSales',
    component: () => import('../views/CrmSales.vue'),
    meta: { requiresAuth: true, title: 'Sales' },
  },
  {
    path: '/leads',
    name: 'Leads',
    component: () => import('../views/Leads.vue'),
    meta: { requiresAuth: true, title: 'Leads' },
  },
  {
    path: '/leads/:id',
    name: 'LeadDetail',
    component: () => import('../views/LeadDetail.vue'),
    meta: { requiresAuth: true, title: 'Lead Details' },
  },
  {
    path: '/project/prospects',
    name: 'Prospects',
    component: () => import('../views/Prospects.vue'),
    meta: { requiresAuth: true, title: 'Prospects' },
  },
  {
    path: '/project/notes',
    name: 'CrmNotes',
    component: () => import('../views/CrmNotes.vue'),
    meta: { requiresAuth: true, title: 'Notes' },
  },
  {
    path: '/mail',
    name: 'Mail',
    component: () => import('../views/Mail.vue'),
    meta: { requiresAuth: true, title: 'Mail' },
  },
  {
    path: '/login',
    name: 'Login',
    component: Login,
  },
  {
    path: '/products',
    name: 'Products',
    component: () => import('../views/Products.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/bom',
    name: 'BOM',
    component: () => import('../views/BOM.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/batches',
    name: 'Batches',
    component: () => import('../views/Batches.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/workorders',
    name: 'WorkOrders',
    component: () => import('../views/WorkOrders.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/inventory',
    name: 'Inventory',
    component: () => import('../views/Inventory.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/inventory/overview',
    name: 'InventoryOverview',
    component: () => import('../views/Inventory.vue'),
    meta: { requiresAuth: true, breadcrumb: [{ label: 'Inventory' }, { label: 'Stock Overview' }] },
  },
  // Inventory detail routes (override placeholders)
  {
    path: '/inventory/stock-card',
    name: 'InventoryStockCardReal',
    component: () => import('../views/StockCard.vue'),
    meta: { requiresAuth: true, breadcrumb: [{ label: 'Inventory', route: '/inventory' }, { label: 'Stock Card' }] },
  },
  {
    path: '/inventory/transfer',
    name: 'InventoryTransferReal',
    component: () => import('../views/StockTransfer.vue'),
    meta: { requiresAuth: true, breadcrumb: [{ label: 'Inventory', route: '/inventory' }, { label: 'Stock Transfer' }] },
  },
  {
    path: '/inventory/adjustment',
    name: 'InventoryAdjustmentReal',
    component: () => import('../views/StockAdjustment.vue'),
    meta: { requiresAuth: true, breadcrumb: [{ label: 'Inventory', route: '/inventory' }, { label: 'Stock Adjustment' }] },
  },
  {
    path: '/inventory/opname',
    name: 'InventoryOpnameReal',
    component: () => import('../views/StockOpname.vue'),
    meta: { requiresAuth: true, breadcrumb: [{ label: 'Inventory', route: '/inventory' }, { label: 'Stock Opname' }] },
  },
  {
    path: '/inventory/batch-tracking',
    name: 'InventoryBatchTrackingReal',
    component: () => import('../views/BatchTracking.vue'),
    meta: { requiresAuth: true, breadcrumb: [{ label: 'Inventory', route: '/inventory' }, { label: 'Batch Tracking' }] },
  },
  {
    path: '/inventory/expiry',
    name: 'InventoryExpiryReal',
    component: () => import('../views/ExpiryMonitoring.vue'),
    meta: { requiresAuth: true, breadcrumb: [{ label: 'Inventory', route: '/inventory' }, { label: 'Expiry Monitoring' }] },
  },
  {
    path: '/procurement',
    name: 'Procurement',
    component: () => import('../views/Procurement.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/procurement/pr',
    name: 'ProcurementPR',
    component: () => import('../views/PurchaseRequests.vue'),
    meta: { requiresAuth: true, breadcrumb: [{ label: 'Procurement', route: '/procurement' }, { label: 'Purchase Requests' }] },
  },
  {
    path: '/procurement/po',
    name: 'ProcurementPO',
    component: () => import('../views/PurchaseOrders.vue'),
    meta: { requiresAuth: true, breadcrumb: [{ label: 'Procurement', route: '/procurement' }, { label: 'Purchase Orders' }] },
  },
  {
    path: '/procurement/grn',
    name: 'ProcurementGRN',
    component: () => import('../views/GoodReceipt.vue'),
    meta: { requiresAuth: true, breadcrumb: [{ label: 'Procurement', route: '/procurement' }, { label: 'Goods Receipt' }] },
  },
  {
    path: '/procurement/price-list',
    name: 'ProcurementVendorPriceList',
    component: () => import('../views/VendorPriceList.vue'),
    meta: { requiresAuth: true, breadcrumb: [{ label: 'Procurement', route: '/procurement' }, { label: 'Vendor Price List' }] },
  },
  {
    path: '/procurement/material-prices',
    name: 'MaterialPriceComparison',
    component: () => import('../views/MaterialPriceComparison.vue'),
    meta: { requiresAuth: true, breadcrumb: [{ label: 'Procurement', route: '/procurement' }, { label: 'Material Price Comparison' }] },
  },
  {
    path: '/procurement/history',
    name: 'ProcurementHistory',
    component: () => import('../views/ProcurementHistory.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/procurement/pr-approval',
    name: 'ProcurementPRApprovalPage',
    component: () => import('../views/ProcurementPRApproval.vue'),
    meta: { requiresAuth: true, title: 'PR Approval', breadcrumb: [{ label: 'Procurement', route: '/procurement' }, { label: 'PR Approval' }] },
  },
  {
    path: '/procurement/po-approval',
    name: 'ProcurementPOApprovalPage',
    component: () => import('../views/ProcurementPOApproval.vue'),
    meta: { requiresAuth: true, title: 'PO Approval', breadcrumb: [{ label: 'Procurement', route: '/procurement' }, { label: 'PO Approval' }] },
  },
  {
    path: '/sales',
    name: 'Sales',
    component: () => import('../views/Sales.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/warehouses',
    name: 'Warehouses',
    component: () => import('../views/Warehouses.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/warehouse-locations',
    name: 'WarehouseLocations',
    component: () => import('../views/WarehouseLocations.vue'),
    meta: { requiresAuth: true, title: 'Warehouse Locations' },
  },
  {
    path: '/quality',
    name: 'Quality',
    component: () => import('../views/Quality.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/categories',
    name: 'Categories',
    component: () => import('../views/Categories.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/line-processes',
    name: 'LineProcesses',
    component: () => import('../views/LineProcesses.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/line-processes/:id',
    name: 'LineProcessDetail',
    component: () => import('../views/LineProcessDetail.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/item-types',
    name: 'ItemTypes',
    component: () => import('../views/ItemTypes.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/units',
    name: 'UnitOfMeasure',
    component: () => import('../views/UnitOfMeasure.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/items',
    name: 'Items',
    component: () => import('../views/Items.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/suppliers',
    name: 'Suppliers',
    component: () => import('../views/Suppliers.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/customers',
    name: 'Customers',
    component: () => import('../views/ClientsManagement.vue'),
    meta: { requiresAuth: true, title: 'Clients Management' },
  },
  {
    path: '/product-types',
    name: 'ProductTypes',
    component: () => import('../views/ProductTypes.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/departments',
    name: 'Departments',
    component: () => import('../views/Departments.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/roles',
    name: 'Roles',
    component: () => import('../views/Roles.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/users',
    name: 'Users',
    component: () => import('../views/Users.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/transactions',
    name: 'Transactions',
    component: () => import('../views/Transactions.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/employees',
    name: 'Employees',
    component: () => import('../views/Employees.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/attendance',
    name: 'AttendanceTracking',
    component: () => import('../views/AttendanceTracking.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/finance',
    name: 'Finance',
    component: () => import('../views/Finance.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/audit-log',
    name: 'AuditLog',
    component: () => import('../views/AuditLog.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/notifications',
    name: 'Notifications',
    component: () => import('../views/Notifications.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/system-settings',
    name: 'SystemSettings',
    component: () => import('../views/SystemSettings.vue'),
    meta: { requiresAuth: true },
  },
  // Client Management Module
  {
    path: '/sample-requests',
    name: 'SampleRequests',
    component: () => import('../views/SampleRequests.vue'),
    meta: { requiresAuth: true, title: 'Sample Requests' },
  },
  {
    path: '/sample-requests/:id',
    name: 'SampleRequestDetail',
    component: () => import('../views/SampleRequestDetail.vue'),
    meta: { requiresAuth: true, title: 'Sample Request Detail' },
  },
  {
    path: '/clients-management',
    name: 'ClientsManagement',
    component: () => import('../views/ClientsManagement.vue'),
    meta: { requiresAuth: true, title: 'Client Management' },
  },
  {
    path: '/clients/:id',
    name: 'ClientDetail',
    component: () => import('../views/ClientDetail.vue'),
    meta: { requiresAuth: true, title: 'Client Detail' },
  },
  {
    path: '/client-categories',
    name: 'ClientCategories',
    component: () => import('../views/ClientCategories.vue'),
    meta: { requiresAuth: true, title: 'Client Categories' },
  },
  {
    path: '/forecast-brands',
    name: 'ForecastBrands',
    component: () => import('../views/ForecastBrands.vue'),
    meta: { requiresAuth: true, title: 'Forecast Brands' },
  },
  // Estimator Module
  {
    path: '/estimator',
    name: 'EstimatorProposalList',
    component: () => import('../views/EstimatorProposalList.vue'),
    meta: { requiresAuth: true, title: 'Estimator - Proposals' },
  },
  {
    path: '/estimator/proposals/:id',
    name: 'EstimatorProposalEditor',
    component: () => import('../views/EstimatorProposalEditor.vue'),
    meta: { requiresAuth: true, title: 'Estimator - Proposal Editor' },
  },
  {
    path: '/estimator/proposals/:id/rab',
    name: 'EstimatorRAB',
    component: () => import('../views/EstimatorRAB.vue'),
    meta: { requiresAuth: true, title: 'Estimator - RAB' },
  },
  {
    path: '/estimator/masters',
    name: 'EstimatorMasters',
    component: () => import('../views/EstimatorMasters.vue'),
    meta: { requiresAuth: true, title: 'Estimator - Satuan Dasar Harga' },
  },
  {
    path: '/estimator/ahsp',
    name: 'EstimatorAHSP',
    component: () => import('../views/EstimatorAHSP.vue'),
    meta: { requiresAuth: true, title: 'Estimator - AHSP' },
  },
  {
    path: '/estimator/hsp',
    name: 'EstimatorHSP',
    component: () => import('../views/EstimatorHSP.vue'),
    meta: { requiresAuth: true, title: 'Estimator - HSP' },
  },
  // HR Module
  {
    path: '/hr/employees',
    name: 'HREmployees',
    component: () => import('../views/hr/Employees.vue'),
    meta: { requiresAuth: true, title: 'HR - Employees' },
  },
  {
    path: '/hr/attendance',
    name: 'HRAttendance',
    component: () => import('../views/hr/AttendanceTracking.vue'),
    meta: { requiresAuth: true, title: 'HR - Attendance' },
  },
  {
    path: '/hr/payroll',
    name: 'HRPayroll',
    component: () => import('../views/hr/PayrollCalculator.vue'),
    meta: { requiresAuth: true, title: 'HR - Payroll' },
  },
  {
    path: '/hr/position-rates',
    name: 'HRPositionRates',
    component: () => import('../views/hr/PositionRates.vue'),
    meta: { requiresAuth: true, title: 'HR - Position Rates' },
  },
  {
    path: '/hr/salary-advances',
    name: 'HRSalaryAdvances',
    component: () => import('../views/hr/SalaryAdvances.vue'),
    meta: { requiresAuth: true, title: 'HR - Salary Advances' },
  },
  {
    path: '/hr/mobile-portal',
    name: 'HRMobilePortal',
    component: () => import('../views/hr/MobilePortal.vue'),
    meta: { requiresAuth: true, title: 'HR - Mobile Portal' },
  },
  // R&D Module
  {
    path: '/rnd/projects',
    name: 'RnDProjects',
    component: () => import('../views/RnDProjects.vue'),
    meta: { requiresAuth: true, title: 'R&D Projects' },
  },
  {
    path: '/rnd/projects/:id',
    name: 'RnDProjectDetail',
    component: () => import('../views/RnDProjectDetail.vue'),
    meta: { requiresAuth: true, title: 'R&D Project Detail' },
  },
  {
    path: '/rnd/kanban',
    name: 'RnDKanban',
    component: () => import('../views/RnDKanban.vue'),
    meta: { requiresAuth: true, title: 'R&D Kanban Board' },
  },
  {
    path: '/rnd/formulations',
    name: 'RnDFormulation',
    component: () => import('../views/RnDFormulation.vue'),
    meta: { requiresAuth: true, title: 'R&D Formulations' },
  },
  {
    path: '/rnd/specifications',
    name: 'RnDSpecifications',
    component: () => import('../views/RnDSpecifications.vue'),
    meta: { requiresAuth: true, title: 'R&D Specifications' },
  },
  {
    path: '/rnd/lab-testing',
    name: 'RnDLabTesting',
    component: () => import('../views/RnDLabTesting.vue'),
    meta: { requiresAuth: true, title: 'R&D Lab Testing' },
  },
  {
    path: '/rnd/stability',
    name: 'RnDStability',
    component: () => import('../views/RnDStability.vue'),
    meta: { requiresAuth: true, title: 'R&D Stability Studies' },
  },
  {
    path: '/sales-orders',
    name: 'SalesOrdersReal',
    component: () => import('../views/SalesOrders.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/deliveries',
    name: 'DeliveriesReal',
    component: () => import('../views/Deliveries.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/sales-invoices',
    name: 'SalesInvoicesReal',
    component: () => import('../views/SalesInvoices.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/project/events',
    name: 'ProductionEvents',
    component: () => import('../views/EventsCalendar.vue'),
    meta: { requiresAuth: true, title: 'Production Events' },
  },
  {
    path: '/project/tasks',
    name: 'CrmTasks',
    component: () => import('../views/CrmTasks.vue'),
    meta: { requiresAuth: true, title: 'CRM Tasks' },
  },
  {
    path: '/sales/shipment',
    name: 'ShipmentTracking',
    component: () => import('../views/ShipmentTracking.vue'),
    meta: { requiresAuth: true, title: 'Shipment Tracking' },
  },
  {
    path: '/sales/payments',
    name: 'CustomerPayments',
    component: () => import('../views/CustomerPayments.vue'),
    meta: { requiresAuth: true, title: 'Customer Payments' },
  },
  {
    path: '/sales/orders-list',
    name: 'SalesOrdersListPage',
    component: () => import('../views/SalesOrdersList.vue'),
    meta: { requiresAuth: true, title: 'Sales Orders' },
  },
  {
    path: '/sales/invoices',
    name: 'SalesInvoicesPage',
    component: () => import('../views/SalesInvoices.vue'),
    meta: { requiresAuth: true, title: 'Sales Invoices' },
  },
  {
    path: '/sales/store',
    name: 'SalesStorePage',
    component: () => import('../views/SalesStore.vue'),
    meta: { requiresAuth: true, title: 'Store' },
  },
  {
    path: '/sales/items',
    name: 'SalesItemsPage',
    component: () => import('../views/SalesItems.vue'),
    meta: { requiresAuth: true, title: 'Sales Items' },
  },
  {
    path: '/sales/contracts',
    name: 'SalesContractsPage',
    component: () => import('../views/SalesContracts.vue'),
    meta: { requiresAuth: true, title: 'Sales Contracts' },
  },
  // Production Module
  {
    path: '/production/planning',
    name: 'ProductionPlanningPage',
    component: () => import('../views/ProductionPlanning.vue'),
    meta: { requiresAuth: true, title: 'Production Planning' },
  },
  {
    path: '/production/mrp',
    name: 'ProductionMRPPage',
    component: () => import('../views/ProductionMRP.vue'),
    meta: { requiresAuth: true, title: 'Material Requirement Planning' },
  },
  {
    path: '/production/issue-material',
    name: 'ProductionIssueMaterialPage',
    component: () => import('../views/ProductionIssueMaterial.vue'),
    meta: { requiresAuth: true, title: 'Issue Material' },
  },
  {
    path: '/production/execution',
    name: 'ProductionExecutionPage',
    component: () => import('../views/ProductionExecution.vue'),
    meta: { requiresAuth: true, title: 'Production Execution' },
  },
  {
    path: '/production/yield',
    name: 'ProductionYieldPage',
    component: () => import('../views/ProductionYield.vue'),
    meta: { requiresAuth: true, title: 'Yield & Scrap' },
  },
  {
    path: '/production/fg-receipt',
    name: 'ProductionFGReceiptPage',
    component: () => import('../views/ProductionFGReceipt.vue'),
    meta: { requiresAuth: true, title: 'FG Receipt' },
  },
  {
    path: '/production/history',
    name: 'ProductionHistoryPage',
    component: () => import('../views/ProductionHistory.vue'),
    meta: { requiresAuth: true, title: 'Production History' },
  },
  // Quality Module
  {
    path: '/quality/test-methods',
    name: 'QualityTestMethodsPage',
    component: () => import('../views/QualityTestMethods.vue'),
    meta: { requiresAuth: true, title: 'QC Test Methods' },
  },
  {
    path: '/quality/sampling',
    name: 'QualitySamplingPage',
    component: () => import('../views/QualitySampling.vue'),
    meta: { requiresAuth: true, title: 'QC Sampling Plans' },
  },
  {
    path: '/quality/results',
    name: 'QualityResultsPage',
    component: () => import('../views/QualityResults.vue'),
    meta: { requiresAuth: true, title: 'QC Results' },
  },
  {
    path: '/quality/batch-release',
    name: 'QualityBatchReleasePage',
    component: () => import('../views/QualityBatchRelease.vue'),
    meta: { requiresAuth: true, title: 'Batch Release' },
  },
  {
    path: '/quality/ncr',
    name: 'QualityNCRPage',
    component: () => import('../views/QualityNCR.vue'),
    meta: { requiresAuth: true, title: 'Non-Conformance Reports' },
  },
  {
    path: '/quality/ncr/:id',
    name: 'QualityNCRDetailPage',
    component: () => import('../views/QualityNCRDetail.vue'),
    meta: { requiresAuth: true, title: 'NCR Detail' },
  },
  {
    path: '/quality/rework',
    name: 'QualityReworkPage',
    component: () => import('../views/QualityRework.vue'),
    meta: { requiresAuth: true, title: 'Rework Orders' },
  },
  {
    path: '/quality/reports',
    name: 'QualityReports',
    component: () => import('../views/QualityReports.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/qc/master',
    name: 'QCMasterData',
    component: () => import('../views/QCMasterData.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/qc/fpa',
    name: 'QCAnalysisRequests',
    component: () => import('../views/QCAnalysisRequests.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/qc/fpa/:id',
    name: 'QCFpaDetail',
    component: () => import('../views/QCFpaDetail.vue'),
    meta: { requiresAuth: true, title: 'FPA Detail' },
  },
  {
    path: '/quality/reports',
    name: 'QualityReportsPage',
    component: () => import('../views/QualityReports.vue'),
    meta: { requiresAuth: true, title: 'QC Reports & Analytics' },
  },
  // Finance Module
  {
    path: '/finance/cogs',
    name: 'FinanceCOGSPage',
    component: () => import('../views/FinanceCOGS.vue'),
    meta: { requiresAuth: true, title: 'COGS Calculation' },
  },
  {
    path: '/finance/ap',
    name: 'FinanceAPPage',
    component: () => import('../views/FinanceAP.vue'),
    meta: { requiresAuth: true, title: 'Accounts Payable' },
  },
  {
    path: '/finance/ar',
    name: 'FinanceARPage',
    component: () => import('../views/FinanceAR.vue'),
    meta: { requiresAuth: true, title: 'Accounts Receivable' },
  },
  {
    path: '/finance/cost-analysis',
    name: 'FinanceCostAnalysisPage',
    component: () => import('../views/FinanceCostAnalysis.vue'),
    meta: { requiresAuth: true, title: 'Cost Analysis' },
  },
  {
    path: '/finance/margin',
    name: 'FinanceMarginPage',
    component: () => import('../views/FinanceMargin.vue'),
    meta: { requiresAuth: true, title: 'Margin Analysis' },
  },
  {
    path: '/finance/summary',
    name: 'FinanceSummaryPage',
    component: () => import('../views/FinanceSummary.vue'),
    meta: { requiresAuth: true, title: 'Financial Summary' },
  },
  {
    path: '/finance/fund-requests',
    name: 'FinanceFundRequestsPage',
    component: () => import('../views/FinanceFundRequests.vue'),
    meta: { requiresAuth: true, title: 'Fund Requests' },
  },
  // Sales Module
  {
    path: '/sales/orders',
    name: 'SalesOrderListPage',
    component: () => import('../views/SalesOrderList.vue'),
    meta: { requiresAuth: true, title: 'Sales Orders' },
  },
  {
    path: '/sales/approval',
    name: 'SalesApprovalPage',
    component: () => import('../views/SalesApproval.vue'),
    meta: { requiresAuth: true, title: 'SO Approval' },
  },
  {
    path: '/sales/price-list',
    name: 'SalesPriceListPage',
    component: () => import('../views/SalesPriceList.vue'),
    meta: { requiresAuth: true, title: 'Price List' },
  },
  {
    path: '/sales/delivery',
    name: 'SalesDeliveryPage',
    component: () => import('../views/SalesDeliveryOrders.vue'),
    meta: { requiresAuth: true, title: 'Delivery Orders' },
  },
  {
    path: '/sales/history',
    name: 'SalesHistoryPage',
    component: () => import('../views/SalesHistoryView.vue'),
    meta: { requiresAuth: true, title: 'Sales History' },
  },
  // Approval Module
  {
    path: '/approval/inbox',
    name: 'ApprovalInboxPage',
    component: () => import('../views/ApprovalInbox.vue'),
    meta: { requiresAuth: true, title: 'My Approval Inbox' },
  },
  {
    path: '/approval/history',
    name: 'ApprovalHistoryPage',
    component: () => import('../views/ApprovalHistory.vue'),
    meta: { requiresAuth: true, title: 'Approval History' },
  },
  {
    path: '/approval/rules',
    name: 'ApprovalRulesPage',
    component: () => import('../views/ApprovalRules.vue'),
    meta: { requiresAuth: true, title: 'Approval Rules' },
  },
  {
    path: '/approval/delegation',
    name: 'ApprovalDelegationPage',
    component: () => import('../views/ApprovalDelegation.vue'),
    meta: { requiresAuth: true, title: 'Delegation' },
  },
  {
    path: '/approval/escalation',
    name: 'ApprovalEscalationPage',
    component: () => import('../views/ApprovalEscalation.vue'),
    meta: { requiresAuth: true, title: 'Escalation Rules' },
  },
  // Reports Module
  {
    path: '/reports/production',
    name: 'ReportsProductionPage',
    component: () => import('../views/ReportsProduction.vue'),
    meta: { requiresAuth: true, title: 'Production Reports' },
  },
  {
    path: '/reports/inventory',
    name: 'ReportsInventoryPage',
    component: () => import('../views/ReportsInventory.vue'),
    meta: { requiresAuth: true, title: 'Inventory Reports' },
  },
  {
    path: '/reports/procurement',
    name: 'ReportsProcurementPage',
    component: () => import('../views/ReportsProcurement.vue'),
    meta: { requiresAuth: true, title: 'Procurement Reports' },
  },
  {
    path: '/reports/qc',
    name: 'ReportsQCPage',
    component: () => import('../views/ReportsQC.vue'),
    meta: { requiresAuth: true, title: 'QC Reports' },
  },
  {
    path: '/reports/sales',
    name: 'ReportsSalesPage',
    component: () => import('../views/ReportsSales.vue'),
    meta: { requiresAuth: true, title: 'Sales Reports' },
  },
  {
    path: '/reports/finance',
    name: 'ReportsFinancePage',
    component: () => import('../views/ReportsFinance.vue'),
    meta: { requiresAuth: true, title: 'Finance Reports' },
  },
  {
    path: '/reports/custom',
    name: 'ReportsCustomPage',
    component: () => import('../views/ReportsCustom.vue'),
    meta: { requiresAuth: true, title: 'Custom Reports' },
  },
  {
    path: '/reports/export',
    name: 'ReportsExportPage',
    component: () => import('../views/ReportsExport.vue'),
    meta: { requiresAuth: true, title: 'Export Data' },
  },
  // Dashboard KPI Module
  {
    path: '/dashboard/production',
    name: 'DashboardProductionKPIPage',
    component: () => import('../views/DashboardProductionKPI.vue'),
    meta: { requiresAuth: true, title: 'Production KPI' },
  },
  {
    path: '/dashboard/inventory',
    name: 'DashboardInventoryKPIPage',
    component: () => import('../views/DashboardInventoryKPI.vue'),
    meta: { requiresAuth: true, title: 'Inventory KPI' },
  },
  {
    path: '/dashboard/sales',
    name: 'DashboardSalesKPIPage',
    component: () => import('../views/DashboardSalesKPI.vue'),
    meta: { requiresAuth: true, title: 'Sales KPI' },
  },
  {
    path: '/dashboard/approvals',
    name: 'DashboardApprovalSummaryPage',
    component: () => import('../views/DashboardApprovalSummary.vue'),
    meta: { requiresAuth: true, title: 'Approval Summary' },
  },
  {
    path: '/dashboard/alerts',
    name: 'DashboardAlertsPage',
    component: () => import('../views/DashboardAlerts.vue'),
    meta: { requiresAuth: true, title: 'Alerts' },
  },
  // Admin Module
  {
    path: '/admin/document-control',
    name: 'AdminDocumentControlPage',
    component: () => import('../views/AdminDocumentControl.vue'),
    meta: { requiresAuth: true, title: 'Document Control' },
  },
  {
    path: '/admin/settings',
    name: 'AdminSettingsPage',
    component: () => import('../views/SystemSettings.vue'),
    meta: { requiresAuth: true, title: 'System Settings' },
  },
  {
    path: '/admin/approval-config',
    name: 'AdminApprovalConfigPage',
    component: () => import('../views/AdminApprovalConfig.vue'),
    meta: { requiresAuth: true, title: 'Approval Configuration' },
  },
  {
    path: '/admin/audit-log',
    name: 'AdminAuditLogPage',
    component: () => import('../views/AuditLog.vue'),
    meta: { requiresAuth: true, title: 'Audit Log' },
  },
  {
    path: '/admin/notifications',
    name: 'AdminNotificationsPage',
    component: () => import('../views/AdminNotifications.vue'),
    meta: { requiresAuth: true, title: 'Notification Settings' },
  },
  {
    path: '/admin/integration',
    name: 'AdminIntegrationPage',
    component: () => import('../views/AdminIntegration.vue'),
    meta: { requiresAuth: true, title: 'Integration Settings' },
  },
  {
    path: '/admin/backup',
    name: 'AdminBackupPage',
    component: () => import('../views/AdminBackup.vue'),
    meta: { requiresAuth: true, title: 'Backup & Restore' },
  },
  // User Profile
  {
    path: '/change-password',
    name: 'ChangePassword',
    component: () => import('../views/ChangePassword.vue'),
    meta: { requiresAuth: true, title: 'Change Password' },
  },
  // General Ledger / Finance & Accounting
  {
    path: '/finance/general-ledger',
    name: 'GeneralLedger',
    component: () => import('../views/GeneralLedger.vue'),
    meta: { requiresAuth: true, title: 'General Ledger' },
  },
  ...placeholderRoutes,
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Navigation guard for authentication + per-menu permission (mirrors the sidebar filtering in
// Layout.vue — this covers direct URL entry / bookmarks / back-button to a page whose menu
// entry was hidden because the current role isn't granted view access to it).
router.beforeEach(async (to, _from, next) => {
  const { useAuthStore } = await import('../stores/auth');
  const authStore = useAuthStore();

  // check token from store first, fallback to localStorage for first load
  const isAuthenticated = authStore.isAuthenticated || !!localStorage.getItem('token');

  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login');
    return;
  }
  if (to.name === 'Login' && isAuthenticated) {
    next('/');
    return;
  }

  // block direct URL access to pages the role can't view (mirrors sidebar filtering)
  if (isAuthenticated && to.meta.requiresAuth) {
    // ensure permissions are hydrated from server before checking
    await authStore.ensureHydrated();

    const resource = getResourceForPath(to.path);
    if (resource) {
      const hasAccess = authStore.hasPermission(`${resource}.view`);
      if (!hasAccess) {
        next('/');
        return;
      }
    }
  }

  next();
});

export default router;

