import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Upload, ArrowRight, Check, FileText, ClipboardPaste, AlertTriangle, Download } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import CountrySelector from './CountrySelector';
import DuplicateHandler from './DuplicateHandler';
import { normalizePhoneNumber, type Country } from '@/lib/phoneNormalizer';
import { api } from '@/lib/api';
import * as XLSX from 'xlsx';

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
  isValid: boolean;
  validationError?: string;
}

export default function ImportContacts({ open, onOpenChange, onImported }: ImportContactsProps) {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; percent: number } | null>(null);
  const [importMode, setImportMode] = useState<'file' | 'paste'>('file');
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [showCountrySelector, setShowCountrySelector] = useState(false);
  const [showDuplicateHandler, setShowDuplicateHandler] = useState(false);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [rawContacts, setRawContacts] = useState<any[]>([]);
  const [previewContacts, setPreviewContacts] = useState<PreviewContact[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [duplicateAction, setDuplicateAction] = useState<'update' | 'skip' | null>(null);
  const [step, setStep] = useState<'select' | 'country' | 'duplicates' | 'preview'>('select');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedTagForPaste, setSelectedTagForPaste] = useState<string>('');
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  useEffect(() => {
    if (open) {
      loadTags();
    }
  }, [open]);

  const loadTags = async () => {
    try {
      const tags = await api.tags.getAll();
      setAvailableTags(tags.filter((t: any) => !t.is_system));
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  // Validate phone number AFTER normalization (only check digit count, not prefix)
  const validatePhoneNumber = (normalized: string, country: Country): { isValid: boolean; error?: string } => {
    if (!normalized || normalized.length === 0) {
      return { isValid: false, error: 'Empty number' };
    }

    // Only validate LENGTH after normalization - prefix should already be added by normalizePhone
    switch (country) {
      case 'israel':
        // Israel: Should be exactly 12 digits after normalization
        if (normalized.length !== 12) {
          return { isValid: false, error: `${normalized.length} digits (need 12)` };
        }
        break;
        
      case 'usa':
        // USA: Should be exactly 11 digits after normalization
        if (normalized.length !== 11) {
          return { isValid: false, error: `${normalized.length} digits (need 11)` };
        }
        break;
        
      case 'saudi':
        // Saudi Arabia: Should be exactly 12 digits after normalization
        if (normalized.length !== 12) {
          return { isValid: false, error: `${normalized.length} digits (need 12)` };
        }
        break;
        
      case 'international':
        // International: between 10-15 digits
        if (normalized.length < 10) {
          return { isValid: false, error: `Too short: ${normalized.length}` };
        }
        if (normalized.length > 15) {
          return { isValid: false, error: `Too long: ${normalized.length}` };
        }
        break;
    }

    return { isValid: true };
  };

  const handleCreateNewTag = async () => {
    if (!newTagName.trim()) return;
    
    try {
      const newTag = await api.tags.create({ name: newTagName.trim() });
      setAvailableTags(prev => [...prev, newTag]);
      setSelectedTagForPaste(newTag.id);
      setNewTagName('');
      setShowNewTagInput(false);
      toast.success(t('toast.tagCreated'));
    } catch (error) {
      console.error('Failed to create tag:', error);
      toast.error(t('toast.error'));
    }
  };

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

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const file = files[0];
    const fileName = file.name.toLowerCase();
    
    // Check if file extension is supported
    const supportedExtensions = ['.csv', '.xlsx', '.xls'];
    const isSupported = supportedExtensions.some(ext => fileName.endsWith(ext));
    
    if (!isSupported) {
      const errorMessage = language === 'he' 
        ? 'אנא השתמש בקובץ CSV או Excel (.xlsx, .xls)'
        : language === 'ar'
        ? 'يرجى استخدام ملف CSV أو Excel (.xlsx, .xls)'
        : 'Please use a CSV or Excel file (.xlsx, .xls)';
      toast.error(errorMessage);
      return;
    }

    // Set the file path
    const filePath = file.path;
    setSelectedFilePath(filePath);
    setSelectedFileName(file.name);
    
    // Show country selector
    setShowCountrySelector(true);
    setStep('country');
  };

  const handleCountrySelect = async (country: Country) => {
    setSelectedCountry(country);
    setShowCountrySelector(false);
    
    if (importMode === 'paste') {
      // טפל ברשימה מודבקת
      await handlePastedNumbers(country);
    } else if (selectedFilePath) {
      // טפל בקובץ
      await handleFileImport(country);
    }
  };

  const handleFileImport = async (country: Country) => {
    if (!selectedFilePath) return;
    
    setLoading(true);
    try {
      const duplicateResult = await api.contacts.checkDuplicates(selectedFilePath, country);
      
      if (duplicateResult.duplicateCount > 0) {
        setDuplicateCount(duplicateResult.duplicateCount);
        setShowDuplicateHandler(true);
        setStep('duplicates');
      } else {
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

  const handlePastedNumbers = async (country: Country) => {
    setLoading(true);
    try {
      // פרק מספרים
      const numbers = pastedText
        .split(/[\n,;]+/)
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      // נרמל וולדט כל מספר
      const preview: PreviewContact[] = numbers.map(num => {
        const normalized = normalizePhoneNumber(num, country);
        const validation = validatePhoneNumber(normalized, country);
        return {
          original: num,
          normalized,
          changed: num !== normalized,
          isValid: validation.isValid,
          validationError: validation.error
        };
      });
      
      setPreviewContacts(preview);
      setStep('preview');
    } catch (error) {
      console.error('Failed to process numbers:', error);
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
      
      // Add validation to each contact
      const validatedPreview = (result.preview as any[]).map(contact => {
        const validation = validatePhoneNumber(contact.normalized, country);
        return {
          ...contact,
          isValid: validation.isValid,
          validationError: validation.error
        };
      });
      
      setPreviewContacts(validatedPreview);
      
      const validCount = validatedPreview.filter(c => c.isValid).length;
      const invalidCount = validatedPreview.filter(c => !c.isValid).length;
      console.log(`Preview: ${validCount} valid, ${invalidCount} invalid, Total: ${result.totalCount}`);
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

  const handleDownloadInvalidNumbers = async () => {
    const invalidContacts = previewContacts.filter(c => !c.isValid);
    
    if (invalidContacts.length === 0) return;

    try {
      // Create worksheet data
      const data = invalidContacts.map(contact => ({
        [language === 'he' ? 'מספר מקורי' : language === 'ar' ? 'الرقم الأصلي' : 'Original Number']: contact.original,
        [language === 'he' ? 'מספר מנורמל' : language === 'ar' ? 'الرقم المنسق' : 'Normalized Number']: contact.normalized,
        [language === 'he' ? 'שגיאה' : language === 'ar' ? 'الخطأ' : 'Error']: contact.validationError || '',
        [language === 'he' ? 'שם' : language === 'ar' ? 'الاسم' : 'Name']: contact.name || ''
      }));

      // Create workbook
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Invalid Numbers');

      // Save file with dialog
      const timestamp = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `invalid_numbers_${timestamp}.xlsx`);

      toast.success(
        language === 'he'
          ? 'קובץ המספרים הלא תקינים הורד בהצלחה'
          : language === 'ar'
          ? 'تم تنزيل ملف الأرقام غير الصالحة بنجاح'
          : 'Invalid numbers file downloaded successfully'
      );
    } catch (error) {
      console.error('Failed to download invalid numbers:', error);
      toast.error(t('toast.error'));
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedCountry) return;

    setLoading(true);
    setImportProgress(null);
    
    // Listen for progress events
    const removeProgressListener = window.electron?.contacts?.onImportProgress?.((progress) => {
      setImportProgress(progress);
    });
    
    try {
      let count = 0;
      let skipped = 0;
      let invalidSkipped = 0;
      
      if (importMode === 'file' && selectedFilePath) {
        const result = await api.contacts.importFromFile(selectedFilePath, selectedCountry, duplicateAction || undefined);
        // Backend now returns { imported, invalid }
        if (typeof result === 'object' && 'imported' in result) {
          count = result.imported;
          invalidSkipped = result.invalid || 0;
        } else {
          // Fallback for old backend response
          count = result as number;
        }
      } else if (importMode === 'paste') {
        // ייבא מרשימה מודבקת - רק מספרים תקינים
        const validContacts = previewContacts.filter(c => c.isValid);
        invalidSkipped = previewContacts.filter(c => !c.isValid).length;
        
        for (const contact of validContacts) {
          try {
            const newContact = await api.contacts.create({
              phone_number: contact.normalized,
              name: contact.name
            });
            
            // הוסף tag אם נבחר
            if (selectedTagForPaste && newContact?.id) {
              await api.contacts.addTag(newContact.id, selectedTagForPaste);
            }
            
            count++;
          } catch (e: any) {
            // אם זה שגיאת כפילות - פשוט דלג
            if (e?.message?.includes('UNIQUE constraint') || e?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
              skipped++;
              console.log(`Contact ${contact.normalized} already exists - skipping`);
            } else {
              console.error('Failed to create contact:', e);
            }
          }
        }
      }
      
      // הודעת הצלחה מותאמת
      if (count > 0) {
        let message = t('contacts.importSuccess').replace('{count}', count.toString());
        const skipMessages = [];
        if (skipped > 0) {
          skipMessages.push(`${skipped} ${language === 'he' ? 'כפולים' : language === 'ar' ? 'مكررات' : 'duplicates'}`);
        }
        if (invalidSkipped > 0) {
          skipMessages.push(`${invalidSkipped} ${language === 'he' ? 'לא תקינים' : language === 'ar' ? 'غير صالحة' : 'invalid'}`);
        }
        if (skipMessages.length > 0) {
          message += ` (${language === 'he' ? 'דולגו' : language === 'ar' ? 'تم التخطي' : 'skipped'}: ${skipMessages.join(', ')})`;
        }
        toast.success(message);
      } else if (skipped > 0 || invalidSkipped > 0) {
        toast.error(language === 'he' ? 'כל המספרים כבר קיימים או לא תקינים' : language === 'ar' ? 'جميع الأرقام موجودة أو غير صالحة' : 'All numbers already exist or invalid');
      }
      
      onImported();
      handleClose();
    } catch (error) {
      console.error('Failed to import contacts:', error);
      toast.error(t('toast.error'));
    } finally {
      removeProgressListener?.();
      setImportProgress(null);
      setLoading(false);
    }
  };

  const handlePasteProcess = () => {
    if (!pastedText.trim()) {
      toast.error(language === 'he' ? 'נא להדביק מספרים' : language === 'ar' ? 'الرجاء لصق الأرقام' : 'Please paste phone numbers');
      return;
    }
    
    // פרק את הטקסט למספרים
    const numbers = pastedText
      .split(/[\n,;]+/) // פצל לפי שורה חדשה, פסיק, או נקודה-פסיק
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    if (numbers.length === 0) {
      toast.error(language === 'he' ? 'לא נמצאו מספרים' : language === 'ar' ? 'لم يتم العثور على أرقام' : 'No numbers found');
      return;
    }
    
    // המשך לבחירת מדינה
    setShowCountrySelector(true);
    setStep('country');
  };

  const handleClose = () => {
    setSelectedFilePath(null);
    setSelectedFileName(null);
    setPastedText('');
    setImportMode('file');
    setSelectedTagForPaste('');
    setShowNewTagInput(false);
    setNewTagName('');
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
      if (duplicateCount > 0 && importMode === 'file') {
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
      setPastedText('');
    }
  };

  return (
    <>
      <Dialog open={open && step !== 'country'} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('contacts.importTitle')}</DialogTitle>
            <DialogDescription>
              {language === 'he' 
                ? 'ייבא אנשי קשר מקובץ או מהעתקה ישירה'
                : language === 'ar'
                ? 'استيراد جهات الاتصال من ملف أو لصق مباشر'
                : 'Import contacts from file or direct paste'
              }
            </DialogDescription>
          </DialogHeader>

          {step === 'select' && (
            <div className="space-y-4">
              {/* Mode Selector Tabs */}
              <div className="flex gap-2 p-1 bg-muted rounded-lg">
                <button
                  onClick={() => setImportMode('file')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    importMode === 'file' 
                      ? 'bg-background shadow-sm' 
                      : 'hover:bg-background/50'
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  {t('contacts.fromFile')}
                </button>
                <button
                  onClick={() => setImportMode('paste')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    importMode === 'paste' 
                      ? 'bg-background shadow-sm' 
                      : 'hover:bg-background/50'
                  }`}
                >
                  <ClipboardPaste className="h-4 w-4" />
                  {t('contacts.fromPaste')}
                </button>
              </div>

              {importMode === 'file' ? (
                <>
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

                <div 
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                    isDragging 
                      ? 'border-primary bg-primary/10 scale-[1.02]' 
                      : 'border-muted-foreground/25 hover:border-primary/50'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <Upload className={`h-12 w-12 mx-auto mb-4 transition-colors ${
                    isDragging ? 'text-primary' : 'text-muted-foreground'
                  }`} />
                  <p className="text-sm text-muted-foreground mb-3">
                    {language === 'he' 
                      ? 'גרור קובץ לכאן או'
                      : language === 'ar'
                      ? 'اسحب الملف هنا أو'
                      : 'Drag file here or'
                    }
                  </p>
                  <Button variant="outline" onClick={handleFileSelect}>
                    {t('contacts.selectFile')}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-3">
                    {language === 'he'
                      ? 'קבצים נתמכים: CSV, XLSX, XLS'
                      : language === 'ar'
                      ? 'الملفات المدعومة: CSV, XLSX, XLS'
                      : 'Supported files: CSV, XLSX, XLS'
                    }
                  </p>
                  {selectedFileName && (
                    <p className="text-sm mt-2 text-muted-foreground">
                      {t('contacts.selected')}: {selectedFileName}
                    </p>
                  )}
                  </div>
                </div>
              </>
              ) : (
                /* Paste Mode */
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {t('contacts.pasteNumbersDesc')}
                    </p>
                    <Textarea
                      placeholder={t('contacts.pasteHere')}
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      className="min-h-[240px] font-mono text-sm"
                      dir="ltr"
                    />
                    {pastedText.trim() && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {t('contacts.numbersFound').replace('{count}', pastedText.split(/[\n,;]+/).filter(l => l.trim()).length.toString())}
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label>{t('contacts.selectTag')}</Label>
                    
                    {!showNewTagInput ? (
                      <div className="flex gap-2">
                        <select
                          value={selectedTagForPaste}
                          onChange={(e) => {
                            if (e.target.value === '__new__') {
                              setShowNewTagInput(true);
                            } else {
                              setSelectedTagForPaste(e.target.value);
                            }
                          }}
                          className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <option value="">
                            {language === 'he' ? 'ללא תג' : language === 'ar' ? 'بدون علامة' : 'No tag'}
                          </option>
                          {availableTags.map((tag) => (
                            <option key={tag.id} value={tag.id}>
                              {tag.name}
                            </option>
                          ))}
                          <option value="__new__" className="font-semibold text-primary">
                            + {t('contacts.newTag')}
                          </option>
                        </select>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          placeholder={t('contacts.tagName')}
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleCreateNewTag();
                            } else if (e.key === 'Escape') {
                              setShowNewTagInput(false);
                              setNewTagName('');
                            }
                          }}
                          autoFocus
                          className="flex-1"
                        />
                        <Button 
                          size="sm" 
                          onClick={handleCreateNewTag}
                          disabled={!newTagName.trim()}
                        >
                          {t('contacts.createTag')}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => {
                            setShowNewTagInput(false);
                            setNewTagName('');
                          }}
                        >
                          {t('common.cancel')}
                        </Button>
                      </div>
                    )}
                    
                    <p className="text-xs text-muted-foreground">
                      {language === 'he' 
                        ? 'תג זה יתווסף לכל אנשי הקשר שיובאו'
                        : language === 'ar'
                        ? 'سيتم إضافة هذه العلامة لجميع جهات الاتصال المستوردة'
                        : 'This tag will be added to all imported contacts'
                      }
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleClose} className="flex-1">
                      {t('common.cancel')}
                    </Button>
                    <Button 
                      onClick={handlePasteProcess} 
                      disabled={!pastedText.trim()}
                      className="flex-1"
                    >
                      {language === 'he' ? 'המשך' : language === 'ar' ? 'متابعة' : 'Continue'}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </div>
              )}
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

              {/* Validation Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-green-700 dark:text-green-300 font-medium mb-1">
                        {language === 'he' ? 'מספרים תקינים' : language === 'ar' ? 'أرقام صالحة' : 'Valid Numbers'}
                      </p>
                      <p className="text-2xl font-bold text-green-600">
                        {previewContacts.filter(c => c.isValid).length}
                      </p>
                    </div>
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                </div>
                
                {previewContacts.filter(c => !c.isValid).length > 0 && (
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-red-700 dark:text-red-300 font-medium mb-1">
                          {language === 'he' ? 'מספרים לא תקינים' : language === 'ar' ? 'أرقام غير صالحة' : 'Invalid Numbers'}
                        </p>
                        <p className="text-2xl font-bold text-red-600">
                          {previewContacts.filter(c => !c.isValid).length}
                        </p>
                      </div>
                      <AlertTriangle className="h-8 w-8 text-red-600" />
                    </div>
                  </div>
                )}
              </div>

              {/* Download Invalid Numbers Button */}
              {previewContacts.filter(c => !c.isValid).length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-start gap-2 flex-1">
                      <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                          {language === 'he'
                            ? `${previewContacts.filter(c => !c.isValid).length} מספרים לא תקינים לא יובאו`
                            : language === 'ar'
                            ? `لن يتم استيراد ${previewContacts.filter(c => !c.isValid).length} أرقام غير صالحة`
                            : `${previewContacts.filter(c => !c.isValid).length} invalid numbers will not be imported`
                          }
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                          {language === 'he'
                            ? 'הורד קובץ Excel כדי לראות את הרשימה המלאה'
                            : language === 'ar'
                            ? 'قم بتنزيل ملف Excel لعرض القائمة الكاملة'
                            : 'Download Excel file to see the full list'
                          }
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDownloadInvalidNumbers}
                      className="gap-2 border-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                    >
                      <Download className="h-4 w-4" />
                      {language === 'he' ? 'הורד Excel' : language === 'ar' ? 'تنزيل Excel' : 'Download Excel'}
                    </Button>
                  </div>
                </div>
              )}

              <div className="max-h-96 overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-medium w-12">
                        {language === 'he' ? 'סטטוס' : language === 'ar' ? 'الحالة' : 'Status'}
                      </th>
                      <th className="text-left p-3 font-medium">
                        {language === 'he' ? 'מקורי' : language === 'ar' ? 'الأصلي' : 'Original'}
                      </th>
                      <th className="p-3"></th>
                      <th className="text-left p-3 font-medium">
                        {language === 'he' ? 'מנורמל' : language === 'ar' ? 'منسق' : 'Normalized'}
                      </th>
                      <th className="text-left p-3 font-medium">{t('common.name')}</th>
                      <th className="text-left p-3 font-medium">
                        {language === 'he' ? 'שגיאה' : language === 'ar' ? 'خطأ' : 'Error'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewContacts.slice(0, 50).map((contact, idx) => (
                      <tr key={idx} className={`border-t hover:bg-accent/30 ${!contact.isValid ? 'bg-red-50/50 dark:bg-red-950/10' : ''}`}>
                        <td className="p-3 text-center">
                          {contact.isValid ? (
                            <Check className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-red-600 mx-auto" />
                          )}
                        </td>
                        <td className="p-3 font-mono text-xs text-muted-foreground">{contact.original}</td>
                        <td className="p-3 text-center">
                          {contact.changed ? (
                            <ArrowRight className="h-3 w-3 text-primary" />
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className={`p-3 font-mono text-xs ${contact.isValid ? (contact.changed ? 'text-green-600 font-semibold' : 'text-muted-foreground') : 'text-red-600 line-through'}`}>
                          {contact.normalized}
                        </td>
                        <td className="p-3 text-xs">{contact.name || '-'}</td>
                        <td className="p-3 text-xs text-red-600 dark:text-red-400">
                          {contact.validationError || ''}
                        </td>
                      </tr>
                    ))}
                    {previewContacts.length > 50 && (
                      <tr className="border-t bg-muted/50">
                        <td colSpan={6} className="p-3 text-center text-xs text-muted-foreground">
                          {language === 'he' 
                            ? `ועוד ${previewContacts.length - 50} אנשי קשר...`
                            : language === 'ar'
                            ? `و ${previewContacts.length - 50} جهات اتصال أخرى...`
                            : `And ${previewContacts.length - 50} more contacts...`
                          }
                        </td>
                      </tr>
                    )}
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
                  <Button 
                    onClick={handleConfirmImport} 
                    disabled={loading || previewContacts.filter(c => c.isValid).length === 0}
                    className="min-w-[160px]"
                  >
                    {loading 
                      ? (importProgress 
                          ? `${importProgress.percent}% (${importProgress.current.toLocaleString()}/${importProgress.total.toLocaleString()})`
                          : t('contacts.importing'))
                      : `${t('common.import')} ${previewContacts.filter(c => c.isValid).length} ${language === 'he' ? 'אנשי קשר' : language === 'ar' ? 'جهات اتصال' : 'Contacts'}`
                    }
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
