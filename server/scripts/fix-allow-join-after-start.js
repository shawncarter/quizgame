#!/usr/bin/env node

/**
 * Migration script to fix allowJoinAfterStart setting for existing games
 * This script updates all existing game sessions to allow joining after start
 */

const { GameSession } = require('../models');

async function fixAllowJoinAfterStart() {
  try {
    console.log('Starting migration to fix allowJoinAfterStart setting...');

    // Find all game sessions where allowJoinAfterStart is false
    const gameSessions = await GameSession.findAll({
      where: {
        '$settings.allowJoinAfterStart$': false
      }
    });

    console.log(`Found ${gameSessions.length} game sessions with allowJoinAfterStart set to false`);

    if (gameSessions.length === 0) {
      console.log('No game sessions need updating.');
      return;
    }

    // Update each game session
    let updatedCount = 0;
    for (const gameSession of gameSessions) {
      try {
        // Update the settings
        const updatedSettings = {
          ...gameSession.settings,
          allowJoinAfterStart: true
        };

        await gameSession.update({
          settings: updatedSettings
        });

        updatedCount++;
        console.log(`Updated game session ${gameSession.id} (${gameSession.code})`);
      } catch (error) {
        console.error(`Failed to update game session ${gameSession.id}:`, error.message);
      }
    }

    console.log(`Successfully updated ${updatedCount} out of ${gameSessions.length} game sessions`);
    console.log('Migration completed!');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  fixAllowJoinAfterStart()
    .then(() => {
      console.log('Migration script finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixAllowJoinAfterStart };
