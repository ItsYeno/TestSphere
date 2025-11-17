import { useState, useEffect } from 'react';
import { projectService } from '../services/projects';
import { useSnackbar } from 'notistack';

export const useProjects = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await projectService.getAll();
      setProjects(response.data || []);
      setError(null);
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to fetch projects';
      setError(message);
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const createProject = async (projectData) => {
    try {
      const response = await projectService.create(projectData);
      enqueueSnackbar('Project created successfully', { variant: 'success' });
      await fetchProjects(); // Refresh the list
      return { success: true, data: response.data };
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to create project';
      enqueueSnackbar(message, { variant: 'error' });
      return { success: false, error: message };
    }
  };

  const updateProject = async (id, projectData) => {
    try {
      const response = await projectService.update(id, projectData);
      enqueueSnackbar('Project updated successfully', { variant: 'success' });
      await fetchProjects(); // Refresh the list
      return { success: true, data: response.data };
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to update project';
      enqueueSnackbar(message, { variant: 'error' });
      return { success: false, error: message };
    }
  };

  const deleteProject = async (id) => {
    try {
      await projectService.delete(id);
      enqueueSnackbar('Project deleted successfully', { variant: 'success' });
      await fetchProjects(); // Refresh the list
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to delete project';
      enqueueSnackbar(message, { variant: 'error' });
      return { success: false, error: message };
    }
  };

  return {
    projects,
    loading,
    error,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject
  };
};