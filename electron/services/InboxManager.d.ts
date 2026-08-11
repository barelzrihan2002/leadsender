import type { Database } from 'better-sqlite3';
import type { WhatsAppManager } from './WhatsAppManager';
export declare class InboxManager {
    private db;
    private whatsappManager;
    constructor(db: Database, whatsappManager: WhatsAppManager);
    getChats(accountId?: string): Promise<any[]>;
    getChatMessages(softwareChatId: string): Promise<any[]>;
    markAsRead(softwareChatId: string): Promise<void>;
    markChatStatus(softwareChatId: string, status: string): Promise<void>;
    sendMessage(accountId: string, to: string, message: string): Promise<void>;
}
