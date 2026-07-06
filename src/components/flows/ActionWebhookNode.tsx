import { Handle, Position, useReactFlow } from 'reactflow';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { Webhook, Plus, X, Phone, User } from 'lucide-react';

export default function ActionWebhookNode({ id, data, isConnectable }: any) {
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

  const fields: { key: string; value: string }[] = data.fields || [];

  const addField = () => {
    updateData({ fields: [...fields, { key: '', value: '' }] });
  };

  const removeField = (index: number) => {
    updateData({ fields: fields.filter((_: any, i: number) => i !== index) });
  };

  const updateField = (index: number, prop: 'key' | 'value', val: string) => {
    const updated = fields.map((f: any, i: number) => i === index ? { ...f, [prop]: val } : f);
    updateData({ fields: updated });
  };

  const toggleBuiltIn = (field: 'sendPhone' | 'sendName') => {
    updateData({ [field]: !data[field] });
  };

  return (
    <Card className="w-[280px] border-0 shadow-md rounded-md overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700 bg-white dark:bg-slate-900">
      <div className="absolute top-0 left-0 w-full h-[2px] bg-rose-500" />
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="!bg-rose-500 !w-2 !h-2 !border !border-white" />
      
      <CardHeader className="p-2 pb-1.5 bg-rose-50/50 dark:bg-rose-900/10 border-b border-rose-100 dark:border-rose-900/20">
        <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
          <Webhook className="h-3 w-3" />
          Webhook
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-2 space-y-1.5">
        <div 
          className="nodrag nopan nowheel space-y-2"
          onMouseDown={handleInputInteraction}
          onPointerDown={handleInputInteraction}
          onTouchStart={handleInputInteraction}
        >
          {/* URL */}
          <div>
            <Label className="text-[8px] uppercase text-muted-foreground font-semibold mb-0.5 block">URL</Label>
            <Input 
              value={data.url || ''}
              onChange={(e) => updateData({ url: e.target.value })}
              placeholder="https://example.com/webhook"
              className="text-[10px] h-7 bg-slate-50 dark:bg-slate-950 border-slate-200 focus-visible:ring-rose-500"
            />
          </div>

          {/* Method */}
          <div>
            <Label className="text-[8px] uppercase text-muted-foreground font-semibold mb-0.5 block">
              {language === 'he' ? 'שיטה' : language === 'ar' ? 'الطريقة' : 'Method'}
            </Label>
            <select
              value={data.method || 'POST'}
              onChange={(e) => updateData({ method: e.target.value })}
              className="w-full text-[10px] h-7 rounded-md border border-slate-200 bg-slate-50 dark:bg-slate-950 dark:border-slate-700 px-2 focus:ring-rose-500 focus:ring-1 outline-none"
            >
              <option value="POST">POST</option>
              <option value="GET">GET</option>
              <option value="PUT">PUT</option>
            </select>
          </div>

          {/* Built-in fields */}
          <div>
            <Label className="text-[8px] uppercase text-muted-foreground font-semibold mb-1 block">
              {language === 'he' ? 'שדות אוטומטיים' : language === 'ar' ? 'حقول تلقائية' : 'Auto Fields'}
            </Label>
            <div className="flex gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => toggleBuiltIn('sendPhone')}
                className={`h-6 text-[9px] px-2 ${
                  data.sendPhone 
                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300' 
                    : 'border-slate-200 text-muted-foreground'
                }`}
              >
                <Phone className="h-2.5 w-2.5 mr-1" />
                {language === 'he' ? 'טלפון' : language === 'ar' ? 'هاتف' : 'Phone'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => toggleBuiltIn('sendName')}
                className={`h-6 text-[9px] px-2 ${
                  data.sendName 
                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300' 
                    : 'border-slate-200 text-muted-foreground'
                }`}
              >
                <User className="h-2.5 w-2.5 mr-1" />
                {language === 'he' ? 'שם' : language === 'ar' ? 'اسم' : 'Name'}
              </Button>
            </div>
          </div>

          {/* Custom body text */}
          <div>
            <Label className="text-[8px] uppercase text-muted-foreground font-semibold mb-0.5 block">
              {language === 'he' ? 'טקסט חופשי' : language === 'ar' ? 'نص حر' : 'Body Text'}
            </Label>
            <Input 
              value={data.bodyText || ''}
              onChange={(e) => updateData({ bodyText: e.target.value })}
              placeholder={language === 'he' ? 'טקסט לשליחה...' : language === 'ar' ? 'نص للإرسال...' : 'Text to send...'}
              className="text-[10px] h-7 bg-slate-50 dark:bg-slate-950 border-slate-200 focus-visible:ring-rose-500"
            />
          </div>

          {/* Custom fields */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-[8px] uppercase text-muted-foreground font-semibold">
                {language === 'he' ? 'שדות מותאמים' : language === 'ar' ? 'حقول مخصصة' : 'Custom Fields'}
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addField}
                className="h-5 w-5 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            
            {fields.map((field: any, index: number) => (
              <div key={index} className="flex gap-1 mb-1 items-center">
                <Input
                  value={field.key}
                  onChange={(e) => updateField(index, 'key', e.target.value)}
                  placeholder="key"
                  className="text-[9px] h-6 flex-1 bg-slate-50 dark:bg-slate-950 border-slate-200 focus-visible:ring-rose-500"
                />
                <Input
                  value={field.value}
                  onChange={(e) => updateField(index, 'value', e.target.value)}
                  placeholder="value"
                  className="text-[9px] h-6 flex-1 bg-slate-50 dark:bg-slate-950 border-slate-200 focus-visible:ring-rose-500"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeField(index)}
                  className="h-5 w-5 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0"
                >
                  <X className="h-2.5 w-2.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
        
        <div className="pt-2 flex justify-center pb-1">
          <Handle 
            type="source" 
            position={Position.Bottom} 
            isConnectable={isConnectable}
            className="!bg-rose-500 !w-2 !h-2 !border !border-white"
          />
        </div>
      </CardContent>
    </Card>
  );
}
