import type { Database } from 'better-sqlite3';
import type { WhatsAppManager } from './WhatsAppManager';
import type { DuoPlusManager } from './DuoPlusManager';
export declare class CampaignScheduler {
    private db;
    private whatsappManager;
    private duoplusManager?;
    private activeCampaigns;
    constructor(db: Database, whatsappManager: WhatsAppManager, duoplusManager?: DuoPlusManager);
    /**
     * Called by WhatsAppManager when an account fires the 'ready' event.
     * Resumes any running campaigns that include this account.
     */
    onAccountReady(accountId: string): Promise<void>;
    private resumeRunningCampaigns;
    private logActivity;
    private isGroupAdderCampaign;
    /**
     * Sends a text-only WhatsApp message through the DuoPlus cloud phone linked to `accountId`,
     * instead of the WhatsApp Web session. Powers the cloud phone on first if needed.
     *
     * Triggering the ADB tap/keyevent only proves the *command* executed - it does not prove
     * WhatsApp on the phone actually delivered the message (e.g. the send button could have been
     * missed, the chat could have not loaded, etc). To catch that, the account's WhatsApp Web
     * session (kept connected as a linked device, but never used to send) is used afterwards to
     * confirm a new outgoing message actually appeared in that chat before we consider this a success.
     */
    private sendViaCloudPhone;
    private markRemainingPendingContactsAsFailed;
    private getEligibleAccountsForCampaign;
    private handleGroupAdderContact;
    private handleGroupAdderBatch;
    startCampaign(campaignId: string): Promise<void>;
    pauseCampaign(campaignId: string): Promise<void>;
    stopCampaign(campaignId: string): Promise<void>;
    resetCampaign(campaignId: string): Promise<void>;
    private getActiveCampaignState;
    private scheduleAccountTimeout;
    private finishAccountRun;
    private scheduleNextMessageForAccount;
    private claimPendingContacts;
    private sendNextMessageFromAccount;
    private getCampaign;
    private getMessageVariantPool;
    private completeCampaign;
    private resetDailyCountersIfNeeded;
    private startDailyReset;
    private updateStats;
    private notifyRenderer;
}
