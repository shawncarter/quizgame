const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const QuestionSchema = new Schema({
  text: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['multipleChoice', 'trueFalse', 'shortAnswer'],
    default: 'multipleChoice'
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  options: [{
    text: {
      type: String,
      required: true,
      trim: true
    },
    isCorrect: {
      type: Boolean,
      required: true
    }
  }],
  correctAnswer: {
    type: String,
    trim: true
    // This field will be used for short answer questions
    // For multiple choice, the correct answer is marked in the options array
  },
  explanation: {
    type: String,
    trim: true
  },
  timeLimit: {
    type: Number,
    default: 30  // Time in seconds
  },
  pointValue: {
    type: Number,
    default: 100
  },
  tags: [{
    type: String,
    trim: true
  }],
  forPlayerId: {
    type: Schema.Types.ObjectId,
    ref: 'Player'
    // Only set for specialist round questions targeted at specific players
  },
  imageUrl: {
    type: String
    // Optional URL to an image related to the question
  },
  createdBy: {
    type: String,
    enum: ['anthropic', 'admin', 'import'],
    default: 'anthropic'
  },
  answerStats: {
    timesAsked: {
      type: Number,
      default: 0
    },
    correctAnswers: {
      type: Number,
      default: 0
    },
    incorrectAnswers: {
      type: Number,
      default: 0
    },
    averageResponseTime: {
      type: Number,
      default: 0  // in milliseconds
    }
  },
  // Add ratings field for user ratings
  ratings: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'Player',
      required: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  // Add average rating field
  averageRating: {
    type: Number,
    default: 0
  },
  // Add reports field for user reports
  reports: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'Player',
      required: true
    },
    reason: {
      type: String,
      required: true,
      trim: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'dismissed'],
      default: 'pending'
    }
  }],
  // Add flagged field to mark questions with multiple reports
  flagged: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the question stats after it's been answered
QuestionSchema.methods.updateStats = function(correct, responseTime) {
  this.answerStats.timesAsked += 1;
  
  if (correct) {
    this.answerStats.correctAnswers += 1;
  } else {
    this.answerStats.incorrectAnswers += 1;
  }
  
  // Update average response time using a weighted average
  const totalAnswers = this.answerStats.correctAnswers + this.answerStats.incorrectAnswers;
  const oldWeight = (totalAnswers - 1) / totalAnswers;
  const newWeight = 1 / totalAnswers;
  
  this.answerStats.averageResponseTime = 
    (this.answerStats.averageResponseTime * oldWeight) + (responseTime * newWeight);
  
  this.updatedAt = new Date();
  return this.save();
};

// Check if an answer is correct
QuestionSchema.methods.isCorrectAnswer = function(answer) {
  if (this.type === 'multipleChoice') {
    const correctOption = this.options.find(option => option.isCorrect);
    return correctOption && (correctOption.text === answer || correctOption._id.toString() === answer);
  } else if (this.type === 'trueFalse') {
    return this.correctAnswer.toLowerCase() === answer.toLowerCase();
  } else if (this.type === 'shortAnswer') {
    // For short answer, do a case-insensitive comparison
    // In a real app, this might use more sophisticated matching
    return this.correctAnswer.toLowerCase() === answer.toLowerCase();
  }
  return false;
};

// Static methods for finding questions
QuestionSchema.statics.findByCategory = function(category, limit = 10) {
  return this.find({ category }).limit(limit);
};

QuestionSchema.statics.findByDifficulty = function(difficulty, limit = 10) {
  return this.find({ difficulty }).limit(limit);
};

QuestionSchema.statics.findForSpecialistRound = function(playerId, limit = 5) {
  return this.find({ forPlayerId: playerId }).limit(limit);
};

QuestionSchema.statics.getRandomQuestions = function(category, difficulty, limit = 10) {
  const query = {};
  if (category) query.category = category;
  if (difficulty) query.difficulty = difficulty;
  
  return this.aggregate([
    { $match: query },
    { $sample: { size: limit } }
  ]);
};

module.exports = mongoose.model('Question', QuestionSchema);
