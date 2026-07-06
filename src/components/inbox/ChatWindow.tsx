import { useEffect, useRef, useState } from 'react';
import { formatDistance } from 'date-fns';
import { he, ar } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Message } from '@/types';
import { cn } from '@/lib/utils';
import { FileText, Image as ImageIcon, Download, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatWindowProps {
  messages: Message[];
}

// Component to display message media
function MessageMedia({ message }: { message: Message }) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { language } = useLanguage();

  useEffect(() => {
    loadMedia();
  }, [message.id]);

  const loadMedia = async () => {
    try {
      setLoading(true);
      const fileData = await window.electron.messages.getMediaFile(message.id);
      
      if (fileData) {
        const uint8Array = new Uint8Array(fileData.buffer);
        const blob = new Blob([uint8Array], { type: message.media_mimetype || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        setMediaUrl(url);
      }
    } catch (error) {
      console.error('Failed to load media:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!mediaUrl) return;
    
    const link = document.createElement('a');
    link.href = mediaUrl;
    link.download = message.media_filename || 'file';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isImage = message.message_type === 'image';
  const isVideo = message.message_type === 'video';

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!mediaUrl) {
    return (
      <div className="flex items-center gap-2 bg-white/10 p-3 rounded">
        <FileText className="h-5 w-5" />
        <span className="text-sm">
          {language === 'he' ? 'לא ניתן לטעון קובץ' : language === 'ar' ? 'لم يتم تحميل الملف' : 'File not found'}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {isImage ? (
        <div className="relative group">
          <img 
            src={mediaUrl} 
            alt={message.media_filename || 'Image'} 
            className="max-w-full rounded-lg max-h-96 object-contain cursor-pointer"
            onClick={() => window.open(mediaUrl, '_blank')}
          />
          <Button
            size="sm"
            variant="secondary"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      ) : isVideo ? (
        <div className="relative group">
          <video 
            src={mediaUrl} 
            controls
            className="max-w-full rounded-lg max-h-96"
          />
          <Button
            size="sm"
            variant="secondary"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div 
          className="flex items-center gap-3 bg-white/10 p-3 rounded-lg cursor-pointer hover:bg-white/20 transition-colors"
          onClick={handleDownload}
        >
          <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <FileText className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{message.media_filename || 'Document'}</p>
            <p className="text-xs opacity-70">{message.media_mimetype?.split('/')[1]?.toUpperCase() || 'FILE'}</p>
          </div>
          <Download className="h-5 w-5 flex-shrink-0" />
        </div>
      )}
    </div>
  );
}

export default function ChatWindow({ messages }: ChatWindowProps) {
  const { language } = useLanguage();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const renderMessageContent = (message: Message) => {
    // Handle media messages (images, videos, and documents)
    if (message.message_type === 'image' || message.message_type === 'video' || message.message_type === 'document') {
      return (
        <div className="space-y-2">
          {/* Media component - displays images, videos, or file download */}
          <MessageMedia message={message} />
          
          {/* Caption if exists */}
          {message.message_text && message.message_text.trim() && (
            <p className="whitespace-pre-wrap leading-relaxed text-sm">{message.message_text}</p>
          )}
        </div>
      );
    }
    
    // Regular text message - show fallback if empty
    if (!message.message_text || !message.message_text.trim()) {
      return (
        <p className="text-xs italic opacity-50">
          {language === 'he' ? 'הודעה ריקה' : language === 'ar' ? 'رسالة فارغة' : 'Empty message'}
        </p>
      );
    }
    
    return <p className="whitespace-pre-wrap leading-relaxed text-[14px]">{message.message_text}</p>;
  };

  return (
    <div 
      className="flex-1 overflow-y-auto p-6 space-y-3 bg-primary/5"
      style={{
        backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")',
        backgroundRepeat: 'repeat',
        backgroundBlendMode: 'overlay',
        backgroundSize: '400px'
      }}
    >
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full">
          <div className="bg-white/90 dark:bg-card/90 backdrop-blur-sm rounded-2xl p-8 shadow-md border border-primary/20">
            <p className="text-muted-foreground text-center">
              {language === 'he' ? 'עדיין אין הודעות בשיחה זו' : language === 'ar' ? 'لا توجد رسائل في هذه المحادثة حتى الآن' : 'No messages in this chat yet.'}
            </p>
          </div>
        </div>
      ) : (
        <>
          {messages
            .filter(msg => {
              // Filter out completely empty messages (no text and no media)
              const hasText = msg.message_text && msg.message_text.trim().length > 0;
              const hasMedia = msg.message_type === 'image' || msg.message_type === 'video' || msg.message_type === 'document';
              // Filter out WWebJS artifact 'CC' messages
              const isCCMessage = msg.message_text && msg.message_text.trim().toLowerCase() === 'cc';
              if (isCCMessage && !hasMedia) return false;
              return hasText || hasMedia;
            })
            .map((message, index, filteredMessages) => {
            const isMe = message.is_from_me;
            const messageDate = new Date(message.timestamp);
            const timestamp = messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            // Check if we need a date divider (based on filtered messages)
            const showDateDivider = index === 0 || 
              new Date(filteredMessages[index - 1].timestamp).toDateString() !== messageDate.toDateString();
            
            return (
              <div key={message.id}>
                {showDateDivider && (
                  <div className="flex justify-center my-4">
                    <div className="bg-primary/10 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm border border-primary/20">
                      <span className="text-xs text-primary font-semibold">
                        {messageDate.toLocaleDateString(
                          language === 'he' ? 'he-IL' : language === 'ar' ? 'ar-SA' : 'en-US',
                          { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
                        )}
                      </span>
                    </div>
                  </div>
                )}
                
              <div
                className={cn(
                  'flex w-full',
                  isMe ? 'justify-end' : 'justify-start'
                )}
              >
                <div className={cn(
                  "flex flex-col max-w-[65%] min-w-[100px]",
                  isMe ? "items-end" : "items-start"
                )}>
                  <div
                    className={cn(
                      'px-3 py-2 rounded-lg shadow-md text-sm relative group',
                      isMe
                        ? 'bg-[#d9fdd3] dark:bg-[#005c4b] text-gray-900 dark:text-gray-100'
                        : 'bg-white dark:bg-[#202c33] text-gray-900 dark:text-gray-100'
                    )}
                    style={{
                      borderTopRightRadius: isMe ? '2px' : '8px',
                      borderTopLeftRadius: isMe ? '8px' : '2px',
                    }}
                  >
                    {/* WhatsApp tail/pointer */}
                    <div 
                      className="absolute top-0 w-0 h-0"
                      style={{
                        [isMe ? 'right' : 'left']: '-8px',
                        borderTop: `10px solid ${isMe ? (document.documentElement.classList.contains('dark') ? '#005c4b' : '#d9fdd3') : (document.documentElement.classList.contains('dark') ? '#202c33' : '#ffffff')}`,
                        [isMe ? 'borderLeft' : 'borderRight']: '10px solid transparent'
                      }}
                    />
                    
                    <div dir={language === 'he' || language === 'ar' ? 'rtl' : 'ltr'}>
                      {renderMessageContent(message)}
                    </div>
                    
                    {/* Time and checkmarks */}
                    <div className={cn(
                      "flex items-center gap-1 mt-1",
                      isMe ? "justify-end text-gray-600 dark:text-gray-400" : "justify-end text-gray-500 dark:text-gray-500"
                    )}>
                      <span className="text-[11px]">{timestamp}</span>
                      {isMe && (
                        <div className="flex">
                          <Check className="h-3.5 w-3.5 text-[#53bdeb]" strokeWidth={2.5} />
                          <Check className="h-3.5 w-3.5 -ml-2 text-[#53bdeb]" strokeWidth={2.5} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            );
          })}
          <div ref={messagesEndRef} />
        </>
      )}
    </div>
  );
}
