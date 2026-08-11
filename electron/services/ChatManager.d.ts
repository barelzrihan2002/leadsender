import type { Database } from 'better-sqlite3';
export declare class ChatManager {
    private db;
    constructor(db: Database);
    /**
     * Find or create a chat for the given phone number and account.
     * Also ensures a Contact exists (creates one if not).
     * Downloads profile photo from WhatsApp and saves locally.
     */
    findOrCreateChat(phoneNumber: string, accountId: string, whatsappClient?: any, senderName?: string | null): Promise<string>;
    /**
     * Update last_message_at for a chat
     */
    updateLastMessageAt(chatId: string, timestamp: string): void;
    /**
     * Download profile picture from WhatsApp and save locally
     */
    private downloadAndSavePhoto;
}
