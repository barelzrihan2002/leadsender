import type { Database } from 'better-sqlite3';
import { WhatsAppManager } from './WhatsAppManager';
export declare class FlowEngine {
    private db;
    private whatsappManager;
    private processingMessages;
    constructor(db: Database, whatsappManager: WhatsAppManager);
    /**
     * בדוק אם יש Flow פעיל עבור account זה והפעל אותו
     */
    checkAndExecuteFlow(accountId: string, chatId: string, incomingMessage: any): Promise<boolean>;
    /**
     * מצא Flows פעילים עבור account ספציפי
     */
    private getActiveFlowsForAccount;
    /**
     * בדוק אם Flow צריך להתבצע (בדוק את התנאי הראשון)
     */
    private evaluateFlowConditions;
    /**
     * הפעל Flow מלא
     */
    private executeFlow;
    /**
     * בנה גרף ביצוע מ-nodes ו-edges
     */
    private buildExecutionGraph;
    /**
     * בצע צומת בודד
     */
    private executeNode;
    private getMessageContext;
    private renderTemplate;
    private extractDigits;
    /**
     * שליחת Webhook
     */
    private executeWebhook;
    /**
     * סימולציה של הקלדה
     */
    private simulateTyping;
    /**
     * פונקציית עזר להמתנה
     */
    private sleep;
    /**
     * הוסף איש קשר לרשימה השחורה (BlackList) לפי מספר טלפון.
     * יוצר את איש הקשר אם עדיין לא קיים בטבלת ה-contacts.
     */
    private addContactToBlacklist;
}
