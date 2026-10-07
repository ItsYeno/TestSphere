import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LoadingSpinner from './components/common/LoadingSpinner';

// Lazy load pages for better performance
const Projects = React.lazy(() => import('./pages/Projects'));
const TestRuns = React.lazy(() => import('./pages/TestRuns'));
const TestRunDetails = React.lazy(() => import('./pages/TestRunDetails'));
const Teams = React.lazy(() => import('./pages/Teams'));
const Admin = React.lazy(() => import('./pages/Admin'));

function App() {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  // Public routes
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Protected routes with layout
  return (
    <Layout>
      <React.Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/test-runs" element={<TestRuns />} />
          <Route path="/test-runs/:id" element={<TestRunDetails />} />
          <Route path="/teams" element={<Teams />} />
          {user?.role === 'admin' && (
            <Route path="/admin" element={<Admin />} />
          )}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </React.Suspense>
    </Layout>
  );
}

export default App;