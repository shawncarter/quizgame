const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('./db');
const { Category } = require('../models');
const categoryData = require('./seedData/categories');

// Load environment variables
dotenv.config();

// Seed the database
const seedDatabase = async () => {
  try {
    // Connect to database
    await connectDB();
    
    console.log('Seeding database...');
    
    // Clear existing categories
    await Category.deleteMany({});
    console.log('Cleared existing categories');
    
    // First pass - create all categories without parent relationships
    const createdCategories = {};
    const secondPassUpdates = [];
    
    for (const category of categoryData) {
      const { parentCategory, ...categoryData } = category;
      
      const newCategory = await Category.create(categoryData);
      createdCategories[category.name] = newCategory._id;
      
      if (parentCategory) {
        secondPassUpdates.push({
          categoryId: newCategory._id,
          parentName: parentCategory
        });
      }
    }
    
    // Second pass - update parent relationships
    for (const update of secondPassUpdates) {
      if (createdCategories[update.parentName]) {
        await Category.findByIdAndUpdate(update.categoryId, {
          parentCategory: createdCategories[update.parentName]
        });
      } else {
        console.warn(`Parent category "${update.parentName}" not found`);
      }
    }
    
    console.log(`Database seeded with ${Object.keys(createdCategories).length} categories`);
    
    // Disconnect from the database
    await mongoose.disconnect();
    console.log('Database connection closed');
    
    process.exit(0);
  } catch (error) {
    console.error(`Error seeding database: ${error.message}`);
    process.exit(1);
  }
};

// Run the seed function
seedDatabase();
