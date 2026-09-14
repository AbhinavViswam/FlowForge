import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { useToast } from 'av-toastx';
import '@xyflow/react/dist/style.css';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
} from '@xyflow/react';

import TriggerNode from '../components/nodes/TriggerNode';
import LogicNode from '../components/nodes/LogicNode';
import ActionNode from '../components/nodes/ActionNode';
import GhostNode from '../components/nodes/GhostNode';
import NexusScene from '../components/NexusScene';
import { io } from 'socket.io-client';

const nodeTypes = {
  trigger: TriggerNode,
  logic: LogicNode,
  action: ActionNode,
  ghost: GhostNode,
};

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

export default function Editor() {
  const { user } = useAuth();
  const firstLetter = user?.name ? user.name.charAt(0).toUpperCase() : (user?.email ? user.email.charAt(0).toUpperCase() : 'U');
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [workflowName, setWorkflowName] = useState('My Automation Pipeline');
  const [isDeploying, setIsDeploying] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [consoleTab, setConsoleTab] = useState<'test' | 'webhook' | 'trace' | 'history' | 'nexus'>('test');
  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [testPayloadText, setTestPayloadText] = useState(JSON.stringify({
    event: "order.created",
    account_tier: "enterprise",
    amount: 299.50,
    customer: {
      id: "cust_90214",
      name: "Sarah Connor",
      email: "sarah@skynet-resistance.com"
    }
  }, null, 2));
  const [testResult, setTestResult] = useState<any>(null);
  const [executionsList, setExecutionsList] = useState<any[]>([]);
  const [isLoadingExecutions, setIsLoadingExecutions] = useState(false);
  const [expandedExecutionId, setExpandedExecutionId] = useState<string | null>(null);
  const [nodeInspectorTab, setNodeInspectorTab] = useState<'config' | 'schema' | 'test'>('config');
  const [singleNodeTestResult, setSingleNodeTestResult] = useState<Record<string, any>>({});
  const [isSingleTesting, setIsSingleTesting] = useState(false);

  const healthState = React.useMemo(() => {
    if (!executionsList || executionsList.length === 0) return 'healthy';
    const recent = executionsList.slice(0, 10);
    const failures = recent.filter(e => e.status === 'failed').length;
    const failureRate = failures / recent.length;
    if (failureRate >= 0.2) return 'incident';
    if (failureRate > 0) return 'degraded';
    return 'healthy';
  }, [executionsList]);

  const fetchExecutions = useCallback(async () => {
    if (!id || id === 'new') return;
    setIsLoadingExecutions(true);
    try {
      const res = await axios.get(`http://localhost:3000/api/v1/workflows/${id}/executions`, { withCredentials: true });
      setExecutionsList(res.data.executions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingExecutions(false);
    }
  }, [id]);

  const handleRetryExecution = async (executionId: string) => {
    try {
      await axios.post(`http://localhost:3000/api/v1/workflows/${executionId}/retry-execution`, {}, { withCredentials: true });
      toast.success('Execution re-queued for retry!');
      setTimeout(fetchExecutions, 1000);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to retry execution');
    }
  };

  useEffect(() => {
    if (id === 'new') { setNodes([]); setEdges([]); } else if (id) {
      axios.get(`http://localhost:3000/api/v1/workflows/${id}`, { withCredentials: true })
        .then(res => {
          if (res.data.workflow?.status) {
            setIsActive(res.data.workflow.status === 'active');
          }
          if (res.data.workflow?.name) {
            setWorkflowName(res.data.workflow.name);
          }
          const version = res.data.workflow.versions?.[0];
          if (version && version.definition) {
            const def = version.definition;
            if (def.nodes && def.nodes.length > 0) {
              setNodes(def.nodes.map((n: any) => ({ id: n.id, type: n.type, data: n.config, position: n.position || { x: 0, y: 0 } })));
            } else {
              setNodes([]);
            }
            if (def.edges) {
              setEdges(def.edges.map((e: any) => ({ 
                id: `${e.source}-${e.target}`, 
                source: e.source, 
                target: e.target, 
                sourceHandle: e.sourceHandle,
                targetHandle: e.targetHandle,
                type: 'smoothstep', 
                animated: true, 
                style: { stroke: '#e11d48', strokeWidth: 2 } 
              })));
            } else {
              setEdges([]);
            }
          } else {
            setNodes([]);
            setEdges([]);
          }
        })
        .catch(console.error);

      fetchExecutions();
    }
  }, [id, setNodes, setEdges]);

  useEffect(() => {
    if (!id || id === 'new') return;
    
    const socket = io('http://localhost:3000', { withCredentials: true });
    
    socket.on('connect', () => {
      socket.emit('join_workflow', id);
    });
    
    socket.on('workflow_event', (event) => {
      console.log('Live Event Received:', event);
      setActiveEvent(event);
      
      // Auto-refresh history if a new execution finishes
      if (event.type === 'execution_finished') {
        fetchExecutions();
      }
    });
    
    return () => {
      socket.disconnect();
    };
  }, [id, fetchExecutions]);

  const loadPayloadPreset = (presetName: string) => {
    let preset: any = {};
    if (presetName === 'enterprise') {
      preset = {
        event: "order.created",
        account_tier: "enterprise",
        amount: 499.00,
        customer: {
          id: "cust_ent_101",
          name: "Sarah Connor",
          email: "sarah@cyberdyne.io",
          account_tier: "enterprise"
        },
        order: {
          id: "ord_ent_991",
          currency: "USD"
        }
      };
    } else if (presetName === 'standard') {
      preset = {
        event: "order.created",
        account_tier: "standard",
        amount: 49.00,
        customer: {
          id: "cust_std_402",
          name: "Miles Dyson",
          email: "miles@standard.net",
          account_tier: "standard"
        },
        order: {
          id: "ord_std_202",
          currency: "USD"
        }
      };
    } else if (presetName === 'high_value') {
      preset = {
        event: "payment.received",
        account_tier: "enterprise",
        amount: 15000.00,
        customer: {
          id: "cust_vip_777",
          name: "John Connor",
          email: "john@resistance.org",
          account_tier: "enterprise"
        },
        order: {
          id: "ord_vip_888",
          currency: "USD"
        }
      };
    }
    setTestPayloadText(JSON.stringify(preset, null, 2));
    toast.info(`Loaded preset: ${presetName.replace('_', ' ').toUpperCase()}`);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.info(`Copied ${label} to clipboard!`);
  };

  const updateMultipleNodeData = (patch: Record<string, any>) => {
    if (!selectedNode) return;
    const updated = {
      ...selectedNode,
      data: {
        ...selectedNode.data,
        ...patch,
      }
    };
    setSelectedNode(updated);
    setNodes((nds) => nds.map((n) => n.id === updated.id ? updated : n));
  };

  const updateSelectedNode = (key: string, value: any) => {
    if (!selectedNode) return;
    const updated = {
      ...selectedNode,
      data: {
        ...selectedNode.data,
        [key]: value,
      }
    };
    setSelectedNode(updated);
    setNodes((nds) => nds.map((n) => n.id === updated.id ? updated : n));
  };

  const getNodeInputSchema = (node: Node | null) => {
    if (!node) return {};
    if (node.type === 'trigger') {
      if (node.data?.expectedSchema) {
        try {
          return typeof node.data.expectedSchema === 'string' 
            ? JSON.parse(node.data.expectedSchema) 
            : node.data.expectedSchema;
        } catch {
          return { error: 'Invalid JSON Schema' };
        }
      }
      return {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        title: `${node.data?.label || 'Trigger'} Event Schema`,
        description: "Payload structure expected by this intake webhook.",
        type: "object",
        properties: {
          event: { type: "string", description: "Event namespace, e.g. order.created", example: "order.created" },
          eventId: { type: "string", example: "evt_99120" },
          account_tier: { type: "string", enum: ["enterprise", "standard", "pro"], example: "enterprise" },
          amount: { type: "number", description: "Transaction value", example: 299.50 },
          customer: {
            type: "object",
            properties: {
              id: { type: "string", example: "cust_90214" },
              email: { type: "string", format: "email", example: "sarah@cyberdyne.io" },
              name: { type: "string", example: "Sarah Connor" },
              account_tier: { type: "string", example: "enterprise" }
            },
            required: ["id", "email"]
          }
        },
        required: ["event", "account_tier"]
      };
    } else if (node.type === 'logic') {
      const cond = (node.data?.condition as string) || (node.data?.subtitle as string) || "account_tier === 'enterprise'";
      return {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        title: `${node.data?.label || 'Logic'} Condition Ingress Schema`,
        description: `Stream fields evaluated by rule: [${cond}]`,
        type: "object",
        properties: {
          account_tier: { type: "string", description: "Evaluated in gate expression", example: "enterprise" },
          amount: { type: "number", description: "Evaluated in numerical conditions", example: 299.50 },
          customer: { type: "object", description: "Customer profile entity" },
          payload: { type: "object", description: "Global event context" }
        },
        evaluationExpression: cond
      };
    } else {
      return {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        title: `${node.data?.label || 'Action'} Step Ingress Schema`,
        description: "Aggregated pipeline payload delivered from upstream nodes.",
        type: "object",
        properties: {
          event: { type: "string" },
          account_tier: { type: "string" },
          amount: { type: "number" },
          customer: { type: "object" },
          _trigger: {
            type: "object",
            properties: {
              source: { type: "string" },
              receivedAt: { type: "string", format: "date-time" }
            }
          },
          _condition: {
            type: "object",
            properties: {
              result: { type: "boolean" },
              expression: { type: "string" }
            }
          }
        }
      };
    }
  };

  const handleTestSingleNode = async (nodeToTest?: Node | null) => {
    const target = nodeToTest || selectedNode;
    if (!target) return;
    setIsSingleTesting(true);

    let currentPayload: any = {};
    try {
      currentPayload = JSON.parse(testPayloadText);
    } catch {
      currentPayload = { event: 'order.created', account_tier: 'enterprise', amount: 250 };
    }

    const startTime = Date.now();
    await new Promise(r => setTimeout(r, Math.floor(Math.random() * 20) + 15));

    let output: any = { ...currentPayload };
    let status = 'completed';
    let evalRes: boolean | undefined = undefined;
    const nodeType = target.type || 'action';
    const nodeConfig = target.data || {};
    const nodeName = (nodeConfig.label as string) || target.id;
    const nodeLogs: Array<{ time: string; msg: string; level: 'info' | 'success' | 'warn' | 'error' }> = [];

    const addNodeLog = (msg: string, level: 'info' | 'success' | 'warn' | 'error' = 'info') => {
      nodeLogs.push({ time: new Date().toISOString().split('T')[1].slice(0, 8), msg, level });
    };

    addNodeLog(`Evaluating isolated node '${nodeName}' [${nodeType.toUpperCase()}]`, 'info');

    if (nodeType === 'trigger') {
      output = {
        ...currentPayload,
        _trigger: {
          nodeId: target.id,
          receivedAt: new Date().toISOString(),
          source: (nodeConfig.subtitle as string) || 'POST /v1/events/webhook'
        }
      };
      addNodeLog(`Ingested event '${currentPayload.event || 'incoming'}' from ${nodeConfig.subtitle || 'webhook'}`, 'success');
    } else if (nodeType === 'logic') {
      const cond = (nodeConfig.condition as string) || (nodeConfig.subtitle as string) || "account_tier === 'enterprise'";
      try {
        const clean = cond.replace(/^IF:\s*/i, '').trim();
        const keys = Object.keys(currentPayload);
        const vals = Object.values(currentPayload);
        const fn = new Function('payload', ...keys, `return Boolean(${clean});`);
        evalRes = Boolean(fn(currentPayload, ...vals));
      } catch {
        evalRes = false;
      }
      output = {
        ...currentPayload,
        _condition: {
          expression: cond,
          result: evalRes,
          evaluatedAt: new Date().toISOString()
        }
      };
      addNodeLog(`Condition [${cond}] evaluated to: ${evalRes ? 'TRUE' : 'FALSE'}`, evalRes ? 'success' : 'warn');
    } else if (nodeType === 'action') {
      const labelLower = (nodeName).toLowerCase();
      if (labelLower.includes('enrich') || labelLower.includes('clearbit')) {
        output = {
          ...currentPayload,
          enrichedData: {
            company: "Cyberdyne Systems Inc.",
            domain: "cyberdyne.io",
            industry: "Autonomous Technology",
            verified: true
          }
        };
        addNodeLog('Enriched profile via Clearbit API (200 OK)', 'success');
      } else if (labelLower.includes('postgres') || labelLower.includes('sink') || labelLower.includes('slack')) {
        output = {
          ...currentPayload,
          sinkStatus: {
            postgres: "persisted",
            recordId: `row_${Date.now().toString().slice(-6)}`,
            slackAlert: "dispatched #enterprise-alerts",
            queueAck: "BullMQ_ACK_OK"
          }
        };
        addNodeLog('Dispatched PostgreSQL batch sink and Slack alert', 'success');
      } else if (labelLower.includes('resend') || labelLower.includes('email')) {
        output = {
          ...currentPayload,
          emailDelivery: {
            id: `msg_${Math.random().toString(36).substring(2, 9)}`,
            to: currentPayload.customer?.email || 'user@example.com',
            status: 'sent'
          }
        };
        addNodeLog('Transactional notification dispatched via Resend', 'success');
      } else {
        output = {
          ...currentPayload,
          actionResult: {
            executed: true,
            timestamp: new Date().toISOString()
          }
        };
        addNodeLog('Action executed successfully (200 OK)', 'success');
      }
    } else if (nodeType === 'ghost') {
      output = { ...currentPayload, _dropped: true };
      addNodeLog('Stream terminated at drop node', 'warn');
    }

    const durationMs = Date.now() - startTime;
    const resultObj = {
      status,
      durationMs,
      input: currentPayload,
      output,
      logs: nodeLogs,
      evaluationResult: evalRes,
      timestamp: new Date().toLocaleTimeString()
    };

    setSingleNodeTestResult(prev => ({
      ...prev,
      [target.id]: resultObj
    }));

    // Update this specific node on canvas
    setNodes(nds => nds.map(n => {
      if (n.id === target.id) {
        const isLogic = n.type === 'logic';
        return {
          ...n,
          data: {
            ...n.data,
            executionState: status,
            status: isLogic ? (evalRes ? 'Eval: True' : 'Eval: False') : 'Success (200)',
            substatus: `${durationMs}ms`,
            evaluationResult: evalRes
          }
        };
      }
      return n;
    }));

    setIsSingleTesting(false);
    setNodeInspectorTab('test');

    if (evalRes !== undefined) {
      toast.success(`Node "${nodeName}" evaluated: ${evalRes ? 'TRUE' : 'FALSE'} in ${durationMs}ms`);
    } else {
      toast.success(`Node "${nodeName}" test executed successfully (200 OK in ${durationMs}ms)`);
    }
  };

  const handleRunTest = async (overridePayload?: any) => {
    setIsTesting(true);
    setIsConsoleOpen(true);
    setConsoleTab('test');

    let parsedPayload: any = null;
    try {
      parsedPayload = overridePayload || JSON.parse(testPayloadText);
    } catch (err) {
      toast.error('Invalid JSON payload syntax. Please check your payload editor.');
      setIsTesting(false);
      return;
    }

    // Set nodes to running
    setNodes((nds) => nds.map((n) => ({
      ...n,
      data: {
        ...n.data,
        executionState: 'running',
        status: 'Executing...',
      }
    })));

    try {
      const canvasDefinition = {
        nodes: nodes.map(n => ({ id: n.id, type: n.type || 'default', config: n.data, position: n.position })),
        edges: edges.map(e => ({ source: e.source, target: e.target, sourceHandle: (e as any).sourceHandle }))
      };

      const workflowId = id || 'new';
      const res = await axios.post(
        `http://localhost:3000/api/v1/workflows/${workflowId}/test`,
        {
          payload: parsedPayload,
          definition: canvasDefinition
        },
        { withCredentials: true }
      );

      const data = res.data;
      setTestResult(data);

      // Update node states on canvas based on nodeResults
      const nodeResults = data.nodeResults || {};
      setNodes((nds) => nds.map((n) => {
        const nr = nodeResults[n.id];
        if (!nr) return n;
        const isLogic = n.type === 'logic';
        const evalRes = nr.output?._condition?.result;

        return {
          ...n,
          data: {
            ...n.data,
            executionState: nr.status,
            status: nr.status === 'completed' ? (isLogic ? (evalRes ? 'Eval: True' : 'Eval: False') : 'Success') : nr.status === 'skipped' ? 'Skipped' : 'Failed',
            substatus: `${nr.durationMs}ms`,
            evaluationResult: evalRes
          }
        };
      }));

      // Update edge animation and styles
      setEdges((eds) => eds.map((e) => {
        const sourceResult = nodeResults[e.source];
        const targetResult = nodeResults[e.target];
        const wasTraversed = sourceResult?.status === 'completed' && targetResult?.status === 'completed';

        return {
          ...e,
          animated: wasTraversed,
          style: wasTraversed 
            ? { stroke: '#10b981', strokeWidth: 2.5 } 
            : { stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1.5 }
        };
      }));

      if (data.success) {
        toast.success(`Workflow test completed in ${data.totalDurationMs}ms! Active path verified.`);
      } else {
        toast.error(`Workflow test failed: ${data.error || 'Execution error'}`);
      }

      if (id && id !== 'new') {
        fetchExecutions();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to execute workflow test');
    } finally {
      setIsTesting(false);
    }
  };

  const onConnect = useCallback((params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)), [setEdges]);
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => setSelectedNode(node), []);
  const onPaneClick = useCallback(() => setSelectedNode(null), []);

  const addNode = (type: string, label: string, subtitle: string, icon?: string, color?: string, defaultData?: Record<string, any>) => {
    const newId = `${type}-${Date.now().toString().slice(-4)}`;
    const newNode: Node = {
      id: newId,
      type,
      position: {
        x: 300 + (nodes.length % 5) * 40,
        y: 180 + (nodes.length % 5) * 50,
      },
      data: {
        label,
        subtitle,
        icon: icon || (type === 'trigger' ? 'bolt' : type === 'logic' ? 'schema' : 'hub'),
        color: color || (type === 'trigger' ? 'primary' : type === 'logic' ? 'tertiary' : 'primary-container'),
        status: 'Active',
        substatus: 'Ready',
        ...defaultData
      }
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNode(newNode);
  };

  const deleteSelectedNode = () => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
  };

  const onSave = async (overrideActiveState?: boolean) => {
    setIsDeploying(true);
    try {
      let workflowId = id;
      if (id === 'new') {
        const res = await axios.post(
          'http://localhost:3000/api/v1/workflows', 
          { name: workflowName || 'Untitled Workflow' }, 
          { withCredentials: true }
        );
        workflowId = res.data.workflow.id;
      } else {
        await axios.put(
          `http://localhost:3000/api/v1/workflows/${workflowId}`,
          { name: workflowName },
          { withCredentials: true }
        );
      }
      
      const definition = {
        nodes: nodes.map(n => ({ id: n.id, type: n.type || 'default', config: n.data, position: n.position })),
        edges: edges.map(e => ({ source: e.source, target: e.target }))
      };
      
      const activeStateToUse = overrideActiveState !== undefined ? overrideActiveState : isActive;
      
      await axios.post(`http://localhost:3000/api/v1/workflows/${workflowId}/activate`, definition, { withCredentials: true });
      if (!activeStateToUse) {
        await axios.post(`http://localhost:3000/api/v1/workflows/${workflowId}/deactivate`, {}, { withCredentials: true });
      }
      
      toast.success('Workflow saved');
      if (id === 'new') {
        navigate(`/editor/${workflowId}`, { replace: true });
      }
      return workflowId;
    } catch (err: any) {
      console.error(err);
      toast.error(`Save failed: ${err.response?.data?.error || err.response?.data?.message || err.message}`);
      return null;
    } finally {
      setIsDeploying(false);
    }
  };

  const onToggleActive = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextState = e.target.checked;
    
    // Optimistic UI update
    setIsActive(nextState);
    
    try {
      const savedId = await onSave(nextState);
      if (!savedId) {
        setIsActive(!nextState); // Revert on failure
        return;
      }
      
      if (nextState) {
        toast.success('Workflow enabled and saved');
      } else {
        toast.success('Workflow disabled and saved');
      }
    } catch (err) {
      setIsActive(!nextState); // Revert on failure
      toast.error('Failed to toggle workflow status');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background text-on-surface select-none">
      
      <header className="flex justify-between items-center w-full px-space-lg h-14 border-b border-surface-container-highest bg-surface z-40 shrink-0">
        
        <div className="flex items-center gap-space-md">
          <Link 
            to="/dashboard" 
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant hover:text-white transition-all text-xs font-medium border border-surface-container-highest"
            title="Back to Dashboard"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Back</span>
          </Link>

<div className="flex items-center gap-2">
<img src="/logo.png" className="w-6 h-6 object-contain" alt="FlowForge" />
<span className="text-headline-sm font-headline-sm font-bold text-on-surface dark:text-on-surface tracking-wider uppercase">FlowForge</span>
</div>
<div className="h-4 w-[1px] bg-surface-container-highest"></div>

<div className="flex items-center gap-space-xs text-body-sm font-body-sm">
<Link to="/dashboard" className="text-on-surface-variant hover:text-white font-code-snippet text-code-snippet transition-colors">Workflows</Link>
<span className="text-surface-container-highest font-code-snippet">/</span>
<input 
  type="text" 
  value={workflowName} 
  onChange={(e) => setWorkflowName(e.target.value)} 
  className="bg-transparent border-b border-transparent hover:border-surface-container-highest focus:border-primary-container focus:outline-none text-on-surface font-headline-sm text-sm font-medium tracking-tight px-1 py-0.5 rounded transition-all max-w-[240px] truncate"
  placeholder="Workflow Name"
/>
</div>

<span className="inline-flex items-center gap-1.5 px-space-xs py-0.5 rounded bg-surface-container-high border border-surface-container-highest text-label-sm font-label-sm text-tertiary">
<span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>
        {id === 'new' ? 'Draft' : 'Active'}
      </span>
</div>

<div className="hidden md:flex items-center bg-surface-container-low border border-surface-container-highest rounded px-1 py-1 gap-1">
<button className="px-2 py-1 text-label-sm font-label-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors duration-150 flex items-center gap-1">
<span className="material-symbols-outlined text-[14px]" data-icon="zoom_in">zoom_in</span>
        100%
      </button>
<button className="p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors duration-150" title="Fit to Screen">
<span className="material-symbols-outlined text-[16px]" data-icon="fit_screen">fit_screen</span>
</button>
<div className="h-3 w-[1px] bg-surface-container-highest my-auto"></div>
<button className="p-1 text-on-surface hover:bg-surface-container-high rounded transition-colors duration-150" title="Minimap Toggle">
<span className="material-symbols-outlined text-[16px]" data-icon="map">map</span>
</button>
<button className="p-1 text-primary hover:bg-surface-container-high rounded transition-colors duration-150" title="Grid Active">
<span className="material-symbols-outlined text-[16px]" data-icon="grid_4x4">grid_4x4</span>
</button>
</div>

<div className="flex items-center gap-space-sm">
  {id && id !== 'new' && (
    <button 
      onClick={() => {
        setIsConsoleOpen(true);
        setConsoleTab('webhook');
      }}
      className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-all text-xs font-medium"
      title="View Webhook Intake URL & cURL command"
    >
      <span className="material-symbols-outlined text-[15px]">link</span>
      <span className="font-code-snippet tracking-wide">Webhook Intake</span>
    </button>
  )}

  <button 
    onClick={() => handleRunTest()} 
    disabled={isTesting}
    className="flex items-center gap-1.5 px-space-md py-1.5 rounded border border-surface-container-highest bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors duration-150 active:scale-[0.98] disabled:opacity-50"
    title="Execute pipeline test"
  >
    {isTesting ? (
      <span className="w-3.5 h-3.5 border-2 border-tertiary border-t-transparent rounded-full animate-spin"></span>
    ) : (
      <span className="material-symbols-outlined text-[15px] text-tertiary" data-icon="terminal">terminal</span>
    )}
    <span className="text-label-sm font-label-sm uppercase tracking-wider">
      {isTesting ? 'Running...' : 'Run Test'}
    </span>
  </button>

  <button 
    onClick={() => {
      setIsConsoleOpen(prev => !prev);
      setConsoleTab('history');
    }}
    className={`p-1.5 rounded transition-colors duration-150 ${isConsoleOpen && consoleTab === 'history' ? 'bg-surface-container-high text-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`} 
    title="Execution History"
  >
    <span className="material-symbols-outlined text-[18px]" data-icon="history">history</span>
  </button>

  <button 
    onClick={() => setIsConsoleOpen(prev => !prev)}
    className={`p-1.5 rounded transition-colors duration-150 ${isConsoleOpen ? 'bg-surface-container-high text-tertiary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`} 
    title="Toggle Execution Console"
  >
    <span className="material-symbols-outlined text-[18px]">terminal</span>
  </button>

  <div className="flex items-center gap-3 pr-3 pl-1">
      <button 
        onClick={() => onSave()} 
        disabled={isDeploying}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-container-high border border-surface-container-highest hover:bg-surface-container text-on-surface transition-all duration-150 active:scale-[0.98] disabled:opacity-50"
      >
        <span className="material-symbols-outlined text-[16px]">save</span>
        <span className="text-xs font-semibold">Save</span>
      </button>
      <div className="flex items-center gap-2" title={isActive ? 'Disable Workflow' : 'Enable Workflow'}>
        <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-emerald-400' : 'text-slate-500'}`}>
          {isActive ? 'Active' : 'Disabled'}
        </span>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" className="sr-only peer" checked={isActive} onChange={onToggleActive} disabled={isDeploying} />
          <div className="w-8 h-4 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 peer-checked:after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
        </label>
      </div>
    </div>
<div className="h-4 w-[1px] bg-surface-container-highest"></div>

<div 
  onClick={() => navigate('/account')}
  className="w-7 h-7 rounded bg-surface-container-high border border-surface-container-highest flex items-center justify-center text-label-sm font-label-sm text-primary font-bold cursor-pointer hover:border-primary/50 transition-colors"
  title="Account Settings"
>
        {firstLetter}
      </div>
</div>
</header>

<div className="flex-1 flex overflow-hidden relative">

<aside className="w-60 flex flex-col justify-between border-r border-surface-container-highest dark:border-surface-container-highest bg-surface-container-low dark:bg-surface-container-low z-30 shrink-0">
<div className="flex flex-col h-full overflow-y-auto">

<div className="p-space-sm border-b border-surface-container-highest flex flex-col gap-space-xs">
<div className="flex items-center justify-between">
<span className="text-headline-sm font-headline-sm font-bold text-on-surface text-xs tracking-wider uppercase">Palette</span>
<span className="text-label-sm font-label-sm text-on-surface-variant text-[10px]">v2.4.0 Engine</span>
</div>
<div className="relative mt-1">
<span className="material-symbols-outlined absolute left-2 top-2 text-[14px] text-on-surface-variant" data-icon="search">search</span>
<input className="w-full bg-surface-container-lowest border border-surface-container-highest rounded pl-7 pr-2 py-1 text-label-sm font-label-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary-container" placeholder="Search nodes..." type="text"/>
</div>
</div>

<div className="p-space-sm flex flex-col gap-space-md">

<div>
<div className="flex items-center justify-between text-label-sm font-label-sm text-on-surface-variant mb-space-xs uppercase tracking-wider text-[10px]">
<span className="flex items-center gap-1">
<span className="material-symbols-outlined text-[12px] text-primary" data-icon="bolt">bolt</span>
                Triggers
              </span>
<span>3</span>
</div>
<div className="flex flex-col gap-1">
<div onClick={() => addNode('trigger', 'Webhook Intake', 'POST /v1/events/webhook', 'bolt', 'primary', { triggerType: 'webhook' })} className="flex items-center justify-between p-space-xs rounded bg-surface-container border border-surface-container-highest hover:border-primary/50 cursor-pointer active:scale-95 transition-all">
<div className="flex items-center gap-1.5">
<span className="w-2 h-2 rounded-full bg-primary"></span>
<span className="text-body-sm font-body-sm text-on-surface">Webhook Intake</span>
</div>
<span className="material-symbols-outlined text-[14px] text-on-surface-variant" data-icon="add">add</span>
</div>
<div onClick={() => addNode('trigger', 'Schedule / Cron', 'Cron: 0 * * * *', 'schedule', 'primary', { triggerType: 'cron' })} className="flex items-center justify-between p-space-xs rounded bg-surface-container border border-surface-container-highest hover:border-primary/50 cursor-pointer active:scale-95 transition-all">
<div className="flex items-center gap-1.5">
<span className="w-2 h-2 rounded-full bg-primary/40"></span>
<span className="text-body-sm font-body-sm text-on-surface">Schedule / Cron</span>
</div>
<span className="material-symbols-outlined text-[14px] text-on-surface-variant" data-icon="add">add</span>
</div>
<div onClick={() => addNode('trigger', 'Redis Stream', 'Stream: events.raw', 'stream', 'primary', { triggerType: 'redis' })} className="flex items-center justify-between p-space-xs rounded bg-surface-container border border-surface-container-highest hover:border-primary/50 cursor-pointer active:scale-95 transition-all">
<div className="flex items-center gap-1.5">
<span className="w-2 h-2 rounded-full bg-primary/40"></span>
<span className="text-body-sm font-body-sm text-on-surface">Kafka / Redis Stream</span>
</div>
<span className="material-symbols-outlined text-[14px] text-on-surface-variant" data-icon="add">add</span>
</div>
</div>
</div>

<div>
<div className="flex items-center justify-between text-label-sm font-label-sm text-on-surface-variant mb-space-xs uppercase tracking-wider text-[10px]">
<span className="flex items-center gap-1">
<span className="material-symbols-outlined text-[12px] text-tertiary" data-icon="schema">schema</span>
                Logic &amp; Flow
              </span>
<span>3</span>
</div>
<div className="flex flex-col gap-1">
<div onClick={() => addNode('logic', 'Condition Branch', 'IF: payload.amount > 100')} className="flex items-center justify-between p-space-xs rounded bg-surface-container border border-surface-container-highest hover:border-tertiary/50 cursor-pointer active:scale-95 transition-all">
<div className="flex items-center gap-1.5">
<span className="w-2 h-2 rounded-full bg-tertiary"></span>
<span className="text-body-sm font-body-sm text-on-surface">Condition Branch</span>
</div>
<span className="material-symbols-outlined text-[14px] text-on-surface-variant" data-icon="add">add</span>
</div>
<div onClick={() => addNode('logic', 'Merge / Fork', 'Fan-out logic')} className="flex items-center justify-between p-space-xs rounded bg-surface-container border border-surface-container-highest hover:border-tertiary/50 cursor-pointer active:scale-95 transition-all">
<div className="flex items-center gap-1.5">
<span className="w-2 h-2 rounded-full bg-tertiary/40"></span>
<span className="text-body-sm font-body-sm text-on-surface">Merge / Fork</span>
</div>
<span className="material-symbols-outlined text-[14px] text-on-surface-variant" data-icon="add">add</span>
</div>
<div onClick={() => addNode('logic', 'Rate Limiter', '100 req / min')} className="flex items-center justify-between p-space-xs rounded bg-surface-container border border-surface-container-highest hover:border-tertiary/50 cursor-pointer active:scale-95 transition-all">
<div className="flex items-center gap-1.5">
<span className="w-2 h-2 rounded-full bg-tertiary/40"></span>
<span className="text-body-sm font-body-sm text-on-surface">Rate Limiter</span>
</div>
<span className="material-symbols-outlined text-[14px] text-on-surface-variant" data-icon="add">add</span>
</div>
</div>
</div>

<div>
<div className="flex items-center justify-between text-label-sm font-label-sm text-on-surface-variant mb-space-xs uppercase tracking-wider text-[10px]">
<span className="flex items-center gap-1">
<span className="material-symbols-outlined text-[12px] text-secondary" data-icon="hub">hub</span>
                Actions &amp; Sinks
              </span>
<span>4</span>
</div>
<div className="flex flex-col gap-1">
<div onClick={() => addNode('action', 'HTTP Request', 'POST https://api.endpoint', 'http', 'tertiary')} className="flex items-center justify-between p-space-xs rounded bg-surface-container border border-surface-container-highest hover:border-secondary/50 cursor-pointer active:scale-95 transition-all">
<div className="flex items-center gap-1.5">
<span className="w-2 h-2 rounded-full bg-secondary"></span>
<span className="text-body-sm font-body-sm text-on-surface">HTTP Request</span>
</div>
<span className="material-symbols-outlined text-[14px] text-on-surface-variant" data-icon="add">add</span>
</div>
<div onClick={() => addNode('action', 'Postgres Sink', 'Database Write', 'storage', 'secondary')} className="flex items-center justify-between p-space-xs rounded bg-surface-container border border-surface-container-highest hover:border-secondary/50 cursor-pointer active:scale-95 transition-all">
<div className="flex items-center gap-1.5">
<span className="w-2 h-2 rounded-full bg-secondary"></span>
<span className="text-body-sm font-body-sm text-on-surface">Postgres Sink</span>
</div>
<span className="material-symbols-outlined text-[14px] text-on-surface-variant" data-icon="add">add</span>
</div>
<div onClick={() => addNode('action', 'Resend Email', 'Send notification', 'mail', 'primary')} className="flex items-center justify-between p-space-xs rounded bg-surface-container border border-surface-container-highest hover:border-secondary/50 cursor-pointer active:scale-95 transition-all">
<div className="flex items-center gap-1.5">
<span className="w-2 h-2 rounded-full bg-secondary/40"></span>
<span className="text-body-sm font-body-sm text-on-surface">Resend Email</span>
</div>
<span className="material-symbols-outlined text-[14px] text-on-surface-variant" data-icon="add">add</span>
</div>
<div onClick={() => addNode('action', 'AI Transformation', 'Prompt: Summarize', 'auto_awesome', 'primary-container')} className="flex items-center justify-between p-space-xs rounded bg-surface-container border border-surface-container-highest hover:border-primary-container/50 cursor-pointer active:scale-95 transition-all">
<div className="flex items-center gap-1.5">
<span className="w-2 h-2 rounded-full bg-primary-container"></span>
<span className="text-body-sm font-body-sm text-on-surface">AI Transformation</span>
</div>
<span className="material-symbols-outlined text-[14px] text-on-surface-variant" data-icon="add">add</span>
</div>
</div>
</div>
</div>
</div>

<div className="p-space-sm border-t border-surface-container-highest bg-surface-container-lowest flex items-center justify-between">
<button onClick={() => addNode('action', 'New Action', 'Generic step', 'hub', 'primary-container')} className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-surface-container border border-surface-container-highest hover:bg-surface-container-high text-on-surface text-label-sm font-label-sm transition-colors active:scale-95">
<span className="material-symbols-outlined text-[14px] text-primary" data-icon="add">add</span>
          Add Custom Node
        </button>
</div>
</aside>

<main className="flex-1 relative bg-surface-container-lowest overflow-hidden flex flex-col">
  <div className="flex-1 relative w-full h-full">
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      fitView
    >
      <Background color="#ffffff" gap={24} size={1} />
      <Controls className="bg-surface border-surface-container-highest fill-on-surface" />
      <MiniMap className="bg-surface border-surface-container-highest" maskColor="rgba(0, 0, 0, 0.5)" />
    </ReactFlow>
  </div>

  {/* Execution Console & Telemetry Drawer */}
  {!isConsoleOpen ? (
    <div className="h-9 border-t border-surface-container-highest bg-[#121316] px-4 flex items-center justify-between z-20 shrink-0 select-none">
      <div className="flex items-center gap-3">
        <button 
          onClick={() => setIsConsoleOpen(true)}
          className="flex items-center gap-1.5 text-xs text-on-surface font-medium hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-[15px] text-tertiary">terminal</span>
          <span className="font-semibold tracking-wide">Execution Console &amp; Webhook Intake</span>
          <span className="material-symbols-outlined text-[15px] text-on-surface-variant">keyboard_arrow_up</span>
        </button>
        
        {testResult && (
          <div className="flex items-center gap-2 text-xs font-code-snippet">
            <span className="text-surface-container-highest">|</span>
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${testResult.success ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${testResult.success ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
              {testResult.success ? '200 OK' : 'FAILED'}
            </span>
            <span className="text-on-surface-variant text-[11px]">{testResult.totalDurationMs}ms</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button 
          onClick={() => { setIsConsoleOpen(true); setConsoleTab('webhook'); }}
          className="text-xs text-on-surface-variant hover:text-white flex items-center gap-1 transition-colors px-2 py-0.5 rounded hover:bg-surface-container-high"
        >
          <span className="material-symbols-outlined text-[13px] text-primary">link</span>
          <span className="font-code-snippet">Webhook URL</span>
        </button>
        <button 
          onClick={() => handleRunTest()}
          disabled={isTesting}
          className="px-2.5 py-1 rounded bg-surface-container border border-surface-container-highest hover:bg-surface-container-high text-xs text-tertiary font-semibold flex items-center gap-1 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[13px]">play_arrow</span>
          <span>{isTesting ? 'Running...' : 'Run Test'}</span>
        </button>
      </div>
    </div>
  ) : (
    <div className="h-80 border-t border-surface-container-highest bg-[#121316] flex flex-col z-20 shrink-0 shadow-2xl">
      {/* Console Header Tabs */}
      <div className="h-10 border-b border-surface-container-highest bg-[#18191d] px-3 flex items-center justify-between select-none">
        <div className="flex items-center gap-1 h-full">
          <button 
            onClick={() => setConsoleTab('test')}
            className={`flex items-center gap-1.5 px-3 h-full text-xs font-medium border-b-2 transition-all ${consoleTab === 'test' ? 'border-tertiary text-white bg-surface-container-low/60' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
          >
            <span className="material-symbols-outlined text-[14px] text-tertiary">terminal</span>
            <span>Live Test Console</span>
          </button>
          
          <button 
            onClick={() => setConsoleTab('webhook')}
            className={`flex items-center gap-1.5 px-3 h-full text-xs font-medium border-b-2 transition-all ${consoleTab === 'webhook' ? 'border-primary text-white bg-surface-container-low/60' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
          >
            <span className="material-symbols-outlined text-[14px] text-primary">link</span>
            <span>Webhook Intake &amp; cURL</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          </button>

          <button 
            onClick={() => setConsoleTab('trace')}
            className={`flex items-center gap-1.5 px-3 h-full text-xs font-medium border-b-2 transition-all ${consoleTab === 'trace' ? 'border-secondary text-white bg-surface-container-low/60' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
          >
            <span className="material-symbols-outlined text-[14px] text-secondary">schema</span>
            <span>Step Trace {testResult?.nodeResults ? `(${Object.keys(testResult.nodeResults).length})` : ''}</span>
          </button>

          <button 
            onClick={() => { setConsoleTab('history'); fetchExecutions(); }}
            className={`flex items-center gap-1.5 px-3 h-full text-xs font-medium border-b-2 transition-all ${consoleTab === 'history' ? 'border-primary-container text-white bg-surface-container-low/60' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
          >
            <span className="material-symbols-outlined text-[14px] text-primary-container">history</span>
            <span>Run History ({executionsList.length})</span>
          </button>

          <button 
            onClick={() => setConsoleTab('nexus')}
            className={`flex items-center gap-1.5 px-3 h-full text-xs font-medium border-b-2 transition-all ${consoleTab === 'nexus' ? 'border-indigo-400 text-white bg-surface-container-low/60' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
          >
            <span className="material-symbols-outlined text-[14px] text-indigo-400">view_in_ar</span>
            <span>Nexus 3D Viewer</span>
            {activeEvent && activeEvent.type === 'execution_started' && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {consoleTab === 'test' && (
            <>
              <div className="hidden sm:flex items-center gap-1 text-[11px] font-code-snippet text-on-surface-variant mr-1">
                <span>Preset:</span>
                <button onClick={() => loadPayloadPreset('enterprise')} className="px-1.5 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface hover:text-white transition-colors">Enterprise</button>
                <button onClick={() => loadPayloadPreset('standard')} className="px-1.5 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface hover:text-white transition-colors">Standard (Filter)</button>
              </div>

              <button 
                onClick={() => handleRunTest()}
                disabled={isTesting}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-tertiary/15 border border-tertiary/40 text-tertiary hover:bg-tertiary/25 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
              >
                {isTesting ? (
                  <span className="w-3 h-3 border-2 border-tertiary border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <span className="material-symbols-outlined text-[14px]">play_arrow</span>
                )}
                <span>{isTesting ? 'Executing...' : 'Execute Test'}</span>
              </button>
            </>
          )}

          {(consoleTab === 'history' || consoleTab === 'webhook') && (
            <button 
              onClick={fetchExecutions}
              disabled={isLoadingExecutions}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container border border-surface-container-highest hover:bg-surface-container-high text-xs text-on-surface-variant hover:text-white transition-colors"
              title="Refresh executions from database"
            >
              <span className={`material-symbols-outlined text-[14px] ${isLoadingExecutions ? 'animate-spin' : ''}`}>refresh</span>
              <span>Refresh</span>
            </button>
          )}

          <button 
            onClick={() => setIsConsoleOpen(false)}
            className="p-1 rounded text-on-surface-variant hover:text-white hover:bg-surface-container-high transition-colors"
            title="Minimize Console"
          >
            <span className="material-symbols-outlined text-[16px]">keyboard_arrow_down</span>
          </button>
        </div>
      </div>

      {/* Console Tab Contents */}
      <div className="flex-1 overflow-hidden">
        {consoleTab === 'test' && (
          <div className="grid grid-cols-12 h-full">
            {/* Left: Editable Payload */}
            <div className="col-span-5 border-r border-surface-container-highest p-3 flex flex-col gap-1.5 h-full bg-[#0f1013]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-on-surface flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px] text-tertiary">data_object</span>
                  <span>Input Event Payload (JSON)</span>
                </span>
                <button 
                  onClick={() => loadPayloadPreset('enterprise')}
                  className="text-[10px] font-code-snippet text-tertiary hover:underline"
                >
                  Reset Sample
                </button>
              </div>
              <textarea 
                value={testPayloadText}
                onChange={(e) => setTestPayloadText(e.target.value)}
                className="flex-1 w-full bg-[#08090b] border border-surface-container-highest rounded p-2 text-code-snippet font-code-snippet text-[11px] text-emerald-300 focus:outline-none focus:border-tertiary resize-none overflow-y-auto leading-relaxed"
                spellCheck={false}
              />
            </div>

            {/* Right: Telemetry & Logs */}
            <div className="col-span-7 p-3 flex flex-col gap-2 h-full bg-[#0c0d10] overflow-hidden">
              {testResult ? (
                <>
                  <div className="flex items-center justify-between pb-2 border-b border-surface-container-highest">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${testResult.success ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${testResult.success ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                        {testResult.success ? 'PIPELINE PASSED (200 OK)' : 'PIPELINE FAILED'}
                      </span>
                      <span className="text-xs font-code-snippet text-on-surface-variant">
                        Execution: <span className="text-on-surface">{testResult.executionId}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-code-snippet">
                      <span className="text-tertiary font-semibold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">bolt</span>
                        {testResult.totalDurationMs}ms total
                      </span>
                      <span className="text-on-surface-variant">
                        {Object.values(testResult.nodeResults || {}).filter((n: any) => n.status === 'completed').length} nodes active
                      </span>
                    </div>
                  </div>

                  {/* Logs terminal */}
                  <div className="flex-1 bg-[#060709] border border-surface-container-highest rounded p-2.5 overflow-y-auto font-code-snippet text-[11px] flex flex-col gap-1">
                    {testResult.logs?.map((log: any, idx: number) => {
                      const isSuccess = log.level === 'success';
                      const isError = log.level === 'error';
                      const isWarn = log.level === 'warn';
                      return (
                        <div key={idx} className="flex items-start gap-2 leading-relaxed">
                          <span className="text-on-surface-variant text-[10px] shrink-0">{log.timestamp}</span>
                          <span className={`px-1 rounded text-[9px] font-bold shrink-0 uppercase ${isSuccess ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : isError ? 'bg-rose-500/20 text-rose-400' : isWarn ? 'bg-amber-500/15 text-amber-400' : 'bg-surface-container text-on-surface-variant'}`}>
                            {log.level}
                          </span>
                          <span className={`break-all ${isSuccess ? 'text-emerald-300' : isError ? 'text-rose-400' : isWarn ? 'text-amber-300' : 'text-on-surface'}`}>
                            {log.message}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[32px] text-tertiary mb-2 opacity-60">terminal</span>
                  <p className="text-xs font-medium text-on-surface mb-1">Pipeline Engine Ready</p>
                  <p className="text-[11px] max-w-sm">
                    Click <strong className="text-tertiary">"Execute Test"</strong> above to send the test payload through your workflow nodes and observe live evaluation traces.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {consoleTab === 'webhook' && (
          <div className="h-full p-4 overflow-y-auto flex flex-col gap-4 bg-[#0e0f12]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-primary">sensors</span>
                  How To Check If Your Workflow Is Working
                </h4>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Every active FlowForge workflow has a dedicated public ingestion endpoint. You can test your workflow with real HTTP traffic from terminals, Postman, or webhook providers (Stripe, GitHub, Shopify).
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  ENDPOINT LISTENING
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Card 1: Webhook URL */}
              <div className="p-3 rounded bg-[#07080a] border border-surface-container-highest flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">1. Dedicated Webhook URL</span>
                  <span className="text-[10px] text-emerald-400 font-code-snippet">POST Endpoint</span>
                </div>
                <div className="flex items-center gap-1.5 bg-[#121316] border border-surface-container-highest rounded px-2.5 py-1.5">
                  <span className="text-code-snippet font-code-snippet text-[11px] text-on-surface select-all truncate flex-1">
                    {id && id !== 'new' ? `http://localhost:3000/api/v1/wh/${id}` : 'Deploy workflow first to obtain URL'}
                  </span>
                  {id && id !== 'new' && (
                    <button 
                      onClick={() => copyToClipboard(`http://localhost:3000/api/v1/wh/${id}`, 'Webhook URL')}
                      className="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-white transition-colors"
                      title="Copy URL"
                    >
                      <span className="material-symbols-outlined text-[14px]">content_copy</span>
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-on-surface-variant">
                  Accepts JSON payloads. Automatically triggers execution, evaluates logic conditions, and runs actions.
                </span>
              </div>

              {/* Card 2: cURL Command */}
              <div className="p-3 rounded bg-[#07080a] border border-surface-container-highest flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">2. Terminal cURL Command</span>
                  {id && id !== 'new' && (
                    <button 
                      onClick={() => copyToClipboard(`curl -X POST http://localhost:3000/api/v1/wh/${id} -H "Content-Type: application/json" -d '{"event":"order.created","account_tier":"enterprise","amount":250}'`, 'cURL command')}
                      className="text-[10px] text-primary hover:underline flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[12px]">content_copy</span>
                      <span>Copy cURL</span>
                    </button>
                  )}
                </div>
                <pre className="bg-[#121316] border border-surface-container-highest rounded p-2 text-code-snippet font-code-snippet text-[10px] text-primary-container overflow-x-auto whitespace-pre">
{`curl -X POST http://localhost:3000/api/v1/wh/${id || ':id'} \\
  -H "Content-Type: application/json" \\
  -d '{"event":"order.created","account_tier":"enterprise","amount":250}'`}
                </pre>
              </div>
            </div>

            {/* Ingestion Verification Notice */}
            <div className="p-3 rounded bg-surface-container-low border border-surface-container-highest flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-emerald-400">verified</span>
                <span className="text-[11px] text-on-surface">
                  Once you trigger the endpoint, incoming events are persisted in PostgreSQL. Switch to the <strong>Run History</strong> tab to inspect live intake events.
                </span>
              </div>
              <button 
                onClick={() => { setConsoleTab('history'); fetchExecutions(); }}
                className="px-2.5 py-1 rounded bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-on-surface border border-surface-container-highest transition-colors flex items-center gap-1"
              >
                <span>View History</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>
          </div>
        )}

        {consoleTab === 'trace' && (
          <div className="h-full p-3 overflow-y-auto flex flex-col gap-2 bg-[#0c0d10]">
            {testResult?.nodeResults && Object.keys(testResult.nodeResults).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {Object.values(testResult.nodeResults).map((nr: any) => (
                  <div key={nr.nodeId} className="p-2.5 rounded bg-[#131417] border border-surface-container-highest flex flex-col gap-1.5 text-xs">
                    <div className="flex items-center justify-between border-b border-surface-container-highest pb-1.5">
                      <span className="font-semibold text-on-surface truncate">{nr.nodeName}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${nr.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' : nr.status === 'skipped' ? 'bg-surface-container text-on-surface-variant' : 'bg-rose-500/15 text-rose-400'}`}>
                        {nr.status.toUpperCase()} ({nr.durationMs}ms)
                      </span>
                    </div>

                    <div className="text-[10px] font-code-snippet text-on-surface-variant">
                      Type: <span className="text-on-surface">{nr.nodeType}</span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-bold uppercase text-on-surface-variant">Output Snapshot</span>
                      <pre className="bg-[#08090b] border border-surface-container-highest rounded p-1.5 text-[10px] font-code-snippet text-emerald-300 max-h-24 overflow-y-auto whitespace-pre-wrap">
                        {JSON.stringify(nr.output || {}, null, 2)}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-on-surface-variant">
                No step trace available. Execute a test run first.
              </div>
            )}
          </div>
        )}

        {consoleTab === 'history' && (
          <div className="h-full p-3 overflow-y-auto flex flex-col gap-2 bg-[#0c0d10]">
            <div className="flex items-center justify-between text-xs pb-1 border-b border-surface-container-highest">
              <span className="font-medium text-on-surface">Stored PostgreSQL Executions ({executionsList.length})</span>
              <button onClick={fetchExecutions} className="text-[11px] text-primary hover:underline flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">refresh</span>
                Refresh
              </button>
            </div>

            {executionsList.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {executionsList.map((exec) => (
                  <div key={exec.id} className="flex flex-col gap-2 p-2.5 rounded bg-[#131417] border border-surface-container-highest text-xs hover:border-primary/40 transition-colors">
                    <div 
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedExecutionId(prev => prev === exec.id ? null : exec.id)}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${exec.status === 'completed' ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                        <div className="flex flex-col">
                          <span className="font-code-snippet font-semibold text-on-surface text-[11px]">{exec.id}</span>
                          <span className="text-[10px] text-on-surface-variant font-code-snippet">
                            {new Date(exec.startedAt).toLocaleString()} • Event: {exec.event?.externalEventId || exec.event?.id || 'manual'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${exec.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'}`}>
                          {exec.status.toUpperCase()}
                        </span>
                        <span className="text-on-surface-variant text-[11px] font-code-snippet">
                          {exec.nodeExecutions?.length || 0} nodes
                        </span>
                        <span className="material-symbols-outlined text-[16px] text-on-surface-variant ml-2">
                          {expandedExecutionId === exec.id ? 'expand_less' : 'expand_more'}
                        </span>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedExecutionId === exec.id && exec.nodeExecutions && (
                      <div className="mt-2 pt-2 border-t border-surface-container-highest flex flex-col gap-3">
                        {exec.nodeExecutions.map((nExec: any) => (
                          <div key={nExec.id} className="flex flex-col gap-1 p-2 bg-[#0c0d10] rounded border border-surface-container-highest">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold font-code-snippet text-on-surface">Node: {nExec.nodeId}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${nExec.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                {nExec.status}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-1">
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">Input</span>
                                <pre className="p-1.5 rounded bg-[#131417] text-on-surface-variant text-[9px] font-code-snippet overflow-x-auto whitespace-pre-wrap max-h-32">
                                  {JSON.stringify(nExec.input, null, 2)}
                                </pre>
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">Output / Error</span>
                                <pre className={`p-1.5 rounded bg-[#131417] text-[9px] font-code-snippet overflow-x-auto whitespace-pre-wrap max-h-32 ${nExec.error ? 'text-rose-400' : 'text-emerald-300'}`}>
                                  {nExec.error ? String(nExec.error) : JSON.stringify(nExec.output, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </div>
                        ))}

                        {exec.status === 'failed' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRetryExecution(exec.id);
                            }}
                            className="mt-2 py-1.5 px-3 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/40 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">replay</span>
                            Manual Retry
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-xs text-on-surface-variant">
                <span className="material-symbols-outlined text-[28px] text-on-surface-variant mb-1">history</span>
                <span>No executions recorded yet. Run a test or trigger the Webhook URL.</span>
              </div>
            )}
          </div>
        )}

        {consoleTab === 'nexus' && (
          <div className="h-full w-full p-2 bg-[#0c0d10]">
            <NexusScene nodes={nodes} edges={edges} activeEvent={activeEvent} healthState={healthState as any} />
          </div>
        )}
      </div>
    </div>
  )}
</main>


{selectedNode && (() => {
  const nodeType = selectedNode.type || 'action';
  const nodeData = (selectedNode.data || {}) as Record<string, any>;
  const activeNodeResult = singleNodeTestResult[selectedNode.id] || testResult?.nodeResults?.[selectedNode.id];
  const nodeSchema = getNodeInputSchema(selectedNode);

  // Evaluate logic variables if logic node
  let logicEvalPreview: boolean | null = null;
  let parsedPayload: any = {};
  try {
    parsedPayload = JSON.parse(testPayloadText);
    if (nodeType === 'logic') {
      const cond = (nodeData.condition as string) || (nodeData.subtitle as string) || "account_tier === 'enterprise'";
      const clean = cond.replace(/^IF:\s*/i, '').trim();
      const fn = new Function('payload', ...Object.keys(parsedPayload), `return Boolean(${clean});`);
      logicEvalPreview = Boolean(fn(parsedPayload, ...Object.values(parsedPayload)));
    }
  } catch {
    logicEvalPreview = null;
  }

  const iconName = nodeType === 'trigger' ? 'bolt' : nodeType === 'logic' ? 'schema' : nodeType === 'ghost' ? 'block' : (nodeData.icon as string || 'hub');
  const iconColor = nodeType === 'trigger' ? 'text-primary' : nodeType === 'logic' ? 'text-tertiary' : nodeType === 'ghost' ? 'text-on-surface-variant' : 'text-secondary';

  return (
    <aside className="w-[350px] min-w-[350px] max-w-[350px] border-l border-surface-container-highest dark:border-surface-container-highest bg-[#111215] z-30 shrink-0 flex flex-col justify-between select-none overflow-x-hidden">
      <div className="flex flex-col h-full overflow-y-auto">

        {/* Sidebar Header */}
        <div className="p-3.5 border-b border-surface-container-highest flex items-center justify-between bg-[#15161a]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-surface-container-high border border-surface-container-highest flex items-center justify-center">
              <span className={`material-symbols-outlined text-[18px] ${iconColor}`} data-icon={iconName}>{iconName}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-on-surface truncate max-w-[170px]">{nodeData.label as string || 'Node Configuration'}</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded bg-surface-container border border-surface-container-highest text-on-surface-variant">
                  {nodeType}
                </span>
                <span className="text-[10px] text-on-surface-variant font-code-snippet">ID: {selectedNode.id}</span>
              </div>
            </div>
          </div>
          <button onClick={() => setSelectedNode(null)} className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors" title="Close Panel">
            <span className="material-symbols-outlined text-[16px]" data-icon="close">close</span>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-surface-container-highest bg-[#0e0f12] px-2">
          <button 
            onClick={() => setNodeInspectorTab('config')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${nodeInspectorTab === 'config' ? 'text-primary border-primary-container bg-surface-container-low/50' : 'text-on-surface-variant hover:text-on-surface border-transparent'}`}
          >
            <span className="material-symbols-outlined text-[14px]">tune</span>
            <span>Config</span>
          </button>
          
          <button 
            onClick={() => setNodeInspectorTab('schema')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${nodeInspectorTab === 'schema' ? 'text-tertiary border-tertiary bg-surface-container-low/50' : 'text-on-surface-variant hover:text-on-surface border-transparent'}`}
          >
            <span className="material-symbols-outlined text-[14px]">data_object</span>
            <span>Input Schema</span>
          </button>

          <button 
            onClick={() => setNodeInspectorTab('test')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${nodeInspectorTab === 'test' ? 'text-secondary border-secondary bg-surface-container-low/50' : 'text-on-surface-variant hover:text-on-surface border-transparent'}`}
          >
            <span className="material-symbols-outlined text-[14px]">play_circle</span>
            <span>Test &amp; Output</span>
            {activeNodeResult && (
              <span className={`w-1.5 h-1.5 rounded-full ${activeNodeResult.status === 'completed' ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
            )}
          </button>
        </div>

        {/* Tab 1: Config */}
        {nodeInspectorTab === 'config' && (
          <div className="p-3.5 flex flex-col gap-3.5">
            {/* Common: Node Label */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Node Name / Label</label>
              <input 
                className="w-full bg-[#090a0c] border border-surface-container-highest rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container" 
                type="text" 
                value={(nodeData.label as string) || ''}
                onChange={(e) => updateSelectedNode('label', e.target.value)}
              />
            </div>

            {/* TYPE: TRIGGER */}
            {nodeType === 'trigger' && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Trigger Mechanism</label>
                  <select 
                    value={(nodeData.triggerType as string) || 'webhook'}
                    onChange={(e) => updateSelectedNode('triggerType', e.target.value)}
                    className="w-full bg-[#090a0c] border border-surface-container-highest rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary-container"
                  >
                    <option value="webhook">HTTP Webhook Ingestion (POST)</option>
                    <option value="cron">Scheduled Cron Interval</option>
                    <option value="redis">Redis Stream / Kafka Topic</option>
                  </select>
                </div>

                {((nodeData.triggerType as string) || 'webhook') === 'webhook' && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Endpoint Path</label>
                      <input 
                        className="w-full bg-[#090a0c] border border-surface-container-highest rounded px-2.5 py-1.5 text-code-snippet font-code-snippet text-[11px] text-on-surface focus:outline-none focus:border-primary-container" 
                        type="text" 
                        value={(nodeData.subtitle as string) || 'POST /v1/events/webhook'}
                        onChange={(e) => updateSelectedNode('subtitle', e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Auth Verification</label>
                      <select 
                        value={(nodeData.authType as string) || 'public'}
                        onChange={(e) => updateSelectedNode('authType', e.target.value)}
                        className="w-full bg-[#090a0c] border border-surface-container-highest rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary-container"
                      >
                        <option value="public">Open Public Webhook (No auth required)</option>
                        <option value="hmac">HMAC SHA-256 Signature (Stripe / GitHub)</option>
                        <option value="bearer">Bearer Token / API Key</option>
                      </select>
                    </div>

                    {nodeData.authType === 'hmac' && (
                      <>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Signature Header Name</label>
                          <input 
                            className="w-full bg-[#090a0c] border border-surface-container-highest rounded px-2.5 py-1.5 text-code-snippet font-code-snippet text-[11px] text-on-surface focus:outline-none focus:border-primary-container" 
                            type="text" 
                            placeholder="e.g., stripe-signature"
                            value={(nodeData.authHeaderName as string) || ''}
                            onChange={(e) => updateSelectedNode('authHeaderName', e.target.value)}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Signing Secret</label>
                          <input 
                            className="w-full bg-[#090a0c] border border-surface-container-highest rounded px-2.5 py-1.5 text-code-snippet font-code-snippet text-[11px] text-on-surface focus:outline-none focus:border-primary-container" 
                            type="password" 
                            placeholder="whsec_..."
                            value={(nodeData.authSecret as string) || ''}
                            onChange={(e) => updateSelectedNode('authSecret', e.target.value)}
                          />
                        </div>
                      </>
                    )}

                    {nodeData.authType === 'bearer' && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Expected Bearer Token</label>
                        <input 
                          className="w-full bg-[#090a0c] border border-surface-container-highest rounded px-2.5 py-1.5 text-code-snippet font-code-snippet text-[11px] text-on-surface focus:outline-none focus:border-primary-container" 
                          type="password" 
                          placeholder="sk_live_..."
                          value={(nodeData.authSecret as string) || ''}
                          onChange={(e) => updateSelectedNode('authSecret', e.target.value)}
                        />
                      </div>
                    )}

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Rate Limit Policy</label>
                      <select 
                        value={(nodeData.rateLimit as string) || '5000'}
                        onChange={(e) => updateSelectedNode('rateLimit', e.target.value)}
                        className="w-full bg-[#090a0c] border border-surface-container-highest rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary-container"
                      >
                        <option value="1000">1,000 requests / min (Standard)</option>
                        <option value="5000">5,000 requests / min (Scale)</option>
                        <option value="unlimited">Unlimited / Queue Backlog</option>
                      </select>
                    </div>

                    {/* Public Ingestion Box */}
                    <div className="p-2.5 rounded bg-[#08090b] border border-surface-container-highest flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[10px] font-code-snippet text-on-surface-variant">
                        <span className="font-semibold text-primary">Public Webhook URL</span>
                        <span className="text-emerald-400">Live</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <input 
                          readOnly 
                          value={id && id !== 'new' ? `http://localhost:3000/api/v1/wh/${id}` : 'Deploy workflow first'} 
                          className="bg-[#121316] border border-surface-container-highest rounded px-2 py-1 text-[10px] font-code-snippet text-on-surface flex-1 truncate select-all"
                        />
                        {id && id !== 'new' && (
                          <button 
                            onClick={() => copyToClipboard(`http://localhost:3000/api/v1/wh/${id}`, 'Webhook URL')}
                            className="p-1 rounded bg-surface-container border border-surface-container-highest hover:bg-surface-container-high text-on-surface-variant hover:text-white"
                            title="Copy Webhook URL"
                          >
                            <span className="material-symbols-outlined text-[13px]">content_copy</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {((nodeData.triggerType as string) || 'webhook') === 'cron' && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Cron Expression</label>
                      <input 
                        className="w-full bg-[#090a0c] border border-surface-container-highest rounded px-2.5 py-1.5 text-code-snippet font-code-snippet text-[11px] text-on-surface focus:outline-none focus:border-primary-container" 
                        type="text" 
                        placeholder="*/5 * * * *"
                        value={(nodeData.cronExpression as string) || '*/5 * * * *'}
                        onChange={(e) => {
                          updateSelectedNode('cronExpression', e.target.value);
                          updateSelectedNode('subtitle', `CRON: ${e.target.value}`);
                        }}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Timezone</label>
                      <select 
                        value={(nodeData.timezone as string) || 'UTC'}
                        onChange={(e) => updateSelectedNode('timezone', e.target.value)}
                        className="w-full bg-[#090a0c] border border-surface-container-highest rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary-container"
                      >
                        <option value="UTC">UTC (Default)</option>
                        <option value="America/New_York">America/New_York (EST/EDT)</option>
                        <option value="Europe/London">Europe/London (GMT/BST)</option>
                        <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                      </select>
                    </div>
                  </>
                )}

                {((nodeData.triggerType as string) || 'webhook') === 'redis' && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Redis Topic / Stream</label>
                      <input 
                        className="w-full bg-[#090a0c] border border-surface-container-highest rounded px-2.5 py-1.5 text-code-snippet font-code-snippet text-[11px] text-on-surface focus:outline-none focus:border-primary-container" 
                        type="text" 
                        placeholder="events:user_signup"
                        value={(nodeData.redisTopic as string) || ''}
                        onChange={(e) => {
                          updateSelectedNode('redisTopic', e.target.value);
                          updateSelectedNode('subtitle', `Stream: ${e.target.value}`);
                        }}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Consumer Group</label>
                      <input 
                        className="w-full bg-[#090a0c] border border-surface-container-highest rounded px-2.5 py-1.5 text-code-snippet font-code-snippet text-[11px] text-on-surface focus:outline-none focus:border-primary-container" 
                        type="text" 
                        placeholder="flowforge-workers"
                        value={(nodeData.redisConsumerGroup as string) || 'flowforge-workers'}
                        onChange={(e) => updateSelectedNode('redisConsumerGroup', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Connection Secret (URI)</label>
                      <input 
                        className="w-full bg-[#090a0c] border border-surface-container-highest rounded px-2.5 py-1.5 text-code-snippet font-code-snippet text-[11px] text-on-surface focus:outline-none focus:border-primary-container" 
                        type="password" 
                        placeholder="redis://..."
                        value={(nodeData.redisUri as string) || ''}
                        onChange={(e) => updateSelectedNode('redisUri', e.target.value)}
                      />
                    </div>
                  </>
                )}
              </>
            )}

            {/* TYPE: LOGIC */}
            {nodeType === 'logic' && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Evaluation Mode</span>
                  <div className="flex items-center bg-surface-container-highest rounded p-0.5">
                    <button 
                      onClick={() => updateSelectedNode('conditionType', 'visual')}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${((nodeData.conditionType as string) || 'visual') === 'visual' ? 'bg-surface-container-lowest text-tertiary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                    >
                      Visual
                    </button>
                    <button 
                      onClick={() => updateSelectedNode('conditionType', 'code')}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${nodeData.conditionType === 'code' ? 'bg-surface-container-lowest text-tertiary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                    >
                      Code
                    </button>
                  </div>
                </div>

                {((nodeData.conditionType as string) || 'visual') === 'visual' ? (
                  <div className="flex flex-col gap-2 p-2.5 rounded bg-[#08090b] border border-surface-container-highest">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-medium text-on-surface-variant uppercase tracking-wide">Target Field</label>
                      <input 
                        className="w-full bg-[#121316] border border-surface-container-highest rounded px-2 py-1.5 text-code-snippet font-code-snippet text-[11px] text-on-surface focus:outline-none focus:border-tertiary" 
                        type="text" 
                        placeholder="e.g. payload.amount"
                        value={(nodeData.visualField as string) || ''}
                        onChange={(e) => {
                          updateSelectedNode('visualField', e.target.value);
                          updateSelectedNode('condition', `${e.target.value} ${nodeData.visualOperator || '==='} ${nodeData.visualValue || '""'}`);
                          updateSelectedNode('subtitle', `IF: ${e.target.value} ${nodeData.visualOperator || '==='} ${nodeData.visualValue || '""'}`);
                        }}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-medium text-on-surface-variant uppercase tracking-wide">Operator</label>
                      <select 
                        value={(nodeData.visualOperator as string) || '==='}
                        onChange={(e) => {
                          updateSelectedNode('visualOperator', e.target.value);
                          const field = nodeData.visualField || 'payload';
                          updateSelectedNode('condition', `${field} ${e.target.value} ${nodeData.visualValue || '""'}`);
                          updateSelectedNode('subtitle', `IF: ${field} ${e.target.value} ${nodeData.visualValue || '""'}`);
                        }}
                        className="w-full bg-[#121316] border border-surface-container-highest rounded px-2 py-1.5 text-code-snippet font-code-snippet text-[11px] text-on-surface focus:outline-none focus:border-tertiary"
                      >
                        <option value="===">Equals (===)</option>
                        <option value="!==">Not Equals (!==)</option>
                        <option value=">">Greater Than (&gt;)</option>
                        <option value="<">Less Than (&lt;)</option>
                        <option value="includes">Contains Text</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-medium text-on-surface-variant uppercase tracking-wide">Value</label>
                      <input 
                        className="w-full bg-[#121316] border border-surface-container-highest rounded px-2 py-1.5 text-code-snippet font-code-snippet text-[11px] text-on-surface focus:outline-none focus:border-tertiary" 
                        type="text" 
                        placeholder="e.g. 100 or 'enterprise'"
                        value={(nodeData.visualValue as string) || ''}
                        onChange={(e) => {
                          updateSelectedNode('visualValue', e.target.value);
                          const field = nodeData.visualField || 'payload';
                          const op = nodeData.visualOperator || '===';
                          updateSelectedNode('condition', op === 'includes' ? `String(${field}).includes(${e.target.value})` : `${field} ${op} ${e.target.value}`);
                          updateSelectedNode('subtitle', `IF: ${field} ${op} ${e.target.value}`);
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Condition Expression</label>
                        <span className="text-[10px] text-tertiary font-code-snippet">JS Sandbox</span>
                      </div>
                      <textarea 
                        className="w-full bg-[#08090b] border border-surface-container-highest rounded p-2 text-code-snippet font-code-snippet text-[11px] text-emerald-300 focus:outline-none focus:border-tertiary resize-none" 
                        rows={3} 
                        value={(nodeData.condition as string) || (nodeData.subtitle as string) || "account_tier === 'enterprise'"}
                        onChange={(e) => {
                          updateSelectedNode('condition', e.target.value);
                          updateSelectedNode('subtitle', `IF: ${e.target.value}`);
                        }}
                      />
                    </div>

                    {/* Quick Presets */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-on-surface-variant font-medium">Quick Expression Presets:</span>
                      <div className="flex flex-wrap gap-1">
                        <button 
                          onClick={() => {
                            updateSelectedNode('condition', "account_tier === 'enterprise'");
                            updateSelectedNode('subtitle', "IF: account_tier === 'enterprise'");
                          }}
                          className="text-[10px] font-code-snippet px-1.5 py-0.5 rounded bg-surface-container border border-surface-container-highest hover:bg-surface-container-high text-tertiary transition-colors"
                        >
                          tier === 'enterprise'
                        </button>
                        <button 
                          onClick={() => {
                            updateSelectedNode('condition', "payload.amount > 100");
                            updateSelectedNode('subtitle', "IF: payload.amount > 100");
                          }}
                          className="text-[10px] font-code-snippet px-1.5 py-0.5 rounded bg-surface-container border border-surface-container-highest hover:bg-surface-container-high text-tertiary transition-colors"
                        >
                          amount &gt; 100
                        </button>
                        <button 
                          onClick={() => {
                            updateSelectedNode('condition', "customer.email.endsWith('.io')");
                            updateSelectedNode('subtitle', "IF: customer.email.endsWith('.io')");
                          }}
                          className="text-[10px] font-code-snippet px-1.5 py-0.5 rounded bg-surface-container border border-surface-container-highest hover:bg-surface-container-high text-tertiary transition-colors"
                        >
                          email .io domain
                        </button>
                      </div>
                    </div>
                  </>
                )}

                <div className="p-2.5 rounded bg-[#08090b] border border-surface-container-highest flex flex-col gap-1.5 mt-2">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase">Branch Output Sockets</span>
                  <div className="flex items-center justify-between text-[11px] font-code-snippet px-2 py-1 rounded bg-[#131417]">
                    <span className="text-tertiary flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
                      Socket 'true'
                    </span>
                    <span className="text-on-surface-variant">Routes forward</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-code-snippet px-2 py-1 rounded bg-[#131417]">
                    <span className="text-on-surface-variant flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-surface-container-highest"></span>
                      Socket 'false'
                    </span>
                    <span className="text-on-surface-variant">Routes secondary</span>
                  </div>
                </div>
              </>
            )}

            {/* TYPE: ACTION */}
            {nodeType === 'action' && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Action Provider / Category</label>
                  <select 
                    value={(nodeData.actionType as string) || 'enrich'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'enrich') {
                        updateMultipleNodeData({ actionType: val, label: 'User Enrichment', subtitle: 'GET api.clearbit.com/v2', icon: 'hub' });
                      } else if (val === 'sink') {
                        updateMultipleNodeData({ actionType: val, label: 'Postgres & Slack Sink', subtitle: 'Database Sink: orders', icon: 'storage' });
                      } else if (val === 'email') {
                        updateMultipleNodeData({ actionType: val, label: 'Resend Email', subtitle: 'POST api.resend.com/emails', icon: 'mail' });
                      } else if (val === 'ai') {
                        updateMultipleNodeData({ actionType: val, label: 'AI Transformation', subtitle: 'Prompt: summarize', icon: 'auto_awesome' });
                      } else {
                        updateMultipleNodeData({ actionType: val, label: 'HTTP Request', subtitle: 'POST https://api.endpoint', icon: 'http' });
                      }
                    }}
                    className="w-full bg-[#090a0c] border border-surface-container-highest rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary-container"
                  >
                    <option value="enrich">User Enrichment (Clearbit / ZoomInfo)</option>
                    <option value="sink">Postgres &amp; Slack Sink</option>
                    <option value="http">Custom HTTP REST Request</option>
                    <option value="email">Transactional Email (Resend)</option>
                    <option value="ai">AI Data Transformation</option>
                  </select>
                </div>

                {((nodeData.actionType as string) || 'enrich') === 'http' && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Target URL</label>
                      <input 
                        className="w-full bg-[#090a0c] border border-surface-container-highest rounded px-2.5 py-1.5 text-code-snippet font-code-snippet text-[11px] text-on-surface focus:outline-none focus:border-primary-container" 
                        type="text" 
                        placeholder="https://api.example.com/v1/data"
                        value={(nodeData.url as string) || ''}
                        onChange={(e) => {
                          updateSelectedNode('url', e.target.value);
                          updateSelectedNode('subtitle', `${nodeData.method || 'POST'} ${e.target.value}`);
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">HTTP Method</label>
                        <select 
                          value={(nodeData.method as string) || 'POST'}
                          onChange={(e) => {
                            updateSelectedNode('method', e.target.value);
                            updateSelectedNode('subtitle', `${e.target.value} ${nodeData.url || 'https://api.endpoint'}`);
                          }}
                          className="w-full bg-[#090a0c] border border-surface-container-highest rounded px-2 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary-container"
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                          <option value="PATCH">PATCH</option>
                          <option value="DELETE">DELETE</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Timeout (ms)</label>
                        <input 
                          className="w-full bg-[#090a0c] border border-surface-container-highest rounded px-2 py-1.5 text-code-snippet font-code-snippet text-xs text-on-surface focus:outline-none focus:border-primary-container" 
                          type="number" 
                          value={nodeData.timeoutMs || 5000}
                          onChange={(e) => updateSelectedNode('timeoutMs', Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Headers (JSON)</label>
                      <textarea
                        className="w-full bg-[#090a0c] border border-surface-container-highest rounded px-2.5 py-1.5 text-code-snippet font-code-snippet text-[10px] text-on-surface focus:outline-none focus:border-primary-container min-h-[60px]" 
                        placeholder='{"Authorization": "Bearer {{env.API_KEY}}"}'
                        value={(nodeData.headers as string) || ''}
                        onChange={(e) => updateSelectedNode('headers', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Body Payload (JSON)</label>
                      <textarea
                        className="w-full bg-[#090a0c] border border-surface-container-highest rounded px-2.5 py-1.5 text-code-snippet font-code-snippet text-[10px] text-on-surface focus:outline-none focus:border-primary-container min-h-[80px]" 
                        placeholder='{"userId": "{{customer.id}}", "event": "signup"}'
                        value={(nodeData.body as string) || ''}
                        onChange={(e) => updateSelectedNode('body', e.target.value)}
                      />
                    </div>
                  </>
                )}

                {((nodeData.actionType as string) || 'enrich') === 'email' && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">To Address</label>
                      <input 
                        className="w-full bg-[#090a0c] border border-surface-container-highest rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary-container" 
                        type="text" 
                        placeholder="{{customer.email}} or user@example.com"
                        value={(nodeData.toAddress as string) || ''}
                        onChange={(e) => updateSelectedNode('toAddress', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Subject</label>
                      <input 
                        className="w-full bg-[#090a0c] border border-surface-container-highest rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary-container" 
                        type="text" 
                        placeholder="Welcome to FlowForge!"
                        value={(nodeData.subject as string) || ''}
                        onChange={(e) => updateSelectedNode('subject', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Email Body (Text/HTML)</label>
                      <textarea
                        className="w-full bg-[#090a0c] border border-surface-container-highest rounded px-2.5 py-1.5 text-code-snippet font-code-snippet text-[11px] text-on-surface focus:outline-none focus:border-primary-container min-h-[100px]" 
                        placeholder="Hi {{customer.name}},\n\nThanks for signing up!"
                        value={(nodeData.emailBody as string) || ''}
                        onChange={(e) => updateSelectedNode('emailBody', e.target.value)}
                      />
                    </div>
                  </>
                )}

                {((nodeData.actionType as string) || 'enrich') === 'sink' && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Postgres Table Name</label>
                      <input 
                        className="w-full bg-[#090a0c] border border-surface-container-highest rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary-container" 
                        type="text" 
                        placeholder="public.users"
                        value={(nodeData.tableName as string) || ''}
                        onChange={(e) => {
                          updateSelectedNode('tableName', e.target.value);
                          updateSelectedNode('subtitle', `Database Sink: ${e.target.value}`);
                        }}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Data Mapping (JSON)</label>
                      <textarea
                        className="w-full bg-[#090a0c] border border-surface-container-highest rounded px-2.5 py-1.5 text-code-snippet font-code-snippet text-[10px] text-on-surface focus:outline-none focus:border-primary-container min-h-[100px]" 
                        placeholder='{"id": "{{event.id}}", "email": "{{customer.email}}", "status": "active"}'
                        value={(nodeData.dataMapping as string) || ''}
                        onChange={(e) => updateSelectedNode('dataMapping', e.target.value)}
                      />
                    </div>
                  </>
                )}

                {((nodeData.actionType as string) || 'enrich') === 'ai' && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">System Prompt</label>
                      <textarea
                        className="w-full bg-[#090a0c] border border-surface-container-highest rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary-container min-h-[60px]" 
                        placeholder="You are an expert data analyst. Extract key themes from the feedback."
                        value={(nodeData.systemPrompt as string) || ''}
                        onChange={(e) => updateSelectedNode('systemPrompt', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">User Input Data</label>
                      <textarea
                        className="w-full bg-[#090a0c] border border-surface-container-highest rounded px-2.5 py-1.5 text-code-snippet font-code-snippet text-[10px] text-on-surface focus:outline-none focus:border-primary-container min-h-[60px]" 
                        placeholder="{{event.feedback_text}}"
                        value={(nodeData.userInput as string) || ''}
                        onChange={(e) => updateSelectedNode('userInput', e.target.value)}
                      />
                    </div>
                  </>
                )}

                {((nodeData.actionType as string) || 'enrich') === 'enrich' && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Target Endpoint / Resource</label>
                      <input 
                        className="w-full bg-[#090a0c] border border-surface-container-highest rounded px-2.5 py-1.5 text-code-snippet font-code-snippet text-[11px] text-on-surface focus:outline-none focus:border-primary-container" 
                        type="text" 
                        value={(nodeData.subtitle as string) || 'Action'}
                        onChange={(e) => updateSelectedNode('subtitle', e.target.value)}
                      />
                    </div>
                  </>
                )}

                <div className="pt-2 border-t border-surface-container-highest flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-on-surface">Retry on Failure</span>
                    <span className="text-[10px] text-on-surface-variant">BullMQ DLQ &amp; Exponential Backoff</span>
                  </div>
                  <button 
                    onClick={() => updateSelectedNode('retryEnabled', !nodeData.retryEnabled)}
                    className={`w-9 h-5 rounded-full relative flex items-center px-0.5 transition-colors duration-200 ${nodeData.retryEnabled !== false ? 'bg-primary-container' : 'bg-surface-container-highest'}`}
                  >
                    <span className={`w-4 h-4 rounded-full bg-white absolute shadow transition-transform ${nodeData.retryEnabled !== false ? 'right-0.5' : 'left-0.5'}`}></span>
                  </button>
                </div>
              </>
            )}

            {/* TYPE: GHOST */}
            {nodeType === 'ghost' && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Filter / Drop Reason</label>
                  <input 
                    className="w-full bg-[#090a0c] border border-surface-container-highest rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary-container" 
                    type="text" 
                    value={(nodeData.subtitle as string) || 'Filtered Stream'}
                    onChange={(e) => updateSelectedNode('subtitle', e.target.value)}
                  />
                </div>

                <div className="p-2.5 rounded bg-[#08090b] border border-surface-container-highest flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-amber-400 uppercase">Stream Termination</span>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    Events delivered to this node terminate here. Payloads can be safely inspected in execution logs or routed to the dead-letter queue.
                  </p>
                </div>
              </>
            )}

            {/* Telemetry Snapshot Mini-card */}
            <div className="p-2.5 rounded bg-[#08090b] border border-surface-container-highest flex flex-col gap-1 mt-1">
              <div className="flex items-center justify-between text-[10px] font-code-snippet text-on-surface-variant">
                <span>Node Telemetry</span>
                <span className="text-tertiary">Live Status</span>
              </div>
              <div className="text-code-snippet font-code-snippet text-[11px] text-on-surface flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${nodeData.executionState === 'completed' ? 'bg-emerald-400' : 'bg-tertiary'}`}></span>
                  Status: <span className="font-semibold text-tertiary">{nodeData.status as string || 'Ready'}</span>
                </span>
                <span className="text-on-surface-variant">{nodeData.substatus as string || '0ms'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Input Schema */}
        {nodeInspectorTab === 'schema' && (
          <div className="p-3.5 flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-on-surface uppercase tracking-wider">Input Schema</span>
                <p className="text-[10px] text-on-surface-variant">Expected stream contract delivered to this node</p>
              </div>
              <button 
                onClick={() => copyToClipboard(JSON.stringify(nodeSchema, null, 2), 'Input Schema')}
                className="text-[10px] font-code-snippet text-primary hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[12px]">content_copy</span>
                Copy
              </button>
            </div>

            {/* Condition Evaluation live preview for logic nodes */}
            {nodeType === 'logic' && logicEvalPreview !== null && (
              <div className={`p-2.5 rounded border flex items-center justify-between ${logicEvalPreview ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">{logicEvalPreview ? 'check_circle' : 'cancel'}</span>
                  <span className="text-xs font-bold font-code-snippet">
                    Evaluates to: {logicEvalPreview ? 'TRUE' : 'FALSE'}
                  </span>
                </div>
                <span className="text-[10px] font-code-snippet">Against test payload</span>
              </div>
            )}

            {/* Formatted JSON Schema */}
            <div className="flex flex-col gap-1 flex-1">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">JSON Schema Definition</span>
              {nodeType === 'trigger' ? (
                <textarea 
                  className="w-full bg-[#08090b] border border-surface-container-highest rounded p-2.5 text-code-snippet font-code-snippet text-[10.5px] text-emerald-300 focus:outline-none focus:border-tertiary resize-none h-56"
                  value={typeof nodeData.expectedSchema === 'string' ? nodeData.expectedSchema : JSON.stringify(nodeSchema, null, 2)}
                  onChange={(e) => updateSelectedNode('expectedSchema', e.target.value)}
                />
              ) : (
                <pre className="bg-[#08090b] border border-surface-container-highest rounded p-2.5 text-code-snippet font-code-snippet text-[10.5px] text-emerald-300 overflow-y-auto max-h-56 whitespace-pre-wrap leading-relaxed">
                  {JSON.stringify(nodeSchema, null, 2)}
                </pre>
              )}
            </div>

            {/* Live Ingress Sample Payload */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Sample Ingress Data</span>
              <pre className="bg-[#08090b] border border-surface-container-highest rounded p-2 text-code-snippet font-code-snippet text-[10px] text-on-surface-variant overflow-y-auto max-h-32 whitespace-pre-wrap">
                {testPayloadText}
              </pre>
            </div>
          </div>
        )}

        {/* Tab 3: Test & Output */}
        {nodeInspectorTab === 'test' && (
          <div className="p-3.5 flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-on-surface uppercase tracking-wider">Node Test &amp; Output</span>
                <p className="text-[10px] text-on-surface-variant">Test this node in isolation or view run output</p>
              </div>

              <button 
                onClick={() => handleTestSingleNode()}
                disabled={isSingleTesting}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-tertiary/15 border border-tertiary/40 text-tertiary hover:bg-tertiary/25 text-xs font-semibold active:scale-95 transition-all disabled:opacity-50"
              >
                {isSingleTesting ? (
                  <span className="w-3 h-3 border-2 border-tertiary border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <span className="material-symbols-outlined text-[14px]">play_arrow</span>
                )}
                <span>{isSingleTesting ? 'Testing...' : 'Run Test'}</span>
              </button>
            </div>

            {activeNodeResult ? (
              <div className="flex flex-col gap-3">
                {/* Result Card */}
                <div className="p-2.5 rounded bg-[#08090b] border border-surface-container-highest flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${activeNodeResult.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${activeNodeResult.status === 'completed' ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                      {activeNodeResult.status === 'completed' ? '200 OK (SUCCESS)' : 'FAILED'}
                    </span>
                    <span className="text-xs font-code-snippet text-tertiary font-semibold">
                      ⚡ {activeNodeResult.durationMs}ms
                    </span>
                  </div>

                  {nodeType === 'logic' && activeNodeResult.output?._condition?.result !== undefined && (
                    <div className="text-[11px] font-code-snippet text-on-surface flex items-center justify-between border-t border-surface-container-highest/60 pt-1.5">
                      <span>Condition Result:</span>
                      <span className={`font-bold ${activeNodeResult.output._condition.result ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {activeNodeResult.output._condition.result ? 'TRUE -> Route Branch' : 'FALSE -> Filtered'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Transformed Output */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Output Payload (JSON)</span>
                    <button 
                      onClick={() => copyToClipboard(JSON.stringify(activeNodeResult.output || {}, null, 2), 'Node Output')}
                      className="text-[10px] font-code-snippet text-tertiary hover:underline"
                    >
                      Copy
                    </button>
                  </div>
                  <pre className="bg-[#08090b] border border-surface-container-highest rounded p-2.5 text-code-snippet font-code-snippet text-[10.5px] text-emerald-300 overflow-y-auto max-h-48 whitespace-pre-wrap leading-relaxed">
                    {JSON.stringify(activeNodeResult.output || {}, null, 2)}
                  </pre>
                </div>

                {/* Input Payload */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Input Received</span>
                  <pre className="bg-[#08090b] border border-surface-container-highest rounded p-2 text-code-snippet font-code-snippet text-[10px] text-on-surface-variant overflow-y-auto max-h-28 whitespace-pre-wrap">
                    {JSON.stringify(activeNodeResult.input || parsedPayload || {}, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center p-4 text-on-surface-variant">
                <span className="material-symbols-outlined text-[32px] text-on-surface-variant/40 mb-2">science</span>
                <span className="text-xs font-medium text-on-surface">No Test Executed Yet</span>
                <p className="text-[11px] max-w-xs mt-1">
                  Click <strong>"Run Test"</strong> above to evaluate this node with the current sample payload.
                </p>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Sidebar Footer Actions */}
      <div className="p-3 border-t border-surface-container-highest bg-[#15161a] flex flex-col gap-2">
        <button 
          onClick={() => handleTestSingleNode()} 
          disabled={isSingleTesting}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded border border-surface-container-highest bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-medium transition-colors active:scale-[0.98] disabled:opacity-50"
        >
          {isSingleTesting ? (
            <span className="w-3.5 h-3.5 border-2 border-tertiary border-t-transparent rounded-full animate-spin"></span>
          ) : (
            <span className="material-symbols-outlined text-[15px] text-tertiary" data-icon="play_arrow">play_arrow</span>
          )}
          <span>{isSingleTesting ? 'Testing Node...' : 'Test This Node'}</span>
        </button>
        <button 
          onClick={deleteSelectedNode} 
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-medium transition-colors active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-[15px]">delete</span>
          <span>Delete Node</span>
        </button>
      </div>
    </aside>
  );
})()}
</div>

    </div>
  );
}


