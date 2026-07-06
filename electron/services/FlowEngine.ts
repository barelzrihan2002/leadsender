import type { Database } from 'better-sqlite3';
import { WhatsAppManager } from './WhatsAppManager';
import { v4 as uuidv4 } from 'uuid';

interface FlowNode {
  id: string;
  flow_id: string;
  type: string;
  position_x: number;
  position_y: number;
  data: string;
}

interface FlowEdge {
  id: string;
  flow_id: string;
  source: string;
  target: string;
  label?: string;
}

interface Flow {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  account_ids: string;
}

interface ExecutionNode {
  id: string;
  type: string;
  data: any;
  edgeYes?: ExecutionNode | null;
  edgeNo?: ExecutionNode | null;
  nextNode?: ExecutionNode | null;
}

export class FlowEngine {
  // Track messages currently being processed to prevent duplicate flow execution
  private processingMessages: Set<string> = new Set();
  
  constructor(
    private db: Database,
    private whatsappManager: WhatsAppManager
  ) {}

  /**
   * בדוק אם יש Flow פעיל עבור account זה והפעל אותו
   */
  async checkAndExecuteFlow(accountId: string, chatId: string, incomingMessage: any): Promise<boolean> {
    try {
      // Generate unique key for this message in this chat
      const messageKey = `${accountId}:${chatId}:${incomingMessage.id?.id || incomingMessage.timestamp}`;
      
      // Check if we're already processing this message
      if (this.processingMessages.has(messageKey)) {
        console.log(`🤖 Duplicate flow execution prevented for message in ${chatId}`);
        return false;
      }
      
      // Mark this message as being processed
      this.processingMessages.add(messageKey);
      
      // Clean up after 30 seconds (safety measure)
      setTimeout(() => {
        this.processingMessages.delete(messageKey);
      }, 30000);
      
      // 1. מצא Flows פעילים עבור account זה
      const activeFlows = this.getActiveFlowsForAccount(accountId);
      
      if (activeFlows.length === 0) {
        return false;
      }
      
      console.log(`🤖 Found ${activeFlows.length} active flow(s) for account ${accountId.substring(0, 8)}...`);
      
      // 2. עבור על כל Flow ובדוק תנאים
      for (const flow of activeFlows) {
        const shouldExecute = await this.evaluateFlowConditions(flow, incomingMessage);
        
        if (shouldExecute) {
          console.log(`🤖 Flow "${flow.name}" conditions matched - executing...`);
          
          // 3. הפעל את הFlow
          await this.executeFlow(flow, accountId, chatId, incomingMessage);
          return true; // Flow executed
        }
      }
      
      console.log(`🤖 No matching flow conditions for message: "${incomingMessage.body?.substring(0, 50)}..."`);
      return false; // No matching flow
    } catch (error) {
      console.error('❌ Error in checkAndExecuteFlow:', error);
      return false;
    }
  }

  /**
   * מצא Flows פעילים עבור account ספציפי
   */
  private getActiveFlowsForAccount(accountId: string): Flow[] {
    const stmt = this.db.prepare(`
      SELECT * FROM flows 
      WHERE is_active = 1
      ORDER BY created_at ASC
    `);
    
    const allFlows = stmt.all() as Flow[];
    
    // סנן לפי accounts
    return allFlows.filter(flow => {
      if (!flow.account_ids) return false;
      
      try {
        const accountIds = JSON.parse(flow.account_ids);
        return accountIds.includes(accountId);
      } catch {
        return false;
      }
    });
  }

  /**
   * בדוק אם Flow צריך להתבצע (בדוק את התנאי הראשון)
   */
  private async evaluateFlowConditions(flow: Flow, message: any): Promise<boolean> {
    // מצא את הצומת הראשון (שאין לו target handle - אין edge שמגיע אליו)
    const nodesStmt = this.db.prepare('SELECT * FROM flow_nodes WHERE flow_id = ?');
    const nodes = nodesStmt.all(flow.id) as FlowNode[];
    
    if (nodes.length === 0) return false;
    
    const edgesStmt = this.db.prepare('SELECT * FROM flow_edges WHERE flow_id = ?');
    const edges = edgesStmt.all(flow.id) as FlowEdge[];
    
    // מצא צומת ראשון (אין edge שמגיע אליו)
    const targetNodeIds = new Set(edges.map(e => e.target));
    const startNode = nodes.find(n => !targetNodeIds.has(n.id));
    
    if (!startNode) {
      console.log('⚠️ No start node found for flow');
      return false;
    }
    
    // אם הצומת הראשון הוא תנאי - בדוק אותו
    if (startNode.type === 'condition_contains' || startNode.type === 'condition_equals') {
      const data = JSON.parse(startNode.data);
      const messageText = message.body || '';
      
      if (startNode.type === 'condition_contains') {
        return messageText.toLowerCase().includes((data.text || '').toLowerCase());
      } else if (startNode.type === 'condition_equals') {
        return messageText.toLowerCase() === (data.text || '').toLowerCase();
      }
    }
    
    // אם הצומת הראשון הוא action - תמיד הפעל
    return true;
  }

  /**
   * הפעל Flow מלא
   */
  private async executeFlow(flow: Flow, accountId: string, chatId: string, triggerMessage: any): Promise<void> {
    const executionId = uuidv4();
    
    // רשום התחלת ביצוע
    const logStmt = this.db.prepare(`
      INSERT INTO flow_executions (id, flow_id, account_id, chat_id, trigger_message_id, status)
      VALUES (?, ?, ?, ?, ?, 'running')
    `);
    logStmt.run(executionId, flow.id, accountId, chatId, triggerMessage.id.id);
    
    try {
      // 1. טען nodes ו-edges
      const nodesStmt = this.db.prepare('SELECT * FROM flow_nodes WHERE flow_id = ?');
      const nodes = nodesStmt.all(flow.id) as FlowNode[];
      
      const edgesStmt = this.db.prepare('SELECT * FROM flow_edges WHERE flow_id = ?');
      const edges = edgesStmt.all(flow.id) as FlowEdge[];
      
      // 2. בנה גרף ביצוע
      const executionGraph = this.buildExecutionGraph(nodes, edges);
      
      if (!executionGraph.startNode) {
        throw new Error('No start node found');
      }
      
      // 3. עבור על הזרימה
      let currentNode: ExecutionNode | null = executionGraph.startNode;
      let stepCount = 0;
      const maxSteps = 50; // מניעת לולאות אינסופיות
      
      while (currentNode && stepCount < maxSteps) {
        console.log(`🤖 Executing node: ${currentNode.type}`);
        currentNode = await this.executeNode(currentNode, accountId, chatId, triggerMessage);
        stepCount++;
      }
      
      // סיים בהצלחה
      const completeStmt = this.db.prepare(`
        UPDATE flow_executions 
        SET status = 'completed', completed_at = ?
        WHERE id = ?
      `);
      completeStmt.run(new Date().toISOString(), executionId);
      
      console.log(`✅ Flow "${flow.name}" completed successfully (${stepCount} steps)`);
      
    } catch (error) {
      console.error(`❌ Error executing flow "${flow.name}":`, error);
      
      // רשום כישלון
      const failStmt = this.db.prepare(`
        UPDATE flow_executions 
        SET status = 'failed', completed_at = ?
        WHERE id = ?
      `);
      failStmt.run(new Date().toISOString(), executionId);
    }
  }

  /**
   * בנה גרף ביצוע מ-nodes ו-edges
   */
  private buildExecutionGraph(nodes: FlowNode[], edges: FlowEdge[]): { startNode: ExecutionNode | null; nodeMap: Map<string, ExecutionNode> } {
    const nodeMap = new Map<string, ExecutionNode>();
    
    console.log(`🔨 Building execution graph with ${nodes.length} nodes and ${edges.length} edges`);
    
    // המר nodes ל-ExecutionNodes
    for (const node of nodes) {
      nodeMap.set(node.id, {
        id: node.id,
        type: node.type,
        data: JSON.parse(node.data || '{}'),
      });
    }
    
    // קשר edges
    for (const edge of edges) {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);
      
      console.log(`🔗 Edge: ${edge.source.substring(0, 10)}... -> ${edge.target.substring(0, 10)}... | label: "${edge.label}"`);
      
      if (!sourceNode || !targetNode) {
        console.log(`⚠️ Edge skipped - source or target not found`);
        continue;
      }
      
      // בדוק את ה-label (שנשמר מה-sourceHandle)
      if (edge.label === 'yes') {
        sourceNode.edgeYes = targetNode;
        console.log(`  ✅ YES edge → ${targetNode.type}`);
      } else if (edge.label === 'no') {
        sourceNode.edgeNo = targetNode;
        console.log(`  ❌ NO edge → ${targetNode.type}`);
      } else {
        // edge רגיל (next)
        sourceNode.nextNode = targetNode;
        console.log(`  ➡️ NEXT edge → ${targetNode.type}`);
      }
    }
    
    // מצא start node (אין edge שמגיע אליו)
    const targetNodeIds = new Set(edges.map(e => e.target));
    const startNode = Array.from(nodeMap.values()).find(n => !targetNodeIds.has(n.id)) || null;
    
    if (startNode) {
      console.log(`🎬 Start node found: ${startNode.type} (${startNode.id})`);
    } else {
      console.log(`⚠️ No start node found!`);
    }
    
    return { startNode, nodeMap };
  }

  /**
   * בצע צומת בודד
   */
  private async executeNode(node: ExecutionNode, accountId: string, chatId: string, message: any): Promise<ExecutionNode | null> {
    switch (node.type) {
      case 'conditionContains':
      case 'condition_contains': {
        const messageText = message.body || '';
        const contains = messageText.toLowerCase().includes((node.data.text || '').toLowerCase());
        console.log(`🔍 Condition "contains ${node.data.text}": ${contains ? 'YES' : 'NO'}`);
        return contains ? node.edgeYes || null : node.edgeNo || null;
      }
      
      case 'conditionEquals':
      case 'condition_equals': {
        const messageText = message.body || '';
        const equals = messageText.toLowerCase() === (node.data.text || '').toLowerCase();
        console.log(`🔍 Condition "equals ${node.data.text}": ${equals ? 'YES' : 'NO'}`);
        return equals ? node.edgeYes || null : node.edgeNo || null;
      }
      
      case 'actionSend':
      case 'action_send': {
        const messageContext = await this.getMessageContext(accountId, chatId, message);
        const resolvedMessage = this.renderTemplate(node.data.message || '', messageContext);
        console.log(`📤 Sending message: "${resolvedMessage.substring(0, 50)}..."`);
        
        // אם יש קובץ מדיה
        if (node.data.mediaPath) {
          console.log(`📎 Sending media: ${node.data.mediaPath}`);
          await this.whatsappManager.sendMedia(
            accountId,
            chatId,
            node.data.mediaPath,
            resolvedMessage
          );
        } else if (resolvedMessage.trim()) {
          // הודעת טקסט רגילה
          await this.whatsappManager.sendMessage(accountId, chatId, resolvedMessage);
        } else {
          console.log('⚠️ actionSend skipped - no message content configured');
        }
        
        return node.nextNode || null;
      }

      case 'actionAutoReply':
      case 'action_auto_reply': {
        const messageContext = await this.getMessageContext(accountId, chatId, message);
        const resolvedMessage = this.renderTemplate(node.data.message || '', messageContext);

        if (!resolvedMessage.trim()) {
          console.log('⚠️ actionAutoReply skipped - no message content configured');
          return node.nextNode || null;
        }

        console.log(`🤖 Auto reply: "${resolvedMessage.substring(0, 50)}..."`);
        await this.whatsappManager.sendMessage(accountId, chatId, resolvedMessage);
        return node.nextNode || null;
      }

      case 'actionForwardMessage':
      case 'action_forward_message': {
        const targetNumber = (node.data.phoneNumber || '').trim();
        const messageContext = await this.getMessageContext(accountId, chatId, message);
        const resolvedMessage = this.renderTemplate(node.data.message || '', messageContext);

        if (!targetNumber) {
          console.log('⚠️ actionForwardMessage skipped - no destination number configured');
          return node.nextNode || null;
        }

        if (!resolvedMessage.trim()) {
          console.log('⚠️ actionForwardMessage skipped - no message content configured');
          return node.nextNode || null;
        }

        console.log(`📨 Forwarding message to ${targetNumber}: "${resolvedMessage.substring(0, 50)}..."`);
        await this.whatsappManager.sendMessage(accountId, targetNumber, resolvedMessage);
        return node.nextNode || null;
      }
      
      case 'actionDelay':
      case 'action_delay': {
        const seconds = node.data.seconds || 1;
        console.log(`⏱️ Delay: ${seconds} seconds`);
        await this.sleep(seconds * 1000);
        return node.nextNode || null;
      }
      
      case 'actionDelayRandom':
      case 'action_delay_random': {
        const min = node.data.min || 1;
        const max = node.data.max || 5;
        const seconds = Math.floor(Math.random() * (max - min + 1)) + min;
        console.log(`⏱️ Random delay: ${seconds} seconds (${min}-${max})`);
        await this.sleep(seconds * 1000);
        return node.nextNode || null;
      }
      
      case 'actionTyping':
      case 'action_typing': {
        const min = node.data.min || 1;
        const max = node.data.max || 3;
        console.log(`⌨️ Simulating typing: ${min}-${max} seconds`);
        await this.simulateTyping(accountId, chatId, min, max);
        return node.nextNode || null;
      }
      
      case 'actionWebhook':
      case 'action_webhook': {
        console.log(`🌐 Sending webhook to: ${node.data.url}`);
        await this.executeWebhook(node.data, accountId, chatId, message);
        return node.nextNode || null;
      }
      
      default:
        console.log(`⚠️ Unknown node type: ${node.type}`);
        return null;
    }
  }

  private async getMessageContext(accountId: string, chatId: string, message: any): Promise<{ incomingMessage: string; senderPhone: string; senderName: string }> {
    let senderPhone = this.extractDigits(message?.from || chatId);
    let senderName = message?._data?.notifyName || message?._data?.pushname || '';

    try {
      const resolvedContact = await this.whatsappManager.resolveContactData(accountId, chatId, message);
      if (resolvedContact.phone) {
        senderPhone = resolvedContact.phone;
      }
      if (resolvedContact.name) {
        senderName = resolvedContact.name;
      }
    } catch (error) {
      console.log('ℹ️ Could not fully resolve message context:', error);
    }

    return {
      incomingMessage: message?.body || '',
      senderPhone,
      senderName,
    };
  }

  private renderTemplate(template: string, context: { incomingMessage: string; senderPhone: string; senderName: string }): string {
    return (template || '')
      .split('{{incoming_message}}').join(context.incomingMessage || '')
      .split('{{sender_phone}}').join(context.senderPhone || '')
      .split('{{sender_name}}').join(context.senderName || '');
  }

  private extractDigits(value: string): string {
    return (value || '').replace(/\D/g, '');
  }

  /**
   * שליחת Webhook
   */
  private async executeWebhook(data: any, accountId: string, chatId: string, message: any): Promise<void> {
    const url = data.url;
    if (!url) {
      console.log('⚠️ Webhook node has no URL configured');
      return;
    }

    try {
      const method = (data.method || 'POST').toUpperCase();
      
      // Build the body
      const body: Record<string, any> = {};
      
      // Resolve real phone number via getContact() (most reliable)
      let resolvedPhone = '';
      let resolvedName = message._data?.notifyName || message._data?.pushname || '';
      
      try {
        const resolvedContact = await this.whatsappManager.resolveContactData(accountId, chatId, message);
        if (resolvedContact.phone) {
          resolvedPhone = resolvedContact.phone;
        }
        if (resolvedContact.name) {
          resolvedName = resolvedContact.name;
        }
      } catch (e) {
        // Ignore - will use fallback
      }
      
      // Try DB lookup for contact name (more reliable than WhatsApp pushname)
      if (resolvedPhone) {
        try {
          const suffix = resolvedPhone.slice(-9);
          const stmt = this.db.prepare('SELECT name, phone_number FROM contacts WHERE phone_number = ? OR phone_number LIKE ?');
          const dbContact = stmt.get(resolvedPhone, `%${suffix}`) as any;
          if (dbContact?.name) {
            resolvedName = dbContact.name;
          }
        } catch (e) {
          // Ignore DB errors
        }
      }

      // Add phone number if enabled
      if (data.sendPhone) {
        body.phone = resolvedPhone;
      }
      
      // Add contact name if enabled
      if (data.sendName) {
        body.name = resolvedName;
      }
      
      // Add body text if provided
      if (data.bodyText) {
        body.text = data.bodyText;
      }
      
      // Add custom fields
      if (data.fields && Array.isArray(data.fields)) {
        for (const field of data.fields) {
          if (field.key && field.key.trim()) {
            body[field.key.trim()] = field.value || '';
          }
        }
      }
      
      console.log(`🌐 Webhook ${method} ${url}`, JSON.stringify(body));
      
      if (method === 'GET') {
        // For GET, append as query params
        const urlObj = new URL(url);
        for (const [key, value] of Object.entries(body)) {
          urlObj.searchParams.append(key, String(value));
        }
        const response = await fetch(urlObj.toString(), { method: 'GET' });
        console.log(`✅ Webhook response: ${response.status}`);
      } else {
        // POST / PUT
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        console.log(`✅ Webhook response: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Webhook error:', error);
    }
  }

  /**
   * סימולציה של הקלדה
   */
  private async simulateTyping(accountId: string, chatId: string, minSeconds: number, maxSeconds: number): Promise<void> {
    const seconds = Math.floor(Math.random() * (maxSeconds - minSeconds + 1)) + minSeconds;
    
    try {
      const client = this.whatsappManager.getConnection(accountId);
      if (!client) return;
      
      // התחל הקלדה
      const chat = await client.getChatById(chatId);
      await chat.sendStateTyping();
      
      // המתן
      await this.sleep(seconds * 1000);
      
      // הפסק הקלדה
      await chat.clearState();
      
      console.log(`✅ Typing simulation completed (${seconds}s)`);
    } catch (error) {
      console.error('❌ Error simulating typing:', error);
    }
  }

  /**
   * פונקציית עזר להמתנה
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
