const { Project, Team, TestRun, User } = require('../models');

const getProjects = async (req, res) => {
  try {
    const { team_id } = req.query;
    const where = {};

    // Non-admin users can only see projects from their team
    if (req.user.role !== 'admin') {
      where.team_id = req.user.team_id;
    } else if (team_id) {
      where.team_id = team_id;
    }

    const projects = await Project.findAll({
      where,
      include: [
        {
          model: Team,
          as: 'team',
          attributes: ['id', 'name', 'display_name']
        },
        {
          model: User,
          as: 'createdBy',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: projects
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch projects',
      code: 'FETCH_PROJECTS_FAILED'
    });
  }
};

const getProject = async (req, res) => {
  try {
    const { id } = req.params;
    
    const project = await Project.findByPk(id, {
      include: [
        {
          model: Team,
          as: 'team',
          attributes: ['id', 'name', 'display_name', 'description']
        },
        {
          model: User,
          as: 'createdBy',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND'
      });
    }

    // Check if user has access to this project
    if (req.user.role !== 'admin' && project.team_id !== req.user.team_id) {
      return res.status(403).json({
        success: false,
        error: 'Access to this project is restricted',
        code: 'PROJECT_ACCESS_RESTRICTED'
      });
    }

    res.json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch project',
      code: 'FETCH_PROJECT_FAILED'
    });
  }
};

const createProject = async (req, res) => {
  try {
    const projectData = {
      ...req.body,
      created_by: req.user.id
    };

    const project = await Project.create(projectData);

    // Fetch the created project with relations
    const createdProject = await Project.findByPk(project.id, {
      include: [
        {
          model: Team,
          as: 'team',
          attributes: ['id', 'name', 'display_name']
        },
        {
          model: User,
          as: 'createdBy',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: createdProject
    });
  } catch (error) {
    console.error('Create project error:', error);
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        success: false,
        error: 'A project with this name already exists in the team',
        code: 'PROJECT_EXISTS'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create project',
      code: 'CREATE_PROJECT_FAILED'
    });
  }
};

const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    
    const project = await Project.findByPk(id);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND'
      });
    }

    // Check if user has access to update this project
    if (req.user.role !== 'admin' && project.team_id !== req.user.team_id) {
      return res.status(403).json({
        success: false,
        error: 'Access to update this project is restricted',
        code: 'PROJECT_UPDATE_RESTRICTED'
      });
    }

    await project.update(req.body);

    // Fetch updated project with relations
    const updatedProject = await Project.findByPk(id, {
      include: [
        {
          model: Team,
          as: 'team',
          attributes: ['id', 'name', 'display_name']
        }
      ]
    });

    res.json({
      success: true,
      message: 'Project updated successfully',
      data: updatedProject
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update project',
      code: 'UPDATE_PROJECT_FAILED'
    });
  }
};

const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    
    const project = await Project.findByPk(id);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND'
      });
    }

    await project.destroy();

    res.json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete project',
      code: 'DELETE_PROJECT_FAILED'
    });
  }
};

const getProjectTestRuns = async (req, res) => {
  try {
    const { id } = req.params;
    
    const project = await Project.findByPk(id);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND'
      });
    }

    // Check if user has access to this project's test runs
    if (req.user.role !== 'admin' && project.team_id !== req.user.team_id) {
      return res.status(403).json({
        success: false,
        error: 'Access to project test runs is restricted',
        code: 'TEST_RUNS_ACCESS_RESTRICTED'
      });
    }

    const testRuns = await TestRun.findAll({
      where: { project_id: id },
      include: [
        {
          model: User,
          as: 'triggeredBy',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: testRuns
    });
  } catch (error) {
    console.error('Get project test runs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch project test runs',
      code: 'FETCH_TEST_RUNS_FAILED'
    });
  }
};

module.exports = {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getProjectTestRuns
};