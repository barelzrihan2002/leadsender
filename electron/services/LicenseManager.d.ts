export interface LicenseInfo {
    isValid: boolean;
    isActivated: boolean;
    expiresAt?: string;
    daysLeft?: number;
    licenseKey?: string;
    email?: string;
    status?: 'active' | 'expired' | 'suspended' | 'grace_period';
    error?: string;
    logAccess?: boolean;
}
export declare class LicenseManager {
    private supabase;
    private licensePath;
    private machineFingerprint;
    constructor();
    private getMachineFingerprint;
    /**
     * אתחול - מוכן מיד (Supabase client נוצר ב-constructor)
     */
    initialize(): Promise<void>;
    /**
     * בדיקת רישיון - אם קיים ותקף
     */
    checkLicense(): Promise<LicenseInfo>;
    /**
     * אקטיבציה של רישיון חדש
     */
    activateLicense(licenseKey: string): Promise<{
        success: boolean;
        error?: string;
        info?: LicenseInfo;
    }>;
    /**
     * ביטול הפעלה (לשחרר את המכשיר)
     */
    deactivateLicense(): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * קבל מידע על המשתמש
     */
    getLicenseUser(): Promise<{
        email?: string;
        name?: string;
    }>;
    private saveLicenseKey;
    private readSavedLicenseKey;
    private deleteLicenseKey;
}
