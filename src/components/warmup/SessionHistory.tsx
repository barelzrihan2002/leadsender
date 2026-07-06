import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { History, Eye, Calendar, Users, MessageSquare } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDistance } from 'date-fns';
import { he, ar } from 'date-fns/locale';
import type { Account } from '@/types';

interface SessionHistoryProps {
  accounts: Account[];
}

export default function SessionHistory({ accounts }: SessionHistoryProps) {
  const { t, language } = useLanguage();
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [sessionDetails, setSessionDetails] = useState<any>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const data = await window.electron.warmup.getAllSessions();
      setSessions(data);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const handleViewDetails = async (session: any) => {
    try {
      const details = await window.electron.warmup.getSessionDetails(session.id);
      setSessionDetails(details);
      setSelectedSession(session);
      setShowDetailsDialog(true);
    } catch (error) {
      console.error('Failed to load session details:', error);
    }
  };

  const getAccountName = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    return account?.name || account?.phone_number || accountId.substring(0, 8) + '...';
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-purple-500" />
            {t('warmup.sessionHistory')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('warmup.noActivity')}
            </p>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={session.status === 'active' ? 'default' : 'secondary'}>
                        {session.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistance(new Date(session.started_at), new Date(), { 
                          addSuffix: true,
                          locale: language === 'he' ? he : language === 'ar' ? ar : undefined
                        })}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleViewDetails(session)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      {t('warmup.viewDetails')}
                    </Button>
                  </div>
                  
                  <div className="flex gap-4 text-xs">
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3 text-blue-500" />
                      <span className="font-mono font-semibold">{session.total_messages || 0}</span>
                      <span className="text-muted-foreground">{t('warmup.messagesInSession')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-green-500" />
                      <span className="font-mono font-semibold">{session.accounts_count || 0}</span>
                      <span className="text-muted-foreground">{t('warmup.accountsParticipated')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {t('warmup.sessionDetails')}
            </DialogTitle>
          </DialogHeader>

          {sessionDetails && (
            <div className="space-y-4 py-4">
              {/* Session Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">{language === 'he' ? 'התחל' : language === 'ar' ? 'بدأ' : 'Started'}</p>
                  <p className="font-medium">
                    {new Date(sessionDetails.session.started_at).toLocaleString(language)}
                  </p>
                </div>
                {sessionDetails.session.stopped_at && (
                  <div>
                    <p className="text-xs text-muted-foreground">{language === 'he' ? 'נעצר' : language === 'ar' ? 'توقف' : 'Stopped'}</p>
                    <p className="font-medium">
                      {new Date(sessionDetails.session.stopped_at).toLocaleString(language)}
                    </p>
                  </div>
                )}
              </div>

              {/* Account Breakdown */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {t('warmup.accountBreakdown')}
                </h3>
                <div className="space-y-2">
                  {sessionDetails.accounts.map((account: any) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/20"
                    >
                      <span className="font-medium text-sm">
                        {account.name || account.phone_number}
                      </span>
                      <Badge className="font-mono">
                        {account.messages_sent || 0} {t('warmup.messagesInSession')}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Message Logs */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  {t('warmup.recentActivity')}
                </h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {sessionDetails.logs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {t('warmup.noActivity')}
                    </p>
                  ) : (
                    sessionDetails.logs.map((log: any) => (
                      <div key={log.id} className="p-2 rounded-md border bg-card text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <div>
                            <span className="font-medium text-blue-600 dark:text-blue-400">
                              {log.from_name || log.from_phone}
                            </span>
                            <span className="text-muted-foreground mx-1">→</span>
                            <span className="font-medium text-green-600 dark:text-green-400">
                              {log.to_name || log.to_phone}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(log.sent_at).toLocaleString(language)}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground bg-muted/50 p-1.5 rounded">
                          "{log.message_text}"
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
