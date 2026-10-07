import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Typography,
  Box,
  Chip,
  Avatar,
  useTheme
} from '@mui/material';
import {
  CheckCircle as PassIcon,
  Cancel as FailIcon,
  PlayArrow as RunningIcon,
  Schedule as ScheduledIcon
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';

const RecentActivity = ({ testRuns }) => {
  const theme = useTheme();

  const getStatusIcon = (status) => {
    const icons = {
      passed: <PassIcon sx={{ color: theme.palette.success.main }} />,
      failed: <FailIcon sx={{ color: theme.palette.error.main }} />,
      in_progress: <RunningIcon sx={{ color: theme.palette.info.main }} />,
      scheduled: <ScheduledIcon sx={{ color: theme.palette.warning.main }} />
    };
    return icons[status] || <RunningIcon />;
  };

  const getStatusColor = (status) => {
    const colors = {
      passed: 'success',
      failed: 'error',
      in_progress: 'info',
      scheduled: 'warning'
    };
    return colors[status] || 'default';
  };

  const getProjectInitials = (projectName) => {
    return projectName
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <Card>
      <CardHeader
        title="Recent Activity"
        titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
      />
      <CardContent sx={{ p: 0 }}>
        {testRuns.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No test runs available
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {testRuns.slice(0, 8).map((run, index) => (
              <ListItem
                key={run.id}
                divider={index < testRuns.length - 1}
                sx={{
                  px: 3,
                  py: 2,
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover
                  }
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  {getStatusIcon(run.status)}
                </ListItemIcon>

                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="body2" fontWeight="500" noWrap>
                        {run.project?.name || 'Unknown Project'}
                      </Typography>
                      <Chip
                        label={run.status.replace('_', ' ')}
                        color={getStatusColor(run.status)}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  }
                  secondary={
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">
                        {run.build_version} • {run.environment}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentActivity;