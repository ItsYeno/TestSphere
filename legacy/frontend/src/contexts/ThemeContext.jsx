import React, { createContext, useState, useContext, useMemo } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { mtnTheme, mtnDarkTheme } from '../themes/mtnTheme';

const ThemeContext = createContext();

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
};

export const AppThemeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('testsphere_darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  const theme = useMemo(() => 
    darkMode ? mtnDarkTheme : mtnTheme,
    [darkMode]
  );

  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const newValue = !prev;
      localStorage.setItem('testsphere_darkMode', JSON.stringify(newValue));
      return newValue;
    });
  };

  const value = {
    darkMode,
    toggleDarkMode,
    isDark: darkMode
  };

  return (
    <ThemeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
};