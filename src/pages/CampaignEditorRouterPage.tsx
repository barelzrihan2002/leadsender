import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CreateCampaignPage from './CreateCampaignPage';
import CreateGroupAdderCampaignPage from './CreateGroupAdderCampaignPage';
import { api } from '@/lib/api';
import type { Campaign } from '@/types';
import { toast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

export default function CampaignEditorRouterPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadCampaign();
  }, [id]);

  async function loadCampaign() {
    if (!id) {
      navigate('/campaigns');
      return;
    }

    try {
      const campaignData = await api.campaigns.getById(id);
      if (!campaignData) {
        toast.error(language === 'he' ? 'קמפיין לא נמצא' : language === 'ar' ? 'الحملة غير موجودة' : 'Campaign not found');
        navigate('/campaigns');
        return;
      }

      setCampaign(campaignData);
    } catch (error) {
      console.error('Failed to load campaign editor:', error);
      toast.error(language === 'he' ? 'שגיאה בטעינת הקמפיין' : language === 'ar' ? 'فشل تحميل الحملة' : 'Failed to load campaign');
      navigate('/campaigns');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!campaign) {
    return null;
  }

  if ((campaign.campaign_type || 'message') === 'group_adder') {
    return <CreateGroupAdderCampaignPage />;
  }

  return <CreateCampaignPage />;
}
