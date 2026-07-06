import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Account, StatsListItem } from '@/types';

interface StatsFiltersProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  accounts: Account[];
  accountId: string;
  onAccountChange: (value: string) => void;
  campaigns?: StatsListItem[];
  campaignId?: string;
  onCampaignChange?: (value: string) => void;
  showCampaignFilter?: boolean;
  onExport: () => void;
  exporting?: boolean;
}

export default function StatsFilters({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  accounts,
  accountId,
  onAccountChange,
  campaigns,
  campaignId,
  onCampaignChange,
  showCampaignFilter = true,
  onExport,
  exporting = false,
}: StatsFiltersProps) {
  const { language } = useLanguage();

  const labels = {
    from: language === 'he' ? 'מתאריך' : language === 'ar' ? 'من تاريخ' : 'From',
    to: language === 'he' ? 'עד תאריך' : language === 'ar' ? 'إلى تاريخ' : 'To',
    account: language === 'he' ? 'חשבון' : language === 'ar' ? 'الحساب' : 'Account',
    campaign: language === 'he' ? 'קמפיין' : language === 'ar' ? 'الحملة' : 'Campaign',
    allAccounts: language === 'he' ? 'כל החשבונות' : language === 'ar' ? 'كل الحسابات' : 'All Accounts',
    allCampaigns: language === 'he' ? 'כל הקמפיינים' : language === 'ar' ? 'كل الحملات' : 'All Campaigns',
    exportReport: language === 'he' ? 'הורד דוח מפורט' : language === 'ar' ? 'تنزيل تقرير مفصل' : 'Download Detailed Report',
    exporting: language === 'he' ? 'מייצא...' : language === 'ar' ? 'جارٍ التصدير...' : 'Exporting...',
  };

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">{labels.from}</Label>
        <input
          type="date"
          value={startDate}
          max={endDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">{labels.to}</Label>
        <input
          type="date"
          value={endDate}
          min={startDate}
          max={new Date().toISOString().split('T')[0]}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        />
      </div>

      <div className="flex flex-col gap-1.5 min-w-[180px]">
        <Label className="text-xs text-muted-foreground">{labels.account}</Label>
        <Select value={accountId} onChange={(e) => onAccountChange(e.target.value)}>
          <option value="">{labels.allAccounts}</option>
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name || acc.phone_number}
            </option>
          ))}
        </Select>
      </div>

      {showCampaignFilter && campaigns && onCampaignChange && (
        <div className="flex flex-col gap-1.5 min-w-[180px]">
          <Label className="text-xs text-muted-foreground">{labels.campaign}</Label>
          <Select value={campaignId} onChange={(e) => onCampaignChange(e.target.value)}>
            <option value="">{labels.allCampaigns}</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="flex-1" />

      <Button onClick={onExport} disabled={exporting} className="gap-2">
        <Download className="h-4 w-4" />
        {exporting ? labels.exporting : labels.exportReport}
      </Button>
    </div>
  );
}
