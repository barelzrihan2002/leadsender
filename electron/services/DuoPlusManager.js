const API_BASE_URL = 'https://openapi.duoplus.net';
/**
 * Integrates with the DuoPlus Cloud Phone REST API.
 * Docs: https://help.duoplus.net/docs/Introduction
 *
 * All requests are POST with a JSON body, authenticated via the
 * `DuoPlus-API-Key` header (no local `adb` binary or IP whitelist required).
 */
export class DuoPlusManager {
    constructor(db) {
        this.requestQueueTail = Promise.resolve();
        this.lastDispatchAt = 0;
        this.db = db;
    }
    /** Serializes callers so DuoPlus API dispatches never exceed ~1/second, no matter how many accounts call concurrently. */
    async throttle() {
        const previousTail = this.requestQueueTail;
        let releaseNext;
        this.requestQueueTail = new Promise(resolve => { releaseNext = resolve; });
        await previousTail;
        const waitMs = Math.max(0, this.lastDispatchAt + DuoPlusManager.MIN_REQUEST_INTERVAL_MS - Date.now());
        if (waitMs > 0) {
            await new Promise(resolve => setTimeout(resolve, waitMs));
        }
        this.lastDispatchAt = Date.now();
        releaseNext();
    }
    // ==================== Settings (stored in the `settings` key/value table) ====================
    getSettings() {
        const rows = this.db.prepare(`SELECT key, value FROM settings WHERE key LIKE 'duoplus_%'`).all();
        const map = new Map(rows.map(row => [row.key, row.value]));
        return {
            apiKey: map.get('duoplus_api_key') || '',
            tapMode: map.get('duoplus_tap_mode') || 'auto',
            tapX: map.has('duoplus_tap_x') ? Number(map.get('duoplus_tap_x')) : null,
            tapY: map.has('duoplus_tap_y') ? Number(map.get('duoplus_tap_y')) : null,
        };
    }
    saveSettings(settings) {
        const upsert = this.db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
        const save = this.db.transaction(() => {
            if (settings.apiKey !== undefined) {
                upsert.run('duoplus_api_key', settings.apiKey);
            }
            if (settings.tapMode !== undefined) {
                upsert.run('duoplus_tap_mode', settings.tapMode);
            }
            if (settings.tapX !== undefined) {
                upsert.run('duoplus_tap_x', settings.tapX === null ? '' : String(settings.tapX));
            }
            if (settings.tapY !== undefined) {
                upsert.run('duoplus_tap_y', settings.tapY === null ? '' : String(settings.tapY));
            }
        });
        save();
    }
    async request(path, body) {
        const { apiKey } = this.getSettings();
        if (!apiKey) {
            throw new Error('DuoPlus API key is not configured. Set it in Settings first.');
        }
        for (let attempt = 0; attempt <= DuoPlusManager.RATE_LIMIT_MAX_RETRIES; attempt++) {
            await this.throttle();
            const response = await fetch(`${API_BASE_URL}${path}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'DuoPlus-API-Key': apiKey,
                },
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                throw new Error(`DuoPlus API request failed: HTTP ${response.status}`);
            }
            const json = (await response.json());
            if (json.code === DuoPlusManager.RATE_LIMIT_CODE && attempt < DuoPlusManager.RATE_LIMIT_MAX_RETRIES) {
                const jitter = Math.floor(Math.random() * DuoPlusManager.RATE_LIMIT_JITTER_MS);
                const delay = DuoPlusManager.RATE_LIMIT_BASE_DELAY_MS * (attempt + 1) + jitter;
                console.log(`⏳ DuoPlus rate limit hit on ${path} (attempt ${attempt + 1}/${DuoPlusManager.RATE_LIMIT_MAX_RETRIES}) - retrying in ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            if (json.code !== 200) {
                throw new Error(`DuoPlus API error (${json.code}): ${json.message}`);
            }
            return json.data;
        }
        throw new Error(`DuoPlus API error (${DuoPlusManager.RATE_LIMIT_CODE}): Request too frequent, please try again later.`);
    }
    // ==================== Cloud phone lifecycle ====================
    async getCloudPhoneStatus(deviceIds) {
        const data = await this.request('/api/v1/cloudPhone/status', {
            image_ids: deviceIds,
        });
        return data.list || [];
    }
    async powerOn(deviceIds) {
        await this.request('/api/v1/cloudPhone/powerOn', { image_ids: deviceIds });
    }
    async powerOff(deviceIds) {
        await this.request('/api/v1/cloudPhone/powerOff', { image_ids: deviceIds });
    }
    /** Polls the cloud phone status until it reports "powered on" (status === 1) or the timeout elapses. */
    async waitUntilOnline(deviceId, timeoutMs = 90000, pollIntervalMs = 5000) {
        const startedAt = Date.now();
        while (Date.now() - startedAt < timeoutMs) {
            const [status] = await this.getCloudPhoneStatus([deviceId]);
            if (status?.status === 1) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
        }
        return false;
    }
    /** Ensures the cloud phone is powered on, powering it on first if necessary. */
    async ensureOnline(deviceId, timeoutMs = 90000) {
        const [status] = await this.getCloudPhoneStatus([deviceId]);
        if (status?.status === 1) {
            return true;
        }
        await this.powerOn([deviceId]);
        return this.waitUntilOnline(deviceId, timeoutMs);
    }
    // ==================== ADB command execution ====================
    async executeAdbCommand(deviceId, command) {
        return this.request('/api/v1/cloudPhone/command', {
            image_id: deviceId,
            command,
        });
    }
    /** Dumps the current screen's UI hierarchy via `uiautomator` and returns the raw XML content. */
    async dumpUiXml(deviceId) {
        const dumpResult = await this.executeAdbCommand(deviceId, `uiautomator dump ${DuoPlusManager.UI_DUMP_PATH}`);
        if (!dumpResult.success) {
            throw new Error(`uiautomator dump failed: ${dumpResult.message || 'unknown error'}`);
        }
        const catResult = await this.executeAdbCommand(deviceId, `cat ${DuoPlusManager.UI_DUMP_PATH}`);
        if (!catResult.success || !catResult.content) {
            throw new Error(`Failed to read UI dump: ${catResult.message || 'empty content'}`);
        }
        return catResult.content;
    }
    /**
     * Parses a `uiautomator dump` XML string and returns the center point of WhatsApp's
     * send button (resource-id `com.whatsapp:id/send`), if present on screen.
     */
    findSendButtonCenter(xml) {
        const nodeMatch = xml.match(/<node[^>]*resource-id="com\.whatsapp:id\/send"[^>]*\/>/);
        if (!nodeMatch) {
            return null;
        }
        const boundsMatch = nodeMatch[0].match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
        if (!boundsMatch) {
            return null;
        }
        const [, x1, y1, x2, y2] = boundsMatch.map(Number);
        return {
            x: Math.round((x1 + x2) / 2),
            y: Math.round((y1 + y2) / 2),
        };
    }
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
    async sendWhatsAppTextViaIntent(deviceId, phone, text) {
        const settings = this.getSettings();
        const sanitizedPhone = phone.replace(/[^\d]/g, '');
        const encodedText = encodeURIComponent(text);
        const openIntentCommand = `am start -a android.intent.action.VIEW -d "whatsapp://send?phone=${sanitizedPhone}&text=${encodedText}" com.whatsapp`;
        const openResult = await this.executeAdbCommand(deviceId, openIntentCommand);
        if (!openResult.success) {
            throw new Error(`Failed to open WhatsApp intent on device: ${openResult.message || 'unknown error'}`);
        }
        // Give WhatsApp time to open the chat and load the pre-filled text
        await new Promise(resolve => setTimeout(resolve, 6000));
        let sendCommand;
        if (settings.tapMode === 'coordinates' && settings.tapX !== null && settings.tapY !== null) {
            sendCommand = `input tap ${settings.tapX} ${settings.tapY}`;
        }
        else if (settings.tapMode === 'enter') {
            sendCommand = 'input keyevent 66'; // KEYCODE_ENTER
        }
        else {
            // 'auto': locate the send button on screen via UI Automator
            const xml = await this.dumpUiXml(deviceId);
            const center = this.findSendButtonCenter(xml);
            if (!center) {
                throw new Error('Could not locate the WhatsApp send button on screen (UI Automator dump found no match). ' +
                    'Try switching to "Screen Coordinates" mode in Settings and calibrate it manually for this device.');
            }
            sendCommand = `input tap ${center.x} ${center.y}`;
        }
        const sendResult = await this.executeAdbCommand(deviceId, sendCommand);
        if (!sendResult.success) {
            throw new Error(`Failed to trigger send action on device: ${sendResult.message || 'unknown error'}`);
        }
    }
}
// Global throttle queue: DuoPlus limits each interface to 1 QPS across the
// WHOLE API key (not per-device - see request() below for docs link). With
// many accounts calling concurrently (e.g. 100 cloud phones), reactive
// retry-on-429 alone isn't enough - the sustained request rate would still
// be far above the limit and most calls would keep failing. Instead, every
// call (from every account) is serialized through this single queue, which
// enforces a minimum spacing between dispatches so the limit is respected
// proactively instead of being violated and retried after the fact.
DuoPlusManager.MIN_REQUEST_INTERVAL_MS = 1100;
// ==================== Low-level API request ====================
// DuoPlus's rate-limit response code ("Request too frequent"). Per DuoPlus's
// own docs (https://help.duoplus.net/docs/Introduction): "The QPS limit for
// each interface is set to 1" - i.e. max 1 request/second PER ENDPOINT,
// shared across the whole API key (not per-device). With multiple accounts
// polling/sending via cloud phones concurrently, this is easy to exceed.
// Retrying with backoff + jitter turns a transient rate limit into a brief
// delay instead of a hard failure. Jitter matters here: without it, several
// accounts rate-limited in the same instant would all retry after the same
// fixed delay and collide again on the very next attempt.
DuoPlusManager.RATE_LIMIT_CODE = 160004;
DuoPlusManager.RATE_LIMIT_MAX_RETRIES = 5;
DuoPlusManager.RATE_LIMIT_BASE_DELAY_MS = 1500;
DuoPlusManager.RATE_LIMIT_JITTER_MS = 1000;
// ==================== UI Automator (send-button auto detection) ====================
DuoPlusManager.UI_DUMP_PATH = '/sdcard/uidump.xml';
