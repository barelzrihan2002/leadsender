import { useEffect, useState } from 'react';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, MessageSquare } from 'lucide-react';
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
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [chats, setChats] = useState<Chat[]>([]);
  const [filteredChats, setFilteredChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'handled' | 'unhandled'>('all');

  useEffect(() => {
    loadAccounts();

    // Listen for new messages
    const cleanup = onNewMessage((message) => {
      if (!selectedAccountId || message.account_id === selectedAccountId) {
        loadChats();
        if (selectedChat && message.chat_id === selectedChat.chat_id) {
          setMessages(prev => [...prev, message]);
        }
      }
    });

    return cleanup;
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      loadChats();
    }
  }, [selectedAccountId]);

  useEffect(() => {
    filterChats();
  }, [chats, searchQuery, statusFilter]);

  const loadAccounts = async () => {
    try {
      const data = await api.accounts.getAll();
      const connectedAccounts = data.filter(acc => acc.status === 'connected');
      setAccounts(connectedAccounts);
      if (connectedAccounts.length > 0 && !selectedAccountId) {
        setSelectedAccountId('all');
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChats = async () => {
    try {
      const accountId = selectedAccountId === 'all' ? undefined : selectedAccountId;
      const data = await api.messages.getChats(accountId);
      setChats(data);
    } catch (error) {
      console.error('Failed to load chats:', error);
    }
  };

  const filterChats = () => {
    let filtered = chats;

    // Filter by status
    if (statusFilter === 'handled') {
      filtered = filtered.filter(chat => chat.is_handled);
    } else if (statusFilter === 'unhandled') {
      filtered = filtered.filter(chat => !chat.is_handled);
    }

    // Filter by search query (name or phone number)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(chat => {
        const senderName = chat.last_message?.sender_name?.toLowerCase() || '';
        const fromNumber = chat.last_message?.from_number || '';
        const chatId = chat.chat_id.toLowerCase();
        
        return senderName.includes(query) || 
               fromNumber.includes(query) || 
               chatId.includes(query);
      });
    }

    setFilteredChats(filtered);
  };

  const loadMessages = async (chat: Chat) => {
    try {
      const data = await api.messages.getByChat(chat.chat_id, chat.account_id);
      setMessages(data);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleSelectChat = async (chat: Chat) => {
    setSelectedChat(chat);
    loadMessages(chat);
    
    // Mark chat as read (clear unread count) when opening
    if (chat.unread_count > 0) {
      try {
        // Update in backend - mark all incoming messages as read
        await api.messages.markAsHandled(chat.chat_id, chat.account_id);
        
        // Update locally
        setChats(prev => prev.map(c => 
          c.chat_id === chat.chat_id && c.account_id === chat.account_id
            ? { ...c, unread_count: 0 }
            : c
        ));
      } catch (error) {
        console.error('Failed to mark as read:', error);
      }
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!selectedChat) return;

    try {
      // Use the ORIGINAL chat_id to keep messages in same conversation
      // If it's @lid, use it. If it's a regular number, add @c.us
      const targetId = selectedChat.chat_id;
      
      console.log('Sending to chat_id:', targetId);
      await api.messages.send(selectedChat.account_id, targetId, message);
      
      // Reload messages to show the sent message
      setTimeout(() => loadMessages(selectedChat), 500);
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error(t('toast.error'));
    }
  };

  const handleSendFile = async (file: File, type: 'image' | 'document', caption?: string) => {
    if (!selectedChat) return;

    try {
      // Convert File to Buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);
      
      // Save to temporary file via Electron
      const tempFilePath = await api.messages.saveTempFile(file.name, buffer as any);
      
      // Send via WhatsApp
      const targetId = selectedChat.chat_id;
      console.log('Sending file to chat_id:', targetId, 'with caption:', caption);
      
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
      await api.messages.markAsHandled(selectedChat.chat_id, selectedChat.account_id);
      setSelectedChat({ ...selectedChat, is_handled: true });
      loadChats();
      toast.success(t('toast.markedAsHandled'));
    } catch (error) {
      console.error('Failed to mark as handled:', error);
      toast.error(t('toast.error'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-muted-foreground mb-4">{t('accounts.noAccounts')}</p>
        <Button onClick={() => window.location.href = '/accounts'}>
          {t('accounts.addAccount')}
        </Button>
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
                      {account.name || account.phone_number}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-hidden">
            <ChatList
              chats={filteredChats}
              selectedChatId={selectedChat?.chat_id || null}
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
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
                    {(() => {
                      let displayName = '';
                      if (selectedChat.last_message) {
                        if (selectedChat.last_message.is_from_me) {
                          displayName = selectedChat.last_message.contact_name || '';
                        } else {
                          displayName = selectedChat.last_message.sender_name || '';
                        }
                      }
                      
                      const finalName = displayName || selectedChat.chat_id;
                      return finalName.charAt(0).toUpperCase();
                    })()}
                  </div>
                  <div>
                    {(() => {
                      let displayName = '';
                      let contactNumber = '';
                      
                      if (selectedChat.last_message) {
                        if (selectedChat.last_message.is_from_me) {
                          displayName = selectedChat.last_message.contact_name || '';
                          contactNumber = selectedChat.last_message.contact_number || selectedChat.chat_id.split('@')[0];
                        } else {
                          displayName = selectedChat.last_message.sender_name || '';
                          contactNumber = selectedChat.last_message.from_number || selectedChat.chat_id.split('@')[0];
                        }
                      }
                      
                      const displayNumber = contactNumber && contactNumber.startsWith('972') 
                        ? `+${contactNumber.slice(0, 3)}-${contactNumber.slice(3)}`
                        : contactNumber
                          ? `+${contactNumber}`
                          : selectedChat.chat_id.split('@')[0];
                      
                      return (
                        <>
                          <h2 className="font-semibold">{displayName || displayNumber}</h2>
                          {displayName && (
                            <p className="text-xs text-muted-foreground">{displayNumber}</p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
                    {accounts.find(a => a.id === selectedChat.account_id)?.name || 'Account'}
                  </div>
                  {!selectedChat.is_handled && (
                    <Button size="sm" onClick={handleMarkAsHandled} variant="outline" className="gap-2 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200">
                      <Check className="h-4 w-4" />
                      {t('inbox.markHandled')}
                    </Button>
                  )}
                </div>
              </div>
              
              <ChatWindow messages={messages} />
              <MessageInput onSend={handleSendMessage} onSendFile={handleSendFile} />
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
