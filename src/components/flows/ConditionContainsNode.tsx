import { Handle, Position, useReactFlow } from 'reactflow';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { Search } from 'lucide-react';

export default function ConditionContainsNode({ id, data, isConnectable }: any) {
  const { t } = useLanguage();
  const { setNodes } = useReactFlow();
  
  const handleTextChange = (newText: string) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: { ...node.data, text: newText }
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
    <Card className="w-[220px] border-0 shadow-md rounded-md overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700 bg-white dark:bg-slate-900">
      <div className="absolute top-0 left-0 w-full h-[2px] bg-blue-500" />
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="!bg-blue-500 !w-2 !h-2 !border !border-white" />
      
      <CardHeader className="p-2 pb-1.5 bg-blue-50/50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/20">
        <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
          <Search className="h-3 w-3" />
          {t('flows.ifContains')}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-2 space-y-1.5">
        <div 
          className="nodrag nopan nowheel"
          onMouseDown={handleInputInteraction}
          onPointerDown={handleInputInteraction}
          onTouchStart={handleInputInteraction}
        >
          <Input 
            value={data.text || ''}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder={t('flows.enterText')}
            className="text-xs h-7 bg-slate-50 dark:bg-slate-950 border-slate-200 focus-visible:ring-blue-500"
          />
        </div>
        
        <div className="flex justify-between items-center pt-2 relative">
          <div className="flex flex-col items-center">
            <span className="text-[8px] font-semibold uppercase text-green-600 dark:text-green-400 mb-0.5 bg-green-50 dark:bg-green-900/20 px-1 py-[1px] rounded-full">
              {t('flows.yes')}
            </span>
            <Handle 
              type="source" 
              position={Position.Bottom} 
              id="yes"
              style={{ left: '25%', bottom: '-6px' }}
              isConnectable={isConnectable}
              className="!bg-green-500 !w-2 !h-2 !border !border-white"
            />
          </div>
          
          <div className="flex flex-col items-center">
            <span className="text-[8px] font-semibold uppercase text-red-600 dark:text-red-400 mb-0.5 bg-red-50 dark:bg-red-900/20 px-1 py-[1px] rounded-full">
              {t('flows.no')}
            </span>
            <Handle 
              type="source" 
              position={Position.Bottom} 
              id="no"
              style={{ left: '75%', bottom: '-6px' }}
              isConnectable={isConnectable}
              className="!bg-red-500 !w-2 !h-2 !border !border-white"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
