import type { Database } from 'better-sqlite3';
import type { WhatsAppManager } from './WhatsAppManager';
export declare class WarmUpService {
    private db;
    private whatsappManager;
    private activeSessions;
    private conversationTimeouts;
    constructor(db: Database, whatsappManager: WhatsAppManager);
    private resumeActiveSessions;
    startSession(accountIds: string[], minDelay: number, maxDelay: number): Promise<string>;
    stopSession(sessionId: string): Promise<void>;
    getActiveSession(): Promise<any>;
    private scheduleNextWarmUpForAccount;
    private getPairKey;
    private linkConversation;
    private releaseConversation;
    /**
     * Kicks off a new conversation: finds a free connected partner for `starterId` and
     * sends the opening message. The rest of the exchange (replies) is driven by
     * runConversationTurn recursively swapping sender/receiver on each turn.
     * Returns true if a conversation was successfully started, false if no partner was available.
     */
    private startConversation;
    /**
     * Sends one message in an ongoing conversation and, if more turns remain, schedules
     * the next turn with sender/receiver swapped (i.e. the reply) after a human-like delay.
     */
    private runConversationTurn;
    /**
     * Sends a single, already-chosen message from senderId to receiverId and logs it.
     * Used exclusively by runConversationTurn for each step of a conversation exchange.
     */
    private sendWarmUpTurnMessage;
    private resetDailyCountersIfNeeded;
    private startDailyReset;
}
