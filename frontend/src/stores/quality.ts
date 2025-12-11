import { defineStore } from 'pinia';
import { api } from '../lib/api';

export const useQualityStore = defineStore('quality', {
  state: () => ({
    batches: [] as any[],
    qcTests: [] as any[],
    qcResults: [] as any[],
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async fetchBatches() {
      this.loading = true;
      this.error = null;
      try {
        const res = await api.get('/quality/batches');
        this.batches = res.data.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to fetch batches';
      } finally {
        this.loading = false;
      }
    },
    async fetchQcTests() {
      this.loading = true;
      this.error = null;
      try {
        const res = await api.get('/quality/qc-tests');
        this.qcTests = res.data.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to fetch QC tests';
      } finally {
        this.loading = false;
      }
    },
    async fetchQcResults(batchId?: number) {
      this.loading = true;
      this.error = null;
      try {
        const url = batchId ? `/quality/qc-results?batch_id=${batchId}` : '/quality/qc-results';
        const res = await api.get(url);
        this.qcResults = res.data.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to fetch QC results';
      } finally {
        this.loading = false;
      }
    },

    async createBatch(payload: {
      batch_number?: string;
      product_id: number;
      work_order_id?: number;
      mfg_date?: string;
      exp_date?: string;
      status?: string;
    }) {
      const res = await api.post('/quality/batches', payload);
      await this.fetchBatches();
      return res.data;
    },

    async createQcTest(payload: { name: string; description?: string }) {
      const res = await api.post('/quality/qc-tests', payload);
      await this.fetchQcTests();
      return res.data;
    },

    async createQcResult(payload: {
      batch_id: number;
      test_id: number;
      result?: string;
      status?: string;
      tested_at?: string;
      tester_id?: number;
      notes?: string;
    }) {
      const res = await api.post('/quality/qc-results', payload);
      await this.fetchQcResults();
      return res.data;
    },
  },
});
