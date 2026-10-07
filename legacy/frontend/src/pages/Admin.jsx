import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Tabs,
  Tab,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  useTheme
} from '@mui/material';
import {
  Add as AddIcon,
  People as UsersIcon,
  Groups as TeamsIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { useAuth } from '../contexts/AuthContext';
import { userService, teamService } from '../services/api';
import { useSnackbar } from 'notistack';
import LoadingSpinner from '../components/common/LoadingSpinner';

const Admin = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'tester',
    team_id: '',
    is_active: true
  });
  const [formErrors, setFormErrors] = useState({});

  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersResponse, teamsResponse] = await Promise.all([
        userService.getAll(),
        teamService.getAll()
      ]);

      setUsers(usersResponse.data.data || []);
      setTeams(teamsResponse.data.data || []);
    } catch (error) {
      enqueueSnackbar('Failed to fetch admin data', { variant: 'error' });
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleUserDialogOpen = (user = null) => {
    if (user) {
      setSelectedUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        password: '',
        role: user.role,
        team_id: user.team_id,
        is_active: user.is_active
      });
    } else {
      setSelectedUser(null);
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'tester',
        team_id: teams[0]?.id || '',
        is_active: true
      });
    }
    setFormErrors({});
    setUserDialogOpen(true);
  };

  const handleUserDialogClose = () => {
    setUserDialogOpen(false);
    setSelectedUser(null);
    setFormErrors({});
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
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
      errors.name = 'Name is required';
    }
    
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Email is invalid';
    }
    
    if (!selectedUser && !formData.password) {
      errors.password = 'Password is required for new users';
    }
    
    if (!formData.team_id) {
      errors.team_id = 'Team selection is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveUser = async () => {
    if (!validateForm()) return;

    try {
      const userData = { ...formData };
      if (!userData.password) {
        delete userData.password;
      }

      if (selectedUser) {
        await userService.update(selectedUser.id, userData);
        enqueueSnackbar('User updated successfully', { variant: 'success' });
      } else {
        await userService.create(userData);
        enqueueSnackbar('User created successfully', { variant: 'success' });
      }

      handleUserDialogClose();
      fetchData();
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to save user';
      enqueueSnackbar(message, { variant: 'error' });
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    try {
      await userService.update(userId, { is_active: !currentStatus });
      enqueueSnackbar(`User ${!currentStatus ? 'activated' : 'deactivated'} successfully`, { 
        variant: 'success' 
      });
      fetchData();
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to update user status';
      enqueueSnackbar(message, { variant: 'error' });
    }
  };

  const userColumns = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      renderCell: (params) => (
        <Box>
          <Typography variant="body2" fontWeight="500">
            {params.value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {params.row.email}
          </Typography>
        </Box>
      )
    },
    {
      field: 'team',
      headerName: 'Team',
      width: 120,
      renderCell: (params) => (
        <Typography variant="body2">
          {params.row.team?.display_name}
        </Typography>
      )
    },
    {
      field: 'role',
      headerName: 'Role',
      width: 100,
      renderCell: (params) => (
        <Typography 
          variant="body2" 
          fontWeight="500"
          color={
            params.value === 'admin' ? 'error.main' :
            params.value === 'tester' ? 'primary.main' : 'text.secondary'
          }
        >
          {params.value}
        </Typography>
      )
    },
    {
      field: 'is_active',
      headerName: 'Status',
      width: 100,
      renderCell: (params) => (
        <FormControlLabel
          control={
            <Switch
              checked={params.value}
              onChange={() => handleToggleUserStatus(params.row.id, params.value)}
              size="small"
              color="success"
            />
          }
          label={params.value ? 'Active' : 'Inactive'}
          sx={{ m: 0 }}
        />
      )
    },
    {
      field: 'last_login',
      headerName: 'Last Login',
      width: 150,
      renderCell: (params) => (
        <Typography variant="body2">
          {params.value ? new Date(params.value).toLocaleDateString() : 'Never'}
        </Typography>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Button
          variant="outlined"
          size="small"
          onClick={() => handleUserDialogOpen(params.row)}
        >
          Edit
        </Button>
      )
    }
  ];

  const teamColumns = [
    {
      field: 'display_name',
      headerName: 'Team Name',
      flex: 1,
      renderCell: (params) => (
        <Box>
          <Typography variant="body2" fontWeight="500">
            {params.value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {params.row.description}
          </Typography>
        </Box>
      )
    },
    {
      field: 'name',
      headerName: 'Slug',
      width: 100,
      renderCell: (params) => (
        <Typography variant="body2" color="text.secondary">
          {params.value}
        </Typography>
      )
    },
    {
      field: 'memberCount',
      headerName: 'Members',
      width: 100,
      renderCell: (params) => (
        <Typography variant="body2" fontWeight="500">
          {users.filter(u => u.team_id === params.row.id && u.is_active).length}
        </Typography>
      )
    },
    {
      field: 'is_active',
      headerName: 'Status',
      width: 100,
      renderCell: (params) => (
        <Typography 
          variant="body2" 
          color={params.value ? 'success.main' : 'text.secondary'}
          fontWeight="500"
        >
          {params.value ? 'Active' : 'Inactive'}
        </Typography>
      )
    }
  ];

  if (loading) {
    return <LoadingSpinner message="Loading admin panel..." />;
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="700" gutterBottom>
          Admin Panel
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage users, teams, and system settings
        </Typography>
      </Box>

      {/* Tabs */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab 
              label="User Management" 
              icon={<UsersIcon />}
              iconPosition="start"
            />
            <Tab 
              label="Team Management" 
              icon={<TeamsIcon />}
              iconPosition="start"
            />
            <Tab 
              label="System Settings" 
              icon={<SettingsIcon />}
              iconPosition="start"
            />
          </Tabs>

          {/* User Management Tab */}
          {activeTab === 0 && (
            <Box sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" fontWeight="600">
                  User Accounts ({users.length})
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => handleUserDialogOpen()}
                >
                  Add User
                </Button>
              </Box>

              <DataGrid
                rows={users}
                columns={userColumns}
                autoHeight
                pageSizeOptions={[10, 25, 50]}
                initialState={{
                  pagination: { paginationModel: { pageSize: 10 } }
                }}
                disableRowSelectionOnClick
                sx={{
                  border: 'none',
                  '& .MuiDataGrid-cell': {
                    borderBottom: `1px solid ${theme.palette.divider}`
                  }
                }}
              />
            </Box>
          )}

          {/* Team Management Tab */}
          {activeTab === 1 && (
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight="600" gutterBottom>
                Teams ({teams.length})
              </Typography>

              <DataGrid
                rows={teams}
                columns={teamColumns}
                autoHeight
                pageSizeOptions={[10, 25, 50]}
                initialState={{
                  pagination: { paginationModel: { pageSize: 10 } }
                }}
                disableRowSelectionOnClick
                sx={{
                  border: 'none',
                  '& .MuiDataGrid-cell': {
                    borderBottom: `1px solid ${theme.palette.divider}`
                  }
                }}
              />
            </Box>
          )}

          {/* System Settings Tab */}
          {activeTab === 2 && (
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight="600" gutterBottom>
                System Configuration
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom fontWeight="600">
                        General Settings
                      </Typography>
                      
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                          label="Application Name"
                          defaultValue="TestSphere"
                          fullWidth
                        />
                        
                        <TextField
                          label="Company Name"
                          defaultValue="MTN"
                          fullWidth
                        />
                        
                        <FormControlLabel
                          control={<Switch defaultChecked />}
                          label="Enable user registration"
                        />
                        
                        <FormControlLabel
                          control={<Switch defaultChecked />}
                          label="Email notifications"
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom fontWeight="600">
                        Security Settings
                      </Typography>
                      
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <FormControlLabel
                          control={<Switch defaultChecked />}
                          label="Require strong passwords"
                        />
                        
                        <FormControlLabel
                          control={<Switch />}
                          label="Two-factor authentication"
                        />
                        
                        <TextField
                          label="Session timeout (minutes)"
                          type="number"
                          defaultValue="60"
                          fullWidth
                        />
                        
                        <Button variant="contained" color="primary">
                          Save Settings
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* User Dialog */}
      <Dialog 
        open={userDialogOpen} 
        onClose={handleUserDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {selectedUser ? 'Edit User' : 'Create New User'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Full Name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              error={!!formErrors.name}
              helperText={formErrors.name}
              fullWidth
              required
            />

            <TextField
              label="Email Address"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              error={!!formErrors.email}
              helperText={formErrors.email}
              fullWidth
              required
            />

            <TextField
              label="Password"
              type="password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              error={!!formErrors.password}
              helperText={formErrors.password || (selectedUser ? 'Leave blank to keep current password' : '')}
              fullWidth
              required={!selectedUser}
            />

            <FormControl fullWidth required>
              <InputLabel>Role</InputLabel>
              <Select
                value={formData.role}
                label="Role"
                onChange={(e) => handleInputChange('role', e.target.value)}
              >
                <MenuItem value="admin">Administrator</MenuItem>
                <MenuItem value="tester">Tester</MenuItem>
                <MenuItem value="viewer">Viewer</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth required error={!!formErrors.team_id}>
              <InputLabel>Team</InputLabel>
              <Select
                value={formData.team_id}
                label="Team"
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

            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_active}
                  onChange={(e) => handleInputChange('is_active', e.target.checked)}
                  color="success"
                />
              }
              label="Active Account"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleUserDialogClose}>Cancel</Button>
          <Button 
            onClick={handleSaveUser}
            variant="contained"
          >
            {selectedUser ? 'Update User' : 'Create User'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Admin;