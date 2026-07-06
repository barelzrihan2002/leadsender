import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Square, CheckCircle2 } from 'lucide-react';
import { formatDistance } from 'date-fns';
import { he, ar } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';
import type { WarmUpSession, Account } from '@/types';

interface WarmUpStatusProps {
  session: WarmUpSession;
  accounts: Account[];
  onStop: () => void;
}

export default function WarmUpStatus({ session, accounts, onStop }: WarmUpStatusProps) {
  const { t, language } = useLanguage();
  const accountsInfo = accounts.filter(acc => session.accounts.includes(acc.id));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('warmup.sessionActive')}</CardTitle>
          <Badge className="bg-green-500">{t('campaigns.running')}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-sm font-medium mb-2">{language === 'he' ? 'חשבונות משתתפים' : 'Participating Accounts'}</h4>
          <div className="space-y-1">
            {accountsInfo.map(account => (
              <div key={account.id} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>{account.name || account.phone_number}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">{t('createCampaign.minDelay')}</p>
            <p className="font-semibold">{Math.floor(session.min_delay / 60)} {language === 'he' ? 'דק' : 'min'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('createCampaign.maxDelay')}</p>
            <p className="font-semibold">{Math.floor(session.max_delay / 60)} {language === 'he' ? 'דק' : 'min'}</p>
          </div>
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">{language === 'he' ? 'היום' : 'Today'}</p>
              <p className="font-bold text-primary text-lg">
                {(session as any).messages_sent_today || 0}
              </p>
              <p className="text-xs text-muted-foreground">{language === 'he' ? 'הודעות נשלחו' : 'messages sent'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">{language === 'he' ? 'מגבלה/חשבון' : 'Limit/Account'}</p>
              <p className="font-bold text-lg">40</p>
              <p className="text-xs text-muted-foreground">{language === 'he' ? 'מקס ליום' : 'max per day'}</p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            {language === 'he' ? 'התחיל ' : language === 'ar' ? 'بدأ ' : 'Started '}
            {formatDistance(new Date(session.started_at), new Date(), { 
              addSuffix: true,
              locale: language === 'he' ? he : language === 'ar' ? ar : undefined
            })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('warmup.activeHours')}
          </p>
        </div>

        <Button onClick={onStop} variant="destructive" className="w-full">
          <Square className="h-4 w-4 mr-2" />
          {t('warmup.stopSession')}
        </Button>
      </CardContent>
    </Card>
  );
}
