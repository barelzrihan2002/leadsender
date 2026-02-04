import { useEffect, useState } from 'react';
import { Plus, Users, ShieldCheck, Edit, Image, CheckSquare, Square, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import AccountCard from '@/components/accounts/AccountCard';
import AddAccountDialog from '@/components/accounts/AddAccountDialog';
import { api, onAccountStatusChange } from '@/lib/api';
import type { Account } from '@/types';

export default function Accounts() {
  const { t } = useLanguage();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [showBulkUpdateDialog, setShowBulkUpdateDialog] = useState(false);
  const [bulkUpdateName, setBulkUpdateName] = useState('');
  const [bulkUpdateImage, setBulkUpdateImage] = useState<File | null>(null);
  const [refreshingPictures, setRefreshingPictures] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    accountId: string | null;
  }>({ open: false, accountId: null });
  const [refreshDialog, setRefreshDialog] = useState(false);

  useEffect(() => {
    loadAccounts();

    // Listen for account status changes
    const cleanup = onAccountStatusChange((accountId, status) => {
      setAccounts(prev => prev.map(acc => 
        acc.id === accountId ? { ...acc, status: status as any } : acc
      ));
    });

    return cleanup;
  }, []);

  const loadAccounts = async () => {
    try {
      const data = await api.accounts.getAll();
      setAccounts(data);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (accountId: string) => {
    setDeleteDialog({ open: true, accountId });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.accountId) return;

    const accountIdToDelete = deleteDialog.accountId;

    try {
      await api.accounts.delete(accountIdToDelete);
      setAccounts(prev => prev.filter(acc => acc.id !== accountIdToDelete));
      toast.success(t('toast.accountDeleted'));
    } catch (error) {
      console.error('Failed to delete account:', error);
      toast.error(t('accounts.failedToDelete'));
    } finally {
      // Ensure dialog state is cleared
      setDeleteDialog({ open: false, accountId: null });
    }
  };

  const handleDisconnect = async (accountId: string) => {
    try {
      await api.accounts.disconnect(accountId);
      toast.success('Account disconnected');
    } catch (error) {
      console.error('Failed to disconnect account:', error);
      toast.error('Failed to disconnect account');
    }
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedAccountIds(new Set());
  };

  const toggleSelectAll = () => {
    if (selectedAccountIds.size === accounts.length) {
      setSelectedAccountIds(new Set());
    } else {
      setSelectedAccountIds(new Set(accounts.map(a => a.id)));
    }
  };

  const toggleAccountSelection = (accountId: string, selected: boolean) => {
    const newSet = new Set(selectedAccountIds);
    if (selected) {
      newSet.add(accountId);
    } else {
      newSet.delete(accountId);
    }
    setSelectedAccountIds(newSet);
  };

  const handleBulkUpdate = async () => {
    if (selectedAccountIds.size === 0) {
      toast.warning(t('accounts.selectAtLeastOne'));
      return;
    }

    setShowBulkUpdateDialog(true);
  };

  const executeBulkUpdate = async () => {
    if (!bulkUpdateName && !bulkUpdateImage) {
      toast.warning(t('accounts.enterNameOrImage'));
      return;
    }

    try {
      const selectedIds = Array.from(selectedAccountIds);
      
      for (const accountId of selectedIds) {
        // Update name if provided
        if (bulkUpdateName.trim()) {
          await api.accounts.updateWhatsAppName(accountId, bulkUpdateName.trim());
        }
        
        // Update image if provided
        if (bulkUpdateImage) {
          const arrayBuffer = await bulkUpdateImage.arrayBuffer();
          const buffer = new Uint8Array(arrayBuffer);
          const tempFilePath = await api.messages.saveTempFile(bulkUpdateImage.name, buffer as any);
          await api.accounts.updateWhatsAppImage(accountId, tempFilePath);
          await api.messages.deleteTempFile(tempFilePath);
        }
      }

      toast.success(`Successfully updated ${selectedIds.length} account(s)`);
      setShowBulkUpdateDialog(false);
      setBulkUpdateName('');
      setBulkUpdateImage(null);
      setSelectionMode(false);
      setSelectedAccountIds(new Set());
    } catch (error) {
      console.error('Failed to bulk update:', error);
      toast.error('Failed to update accounts');
    }
  };

  const handleRefreshAllProfilePicturesClick = () => {
    const connectedAccounts = accounts.filter(acc => acc.status === 'connected');
    
    if (connectedAccounts.length === 0) {
      toast.warning(t('accounts.noConnectedToRefresh'));
      return;
    }

    setRefreshDialog(true);
  };

  const handleRefreshAllProfilePicturesConfirm = async () => {
    const connectedAccounts = accounts.filter(acc => acc.status === 'connected');
    setRefreshingPictures(true);

    try {
      for (const account of connectedAccounts) {
        await api.accounts.refreshProfilePicture(account.id);
      }

      // Reload accounts to show updated pictures
      await loadAccounts();
      
      toast.success(t('accounts.successfullyRefreshed').replace('{count}', connectedAccounts.length.toString()));
    } catch (error) {
      console.error('Failed to refresh profile pictures:', error);
      toast.error(t('accounts.failedToRefreshPictures'));
    } finally {
      setRefreshingPictures(false);
      // Ensure dialog state is cleared
      setRefreshDialog(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-2">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            {t('accounts.title')}
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            {t('accounts.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          {accounts.length > 0 && (
            <>
              <Button 
                onClick={handleRefreshAllProfilePicturesClick}
                size="lg" 
                variant="outline"
                disabled={refreshingPictures || accounts.filter(a => a.status === 'connected').length === 0}
                className="shadow-lg hover:shadow-xl transition-all"
              >
                {refreshingPictures ? (
                  <>
                    <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                    {t('accounts.refreshing')}
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-5 w-5 mr-2" />
                    {t('accounts.refreshPictures')}
                  </>
                )}
              </Button>
              <Button 
                onClick={toggleSelectionMode} 
                size="lg" 
                variant={selectionMode ? "default" : "outline"}
                className="shadow-lg hover:shadow-xl transition-all"
              >
                <CheckSquare className="h-5 w-5 mr-2" />
                {selectionMode ? t('accounts.cancelSelection') : t('accounts.bulkUpdate')}
              </Button>
            </>
          )}
          <Button onClick={() => setShowAddDialog(true)} size="lg" className="shadow-lg hover:shadow-xl transition-all">
            <Plus className="h-5 w-5 mr-2" />
            {t('accounts.connectNewAccount')}
          </Button>
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectionMode && (
        <div className="bg-primary/10 dark:bg-primary/20 border border-primary/30 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSelectAll}
              className="gap-2"
            >
              {selectedAccountIds.size === accounts.length ? (
                <CheckSquare className="h-4 w-4" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              {selectedAccountIds.size === accounts.length ? t('common.deselectAll') : t('common.selectAll')}
            </Button>
            <span className="text-sm font-medium text-primary">
              {t('accounts.selectedCount').replace('{selected}', selectedAccountIds.size.toString()).replace('{total}', accounts.length.toString())}
            </span>
          </div>
          <Button
            onClick={handleBulkUpdate}
            disabled={selectedAccountIds.size === 0}
            className="gap-2"
          >
            <Edit className="h-4 w-4" />
            {t('accounts.updateSelected')}
          </Button>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-primary/10 dark:bg-primary/20 p-4 rounded-xl border border-primary/20 dark:border-primary/30 flex items-center gap-3">
          <div className="p-2 bg-primary/20 dark:bg-primary/30 rounded-lg">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-primary dark:text-primary">{t('accounts.totalAccounts')}</p>
            <p className="text-2xl font-bold text-primary dark:text-primary">{accounts.length}</p>
          </div>
        </div>
        
        <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-xl border border-green-100 dark:border-green-900/50 flex items-center gap-3">
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <ShieldCheck className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-green-900 dark:text-green-100">{t('accounts.activeSessions')}</p>
            <p className="text-2xl font-bold text-green-700 dark:text-green-300">
              {accounts.filter(a => a.status === 'connected').length}
            </p>
          </div>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed border-muted-foreground/20 rounded-2xl bg-muted/5 mt-8">
          <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mb-6">
            <Users className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <h3 className="text-xl font-semibold mb-2">{t('accounts.noAccounts')}</h3>
          <p className="text-muted-foreground mb-8 text-center max-w-sm">
            {t('accounts.noAccountsDescription')}
          </p>
          <Button onClick={() => setShowAddDialog(true)} size="lg">
            <Plus className="h-5 w-5 mr-2" />
            {t('accounts.addFirstAccount')}
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-6">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onDelete={() => handleDeleteClick(account.id)}
              onDisconnect={() => handleDisconnect(account.id)}
              selectionMode={selectionMode}
              isSelected={selectedAccountIds.has(account.id)}
              onSelect={(selected) => toggleAccountSelection(account.id, selected)}
            />
          ))}
        </div>
      )}

      {/* Bulk Update Dialog */}
      <Dialog open={showBulkUpdateDialog} onOpenChange={setShowBulkUpdateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('accounts.bulkUpdateTitle')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('accounts.bulkUpdateDescription').replace('{count}', selectedAccountIds.size.toString())}
            </p>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('accounts.whatsappDisplayName')}</label>
              <Input
                placeholder={t('accounts.enterNewDisplayName')}
                value={bulkUpdateName}
                onChange={(e) => setBulkUpdateName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t('accounts.leaveEmptyNames')}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('accounts.profilePicture')}</label>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setBulkUpdateImage(e.target.files?.[0] || null)}
                  className="cursor-pointer"
                />
              </div>
              {bulkUpdateImage && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <Image className="h-3 w-3" />
                  {bulkUpdateImage.name}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {t('accounts.leaveEmptyPictures')}
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowBulkUpdateDialog(false);
                  setBulkUpdateName('');
                  setBulkUpdateImage(null);
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={executeBulkUpdate}
                disabled={!bulkUpdateName.trim() && !bulkUpdateImage}
              >
                {t('accounts.updateAccountsButton').replace('{count}', selectedAccountIds.size.toString())}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AddAccountDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onAccountAdded={loadAccounts}
      />

      {deleteDialog.open && (
        <ConfirmDialog
          key={`delete-${deleteDialog.accountId}`}
          open={deleteDialog.open}
          onOpenChange={(open) => setDeleteDialog({ open, accountId: null })}
          onConfirm={handleDeleteConfirm}
          title={t('accounts.deleteAccount')}
          description={t('accounts.deleteConfirm')}
          confirmText={t('common.delete')}
          cancelText={t('common.cancel')}
          variant="destructive"
        />
      )}

      {refreshDialog && (
        <ConfirmDialog
          key="refresh-pictures"
          open={refreshDialog}
          onOpenChange={setRefreshDialog}
          onConfirm={handleRefreshAllProfilePicturesConfirm}
          title={t('accounts.refreshPicturesTitle')}
          description={t('accounts.refreshConfirm').replace('{count}', accounts.filter(acc => acc.status === 'connected').length.toString())}
          confirmText={t('common.refresh')}
          cancelText={t('common.cancel')}
          variant="default"
        />
      )}
    </div>
  );
}
