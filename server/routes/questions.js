/**
 * Question Routes
 * Handles all question related endpoints
 */
const express = require('express');
const router = express.Router();
const { authenticate, authorizeGameMaster } = require('../middleware/auth');
const { Question } = require('../models');
const anthropicService = require('../services/anthropicService');

// Public routes
// Get all questions (with optional filtering)
router.get('/', async (req, res) => {
  try {
    const { category, difficulty, type, limit = 10, skip = 0 } = req.query;
    
    // Build query object based on provided filters
    const query = {};
    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;
    if (type) query.type = type;
    
    // Execute query with pagination
    const questions = await Question.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const total = await Question.countDocuments(query);
    
    res.json({ 
      questions,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: total > (parseInt(skip) + questions.length)
      }
    });
  } catch (err) {
    console.error('Error fetching questions:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get a specific question by ID
router.get('/:id', async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }
    
    res.json(question);
  } catch (err) {
    console.error(`Error fetching question ${req.params.id}:`, err);
    res.status(500).json({ message: err.message });
  }
});

// Get random questions (with optional filters)
router.get('/random', async (req, res) => {
  try {
    const { category, difficulty, type, count = 1 } = req.query;
    
    // Build query object based on provided filters
    const query = {};
    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;
    if (type) query.type = type;
    
    // Use the aggregate with $sample for random selection
    const questions = await Question.aggregate([
      { $match: query },
      { $sample: { size: parseInt(count) } }
    ]);
    
    if (questions.length === 0) {
      return res.status(404).json({ 
        message: 'No questions found matching the criteria',
        filters: { category, difficulty, type }
      });
    }
    
    // Return a single question object if count is 1, otherwise return array
    res.json(parseInt(count) === 1 ? questions[0] : questions);
  } catch (err) {
    console.error('Error fetching random questions:', err);
    res.status(500).json({ message: err.message });
  }
});

// Protected routes - require authentication
router.use(authenticate);

// Create a new question (Game Master only)
router.post('/', authorizeGameMaster, async (req, res) => {
  try {
    const questionData = req.body;
    
    // Validate required fields
    if (!questionData.text) {
      return res.status(400).json({ message: 'Question text is required' });
    }
    
    if (!questionData.category) {
      return res.status(400).json({ message: 'Question category is required' });
    }
    
    // Create and save the question
    const question = new Question(questionData);
    await question.save();
    
    res.status(201).json(question);
  } catch (err) {
    console.error('Error creating question:', err);
    res.status(400).json({ message: err.message });
  }
});

// Update a question (Game Master only)
router.put('/:id', authorizeGameMaster, async (req, res) => {
  try {
    const questionData = req.body;
    
    // Find and update the question
    const question = await Question.findByIdAndUpdate(
      req.params.id,
      questionData,
      { new: true, runValidators: true }
    );
    
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }
    
    res.json(question);
  } catch (err) {
    console.error(`Error updating question ${req.params.id}:`, err);
    res.status(400).json({ message: err.message });
  }
});

// Delete a question (Game Master only)
router.delete('/:id', authorizeGameMaster, async (req, res) => {
  try {
    const question = await Question.findByIdAndDelete(req.params.id);
    
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }
    
    res.json({ message: 'Question deleted successfully', question });
  } catch (err) {
    console.error(`Error deleting question ${req.params.id}:`, err);
    res.status(500).json({ message: err.message });
  }
});

// Rate a question
router.post('/:id/rate', async (req, res) => {
  try {
    const { rating } = req.body;
    
    // Validate rating
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }
    
    // Find the question
    const question = await Question.findById(req.params.id);
    
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }
    
    // Add or update rating
    if (!question.ratings) {
      question.ratings = [];
    }
    
    // Check if user already rated this question
    const existingRatingIndex = question.ratings.findIndex(
      r => r.userId.toString() === req.user.id
    );
    
    if (existingRatingIndex >= 0) {
      // Update existing rating
      question.ratings[existingRatingIndex].rating = rating;
    } else {
      // Add new rating
      question.ratings.push({
        userId: req.user.id,
        rating,
        timestamp: new Date()
      });
    }
    
    // Calculate average rating
    const totalRating = question.ratings.reduce((sum, r) => sum + r.rating, 0);
    question.averageRating = totalRating / question.ratings.length;
    
    await question.save();
    
    res.json({ 
      message: 'Question rated successfully',
      averageRating: question.averageRating,
      totalRatings: question.ratings.length
    });
  } catch (err) {
    console.error(`Error rating question ${req.params.id}:`, err);
    res.status(400).json({ message: err.message });
  }
});

// Report a question
router.post('/:id/report', async (req, res) => {
  try {
    const { reason } = req.body;
    
    // Validate reason
    if (!reason) {
      return res.status(400).json({ message: 'Report reason is required' });
    }
    
    // Find the question
    const question = await Question.findById(req.params.id);
    
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }
    
    // Add report
    if (!question.reports) {
      question.reports = [];
    }
    
    question.reports.push({
      userId: req.user.id,
      reason,
      timestamp: new Date(),
      status: 'pending'
    });
    
    // Flag question if it has multiple reports
    if (question.reports.length >= 3) {
      question.flagged = true;
    }
    
    await question.save();
    
    res.json({ 
      message: 'Question reported successfully',
      reportsCount: question.reports.length,
      flagged: question.flagged
    });
  } catch (err) {
    console.error(`Error reporting question ${req.params.id}:`, err);
    res.status(400).json({ message: err.message });
  }
});

// Anthropic API Routes
// Generate a question using Anthropic API
router.post('/generate', authorizeGameMaster, async (req, res) => {
  try {
    const { category, difficulty, type, playerProfile, forceRefresh } = req.body;
    
    // Generate question using Anthropic service
    const question = await anthropicService.generateQuestion({
      category,
      difficulty,
      type,
      playerProfile,
      forceRefresh
    });
    
    // Save to database if requested
    if (req.body.saveToDatabase) {
      const savedQuestion = await anthropicService.saveQuestionToDatabase(question);
      return res.status(201).json(savedQuestion);
    }
    
    res.json(question);
  } catch (err) {
    console.error('Error generating question with Anthropic:', err);
    res.status(500).json({ message: err.message });
  }
});

// Generate multiple questions using Anthropic API
router.post('/generate-batch', authorizeGameMaster, async (req, res) => {
  try {
    const { category, difficulty, type, count, playerProfile, forceRefresh } = req.body;
    
    // Generate questions using Anthropic service
    const questions = await anthropicService.generateMultipleQuestions({
      category,
      difficulty,
      type,
      count: parseInt(count) || 5,
      playerProfile,
      forceRefresh
    });
    
    // Save to database if requested
    if (req.body.saveToDatabase) {
      const savedQuestions = await Promise.all(
        questions.map(question => anthropicService.saveQuestionToDatabase(question))
      );
      return res.status(201).json(savedQuestions);
    }
    
    res.json(questions);
  } catch (err) {
    console.error('Error generating multiple questions with Anthropic:', err);
    res.status(500).json({ message: err.message });
  }
});

// Generate questions for a specific player
router.post('/generate-for-player/:playerId', authorizeGameMaster, async (req, res) => {
  try {
    const { playerId } = req.params;
    const { category, count } = req.body;
    
    // Generate questions for player using Anthropic service
    const questions = await anthropicService.generateQuestionsForPlayer(
      playerId,
      category,
      parseInt(count) || 5
    );
    
    // Save to database if requested
    if (req.body.saveToDatabase) {
      const savedQuestions = await Promise.all(
        questions.map(question => anthropicService.saveQuestionToDatabase(question))
      );
      return res.status(201).json(savedQuestions);
    }
    
    res.json(questions);
  } catch (err) {
    console.error(`Error generating questions for player ${req.params.playerId}:`, err);
    res.status(500).json({ message: err.message });
  }
});

// Generate specialist questions for a player
router.post('/generate-specialist/:playerId', authorizeGameMaster, async (req, res) => {
  try {
    const { playerId } = req.params;
    const { specialistTopic, count } = req.body;
    
    if (!specialistTopic) {
      return res.status(400).json({ message: 'Specialist topic is required' });
    }
    
    // Generate specialist questions using Anthropic service
    const questions = await anthropicService.generateSpecialistQuestions(
      playerId,
      specialistTopic,
      parseInt(count) || 5
    );
    
    // Save to database if requested
    if (req.body.saveToDatabase) {
      const savedQuestions = await Promise.all(
        questions.map(question => anthropicService.saveQuestionToDatabase(question))
      );
      return res.status(201).json(savedQuestions);
    }
    
    res.json(questions);
  } catch (err) {
    console.error(`Error generating specialist questions for player ${req.params.playerId}:`, err);
    res.status(500).json({ message: err.message });
  }
});

// Clear question cache (Game Master only)
router.post('/clear-cache', authorizeGameMaster, async (req, res) => {
  try {
    anthropicService.clearCache();
    res.json({ message: 'Question cache cleared successfully' });
  } catch (err) {
    console.error('Error clearing question cache:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
