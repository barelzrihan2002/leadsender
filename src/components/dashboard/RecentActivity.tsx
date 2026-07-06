import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle, Clock, MessageSquare, UserPlus, PlayCircle } from 'lucide-react';
import { formatDistance } from 'date-fns';
import { he, ar } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Activity } from '@/types';

interface RecentActivityProps {
  activities: (Activity & { timestamp: Date })[];
}

export default function RecentActivity({ activities }: RecentActivityProps) {
  const { t, dir, language } = useLanguage();
  
  // Translate activity messages
  const translateActivity = (message: string): string => {
    if (language === 'en') return message;
    
    // Translations for common activity patterns (Hebrew and Arabic)
    // Order matters! More specific patterns should come first
    const hePatterns = [
      // Account activities - most specific first
      { pattern: /Account (.+?) connecting via QR Code/i, template: (name: string) => `חשבון ${name} מתחבר דרך קוד QR` },
      { pattern: /Account (.+?) connecting via Pairing Code/i, template: (name: string) => `חשבון ${name} מתחבר דרך קוד זיווג` },
      { pattern: /Account (.+?) added/i, template: (name: string) => `חשבון ${name} נוסף` },
      { pattern: /Account (.+?) connected successfully/i, template: (name: string) => `חשבון ${name} התחבר בהצלחה` },
      { pattern: /Account (.+?) connected/i, template: (name: string) => `חשבון ${name} התחבר` },
      { pattern: /Account (.+?) disconnected/i, template: (name: string) => `חשבון ${name} התנתק` },
      { pattern: /Account (.+?) deleted successfully/i, template: (name: string) => `חשבון ${name} נמחק בהצלחה` },
      { pattern: /Account (.+?) deleted/i, template: (name: string) => `חשבון ${name} נמחק` },
      { pattern: /Account (.+?) updated/i, template: (name: string) => `חשבון ${name} עודכן` },
      { pattern: /Campaign "(.+)" started/i, template: (name: string) => `קמפיין "${name}" התחיל` },
      { pattern: /Campaign "(.+)" completed/i, template: (name: string) => `קמפיין "${name}" הושלם` },
      { pattern: /Campaign "(.+)" paused/i, template: (name: string) => `קמפיין "${name}" הושהה` },
      { pattern: /Campaign "(.+)" stopped/i, template: (name: string) => `קמפיין "${name}" נעצר` },
      { pattern: /Campaign "(.+)" created/i, template: (name: string) => `קמפיין "${name}" נוצר` },
      { pattern: /Campaign "(.+)" deleted/i, template: (name: string) => `קמפיין "${name}" נמחק` },
      { pattern: /Campaign "(.+)" auto-resumed after app restart/i, template: (name: string) => `קמפיין "${name}" התחדש אוטומטית לאחר הפעלת האפליקציה` },
      { pattern: /(\d+) contacts imported/i, template: (count: string) => `${count} אנשי קשר יובאו` },
      { pattern: /Contact (.+) created/i, template: (name: string) => `איש קשר ${name} נוצר` },
      { pattern: /Contact (.+) added/i, template: (name: string) => `איש קשר ${name} נוסף` },
      { pattern: /Contact (.+) deleted/i, template: (name: string) => `איש קשר ${name} נמחק` },
      { pattern: /Contact (.+) updated/i, template: (name: string) => `איש קשר ${name} עודכן` },
      { pattern: /Warm-up session started with (\d+) accounts/i, template: (count: string) => `סשן חימום התחיל עם ${count} חשבונות` },
      { pattern: /Warm-up session stopped/i, template: () => `סשן חימום נעצר` },
      { pattern: /Tag "(.+)" created/i, template: (name: string) => `תג "${name}" נוצר` },
      { pattern: /Tag "(.+)" added/i, template: (name: string) => `תג "${name}" נוסף` },
      { pattern: /Tag "(.+)" deleted/i, template: (name: string) => `תג "${name}" נמחק` },
      { pattern: /Message sent to (.+)/i, template: (to: string) => `הודעה נשלחה אל ${to}` },
      { pattern: /New message from (.+)/i, template: (from: string) => `הודעה חדשה מ${from}` },
      { pattern: /Profile picture updated for (.+)/i, template: (name: string) => `תמונת פרופיל עודכנה עבור ${name}` },
      { pattern: /(\d+) profile pictures refreshed/i, template: (count: string) => `${count} תמונות פרופיל רועננו` },
    ];

    const arPatterns = [
      // Account activities - most specific first
      { pattern: /Account (.+?) connecting via QR Code/i, template: (name: string) => `الحساب ${name} يتصل عبر رمز QR` },
      { pattern: /Account (.+?) connecting via Pairing Code/i, template: (name: string) => `الحساب ${name} يتصل عبر رمز الإقران` },
      { pattern: /Account (.+?) added/i, template: (name: string) => `تمت إضافة الحساب ${name}` },
      { pattern: /Account (.+?) connected successfully/i, template: (name: string) => `تم توصيل الحساب ${name} بنجاح` },
      { pattern: /Account (.+?) connected/i, template: (name: string) => `تم توصيل الحساب ${name}` },
      { pattern: /Account (.+?) disconnected/i, template: (name: string) => `تم قطع اتصال الحساب ${name}` },
      { pattern: /Account (.+?) deleted successfully/i, template: (name: string) => `تم حذف الحساب ${name} بنجاح` },
      { pattern: /Account (.+?) deleted/i, template: (name: string) => `تم حذف الحساب ${name}` },
      { pattern: /Account (.+?) updated/i, template: (name: string) => `تم تحديث الحساب ${name}` },
      { pattern: /Campaign "(.+?)" started/i, template: (name: string) => `بدأت الحملة "${name}"` },
      { pattern: /Campaign "(.+?)" completed/i, template: (name: string) => `اكتملت الحملة "${name}"` },
      { pattern: /Campaign "(.+?)" paused/i, template: (name: string) => `تم إيقاف الحملة "${name}" مؤقتاً` },
      { pattern: /Campaign "(.+?)" stopped/i, template: (name: string) => `تم إيقاف الحملة "${name}"` },
      { pattern: /Campaign "(.+?)" created/i, template: (name: string) => `تم إنشاء الحملة "${name}"` },
      { pattern: /Campaign "(.+?)" deleted/i, template: (name: string) => `تم حذف الحملة "${name}"` },
      { pattern: /Campaign "(.+?)" auto-resumed after app restart/i, template: (name: string) => `تم استئناف الحملة "${name}" تلقائياً بعد إعادة تشغيل التطبيق` },
      { pattern: /(\d+) contacts imported/i, template: (count: string) => `تم استيراد ${count} جهة اتصال` },
      { pattern: /Contact (.+?) created/i, template: (name: string) => `تم إنشاء جهة الاتصال ${name}` },
      { pattern: /Contact (.+?) added/i, template: (name: string) => `تمت إضافة جهة الاتصال ${name}` },
      { pattern: /Contact (.+?) deleted/i, template: (name: string) => `تم حذف جهة الاتصال ${name}` },
      { pattern: /Contact (.+?) updated/i, template: (name: string) => `تم تحديث جهة الاتصال ${name}` },
      { pattern: /Warm-up session started with (\d+) accounts/i, template: (count: string) => `بدأت جلسة الإحماء مع ${count} حساب` },
      { pattern: /Warm-up session stopped/i, template: () => `تم إيقاف جلسة الإحماء` },
      { pattern: /Tag "(.+?)" created/i, template: (name: string) => `تم إنشاء العلامة "${name}"` },
      { pattern: /Tag "(.+?)" added/i, template: (name: string) => `تمت إضافة العلامة "${name}"` },
      { pattern: /Tag "(.+?)" deleted/i, template: (name: string) => `تم حذف العلامة "${name}"` },
      { pattern: /Message sent to (.+)/i, template: (to: string) => `تم إرسال رسالة إلى ${to}` },
      { pattern: /New message from (.+)/i, template: (from: string) => `رسالة جديدة من ${from}` },
      { pattern: /Profile picture updated for (.+)/i, template: (name: string) => `تم تحديث صورة الملف الشخصي لـ ${name}` },
      { pattern: /(\d+) profile pictures refreshed/i, template: (count: string) => `تم تحديث ${count} صورة ملف شخصي` },
    ];

    const patterns = language === 'ar' ? arPatterns : hePatterns;
    
    for (const { pattern, template } of patterns) {
      const match = message.match(pattern);
      if (match) {
        return template(match[1]);
      }
    }
    
    return message; // Return original if no pattern matches
  };
  const getIcon = (type: Activity['type']) => {
    switch (type) {
      case 'success':
        return <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-full"><CheckCircle2 className="h-4 w-4 text-green-600" /></div>;
      case 'error':
        return <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-full"><XCircle className="h-4 w-4 text-red-600" /></div>;
      case 'pending':
        return <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-full"><Clock className="h-4 w-4 text-yellow-600" /></div>;
      case 'message':
        return <div className="p-2 bg-primary/20 dark:bg-primary/30 rounded-full"><MessageSquare className="h-4 w-4 text-primary" /></div>;
      case 'account':
        return <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-full"><UserPlus className="h-4 w-4 text-purple-600" /></div>;
      case 'campaign':
        return <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-full"><PlayCircle className="h-4 w-4 text-orange-600" /></div>;
      default:
        return <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full"><Clock className="h-4 w-4 text-gray-600" /></div>;
    }
  };

  return (
    <Card className="col-span-1 h-full">
      <CardHeader>
        <CardTitle>{t('dashboard.recentActivity')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="p-3 bg-muted rounded-full mb-3">
                <Clock className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">{t('dashboard.noRecentActivity')}</p>
            </div>
          ) : (
            activities.map((activity, index) => (
              <div key={activity.id} className="flex items-start gap-4 relative group">
                {/* Vertical line connector */}
                {index !== activities.length - 1 && (
                  <div 
                    className="absolute top-10 bottom-[-24px] w-[2px] bg-muted group-last:hidden"
                    style={{ [dir === 'rtl' ? 'right' : 'left']: '19px' }}
                  />
                )}
                
                {getIcon(activity.type)}
                
                <div className="flex-1 space-y-1 py-1">
                  <p className="text-sm font-medium leading-none">{translateActivity(activity.message)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistance(activity.timestamp, new Date(), { 
                      addSuffix: true,
                      locale: language === 'he' ? he : language === 'ar' ? ar : undefined 
                    })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
