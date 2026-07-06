import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  MarkerType,
  NodeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Save, ArrowLeft, Copy, Trash2, Search, Equal, MessageSquare, Clock, Shuffle, MessageCircle, Check, Webhook, Send } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/components/ui/use-toast';
import type { Account } from '@/types';

// Custom nodes
import ConditionContainsNode from '@/components/flows/ConditionContainsNode';
import ConditionEqualsNode from '@/components/flows/ConditionEqualsNode';
import ActionSendNode from '@/components/flows/ActionSendNode';
import ActionAutoReplyNode from '@/components/flows/ActionAutoReplyNode';
import ActionDelayNode from '@/components/flows/ActionDelayNode';
import ActionTypingNode from '@/components/flows/ActionTypingNode';
import ActionForwardMessageNode from '@/components/flows/ActionForwardMessageNode';
import ActionWebhookNode from '@/components/flows/ActionWebhookNode';

const nodeTypes = {
  conditionContains: ConditionContainsNode,
  conditionEquals: ConditionEqualsNode,
  actionSend: ActionSendNode,
  actionAutoReply: ActionAutoReplyNode,
  actionDelay: ActionDelayNode,
  actionDelayRandom: ActionDelayNode,
  actionTyping: ActionTypingNode,
  actionForwardMessage: ActionForwardMessageNode,
  actionWebhook: ActionWebhookNode,
};

let nodeIdCounter = 0;

export default function FlowEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  
  const [flowName, setFlowName] = useState('');
  const [flowDescription, setFlowDescription] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);

  useEffect(() => {
    loadAccounts();
    if (id && id !== 'new') {
      loadFlow(id);
    }
  }, [id]);

  const loadAccounts = async () => {
    try {
      const data = await window.electron.accounts.getAll();
      setAccounts(
        [...data].sort((a, b) => {
          const connectionPriority = Number(b.status === 'connected') - Number(a.status === 'connected');
          if (connectionPriority !== 0) {
            return connectionPriority;
          }

          return (a.name || a.phone_number || '').localeCompare(b.name || b.phone_number || '');
        })
      );
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };

  const loadFlow = async (flowId: string) => {
    try {
      const data = await window.electron.flows.getById(flowId);
      if (data) {
        setFlowName(data.flow.name);
        setFlowDescription(data.flow.description || '');
        setSelectedAccounts(data.flow.account_ids);
        setNodes(data.nodes);
        setEdges(data.edges);
      }
    } catch (error) {
      console.error('Failed to load flow:', error);
      toast.error(t('toast.error'));
    }
  };

  const onConnect = useCallback(
    (params: Connection | Edge) => {
      // שמור את sourceHandle כ-label כדי לדעת אם זה yes/no
      const label = (params as any).sourceHandle || 'next';
      
      const newEdge = {
        ...params,
        type: 'smoothstep',
        animated: true,
        label,
        style: { 
          stroke: label === 'yes' ? '#22c55e' : label === 'no' ? '#ef4444' : '#6366f1', 
          strokeWidth: 2.5 
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: label === 'yes' ? '#22c55e' : label === 'no' ? '#ef4444' : '#6366f1',
        },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !reactFlowWrapper.current || !reactFlowInstance) {
        return;
      }

      const rect = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });

      const newNodeId = `node_${++nodeIdCounter}_${Date.now()}`;
      const newNode: Node = {
        id: newNodeId,
        type,
        position,
        data: {},
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onNodeContextMenu: NodeMouseHandler = useCallback((event, node) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      nodeId: node.id
    });
  }, []);

  const handleDuplicateNode = () => {
    if (!contextMenu) return;
    
    const nodeToDuplicate = nodes.find(n => n.id === contextMenu.nodeId);
    if (!nodeToDuplicate) return;
    
    const newNode: Node = {
      ...nodeToDuplicate,
      id: `node_${++nodeIdCounter}_${Date.now()}`,
      position: {
        x: nodeToDuplicate.position.x + 50,
        y: nodeToDuplicate.position.y + 50
      },
      data: { ...nodeToDuplicate.data }
    };
    
    setNodes((nds) => nds.concat(newNode));
    setContextMenu(null);
  };

  const handleRemoveNode = () => {
    if (!contextMenu) return;
    
    setNodes((nds) => nds.filter(n => n.id !== contextMenu.nodeId));
    setEdges((eds) => eds.filter(e => e.source !== contextMenu.nodeId && e.target !== contextMenu.nodeId));
    setContextMenu(null);
  };

  const handleCanvasClick = () => {
    setContextMenu(null);
  };

  const handleSave = async () => {
    if (!flowName.trim()) {
      toast.error(language === 'he' ? 'נא להזין שם לזרימה' : language === 'ar' ? 'الرجاء إدخال اسم للتدفق' : 'Please enter a flow name');
      return;
    }

    if (selectedAccounts.length === 0) {
      toast.error(language === 'he' ? 'נא לבחור לפחות חשבון אחד' : language === 'ar' ? 'الرجاء اختيار حساب واحد على الأقل' : 'Please select at least one account');
      return;
    }

    try {
      let flowId = id;
      
      if (!flowId || flowId === 'new') {
        flowId = await window.electron.flows.create({
          name: flowName,
          description: flowDescription,
          account_ids: selectedAccounts,
          is_active: true
        });
      }
      
      await window.electron.flows.save(flowId, {
        name: flowName.trim(),
        description: flowDescription.trim(),
        account_ids: selectedAccounts,
        nodes,
        edges,
      });
      
      toast.success(t('toast.success'));
      navigate('/flows');
    } catch (error) {
      console.error('Failed to save flow:', error);
      toast.error(t('toast.error'));
    }
  };

  const PaletteItem = ({ type, label, icon: Icon, gradientFrom, gradientTo, description }: any) => (
    <Card
      draggable
      onDragStart={(e) => onDragStart(e, type)}
      className={`
        p-2.5 cursor-grab hover:cursor-grab active:cursor-grabbing
        border-l-[3px] hover:shadow-lg transition-all duration-200 hover:scale-[1.01]
        bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950
        border-t border-r border-b border-slate-200 dark:border-slate-800
      `}
      style={{ borderLeftColor: gradientFrom }}
    >
      <div className="flex items-start gap-2">
        <div className={`p-1.5 rounded-lg bg-gradient-to-br shadow-sm`} style={{
          backgroundImage: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`
        }}>
          <Icon className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold mb-0.5">{label}</p>
          <p className="text-[9px] text-muted-foreground leading-tight line-clamp-1">{description}</p>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Compact Modern Header */}
      <div className="bg-gradient-to-r from-primary/5 via-primary/3 to-background border-b px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/flows')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {language === 'he' ? 'חזור' : language === 'ar' ? 'رجوع' : 'Back'}
            </Button>
            
            <div className="h-8 w-[1px] bg-border" />
            
            <div className="flex-1 max-w-2xl">
              <Input
                placeholder={t('flows.flowName')}
                value={flowName}
                onChange={(e) => setFlowName(e.target.value)}
                className="font-semibold border-0 shadow-none focus-visible:ring-0 px-2 h-8 bg-transparent nodrag placeholder:text-muted-foreground/50"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {selectedAccounts.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                <div className="flex -space-x-1.5">
                  {selectedAccounts.slice(0, 3).map((id, idx) => (
                    <div key={id} className="h-6 w-6 rounded-full bg-primary text-primary-foreground border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] font-bold" style={{ zIndex: 10 - idx }}>
                      {accounts.find(a => a.id === id)?.name?.charAt(0)?.toUpperCase() || 'A'}
                    </div>
                  ))}
                </div>
                <span className="text-xs font-medium">
                  {selectedAccounts.length} {language === 'he' ? 'חשבונות' : language === 'ar' ? 'حسابات' : 'accounts'}
                </span>
              </div>
            )}
            
            <Button onClick={handleSave} className="gap-2">
              <Save className="h-4 w-4" />
              {t('flows.saveFlow')}
            </Button>
          </div>
        </div>

        {/* Accounts Selection Bar */}
        {accounts.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedAccounts(accounts.map(a => a.id))}
                className="h-7 text-xs"
              >
                {t('flows.selectAll')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedAccounts([])}
                className="h-7 text-xs"
              >
                {t('flows.clearAll')}
              </Button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {accounts.map(account => (
                <button
                  key={account.id}
                  onClick={() => {
                    setSelectedAccounts(prev =>
                      prev.includes(account.id)
                        ? prev.filter(i => i !== account.id)
                        : [...prev, account.id]
                    );
                  }}
                  className={`
                    px-3 py-1 rounded-full text-xs font-medium transition-all
                    ${selectedAccounts.includes(account.id)
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-background hover:bg-accent border'
                    }
                  `}
                >
                  {selectedAccounts.includes(account.id) && <Check className="h-3 w-3 inline mr-1" />}
                  {account.name || account.phone_number}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Node Palette Sidebar */}
        <div className="w-64 bg-gradient-to-br from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 border-r flex flex-col overflow-hidden">
          <div className="p-4 border-b bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              {t('flows.nodeTypes')}
            </h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">{t('flows.dragNodes')}</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {/* Conditions Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 mb-2">
                <div className="h-1 w-1 rounded-full bg-blue-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">{t('flows.conditions')}</span>
                <div className="h-[1px] flex-1 bg-gradient-to-r from-blue-200 to-transparent dark:from-blue-900" />
              </div>
              
              <PaletteItem 
                type="conditionContains" 
                label={t('flows.ifContains')} 
                icon={Search} 
                gradientFrom="#3b82f6"
                gradientTo="#6366f1"
                description={language === 'he' ? 'בדוק אם ההודעה מכילה טקסט' : language === 'ar' ? 'تحقق مما إذا كانت الرسالة تحتوي على نص' : 'Check if message contains text'}
              />
              
              <PaletteItem 
                type="conditionEquals" 
                label={t('flows.ifEquals')} 
                icon={Equal} 
                gradientFrom="#2563eb"
                gradientTo="#3b82f6"
                description={language === 'he' ? 'בדוק אם ההודעה שווה בדיוק' : language === 'ar' ? 'تحقق من مطابقة الرسالة بالضبط' : 'Check exact text match'}
              />
            </div>

            {/* Actions Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 mb-2">
                <div className="h-1 w-1 rounded-full bg-green-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-green-600 dark:text-green-400">{t('flows.actions')}</span>
                <div className="h-[1px] flex-1 bg-gradient-to-r from-green-200 to-transparent dark:from-green-900" />
              </div>

              <PaletteItem 
                type="actionSend" 
                label={t('flows.sendMessage')} 
                icon={MessageSquare} 
                gradientFrom="#22c55e"
                gradientTo="#10b981"
                description={language === 'he' ? 'שלח הודעה/תמונה/קובץ' : language === 'ar' ? 'إرسال رسالة/صورة/ملف' : 'Send text, image or file'}
              />

              <PaletteItem 
                type="actionAutoReply" 
                label={t('flows.autoReply')} 
                icon={MessageSquare} 
                gradientFrom="#10b981"
                gradientTo="#14b8a6"
                description={language === 'he' ? 'החזר תשובה קבועה לכל הודעה נכנסת' : language === 'ar' ? 'إرسال رد ثابت لأي رسالة واردة' : 'Reply with a fixed message to any incoming message'}
              />

              <PaletteItem 
                type="actionForwardMessage" 
                label={t('flows.forwardMessage')} 
                icon={Send} 
                gradientFrom="#06b6d4"
                gradientTo="#3b82f6"
                description={language === 'he' ? 'שלח הודעה למספר אחר עם תוכן דינמי' : language === 'ar' ? 'إرسال رسالة إلى رقم آخر مع محتوى ديناميكي' : 'Send a message to another number with dynamic content'}
              />
              
              <PaletteItem 
                type="actionDelay" 
                label={t('flows.delay')} 
                icon={Clock} 
                gradientFrom="#f59e0b"
                gradientTo="#fb923c"
                description={language === 'he' ? 'המתנה קבועה בשניות' : language === 'ar' ? 'تأخير ثابت بالثواني' : 'Wait for fixed seconds'}
              />
              
              <PaletteItem 
                type="actionDelayRandom" 
                label={t('flows.randomDelay')} 
                icon={Shuffle} 
                gradientFrom="#f97316"
                gradientTo="#fb923c"
                description={language === 'he' ? 'המתנה אקראית' : language === 'ar' ? 'تأخير عشوائي' : 'Random wait time'}
              />
              
              <PaletteItem 
                type="actionTyping" 
                label={t('flows.typing')} 
                icon={MessageCircle} 
                gradientFrom="#a855f7"
                gradientTo="#c084fc"
                description={language === 'he' ? 'סימולציית הקלדה' : language === 'ar' ? 'محاكاة الكتابة' : 'Simulate typing'}
              />
              
              <PaletteItem 
                type="actionWebhook" 
                label="Webhook" 
                icon={Webhook} 
                gradientFrom="#e11d48"
                gradientTo="#f43f5e"
                description={language === 'he' ? 'שלח webhook לכתובת חיצונית' : language === 'ar' ? 'إرسال webhook إلى عنوان خارجي' : 'Send webhook to external URL'}
              />
            </div>
          </div>

          {/* Help Box */}
          <div className="p-2.5 m-3 rounded-lg bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20">
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              💡 {t('flows.connectNodes')}
            </p>
          </div>
        </div>

        {/* Flow Canvas */}
        <div ref={reactFlowWrapper} className="flex-1 relative bg-slate-50 dark:bg-slate-950">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeContextMenu={onNodeContextMenu}
            onPaneClick={handleCanvasClick}
            nodeTypes={nodeTypes}
            fitView
            defaultEdgeOptions={{
              type: 'smoothstep',
              animated: true,
              style: { strokeWidth: 2.5, stroke: '#6366f1' },
            }}
          >
            <Background color="#cbd5e1" gap={20} size={1.5} className="opacity-30" />
            <Controls className="bg-white dark:bg-slate-900 border shadow-xl rounded-xl overflow-hidden !left-auto !right-4 !bottom-4" />
            <MiniMap 
              className="bg-white dark:bg-slate-900 border shadow-xl rounded-xl overflow-hidden !m-4" 
              nodeColor={(n) => {
                if (n.type?.includes('condition')) return '#3b82f6';
                if (n.type?.includes('Send')) return '#22c55e';
                if (n.type?.includes('Reply')) return '#10b981';
                if (n.type?.includes('Forward')) return '#06b6d4';
                if (n.type?.includes('Delay')) return '#f59e0b';
                if (n.type?.includes('Typing')) return '#a855f7';
                if (n.type?.includes('Webhook')) return '#e11d48';
                return '#6366f1';
              }}
              maskColor="rgb(248, 250, 252, 0.8)"
            />
          </ReactFlow>

          {/* Context Menu */}
          {contextMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={handleCanvasClick}
              />
              <div
                className="fixed z-50 bg-white dark:bg-slate-900 border rounded-xl shadow-2xl overflow-hidden min-w-[180px]"
                style={{
                  left: contextMenu.x,
                  top: contextMenu.y
                }}
              >
                <button
                  onClick={handleDuplicateNode}
                  className="w-full px-4 py-3 text-sm hover:bg-primary/5 flex items-center gap-3 text-left transition-colors border-b"
                >
                  <Copy className="h-4 w-4 text-primary" />
                  <span className="font-medium">{t('flows.duplicate')}</span>
                </button>
                <button
                  onClick={handleRemoveNode}
                  className="w-full px-4 py-3 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 text-left text-red-600 dark:text-red-400 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="font-medium">{t('flows.remove')}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
