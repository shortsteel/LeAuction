import axios from 'axios';
import { message } from 'antd';

const client = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach JWT token
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle errors
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;

    if (status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Don't redirect if on public pages or auth pages
      const path = window.location.pathname;
      const isPublicPage = path === '/' || path.startsWith('/items/');
      const isAuthPage = path.startsWith('/login') || path.startsWith('/register');
      if (!isPublicPage && !isAuthPage) {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    const errorMsg = data?.errors?.[0] || data?.message || '请求失败，请稍后重试';
    message.error(errorMsg);

    return Promise.reject(error);
  }
);

export default client;
