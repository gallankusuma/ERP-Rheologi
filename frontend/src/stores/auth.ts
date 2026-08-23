import { defineStore } from 'pinia';
import { api, setAuthToken } from '../lib/api';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  role_id?: number | null;
  user_level?: number;
  department_name?: string;
  department?: string;
  permissions?: string[];
  permission_version?: string | null;
}

type PermissionState = 'LOADING' | 'READY' | 'FAILED';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  permissionsHydrated: boolean;
  permissionState: PermissionState;
  permissionError: string | null;
}

// in-flight hydration promise so multiple callers don't race
let hydrationPromise: Promise<void> | null = null;

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    token: localStorage.getItem('token'),
    isAuthenticated: !!localStorage.getItem('token'),
    permissionsHydrated: false,
    permissionState: 'LOADING',
    permissionError: null,
  }),

  getters: {
    /** Check if the user has a specific permission like 'inventory.dashboard.view' */
    hasPermission: (state) => (permission: string): boolean => {
      if (!state.user) return false;
      // fail-closed: if permissions aren't hydrated, deny
      if (!state.permissionsHydrated) return false;
      if (state.permissionState !== 'READY') return false;
      return state.user.permissions?.includes(permission) || false;
    },

    /** True when permission state is explicitly FAILED (not just loading) */
    isPermissionFailed: (state) => state.permissionState === 'FAILED',
    /** True when permissions are still loading */
    isPermissionLoading: (state) => state.permissionState === 'LOADING',
  },

  actions: {
    async login(email: string, password: string) {
      try {
        const response = await api.post('/auth/login', { email, password });
        this.token = response.data.token;
        this.user = response.data.user;
        this.isAuthenticated = true;
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        setAuthToken(response.data.token);

        // validate that login returned a proper permissions array
        if (Array.isArray(response.data.user?.permissions)) {
          this.permissionsHydrated = true;
          this.permissionState = 'READY';
          this.permissionError = null;
        } else {
          // login succeeded but permissions missing — hydrate from /auth/me
          const hydrated = await this.refreshPermissions();
          this.permissionsHydrated = hydrated;
          this.permissionState = hydrated ? 'READY' : 'FAILED';
          if (!hydrated) this.permissionError = 'Login succeeded but permissions could not be loaded';
        }

        return response.data;
      } catch (error: any) {
        throw error.response?.data || error;
      }
    },

    async register(name: string, email: string, password: string) {
      try {
        const response = await api.post('/auth/register', { name, email, password });
        this.token = response.data.token;
        this.user = response.data.user;
        this.isAuthenticated = true;
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        setAuthToken(response.data.token);

        // register response doesn't include role_id/permissions,
        // so hydrate from /auth/me before marking ready
        this.permissionState = 'LOADING';
        const hydrated = await this.refreshPermissions();
        this.permissionsHydrated = hydrated;
        this.permissionState = hydrated ? 'READY' : 'FAILED';
        if (!hydrated) this.permissionError = 'Registration succeeded but permissions could not be loaded';

        return response.data;
      } catch (error: any) {
        throw error.response?.data || error;
      }
    },

    logout() {
      this.token = null;
      this.user = null;
      this.isAuthenticated = false;
      this.permissionsHydrated = false;
      this.permissionState = 'LOADING';
      this.permissionError = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setAuthToken(null);
    },

    async initializeAuth() {
      const token = localStorage.getItem('token');
      const user = localStorage.getItem('user');
      if (token) {
        this.token = token;
        this.isAuthenticated = true;
        setAuthToken(token);
      }
      if (user) {
        try {
          this.user = JSON.parse(user);
        } catch (e) {
          console.warn('Failed to parse stored user');
        }
      }
      // hydrate permissions from server — explicit state tracking
      if (this.isAuthenticated) {
        this.permissionState = 'LOADING';
        this.permissionError = null;
        const hydrated = await this.refreshPermissions();
        this.permissionsHydrated = hydrated;
        this.permissionState = hydrated ? 'READY' : 'FAILED';
        if (!hydrated) this.permissionError = 'Permission bootstrap failed — server may be unreachable';
      } else {
        // not authenticated, nothing to hydrate
        this.permissionsHydrated = true;
        this.permissionState = 'READY';
      }
    },

    async ensureHydrated(): Promise<void> {
      if (this.permissionsHydrated && this.permissionState === 'READY') return;
      if (!hydrationPromise) {
        this.permissionState = 'LOADING';
        hydrationPromise = this.refreshPermissions().then((ok) => {
          this.permissionsHydrated = ok;
          this.permissionState = ok ? 'READY' : 'FAILED';
          if (!ok) this.permissionError = 'Permission refresh failed';
          hydrationPromise = null;
        });
      }
      return hydrationPromise;
    },

    // retry after FAILED state
    async retryPermissions(): Promise<boolean> {
      this.permissionState = 'LOADING';
      this.permissionError = null;
      const ok = await this.refreshPermissions();
      this.permissionsHydrated = ok;
      this.permissionState = ok ? 'READY' : 'FAILED';
      if (!ok) this.permissionError = 'Permission retry failed — check connection and try again';
      return ok;
    },

    // returns true if /auth/me succeeded, false otherwise
    async refreshPermissions(): Promise<boolean> {
      try {
        const response = await api.get('/auth/me');
        if (response.data?.user) {
          this.user = response.data.user;
          localStorage.setItem('user', JSON.stringify(response.data.user));
          // validate permissions array
          if (!Array.isArray(response.data.user.permissions)) {
            console.warn('auth/me returned user without permissions array');
          }
          return true;
        }
        return false;
      } catch (e: any) {
        // 401 = token expired/invalid — force logout
        if (e.response?.status === 401) {
          this.logout();
        }
        console.warn('Permission hydration failed:', e.message || e);
        return false;
      }
    },
  },
});
