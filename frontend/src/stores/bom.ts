import { defineStore } from 'pinia';
import { api } from '../lib/api';

interface BOM {
  id: number;
  product_id: number;
  product_name?: string;
  component_product_id: number;
  component_name?: string;
  component_sku?: string;
  quantity: number;
  unit?: string;
  notes?: string;
  created_at: string;
}

interface BOMState {
  boms: BOM[];
  loading: boolean;
  error: string | null;
}

export const useBOMStore = defineStore('bom', {
  state: (): BOMState => ({
    boms: [],
    loading: false,
    error: null,
  }),

  actions: {
    async fetchBOMs(productId?: number) {
      this.loading = true;
      this.error = null;
      try {
        const url = productId ? `/bom?product_id=${productId}` : `/bom`;
        const response = await api.get(url);
        this.boms = response.data.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to fetch BOMs';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async createBOM(bomData: any) {
      try {
        const payload = {
          product_id: bomData.product_id,
          component_product_id: bomData.component_product_id,
          quantity: bomData.quantity,
          unit: bomData.unit,
          notes: bomData.notes,
          loss_percent: bomData.loss_percent || 0,
          is_sub_bom: bomData.is_sub_bom || false,
        };
        const response = await api.post(`/bom`, payload);
        await this.fetchBOMs();
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to create BOM';
        throw error;
      }
    },

    async updateBOM(id: number, bomData: any) {
      try {
        const payload = {
          product_id: bomData.product_id,
          component_product_id: bomData.component_product_id,
          quantity: bomData.quantity,
          unit: bomData.unit,
          notes: bomData.notes,
          loss_percent: bomData.loss_percent || 0,
          is_sub_bom: bomData.is_sub_bom || false,
        };
        const response = await api.put(`/bom/${id}`, payload);
        await this.fetchBOMs();
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to update BOM';
        throw error;
      }
    },

    async deleteBOM(id: number) {
      try {
        await api.delete(`/bom/${id}`);
        await this.fetchBOMs();
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to delete BOM';
        throw error;
      }
    },
  },
});
