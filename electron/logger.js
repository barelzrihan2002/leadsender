class Logger {
    constructor() {
        this.logs = [];
        this.maxLogs = 1000; // Keep last 1000 logs
        this.originalConsole = {
            log: console.log,
            info: console.info,
            warn: console.warn,
            error: console.error,
        };
        this.interceptConsole();
    }
    interceptConsole() {
        // Override console.log
        console.log = (...args) => {
            const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
            this.addLog('log', message);
            this.originalConsole.log(...args);
        };
        // Override console.info
        console.info = (...args) => {
            const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
            this.addLog('info', message);
            this.originalConsole.info(...args);
        };
        // Override console.warn
        console.warn = (...args) => {
            const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
            this.addLog('warn', message);
            this.originalConsole.warn(...args);
        };
        // Override console.error
        console.error = (...args) => {
            const message = args.map(arg => {
                if (arg instanceof Error) {
                    return `${arg.message}\n${arg.stack}`;
                }
                return typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg);
            }).join(' ');
            this.addLog('error', message);
            this.originalConsole.error(...args);
        };
    }
    addLog(level, message) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message,
        };
        this.logs.push(entry);
        // Keep only last maxLogs entries
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }
    }
    getLogs() {
        return [...this.logs];
    }
    clearLogs() {
        this.logs = [];
    }
    // Manual logging methods
    log(message) {
        console.log(message);
    }
    info(message) {
        console.info(message);
    }
    warn(message) {
        console.warn(message);
    }
    error(message) {
        console.error(message);
    }
}
// Export singleton instance
export const logger = new Logger();
