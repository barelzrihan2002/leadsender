import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import type { StatsDailyPoint } from '@/types';

interface StatsDailyChartProps {
  data: StatsDailyPoint[];
}

export default function StatsDailyChart({ data }: StatsDailyChartProps) {
  const { language } = useLanguage();

  const title = language === 'he' ? 'הודעות לפי יום' : language === 'ar' ? 'الرسائل حسب اليوم' : 'Messages Per Day';
  const sentLabel = language === 'he' ? 'נשלחו' : language === 'ar' ? 'أُرسلت' : 'Sent';
  const failedLabel = language === 'he' ? 'נכשלו' : language === 'ar' ? 'فشلت' : 'Failed';

  const formattedData = data.map((d) => ({
    ...d,
    label: new Date(d.date + 'T00:00:00').toLocaleDateString(language === 'he' ? 'he-IL' : language === 'ar' ? 'ar' : 'en-US', {
      month: 'short',
      day: 'numeric',
    }),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="label" fontSize={12} tickLine={false} />
              <YAxis allowDecimals={false} fontSize={12} tickLine={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="sent" name={sentLabel} fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="failed" name={failedLabel} fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
