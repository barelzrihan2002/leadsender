import Database from 'better-sqlite3';
type BetterSqliteDatabase = InstanceType<typeof Database>;
export declare function initDatabase(): Promise<void>;
export declare function getDatabase(): BetterSqliteDatabase;
export { Database };
