import { defineStore } from 'pinia';
import { api } from '../lib/api';

interface Department {
  id: number;
  code: string;
  name: string;
  description?: string;
  head_user_id?: number;
  head_user_name?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface DepartmentState {
  departments: Department[];
  loading: boolean;
  error: string | null;
}

export const useDepartmentStore = defineStore('department', {
  state: (): DepartmentState => ({
    departments: [],
    loading: false,
    error: null,
  }),

  actions: {
    async fetchDepartments() {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.get('/departments');
        this.departments = response.data.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to fetch departments';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async createDepartment(deptData: { code: string; name: string; description?: string }) {
      try {
        const response = await api.post('/departments', deptData);
        await this.fetchDepartments();
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to create department';
        throw error;
      }
    },

    async updateDepartment(id: number, deptData: { code: string; name: string; description?: string; head_user_id?: number; active: boolean }) {
      try {
        const response = await api.put(`/departments/${id}`, deptData);
        await this.fetchDepartments();
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to update department';
        throw error;
      }
    },

    async deleteDepartment(id: number) {
      try {
        await api.delete(`/departments/${id}`);
        await this.fetchDepartments();
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to delete department';
        throw error;
      }
    },
  },
});
