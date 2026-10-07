import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  Tabs,
  Tab,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
  useTheme
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  ExpandMore as ExpandIcon,
  CheckCircle as PassIcon,
  Cancel as FailIcon,
  Remove as SkipIcon,
  Image as ScreenshotIcon,
  Videocam as VideoIcon,
  Schedule as PendingIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { testRunService } from '../services/api';
import { useSnackbar } from 'notistack';
import { format, formatDistanceToNow } from 'date-fns';
import LoadingSpinner from '../components/common/LoadingSpinner';

const TestRunDetails = () => {
  const [testRun, setTestRun] = useState(null);
  const [testCases, setTestCases] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [expandedTestCase, setExpandedTestCase] = useState(null);
  const [loading, setLoading] = useState(true);

  const { id } = useParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();

  useEffect(() => {
    fetchTestRunDetails();
  }, [id]);

  const fetchTestRunDetails = async () => {
    try {
      setLoading(true);
      const [runResponse, casesResponse] = await Promise.all([
        testRunService.getById(id),
        testRunService.getTestCases(id)
      ]);

      setTestRun(runResponse.data.data);
      setTestCases(casesResponse.data.data || []);
    } catch (error) {
      enqueueSnackbar('Failed to fetch test run details', { variant: 'error' });
      console.error('Error fetching test run details:', error);
      navigate('/test-runs');
    } finally {
      setLoading(false);
    }
  };

  const handleTestCaseToggle = (testCaseId) => {
    setExpandedTestCase(expandedTestCase === testCaseId ? null : testCaseId);
  };

  const getStatusIcon = (status) => {
    const icons = {
      passed: <PassIcon sx={{ color: theme.palette.success.main }} />,
      failed: <FailIcon sx={{ color: theme.palette.error.main }} />,
      skipped: <SkipIcon sx={{ color: theme.palette.warning.main }} />,
      pending: <PendingIcon sx={{ color: theme.palette.info.main }} />
    };
    return icons[status] || <PendingIcon />;
  };

  const getStatusChip = (status) => {
    const statusConfig = {
      passed: { label: 'Passed', color: 'success' },
      failed: { label: 'Failed', color: 'error' },
      skipped: { label: 'Skipped', color: 'warning' },
      pending: { label: 'Pending', color: 'info' }
    };

    const config = statusConfig[status] || { label: status, color: 'default' };
    
    return (
      <Chip
        label={config.label}
        color={config.color}
        size="small"
        icon={getStatusIcon(status)}
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

  const renderAttachments = (attachments) => {
    if (!attachments || attachments.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          No attachments available
        </Typography>
      );
    }

    return attachments.map((attachment, index) => (
      <Box key={attachment.id} sx={{ mb: 2, p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          {attachment.attachment_type === 'screenshot' ? (
            <ScreenshotIcon color="primary" />
          ) : (
            <VideoIcon color="secondary" />
          )}
          <Typography variant="body2" fontWeight="500">
            {attachment.file_name}
          </Typography>
          <Chip
            label={attachment.attachment_type}
            size="small"
            variant="outlined"
          />
        </Box>
        
        {attachment.attachment_type === 'screenshot' ? (
          <Box
            component="img"
            src={`/api${attachment.file_path}`}
            alt={attachment.description || 'Test screenshot'}
            sx={{
              maxWidth: '100%',
              maxHeight: 300,
              borderRadius: 1,
              border: `1px solid ${theme.palette.divider}`
            }}
          />
        ) : (
          <Box
            component="video"
            controls
            src={`/api${attachment.file_path}`}
            sx={{
              maxWidth: '100%',
              maxHeight: 300,
              borderRadius: 1,
              border: `1px solid ${theme.palette.divider}`
            }}
          />
        )}
        
        {attachment.description && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {attachment.description}
          </Typography>
        )}
      </Box>
    ));
  };

  if (loading) {
    return <LoadingSpinner message="Loading test run details..." />;
  }

  if (!testRun) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="h6" color="text.secondary">
          Test run not found
        </Typography>
        <Button onClick={() => navigate('/test-runs')} sx={{ mt: 2 }}>
          Back to Test Runs
        </Button>
      </Box>
    );
  }

  const passedCases = testCases.filter(tc => tc.status === 'passed');
  const failedCases = testCases.filter(tc => tc.status === 'failed');
  const skippedCases = testCases.filter(tc => tc.status === 'skipped');

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => navigate('/test-runs')}>
          <BackIcon />
        </IconButton>
        
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" fontWeight="700" gutterBottom>
            {testRun.project?.name} - Test Run
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Chip label={`Build: ${testRun.build_version}`} size="small" />
            {getEnvironmentChip(testRun.environment)}
            {getStatusChip(testRun.status)}
            <Typography variant="body2" color="text.secondary">
              {formatDistanceToNow(new Date(testRun.created_at), { addSuffix: true })}
            </Typography>
          </Box>
        </Box>

        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchTestRunDetails}
        >
          Refresh
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" fontWeight="700" color="primary.main">
                {testCases.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Tests
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" fontWeight="700" color="success.main">
                {passedCases.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Passed
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" fontWeight="700" color="error.main">
                {failedCases.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Failed
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" fontWeight="700" color="warning.main">
                {skippedCases.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Skipped
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Test Cases List */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent sx={{ p: 0 }}>
              <Tabs
                value={activeTab}
                onChange={(e, newValue) => setActiveTab(newValue)}
                sx={{ borderBottom: 1, borderColor: 'divider' }}
              >
                <Tab 
                  label={`All Tests (${testCases.length})`} 
                  icon={<Typography variant="caption">{testCases.length}</Typography>}
                />
                <Tab 
                  label={`Passed (${passedCases.length})`} 
                  icon={<Typography variant="caption" color="success.main">{passedCases.length}</Typography>}
                />
                <Tab 
                  label={`Failed (${failedCases.length})`} 
                  icon={<Typography variant="caption" color="error.main">{failedCases.length}</Typography>}
                />
                <Tab 
                  label={`Skipped (${skippedCases.length})`} 
                  icon={<Typography variant="caption" color="warning.main">{skippedCases.length}</Typography>}
                />
              </Tabs>

              <Box sx={{ maxHeight: 600, overflow: 'auto' }}>
                {(() => {
                  let displayCases = testCases;
                  if (activeTab === 1) displayCases = passedCases;
                  if (activeTab === 2) displayCases = failedCases;
                  if (activeTab === 3) displayCases = skippedCases;

                  return displayCases.map((testCase, index) => (
                    <Accordion
                      key={testCase.id}
                      expanded={expandedTestCase === testCase.id}
                      onChange={() => handleTestCaseToggle(testCase.id)}
                      sx={{
                        '&:before': { display: 'none' },
                        boxShadow: 'none',
                        borderBottom: `1px solid ${theme.palette.divider}`
                      }}
                    >
                      <AccordionSummary expandIcon={<ExpandIcon />}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                          {getStatusIcon(testCase.status)}
                          
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body1" fontWeight="500">
                              {testCase.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {testCase.full_name}
                            </Typography>
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              {Math.round(testCase.duration / 1000)}s
                            </Typography>
                            {testCase.attachments && testCase.attachments.length > 0 && (
                              <Tooltip title={`${testCase.attachments.length} attachments`}>
                                <Chip
                                  icon={<ScreenshotIcon />}
                                  label={testCase.attachments.length}
                                  size="small"
                                  variant="outlined"
                                />
                              </Tooltip>
                            )}
                          </Box>
                        </Box>
                      </AccordionSummary>

                      <AccordionDetails sx={{ pt: 0 }}>
                        {testCase.failure_message && (
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle2" gutterBottom color="error.main">
                              Failure Message:
                            </Typography>
                            <Box
                              component="pre"
                              sx={{
                                p: 2,
                                backgroundColor: theme.palette.error.light + '20',
                                border: `1px solid ${theme.palette.error.light}`,
                                borderRadius: 1,
                                overflow: 'auto',
                                fontSize: '0.875rem',
                                color: theme.palette.error.dark
                              }}
                            >
                              {testCase.failure_message}
                            </Box>
                          </Box>
                        )}

                        {testCase.stack_trace && (
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Stack Trace:
                            </Typography>
                            <Box
                              component="pre"
                              sx={{
                                p: 2,
                                backgroundColor: theme.palette.grey[100],
                                border: `1px solid ${theme.palette.divider}`,
                                borderRadius: 1,
                                overflow: 'auto',
                                fontSize: '0.75rem'
                              }}
                            >
                              {testCase.stack_trace}
                            </Box>
                          </Box>
                        )}

                        {testCase.attachments && testCase.attachments.length > 0 && (
                          <Box>
                            <Typography variant="subtitle2" gutterBottom>
                              Attachments:
                            </Typography>
                            {renderAttachments(testCase.attachments)}
                          </Box>
                        )}
                      </AccordionDetails>
                    </Accordion>
                  ));
                })()}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Run Details Sidebar */}
        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="600">
                Run Information
              </Typography>

              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Project"
                    secondary={testRun.project?.name}
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemText
                    primary="Build Version"
                    secondary={testRun.build_version}
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemText
                    primary="Environment"
                    secondary={
                      <Chip
                        label={testRun.environment}
                        size="small"
                        color={testRun.environment === 'production' ? 'success' : 'default'}
                      />
                    }
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemText
                    primary="Test Framework"
                    secondary={testRun.test_framework}
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemText
                    primary="Duration"
                    secondary={`${Math.round(testRun.duration / 1000)} seconds`}
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemText
                    primary="Start Time"
                    secondary={format(new Date(testRun.start_time), 'PPpp')}
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemText
                    primary="End Time"
                    secondary={format(new Date(testRun.end_time), 'PPpp')}
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemText
                    primary="Triggered By"
                    secondary={testRun.triggeredBy?.name || 'Unknown'}
                  />
                </ListItem>
              </List>

              <Divider sx={{ my: 2 }} />

              <Typography variant="h6" gutterBottom fontWeight="600">
                Test Summary
              </Typography>

              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <PassIcon color="success" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Passed Tests"
                    secondary={`${passedCases.length} (${testCases.length > 0 ? Math.round((passedCases.length / testCases.length) * 100) : 0}%)`}
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <FailIcon color="error" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Failed Tests"
                    secondary={`${failedCases.length} (${testCases.length > 0 ? Math.round((failedCases.length / testCases.length) * 100) : 0}%)`}
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <SkipIcon color="warning" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Skipped Tests"
                    secondary={`${skippedCases.length} (${testCases.length > 0 ? Math.round((skippedCases.length / testCases.length) * 100) : 0}%)`}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default TestRunDetails;