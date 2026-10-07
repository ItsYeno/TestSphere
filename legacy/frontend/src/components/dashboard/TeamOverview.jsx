import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Box,
  Chip,
  Grid,
  LinearProgress,
  useTheme
} from '@mui/material';
import { teamService, testRunService } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';

const TeamOverview = () => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const theme = useTheme();

  useEffect(() => {
    fetchTeamOverview();
  }, []);

  const fetchTeamOverview = async () => {
    try {
      const [teamsResponse, runsResponse] = await Promise.all([
        teamService.getAll(),
        testRunService.getAll({ limit: 100 }) // Get more runs for stats
      ]);

      const teamsData = teamsResponse.data.data || [];
      const allRuns = runsResponse.data.data || [];

      // Calculate stats for each team
      const teamsWithStats = teamsData.map(team => {
        const teamRuns = allRuns.filter(run => 
          run.project?.team_id === team.id
        );

        const totalRuns = teamRuns.length;
        const passedRuns = teamRuns.filter(run => run.status === 'passed').length;
        const failedRuns = teamRuns.filter(run => run.status === 'failed').length;
        const successRate = totalRuns > 0 ? (passedRuns / totalRuns) * 100 : 0;

        return {
          ...team,
          stats: {
            totalRuns,
            passedRuns,
            failedRuns,
            successRate: Math.round(successRate),
            totalTests: teamRuns.reduce((sum, run) => sum + run.total_tests, 0)
          }
        };
      });

      setTeams(teamsWithStats);
    } catch (error) {
      console.error('Failed to fetch team overview:', error);
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

  if (loading) {
    return (
      <Card>
        <CardContent>
          <LoadingSpinner message="Loading team overview..." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Team Overview"
        titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
      />
      <CardContent>
        <Grid container spacing={3}>
          {teams.map((team) => (
            <Grid item xs={12} key={team.id}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: `1px solid ${theme.palette.divider}`,
                  backgroundColor: theme.palette.background.paper
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box>
                    <Typography variant="h6" fontWeight="600" gutterBottom>
                      {team.display_name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {team.description}
                    </Typography>
                  </Box>
                  <Chip
                    label={`${team.stats.successRate}% Success`}
                    color={getTeamColor(team.name)}
                    variant="filled"
                  />
                </Box>

                {/* Progress Bar */}
                <Box sx={{ mb: 2 }}>
                  <LinearProgress
                    variant="determinate"
                    value={team.stats.successRate}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: theme.palette.action.hover,
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: theme.palette[getTeamColor(team.name)]?.main || theme.palette.primary.main,
                        borderRadius: 4
                      }
                    }}
                  />
                </Box>

                {/* Stats */}
                <Box sx={{ display: 'flex', gap: 3 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Total Runs
                    </Typography>
                    <Typography variant="h6" fontWeight="600">
                      {team.stats.totalRuns}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Passed
                    </Typography>
                    <Typography 
                      variant="h6" 
                      fontWeight="600"
                      color="success.main"
                    >
                      {team.stats.passedRuns}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Failed
                    </Typography>
                    <Typography 
                      variant="h6" 
                      fontWeight="600"
                      color="error.main"
                    >
                      {team.stats.failedRuns}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Total Tests
                    </Typography>
                    <Typography variant="h6" fontWeight="600">
                      {team.stats.totalTests}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
};

export default TeamOverview;