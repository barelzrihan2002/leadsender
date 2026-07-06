import { useEffect, useState, useRef } from 'react';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, MessageSquare, Ban, CheckCheck, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import ChatList from '@/components/inbox/ChatList';
import ChatWindow from '@/components/inbox/ChatWindow';
import MessageInput from '@/components/inbox/MessageInput';
import { toast } from '@/components/ui/use-toast';
import { api, onNewMessage } from '@/lib/api';
import type { Chat, Message, Account } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Inbox() {
  const { t, dir, language } = useLanguage();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [chats, setChats] = useState<Chat[]>([]);
  const [filteredChats, setFilteredChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'handled' | 'unhandled'>('all');
  const [isContactInBlacklist, setIsContactInBlacklist] = useState(false);

  useEffect(() => {
    loadAccounts();

    // Listen for new messages
    const cleanup = onNewMessage((message) => {
      if (!selectedAccountId || selectedAccountId === 'all' || message.account_id === selectedAccountId) {
        loadChats();
        if (selectedChat && message.software_chat_id === selectedChat.id) {
          setMessages(prev => [...prev, message]);
        }
      }
    });

    return cleanup;
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      loadChats(searchQuery);
    }
  }, [selectedAccountId]);

  // Debounce search - search server-side after 400ms
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      loadChats(searchQuery);
    }, 400);
    
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery]);

  useEffect(() => {
    filterChats();
  }, [chats, statusFilter]);

  const loadAccounts = async () => {
    try {
      const data = await api.accounts.getAll();
      setAccounts(data);
      if (data.length > 0 && !selectedAccountId) {
        setSelectedAccountId('all');
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const loadChats = async (search?: string) => {
    try {
      const accountId = selectedAccountId === 'all' ? undefined : selectedAccountId;
      const data = await api.messages.getChats(accountId, search || undefined);
      setChats(data);
    } catch (error) {
      console.error('Failed to load chats:', error);
    }
  };

  const filterChats = () => {
    let filtered = chats;

    // Filter by status (client-side, fast)
    if (statusFilter === 'handled') {
      filtered = filtered.filter(chat => chat.status === 'handled');
    } else if (statusFilter === 'unhandled') {
      filtered = filtered.filter(chat => chat.status === 'unhandled');
    }

    // Search is now done server-side, no need to filter here

    setFilteredChats(filtered);
  };

  const loadMessages = async (chat: Chat) => {
    try {
      const data = await api.messages.getByChat(chat.id);
      setMessages(data);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleSelectChat = async (chat: Chat) => {
    setSelectedChat(chat);
    loadMessages(chat);
    checkIfInBlacklist(chat);
    
    // Mark chat as read (clear unread count) when opening
    if (chat.unread_count > 0) {
      try {
        // Update in backend - mark all incoming messages as read
        await api.messages.markAsRead(chat.id);
        
        // Update locally
        setChats(prev => prev.map(c => 
          c.id === chat.id
            ? { ...c, unread_count: 0 }
            : c
        ));
      } catch (error) {
        console.error('Failed to mark as read:', error);
      }
    }
  };

  const checkIfInBlacklist = async (chat: Chat) => {
    try {
      const phoneNumber = chat.phone_number || '';
      const isBlacklisted = await api.contacts.isInBlacklist(phoneNumber);
      setIsContactInBlacklist(isBlacklisted);
    } catch (error) {
      console.error('Failed to check blacklist status:', error);
      setIsContactInBlacklist(false);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!selectedChat || !canReplyInSelectedChat) return;

    try {
      // Use phone_number from the chat to send
      const targetId = selectedChat.last_message?.chat_id || `${selectedChat.phone_number}@c.us`;
      
      console.log('Sending to chat_id:', targetId);
      await api.messages.send(selectedChat.account_id, targetId, message);
      
      // Reload messages to show the sent message
      setTimeout(() => loadMessages(selectedChat), 500);
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error(t('toast.error'));
    }
  };

  const handleSendFile = async (file: File, type: 'image' | 'document' | 'video', caption?: string) => {
    if (!selectedChat || !canReplyInSelectedChat) return;

    try {
      // Convert File to Buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);
      
      // Save to temporary file via Electron
      const tempFilePath = await api.messages.saveTempFile(file.name, buffer as any);
      
      // Send via WhatsApp
      const targetId = selectedChat.last_message?.chat_id || `${selectedChat.phone_number}@c.us`;
      console.log('Sending file to chat_id:', targetId, 'type:', type, 'with caption:', caption);
      
      await api.messages.sendMedia(selectedChat.account_id, targetId, tempFilePath, caption);
      
      // Clean up temp file
      setTimeout(async () => {
        await api.messages.deleteTempFile(tempFilePath);
      }, 5000);
      
      // Reload messages to show the sent media
      setTimeout(() => loadMessages(selectedChat), 500);
      toast.success(t('toast.fileSent'));
    } catch (error) {
      console.error('Failed to send file:', error);
      toast.error(t('toast.error'));
    }
  };

  const handleMarkAsHandled = async () => {
    if (!selectedChat) return;

    try {
      const newStatus = selectedChat.status === 'handled' ? 'unhandled' : 'handled';
      await api.messages.markChatStatus(selectedChat.id, newStatus);
      setSelectedChat({ ...selectedChat, status: newStatus });
      loadChats();
      toast.success(t('toast.markedAsHandled'));
    } catch (error) {
      console.error('Failed to mark as handled:', error);
      toast.error(t('toast.error'));
    }
  };

  const handleMarkAllAsHandled = async () => {
    try {
      const accountId = selectedAccountId === 'all' ? undefined : selectedAccountId;
      const count = await api.messages.markAllChats(accountId, true);
      
      // Update selected chat if exists
      if (selectedChat) {
        setSelectedChat({ ...selectedChat, status: 'handled' });
      }
      
      loadChats();
      
      toast.success(
        language === 'he' 
          ? `${count} צ'אטים סומנו כטופל`
          : `${count} chats marked as handled`
      );
    } catch (error) {
      console.error('Failed to mark all as handled:', error);
      toast.error(t('toast.error'));
    }
  };

  const handleMarkAllAsUnhandled = async () => {
    try {
      const accountId = selectedAccountId === 'all' ? undefined : selectedAccountId;
      const count = await api.messages.markAllChats(accountId, false);
      
      // Update selected chat if exists
      if (selectedChat) {
        setSelectedChat({ ...selectedChat, status: 'unhandled' });
      }
      
      loadChats();
      
      toast.success(
        language === 'he' 
          ? `${count} צ'אטים סומנו כלא טופל`
          : `${count} chats marked as unhandled`
      );
    } catch (error) {
      console.error('Failed to mark all as unhandled:', error);
      toast.error(t('toast.error'));
    }
  };

  const handleAddToBlacklist = async () => {
    if (!selectedChat) return;

    try {
      // Get phone number from chat
      const phoneNumber = selectedChat.phone_number || '';

      console.log('Adding to blacklist:', phoneNumber);

      // Check if contact exists (smart matching - all formats)
      let contact = await api.contacts.findByPhone(phoneNumber);

      // Create contact if doesn't exist
      if (!contact) {
        const contactName = selectedChat.name || phoneNumber;
        contact = await api.contacts.create({
          phone_number: phoneNumber,
          name: contactName
        });
        console.log('Created new contact:', contact.id);
      }

      // Get BlackList tag
      const tags = await api.tags.getAll();
      const blacklistTag = tags.find(t => t.name === 'BlackList');

      if (!blacklistTag) {
        toast.error(language === 'he' ? 'לא נמצא טאג BlackList' : 'BlackList tag not found');
        return;
      }

      // Check if already in blacklist
      if (contact.tags?.some(t => t.name === 'BlackList')) {
        toast.warning(language === 'he' 
          ? 'איש הקשר כבר ב-BlackList'
          : 'Contact already in BlackList'
        );
        return;
      }

      // Add to BlackList
      await api.contacts.addTag(contact.id, blacklistTag.id);
      setIsContactInBlacklist(true);
      
      toast.success(language === 'he' 
        ? `${phoneNumber} נוסף ל-BlackList בהצלחה`
        : `${phoneNumber} added to BlackList successfully`
      );
    } catch (error) {
      console.error('Failed to add to blacklist:', error);
      toast.error(t('toast.error'));
    }
  };

  const connectedAccountsCount = accounts.filter(account => account.status === 'connected').length;
  const selectedChatAccount = selectedChat
    ? accounts.find(account => account.id === selectedChat.account_id) || null
    : null;
  const canReplyInSelectedChat = Boolean(selectedChatAccount && selectedChatAccount.status === 'connected');
  const offlineInboxMessage = language === 'he'
    ? 'אין כרגע חשבונות מחוברים. אפשר עדיין לצפות בשיחות ובהודעות שנשמרו.'
    : language === 'ar'
    ? 'لا توجد حسابات متصلة حالياً. ما زال بإمكانك عرض المحادثات والرسائل المحفوظة.'
    : 'No accounts are currently connected. You can still view saved chats and messages.';
  const offlineReplyMessage = language === 'he'
    ? 'כדי לשלוח הודעות צריך לחבר מחדש את החשבון של השיחה הזו.'
    : language === 'ar'
    ? 'لإرسال رسائل يجب إعادة توصيل حساب هذه المحادثة.'
    : 'Reconnect this chat account to send messages.';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col bg-card rounded-2xl border shadow-sm overflow-hidden m-2">
      <div className="flex h-full" dir={dir}>
        {/* Sidebar - Chat List - Always on left like WhatsApp */}
        <div className={cn(
          "w-80 flex flex-col border-r border-primary/20 bg-card",
          dir === 'rtl' ? 'mr-2 pr-3' : ''
        )}>
          <div className={cn(
            "p-4 border-b border-primary/10 space-y-3 bg-primary/5",
            dir === 'rtl' ? 'pr-6' : ''
          )}>
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">{t('inbox.title')}</h1>
            {connectedAccountsCount === 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                {offlineInboxMessage}
              </div>
            )}
            
            <div className="space-y-2">
              <Input
                placeholder={t('inbox.searchChats')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 bg-muted/50 border-none focus-visible:ring-1"
              />
              
              <div className="flex gap-2">
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <option value="all">{t('inbox.allStatus')}</option>
                  <option value="unhandled">{t('inbox.unhandled')}</option>
                  <option value="handled">{t('inbox.handled')}</option>
                </Select>
                
                <Select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                >
                  <option value="all">{t('inbox.allAccounts')}</option>
                  {accounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {`${account.name || account.phone_number}${account.status === 'connected' ? '' : ` (${account.status})`}`}
                    </option>
                  ))}
                </Select>
              </div>
              
              {/* Bulk Actions */}
              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleMarkAllAsHandled}
                  className="flex-1 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200 text-xs"
                >
                  {language === 'he' ? 'סמן הכל כטופל' : 'Mark All Handled'}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleMarkAllAsUnhandled}
                  className="flex-1 text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200 text-xs"
                >
                  {language === 'he' ? 'סמן הכל כלא טופל' : 'Mark All Unhandled'}
                </Button>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-hidden">
            <ChatList
              chats={filteredChats}
              selectedChatId={selectedChat?.id || null}
              onSelectChat={handleSelectChat}
            />
          </div>
          
          <div className="p-2 text-center border-t border-primary/10 bg-primary/5 text-xs text-muted-foreground">
            {filteredChats.length} {t('inbox.chats')}
          </div>
        </div>

        {/* Separator in RTL */}
        {dir === 'rtl' && <div className="w-1 bg-border flex-shrink-0" />}
        
        {/* Main Content - Chat Window */}
        <div className="flex-1 flex flex-col bg-background relative">
          {selectedChat ? (
            <>
              <div className="h-16 px-6 border-b border-primary/10 flex items-center justify-between bg-primary/5 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  {selectedChat.photo ? (
                    <img 
                      src={`local-file:///${selectedChat.photo.replace(/\\/g, '/')}`} 
                      alt={selectedChat.name || ''} 
                      className="h-10 w-10 rounded-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                    />
                  ) : null}
                  <div className={`h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg ${selectedChat.photo ? 'hidden' : ''}`}>
                    {(selectedChat.name || selectedChat.phone_number || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    {(() => {
                      const displayName = selectedChat.name || '';
                      const phoneNumber = selectedChat.phone_number || '';
                      const displayNumber = phoneNumber && phoneNumber.startsWith('972') 
                        ? `+${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3)}`
                        : phoneNumber
                          ? `+${phoneNumber}`
                          : '';
                      
                      return (
                        <>
                          <h2 className="font-semibold">{displayName || displayNumber}</h2>
                          {displayName && displayNumber && (
                            <p className="text-xs text-muted-foreground">{displayNumber}</p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
                    {selectedChatAccount?.name || selectedChatAccount?.phone_number || 'Account'}
                    {selectedChatAccount ? ` • ${selectedChatAccount.status}` : ''}
                  </div>
                  <Button 
                    size="sm" 
                    onClick={handleAddToBlacklist} 
                    variant="outline" 
                    className={`gap-2 ${
                      isContactInBlacklist 
                        ? 'bg-red-100 text-red-700 border-red-300 cursor-not-allowed opacity-75'
                        : 'text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200'
                    }`}
                    disabled={isContactInBlacklist}
                  >
                    <Ban className="h-4 w-4" />
                    {isContactInBlacklist 
                      ? (language === 'he' ? 'ב-BlackList' : 'Blocked')
                      : (language === 'he' ? 'BlackList' : 'Block')
                    }
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleMarkAsHandled} 
                    variant="outline" 
                    className={`gap-2 ${
                      selectedChat.status === 'handled'
                        ? 'bg-green-100 text-green-700 border-green-300'
                        : 'text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200'
                    }`}
                  >
                    <Check className="h-4 w-4" />
                    {selectedChat.status === 'handled'
                      ? (language === 'he' ? 'טופל ✓' : 'Handled ✓')
                      : t('inbox.markHandled')
                    }
                  </Button>
                </div>
              </div>
              
              <ChatWindow messages={messages} />
              {!canReplyInSelectedChat && (
                <div className="border-t border-primary/10 px-4 py-2 text-xs text-amber-800 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-100">
                  {offlineReplyMessage}
                </div>
              )}
              <MessageInput onSend={handleSendMessage} onSendFile={handleSendFile} disabled={!canReplyInSelectedChat} />
            </>
          ) : (
            <div 
              className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-primary/5"
              style={{
                backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")',
                backgroundRepeat: 'repeat',
                backgroundBlendMode: 'overlay',
                backgroundSize: '400px'
              }}
            >
              <div className="bg-white/90 dark:bg-card/90 backdrop-blur-sm rounded-2xl p-8 shadow-lg max-w-md mx-4 border border-primary/20">
                <div className="h-24 w-24 bg-primary/10 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <MessageSquare className="h-12 w-12 text-primary" />
                </div>
                <p className="text-lg font-medium text-center mb-2">{t('inbox.selectChat')}</p>
                <p className="text-sm text-center text-muted-foreground">{t('inbox.manageConversations')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
