import { Handle, Position, useReactFlow } from 'reactflow';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { Send, Phone, MessageSquare } from 'lucide-react';

const INCOMING_MESSAGE_TOKEN = '{{incoming_message}}';
const SENDER_PHONE_TOKEN = '{{sender_phone}}';

export default function ActionForwardMessageNode({ id, data, isConnectable }: any) {
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

  const appendToken = (token: string) => {
    const currentMessage = data.message || '';
    const nextMessage = currentMessage && !currentMessage.endsWith(' ')
      ? `${currentMessage} ${token}`
      : `${currentMessage}${token}`;

    updateData({ message: nextMessage });
  };

  return (
    <Card className="w-[280px] border-0 shadow-md rounded-md overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700 bg-white dark:bg-slate-900">
      <div className="absolute top-0 left-0 w-full h-[2px] bg-cyan-500" />
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="!bg-cyan-500 !w-2 !h-2 !border !border-white" />

      <CardHeader className="p-2 pb-1.5 bg-cyan-50/50 dark:bg-cyan-900/10 border-b border-cyan-100 dark:border-cyan-900/20">
        <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-cyan-700 dark:text-cyan-300">
          <Send className="h-3 w-3" />
          {t('flows.forwardMessage')}
        </CardTitle>
      </CardHeader>

      <CardContent className="p-2 space-y-2">
        <div
          className="nodrag nopan nowheel space-y-2"
          onMouseDown={handleInputInteraction}
          onPointerDown={handleInputInteraction}
          onTouchStart={handleInputInteraction}
        >
          <div>
            <div className="text-[8px] uppercase text-muted-foreground font-semibold mb-0.5 block">
              {t('flows.destinationNumber')}
            </div>
            <Input
              value={data.phoneNumber || ''}
              onChange={(e) => updateData({ phoneNumber: e.target.value })}
              placeholder={t('flows.enterDestinationNumber')}
              className="text-[10px] h-7 bg-slate-50 dark:bg-slate-950 border-slate-200 focus-visible:ring-cyan-500"
            />
          </div>

          <div>
            <div className="text-[8px] uppercase text-muted-foreground font-semibold mb-0.5 block">
              {t('flows.sendMessage')}
            </div>
            <Textarea
              value={data.message || ''}
              onChange={(e) => updateData({ message: e.target.value })}
              placeholder={t('flows.enterMessage')}
              rows={3}
              className="text-[11px] leading-tight bg-slate-50 dark:bg-slate-950 border-slate-200 focus-visible:ring-cyan-500 resize-none min-h-[4rem]"
            />
          </div>

          <div>
            <div className="text-[8px] uppercase text-muted-foreground font-semibold mb-1 block">
              {t('flows.messageVariables')}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendToken(INCOMING_MESSAGE_TOKEN)}
                className="h-6 text-[9px] px-2 border-cyan-300 hover:border-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300"
              >
                <MessageSquare className="h-2.5 w-2.5 mr-1" />
                {t('flows.insertIncomingMessage')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendToken(SENDER_PHONE_TOKEN)}
                className="h-6 text-[9px] px-2 border-cyan-300 hover:border-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300"
              >
                <Phone className="h-2.5 w-2.5 mr-1" />
                {t('flows.insertSenderPhone')}
              </Button>
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-center pb-1">
          <Handle
            type="source"
            position={Position.Bottom}
            isConnectable={isConnectable}
            className="!bg-cyan-500 !w-2 !h-2 !border !border-white"
          />
        </div>
      </CardContent>
    </Card>
  );
}
