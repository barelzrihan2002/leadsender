import type { Database } from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Normalize phone number into all possible matching variants
function normalizePhoneForMatching(phone: string): string[] {
  const digitsOnly = phone.replace(/\D/g, '');
  
  const variants: string[] = [
    phone,
    digitsOnly,
  ];
  
  // Israel: 972509830906 → 0509830906
  if (digitsOnly.startsWith('972') && digitsOnly.length >= 12) {
    variants.push('0' + digitsOnly.slice(3));
  }
  // USA: 15551234567 → 5551234567
  if (digitsOnly.startsWith('1') && digitsOnly.length === 11) {
    variants.push(digitsOnly.slice(1));
  }
  // Saudi: 966501234567 → 0501234567
  if (digitsOnly.startsWith('966') && digitsOnly.length >= 12) {
    variants.push('0' + digitsOnly.slice(3));
  }
  
  // Add without leading zero → with country code
  if (digitsOnly.startsWith('0') && digitsOnly.length >= 10) {
    variants.push('972' + digitsOnly.slice(1)); // Assume Israel
  }
  
  // Last 9-10 digits for fuzzy matching
  if (digitsOnly.length >= 9) {
    variants.push(digitsOnly.slice(-9));
  }
  if (digitsOnly.length >= 10) {
    variants.push(digitsOnly.slice(-10));
  }
  
  return [...new Set(variants)];
}

export class ChatManager {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Find or create a chat for the given phone number and account.
   * Also ensures a Contact exists (creates one if not).
   * Downloads profile photo from WhatsApp and saves locally.
   */
  async findOrCreateChat(
    phoneNumber: string,
    accountId: string,
    whatsappClient?: any,
    senderName?: string | null
  ): Promise<string> {
    const normalizedNumber = phoneNumber.replace(/\D/g, '');
    
    // Step 1: Find existing chat by phone number variants + account_id
    const variants = normalizePhoneForMatching(phoneNumber);
    let existingChat: any = null;
    
    for (const variant of variants) {
      existingChat = this.db.prepare(
        `SELECT id, contact_id, photo, name FROM chats WHERE phone_number = ? AND account_id = ?`
      ).get(variant, accountId) as any;
      if (existingChat) break;
    }
    
    if (existingChat) {
      // Chat exists - try to download photo if missing (lazy)
      if (!existingChat.photo && whatsappClient) {
        this.downloadAndSavePhoto(existingChat.id, normalizedNumber, whatsappClient).catch(() => {});
      }
      // Update name if chat has no name but we have senderName
      if (!existingChat.name && senderName) {
        this.db.prepare(`UPDATE chats SET name = ? WHERE id = ?`).run(senderName, existingChat.id);
        // Also update contact name if missing
        const contact = this.db.prepare(`SELECT name FROM contacts WHERE id = ?`).get(existingChat.contact_id) as any;
        if (contact && !contact.name) {
          this.db.prepare(`UPDATE contacts SET name = ? WHERE id = ?`).run(senderName, existingChat.contact_id);
        }
      }
      return existingChat.id;
    }
    
    // Step 2: No chat found - find or create Contact
    let contact: any = null;
    for (const variant of variants) {
      contact = this.db.prepare(
        `SELECT id, name FROM contacts WHERE phone_number = ?`
      ).get(variant) as any;
      if (contact) break;
    }
    
    // Try fuzzy matching with last 9 digits
    if (!contact && normalizedNumber.length >= 9) {
      const last9 = normalizedNumber.slice(-9);
      contact = this.db.prepare(
        `SELECT id, name FROM contacts WHERE phone_number LIKE '%' || ?`
      ).get(last9) as any;
    }
    
    if (!contact) {
      // Create new contact
      const contactId = uuidv4();
      const contactName = senderName || null;
      this.db.prepare(
        `INSERT INTO contacts (id, phone_number, name) VALUES (?, ?, ?)`
      ).run(contactId, normalizedNumber, contactName);
      contact = { id: contactId, name: contactName };
      console.log('📇 Created new contact:', normalizedNumber, contactName || '(no name)');
    } else if (!contact.name && senderName) {
      // Update contact name if it was missing
      this.db.prepare(`UPDATE contacts SET name = ? WHERE id = ?`).run(senderName, contact.id);
      contact.name = senderName;
    }
    
    // Step 3: Get WhatsApp name if contact has no name and we have a client
    let chatName = contact.name || senderName || null;
    if (!chatName && whatsappClient) {
      try {
        const wid = normalizedNumber.includes('@') ? normalizedNumber : `${normalizedNumber}@c.us`;
        const waContact = await whatsappClient.getContactById(wid);
        if (waContact?.pushname) {
          chatName = waContact.pushname;
          // Update contact name
          this.db.prepare(`UPDATE contacts SET name = ? WHERE id = ?`).run(chatName, contact.id);
          console.log('📇 Updated contact name from WhatsApp:', chatName);
        }
      } catch (e) {
        console.log('⚠️ Could not get WhatsApp contact name');
      }
    }
    
    // Step 4: Create the chat
    const chatId = uuidv4();
    this.db.prepare(`
      INSERT INTO chats (id, contact_id, account_id, phone_number, status, name, last_message_at)
      VALUES (?, ?, ?, ?, 'unhandled', ?, ?)
    `).run(chatId, contact.id, accountId, normalizedNumber, chatName, new Date().toISOString());
    
    console.log('💬 Created new chat:', chatId, 'for phone:', normalizedNumber, 'contact:', contact.id);
    
    // Step 5: Download profile photo in background
    if (whatsappClient) {
      this.downloadAndSavePhoto(chatId, normalizedNumber, whatsappClient).catch(() => {});
    }
    
    return chatId;
  }

  /**
   * Update last_message_at for a chat
   */
  updateLastMessageAt(chatId: string, timestamp: string): void {
    this.db.prepare(`UPDATE chats SET last_message_at = ? WHERE id = ?`).run(timestamp, chatId);
  }

  /**
   * Download profile picture from WhatsApp and save locally
   */
  private async downloadAndSavePhoto(chatId: string, phoneNumber: string, client: any): Promise<void> {
    try {
      const wid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@c.us`;
      
      let profilePicUrl: string | undefined;
      
      // Try getProfilePicUrl via contact
      try {
        const contact = await client.getContactById(wid);
        profilePicUrl = await contact.getProfilePicUrl();
      } catch (e) {
        // Try direct method
        try {
          profilePicUrl = await client.getProfilePicUrl(wid);
        } catch (e2) {
          // No profile pic available
        }
      }
      
      if (!profilePicUrl || typeof profilePicUrl !== 'string') {
        console.log('📷 No profile picture for:', phoneNumber);
        return;
      }
      
      // Download the image
      const https = await import('https');
      const http = await import('http');
      const userDataPath = app.getPath('userData');
      const photosDir = path.join(userDataPath, 'chat-photos');
      
      if (!fs.existsSync(photosDir)) {
        fs.mkdirSync(photosDir, { recursive: true });
      }
      
      const photoFileName = `${chatId}.jpg`;
      const photoPath = path.join(photosDir, photoFileName);
      
      await new Promise<void>((resolve, reject) => {
        const protocol = profilePicUrl!.startsWith('https') ? https : http;
        protocol.get(profilePicUrl!, (response: any) => {
          // Follow redirects
          if (response.statusCode === 301 || response.statusCode === 302) {
            const redirectUrl = response.headers.location;
            if (redirectUrl) {
              const redirectProtocol = redirectUrl.startsWith('https') ? https : http;
              redirectProtocol.get(redirectUrl, (redirectResponse: any) => {
                const fileStream = fs.createWriteStream(photoPath);
                redirectResponse.pipe(fileStream);
                fileStream.on('finish', () => { fileStream.close(); resolve(); });
                fileStream.on('error', reject);
              }).on('error', reject);
              return;
            }
          }
          
          const fileStream = fs.createWriteStream(photoPath);
          response.pipe(fileStream);
          fileStream.on('finish', () => { fileStream.close(); resolve(); });
          fileStream.on('error', reject);
        }).on('error', reject);
      });
      
      // Update chat with local photo path
      this.db.prepare(`UPDATE chats SET photo = ? WHERE id = ?`).run(photoPath, chatId);
      console.log('📷 Profile photo saved for chat:', chatId);
      
    } catch (error) {
      console.log('⚠️ Could not download profile photo for:', phoneNumber);
    }
  }
}
