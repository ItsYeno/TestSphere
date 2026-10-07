const jwt = require('jsonwebtoken');
const { User, Team } = require('../models');
const { loginValidation } = require('../middleware/validation');

const generateToken = (userId) => {
  return jwt.sign(
    { userId }, 
    process.env.JWT_SECRET, 
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

const login = async (req, res) => {
  try {
    // Validate request body
    const { error } = loginValidation(req.body);
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path[0],
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
        code: 'VALIDATION_ERROR'
      });
    }

    const { email, password } = req.body;

    // Find user with team information
    const user = await User.findOne({
      where: { email },
      include: [{
        model: Team,
        as: 'team',
        attributes: ['id', 'name', 'display_name']
      }]
    });

    if (!user || !(await user.validatePassword(password))) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        error: 'Your account has been deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    // Update last login
    user.last_login = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user.id);

    // User data to return (excluding password)
    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      team: user.team,
      last_login: user.last_login
    };

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userData,
        token,
        expires_in: process.env.JWT_EXPIRES_IN
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [{
        model: Team,
        as: 'team',
        attributes: ['id', 'name', 'display_name', 'description']
      }],
      attributes: { exclude: ['password_hash'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: { user }
    });

  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user data',
      code: 'FETCH_USER_FAILED'
    });
  }
};

const refreshToken = async (req, res) => {
  try {
    const token = generateToken(req.user.id);

    res.json({
      success: true,
      data: {
        token,
        expires_in: process.env.JWT_EXPIRES_IN
      }
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh token',
      code: 'REFRESH_FAILED'
    });
  }
};

module.exports = {
  login,
  getCurrentUser,
  refreshToken
};