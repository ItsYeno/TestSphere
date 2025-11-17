const formatResponse = (success, data, message = '', code = '') => {
  return {
    success,
    ...(message && { message }),
    ...(code && { code }),
    ...(data && { data })
  };
};

const formatError = (message, code = '') => {
  return {
    success: false,
    error: message,
    ...(code && { code })
  };
};

const calculateDuration = (startTime, endTime) => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  return end - start; // Returns duration in milliseconds
};

const generateBuildVersion = () => {
  const now = new Date();
  const timestamp = now.toISOString().slice(0, 19).replace(/[-T:/]/g, '');
  return `build-${timestamp}`;
};

const sanitizeFileName = (fileName) => {
  return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

module.exports = {
  formatResponse,
  formatError,
  calculateDuration,
  generateBuildVersion,
  sanitizeFileName,
  formatFileSize
};