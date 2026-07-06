import { Handle, Position, useReactFlow } from 'reactflow';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { MessageSquare, Paperclip, X } from 'lucide-react';

export default function ActionSendNode({ id, data, isConnectable }: any) {
  const { t, language } = useLanguage();
  const { setNodes } = useReactFlow();
  
  const handleMessageChange = (newMessage: string) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: { ...node.data, message: newMessage }
          };
        }
        return node;
      })
    );
  };
  
  const handleInputInteraction = (e: React.MouseEvent | React.PointerEvent | React.TouchEvent) => {
    e.stopPropagation();
  };
  
  const handleFileSelect = async () => {
    try {
      const filePath = await window.electron.flows.selectMedia();
      if (filePath) {
        setNodes((nds) =>
          nds.map((node) => {
            if (node.id === id) {
              return {
                ...node,
                data: { ...node.data, mediaPath: filePath }
              };
            }
            return node;
          })
        );
      }
    } catch (error) {
      console.error('Failed to select file:', error);
    }
  };
  
  const handleRemoveFile = () => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: { ...node.data, mediaPath: undefined }
          };
        }
        return node;
      })
    );
  };
  
  return (
    <Card className="w-[240px] border-0 shadow-md rounded-md overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700 bg-white dark:bg-slate-900">
      <div className="absolute top-0 left-0 w-full h-[2px] bg-green-500" />
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="!bg-green-500 !w-2 !h-2 !border !border-white" />
      
      <CardHeader className="p-2 pb-1.5 bg-green-50/50 dark:bg-green-900/10 border-b border-green-100 dark:border-green-900/20">
        <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-green-700 dark:text-green-300">
          <MessageSquare className="h-3 w-3" />
          {t('flows.sendMessage')}
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
            onChange={(e) => handleMessageChange(e.target.value)}
            placeholder={t('flows.enterMessage')}
            rows={2}
            className="text-[11px] leading-tight bg-slate-50 dark:bg-slate-950 border-slate-200 focus-visible:ring-green-500 resize-none min-h-[3rem]"
          />
        </div>
        
        <div 
          className="flex items-center gap-1 nodrag"
          onMouseDown={handleInputInteraction}
          onPointerDown={handleInputInteraction}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleFileSelect}
            className={`flex-1 h-7 text-[10px] border-dashed ${
              data.mediaPath 
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                : 'border-green-300 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'
            } text-green-700 dark:text-green-300`}
          >
            <Paperclip className="h-2.5 w-2.5 mr-1" />
            {data.mediaPath ? '✓ Media' : t('flows.selectMedia')}
          </Button>
          {data.mediaPath && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemoveFile}
              className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        <div className="pt-2 flex justify-center pb-1">
          <Handle 
            type="source" 
            position={Position.Bottom} 
            isConnectable={isConnectable}
            className="!bg-green-500 !w-2 !h-2 !border !border-white"
          />
        </div>
      </CardContent>
    </Card>
  );
}
