import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import CampaignsStatsTab from '@/components/statistics/CampaignsStatsTab';
import GroupsCampaignStatsTab from '@/components/statistics/GroupsCampaignStatsTab';
import WarmupStatsTab from '@/components/statistics/WarmupStatsTab';
import GroupAdderStatsTab from '@/components/statistics/GroupAdderStatsTab';

type TabKey = 'campaigns' | 'groupsCampaigns' | 'warmup' | 'groupAdder';

export default function Statistics() {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabKey>('campaigns');

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'campaigns', label: language === 'he' ? 'קמפיינים' : language === 'ar' ? 'الحملات' : 'Campaigns' },
    { key: 'groupsCampaigns', label: language === 'he' ? 'קמפייני קבוצות' : language === 'ar' ? 'حملات المجموعات' : 'Groups Campaigns' },
    { key: 'warmup', label: language === 'he' ? 'חימום' : language === 'ar' ? 'التحمية' : 'Warm-up' },
    { key: 'groupAdder', label: language === 'he' ? 'הוספה לקבוצות' : language === 'ar' ? 'إضافة للمجموعات' : 'Group Adder' },
  ];

  const title = language === 'he' ? 'סטטיסטיקות מפורטות' : language === 'ar' ? 'إحصائيات مفصلة' : 'Detailed Statistics';
  const subtitle = language === 'he'
    ? 'עקוב אחר ביצועי ההודעות שלך לפי טווח תאריכים'
    : language === 'ar'
    ? 'تتبع أداء رسائلك حسب النطاق الزمني'
    : 'Track your messaging performance over a date range';

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>

      <div className="flex gap-2 border-b overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'campaigns' && <CampaignsStatsTab />}
        {activeTab === 'groupsCampaigns' && <GroupsCampaignStatsTab />}
        {activeTab === 'warmup' && <WarmupStatsTab />}
        {activeTab === 'groupAdder' && <GroupAdderStatsTab />}
      </div>
    </div>
  );
}
