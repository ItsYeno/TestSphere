const { Sequelize } = require('sequelize');
const config = require('../../config/database');

const sequelize = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  port: config.port,
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

const User = require('./User')(sequelize, Sequelize);
const Team = require('./Team')(sequelize, Sequelize);
const Project = require('./Project')(sequelize, Sequelize);
const TestRun = require('./TestRun')(sequelize, Sequelize);
const TestCase = require('./TestCase')(sequelize, Sequelize);
const TestAttachment = require('./TestAttachment')(sequelize, Sequelize);

// Define Associations
User.belongsTo(Team, { foreignKey: 'team_id', as: 'team' });
Team.hasMany(User, { foreignKey: 'team_id', as: 'members' });

Project.belongsTo(Team, { foreignKey: 'team_id', as: 'team' });
Team.hasMany(Project, { foreignKey: 'team_id', as: 'projects' });

// ADD THIS ASSOCIATION - User can create projects
Project.belongsTo(User, { foreignKey: 'created_by', as: 'createdBy' });
User.hasMany(Project, { foreignKey: 'created_by', as: 'createdProjects' });

TestRun.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
Project.hasMany(TestRun, { foreignKey: 'project_id', as: 'testRuns' });

TestRun.belongsTo(User, { foreignKey: 'triggered_by', as: 'triggeredBy' });
User.hasMany(TestRun, { foreignKey: 'triggered_by', as: 'triggeredTestRuns' });

TestCase.belongsTo(TestRun, { foreignKey: 'test_run_id', as: 'testRun' });
TestRun.hasMany(TestCase, { foreignKey: 'test_run_id', as: 'testCases' });

TestAttachment.belongsTo(TestCase, { foreignKey: 'test_case_id', as: 'testCase' });
TestCase.hasMany(TestAttachment, { foreignKey: 'test_case_id', as: 'attachments' });

module.exports = {
  sequelize,
  Sequelize,
  User,
  Team,
  Project,
  TestRun,
  TestCase,
  TestAttachment
};