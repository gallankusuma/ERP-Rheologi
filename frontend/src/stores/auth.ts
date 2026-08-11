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

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  permissionsHydrated: boolean;
}

// in-flight hydration promise so multiple callers don't race
let hydrationPromise: Promise<void> | null = null;

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    token: localStorage.getItem('token'),
    isAuthenticated: !!localStorage.getItem('token'),
    permissionsHydrated: false,
  }),

  getters: {
    /** Check if the user has a specific permission like 'inventory.dashboard.view' */
    hasPermission: (state) => (permission: string): boolean => {
      if (!state.user) return false;
      return state.user.permissions?.includes(permission) || false;
    },
  },

  actions: {
    async login(email: string, password: string) {
      try {
        const response = await api.post('/auth/login', { email, password });
        this.token = response.data.token;
        this.user = response.data.user;
        this.isAuthenticated = true;
        this.permissionsHydrated = true;
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        setAuthToken(response.data.token);
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
        this.permissionsHydrated = true;
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        setAuthToken(response.data.token);
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
      // hydrate permissions from server before marking ready
      if (this.isAuthenticated) {
        await this.refreshPermissions();
      }
      this.permissionsHydrated = true;
    },

    async ensureHydrated(): Promise<void> {
      if (this.permissionsHydrated) return;
      if (!hydrationPromise) {
        hydrationPromise = this.refreshPermissions().then(() => {
          this.permissionsHydrated = true;
          hydrationPromise = null;
        });
      }
      return hydrationPromise;
    },

    async refreshPermissions() {
      try {
        const response = await api.get('/auth/me');
        if (response.data?.user) {
          this.user = response.data.user;
          localStorage.setItem('user', JSON.stringify(response.data.user));
        }
      } catch (e) {
        // silent fail — user keeps existing permissions
      }
    },
  },
});
