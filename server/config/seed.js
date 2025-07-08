const dotenv = require('dotenv');
const connectDB = require('./db');
const db = require('../models');
const categoryData = require('./seedData/categories');

// Load environment variables
dotenv.config();

// Seed the database
const seedDatabase = async () => {
  try {
    // Connect to database
    const connection = await connectDB();

    // Skip seeding if using mock database
    if (connection.mock) {
      console.log('Using mock database - skipping database seeding');
      process.exit(0);
      return;
    }

    console.log('Seeding database...');

    // Clear existing categories
    await db.Category.destroy({ where: {}, truncate: true, cascade: true });
    console.log('Cleared existing categories');

    // First pass - create all categories without parent relationships
    const createdCategories = {};
    const secondPassUpdates = [];

    for (const category of categoryData) {
      const { parentCategory, ...categoryData } = category;

      const newCategory = await db.Category.create(categoryData);
      createdCategories[category.name] = newCategory.id;

      if (parentCategory) {
        secondPassUpdates.push({
          categoryId: newCategory.id,
          parentName: parentCategory
        });
      }
    }

    // Second pass - update parent relationships
    for (const update of secondPassUpdates) {
      if (createdCategories[update.parentName]) {
        await db.Category.update(
          { parentCategoryId: createdCategories[update.parentName] },
          { where: { id: update.categoryId } }
        );
      } else {
        console.warn(`Parent category "${update.parentName}" not found`);
      }
    }

    console.log(`Database seeded with ${Object.keys(createdCategories).length} categories`);
    console.log('Database seeding completed');

    process.exit(0);
  } catch (error) {
    console.error(`Error seeding database: ${error.message}`);
    process.exit(1);
  }
};

// Run the seed function
seedDatabase();
