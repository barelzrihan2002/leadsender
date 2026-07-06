import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Terminal, Trash2, Download, Search, Filter, RefreshCw, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api';

interface LogEntry {
  timestamp: string;
  level: 'log' | 'info' | 'warn' | 'error';
  message: string;
}

export default function Logs() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [hasAccess, setHasAccess] = useState(true);
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    checkAccess();
  }, []);

  useEffect(() => {
    if (hasAccess) {
      loadLogs();
      const interval = setInterval(loadLogs, 2000); // Refresh every 2 seconds
      return () => clearInterval(interval);
    }
  }, [hasAccess]);

  const checkAccess = async () => {
    try {
      const licenseInfo = await api.license.check();
      const access = licenseInfo.logAccess === true;
      setHasAccess(access);
      
      if (!access) {
        console.warn('🔒 Log access denied for this user');
      }
    } catch (error) {
      console.error('Failed to check log access:', error);
      setHasAccess(false);
    } finally {
      setCheckingAccess(false);
    }
  };

  useEffect(() => {
    filterLogs();
  }, [logs, searchTerm, levelFilter]);

  useEffect(() => {
    if (autoScroll) {
      scrollToBottom();
    }
  }, [filteredLogs, autoScroll]);

  const loadLogs = async () => {
    try {
      const data = await window.electron.logs.get();
      setLogs(data);
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
  };

  const filterLogs = () => {
    let filtered = [...logs];

    // Filter by level
    if (levelFilter !== 'all') {
      filtered = filtered.filter(log => log.level === levelFilter);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredLogs(filtered);
  };

  const clearLogs = async () => {
    try {
      await window.electron.logs.clear();
      setLogs([]);
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  const downloadLogs = () => {
    const content = logs.map(log => 
      `[${new Date(log.timestamp).toLocaleString()}] [${log.level.toUpperCase()}] ${log.message}`
    ).join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leadsender-logs-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const scrollToBottom = () => {
    const logContainer = document.getElementById('log-container');
    if (logContainer) {
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'warn': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'info': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      default: return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error': return '❌';
      case 'warn': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📝';
    }
  };

  if (checkingAccess) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {language === 'he' ? 'בודק הרשאות...' : 'Checking permissions...'}
          </p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <div className="h-20 w-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="h-10 w-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">
            {language === 'he' ? 'אין גישה ללוגים' : language === 'ar' ? 'لا يمكن الوصول إلى السجلات' : 'No Access to Logs'}
          </h2>
          <p className="text-muted-foreground mb-6">
            {language === 'he' 
              ? 'תכונת הלוגים אינה זמינה עבור החשבון שלך. צור קשר עם התמיכה לקבלת גישה.'
              : language === 'ar'
              ? 'ميزة السجلات غير متاحة لحسابك. اتصل بالدعم للحصول على الوصول.'
              : 'Logs feature is not available for your account. Contact support for access.'
            }
          </p>
          <Button onClick={() => navigate('/dashboard')}>
            {language === 'he' ? 'חזרה לדף הבית' : language === 'ar' ? 'العودة إلى الصفحة الرئيسية' : 'Back to Dashboard'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Terminal className="h-8 w-8 text-primary" />
            {language === 'he' ? 'לוגים' : 'System Logs'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {language === 'he' ? 'מעקב אחר פעילות המערכת בזמן אמת' : 'Monitor system activity in real-time'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadLogs}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {language === 'he' ? 'רענן' : 'Refresh'}
          </Button>
          <Button variant="outline" size="sm" onClick={downloadLogs}>
            <Download className="h-4 w-4 mr-2" />
            {language === 'he' ? 'הורד' : 'Download'}
          </Button>
          <Button variant="outline" size="sm" onClick={clearLogs}>
            <Trash2 className="h-4 w-4 mr-2" />
            {language === 'he' ? 'נקה' : 'Clear'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4" />
            {language === 'he' ? 'מסננים' : 'Filters'}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={language === 'he' ? 'חפש בלוגים...' : 'Search logs...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select 
            value={levelFilter} 
            onChange={(e) => setLevelFilter(e.target.value)}
            className="w-[180px]"
          >
            <option value="all">{language === 'he' ? 'הכל' : 'All'}</option>
            <option value="log">{language === 'he' ? 'לוג' : 'Log'}</option>
            <option value="info">{language === 'he' ? 'מידע' : 'Info'}</option>
            <option value="warn">{language === 'he' ? 'אזהרה' : 'Warning'}</option>
            <option value="error">{language === 'he' ? 'שגיאה' : 'Error'}</option>
          </Select>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="auto-scroll"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="auto-scroll" className="text-sm">
              {language === 'he' ? 'גלילה אוטומטית' : 'Auto-scroll'}
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Logs Display */}
      <Card className="flex-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              {language === 'he' ? 'פלט מערכת' : 'System Output'}
            </CardTitle>
            <CardDescription>
              {filteredLogs.length} {language === 'he' ? 'רשומות' : 'entries'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div
            id="log-container"
            className="bg-black/95 text-green-400 font-mono text-sm p-4 rounded-lg h-[600px] overflow-y-auto space-y-1"
            style={{ 
              fontFamily: 'Consolas, Monaco, monospace',
              scrollbarWidth: 'thin',
              scrollbarColor: '#22c55e #1a1a1a'
            }}
          >
            {filteredLogs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                {language === 'he' ? 'אין לוגים להצגה' : 'No logs to display'}
              </div>
            ) : (
              filteredLogs.map((log, index) => (
                <div
                  key={index}
                  className={`p-2 rounded hover:bg-white/5 transition-colors ${
                    log.level === 'error' ? 'text-red-400' : 
                    log.level === 'warn' ? 'text-yellow-400' :
                    log.level === 'info' ? 'text-blue-400' :
                    'text-green-400'
                  }`}
                >
                  <span className="text-gray-500">
                    [{new Date(log.timestamp).toLocaleTimeString()}]
                  </span>{' '}
                  <Badge variant="outline" className={`${getLevelColor(log.level)} text-xs mr-2`}>
                    {getLevelIcon(log.level)} {log.level.toUpperCase()}
                  </Badge>
                  <span>{log.message}</span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
