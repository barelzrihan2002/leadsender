import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, TrendingUp, MessageCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDistance } from 'date-fns';
import { he, ar } from 'date-fns/locale';
import type { Account } from '@/types';

interface WarmUpStatsProps {
  accounts: Account[];
}

export default function WarmUpStats({ accounts }: WarmUpStatsProps) {
  const { t, language } = useLanguage();
  const [stats, setStats] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [statsData, logsData] = await Promise.all([
        window.electron.warmup.getStats(),
        window.electron.warmup.getLogs(20)
      ]);
      setStats(statsData);
      setLogs(logsData);
    } catch (error) {
      console.error('Failed to load warmup stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAccountInfo = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    return account?.name || account?.phone_number || accountId.substring(0, 8) + '...';
  };

  return (
    <div className="space-y-4">
      {/* Statistics Cards */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {t('warmup.statistics')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : stats.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('warmup.noActivity')}</p>
          ) : (
            <div className="space-y-3">
              {stats.map((stat) => (
                <div key={stat.account_id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{getAccountInfo(stat.account_id)}</p>
                    {stat.last_sent && (
                      <p className="text-xs text-muted-foreground">
                        {t('warmup.lastMessage')}: {formatDistance(new Date(stat.last_sent), new Date(), { 
                          addSuffix: true,
                          locale: language === 'he' ? he : language === 'ar' ? ar : undefined
                        })}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary" className="font-mono">
                    {stat.total_sent} {t('warmup.totalSent')}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-500" />
            {t('warmup.recentActivity')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('warmup.noActivity')}</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {logs.map((log) => (
                <div key={log.id} className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1 text-xs">
                      <span className="font-medium text-blue-600 dark:text-blue-400">
                        {log.from_name || log.from_phone}
                      </span>
                      <span className="text-muted-foreground mx-1">→</span>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        {log.to_name || log.to_phone}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDistance(new Date(log.sent_at), new Date(), { 
                        addSuffix: true,
                        locale: language === 'he' ? he : language === 'ar' ? ar : undefined
                      })}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded mt-2">
                    "{log.message_text}"
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
