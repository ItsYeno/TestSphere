import { authAPI } from './api';

export const projectService = {
  getAll: async () => {
    const response = await authAPI.get('/projects');
    return response.data;
  },

  getById: async (id) => {
    const response = await authAPI.get(`/projects/${id}`);
    return response.data;
  },

  create: async (projectData) => {
    const response = await authAPI.post('/projects', projectData);
    return response.data;
  },

  update: async (id, projectData) => {
    const response = await authAPI.put(`/projects/${id}`, projectData);
    return response.data;
  },

  delete: async (id) => {
    const response = await authAPI.delete(`/projects/${id}`);
    return response.data;
  },

  getTestRuns: async (id) => {
    const response = await authAPI.get(`/projects/${id}/test-runs`);
    return response.data;
  }
};