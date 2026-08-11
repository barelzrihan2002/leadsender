import { Client } from 'whatsapp-web.js';
import type { Database } from 'better-sqlite3';
import type { CampaignContactResultCode, GroupAddParticipantResult, GroupJoinByInviteResult, ProxyConfig, WhatsAppGroupInviteInfo, WhatsAppGroupParticipant, WhatsAppGroupSummary } from '../../src/types';
import type { FlowEngine } from './FlowEngine';
export interface InitializationProgress {
    total: number;
    completed: number;
    failed: number;
    isComplete: boolean;
    currentAccount?: string;
}
export declare class WhatsAppManager {
    private db;
    private clients;
    private sessionsPaths;
    private readyAccounts;
    private connectingAccounts;
    private anonymizedProxyServers;
    private flowEngine;
    private campaignScheduler;
    private chatManager;
    private initProgress;
    private recentlySentMessages;
    constructor(db: Database);
    setFlowEngine(flowEngine: FlowEngine): void;
    setCampaignScheduler(scheduler: any): void;
    /**
     * Returns current initialization progress (used by the startup loader UI).
     */
    getInitializationProgress(): InitializationProgress;
    /**
     * Waits until an account is fully ready (ready event fired + WWebJS loaded)
     * or until the timeout expires. Returns true if ready, false otherwise.
     */
    private waitForAccountReady;
    /**
     * Broadcast the current initialization progress to the renderer process.
     */
    private emitInitProgress;
    private getSessionPath;
    private isTrackedClient;
    private isMessageFromMe;
    private cleanupProxyServer;
    private destroyClientInstance;
    private cleanupAccountResources;
    /**
     * Picks how many Chromium instances to launch at once based on available RAM/CPU,
     * so a weaker machine doesn't get hit with a simultaneous burst of heavy browser
     * startups when many accounts need to (re)connect at once.
     */
    private getAdaptiveBatchSize;
    /**
     * Pairing-code debugging aid. whatsapp-web.js's internal pairing-code request (see
     * Client.js's requestPairingCode, called fire-and-forget from inside initialize())
     * runs entirely inside the page context via page.evaluate() - if it throws there, we
     * only ever see a generic "Evaluation failed: ..." with no detail about WHERE inside
     * the page it failed. This forwards the page's own console output and uncaught errors
     * to our logs, and runs a direct diagnostic check for the WAWebAltDeviceLinkingApi
     * module (the exact module requestPairingCode depends on) so we can see immediately
     * whether it's missing/renamed vs. present-but-erroring (e.g. WhatsApp's rate limit).
     */
    private setupPairingDebugLogging;
    /**
     * Headless Chrome auto-denies the Persistent Storage permission (no UI to show a prompt
     * for it), unlike a real user-facing Chrome. We saw this surface as WA Web's own console
     * logging "storage bucket persistence denied (aquire-persistent-storage-denied)" right at
     * startup - and, in the same test run, the pairing-code device-linking "Hello" handshake
     * failed server-side with CompanionHelloError/IQErrorBadRequest (400 bad-request). That
     * handshake needs to generate/persist E2E crypto material for the new linked device, so a
     * denied persistent-storage permission is a plausible cause of a malformed Hello payload.
     * Granting it explicitly via CDP (browser.defaultBrowserContext().overridePermissions)
     * removes this as a variable regardless.
     */
    private grantWebPermissions;
    private loadExistingSessions;
    connectAccount(accountId: string, proxy?: ProxyConfig, pairingMethod?: 'qr' | 'code'): Promise<void>;
    disconnectAccount(accountId: string): Promise<void>;
    sendMessage(accountId: string, to: string, message: string, isWarmup?: boolean): Promise<void>;
    sendMedia(accountId: string, to: string, filePath: string, caption?: string): Promise<void>;
    getQRCode(accountId: string): Promise<string>;
    updateWhatsAppName(accountId: string, name: string): Promise<void>;
    sendMediaFromPath(accountId: string, to: string, filePath: string, caption?: string, isWarmup?: boolean): Promise<void>;
    refreshProfilePicture(accountId: string): Promise<void>;
    updateWhatsAppProfilePicture(accountId: string, imagePath: string): Promise<void>;
    getConnection(accountId: string): Client | undefined;
    private extractDigits;
    private getDirectPhoneFallback;
    private resolvePhoneFromHistory;
    resolvePhoneNumber(accountId: string, identifier: string, message?: any): Promise<string>;
    resolveContactData(accountId: string, identifier: string, message?: any): Promise<{
        phone: string;
        name: string | null;
    }>;
    private normalizeSendTarget;
    isConnected(accountId: string): boolean;
    /**
     * Polls the local `messages` table (populated by this account's WhatsApp Web session, kept
     * connected only as a linked-device observer here, never to send) for a new outgoing message
     * to `phoneNumber` timestamped at or after `afterTimestampMs`. Used to confirm that a message
     * sent through another device (e.g. a DuoPlus cloud phone) actually went through, rather than
     * just assuming success because the send command executed without error.
     *
     * Querying the DB (instead of calling `client.getChatById`) is important: WhatsApp Web can
     * index a contact's chat under a `@lid` id instead of `@c.us`, and the `message_create`
     * handler in this file already resolves that correctly via `resolvePhoneNumber` before saving
     * `to_number` to the DB - so the DB is a more reliable source of truth than guessing a chat id.
     */
    waitForOutgoingMessage(accountId: string, phoneNumber: string, afterTimestampMs: number, timeoutMs?: number, pollIntervalMs?: number): Promise<boolean>;
    private mapAddParticipantResultCode;
    private getGroupAccessState;
    canAddParticipantsToGroup(accountId: string, groupId: string): Promise<{
        ok: boolean;
        reason?: CampaignContactResultCode;
        message?: string;
        groupName?: string;
    }>;
    getGroups(accountId: string): Promise<WhatsAppGroupSummary[]>;
    private extractInviteCode;
    private normalizeGroupInviteInfo;
    getGroupInviteInfo(accountId: string, inviteLink: string): Promise<WhatsAppGroupInviteInfo>;
    getGroupParticipants(accountId: string, groupId: string): Promise<WhatsAppGroupParticipant[]>;
    /**
     * Joins a group via invite code, returning a normalized raw response
     * instead of relying on whatsapp-web.js's `acceptInvite`, which blindly
     * assumes `res.gid._serialized` exists.
     *
     * Per WhatsApp Web's internal `WAWebGroupInviteJob.joinGroupViaInvite`
     * (confirmed via whatsapp-web.js issue #2570 and wa-js's documented
     * `membershipApprovalMode` behavior), when the target group requires
     * admin approval the call does NOT resolve with a usable group id -
     * it *rejects* with an error object shaped like:
     *   { name: 'UnexpectedJoinGroupViaInviteResponse', gid: '<id>@g.us', membershipApprovalMode: true }
     * even though the join request was actually submitted successfully.
     *
     * Puppeteer's `page.evaluate` normally loses custom properties on thrown
     * values when crossing the browser/Node boundary (only `message`/`stack`
     * survive), so we catch the rejection INSIDE the page context and return
     * it as a plain, fully-serializable object instead of letting it throw.
     */
    private acceptInviteRaw;
    joinGroupByInviteLink(accountId: string, inviteLink: string): Promise<GroupJoinByInviteResult>;
    /**
     * Re-implementation of whatsapp-web.js's `GroupChat.addParticipants` that
     * skips its hardcoded `if (!group.iAmAdmin()) return errorCodes.iAmNotAdmin`
     * client-side gate.
     *
     * Confirmed via whatsapp-web.js issue #3355: the library blocks ANY
     * non-admin from adding participants even when the group's "who can add
     * members" setting is "All participants" (`memberAddMode: all_member_add`),
     * which is a real WhatsApp feature that doesn't require admin rights. The
     * actual permission check happens server-side via
     * `WWebJS.getAddParticipantsRpcResult`, so we call that directly and let
     * WhatsApp itself decide (returning codes 200/403/404/408/409/417/419)
     * instead of failing early on a client-side assumption.
     */
    private addParticipantRaw;
    addParticipantToGroup(accountId: string, groupId: string, phoneNumber: string): Promise<GroupAddParticipantResult>;
    private updateAccountStatus;
    private handleIncomingMessage;
}
