import { formatDistance } from 'date-fns';
import { he, ar } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { CheckCheck } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Chat } from '@/types';
import { cn } from '@/lib/utils';

interface ChatListProps {
  chats: Chat[];
  selectedChatId: string | null;
  onSelectChat: (chat: Chat) => void;
}

export default function ChatList({ chats, selectedChatId, onSelectChat }: ChatListProps) {
  const { language, t } = useLanguage();
  
  // Function to get message preview text - handles media types
  const getMessagePreview = (message: Chat['last_message']): string => {
    if (!message) return '';
    
    // If there's text content, show it
    if (message.message_text && message.message_text.trim() !== '') {
      return message.message_text;
    }
    
    // For media types without text, show media type label
    const mediaType = message.message_type;
    switch (mediaType) {
      case 'image':
        return t('inbox.media.image');
      case 'video':
        return t('inbox.media.video');
      case 'audio':
      case 'voice':
        return t('inbox.media.audio');
      case 'document':
        return t('inbox.media.document');
      default:
        // If no text and not a known media type, return empty
        return '';
    }
  };
  
  return (
    <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-muted">
      {chats.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <p>{t('inbox.noChats')}</p>
        </div>
      ) : (
        <div className="divide-y divide-border/50">
          {chats.map((chat) => {
            // Use name and phone_number from the chat object
            const displayName = chat.name || '';
            const phoneNumber = chat.phone_number || '';
            
            // Format phone number nicely
            const displayNumber = phoneNumber && phoneNumber.startsWith('972') 
              ? `+${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3)}`
              : phoneNumber 
                ? `+${phoneNumber}`
                : '';
            
            const finalDisplayName = displayName || displayNumber;
            
            return (
              <button
                key={chat.id}
                onClick={() => onSelectChat(chat)}
                className={cn(
                  "w-full hover:bg-primary/10 transition-all duration-200 relative group",
                  selectedChatId === chat.id 
                    ? 'bg-primary/10 border-l-4 border-primary p-4 pl-3' 
                    : 'border-l-4 border-transparent p-4 pl-3'
                )}
                style={{ textAlign: 'start' }}
              >
                <div className="flex items-start justify-between mb-1.5 gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                    {/* Profile photo or initial */}
                    {chat.photo ? (
                      <img 
                        src={`local-file:///${chat.photo.replace(/\\/g, '/')}`} 
                        alt="" 
                        className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs flex-shrink-0">
                        {finalDisplayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex flex-col min-w-0 flex-1">
                      <h4 
                        className={cn(
                          "font-medium truncate",
                          chat.unread_count > 0 ? "text-foreground" : "text-muted-foreground"
                        )}
                        style={{ direction: language === 'he' ? 'rtl' : 'ltr' }}
                      >
                        {finalDisplayName}
                      </h4>
                      {displayName && displayNumber && (
                        <span className="text-[10px] text-muted-foreground truncate">{displayNumber}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {chat.last_message && (
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatDistance(new Date(chat.last_message.timestamp), new Date(), { 
                          addSuffix: true,
                          locale: language === 'he' ? he : language === 'ar' ? ar : undefined
                        })}
                      </span>
                    )}
                  </div>
                </div>
                
                {chat.last_message && (
                  <div className="flex items-start justify-between gap-3 pl-10">
                    <p className="text-xs text-muted-foreground truncate leading-relaxed line-clamp-2 flex-1 min-w-0">
                      {getMessagePreview(chat.last_message)}
                    </p>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {chat.unread_count > 0 && (
                        <Badge className="h-5 min-w-[1.25rem] px-1 rounded-full bg-primary hover:bg-primary/90 text-[10px] justify-center">
                          {chat.unread_count}
                        </Badge>
                      )}
                      {chat.status === 'handled' && (
                        <CheckCheck className="h-3 w-3 text-green-500" />
                      )}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
