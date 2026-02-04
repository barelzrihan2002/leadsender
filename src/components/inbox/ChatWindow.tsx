import { useEffect, useRef } from 'react';
import { formatDistance } from 'date-fns';
import { he, ar } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Message } from '@/types';
import { cn } from '@/lib/utils';
import { FileText, Image as ImageIcon, Download, Check } from 'lucide-react';

interface ChatWindowProps {
  messages: Message[];
}

export default function ChatWindow({ messages }: ChatWindowProps) {
  const { language } = useLanguage();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const renderMessageContent = (message: Message) => {
    // Handle media messages (images and documents)
    if (message.message_type === 'image' || message.message_type === 'document') {
      const isImage = message.message_type === 'image';
      
      return (
        <div className="space-y-2">
          {/* Media preview/icon */}
          <div className={cn(
            "rounded-lg overflow-hidden",
            isImage ? "bg-transparent" : "bg-white/10 p-3"
          )}>
            {isImage ? (
              <div className="flex items-center gap-2 bg-white/10 p-2 rounded">
                <ImageIcon className="h-5 w-5" />
                <span className="text-sm font-medium">{message.media_filename || 'Image'}</span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{message.media_filename || 'Document'}</p>
                  <p className="text-xs opacity-70">{message.media_mimetype?.split('/')[1]?.toUpperCase() || 'FILE'}</p>
                </div>
              </div>
            )}
          </div>
          
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
              const hasMedia = msg.message_type === 'image' || msg.message_type === 'document';
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
