import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Wifi, WifiOff, Trash2, Globe, Smartphone, MoreVertical } from 'lucide-react';
import { formatDistance } from 'date-fns';
import { he, ar } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Account } from '@/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AccountCardProps {
  account: Account;
  onDelete: () => void;
  onDisconnect: () => void;
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
  selectionMode?: boolean;
}

export default function AccountCard({ account, onDelete, onDisconnect, isSelected, onSelect, selectionMode }: AccountCardProps) {
  const { t, language } = useLanguage();
  const isConnected = account.status === 'connected';

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500/10 text-green-600 border-green-200';
      case 'connecting':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-200';
      case 'qr':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'disconnected':
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return t('accounts.connected');
      case 'connecting': return t('accounts.connecting');
      case 'qr': return language === 'he' ? 'סרוק QR' : 'Scan QR';
      default: return t('accounts.disconnected');
    }
  };

  return (
    <Card className={`group hover:shadow-md transition-all duration-300 border-muted/60 ${isSelected ? 'ring-2 ring-primary' : ''}`}>
      <CardContent className="p-0">
        {/* Header Background */}
        <div className={`h-24 w-full bg-gradient-to-r ${isConnected ? 'from-green-500/10 to-emerald-500/10' : 'from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900'} relative`}>
          {selectionMode && (
            <div className="absolute top-4 left-4">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => onSelect?.(e.target.checked)}
                className="h-5 w-5 rounded border-2 border-white shadow-sm cursor-pointer accent-primary"
              />
            </div>
          )}
          <div className="absolute top-4 right-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 bg-white/50 backdrop-blur-sm hover:bg-white/80 rounded-full">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isConnected && (
                  <DropdownMenuItem onClick={onDisconnect} className="text-orange-600">
                    <WifiOff className="mr-2 h-4 w-4" /> Disconnect
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={onDelete} className="text-red-600">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="px-6 pb-6 -mt-10">
          {/* Avatar / Icon */}
          <div className="flex justify-between items-end mb-4">
            {account.profile_picture_url ? (
              <img
                src={account.profile_picture_url}
                alt={account.name || 'WhatsApp Account'}
                className="h-20 w-20 rounded-full border-4 border-background shadow-lg object-cover bg-white"
                onError={(e) => {
                  // אם התמונה לא נטענת, הסתר אותה והצג את האייקון
                  e.currentTarget.style.display = 'none';
                  const iconDiv = e.currentTarget.nextElementSibling as HTMLElement;
                  if (iconDiv) iconDiv.style.display = 'flex';
                }}
              />
            ) : null}
            <div 
              className={`h-20 w-20 rounded-full flex items-center justify-center border-4 border-background shadow-sm ${isConnected ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'} ${account.profile_picture_url ? 'hidden' : ''}`}
            >
              <Smartphone className="h-10 w-10" />
            </div>
            
            <Badge variant="outline" className={`px-3 py-1 ${getStatusColor(account.status)}`}>
              {isConnected && <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2 animate-pulse" />}
              {getStatusText(account.status)}
            </Badge>
          </div>

          {/* Info */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold truncate">{account.name || (language === 'he' ? 'חשבון ווטסאפ' : 'WhatsApp Account')}</h3>
              <p className="text-sm text-muted-foreground truncate">{account.phone_number}</p>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t">
              {account.proxy_host && (
                <div className="flex items-center text-xs text-muted-foreground bg-muted/50 p-2 rounded-md">
                  <Globe className="h-3 w-3 mr-2 text-primary" />
                  <span className="truncate">{account.proxy_host}:{account.proxy_port}</span>
                </div>
              )}
              
              {account.last_seen && (
                <p className="text-xs text-muted-foreground flex items-center justify-end mt-1">
                  {language === 'he' ? 'נראה לאחרונה ' : language === 'ar' ? 'آخر ظهور ' : 'Last seen '}
                  {formatDistance(new Date(account.last_seen), new Date(), { 
                    addSuffix: true,
                    locale: language === 'he' ? he : language === 'ar' ? ar : undefined
                  })}
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
