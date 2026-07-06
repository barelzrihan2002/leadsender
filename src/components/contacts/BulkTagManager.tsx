import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Plus, Minus, Check } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Tag } from '@/types';

interface BulkTagManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactIds: string[];
  onUpdated: () => void;
}

export default function BulkTagManager({ open, onOpenChange, contactIds, onUpdated }: BulkTagManagerProps) {
  const { language } = useLanguage();
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagsToAdd, setSelectedTagsToAdd] = useState<Set<string>>(new Set());
  const [selectedTagsToRemove, setSelectedTagsToRemove] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadTags();
      setSelectedTagsToAdd(new Set());
      setSelectedTagsToRemove(new Set());
    }
  }, [open]);

  const loadTags = async () => {
    try {
      const allTags = await window.electron.tags.getAll();
      // Filter out system tags for bulk operations
      setTags(allTags.filter(tag => !tag.is_system));
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  const toggleTagToAdd = (tagId: string) => {
    setSelectedTagsToAdd(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tagId)) {
        newSet.delete(tagId);
      } else {
        newSet.add(tagId);
      }
      return newSet;
    });
    
    // Remove from "remove" list if it's there
    setSelectedTagsToRemove(prev => {
      const newSet = new Set(prev);
      newSet.delete(tagId);
      return newSet;
    });
  };

  const toggleTagToRemove = (tagId: string) => {
    setSelectedTagsToRemove(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tagId)) {
        newSet.delete(tagId);
      } else {
        newSet.add(tagId);
      }
      return newSet;
    });
    
    // Remove from "add" list if it's there
    setSelectedTagsToAdd(prev => {
      const newSet = new Set(prev);
      newSet.delete(tagId);
      return newSet;
    });
  };

  const handleApply = async () => {
    setLoading(true);
    
    try {
      // Add tags to all selected contacts
      for (const tagId of selectedTagsToAdd) {
        await Promise.all(
          contactIds.map(contactId => 
            window.electron.contacts.addTag(contactId, tagId)
          )
        );
      }

      // Remove tags from all selected contacts
      for (const tagId of selectedTagsToRemove) {
        await Promise.all(
          contactIds.map(contactId => 
            window.electron.contacts.removeTag(contactId, tagId)
          )
        );
      }

      const addedCount = selectedTagsToAdd.size;
      const removedCount = selectedTagsToRemove.size;
      
      let message = '';
      if (language === 'he') {
        if (addedCount > 0 && removedCount > 0) {
          message = `${addedCount} טאגים נוספו ו-${removedCount} טאגים הוסרו מ-${contactIds.length} אנשי קשר`;
        } else if (addedCount > 0) {
          message = `${addedCount} טאגים נוספו ל-${contactIds.length} אנשי קשר`;
        } else if (removedCount > 0) {
          message = `${removedCount} טאגים הוסרו מ-${contactIds.length} אנשי קשר`;
        }
      } else if (language === 'ar') {
        if (addedCount > 0 && removedCount > 0) {
          message = `تمت إضافة ${addedCount} علامات وإزالة ${removedCount} علامات من ${contactIds.length} جهات اتصال`;
        } else if (addedCount > 0) {
          message = `تمت إضافة ${addedCount} علامات إلى ${contactIds.length} جهات اتصال`;
        } else if (removedCount > 0) {
          message = `تمت إزالة ${removedCount} علامات من ${contactIds.length} جهات اتصال`;
        }
      } else {
        if (addedCount > 0 && removedCount > 0) {
          message = `${addedCount} tags added and ${removedCount} tags removed from ${contactIds.length} contacts`;
        } else if (addedCount > 0) {
          message = `${addedCount} tags added to ${contactIds.length} contacts`;
        } else if (removedCount > 0) {
          message = `${removedCount} tags removed from ${contactIds.length} contacts`;
        }
      }

      if (message) {
        toast.success(message);
      }
      
      onUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update tags:', error);
      toast.error(language === 'he' ? 'שגיאה בעדכון טאגים' : language === 'ar' ? 'خطأ في تحديث العلامات' : 'Failed to update tags');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {language === 'he' 
              ? `עריכת טאגים עבור ${contactIds.length} אנשי קשר`
              : language === 'ar'
              ? `تحرير العلامات لـ ${contactIds.length} جهات اتصال`
              : `Edit Tags for ${contactIds.length} Contacts`
            }
          </DialogTitle>
          <DialogDescription>
            {language === 'he'
              ? 'הוסף או הסר טאגים מאנשי קשר מרובים בבת אחת'
              : language === 'ar'
              ? 'إضافة أو إزالة العلامات من جهات اتصال متعددة دفعة واحدة'
              : 'Add or remove tags from multiple contacts at once'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Info */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-xs text-blue-900 dark:text-blue-100">
              {language === 'he'
                ? 'בחר טאגים להוספה (ירוק) או הסרה (אדום) מכל אנשי הקשר שנבחרו.'
                : language === 'ar'
                ? 'حدد العلامات لإضافتها (أخضر) أو إزالتها (أحمر) من جميع جهات الاتصال المحددة.'
                : 'Select tags to add (green) or remove (red) from all selected contacts.'
              }
            </p>
          </div>

          {/* Tags */}
          <div className="space-y-3">
            <Label className="text-base font-medium">
              {language === 'he' ? 'טאגים זמינים' : language === 'ar' ? 'العلامات المتاحة' : 'Available Tags'}
            </Label>
            
            <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto p-2">
              {tags.length === 0 ? (
                <p className="col-span-2 text-sm text-muted-foreground text-center py-4">
                  {language === 'he' ? 'אין טאגים זמינים' : language === 'ar' ? 'لا توجد علامات متاحة' : 'No tags available'}
                </p>
              ) : (
                tags.map(tag => {
                  const isToAdd = selectedTagsToAdd.has(tag.id);
                  const isToRemove = selectedTagsToRemove.has(tag.id);
                  
                  return (
                    <div
                      key={tag.id}
                      className="flex items-center gap-2 p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                    >
                      <Badge
                        style={{ backgroundColor: tag.color || undefined }}
                        className="flex-1"
                      >
                        {tag.name}
                      </Badge>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant={isToAdd ? "default" : "outline"}
                          className={`h-7 w-7 p-0 ${isToAdd ? 'bg-green-600 hover:bg-green-700' : ''}`}
                          onClick={() => toggleTagToAdd(tag.id)}
                          title={language === 'he' ? 'הוסף טאג' : language === 'ar' ? 'إضافة علامة' : 'Add tag'}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={isToRemove ? "destructive" : "outline"}
                          className="h-7 w-7 p-0"
                          onClick={() => toggleTagToRemove(tag.id)}
                          title={language === 'he' ? 'הסר טאג' : language === 'ar' ? 'إزالة علامة' : 'Remove tag'}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Summary */}
            {(selectedTagsToAdd.size > 0 || selectedTagsToRemove.size > 0) && (
              <div className="bg-muted/30 border rounded-lg p-3 space-y-2">
                {selectedTagsToAdd.size > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Plus className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-green-700 dark:text-green-400">
                      {language === 'he' 
                        ? `להוסיף: ${selectedTagsToAdd.size} טאגים`
                        : language === 'ar'
                        ? `للإضافة: ${selectedTagsToAdd.size} علامات`
                        : `To add: ${selectedTagsToAdd.size} tags`
                      }
                    </span>
                  </div>
                )}
                {selectedTagsToRemove.size > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Minus className="h-4 w-4 text-red-600" />
                    <span className="font-medium text-red-700 dark:text-red-400">
                      {language === 'he' 
                        ? `להסיר: ${selectedTagsToRemove.size} טאגים`
                        : language === 'ar'
                        ? `للإزالة: ${selectedTagsToRemove.size} علامات`
                        : `To remove: ${selectedTagsToRemove.size} tags`
                      }
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              {language === 'he' ? 'ביטול' : language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button 
              onClick={handleApply} 
              disabled={loading || (selectedTagsToAdd.size === 0 && selectedTagsToRemove.size === 0)}
              className="gap-2"
            >
              {loading ? (
                language === 'he' ? 'מעדכן...' : language === 'ar' ? 'جارٍ التحديث...' : 'Updating...'
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  {language === 'he' ? 'החל שינויים' : language === 'ar' ? 'تطبيق التغييرات' : 'Apply Changes'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
