import { authAPI } from './api';

export const authService = {
  login: async (credentials) => {
    const response = await authAPI.post('/auth/login', credentials);
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await authAPI.get('/auth/me');
    return response.data;
  },

  refreshToken: async () => {
    const response = await authAPI.post('/auth/refresh');
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('testsphere_token');
    delete authAPI.defaults.headers.common['Authorization'];
  }
};