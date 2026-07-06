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
  color TEXT
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
