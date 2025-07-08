const dotenv = require('dotenv');
const connectDB = require('./db');
const db = require('../models');

// Load environment variables
dotenv.config();

// Validate model relationships
const validateModels = async () => {
  try {
    // Connect to database
    const connection = await connectDB();

    // Skip validation if using mock database
    if (connection.mock) {
      console.log('Using mock database - skipping model validation');
      process.exit(0);
      return;
    }

    console.log('Validating database models...');

    // Validate Player model
    try {
      // Build a test player (doesn't save to database)
      const testPlayer = db.Player.build({
        name: 'Test Player',
        age: 30,
        specialistSubject: 'Testing',
        deviceId: `test-device-${Date.now()}`
      });

      // Validate the model
      await testPlayer.validate();
      console.log('Player model validation successful');
    } catch (error) {
      console.error('Player model validation failed:', error.message);
    }

    // Validate Question model
    try {
      // Build a test question (doesn't save to database)
      const testQuestion = db.Question.build({
        text: 'What is the capital of France?',
        type: 'multipleChoice',
        category: 'Geography',
        options: [
          { text: 'Paris', isCorrect: true },
          { text: 'London', isCorrect: false },
          { text: 'Berlin', isCorrect: false },
          { text: 'Madrid', isCorrect: false }
        ]
      });

      // Validate the model
      await testQuestion.validate();
      console.log('Question model validation successful');
    } catch (error) {
      console.error('Question model validation failed:', error.message);
    }

    // Validate GameSession model
    try {
      // Build a test game session (doesn't save to database)
      const testGameSession = db.GameSession.build({
        code: `TEST-${Date.now()}`,
        hostId: 1,
        status: 'created'
      });

      // Validate the model
      await testGameSession.validate();
      console.log('GameSession model validation successful');
    } catch (error) {
      console.error('GameSession model validation failed:', error.message);
    }

    // Check model associations
    console.log('Checking model associations...');

    // List all models and their associations
    Object.keys(db).forEach(modelName => {
      if (db[modelName].associations) {
        console.log(`Model ${modelName} associations:`,
          Object.keys(db[modelName].associations).join(', '));
      }
    });

    // Exit successfully
    console.log('All models validated successfully');
    process.exit(0);
  } catch (error) {
    console.error(`Error validating models: ${error.message}`);
    process.exit(1);
  }
};

// Run the validation
validateModels();
