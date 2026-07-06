import type { Database } from 'better-sqlite3';
import type { WhatsAppManager } from './WhatsAppManager';
import { BrowserWindow } from 'electron';
import { replaceVariables, getRandomDelay } from '../../src/lib/utils';
import { v4 as uuidv4 } from 'uuid';

interface CampaignState {
  isRunning: boolean;
  runId: string;
  accountTimeouts: Map<string, NodeJS.Timeout>; // accountId -> timeout
  activeAccounts: Set<string>;
  messagesSentToday: Map<string, number>; // accountId -> count
  messagesSinceLastBreak: Map<string, number>; // accountId -> count (for break tracking)
  lastResetDate: string;
}

interface SendNextMessageResult {
  success: boolean;
  delayMs?: number;
  finished?: boolean;
  finishReason?: string;
}

export class CampaignScheduler {
  private db: Database;
  private whatsappManager: WhatsAppManager;
  private activeCampaigns: Map<string, CampaignState> = new Map();

  constructor(db: Database, whatsappManager: WhatsAppManager) {
    this.db = db;
    this.whatsappManager = whatsappManager;

    // Reset daily counters at midnight
    this.startDailyReset();
  }

  /**
   * Called by WhatsAppManager when an account fires the 'ready' event.
   * Resumes any running campaigns that include this account.
   */
  async onAccountReady(accountId: string): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        SELECT c.* FROM campaigns c
        JOIN campaign_accounts ca ON ca.campaign_id = c.id
        WHERE c.status = 'running'
        AND ca.account_id = ?
      `);
      const runningCampaigns = stmt.all(accountId) as any[];

      if (runningCampaigns.length === 0) {
        console.log(`ℹ️ No running campaigns for account ${accountId.substring(0, 8)}...`);
        return;
      }

      console.log(`🔄 Account ${accountId.substring(0, 8)}... is ready - checking ${runningCampaigns.length} campaign(s)`);

      for (const campaign of runningCampaigns) {
        const startedAt = new Date(campaign.started_at);
        const now = new Date();
        const hoursSinceStart = (now.getTime() - startedAt.getTime()) / 1000 / 60 / 60;

        if (hoursSinceStart > 168) {
          console.log(`⚠️ Campaign "${campaign.name}" running >7 days, pausing`);
          this.db.prepare(`UPDATE campaigns SET status = 'paused' WHERE id = ?`).run(campaign.id);
          continue;
        }

        const currentHour = now.getHours();
        const state = this.activeCampaigns.get(campaign.id);

        // If campaign already has an active state with this account scheduled, skip
        if (state?.isRunning && state.activeAccounts.has(accountId)) {
          console.log(`ℹ️ Account ${accountId.substring(0, 8)}... already scheduled in campaign "${campaign.name}"`);
          continue;
        }

        // Initialize campaign state if not already running
        if (!state || !state.isRunning) {
          console.log(`🔄 Starting campaign "${campaign.name}" now that account is ready`);
          await this.startCampaign(campaign.id);
          this.logActivity('campaign', `Campaign "${campaign.name}" resumed after account reconnected`, campaign.id);
        } else {
          // Campaign state exists but this account wasn't scheduled - add it
          console.log(`➕ Adding account ${accountId.substring(0, 8)}... to running campaign "${campaign.name}"`);

          if (this.isGroupAdderCampaign(campaign)) {
            const eligibility = await this.whatsappManager.canAddParticipantsToGroup(accountId, campaign.target_group_id);
            if (!eligibility.ok) {
              console.log(`⚠️ Account ${accountId.substring(0, 8)}... is not eligible for group adder campaign "${campaign.name}": ${eligibility.message || eligibility.reason}`);
              continue;
            }
          }

          state.activeAccounts.add(accountId);

          if (currentHour >= campaign.start_hour && currentHour < campaign.end_hour) {
            void this.scheduleNextMessageForAccount(campaign.id, accountId, state.runId);
          } else {
            const nextStart = new Date(now);
            if (currentHour >= campaign.end_hour) nextStart.setDate(nextStart.getDate() + 1);
            nextStart.setHours(campaign.start_hour, 0, 0, 0);
            const delay = nextStart.getTime() - now.getTime();
            console.log(`⏰ Outside working hours - scheduling account for ${nextStart.toLocaleTimeString()}`);
            this.scheduleAccountTimeout(campaign.id, accountId, delay, state.runId);
          }
        }
      }
    } catch (error) {
      console.error(`Failed in onAccountReady for ${accountId}:`, error);
    }
  }

  private resumeRunningCampaigns(): void {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM campaigns 
        WHERE status = 'running'
      `);
      const runningCampaigns = stmt.all() as any[];

      if (runningCampaigns.length > 0) {
        console.log(`🔄 Found ${runningCampaigns.length} running campaign(s), resuming...`);

        for (const campaign of runningCampaigns) {
          const startedAt = new Date(campaign.started_at);
          const now = new Date();
          const hoursSinceStart = (now.getTime() - startedAt.getTime()) / 1000 / 60 / 60;

          // If campaign has been running for more than 7 days, mark as paused (safety)
          if (hoursSinceStart > 168) { // 7 days
            console.log(`⚠️ Campaign "${campaign.name}" has been running for ${Math.floor(hoursSinceStart)} hours, pausing for safety`);
            const pauseStmt = this.db.prepare(`UPDATE campaigns SET status = 'paused' WHERE id = ?`);
            pauseStmt.run(campaign.id);
          } else {
            console.log(`🔄 Resuming campaign: "${campaign.name}"`);

            // Check if we're within working hours before starting
            const now = new Date();
            const currentHour = now.getHours();

            if (currentHour >= campaign.start_hour && currentHour < campaign.end_hour) {
              // בתוך שעות עבודה - התחל מיד
              console.log(`✅ Within working hours (${currentHour}:00, range: ${campaign.start_hour}-${campaign.end_hour}) - starting now`);
              void this.startCampaign(campaign.id).catch(error => {
                console.error(`Failed to auto-resume campaign ${campaign.id}:`, error);
              });
              this.logActivity('campaign', `Campaign "${campaign.name}" auto-resumed after app restart`, campaign.id);
            } else if (currentHour < campaign.start_hour) {
              // לפני שעת ההתחלה - חכה עד שעת ההתחלה היום
              const nextStart = new Date(now);
              nextStart.setHours(campaign.start_hour, 0, 0, 0);
              const delay = nextStart.getTime() - now.getTime();

              console.log(`⏰ Before working hours (${currentHour}:00) - will start at ${nextStart.toLocaleTimeString()}`);

              setTimeout(() => {
                console.log(`✅ Starting campaign at working hours: "${campaign.name}"`);
                void this.startCampaign(campaign.id).catch(error => {
                  console.error(`Failed to auto-resume campaign ${campaign.id}:`, error);
                });
                this.logActivity('campaign', `Campaign "${campaign.name}" auto-resumed at start of working hours`, campaign.id);
              }, delay);
            } else {
              // אחרי שעת הסיום - חכה עד מחר בשעת ההתחלה
              const nextStart = new Date(now);
              nextStart.setDate(nextStart.getDate() + 1);
              nextStart.setHours(campaign.start_hour, 0, 0, 0);
              const delay = nextStart.getTime() - now.getTime();

              console.log(`⏰ After working hours (${currentHour}:00) - will start tomorrow at ${nextStart.toLocaleTimeString()}`);

              setTimeout(() => {
                console.log(`✅ Starting campaign at working hours: "${campaign.name}"`);
                void this.startCampaign(campaign.id).catch(error => {
                  console.error(`Failed to auto-resume campaign ${campaign.id}:`, error);
                });
                this.logActivity('campaign', `Campaign "${campaign.name}" auto-resumed at start of working hours`, campaign.id);
              }, delay);
            }
          }
        }
      } else {
        console.log('ℹ️ No running campaigns to resume');
      }
    } catch (error) {
      console.error('Failed to resume running campaigns:', error);
    }
  }

  private logActivity(type: string, message: string, relatedId?: string) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO activities (id, type, message, related_id, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(uuidv4(), type, message, relatedId || null, new Date().toISOString());
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  }

  private isGroupAdderCampaign(campaign: any): boolean {
    return campaign?.campaign_type === 'group_adder';
  }

  private markRemainingPendingContactsAsFailed(campaignId: string, error: string, resultCode: string): void {
    const stmt = this.db.prepare(`
      UPDATE campaign_contacts
      SET status = 'failed', error = ?, result_code = ?
      WHERE campaign_id = ? AND status = 'pending'
    `);
    stmt.run(error, resultCode, campaignId);
  }

  private async getEligibleAccountsForCampaign(campaignId: string, campaign: any, accountIds: string[]): Promise<string[]> {
    if (!this.isGroupAdderCampaign(campaign)) {
      return accountIds;
    }

    if (!campaign.target_group_id) {
      throw new Error('Target group is required for group adder campaigns');
    }

    const eligibleAccounts: string[] = [];

    for (const accountId of accountIds) {
      const eligibility = await this.whatsappManager.canAddParticipantsToGroup(accountId, campaign.target_group_id);

      if (eligibility.ok) {
        eligibleAccounts.push(accountId);
        continue;
      }

      console.log(`⚠️ Skipping account ${accountId.substring(0, 8)}... for campaign ${campaignId}: ${eligibility.message || eligibility.reason}`);
    }

    return eligibleAccounts;
  }

  private async handleGroupAdderContact(
    campaignId: string,
    accountId: string,
    contact: any,
    state: CampaignState,
    campaign: any
  ): Promise<SendNextMessageResult> {
    if (!campaign.target_group_id) {
      const updateStmt = this.db.prepare(`
        UPDATE campaign_contacts
        SET status = 'failed', error = ?, result_code = ?
        WHERE id = ?
      `);
      updateStmt.run('Target group is missing', 'group_not_found', contact.id);
      return { success: false };
    }

    const result = await this.whatsappManager.addParticipantToGroup(accountId, campaign.target_group_id, contact.phone_number);

    if (!result.success) {
      console.warn(
        `⚠️ Group adder failed for account ${accountId.substring(0, 8)}... ` +
        `contact ${contact.phone_number} -> ${result.resultCode}: ${result.message}`
      );
    }

    if (result.success) {
      const updateStmt = this.db.prepare(`
        UPDATE campaign_contacts
        SET status = 'sent', sent_by_account_id = ?, sent_at = ?, error = NULL, retry_count = 0, result_code = ?
        WHERE id = ?
      `);
      updateStmt.run(accountId, new Date().toISOString(), result.resultCode, contact.id);

      const currentCount = state.messagesSentToday.get(accountId) || 0;
      state.messagesSentToday.set(accountId, currentCount + 1);

      const messagesSinceBreak = state.messagesSinceLastBreak.get(accountId) || 0;
      state.messagesSinceLastBreak.set(accountId, messagesSinceBreak + 1);

      console.log(`✅ Account ${accountId} added participant (${currentCount + 1}/${campaign.max_messages_per_day} today, ${messagesSinceBreak + 1} since last break)`);

      this.updateStats();

      this.notifyRenderer('campaign:progress', campaignId, {
        contactId: contact.id,
        status: 'sent',
        accountId,
        resultCode: result.resultCode
      });

      return { success: true };
    }

    if (result.resultCode === 'group_full') {
      const updateStmt = this.db.prepare(`
        UPDATE campaign_contacts
        SET status = 'failed', error = ?, result_code = ?
        WHERE id = ?
      `);
      updateStmt.run(result.message, result.resultCode, contact.id);
      this.markRemainingPendingContactsAsFailed(campaignId, result.message, result.resultCode);
      this.notifyRenderer('campaign:progress', campaignId, {
        contactId: contact.id,
        status: 'failed',
        accountId,
        resultCode: result.resultCode,
        error: result.message
      });
      return { success: false, finished: true, finishReason: `group is full (${result.message})` };
    }

    if (result.resultCode === 'not_admin' || result.resultCode === 'group_not_found' || result.resultCode === 'group_access_denied') {
      const releaseStmt = this.db.prepare(`
        UPDATE campaign_contacts
        SET status = 'pending', sent_by_account_id = NULL, error = NULL, result_code = NULL
        WHERE id = ?
      `);
      releaseStmt.run(contact.id);

      this.logActivity('error', `Campaign account ${accountId.substring(0, 8)}... cannot continue group adder campaign "${campaign.name}": ${result.resultCode} (${result.message})`, campaignId);

      return { success: false, finished: true, finishReason: `${result.resultCode} (${result.message})` };
    }

    if (result.resultCode === 'account_not_connected') {
      const releaseStmt = this.db.prepare(`
        UPDATE campaign_contacts
        SET status = 'pending', sent_by_account_id = NULL, error = NULL, result_code = NULL
        WHERE id = ?
      `);
      releaseStmt.run(contact.id);
      return { success: false };
    }

    const permanentFailure = result.resultCode !== 'unknown_error';

    if (permanentFailure) {
      const updateStmt = this.db.prepare(`
        UPDATE campaign_contacts
        SET status = 'failed', error = ?, result_code = ?
        WHERE id = ?
      `);
      updateStmt.run(result.message, result.resultCode, contact.id);

      this.notifyRenderer('campaign:progress', campaignId, {
        contactId: contact.id,
        status: 'failed',
        accountId,
        resultCode: result.resultCode,
        error: result.message
      });

      return { success: false };
    }

    const currentRetryCount = contact.retry_count || 0;
    const newRetryCount = currentRetryCount + 1;

    if (newRetryCount >= 2) {
      const updateStmt = this.db.prepare(`
        UPDATE campaign_contacts
        SET status = 'failed', error = ?, retry_count = ?, result_code = ?
        WHERE id = ?
      `);
      updateStmt.run(`Failed after 2 attempts: ${result.message}`, newRetryCount, result.resultCode, contact.id);

      this.notifyRenderer('campaign:progress', campaignId, {
        contactId: contact.id,
        status: 'failed',
        accountId,
        resultCode: result.resultCode,
        error: `Failed after 2 attempts: ${result.message}`
      });
    } else {
      const updateStmt = this.db.prepare(`
        UPDATE campaign_contacts
        SET status = 'pending', sent_by_account_id = NULL, error = NULL, retry_count = ?, result_code = ?
        WHERE id = ?
      `);
      updateStmt.run(newRetryCount, result.resultCode, contact.id);
    }

    return { success: false };
  }

  async startCampaign(campaignId: string): Promise<void> {
    // If campaign was paused/stopped, remove old state so it can restart
    const existingState = this.activeCampaigns.get(campaignId);
    if (existingState) {
      if (existingState.isRunning) {
        console.log(`ℹ️ Campaign ${campaignId} is already running`);
        return;
      }
      // Campaign was paused/stopped - clean up old state
      console.log(`🔄 Cleaning up paused/stopped campaign state for restart`);
      for (const timeout of existingState.accountTimeouts.values()) {
        clearTimeout(timeout);
      }
      existingState.accountTimeouts.clear();
      existingState.activeAccounts.clear();
      this.activeCampaigns.delete(campaignId);
    }

    // Get campaign info
    const campaign = this.getCampaign(campaignId);
    if (!campaign) {
      console.error(`Campaign ${campaignId} not found`);
      return;
    }

    // Get participating accounts
    const accountsStmt = this.db.prepare(`
      SELECT account_id FROM campaign_accounts WHERE campaign_id = ?
    `);
    let accountIds = (accountsStmt.all(campaignId) as any[]).map(row => row.account_id);

    if (accountIds.length === 0) {
      console.error('No accounts assigned to campaign');
      throw new Error('No accounts assigned to campaign');
    }

    accountIds = await this.getEligibleAccountsForCampaign(campaignId, campaign, accountIds);

    if (accountIds.length === 0) {
      throw new Error(this.isGroupAdderCampaign(campaign)
        ? 'No eligible connected accounts can access the selected group'
        : 'No eligible accounts assigned to campaign');
    }

    // Update campaign status (only if not already running)
    const stmt = this.db.prepare(`
      UPDATE campaigns 
      SET status = 'running', started_at = COALESCE(started_at, ?), completed_at = NULL 
      WHERE id = ?
    `);
    stmt.run(new Date().toISOString(), campaignId);

    // Initialize campaign state
    const today = new Date().toISOString().split('T')[0];
    const state: CampaignState = {
      isRunning: true,
      runId: uuidv4(),
      accountTimeouts: new Map(),
      activeAccounts: new Set(accountIds),
      messagesSentToday: new Map(),
      messagesSinceLastBreak: new Map(),
      lastResetDate: today
    };

    // Query database for messages already sent today by each account
    // This ensures daily limit is respected after app restart
    for (const accountId of accountIds) {
      const sentTodayStmt = this.db.prepare(`
        SELECT COUNT(*) as count 
        FROM campaign_contacts 
        WHERE campaign_id = ? 
          AND sent_by_account_id = ? 
          AND status = 'sent'
          AND DATE(sent_at) = ?
      `);
      const result = sentTodayStmt.get(campaignId, accountId, today) as any;
      const alreadySent = result?.count || 0;

      if (alreadySent > 0) {
        console.log(`📊 Account ${accountId.substring(0, 8)}... already sent ${alreadySent} messages today`);
        state.messagesSentToday.set(accountId, alreadySent);
      }
    }

    this.activeCampaigns.set(campaignId, state);

    // Start sending messages from ALL accounts in parallel
    console.log(`🚀 Starting campaign ${campaignId} with ${accountIds.length} accounts in parallel`);
    for (const accountId of accountIds) {
      void this.scheduleNextMessageForAccount(campaignId, accountId, state.runId);
    }
  }

  async pauseCampaign(campaignId: string): Promise<void> {
    const state = this.activeCampaigns.get(campaignId);
    if (state) {
      state.isRunning = false;
      // Clear all account timeouts
      for (const timeout of state.accountTimeouts.values()) {
        clearTimeout(timeout);
      }
      state.accountTimeouts.clear();
      state.activeAccounts.clear();
    }

    const stmt = this.db.prepare("UPDATE campaigns SET status = 'paused' WHERE id = ?");
    stmt.run(campaignId);
  }

  async stopCampaign(campaignId: string): Promise<void> {
    const state = this.activeCampaigns.get(campaignId);
    if (state) {
      state.isRunning = false;
      // Clear all account timeouts
      for (const timeout of state.accountTimeouts.values()) {
        clearTimeout(timeout);
      }
      state.accountTimeouts.clear();
      state.activeAccounts.clear();
      this.activeCampaigns.delete(campaignId);
    }

    const stmt = this.db.prepare(`
      UPDATE campaigns 
      SET status = 'stopped', completed_at = NULL 
      WHERE id = ?
    `);
    stmt.run(campaignId);
  }

  async resetCampaign(campaignId: string): Promise<void> {
    // Stop if running
    await this.stopCampaign(campaignId);

    // Reset all contacts to pending
    const stmt = this.db.prepare(`
      UPDATE campaign_contacts 
      SET status = 'pending', 
          sent_by_account_id = NULL, 
          sent_at = NULL, 
          error = NULL,
          retry_count = 0
      WHERE campaign_id = ?
    `);
    stmt.run(campaignId);

    // Update campaign status
    const updateStmt = this.db.prepare(`
      UPDATE campaigns 
      SET status = 'draft', started_at = NULL, completed_at = NULL 
      WHERE id = ?
    `);
    updateStmt.run(campaignId);

    console.log(`✅ Campaign ${campaignId} reset successfully`);
  }

  private getActiveCampaignState(campaignId: string, runId: string, accountId?: string): CampaignState | null {
    const state = this.activeCampaigns.get(campaignId);
    if (!state || !state.isRunning || state.runId !== runId) {
      return null;
    }

    if (accountId && !state.activeAccounts.has(accountId)) {
      return null;
    }

    return state;
  }

  private scheduleAccountTimeout(campaignId: string, accountId: string, delay: number, runId: string): void {
    const state = this.getActiveCampaignState(campaignId, runId, accountId);
    if (!state) {
      return;
    }

    const existingTimeout = state.accountTimeouts.get(accountId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      const currentState = this.getActiveCampaignState(campaignId, runId, accountId);
      if (!currentState) {
        return;
      }

      currentState.accountTimeouts.delete(accountId);
      void this.scheduleNextMessageForAccount(campaignId, accountId, runId);
    }, delay);

    state.accountTimeouts.set(accountId, timeout);
  }

  private finishAccountRun(campaignId: string, accountId: string, runId: string): CampaignState | null {
    const state = this.getActiveCampaignState(campaignId, runId);
    if (!state) {
      return null;
    }

    const timeout = state.accountTimeouts.get(accountId);
    if (timeout) {
      clearTimeout(timeout);
      state.accountTimeouts.delete(accountId);
    }

    state.activeAccounts.delete(accountId);
    return state;
  }

  private async scheduleNextMessageForAccount(campaignId: string, accountId: string, runId: string): Promise<void> {
    const state = this.getActiveCampaignState(campaignId, runId, accountId);
    if (!state) {
      console.log(`📊 Campaign ${campaignId} is not running - stopping account ${accountId.substring(0, 8)}...`);
      return;
    }

    // Check if we're within working hours
    const campaign = this.getCampaign(campaignId);
    if (!campaign) {
      console.log(`❌ Campaign ${campaignId} not found in database`);
      return;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const timestamp = now.toLocaleTimeString();
    const sentToday = state.messagesSentToday.get(accountId) || 0;

    console.log(`📊 ⏰ [${timestamp}] Campaign cycle for ${accountId.substring(0, 8)}... (sent today: ${sentToday}/${campaign.max_messages_per_day})`);

    // Check working hours
    if (currentHour < campaign.start_hour || currentHour >= campaign.end_hour) {
      // Schedule next check at start_hour
      const tomorrow = new Date(now);
      tomorrow.setHours(campaign.start_hour, 0, 0, 0);

      if (currentHour >= campaign.end_hour) {
        // If after end_hour, schedule for tomorrow
        tomorrow.setDate(tomorrow.getDate() + 1);
      }

      const delay = tomorrow.getTime() - now.getTime();
      console.log(`📊 Outside working hours (${currentHour}:00) - next attempt at ${tomorrow.toLocaleString()}`);

      this.scheduleAccountTimeout(campaignId, accountId, delay, runId);
      return;
    }

    // Reset daily counters if needed
    this.resetDailyCountersIfNeeded(campaignId);

    let result: SendNextMessageResult;

    try {
      result = await this.sendNextMessageFromAccount(campaignId, accountId, runId);
    } catch (error: any) {
      console.error(`❌ Error sending message for campaign ${campaignId} from account ${accountId}:`, error);
      result = { success: false };
    }

    if (result.finished) {
      console.log(`📊 Account ${accountId.substring(0, 8)}... finished - ${result.finishReason || 'no more contacts to send'}`);
      const currentState = this.finishAccountRun(campaignId, accountId, runId);
      if (currentState && currentState.activeAccounts.size === 0) {
        console.log(`✅ All accounts finished for campaign ${campaignId}`);
        await this.completeCampaign(campaignId);
      }
      return;
    }

    if (!this.getActiveCampaignState(campaignId, runId, accountId)) {
      return;
    }

    // Schedule next message (whether success or failure)
    // If failed, use shorter delay for retry
    let delay: number;
    if (result.delayMs !== undefined) {
      delay = result.delayMs;
    } else if (result.success) {
      // Check if account needs a break
      const messagesSinceBreak = state.messagesSinceLastBreak.get(accountId) || 0;
      const needsBreak = campaign.messages_before_break && campaign.break_duration && messagesSinceBreak >= campaign.messages_before_break;

      if (needsBreak) {
        // Take a break
        delay = campaign.break_duration! * 60 * 1000; // Convert minutes to milliseconds
        console.log(`☕ Account ${accountId.substring(0, 8)}... taking ${campaign.break_duration} minute break after ${messagesSinceBreak} messages`);

        // Reset break counter
        state.messagesSinceLastBreak.set(accountId, 0);
      } else {
        // Regular delay
        delay = getRandomDelay(campaign.min_delay, campaign.max_delay) * 1000;
        console.log(`✅ Next campaign message from ${accountId.substring(0, 8)}... in ${Math.floor(delay / 1000)} seconds`);
      }
    } else {
      delay = getRandomDelay(60, 120) * 1000; // 1-2 minutes retry
      console.log(`⚠️ Retry campaign from ${accountId.substring(0, 8)}... in ${Math.floor(delay / 1000)} seconds`);
     }
 
     this.scheduleAccountTimeout(campaignId, accountId, delay, runId);
   }
 
  private claimNextPendingContact(campaignId: string, accountId: string, campaign: any): any | null {
    let contactQuery = `
      SELECT cc.* FROM campaign_contacts cc
      WHERE cc.campaign_id = ? AND cc.status = 'pending'
      AND cc.phone_number NOT IN (
        SELECT c.phone_number FROM contacts c
        JOIN contact_tags ct ON c.id = ct.contact_id
        JOIN tags t ON ct.tag_id = t.id
        WHERE t.name = 'BlackList'
      )
    `;
    
    // Add filter for recent contacts if enabled
    if (campaign.skip_recent_contacts && campaign.skip_recent_days) {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - campaign.skip_recent_days);
      const cutoffDate = daysAgo.toISOString();
      
      console.log(`📋 Skip recent contacts ENABLED: ${campaign.skip_recent_days} days (since ${cutoffDate})`);
      
      // Use normalized phone matching - compare digits only
      contactQuery += `
        AND NOT EXISTS (
          SELECT 1 FROM messages 
          WHERE is_from_me = 1 
          AND timestamp >= '${cutoffDate}'
          AND (
            REPLACE(REPLACE(REPLACE(to_number, '-', ''), ' ', ''), '+', '') = REPLACE(REPLACE(REPLACE(cc.phone_number, '-', ''), ' ', ''), '+', '')
            OR REPLACE(REPLACE(REPLACE(to_number, '-', ''), ' ', ''), '+', '') LIKE '%' || SUBSTR(REPLACE(REPLACE(REPLACE(cc.phone_number, '-', ''), ' ', ''), '+', ''), -9)
            OR REPLACE(REPLACE(REPLACE(cc.phone_number, '-', ''), ' ', ''), '+', '') LIKE '%' || SUBSTR(REPLACE(REPLACE(REPLACE(to_number, '-', ''), ' ', ''), '+', ''), -9)
          )
        )
      `;
      
      console.log(`📋 Query will filter contacts who received messages in last ${campaign.skip_recent_days} days`);
    } else {
      console.log(`📋 Skip recent contacts DISABLED`);
    }
    
    contactQuery += ` LIMIT 1`;

    const claimContact = this.db.transaction(() => {
      const contactStmt = this.db.prepare(contactQuery);
      const contact = contactStmt.get(campaignId) as any;
      if (!contact) {
        return null;
      }

      const claimStmt = this.db.prepare(`
        UPDATE campaign_contacts 
        SET status = 'sending', sent_by_account_id = ?, error = NULL
        WHERE id = ? AND status = 'pending'
      `);
      const claimResult = claimStmt.run(accountId, contact.id);
      if (claimResult.changes === 0) {
        return null;
      }

      return { ...contact, status: 'sending', sent_by_account_id: accountId };
    });

    return claimContact();
  }

  private async sendNextMessageFromAccount(campaignId: string, accountId: string, runId: string): Promise<SendNextMessageResult> {
    const campaign = this.getCampaign(campaignId);
    if (!campaign) {
      return { success: false, finished: true };
    }

    const state = this.getActiveCampaignState(campaignId, runId, accountId);
    if (!state) {
      return { success: false, finished: true };
    }

    // Check if account reached daily limit
    const sentToday = state.messagesSentToday.get(accountId) || 0;
    if (sentToday >= campaign.max_messages_per_day) {
      console.log(`📊 Account ${accountId} reached daily limit (${sentToday}/${campaign.max_messages_per_day})`);
      console.log(`   Will resume tomorrow after midnight reset`);
      
      // Don't stop completely! Schedule for tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(campaign.start_hour, 0, 0, 0);
      
      const delay = tomorrow.getTime() - Date.now();
      console.log(`   Next attempt at ${tomorrow.toLocaleString()}`);
      
      return { success: false, delayMs: delay };
    }

    // Check if account is connected BEFORE claiming a contact
    if (!this.whatsappManager.isConnected(accountId)) {
      console.log(`⚠️ Account ${accountId.substring(0, 8)}... is not connected - skipping this cycle`);
      
      // Release any stuck contacts that this account might have claimed before
      const releaseStmt = this.db.prepare(`
        UPDATE campaign_contacts 
        SET status = 'pending', sent_by_account_id = NULL
        WHERE campaign_id = ? AND status = 'sending' AND sent_by_account_id = ?
      `);
      const released = releaseStmt.run(campaignId, accountId);
      if (released.changes > 0) {
        console.log(`   Released ${released.changes} stuck contacts back to pending`);
      }
      
      // Don't claim any new contact - just skip and retry later
      // Timeout will be set at end of scheduleNextMessageForAccount
      return { success: false };
    }

    // CLAIM PATTERN: Get next pending contact and immediately mark as 'sending'
    // This prevents other accounts from taking the same contact
    // IMPORTANT: Skip contacts in BlackList and skip recent contacts if enabled
    const contact = this.claimNextPendingContact(campaignId, accountId, campaign);

    if (contact) {
      console.log(`📞 Selected contact: ${contact.phone_number}`);
      
      // Debug: check if this contact received messages recently
      if (campaign.skip_recent_contacts && campaign.skip_recent_days) {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - campaign.skip_recent_days);
        const cutoffDate = daysAgo.toISOString();
        
        const debugStmt = this.db.prepare(`
          SELECT COUNT(*) as count, MAX(timestamp) as last_sent FROM messages 
          WHERE is_from_me = 1 
          AND timestamp >= ?
          AND (
            REPLACE(REPLACE(REPLACE(to_number, '-', ''), ' ', ''), '+', '') = REPLACE(REPLACE(REPLACE(?, '-', ''), ' ', ''), '+', '')
            OR REPLACE(REPLACE(REPLACE(to_number, '-', ''), ' ', ''), '+', '') LIKE '%' || SUBSTR(REPLACE(REPLACE(REPLACE(?, '-', ''), ' ', ''), '+', ''), -9)
            OR REPLACE(REPLACE(REPLACE(?, '-', ''), ' ', ''), '+', '') LIKE '%' || SUBSTR(REPLACE(REPLACE(REPLACE(to_number, '-', ''), ' ', ''), '+', ''), -9)
          )
        `);
        const debugResult = debugStmt.get(cutoffDate, contact.phone_number, contact.phone_number, contact.phone_number) as any;
        
        if (debugResult.count > 0) {
          console.warn(`⚠️ WARNING: Contact ${contact.phone_number} received ${debugResult.count} message(s) recently (last: ${debugResult.last_sent})`);
          console.warn(`   This should have been filtered! Checking why...`);
        } else {
          console.log(`✅ Contact ${contact.phone_number} passed recent filter (no messages in last ${campaign.skip_recent_days} days)`);
        }
      }
    }

    if (!contact) {
      // Check if there are blacklisted contacts that were skipped
      const blacklistedStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM campaign_contacts cc
        WHERE cc.campaign_id = ? AND cc.status = 'pending'
        AND cc.phone_number IN (
          SELECT c.phone_number FROM contacts c
          JOIN contact_tags ct ON c.id = ct.contact_id
          JOIN tags t ON ct.tag_id = t.id
          WHERE t.name = 'BlackList'
        )
      `);
      const blacklistedResult = blacklistedStmt.get(campaignId) as any;
      
      if (blacklistedResult && blacklistedResult.count > 0) {
        console.log(`🚫 ${blacklistedResult.count} contacts skipped due to BlackList`);
        
        // Mark them as 'skipped' instead of leaving as 'pending'
        const markSkippedStmt = this.db.prepare(`
          UPDATE campaign_contacts 
          SET status = 'failed', error = 'Contact in BlackList'
          WHERE campaign_id = ? AND status = 'pending'
          AND phone_number IN (
            SELECT c.phone_number FROM contacts c
            JOIN contact_tags ct ON c.id = ct.contact_id
            JOIN tags t ON ct.tag_id = t.id
            WHERE t.name = 'BlackList'
          )
        `);
        markSkippedStmt.run(campaignId);
      }
      
      // Check for contacts skipped due to recent messages
      if (campaign.skip_recent_contacts && campaign.skip_recent_days) {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - campaign.skip_recent_days);
        const cutoffDate = daysAgo.toISOString();
        
        // Count contacts that should be skipped (using normalized phone matching)
        const recentContactsStmt = this.db.prepare(`
          SELECT COUNT(*) as count FROM campaign_contacts cc
          WHERE cc.campaign_id = ? AND cc.status = 'pending'
          AND EXISTS (
            SELECT 1 FROM messages 
            WHERE is_from_me = 1 
            AND timestamp >= ?
            AND (
              REPLACE(REPLACE(REPLACE(to_number, '-', ''), ' ', ''), '+', '') = REPLACE(REPLACE(REPLACE(cc.phone_number, '-', ''), ' ', ''), '+', '')
              OR REPLACE(REPLACE(REPLACE(to_number, '-', ''), ' ', ''), '+', '') LIKE '%' || SUBSTR(REPLACE(REPLACE(REPLACE(cc.phone_number, '-', ''), ' ', ''), '+', ''), -9)
              OR REPLACE(REPLACE(REPLACE(cc.phone_number, '-', ''), ' ', ''), '+', '') LIKE '%' || SUBSTR(REPLACE(REPLACE(REPLACE(to_number, '-', ''), ' ', ''), '+', ''), -9)
            )
          )
        `);
        const recentContactsResult = recentContactsStmt.get(campaignId, cutoffDate) as any;
        
        if (recentContactsResult && recentContactsResult.count > 0) {
          console.log(`⏱️ ${recentContactsResult.count} contacts skipped - received messages in last ${campaign.skip_recent_days} days`);
          
          // Mark them as skipped (using normalized phone matching)
          const markRecentStmt = this.db.prepare(`
            UPDATE campaign_contacts 
            SET status = 'failed', error = ?
            WHERE campaign_id = ? AND status = 'pending'
            AND EXISTS (
              SELECT 1 FROM messages 
              WHERE is_from_me = 1 
              AND timestamp >= ?
              AND (
                REPLACE(REPLACE(REPLACE(to_number, '-', ''), ' ', ''), '+', '') = REPLACE(REPLACE(REPLACE(campaign_contacts.phone_number, '-', ''), ' ', ''), '+', '')
                OR REPLACE(REPLACE(REPLACE(to_number, '-', ''), ' ', ''), '+', '') LIKE '%' || SUBSTR(REPLACE(REPLACE(REPLACE(campaign_contacts.phone_number, '-', ''), ' ', ''), '+', ''), -9)
                OR REPLACE(REPLACE(REPLACE(campaign_contacts.phone_number, '-', ''), ' ', ''), '+', '') LIKE '%' || SUBSTR(REPLACE(REPLACE(REPLACE(to_number, '-', ''), ' ', ''), '+', ''), -9)
              )
            )
          `);
          markRecentStmt.run(
            `Skipped - received message in last ${campaign.skip_recent_days} days`,
            campaignId,
            cutoffDate
          );
        }
      }
      
      // No more pending contacts (excluding blacklisted)
      console.log(`✅ Account ${accountId} has no more pending contacts`);
      
      // Check if there are any contacts still in 'sending' status (stuck)
      const stuckStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM campaign_contacts 
        WHERE campaign_id = ? AND status = 'sending'
      `);
      const stuckResult = stuckStmt.get(campaignId) as any;
      
      if (stuckResult && stuckResult.count > 0) {
        console.log(`⚠️ Found ${stuckResult.count} contacts stuck in 'sending' status - will retry in 1 minute`);
        return { success: false, delayMs: 60000 };
      }
      
      return { success: false, finished: true, finishReason: 'no more pending contacts' };
    }

    if (this.isGroupAdderCampaign(campaign)) {
      return this.handleGroupAdderContact(campaignId, accountId, contact, state, campaign);
    }

    // Get contact details for variable replacement
    const contactDetailsStmt = this.db.prepare(`
      SELECT * FROM contacts WHERE phone_number = ?
    `);
    const contactDetails = contactDetailsStmt.get(contact.phone_number) as any;

    // Replace variables in message
    const variables: Record<string, string> = {
      name: contactDetails?.name || contact.phone_number,
      phone: contact.phone_number,
      custom1: '',
      custom2: ''
    };
    
    const message = replaceVariables(campaign.message, variables);

    try {
      // Check if campaign has media attached
      if (campaign.media_path && campaign.media_type) {
        // Send media with optional caption
        const caption = campaign.media_caption || message;
        await this.whatsappManager.sendMediaFromPath(accountId, contact.phone_number, campaign.media_path, caption, false);
      } else {
        // Send text message only
        await this.whatsappManager.sendMessage(accountId, contact.phone_number, message, false);
      }

      // Update contact status
      const updateStmt = this.db.prepare(`
        UPDATE campaign_contacts 
        SET status = 'sent', sent_by_account_id = ?, sent_at = ?, error = NULL, retry_count = 0
        WHERE id = ?
      `);
      updateStmt.run(accountId, new Date().toISOString(), contact.id);

      // Increment counters
      const currentCount = state.messagesSentToday.get(accountId) || 0;
      state.messagesSentToday.set(accountId, currentCount + 1);
      
      const messagesSinceBreak = state.messagesSinceLastBreak.get(accountId) || 0;
      state.messagesSinceLastBreak.set(accountId, messagesSinceBreak + 1);

      console.log(`✅ Account ${accountId} sent message (${currentCount + 1}/${campaign.max_messages_per_day} today, ${messagesSinceBreak + 1} since last break)`);

      // Update stats
      this.updateStats();

      // Notify renderer
      this.notifyRenderer('campaign:progress', campaignId, {
        contactId: contact.id,
        status: 'sent',
        accountId
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to send message:', error);
      
      const errorMsg = (error as Error).message?.toLowerCase() || '';
      
      // Determine if this is a permanent failure or temporary issue
      const isPermanentFailure = 
        // Account issues
        errorMsg.includes('banned') || 
        errorMsg.includes('blocked') || 
        errorMsg.includes('restricted') ||
        errorMsg.includes('account has been') ||
        
        // Phone number/Contact issues
        errorMsg.includes('not registered') ||
        errorMsg.includes('phone number not registered') ||
        errorMsg.includes('invalid phone') ||
        errorMsg.includes('phone number must include') ||
        errorMsg.includes('invalid number') ||
        errorMsg.includes('does not exist') ||
        errorMsg.includes('chat not found') ||
        errorMsg.includes('contact not found') ||
        errorMsg.includes('recipient not found') ||
        errorMsg.includes('recipient not available') ||
        errorMsg.includes('user not found') ||
        errorMsg.includes('number is not on whatsapp') ||
        errorMsg.includes('no lid for user') ||  // Number doesn't exist on WhatsApp
        
        // Block/Privacy issues  
        errorMsg.includes('you have been blocked') ||
        errorMsg.includes('this contact blocked you') ||
        errorMsg.includes('privacy settings') ||
        errorMsg.includes('cannot send message to this contact') ||
        
        // Invalid format
        errorMsg.includes('invalid format') ||
        errorMsg.includes('malformed') ||
        errorMsg.includes('invalid input');
      
      if (isPermanentFailure) {
        // Mark as permanently failed - don't retry
        console.log(`❌ Permanent failure for contact ${contact.phone_number}: ${errorMsg}`);
        console.log(`   Marking as 'failed' - will not retry`);
        
        const updateStmt = this.db.prepare(`
          UPDATE campaign_contacts 
          SET status = 'failed', error = ?
          WHERE id = ?
        `);
        updateStmt.run((error as Error).message, contact.id);
        
        this.notifyRenderer('campaign:progress', campaignId, {
          contactId: contact.id,
          status: 'failed',
          error: (error as Error).message
        });
      } else {
        // For temporary errors (not ready, timeout, network issues, etc)
        // Check retry count - max 2 attempts
        const currentRetryCount = contact.retry_count || 0;
        const newRetryCount = currentRetryCount + 1;
        
        console.log(`⚠️ Temporary error for contact ${contact.phone_number}: ${errorMsg}`);
        console.log(`   Retry attempt ${newRetryCount}/2`);
        
        if (newRetryCount >= 2) {
          // Max retries reached - mark as failed
          console.log(`❌ Max retries (2) reached - marking as failed`);
          
          const updateStmt = this.db.prepare(`
            UPDATE campaign_contacts 
            SET status = 'failed', error = ?, retry_count = ?
            WHERE id = ?
          `);
          updateStmt.run(`Failed after 2 attempts: ${(error as Error).message}`, newRetryCount, contact.id);
          
          this.notifyRenderer('campaign:progress', campaignId, {
            contactId: contact.id,
            status: 'failed',
            error: `Failed after 2 attempts: ${(error as Error).message}`
          });
        } else {
          // Still have retries left - return to pending
          console.log(`   Returning to 'pending' pool for retry (${2 - newRetryCount} attempts left)`);
          
          const updateStmt = this.db.prepare(`
            UPDATE campaign_contacts 
            SET status = 'pending', sent_by_account_id = NULL, error = NULL, retry_count = ?
            WHERE id = ?
          `);
          updateStmt.run(newRetryCount, contact.id);
        }
      }

      return { success: false };
    }
  }

  private getCampaign(campaignId: string): any {
    const stmt = this.db.prepare('SELECT * FROM campaigns WHERE id = ?');
    return stmt.get(campaignId);
  }

  private async completeCampaign(campaignId: string): Promise<void> {
    const campaign = this.getCampaign(campaignId);
    if (!campaign) return;
    
    console.log(`✅ All accounts finished for campaign ${campaignId}`);
    
    // Mark any remaining BlackList contacts as failed
    const markBlacklistStmt = this.db.prepare(`
      UPDATE campaign_contacts 
      SET status = 'failed', error = 'Contact in BlackList - skipped'
      WHERE campaign_id = ? AND status = 'pending'
      AND phone_number IN (
        SELECT c.phone_number FROM contacts c
        JOIN contact_tags ct ON c.id = ct.contact_id
        JOIN tags t ON ct.tag_id = t.id
        WHERE t.name = 'BlackList'
      )
    `);
    const blacklistResult = markBlacklistStmt.run(campaignId);
    if (blacklistResult.changes > 0) {
      console.log(`🚫 Marked ${blacklistResult.changes} remaining BlackList contacts as failed`);
    }
    
    // Mark any remaining recent contacts as failed if skip_recent_contacts is enabled
    if (campaign.skip_recent_contacts && campaign.skip_recent_days) {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - campaign.skip_recent_days);
      const cutoffDate = daysAgo.toISOString();
      
      console.log(`🔍 Marking recent contacts as failed (${campaign.skip_recent_days} days, since ${cutoffDate})`);
      
      // Use normalized phone matching
      const markRecentStmt = this.db.prepare(`
        UPDATE campaign_contacts 
        SET status = 'failed', error = ?
        WHERE campaign_id = ? AND status = 'pending'
        AND EXISTS (
          SELECT 1 FROM messages 
          WHERE is_from_me = 1 
          AND timestamp >= ?
          AND (
            REPLACE(REPLACE(REPLACE(to_number, '-', ''), ' ', ''), '+', '') = REPLACE(REPLACE(REPLACE(campaign_contacts.phone_number, '-', ''), ' ', ''), '+', '')
            OR REPLACE(REPLACE(REPLACE(to_number, '-', ''), ' ', ''), '+', '') LIKE '%' || SUBSTR(REPLACE(REPLACE(REPLACE(campaign_contacts.phone_number, '-', ''), ' ', ''), '+', ''), -9)
            OR REPLACE(REPLACE(REPLACE(campaign_contacts.phone_number, '-', ''), ' ', ''), '+', '') LIKE '%' || SUBSTR(REPLACE(REPLACE(REPLACE(to_number, '-', ''), ' ', ''), '+', ''), -9)
          )
        )
      `);
      const recentResult = markRecentStmt.run(
        `Skipped - received message in last ${campaign.skip_recent_days} days`,
        campaignId,
        cutoffDate
      );
      console.log(`⏱️ Marked ${recentResult.changes} recent contacts as failed`);
    } else {
      console.log(`ℹ️ Skip recent contacts not enabled, skipping this step`);
    }
    
    // Double check - are there really no pending contacts?
    const finalCheckStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM campaign_contacts 
      WHERE campaign_id = ? AND status = 'pending'
    `);
    const finalCheck = finalCheckStmt.get(campaignId) as any;
    
    if (finalCheck && finalCheck.count > 0) {
      console.log(`⚠️ Still ${finalCheck.count} pending contacts - campaign should not complete yet`);

      const activeState = this.activeCampaigns.get(campaignId);
      if (activeState && activeState.activeAccounts.size === 0) {
        activeState.isRunning = false;
        for (const timeout of activeState.accountTimeouts.values()) {
          clearTimeout(timeout);
        }
        activeState.accountTimeouts.clear();
        this.activeCampaigns.delete(campaignId);
        console.log(`⏸️ No active accounts remain for campaign ${campaignId} - pausing with pending contacts still queued`);
        const pauseStmt = this.db.prepare(`
          UPDATE campaigns
          SET status = 'paused'
          WHERE id = ?
        `);
        pauseStmt.run(campaignId);
        this.logActivity('error', `Campaign "${campaign?.name || 'Unknown'}" paused because no active accounts could process remaining contacts`, campaignId);
        this.notifyRenderer('campaign:error', campaignId, {
          message: 'No active accounts could process the remaining campaign contacts'
        });
      }

      return;
    }
    
    // Truly complete (all sent, failed, or blacklisted)
    console.log(`🎉 Campaign ${campaignId} is complete - marking as completed`);
    await this.stopCampaign(campaignId);
    
    const stmt = this.db.prepare(`
      UPDATE campaigns 
      SET status = 'completed', completed_at = ? 
      WHERE id = ?
    `);
    stmt.run(new Date().toISOString(), campaignId);
    
    this.logActivity('success', `Campaign "${campaign?.name || 'Unknown'}" completed`, campaignId);
    this.notifyRenderer('campaign:completed', campaignId);
  }

  private resetDailyCountersIfNeeded(campaignId: string): void {
    const state = this.activeCampaigns.get(campaignId);
    if (!state) return;

    const today = new Date().toISOString().split('T')[0];
    if (state.lastResetDate !== today) {
      state.messagesSentToday.clear();
      state.lastResetDate = today;
    }
  }

  private startDailyReset(): void {
    // Reset at midnight every day
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      // Reset all daily counters
      for (const [campaignId, state] of this.activeCampaigns) {
        state.messagesSentToday.clear();
        state.lastResetDate = new Date().toISOString().split('T')[0];
      }

      // Schedule next reset
      this.startDailyReset();
    }, msUntilMidnight);
  }

  private updateStats(): void {
    const today = new Date().toISOString().split('T')[0];
    
    const stmt = this.db.prepare(`
      INSERT INTO stats (date, messages_sent)
      VALUES (?, 1)
      ON CONFLICT(date) DO UPDATE SET messages_sent = messages_sent + 1
    `);
    
    stmt.run(today);
  }

  private notifyRenderer(channel: string, ...args: any[]): void {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      mainWindow.webContents.send(channel, ...args);
    }
  }
}
