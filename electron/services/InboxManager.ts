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
        chat_id,
        account_id,
        MAX(timestamp) as last_timestamp,
        SUM(CASE WHEN is_from_me = 0 AND is_handled = 0 THEN 1 ELSE 0 END) as unread_count,
        MAX(CASE WHEN is_handled = 1 THEN 1 ELSE 0 END) as is_handled
      FROM messages
    `;
    
    const params: any[] = [];
    if (accountId) {
      query += ' WHERE account_id = ?';
      params.push(accountId);
    }
    
    query += ' GROUP BY chat_id, account_id ORDER BY last_timestamp DESC';
    
    const stmt = this.db.prepare(query);
    const chats = stmt.all(...params) as any[];

    // Get last message for each chat
    return chats.map((chat) => {
      const msgStmt = this.db.prepare(`
        SELECT * FROM messages 
        WHERE chat_id = ? AND account_id = ?
        ORDER BY timestamp DESC LIMIT 1
      `);
      const lastMessage = msgStmt.get(chat.chat_id, chat.account_id) as any;
      
      if (!lastMessage) {
        return {
          chat_id: chat.chat_id,
          account_id: chat.account_id,
          last_message: null,
          unread_count: chat.unread_count,
          is_handled: chat.is_handled === 1
        };
      }
      
      // Get the phone number of the OTHER person (not me)
      let otherPersonNumber: string;
      if (lastMessage.is_from_me) {
        // Outgoing message - other person is the recipient
        otherPersonNumber = lastMessage.to_number;
      } else {
        // Incoming message - other person is the sender
        otherPersonNumber = lastMessage.from_number;
      }
      
      // Try to get contact name from contacts table first
      const contactStmt = this.db.prepare(`
        SELECT name FROM contacts WHERE phone_number = ?
      `);
      const contact = contactStmt.get(otherPersonNumber) as any;
      
      if (contact?.name) {
        // Found in contacts table - this is the best source
        lastMessage.contact_name = contact.name;
        lastMessage.contact_number = otherPersonNumber;
      } else if (!lastMessage.is_from_me && lastMessage.sender_name) {
        // No contact entry, but we have sender_name from incoming message
        lastMessage.contact_name = lastMessage.sender_name;
        lastMessage.contact_number = otherPersonNumber;
      } else {
        // No name available - just set the number
        lastMessage.contact_name = null;
        lastMessage.contact_number = otherPersonNumber;
      }
      
      return {
        chat_id: chat.chat_id,
        account_id: chat.account_id,
        last_message: lastMessage,
        unread_count: chat.unread_count,
        is_handled: chat.is_handled === 1
      };
    });
  }

  async getChatMessages(chatId: string, accountId: string): Promise<any[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE chat_id = ? AND account_id = ?
      ORDER BY timestamp ASC
    `);
    return stmt.all(chatId, accountId) as any[];
  }

  async markChatAsHandled(chatId: string, accountId: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE messages 
      SET is_handled = 1 
      WHERE chat_id = ? AND account_id = ?
    `);
    stmt.run(chatId, accountId);
  }

  async sendMessage(accountId: string, to: string, message: string): Promise<void> {
    await this.whatsappManager.sendMessage(accountId, to, message);
  }
}
