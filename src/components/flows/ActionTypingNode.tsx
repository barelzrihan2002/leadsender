import { Handle, Position, useReactFlow } from 'reactflow';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { MessageCircle } from 'lucide-react';

export default function ActionTypingNode({ id, data, isConnectable }: any) {
  const { t, language } = useLanguage();
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
    <Card className="w-[200px] border-0 shadow-md rounded-md overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700 bg-white dark:bg-slate-900">
      <div className="absolute top-0 left-0 w-full h-[2px] bg-purple-500" />
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="!bg-purple-500 !w-2 !h-2 !border !border-white" />
      
      <CardHeader className="p-2 pb-1.5 bg-purple-50/50 dark:bg-purple-900/10 border-b border-purple-100 dark:border-purple-900/20">
        <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-purple-700 dark:text-purple-300">
          <MessageCircle className="h-3 w-3" />
          {t('flows.typing')}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-2 space-y-1.5">
        
        <div 
          className="nodrag nopan nowheel"
          onMouseDown={handleInputInteraction}
          onPointerDown={handleInputInteraction}
          onTouchStart={handleInputInteraction}
        >
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <Label className="text-[8px] uppercase text-muted-foreground font-semibold mb-0.5 block">{t('flows.minSeconds')}</Label>
              <Input 
                type="number"
                min={1}
                value={data.min || 1}
                onChange={(e) => updateData({ min: parseInt(e.target.value) || 1 })}
                className="text-xs h-7 bg-slate-50 dark:bg-slate-950 border-slate-200 focus-visible:ring-purple-500"
              />
            </div>
            <div>
              <Label className="text-[8px] uppercase text-muted-foreground font-semibold mb-0.5 block">{t('flows.maxSeconds')}</Label>
              <Input 
                type="number"
                min={1}
                value={data.max || 3}
                onChange={(e) => updateData({ max: parseInt(e.target.value) || 3 })}
                className="text-xs h-7 bg-slate-50 dark:bg-slate-950 border-slate-200 focus-visible:ring-purple-500"
              />
            </div>
          </div>
        </div>
        
        <div className="pt-2 flex justify-center pb-1">
          <Handle 
            type="source" 
            position={Position.Bottom} 
            isConnectable={isConnectable}
            className="!bg-purple-500 !w-2 !h-2 !border !border-white"
          />
        </div>
      </CardContent>
    </Card>
  );
}
