import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Avatar,
  Chip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  useTheme
} from '@mui/material';
import {
  Groups as TeamIcon,
  Person as UserIcon,
  BugReport as TestIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { teamService, userService } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';

const Teams = () => {
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const { user, isAdmin } = useAuth();
  const theme = useTheme();

  useEffect(() => {
    fetchTeamsAndUsers();
  }, []);

  const fetchTeamsAndUsers = async () => {
    try {
      const [teamsResponse, usersResponse] = await Promise.all([
        teamService.getAll(),
        userService.getAll()
      ]);

      setTeams(teamsResponse.data.data || []);
      setUsers(usersResponse.data.data || []);
    } catch (error) {
      console.error('Error fetching teams and users:', error);
    } finally {
      setLoading(false);
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

  const getTeamIcon = (teamName) => {
    const icons = {
      mobile: '📱',
      web: '🌐',
      api: '⚡'
    };
    return icons[teamName] || '👥';
  };

  const getUsersByTeam = (teamId) => {
    return users.filter(user => user.team_id === teamId);
  };

  const getRoleColor = (role) => {
    const colors = {
      admin: 'error',
      tester: 'primary',
      viewer: 'default'
    };
    return colors[role] || 'default';
  };

  const filteredTeams = isAdmin() 
    ? teams 
    : teams.filter(team => team.id === user.team_id);

  if (loading) {
    return <LoadingSpinner message="Loading teams..." />;
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="700" gutterBottom>
          Teams
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage team members and their testing responsibilities
        </Typography>
      </Box>

      {/* Teams Grid */}
      <Grid container spacing={3}>
        {filteredTeams.map((team) => {
          const teamUsers = getUsersByTeam(team.id);
          const activeUsers = teamUsers.filter(user => user.is_active);

          return (
            <Grid item xs={12} key={team.id}>
              <Card>
                <CardContent>
                  {/* Team Header */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <Avatar
                      sx={{
                        width: 60,
                        height: 60,
                        backgroundColor: theme.palette[getTeamColor(team.name)]?.main || theme.palette.primary.main,
                        fontSize: '1.5rem'
                      }}
                    >
                      {getTeamIcon(team.name)}
                    </Avatar>
                    
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h5" fontWeight="600" gutterBottom>
                        {team.display_name}
                      </Typography>
                      <Typography variant="body1" color="text.secondary">
                        {team.description}
                      </Typography>
                    </Box>

                    <Chip
                      label={`${activeUsers.length} Members`}
                      color={getTeamColor(team.name)}
                      variant="filled"
                    />
                  </Box>

                  <Divider sx={{ mb: 3 }} />

                  {/* Team Statistics */}
                  <Grid container spacing={3} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={4}>
                      <Box sx={{ textAlign: 'center' }}>
                        <TestIcon 
                          sx={{ 
                            fontSize: 32, 
                            color: 'primary.main',
                            mb: 1 
                          }} 
                        />
                        <Typography variant="h6" fontWeight="600">
                          {team.stats?.totalRuns || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Total Test Runs
                        </Typography>
                      </Box>
                    </Grid>

                    <Grid item xs={12} sm={4}>
                      <Box sx={{ textAlign: 'center' }}>
                        <TeamIcon 
                          sx={{ 
                            fontSize: 32, 
                            color: 'success.main',
                            mb: 1 
                          }} 
                        />
                        <Typography variant="h6" fontWeight="600" color="success.main">
                          {team.stats?.successRate || 0}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Success Rate
                        </Typography>
                      </Box>
                    </Grid>

                    <Grid item xs={12} sm={4}>
                      <Box sx={{ textAlign: 'center' }}>
                        <UserIcon 
                          sx={{ 
                            fontSize: 32, 
                            color: 'info.main',
                            mb: 1 
                          }} 
                        />
                        <Typography variant="h6" fontWeight="600">
                          {team.stats?.totalTests || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Total Tests
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>

                  {/* Team Members */}
                  <Box>
                    <Typography variant="h6" fontWeight="600" gutterBottom>
                      Team Members ({activeUsers.length})
                    </Typography>
                    
                    {activeUsers.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                        No active team members
                      </Typography>
                    ) : (
                      <List sx={{ py: 0 }}>
                        {activeUsers.map((member, index) => (
                          <React.Fragment key={member.id}>
                            <ListItem sx={{ px: 0 }}>
                              <ListItemAvatar>
                                <Avatar
                                  sx={{
                                    backgroundColor: 'primary.main',
                                    fontSize: '0.875rem',
                                    fontWeight: 600
                                  }}
                                >
                                  {member.name.charAt(0).toUpperCase()}
                                </Avatar>
                              </ListItemAvatar>
                              
                              <ListItemText
                                primary={
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="body1" fontWeight="500">
                                      {member.name}
                                    </Typography>
                                    <Chip
                                      label={member.role}
                                      color={getRoleColor(member.role)}
                                      size="small"
                                    />
                                  </Box>
                                }
                                secondary={member.email}
                              />
                            </ListItem>
                            
                            {index < activeUsers.length - 1 && (
                              <Divider variant="inset" component="li" />
                            )}
                          </React.Fragment>
                        ))}
                      </List>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default Teams;