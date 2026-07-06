import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Play, Pause, Square, Trash2, Download, Edit } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/components/ui/use-toast';
import type { Campaign, CampaignStats } from '@/types';

interface CampaignListProps {
  campaign: Campaign;
  stats: CampaignStats;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

async function handleExport(campaignId: string, campaignName: string, t: any, language: string) {
  try {
    const filePath = await window.electron.campaigns.exportReport(campaignId);
    
    if (!filePath) {
      // User canceled
      return;
    }
    
    // Show success message
    const message = language === 'he' 
      ? 'הדוח יוצא בהצלחה!' 
      : language === 'ar' 
      ? 'تم تصدير التقرير بنجاح!' 
      : 'Report exported successfully!';
    
    toast.success(message);
    
    // Open file location
    if (window.electron.shell) {
      window.electron.shell.showItemInFolder(filePath);
    }
  } catch (error) {
    console.error('Failed to export report:', error);
    toast.error(t('toast.error'));
  }
}

export default function CampaignList({
  campaign,
  stats,
  onStart,
  onPause,
  onStop,
  onDelete,
  onEdit
}: CampaignListProps) {
  const { t, language } = useLanguage();
  const isGroupAdder = (campaign.campaign_type || 'message') === 'group_adder';
  const canEdit = ['draft', 'paused', 'stopped'].includes(campaign.status);
  const canStartOrContinue = ['draft', 'paused', 'stopped'].includes(campaign.status);
  const startButtonLabel = campaign.status === 'draft'
    ? t('campaigns.start')
    : t('campaigns.continue');
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
  const previewText = isGroupAdder
    ? (language === 'he'
        ? `הוספת אנשי קשר לקבוצה ${campaign.target_group_name || campaign.target_group_id || ''}`
        : language === 'ar'
        ? `إضافة جهات اتصال إلى المجموعة ${campaign.target_group_name || campaign.target_group_id || ''}`
        : `Add contacts to ${campaign.target_group_name || campaign.target_group_id || 'selected group'}`)
    : `${campaign.message.substring(0, 100)}${campaign.message.length > 100 ? '...' : ''}`;
  const successLabel = isGroupAdder
    ? (language === 'he' ? 'נוספו' : language === 'ar' ? 'تمت إضافتهم' : 'added')
    : (language === 'he' ? 'נשלחו' : 'sent');

  return (
    <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <CardTitle>{campaign.name}</CardTitle>
                <Badge variant="outline" className={isGroupAdder ? 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300' : ''}>
                  {isGroupAdder
                    ? (language === 'he' ? 'Group Adder' : language === 'ar' ? 'إضافة مجموعة' : 'Group Adder')
                    : (language === 'he' ? 'Message' : language === 'ar' ? 'رسائل' : 'Message')}
                </Badge>
                {campaign.scheduled_start_datetime && campaign.status === 'draft' && (
                  <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 text-xs">
                    {language === 'he' ? '📅 מתוזמן' : language === 'ar' ? '📅 مجدولة' : '📅 Scheduled'}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {previewText}
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
                {stats.sent} / {stats.total} {successLabel}
              </span>
            </div>
            <Progress value={progress} />
          </div>

          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">{isGroupAdder ? (language === 'he' ? 'נוספו' : language === 'ar' ? 'تمت إضافتهم' : 'Added') : (language === 'he' ? 'נשלחו' : 'Sent')}</p>
              <p className="font-semibold text-green-600">{stats.sent}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{language === 'he' ? 'ממתינות' : language === 'ar' ? 'قيد الانتظار' : 'Pending'}</p>
              <p className="font-semibold text-yellow-600">{stats.pending}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{language === 'he' ? 'נכשלו' : language === 'ar' ? 'فشلت' : 'Failed'}</p>
              <p className="font-semibold text-red-600">{stats.failed}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              {canStartOrContinue ? (
              <Button size="sm" onClick={onStart}>
                <Play className="h-4 w-4 mr-1" />
                {startButtonLabel}
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

            {canEdit && (
              <Button size="sm" variant="outline" onClick={onEdit} className="border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-800 dark:hover:bg-blue-900/20">
                <Edit className="h-4 w-4 mr-1" />
                {language === 'he' ? 'ערוך' : language === 'ar' ? 'تحرير' : 'Edit'}
              </Button>
            )}

            <Button size="sm" variant="destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4 mr-1" />
              {t('campaigns.delete')}
            </Button>
            </div>
            
            {/* Export Report Button - always visible */}
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => handleExport(campaign.id, campaign.name, t, language)}
              className="w-full border-dashed border-primary/30 hover:border-primary hover:bg-primary/5"
            >
              <Download className="h-4 w-4 mr-2" />
              {t('campaigns.downloadReport')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
