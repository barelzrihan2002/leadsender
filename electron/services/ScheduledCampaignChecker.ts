import { Database } from '../database';
import { CampaignScheduler } from './CampaignScheduler';

/**
 * Service to check for scheduled campaigns and start them automatically
 * Checks every hour for campaigns that should be started
 */
export class ScheduledCampaignChecker {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

  constructor(
    private db: Database,
    private campaignScheduler: CampaignScheduler
  ) {}

  /**
   * Start the scheduled campaign checker
   */
  start() {
    console.log('🕐 Starting ScheduledCampaignChecker service...');
    
    // Check immediately on start
    this.checkScheduledCampaigns();
    
    // Then check every hour
    this.intervalId = setInterval(() => {
      this.checkScheduledCampaigns();
    }, this.CHECK_INTERVAL);
    
    console.log('✅ ScheduledCampaignChecker started - checking every hour');
  }

  /**
   * Stop the scheduled campaign checker
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 ScheduledCampaignChecker stopped');
    }
  }

  /**
   * Check for scheduled campaigns that should be started
   */
  private checkScheduledCampaigns() {
    try {
      const now = new Date();
      console.log(`🔍 Checking for scheduled campaigns (${now.toISOString()})...`);
      
      // Find all campaigns in 'draft' status with scheduled_start_datetime in the past or present
      const stmt = this.db.prepare(`
        SELECT * FROM campaigns 
        WHERE status = 'draft' 
        AND scheduled_start_datetime IS NOT NULL 
        AND scheduled_start_datetime <= ?
      `);
      
      const scheduledCampaigns = stmt.all(now.toISOString()) as any[];
      
      if (scheduledCampaigns.length === 0) {
        console.log('📭 No scheduled campaigns to start');
        return;
      }
      
      console.log(`📨 Found ${scheduledCampaigns.length} scheduled campaign(s) to start`);
      
      // Start each campaign
      for (const campaign of scheduledCampaigns) {
        this.startScheduledCampaign(campaign);
      }
    } catch (error) {
      console.error('❌ Error checking scheduled campaigns:', error);
    }
  }

  /**
   * Start a scheduled campaign
   */
  private async startScheduledCampaign(campaign: any) {
    try {
      console.log(`🚀 Starting scheduled campaign: ${campaign.name} (ID: ${campaign.id})`);
      console.log(`   Scheduled for: ${campaign.scheduled_start_datetime}`);
      
      // Use the campaign scheduler to start the campaign
      await this.campaignScheduler.startCampaign(campaign.id);
      
      console.log(`✅ Scheduled campaign "${campaign.name}" started successfully`);
    } catch (error) {
      console.error(`❌ Failed to start scheduled campaign "${campaign.name}":`, error);
      
      // Update campaign status to show error
      try {
        const updateStmt = this.db.prepare(`
          UPDATE campaigns 
          SET status = 'stopped' 
          WHERE id = ?
        `);
        updateStmt.run(campaign.id);
      } catch (updateError) {
        console.error('❌ Failed to update campaign status:', updateError);
      }
    }
  }

  /**
   * Manually trigger a check (useful for testing)
   */
  checkNow() {
    this.checkScheduledCampaigns();
  }
}
