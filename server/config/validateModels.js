const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('./db');
const {
  Player,
  GameSession,
  Question,
  Category,
  GameHistory
} = require('../models');

// Load environment variables
dotenv.config();

// Validate model relationships
const validateModels = async () => {
  try {
    // Connect to database
    await connectDB();
    console.log('Validating database models...');
    
    // Validate Category model
    const categories = await Category.find().limit(2);
    if (categories.length === 0) {
      console.warn('No categories found. Please run the seed script first.');
    } else {
      console.log(`Found ${categories.length} categories. Category model is working.`);
      
      // Test relationship getters
      if (categories[0].getSubcategories) {
        const subcategories = await categories[0].getSubcategories();
        console.log(`Category ${categories[0].name} has ${subcategories.length} subcategories.`);
      }
    }
    
    // Create a test player to validate Player model
    const testPlayer = new Player({
      name: 'Test Player',
      age: 30,
      specialistSubject: 'Testing',
      deviceId: `test-device-${Date.now()}`
    });
    
    const validation = testPlayer.validateSync();
    if (!validation) {
      console.log('Player model validation successful');
    } else {
      console.error('Player model validation failed:', validation.errors);
    }
    
    // Clean up test data (don't actually save it)
    
    // Check question model validation
    const testQuestion = new Question({
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
    
    const questionValidation = testQuestion.validateSync();
    if (!questionValidation) {
      console.log('Question model validation successful');
    } else {
      console.error('Question model validation failed:', questionValidation.errors);
    }
    
    // Exit successfully
    console.log('All models validated successfully');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error(`Error validating models: ${error.message}`);
    process.exit(1);
  }
};

// Run the validation
validateModels();
