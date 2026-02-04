import { ipcMain, app } from 'electron';
import { getDatabase } from './database/index';
import { v4 as uuidv4 } from 'uuid';
import type { Account, Campaign, Contact, Tag, Message } from '../src/types';
import { WhatsAppManager } from './services/WhatsAppManager';
import { CampaignScheduler } from './services/CampaignScheduler';
import { WarmUpService } from './services/WarmUpService';
import { InboxManager } from './services/InboxManager';
import { LicenseManager } from './services/LicenseManager';
import { ScheduledCampaignChecker } from './services/ScheduledCampaignChecker';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

let whatsappManager: WhatsAppManager;
let campaignScheduler: CampaignScheduler;
let warmUpService: WarmUpService;
let inboxManager: InboxManager;
let licenseManager: LicenseManager;
let scheduledCampaignChecker: ScheduledCampaignChecker;

// Helper function to log activity
function logActivity(db: any, type: string, message: string, relatedId?: string) {
  try {
    const stmt = db.prepare(`
      INSERT INTO activities (id, type, message, related_id, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(uuidv4(), type, message, relatedId || null, new Date().toISOString());
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

let servicesInitialized = false;

async function initializeServices() {
  if (servicesInitialized) return;
  
  const db = getDatabase();
  
  console.log('🚀 Initializing WhatsApp and Campaign services...');
  whatsappManager = new WhatsAppManager(db);
  campaignScheduler = new CampaignScheduler(db, whatsappManager);
  warmUpService = new WarmUpService(db, whatsappManager);
  inboxManager = new InboxManager(db, whatsappManager);
  
  // Initialize and start scheduled campaign checker (runs every hour)
  scheduledCampaignChecker = new ScheduledCampaignChecker(db, campaignScheduler);
  scheduledCampaignChecker.start();
  
  servicesInitialized = true;
  console.log('✅ All services initialized');
}

export function setupIPCHandlers() {
  const db = getDatabase();

  // Initialize only license manager (lightweight)
  licenseManager = new LicenseManager();
  licenseManager.initialize().catch(err => {
    console.error('Failed to initialize license manager:', err);
  });
  
  // Services will be initialized only after valid license

  // ==================== LICENSE HANDLERS ====================
  ipcMain.handle('license:check', async () => {
    const licenseInfo = await licenseManager.checkLicense();
    
    // אם הרישיון תקף ו-services עדיין לא אותחלו - אתחל אותם
    if (licenseInfo.isValid && !servicesInitialized) {
      console.log('✅ Valid license detected - initializing services...');
      await initializeServices();
    }
    
    return licenseInfo;
  });

  ipcMain.handle('license:activate', async (_event, licenseKey: string) => {
    const result = await licenseManager.activateLicense(licenseKey);
    
    // אם האקטיבציה הצליחה - אתחל services
    if (result.success && !servicesInitialized) {
      console.log('✅ License activated - initializing services...');
      await initializeServices();
    }
    
    return result;
  });

  ipcMain.handle('license:deactivate', async () => {
    return await licenseManager.deactivateLicense();
  });

  ipcMain.handle('license:getUser', () => {
    return licenseManager.getLicenseUser();
  });

  // ==================== ACCOUNT HANDLERS ====================
  ipcMain.handle('accounts:getAll', async () => {
    const stmt = db.prepare('SELECT * FROM accounts ORDER BY created_at DESC');
    return stmt.all();
  });

  ipcMain.handle('accounts:getById', async (_event, id: string) => {
    const stmt = db.prepare('SELECT * FROM accounts WHERE id = ?');
    return stmt.get(id);
  });

  ipcMain.handle('accounts:create', async (_event, data: Partial<Account>) => {
    const id = uuidv4();
    
    if (!data.phone_number) {
      throw new Error('Phone number is required');
    }
    
    const stmt = db.prepare(`
      INSERT INTO accounts (id, phone_number, name, proxy_host, proxy_port, proxy_username, proxy_password, proxy_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      data.phone_number,
      data.name || null,
      data.proxy_host || null,
      data.proxy_port || null,
      data.proxy_username || null,
      data.proxy_password || null,
      'http' // Always HTTP - SOCKS5 not supported
    );

    logActivity(db, 'account', `Account ${data.name || data.phone_number} added`, id);

    const getStmt = db.prepare('SELECT * FROM accounts WHERE id = ?');
    return getStmt.get(id);
  });

  ipcMain.handle('accounts:update', async (_event, id: string, data: Partial<Account>) => {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.proxy_host !== undefined) {
      updates.push('proxy_host = ?');
      values.push(data.proxy_host);
    }
    if (data.proxy_port !== undefined) {
      updates.push('proxy_port = ?');
      values.push(data.proxy_port);
    }
    if (data.proxy_username !== undefined) {
      updates.push('proxy_username = ?');
      values.push(data.proxy_username);
    }
    if (data.proxy_password !== undefined) {
      updates.push('proxy_password = ?');
      values.push(data.proxy_password);
    }

    if (updates.length > 0) {
      values.push(id);
      const stmt = db.prepare(`UPDATE accounts SET ${updates.join(', ')} WHERE id = ?`);
      stmt.run(...values);
    }
  });

  ipcMain.handle('accounts:delete', async (_event, id: string) => {
    const accountStmt = db.prepare('SELECT name, phone_number FROM accounts WHERE id = ?');
    const account = accountStmt.get(id) as any;
    
    await whatsappManager.disconnectAccount(id);
    const stmt = db.prepare('DELETE FROM accounts WHERE id = ?');
    stmt.run(id);
    
    logActivity(db, 'account', `Account ${account?.name || account?.phone_number || 'Unknown'} deleted`, id);
  });

  ipcMain.handle('accounts:connect', async (_event, id: string, proxy?: any, pairingMethod: 'qr' | 'code' = 'qr') => {
    const accountStmt = db.prepare('SELECT name, phone_number FROM accounts WHERE id = ?');
    const account = accountStmt.get(id) as any;
    
    await whatsappManager.connectAccount(id, proxy, pairingMethod);
    
    logActivity(db, 'account', `Account ${account?.name || account?.phone_number || 'Unknown'} connecting via ${pairingMethod === 'qr' ? 'QR Code' : 'Pairing Code'}`, id);
  });

  ipcMain.handle('accounts:disconnect', async (_event, id: string) => {
    await whatsappManager.disconnectAccount(id);
  });

  ipcMain.handle('accounts:getQRCode', async (_event, id: string) => {
    return await whatsappManager.getQRCode(id);
  });

  ipcMain.handle('accounts:updateWhatsAppName', async (_event, id: string, name: string) => {
    await whatsappManager.updateWhatsAppName(id, name);
  });

  ipcMain.handle('accounts:updateWhatsAppImage', async (_event, id: string, imagePath: string) => {
    await whatsappManager.updateWhatsAppProfilePicture(id, imagePath);
  });

  ipcMain.handle('accounts:refreshProfilePicture', async (_event, id: string) => {
    await whatsappManager.refreshProfilePicture(id);
  });

  // ==================== CAMPAIGN HANDLERS ====================
  ipcMain.handle('campaigns:getAll', async () => {
    const stmt = db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC');
    return stmt.all();
  });

  ipcMain.handle('campaigns:getById', async (_event, id: string) => {
    const stmt = db.prepare('SELECT * FROM campaigns WHERE id = ?');
    return stmt.get(id);
  });

  ipcMain.handle('campaigns:create', async (_event, data: Partial<Campaign> & { media_path?: string, media_type?: string, media_caption?: string, scheduled_start_datetime?: string }) => {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO campaigns (id, name, message, min_delay, max_delay, max_messages_per_day, start_hour, end_hour, media_path, media_type, media_caption, scheduled_start_datetime)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      data.name,
      data.message,
      data.min_delay || 30,
      data.max_delay || 60,
      data.max_messages_per_day || 100,
      data.start_hour || 9,
      data.end_hour || 18,
      data.media_path || null,
      data.media_type || null,
      data.media_caption || null,
      data.scheduled_start_datetime || null
    );

    const getStmt = db.prepare('SELECT * FROM campaigns WHERE id = ?');
    return getStmt.get(id);
  });

  // Save campaign media file
  ipcMain.handle('campaigns:save-media', async (_event, fileName: string, buffer: Uint8Array) => {
    try {
      // Create media directory in userData
      const userDataPath = app.getPath('userData');
      const mediaDir = path.join(userDataPath, 'campaign-media');
      
      if (!fs.existsSync(mediaDir)) {
        fs.mkdirSync(mediaDir, { recursive: true });
      }
      
      // Generate unique filename
      const ext = path.extname(fileName);
      const uniqueFileName = `${uuidv4()}${ext}`;
      const filePath = path.join(mediaDir, uniqueFileName);
      
      // Save file
      fs.writeFileSync(filePath, Buffer.from(buffer));
      console.log('✅ Campaign media saved to:', filePath);
      
      return filePath;
    } catch (error) {
      console.error('Failed to save campaign media:', error);
      throw error;
    }
  });

  ipcMain.handle('campaigns:update', async (_event, id: string, data: Partial<Campaign>) => {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.message !== undefined) {
      updates.push('message = ?');
      values.push(data.message);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }

    if (updates.length > 0) {
      values.push(id);
      const stmt = db.prepare(`UPDATE campaigns SET ${updates.join(', ')} WHERE id = ?`);
      stmt.run(...values);
    }
  });

  ipcMain.handle('campaigns:delete', async (_event, id: string) => {
    await campaignScheduler.stopCampaign(id);
    const stmt = db.prepare('DELETE FROM campaigns WHERE id = ?');
    stmt.run(id);
  });

  ipcMain.handle('campaigns:start', async (_event, id: string) => {
    const campaignStmt = db.prepare('SELECT name FROM campaigns WHERE id = ?');
    const campaign = campaignStmt.get(id) as any;
    
    await campaignScheduler.startCampaign(id);
    
    logActivity(db, 'campaign', `Campaign "${campaign?.name || 'Unknown'}" started`, id);
  });

  ipcMain.handle('campaigns:pause', async (_event, id: string) => {
    const campaignStmt = db.prepare('SELECT name FROM campaigns WHERE id = ?');
    const campaign = campaignStmt.get(id) as any;
    
    await campaignScheduler.pauseCampaign(id);
    
    logActivity(db, 'pending', `Campaign "${campaign?.name || 'Unknown'}" paused`, id);
  });

  ipcMain.handle('campaigns:stop', async (_event, id: string) => {
    const campaignStmt = db.prepare('SELECT name FROM campaigns WHERE id = ?');
    const campaign = campaignStmt.get(id) as any;
    
    await campaignScheduler.stopCampaign(id);
    
    logActivity(db, 'error', `Campaign "${campaign?.name || 'Unknown'}" stopped`, id);
  });

  ipcMain.handle('campaigns:reset', async (_event, id: string) => {
    const campaignStmt = db.prepare('SELECT name FROM campaigns WHERE id = ?');
    const campaign = campaignStmt.get(id) as any;
    
    await campaignScheduler.resetCampaign(id);
    
    logActivity(db, 'pending', `Campaign "${campaign?.name || 'Unknown'}" reset`, id);
  });

  ipcMain.handle('campaigns:getStats', async (_event, id: string) => {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM campaign_contacts
      WHERE campaign_id = ?
    `);
    return stmt.get(id);
  });

  ipcMain.handle('campaigns:addContacts', async (_event, id: string, contacts: { phone_number: string }[]) => {
    const stmt = db.prepare(`
      INSERT INTO campaign_contacts (id, campaign_id, phone_number)
      VALUES (?, ?, ?)
    `);

    const insertMany = db.transaction((contactList) => {
      for (const contact of contactList) {
        stmt.run(uuidv4(), id, contact.phone_number);
      }
    });

    insertMany(contacts);
  });

  ipcMain.handle('campaigns:getContacts', async (_event, id: string) => {
    const stmt = db.prepare('SELECT * FROM campaign_contacts WHERE campaign_id = ?');
    return stmt.all(id);
  });

  ipcMain.handle('campaigns:addAccounts', async (_event, campaignId: string, accountIds: string[]) => {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO campaign_accounts (campaign_id, account_id)
      VALUES (?, ?)
    `);

    const insertMany = db.transaction((ids) => {
      for (const accountId of ids) {
        stmt.run(campaignId, accountId);
      }
    });

    insertMany(accountIds);
  });

  ipcMain.handle('campaigns:getAccounts', async (_event, campaignId: string) => {
    const stmt = db.prepare('SELECT account_id FROM campaign_accounts WHERE campaign_id = ?');
    return stmt.all(campaignId).map((row: any) => row.account_id);
  });

  // ==================== CONTACT HANDLERS ====================
  ipcMain.handle('contacts:getAll', async () => {
    const stmt = db.prepare(`
      SELECT c.*, GROUP_CONCAT(t.id || ':' || t.name || ':' || COALESCE(t.color, '')) as tags_data
      FROM contacts c
      LEFT JOIN contact_tags ct ON c.id = ct.contact_id
      LEFT JOIN tags t ON ct.tag_id = t.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    
    const contacts = stmt.all() as any[];
    return contacts.map(contact => ({
      ...contact,
      tags: contact.tags_data ? contact.tags_data.split(',').map((t: string) => {
        const [id, name, color] = t.split(':');
        return { id, name, color: color || undefined };
      }) : []
    }));
  });

  ipcMain.handle('contacts:getById', async (_event, id: string) => {
    const stmt = db.prepare('SELECT * FROM contacts WHERE id = ?');
    return stmt.get(id);
  });

  ipcMain.handle('contacts:create', async (_event, data: Partial<Contact>) => {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO contacts (id, phone_number, name)
      VALUES (?, ?, ?)
    `);
    
    stmt.run(id, data.phone_number, data.name || null);

    const getStmt = db.prepare('SELECT * FROM contacts WHERE id = ?');
    return getStmt.get(id);
  });

  ipcMain.handle('contacts:update', async (_event, id: string, data: Partial<Contact>) => {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.phone_number !== undefined) {
      updates.push('phone_number = ?');
      values.push(data.phone_number);
    }

    if (updates.length > 0) {
      values.push(id);
      const stmt = db.prepare(`UPDATE contacts SET ${updates.join(', ')} WHERE id = ?`);
      stmt.run(...values);
    }
  });

  ipcMain.handle('contacts:delete', async (_event, id: string) => {
    const stmt = db.prepare('DELETE FROM contacts WHERE id = ?');
    stmt.run(id);
  });

  // Preview contacts before import
  ipcMain.handle('contacts:previewFile', async (_event, filePath: string, country: string = 'international') => {
    try {
      let data: any[];
      
      if (filePath.toLowerCase().endsWith('.csv')) {
        // For CSV, read as UTF-8 text
        console.log('📄 Reading CSV for preview...');
        let csvContent = fs.readFileSync(filePath, 'utf8');
        
        // Detect encoding issues
        if (csvContent.includes('�') || /[À-ÿ]{3,}/.test(csvContent)) {
          const buffer = fs.readFileSync(filePath);
          const decoder = new TextDecoder('windows-1255');
          csvContent = decoder.decode(buffer);
          console.log('✅ Decoded preview CSV as Windows-1255');
        }
        
        const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line);
        const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
        
        data = lines.slice(1).map(line => {
          const values: string[] = [];
          let currentValue = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"' || char === "'") {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(currentValue.trim().replace(/^["']|["']$/g, ''));
              currentValue = '';
            } else {
              currentValue += char;
            }
          }
          values.push(currentValue.trim().replace(/^["']|["']$/g, ''));
          
          const row: any = {};
          headers.forEach((header, idx) => {
            row[header] = values[idx] || '';
          });
          return row;
        });
      } else {
        // For Excel
        const fileBuffer = fs.readFileSync(filePath);
        const workbook = XLSX.read(fileBuffer, { 
          type: 'buffer',
          codepage: 65001
        });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet, { 
          raw: false,
          defval: ''
        }) as any[];
      }

      // Phone normalization function
      function normalizePhone(phone: string | number, countryCode: string): string {
        let phoneStr = String(phone);
        if (phoneStr.includes('E+') || phoneStr.includes('e+')) {
          const num = Number(phone);
          phoneStr = String(Math.round(num));
        }
        let cleaned = phoneStr.trim().replace(/[^\d+]/g, '').replace(/^\+/, '');
        
        if (countryCode === 'israel') {
          if (cleaned.startsWith('972') && cleaned.length >= 12) return cleaned;
          if (cleaned.startsWith('05') && cleaned.length === 10) return '9725' + cleaned.substring(2);
          if (cleaned.startsWith('5') && cleaned.length === 9) return '972' + cleaned;
          if (cleaned.startsWith('0') && (cleaned.length === 10 || cleaned.length === 9)) return '972' + cleaned.substring(1);
        } else if (countryCode === 'usa') {
          if (cleaned.startsWith('1') && cleaned.length === 11) return cleaned;
          if (cleaned.length === 10) return '1' + cleaned;
        } else if (countryCode === 'saudi') {
          if (cleaned.startsWith('966') && cleaned.length >= 12) return cleaned;
          if (cleaned.startsWith('05') && cleaned.length === 10) return '9665' + cleaned.substring(2);
          if (cleaned.startsWith('5') && cleaned.length === 9) return '966' + cleaned;
          if (cleaned.startsWith('0') && cleaned.length === 10) return '966' + cleaned.substring(1);
        }
        
        return cleaned;
      }

      // Create preview
      const preview = data.slice(0, 50).map(row => {
        const rawPhone = row.phone_number || row.phone || row.number || row.Phone || row['Phone Number'];
        const name = row.name || row.Name || null;
        
        if (rawPhone) {
          const original = String(rawPhone);
          const normalized = normalizePhone(rawPhone, country);
          
          return {
            original,
            normalized,
            name,
            changed: original !== normalized
          };
        }
        return null;
      }).filter(Boolean);

      return {
        preview,
        totalCount: data.length
      };
    } catch (error) {
      console.error('Failed to preview file:', error);
      throw error;
    }
  });

  ipcMain.handle('contacts:selectFile', async () => {
    const { dialog } = await import('electron');
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Spreadsheets', extensions: ['csv', 'xlsx', 'xls'] }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  // Check for duplicates before import
  ipcMain.handle('contacts:checkDuplicates', async (_event, filePath: string, country: string = 'international') => {
    try {
      let data: any[];
      
      if (filePath.toLowerCase().endsWith('.csv')) {
        let csvContent = fs.readFileSync(filePath, 'utf8');
        
        // Detect encoding issues
        if (csvContent.includes('�') || /[À-ÿ]{3,}/.test(csvContent)) {
          const buffer = fs.readFileSync(filePath);
          const decoder = new TextDecoder('windows-1255');
          csvContent = decoder.decode(buffer);
          console.log('✅ Decoded checkDuplicates CSV as Windows-1255');
        }
        
        const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line);
        const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
        
        data = lines.slice(1).map(line => {
          const values: string[] = [];
          let currentValue = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"' || char === "'") {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(currentValue.trim().replace(/^["']|["']$/g, ''));
              currentValue = '';
            } else {
              currentValue += char;
            }
          }
          values.push(currentValue.trim().replace(/^["']|["']$/g, ''));
          
          const row: any = {};
          headers.forEach((header, idx) => {
            row[header] = values[idx] || '';
          });
          return row;
        });
      } else {
        const fileBuffer = fs.readFileSync(filePath);
        const workbook = XLSX.read(fileBuffer, { type: 'buffer', codepage: 65001 });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' }) as any[];
      }

      function normalizePhone(phone: string | number, countryCode: string): string {
        let phoneStr = String(phone);
        if (phoneStr.includes('E+') || phoneStr.includes('e+')) phoneStr = String(Math.round(Number(phone)));
        let cleaned = phoneStr.trim().replace(/[^\d+]/g, '').replace(/^\+/, '');
        
        if (countryCode === 'israel') {
          if (cleaned.startsWith('972') && cleaned.length >= 12) return cleaned;
          if (cleaned.startsWith('05') && cleaned.length === 10) return '9725' + cleaned.substring(2);
          if (cleaned.startsWith('5') && cleaned.length === 9) return '972' + cleaned;
          if (cleaned.startsWith('0') && (cleaned.length === 10 || cleaned.length === 9)) return '972' + cleaned.substring(1);
        } else if (countryCode === 'usa') {
          if (cleaned.startsWith('1') && cleaned.length === 11) return cleaned;
          if (cleaned.length === 10) return '1' + cleaned;
        } else if (countryCode === 'saudi') {
          if (cleaned.startsWith('966') && cleaned.length >= 12) return cleaned;
          if (cleaned.startsWith('05') && cleaned.length === 10) return '9665' + cleaned.substring(2);
          if (cleaned.startsWith('5') && cleaned.length === 9) return '966' + cleaned;
          if (cleaned.startsWith('0') && cleaned.length === 10) return '966' + cleaned.substring(1);
        }
        return cleaned;
      }

      // Get all existing phone numbers from DB
      const existingPhonesStmt = db.prepare('SELECT phone_number FROM contacts');
      const existingPhones = new Set((existingPhonesStmt.all() as any[]).map(row => row.phone_number));

      // Check which phone numbers are duplicates
      const duplicates: string[] = [];
      for (const row of data) {
        const rawPhone = row.phone_number || row.phone || row.number || row.Phone || row['Phone Number'];
        if (rawPhone) {
          const normalized = normalizePhone(rawPhone, country);
          if (existingPhones.has(normalized)) {
            duplicates.push(normalized);
          }
        }
      }

      return {
        duplicateCount: duplicates.length,
        totalCount: data.length,
        duplicates: duplicates
      };
    } catch (error) {
      console.error('Failed to check duplicates:', error);
      throw error;
    }
  });

  ipcMain.handle('contacts:importFromFile', async (_event, filePath: string, country?: string, duplicateAction?: 'update' | 'skip') => {
    // Try to read as UTF-8 text first (for CSV files)
    let data: any[];
    
    if (filePath.toLowerCase().endsWith('.csv')) {
      // For CSV files, try UTF-8 first
      console.log('📄 Reading CSV file...');
      let csvContent = fs.readFileSync(filePath, 'utf8');
      
      // Detect if it's actually Windows-1255 (Hebrew) by checking for mojibake
      if (csvContent.includes('�') || /[À-ÿ]{3,}/.test(csvContent)) {
        console.log('⚠️ Detected encoding issue, trying Windows-1255 (Hebrew)...');
        // Read as binary and decode as Windows-1255
        const buffer = fs.readFileSync(filePath);
        const decoder = new TextDecoder('windows-1255');
        csvContent = decoder.decode(buffer);
        console.log('✅ Decoded as Windows-1255');
      }
      
      // Parse CSV manually to ensure UTF-8
      const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line);
      const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
      
      data = lines.slice(1).map(line => {
        // Handle quoted values with commas inside
        const values: string[] = [];
        let currentValue = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"' || char === "'") {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(currentValue.trim().replace(/^["']|["']$/g, ''));
            currentValue = '';
          } else {
            currentValue += char;
          }
        }
        values.push(currentValue.trim().replace(/^["']|["']$/g, ''));
        
        const row: any = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });
        return row;
      });
      
      console.log(`✅ Parsed ${data.length} rows from CSV (UTF-8)`);
    } else {
      // For Excel files, use XLSX
      console.log('📊 Reading Excel file...');
      const fileBuffer = fs.readFileSync(filePath);
      const workbook = XLSX.read(fileBuffer, { 
        type: 'buffer',
        codepage: 65001, // UTF-8
        cellText: true,
        cellDates: true
      });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      data = XLSX.utils.sheet_to_json(worksheet, { 
        raw: false,
        defval: '',
        blankrows: false
      }) as any[];
      
      console.log(`✅ Parsed ${data.length} rows from Excel`);
    }

    // Phone normalization function
    function normalizePhone(phone: string | number, countryCode: string = 'international'): string {
      let phoneStr = String(phone);
      
      // Handle scientific notation
      if (phoneStr.includes('E+') || phoneStr.includes('e+')) {
        const num = Number(phone);
        phoneStr = String(Math.round(num));
      }
      
      // Clean the phone number
      let cleaned = phoneStr.trim().replace(/[^\d+]/g, '');
      cleaned = cleaned.replace(/^\+/, '');
      
      if (countryCode === 'international') return cleaned;
      
      // Israel normalization
      if (countryCode === 'israel') {
        if (cleaned.startsWith('972') && cleaned.length >= 12) return cleaned;
        if (cleaned.startsWith('05') && cleaned.length === 10) return '9725' + cleaned.substring(2);
        if (cleaned.startsWith('5') && cleaned.length === 9) return '972' + cleaned;
        if (cleaned.startsWith('0') && (cleaned.length === 10 || cleaned.length === 9)) return '972' + cleaned.substring(1);
      }
      
      // USA normalization
      if (countryCode === 'usa') {
        if (cleaned.startsWith('1') && cleaned.length === 11) return cleaned;
        if (cleaned.length === 10 && !cleaned.startsWith('1')) return '1' + cleaned;
      }
      
      // Saudi Arabia normalization
      if (countryCode === 'saudi') {
        if (cleaned.startsWith('966') && cleaned.length >= 12) return cleaned;
        if (cleaned.startsWith('05') && cleaned.length === 10) return '9665' + cleaned.substring(2);
        if (cleaned.startsWith('5') && cleaned.length === 9) return '966' + cleaned;
        if (cleaned.startsWith('0') && cleaned.length === 10) return '966' + cleaned.substring(1);
      }
      
      return cleaned;
    }

    let count = 0;
    const contactStmt = db.prepare(`
      INSERT OR IGNORE INTO contacts (id, phone_number, name)
      VALUES (?, ?, ?)
    `);
    
    const updateContactStmt = db.prepare(`
      UPDATE contacts SET name = ? WHERE phone_number = ? AND ? IS NOT NULL AND ? != ''
    `);
    
    const getTagStmt = db.prepare('SELECT id FROM tags WHERE name = ?');
    const createTagStmt = db.prepare('INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)');
    const linkTagStmt = db.prepare('INSERT OR IGNORE INTO contact_tags (contact_id, tag_id) VALUES (?, ?)');
    const getContactByPhoneStmt = db.prepare('SELECT id, name FROM contacts WHERE phone_number = ?');

    const insertMany = db.transaction((contacts) => {
      for (const row of contacts) {
        const rawPhoneNumber = row.phone_number || row.phone || row.number || row.Phone || row['Phone Number'];
        let name = row.name || row.Name || null;
        const tagsString = row.tags || row.Tags || '';
        
        // Debug logging for Hebrew text
        if (name) {
          console.log(`📝 Processing contact - Name: "${name}" (length: ${name.length})`);
          // Check for encoding issues
          if (name.includes('�')) {
            console.warn(`⚠️ Detected encoding issue in name: ${name}`);
          }
        }
        
        if (rawPhoneNumber) {
          // Normalize phone number based on selected country
          const phoneNumber = normalizePhone(rawPhoneNumber, country || 'international');
          
          // Check if contact already exists
          const existingContact = getContactByPhoneStmt.get(phoneNumber) as any;
          
          if (existingContact) {
            // Contact exists - handle based on duplicateAction
            if (duplicateAction === 'skip') {
              // Skip this contact - don't import
              console.log(`   Skipping duplicate: ${phoneNumber}`);
              continue;
            } else if (duplicateAction === 'update') {
              // Update name if provided
              if (name && name.trim()) {
                console.log(`   Updating name for ${phoneNumber}: "${name}"`);
                updateContactStmt.run(name, phoneNumber, name, name);
              }
              // Tags will be added below (contact id from existingContact)
              // Don't increment count for duplicates being updated
            }
          } else {
            // New contact - insert it
            const contactId = uuidv4();
            console.log(`   Inserting new contact: ${phoneNumber}, name: "${name || 'N/A'}"`);
            contactStmt.run(contactId, phoneNumber, name);
            count++;
          }
          
          // Handle tags if provided
          if (tagsString && tagsString.trim()) {
            console.log(`   Tags for ${phoneNumber}: "${tagsString}"`);
            
            const tagNames = tagsString.split(',').map((t: string) => t.trim()).filter((t: string) => t);
            console.log(`   Parsed tags:`, tagNames);
            
            for (const tagName of tagNames) {
              if (tagName.includes('�')) {
                console.warn(`   ⚠️ Encoding issue in tag: "${tagName}"`);
              }
              
              // Check if tag exists
              let tagRecord = getTagStmt.get(tagName) as any;
              let tagId: string;
              
              if (!tagRecord) {
                // Create new tag
                tagId = uuidv4();
                console.log(`   Creating new tag: "${tagName}"`);
                createTagStmt.run(tagId, tagName);
              } else {
                tagId = tagRecord.id;
                console.log(`   Using existing tag: "${tagName}" (${tagId.substring(0, 8)}...)`);
              }
              
              // Link tag to contact - get the actual contact id from DB (in case of duplicate phone)
              const contact = getContactByPhoneStmt.get(String(phoneNumber)) as any;
              if (contact) {
                linkTagStmt.run(contact.id, tagId);
              }
            }
          }
        }
      }
    });

    insertMany(data);
    return count;
  });

  ipcMain.handle('contacts:addTag', async (_event, contactId: string, tagId: string) => {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO contact_tags (contact_id, tag_id)
      VALUES (?, ?)
    `);
    stmt.run(contactId, tagId);
  });

  ipcMain.handle('contacts:removeTag', async (_event, contactId: string, tagId: string) => {
    const stmt = db.prepare('DELETE FROM contact_tags WHERE contact_id = ? AND tag_id = ?');
    stmt.run(contactId, tagId);
  });

  // ==================== TAG HANDLERS ====================
  ipcMain.handle('tags:getAll', async () => {
    const stmt = db.prepare('SELECT * FROM tags ORDER BY name');
    return stmt.all();
  });

  ipcMain.handle('tags:create', async (_event, data: Partial<Tag>) => {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO tags (id, name, color)
      VALUES (?, ?, ?)
    `);
    
    stmt.run(id, data.name, data.color || null);

    const getStmt = db.prepare('SELECT * FROM tags WHERE id = ?');
    return getStmt.get(id);
  });

  ipcMain.handle('tags:update', async (_event, id: string, data: Partial<Tag>) => {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.color !== undefined) {
      updates.push('color = ?');
      values.push(data.color);
    }

    if (updates.length > 0) {
      values.push(id);
      const stmt = db.prepare(`UPDATE tags SET ${updates.join(', ')} WHERE id = ?`);
      stmt.run(...values);
    }
  });

  ipcMain.handle('tags:delete', async (_event, id: string) => {
    // Check if this is a system tag
    const checkStmt = db.prepare('SELECT name, is_system FROM tags WHERE id = ?');
    const tag = checkStmt.get(id) as any;
    
    if (tag && (tag.is_system || tag.name === 'BlackList')) {
      throw new Error('Cannot delete system tag. System tags are protected.');
    }
    
    const stmt = db.prepare('DELETE FROM tags WHERE id = ? AND is_system = 0');
    const result = stmt.run(id);
    
    if (result.changes === 0) {
      throw new Error('Tag not found or is a system tag');
    }
  });

  // ==================== MESSAGE HANDLERS ====================
  ipcMain.handle('messages:send', async (_event, accountId: string, to: string, message: string) => {
    await whatsappManager.sendMessage(accountId, to, message, false); // Not a warmup message
    
    logActivity(db, 'message', `Message sent to ${to}`, accountId);
  });

  ipcMain.handle('messages:sendMedia', async (_event, accountId: string, to: string, filePath: string, caption?: string) => {
    await whatsappManager.sendMedia(accountId, to, filePath, caption);
  });

  ipcMain.handle('messages:saveTempFile', async (_event, fileName: string, buffer: Buffer) => {
    const path = await import('path');
    const os = await import('os');
    
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `whatsapp_${Date.now()}_${fileName}`);
    
    fs.writeFileSync(tempFilePath, buffer);
    
    return tempFilePath;
  });

  ipcMain.handle('messages:deleteTempFile', async (_event, filePath: string) => {
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      console.warn('Failed to delete temp file:', error);
    }
  });

  ipcMain.handle('messages:getByChat', async (_event, chatId: string, accountId: string) => {
    const stmt = db.prepare(`
      SELECT * FROM messages 
      WHERE chat_id = ? AND account_id = ?
        AND (is_warmup = 0 OR is_warmup IS NULL OR is_from_me = 0)
      ORDER BY timestamp ASC
    `);
    return stmt.all(chatId, accountId);
  });

  ipcMain.handle('messages:getChats', async (_event, accountId?: string) => {
    let query = `
      SELECT 
        chat_id,
        account_id,
        MAX(timestamp) as last_timestamp,
        SUM(CASE WHEN is_from_me = 0 AND is_handled = 0 THEN 1 ELSE 0 END) as unread_count,
        MAX(CASE WHEN is_handled = 1 THEN 1 ELSE 0 END) as is_handled
      FROM messages
      WHERE (is_warmup = 0 OR is_warmup IS NULL OR is_from_me = 0)
    `;
    
    const params: any[] = [];
    if (accountId) {
      query += ' AND account_id = ?';
      params.push(accountId);
    }
    
    query += ' GROUP BY chat_id, account_id ORDER BY last_timestamp DESC';
    
    const stmt = db.prepare(query);
    const chats = stmt.all(...params) as any[];

    // Get last message AND contact info for each chat
    return Promise.all(chats.map(async (chat) => {
      // Get last message
      const lastMsgStmt = db.prepare(`
        SELECT * FROM messages 
        WHERE chat_id = ? AND account_id = ?
        ORDER BY timestamp DESC LIMIT 1
      `);
      const lastMessage = lastMsgStmt.get(chat.chat_id, chat.account_id) as any;
      
      // Get contact name from first incoming message (not from me)
      const contactStmt = db.prepare(`
        SELECT sender_name, from_number FROM messages 
        WHERE chat_id = ? AND account_id = ? AND is_from_me = 0
        ORDER BY timestamp ASC LIMIT 1
      `);
      const contactInfo = contactStmt.get(chat.chat_id, chat.account_id) as any;
      
      return {
        chat_id: chat.chat_id,
        account_id: chat.account_id,
        last_message: {
          ...lastMessage,
          // Override with contact info for display
          sender_name: contactInfo?.sender_name || lastMessage?.sender_name,
          from_number: contactInfo?.from_number || lastMessage?.from_number
        },
        unread_count: chat.unread_count,
        is_handled: chat.is_handled === 1
      };
    }));
  });

  ipcMain.handle('messages:markAsHandled', async (_event, chatId: string, accountId: string) => {
    // Mark all incoming messages in this chat as handled (read)
    const stmt = db.prepare(`
      UPDATE messages 
      SET is_handled = 1 
      WHERE chat_id = ? AND account_id = ? AND is_from_me = 0
    `);
    stmt.run(chatId, accountId);
  });

  // ==================== WARMUP HANDLERS ====================
  ipcMain.handle('warmup:start', async (_event, accountIds: string[], minDelay: number, maxDelay: number) => {
    return await warmUpService.startSession(accountIds, minDelay, maxDelay);
  });

  ipcMain.handle('warmup:stop', async (_event, sessionId: string) => {
    await warmUpService.stopSession(sessionId);
  });

  ipcMain.handle('warmup:getActive', async () => {
    return await warmUpService.getActiveSession();
  });

  // ==================== STATS HANDLERS ====================
  ipcMain.handle('stats:getDashboard', async () => {
    const accountsStmt = db.prepare("SELECT COUNT(*) as count FROM accounts WHERE status = 'connected'");
    const accountsConnected = (accountsStmt.get() as any).count;

    const today = new Date().toISOString().split('T')[0];
    const messagesStmt = db.prepare(`
      SELECT COUNT(*) as count FROM messages 
      WHERE DATE(timestamp) = ? AND is_from_me = 1
    `);
    const messagesSentToday = (messagesStmt.get(today) as any).count;

    const campaignsStmt = db.prepare("SELECT COUNT(*) as count FROM campaigns WHERE status = 'running'");
    const activeCampaigns = (campaignsStmt.get() as any).count;

    const pendingStmt = db.prepare("SELECT COUNT(*) as count FROM campaign_contacts WHERE status = 'pending'");
    const pendingMessages = (pendingStmt.get() as any).count;

    return {
      accounts_connected: accountsConnected,
      messages_sent_today: messagesSentToday,
      active_campaigns: activeCampaigns,
      pending_messages: pendingMessages
    };
  });

  ipcMain.handle('stats:getRecentActivities', async (_event, limit: number = 10) => {
    const stmt = db.prepare(`
      SELECT * FROM activities 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    return stmt.all(limit);
  });

  // ==================== AUTO-UPDATER HANDLERS ====================
  ipcMain.handle('updater:check-for-updates', async () => {
    const { checkForUpdates } = await import('./main');
    return checkForUpdates();
  });

  ipcMain.handle('updater:download-update', async () => {
    const { downloadUpdate } = await import('./main');
    return downloadUpdate();
  });

  ipcMain.handle('updater:install-update', () => {
    const { quitAndInstall } = require('./main');
    quitAndInstall();
  });

  ipcMain.handle('updater:get-version', () => {
    return app.getVersion();
  });
}

export { whatsappManager, campaignScheduler, warmUpService, inboxManager };
