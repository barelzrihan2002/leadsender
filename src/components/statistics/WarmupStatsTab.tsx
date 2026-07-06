import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Account, StatsResult } from '@/types';
import StatsFilters from './StatsFilters';
import StatsSummaryCards from './StatsSummaryCards';
import StatsDailyChart from './StatsDailyChart';
import StatsTable, { StatsTableColumn } from './StatsTable';

function getDefaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

const EMPTY_RESULT: StatsResult = { summary: { total: 0, sent: 0, failed: 0, successRate: 0 }, daily: [], rows: [] };

export default function WarmupStatsTab() {
  const { language } = useLanguage();
  const defaultRange = getDefaultRange();
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [result, setResult] = useState<StatsResult>(EMPTY_RESULT);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.accounts.getAll().then(setAccounts).catch(() => {});
  }, []);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.stats.getWarmupStats(startDate, endDate, accountId || undefined);
      setResult(data);
    } catch (error) {
      console.error('Failed to load warmup stats:', error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, accountId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const filePath = await api.stats.exportReport('warmup', startDate, endDate, accountId || undefined);
      if (filePath) {
        const msg = language === 'he' ? 'הדוח יוצא בהצלחה!' : language === 'ar' ? 'تم تصدير التقرير بنجاح!' : 'Report exported successfully!';
        toast.success(msg);
        api.shell?.showItemInFolder(filePath);
      }
    } catch (error) {
      console.error('Failed to export report:', error);
      toast.error(language === 'he' ? 'שגיאה בייצוא הדוח' : language === 'ar' ? 'فشل تصدير التقرير' : 'Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  const columns: StatsTableColumn[] = [
    { key: 'from_account_name', label: language === 'he' ? 'מאת' : language === 'ar' ? 'من' : 'From', render: (r) => r.from_account_name || r.from_account_phone || '-' },
    { key: 'to_account_name', label: language === 'he' ? 'אל' : language === 'ar' ? 'إلى' : 'To', render: (r) => r.to_account_name || r.to_account_phone || '-' },
    { key: 'message_text', label: language === 'he' ? 'הודעה' : language === 'ar' ? 'الرسالة' : 'Message', render: (r) => r.message_text || '-' },
    {
      key: 'sent_at',
      label: language === 'he' ? 'תאריך ושעה' : language === 'ar' ? 'التاريخ والوقت' : 'Date & Time',
      render: (r) => (r.sent_at ? new Date(r.sent_at).toLocaleString() : '-'),
    },
  ];

  return (
    <div className="space-y-4">
      <StatsFilters
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        accounts={accounts}
        accountId={accountId}
        onAccountChange={setAccountId}
        showCampaignFilter={false}
        onExport={handleExport}
        exporting={exporting}
      />

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          {language === 'he' ? 'טוען...' : language === 'ar' ? 'جارٍ التحميل...' : 'Loading...'}
        </div>
      ) : (
        <>
          <StatsSummaryCards summary={result.summary} />
          <StatsDailyChart data={result.daily} />
          <StatsTable columns={columns} rows={result.rows} />
        </>
      )}
    </div>
  );
}
