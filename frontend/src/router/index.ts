import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import Dashboard from '../views/Dashboard.vue';
import Login from '../views/Login.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard,
    meta: { requiresAuth: true },
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
    path: '/procurement',
    name: 'Procurement',
    component: () => import('../views/Procurement.vue'),
    meta: { requiresAuth: true },
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
    path: '/quality',
    name: 'Quality',
    component: () => import('../views/Quality.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/data-master/categories',
    name: 'Categories',
    component: () => import('../views/Categories.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/data-master/units',
    name: 'UnitOfMeasure',
    component: () => import('../views/UnitOfMeasure.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/data-master/suppliers',
    name: 'Suppliers',
    component: () => import('../views/Suppliers.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/data-master/customers',
    name: 'Customers',
    component: () => import('../views/Customers.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/data-master/product-types',
    name: 'ProductTypes',
    component: () => import('../views/ProductTypes.vue'),
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Navigation guard for authentication
router.beforeEach((to, _from, next) => {
  const isAuthenticated = localStorage.getItem('token');
  
  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login');
  } else if (to.name === 'Login' && isAuthenticated) {
    next('/');
  } else {
    next();
  }
});

export default router;
