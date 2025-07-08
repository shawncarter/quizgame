module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define('Category', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    iconName: {
      type: DataTypes.STRING,
      defaultValue: 'question-mark'
    },
    color: {
      type: DataTypes.STRING,
      defaultValue: '#3498db'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    parentCategoryId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Categories',
        key: 'id'
      }
    },
    difficulty: {
      type: DataTypes.INTEGER,
      defaultValue: 2,
      validate: {
        min: 1,
        max: 5
      }
    },
    questionCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    }
  }, {
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['name']
      },
      {
        fields: ['parentCategoryId']
      }
    ]
  });

  // After the model is defined, set up associations
  Category.associate = (models) => {
    Category.hasMany(models.Category, {
      as: 'subcategories',
      foreignKey: 'parentCategoryId'
    });

    Category.belongsTo(models.Category, {
      as: 'parentCategory',
      foreignKey: 'parentCategoryId'
    });

    // Note: Questions use string category field, not foreign key relationship
  };

  // Instance methods
  Category.prototype.getSubcategories = function() {
    return Category.findAll({
      where: { parentCategoryId: this.id }
    });
  };

  // Static methods
  Category.getRootCategories = function() {
    return Category.findAll({
      where: { parentCategoryId: null }
    });
  };

  Category.getCategoryHierarchy = async function() {
    const rootCategories = await Category.findAll({
      where: { parentCategoryId: null },
      order: [['name', 'ASC']]
    });

    const result = [];

    for (const rootCategory of rootCategories) {
      const subcategories = await Category.findAll({
        where: { parentCategoryId: rootCategory.id },
        order: [['name', 'ASC']]
      });

      result.push({
        ...rootCategory.toJSON(),
        subcategories: subcategories
      });
    }

    return result;
  };

  Category.getPopularCategories = function(limit = 10) {
    return Category.findAll({
      where: { isActive: true },
      order: [['questionCount', 'DESC']],
      limit
    });
  };

  return Category;
};
