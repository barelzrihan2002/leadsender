import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import WarmUpConfig from '@/components/warmup/WarmUpConfig';
import WarmUpStatus from '@/components/warmup/WarmUpStatus';
import { toast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import type { WarmUpSession, Account } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';

export default function WarmUp() {
  const { t } = useLanguage();
  const [activeSession, setActiveSession] = useState<WarmUpSession | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSession();
    loadAccounts();

    const interval = setInterval(loadSession, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadSession = async () => {
    try {
      const session = await api.warmup.getActive();
      setActiveSession(session);
    } catch (error) {
      console.error('Failed to load warm-up session:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      const data = await api.accounts.getAll();
      setAccounts(data);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };

  const handleStart = async (accountIds: string[], minDelay: number, maxDelay: number) => {
    try {
      const sessionId = await api.warmup.start(accountIds, minDelay, maxDelay);
      console.log('Started warm-up session:', sessionId);
      loadSession();
      toast.success(t('toast.success'));
    } catch (error) {
      console.error('Failed to start warm-up:', error);
      toast.error(t('toast.error'));
    }
  };

  const handleStop = async () => {
    if (!activeSession) return;

    try {
      await api.warmup.stop(activeSession.id);
      setActiveSession(null);
      toast.success(t('toast.success'));
    } catch (error) {
      console.error('Failed to stop warm-up:', error);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('warmup.title')}</h1>
        <p className="text-muted-foreground">
          {t('warmup.subtitle')}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {activeSession ? (
          <WarmUpStatus
            session={activeSession}
            accounts={accounts}
            onStop={handleStop}
          />
        ) : (
          <WarmUpConfig onStart={handleStart} />
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t('warmup.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              {t('warmup.subtitle')}
            </p>
            
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mt-3">
              <h4 className="font-semibold text-primary mb-2">{t('warmup.smartLimits')}</h4>
              <ul className="space-y-1 text-xs">
                <li>✅ <strong>{t('warmup.parallelWork')}</strong></li>
                <li>✅ <strong>{t('warmup.maxMessages')}</strong></li>
                <li>✅ <strong>{t('warmup.activeHours')}</strong></li>
                <li>✅ <strong>{t('warmup.autoReset')}</strong></li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
