import type { Database } from 'better-sqlite3';
import type { WhatsAppManager } from './WhatsAppManager';

export class InboxManager {
  private db: Database;
  private whatsappManager: WhatsAppManager;

  constructor(db: Database, whatsappManager: WhatsAppManager) {
    this.db = db;
    this.whatsappManager = whatsappManager;
  }

  async getChats(accountId?: string): Promise<any[]> {
    let query = `
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM messages m WHERE m.software_chat_id = c.id AND m.is_read = 0 AND m.is_from_me = 0) as unread_count
      FROM chats c
      WHERE 1=1
    `;
    
    const params: any[] = [];
    if (accountId) {
      query += ' AND c.account_id = ?';
      params.push(accountId);
    }
    
    query += ' ORDER BY c.last_message_at DESC';
    
    const chats = this.db.prepare(query).all(...params) as any[];
    
    const lastMsgStmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE software_chat_id = ?
        AND (is_warmup = 0 OR is_warmup IS NULL OR is_from_me = 0)
      ORDER BY timestamp DESC LIMIT 1
    `);
    
    return chats.map((chat) => {
      const lastMessage = lastMsgStmt.get(chat.id) as any;
      
      return {
        id: chat.id,
        contact_id: chat.contact_id,
        account_id: chat.account_id,
        phone_number: chat.phone_number,
        status: chat.status,
        photo: chat.photo,
        name: chat.name,
        last_message_at: chat.last_message_at,
        unread_count: chat.unread_count,
        last_message: lastMessage || null
      };
    }).filter(chat => chat.last_message !== null);
  }

  async getChatMessages(softwareChatId: string): Promise<any[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE software_chat_id = ?
        AND (is_warmup = 0 OR is_warmup IS NULL OR is_from_me = 0)
      ORDER BY timestamp ASC
    `);
    return stmt.all(softwareChatId) as any[];
  }

  async markAsRead(softwareChatId: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE messages 
      SET is_read = 1 
      WHERE software_chat_id = ? AND is_from_me = 0 AND is_read = 0
    `);
    stmt.run(softwareChatId);
  }

  async markChatStatus(softwareChatId: string, status: string): Promise<void> {
    const stmt = this.db.prepare(`UPDATE chats SET status = ? WHERE id = ?`);
    stmt.run(status, softwareChatId);
  }

  async sendMessage(accountId: string, to: string, message: string): Promise<void> {
    await this.whatsappManager.sendMessage(accountId, to, message);
  }
}
