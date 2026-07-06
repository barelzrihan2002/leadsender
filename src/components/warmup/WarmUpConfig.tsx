import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Play, CheckSquare, Square } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/lib/api';
import type { Account } from '@/types';

interface WarmUpConfigProps {
  onStart: (accountIds: string[], minDelay: number, maxDelay: number) => void;
}

export default function WarmUpConfig({ onStart }: WarmUpConfigProps) {
  const { t } = useLanguage();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [minDelay, setMinDelay] = useState(600); // 10 minutes (recommended)
  const [maxDelay, setMaxDelay] = useState(1800); // 30 minutes (recommended)

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    const data = await api.accounts.getAll();
    setAccounts(data.filter(acc => acc.status === 'connected'));
  };

  const toggleAccount = (accountId: string) => {
    setSelectedAccounts(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedAccounts.length === accounts.length) {
      setSelectedAccounts([]);
    } else {
      setSelectedAccounts(accounts.map(acc => acc.id));
    }
  };

  const handleStart = () => {
    if (selectedAccounts.length < 2) {
      toast.warning('Please select at least 2 accounts');
      return;
    }
    onStart(selectedAccounts, minDelay, maxDelay);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('warmup.configure')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>{t('warmup.selectAccounts')}</Label>
            {accounts.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleSelectAll}
                className="h-7 text-xs gap-1.5"
              >
                {selectedAccounts.length === accounts.length ? (
                  <>
                    <CheckSquare className="h-3.5 w-3.5" />
                    {t('common.deselectAll')}
                  </>
                ) : (
                  <>
                    <Square className="h-3.5 w-3.5" />
                    {t('common.selectAll')}
                  </>
                )}
              </Button>
            )}
          </div>
          <div className="border rounded-md p-3 space-y-2 max-h-60 overflow-y-auto">
            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('accounts.noAccounts')}</p>
            ) : (
              <>
                <div className="text-xs text-muted-foreground mb-2">
                  {selectedAccounts.length} {t('common.of')} {accounts.length} {t('warmup.selected')}
                </div>
                {accounts.map(account => (
                  <label key={account.id} className="flex items-center gap-2 cursor-pointer hover:bg-accent/50 p-2 rounded transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedAccounts.includes(account.id)}
                      onChange={() => toggleAccount(account.id)}
                      className="h-4 w-4 accent-primary cursor-pointer"
                    />
                    <span className="text-sm flex-1">{account.name || account.phone_number}</span>
                    <Badge variant="outline" className="text-xs">
                      {account.status === 'connected' ? '🟢' : '⚫'}
                    </Badge>
                  </label>
                ))}
              </>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="min_delay">{t('warmup.minDelay')}</Label>
              <Input
                id="min_delay"
                type="number"
                value={minDelay}
                onChange={(e) => setMinDelay(parseInt(e.target.value))}
                min={300}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {Math.floor(minDelay / 60)} {t('warmup.minutes')}
              </p>
            </div>
            <div>
              <Label htmlFor="max_delay">{t('warmup.maxDelay')}</Label>
              <Input
                id="max_delay"
                type="number"
                value={maxDelay}
                onChange={(e) => setMaxDelay(parseInt(e.target.value))}
                min={300}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {Math.floor(maxDelay / 60)} {t('warmup.minutes')}
              </p>
            </div>
          </div>
          
          <div className="bg-muted/50 p-3 rounded-lg text-xs space-y-1">
            <p className="font-medium text-foreground">{t('warmup.smartLimits')}</p>
            <p>• {t('warmup.maxMessages')}</p>
            <p>• {t('warmup.activeHours')}</p>
            <p>• {t('warmup.parallelWork')}</p>
            <p>• {t('warmup.autoReset')}</p>
          </div>
        </div>

        <Button
          onClick={handleStart}
          disabled={selectedAccounts.length < 2}
          className="w-full"
        >
          <Play className="h-4 w-4 mr-2" />
          {t('warmup.startSession')}
        </Button>
      </CardContent>
    </Card>
  );
}
