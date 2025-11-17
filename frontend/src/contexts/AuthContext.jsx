import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('testsphere_token'));
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Set auth token in axios headers and localStorage
  const setAuthToken = (newToken) => {
    if (newToken) {
      localStorage.setItem('testsphere_token', newToken);
      authAPI.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    } else {
      localStorage.removeItem('testsphere_token');
      delete authAPI.defaults.headers.common['Authorization'];
    }
    setToken(newToken);
  };

  // Login function
  const login = async (email, password) => {
    try {
      setLoading(true);
      const response = await authAPI.post('/auth/login', { email, password });
      
      if (response.data.success) {
        const { user, token } = response.data.data;
        setUser(user);
        setAuthToken(token);
        setIsAuthenticated(true);
        return { success: true, user };
      }
    } catch (error) {
      const message = error.response?.data?.error || 'Login failed';
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    setUser(null);
    setAuthToken(null);
    setIsAuthenticated(false);
  };

  // Fetch current user
  const fetchCurrentUser = async () => {
    try {
      if (token) {
        setAuthToken(token);
        const response = await authAPI.get('/auth/me');
        if (response.data.success) {
          setUser(response.data.data.user);
          setIsAuthenticated(true);
        }
      }
    } catch (error) {
      console.error('Failed to fetch current user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  // Check for existing token on app start
  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const value = {
    user,
    token,
    loading,
    isAuthenticated,
    login,
    logout,
    setUser,
    hasRole: (role) => user?.role === role,
    isAdmin: () => user?.role === 'admin',
    isTester: () => user?.role === 'tester',
    isViewer: () => user?.role === 'viewer'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};