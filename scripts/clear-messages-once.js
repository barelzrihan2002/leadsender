/**
 * ONE-TIME Script to clear all messages from database
 * 
 * This script will delete all messages from the database.
 * Run this manually only once using:
 * node scripts/clear-messages-once.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Get database path
const userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'leadsender');
const dbPath = path.join(userDataPath, 'leadsender.db');

console.log('🗑️  Connecting to database:', dbPath);

try {
  const db = new Database(dbPath);
  
  // Count messages before deletion
  const countBefore = db.prepare('SELECT COUNT(*) as count FROM messages').get();
  console.log(`📊 Found ${countBefore.count} messages in database`);
  
  if (countBefore.count === 0) {
    console.log('✅ No messages to delete');
    db.close();
    process.exit(0);
  }
  
  // Ask for confirmation
  console.log('\n⚠️  WARNING: This will delete ALL messages from the database!');
  console.log('Press Ctrl+C to cancel or wait 5 seconds to continue...\n');
  
  setTimeout(() => {
    // Delete all messages
    const result = db.prepare('DELETE FROM messages').run();
    console.log(`✅ Deleted ${result.changes} messages successfully`);
    
    // Verify deletion
    const countAfter = db.prepare('SELECT COUNT(*) as count FROM messages').get();
    console.log(`📊 Messages remaining: ${countAfter.count}`);
    
    db.close();
    console.log('\n✨ Database cleanup completed!');
    process.exit(0);
  }, 5000);
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
