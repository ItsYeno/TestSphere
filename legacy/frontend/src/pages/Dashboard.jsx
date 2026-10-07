import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Typography,
  Card,
  CardContent,
  alpha,
  useTheme
} from '@mui/material';
import {
  PlayArrow as RunIcon,
  CheckCircle as PassIcon,
  Cancel as FailIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { testRunService, projectService } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import StatCard from '../components/dashboard/StatCard';
import TeamOverview from '../components/dashboard/TeamOverview';
import RecentActivity from '../components/dashboard/RecentActivity';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentRuns, setRecentRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const theme = useTheme();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch recent test runs
      const runsResponse = await testRunService.getAll({
        limit: 10,
        sort: 'created_at',
        order: 'desc'
      });

      // Fetch projects for team overview
      const projectsResponse = await projectService.getAll();

      // Calculate stats from recent runs
      const recentRunsData = runsResponse.data.data || [];
      const totalRuns = recentRunsData.length;
      const passedRuns = recentRunsData.filter(run => run.status === 'passed').length;
      const failedRuns = recentRunsData.filter(run => run.status === 'failed').length;
      const successRate = totalRuns > 0 ? (passedRuns / totalRuns) * 100 : 0;

      setStats({
        totalRuns,
        passedRuns,
        failedRuns,
        successRate: Math.round(successRate),
        totalTests: recentRunsData.reduce((sum, run) => sum + run.total_tests, 0),
        activeProjects: projectsResponse.data.data?.length || 0
      });

      setRecentRuns(recentRunsData);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading dashboard data..." />;
  }

  return (
    <Box>
      {/* Welcome Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="700" gutterBottom>
          Welcome back, {user?.name}!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Here's what's happening with your tests today.
        </Typography>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Test Runs"
            value={stats?.totalRuns || 0}
            icon={<RunIcon />}
            color={theme.palette.info.main}
            trend={{ value: 12, isPositive: true }}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Passed Tests"
            value={stats?.passedRuns || 0}
            icon={<PassIcon />}
            color={theme.palette.success.main}
            trend={{ value: 8, isPositive: true }}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Failed Tests"
            value={stats?.failedRuns || 0}
            icon={<FailIcon />}
            color={theme.palette.error.main}
            trend={{ value: 3, isPositive: false }}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Success Rate"
            value={`${stats?.successRate || 0}%`}
            icon={<TrendIcon />}
            color={theme.palette.primary.main}
            trend={{ value: 5, isPositive: true }}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Team Overview */}
        <Grid item xs={12} lg={8}>
          <TeamOverview />
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} lg={4}>
          <RecentActivity testRuns={recentRuns} />
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;