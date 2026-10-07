const { Team, User } = require('../models');

const getTeams = async (req, res) => {
  try {
    const teams = await Team.findAll({
      order: [['name', 'ASC']]
    });

    res.json({
      success: true,
      data: teams
    });
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch teams',
      code: 'FETCH_TEAMS_FAILED'
    });
  }
};

const getTeam = async (req, res) => {
  try {
    const { id } = req.params;
    
    const team = await Team.findByPk(id);

    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Team not found',
        code: 'TEAM_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: team
    });
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch team',
      code: 'FETCH_TEAM_FAILED'
    });
  }
};

const getTeamMembers = async (req, res) => {
  try {
    const { id } = req.params;
    
    const team = await Team.findByPk(id);
    
    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Team not found',
        code: 'TEAM_NOT_FOUND'
      });
    }

    const members = await User.findAll({
      where: { team_id: id },
      attributes: { exclude: ['password_hash'] },
      order: [['name', 'ASC']]
    });

    res.json({
      success: true,
      data: members
    });
  } catch (error) {
    console.error('Get team members error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch team members',
      code: 'FETCH_MEMBERS_FAILED'
    });
  }
};

module.exports = {
  getTeams,
  getTeam,
  getTeamMembers
};