/**
 * Anthropic API Service
 * Handles communication with the Anthropic API for generating quiz questions
 */
const Anthropic = require('@anthropic-ai/sdk');
const { Question } = require('../models');
const NodeCache = require('node-cache');

// Initialize cache with TTL of 24 hours and check period of 600 seconds
const questionCache = new NodeCache({ stdTTL: 86400, checkperiod: 600 });

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Cache key prefixes
const CACHE_KEYS = {
  CATEGORY: 'category:',
  PLAYER: 'player:',
  DIFFICULTY: 'difficulty:',
  COMBINED: 'combined:'
};

/**
 * Generate a question using Anthropic API
 * @param {Object} options - Options for question generation
 * @param {string} options.category - Question category
 * @param {string} options.difficulty - Question difficulty (easy, medium, hard)
 * @param {string} options.type - Question type (multipleChoice, trueFalse, shortAnswer)
 * @param {Object} options.playerProfile - Player profile for personalization
 * @returns {Promise<Object>} Generated question
 */
async function generateQuestion(options = {}) {
  try {
    const { 
      category, 
      difficulty = 'medium', 
      type = 'multipleChoice',
      playerProfile = null,
      forceRefresh = false
    } = options;

    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      const cachedQuestion = getCachedQuestion(options);
      if (cachedQuestion) {
        console.log('Using cached question');
        return cachedQuestion;
      }
    }

    // Construct the prompt based on options
    const prompt = constructQuestionPrompt(options);

    // Call Anthropic API
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1000,
      temperature: 0.7,
      system: "You are a helpful assistant that generates high-quality quiz questions. Your responses should be formatted as JSON objects that can be parsed directly by JavaScript's JSON.parse().",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    // Extract and parse the JSON from the response
    const content = response.content[0].text;
    const questionData = extractJsonFromResponse(content);

    // Validate the question data
    if (!validateQuestionData(questionData, type)) {
      throw new Error('Invalid question data received from Anthropic API');
    }

    // Format the question for our database model
    const formattedQuestion = formatQuestionForDatabase(questionData, options);

    // Cache the question
    cacheQuestion(options, formattedQuestion);

    return formattedQuestion;
  } catch (error) {
    console.error('Error generating question with Anthropic:', error);
    throw new Error(`Failed to generate question: ${error.message}`);
  }
}

/**
 * Generate multiple questions using Anthropic API
 * @param {Object} options - Options for question generation
 * @param {string} options.category - Question category
 * @param {string} options.difficulty - Question difficulty
 * @param {string} options.type - Question type
 * @param {number} options.count - Number of questions to generate
 * @param {Object} options.playerProfile - Player profile for personalization
 * @returns {Promise<Array>} Array of generated questions
 */
async function generateMultipleQuestions(options = {}) {
  try {
    const { count = 5, ...questionOptions } = options;
    const questions = [];

    // Try to get questions from cache first
    if (!options.forceRefresh) {
      const cachedQuestions = getCachedQuestionBatch(options);
      if (cachedQuestions && cachedQuestions.length >= count) {
        return cachedQuestions.slice(0, count);
      }
    }

    // Generate questions in parallel (with a reasonable concurrency limit)
    const concurrencyLimit = 3; // Limit concurrent API calls
    const batches = Math.ceil(count / concurrencyLimit);

    for (let i = 0; i < batches; i++) {
      const batchSize = Math.min(concurrencyLimit, count - (i * concurrencyLimit));
      const batchPromises = Array(batchSize).fill().map(() => generateQuestion(questionOptions));
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Filter out any rejected promises and add fulfilled ones to our questions array
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          questions.push(result.value);
        }
      });

      // If we have enough questions, break early
      if (questions.length >= count) {
        break;
      }
    }

    // If we couldn't generate enough questions, log a warning
    if (questions.length < count) {
      console.warn(`Could only generate ${questions.length} of ${count} requested questions`);
    }

    return questions;
  } catch (error) {
    console.error('Error generating multiple questions:', error);
    throw new Error(`Failed to generate multiple questions: ${error.message}`);
  }
}

/**
 * Generate a batch of questions for a specific player
 * @param {string} playerId - Player ID
 * @param {string} category - Question category
 * @param {number} count - Number of questions to generate
 * @returns {Promise<Array>} Array of generated questions
 */
async function generateQuestionsForPlayer(playerId, category, count = 5) {
  try {
    // Get player profile from database
    const Player = require('../models/Player');
    const player = await Player.findByPk(playerId);

    if (!player) {
      throw new Error(`Player with ID ${playerId} not found`);
    }

    // Extract relevant player information for personalization
    const playerProfile = {
      id: player.id,
      name: player.name,
      preferredCategories: player.preferences?.categories || [],
      difficultyLevel: player.preferences?.difficulty || 'medium',
      pastPerformance: player.stats || {}
    };

    // Generate questions with player profile
    return generateMultipleQuestions({
      category,
      difficulty: playerProfile.difficultyLevel,
      count,
      playerProfile
    });
  } catch (error) {
    console.error(`Error generating questions for player ${playerId}:`, error);
    throw new Error(`Failed to generate questions for player: ${error.message}`);
  }
}

/**
 * Generate questions for a specialist round
 * @param {string} playerId - Player ID
 * @param {string} specialistTopic - Player's specialist topic
 * @param {number} count - Number of questions to generate
 * @returns {Promise<Array>} Array of generated questions
 */
async function generateSpecialistQuestions(playerId, specialistTopic, count = 5) {
  try {
    // Get player profile from database
    const Player = require('../models/Player');
    const player = await Player.findByPk(playerId);

    if (!player) {
      throw new Error(`Player with ID ${playerId} not found`);
    }

    // Extract relevant player information for personalization
    const playerProfile = {
      id: player.id,
      name: player.name,
      specialistTopic
    };

    // Generate specialist questions
    return generateMultipleQuestions({
      category: specialistTopic,
      difficulty: 'hard', // Specialist questions are typically harder
      count,
      playerProfile,
      type: 'multipleChoice'
    });
  } catch (error) {
    console.error(`Error generating specialist questions for player ${playerId}:`, error);
    throw new Error(`Failed to generate specialist questions: ${error.message}`);
  }
}

/**
 * Construct a prompt for question generation
 * @param {Object} options - Options for question generation
 * @returns {string} Prompt for Anthropic API
 */
function constructQuestionPrompt(options) {
  const { 
    category, 
    difficulty = 'medium', 
    type = 'multipleChoice',
    playerProfile = null
  } = options;

  let prompt = `Generate a ${difficulty} difficulty quiz question`;
  
  if (category) {
    prompt += ` about ${category}`;
  }

  // Add question type specific instructions
  if (type === 'multipleChoice') {
    prompt += `. The question should have 4 possible answers with only one correct answer.`;
  } else if (type === 'trueFalse') {
    prompt += `. The question should be answerable with True or False.`;
  } else if (type === 'shortAnswer') {
    prompt += `. The question should be answerable with a short text response.`;
  }

  // Add personalization if player profile is provided
  if (playerProfile) {
    prompt += `\n\nThis question is for a player named ${playerProfile.name}.`;
    
    if (playerProfile.specialistTopic) {
      prompt += ` This is for a specialist round where the player has chosen ${playerProfile.specialistTopic} as their specialist topic.`;
    }
    
    if (playerProfile.preferredCategories && playerProfile.preferredCategories.length > 0) {
      prompt += ` The player's preferred categories are: ${playerProfile.preferredCategories.join(', ')}.`;
    }
  }

  // Add formatting instructions
  prompt += `\n\nFormat your response as a JSON object with the following structure:`;
  
  if (type === 'multipleChoice') {
    prompt += `
{
  "text": "The question text",
  "options": [
    {"text": "Option A", "isCorrect": false},
    {"text": "Option B", "isCorrect": false},
    {"text": "Option C", "isCorrect": true},
    {"text": "Option D", "isCorrect": false}
  ],
  "explanation": "Explanation of the correct answer"
}`;
  } else if (type === 'trueFalse') {
    prompt += `
{
  "text": "The question text",
  "correctAnswer": "True or False",
  "explanation": "Explanation of the correct answer"
}`;
  } else if (type === 'shortAnswer') {
    prompt += `
{
  "text": "The question text",
  "correctAnswer": "The correct answer",
  "explanation": "Explanation of the correct answer"
}`;
  }

  return prompt;
}

/**
 * Extract JSON from Anthropic API response
 * @param {string} response - Raw response from Anthropic API
 * @returns {Object} Parsed JSON object
 */
function extractJsonFromResponse(response) {
  try {
    // Try to find JSON in the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // If no JSON found, throw an error
    throw new Error('No JSON found in response');
  } catch (error) {
    console.error('Error extracting JSON from response:', error);
    throw new Error(`Failed to extract JSON from response: ${error.message}`);
  }
}

/**
 * Validate question data from Anthropic API
 * @param {Object} questionData - Question data from Anthropic API
 * @param {string} type - Question type
 * @returns {boolean} Whether the question data is valid
 */
function validateQuestionData(questionData, type) {
  if (!questionData || typeof questionData !== 'object') {
    return false;
  }

  // Check for required fields
  if (!questionData.text) {
    return false;
  }

  // Type-specific validation
  if (type === 'multipleChoice') {
    if (!Array.isArray(questionData.options) || questionData.options.length < 2) {
      return false;
    }
    
    // Ensure there's exactly one correct answer
    const correctOptions = questionData.options.filter(option => option.isCorrect);
    if (correctOptions.length !== 1) {
      return false;
    }
  } else if (type === 'trueFalse' || type === 'shortAnswer') {
    if (!questionData.correctAnswer) {
      return false;
    }
  }

  return true;
}

/**
 * Format question data for database
 * @param {Object} questionData - Question data from Anthropic API
 * @param {Object} options - Original options used for generation
 * @returns {Object} Formatted question data
 */
function formatQuestionForDatabase(questionData, options) {
  const { 
    category, 
    difficulty = 'medium', 
    type = 'multipleChoice',
    playerProfile = null
  } = options;

  const formattedQuestion = {
    text: questionData.text,
    type,
    category: category || 'general',
    difficulty,
    explanation: questionData.explanation || '',
    createdBy: 'anthropic',
    timeLimit: getTimeLimitForDifficulty(difficulty),
    pointValue: getPointValueForDifficulty(difficulty),
    tags: [category]
  };

  // Add type-specific fields
  if (type === 'multipleChoice') {
    formattedQuestion.options = questionData.options;
  } else {
    formattedQuestion.correctAnswer = questionData.correctAnswer;
  }

  // Add player-specific fields if available
  if (playerProfile && playerProfile.id) {
    formattedQuestion.forPlayerId = playerProfile.id;
  }

  return formattedQuestion;
}

/**
 * Get time limit based on difficulty
 * @param {string} difficulty - Question difficulty
 * @returns {number} Time limit in seconds
 */
function getTimeLimitForDifficulty(difficulty) {
  switch (difficulty) {
    case 'easy':
      return 20;
    case 'medium':
      return 30;
    case 'hard':
      return 45;
    default:
      return 30;
  }
}

/**
 * Get point value based on difficulty
 * @param {string} difficulty - Question difficulty
 * @returns {number} Point value
 */
function getPointValueForDifficulty(difficulty) {
  switch (difficulty) {
    case 'easy':
      return 50;
    case 'medium':
      return 100;
    case 'hard':
      return 150;
    default:
      return 100;
  }
}

/**
 * Generate cache key for question options
 * @param {Object} options - Question generation options
 * @returns {string} Cache key
 */
function generateCacheKey(options) {
  const { 
    category, 
    difficulty = 'medium', 
    type = 'multipleChoice',
    playerProfile = null
  } = options;

  let key = CACHE_KEYS.COMBINED;
  
  if (category) {
    key += `${category}:`;
  }
  
  key += `${difficulty}:${type}`;
  
  if (playerProfile && playerProfile.id) {
    key += `:${playerProfile.id}`;
  }
  
  return key;
}

/**
 * Cache a generated question
 * @param {Object} options - Question generation options
 * @param {Object} question - Generated question
 */
function cacheQuestion(options, question) {
  const key = generateCacheKey(options);
  
  // Get existing questions for this key or initialize empty array
  const existingQuestions = questionCache.get(key) || [];
  
  // Add new question
  existingQuestions.push(question);
  
  // Store back in cache
  questionCache.set(key, existingQuestions);
}

/**
 * Get a cached question
 * @param {Object} options - Question generation options
 * @returns {Object|null} Cached question or null if not found
 */
function getCachedQuestion(options) {
  const key = generateCacheKey(options);
  
  // Get existing questions for this key
  const existingQuestions = questionCache.get(key);
  
  if (!existingQuestions || existingQuestions.length === 0) {
    return null;
  }
  
  // Get a random question from the cache
  const randomIndex = Math.floor(Math.random() * existingQuestions.length);
  const question = existingQuestions[randomIndex];
  
  // Remove the question from cache to avoid repetition
  existingQuestions.splice(randomIndex, 1);
  questionCache.set(key, existingQuestions);
  
  return question;
}

/**
 * Get a batch of cached questions
 * @param {Object} options - Question generation options
 * @returns {Array|null} Array of cached questions or null if not enough found
 */
function getCachedQuestionBatch(options) {
  const { count = 5 } = options;
  const key = generateCacheKey(options);
  
  // Get existing questions for this key
  const existingQuestions = questionCache.get(key);
  
  if (!existingQuestions || existingQuestions.length < count) {
    return null;
  }
  
  // Get a random subset of questions
  const selectedQuestions = [];
  const questionsCopy = [...existingQuestions];
  
  for (let i = 0; i < count; i++) {
    if (questionsCopy.length === 0) break;
    
    const randomIndex = Math.floor(Math.random() * questionsCopy.length);
    selectedQuestions.push(questionsCopy[randomIndex]);
    questionsCopy.splice(randomIndex, 1);
  }
  
  // Update the cache with remaining questions
  questionCache.set(key, questionsCopy);
  
  return selectedQuestions;
}

/**
 * Clear all cached questions
 */
function clearCache() {
  questionCache.flushAll();
}

/**
 * Save a generated question to the database
 * @param {Object} questionData - Formatted question data
 * @returns {Promise<Object>} Saved question
 */
async function saveQuestionToDatabase(questionData) {
  try {
    const question = new Question(questionData);
    await question.save();
    return question;
  } catch (error) {
    console.error('Error saving question to database:', error);
    throw new Error(`Failed to save question to database: ${error.message}`);
  }
}

module.exports = {
  generateQuestion,
  generateMultipleQuestions,
  generateQuestionsForPlayer,
  generateSpecialistQuestions,
  saveQuestionToDatabase,
  clearCache
};
