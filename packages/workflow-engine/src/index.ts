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

function evaluateCondition(conditionStr: string, payload: any): boolean {
  if (!conditionStr || !conditionStr.trim()) return true;
  let clean = conditionStr.replace(/^IF:\s*/i, '').replace(/eval:\s*/i, '').trim();
  
  try {
    const keys = Object.keys(payload || {});
    const values = Object.values(payload || {});
    const fn = new Function('payload', ...keys, `try { return Boolean(${clean}); } catch (e) { return false; }`);
    return Boolean(fn(payload, ...values));
  } catch {
    try {
      const fnFallback = new Function('payload', `try { with(payload) { return Boolean(${clean}); } } catch (e) { return false; }`);
      return Boolean(fnFallback(payload));
    } catch {
      return false;
    }
  }
}

export async function executeWorkflow(
  definition: WorkflowDefinition, 
  initialPayload?: any
): Promise<WorkflowExecutionResult> {
  const startTime = Date.now();
  const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const logs: WorkflowLog[] = [];
  const nodeResults: Record<string, NodeExecutionResult> = {};

  const addLog = (level: WorkflowLog['level'], message: string, nodeId?: string) => {
    logs.push({
      timestamp: new Date().toISOString().split('T')[1].slice(0, 12),
      level,
      nodeId,
      message
    });
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
        const condString = nodeConfig.condition || nodeConfig.subtitle || "account_tier === 'enterprise'";
        conditionResult = evaluateCondition(condString, incomingPayload);
        
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
        // Action node
        const actionDelay = Math.floor(Math.random() * 20) + 15; // 15-35ms
        await new Promise(r => setTimeout(r, actionDelay));

        const actionType = (nodeConfig.label || '').toLowerCase();
        if (actionType.includes('enrich') || actionType.includes('clearbit')) {
          outputData = {
            ...incomingPayload,
            enrichedData: {
              company: "Cyberdyne Systems Inc.",
              domain: "cyberdyne.io",
              industry: "Autonomous Technology & Robotics",
              employees: "1,000-5,000",
              verified: true,
              country: "US"
            }
          };
          addLog('success', `[Action] ${nodeName}: Enriched customer profile via Clearbit API (200 OK)`, nodeId);
        } else if (actionType.includes('postgres') || actionType.includes('sink') || actionType.includes('slack')) {
          outputData = {
            ...incomingPayload,
            sinkStatus: {
              postgres: "persisted",
              recordId: `row_${Date.now().toString().slice(-6)}`,
              slackAlert: "dispatched #enterprise-alerts",
              queueAck: "BullMQ_ACK_OK"
            }
          };
          addLog('success', `[Action] ${nodeName}: Successfully written to Postgres & Slack alert queued`, nodeId);
        } else if (actionType.includes('resend') || actionType.includes('email')) {
          outputData = {
            ...incomingPayload,
            emailDelivery: {
              id: `msg_${Math.random().toString(36).substring(2, 9)}`,
              to: incomingPayload.customer?.email || 'user@example.com',
              status: 'sent'
            }
          };
          addLog('success', `[Action] ${nodeName}: Transactional notification dispatched via Resend`, nodeId);
        } else {
          outputData = {
            ...incomingPayload,
            actionResult: {
              executed: true,
              timestamp: new Date().toISOString()
            }
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

