import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Power, PowerOff, Edit, Trash2, Workflow } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/components/ui/use-toast';
import type { Flow, Account } from '@/types';

export default function FlowBuilder() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFlows();
    loadAccounts();
  }, []);

  const loadFlows = async () => {
    try {
      const data = await window.electron.flows.getAll();
      setFlows(data);
    } catch (error) {
      console.error('Failed to load flows:', error);
      toast.error(t('toast.error'));
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      const data = await window.electron.accounts.getAll();
      setAccounts(data);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };

  const handleToggleActive = async (flowId: string) => {
    try {
      await window.electron.flows.toggleActive(flowId);
      await loadFlows();
      toast.success(t('toast.success'));
    } catch (error) {
      console.error('Failed to toggle flow:', error);
      toast.error(t('toast.error'));
    }
  };

  const handleDelete = async (flowId: string) => {
    if (!confirm(t('flows.deleteConfirm'))) return;
    
    try {
      await window.electron.flows.delete(flowId);
      await loadFlows();
      toast.success(t('toast.success'));
    } catch (error) {
      console.error('Failed to delete flow:', error);
      toast.error(t('toast.error'));
    }
  };

  const handleCreateNew = () => {
    navigate('/flows/new');
  };

  const handleEdit = (flowId: string) => {
    navigate(`/flows/${flowId}`);
  };

  const getAccountNames = (accountIds: string[]) => {
    if (!accountIds || accountIds.length === 0) return language === 'he' ? 'כל החשבונות' : language === 'ar' ? 'جميع الحسابات' : 'All Accounts';
    
    const names = accountIds
      .map(id => accounts.find(a => a.id === id)?.name || accounts.find(a => a.id === id)?.phone_number)
      .filter(Boolean);
    
    return names.length > 0 ? names.join(', ') : '-';
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{t('flows.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('flows.subtitle')}</p>
        </div>
        <Button onClick={handleCreateNew}>
          <Plus className="h-4 w-4 mr-2" />
          {t('flows.createNew')}
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          {language === 'he' ? 'טוען...' : language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
        </div>
      ) : flows.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Workflow className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('flows.noFlows')}</h3>
            <Button onClick={handleCreateNew} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              {t('flows.createNew')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {flows.map((flow) => (
            <Card key={flow.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {flow.name}
                      <Badge variant={flow.is_active ? 'default' : 'secondary'} className="ml-2">
                        {flow.is_active ? t('flows.activeFlow') : t('flows.inactiveFlow')}
                      </Badge>
                    </CardTitle>
                    {flow.description && (
                      <CardDescription className="mt-1">{flow.description}</CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm">
                  <span className="text-muted-foreground">
                    {t('flows.selectAccounts')}:
                  </span>
                  <p className="font-medium mt-1">{getAccountNames(flow.account_ids)}</p>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => handleEdit(flow.id)}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    {t('common.edit')}
                  </Button>
                  <Button
                    size="sm"
                    variant={flow.is_active ? 'destructive' : 'default'}
                    onClick={() => handleToggleActive(flow.id)}
                  >
                    {flow.is_active ? (
                      <>
                        <PowerOff className="h-3 w-3 mr-1" />
                        {language === 'he' ? 'השבת' : language === 'ar' ? 'تعطيل' : 'Disable'}
                      </>
                    ) : (
                      <>
                        <Power className="h-3 w-3 mr-1" />
                        {language === 'he' ? 'הפעל' : language === 'ar' ? 'تفعيل' : 'Enable'}
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(flow.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
