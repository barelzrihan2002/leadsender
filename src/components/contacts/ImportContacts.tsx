import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, ArrowRight, Check } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import CountrySelector from './CountrySelector';
import DuplicateHandler from './DuplicateHandler';
import { normalizePhoneNumber, type Country } from '@/lib/phoneNormalizer';
import { api } from '@/lib/api';

interface ImportContactsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

interface PreviewContact {
  original: string;
  normalized: string;
  name?: string;
  changed: boolean;
}

export default function ImportContacts({ open, onOpenChange, onImported }: ImportContactsProps) {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [showCountrySelector, setShowCountrySelector] = useState(false);
  const [showDuplicateHandler, setShowDuplicateHandler] = useState(false);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [rawContacts, setRawContacts] = useState<any[]>([]);
  const [previewContacts, setPreviewContacts] = useState<PreviewContact[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [duplicateAction, setDuplicateAction] = useState<'update' | 'skip' | null>(null);
  const [step, setStep] = useState<'select' | 'country' | 'duplicates' | 'preview'>('select');

  const handleFileSelect = async () => {
    try {
      const filePath = await api.contacts.selectFile();
      if (filePath) {
        setSelectedFilePath(filePath);
        const fileName = filePath.split('\\').pop()?.split('/').pop() || 'Unknown file';
        setSelectedFileName(fileName);
        
        // Show country selector
        setShowCountrySelector(true);
        setStep('country');
      }
    } catch (error) {
      console.error('Failed to select file:', error);
      toast.error(t('toast.error'));
    }
  };

  const handleCountrySelect = async (country: Country) => {
    setSelectedCountry(country);
    setShowCountrySelector(false);
    
    if (!selectedFilePath) return;
    
    // Check for duplicates first
    setLoading(true);
    try {
      // Check duplicates
      const duplicateResult = await api.contacts.checkDuplicates(selectedFilePath, country);
      
      if (duplicateResult.duplicateCount > 0) {
        // Show duplicate handler
        setDuplicateCount(duplicateResult.duplicateCount);
        setShowDuplicateHandler(true);
        setStep('duplicates');
      } else {
        // No duplicates - go straight to preview
        await showPreview(country);
      }
    } catch (error) {
      console.error('Failed to check duplicates:', error);
      toast.error(t('toast.error'));
      setStep('select');
    } finally {
      setLoading(false);
    }
  };

  const showPreview = async (country: Country) => {
    if (!selectedFilePath) return;
    
    setLoading(true);
    try {
      setStep('preview');
      
      // Get preview from backend
      const result = await api.contacts.previewFile(selectedFilePath, country);
      setPreviewContacts(result.preview as PreviewContact[]);
      
      console.log(`Preview: ${result.preview.length} contacts, Total: ${result.totalCount}`);
    } catch (error) {
      console.error('Failed to process file:', error);
      toast.error(t('toast.error'));
      setStep('select');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicateAction = async (action: 'update' | 'skip') => {
    setDuplicateAction(action);
    setShowDuplicateHandler(false);
    
    // Continue to preview
    if (selectedCountry) {
      await showPreview(selectedCountry);
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedFilePath || !selectedCountry) return;

    setLoading(true);
    try {
      // Call import with country normalization and duplicate handling
      const count = await api.contacts.importFromFile(selectedFilePath, selectedCountry, duplicateAction || undefined);
      toast.success(t('contacts.importSuccess').replace('{count}', count.toString()));
      onImported();
      handleClose();
    } catch (error) {
      console.error('Failed to import contacts:', error);
      toast.error(t('toast.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedFilePath(null);
    setSelectedFileName(null);
    setRawContacts([]);
    setPreviewContacts([]);
    setSelectedCountry(null);
    setDuplicateAction(null);
    setDuplicateCount(0);
    setStep('select');
    setShowCountrySelector(false);
    setShowDuplicateHandler(false);
    onOpenChange(false);
  };

  const handleBack = () => {
    if (step === 'preview') {
      // Check if we came from duplicates or directly
      if (duplicateCount > 0) {
        setStep('duplicates');
        setShowDuplicateHandler(true);
      } else {
        setStep('country');
        setShowCountrySelector(true);
      }
    } else if (step === 'duplicates') {
      setStep('country');
      setShowCountrySelector(true);
      setShowDuplicateHandler(false);
    } else if (step === 'country') {
      setStep('select');
      setSelectedFilePath(null);
      setSelectedFileName(null);
    }
  };

  return (
    <>
      <Dialog open={open && step !== 'country'} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('contacts.importTitle')}</DialogTitle>
          </DialogHeader>

          {step === 'select' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  {t('contacts.importDesc')}
                </p>
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
              <div className="space-y-3">
                <p className="text-sm text-blue-900 dark:text-blue-100 font-semibold flex items-start gap-2">
                  <span className="text-lg">📋</span>
                  <span>
                    {language === 'he' 
                      ? 'חשוב! כדי שעברית/ערבית יופיעו נכון:'
                      : language === 'ar'
                      ? 'مهم! لعرض العبرية/العربية بشكل صحيح:'
                      : 'Important! For Hebrew/Arabic to display correctly:'
                    }
                  </span>
                </p>
                <div className="space-y-2 text-xs text-blue-800 dark:text-blue-200 pr-7">
                  <p className="flex items-start gap-2">
                    <span>1.</span>
                    <span>
                      {language === 'he'
                        ? 'ב-Excel: קובץ → שמירה בשם'
                        : language === 'ar'
                        ? 'في Excel: ملف ← حفظ باسم'
                        : 'In Excel: File → Save As'
                      }
                    </span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span>2.</span>
                    <span>
                      {language === 'he'
                        ? 'בחר "CSV UTF-8 (מופרד בפסיקים)" (.csv)'
                        : language === 'ar'
                        ? 'اختر "CSV UTF-8 (مفصول بفواصل)" (.csv)'
                        : 'Choose "CSV UTF-8 (Comma delimited)" (.csv)'
                      }
                    </span>
                  </p>
                  <p className="flex items-start gap-2 text-amber-700 dark:text-amber-300 font-medium">
                    <span>⚠️</span>
                    <span>
                      {language === 'he'
                        ? 'אל תשמור כ-"CSV (מופרד בפסיקים)" רגיל - רק UTF-8!'
                        : language === 'ar'
                        ? 'لا تحفظ كـ "CSV عادي" - UTF-8 فقط!'
                        : 'Don\'t save as regular "CSV" - UTF-8 only!'
                      }
                    </span>
                  </p>
                </div>
              </div>
            </div>

                <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <Button variant="outline" onClick={handleFileSelect}>
                    {t('contacts.selectFile')}
                  </Button>
                  {selectedFileName && (
                    <p className="text-sm mt-2 text-muted-foreground">
                      {t('contacts.selected')}: {selectedFileName}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="text-sm font-medium text-green-800 dark:text-green-200 flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  {language === 'he'
                    ? `נבחרה: ${selectedCountry === 'israel' ? 'ישראל' : selectedCountry === 'usa' ? 'ארה"ב' : selectedCountry === 'saudi' ? 'סעודיה' : 'בינלאומי'}`
                    : language === 'ar'
                    ? `تم الاختيار: ${selectedCountry === 'israel' ? 'إسرائيل' : selectedCountry === 'usa' ? 'الولايات المتحدة' : selectedCountry === 'saudi' ? 'السعودية' : 'دولي'}`
                    : `Selected: ${selectedCountry?.toUpperCase()}`
                  }
                </p>
              </div>

              <div className="max-h-96 overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-medium">
                        {language === 'he' ? 'מקורי' : language === 'ar' ? 'الأصلي' : 'Original'}
                      </th>
                      <th className="p-3"></th>
                      <th className="text-left p-3 font-medium">
                        {language === 'he' ? 'מנורמל' : language === 'ar' ? 'منسق' : 'Normalized'}
                      </th>
                      <th className="text-left p-3 font-medium">{t('common.name')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewContacts.slice(0, 20).map((contact, idx) => (
                      <tr key={idx} className="border-t hover:bg-accent/30">
                        <td className="p-3 font-mono text-xs text-muted-foreground">{contact.original}</td>
                        <td className="p-3 text-center">
                          {contact.changed ? (
                            <ArrowRight className="h-3 w-3 text-primary" />
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className={`p-3 font-mono text-xs ${contact.changed ? 'text-green-600 font-semibold' : 'text-muted-foreground'}`}>
                          {contact.normalized}
                        </td>
                        <td className="p-3 text-xs">{contact.name || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center gap-2">
                <Button variant="outline" onClick={handleBack}>
                  {language === 'he' ? 'חזור' : language === 'ar' ? 'رجوع' : 'Back'}
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleClose}>
                    {t('common.cancel')}
                  </Button>
                  <Button onClick={handleConfirmImport} disabled={loading}>
                    {loading ? t('contacts.importing') : `${t('common.import')} ${previewContacts.length} ${language === 'he' ? 'אנשי קשר' : language === 'ar' ? 'جهات اتصال' : 'Contacts'}`}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Country Selector */}
      <CountrySelector
        open={showCountrySelector && step === 'country'}
        onSelect={handleCountrySelect}
        onCancel={handleBack}
      />

      {/* Duplicate Handler */}
      <DuplicateHandler
        open={showDuplicateHandler && step === 'duplicates'}
        duplicateCount={duplicateCount}
        onSelect={handleDuplicateAction}
        onCancel={handleBack}
      />
    </>
  );
}
