import { Handle, Position } from 'reactflow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { Ban } from 'lucide-react';

export default function ActionBlacklistNode({ isConnectable }: any) {
  const { t } = useLanguage();

  return (
    <Card className="w-[200px] border-0 shadow-md rounded-md overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700 bg-white dark:bg-slate-900">
      <div className="absolute top-0 left-0 w-full h-[2px] bg-red-600" />
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="!bg-red-600 !w-2 !h-2 !border !border-white" />

      <CardHeader className="p-2 pb-1.5 bg-red-50/50 dark:bg-red-900/10 border-b border-red-100 dark:border-red-900/20">
        <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-red-700 dark:text-red-300">
          <Ban className="h-3 w-3" />
          {t('flows.blacklist')}
        </CardTitle>
      </CardHeader>

      <CardContent className="p-2 space-y-1.5">
        <p className="text-[10px] text-muted-foreground leading-tight">
          {t('flows.blacklistDescription')}
        </p>

        <div className="pt-1.5 flex justify-center pb-1">
          <Handle
            type="source"
            position={Position.Bottom}
            isConnectable={isConnectable}
            className="!bg-red-600 !w-2 !h-2 !border !border-white"
          />
        </div>
      </CardContent>
    </Card>
  );
}
