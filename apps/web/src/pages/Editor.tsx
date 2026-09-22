import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { useToast } from 'av-toastx';
import '@xyflow/react/dist/style.css';
import {
  ReactFlow, MiniMap, Controls,
  useNodesState, useEdgesState, addEdge, Connection, Edge, Node,
} from '@xyflow/react';
import {
  ArrowLeft, Play, Save, Terminal, X, Copy, RefreshCw, Trash2, ChevronDown, Plus,
  Webhook, Clock, Radio, GitBranch, Send, Mail, Database, Sparkles,
  Settings2, FileJson, FlaskConical, History, Box, Link2, CheckCircle2, XCircle, Info,
} from 'lucide-react';

import TriggerNode from '../components/nodes/TriggerNode';
import LogicNode from '../components/nodes/LogicNode';
import ActionNode from '../components/nodes/ActionNode';
import GhostNode from '../components/nodes/GhostNode';
import Logo from '../components/Logo';
import WorkflowScene from '../components/WorkflowScene';
import ThemeToggle from '../components/ThemeToggle';
import { io } from 'socket.io-client';
import { evaluateCondition } from '@flowforge/shared/src/condition';
import { API_BASE, API_V1, webhookUrl } from '../config';
import { Button, Input, Textarea, Select, Field, Badge, Toggle, cn } from '../components/ui';

const nodeTypes = { trigger: TriggerNode, logic: LogicNode, action: ActionNode, ghost: GhostNode };
const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

// Palette shown on the left. Each item creates a node with sensible defaults.
const PALETTE = [
  {
    group: 'Triggers', hint: 'How the automation starts',
    items: [
      { type: 'trigger', label: 'Webhook', desc: 'When a webhook is received', icon: Webhook, data: { triggerType: 'webhook', subtitle: 'When a webhook is received' } },
      { type: 'trigger', label: 'Schedule', desc: 'On a repeating schedule', icon: Clock, data: { triggerType: 'cron', cronExpression: '*/5 * * * *', subtitle: 'Every 5 minutes' } },
      { type: 'trigger', label: 'Incoming event', desc: 'From a Redis stream', icon: Radio, data: { triggerType: 'redis', subtitle: 'From a Redis stream' } },
    ],
  },
  {
    group: 'Logic', hint: 'Branch the flow',
    items: [
      { type: 'logic', label: 'If / condition', desc: 'Only continue if a rule is true', icon: GitBranch, data: { condition: "account_tier === 'enterprise'", subtitle: "If account_tier === 'enterprise'" } },
    ],
  },
  {
    group: 'Actions', hint: 'What the automation does',
    items: [
      { type: 'action', label: 'HTTP request', desc: 'Call any API', icon: Send, data: { actionType: 'http', method: 'POST', subtitle: 'POST to an API' } },
      { type: 'action', label: 'Send email', desc: 'Email someone', icon: Mail, data: { actionType: 'email', subtitle: 'Send an email' } },
      { type: 'action', label: 'Save to database', desc: 'Write a row to Postgres', icon: Database, data: { actionType: 'sink', subtitle: 'Write to database' } },
      { type: 'action', label: 'AI transform', desc: 'Summarize or transform data', icon: Sparkles, data: { actionType: 'ai', subtitle: 'AI transform' } },
    ],
  },
];

export default function Editor() {
  const { user } = useAuth();
  const firstLetter = user?.name ? user.name.charAt(0).toUpperCase() : (user?.email ? user.email.charAt(0).toUpperCase() : 'U');
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [workflowName, setWorkflowName] = useState('My automation');
  const [isDeploying, setIsDeploying] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [consoleTab, setConsoleTab] = useState<'test' | 'webhook' | 'trace' | 'history' | 'nexus'>('test');
  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [testPayloadText, setTestPayloadText] = useState(JSON.stringify({
    event: 'order.created',
    account_tier: 'enterprise',
    amount: 299.50,
    customer: { id: 'cust_90214', name: 'Sarah Connor', email: 'sarah@example.com' },
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
      const res = await axios.get(`${API_V1}/workflows/${id}/executions`, { withCredentials: true });
      setExecutionsList(res.data.executions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingExecutions(false);
    }
  }, [id]);

  const handleRetryExecution = async (executionId: string) => {
    try {
      await axios.post(`${API_V1}/workflows/${executionId}/retry-execution`, {}, { withCredentials: true });
      toast.success('Run re-queued for retry');
      setTimeout(fetchExecutions, 1000);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to retry run');
    }
  };

  useEffect(() => {
    if (id === 'new') { setNodes([]); setEdges([]); } else if (id) {
      axios.get(`${API_V1}/workflows/${id}`, { withCredentials: true })
        .then(res => {
          if (res.data.workflow?.status) setIsActive(res.data.workflow.status === 'active');
          if (res.data.workflow?.name) setWorkflowName(res.data.workflow.name);
          const version = res.data.workflow.versions?.[0];
          if (version && version.definition) {
            const def = version.definition;
            if (def.nodes && def.nodes.length > 0) {
              setNodes(def.nodes.map((n: any) => ({ id: n.id, type: n.type, data: n.config, position: n.position || { x: 0, y: 0 } })));
            } else { setNodes([]); }
            if (def.edges) {
              setEdges(def.edges.map((e: any) => ({
                id: `${e.source}-${e.target}`, source: e.source, target: e.target,
                sourceHandle: e.sourceHandle, targetHandle: e.targetHandle,
                type: 'smoothstep', animated: true,
                style: { stroke: 'rgb(var(--c-accent))', strokeWidth: 2 },
              })));
            } else { setEdges([]); }
          } else { setNodes([]); setEdges([]); }
        })
        .catch(console.error);
      fetchExecutions();
    }
  }, [id, setNodes, setEdges]);

  useEffect(() => {
    if (!id || id === 'new') return;
    const socket = io(`${API_BASE}`, { withCredentials: true });
    socket.on('connect', () => { socket.emit('join_workflow', id); });
    socket.on('workflow_event', (event) => {
      setActiveEvent(event);
      if (event.type === 'execution_finished') fetchExecutions();
    });
    return () => { socket.disconnect(); };
  }, [id, fetchExecutions]);

  const loadPayloadPreset = (presetName: string) => {
    let preset: any = {};
    if (presetName === 'enterprise') {
      preset = { event: 'order.created', account_tier: 'enterprise', amount: 499.00, customer: { id: 'cust_ent_101', name: 'Sarah Connor', email: 'sarah@example.com', account_tier: 'enterprise' }, order: { id: 'ord_ent_991', currency: 'USD' } };
    } else if (presetName === 'standard') {
      preset = { event: 'order.created', account_tier: 'standard', amount: 49.00, customer: { id: 'cust_std_402', name: 'Miles Dyson', email: 'miles@example.net', account_tier: 'standard' }, order: { id: 'ord_std_202', currency: 'USD' } };
    } else if (presetName === 'high_value') {
      preset = { event: 'payment.received', account_tier: 'enterprise', amount: 15000.00, customer: { id: 'cust_vip_777', name: 'John Connor', email: 'john@example.org', account_tier: 'enterprise' }, order: { id: 'ord_vip_888', currency: 'USD' } };
    }
    setTestPayloadText(JSON.stringify(preset, null, 2));
    toast.info(`Loaded ${presetName.replace('_', ' ')} sample`);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.info(`${label} copied`);
  };

  const updateMultipleNodeData = (patch: Record<string, any>) => {
    if (!selectedNode) return;
    const updated = { ...selectedNode, data: { ...selectedNode.data, ...patch } };
    setSelectedNode(updated);
    setNodes((nds) => nds.map((n) => n.id === updated.id ? updated : n));
  };

  const updateSelectedNode = (key: string, value: any) => {
    if (!selectedNode) return;
    const updated = { ...selectedNode, data: { ...selectedNode.data, [key]: value } };
    setSelectedNode(updated);
    setNodes((nds) => nds.map((n) => n.id === updated.id ? updated : n));
  };

  const getNodeInputSchema = (node: Node | null) => {
    if (!node) return {};
    if (node.type === 'trigger') {
      if (node.data?.expectedSchema) {
        try {
          return typeof node.data.expectedSchema === 'string' ? JSON.parse(node.data.expectedSchema) : node.data.expectedSchema;
        } catch { return { error: 'Invalid JSON Schema' }; }
      }
      return {
        title: `${node.data?.label || 'Trigger'} — expected input`,
        description: 'The shape of the event this trigger receives.',
        type: 'object',
        properties: {
          event: { type: 'string', example: 'order.created' },
          account_tier: { type: 'string', enum: ['enterprise', 'standard', 'pro'], example: 'enterprise' },
          amount: { type: 'number', example: 299.50 },
          customer: { type: 'object', properties: { id: { type: 'string' }, email: { type: 'string', format: 'email' }, name: { type: 'string' } } },
        },
        required: ['event'],
      };
    } else if (node.type === 'logic') {
      const cond = (node.data?.condition as string) || (node.data?.subtitle as string) || "account_tier === 'enterprise'";
      return { title: `${node.data?.label || 'Condition'} — input`, description: `Fields checked by the rule: ${cond}`, type: 'object', properties: { account_tier: { type: 'string', example: 'enterprise' }, amount: { type: 'number', example: 299.50 }, customer: { type: 'object' } }, rule: cond };
    }
    return {
      title: `${node.data?.label || 'Action'} — input`,
      description: 'The combined data passed in from earlier steps.',
      type: 'object',
      properties: { event: { type: 'string' }, account_tier: { type: 'string' }, amount: { type: 'number' }, customer: { type: 'object' } },
    };
  };

  const handleTestSingleNode = async (nodeToTest?: Node | null) => {
    const target = nodeToTest || selectedNode;
    if (!target) return;
    setIsSingleTesting(true);

    let currentPayload: any = {};
    try { currentPayload = JSON.parse(testPayloadText); }
    catch { currentPayload = { event: 'order.created', account_tier: 'enterprise', amount: 250 }; }

    const startTime = Date.now();
    await new Promise(r => setTimeout(r, Math.floor(Math.random() * 20) + 15));

    let output: any = { ...currentPayload };
    const status = 'completed';
    let evalRes: boolean | undefined = undefined;
    const nodeType = target.type || 'action';
    const nodeConfig = target.data || {};
    const nodeName = (nodeConfig.label as string) || target.id;
    const nodeLogs: Array<{ time: string; msg: string; level: 'info' | 'success' | 'warn' | 'error' }> = [];
    const addNodeLog = (msg: string, level: 'info' | 'success' | 'warn' | 'error' = 'info') => {
      nodeLogs.push({ time: new Date().toISOString().split('T')[1].slice(0, 8), msg, level });
    };
    addNodeLog(`Testing "${nodeName}" (${nodeType})`, 'info');

    if (nodeType === 'trigger') {
      output = { ...currentPayload, _trigger: { nodeId: target.id, receivedAt: new Date().toISOString(), source: (nodeConfig.subtitle as string) || 'webhook' } };
      addNodeLog(`Received event '${currentPayload.event || 'incoming'}'`, 'success');
    } else if (nodeType === 'logic') {
      const cond = (nodeConfig.condition as string) || (nodeConfig.subtitle as string) || "account_tier === 'enterprise'";
      evalRes = evaluateCondition(nodeConfig, currentPayload);
      output = { ...currentPayload, _condition: { expression: cond, result: evalRes, evaluatedAt: new Date().toISOString() } };
      addNodeLog(`Condition [${cond}] is ${evalRes ? 'TRUE' : 'FALSE'}`, evalRes ? 'success' : 'warn');
    } else if (nodeType === 'action') {
      const at = (nodeConfig.actionType as string) || '';
      if (at === 'sink') {
        output = { ...currentPayload, saved: { table: (nodeConfig.tableName as string) || 'records', rowId: `row_${Date.now().toString().slice(-6)}` } };
        addNodeLog('Row written to database', 'success');
      } else if (at === 'email') {
        output = { ...currentPayload, email: { to: currentPayload.customer?.email || 'user@example.com', status: 'sent' } };
        addNodeLog('Email sent', 'success');
      } else if (at === 'ai') {
        output = { ...currentPayload, ai: { result: 'AI summary (simulated)' } };
        addNodeLog('AI transform complete', 'success');
      } else {
        output = { ...currentPayload, result: { executed: true, timestamp: new Date().toISOString() } };
        addNodeLog('Action executed', 'success');
      }
    } else if (nodeType === 'ghost') {
      output = { ...currentPayload, _dropped: true };
      addNodeLog('Flow stops here', 'warn');
    }

    const durationMs = Date.now() - startTime;
    const resultObj = { status, durationMs, input: currentPayload, output, logs: nodeLogs, evaluationResult: evalRes, timestamp: new Date().toLocaleTimeString() };
    setSingleNodeTestResult(prev => ({ ...prev, [target.id]: resultObj }));

    setNodes(nds => nds.map(n => {
      if (n.id === target.id) {
        const isLogic = n.type === 'logic';
        return { ...n, data: { ...n.data, executionState: status, status: isLogic ? (evalRes ? 'True' : 'False') : 'Success', substatus: `${durationMs}ms`, evaluationResult: evalRes } };
      }
      return n;
    }));

    setIsSingleTesting(false);
    setNodeInspectorTab('test');
    if (evalRes !== undefined) toast.success(`"${nodeName}" → ${evalRes ? 'TRUE' : 'FALSE'}`);
    else toast.success(`"${nodeName}" ran successfully`);
  };

  const handleRunTest = async () => {
    setIsTesting(true);
    setIsConsoleOpen(true);
    setConsoleTab('test');

    let parsedPayload: any = null;
    try { parsedPayload = JSON.parse(testPayloadText); }
    catch { toast.error('The sample data isn\'t valid JSON. Check the editor.'); setIsTesting(false); return; }

    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, executionState: 'running', status: 'Running…' } })));

    try {
      const canvasDefinition = {
        nodes: nodes.map(n => ({ id: n.id, type: n.type || 'default', config: n.data, position: n.position })),
        edges: edges.map(e => ({ source: e.source, target: e.target, sourceHandle: (e as any).sourceHandle })),
      };
      const workflowId = id || 'new';
      const res = await axios.post(`${API_V1}/workflows/${workflowId}/test`, { payload: parsedPayload, definition: canvasDefinition }, { withCredentials: true });
      const data = res.data;
      setTestResult(data);

      const nodeResults = data.nodeResults || {};
      setNodes((nds) => nds.map((n) => {
        const nr = nodeResults[n.id];
        if (!nr) return n;
        const isLogic = n.type === 'logic';
        const evalRes = nr.output?._condition?.result;
        return { ...n, data: { ...n.data, executionState: nr.status, status: nr.status === 'completed' ? (isLogic ? (evalRes ? 'True' : 'False') : 'Success') : nr.status === 'skipped' ? 'Skipped' : 'Failed', substatus: `${nr.durationMs}ms`, evaluationResult: evalRes } };
      }));

      setEdges((eds) => eds.map((e) => {
        const s = nodeResults[e.source], t = nodeResults[e.target];
        const traversed = s?.status === 'completed' && t?.status === 'completed';
        return { ...e, animated: traversed, style: traversed ? { stroke: 'rgb(var(--c-ok))', strokeWidth: 2.5 } : { stroke: 'rgb(var(--c-line))', strokeWidth: 1.5 } };
      }));

      if (data.success) toast.success(`Test passed in ${data.totalDurationMs}ms`);
      else toast.error(`Test failed: ${data.error || 'execution error'}`);
      if (id && id !== 'new') fetchExecutions();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to run test');
    } finally {
      setIsTesting(false);
    }
  };

  const onConnect = useCallback((params: Connection | Edge) => setEdges((eds) => addEdge({ ...params, type: 'smoothstep', animated: true, style: { stroke: 'rgb(var(--c-accent))', strokeWidth: 2 } } as any, eds)), [setEdges]);
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => { setSelectedNode(node); setNodeInspectorTab('config'); }, []);
  const onPaneClick = useCallback(() => setSelectedNode(null), []);

  const addNode = (type: string, label: string, subtitle: string, _icon?: string, _color?: string, defaultData?: Record<string, any>) => {
    const newId = `${type}-${Date.now().toString().slice(-4)}`;
    const newNode: Node = {
      id: newId, type,
      position: { x: 260 + (nodes.length % 5) * 40, y: 140 + (nodes.length % 5) * 60 },
      data: { label, subtitle, status: 'Ready', substatus: '', ...defaultData },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNode(newNode);
    setNodeInspectorTab('config');
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
        const res = await axios.post(`${API_V1}/workflows`, { name: workflowName || 'Untitled automation' }, { withCredentials: true });
        workflowId = res.data.workflow.id;
      } else {
        await axios.put(`${API_V1}/workflows/${workflowId}`, { name: workflowName }, { withCredentials: true });
      }
      const definition = {
        nodes: nodes.map(n => ({ id: n.id, type: n.type || 'default', config: n.data, position: n.position })),
        // Preserve branch handles ('true'/'false') so the engine routes conditions correctly.
        edges: edges.map(e => ({ source: e.source, target: e.target, sourceHandle: (e as any).sourceHandle ?? null, targetHandle: (e as any).targetHandle ?? null })),
      };
      const activeStateToUse = overrideActiveState !== undefined ? overrideActiveState : isActive;
      await axios.post(`${API_V1}/workflows/${workflowId}/activate`, definition, { withCredentials: true });
      if (!activeStateToUse) await axios.post(`${API_V1}/workflows/${workflowId}/deactivate`, {}, { withCredentials: true });
      toast.success('Saved');
      if (id === 'new') navigate(`/editor/${workflowId}`, { replace: true });
      return workflowId;
    } catch (err: any) {
      console.error(err);
      toast.error(`Save failed: ${err.response?.data?.error || err.response?.data?.message || err.message}`);
      return null;
    } finally {
      setIsDeploying(false);
    }
  };

  const onToggleActive = async (nextState: boolean) => {
    setIsActive(nextState);
    try {
      const savedId = await onSave(nextState);
      if (!savedId) { setIsActive(!nextState); return; }
      toast.success(nextState ? 'Automation is live' : 'Automation turned off');
    } catch {
      setIsActive(!nextState);
      toast.error('Failed to change status');
    }
  };

  const liveUrl = id && id !== 'new' ? webhookUrl(id) : '';
  const consoleTabs: { key: typeof consoleTab; label: string; icon: any }[] = [
    { key: 'test', label: 'Test', icon: FlaskConical },
    { key: 'webhook', label: 'Webhook', icon: Link2 },
    { key: 'trace', label: 'Steps', icon: Terminal },
    { key: 'history', label: 'Runs', icon: History },
    { key: 'nexus', label: '3D', icon: Box },
  ];

  return (
    <div className="h-screen flex flex-col bg-canvas text-ink overflow-hidden">
      {/* Header */}
      <header className="h-14 shrink-0 border-b border-line bg-surface px-3 sm:px-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 px-2 h-8 rounded-lg text-sm text-muted hover:text-ink hover:bg-surface-2 transition-colors">
            <ArrowLeft size={16} /> <span className="hidden sm:inline">Back</span>
          </Link>
          <div className="h-5 w-px bg-line hidden sm:block" />
          <Logo size="sm" showText={false} />
          <input
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="bg-transparent text-sm font-semibold text-ink px-2 py-1 rounded-md hover:bg-surface-2 focus:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-accent/20 max-w-[180px] sm:max-w-[280px] truncate"
            placeholder="Automation name"
          />
          <Badge tone={isActive ? 'ok' : 'neutral'} dot>{isActive ? 'Live' : 'Draft'}</Badge>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button size="sm" variant="secondary" onClick={() => setIsConsoleOpen((o) => !o)} className={isConsoleOpen ? 'border-accent/40 text-accent' : ''}>
            <Terminal size={15} /> <span className="hidden sm:inline">Console</span>
          </Button>
          <Button size="sm" variant="secondary" onClick={handleRunTest} loading={isTesting}>
            <Play size={15} /> <span className="hidden sm:inline">{isTesting ? 'Running…' : 'Test'}</span>
          </Button>
          <Button size="sm" onClick={() => onSave()} loading={isDeploying}>
            <Save size={15} /> <span className="hidden sm:inline">Save</span>
          </Button>
          <div className="hidden sm:flex items-center gap-2 pl-1">
            <span className={cn('text-xs font-medium', isActive ? 'text-ok' : 'text-muted')}>{isActive ? 'On' : 'Off'}</span>
            <Toggle checked={isActive} onChange={onToggleActive} disabled={isDeploying} />
          </div>
          <button onClick={() => navigate('/account')} className="w-8 h-8 rounded-full bg-accent-soft text-accent text-xs font-bold grid place-items-center hover:ring-2 hover:ring-accent/30 transition-all" title="Account">
            {firstLetter}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Palette */}
        <aside className="w-60 shrink-0 border-r border-line bg-surface flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-line">
            <h2 className="text-sm font-semibold text-ink">Add a step</h2>
            <p className="text-xs text-muted mt-0.5">Click to add it to the canvas, then connect the dots.</p>
          </div>
          <div className="p-3 flex flex-col gap-5">
            {PALETTE.map((grp) => (
              <div key={grp.group}>
                <div className="px-1 mb-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-faint">{grp.group}</div>
                  <div className="text-[11px] text-muted">{grp.hint}</div>
                </div>
                <div className="flex flex-col gap-1.5">
                  {grp.items.map((it) => (
                    <button
                      key={it.label}
                      onClick={() => addNode(it.type, it.label, it.data.subtitle || it.desc, undefined, undefined, it.data)}
                      className="group flex items-center gap-2.5 p-2.5 rounded-xl border border-line bg-surface hover:border-accent/40 hover:bg-surface-2 transition-all text-left"
                    >
                      <span className="w-8 h-8 rounded-lg bg-surface-2 border border-line text-accent grid place-items-center shrink-0">
                        <it.icon size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium text-ink truncate">{it.label}</span>
                        <span className="block text-[11px] text-muted truncate">{it.desc}</span>
                      </span>
                      <Plus size={15} className="text-faint group-hover:text-accent transition-colors shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Canvas + console */}
        <main className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 relative bg-grid">
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
              proOptions={{ hideAttribution: true }}
            >
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable nodeColor="#6366f1" />
            </ReactFlow>

            {nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center max-w-xs px-6">
                  <div className="w-12 h-12 rounded-xl bg-accent-soft text-accent grid place-items-center mx-auto"><Webhook size={22} /></div>
                  <h3 className="mt-4 text-base font-semibold text-ink">Start with a trigger</h3>
                  <p className="mt-1.5 text-sm text-muted">Add a trigger from the left to decide when this automation runs, then add actions and connect them.</p>
                </div>
              </div>
            )}
          </div>

          {/* Console */}
          {isConsoleOpen ? (
            <div className="h-80 shrink-0 border-t border-line bg-surface flex flex-col">
              <div className="h-11 shrink-0 border-b border-line px-2 flex items-center justify-between">
                <div className="flex items-center gap-1 h-full">
                  {consoleTabs.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => { setConsoleTab(t.key); if (t.key === 'history') fetchExecutions(); }}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 h-full text-[13px] font-medium border-b-2 transition-colors',
                        consoleTab === t.key ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
                      )}
                    >
                      <t.icon size={14} /> {t.label}
                      {t.key === 'trace' && testResult?.nodeResults ? ` (${Object.keys(testResult.nodeResults).length})` : ''}
                      {t.key === 'history' ? ` (${executionsList.length})` : ''}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 pr-1">
                  {consoleTab === 'test' && <Button size="sm" onClick={handleRunTest} loading={isTesting}><Play size={14} /> Run test</Button>}
                  {(consoleTab === 'history' || consoleTab === 'webhook') && (
                    <Button size="sm" variant="ghost" onClick={fetchExecutions}><RefreshCw size={14} className={isLoadingExecutions ? 'animate-spin' : ''} /> Refresh</Button>
                  )}
                  <button onClick={() => setIsConsoleOpen(false)} className="w-8 h-8 grid place-items-center rounded-lg text-muted hover:text-ink hover:bg-surface-2"><ChevronDown size={16} /></button>
                </div>
              </div>

              <div className="flex-1 overflow-hidden">
                {consoleTab === 'test' && (
                  <div className="grid grid-cols-2 h-full">
                    <div className="border-r border-line p-3 flex flex-col gap-2 min-h-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-ink flex items-center gap-1.5"><FileJson size={13} className="text-accent" /> Sample event (JSON)</span>
                        <div className="flex items-center gap-1 text-[11px] text-muted">
                          <button onClick={() => loadPayloadPreset('enterprise')} className="px-1.5 py-0.5 rounded hover:bg-surface-2">Enterprise</button>
                          <button onClick={() => loadPayloadPreset('standard')} className="px-1.5 py-0.5 rounded hover:bg-surface-2">Standard</button>
                        </div>
                      </div>
                      <textarea value={testPayloadText} onChange={(e) => setTestPayloadText(e.target.value)} spellCheck={false}
                        className="flex-1 w-full rounded-lg bg-surface-2 border border-line font-mono text-[11px] text-ink p-2.5 focus:outline-none focus:border-accent resize-none leading-relaxed" />
                    </div>
                    <div className="p-3 overflow-y-auto min-h-0">
                      {testResult ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <Badge tone={testResult.success ? 'ok' : 'danger'} dot>{testResult.success ? 'Passed' : 'Failed'}</Badge>
                            <span className="text-xs text-muted font-mono">{testResult.totalDurationMs}ms</span>
                          </div>
                          <div className="rounded-lg border border-line bg-surface-2 p-2.5 font-mono text-[11px] flex flex-col gap-1 overflow-y-auto">
                            {testResult.logs?.map((log: any, i: number) => (
                              <div key={i} className="flex items-start gap-2">
                                <span className="text-faint shrink-0">{log.timestamp}</span>
                                <span className={cn('break-all',
                                  log.level === 'success' ? 'text-ok' : log.level === 'error' ? 'text-danger' : log.level === 'warn' ? 'text-warn' : 'text-muted')}>
                                  {log.message}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center text-muted">
                          <Terminal size={26} className="text-faint mb-2" />
                          <p className="text-sm font-medium text-ink">Run a test</p>
                          <p className="text-xs mt-1 max-w-xs">Sends the sample event through your steps and shows what happens — without going live.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {consoleTab === 'webhook' && (
                  <div className="h-full overflow-y-auto p-4 flex flex-col gap-3">
                    <div className="flex items-start gap-2 text-sm text-muted">
                      <Info size={16} className="text-accent mt-0.5 shrink-0" />
                      <p>When this automation is <b className="text-ink">live</b>, send events to its URL to trigger it. Point Stripe, GitHub, or your own app at it.</p>
                    </div>
                    <div className="rounded-xl border border-line bg-surface-2 p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-faint mb-1.5">Webhook URL</div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs font-mono text-ink truncate">{liveUrl || 'Save the automation to get its URL'}</code>
                        {liveUrl && <button onClick={() => copyToClipboard(liveUrl, 'Webhook URL')} className="w-8 h-8 grid place-items-center rounded-lg text-muted hover:text-ink hover:bg-surface"><Copy size={14} /></button>}
                      </div>
                    </div>
                    {liveUrl && (
                      <div className="rounded-xl border border-line bg-surface-2 p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-faint">Try it from a terminal</div>
                          <button onClick={() => copyToClipboard(`curl -X POST ${liveUrl} -H "Content-Type: application/json" -d '{"event":"order.created","account_tier":"enterprise","amount":250}'`, 'Command')} className="text-xs text-accent hover:underline flex items-center gap-1"><Copy size={12} /> Copy</button>
                        </div>
                        <pre className="text-[11px] font-mono text-muted whitespace-pre-wrap break-all">{`curl -X POST ${liveUrl} \\
  -H "Content-Type: application/json" \\
  -d '{"event":"order.created","account_tier":"enterprise","amount":250}'`}</pre>
                      </div>
                    )}
                  </div>
                )}

                {consoleTab === 'trace' && (
                  <div className="h-full overflow-y-auto p-3">
                    {testResult?.nodeResults && Object.keys(testResult.nodeResults).length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {Object.values(testResult.nodeResults).map((nr: any) => (
                          <div key={nr.nodeId} className="rounded-xl border border-line bg-surface-2 p-2.5">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[13px] font-medium text-ink truncate">{nr.nodeName}</span>
                              <Badge tone={nr.status === 'completed' ? 'ok' : nr.status === 'skipped' ? 'neutral' : 'danger'}>{nr.status}</Badge>
                            </div>
                            <pre className="rounded-lg bg-surface border border-line p-2 text-[10px] font-mono text-muted max-h-28 overflow-y-auto whitespace-pre-wrap">{JSON.stringify(nr.output || {}, null, 2)}</pre>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-sm text-muted">Run a test to see each step's result here.</div>
                    )}
                  </div>
                )}

                {consoleTab === 'history' && (
                  <div className="h-full overflow-y-auto p-3 flex flex-col gap-2">
                    {executionsList.length > 0 ? executionsList.map((exec) => (
                      <div key={exec.id} className="rounded-xl border border-line bg-surface-2">
                        <button onClick={() => setExpandedExecutionId(p => p === exec.id ? null : exec.id)} className="w-full flex items-center justify-between p-3 text-left">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {exec.status === 'completed' ? <CheckCircle2 size={16} className="text-ok shrink-0" /> : <XCircle size={16} className="text-danger shrink-0" />}
                            <div className="min-w-0">
                              <div className="text-[13px] text-ink font-mono truncate">{exec.id.slice(0, 18)}…</div>
                              <div className="text-[11px] text-muted">{new Date(exec.startedAt).toLocaleString()} · {exec.nodeExecutions?.length || 0} steps</div>
                            </div>
                          </div>
                          <Badge tone={exec.status === 'completed' ? 'ok' : 'danger'}>{exec.status}</Badge>
                        </button>
                        {expandedExecutionId === exec.id && exec.nodeExecutions && (
                          <div className="px-3 pb-3 flex flex-col gap-2 border-t border-line pt-3">
                            {exec.nodeExecutions.map((ne: any) => (
                              <div key={ne.id} className="rounded-lg border border-line bg-surface p-2">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-mono text-ink">{ne.nodeId}</span>
                                  <Badge tone={ne.status === 'completed' ? 'ok' : 'danger'}>{ne.status}</Badge>
                                </div>
                                <pre className={cn('text-[10px] font-mono max-h-24 overflow-y-auto whitespace-pre-wrap', ne.error ? 'text-danger' : 'text-muted')}>{ne.error ? String(ne.error) : JSON.stringify(ne.output, null, 2)}</pre>
                              </div>
                            ))}
                            {exec.status === 'failed' && (
                              <Button size="sm" variant="secondary" onClick={() => handleRetryExecution(exec.id)}><RefreshCw size={14} /> Retry this run</Button>
                            )}
                          </div>
                        )}
                      </div>
                    )) : (
                      <div className="h-full flex flex-col items-center justify-center text-center text-muted">
                        <History size={26} className="text-faint mb-2" />
                        <p className="text-sm">No runs yet. Run a test or send an event to the webhook URL.</p>
                      </div>
                    )}
                  </div>
                )}

                {consoleTab === 'nexus' && (
                  <div className="h-full w-full p-2">
                    <WorkflowScene nodes={nodes} edges={edges} activeEvent={activeEvent} healthState={healthState as any} />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <button onClick={() => setIsConsoleOpen(true)} className="h-9 shrink-0 border-t border-line bg-surface px-4 flex items-center gap-2 text-[13px] text-muted hover:text-ink transition-colors">
              <Terminal size={15} className="text-accent" /> Open run console
              {testResult && <Badge tone={testResult.success ? 'ok' : 'danger'} className="ml-1">{testResult.success ? 'Last test passed' : 'Last test failed'}</Badge>}
            </button>
          )}
        </main>

        {/* Inspector */}
        {selectedNode && (() => {
          const nodeType = selectedNode.type || 'action';
          const nodeData = (selectedNode.data || {}) as Record<string, any>;
          const activeNodeResult = singleNodeTestResult[selectedNode.id] || testResult?.nodeResults?.[selectedNode.id];
          const nodeSchema = getNodeInputSchema(selectedNode);

          let logicEvalPreview: boolean | null = null;
          let parsedPayload: any = {};
          try {
            parsedPayload = JSON.parse(testPayloadText);
            if (nodeType === 'logic') logicEvalPreview = evaluateCondition(nodeData, parsedPayload);
          } catch { logicEvalPreview = null; }

          const inspectorTabs: { key: typeof nodeInspectorTab; label: string; icon: any }[] = [
            { key: 'config', label: 'Settings', icon: Settings2 },
            { key: 'schema', label: 'Input', icon: FileJson },
            { key: 'test', label: 'Test', icon: FlaskConical },
          ];

          return (
            <aside className="w-[380px] shrink-0 border-l border-line bg-surface flex flex-col overflow-hidden">
              <div className="p-4 border-b border-line flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink truncate">{(nodeData.label as string) || 'Step settings'}</div>
                  <div className="text-[11px] text-muted capitalize">{nodeType === 'logic' ? 'condition' : nodeType} · {selectedNode.id}</div>
                </div>
                <button onClick={() => setSelectedNode(null)} className="w-8 h-8 grid place-items-center rounded-lg text-muted hover:text-ink hover:bg-surface-2 shrink-0"><X size={16} /></button>
              </div>

              <div className="px-3 pt-3">
                <div className="inline-flex w-full items-center gap-1 p-1 rounded-lg border border-line bg-surface-2">
                  {inspectorTabs.map((t) => (
                    <button key={t.key} onClick={() => setNodeInspectorTab(t.key)}
                      className={cn('flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-md text-[13px] font-medium transition-colors',
                        nodeInspectorTab === t.key ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}>
                      <t.icon size={14} /> {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {nodeInspectorTab === 'config' && (
                  <div className="flex flex-col gap-4">
                    <Field label="Step name"><Input value={(nodeData.label as string) || ''} onChange={(e) => updateSelectedNode('label', e.target.value)} /></Field>

                    {nodeType === 'trigger' && (
                      <>
                        <Field label="Trigger type">
                          <Select value={(nodeData.triggerType as string) || 'webhook'} onChange={(e) => updateSelectedNode('triggerType', e.target.value)}>
                            <option value="webhook">Webhook (an HTTP request arrives)</option>
                            <option value="cron">Schedule (run on a timer)</option>
                            <option value="redis">Incoming event (Redis stream)</option>
                          </Select>
                        </Field>

                        {((nodeData.triggerType as string) || 'webhook') === 'webhook' && (
                          <>
                            <Field label="Security" hint="How incoming requests are verified.">
                              <Select value={(nodeData.authType as string) || 'public'} onChange={(e) => updateSelectedNode('authType', e.target.value)}>
                                <option value="public">Open — anyone with the URL</option>
                                <option value="stripe">Stripe signature</option>
                                <option value="hmac">Signature (HMAC SHA-256, e.g. GitHub)</option>
                                <option value="bearer">Bearer token / API key</option>
                              </Select>
                            </Field>
                            {nodeData.authType === 'stripe' && (
                              <Field label="Stripe signing secret" hint="From your Stripe webhook endpoint (starts with whsec_). The header is always stripe-signature.">
                                <Input type="password" className="font-mono" placeholder="whsec_…" value={(nodeData.authSecret as string) || ''} onChange={(e) => updateSelectedNode('authSecret', e.target.value)} />
                              </Field>
                            )}
                            {nodeData.authType === 'hmac' && (
                              <div className="flex flex-col gap-4 p-3 rounded-xl bg-surface-2 border border-line">
                                <Field label="Signature header"><Input className="font-mono" placeholder="stripe-signature" value={(nodeData.authHeaderName as string) || ''} onChange={(e) => updateSelectedNode('authHeaderName', e.target.value)} /></Field>
                                <Field label="Signing secret"><Input type="password" className="font-mono" placeholder="whsec_…" value={(nodeData.authSecret as string) || ''} onChange={(e) => updateSelectedNode('authSecret', e.target.value)} /></Field>
                              </div>
                            )}
                            {nodeData.authType === 'bearer' && (
                              <Field label="Expected token"><Input type="password" className="font-mono" placeholder="sk_live_…" value={(nodeData.authSecret as string) || ''} onChange={(e) => updateSelectedNode('authSecret', e.target.value)} /></Field>
                            )}
                          </>
                        )}

                        {((nodeData.triggerType as string) || 'webhook') === 'cron' && (
                          <div className="flex flex-col gap-4 p-3 rounded-xl bg-surface-2 border border-line">
                            <Field label="Schedule (cron)" hint="e.g. */5 * * * * = every 5 minutes">
                              <Input className="font-mono" placeholder="*/5 * * * *" value={(nodeData.cronExpression as string) || '*/5 * * * *'}
                                onChange={(e) => { updateSelectedNode('cronExpression', e.target.value); updateSelectedNode('subtitle', `Schedule: ${e.target.value}`); }} />
                            </Field>
                            <Field label="Timezone">
                              <Select value={(nodeData.timezone as string) || 'UTC'} onChange={(e) => updateSelectedNode('timezone', e.target.value)}>
                                <option value="UTC">UTC</option>
                                <option value="America/New_York">America/New_York</option>
                                <option value="Europe/London">Europe/London</option>
                                <option value="Asia/Tokyo">Asia/Tokyo</option>
                              </Select>
                            </Field>
                          </div>
                        )}

                        {((nodeData.triggerType as string) || 'webhook') === 'redis' && (
                          <div className="flex flex-col gap-4 p-3 rounded-xl bg-surface-2 border border-line">
                            <Field label="Stream / topic"><Input className="font-mono" placeholder="events:signups" value={(nodeData.redisTopic as string) || ''} onChange={(e) => { updateSelectedNode('redisTopic', e.target.value); updateSelectedNode('subtitle', `Stream: ${e.target.value}`); }} /></Field>
                            <Field label="Consumer group"><Input className="font-mono" placeholder="flowforge-workers" value={(nodeData.redisConsumerGroup as string) || 'flowforge-workers'} onChange={(e) => updateSelectedNode('redisConsumerGroup', e.target.value)} /></Field>
                            <Field label="Connection URI"><Input type="password" className="font-mono" placeholder="redis://…" value={(nodeData.redisUri as string) || ''} onChange={(e) => updateSelectedNode('redisUri', e.target.value)} /></Field>
                          </div>
                        )}
                      </>
                    )}

                    {nodeType === 'logic' && (
                      <>
                        <Field label="Condition" hint="Continue only when this is true. Use a field, an operator, and a value.">
                          <Textarea rows={2} className="font-mono text-emerald-600 dark:text-emerald-400"
                            value={(nodeData.condition as string) || (nodeData.subtitle as string) || "account_tier === 'enterprise'"}
                            onChange={(e) => { updateSelectedNode('condition', e.target.value); updateSelectedNode('subtitle', `If: ${e.target.value}`); }} />
                        </Field>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { l: "tier is enterprise", v: "account_tier === 'enterprise'" },
                            { l: "amount > 100", v: 'amount > 100' },
                            { l: "email ends .io", v: "customer.email.endsWith('.io')" },
                          ].map((p) => (
                            <button key={p.l} onClick={() => { updateSelectedNode('condition', p.v); updateSelectedNode('subtitle', `If: ${p.v}`); }}
                              className="px-2 py-1 rounded-md bg-surface-2 border border-line text-[11px] font-mono text-muted hover:text-ink hover:border-accent/40 transition-colors">{p.l}</button>
                          ))}
                        </div>
                        {logicEvalPreview !== null && (
                          <div className={cn('rounded-xl border p-3 flex items-center justify-between text-sm font-medium',
                            logicEvalPreview ? 'bg-ok/10 border-ok/25 text-ok' : 'bg-warn/10 border-warn/25 text-warn')}>
                            <span>With the sample data, this is {logicEvalPreview ? 'TRUE' : 'FALSE'}</span>
                            {logicEvalPreview ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                          </div>
                        )}
                        <div className="rounded-xl border border-line bg-surface-2 p-3 text-xs text-muted">
                          Connect the <b className="text-ok">True</b> handle to the step that should run when the rule passes, and the <b className="text-warn">False</b> handle to the other path.
                        </div>
                      </>
                    )}

                    {nodeType === 'action' && (
                      <>
                        <Field label="Action type">
                          <Select value={(nodeData.actionType as string) || 'http'} onChange={(e) => {
                            const v = e.target.value;
                            if (v === 'sink') updateMultipleNodeData({ actionType: v, label: 'Save to database', subtitle: 'Write to database' });
                            else if (v === 'email') updateMultipleNodeData({ actionType: v, label: 'Send email', subtitle: 'Send an email' });
                            else if (v === 'ai') updateMultipleNodeData({ actionType: v, label: 'AI transform', subtitle: 'AI transform' });
                            else updateMultipleNodeData({ actionType: v, label: 'HTTP request', subtitle: 'POST to an API' });
                          }}>
                            <option value="http">HTTP request</option>
                            <option value="email">Send email</option>
                            <option value="sink">Save to database (Postgres)</option>
                            <option value="ai">AI transform</option>
                          </Select>
                        </Field>

                        {((nodeData.actionType as string) || 'http') === 'http' && (
                          <>
                            <Field label="URL"><Input className="font-mono" placeholder="https://api.example.com/notify" value={(nodeData.url as string) || ''} onChange={(e) => { updateSelectedNode('url', e.target.value); updateSelectedNode('subtitle', `${nodeData.method || 'POST'} ${e.target.value}`); }} /></Field>
                            <div className="grid grid-cols-2 gap-3">
                              <Field label="Method">
                                <Select value={(nodeData.method as string) || 'POST'} onChange={(e) => { updateSelectedNode('method', e.target.value); updateSelectedNode('subtitle', `${e.target.value} ${nodeData.url || ''}`); }}>
                                  <option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option>
                                </Select>
                              </Field>
                              <Field label="Timeout (ms)"><Input type="number" value={nodeData.timeoutMs || 5000} onChange={(e) => updateSelectedNode('timeoutMs', Number(e.target.value))} /></Field>
                            </div>
                            <Field label="Headers (JSON)"><Textarea rows={2} className="font-mono" placeholder='{"Authorization":"Bearer …"}' value={(nodeData.headers as string) || ''} onChange={(e) => updateSelectedNode('headers', e.target.value)} /></Field>
                            <Field label="Body (JSON)" hint="Use {{path}} to insert values, e.g. {{customer.email}}."><Textarea rows={4} className="font-mono" placeholder='{"email":"{{customer.email}}"}' value={(nodeData.body as string) || ''} onChange={(e) => updateSelectedNode('body', e.target.value)} /></Field>
                          </>
                        )}

                        {((nodeData.actionType as string) || '') === 'email' && (
                          <>
                            <Field label="From" hint="Must be a verified sender in Resend. Leave blank to use the default.">
                              <Input placeholder="you@yourdomain.com" value={(nodeData.fromAddress as string) || ''} onChange={(e) => updateSelectedNode('fromAddress', e.target.value)} />
                            </Field>
                            <Field label="To"><Input placeholder="{{customer.email}}" value={(nodeData.toAddress as string) || ''} onChange={(e) => updateSelectedNode('toAddress', e.target.value)} /></Field>
                            <Field label="Subject"><Input placeholder="Welcome!" value={(nodeData.subject as string) || ''} onChange={(e) => updateSelectedNode('subject', e.target.value)} /></Field>
                            <Field label="Message" hint="Plain text or HTML. Use {{path}} to insert values."><Textarea rows={5} placeholder="Hi {{customer.name}}, thanks for signing up!" value={(nodeData.emailBody as string) || ''} onChange={(e) => updateSelectedNode('emailBody', e.target.value)} /></Field>
                          </>
                        )}

                        {((nodeData.actionType as string) || '') === 'sink' && (
                          <>
                            <Field label="Table" hint="Include the schema if needed, e.g. public.orders."><Input className="font-mono" placeholder="public.orders" value={(nodeData.tableName as string) || ''} onChange={(e) => { updateSelectedNode('tableName', e.target.value); updateSelectedNode('subtitle', `Write to ${e.target.value}`); }} /></Field>
                            <Field label="Columns (JSON)" hint="Map each column to a value. Use {{path}} to pull from the event."><Textarea rows={4} className="font-mono" placeholder='{"email":"{{customer.email}}","amount":"{{amount}}"}' value={(nodeData.dataMapping as string) || ''} onChange={(e) => updateSelectedNode('dataMapping', e.target.value)} /></Field>
                            <Field label="Connection string (optional)" hint="A Postgres URL to write to. Leave blank to use FlowForge's own database. The table must already exist.">
                              <Input type="password" className="font-mono" placeholder="postgres://user:pass@host:5432/db?sslmode=require" value={(nodeData.pgUri as string) || ''} onChange={(e) => updateSelectedNode('pgUri', e.target.value)} />
                            </Field>
                          </>
                        )}

                        {((nodeData.actionType as string) || '') === 'ai' && (
                          <>
                            <Field label="Model">
                              <Select value={(nodeData.model as string) || 'claude-opus-5'} onChange={(e) => updateSelectedNode('model', e.target.value)}>
                                <option value="claude-opus-5">Claude Opus 5 — most capable</option>
                                <option value="claude-sonnet-5">Claude Sonnet 5 — balanced</option>
                                <option value="claude-haiku-4-5">Claude Haiku 4.5 — fastest / cheapest</option>
                              </Select>
                            </Field>
                            <Field label="Instructions" hint="What the model should do."><Textarea rows={4} placeholder="Summarize the feedback into 3 bullet points." value={(nodeData.systemPrompt as string) || ''} onChange={(e) => updateSelectedNode('systemPrompt', e.target.value)} /></Field>
                            <Field label="Input data" hint="The text to transform. Use {{path}} to pull from the event."><Textarea rows={2} className="font-mono" placeholder="{{feedback_text}}" value={(nodeData.userInput as string) || ''} onChange={(e) => updateSelectedNode('userInput', e.target.value)} /></Field>
                          </>
                        )}

                        <div className="flex items-center justify-between pt-1">
                          <div>
                            <div className="text-sm font-medium text-ink">Retry on failure</div>
                            <div className="text-xs text-muted">Retries with backoff if the step fails.</div>
                          </div>
                          <Toggle checked={nodeData.retryEnabled !== false} onChange={(v) => updateSelectedNode('retryEnabled', v)} />
                        </div>
                      </>
                    )}

                    {nodeType === 'ghost' && (
                      <Field label="Reason"><Input value={(nodeData.subtitle as string) || 'Filtered'} onChange={(e) => updateSelectedNode('subtitle', e.target.value)} /></Field>
                    )}
                  </div>
                )}

                {nodeInspectorTab === 'schema' && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-ink">Expected input</span>
                      <button onClick={() => copyToClipboard(JSON.stringify(nodeSchema, null, 2), 'Schema')} className="text-xs text-accent hover:underline flex items-center gap-1"><Copy size={12} /> Copy</button>
                    </div>
                    {nodeType === 'trigger' ? (
                      <Textarea rows={12} className="font-mono text-[11px]" value={typeof nodeData.expectedSchema === 'string' ? nodeData.expectedSchema : JSON.stringify(nodeSchema, null, 2)} onChange={(e) => updateSelectedNode('expectedSchema', e.target.value)} />
                    ) : (
                      <pre className="rounded-xl border border-line bg-surface-2 p-3 font-mono text-[11px] text-muted overflow-auto max-h-72 whitespace-pre-wrap">{JSON.stringify(nodeSchema, null, 2)}</pre>
                    )}
                    <div className="text-xs text-muted">Sample event currently in the console:</div>
                    <pre className="rounded-xl border border-line bg-surface-2 p-3 font-mono text-[11px] text-muted overflow-auto max-h-40 whitespace-pre-wrap">{testPayloadText}</pre>
                  </div>
                )}

                {nodeInspectorTab === 'test' && (
                  <div className="flex flex-col gap-4">
                    <Button variant="secondary" onClick={() => handleTestSingleNode()} loading={isSingleTesting} className="w-full">
                      <Play size={15} /> {isSingleTesting ? 'Testing…' : 'Test this step'}
                    </Button>
                    {activeNodeResult ? (
                      <>
                        <div className="rounded-xl border border-line bg-surface-2 p-3 flex items-center justify-between">
                          <Badge tone={activeNodeResult.status === 'completed' ? 'ok' : 'danger'} dot>{activeNodeResult.status === 'completed' ? 'Success' : 'Failed'}</Badge>
                          <span className="text-xs font-mono text-muted">{activeNodeResult.durationMs}ms</span>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1.5"><span className="text-xs font-medium text-ink">Output</span>
                            <button onClick={() => copyToClipboard(JSON.stringify(activeNodeResult.output || {}, null, 2), 'Output')} className="text-xs text-accent hover:underline">Copy</button></div>
                          <pre className="rounded-xl border border-line bg-surface-2 p-3 font-mono text-[11px] text-muted overflow-auto max-h-64 whitespace-pre-wrap">{JSON.stringify(activeNodeResult.output || {}, null, 2)}</pre>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
                        Test this single step with the sample event to preview its output.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-line">
                <Button variant="danger" onClick={deleteSelectedNode} className="w-full"><Trash2 size={15} /> Delete step</Button>
              </div>
            </aside>
          );
        })()}
      </div>
    </div>
  );
}
