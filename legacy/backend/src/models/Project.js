const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Project = sequelize.define('Project', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT
    },
    repository_url: {
      type: DataTypes.STRING(500)
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    team_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'teams',
        key: 'id'
      }
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'projects',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['name', 'team_id']
      }
    ]
  });

  // Associations
  Project.associate = (models) => {
    Project.belongsTo(models.Team, {
      foreignKey: 'team_id',
      as: 'team'
    });

    Project.belongsTo(models.User, {
      foreignKey: 'created_by',
      as: 'createdBy'
    });

    // If you have TestRun model
    Project.hasMany(models.TestRun, {
      foreignKey: 'project_id',
      as: 'testRuns'
    });
  };

  return Project;
};
