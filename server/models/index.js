const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
const config = require('../config/config');
const basename = path.basename(__filename);

// Initialize Sequelize with PostgreSQL using config
const sequelize = new Sequelize(config.DB_CONFIG);

const db = {};

// Import all models from the current directory
fs.readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js'
    );
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

// Set up associations
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Add Sequelize and sequelize to the db object
db.sequelize = sequelize;
db.Sequelize = Sequelize;

// Export the db object
module.exports = db;
