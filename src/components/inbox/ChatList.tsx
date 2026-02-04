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
  
  return (
    <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-muted">
      {chats.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <p>{t('inbox.noChats')}</p>
        </div>
      ) : (
        <div className="divide-y divide-border/50">
          {chats.map((chat) => {
            // Determine display name based on message direction:
            // - For outgoing messages (is_from_me): show contact name (who we sent to)
            // - For incoming messages: show sender name (who sent to us)
            let displayName = '';
            let contactNumber = '';
            
            if (chat.last_message) {
              if (chat.last_message.is_from_me) {
                // Outgoing message - show the contact we sent to
                displayName = chat.last_message.contact_name || '';
                contactNumber = chat.last_message.contact_number || chat.chat_id.split('@')[0];
              } else {
                // Incoming message - show sender name
                displayName = chat.last_message.sender_name || '';
                contactNumber = chat.last_message.from_number || chat.chat_id.split('@')[0];
              }
            }
            
            // Format phone number nicely
            const displayNumber = contactNumber && contactNumber.startsWith('972') 
              ? `+${contactNumber.slice(0, 3)}-${contactNumber.slice(3)}`
              : contactNumber 
                ? `+${contactNumber}`
                : chat.chat_id.split('@')[0];
            
            // Use contact name if available, otherwise use formatted phone number
            const finalDisplayName = displayName || displayNumber;
            
            return (
              <button
                key={`${chat.chat_id}-${chat.account_id}`}
                onClick={() => onSelectChat(chat)}
                className={cn(
                  "w-full hover:bg-primary/10 transition-all duration-200 relative group",
                  selectedChatId === chat.chat_id 
                    ? 'bg-primary/10 border-l-4 border-primary p-4 pl-3' 
                    : 'border-l-4 border-transparent p-4 pl-3'
                )}
                style={{ textAlign: 'start' }}
              >
                <div className="flex items-start justify-between mb-1.5 gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                    <div className={cn(
                      "h-2 w-2 rounded-full flex-shrink-0",
                      chat.unread_count > 0 ? "bg-blue-500" : "bg-transparent"
                    )} />
                    <h4 
                      className={cn(
                        "font-medium truncate flex-1",
                        chat.unread_count > 0 ? "text-foreground" : "text-muted-foreground"
                      )}
                      style={{ direction: language === 'he' ? 'rtl' : 'ltr' }}
                    >
                      {finalDisplayName}
                    </h4>
                  </div>
                  {chat.last_message && (
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                      {formatDistance(new Date(chat.last_message.timestamp), new Date(), { 
                        addSuffix: true,
                        locale: language === 'he' ? he : language === 'ar' ? ar : undefined
                      })}
                    </span>
                  )}
                </div>
                
                {chat.last_message && (
                  <div className="flex items-start justify-between gap-3 pl-4">
                    <p className="text-xs text-muted-foreground truncate leading-relaxed line-clamp-2 flex-1 min-w-0">
                      {chat.last_message.message_text}
                    </p>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {chat.unread_count > 0 && (
                        <Badge className="h-5 min-w-[1.25rem] px-1 rounded-full bg-primary hover:bg-primary/90 text-[10px] justify-center">
                          {chat.unread_count}
                        </Badge>
                      )}
                      {chat.is_handled && (
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
