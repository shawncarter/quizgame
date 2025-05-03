/**
 * Category Routes
 * Handles all category related endpoints
 */
const express = require('express');
const router = express.Router();
const { authenticate, authorizeGameMaster } = require('../middleware/auth');

// Public routes - Get all categories
router.get('/', async (req, res) => {
  try {
    // TODO: Implement fetching all categories
    res.json({ message: 'Get all categories - to be implemented' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get category by ID
router.get('/:id', async (req, res) => {
  try {
    // TODO: Implement fetching a category by ID
    res.json({ message: `Get category with ID: ${req.params.id} - to be implemented` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Protected routes - require authentication
router.use(authenticate);

// Create a new category (Game Master only)
router.post('/', authorizeGameMaster, async (req, res) => {
  try {
    // TODO: Implement category creation
    res.status(201).json({ message: 'Create new category - to be implemented' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update a category (Game Master only)
router.put('/:id', authorizeGameMaster, async (req, res) => {
  try {
    // TODO: Implement category update
    res.json({ message: `Update category with ID: ${req.params.id} - to be implemented` });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete a category (Game Master only)
router.delete('/:id', authorizeGameMaster, async (req, res) => {
  try {
    // TODO: Implement category deletion
    res.json({ message: `Delete category with ID: ${req.params.id} - to be implemented` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get questions for a specific category
router.get('/:id/questions', async (req, res) => {
  try {
    // TODO: Implement fetching questions by category
    res.json({ message: `Get questions for category ID: ${req.params.id} - to be implemented` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
