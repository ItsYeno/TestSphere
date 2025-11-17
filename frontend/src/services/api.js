import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// Create axios instance with base configuration
export const authAPI = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add auth token
authAPI.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('testsphere_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle common errors
authAPI.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('testsphere_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API service functions
export const authService = {
  login: (credentials) => authAPI.post('/auth/login', credentials),
  getCurrentUser: () => authAPI.get('/auth/me'),
  refreshToken: () => authAPI.post('/auth/refresh')
};

export const userService = {
  getAll: () => authAPI.get('/users'),
  getById: (id) => authAPI.get(`/users/${id}`),
  create: (userData) => authAPI.post('/users', userData),
  update: (id, userData) => authAPI.put(`/users/${id}`, userData),
  delete: (id) => authAPI.delete(`/users/${id}`)
};

export const teamService = {
  getAll: () => authAPI.get('/teams'),
  getById: (id) => authAPI.get(`/teams/${id}`),
  getMembers: (id) => authAPI.get(`/teams/${id}/members`)
};

export const projectService = {
  getAll: () => authAPI.get('/projects'),
  getById: (id) => authAPI.get(`/projects/${id}`),
  create: (projectData) => authAPI.post('/projects', projectData),
  update: (id, projectData) => authAPI.put(`/projects/${id}`, projectData),
  getTestRuns: (id) => authAPI.get(`/projects/${id}/test-runs`)
};

export const testRunService = {
  getAll: (params) => authAPI.get('/test-runs', { params }),
  getById: (id) => authAPI.get(`/test-runs/${id}`),
  create: (testRunData) => authAPI.post('/test-runs', testRunData),
  getTestCases: (id) => authAPI.get(`/test-runs/${id}/test-cases`)
};

export default authAPI;