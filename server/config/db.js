const config = require('./config');
const db = require('../models');

const connectDB = async () => {
  try {
    // Check if we're in development mode and allow mock DB
    if (config.IS_DEVELOPMENT && config.MOCK_DB) {
      console.log('Using mock database (PostgreSQL connection skipped)');
      return { mock: true };
    }

    // Test the connection
    await db.sequelize.authenticate();
    console.log('PostgreSQL Connected');

    // Sync models with database
    if (config.IS_DEVELOPMENT && config.DB_SYNC) {
      // In development, we can sync the models with the database
      // This will create tables if they don't exist, but won't drop existing ones
      await db.sequelize.sync({ force: false, alter: false });
      console.log('Database synchronized (tables created)');
    }

    return db.sequelize;
  } catch (error) {
    console.error(`Error connecting to PostgreSQL: ${error.message}`);

    // In development mode, we can continue without PostgreSQL
    if (config.IS_DEVELOPMENT) {
      console.warn('Running in development mode without PostgreSQL. Some features will not work.');
      return { mock: true };
    } else {
      process.exit(1);
    }
  }
};

module.exports = connectDB;
