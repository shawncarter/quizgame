const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CategorySchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  iconName: {
    type: String,
    default: 'question-mark'
    // Name of the icon to display for this category
  },
  color: {
    type: String,
    default: '#3498db'
    // Hex color code for the category
  },
  isActive: {
    type: Boolean,
    default: true
    // Whether this category is available for new games
  },
  parentCategory: {
    type: Schema.Types.ObjectId,
    ref: 'Category'
    // For subcategories (e.g., "Classical Music" under "Music")
  },
  difficulty: {
    type: Number, 
    default: 2,
    min: 1,
    max: 5
    // Difficulty rating from 1-5, useful for game balancing
  },
  questionCount: {
    type: Number,
    default: 0
    // Number of questions in this category (updated via hooks)
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

// Method to get all subcategories
CategorySchema.methods.getSubcategories = function() {
  return this.model('Category').find({ parentCategory: this._id });
};

// Static method to get root categories (those without a parent)
CategorySchema.statics.getRootCategories = function() {
  return this.find({ parentCategory: { $exists: false } });
};

// Static method to get category hierarchy
CategorySchema.statics.getCategoryHierarchy = async function() {
  const rootCategories = await this.find({ parentCategory: { $exists: false } })
    .sort({ name: 1 });
  
  const result = [];
  
  for (const rootCategory of rootCategories) {
    const subcategories = await this.find({ parentCategory: rootCategory._id })
      .sort({ name: 1 });
    
    result.push({
      ...rootCategory.toObject(),
      subcategories: subcategories
    });
  }
  
  return result;
};

// Static method to get popular categories
CategorySchema.statics.getPopularCategories = function(limit = 10) {
  return this.find({ isActive: true })
    .sort({ questionCount: -1 })
    .limit(limit);
};

// Create a text index for searching
CategorySchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Category', CategorySchema);
