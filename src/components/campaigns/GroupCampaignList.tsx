import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, Pause, Square, Trash2, Edit, ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/lib/api';
import type { GroupCampaign, GroupCampaignRun } from '@/types';

interface GroupCampaignListProps {
  campaign: GroupCampaign;
  groupCount: number;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

const DAY_LABELS: Record<'he' | 'ar' | 'en', string[]> = {
  he: ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'],
  ar: ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

function getStatusColor(status: string) {
  switch (status) {
    case 'active':
      return 'bg-green-500';
    case 'paused':
      return 'bg-yellow-500';
    case 'stopped':
      return 'bg-gray-500';
    default:
      return 'bg-gray-300';
  }
}

export default function GroupCampaignList({
  campaign,
  groupCount,
  onStart,
  onPause,
  onStop,
  onDelete,
  onEdit,
}: GroupCampaignListProps) {
  const { language } = useLanguage();
  const dayLabels = DAY_LABELS[language as 'he' | 'ar' | 'en'] || DAY_LABELS.en;
  const [expanded, setExpanded] = useState(false);
  const [runs, setRuns] = useState<GroupCampaignRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);

  const timeLabel = `${String(campaign.send_hour).padStart(2, '0')}:${String(campaign.send_minute).padStart(2, '0')}`;

  const statusLabel = campaign.status === 'active'
    ? (language === 'he' ? 'פעיל' : language === 'ar' ? 'نشط' : 'Active')
    : campaign.status === 'paused'
    ? (language === 'he' ? 'מושהה' : language === 'ar' ? 'متوقف مؤقتاً' : 'Paused')
    : (language === 'he' ? 'הופסק' : language === 'ar' ? 'متوقف' : 'Stopped');

  async function toggleHistory() {
    if (expanded) {
      setExpanded(false);
      return;
    }

    setExpanded(true);
    setLoadingRuns(true);
    try {
      const data = await api.groupCampaigns.getRuns(campaign.id);
      setRuns(data);
    } catch (error) {
      console.error('Failed to load group campaign runs:', error);
    } finally {
      setLoadingRuns(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle>{campaign.name}</CardTitle>
              <Badge variant="outline" className="border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-300">
                {language === 'he' ? 'Groups Campaign' : language === 'ar' ? 'حملة مجموعات' : 'Groups Campaign'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {language === 'he'
                ? `${groupCount} קבוצות · בשעה ${timeLabel}`
                : language === 'ar'
                ? `${groupCount} مجموعات · الساعة ${timeLabel}`
                : `${groupCount} group(s) · at ${timeLabel}`}
            </p>
            <div className="flex gap-1 mt-2">
              {dayLabels.map((label, index) => (
                <span
                  key={index}
                  className={`text-xs px-2 py-0.5 rounded-full border ${
                    campaign.days_of_week.includes(index)
                      ? 'bg-primary/10 border-primary/30 text-primary font-medium'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  {label}
                </span>
              ))}
            </div>
            {campaign.last_run_date && (
              <p className="text-xs text-muted-foreground mt-2">
                {language === 'he' ? 'ריצה אחרונה: ' : language === 'ar' ? 'آخر تشغيل: ' : 'Last run: '}
                {campaign.last_run_date}
              </p>
            )}
          </div>
          <Badge className={getStatusColor(campaign.status)}>{statusLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {campaign.status !== 'active' ? (
              <Button size="sm" onClick={onStart}>
                <Play className="h-4 w-4 mr-1" />
                {language === 'he' ? 'הפעל' : language === 'ar' ? 'تشغيل' : 'Start'}
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={onPause}>
                <Pause className="h-4 w-4 mr-1" />
                {language === 'he' ? 'השהה' : language === 'ar' ? 'إيقاف مؤقت' : 'Pause'}
              </Button>
            )}

            {campaign.status !== 'stopped' && (
              <Button size="sm" variant="outline" onClick={onStop}>
                <Square className="h-4 w-4 mr-1" />
                {language === 'he' ? 'עצור' : language === 'ar' ? 'إيقاف' : 'Stop'}
              </Button>
            )}

            <Button size="sm" variant="outline" onClick={onEdit} className="border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-800 dark:hover:bg-blue-900/20">
              <Edit className="h-4 w-4 mr-1" />
              {language === 'he' ? 'ערוך' : language === 'ar' ? 'تحرير' : 'Edit'}
            </Button>

            <Button size="sm" variant="destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4 mr-1" />
              {language === 'he' ? 'מחק' : language === 'ar' ? 'حذف' : 'Delete'}
            </Button>
          </div>

          <Button size="sm" variant="ghost" className="w-full justify-between" onClick={toggleHistory}>
            <span>{language === 'he' ? 'היסטוריית פרסומים' : language === 'ar' ? 'سجل النشر' : 'Post history'}</span>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>

          {expanded && (
            <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
              {loadingRuns ? (
                <div className="p-3 text-sm text-muted-foreground text-center">
                  {language === 'he' ? 'טוען...' : language === 'ar' ? 'جار التحميل...' : 'Loading...'}
                </div>
              ) : runs.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground text-center">
                  {language === 'he' ? 'אין היסטוריה עדיין' : language === 'ar' ? 'لا يوجد سجل بعد' : 'No history yet'}
                </div>
              ) : (
                runs.map((run) => (
                  <div key={run.id} className="p-2.5 text-sm flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{run.group_name || run.group_id}</p>
                      <p className="text-xs text-muted-foreground">
                        {run.run_date} · {new Date(run.sent_at).toLocaleTimeString()}
                      </p>
                      {run.status === 'failed' && run.error && (
                        <p className="text-xs text-red-500 truncate">{run.error}</p>
                      )}
                    </div>
                    <Badge variant="outline" className={run.status === 'sent' ? 'text-green-700 border-green-300' : 'text-red-700 border-red-300'}>
                      {run.status === 'sent'
                        ? (language === 'he' ? 'נשלח' : language === 'ar' ? 'أُرسل' : 'Sent')
                        : (language === 'he' ? 'נכשל' : language === 'ar' ? 'فشل' : 'Failed')}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
