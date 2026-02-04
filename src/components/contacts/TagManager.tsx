import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/lib/api';
import type { Contact, Tag } from '@/types';

interface TagManagerProps {
  contact: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export default function TagManager({ contact, open, onOpenChange, onUpdated }: TagManagerProps) {
  const { t, language } = useLanguage();
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    tagId: string | null;
  }>({ open: false, tagId: null });

  useEffect(() => {
    if (open) {
      loadTags();
    }
  }, [open]);

  const loadTags = async () => {
    const tags = await api.tags.getAll();
    setAllTags(tags);
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    try {
      await api.tags.create({
        name: newTagName,
        color: newTagColor
      });
      
      setNewTagName('');
      setNewTagColor('#3b82f6');
      setShowCreateTag(false);
      loadTags();
      toast.success('Tag created successfully');
    } catch (error) {
      console.error('Failed to create tag:', error);
      toast.error('Failed to create tag');
    }
  };

  const handleToggleTag = async (tagId: string) => {
    if (!contact) return;

    const hasTag = contact.tags?.some(t => t.id === tagId);

    try {
      if (hasTag) {
        await api.contacts.removeTag(contact.id, tagId);
      } else {
        await api.contacts.addTag(contact.id, tagId);
      }
      onUpdated();
    } catch (error) {
      console.error('Failed to toggle tag:', error);
      toast.error('Failed to update tag');
    }
  };

  const handleDeleteTagClick = (tagId: string) => {
    setConfirmDialog({ open: true, tagId });
  };

  const handleDeleteTagConfirm = async () => {
    if (!confirmDialog.tagId) return;

    const tagIdToDelete = confirmDialog.tagId;
    const tagToDelete = allTags.find(t => t.id === tagIdToDelete);

    try {
      await api.tags.delete(tagIdToDelete);
      loadTags();
      onUpdated();
      toast.success(t('toast.tagDeleted'));
    } catch (error: any) {
      console.error('Failed to delete tag:', error);
      
      // Check if it's a system tag error
      if (error.message?.includes('system tag') || error.message?.includes('protected')) {
        toast.error(t('contacts.cannotDeleteSystem'));
      } else {
        toast.error(t('toast.error'));
      }
    } finally {
      // Ensure dialog state is cleared
      setConfirmDialog({ open: false, tagId: null });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {contact 
              ? t('contacts.manageTagsFor').replace('{name}', contact.name || contact.phone_number)
              : t('contacts.manageTags')
            }
          </DialogTitle>
        </DialogHeader>

        {/* BlackList Info */}
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <p className="text-xs text-amber-900 dark:text-amber-100 flex items-start gap-2">
            <span className="text-base">🚫</span>
            <span>
              {language === 'he'
                ? 'אנשי קשר עם תג BlackList לא יקבלו הודעות מקמפיינים. השתמש בזה כדי למנוע שליחה לאנשי קשר מסוימים.'
                : language === 'ar'
                ? 'جهات الاتصال ذات علامة BlackList لن تتلقى رسائل من الحملات. استخدم هذا لمنع الإرسال إلى جهات اتصال معينة.'
                : 'Contacts with BlackList tag will not receive campaign messages. Use this to prevent sending to specific contacts.'
              }
            </span>
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label>{t('contacts.availableTags')}</Label>
              <Button size="sm" onClick={() => setShowCreateTag(!showCreateTag)}>
                <Plus className="h-4 w-4 mr-1" />
                {t('contacts.newTag')}
              </Button>
            </div>

            {showCreateTag && (
              <div className="mb-3 p-3 border rounded-md space-y-2">
                <Input
                  placeholder={t('contacts.tagName')}
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                />
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                    className="w-20"
                  />
                  <Button size="sm" onClick={handleCreateTag}>
                    {t('contacts.createTag')}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {allTags.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('contacts.noTags')}</p>
              ) : (
                allTags.map((tag) => {
                  const isAssigned = contact?.tags?.some(t => t.id === tag.id);
                  const isSystemTag = tag.is_system || tag.name === 'BlackList';
                  
                  return (
                    <div
                      key={tag.id}
                      className={`flex items-center justify-between p-2 border rounded-md ${isSystemTag ? 'bg-muted/30' : ''}`}
                    >
                      <label className="flex items-center gap-2 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={isAssigned}
                          onChange={() => handleToggleTag(tag.id)}
                        />
                        <div className="flex items-center gap-2">
                          <Badge 
                            style={{ backgroundColor: tag.color || undefined }}
                            className={isSystemTag ? 'border border-border' : ''}
                          >
                            {tag.name}
                          </Badge>
                          {isSystemTag && (
                            <span className="text-xs text-muted-foreground italic">
                              ({language === 'he' ? 'מערכת' : language === 'ar' ? 'نظام' : 'System'})
                            </span>
                          )}
                        </div>
                      </label>
                      {!isSystemTag ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteTagClick(tag.id)}
                          title={t('contacts.deleteContactTooltip')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <div className="w-8 h-8 flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">🔒</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <Button onClick={() => onOpenChange(false)} className="w-full">
            {t('contacts.done')}
          </Button>
        </div>
      </DialogContent>

      {confirmDialog.open && (
        <ConfirmDialog
          key={`delete-tag-${confirmDialog.tagId}`}
          open={confirmDialog.open}
          onOpenChange={(open) => setConfirmDialog({ open, tagId: null })}
          onConfirm={handleDeleteTagConfirm}
          title={t('contacts.deleteTag')}
          description={t('contacts.deleteTagConfirm')}
          confirmText={t('common.delete')}
          cancelText={t('common.cancel')}
          variant="destructive"
        />
      )}
    </Dialog>
  );
}
