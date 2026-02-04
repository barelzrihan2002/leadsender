import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface DuplicateHandlerProps {
  open: boolean;
  duplicateCount: number;
  onSelect: (action: 'update' | 'skip') => void;
  onCancel: () => void;
}

export default function DuplicateHandler({ open, duplicateCount, onSelect, onCancel }: DuplicateHandlerProps) {
  const { language, t } = useLanguage();

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <DialogTitle className="text-xl">
              {language === 'he' 
                ? 'נמצאו מספרים כפולים'
                : language === 'ar'
                ? 'تم العثور على أرقام مكررة'
                : 'Duplicate Numbers Found'
              }
            </DialogTitle>
          </div>
          <DialogDescription className="text-base">
            {language === 'he'
              ? `נמצאו ${duplicateCount} מספרי טלפון שכבר קיימים במערכת. מה תרצה לעשות?`
              : language === 'ar'
              ? `تم العثور على ${duplicateCount} رقم هاتف موجود بالفعل في النظام. ماذا تريد أن تفعل؟`
              : `Found ${duplicateCount} phone numbers that already exist in the system. What would you like to do?`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {/* Option 1: Update */}
          <button
            onClick={() => onSelect('update')}
            className="group w-full text-left p-5 rounded-xl border-2 border-border hover:border-primary transition-all duration-200 hover:shadow-md hover:scale-[1.02] bg-card hover:bg-accent/50"
          >
            <div className="flex items-start gap-4">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg group-hover:scale-110 transition-transform">
                <RefreshCw className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-base mb-1">
                  {language === 'he'
                    ? 'עדכן תגים ושמות'
                    : language === 'ar'
                    ? 'تحديث العلامات والأسماء'
                    : 'Update Tags & Names'
                  }
                </p>
                <p className="text-sm text-muted-foreground">
                  {language === 'he'
                    ? 'הוסף תגים חדשים לאנשי קשר קיימים ועדכן שמות במידת הצורך'
                    : language === 'ar'
                    ? 'أضف علامات جديدة لجهات الاتصال الموجودة وقم بتحديث الأسماء إذا لزم الأمر'
                    : 'Add new tags to existing contacts and update names if provided'
                  }
                </p>
              </div>
            </div>
          </button>

          {/* Option 2: Skip */}
          <button
            onClick={() => onSelect('skip')}
            className="group w-full text-left p-5 rounded-xl border-2 border-border hover:border-destructive transition-all duration-200 hover:shadow-md hover:scale-[1.02] bg-card hover:bg-destructive/5"
          >
            <div className="flex items-start gap-4">
              <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg group-hover:scale-110 transition-transform">
                <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-base mb-1">
                  {language === 'he'
                    ? 'דלג על כפילויות'
                    : language === 'ar'
                    ? 'تخطي المكررات'
                    : 'Skip Duplicates'
                  }
                </p>
                <p className="text-sm text-muted-foreground">
                  {language === 'he'
                    ? 'התעלם ממספרים כפולים ויבא רק אנשי קשר חדשים'
                    : language === 'ar'
                    ? 'تجاهل الأرقام المكررة واستورد جهات الاتصال الجديدة فقط'
                    : 'Ignore duplicate numbers and only import new contacts'
                  }
                </p>
              </div>
            </div>
          </button>

          {/* Cancel */}
          <div className="pt-2">
            <Button variant="outline" onClick={onCancel} className="w-full">
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
