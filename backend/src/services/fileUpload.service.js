const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../../storage/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = file.mimetype.startsWith('image/') ? 'screenshots' : 
                 file.mimetype.startsWith('video/') ? 'videos' : 'other';
    
    const dir = path.join(uploadDir, type);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/png',
    'image/jpeg', 
    'image/jpg',
    'video/mp4',
    'video/webm',
    'video/avi',
    'text/plain',
    'application/json'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`), false);
  }
};

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 10 // Max 10 files per upload
  }
});

// Service functions
const handleFileUpload = (fieldName) => {
  return upload.array(fieldName);
};

const deleteFile = (filePath) => {
  return new Promise((resolve, reject) => {
    const fullPath = path.join(uploadDir, filePath);
    
    fs.unlink(fullPath, (err) => {
      if (err) {
        if (err.code === 'ENOENT') {
          resolve(); // File doesn't exist, consider it deleted
        } else {
          reject(err);
        }
      } else {
        resolve();
      }
    });
  });
};

const getFileUrl = (filePath) => {
  return `/api/uploads/${filePath}`;
};

module.exports = {
  handleFileUpload,
  deleteFile,
  getFileUrl,
  upload
};