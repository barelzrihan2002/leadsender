import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Play, Pause, Square, Trash2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Campaign, CampaignStats } from '@/types';

interface CampaignListProps {
  campaign: Campaign;
  stats: CampaignStats;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onDelete: () => void;
}

export default function CampaignList({
  campaign,
  stats,
  onStart,
  onPause,
  onStop,
  onDelete
}: CampaignListProps) {
  const { t, language } = useLanguage();
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'completed':
        return 'bg-blue-500';
      case 'stopped':
        return 'bg-gray-500';
      default:
        return 'bg-gray-300';
    }
  };

  const progress = stats.total > 0 ? (stats.sent / stats.total) * 100 : 0;

  return (
    <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <CardTitle>{campaign.name}</CardTitle>
                {campaign.scheduled_start_datetime && campaign.status === 'draft' && (
                  <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 text-xs">
                    {language === 'he' ? '📅 מתוזמן' : language === 'ar' ? '📅 مجدولة' : '📅 Scheduled'}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {campaign.message.substring(0, 100)}
                {campaign.message.length > 100 ? '...' : ''}
              </p>
              {campaign.scheduled_start_datetime && campaign.status === 'draft' && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 font-medium">
                  {t('createCampaign.scheduling.scheduledFor').replace('{datetime}', new Date(campaign.scheduled_start_datetime).toLocaleString(language === 'he' ? 'he-IL' : language === 'ar' ? 'ar-SA' : 'en-US'))}
                </p>
              )}
            </div>
            <Badge className={getStatusColor(campaign.status)}>
              {t(`campaigns.${campaign.status}`)}
            </Badge>
          </div>
        </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span>{language === 'he' ? 'התקדמות' : 'Progress'}</span>
              <span className="text-muted-foreground">
                {stats.sent} / {stats.total} {language === 'he' ? 'נשלחו' : 'sent'}
              </span>
            </div>
            <Progress value={progress} />
          </div>

          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">{language === 'he' ? 'נשלחו' : 'Sent'}</p>
              <p className="font-semibold text-green-600">{stats.sent}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{language === 'he' ? 'ממתינות' : 'Pending'}</p>
              <p className="font-semibold text-yellow-600">{stats.pending}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{language === 'he' ? 'נכשלו' : 'Failed'}</p>
              <p className="font-semibold text-red-600">{stats.failed}</p>
            </div>
          </div>

          <div className="flex gap-2">
            {campaign.status === 'draft' || campaign.status === 'paused' ? (
              <Button size="sm" onClick={onStart}>
                <Play className="h-4 w-4 mr-1" />
                {t('campaigns.start')}
              </Button>
            ) : campaign.status === 'running' ? (
              <Button size="sm" variant="outline" onClick={onPause}>
                <Pause className="h-4 w-4 mr-1" />
                {t('campaigns.pause')}
              </Button>
            ) : null}

            {campaign.status !== 'completed' && campaign.status !== 'stopped' && (
              <Button size="sm" variant="outline" onClick={onStop}>
                <Square className="h-4 w-4 mr-1" />
                {t('campaigns.stop')}
              </Button>
            )}

            <Button size="sm" variant="destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4 mr-1" />
              {t('campaigns.delete')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
