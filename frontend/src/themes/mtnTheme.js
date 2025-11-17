import { createTheme } from '@mui/material/styles';

// MTN Brand Colors
export const MTN_COLORS = {
  // Primary Brand Colors
  yellow: {
    main: '#FFCC00',
    light: '#FFD633',
    dark: '#E6B800',
    contrastText: '#000000'
  },
  black: {
    main: '#000000',
    light: '#333333',
    dark: '#000000',
    contrastText: '#FFFFFF'
  },
  white: {
    main: '#FFFFFF',
    light: '#F8F9FA',
    dark: '#E9ECEF',
    contrastText: '#000000'
  },
  
  // Status Colors
  success: '#22BB33',
  warning: '#F0AD4E', 
  error: '#BB2124',
  info: '#5BC0DE',
  
  // Additional MTN Colors
  red: '#BB2124',
  darkRed: '#9B1B1D',
  lightGrey: '#E9ECEF',
  darkGrey: '#495057'
};

// Create MTN Theme
export const mtnTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: MTN_COLORS.yellow.main,
      light: MTN_COLORS.yellow.light,
      dark: MTN_COLORS.yellow.dark,
      contrastText: MTN_COLORS.yellow.contrastText
    },
    secondary: {
      main: MTN_COLORS.black.main,
      light: MTN_COLORS.black.light,
      dark: MTN_COLORS.black.dark,
      contrastText: MTN_COLORS.black.contrastText
    },
    background: {
      default: MTN_COLORS.white.light,
      paper: MTN_COLORS.white.main
    },
    text: {
      primary: MTN_COLORS.black.main,
      secondary: MTN_COLORS.black.light
    },
    success: {
      main: MTN_COLORS.success
    },
    warning: {
      main: MTN_COLORS.warning
    },
    error: {
      main: MTN_COLORS.error
    },
    info: {
      main: MTN_COLORS.info
    }
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      color: MTN_COLORS.black.main
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      color: MTN_COLORS.black.main
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
      color: MTN_COLORS.black.main
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 500,
      color: MTN_COLORS.black.main
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 500,
      color: MTN_COLORS.black.main
    },
    h6: {
      fontSize: '1.1rem',
      fontWeight: 500,
      color: MTN_COLORS.black.main
    },
    subtitle1: {
      fontSize: '1rem',
      fontWeight: 400,
      color: MTN_COLORS.black.light
    },
    button: {
      fontWeight: 500,
      textTransform: 'none'
    }
  },
  shape: {
    borderRadius: 8
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: MTN_COLORS.black.main,
          color: MTN_COLORS.white.main,
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.1)'
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 24px',
          fontWeight: 500,
          textTransform: 'none',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }
        },
        containedPrimary: {
          backgroundColor: MTN_COLORS.yellow.main,
          color: MTN_COLORS.black.main,
          '&:hover': {
            backgroundColor: MTN_COLORS.yellow.dark,
            boxShadow: '0 4px 12px rgba(255, 204, 0, 0.3)'
          }
        },
        containedSecondary: {
          backgroundColor: MTN_COLORS.black.main,
          color: MTN_COLORS.white.main,
          '&:hover': {
            backgroundColor: MTN_COLORS.black.light
          }
        },
        outlinedPrimary: {
          borderColor: MTN_COLORS.yellow.main,
          color: MTN_COLORS.yellow.main,
          '&:hover': {
            backgroundColor: 'rgba(255, 204, 0, 0.04)',
            borderColor: MTN_COLORS.yellow.dark
          }
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
          border: `1px solid ${MTN_COLORS.lightGrey}`,
          '&:hover': {
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)'
          }
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          borderRadius: 6
        },
        filledSuccess: {
          backgroundColor: MTN_COLORS.success,
          color: MTN_COLORS.white.main
        },
        filledError: {
          backgroundColor: MTN_COLORS.error,
          color: MTN_COLORS.white.main
        },
        filledWarning: {
          backgroundColor: MTN_COLORS.warning,
          color: MTN_COLORS.black.main
        },
        filledInfo: {
          backgroundColor: MTN_COLORS.info,
          color: MTN_COLORS.white.main
        }
      }
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8
        }
      }
    }
  }
});

// Dark theme variant
export const mtnDarkTheme = createTheme({
  ...mtnTheme,
  palette: {
    mode: 'dark',
    primary: {
      main: MTN_COLORS.yellow.main,
      light: MTN_COLORS.yellow.light,
      dark: MTN_COLORS.yellow.dark,
      contrastText: MTN_COLORS.yellow.contrastText
    },
    secondary: {
      main: MTN_COLORS.white.main,
      light: MTN_COLORS.white.light,
      dark: MTN_COLORS.white.dark,
      contrastText: MTN_COLORS.black.main
    },
    background: {
      default: '#121212',
      paper: '#1E1E1E'
    },
    text: {
      primary: MTN_COLORS.white.main,
      secondary: MTN_COLORS.white.light
    },
    success: {
      main: MTN_COLORS.success
    },
    warning: {
      main: MTN_COLORS.warning
    },
    error: {
      main: MTN_COLORS.error
    },
    info: {
      main: MTN_COLORS.info
    }
  }
});