import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  IconButton,
  useTheme
} from '@mui/material';
import {
  PlayArrow as RunIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { useAuth } from '../contexts/AuthContext';
import { testRunService, projectService } from '../services/api';
import { useSnackbar } from 'notistack';
import { format } from 'date-fns';
import LoadingSpinner from '../components/common/LoadingSpinner';

const TestRuns = () => {
  const [testRuns, setTestRuns] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    project_id: '',
    status: '',
    environment: '',
    build_version: ''
  });
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 10
  });

  const { user, isAdmin } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();

  useEffect(() => {
    fetchTestRuns();
    fetchProjects();
  }, [filters, paginationModel]);

  const fetchTestRuns = async () => {
    try {
      setLoading(true);
      const params = {
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
        ...filters
      };

      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (!params[key]) delete params[key];
      });

      const response = await testRunService.getAll(params);
      setTestRuns(response.data.data || []);
    } catch (error) {
      enqueueSnackbar('Failed to fetch test runs', { variant: 'error' });
      console.error('Error fetching test runs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await projectService.getAll();
      setProjects(response.data.data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
    setPaginationModel(prev => ({ ...prev, page: 0 }));
  };

  const clearFilters = () => {
    setFilters({
      project_id: '',
      status: '',
      environment: '',
      build_version: ''
    });
  };

  const getStatusChip = (status) => {
    const statusConfig = {
      passed: { label: 'Passed', color: 'success' },
      failed: { label: 'Failed', color: 'error' },
      in_progress: { label: 'In Progress', color: 'info' },
      aborted: { label: 'Aborted', color: 'warning' }
    };

    const config = statusConfig[status] || { label: status, color: 'default' };
    
    return (
      <Chip
        label={config.label}
        color={config.color}
        size="small"
        variant="filled"
      />
    );
  };

  const getEnvironmentChip = (environment) => {
    const envConfig = {
      development: { label: 'Development', color: 'default' },
      staging: { label: 'Staging', color: 'info' },
      preproduction: { label: 'Pre-Prod', color: 'warning' },
      production: { label: 'Production', color: 'success' }
    };

    const config = envConfig[environment] || { label: environment, color: 'default' };
    
    return (
      <Chip
        label={config.label}
        color={config.color}
        size="small"
        variant="outlined"
      />
    );
  };

  const columns = [
    {
      field: 'project',
      headerName: 'Project',
      flex: 1,
      renderCell: (params) => (
        <Typography variant="body2" fontWeight="500">
          {params.row.project?.name || 'Unknown Project'}
        </Typography>
      )
    },
    {
      field: 'build_version',
      headerName: 'Build Version',
      width: 150,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          variant="outlined"
        />
      )
    },
    {
      field: 'environment',
      headerName: 'Environment',
      width: 130,
      renderCell: (params) => getEnvironmentChip(params.value)
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      renderCell: (params) => getStatusChip(params.value)
    },
    {
      field: 'test_framework',
      headerName: 'Framework',
      width: 130,
      renderCell: (params) => (
        <Typography variant="body2" color="text.secondary">
          {params.value}
        </Typography>
      )
    },
    {
      field: 'total_tests',
      headerName: 'Tests',
      width: 100,
      renderCell: (params) => (
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" fontWeight="500">
            {params.row.passed_tests || 0}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            / {params.value}
          </Typography>
        </Box>
      )
    },
    {
      field: 'duration',
      headerName: 'Duration',
      width: 100,
      renderCell: (params) => (
        <Typography variant="body2">
          {Math.round(params.value / 1000)}s
        </Typography>
      )
    },
    {
      field: 'created_at',
      headerName: 'Run Date',
      width: 180,
      renderCell: (params) => (
        <Typography variant="body2">
          {format(new Date(params.value), 'MMM dd, yyyy HH:mm')}
        </Typography>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      renderCell: (params) => (
        <Button
          variant="outlined"
          size="small"
          onClick={() => handleViewDetails(params.row)}
        >
          View
        </Button>
      )
    }
  ];

  const handleViewDetails = (testRun) => {
    // Navigate to test run details page
    console.log('View test run:', testRun);
    enqueueSnackbar('Test run details page coming soon', { variant: 'info' });
  };

  const filteredProjects = isAdmin() 
    ? projects 
    : projects.filter(project => project.team_id === user.team_id);

  const filteredTestRuns = isAdmin()
    ? testRuns
    : testRuns.filter(run => run.project?.team_id === user.team_id);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight="700" gutterBottom>
            Test Runs
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Monitor and analyze test execution results
          </Typography>
        </Box>

        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchTestRuns}
        >
          Refresh
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Project</InputLabel>
                <Select
                  value={filters.project_id}
                  label="Project"
                  onChange={(e) => handleFilterChange('project_id', e.target.value)}
                >
                  <MenuItem value="">All Projects</MenuItem>
                  {filteredProjects.map((project) => (
                    <MenuItem key={project.id} value={project.id}>
                      {project.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  label="Status"
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                  <MenuItem value="">All Status</MenuItem>
                  <MenuItem value="passed">Passed</MenuItem>
                  <MenuItem value="failed">Failed</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="aborted">Aborted</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Environment</InputLabel>
                <Select
                  value={filters.environment}
                  label="Environment"
                  onChange={(e) => handleFilterChange('environment', e.target.value)}
                >
                  <MenuItem value="">All Environments</MenuItem>
                  <MenuItem value="development">Development</MenuItem>
                  <MenuItem value="staging">Staging</MenuItem>
                  <MenuItem value="preproduction">Pre-Production</MenuItem>
                  <MenuItem value="production">Production</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="Build Version"
                value={filters.build_version}
                onChange={(e) => handleFilterChange('build_version', e.target.value)}
                size="small"
                fullWidth
              />
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <Button
                variant="outlined"
                startIcon={<FilterIcon />}
                onClick={clearFilters}
                fullWidth
                size="small"
              >
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Test Runs Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <DataGrid
            rows={filteredTestRuns}
            columns={columns}
            loading={loading}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            pageSizeOptions={[10, 25, 50]}
            autoHeight
            disableRowSelectionOnClick
            sx={{
              border: 'none',
              '& .MuiDataGrid-cell': {
                borderBottom: `1px solid ${theme.palette.divider}`
              },
              '& .MuiDataGrid-columnHeaders': {
                backgroundColor: theme.palette.background.default,
                borderBottom: `2px solid ${theme.palette.divider}`
              }
            }}
          />
        </CardContent>
      </Card>
    </Box>
  );
};

export default TestRuns;