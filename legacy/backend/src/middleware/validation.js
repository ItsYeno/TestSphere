const Joi = require('joi');

const loginValidation = (data) => {
  const schema = Joi.object({
    email: Joi.string().email().required().trim().lowercase()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email address is required'
      }),
    password: Joi.string().min(6).required()
      .messages({
        'string.min': 'Password must be at least 6 characters long',
        'any.required': 'Password is required'
      })
  });

  return schema.validate(data, { abortEarly: false });
};

const createUserValidation = (data) => {
  const schema = Joi.object({
    email: Joi.string().email().required().trim().lowercase(),
    password: Joi.string().min(6).required(),
    name: Joi.string().min(2).max(100).required().trim(),
    role: Joi.string().valid('admin', 'tester', 'viewer').required(),
    team_id: Joi.string().uuid().required()
  });

  return schema.validate(data, { abortEarly: false });
};

const createProjectValidation = (data) => {
  const schema = Joi.object({
    name: Joi.string().min(3).max(100).required().trim(),
    description: Joi.string().max(1000).optional().allow(''),
    repository_url: Joi.string().uri().optional().allow(''),
    team_id: Joi.string().uuid().required()
  });

  return schema.validate(data, { abortEarly: false });
};

const testRunValidation = (data) => {
  const schema = Joi.object({
    project_id: Joi.string().uuid().required(),
    build_version: Joi.string().min(1).max(50).required(),
    environment: Joi.string().valid('development', 'staging', 'preproduction', 'production').required(),
    test_framework: Joi.string().min(1).max(50).required(),
    start_time: Joi.date().iso().required(),
    end_time: Joi.date().iso().required(),
    tags: Joi.array().items(Joi.string()).optional(),
    metadata: Joi.object().optional()
  });

  return schema.validate(data, { abortEarly: false });
};

const validate = (validator) => {
  return (req, res, next) => {
    const { error, value } = validator(req.body);
    
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

    req.body = value;
    next();
  };
};

module.exports = {
  loginValidation,
  createUserValidation,
  createProjectValidation,
  testRunValidation,
  validate
};