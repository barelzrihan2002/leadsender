import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

interface CountrySelectorProps {
  open: boolean;
  onSelect: (country: 'israel' | 'usa' | 'saudi' | 'international') => void;
  onCancel: () => void;
}

export default function CountrySelector({ open, onSelect, onCancel }: CountrySelectorProps) {
  const { language } = useLanguage();

  const countries = [
    {
      code: 'israel' as const,
      flag: '🇮🇱',
      nameEn: 'Israel',
      nameHe: 'ישראל',
      nameAr: 'إسرائيل',
      prefix: '+972',
      examples: ['05XXXXXXXX → 9725XXXXXXXX', '5XXXXXXXX → 972XXXXXXXX', '+972XXXXXXXX → 972XXXXXXXX']
    },
    {
      code: 'usa' as const,
      flag: '🇺🇸',
      nameEn: 'United States',
      nameHe: 'ארצות הברית',
      nameAr: 'الولايات المتحدة',
      prefix: '+1',
      examples: ['5551234567 → 15551234567', '+15551234567 → 15551234567']
    },
    {
      code: 'saudi' as const,
      flag: '🇸🇦',
      nameEn: 'Saudi Arabia',
      nameHe: 'ערב הסעודית',
      nameAr: 'المملكة العربية السعودية',
      prefix: '+966',
      examples: ['05XXXXXXXX → 9665XXXXXXXX', '5XXXXXXXX → 966XXXXXXXX']
    },
    {
      code: 'international' as const,
      flag: '🌍',
      nameEn: 'International',
      nameHe: 'בינלאומי',
      nameAr: 'دولي',
      prefix: '',
      examples: [language === 'he' ? 'ללא שינויים' : language === 'ar' ? 'بدون تغييرات' : 'No changes']
    }
  ];

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {language === 'he' 
              ? 'בחר פורמט מספרי טלפון'
              : language === 'ar'
              ? 'اختر تنسيق أرقام الهواتف'
              : 'Select Phone Number Format'
            }
          </DialogTitle>
          <DialogDescription>
            {language === 'he'
              ? 'בחר את המדינה כדי לנרמל אוטומטית את מספרי הטלפון בקובץ'
              : language === 'ar'
              ? 'اختر البلد لتطبيع أرقام الهواتف تلقائياً في الملف'
              : 'Select the country to automatically normalize phone numbers in the file'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {countries.map((country) => (
            <button
              key={country.code}
              onClick={() => onSelect(country.code)}
              className="group relative flex flex-col p-5 rounded-xl border-2 border-border hover:border-primary transition-all duration-200 hover:shadow-md hover:scale-[1.02] bg-card hover:bg-accent/50"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-4xl filter drop-shadow-sm group-hover:scale-110 transition-transform">
                  {country.flag}
                </span>
                <div className="text-left">
                  <p className="font-bold text-base">
                    {language === 'he' ? country.nameHe : language === 'ar' ? country.nameAr : country.nameEn}
                  </p>
                  {country.prefix && (
                    <p className="text-sm text-muted-foreground font-mono">{country.prefix}</p>
                  )}
                </div>
              </div>
              
              <div className="space-y-1 mt-2 border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  {language === 'he' ? 'דוגמאות:' : language === 'ar' ? 'أمثلة:' : 'Examples:'}
                </p>
                {country.examples.map((example, idx) => (
                  <p key={idx} className="text-xs font-mono text-muted-foreground bg-muted/30 px-2 py-1 rounded">
                    {example}
                  </p>
                ))}
              </div>
              
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="h-2 w-2 rounded-full bg-primary"></div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-xs text-blue-800 dark:text-blue-200 flex items-start gap-2">
            <span className="text-base">💡</span>
            <span>
              {language === 'he'
                ? 'המערכת תתקן אוטומטית פורמטים שונים: 05XXXXXXXX, 5XXXXXXXX, +972XXXXXXXX → 972XXXXXXXX'
                : language === 'ar'
                ? 'سيقوم النظام بتصحيح التنسيقات المختلفة تلقائياً: 05XXXXXXXX, 5XXXXXXXX, +972XXXXXXXX ← 972XXXXXXXX'
                : 'The system will automatically fix different formats: 05XXXXXXXX, 5XXXXXXXX, +972XXXXXXXX → 972XXXXXXXX'
              }
            </span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
