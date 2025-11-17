const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TestAttachment = sequelize.define('TestAttachment', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    file_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    file_path: {
      type: DataTypes.STRING(1000),
      allowNull: false
    },
    file_size: {
      type: DataTypes.INTEGER
    },
    mime_type: {
      type: DataTypes.STRING(100)
    },
    attachment_type: {
      type: DataTypes.ENUM('screenshot', 'video', 'log', 'other'),
      allowNull: false
    },
    description: {
      type: DataTypes.STRING(500)
    },
    test_case_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'test_cases',
        key: 'id'
      }
    }
  }, {
    tableName: 'test_attachments',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['test_case_id', 'attachment_type']
      }
    ]
  });

  return TestAttachment;
};