import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Send, MessageSquare, Clock, Plus, Zap, BarChart3, ArrowUpRight } from 'lucide-react';
import StatsCard from '@/components/dashboard/StatsCard';
import RecentActivity from '@/components/dashboard/RecentActivity';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/lib/api';
import type { DashboardStats, Activity } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function Dashboard() {
  const navigate = useNavigate();
  const { t, language, dir } = useLanguage();
  const [stats, setStats] = useState<DashboardStats>({
    accounts_connected: 0,
    messages_sent_today: 0,
    active_campaigns: 0,
    pending_messages: 0
  });

  const [activities, setActivities] = useState<(Activity & { timestamp: Date })[]>([]);

  useEffect(() => {
    loadStats();
    loadActivities();

    const statsInterval = setInterval(loadStats, 10000);
    const activitiesInterval = setInterval(loadActivities, 3000); // Refresh every 3 seconds
    return () => {
      clearInterval(statsInterval);
      clearInterval(activitiesInterval);
    };
  }, []);

  const loadStats = async () => {
    try {
      const data = await api.stats.getDashboard();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadActivities = async () => {
    try {
      const data = await api.stats.getRecentActivities(4);
      // Convert timestamp strings to Date objects
      const formattedActivities = data.map(activity => ({
        ...activity,
        timestamp: new Date(activity.timestamp)
      }));
      setActivities(formattedActivities);
    } catch (error) {
      console.error('Failed to load activities:', error);
    }
  };

  return (
    <div className="space-y-8 p-2">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            {t('dashboard')}
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            {t('dashboard.welcome')}
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => navigate('/campaigns/create')} className="shadow-md hover:shadow-lg transition-all">
            <Plus className="mr-2 h-4 w-4" /> {t('dashboard.newCampaign')}
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title={t('dashboard.connectedAccounts')}
          value={stats.accounts_connected}
          icon={Users}
          description={language === 'he' ? 'חשבונות ווטסאפ פעילים' : 'Active WhatsApp accounts'}
          className={dir === 'rtl' ? 'border-r-4 border-r-blue-500' : 'border-l-4 border-l-blue-500'}
        />
        <StatsCard
          title={t('dashboard.messagesSentToday')}
          value={stats.messages_sent_today}
          icon={Send}
          description={language === 'he' ? 'סך הודעות שנשלחו' : 'Total messages sent'}
          className={dir === 'rtl' ? 'border-r-4 border-r-green-500' : 'border-l-4 border-l-green-500'}
        />
        <StatsCard
          title={t('dashboard.activeCampaigns')}
          value={stats.active_campaigns}
          icon={Zap}
          description={language === 'he' ? 'רצים כרגע' : 'Currently running'}
          className={dir === 'rtl' ? 'border-r-4 border-r-yellow-500' : 'border-l-4 border-l-yellow-500'}
        />
        <StatsCard
          title={t('dashboard.pendingMessages')}
          value={stats.pending_messages}
          icon={Clock}
          description={language === 'he' ? 'ממתינות לשליחה' : 'Waiting to be sent'}
          className={dir === 'rtl' ? 'border-r-4 border-r-purple-500' : 'border-l-4 border-l-purple-500'}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-7 lg:grid-cols-7">
        
        {/* Activity Feed - Takes 4 columns */}
        <div className="md:col-span-4 lg:col-span-4 h-full">
          <RecentActivity activities={activities} />
        </div>
        
        {/* Quick Actions & Tips - Takes 3 columns */}
        <div className="md:col-span-3 lg:col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.quickActions')}</CardTitle>
              <CardDescription>{language === 'he' ? 'משימות נפוצות שכדאי לבצע' : 'Common tasks you might want to perform'}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Button 
                variant="outline" 
                className="w-full justify-start h-12 hover:bg-primary/10 hover:text-primary dark:hover:bg-primary/20 border-l-4 hover:border-l-primary transition-all"
                onClick={() => navigate('/accounts')}
              >
                <Users className="mr-3 h-5 w-5" />
                {t('dashboard.addNewAccount')}
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start h-12 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/20 border-l-4 hover:border-l-green-500 transition-all"
                onClick={() => navigate('/campaigns/create')}
              >
                <Send className="mr-3 h-5 w-5" />
                {t('dashboard.createCampaign')}
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start h-12 hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-900/20 border-l-4 hover:border-l-purple-500 transition-all"
                onClick={() => navigate('/contacts')}
              >
                <Users className="mr-3 h-5 w-5" />
                {t('dashboard.importContacts')}
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start h-12 hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-900/20 border-l-4 hover:border-l-orange-50 transition-all"
                onClick={() => navigate('/warmup')}
              >
                <Zap className="mr-3 h-5 w-5" />
                {t('dashboard.startWarmup')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
