import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import type { CustomField } from '@/types';

interface CustomFieldsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export default function CustomFieldsManager({ open, onOpenChange, onUpdated }: CustomFieldsManagerProps) {
  const { language } = useLanguage();
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newField, setNewField] = useState({
    name: '',
    label: '',
    type: 'text' as 'text' | 'number' | 'email' | 'url',
    required: false
  });

  useEffect(() => {
    if (open) {
      loadCustomFields();
    }
  }, [open]);

  const loadCustomFields = async () => {
    try {
      const fields = await window.electron.customFields.getAll();
      setCustomFields(fields);
    } catch (error) {
      console.error('Failed to load custom fields:', error);
    }
  };

  const handleCreate = async () => {
    if (!newField.name.trim() || !newField.label.trim()) {
      toast.warning(language === 'he' ? 'נא למלא שם ותווית' : language === 'ar' ? 'الرجاء ملء الاسم والعنوان' : 'Please fill name and label');
      return;
    }

    try {
      await window.electron.customFields.create(newField);
      setNewField({ name: '', label: '', type: 'text', required: false });
      setShowCreate(false);
      loadCustomFields();
      onUpdated();
      toast.success(language === 'he' ? 'שדה נוצר בהצלחה' : language === 'ar' ? 'تم إنشاء الحقل بنجاح' : 'Field created successfully');
    } catch (error) {
      console.error('Failed to create custom field:', error);
      toast.error(language === 'he' ? 'שגיאה ביצירת שדה' : language === 'ar' ? 'خطأ في إنشاء الحقل' : 'Failed to create field');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await window.electron.customFields.delete(id);
      loadCustomFields();
      onUpdated();
      toast.success(language === 'he' ? 'שדה נמחק' : language === 'ar' ? 'تم حذف الحقل' : 'Field deleted');
    } catch (error) {
      console.error('Failed to delete custom field:', error);
      toast.error(language === 'he' ? 'שגיאה במחיקה' : language === 'ar' ? 'خطأ في الحذف' : 'Failed to delete');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {language === 'he' ? 'ניהול שדות מותאמים' : language === 'ar' ? 'إدارة الحقول المخصصة' : 'Manage Custom Fields'}
          </DialogTitle>
          <DialogDescription>
            {language === 'he'
              ? 'צור ונהל שדות מותאמים אישית לאנשי הקשר שלך'
              : language === 'ar'
              ? 'إنشاء وإدارة الحقول المخصصة لجهات الاتصال الخاصة بك'
              : 'Create and manage custom fields for your contacts'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-xs text-blue-900 dark:text-blue-100 flex items-start gap-2">
              <span className="text-base">ℹ️</span>
              <span>
                {language === 'he'
                  ? 'שדות מותאמים מאפשרים לך להוסיף מידע נוסף על אנשי קשר (כמו עיר, חברה, תחום עיסוק וכו\'). השדות יופיעו בטבלה, בייבוא קבצים ובעריכת איש קשר.'
                  : language === 'ar'
                  ? 'الحقول المخصصة تتيح لك إضافة معلومات إضافية عن جهات الاتصال (مثل المدينة، الشركة، المجال وما إلى ذلك). ستظهر الحقول في الجدول، واستيراد الملفات، وتحرير جهة الاتصال.'
                  : 'Custom fields allow you to add additional information about contacts (like city, company, business field, etc.). Fields will appear in the table, file imports, and contact editing.'
                }
              </span>
            </p>
          </div>

          {/* Create New Field Button */}
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">
              {language === 'he' ? 'שדות קיימים' : language === 'ar' ? 'الحقول الموجودة' : 'Existing Fields'}
            </Label>
            <Button size="sm" onClick={() => setShowCreate(!showCreate)} className="gap-2">
              <Plus className="h-4 w-4" />
              {language === 'he' ? 'שדה חדש' : language === 'ar' ? 'حقل جديد' : 'New Field'}
            </Button>
          </div>

          {/* Create Field Form */}
          {showCreate && (
            <div className="p-4 border rounded-lg space-y-3 bg-muted/30">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm">
                    {language === 'he' ? 'שם השדה (באנגלית)' : language === 'ar' ? 'اسم الحقل (بالإنجليزية)' : 'Field Name (English)'}
                  </Label>
                  <Input
                    placeholder={language === 'he' ? 'לדוגמה: company' : language === 'ar' ? 'مثال: company' : 'e.g., company'}
                    value={newField.name}
                    onChange={(e) => setNewField({ ...newField, name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    {language === 'he' ? 'אותיות אנגליות, מספרים ו-_ בלבד' : language === 'ar' ? 'أحرف إنجليزية وأرقام و _ فقط' : 'English letters, numbers and _ only'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">
                    {language === 'he' ? 'תווית (לתצוגה)' : language === 'ar' ? 'العنوان (للعرض)' : 'Label (Display)'}
                  </Label>
                  <Input
                    placeholder={language === 'he' ? 'לדוגמה: חברה' : language === 'ar' ? 'مثال: شركة' : 'e.g., Company'}
                    value={newField.label}
                    onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm">
                    {language === 'he' ? 'סוג' : language === 'ar' ? 'النوع' : 'Type'}
                  </Label>
                  <select
                    value={newField.type}
                    onChange={(e) => setNewField({ ...newField, type: e.target.value as any })}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="text">{language === 'he' ? 'טקסט' : language === 'ar' ? 'نص' : 'Text'}</option>
                    <option value="number">{language === 'he' ? 'מספר' : language === 'ar' ? 'رقم' : 'Number'}</option>
                    <option value="email">{language === 'he' ? 'אימייל' : language === 'ar' ? 'بريد إلكتروني' : 'Email'}</option>
                    <option value="url">{language === 'he' ? 'קישור' : language === 'ar' ? 'رابط' : 'URL'}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">
                    {language === 'he' ? 'חובה?' : language === 'ar' ? 'مطلوب؟' : 'Required?'}
                  </Label>
                  <div className="flex items-center h-10 px-3">
                    <input
                      type="checkbox"
                      checked={newField.required}
                      onChange={(e) => setNewField({ ...newField, required: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <Label className="ml-2 cursor-pointer">
                      {language === 'he' ? 'שדה חובה' : language === 'ar' ? 'حقل إلزامي' : 'Required field'}
                    </Label>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreate} className="flex-1">
                  {language === 'he' ? 'צור שדה' : language === 'ar' ? 'إنشاء حقل' : 'Create Field'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>
                  {language === 'he' ? 'ביטול' : language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
              </div>
            </div>
          )}

          {/* Fields List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {customFields.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                <p className="text-sm">
                  {language === 'he' ? 'עדיין אין שדות מותאמים. צור שדה חדש כדי להתחיל.' : language === 'ar' ? 'لا توجد حقول مخصصة حتى الآن. أنشئ حقلاً جديداً للبدء.' : 'No custom fields yet. Create a new field to get started.'}
                </p>
              </div>
            ) : (
              customFields.map((field) => (
                <div
                  key={field.id}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{field.label}</span>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded">{field.name}</code>
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                        {field.type}
                      </span>
                      {field.required && (
                        <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5 rounded">
                          {language === 'he' ? 'חובה' : language === 'ar' ? 'مطلوب' : 'Required'}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(field.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>

          {/* Example File Info */}
          {customFields.length > 0 && (
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <p className="text-xs text-green-900 dark:text-green-100 font-medium mb-2">
                {language === 'he' ? '📋 פורמט קובץ CSV לדוגמה:' : language === 'ar' ? '📋 تنسيق ملف CSV المثالي:' : '📋 Example CSV Format:'}
              </p>
              <code className="text-xs bg-white dark:bg-slate-900 p-2 rounded block font-mono" dir="ltr">
                phone_number,name,tags,{customFields.map(f => f.name).join(',')}
                <br />
                972501234567,John Doe,VIP,{customFields.map(() => '...').join(',')}
              </code>
            </div>
          )}

          <Button onClick={() => onOpenChange(false)} className="w-full">
            {language === 'he' ? 'סגור' : language === 'ar' ? 'إغلاق' : 'Close'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
