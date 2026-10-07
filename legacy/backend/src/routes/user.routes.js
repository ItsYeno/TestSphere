const express = require('express');
const { 
  getUsers, 
  getUser, 
  createUser, 
  updateUser, 
  deleteUser 
} = require('../controllers/user.controller');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { createUserValidation } = require('../middleware/validation');

const router = express.Router();

// All routes require admin privileges
router.use(authenticateToken, authorizeRoles('admin'));

router.get('/', getUsers);
router.get('/:id', getUser);
router.post('/', validate(createUserValidation), createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;