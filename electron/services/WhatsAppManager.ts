import { Client, LocalAuth, Events, MessageMedia } from 'whatsapp-web.js';
import { app, BrowserWindow } from 'electron';
import type { Database } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import proxyChain from 'proxy-chain';
import type { ProxyConfig } from '../../src/types';

// Find Chrome executable path
function findChromePath(): string | undefined {
  const possiblePaths = [
    // Windows paths
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
    // Edge as fallback (Chromium-based)
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];

  for (const chromePath of possiblePaths) {
    if (chromePath && fs.existsSync(chromePath)) {
      console.log('✅ Found Chrome at:', chromePath);
      return chromePath;
    }
  }
  
  console.warn('⚠️ Chrome not found in standard locations');
  return undefined;
}

// Get bundled Chromium path from puppeteer cache
async function getOrDownloadChromium(): Promise<string> {
  // First try to find installed Chrome/Edge
  const installedChrome = findChromePath();
  if (installedChrome) {
    return installedChrome;
  }

  // Try to use puppeteer's built-in browser
  try {
    const puppeteer = await import('puppeteer');
    const execPath = puppeteer.executablePath();
    if (execPath && fs.existsSync(execPath)) {
      console.log('✅ Using Puppeteer bundled Chromium:', execPath);
      return execPath;
    }
  } catch (e) {
    console.log('Puppeteer bundled browser not available');
  }

  // Download Chromium to app data folder
  const userDataPath = app.getPath('userData');
  const chromiumPath = path.join(userDataPath, 'chromium');
  const chromiumExe = path.join(chromiumPath, 'chrome-win', 'chrome.exe');

  if (fs.existsSync(chromiumExe)) {
    console.log('✅ Using cached Chromium:', chromiumExe);
    return chromiumExe;
  }

  console.log('📥 Downloading Chromium... This may take a few minutes on first run.');
  
  // Use puppeteer's browser fetcher
  try {
    const puppeteer = await import('puppeteer');
    // @ts-ignore - BrowserFetcher exists
    const browserFetcher = (puppeteer as any).createBrowserFetcher({
      path: chromiumPath,
      platform: 'win64'
    });
    
    // Get latest stable revision
    const revisionInfo = await browserFetcher.download('1350406'); // Chrome 131 stable
    console.log('✅ Chromium downloaded to:', revisionInfo.executablePath);
    return revisionInfo.executablePath;
  } catch (downloadError) {
    console.error('Failed to download Chromium:', downloadError);
    throw new Error('Chrome/Edge not found and failed to download Chromium. Please install Google Chrome or Microsoft Edge.');
  }
}

export class WhatsAppManager {
  private db: Database;
  private clients: Map<string, Client> = new Map();
  private sessionsPaths: Map<string, string> = new Map();
  private readyAccounts: Set<string> = new Set(); // Track which accounts are fully ready
  private anonymizedProxyServers: Map<string, proxyChain.Server> = new Map(); // accountId -> proxy server

  constructor(db: Database) {
    this.db = db;
    this.loadExistingSessions();
  }

  private async loadExistingSessions() {
    const stmt = this.db.prepare("SELECT * FROM accounts WHERE status = 'connected' OR session_path IS NOT NULL");
    const accounts = stmt.all() as any[];

    for (const account of accounts) {
      try {
        const proxy = account.proxy_host ? {
          host: account.proxy_host,
          port: account.proxy_port,
          username: account.proxy_username,
          password: account.proxy_password,
          type: 'http' as 'http' | 'socks5' // Always HTTP
        } : undefined;

        await this.connectAccount(account.id, proxy);
      } catch (error) {
        console.error(`Failed to reconnect account ${account.id}:`, error);
      }
    }
  }

  async connectAccount(accountId: string, proxy?: ProxyConfig, pairingMethod: 'qr' | 'code' = 'qr'): Promise<void> {
    console.log('🔵 connectAccount called for:', accountId, 'method:', pairingMethod);
    
    if (this.clients.has(accountId)) {
      console.log('⚠️ Account already connected');
      return;
    }

    const userDataPath = app.getPath('userData');
    const sessionPath = path.join(userDataPath, 'sessions', accountId);
    console.log('📁 Session path:', sessionPath);

    this.sessionsPaths.set(accountId, sessionPath);

    // Get phone number from database for pairing code method
    let phoneNumber: string | undefined;
    if (pairingMethod === 'code') {
      const stmt = this.db.prepare('SELECT phone_number FROM accounts WHERE id = ?');
      const account = stmt.get(accountId) as any;
      phoneNumber = account?.phone_number?.replace(/\D/g, ''); // Remove all non-digits
      console.log('📞 Phone number for pairing:', phoneNumber);
    }

    // Find Chrome executable (or download Chromium)
    console.log('🔍 Looking for Chrome/Chromium...');
    const chromePath = await getOrDownloadChromium();
    console.log('✅ Using browser:', chromePath);

    // Create client with LocalAuth
    const clientOptions: any = {
      authStrategy: new LocalAuth({
        clientId: accountId,
        dataPath: path.join(userDataPath, 'sessions')
      }),
      // Use a stable cached version of WhatsApp Web to avoid compatibility issues
      webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
      },
      // Session restore options - important for reconnection after restart
      restartOnAuthFail: true,
      takeoverOnConflict: true,
      takeoverTimeoutMs: 60000,
      puppeteer: {
        headless: true,
        executablePath: chromePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      }
    };

    // Add pairing code option if requested
    if (pairingMethod === 'code' && phoneNumber) {
      clientOptions.pairWithPhoneNumber = {
        phoneNumber: phoneNumber,
        showNotification: true,
        intervalMs: 180000 // 3 minutes
      };
      console.log('📞 Pairing code mode enabled for:', phoneNumber);
    }

    // Add proxy if provided - use proxy-chain for authentication
    if (proxy) {
      console.log('🌐 Setting up HTTP proxy...');
      
      if (proxy.username && proxy.password) {
        // HTTP proxy with authentication - use proxy-chain to create anonymous local proxy
        console.log('🔐 Setting up authenticated HTTP proxy via proxy-chain...');
        
        try {
          const upstreamProxyUrl = `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
          console.log(`📡 Upstream proxy: http://${proxy.username}@${proxy.host}:${proxy.port}`);
          
          // Create anonymous local proxy that forwards to authenticated upstream
          const anonymizedProxyUrl = await proxyChain.anonymizeProxy(upstreamProxyUrl);
          console.log(`✅ Anonymous local proxy created: ${anonymizedProxyUrl}`);
          
          // Store the server reference for cleanup later
          // Extract port from anonymizedProxyUrl (format: http://127.0.0.1:XXXXX)
          const match = anonymizedProxyUrl.match(/:(\d+)$/);
          if (match) {
            const localPort = parseInt(match[1]);
            const server = (proxyChain as any).servers?.get(localPort);
            if (server) {
              this.anonymizedProxyServers.set(accountId, server);
            }
          }
          
          // Use the anonymous proxy
          clientOptions.puppeteer.args.push(`--proxy-server=${anonymizedProxyUrl}`);
          console.log(`✅ Proxy configured with authentication support`);
        } catch (proxyError) {
          console.error('❌ Failed to set up proxy-chain:', proxyError);
          throw new Error('Failed to configure proxy. Please check your proxy credentials.');
        }
      } else {
        // HTTP proxy without authentication
        clientOptions.puppeteer.args.push(`--proxy-server=http://${proxy.host}:${proxy.port}`);
        console.log(`✅ HTTP Proxy configured (no auth): http://${proxy.host}:${proxy.port}`);
      }
    }

    console.log('🔌 Creating WhatsApp client...');
    const client = new Client(clientOptions);

    this.clients.set(accountId, client);

    // QR Code event
    client.on('qr', async (qr) => {
      console.log('📱 QR code received, generating data URL...');
      const qrDataURL = await QRCode.toDataURL(qr);
      console.log('✅ QR code generated');
      
      this.updateAccountStatus(accountId, 'qr', qrDataURL);
      
      // Send QR to renderer
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        console.log('📤 Sending QR to renderer...');
        mainWindow.webContents.send('account:qr', accountId, qrDataURL);
        console.log('✅ QR sent to renderer');
      }
    });

    // Pairing Code event (when using pairing code method)
    client.on('code', (code: string) => {
      console.log('🔢 Pairing code received from WhatsApp:', code);
      
      // Update database with pairing code
      const stmt = this.db.prepare('UPDATE accounts SET pairing_code = ?, status = ? WHERE id = ?');
      stmt.run(code, 'pairing', accountId);
      
      // Send pairing code to renderer
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        console.log('📤 Sending pairing code to renderer:', code);
        mainWindow.webContents.send('account:pairing', accountId, code);
        console.log('✅ Pairing code sent to renderer');
      }
    });

    // Ready event
    client.on('ready', async () => {
      console.log('🟢 WhatsApp client is ready!');
      
      // Disable sendSeen at both client and page level
      (client as any).sendSeen = async () => {};
      
      // Also disable in Puppeteer page
      const page = (client as any).pupPage;
      if (page) {
        await page.evaluate(() => {
          (window as any).WWebJS.sendSeen = async () => {};
        });
        console.log('✅ sendSeen disabled at page level');
      }
      
      this.updateAccountStatus(accountId, 'connected');
      
      // Get phone number
      const info = (client as any).info;
      if (info?.wid?._serialized) {
        const phoneNumber = info.wid._serialized.split('@')[0];
        console.log('📞 Phone number:', phoneNumber);
        const stmt = this.db.prepare('UPDATE accounts SET phone_number = ? WHERE id = ?');
        stmt.run(phoneNumber, accountId);
      }
      
      // Get profile picture (some accounts might not have one)
      try {
        // Wait a bit for profile to load
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const info = (client as any).info;
        const myWid = info?.wid?._serialized;
        
        if (myWid) {
          try {
            console.log('📷 Getting profile picture for WID:', myWid);
            const contact = await client.getContactById(myWid);
            const profilePicUrl = await contact.getProfilePicUrl();
            
            if (profilePicUrl && typeof profilePicUrl === 'string') {
              console.log('✅ Profile picture URL:', profilePicUrl.substring(0, 50) + '...');
              const picStmt = this.db.prepare('UPDATE accounts SET profile_picture_url = ? WHERE id = ?');
              picStmt.run(profilePicUrl, accountId);
            } else {
              console.log('📷 No profile picture set for this account');
            }
          } catch (contactError) {
            console.log('📷 Could not get profile picture via contact method');
          }
        }
      } catch (picError) {
        console.log('📷 Profile picture fetch failed (this is normal if no picture is set)');
      }
      
      // Wait a bit for WhatsApp Web to fully load before allowing messages
      console.log('⏳ Waiting for WhatsApp Web to fully initialize...');
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      this.readyAccounts.add(accountId); // Mark as fully ready
      console.log('✅ WhatsApp Web fully ready for messaging');
    });

    // Authentication events
    client.on('authenticated', async () => {
      console.log('✅ Authenticated');
      
      // CRITICAL: Disable sendSeen immediately to avoid markedUnread error
      // This prevents the error even if ready event doesn't fire
      (client as any).sendSeen = async () => {};
      console.log('✅ sendSeen disabled on client');
      
      // Wait a bit for page to be available, then disable sendSeen at page level
      setTimeout(async () => {
        try {
          const page = (client as any).pupPage;
          if (page) {
            await page.evaluate(() => {
              if ((window as any).WWebJS) {
                (window as any).WWebJS.sendSeen = async () => {};
              }
            });
            console.log('✅ sendSeen disabled at page level');
          }
        } catch (e) {
          console.log('⚠️ Could not disable sendSeen at page level (yet)');
        }
      }, 5000);
      
      // Fallback: If ready event doesn't fire within 30 seconds after authentication,
      // try to manually verify and mark as ready
      setTimeout(async () => {
        if (!this.readyAccounts.has(accountId)) {
          console.log('⚠️ Ready event not fired after 30s, attempting manual verification...');
          try {
            const state = await client.getState();
            if (state === 'CONNECTED') {
              // CRITICAL: Disable sendSeen to avoid markedUnread error
              (client as any).sendSeen = async () => {};
              console.log('✅ sendSeen disabled (fallback)');
              
              // Also disable in Puppeteer page
              const page = (client as any).pupPage;
              if (page) {
                try {
                  await page.evaluate(() => {
                    (window as any).WWebJS.sendSeen = async () => {};
                  });
                  console.log('✅ sendSeen disabled at page level (fallback)');
                } catch (e) {
                  console.log('⚠️ Could not disable sendSeen at page level');
                }
              }
              
              // Try to get chats to verify WWebJS is loaded
              const chats = await client.getChats();
              if (chats && chats.length >= 0) {
                console.log(`✅ Manual verification passed for ${accountId} (${chats.length} chats)`);
                this.updateAccountStatus(accountId, 'connected');
                this.readyAccounts.add(accountId);
                console.log('✅ Account marked as ready (fallback)');
              }
            }
          } catch (error: any) {
            console.log(`⚠️ Manual verification failed for ${accountId}: ${error.message}`);
          }
        }
      }, 30000);
    });

    client.on('auth_failure', (msg) => {
      console.error('❌ Authentication failure:', msg);
      this.updateAccountStatus(accountId, 'disconnected');
    });

    // Disconnected event
    client.on('disconnected', (reason) => {
      console.log('🔴 Disconnected:', reason);
      this.updateAccountStatus(accountId, 'disconnected');
      this.clients.delete(accountId);
      this.readyAccounts.delete(accountId); // Remove from ready set
    });

    // Message events - use message_create which fires for all messages including when ready event doesn't fire
    client.on('message_create', async (message) => {
      // Skip outgoing messages (we already save them when sending)
      if (message.fromMe) {
        console.log('📤 Outgoing message detected (skipping, already saved)');
        return;
      }
      
      console.log('\n📨 ==================== NEW MESSAGE ====================');
      console.log('Message from:', message.from);
      console.log('Message body:', message.body?.substring(0, 50));
      console.log('======================================================\n');
      
      await this.handleIncomingMessage(accountId, message);
    });
    
    // Also listen to 'message' event as backup
    client.on('message', async (message) => {
      console.log('📩 message event fired (backup):', message.from);
      // Don't process here - message_create handles it
    });

    // Loading event
    client.on('loading_screen', (percent) => {
      console.log('⏳ Loading:', percent + '%');
    });

    console.log('✅ Event listeners registered');
    console.log('⏳ Initializing client...');

    try {
      await client.initialize();
      console.log('✅ Client initialized');
    } catch (error) {
      console.error('❌ Error initializing client:', error);
      this.clients.delete(accountId);
      
      // Cleanup proxy-chain server on error
      const proxyServer = this.anonymizedProxyServers.get(accountId);
      if (proxyServer) {
        try {
          await proxyServer.close(true);
          this.anonymizedProxyServers.delete(accountId);
          console.log('🧹 Closed proxy-chain server');
        } catch (e) {
          console.log('ℹ️ Could not cleanup proxy server:', e);
        }
      }
      
      throw error;
    }
  }

  async disconnectAccount(accountId: string): Promise<void> {
    const client = this.clients.get(accountId);
    
    if (client) {
      await client.destroy();
      this.clients.delete(accountId);
    }

    // Cleanup proxy-chain server if exists
    const proxyServer = this.anonymizedProxyServers.get(accountId);
    if (proxyServer) {
      try {
        await proxyServer.close(true);
        this.anonymizedProxyServers.delete(accountId);
        console.log('🧹 Closed proxy-chain server for account:', accountId);
      } catch (e) {
        console.log('ℹ️ Could not cleanup proxy server:', e);
      }
    }

    this.readyAccounts.delete(accountId); // Remove from ready set
    this.updateAccountStatus(accountId, 'disconnected');
  }

  async sendMessage(accountId: string, to: string, message: string, isWarmup: boolean = false): Promise<void> {
    const client = this.clients.get(accountId);
    
    if (!client) {
      throw new Error('Account not connected');
    }

    // Check if client is truly ready
    const state = await client.getState();
    if (state !== 'CONNECTED') {
      throw new Error(`Account not ready. Current state: ${state}`);
    }

    console.log('📤 Sending message to:', to);
    
    let chatIdToSend = to;
    let originalChatId = to; // For saving to DB
    
    // ALWAYS format to @c.us for sending (NEVER use @lid for sending!)
    if (!to.includes('@')) {
      // Case 1: Plain phone number (e.g., "972501234567")
      const cleanNumber = to.replace(/\D/g, '');
      
      // Ensure it has country code
      if (!cleanNumber.startsWith('972') && !cleanNumber.startsWith('1') && !cleanNumber.startsWith('44')) {
        throw new Error('Phone number must include country code (e.g., 972501234567)');
      }
      
      // Add @c.us suffix for sending
      chatIdToSend = `${cleanNumber}@c.us`;
      originalChatId = to; // Keep original for DB
      console.log('📤 Formatted to @c.us:', chatIdToSend);
    } else if (to.includes('@lid')) {
      // Case 2: @lid chat (from inbox) - convert to @c.us for sending
      console.log('⚠️ Received @lid, converting to @c.us...');
      originalChatId = to; // Keep @lid for DB (to group messages)
      
      // Get the actual phone number from database
      const messagesStmt = this.db.prepare(`
        SELECT from_number FROM messages 
        WHERE chat_id = ? AND account_id = ? AND from_number LIKE '972%'
        LIMIT 1
      `);
      const msgData = messagesStmt.get(to, accountId) as any;
      if (msgData?.from_number) {
        chatIdToSend = `${msgData.from_number}@c.us`;
        console.log('✅ Converted @lid to @c.us:', chatIdToSend);
      } else {
        // Fallback: extract number from @lid and add @c.us
        const phoneFromLid = to.split('@')[0];
        chatIdToSend = `${phoneFromLid}@c.us`;
        console.log('⚠️ Fallback conversion:', chatIdToSend);
      }
    } else {
      // Case 3: Already has @c.us or other format
      console.log('✅ Using chat ID as-is:', chatIdToSend);
    }

    // Send message with error handling and retry logic
    const maxRetries = 5;
    let lastError: any = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📨 Getting chat for: ${chatIdToSend} (attempt ${attempt}/${maxRetries})`);
        const chat = await client.getChatById(chatIdToSend);
        console.log('✅ Chat found, sending...');
        await chat.sendMessage(message);
        console.log('✅ Message sent successfully');
        lastError = null;
        break; // Success, exit retry loop
      } catch (error: any) {
        lastError = error;
        const errorMsg = error.message?.toLowerCase() || '';
        console.log(`❌ Send attempt ${attempt} failed: ${error.message}`);
        
        // Check if account is banned or restricted - don't retry
        if (errorMsg.includes('banned') || errorMsg.includes('restricted') || errorMsg.includes('blocked')) {
          console.error('❌ Account appears to be banned/restricted');
          this.updateAccountStatus(accountId, 'disconnected');
          throw new Error('Account has been banned or restricted by WhatsApp');
        }
        
        // Retry on any error (WhatsApp Web might not be fully loaded)
        if (attempt < maxRetries) {
          const waitTime = attempt * 5000; // 5s, 10s, 15s, 20s
          console.log(`⚠️ Retrying in ${waitTime/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        console.error('⚠️ Failed after all retries');
        throw new Error('WhatsApp Web is not ready. Please wait a moment and try again.');
      }
    }
    
    if (lastError) {
      throw lastError;
    }

    // Save message to database using ORIGINAL chat_id (to group with incoming messages)
    const messageId = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO messages (id, account_id, chat_id, from_number, to_number, sender_name, message_text, is_from_me, is_warmup, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);
    
    const myNumber = (client as any).info?.wid?._serialized?.split('@')[0] || '';
    const myName = (client as any).info?.pushname || null;
    
    // Use originalChatId (defined earlier) for DB, but chatIdToSend (@c.us) for actual sending
    const toNumber = chatIdToSend.split('@')[0];
    
    console.log('💾 Saving with chat_id:', originalChatId, 'sent to:', chatIdToSend, isWarmup ? '(WarmUp)' : '');
    stmt.run(messageId, accountId, originalChatId, myNumber, toNumber, myName, message, isWarmup ? 1 : 0, new Date().toISOString());
    console.log('✅ Message saved to database');
  }

  async sendMedia(accountId: string, to: string, filePath: string, caption?: string): Promise<void> {
    const client = this.clients.get(accountId);
    
    if (!client) {
      throw new Error('Account not connected');
    }

    // Check if client is truly ready
    const state = await client.getState();
    if (state !== 'CONNECTED') {
      throw new Error(`Account not ready. Current state: ${state}`);
    }

    console.log('📤 Sending media to:', to);
    
    let chatIdToSend = to;
    let originalChatId = to; // For saving to DB
    
    // ALWAYS format to @c.us for sending (NEVER use @lid for sending!)
    if (!to.includes('@')) {
      // Case 1: Plain phone number (e.g., "972501234567")
      const cleanNumber = to.replace(/\D/g, '');
      
      // Ensure it has country code
      if (!cleanNumber.startsWith('972') && !cleanNumber.startsWith('1') && !cleanNumber.startsWith('44')) {
        throw new Error('Phone number must include country code (e.g., 972501234567)');
      }
      
      // Add @c.us suffix for sending
      chatIdToSend = `${cleanNumber}@c.us`;
      originalChatId = to; // Keep original for DB
      console.log('📤 Formatted to @c.us:', chatIdToSend);
    } else if (to.includes('@lid')) {
      // Case 2: @lid chat (from inbox) - convert to @c.us for sending
      console.log('⚠️ Received @lid, converting to @c.us...');
      originalChatId = to; // Keep @lid for DB (to group messages)
      
      // Get the actual phone number from database
      const messagesStmt = this.db.prepare(`
        SELECT from_number FROM messages 
        WHERE chat_id = ? AND account_id = ? AND from_number LIKE '972%'
        LIMIT 1
      `);
      const msgData = messagesStmt.get(to, accountId) as any;
      if (msgData?.from_number) {
        chatIdToSend = `${msgData.from_number}@c.us`;
        console.log('✅ Converted @lid to @c.us:', chatIdToSend);
      } else {
        // Fallback: extract number from @lid and add @c.us
        const phoneFromLid = to.split('@')[0];
        chatIdToSend = `${phoneFromLid}@c.us`;
        console.log('⚠️ Fallback conversion:', chatIdToSend);
      }
    } else {
      // Case 3: Already has @c.us or other format
      console.log('✅ Using chat ID as-is:', chatIdToSend);
    }

    // Send media with error handling and retry logic
    const maxRetries = 5;
    let lastError: any = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📨 Getting chat for: ${chatIdToSend} (attempt ${attempt}/${maxRetries})`);
        const chat = await client.getChatById(chatIdToSend);
        console.log('✅ Chat found, sending media...');
        
        const media = MessageMedia.fromFilePath(filePath);
        await chat.sendMessage(media, { caption: caption || '' });
        console.log('✅ Media sent successfully');
        lastError = null;
        break; // Success, exit retry loop
      } catch (error: any) {
        lastError = error;
        const errorMsg = error.message?.toLowerCase() || '';
        console.log(`❌ Send media attempt ${attempt} failed: ${error.message}`);
        
        // Check if account is banned or restricted - don't retry
        if (errorMsg.includes('banned') || errorMsg.includes('restricted') || errorMsg.includes('blocked')) {
          console.error('❌ Account appears to be banned/restricted');
          this.updateAccountStatus(accountId, 'disconnected');
          throw new Error('Account has been banned or restricted by WhatsApp');
        }
        
        // Retry on any error
        if (attempt < maxRetries) {
          const waitTime = attempt * 5000; // 5s, 10s, 15s, 20s
          console.log(`⚠️ Retrying in ${waitTime/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        console.error('⚠️ Failed after all retries');
        throw new Error('WhatsApp Web is not ready. Please wait a moment and try again.');
      }
    }
    
    if (lastError) {
      throw lastError;
    }

    // Extract file information
    const pathModule = await import('path');
    const filename = pathModule.basename(filePath);
    const mediaInfo = MessageMedia.fromFilePath(filePath);
    const mimetype = mediaInfo.mimetype || 'application/octet-stream';
    const messageType = mimetype.startsWith('image/') ? 'image' : 'document';
    
    // Save message to database
    const messageId = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO messages (id, account_id, chat_id, from_number, to_number, sender_name, message_text, message_type, media_filename, media_mimetype, is_from_me, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);
    
    const myNumber = (client as any).info?.wid?._serialized?.split('@')[0] || '';
    const myName = (client as any).info?.pushname || null;
    
    // Use originalChatId (defined earlier) for DB, but chatIdToSend (@c.us) for actual sending
    const toNumber = chatIdToSend.split('@')[0];
    
    console.log('💾 Saving media with chat_id:', originalChatId, 'sent to:', chatIdToSend);
    stmt.run(messageId, accountId, originalChatId, myNumber, toNumber, myName, caption || null, messageType, filename, mimetype, new Date().toISOString());
    console.log('✅ Media saved to database');
  }

  async getQRCode(accountId: string): Promise<string> {
    const stmt = this.db.prepare('SELECT qr_code FROM accounts WHERE id = ?');
    const result = stmt.get(accountId) as any;
    return result?.qr_code || '';
  }

  async updateWhatsAppName(accountId: string, name: string): Promise<void> {
    const client = this.clients.get(accountId);
    
    if (!client) {
      throw new Error('Account not connected');
    }

    console.log('📝 Updating WhatsApp name to:', name);
    await client.setDisplayName(name);
    console.log('✅ Name updated successfully');
  }

  async sendMediaFromPath(accountId: string, to: string, filePath: string, caption?: string, isWarmup: boolean = false): Promise<void> {
    // Simply call sendMedia - it already handles everything we need
    await this.sendMedia(accountId, to, filePath, caption);
    // Note: sendMedia doesn't save to DB, which is fine for campaigns
    // The campaign scheduler tracks sends in campaign_contacts table instead
  }

  async refreshProfilePicture(accountId: string): Promise<void> {
    const client = this.clients.get(accountId);
    
    if (!client) {
      throw new Error('Account not connected');
    }

    try {
      console.log('🔄 Refreshing profile picture for account:', accountId);
      
      // Method 1: Try getting own profile picture through contact
      try {
        const info = (client as any).info;
        const myWid = info?.wid?._serialized;
        
        if (myWid) {
          console.log('📞 Getting profile picture for WID:', myWid);
          
          // Get contact object
          const contact = await client.getContactById(myWid);
          const profilePicUrl = await contact.getProfilePicUrl();
          
          if (profilePicUrl && typeof profilePicUrl === 'string') {
            const stmt = this.db.prepare('UPDATE accounts SET profile_picture_url = ? WHERE id = ?');
            stmt.run(profilePicUrl, accountId);
            console.log('✅ Profile picture refreshed:', profilePicUrl.substring(0, 60) + '...');
            return;
          }
        }
      } catch (methodError) {
        console.log('⚠️ Method 1 failed, trying Method 2...', methodError.message);
      }
      
      // Method 2: Try direct client method
      const myWid = (client as any).info?.wid?._serialized;
      const profilePicUrl = myWid ? await client.getProfilePicUrl(myWid) : null;
      
      if (profilePicUrl && typeof profilePicUrl === 'string') {
        const stmt = this.db.prepare('UPDATE accounts SET profile_picture_url = ? WHERE id = ?');
        stmt.run(profilePicUrl, accountId);
        console.log('✅ Profile picture refreshed (Method 2)');
      } else {
        console.log('📷 No profile picture available');
        const stmt = this.db.prepare('UPDATE accounts SET profile_picture_url = NULL WHERE id = ?');
        stmt.run(accountId);
      }
      
    } catch (error: any) {
      console.log('📷 No profile picture for this account:', error.message);
      
      // נקה מה-DB
      const stmt = this.db.prepare('UPDATE accounts SET profile_picture_url = NULL WHERE id = ?');
      stmt.run(accountId);
    }
  }

  async updateWhatsAppProfilePicture(accountId: string, imagePath: string): Promise<void> {
    const client = this.clients.get(accountId);
    
    if (!client) {
      throw new Error('Account not connected');
    }

    console.log('📷 Updating WhatsApp profile picture:', imagePath);
    const media = MessageMedia.fromFilePath(imagePath);
    await client.setProfilePicture(media);
    console.log('✅ Profile picture updated successfully');
    
    // Get the new profile picture URL and save to database
    try {
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for WhatsApp to update
      const myWid = (client as any).info?.wid?._serialized;
      const profilePicUrl = myWid ? await client.getProfilePicUrl(myWid) : null;
      
      if (profilePicUrl && typeof profilePicUrl === 'string') {
        const stmt = this.db.prepare('UPDATE accounts SET profile_picture_url = ? WHERE id = ?');
        stmt.run(profilePicUrl, accountId);
        console.log('✅ Profile picture URL saved to database');
      }
    } catch (error) {
      console.log('📷 Could not get updated profile picture URL (might not be set)');
    }
  }

  getConnection(accountId: string): Client | undefined {
    return this.clients.get(accountId);
  }

  isConnected(accountId: string): boolean {
    const client = this.clients.get(accountId);
    const hasClient = client && (client as any).pupPage != null;
    const isFullyReady = this.readyAccounts.has(accountId);
    return hasClient && isFullyReady;
  }

  private updateAccountStatus(accountId: string, status: string, qrCode?: string) {
    const updates = ['status = ?', 'last_seen = ?'];
    const values = [status, new Date().toISOString()];

    if (qrCode !== undefined) {
      updates.push('qr_code = ?');
      values.push(qrCode);
    }

    values.push(accountId);
    const stmt = this.db.prepare(`UPDATE accounts SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    // Notify renderer
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      mainWindow.webContents.send('account:status', accountId, status);
    }
  }

  private async handleIncomingMessage(accountId: string, msg: any) {
    try {
      console.log('💾 Processing message for database...');

      const messageId = msg.id.id || uuidv4();
      const chatId = msg.from; // Keep full chat ID (with @c.us or @lid)
      
      // Get sender name - prefer notifyName (always available)
      let senderName = msg._data?.notifyName || msg._data?.pushname || null;
      console.log('✅ Sender name from notifyName:', senderName);
      
      // Try to get the real phone number from contact
      let fromNumber = msg.from.split('@')[0];
      
      try {
        const contact = await msg.getContact();
        if (contact.number) {
          fromNumber = contact.number;
          console.log('✅ Got real phone number from contact:', fromNumber);
        }
        // Don't override senderName - keep notifyName
      } catch (e) {
        console.log('⚠️ Could not get contact details, using message data');
      }
      
      const myNumber = (this.clients.get(accountId) as any)?.info?.wid?._serialized?.split('@')[0] || '';
      
      // Check if message has media
      let messageType = 'text';
      let mediaFilename: string | null = null;
      let mediaMimetype: string | null = null;
      
      if (msg.hasMedia) {
        console.log('📎 Message has media');
        try {
          const media = await msg.downloadMedia();
          if (media) {
            mediaMimetype = media.mimetype;
            messageType = media.mimetype.startsWith('image/') ? 'image' : 'document';
            mediaFilename = media.filename || `file_${Date.now()}`;
            console.log('✅ Media downloaded:', messageType, mediaFilename);
          }
        } catch (e) {
          console.log('⚠️ Could not download media:', e);
        }
      }
      
      console.log('Database values:');
      console.log('  - messageId:', messageId);
      console.log('  - accountId:', accountId);
      console.log('  - chatId:', chatId);
      console.log('  - fromNumber:', fromNumber);
      console.log('  - senderName:', senderName);
      console.log('  - myNumber:', myNumber);
      console.log('  - messageType:', messageType);
      console.log('  - is_from_me:', msg.fromMe ? 1 : 0);
      
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO messages (id, account_id, chat_id, from_number, to_number, sender_name, message_text, message_type, media_filename, media_mimetype, is_from_me, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        messageId,
        accountId,
        chatId,
        fromNumber,
        myNumber,
        senderName,
        msg.body || null,
        messageType,
        mediaFilename,
        mediaMimetype,
        msg.fromMe ? 1 : 0,
        new Date(msg.timestamp * 1000).toISOString()
      );

      console.log('✅ Message saved to database successfully');

      // Notify renderer of new message
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow && !msg.fromMe) {
        console.log('📤 Sending message to renderer...');
        mainWindow.webContents.send('message:new', {
          id: messageId,
          account_id: accountId,
          chat_id: chatId,
          from_number: fromNumber,
          to_number: myNumber,
          message_text: msg.body,
          is_from_me: false,
          timestamp: new Date().toISOString()
        });
        console.log('✅ Message sent to renderer');
      }
    } catch (error) {
      console.error('❌ Error handling incoming message:', error);
    }
  }
}
