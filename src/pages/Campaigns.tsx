import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CampaignList from '@/components/campaigns/CampaignList';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/use-toast';
import { api, onCampaignProgress } from '@/lib/api';
import type { Campaign, CampaignStats } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Campaigns() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignStats, setCampaignStats] = useState<Map<string, CampaignStats>>(new Map());
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    campaignId: string | null;
  }>({ open: false, campaignId: null });

  useEffect(() => {
    loadCampaigns();

    // Listen for campaign progress updates
    const cleanup = onCampaignProgress((campaignId, progress) => {
      loadCampaignStats(campaignId);
    });

    return cleanup;
  }, []);

  const loadCampaigns = async () => {
    try {
      const data = await api.campaigns.getAll();
      setCampaigns(data);

      // Load stats for each campaign
      for (const campaign of data) {
        loadCampaignStats(campaign.id);
      }
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCampaignStats = async (campaignId: string) => {
    try {
      const stats = await api.campaigns.getStats(campaignId);
      setCampaignStats(prev => new Map(prev).set(campaignId, stats));
    } catch (error) {
      console.error('Failed to load campaign stats:', error);
    }
  };

  const handleStart = async (campaignId: string) => {
    try {
      await api.campaigns.start(campaignId);
      setCampaigns(prev => prev.map(c => 
        c.id === campaignId ? { ...c, status: 'running' as any } : c
      ));
      toast.success(t('toast.campaignStarted'));
    } catch (error) {
      console.error('Failed to start campaign:', error);
      toast.error('Failed to start campaign');
    }
  };

  const handlePause = async (campaignId: string) => {
    try {
      await api.campaigns.pause(campaignId);
      setCampaigns(prev => prev.map(c => 
        c.id === campaignId ? { ...c, status: 'paused' as any } : c
      ));
      toast.success(t('toast.campaignPaused'));
    } catch (error) {
      console.error('Failed to pause campaign:', error);
      toast.error('Failed to pause campaign');
    }
  };

  const handleStop = async (campaignId: string) => {
    try {
      await api.campaigns.stop(campaignId);
      setCampaigns(prev => prev.map(c => 
        c.id === campaignId ? { ...c, status: 'stopped' as any } : c
      ));
      toast.success(t('toast.campaignStopped'));
    } catch (error) {
      console.error('Failed to stop campaign:', error);
      toast.error('Failed to stop campaign');
    }
  };

  const handleDeleteClick = (campaignId: string) => {
    setConfirmDialog({ open: true, campaignId });
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDialog.campaignId) return;

    const campaignIdToDelete = confirmDialog.campaignId;

    try {
      await api.campaigns.delete(campaignIdToDelete);
      setCampaigns(prev => prev.filter(c => c.id !== campaignIdToDelete));
      toast.success(t('toast.campaignDeleted'));
    } catch (error) {
      console.error('Failed to delete campaign:', error);
      toast.error('Failed to delete campaign');
    } finally {
      // Ensure dialog state is cleared
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
          <h1 className="text-3xl font-bold">{t('campaigns.title')}</h1>
          <p className="text-muted-foreground">
            {t('campaigns.subtitle')}
          </p>
        </div>
        <Button onClick={() => navigate('/campaigns/create')}>
          <Plus className="h-4 w-4 mr-2" />
          {t('campaigns.createCampaign')}
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground mb-4">{t('campaigns.noCampaigns')}</p>
          <Button onClick={() => navigate('/campaigns/create')}>
            <Plus className="h-4 w-4 mr-2" />
            {t('campaigns.createFirst')}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {campaigns.map((campaign) => (
            <CampaignList
              key={campaign.id}
              campaign={campaign}
              stats={campaignStats.get(campaign.id) || { total: 0, sent: 0, pending: 0, failed: 0 }}
              onStart={() => handleStart(campaign.id)}
              onPause={() => handlePause(campaign.id)}
              onStop={() => handleStop(campaign.id)}
              onDelete={() => handleDeleteClick(campaign.id)}
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
          title={`${t('campaigns.delete')} Campaign?`}
          description={t('campaigns.deleteConfirm')}
          confirmText={t('campaigns.delete')}
          cancelText={t('common.cancel')}
          variant="destructive"
        />
      )}
    </div>
  );
}
