import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import type { StatsSummary } from '@/types';
import { CheckCircle2, XCircle, Percent, Layers } from 'lucide-react';

interface StatsSummaryCardsProps {
  summary: StatsSummary;
}

export default function StatsSummaryCards({ summary }: StatsSummaryCardsProps) {
  const { language } = useLanguage();

  const labels = {
    total: language === 'he' ? 'סה"כ' : language === 'ar' ? 'الإجمالي' : 'Total',
    sent: language === 'he' ? 'נשלחו בהצלחה' : language === 'ar' ? 'أُرسلت بنجاح' : 'Sent',
    failed: language === 'he' ? 'נכשלו' : language === 'ar' ? 'فشلت' : 'Failed',
    successRate: language === 'he' ? 'אחוז הצלחה' : language === 'ar' ? 'معدل النجاح' : 'Success Rate',
  };

  const cards = [
    { label: labels.total, value: summary.total, icon: Layers, color: 'text-blue-500' },
    { label: labels.sent, value: summary.sent, icon: CheckCircle2, color: 'text-green-500' },
    { label: labels.failed, value: summary.failed, icon: XCircle, color: 'text-red-500' },
    { label: labels.successRate, value: `${summary.successRate}%`, icon: Percent, color: 'text-purple-500' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
            <card.icon className={`h-5 w-5 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
