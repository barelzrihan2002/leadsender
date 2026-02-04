import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Smile, Image, FileText, X, Paperclip } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

interface MessageInputProps {
  onSend: (message: string) => void;
  onSendFile?: (file: File, type: 'image' | 'document', caption?: string) => void;
  disabled?: boolean;
}

export default function MessageInput({ onSend, onSendFile, disabled }: MessageInputProps) {
  const { t, language } = useLanguage();
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'image' | 'document' | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedFile && fileType && onSendFile) {
      onSendFile(selectedFile, fileType, message.trim() || undefined);
      setSelectedFile(null);
      setFileType(null);
      setMessage('');
    } else if (message.trim()) {
      onSend(message);
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setMessage(prev => prev + emojiData.emoji);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileType('image');
    }
  };

  const handleDocumentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileType('document');
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setFileType(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (documentInputRef.current) documentInputRef.current.value = '';
  };

  const placeholder = selectedFile 
    ? (language === 'he' ? 'הוסף כיתוב (אופציונלי)...' : language === 'ar' ? 'أضف تعليقاً (اختياري)...' : 'Add a caption (optional)...')
    : t('inbox.typeMessage');

  return (
    <form onSubmit={handleSubmit} className="border-t border-primary/10 p-3 bg-primary/5 relative">
      {showEmojiPicker && (
        <div ref={emojiPickerRef} className="absolute bottom-20 left-4 z-50">
          <EmojiPicker 
            onEmojiClick={handleEmojiClick}
            searchDisabled
            skinTonesDisabled
            height={400}
            width={350}
          />
        </div>
      )}

      {selectedFile && (
        <div className="mb-2 p-3 bg-white dark:bg-[#2a3942] rounded-lg flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            {fileType === 'image' ? (
              <div className="h-10 w-10 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Image className="h-5 w-5 text-blue-600" />
              </div>
            ) : (
              <div className="h-10 w-10 rounded bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium truncate block max-w-[250px]">
                {selectedFile.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </span>
            </div>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={clearSelectedFile}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex gap-2 items-end">
        <div className="flex gap-1">
          <Button 
            type="button" 
            size="icon" 
            variant="ghost" 
            className="h-10 w-10 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-transparent"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            <Smile className="h-5 w-5" />
          </Button>
          
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />
          
          <input
            ref={documentInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.xlsx,.xls,.ppt,.pptx"
            className="hidden"
            onChange={handleDocumentSelect}
          />
          
          <Button 
            type="button" 
            size="icon" 
            variant="ghost" 
            className="h-10 w-10 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-transparent"
            onClick={() => {
              // Show a menu to choose between image and document
              if (imageInputRef.current && documentInputRef.current) {
                imageInputRef.current.click();
              }
            }}
          >
            <Paperclip className="h-5 w-5" />
          </Button>
        </div>
        
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="min-h-[42px] max-h-[120px] resize-none py-2.5 px-4 rounded-lg bg-white dark:bg-[#2a3942] border border-transparent focus-visible:ring-0 focus-visible:border-[#00a884] transition-all"
          disabled={disabled}
          dir={language === 'he' || language === 'ar' ? 'rtl' : 'ltr'}
        />
        
        <Button 
          type="submit" 
          size="icon" 
          disabled={disabled || (!message.trim() && !selectedFile)}
          className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 shadow-md shrink-0"
        >
          <Send className="h-4 w-4 text-white" />
        </Button>
      </div>
    </form>
  );
}
