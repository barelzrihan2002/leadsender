import { useEffect, useState } from 'react';
import { User, Mail, Calendar, Key, Languages, Shield, Info, CreditCard, Monitor, Globe, Download, RefreshCw, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/lib/api';
import type { LicenseInfo } from '@/types';

export default function Settings() {
  const { language, setLanguage, t, dir } = useLanguage();
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const [userInfo, setUserInfo] = useState<{ email?: string; name?: string }>({});
  const [loading, setLoading] = useState(true);
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [checkingForUpdates, setCheckingForUpdates] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloadingUpdate, setDownloadingUpdate] = useState(false);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [newVersion, setNewVersion] = useState<string>('');

  useEffect(() => {
    loadSettings();
    loadVersion();
    setupUpdateListeners();

    return () => {
      // Clean up listeners
      window.electron.removeListener('updater:checking-for-update', handleCheckingForUpdate);
      window.electron.removeListener('updater:update-available', handleUpdateAvailable);
      window.electron.removeListener('updater:update-not-available', handleUpdateNotAvailable);
      window.electron.removeListener('updater:download-progress', handleDownloadProgress);
      window.electron.removeListener('updater:update-downloaded', handleUpdateDownloaded);
      window.electron.removeListener('updater:error', handleUpdateError);
    };
  }, []);

  const loadVersion = async () => {
    try {
      const version = await window.electron.updater.getVersion();
      setCurrentVersion(version);
    } catch (error) {
      console.error('Failed to load version:', error);
    }
  };

  const setupUpdateListeners = () => {
    window.electron.on('updater:checking-for-update', handleCheckingForUpdate);
    window.electron.on('updater:update-available', handleUpdateAvailable);
    window.electron.on('updater:update-not-available', handleUpdateNotAvailable);
    window.electron.on('updater:download-progress', handleDownloadProgress);
    window.electron.on('updater:update-downloaded', handleUpdateDownloaded);
    window.electron.on('updater:error', handleUpdateError);
  };

  const handleCheckingForUpdate = () => {
    setCheckingForUpdates(true);
  };

  const handleUpdateAvailable = (info: any) => {
    setCheckingForUpdates(false);
    setUpdateAvailable(true);
    setNewVersion(info.version);
    toast.info(
      language === 'he' 
        ? `עדכון חדש זמין! גרסה ${info.version}` 
        : language === 'ar'
        ? `تحديث جديد متاح! إصدار ${info.version}`
        : `New update available! Version ${info.version}`
    );
  };

  const handleUpdateNotAvailable = () => {
    setCheckingForUpdates(false);
    setUpdateAvailable(false);
  };

  const handleDownloadProgress = (progress: any) => {
    setDownloadProgress(Math.round(progress.percent));
  };

  const handleUpdateDownloaded = (info: any) => {
    setDownloadingUpdate(false);
    setUpdateDownloaded(true);
    toast.success(
      language === 'he'
        ? `עדכון הורד בהצלחה! גרסה ${info.version}`
        : language === 'ar'
        ? `تم تنزيل التحديث بنجاح! إصدار ${info.version}`
        : `Update downloaded successfully! Version ${info.version}`
    );
  };

  const handleUpdateError = (error: string) => {
    setCheckingForUpdates(false);
    setDownloadingUpdate(false);
    toast.error(
      language === 'he'
        ? `שגיאה בעדכון: ${error}`
        : language === 'ar'
        ? `خطأ في التحديث: ${error}`
        : `Update error: ${error}`
    );
  };

  const checkForUpdates = async () => {
    try {
      setCheckingForUpdates(true);
      await window.electron.updater.checkForUpdates();
    } catch (error: any) {
      toast.error(
        language === 'he'
          ? 'שגיאה בבדיקת עדכונים'
          : language === 'ar'
          ? 'خطأ في التحقق من التحديثات'
          : 'Error checking for updates'
      );
      setCheckingForUpdates(false);
    }
  };

  const downloadUpdate = async () => {
    try {
      setDownloadingUpdate(true);
      await window.electron.updater.downloadUpdate();
    } catch (error) {
      toast.error(
        language === 'he'
          ? 'שגיאה בהורדת עדכון'
          : language === 'ar'
          ? 'خطأ في تنزيل التحديث'
          : 'Error downloading update'
      );
      setDownloadingUpdate(false);
    }
  };

  const installUpdate = () => {
    window.electron.updater.installUpdate();
  };

  const loadSettings = async () => {
    try {
      // Load license info
      const license = await api.license.check();
      setLicenseInfo(license);

      // Load user info
      const user = await api.license.getUser();
      setUserInfo(user);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = (lang: 'en' | 'he') => {
    setLanguage(lang);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getLicenseStatusColor = (): 'default' | 'destructive' | 'outline' | 'secondary' => {
    if (!licenseInfo?.isValid) return 'destructive';
    if (licenseInfo.daysLeft && licenseInfo.daysLeft < 7) return 'secondary';
    return 'default';
  };

  const getLicenseStatusText = () => {
    if (!licenseInfo?.isValid) return t('settings.invalid');
    if (licenseInfo.status === 'expired') return t('settings.expired');
    if (licenseInfo.status === 'suspended') return t('settings.suspended');
    if (licenseInfo.status === 'grace_period') return t('settings.gracePeriod');
    return t('settings.active');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          {t('settings.title')}
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          {t('settings.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Main Settings */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Account Information */}
          <Card className="overflow-hidden border-none shadow-md hover:shadow-lg transition-shadow duration-300">
            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-1 h-2 w-full"></div>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-xl">{t('settings.accountInfo')}</CardTitle>
                  <CardDescription>{t('settings.accountDetails')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2.5">
                  <Label className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    {t('settings.name')}
                  </Label>
                  <div className="relative group">
                    <Input
                      value={userInfo?.name || t('settings.notSet')}
                      readOnly
                      className="bg-muted/30 border-muted-foreground/20 focus-visible:ring-0 font-medium pl-3 h-11 transition-all group-hover:bg-muted/50"
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <Label className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    {t('settings.email')}
                  </Label>
                  <div className="relative group">
                    <Input
                      value={userInfo?.email || t('settings.notSet')}
                      readOnly
                      className="bg-muted/30 border-muted-foreground/20 focus-visible:ring-0 font-medium pl-3 h-11 transition-all group-hover:bg-muted/50"
                      type="email"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* License Information */}
          <Card className="overflow-hidden border-none shadow-md hover:shadow-lg transition-shadow duration-300">
            <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-1 h-2 w-full"></div>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <CreditCard className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{t('settings.licenseInfo')}</CardTitle>
                    <CardDescription>{t('settings.licenseDetails')}</CardDescription>
                  </div>
                </div>
                <Badge 
                  variant={getLicenseStatusColor()}
                  className={cn(
                    "px-3 py-1 text-sm font-medium capitalize shadow-sm",
                    getLicenseStatusColor() === 'default' && 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300'
                  )}
                >
                  {getLicenseStatusText()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted/30 rounded-xl p-5 border border-muted-foreground/10">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">{t('settings.timeRemaining')}</p>
                    <p className="text-xs text-muted-foreground/70">
                      {language === 'he' ? 'עד פקיעת הרישיון' : 'Until license expiration'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-baseline gap-1.5 justify-end">
                      <span className={`text-3xl font-bold tracking-tight ${
                        licenseInfo?.daysLeft && licenseInfo.daysLeft < 7 ? 'text-destructive' : 
                        licenseInfo?.daysLeft && licenseInfo.daysLeft < 30 ? 'text-amber-600' : 
                        'text-green-600 dark:text-green-400'
                      }`}>
                        {licenseInfo?.daysLeft}
                      </span>
                      <span className="text-sm font-medium text-muted-foreground">
                        {t('settings.daysLeft')}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 h-2 w-full bg-muted/50 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
                    style={{ width: `${Math.min(100, Math.max(0, ((licenseInfo?.daysLeft || 0) / 365) * 100))}%` }}
                  />
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2.5">
                  <Label className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                    <Key className="h-3.5 w-3.5" />
                    {t('settings.licenseKey')}
                  </Label>
                  <div className="relative group">
                    <Input
                      value={licenseInfo?.licenseKey || 'N/A'}
                      readOnly
                      className="bg-muted/30 font-mono text-sm border-muted-foreground/20 focus-visible:ring-0 h-11 transition-all group-hover:bg-muted/50"
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <Label className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    {t('settings.expiresOn')}
                  </Label>
                  <div className="relative group">
                    <Input
                      value={formatDate(licenseInfo?.expiresAt)}
                      readOnly
                      className="bg-muted/30 border-muted-foreground/20 focus-visible:ring-0 h-11 transition-all group-hover:bg-muted/50"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Preferences */}
        <div className="space-y-8">
          {/* Language Preferences */}
          <Card className="overflow-hidden border-none shadow-md hover:shadow-lg transition-shadow duration-300">
            <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 p-1 h-2 w-full"></div>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <Globe className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">{t('settings.language')}</CardTitle>
                  <CardDescription>{t('settings.chooseLanguage')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label className="text-sm font-medium text-muted-foreground">{t('settings.appLanguage')}</Label>
                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={() => handleLanguageChange('en')}
                    className={`
                      relative flex items-center gap-4 p-3 rounded-xl border-2 transition-all duration-200 group
                      ${language === 'en'
                        ? 'border-primary bg-primary/5 shadow-sm scale-[1.02]'
                        : 'border-transparent bg-muted/30 hover:bg-muted hover:scale-[1.01]'
                      }
                    `}
                  >
                    <span className="text-3xl filter drop-shadow-sm group-hover:scale-110 transition-transform">🇺🇸</span>
                    <div className="text-left flex-1">
                      <p className={`font-semibold text-sm ${language === 'en' ? 'text-primary' : 'text-foreground'}`}>English</p>
                      <p className="text-xs text-muted-foreground">United States</p>
                    </div>
                    {language === 'en' && (
                      <div className="h-2 w-2 rounded-full bg-primary shadow-lg shadow-primary/50 animate-pulse"></div>
                    )}
                  </button>

                  <button
                    onClick={() => handleLanguageChange('he')}
                    className={`
                      relative flex items-center gap-4 p-3 rounded-xl border-2 transition-all duration-200 group
                      ${language === 'he'
                        ? 'border-primary bg-primary/5 shadow-sm scale-[1.02]'
                        : 'border-transparent bg-muted/30 hover:bg-muted hover:scale-[1.01]'
                      }
                    `}
                  >
                    <span className="text-3xl filter drop-shadow-sm group-hover:scale-110 transition-transform">🇮🇱</span>
                    <div className="text-left flex-1">
                      <p className={`font-semibold text-sm ${language === 'he' ? 'text-primary' : 'text-foreground'}`}>עברית</p>
                      <p className="text-xs text-muted-foreground">Israel</p>
                    </div>
                    {language === 'he' && (
                      <div className="h-2 w-2 rounded-full bg-primary shadow-lg shadow-primary/50 animate-pulse"></div>
                    )}
                  </button>

                  <button
                    onClick={() => handleLanguageChange('ar')}
                    className={`
                      relative flex items-center gap-4 p-3 rounded-xl border-2 transition-all duration-200 group
                      ${language === 'ar'
                        ? 'border-primary bg-primary/5 shadow-sm scale-[1.02]'
                        : 'border-transparent bg-muted/30 hover:bg-muted hover:scale-[1.01]'
                      }
                    `}
                  >
                    <span className="text-3xl filter drop-shadow-sm group-hover:scale-110 transition-transform">🇸🇦</span>
                    <div className="text-left flex-1">
                      <p className={`font-semibold text-sm ${language === 'ar' ? 'text-primary' : 'text-foreground'}`}>العربية</p>
                      <p className="text-xs text-muted-foreground">Arabic</p>
                    </div>
                    {language === 'ar' && (
                      <div className="h-2 w-2 rounded-full bg-primary shadow-lg shadow-primary/50 animate-pulse"></div>
                    )}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Application Info */}
          <Card className="overflow-hidden border-none shadow-md hover:shadow-lg transition-shadow duration-300">
            <div className="bg-gradient-to-r from-slate-500/10 to-gray-500/10 p-1 h-2 w-full"></div>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <Monitor className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </div>
                <CardTitle className="text-lg">{t('settings.appInfo')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/30 rounded-xl p-4 space-y-3 border border-muted-foreground/10">
                <div className="flex justify-between items-center text-sm p-2 hover:bg-muted/50 rounded-lg transition-colors">
                  <span className="text-muted-foreground font-medium">{t('settings.version')}</span>
                  <span className="font-mono bg-background px-2 py-1 rounded border shadow-sm">v{currentVersion}</span>
                </div>
                <Separator className="bg-border/50" />
                <div className="flex justify-between items-center text-sm p-2 hover:bg-muted/50 rounded-lg transition-colors">
                  <span className="text-muted-foreground font-medium">{t('settings.environment')}</span>
                  <Badge variant="outline" className="text-xs font-mono capitalize bg-background shadow-sm">
                    {process.env.NODE_ENV || 'production'}
                  </Badge>
                </div>
              </div>
              
              <div className="mt-6 text-center">
                <p className="text-xs text-muted-foreground/50">
                  © 2026 LeadSender. All rights reserved.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Auto Updates */}
          <Card className="overflow-hidden border-none shadow-md hover:shadow-lg transition-shadow duration-300">
            <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 p-1 h-2 w-full"></div>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
                  <Download className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {language === 'he' ? 'עדכונים אוטומטיים' : language === 'ar' ? 'التحديثات التلقائية' : 'Auto Updates'}
                  </CardTitle>
                  <CardDescription>
                    {language === 'he' 
                      ? 'בדוק והתקן עדכונים חדשים' 
                      : language === 'ar'
                      ? 'تحقق وقم بتثبيت التحديثات الجديدة'
                      : 'Check and install new updates'
                    }
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {updateDownloaded ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border-2 border-green-200 dark:border-green-800">
                    <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold text-green-900 dark:text-green-100">
                        {language === 'he' 
                          ? `גרסה ${newVersion} מוכנה להתקנה!`
                          : language === 'ar'
                          ? `الإصدار ${newVersion} جاهز للتثبيت!`
                          : `Version ${newVersion} ready to install!`
                        }
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        {language === 'he'
                          ? 'לחץ על "התקן עכשיו" כדי להפעיל מחדש ולעדכן'
                          : language === 'ar'
                          ? 'انقر على "تثبيت الآن" لإعادة التشغيل والتحديث'
                          : 'Click "Install Now" to restart and update'
                        }
                      </p>
                    </div>
                  </div>
                  <Button onClick={installUpdate} className="w-full" size="lg">
                    <Download className="h-4 w-4 mr-2" />
                    {language === 'he' ? 'התקן עכשיו' : language === 'ar' ? 'تثبيت الآن' : 'Install Now'}
                  </Button>
                </div>
              ) : downloadingUpdate ? (
                <div className="space-y-3">
                  <div className="text-center p-4">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary mb-2" />
                    <p className="font-medium">
                      {language === 'he' ? 'מוריד עדכון...' : language === 'ar' ? 'جاري التنزيل...' : 'Downloading update...'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">{downloadProgress}%</p>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                </div>
              ) : updateAvailable ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border-2 border-blue-200 dark:border-blue-800">
                    <Info className="h-6 w-6 text-blue-600 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold text-blue-900 dark:text-blue-100">
                        {language === 'he'
                          ? `גרסה חדשה זמינה: ${newVersion}`
                          : language === 'ar'
                          ? `إصدار جديد متاح: ${newVersion}`
                          : `New version available: ${newVersion}`
                        }
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        {language === 'he'
                          ? 'לחץ להורדת העדכון'
                          : language === 'ar'
                          ? 'انقر لتنزيل التحديث'
                          : 'Click to download the update'
                        }
                      </p>
                    </div>
                  </div>
                  <Button onClick={downloadUpdate} className="w-full" size="lg">
                    <Download className="h-4 w-4 mr-2" />
                    {language === 'he' ? 'הורד עדכון' : language === 'ar' ? 'تنزيل التحديث' : 'Download Update'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-center p-4 bg-muted/30 rounded-xl">
                    <CheckCircle className="h-8 w-8 mx-auto text-green-600 mb-2" />
                    <p className="font-medium">
                      {language === 'he' ? 'אתה עדכני!' : language === 'ar' ? 'أنت محدث!' : 'You\'re up to date!'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {language === 'he' 
                        ? `גרסה נוכחית: v${currentVersion}`
                        : language === 'ar'
                        ? `الإصدار الحالي: v${currentVersion}`
                        : `Current version: v${currentVersion}`
                      }
                    </p>
                  </div>
                  <Button 
                    onClick={checkForUpdates} 
                    variant="outline" 
                    className="w-full" 
                    disabled={checkingForUpdates}
                  >
                    {checkingForUpdates ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        {language === 'he' ? 'בודק...' : language === 'ar' ? 'جاري التحقق...' : 'Checking...'}
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        {language === 'he' ? 'בדוק עדכונים' : language === 'ar' ? 'تحقق من التحديثات' : 'Check for Updates'}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
