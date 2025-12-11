import axios from 'axios';

const env = (import.meta as unknown as { env: { VITE_API_URL?: string } }).env;
const baseURL = env.VITE_API_URL || 'http://localhost:3000/api';

export const api = axios.create({
  baseURL,
});

// Ensure Authorization header is sent on every request if token exists in localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};
