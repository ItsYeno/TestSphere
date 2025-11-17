const express = require('express');
const { 
  getTestRuns, 
  getTestRun, 
  createTestRun, 
  getTestRunTestCases 
} = require('../controllers/testRun.controller');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { testRunValidation } = require('../middleware/validation');

const router = express.Router();

router.use(authenticateToken);

router.get('/', getTestRuns);
router.get('/:id', getTestRun);
router.get('/:id/test-cases', getTestRunTestCases);
router.post('/', validate(testRunValidation), createTestRun);

module.exports = router;