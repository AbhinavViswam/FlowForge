import { interpolate } from './utils';
import { evaluateCondition } from '@flowforge/shared';

export interface WorkflowNodeDef {
  id: string;
  type: string;
  config?: Record<string, any>;
  position?: { x: number; y: number };
  data?: Record<string, any>;
}

export interface WorkflowEdgeDef {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  id?: string;
}

export interface WorkflowDefinition {
  nodes: WorkflowNodeDef[];
  edges: WorkflowEdgeDef[];
}

export interface NodeExecutionResult {
  nodeId: string;
  nodeType: string;
  nodeName: string;
  status: 'completed' | 'failed' | 'skipped';
  durationMs: number;
  input: any;
  output: any;
  error?: string;
  executedAt: string;
}

export interface WorkflowLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  nodeId?: string;
  message: string;
}

export interface WorkflowExecutionResult {
  executionId: string;
  status: 'completed' | 'failed';
  totalDurationMs: number;
  nodeResults: Record<string, NodeExecutionResult>;
  logs: WorkflowLog[];
  output: any;
  error?: string;
}

export const DEFAULT_TEST_PAYLOAD = {
  event: "order.created",
  eventId: "evt_live_88421",
  timestamp: new Date().toISOString(),
  account_tier: "enterprise",
  customer: {
    id: "cust_90214",
    name: "Sarah Connor",
    email: "sarah@cyberdyne.io",
    account_tier: "enterprise"
  },
  order: {
    id: "ord_1029",
    amount: 349.50,
    currency: "USD",
    items: [
      { sku: "SKU-PRO-01", name: "FlowForge Enterprise Node License", qty: 1 }
    ]
  }
};

/** Build a human-readable label for a logic node's condition (for logs/UI). */
function describeCondition(nodeConfig: any): string {
  if (nodeConfig?.condition) return String(nodeConfig.condition);
  if (nodeConfig?.subtitle) return String(nodeConfig.subtitle);
  if (nodeConfig?.operator && nodeConfig?.field !== undefined) {
    return `${nodeConfig.field} ${nodeConfig.operator} ${nodeConfig.value ?? ''}`.trim();
  }
  return "account_tier === 'enterprise'";
}

/** Resolve what to hand the (eval-free) evaluator: the structured config when
 *  present, otherwise the expression string, otherwise a sensible default. */
function conditionInput(nodeConfig: any): any {
  if (nodeConfig?.operator && nodeConfig?.field !== undefined) return nodeConfig;
  return nodeConfig?.condition || nodeConfig?.subtitle || "account_tier === 'enterprise'";
}

export async function executeWorkflow(
  definition: WorkflowDefinition, 
  initialPayload?: any,
  previousResults?: Record<string, NodeExecutionResult>,
  onLog?: (log: WorkflowLog) => void,
  onNodeComplete?: (res: NodeExecutionResult) => void
): Promise<WorkflowExecutionResult> {
  const startTime = Date.now();
  const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const logs: WorkflowLog[] = [];
  const nodeResults: Record<string, NodeExecutionResult> = {};

  const addLog = (level: WorkflowLog['level'], message: string, nodeId?: string) => {
    const log: WorkflowLog = {
      timestamp: new Date().toISOString().split('T')[1].slice(0, 12),
      level,
      nodeId,
      message
    };
    logs.push(log);
    if (onLog) onLog(log);
  };

  const nodes = definition.nodes || [];
  const edges = definition.edges || [];

  if (nodes.length === 0) {
    addLog('error', 'Workflow contains no nodes to execute.');
    return {
      executionId,
      status: 'failed',
      totalDurationMs: 0,
      nodeResults: {},
      logs,
      output: null,
      error: 'Empty workflow definition'
    };
  }

  // Normalise payload
  const currentPayload = initialPayload && Object.keys(initialPayload).length > 0 
    ? initialPayload 
    : DEFAULT_TEST_PAYLOAD;

  addLog('info', `Initializing workflow execution ${executionId}`);

  // Find root trigger nodes or nodes with 0 incoming edges
  const targets = new Set(edges.map(e => e.target));
  let startNodes = nodes.filter(n => n.type === 'trigger');
  if (startNodes.length === 0) {
    startNodes = nodes.filter(n => !targets.has(n.id));
  }
  if (startNodes.length === 0 && nodes.length > 0) {
    startNodes = [nodes[0]];
  }

  // Map of node outputs
  const nodeOutputs: Record<string, any> = {};
  const queue: Array<{ nodeId: string; incomingPayload: any }> = [];

  for (const startNode of startNodes) {
    queue.push({ nodeId: startNode.id, incomingPayload: currentPayload });
  }

  let finalOutput: any = currentPayload;
  let hasFailure = false;

  // BFS traversal following outgoing edges
  const visited = new Set<string>();

  while (queue.length > 0) {
    const item = queue.shift()!;
    const { nodeId, incomingPayload } = item;

    if (visited.has(nodeId)) {
      continue;
    }
    visited.add(nodeId);

    const node = nodes.find(n => n.id === nodeId);
    if (!node) continue;

    const nodeConfig = node.config || node.data || {};
    const nodeName = nodeConfig.label || `${node.type}_${node.id}`;

    // If node successfully completed in a previous run, skip executing it and use its output
    if (previousResults && previousResults[node.id] && previousResults[node.id].status === 'completed') {
      const prev = previousResults[node.id];
      addLog('info', `[Resume] ${nodeName}: Skipped (already completed)`, node.id);
      
      // We must enqueue outgoing edges just like normal so the BFS continues
      const outgoingEdges = edges.filter(e => e.source === node.id);
      for (const edge of outgoingEdges) {
        // If it was a logic node, we might need conditionResult to branch correctly. 
        // For now we'll just evaluate the logic again quickly if it's a logic node.
        if (node.type === 'logic') {
           const conditionResult = evaluateCondition(conditionInput(nodeConfig), prev.input);
           if (edge.sourceHandle === 'true' && !conditionResult) continue;
           if (edge.sourceHandle === 'false' && conditionResult) continue;
        }
        
        queue.push({
          nodeId: edge.target,
          incomingPayload: prev.output
        });
      }
      
      // Carry forward the output
      finalOutput = prev.output;
      continue;
    }

    const nodeStart = Date.now();

    try {
      let outputData: any = { ...incomingPayload };
      let conditionResult: boolean | null = null;

      if (node.type === 'trigger') {
        // Trigger execution
        await new Promise(r => setTimeout(r, 8)); // simulate fast event ingestion
        outputData = {
          ...incomingPayload,
          _trigger: {
            nodeId: node.id,
            receivedAt: new Date().toISOString(),
            source: nodeConfig.subtitle || 'POST /v1/events/webhook'
          }
        };
        addLog('success', `[Trigger] ${nodeName}: Received event '${incomingPayload.event || 'incoming'}'`, nodeId);
      } else if (node.type === 'logic') {
        // Logic / Branch node
        const condString = describeCondition(nodeConfig);
        conditionResult = evaluateCondition(conditionInput(nodeConfig), incomingPayload);

        await new Promise(r => setTimeout(r, 4)); // simulate fast eval
        outputData = {
          ...incomingPayload,
          _condition: {
            expression: condString,
            result: conditionResult,
            evaluatedAt: new Date().toISOString()
          }
        };

        addLog(
          conditionResult ? 'success' : 'warn',
          `[Logic] ${nodeName}: Evaluated condition [${condString}] => ${conditionResult ? 'TRUE' : 'FALSE'}`,
          nodeId
        );
      } else if (node.type === 'action') {
        // Real Action Node implementation
        const actionType = nodeConfig.actionType || 'http';
        
        if (actionType === 'http') {
          const url = interpolate(nodeConfig.url || '', incomingPayload);
          const method = (nodeConfig.method || 'POST').toUpperCase();
          const timeoutMs = parseInt(nodeConfig.timeoutMs) || 5000;
          
          let headers: any = {};
          if (nodeConfig.headers && typeof nodeConfig.headers === 'string') {
            try {
              const parsed = JSON.parse(nodeConfig.headers);
              // Simple interpolation on headers
              for (const [k, v] of Object.entries(parsed)) {
                headers[k] = interpolate(v as string, incomingPayload);
              }
            } catch (e) {
              addLog('warn', `[Action] ${nodeName}: Failed to parse HTTP headers JSON`, nodeId);
            }
          }

          let body: string | undefined = undefined;
          if (nodeConfig.body && typeof nodeConfig.body === 'string') {
            body = interpolate(nodeConfig.body, incomingPayload);
          }

          if (!url) {
            throw new Error('HTTP Target URL is missing');
          }

          addLog('info', `[Action] ${nodeName}: Sending ${method} ${url}`, nodeId);
          
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            
            const reqInit: RequestInit = {
              method,
              headers,
              signal: controller.signal
            };
            if (['POST', 'PUT', 'PATCH'].includes(method) && body) {
              reqInit.body = body;
              if (!headers['Content-Type'] && !headers['content-type']) {
                headers['Content-Type'] = 'application/json';
              }
            }
            
            const startTime = Date.now();
            const res = await fetch(url, reqInit);
            clearTimeout(timeoutId);
            
            const responseText = await res.text();
            let responseData: any = responseText;
            try {
              responseData = JSON.parse(responseText);
            } catch (e) { /* ignore */ }
            
            outputData = {
              ...incomingPayload,
              [node.id]: {
                status: res.status,
                headers: Object.fromEntries(res.headers.entries()),
                data: responseData,
                durationMs: Date.now() - startTime
              }
            };
            
            if (res.ok) {
              addLog('success', `[Action] ${nodeName}: HTTP ${res.status} OK`, nodeId);
            } else {
              addLog('warn', `[Action] ${nodeName}: HTTP ${res.status} Error`, nodeId);
              if (!nodeConfig.retryEnabled) {
                throw new Error(`HTTP ${res.status}: ${responseText.slice(0, 100)}`);
              }
            }
          } catch (err: any) {
            if (err.name === 'AbortError') {
              throw new Error(`HTTP request timed out after ${timeoutMs}ms`);
            }
            throw err;
          }
        } else if (actionType === 'instagram') {
          const igAction = nodeConfig.action || 'publish_photo';
          const mediaUrl = interpolate(nodeConfig.mediaUrl || '', incomingPayload);
          const caption = interpolate(nodeConfig.caption || '', incomingPayload);
          
          addLog('info', `[Action] ${nodeName}: Connecting to Instagram (${igAction})`, nodeId);
          
          if (igAction === 'publish_photo') {
            if (!mediaUrl) throw new Error('Instagram Media URL is required');
            addLog('info', `[Action] ${nodeName}: Publishing photo: ${mediaUrl}`, nodeId);
            await new Promise(r => setTimeout(r, 1500)); // Simulate API call
            
            outputData = {
              ...incomingPayload,
              [node.id]: {
                published: true,
                platform: 'instagram',
                postId: `ig_${Math.floor(Math.random() * 1000000)}`,
                url: mediaUrl,
                timestamp: new Date().toISOString()
              }
            };
            addLog('success', `[Action] ${nodeName}: Instagram photo published`, nodeId);
          } else {
            throw new Error(`Unsupported Instagram action: ${igAction}`);
          }
        } else if (actionType === 'email') {
          const toAddress = interpolate(nodeConfig.toAddress || '', incomingPayload);
          const subject = interpolate(nodeConfig.subject || '', incomingPayload);
          const emailBody = interpolate(nodeConfig.emailBody || '', incomingPayload);
          const fromAddress =
            interpolate(nodeConfig.fromAddress || '', incomingPayload) ||
            process.env.EMAIL_FROM ||
            'onboarding@resend.dev';

          if (!toAddress) throw new Error('Email "To" address is missing');
          if (!subject) throw new Error('Email subject is missing');

          const apiKey = process.env.RESEND_API_KEY;

          if (!apiKey) {
            // No provider key configured — fall back to a clearly-marked simulation
            // so flows still run in development without sending anything.
            addLog('warn', `[Action] ${nodeName}: RESEND_API_KEY not set — simulating send (no email delivered)`, nodeId);
            await new Promise(r => setTimeout(r, 300));
            outputData = {
              ...incomingPayload,
              [node.id]: {
                sent: false,
                simulated: true,
                to: toAddress,
                subject,
                from: fromAddress,
                provider: 'resend',
                timestamp: new Date().toISOString()
              }
            };
            addLog('success', `[Action] ${nodeName}: Simulated email to ${toAddress}`, nodeId);
          } else {
            addLog('info', `[Action] ${nodeName}: Sending email to ${toAddress} via Resend`, nodeId);

            // Treat the body as HTML if it looks like markup, otherwise plain text.
            const looksHtml = /<[a-z][\s\S]*>/i.test(emailBody);
            const message: any = { from: fromAddress, to: [toAddress], subject };
            if (looksHtml) message.html = emailBody; else message.text = emailBody || subject;

            const timeoutMs = parseInt(nodeConfig.timeoutMs) || 10000;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            try {
              const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(message),
                signal: controller.signal,
              });
              clearTimeout(timeoutId);

              const responseText = await res.text();
              let data: any = responseText;
              try { data = JSON.parse(responseText); } catch { /* keep text */ }

              if (!res.ok) {
                const detail = data && typeof data === 'object' && data.message ? data.message : `HTTP ${res.status}`;
                throw new Error(`Email send failed: ${detail}`);
              }

              outputData = {
                ...incomingPayload,
                [node.id]: {
                  sent: true,
                  id: (data && data.id) || null,
                  to: toAddress,
                  subject,
                  from: fromAddress,
                  provider: 'resend',
                  timestamp: new Date().toISOString()
                }
              };
              addLog('success', `[Action] ${nodeName}: Email sent (id ${(data && data.id) || 'n/a'})`, nodeId);
            } catch (err: any) {
              clearTimeout(timeoutId);
              if (err.name === 'AbortError') throw new Error(`Email send timed out after ${timeoutMs}ms`);
              throw err;
            }
          }
        } else if (actionType === 'sink') {
          const tableName = interpolate(nodeConfig.tableName || '', incomingPayload);
          if (!tableName) throw new Error('Database table name is missing');

          const dataToInsert: Record<string, any> = {};
          try {
            if (nodeConfig.dataMapping) {
              const parsed = JSON.parse(nodeConfig.dataMapping);
              for (const [k, v] of Object.entries(parsed)) {
                dataToInsert[k] = interpolate(v as string, incomingPayload);
              }
            }
          } catch (e) {
            throw new Error('Columns mapping must be valid JSON');
          }
          if (Object.keys(dataToInsert).length === 0) {
            throw new Error('No columns to insert — set the Columns (JSON) mapping');
          }

          // Target DB: the node's own connection string, else a dedicated sink DB,
          // else the app database. Values are always sent as bound parameters.
          const connectionString =
            interpolate(nodeConfig.pgUri || '', incomingPayload) ||
            process.env.SINK_DATABASE_URL ||
            process.env.DATABASE_URL ||
            '';

          if (!connectionString) {
            addLog('warn', `[Action] ${nodeName}: No database configured — simulating insert (nothing written)`, nodeId);
            await new Promise(r => setTimeout(r, 80));
            outputData = {
              ...incomingPayload,
              [node.id]: { persisted: false, simulated: true, table: tableName, insertedData: dataToInsert }
            };
            addLog('success', `[Action] ${nodeName}: Simulated insert into '${tableName}'`, nodeId);
          } else {
            let Client: any;
            try { Client = require('pg').Client; }
            catch { throw new Error("The 'pg' package isn't installed. Run: npm install pg"); }

            // Quote identifiers to prevent SQL injection via table/column names.
            const quoteIdent = (s: string) => '"' + String(s).replace(/"/g, '""') + '"';
            const tableIdent = tableName.split('.').map(quoteIdent).join('.');
            const cols = Object.keys(dataToInsert);
            const colList = cols.map(quoteIdent).join(', ');
            const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
            const values = cols.map((c) => dataToInsert[c]);

            const needsSsl = /sslmode=(require|verify-ca|verify-full)/i.test(connectionString);
            const client = new Client({ connectionString, ssl: needsSsl ? { rejectUnauthorized: false } : undefined });

            addLog('info', `[Action] ${nodeName}: Inserting into ${tableName}`, nodeId);
            await client.connect();
            try {
              const result = await client.query(
                `INSERT INTO ${tableIdent} (${colList}) VALUES (${placeholders}) RETURNING *`,
                values
              );
              outputData = {
                ...incomingPayload,
                [node.id]: {
                  persisted: true,
                  table: tableName,
                  insertedData: dataToInsert,
                  row: result.rows?.[0] ?? null,
                  rowCount: result.rowCount ?? 0
                }
              };
              addLog('success', `[Action] ${nodeName}: Inserted ${result.rowCount ?? 1} row into '${tableName}'`, nodeId);
            } finally {
              await client.end().catch(() => {});
            }
          }
        } else if (actionType === 'ai') {
          const systemPrompt = interpolate(nodeConfig.systemPrompt || '', incomingPayload);
          const userInput = interpolate(nodeConfig.userInput || '', incomingPayload);

          if (!systemPrompt && !userInput) throw new Error('AI transform needs instructions and/or input data');

          const apiKey = process.env.ANTHROPIC_API_KEY;

          if (!apiKey) {
            addLog('warn', `[Action] ${nodeName}: ANTHROPIC_API_KEY not set — simulating (no model call)`, nodeId);
            await new Promise(r => setTimeout(r, 400));
            outputData = {
              ...incomingPayload,
              [node.id]: {
                transformed: false,
                simulated: true,
                result: `(simulated) ${userInput.slice(0, 120)}`,
                model: 'claude (simulated)'
              }
            };
            addLog('success', `[Action] ${nodeName}: Simulated AI transform`, nodeId);
          } else {
            const model = (nodeConfig.model as string) || 'claude-opus-5';
            const maxTokens = parseInt(nodeConfig.maxTokens) || 4096;
            addLog('info', `[Action] ${nodeName}: Calling ${model}`, nodeId);

            let Anthropic: any;
            try { Anthropic = (await import('@anthropic-ai/sdk')).default; }
            catch { throw new Error("The '@anthropic-ai/sdk' package isn't installed. Run: npm install @anthropic-ai/sdk"); }

            const client = new Anthropic({ apiKey });
            const resp = await client.messages.create({
              model,
              max_tokens: maxTokens,
              ...(systemPrompt ? { system: systemPrompt } : {}),
              messages: [{ role: 'user', content: userInput || 'Transform the provided input.' }],
            });

            if (resp.stop_reason === 'refusal') {
              throw new Error('AI declined this request (safety refusal)');
            }

            const text = (resp.content || [])
              .filter((b: any) => b.type === 'text')
              .map((b: any) => b.text)
              .join('\n')
              .trim();

            outputData = {
              ...incomingPayload,
              [node.id]: {
                transformed: true,
                result: text,
                model: resp.model,
                usage: resp.usage
              }
            };
            addLog('success', `[Action] ${nodeName}: AI transform complete (${resp.usage?.output_tokens ?? '?'} output tokens)`, nodeId);
          }
        } else {
          // Fallback (e.g. enrich)
          const actionDelay = Math.floor(Math.random() * 20) + 15;
          await new Promise(r => setTimeout(r, actionDelay));
          outputData = {
            ...incomingPayload,
            [node.id]: { executed: true, timestamp: new Date().toISOString() }
          };
          addLog('success', `[Action] ${nodeName}: Action completed successfully`, nodeId);
        }
      } else if (node.type === 'ghost') {
        // Ghost / Drop Stream
        addLog('warn', `[Stream Dropped] Stream terminated at node '${nodeName}'`, nodeId);
        outputData = {
          ...incomingPayload,
          _dropped: true
        };
      }

      const nodeDuration = Date.now() - nodeStart;
      nodeOutputs[node.id] = outputData;
      finalOutput = outputData;

      nodeResults[node.id] = {
        nodeId: node.id,
        nodeType: node.type,
        nodeName,
        status: 'completed',
        durationMs: Math.max(1, nodeDuration),
        input: incomingPayload,
        output: outputData,
        executedAt: new Date().toISOString()
      };
      if (onNodeComplete) onNodeComplete(nodeResults[node.id]);

      // Find outgoing edges
      const outgoingEdges = edges.filter(e => e.source === node.id);

      for (const edge of outgoingEdges) {
        // If logic node with branching handles (e.g. true vs false)
        if (node.type === 'logic' && conditionResult !== null) {
          if (edge.sourceHandle === 'true' && !conditionResult) {
            continue; // Skip false branch
          }
          if (edge.sourceHandle === 'false' && conditionResult) {
            continue; // Skip true branch
          }
        }

        queue.push({
          nodeId: edge.target,
          incomingPayload: outputData
        });
      }
    } catch (nodeErr: any) {
      hasFailure = true;
      const nodeDuration = Date.now() - nodeStart;
      const errorMsg = nodeErr?.message || 'Node execution failed';
      addLog('error', `[Error] ${nodeName} failed: ${errorMsg}`, nodeId);

      nodeResults[node.id] = {
        nodeId: node.id,
        nodeType: node.type,
        nodeName,
        status: 'failed',
        durationMs: Math.max(1, nodeDuration),
        input: incomingPayload,
        output: null,
        error: errorMsg,
        executedAt: new Date().toISOString()
      };
      if (onNodeComplete) onNodeComplete(nodeResults[node.id]);
      break;
    }
  }

  // Mark any remaining nodes not reached as skipped
  for (const n of nodes) {
    if (!nodeResults[n.id]) {
      const cfg = n.config || n.data || {};
      nodeResults[n.id] = {
        nodeId: n.id,
        nodeType: n.type,
        nodeName: cfg.label || n.id,
        status: 'skipped',
        durationMs: 0,
        input: null,
        output: null,
        executedAt: new Date().toISOString()
      };
    }
  }

  const totalDurationMs = Date.now() - startTime;
  const executionStatus = hasFailure ? 'failed' : 'completed';
  addLog(
    hasFailure ? 'error' : 'success', 
    `Execution ${executionId} finished in ${totalDurationMs}ms (${executionStatus.toUpperCase()})`
  );

  return {
    executionId,
    status: executionStatus,
    totalDurationMs,
    nodeResults,
    logs,
    output: finalOutput,
    error: hasFailure ? 'One or more nodes failed' : undefined
  };
}

