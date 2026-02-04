// Account types
export interface Account {
  id: string;
  phone_number: string;
  name?: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'qr' | 'pairing';
  proxy_host?: string;
  proxy_port?: number;
  proxy_username?: string;
  proxy_password?: string;
  proxy_type?: 'http' | 'socks5';
  session_path?: string;
  qr_code?: string;
  pairing_code?: string;
  profile_picture_url?: string;
  last_seen?: string;
  created_at: string;
}

export interface ProxyConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  type?: 'http' | 'socks5'; // Only HTTP is supported for authentication
}

// Campaign types
export interface Campaign {
  id: string;
  name: string;
  message: string;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'stopped';
  min_delay: number;
  max_delay: number;
  max_messages_per_day: number;
  start_hour: number;
  end_hour: number;
  media_path?: string;
  media_type?: 'image' | 'video' | 'document';
  media_caption?: string;
  scheduled_start_datetime?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface CampaignContact {
  id: string;
  campaign_id: string;
  phone_number: string;
  status: 'pending' | 'sent' | 'failed';
  sent_by_account_id?: string;
  sent_at?: string;
  error?: string;
}

export interface CampaignStats {
  total: number;
  sent: number;
  pending: number;
  failed: number;
}

// Contact types
export interface Contact {
  id: string;
  phone_number: string;
  name?: string;
  created_at: string;
  tags?: Tag[];
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
  is_system?: boolean;
}

// Message types
export interface Message {
  id: string;
  account_id: string;
  chat_id: string;
  from_number: string;
  to_number: string;
  sender_name?: string;
  contact_name?: string;
  contact_number?: string;
  message_text?: string;
  message_type: string;
  media_filename?: string;
  media_mimetype?: string;
  is_from_me: boolean;
  is_handled: boolean;
  is_warmup?: boolean;
  timestamp: string;
}

export interface Chat {
  chat_id: string;
  account_id: string;
  last_message?: Message;
  unread_count: number;
  is_handled: boolean;
}

// Warm-up types
export interface WarmUpSession {
  id: string;
  status: 'active' | 'stopped';
  min_delay: number;
  max_delay: number;
  started_at: string;
  stopped_at?: string;
  accounts: string[];
  messages_sent_today?: number;
}

// Stats types
export interface DashboardStats {
  accounts_connected: number;
  messages_sent_today: number;
  active_campaigns: number;
  pending_messages: number;
}

export interface Activity {
  id: string;
  type: 'success' | 'error' | 'pending' | 'message' | 'account' | 'campaign';
  message: string;
  related_id?: string;
  timestamp: string;
}

// License types
export interface LicenseInfo {
  isValid: boolean;
  isActivated: boolean;
  expiresAt?: string;
  daysLeft?: number;
  licenseKey?: string;
  email?: string;
  status?: 'active' | 'expired' | 'suspended' | 'grace_period';
  error?: string;
}

// IPC Types
export interface ElectronAPI {
  // License operations
  license: {
    check: () => Promise<LicenseInfo>;
    activate: (licenseKey: string) => Promise<{ success: boolean; error?: string; info?: LicenseInfo }>;
    deactivate: () => Promise<{ success: boolean; error?: string }>;
    getUser: () => Promise<{ email?: string; name?: string }>;
  };

  // Account operations
  accounts: {
    getAll: () => Promise<Account[]>;
    getById: (id: string) => Promise<Account | null>;
    create: (data: Partial<Account>) => Promise<Account>;
    update: (id: string, data: Partial<Account>) => Promise<void>;
    delete: (id: string) => Promise<void>;
    connect: (id: string, proxy?: ProxyConfig, pairingMethod?: 'qr' | 'code') => Promise<void>;
    disconnect: (id: string) => Promise<void>;
    getQRCode: (id: string) => Promise<string>;
    updateWhatsAppName: (id: string, name: string) => Promise<void>;
    updateWhatsAppImage: (id: string, imagePath: string) => Promise<void>;
    refreshProfilePicture: (id: string) => Promise<void>;
  };

  // Campaign operations
  campaigns: {
    getAll: () => Promise<Campaign[]>;
    getById: (id: string) => Promise<Campaign | null>;
    create: (data: Partial<Campaign>) => Promise<Campaign>;
    update: (id: string, data: Partial<Campaign>) => Promise<void>;
    delete: (id: string) => Promise<void>;
    start: (id: string) => Promise<void>;
    pause: (id: string) => Promise<void>;
    stop: (id: string) => Promise<void>;
    reset: (id: string) => Promise<void>;
    getStats: (id: string) => Promise<CampaignStats>;
    addContacts: (id: string, contacts: { phone_number: string }[]) => Promise<void>;
    getContacts: (id: string) => Promise<CampaignContact[]>;
    addAccounts: (campaignId: string, accountIds: string[]) => Promise<void>;
    getAccounts: (campaignId: string) => Promise<string[]>;
    saveMedia: (fileName: string, buffer: Buffer) => Promise<string>;
  };

  // Contact operations
  contacts: {
    getAll: () => Promise<Contact[]>;
    getById: (id: string) => Promise<Contact | null>;
    create: (data: Partial<Contact>) => Promise<Contact>;
    update: (id: string, data: Partial<Contact>) => Promise<void>;
    delete: (id: string) => Promise<void>;
    selectFile: () => Promise<string | null>;
    checkDuplicates: (filePath: string, country: string) => Promise<{ duplicateCount: number; totalCount: number; duplicates: string[] }>;
    previewFile: (filePath: string, country: string) => Promise<{ preview: any[]; totalCount: number }>;
    importFromFile: (filePath: string, country?: string, duplicateAction?: 'update' | 'skip') => Promise<number>;
    addTag: (contactId: string, tagId: string) => Promise<void>;
    removeTag: (contactId: string, tagId: string) => Promise<void>;
  };

  // Tag operations
  tags: {
    getAll: () => Promise<Tag[]>;
    create: (data: Partial<Tag>) => Promise<Tag>;
    update: (id: string, data: Partial<Tag>) => Promise<void>;
    delete: (id: string) => Promise<void>;
  };

  // Message operations
  messages: {
    getByChat: (chatId: string, accountId: string) => Promise<Message[]>;
    getChats: (accountId?: string) => Promise<Chat[]>;
    send: (accountId: string, to: string, message: string) => Promise<void>;
    sendMedia: (accountId: string, to: string, filePath: string, caption?: string) => Promise<void>;
    saveTempFile: (fileName: string, buffer: Buffer) => Promise<string>;
    deleteTempFile: (filePath: string) => Promise<void>;
    markAsHandled: (chatId: string, accountId: string) => Promise<void>;
  };

  // Warm-up operations
  warmup: {
    start: (accountIds: string[], minDelay: number, maxDelay: number) => Promise<string>;
    stop: (sessionId: string) => Promise<void>;
    getActive: () => Promise<WarmUpSession | null>;
  };

  // Dashboard stats
  stats: {
    getDashboard: () => Promise<DashboardStats>;
    getRecentActivities: (limit?: number) => Promise<Activity[]>;
  };

  // Auto-updater
  updater: {
    checkForUpdates: () => Promise<any>;
    downloadUpdate: () => Promise<any>;
    installUpdate: () => void;
    getVersion: () => Promise<string>;
  };

  // Event listeners
  on: (channel: string, callback: (...args: any[]) => void) => void;
  removeListener: (channel: string, callback: (...args: any[]) => void) => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
