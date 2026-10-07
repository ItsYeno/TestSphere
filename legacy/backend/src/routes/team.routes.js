const express = require('express');
const { getTeams, getTeam, getTeamMembers } = require('../controllers/team.controller');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/', getTeams);
router.get('/:id', getTeam);
router.get('/:id/members', getTeamMembers);

module.exports = router;