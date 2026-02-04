import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

let db: Database;

const SCHEMA = `
-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  phone_number TEXT UNIQUE NOT NULL,
  name TEXT,
  status TEXT DEFAULT 'disconnected',
  proxy_host TEXT,
  proxy_port INTEGER,
  proxy_username TEXT,
  proxy_password TEXT,
  session_path TEXT,
  qr_code TEXT,
  pairing_code TEXT,
  last_seen DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  min_delay INTEGER DEFAULT 30,
  max_delay INTEGER DEFAULT 60,
  max_messages_per_day INTEGER DEFAULT 100,
  start_hour INTEGER DEFAULT 9,
  end_hour INTEGER DEFAULT 18,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME
);

-- Campaign accounts (which accounts participate)
CREATE TABLE IF NOT EXISTS campaign_accounts (
  campaign_id TEXT,
  account_id TEXT,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, account_id)
);

-- Campaign contacts
CREATE TABLE IF NOT EXISTS campaign_contacts (
  id TEXT PRIMARY KEY,
  campaign_id TEXT,
  phone_number TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  sent_by_account_id TEXT,
  sent_at DATETIME,
  error TEXT,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (sent_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  phone_number TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Contact tags
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  color TEXT,
  is_system BOOLEAN DEFAULT 0
);

CREATE TABLE IF NOT EXISTS contact_tags (
  contact_id TEXT,
  tag_id TEXT,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, tag_id)
);

-- Messages/Inbox
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  account_id TEXT,
  chat_id TEXT NOT NULL,
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  sender_name TEXT,
  message_text TEXT,
  message_type TEXT DEFAULT 'text',
  is_from_me BOOLEAN DEFAULT 0,
  is_handled BOOLEAN DEFAULT 0,
  timestamp DATETIME NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- Warm-up sessions
CREATE TABLE IF NOT EXISTS warmup_sessions (
  id TEXT PRIMARY KEY,
  status TEXT DEFAULT 'active',
  min_delay INTEGER DEFAULT 300,
  max_delay INTEGER DEFAULT 900,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  stopped_at DATETIME
);

CREATE TABLE IF NOT EXISTS warmup_accounts (
  session_id TEXT,
  account_id TEXT,
  FOREIGN KEY (session_id) REFERENCES warmup_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, account_id)
);

-- Stats table for dashboard
CREATE TABLE IF NOT EXISTS stats (
  date DATE PRIMARY KEY,
  messages_sent INTEGER DEFAULT 0,
  accounts_active INTEGER DEFAULT 0
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_account_id ON messages(account_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign_id ON campaign_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_status ON campaign_contacts(status);
CREATE INDEX IF NOT EXISTS idx_contact_tags_contact_id ON contact_tags(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_tags_tag_id ON contact_tags(tag_id);
`;

export async function initDatabase() {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'leadsender.db');

  // Ensure the directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('encoding = "UTF-8"'); // Ensure UTF-8 encoding for Hebrew/Arabic support

  // Run schema
  db.exec(SCHEMA);

  // Add new columns if they don't exist (for media support)
  try {
    db.exec(`ALTER TABLE messages ADD COLUMN media_filename TEXT;`);
  } catch (e) {
    // Column already exists
  }
  
  try {
    db.exec(`ALTER TABLE messages ADD COLUMN media_mimetype TEXT;`);
  } catch (e) {
    // Column already exists
  }

  // Add warmup flag column
  try {
    db.exec(`ALTER TABLE messages ADD COLUMN is_warmup BOOLEAN DEFAULT 0;`);
  } catch (e) {
    // Column already exists
  }

  // Add profile picture URL column
  try {
    db.exec(`ALTER TABLE accounts ADD COLUMN profile_picture_url TEXT;`);
  } catch (e) {
    // Column already exists
  }

  // Add proxy type column
  try {
    db.exec(`ALTER TABLE accounts ADD COLUMN proxy_type TEXT DEFAULT 'http';`);
  } catch (e) {
    // Column already exists
  }
  
  // Update existing accounts to use http instead of socks5
  try {
    db.exec(`UPDATE accounts SET proxy_type = 'http' WHERE proxy_type = 'socks5' OR proxy_type IS NULL;`);
  } catch (e) {
    // Ignore
  }

  // Add is_system column to tags
  try {
    db.exec(`ALTER TABLE tags ADD COLUMN is_system BOOLEAN DEFAULT 0;`);
  } catch (e) {
    // Column already exists
  }

  // Add media support to campaigns
  try {
    db.exec(`ALTER TABLE campaigns ADD COLUMN media_path TEXT;`);
  } catch (e) {
    // Column already exists
  }
  
  try {
    db.exec(`ALTER TABLE campaigns ADD COLUMN media_type TEXT;`);
  } catch (e) {
    // Column already exists
  }
  
  try {
    db.exec(`ALTER TABLE campaigns ADD COLUMN media_caption TEXT;`);
  } catch (e) {
    // Column already exists
  }

  // Add scheduled start datetime for campaign scheduling
  try {
    db.exec(`ALTER TABLE campaigns ADD COLUMN scheduled_start_datetime DATETIME;`);
  } catch (e) {
    // Column already exists
  }

  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // One-time migration: Clear all messages
  try {
    const migrationId = 'clear_messages_2026_01_29';
    const checkMigration = db.prepare(`SELECT id FROM migrations WHERE id = ?`);
    const migrationExists = checkMigration.get(migrationId);
    
    if (!migrationExists) {
      console.log('🔄 Running one-time migration: clearing all messages...');
      db.exec(`DELETE FROM messages;`);
      
      // Mark migration as applied
      const markMigration = db.prepare(`INSERT INTO migrations (id) VALUES (?)`);
      markMigration.run(migrationId);
      
      console.log('✅ Migration completed: all messages cleared');
    }
  } catch (e) {
    console.log('ℹ️ Migration already applied or error:', e);
  }

  // One-time migration: Remove assigned_account_id if it exists
  try {
    const migrationId = 'remove_assigned_account_id_2026_01_29';
    const checkMigration = db.prepare(`SELECT id FROM migrations WHERE id = ?`);
    const migrationExists = checkMigration.get(migrationId);
    
    if (!migrationExists) {
      // Check if column exists
      const checkStmt = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='campaign_contacts'`);
      const tableInfo = checkStmt.get() as any;
      
      if (tableInfo?.sql?.includes('assigned_account_id')) {
        console.log('🔄 Running one-time migration: removing assigned_account_id column...');
        
        // SQLite doesn't support DROP COLUMN, so we need to recreate the table
        db.exec(`
          -- Create new table without assigned_account_id
          CREATE TABLE campaign_contacts_new (
            id TEXT PRIMARY KEY,
            campaign_id TEXT,
            phone_number TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            sent_by_account_id TEXT,
            sent_at DATETIME,
            error TEXT,
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
            FOREIGN KEY (sent_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL
          );
          
          -- Copy data (excluding assigned_account_id)
          INSERT INTO campaign_contacts_new (id, campaign_id, phone_number, status, sent_by_account_id, sent_at, error)
          SELECT id, campaign_id, phone_number, status, sent_by_account_id, sent_at, error
          FROM campaign_contacts;
          
          -- Drop old table
          DROP TABLE campaign_contacts;
          
          -- Rename new table
          ALTER TABLE campaign_contacts_new RENAME TO campaign_contacts;
          
          -- Recreate indexes
          CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign_id ON campaign_contacts(campaign_id);
          CREATE INDEX IF NOT EXISTS idx_campaign_contacts_status ON campaign_contacts(status);
        `);
        
        console.log('✅ Migration completed: assigned_account_id removed');
      }
      
      // Mark migration as applied
      const markMigration = db.prepare(`INSERT INTO migrations (id) VALUES (?)`);
      markMigration.run(migrationId);
    }
  } catch (e) {
    console.log('ℹ️ Migration already applied or not needed');
  }

  // Create activities table for Recent Activity
  db.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      related_id TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp DESC);
  `);

  // Create system BlackList tag if it doesn't exist
  try {
    const checkBlacklistStmt = db.prepare(`SELECT id FROM tags WHERE name = 'BlackList'`);
    const blacklistExists = checkBlacklistStmt.get();
    
    if (!blacklistExists) {
      console.log('🏷️ Creating system BlackList tag...');
      const createBlacklistStmt = db.prepare(`
        INSERT INTO tags (id, name, color, is_system)
        VALUES (?, 'BlackList', '#000000', 1)
      `);
      const { v4: uuidv4 } = require('uuid');
      createBlacklistStmt.run(uuidv4());
      console.log('✅ BlackList tag created');
    } else {
      // Make sure existing BlackList is marked as system
      console.log('🏷️ Ensuring BlackList is marked as system tag...');
      const updateStmt = db.prepare(`UPDATE tags SET is_system = 1 WHERE name = 'BlackList'`);
      updateStmt.run();
    }
  } catch (e) {
    console.log('ℹ️ BlackList tag setup:', e);
  }

  console.log('Database initialized at:', dbPath);
}

export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

export { Database };
