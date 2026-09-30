import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token from localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('vendorflow_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for unified error formatting
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If 401 Unauthorized occurs on protected routes (expired/invalid token), handle gracefully
    if (error.response?.status === 401) {
      // Clear expired session if present
      const token = localStorage.getItem('vendorflow_token');
      if (token && error.config.url !== '/auth/login') {
        localStorage.removeItem('vendorflow_token');
        localStorage.removeItem('vendorflow_user');
      }
    }

    const customError = {
      message: error.response?.data?.message || error.message || 'An unexpected error occurred',
      status: error.response?.status || null,
      data: error.response?.data || null,
    };
    return Promise.reject(customError);
  }
);

export default api;
