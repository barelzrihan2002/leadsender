import type { Database } from 'better-sqlite3';
import { BrowserWindow } from 'electron';
import type { WhatsAppManager } from './WhatsAppManager';
import { getRandomDelay } from '../../src/lib/utils';
import { v4 as uuidv4 } from 'uuid';

interface GroupCampaignRow {
  id: string;
  name: string;
  account_id: string;
  message: string | null;
  media_path: string | null;
  media_type: string | null;
  media_caption: string | null;
  days_of_week: string;
  send_hour: number;
  send_minute: number;
  min_delay: number;
  max_delay: number;
  status: string;
  last_run_date: string | null;
  created_at: string;
}

interface TargetGroupRow {
  group_id: string;
  group_name: string | null;
}

function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class GroupCampaignScheduler {
  private db: Database;
  private whatsappManager: WhatsAppManager;
  private tickInterval: NodeJS.Timeout | null = null;
  private runningCampaignIds: Set<string> = new Set();

  constructor(db: Database, whatsappManager: WhatsAppManager) {
    this.db = db;
    this.whatsappManager = whatsappManager;
  }

  start(): void {
    if (this.tickInterval) {
      return;
    }

    console.log('🗓️ GroupCampaignScheduler started - checking every 60s');

    // Run an initial check shortly after startup (covers app restarts that
    // happened right around a scheduled time), then every minute after that.
    setTimeout(() => void this.tick(), 5000);
    this.tickInterval = setInterval(() => void this.tick(), 60 * 1000);
  }

  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private notifyRenderer(channel: string, ...args: any[]): void {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      mainWindow.webContents.send(channel, ...args);
    }
  }

  private async tick(): Promise<void> {
    try {
      const stmt = this.db.prepare(`SELECT * FROM group_campaigns WHERE status = 'active'`);
      const campaigns = stmt.all() as GroupCampaignRow[];

      if (campaigns.length === 0) {
        return;
      }

      const now = new Date();
      const currentDay = now.getDay(); // 0 = Sunday ... 6 = Saturday
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const today = todayDateString();

      for (const campaign of campaigns) {
        if (this.runningCampaignIds.has(campaign.id)) {
          continue; // already running a cycle for this campaign
        }

        if (campaign.last_run_date === today) {
          continue; // already ran today
        }

        let days: number[] = [];
        try {
          days = JSON.parse(campaign.days_of_week || '[]');
        } catch {
          days = [];
        }

        if (!days.includes(currentDay)) {
          continue;
        }

        const scheduledMinutesOfDay = campaign.send_hour * 60 + campaign.send_minute;
        const currentMinutesOfDay = currentHour * 60 + currentMinute;

        if (currentMinutesOfDay < scheduledMinutesOfDay) {
          continue; // not time yet today
        }

        void this.runCampaignNow(campaign.id);
      }
    } catch (error) {
      console.error('❌ GroupCampaignScheduler tick failed:', error);
    }
  }

  async runCampaignNow(campaignId: string): Promise<void> {
    if (this.runningCampaignIds.has(campaignId)) {
      return;
    }

    this.runningCampaignIds.add(campaignId);

    try {
      const campaignStmt = this.db.prepare('SELECT * FROM group_campaigns WHERE id = ?');
      const campaign = campaignStmt.get(campaignId) as GroupCampaignRow | undefined;

      if (!campaign || campaign.status !== 'active') {
        return;
      }

      if (!this.whatsappManager.isConnected(campaign.account_id)) {
        console.log(`⏳ Group campaign "${campaign.name}" - account not connected, will retry next check`);
        return; // last_run_date stays untouched, so the next tick retries
      }

      const targetsStmt = this.db.prepare('SELECT group_id, group_name FROM group_campaign_targets WHERE campaign_id = ?');
      const allTargets = targetsStmt.all(campaignId) as TargetGroupRow[];

      if (allTargets.length === 0) {
        console.log(`⚠️ Group campaign "${campaign.name}" has no target groups configured`);
        return;
      }

      const today = todayDateString();

      // Skip groups that already got a successful send today (covers the
      // case where a previous attempt today was interrupted mid-run and the
      // scheduler is retrying - we don't want to double-post).
      const alreadySentStmt = this.db.prepare(`
        SELECT DISTINCT group_id FROM group_campaign_runs
        WHERE campaign_id = ? AND run_date = ? AND status = 'sent'
      `);
      const alreadySentGroupIds = new Set((alreadySentStmt.all(campaignId, today) as { group_id: string }[]).map(r => r.group_id));
      const targets = allTargets.filter(t => !alreadySentGroupIds.has(t.group_id));

      if (targets.length === 0) {
        // Everything was already sent today (e.g. scheduler retried after completion) - just finalize.
        this.db.prepare('UPDATE group_campaigns SET last_run_date = ? WHERE id = ?').run(today, campaignId);
        return;
      }

      console.log(`🚀 Running group campaign "${campaign.name}" - posting to ${targets.length} group(s)`);

      const insertRunStmt = this.db.prepare(`
        INSERT INTO group_campaign_runs (id, campaign_id, group_id, group_name, status, error, run_date, sent_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];

        // Re-check status/connection between each group in case the campaign
        // was paused/stopped or the account dropped mid-run.
        const liveCampaign = campaignStmt.get(campaignId) as GroupCampaignRow | undefined;
        if (!liveCampaign || liveCampaign.status !== 'active') {
          console.log(`⏸️ Group campaign "${campaign.name}" stopped mid-run - halting remaining sends`);
          break;
        }

        if (!this.whatsappManager.isConnected(campaign.account_id)) {
          console.log(`⚠️ Account disconnected mid-run for "${campaign.name}" - halting remaining sends for today`);
          break;
        }

        try {
          if (campaign.media_path) {
            await this.whatsappManager.sendMedia(
              campaign.account_id,
              target.group_id,
              campaign.media_path,
              campaign.media_caption || campaign.message || ''
            );
          } else {
            await this.whatsappManager.sendMessage(
              campaign.account_id,
              target.group_id,
              campaign.message || ''
            );
          }

          insertRunStmt.run(uuidv4(), campaignId, target.group_id, target.group_name, 'sent', null, today, new Date().toISOString());
          console.log(`✅ Group campaign "${campaign.name}" - sent to ${target.group_name || target.group_id}`);
        } catch (error) {
          const message = (error as Error).message || 'Unknown error';
          insertRunStmt.run(uuidv4(), campaignId, target.group_id, target.group_name, 'failed', message, today, new Date().toISOString());
          console.error(`❌ Group campaign "${campaign.name}" - failed for ${target.group_name || target.group_id}:`, message);
        }

        this.notifyRenderer('groupCampaign:progress', campaignId);

        if (i < targets.length - 1) {
          const delaySeconds = getRandomDelay(campaign.min_delay || 20, campaign.max_delay || 60);
          await sleep(delaySeconds * 1000);
        }
      }

      // Only mark as run-for-today if we actually attempted all groups
      // (i.e. we weren't halted early by a pause/stop/disconnect).
      const finalCampaign = campaignStmt.get(campaignId) as GroupCampaignRow | undefined;
      if (finalCampaign && finalCampaign.status === 'active' && this.whatsappManager.isConnected(campaign.account_id)) {
        this.db.prepare('UPDATE group_campaigns SET last_run_date = ? WHERE id = ?').run(today, campaignId);
      }

      this.notifyRenderer('groupCampaign:progress', campaignId);
    } finally {
      this.runningCampaignIds.delete(campaignId);
    }
  }
}
