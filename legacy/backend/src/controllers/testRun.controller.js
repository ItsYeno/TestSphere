const { TestRun, TestCase, TestAttachment, Project, User } = require('../models');

const getTestRuns = async (req, res) => {
  try {
    const { 
      project_id, 
      status, 
      environment, 
      build_version,
      page = 1, 
      limit = 10,
      sort = 'created_at',
      order = 'DESC'
    } = req.query;

    const where = {};
    const include = [{
      model: Project,
      as: 'project',
      attributes: ['id', 'name', 'team_id'],
      required: true
    }];

    // Apply filters
    if (project_id) where.project_id = project_id;
    if (status) where.status = status;
    if (environment) where.environment = environment;
    if (build_version) where.build_version = build_version;

    // Non-admin users can only see test runs from their team
    if (req.user.role !== 'admin') {
      include[0].where = { team_id: req.user.team_id };
    }

    const offset = (page - 1) * limit;

    const testRuns = await TestRun.findAndCountAll({
      where,
      include: [
        ...include,
        {
          model: User,
          as: 'triggeredBy',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [[sort, order.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: testRuns.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: testRuns.count,
        pages: Math.ceil(testRuns.count / limit)
      }
    });
  } catch (error) {
    console.error('Get test runs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch test runs',
      code: 'FETCH_TEST_RUNS_FAILED'
    });
  }
};

const getTestRun = async (req, res) => {
  try {
    const { id } = req.params;
    
    const testRun = await TestRun.findByPk(id, {
      include: [
        {
          model: Project,
          as: 'project',
          attributes: ['id', 'name', 'team_id']
        },
        {
          model: User,
          as: 'triggeredBy',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    if (!testRun) {
      return res.status(404).json({
        success: false,
        error: 'Test run not found',
        code: 'TEST_RUN_NOT_FOUND'
      });
    }

    // Check if user has access to this test run
    if (req.user.role !== 'admin' && testRun.project.team_id !== req.user.team_id) {
      return res.status(403).json({
        success: false,
        error: 'Access to this test run is restricted',
        code: 'TEST_RUN_ACCESS_RESTRICTED'
      });
    }

    res.json({
      success: true,
      data: testRun
    });
  } catch (error) {
    console.error('Get test run error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch test run',
      code: 'FETCH_TEST_RUN_FAILED'
    });
  }
};

const createTestRun = async (req, res) => {
  try {
    const testRunData = {
      ...req.body,
      triggered_by: req.user.id
    };

    const testRun = await TestRun.create(testRunData);

    // Fetch the created test run with relations
    const createdTestRun = await TestRun.findByPk(testRun.id, {
      include: [
        {
          model: Project,
          as: 'project',
          attributes: ['id', 'name']
        },
        {
          model: User,
          as: 'triggeredBy',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Test run created successfully',
      data: createdTestRun
    });
  } catch (error) {
    console.error('Create test run error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create test run',
      code: 'CREATE_TEST_RUN_FAILED'
    });
  }
};

const getTestRunTestCases = async (req, res) => {
  try {
    const { id } = req.params;
    
    const testRun = await TestRun.findByPk(id, {
      include: [{
        model: Project,
        as: 'project',
        attributes: ['id', 'name', 'team_id']
      }]
    });
    
    if (!testRun) {
      return res.status(404).json({
        success: false,
        error: 'Test run not found',
        code: 'TEST_RUN_NOT_FOUND'
      });
    }

    // Check if user has access to this test run's test cases
    if (req.user.role !== 'admin' && testRun.project.team_id !== req.user.team_id) {
      return res.status(403).json({
        success: false,
        error: 'Access to test cases is restricted',
        code: 'TEST_CASES_ACCESS_RESTRICTED'
      });
    }

    const testCases = await TestCase.findAll({
      where: { test_run_id: id },
      include: [{
        model: TestAttachment,
        as: 'attachments',
        attributes: ['id', 'file_name', 'file_path', 'attachment_type', 'description']
      }],
      order: [['created_at', 'ASC']]
    });

    res.json({
      success: true,
      data: testCases
    });
  } catch (error) {
    console.error('Get test run test cases error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch test cases',
      code: 'FETCH_TEST_CASES_FAILED'
    });
  }
};

module.exports = {
  getTestRuns,
  getTestRun,
  createTestRun,
  getTestRunTestCases
};