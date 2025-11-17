require('dotenv').config();
const app = require('./src/app');

const PORT = process.env.PORT || 5000;

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 TestSphere Server running in ${process.env.NODE_ENV} mode`);
  console.log(`📍 Server URL: http://localhost:${PORT}`);
  console.log(`🏢 Company: ${process.env.COMPANY_NAME}`);
  console.log(`📊 Application: ${process.env.APP_NAME}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Process terminated.');
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Process terminated.');
  });
});

module.exports = server;