const { handleFileUpload } = require('../services/fileUpload.service');

const uploadMiddleware = (fieldName) => {
  return (req, res, next) => {
    handleFileUpload(fieldName)(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: 'File too large. Maximum size is 100MB.',
            code: 'FILE_TOO_LARGE'
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            error: 'Too many files. Maximum 10 files allowed.',
            code: 'TOO_MANY_FILES'
          });
        }
        if (err.message.includes('File type')) {
          return res.status(400).json({
            success: false,
            error: err.message,
            code: 'INVALID_FILE_TYPE'
          });
        }
        
        return res.status(500).json({
          success: false,
          error: 'File upload failed',
          code: 'UPLOAD_FAILED'
        });
      }
      next();
    });
  };
};

module.exports = { uploadMiddleware };