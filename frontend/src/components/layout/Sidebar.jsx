import React from 'react';
// At the top of Sidebar.jsx
import BugReportIcon from '@mui/icons-material/BugReport';

import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  useTheme
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Folder as ProjectIcon,
  PlayArrow as TestRunIcon,
  Groups as TeamIcon,
  AdminPanelSettings as AdminIcon,
  BugReport as BugIcon
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Sidebar = ({ onMobileClose }) => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();

  const menuItems = [
    {
      text: 'Dashboard',
      icon: <DashboardIcon />,
      path: '/dashboard',
      roles: ['admin', 'tester', 'viewer']
    },
    {
      text: 'Projects',
      icon: <ProjectIcon />,
      path: '/projects',
      roles: ['admin', 'tester', 'viewer']
    },
    {
      text: 'Test Runs',
      icon: <TestRunIcon />,
      path: '/test-runs',
      roles: ['admin', 'tester', 'viewer']
    },
    {
      text: 'Teams',
      icon: <TeamIcon />,
      path: '/teams',
      roles: ['admin', 'tester']
    },
    {
      text: 'Admin',
      icon: <AdminIcon />,
      path: '/admin',
      roles: ['admin']
    }
  ];

  const handleNavigation = (path) => {
    navigate(path);
    if (onMobileClose) {
      onMobileClose();
    }
  };

  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(user?.role)
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo Section */}
      <Box 
        sx={{ 
          p: 3, 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2,
          borderBottom: `1px solid ${theme.palette.divider}`
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            backgroundColor: theme.palette.primary.main,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.palette.primary.contrastText,
            fontWeight: 'bold',
            fontSize: '1.2rem'
          }}
        >
          TS
        </Box>
        <Box>
          <Typography variant="h6" fontWeight="700" noWrap>
            TestSphere
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            MTN Dashboard
          </Typography>
        </Box>
      </Box>

      {/* Navigation Menu */}
      <Box sx={{ flexGrow: 1, p: 2 }}>
        <List sx={{ gap: 0.5 }}>
          {filteredMenuItems.map((item) => {
            const isActive = location.pathname === item.path || 
                            (item.path !== '/dashboard' && location.pathname.startsWith(item.path));

            return (
              <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  onClick={() => handleNavigation(item.path)}
                  sx={{
                    borderRadius: 2,
                    backgroundColor: isActive ? 
                      theme.palette.primary.main + '15' : 'transparent',
                    color: isActive ? 
                      theme.palette.primary.main : theme.palette.text.secondary,
                    border: isActive ? 
                      `1px solid ${theme.palette.primary.main}30` : '1px solid transparent',
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                      color: theme.palette.text.primary
                    },
                    '& .MuiListItemIcon-root': {
                      color: isActive ? 
                        theme.palette.primary.main : theme.palette.text.secondary
                    }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.text}
                    primaryTypographyProps={{
                      fontWeight: isActive ? 600 : 400
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>

      {/* Footer Section */}
      <Box sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Box sx={{ textAlign: 'center' }}>
          <BugReportIcon 
            sx={{ 
              fontSize: 32, 
              color: 'text.secondary',
              mb: 1 
            }} 
          />
          <Typography variant="caption" color="text.secondary" display="block">
            Quality Assurance
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            MTN Group
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default Sidebar;