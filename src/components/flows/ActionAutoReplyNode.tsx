import { Handle, Position, useReactFlow } from 'reactflow';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { MessageSquare } from 'lucide-react';

export default function ActionAutoReplyNode({ id, data, isConnectable }: any) {
  const { t } = useLanguage();
  const { setNodes } = useReactFlow();

  const updateData = (newData: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: { ...node.data, ...newData }
          };
        }
        return node;
      })
    );
  };

  const handleInputInteraction = (e: React.MouseEvent | React.PointerEvent | React.TouchEvent) => {
    e.stopPropagation();
  };

  return (
    <Card className="w-[240px] border-0 shadow-md rounded-md overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700 bg-white dark:bg-slate-900">
      <div className="absolute top-0 left-0 w-full h-[2px] bg-emerald-500" />
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="!bg-emerald-500 !w-2 !h-2 !border !border-white" />

      <CardHeader className="p-2 pb-1.5 bg-emerald-50/50 dark:bg-emerald-900/10 border-b border-emerald-100 dark:border-emerald-900/20">
        <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
          <MessageSquare className="h-3 w-3" />
          {t('flows.autoReply')}
        </CardTitle>
      </CardHeader>

      <CardContent className="p-2 space-y-1.5">
        <div
          className="nodrag nopan nowheel"
          onMouseDown={handleInputInteraction}
          onPointerDown={handleInputInteraction}
          onTouchStart={handleInputInteraction}
        >
          <Textarea
            value={data.message || ''}
            onChange={(e) => updateData({ message: e.target.value })}
            placeholder={t('flows.enterMessage')}
            rows={3}
            className="text-[11px] leading-tight bg-slate-50 dark:bg-slate-950 border-slate-200 focus-visible:ring-emerald-500 resize-none min-h-[4rem]"
          />
        </div>

        <div className="pt-2 flex justify-center pb-1">
          <Handle
            type="source"
            position={Position.Bottom}
            isConnectable={isConnectable}
            className="!bg-emerald-500 !w-2 !h-2 !border !border-white"
          />
        </div>
      </CardContent>
    </Card>
  );
}
