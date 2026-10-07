import React from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Avatar,
  useTheme
} from '@mui/material';
import { TrendingUp, TrendingDown } from '@mui/icons-material';

const StatCard = ({ title, value, icon, color, trend }) => {
  const theme = useTheme();

  return (
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
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box sx={{ flex: 1 }}>
            <Typography 
              color="text.secondary" 
              gutterBottom 
              variant="body2"
              fontWeight="500"
            >
              {title}
            </Typography>
            
            <Typography 
              variant="h4" 
              component="div" 
              fontWeight="700"
              sx={{ mb: 1 }}
            >
              {value}
            </Typography>

            {trend && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {trend.isPositive ? (
                  <TrendingUp sx={{ fontSize: 16, color: theme.palette.success.main }} />
                ) : (
                  <TrendingDown sx={{ fontSize: 16, color: theme.palette.error.main }} />
                )}
                <Typography 
                  variant="body2" 
                  color={trend.isPositive ? 'success.main' : 'error.main'}
                  fontWeight="500"
                >
                  {trend.isPositive ? '+' : ''}{trend.value}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  from last week
                </Typography>
              </Box>
            )}
          </Box>

          <Avatar
            sx={{
              backgroundColor: color + '20',
              color: color,
              width: 56,
              height: 56
            }}
          >
            {icon}
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  );
};

export default StatCard;