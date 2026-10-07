const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

// Route imports
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const teamRoutes = require('./routes/team.routes');
const projectRoutes = require('./routes/project.routes');
const testRunRoutes = require('./routes/testRun.routes');

// Middleware imports
const errorHandler = require('./middleware/errorHandler');
const notFoundHandler = require('./middleware/notFoundHandler');

const app = express();

// Security Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS Configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body Parsing Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging Middleware
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Static Files - Serve uploaded files
app.use('/api/uploads', express.static(path.join(__dirname, '../../storage/uploads')));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: process.env.APP_NAME,
    environment: process.env.NODE_ENV,
    company: process.env.COMPANY_NAME
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/test-runs', testRunRoutes);

// Welcome Route
app.get('/api', (req, res) => {
  res.json({
    message: `Welcome to ${process.env.APP_NAME} - ${process.env.COMPANY_NAME} Enterprise Testing Dashboard`,
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Error Handling Middleware
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;