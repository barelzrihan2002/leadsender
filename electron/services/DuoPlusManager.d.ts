import type { Database } from 'better-sqlite3';
export type DuoPlusTapMode = 'auto' | 'coordinates' | 'enter';
export interface DuoPlusSettings {
    apiKey: string;
    tapMode: DuoPlusTapMode;
    tapX: number | null;
    tapY: number | null;
}
export type DuoPlusCloudPhoneStatus = 0 | 1 | 2 | 3 | 4 | 10 | 11 | 12;
export interface DuoPlusStatusItem {
    id: string;
    name: string;
    status: DuoPlusCloudPhoneStatus;
}
/**
 * Integrates with the DuoPlus Cloud Phone REST API.
 * Docs: https://help.duoplus.net/docs/Introduction
 *
 * All requests are POST with a JSON body, authenticated via the
 * `DuoPlus-API-Key` header (no local `adb` binary or IP whitelist required).
 */
export declare class DuoPlusManager {
    private db;
    private static readonly MIN_REQUEST_INTERVAL_MS;
    private requestQueueTail;
    private lastDispatchAt;
    constructor(db: Database);
    /** Serializes callers so DuoPlus API dispatches never exceed ~1/second, no matter how many accounts call concurrently. */
    private throttle;
    getSettings(): DuoPlusSettings;
    saveSettings(settings: Partial<DuoPlusSettings>): void;
    private static readonly RATE_LIMIT_CODE;
    private static readonly RATE_LIMIT_MAX_RETRIES;
    private static readonly RATE_LIMIT_BASE_DELAY_MS;
    private static readonly RATE_LIMIT_JITTER_MS;
    private request;
    getCloudPhoneStatus(deviceIds: string[]): Promise<DuoPlusStatusItem[]>;
    powerOn(deviceIds: string[]): Promise<void>;
    powerOff(deviceIds: string[]): Promise<void>;
    /** Polls the cloud phone status until it reports "powered on" (status === 1) or the timeout elapses. */
    waitUntilOnline(deviceId: string, timeoutMs?: number, pollIntervalMs?: number): Promise<boolean>;
    /** Ensures the cloud phone is powered on, powering it on first if necessary. */
    ensureOnline(deviceId: string, timeoutMs?: number): Promise<boolean>;
    executeAdbCommand(deviceId: string, command: string): Promise<{
        success: boolean;
        content: string;
        message: string;
    }>;
    private static readonly UI_DUMP_PATH;
    /** Dumps the current screen's UI hierarchy via `uiautomator` and returns the raw XML content. */
    private dumpUiXml;
    /**
     * Parses a `uiautomator dump` XML string and returns the center point of WhatsApp's
     * send button (resource-id `com.whatsapp:id/send`), if present on screen.
     */
    private findSendButtonCenter;
    /**
     * Opens WhatsApp with a pre-filled chat via the `whatsapp://send` intent, waits briefly
     * for the app/chat to load, then triggers the send action according to DuoPlusSettings.tapMode:
     * - 'auto' (recommended): dumps the UI via uiautomator, locates the send button and taps its
     *   center. WhatsApp's Android app does NOT send on a hardware Enter keypress (unlike the
     *   Web/Desktop clients), so this is the only reliable automatic method.
     * - 'coordinates': taps a fixed, manually-calibrated screen position.
     * - 'enter': sends KEYCODE_ENTER - kept only for compatibility, usually just inserts a newline.
     *
     * Text-only - media is intentionally not supported through this path.
     */
    sendWhatsAppTextViaIntent(deviceId: string, phone: string, text: string): Promise<void>;
}
