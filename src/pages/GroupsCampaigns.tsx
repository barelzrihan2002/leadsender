import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import GroupCampaignList from '@/components/campaigns/GroupCampaignList';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import type { GroupCampaign } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';

export default function GroupsCampaigns() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<GroupCampaign[]>([]);
  const [groupCounts, setGroupCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; campaignId: string | null }>({
    open: false,
    campaignId: null,
  });

  useEffect(() => {
    void loadCampaigns();

    const handler = () => void loadCampaigns();
    window.electron?.on?.('groupCampaign:progress', handler);
    return () => {
      window.electron?.removeListener?.('groupCampaign:progress', handler);
    };
  }, []);

  const loadCampaigns = async () => {
    try {
      const data = await api.groupCampaigns.getAll();
      setCampaigns(data);

      const counts = new Map<string, number>();
      await Promise.all(
        data.map(async (campaign) => {
          try {
            const targets = await api.groupCampaigns.getTargets(campaign.id);
            counts.set(campaign.id, targets.length);
          } catch {
            counts.set(campaign.id, 0);
          }
        })
      );
      setGroupCounts(counts);
    } catch (error) {
      console.error('Failed to load group campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async (id: string) => {
    try {
      await api.groupCampaigns.start(id);
      setCampaigns(prev => prev.map(c => (c.id === id ? { ...c, status: 'active' } : c)));
      toast.success(language === 'he' ? 'הקמפיין הופעל' : language === 'ar' ? 'تم تشغيل الحملة' : 'Campaign started');
    } catch (error) {
      console.error('Failed to start group campaign:', error);
      toast.error(language === 'he' ? 'שגיאה בהפעלת הקמפיין' : language === 'ar' ? 'فشل تشغيل الحملة' : 'Failed to start campaign');
    }
  };

  const handlePause = async (id: string) => {
    try {
      await api.groupCampaigns.pause(id);
      setCampaigns(prev => prev.map(c => (c.id === id ? { ...c, status: 'paused' } : c)));
      toast.success(language === 'he' ? 'הקמפיין הושהה' : language === 'ar' ? 'تم إيقاف الحملة مؤقتاً' : 'Campaign paused');
    } catch (error) {
      console.error('Failed to pause group campaign:', error);
      toast.error(language === 'he' ? 'שגיאה בהשהיית הקמפיין' : language === 'ar' ? 'فشل إيقاف الحملة' : 'Failed to pause campaign');
    }
  };

  const handleStop = async (id: string) => {
    try {
      await api.groupCampaigns.stop(id);
      setCampaigns(prev => prev.map(c => (c.id === id ? { ...c, status: 'stopped' } : c)));
      toast.success(language === 'he' ? 'הקמפיין הופסק' : language === 'ar' ? 'تم إيقاف الحملة' : 'Campaign stopped');
    } catch (error) {
      console.error('Failed to stop group campaign:', error);
      toast.error(language === 'he' ? 'שגיאה בעצירת הקמפיין' : language === 'ar' ? 'فشل إيقاف الحملة' : 'Failed to stop campaign');
    }
  };

  const handleDeleteClick = (id: string) => {
    setConfirmDialog({ open: true, campaignId: id });
  };

  const handleEdit = (id: string) => {
    navigate(`/groups-campaigns/edit/${id}`);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDialog.campaignId) return;
    const id = confirmDialog.campaignId;

    try {
      await api.groupCampaigns.delete(id);
      setCampaigns(prev => prev.filter(c => c.id !== id));
      toast.success(language === 'he' ? 'הקמפיין נמחק' : language === 'ar' ? 'تم حذف الحملة' : 'Campaign deleted');
    } catch (error) {
      console.error('Failed to delete group campaign:', error);
      toast.error(language === 'he' ? 'שגיאה במחיקת הקמפיין' : language === 'ar' ? 'فشل حذف الحملة' : 'Failed to delete campaign');
    } finally {
      setConfirmDialog({ open: false, campaignId: null });
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {language === 'he' ? 'קמפייני קבוצות' : language === 'ar' ? 'حملات المجموعات' : 'Groups Campaigns'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'he'
              ? 'פרסום מתוזמן וחוזר להודעות/מדיה בקבוצות וואטסאפ'
              : language === 'ar'
              ? 'نشر مجدول ومتكرر للرسائل/الوسائط في مجموعات واتساب'
              : 'Scheduled, recurring broadcasts of messages/media to WhatsApp groups'}
          </p>
        </div>
        <Button onClick={() => navigate('/groups-campaigns/create')}>
          <Plus className="h-4 w-4 mr-2" />
          {language === 'he' ? 'קמפיין חדש' : language === 'ar' ? 'حملة جديدة' : 'New campaign'}
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground mb-4">
            {language === 'he' ? 'אין עדיין קמפייני קבוצות' : language === 'ar' ? 'لا توجد حملات مجموعات بعد' : 'No group campaigns yet'}
          </p>
          <Button onClick={() => navigate('/groups-campaigns/create')}>
            <Plus className="h-4 w-4 mr-2" />
            {language === 'he' ? 'צור קמפיין ראשון' : language === 'ar' ? 'أنشئ أول حملة' : 'Create your first campaign'}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {campaigns.map((campaign) => (
            <GroupCampaignList
              key={campaign.id}
              campaign={campaign}
              groupCount={groupCounts.get(campaign.id) || 0}
              onStart={() => handleStart(campaign.id)}
              onPause={() => handlePause(campaign.id)}
              onStop={() => handleStop(campaign.id)}
              onDelete={() => handleDeleteClick(campaign.id)}
              onEdit={() => handleEdit(campaign.id)}
            />
          ))}
        </div>
      )}

      {confirmDialog.open && (
        <ConfirmDialog
          key={`delete-${confirmDialog.campaignId}`}
          open={confirmDialog.open}
          onOpenChange={(open) => setConfirmDialog({ open, campaignId: null })}
          onConfirm={handleDeleteConfirm}
          title={language === 'he' ? 'למחוק קמפיין?' : language === 'ar' ? 'حذف الحملة؟' : 'Delete campaign?'}
          description={language === 'he' ? 'פעולה זו אינה הפיכה.' : language === 'ar' ? 'هذا الإجراء غير قابل للتراجع.' : 'This action cannot be undone.'}
          confirmText={language === 'he' ? 'מחק' : language === 'ar' ? 'حذف' : 'Delete'}
          cancelText={language === 'he' ? 'ביטול' : language === 'ar' ? 'إلغاء' : 'Cancel'}
          variant="destructive"
        />
      )}
    </div>
  );
}
