module.exports = (sequelize, DataTypes) => {
  const Question = sequelize.define('Question', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    type: {
      type: DataTypes.ENUM('multipleChoice', 'trueFalse', 'shortAnswer'),
      defaultValue: 'multipleChoice'
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    difficulty: {
      type: DataTypes.ENUM('easy', 'medium', 'hard'),
      defaultValue: 'medium'
    },
    options: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    correctAnswer: {
      type: DataTypes.STRING,
      allowNull: true
    },
    explanation: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    timeLimit: {
      type: DataTypes.INTEGER,
      defaultValue: 30
    },
    pointValue: {
      type: DataTypes.INTEGER,
      defaultValue: 100
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    forPlayerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Players',
        key: 'id'
      }
    },
    imageUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    createdBy: {
      type: DataTypes.ENUM('anthropic', 'admin', 'import'),
      defaultValue: 'anthropic'
    },
    answerStats: {
      type: DataTypes.JSONB,
      defaultValue: {
        timesAsked: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        averageResponseTime: 0
      }
    },
    ratings: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    averageRating: {
      type: DataTypes.FLOAT,
      defaultValue: 0
    },
    reports: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    flagged: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    timestamps: true,
    indexes: [
      {
        fields: ['category']
      },
      {
        fields: ['difficulty']
      },
      {
        fields: ['forPlayerId']
      }
    ]
  });

  // Set up associations
  Question.associate = function(models) {
    Question.belongsTo(models.Player, {
      foreignKey: 'forPlayerId',
      as: 'targetPlayer'
    });
  };

  // Instance methods
  Question.prototype.updateStats = function(correct, responseTime) {
    const stats = this.answerStats;
    stats.timesAsked += 1;

    if (correct) {
      stats.correctAnswers += 1;
    } else {
      stats.incorrectAnswers += 1;
    }

    // Update average response time using a weighted average
    const totalAnswers = stats.correctAnswers + stats.incorrectAnswers;
    const oldWeight = (totalAnswers - 1) / totalAnswers;
    const newWeight = 1 / totalAnswers;

    stats.averageResponseTime =
      (stats.averageResponseTime * oldWeight) + (responseTime * newWeight);

    this.changed('answerStats', true);
    return this.save();
  };

  Question.prototype.isCorrectAnswer = function(answer) {
    if (this.type === 'multipleChoice') {
      const correctOption = this.options.find(option => option.isCorrect);
      return correctOption && (correctOption.text === answer || correctOption.id === answer);
    } else if (this.type === 'trueFalse') {
      return this.correctAnswer.toLowerCase() === answer.toLowerCase();
    } else if (this.type === 'shortAnswer') {
      // For short answer, do a case-insensitive comparison
      return this.correctAnswer.toLowerCase() === answer.toLowerCase();
    }
    return false;
  };

  // Static methods
  Question.findByCategory = function(category, limit = 10) {
    return Question.findAll({
      where: { category },
      limit
    });
  };

  Question.findByDifficulty = function(difficulty, limit = 10) {
    return Question.findAll({
      where: { difficulty },
      limit
    });
  };

  Question.findForSpecialistRound = function(playerId, limit = 5) {
    return Question.findAll({
      where: { forPlayerId: playerId },
      limit
    });
  };

  Question.getRandomQuestions = async function(category, difficulty, limit = 10) {
    const query = {};
    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;

    return Question.findAll({
      where: query,
      order: sequelize.literal('random()'),
      limit
    });
  };

  return Question;
};
