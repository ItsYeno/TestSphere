const express = require('express');
const { 
  getProjects, 
  getProject, 
  createProject, 
  updateProject, 
  deleteProject,
  getProjectTestRuns 
} = require('../controllers/project.controller');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { createProjectValidation } = require('../middleware/validation');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/', getProjects);
router.get('/:id', getProject);
router.get('/:id/test-runs', getProjectTestRuns);
router.post('/', authorizeRoles('admin', 'tester'), validate(createProjectValidation), createProject);
router.put('/:id', authorizeRoles('admin', 'tester'), updateProject);
router.delete('/:id', authorizeRoles('admin'), deleteProject);

module.exports = router;