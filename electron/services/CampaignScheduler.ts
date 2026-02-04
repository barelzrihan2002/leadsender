import type { Database } from 'better-sqlite3';
import type { WhatsAppManager } from './WhatsAppManager';
import { BrowserWindow } from 'electron';
import { replaceVariables, getRandomDelay } from '../../src/lib/utils';
import { v4 as uuidv4 } from 'uuid';

interface CampaignState {
  isRunning: boolean;
  accountTimeouts: Map<string, NodeJS.Timeout>; // accountId -> timeout
  messagesSentToday: Map<string, number>; // accountId -> count
  lastResetDate: string;
}

export class CampaignScheduler {
  private db: Database;
  private whatsappManager: WhatsAppManager;
  private activeCampaigns: Map<string, CampaignState> = new Map();

  constructor(db: Database, whatsappManager: WhatsAppManager) {
    this.db = db;
    this.whatsappManager = whatsappManager;

    // Resume any running campaigns from before app closed
    this.resumeRunningCampaigns();

    // Reset daily counters at midnight
    this.startDailyReset();
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
              this.startCampaign(campaign.id);
              this.logActivity('campaign', `Campaign "${campaign.name}" auto-resumed after app restart`, campaign.id);
            } else if (currentHour < campaign.start_hour) {
              // לפני שעת ההתחלה - חכה עד שעת ההתחלה היום
              const nextStart = new Date(now);
              nextStart.setHours(campaign.start_hour, 0, 0, 0);
              const delay = nextStart.getTime() - now.getTime();
              
              console.log(`⏰ Before working hours (${currentHour}:00) - will start at ${nextStart.toLocaleTimeString()}`);
              
              setTimeout(() => {
                console.log(`✅ Starting campaign at working hours: "${campaign.name}"`);
                this.startCampaign(campaign.id);
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
                this.startCampaign(campaign.id);
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

  async startCampaign(campaignId: string): Promise<void> {
    if (this.activeCampaigns.has(campaignId)) {
      console.log(`ℹ️ Campaign ${campaignId} is already running`);
      return;
    }

    // Get campaign info
    const campaign = this.getCampaign(campaignId);
    if (!campaign) {
      console.error(`Campaign ${campaignId} not found`);
      return;
    }

    // Update campaign status (only if not already running)
    const stmt = this.db.prepare(`
      UPDATE campaigns 
      SET status = 'running', started_at = COALESCE(started_at, ?) 
      WHERE id = ?
    `);
    stmt.run(new Date().toISOString(), campaignId);

    // Get participating accounts
    const accountsStmt = this.db.prepare(`
      SELECT account_id FROM campaign_accounts WHERE campaign_id = ?
    `);
    const accountIds = (accountsStmt.all(campaignId) as any[]).map(row => row.account_id);

    if (accountIds.length === 0) {
      console.error('No accounts assigned to campaign');
      return;
    }

    // Initialize campaign state
    this.activeCampaigns.set(campaignId, {
      isRunning: true,
      accountTimeouts: new Map(),
      messagesSentToday: new Map(),
      lastResetDate: new Date().toISOString().split('T')[0]
    });

    // Start sending messages from ALL accounts in parallel
    console.log(`🚀 Starting campaign ${campaignId} with ${accountIds.length} accounts in parallel`);
    for (const accountId of accountIds) {
      this.scheduleNextMessageForAccount(campaignId, accountId);
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
      this.activeCampaigns.delete(campaignId);
    }

    const stmt = this.db.prepare(`
      UPDATE campaigns 
      SET status = 'stopped', completed_at = ? 
      WHERE id = ?
    `);
    stmt.run(new Date().toISOString(), campaignId);
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
          error = NULL
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

  private async scheduleNextMessageForAccount(campaignId: string, accountId: string): Promise<void> {
    const state = this.activeCampaigns.get(campaignId);
    if (!state || !state.isRunning) {
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
      
      const timeout = setTimeout(() => this.scheduleNextMessageForAccount(campaignId, accountId), delay);
      state.accountTimeouts.set(accountId, timeout);
      return;
    }

    // Reset daily counters if needed
    this.resetDailyCountersIfNeeded(campaignId);

    let sendSuccessful = false;
    try {
      await this.sendNextMessageFromAccount(campaignId, accountId);
      sendSuccessful = true;
    } catch (error) {
      console.error(`❌ Error sending message for campaign ${campaignId} from account ${accountId}:`, error);
      sendSuccessful = false;
    }

    // Always schedule next message (whether success or failure)
    // If failed, use shorter delay for retry
    let delay: number;
    if (sendSuccessful) {
      delay = getRandomDelay(campaign.min_delay, campaign.max_delay) * 1000;
      console.log(`✅ Next campaign message from ${accountId.substring(0, 8)}... in ${Math.floor(delay / 1000)} seconds`);
    } else {
      delay = getRandomDelay(60, 120) * 1000; // 1-2 minutes retry
      console.log(`⚠️ Retry campaign from ${accountId.substring(0, 8)}... in ${Math.floor(delay / 1000)} seconds`);
    }
    
    const timeout = setTimeout(() => this.scheduleNextMessageForAccount(campaignId, accountId), delay);
    state.accountTimeouts.set(accountId, timeout);
  }

  private async sendNextMessageFromAccount(campaignId: string, accountId: string): Promise<void> {
    const campaign = this.getCampaign(campaignId);
    if (!campaign) {
      return;
    }

    const state = this.activeCampaigns.get(campaignId)!;

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
      
      const timeout = setTimeout(() => this.scheduleNextMessageForAccount(campaignId, accountId), delay);
      state.accountTimeouts.set(accountId, timeout);
      return;
    }

    // Check if account is connected BEFORE claiming a contact
    if (!this.whatsappManager.isConnected(accountId)) {
      console.log(`⚠️ Account ${accountId.substring(0, 8)}... is not connected - skipping this cycle`);
      
      // Release any stuck contacts that this account might have claimed before
      const releaseStmt = this.db.prepare(`
        UPDATE campaign_contacts 
        SET status = 'pending'
        WHERE campaign_id = ? AND status = 'sending' AND sent_by_account_id IS NULL
      `);
      const released = releaseStmt.run(campaignId);
      if (released.changes > 0) {
        console.log(`   Released ${released.changes} stuck contacts back to pending`);
      }
      
      // Don't claim any new contact - just skip and retry later
      // Timeout will be set at end of scheduleNextMessageForAccount
      return;
    }

    // CLAIM PATTERN: Get next pending contact and immediately mark as 'sending'
    // This prevents other accounts from taking the same contact
    // IMPORTANT: Skip contacts in BlackList
    const contactStmt = this.db.prepare(`
      SELECT cc.* FROM campaign_contacts cc
      WHERE cc.campaign_id = ? AND cc.status = 'pending'
      AND cc.phone_number NOT IN (
        SELECT c.phone_number FROM contacts c
        JOIN contact_tags ct ON c.id = ct.contact_id
        JOIN tags t ON ct.tag_id = t.id
        WHERE t.name = 'BlackList'
      )
      LIMIT 1
    `);
    const contact = contactStmt.get(campaignId) as any;

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
        // Schedule retry to check again
        const timeout = setTimeout(() => this.scheduleNextMessageForAccount(campaignId, accountId), 60000);
        state.accountTimeouts.set(accountId, timeout);
        return;
      }
      
      // Truly no more contacts - stop this account's timeout
      const timeout = state.accountTimeouts.get(accountId);
      if (timeout) {
        clearTimeout(timeout);
        state.accountTimeouts.delete(accountId);
      }
      
      // If all accounts finished, complete campaign
      if (state.accountTimeouts.size === 0) {
        await this.stopCampaign(campaignId);
        
        const campaign = this.getCampaign(campaignId);
        
        const stmt = this.db.prepare(`
          UPDATE campaigns 
          SET status = 'completed', completed_at = ? 
          WHERE id = ?
        `);
        stmt.run(new Date().toISOString(), campaignId);
        
        this.logActivity('success', `Campaign "${campaign?.name || 'Unknown'}" completed`, campaignId);
        this.notifyRenderer('campaign:completed', campaignId);
      }
      return;
    }

    // CLAIM: Mark as 'sending' immediately so other accounts won't take it
    const claimStmt = this.db.prepare(`
      UPDATE campaign_contacts 
      SET status = 'sending'
      WHERE id = ?
    `);
    claimStmt.run(contact.id);

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
        SET status = 'sent', sent_by_account_id = ?, sent_at = ?
        WHERE id = ?
      `);
      updateStmt.run(accountId, new Date().toISOString(), contact.id);

      // Increment counter
      const currentCount = state.messagesSentToday.get(accountId) || 0;
      state.messagesSentToday.set(accountId, currentCount + 1);

      console.log(`✅ Account ${accountId} sent message (${currentCount + 1}/${campaign.max_messages_per_day} today)`);

      // Update stats
      this.updateStats();

      // Notify renderer
      this.notifyRenderer('campaign:progress', campaignId, {
        contactId: contact.id,
        status: 'sent',
        accountId
      });

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
        // Return to 'pending' so another account can try or this account can retry later
        console.log(`⚠️ Temporary error for contact ${contact.phone_number}: ${errorMsg}`);
        console.log(`   Returning to 'pending' pool for retry`);
        
        const updateStmt = this.db.prepare(`
          UPDATE campaign_contacts 
          SET status = 'pending'
          WHERE id = ?
        `);
        updateStmt.run(contact.id);
      }
    }
  }

  private getCampaign(campaignId: string): any {
    const stmt = this.db.prepare('SELECT * FROM campaigns WHERE id = ?');
    return stmt.get(campaignId);
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
