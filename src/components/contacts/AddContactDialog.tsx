import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Tag, CustomField } from '@/types';

interface AddContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}

export default function AddContactDialog({ open, onOpenChange, onAdded }: AddContactDialogProps) {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      loadTags();
      loadCustomFields();
      // Reset form
      setName('');
      setPhone('');
      setSelectedTag('');
      setCustomFieldValues({});
    }
  }, [open]);

  const loadTags = async () => {
    try {
      const allTags = await window.electron.tags.getAll();
      // Filter out system tags
      setTags(allTags.filter(tag => !tag.is_system));
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  const loadCustomFields = async () => {
    try {
      const fields = await window.electron.customFields.getAll();
      setCustomFields(fields);
    } catch (error) {
      console.error('Failed to load custom fields:', error);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!phone.trim()) {
      toast.error(t('contacts.phoneRequired'));
      return;
    }

    // Basic phone validation
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    if (cleanPhone.length < 10) {
      toast.error(t('contacts.phoneInvalid'));
      return;
    }

    // Validate required custom fields
    for (const field of customFields) {
      if (field.required && !customFieldValues[field.name]?.trim()) {
        toast.error(language === 'he' 
          ? `שדה "${field.label}" הוא חובה`
          : language === 'ar'
          ? `حقل "${field.label}" مطلوب`
          : `Field "${field.label}" is required`
        );
        return;
      }
    }

    setLoading(true);
    try {
      // Create contact with custom fields
      const contact = await window.electron.contacts.create({
        phone_number: cleanPhone,
        name: name.trim() || undefined,
        custom_fields: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined
      });

      // Add tag if selected
      if (selectedTag && contact.id) {
        await window.electron.contacts.addTag(contact.id, selectedTag);
      }

      toast.success(t('contacts.addSuccess'));
      onAdded();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to add contact:', error);
      toast.error(t('toast.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            {t('contacts.addContact')}
          </DialogTitle>
          <DialogDescription>
            {language === 'he'
              ? 'הוסף איש קשר חדש באופן ידני'
              : language === 'ar'
              ? 'إضافة جهة اتصال جديدة يدويًا'
              : 'Add a new contact manually'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="contact-name">{t('contacts.contactName')}</Label>
            <Input
              id="contact-name"
              placeholder={language === 'he' ? 'שם מלא' : language === 'ar' ? 'الاسم الكامل' : 'Full name'}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-phone">{t('contacts.phoneNumber')} *</Label>
            <Input
              id="contact-phone"
              placeholder={language === 'he' ? '972501234567' : language === 'ar' ? '972501234567' : '972501234567'}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              {language === 'he' ? 'כלול קוד מדינה, לדוגמא: 972501234567' : language === 'ar' ? 'قم بتضمين رمز البلد، مثال: 972501234567' : 'Include country code, e.g., 972501234567'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-tag">{t('contacts.selectTag')}</Label>
            <select
              id="contact-tag"
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">
                {language === 'he' ? 'ללא תג' : language === 'ar' ? 'بدون علامة' : 'No tag'}
              </option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Fields */}
          {customFields.length > 0 && (
            <div className="space-y-3 pt-3 border-t">
              <Label className="text-sm font-medium text-muted-foreground">
                {language === 'he' ? 'שדות נוספים' : language === 'ar' ? 'حقول إضافية' : 'Additional Fields'}
              </Label>
              {customFields.map(field => (
                <div key={field.id} className="space-y-2">
                  <Label htmlFor={`custom-${field.id}`}>
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  <Input
                    id={`custom-${field.id}`}
                    type={field.type}
                    placeholder={language === 'he' 
                      ? `הזן ${field.label.toLowerCase()}`
                      : language === 'ar'
                      ? `أدخل ${field.label}`
                      : `Enter ${field.label.toLowerCase()}`
                    }
                    value={customFieldValues[field.name] || ''}
                    onChange={(e) => setCustomFieldValues(prev => ({
                      ...prev,
                      [field.name]: e.target.value
                    }))}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (language === 'he' ? 'מוסיף...' : language === 'ar' ? 'جارٍ الإضافة...' : 'Adding...') : t('common.add')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
