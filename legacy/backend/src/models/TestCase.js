const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TestCase = sequelize.define('TestCase', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    full_name: {
      type: DataTypes.STRING(1000),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('passed', 'failed', 'skipped', 'pending'),
      allowNull: false
    },
    duration: {
      type: DataTypes.INTEGER, // in milliseconds
      allowNull: false
    },
    failure_message: {
      type: DataTypes.TEXT
    },
    stack_trace: {
      type: DataTypes.TEXT
    },
    error_type: {
      type: DataTypes.STRING(200)
    },
    tags: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    test_run_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'test_runs',
        key: 'id'
      }
    }
  }, {
    tableName: 'test_cases',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['test_run_id', 'status']
      }
    ]
  });

  return TestCase;
};