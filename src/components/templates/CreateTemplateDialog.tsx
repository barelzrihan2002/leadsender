import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Upload, X, Smile, Image as ImageIcon, Video, FileText } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import type { MessageTemplate } from '@/types';

interface CreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: MessageTemplate | null;
  onSaved: () => void;
}

export default function CreateTemplateDialog({ open, onOpenChange, template, onSaved }: CreateTemplateDialogProps) {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string>('');
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'document' | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const popularEmojis = [
    '😊', '😃', '😄', '😁', '😅', '😂', '🤣', '😉', '😍', '🥰',
    '😘', '👍', '👎', '👌', '✌️', '🤞', '🤝', '👏', '🙌', '🙏',
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '💕',
    '⭐', '🌟', '✨', '💫', '🌈', '🔥', '💯', '✅', '❌', '⚠️',
    '🎉', '🎊', '🎁', '🎈', '🎯', '💪', '🚀', '💡', '📱', '📧'
  ];

  useEffect(() => {
    if (open && template) {
      setName(template.name);
      setMessage(template.message);
      if (template.media_path) {
        setMediaPreview(template.media_path);
        setMediaType(template.media_type || null);
      }
    } else if (!open) {
      setName('');
      setMessage('');
      setMediaFile(null);
      setMediaPreview('');
      setMediaType(null);
    }
  }, [open, template]);

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMediaFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setMediaPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    if (file.type.startsWith('image/')) {
      setMediaType('image');
    } else if (file.type.startsWith('video/')) {
      setMediaType('video');
    } else {
      setMediaType('document');
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !message.trim()) {
      toast.error(language === 'he' ? 'נא למלא שם והודעה' : language === 'ar' ? 'الرجاء ملء الاسم والرسالة' : 'Please fill name and message');
      return;
    }

    setLoading(true);
    try {
      let mediaPath = template?.media_path;
      
      if (mediaFile) {
        // המר ArrayBuffer ל-Uint8Array
        const arrayBuffer = await mediaFile.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const savedPath = await window.electron.messages.saveTempFile(mediaFile.name, uint8Array);
        mediaPath = savedPath;
      }

      if (template) {
        await window.electron.templates.update(template.id, {
          name,
          message,
          media_path: mediaPath,
          media_type: mediaType
        });
      } else {
        await window.electron.templates.create({
          name,
          message,
          media_path: mediaPath,
          media_type: mediaType
        });
      }

      toast.success(t('toast.success'));
      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save template:', error);
      toast.error(t('toast.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {template ? t('templates.editTemplate') : t('templates.createNew')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t('templates.templateName')}</Label>
            <Input
              placeholder={language === 'he' ? 'שם התבנית...' : language === 'ar' ? 'اسم القالب...' : 'Template name...'}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('templates.messageContent')}</Label>
            <div className="relative">
              <Textarea
                placeholder={language === 'he' ? 'כתוב את ההודעה...' : language === 'ar' ? 'اكتب الرسالة...' : 'Write your message...'}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[200px] pr-20"
              />
              
              <div className="absolute bottom-3 right-3 flex gap-2">
                <input
                  type="file"
                  id="template-media"
                  className="hidden"
                  accept="image/*,video/*,.pdf,.doc,.docx"
                  onChange={handleMediaUpload}
                />
                
                {/* Emoji Picker */}
                <div className="relative" ref={emojiPickerRef}>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 rounded-full hover:bg-amber-100 dark:hover:bg-amber-900/20"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  >
                    <Smile className="h-4 w-4" />
                  </Button>
                  
                  {showEmojiPicker && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setShowEmojiPicker(false)}
                      />
                      <div className="absolute bottom-full right-0 mb-2 z-50 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border p-3 w-[280px]">
                        <div className="text-xs font-semibold mb-2 text-muted-foreground">
                          {language === 'he' ? 'בחר אימוג\'י' : language === 'ar' ? 'اختر رمز تعبيري' : 'Select emoji'}
                        </div>
                        <div className="grid grid-cols-10 gap-1 max-h-[200px] overflow-y-auto">
                          {popularEmojis.map((emoji, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setMessage(message + emoji);
                                setShowEmojiPicker(false);
                              }}
                              className="text-xl hover:bg-accent rounded p-1"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 rounded-full hover:bg-primary/10"
                  onClick={() => document.getElementById('template-media')?.click()}
                >
                  <Upload className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {mediaPreview && (
            <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/20">
              {mediaType === 'image' && (
                <ImageIcon className="h-8 w-8 text-blue-500" />
              )}
              {mediaType === 'video' && (
                <Video className="h-8 w-8 text-purple-500" />
              )}
              {mediaType === 'document' && (
                <FileText className="h-8 w-8 text-orange-500" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {mediaFile?.name || language === 'he' ? 'קובץ מצורף' : language === 'ar' ? 'ملف مرفق' : 'Attached file'}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setMediaFile(null);
                  setMediaPreview('');
                  setMediaType(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? t('common.loading') : t('common.save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
