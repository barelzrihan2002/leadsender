interface LogEntry {
    timestamp: string;
    level: 'log' | 'info' | 'warn' | 'error';
    message: string;
}
declare class Logger {
    private logs;
    private maxLogs;
    private originalConsole;
    constructor();
    private interceptConsole;
    private addLog;
    getLogs(): LogEntry[];
    clearLogs(): void;
    log(message: string): void;
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
}
export declare const logger: Logger;
export {};
