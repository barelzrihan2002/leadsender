import type { Database } from 'better-sqlite3';
import type { WhatsAppManager } from './WhatsAppManager';
export declare class GroupCampaignScheduler {
    private db;
    private whatsappManager;
    private tickInterval;
    private runningCampaignIds;
    constructor(db: Database, whatsappManager: WhatsAppManager);
    start(): void;
    stop(): void;
    private notifyRenderer;
    private tick;
    runCampaignNow(campaignId: string): Promise<void>;
}
