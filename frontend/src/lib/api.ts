import axios, { AxiosError } from 'axios';

const env = (import.meta as unknown as { env: { VITE_API_URL?: string } }).env;
// Ensure API calls hit the Express routes mounted at /api
const baseURL = env.VITE_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL,
});

// Store error callback for use in interceptors
let errorCallback: ((error: string) => void) | null = null;

export const setErrorCallback = (callback: (error: string) => void) => {
  errorCallback = callback;
};

// Request Interceptor: Add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response Interceptor: Handle errors
let isRedirecting = false;
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    const data = error.response?.data as any;
    const message = data?.error || data?.message || error.message || 'An error occurred';
    const url = error.config?.url || '';

    if (status === 401) {
      // Only redirect to login if we truly have no valid session
      // Check: is this a core auth-protected route (not a peripheral/optional endpoint)?
      const isCoreRoute = ['/users', '/rnd/', '/departments', '/inventory', '/workorders', '/products', '/procurement/'].some(r => url.includes(r));
      const isAuthRoute = url.includes('/auth/');
      
      if (!isAuthRoute && isCoreRoute && !isRedirecting) {
        // Token is truly expired - redirect once
        isRedirecting = true;
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
      // For non-core routes or mutation requests, just reject so catch blocks work
      return Promise.reject(error);
    } else if (status === 403) {
      if (errorCallback) {
        errorCallback('You do not have permission to perform this action');
      }
    } else if (status === 404) {
      if (errorCallback) {
        errorCallback('Resource not found');
      }
    } else if (status === 500) {
      if (errorCallback) {
        errorCallback('Server error. Please try again later');
      }
    } else {
      if (errorCallback) {
        errorCallback(message);
      }
    }

    return Promise.reject(error);
  }
);

export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

// Export useApi composable for components that need it
export const useApi = () => {
  return { api };
};
