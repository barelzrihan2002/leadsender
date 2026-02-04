import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface QRCodeDisplayProps {
  qrCode: string;
  pairingCode: string;
  connectionMethod: 'qr' | 'code';
  isConnecting?: boolean;
  onClose: () => void;
}

export default function QRCodeDisplay({ qrCode, pairingCode, connectionMethod, isConnecting, onClose }: QRCodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(pairingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <DialogHeader>
        <div className="flex items-center justify-between">
          <DialogTitle>
            {connectionMethod === 'qr' ? 'Scan QR Code' : 'Enter Pairing Code'}
          </DialogTitle>
          {isConnecting && (
            <span className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-medium">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
              Connecting...
            </span>
          )}
        </div>
        <DialogDescription>
          {connectionMethod === 'qr' 
            ? 'Open WhatsApp on your phone and scan this QR code'
            : 'Open WhatsApp on your phone and enter this pairing code'}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col items-center space-y-4">
        {connectionMethod === 'qr' ? (
          // QR Code Display
          qrCode ? (
            <>
              <img src={qrCode} alt="QR Code" className="w-64 h-64 border-4 border-primary/20 rounded-xl p-2" />
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground text-center">
                  <strong className="block text-foreground mb-2">How to scan:</strong>
                  1. Open WhatsApp on your phone
                  <br />
                  2. Tap Menu or Settings and select <strong>Linked Devices</strong>
                  <br />
                  3. Tap on <strong>Link a Device</strong>
                  <br />
                  4. Point your phone to this screen to capture the code
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center space-y-3 py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="text-sm text-muted-foreground">Generating QR code...</p>
            </div>
          )
        ) : (
          // Pairing Code Display
          pairingCode ? (
            <>
              <div className="bg-primary/10 border-2 border-primary/30 rounded-xl p-8 w-full">
                <div className="flex items-center justify-center gap-3">
                  <span className="text-5xl font-mono font-bold text-primary tracking-wider">
                    {pairingCode}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={handleCopy}
                    className="h-10 w-10"
                  >
                    {copied ? <Check className="h-5 w-5 text-green-600" /> : <Copy className="h-5 w-5" />}
                  </Button>
                </div>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg w-full">
                <p className="text-sm text-muted-foreground text-center">
                  <strong className="block text-foreground mb-2">How to enter code:</strong>
                  1. Open WhatsApp on your phone
                  <br />
                  2. Tap Menu or Settings and select <strong>Linked Devices</strong>
                  <br />
                  3. Tap on <strong>Link a Device</strong>
                  <br />
                  4. Select <strong>Link with phone number</strong>
                  <br />
                  5. Enter this code: <strong className="text-primary">{pairingCode}</strong>
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center space-y-3 py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="text-sm text-muted-foreground">Generating pairing code...</p>
            </div>
          )
        )}

        <Button onClick={onClose} className="w-full">
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Done
        </Button>
      </div>
    </>
  );
}
