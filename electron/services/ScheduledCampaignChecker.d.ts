import { CampaignScheduler } from './CampaignScheduler';
/**
 * Service to check for scheduled campaigns and start them automatically
 * Checks every hour for campaigns that should be started
 */
export declare class ScheduledCampaignChecker {
    private db;
    private campaignScheduler;
    private intervalId;
    private readonly CHECK_INTERVAL;
    constructor(db: Database, campaignScheduler: CampaignScheduler);
    /**
     * Start the scheduled campaign checker
     */
    start(): void;
    /**
     * Stop the scheduled campaign checker
     */
    stop(): void;
    /**
     * Check for scheduled campaigns that should be started
     */
    private checkScheduledCampaigns;
    /**
     * Start a scheduled campaign
     */
    private startScheduledCampaign;
    /**
     * Manually trigger a check (useful for testing)
     */
    checkNow(): void;
}
