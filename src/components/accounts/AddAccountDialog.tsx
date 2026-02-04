import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, onQRCode, onPairingCode, onAccountStatusChange } from '@/lib/api';
import QRCodeDisplay from './QRCodeDisplay';

interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountAdded: () => void;
}

export default function AddAccountDialog({ open, onOpenChange, onAccountAdded }: AddAccountDialogProps) {
  const { t } = useLanguage();
  const [step, setStep] = useState<'form' | 'qr'>('form');
  const [loading, setLoading] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [connectionMethod, setConnectionMethod] = useState<'qr' | 'code'>('qr');
  
  const [formData, setFormData] = useState({
    phone_number: '',
    name: '',
    proxy_host: '',
    proxy_port: '',
    proxy_username: '',
    proxy_password: '',
    proxy_type: 'http' as 'http' | 'socks5'
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionSuccess, setConnectionSuccess] = useState(false);

  // Listen for account status changes and auto-close when connected
  useEffect(() => {
    if (!accountId || !open || step !== 'qr') return;

    console.log('👂 Listening for account status changes for:', accountId);

    const cleanup = onAccountStatusChange((id, status) => {
      console.log('📡 Account status change:', id, '→', status);
      
      if (id === accountId) {
        if (status === 'connected') {
          console.log('✅ Account connected successfully - will close dialog');
          
          setConnectionSuccess(true);
          
          // Show success message
          toast.success(t('addAccount.connected'));
          
          // Close dialog after 2 seconds to show success animation
          setTimeout(() => {
            onAccountAdded(); // Reload accounts list
            handleClose();    // Close dialog
          }, 2000);
        } else if (status === 'connecting') {
          setIsConnecting(true);
        }
      }
    });

    return cleanup;
  }, [accountId, open, step]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create account
      const account = await api.accounts.create({
        phone_number: formData.phone_number,
        name: formData.name || undefined,
        proxy_host: formData.proxy_host || undefined,
        proxy_port: formData.proxy_port ? parseInt(formData.proxy_port) : undefined,
        proxy_username: formData.proxy_username || undefined,
        proxy_password: formData.proxy_password || undefined
      });

      setAccountId(account.id);

      // Listen for QR code or Pairing code
      const cleanupQR = onQRCode((id, qr) => {
        if (id === account.id) {
          setQrCode(qr);
        }
      });

      // Listen for pairing code
      const cleanupPairing = onPairingCode((id, code) => {
        if (id === account.id) {
          setPairingCode(code);
        }
      });

      // Connect account
      const proxy = formData.proxy_host ? {
        host: formData.proxy_host,
        port: parseInt(formData.proxy_port),
        username: formData.proxy_username || undefined,
        password: formData.proxy_password || undefined,
        type: 'http' as 'http' | 'socks5' // Always HTTP
      } : undefined;

      await api.accounts.connect(account.id, proxy, connectionMethod);

      setStep('qr');
      setLoading(false);

      // Cleanup listeners after a while
      setTimeout(() => {
        cleanupQR();
        cleanupPairing();
      }, 60000);

    } catch (error) {
      console.error('Failed to add account:', error);
      setLoading(false);
      toast.error(t('addAccount.errorAdd'));
    }
  };

  const handleClose = () => {
    setStep('form');
    setFormData({
      phone_number: '',
      name: '',
      proxy_host: '',
      proxy_port: '',
      proxy_username: '',
      proxy_password: '',
      proxy_type: 'http'
    });
    setQrCode('');
    setPairingCode('');
    setAccountId('');
    setConnectionMethod('qr');
    setIsConnecting(false);
    setConnectionSuccess(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {step === 'form' ? (
          <>
            <DialogHeader>
              <DialogTitle>{t('addAccount.title')}</DialogTitle>
              <DialogDescription>
                {t('addAccount.description')}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>{t('addAccount.connectionMethod')}</Label>
                <div className="flex gap-2 mt-2">
                  <Button
                    type="button"
                    variant={connectionMethod === 'qr' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setConnectionMethod('qr')}
                  >
                    {t('addAccount.qrCode')}
                  </Button>
                  <Button
                    type="button"
                    variant={connectionMethod === 'code' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setConnectionMethod('code')}
                  >
                    {t('addAccount.pairingCode')}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {connectionMethod === 'qr' 
                    ? t('addAccount.qrCodeHelper') 
                    : t('addAccount.pairingCodeHelper')}
                </p>
              </div>

              <div>
                <Label htmlFor="phone_number">{t('addAccount.phoneNumber')}</Label>
                <Input
                  id="phone_number"
                  required
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  placeholder={t('addAccount.phoneNumberPlaceholder')}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('addAccount.phoneNumberHelper')}
                </p>
              </div>

              <div>
                <Label htmlFor="name">{t('addAccount.accountName')}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('addAccount.accountNamePlaceholder')}
                />
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">{t('addAccount.proxySettings')}</h4>
                  <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded font-medium">
                    {t('addAccount.httpOnly')}
                  </span>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-3">
                  <p className="text-xs text-blue-900 dark:text-blue-100 font-medium mb-1">
                    {t('addAccount.proxySupported')}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    {t('addAccount.proxyExample')}
                  </p>
                </div>
                
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="proxy_host">{t('addAccount.proxyHost')}</Label>
                      <Input
                        id="proxy_host"
                        value={formData.proxy_host}
                        onChange={(e) => setFormData({ ...formData, proxy_host: e.target.value })}
                        placeholder={t('addAccount.proxyHostPlaceholder')}
                      />
                    </div>
                    <div>
                      <Label htmlFor="proxy_port">{t('addAccount.proxyPort')}</Label>
                      <Input
                        id="proxy_port"
                        type="number"
                        value={formData.proxy_port}
                        onChange={(e) => setFormData({ ...formData, proxy_port: e.target.value })}
                        placeholder={t('addAccount.proxyPortPlaceholder')}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="proxy_username">{t('addAccount.proxyUsername')}</Label>
                      <Input
                        id="proxy_username"
                        value={formData.proxy_username}
                        onChange={(e) => setFormData({ ...formData, proxy_username: e.target.value })}
                        placeholder={t('addAccount.proxyUsernamePlaceholder')}
                        autoComplete="off"
                      />
                      <p className="text-[10px] text-muted-foreground mt-0.5">{t('addAccount.proxyAuthHelper')}</p>
                    </div>
                    <div>
                      <Label htmlFor="proxy_password">{t('addAccount.proxyPassword')}</Label>
                      <Input
                        id="proxy_password"
                        type="password"
                        value={formData.proxy_password}
                        onChange={(e) => setFormData({ ...formData, proxy_password: e.target.value })}
                        placeholder={t('addAccount.proxyPasswordPlaceholder')}
                        autoComplete="off"
                      />
                      <p className="text-[10px] text-muted-foreground mt-0.5">{t('addAccount.proxyAuthHelper')}</p>
                    </div>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t('addAccount.connecting') : t('addAccount.connectButton')}
              </Button>
            </form>
          </>
        ) : connectionSuccess ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-center text-green-600 dark:text-green-400 flex items-center justify-center gap-2">
                <CheckCircle2 className="h-6 w-6" />
                {t('addAccount.connected')}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center space-y-4 py-8">
              <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400 animate-pulse" />
              </div>
              <p className="text-sm text-muted-foreground">
                {t('addAccount.closingAutomatically')}
              </p>
            </div>
          </>
        ) : (
          <QRCodeDisplay 
            qrCode={qrCode} 
            pairingCode={pairingCode}
            connectionMethod={connectionMethod}
            isConnecting={isConnecting}
            onClose={handleClose} 
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
