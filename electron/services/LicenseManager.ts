import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { machineIdSync } from 'node-machine-id';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';

export interface LicenseInfo {
  isValid: boolean;
  isActivated: boolean;
  expiresAt?: string;
  daysLeft?: number;
  licenseKey?: string;
  email?: string;
  status?: 'active' | 'expired' | 'suspended' | 'grace_period';
  error?: string;
}

export class LicenseManager {
  private supabase: SupabaseClient;
  private licensePath: string;
  private machineFingerprint: string;

  constructor() {
    // Supabase configuration
    const supabaseUrl = 'https://uqlftmdssltilkkkcdss.supabase.co';
    const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxbGZ0bWRzc2x0aWxra2tjZHNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MDU4NTEsImV4cCI6MjA4NTA4MTg1MX0.sqS_UJl6dbsaYXhZzCVjhAKHNjdbYzwX2s7WxVs2Kt8';
    
    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    const userDataPath = app.getPath('userData');
    this.licensePath = path.join(userDataPath, '.license');
    
    // Get machine fingerprint
    this.machineFingerprint = this.getMachineFingerprint();
    console.log('🔐 Machine Fingerprint:', this.machineFingerprint.substring(0, 16) + '...');
  }

  private getMachineFingerprint(): string {
    try {
      // Get unique machine ID
      const machineId = machineIdSync();
      return machineId;
    } catch (error) {
      console.error('Failed to get machine ID:', error);
      // Fallback
      return `${os.hostname()}-${os.platform()}-${os.arch()}`;
    }
  }

  /**
   * אתחול - מוכן מיד (Supabase client נוצר ב-constructor)
   */
  async initialize(): Promise<void> {
    console.log('✅ License Manager initialized (Supabase)');
  }

  /**
   * בדיקת רישיון - אם קיים ותקף
   */
  async checkLicense(): Promise<LicenseInfo> {
    try {
      // קרא license key שמור מקומית
      const savedLicenseKey = this.readSavedLicenseKey();
      
      if (!savedLicenseKey) {
        return {
          isValid: false,
          isActivated: false,
          error: 'No license activated'
        };
      }

      console.log('🔍 Checking license:', savedLicenseKey.substring(0, 8) + '...');

      // שלוף מידע מ-Supabase
      const { data: client, error } = await this.supabase
        .from('clients')
        .select('*')
        .eq('id', savedLicenseKey)
        .single();

      if (error || !client) {
        console.error('❌ License not found in database:', error);
        return {
          isValid: false,
          isActivated: false,
          error: 'Invalid license key'
        };
      }

      // בדוק תוקף
      const now = new Date();
      const expiryDate = client.expiration_date ? new Date(client.expiration_date) : null;

      if (expiryDate && expiryDate < now) {
        const daysExpired = Math.floor((now.getTime() - expiryDate.getTime()) / 1000 / 60 / 60 / 24);
        console.log('⚠️ License expired', daysExpired, 'days ago');
        
        return {
          isValid: false,
          isActivated: true,
          status: 'expired',
          error: `License expired ${daysExpired} days ago`,
          expiresAt: expiryDate.toISOString()
        };
      }

      // בדוק machine fingerprint (למניעת שימוש ממספר מכשירים)
      const hasMachineFingerprint = client.machine_fingerprint && 
                                     typeof client.machine_fingerprint === 'string' && 
                                     client.machine_fingerprint.trim() !== '';
      
      if (hasMachineFingerprint) {
        // Fingerprint כבר קיים - בדוק התאמה
        if (client.machine_fingerprint !== this.machineFingerprint) {
          console.error('❌ License activated on different machine');
          console.log('   Registered machine:', client.machine_fingerprint.substring(0, 16) + '...');
          console.log('   Current machine:', this.machineFingerprint.substring(0, 16) + '...');
          
          return {
            isValid: false,
            isActivated: true,
            error: 'This license is already activated on another device. Each license can only be used on one machine.'
          };
        } else {
          console.log('✅ Machine fingerprint matches - same device');
        }
      } else {
        // Fingerprint ריק, NULL, או undefined - זו ההפעלה הראשונה, שמור את ה-fingerprint
        console.log('📝 Machine fingerprint is empty/null - this is first use on this machine');
        console.log('   Current machine ID:', this.machineFingerprint.substring(0, 16) + '...');
        
        try {
          const { data: updateData, error: updateError } = await this.supabase
            .from('clients')
            .update({ 
              machine_fingerprint: this.machineFingerprint
            })
            .eq('id', savedLicenseKey)
            .select();

          if (updateError) {
            console.error('❌ Failed to save machine fingerprint:', updateError);
            // Don't block - continue anyway (for backward compatibility)
          } else {
            console.log('✅ Machine fingerprint saved successfully to database');
            if (updateData && updateData.length > 0) {
              console.log('   Confirmed in DB:', updateData[0].machine_fingerprint?.substring(0, 16) + '...');
            }
          }
        } catch (error) {
          console.error('⚠️ Error saving fingerprint:', error);
          // Don't block - continue anyway
        }
      }

      // חשב ימים שנותרו
      const daysLeft = expiryDate 
        ? Math.floor((expiryDate.getTime() - now.getTime()) / 1000 / 60 / 60 / 24)
        : undefined;

      console.log('✅ License valid!', daysLeft ? `${daysLeft} days left` : 'Lifetime');

      return {
        isValid: true,
        isActivated: true,
        expiresAt: expiryDate?.toISOString(),
        daysLeft: daysLeft,
        licenseKey: savedLicenseKey,
        email: client.email,
        status: 'active'
      };

    } catch (error: any) {
      console.error('License check error:', error);
      return {
        isValid: false,
        isActivated: false,
        error: error.message || 'License check failed'
      };
    }
  }

  /**
   * אקטיבציה של רישיון חדש
   */
  async activateLicense(licenseKey: string): Promise<{ success: boolean; error?: string; info?: LicenseInfo }> {
    try {
      console.log('🔑 Activating license:', licenseKey);
      console.log('💻 Hostname:', os.hostname());
      console.log('🔐 Machine Fingerprint:', this.machineFingerprint.substring(0, 16) + '...');

      // 1. בדוק שה-license key קיים ב-Supabase
      const { data: client, error: fetchError } = await this.supabase
        .from('clients')
        .select('*')
        .eq('id', licenseKey)
        .single();

      if (fetchError || !client) {
        console.error('❌ License not found:', fetchError);
        return { 
          success: false, 
          error: 'Invalid license key. Please check the key and try again.' 
        };
      }

      console.log('✅ License found in database');
      console.log('📋 Client:', client.name, '/', client.email);

      // 2. בדוק תוקף
      const now = new Date();
      const expiryDate = client.expiration_date ? new Date(client.expiration_date) : null;

      if (expiryDate && expiryDate < now) {
        return { 
          success: false, 
          error: 'This license has expired. Please renew your subscription.' 
        };
      }

      // 3. בדוק machine fingerprint - מניעת שימוש ממספר מכשירים!
      const hasMachineFingerprint = client.machine_fingerprint && 
                                     typeof client.machine_fingerprint === 'string' && 
                                     client.machine_fingerprint.trim() !== '';
      
      if (hasMachineFingerprint) {
        // Fingerprint כבר קיים - בדוק התאמה
        if (client.machine_fingerprint !== this.machineFingerprint) {
          console.error('❌ License already activated on another device');
          console.log('   Registered machine:', client.machine_fingerprint.substring(0, 16) + '...');
          console.log('   Current machine:', this.machineFingerprint.substring(0, 16) + '...');
          
          return { 
            success: false, 
            error: 'This license is already activated on another device. Each license can only be used on one machine.' 
          };
        } else {
          console.log('✅ Machine fingerprint matches - reactivation on same device confirmed');
        }
      } else {
        // Fingerprint ריק, NULL, או undefined - מכשיר ראשון, שמור את ה-fingerprint
        console.log('📝 FIRST DEVICE ACTIVATION - machine_fingerprint is empty/null');
        console.log('   License Key:', licenseKey);
        console.log('   Current machine ID:', this.machineFingerprint.substring(0, 16) + '...');
        console.log('   Saving to Supabase database...');
        
        const { data: updateData, error: updateError } = await this.supabase
          .from('clients')
          .update({ 
            machine_fingerprint: this.machineFingerprint
          })
          .eq('id', licenseKey)
          .select('id, machine_fingerprint');

        if (updateError) {
          console.error('❌ CRITICAL ERROR: Failed to save machine fingerprint to database');
          console.error('   Supabase error:', JSON.stringify(updateError));
          return {
            success: false,
            error: 'Failed to bind license to this device. Please check your internet connection and try again.'
          };
        }
        
        if (updateData && updateData.length > 0 && updateData[0].machine_fingerprint) {
          console.log('✅✅✅ SUCCESS: Machine fingerprint saved to database');
          console.log('   License ID:', updateData[0].id);
          console.log('   Saved fingerprint:', updateData[0].machine_fingerprint.substring(0, 16) + '...');
          console.log('   ✅ This license is now PERMANENTLY bound to this device only');
        } else {
          console.error('❌ CRITICAL: Update succeeded but fingerprint not confirmed');
          console.error('   Response data:', JSON.stringify(updateData));
          return {
            success: false,
            error: 'License activation incomplete. Please try again or contact support with code: FP_SAVE_FAILED'
          };
        }
      }

      // 4. שמור license key מקומית
      this.saveLicenseKey(licenseKey);
      console.log('✅ License saved locally');

      // 5. קבל מידע מלא
      const daysLeft = expiryDate 
        ? Math.floor((expiryDate.getTime() - now.getTime()) / 1000 / 60 / 60 / 24)
        : undefined;

      const info: LicenseInfo = {
        isValid: true,
        isActivated: true,
        expiresAt: expiryDate?.toISOString(),
        daysLeft: daysLeft,
        licenseKey: licenseKey,
        email: client.email,
        status: 'active'
      };

      console.log('🎉 License activated successfully!');
      if (daysLeft) {
        console.log(`⏰ Expires in ${daysLeft} days`);
      } else {
        console.log('♾️ Lifetime license');
      }

      return { success: true, info };

    } catch (error: any) {
      console.error('❌ Activation error:', error);
      return { 
        success: false, 
        error: error.message || 'Activation failed. Please check your internet connection.' 
      };
    }
  }

  /**
   * ביטול הפעלה (לשחרר את המכשיר)
   */
  async deactivateLicense(): Promise<{ success: boolean; error?: string }> {
    try {
      const savedLicenseKey = this.readSavedLicenseKey();
      
      if (!savedLicenseKey) {
        return { success: true }; // כבר לא מופעל
      }

      console.log('🔓 Deactivating license...');

      // מחק את machine_fingerprint מ-Supabase
      const { error } = await this.supabase
        .from('clients')
        .update({ machine_fingerprint: null })
        .eq('id', savedLicenseKey)
        .eq('machine_fingerprint', this.machineFingerprint); // רק אם זה המכשיר הנוכחי

      if (error) {
        console.error('⚠️ Failed to deactivate in database:', error);
        // ממשיכים בכל זאת למחוק מקומית
      }

      // מחק license key מקומית
      this.deleteLicenseKey();
      console.log('✅ License deactivated');

      return { success: true };

    } catch (error: any) {
      console.error('❌ Deactivation error:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * קבל מידע על המשתמש
   */
  async getLicenseUser(): Promise<{ email?: string; name?: string }> {
    try {
      const savedLicenseKey = this.readSavedLicenseKey();
      
      if (!savedLicenseKey) {
        return {};
      }

      const { data: client } = await this.supabase
        .from('clients')
        .select('email, name')
        .eq('id', savedLicenseKey)
        .single();

      return {
        email: client?.email,
        name: client?.name
      };
    } catch (e) {
      return {};
    }
  }

  // ========== Helper Methods ==========

  private saveLicenseKey(key: string): void {
    try {
      fs.writeFileSync(this.licensePath, key, 'utf-8');
    } catch (e) {
      console.error('Failed to save license key:', e);
    }
  }

  private readSavedLicenseKey(): string | undefined {
    try {
      if (fs.existsSync(this.licensePath)) {
        return fs.readFileSync(this.licensePath, 'utf-8');
      }
    } catch (e) {
      console.error('Failed to read license key:', e);
    }
    return undefined;
  }

  private deleteLicenseKey(): void {
    try {
      if (fs.existsSync(this.licensePath)) {
        fs.unlinkSync(this.licensePath);
      }
    } catch (e) {
      console.error('Failed to delete license key:', e);
    }
  }
}
