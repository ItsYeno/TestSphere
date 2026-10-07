const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TestRun = sequelize.define('TestRun', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    build_version: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    environment: {
      type: DataTypes.ENUM('development', 'staging', 'preproduction', 'production'),
      allowNull: false
    },
    test_framework: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    start_time: {
      type: DataTypes.DATE,
      allowNull: false
    },
    end_time: {
      type: DataTypes.DATE,
      allowNull: false
    },
    duration: {
      type: DataTypes.INTEGER, // in milliseconds
      allowNull: false
    },
    total_tests: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    passed_tests: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    failed_tests: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    skipped_tests: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    status: {
      type: DataTypes.ENUM('in_progress', 'passed', 'failed', 'aborted'),
      defaultValue: 'in_progress'
    },
    tags: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    project_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'projects',
        key: 'id'
      }
    },
    triggered_by: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'test_runs',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['project_id', 'created_at']
      },
      {
        fields: ['build_version']
      },
      {
        fields: ['environment']
      }
    ]
  });

  return TestRun;
};