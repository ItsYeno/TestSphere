const jwt = require('jsonwebtoken');
const { User, Team } = require('../models');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required',
        code: 'TOKEN_REQUIRED'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userId, {
      include: [{
        model: Team,
        as: 'team',
        attributes: ['id', 'name', 'display_name']
      }]
    });

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        error: 'User account is inactive or not found',
        code: 'USER_INACTIVE'
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      team: user.team,
      team_id: user.team_id
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid access token',
        code: 'INVALID_TOKEN'
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Access token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions to access this resource',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
};

const authorizeTeamAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  // Admin can access all teams
  if (req.user.role === 'admin') {
    return next();
  }

  // Users can only access their own team's data
  const requestedTeamId = req.params.teamId || req.body.team_id;
  if (requestedTeamId && requestedTeamId !== req.user.team_id) {
    return res.status(403).json({
      success: false,
      error: 'Access to this team is restricted',
      code: 'TEAM_ACCESS_RESTRICTED'
    });
  }

  next();
};

module.exports = {
  authenticateToken,
  authorizeRoles,
  authorizeTeamAccess
};