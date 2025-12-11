import { defineStore } from 'pinia';
import { api } from '../lib/api';

export const useSalesStore = defineStore('sales', {
  state: () => ({
    customers: [] as any[],
    salesOrders: [] as any[],
    deliveries: [] as any[],
    invoices: [] as any[],
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async fetchCustomers() {
      this.loading = true;
      this.error = null;
      try {
        const res = await api.get('/sales/customers');
        this.customers = res.data.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to fetch customers';
      } finally {
        this.loading = false;
      }
    },
    async fetchSalesOrders() {
      this.loading = true;
      this.error = null;
      try {
        const res = await api.get('/sales/sales-orders');
        this.salesOrders = res.data.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to fetch sales orders';
      } finally {
        this.loading = false;
      }
    },
    async fetchDeliveries() {
      this.loading = true;
      this.error = null;
      try {
        const res = await api.get('/sales/deliveries');
        this.deliveries = res.data.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to fetch deliveries';
      } finally {
        this.loading = false;
      }
    },
    async fetchInvoices() {
      this.loading = true;
      this.error = null;
      try {
        const res = await api.get('/sales/invoices');
        this.invoices = res.data.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to fetch invoices';
      } finally {
        this.loading = false;
      }
    },

    async createCustomer(payload: { code: string; name: string; contact?: string; phone?: string; email?: string; address?: string }) {
      const res = await api.post('/sales/customers', payload);
      await this.fetchCustomers();
      return res.data;
    },

    async createSalesOrder(payload: {
      so_number?: string;
      customer_id: number;
      status?: string;
      expected_ship_date?: string;
      currency?: string;
      notes?: string;
      items: { product_id: number; quantity: number; uom?: string; unit_price?: number; currency?: string; notes?: string }[];
    }) {
      const res = await api.post('/sales/sales-orders', payload);
      await this.fetchSalesOrders();
      return res.data;
    },

    async createDelivery(payload: { do_number?: string; so_id: number; warehouse_id?: number; status?: string; shipped_at?: string; notes?: string }) {
      const res = await api.post('/sales/deliveries', payload);
      await this.fetchDeliveries();
      return res.data;
    },

    async createInvoice(payload: {
      invoice_number?: string;
      so_id: number;
      amount: number;
      currency?: string;
      status?: string;
      issued_at?: string;
      due_at?: string;
      notes?: string;
    }) {
      const res = await api.post('/sales/invoices', payload);
      await this.fetchInvoices();
      return res.data;
    },
  },
});
