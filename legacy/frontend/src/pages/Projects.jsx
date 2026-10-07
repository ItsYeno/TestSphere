import React, { useState, useEffect } from 'react';
import ListItemIcon from '@mui/material/ListItemIcon';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Alert,
  useTheme
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Folder as FolderIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { projectService, teamService } from '../services/api';
import { useSnackbar } from 'notistack';
import LoadingSpinner from '../components/common/LoadingSpinner';

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    repository_url: '',
    team_id: ''
  });
  const [formErrors, setFormErrors] = useState({});

  const { user, isAdmin } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();

  useEffect(() => {
    fetchProjects();
    fetchTeams();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await projectService.getAll();
      setProjects(response.data.data || []);
    } catch (error) {
      enqueueSnackbar('Failed to fetch projects', { variant: 'error' });
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeams = async () => {
    try {
      const response = await teamService.getAll();
      setTeams(response.data.data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  const handleMenuOpen = (event, project) => {
    setMenuAnchor(event.currentTarget);
    setSelectedProject(project);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedProject(null);
  };

  const handleCreateOpen = () => {
    setFormData({
      name: '',
      description: '',
      repository_url: '',
      team_id: user.team_id
    });
    setFormErrors({});
    setCreateDialogOpen(true);
  };

  const handleCreateClose = () => {
    setCreateDialogOpen(false);
    setFormErrors({});
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear field error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Project name is required';
    }
    
    if (!formData.team_id) {
      errors.team_id = 'Team selection is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateProject = async () => {
    if (!validateForm()) return;

    try {
      await projectService.create(formData);
      enqueueSnackbar('Project created successfully', { variant: 'success' });
      handleCreateClose();
      fetchProjects();
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to create project';
      enqueueSnackbar(message, { variant: 'error' });
    }
  };

  const handleDeleteProject = async () => {
    if (!selectedProject) return;

    try {
      await projectService.delete(selectedProject.id);
      enqueueSnackbar('Project deleted successfully', { variant: 'success' });
      handleMenuClose();
      fetchProjects();
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to delete project';
      enqueueSnackbar(message, { variant: 'error' });
    }
  };

  const getTeamColor = (teamName) => {
    const colors = {
      mobile: 'success',
      web: 'info',
      api: 'warning'
    };
    return colors[teamName] || 'default';
  };

  const filteredProjects = isAdmin() 
    ? projects 
    : projects.filter(project => project.team_id === user.team_id);

  if (loading) {
    return <LoadingSpinner message="Loading projects..." />;
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight="700" gutterBottom>
            Projects
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage and monitor your testing projects
          </Typography>
        </Box>

        {(isAdmin() || user.role === 'tester') && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateOpen}
          >
            New Project
          </Button>
        )}
      </Box>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <FolderIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Projects Found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {isAdmin() || user.role === 'tester' 
                ? 'Get started by creating your first project' 
                : 'No projects have been assigned to your team yet'
              }
            </Typography>
            {(isAdmin() || user.role === 'tester') && (
              <Button variant="contained" onClick={handleCreateOpen}>
                Create Project
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {filteredProjects.map((project) => (
            <Grid item xs={12} sm={6} lg={4} key={project.id}>
              <Card 
                sx={{ 
                  height: '100%',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: theme.shadows[8]
                  }
                }}
              >
                <CardContent>
                  {/* Project Header */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                      <FolderIcon 
                        sx={{ 
                          fontSize: 32, 
                          color: 'primary.main' 
                        }} 
                      />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" fontWeight="600" noWrap>
                          {project.name}
                        </Typography>
                        <Chip
                          label={project.team?.display_name}
                          color={getTeamColor(project.team?.name)}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    </Box>

                    {(isAdmin() || user.role === 'tester') && (
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, project)}
                      >
                        <MoreIcon />
                      </IconButton>
                    )}
                  </Box>

                  {/* Project Description */}
                  {project.description && (
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ mb: 2, lineHeight: 1.5 }}
                    >
                      {project.description}
                    </Typography>
                  )}

                  {/* Repository Link */}
                  {project.repository_url && (
                    <Typography 
                      variant="caption" 
                      component="a"
                      href={project.repository_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        color: 'primary.main',
                        textDecoration: 'none',
                        '&:hover': { textDecoration: 'underline' }
                      }}
                    >
                      View Repository
                    </Typography>
                  )}

                  {/* Project Stats */}
                  <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                    <Typography variant="caption" color="text.secondary">
                      Created {new Date(project.created_at).toLocaleDateString()}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create Project Dialog */}
      <Dialog 
        open={createDialogOpen} 
        onClose={handleCreateClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Project</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Project Name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              error={!!formErrors.name}
              helperText={formErrors.name}
              fullWidth
              required
            />

            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              multiline
              rows={3}
              fullWidth
            />

            <TextField
              label="Repository URL"
              value={formData.repository_url}
              onChange={(e) => handleInputChange('repository_url', e.target.value)}
              placeholder="https://github.com/your-org/your-repo"
              fullWidth
            />

            <FormControl fullWidth error={!!formErrors.team_id}>
              <InputLabel>Team *</InputLabel>
              <Select
                value={formData.team_id}
                label="Team *"
                onChange={(e) => handleInputChange('team_id', e.target.value)}
              >
                {teams.map((team) => (
                  <MenuItem key={team.id} value={team.id}>
                    {team.display_name}
                  </MenuItem>
                ))}
              </Select>
              {formErrors.team_id && (
                <Typography variant="caption" color="error">
                  {formErrors.team_id}
                </Typography>
              )}
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCreateClose}>Cancel</Button>
          <Button 
            onClick={handleCreateProject}
            variant="contained"
          >
            Create Project
          </Button>
        </DialogActions>
      </Dialog>

      {/* Project Actions Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          Edit Project
        </MenuItem>
        <MenuItem 
          onClick={handleDeleteProject}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          Delete Project
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default Projects;