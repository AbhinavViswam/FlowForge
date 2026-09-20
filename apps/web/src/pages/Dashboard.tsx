import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useToast } from 'av-toastx';
import ThemeToggle from '../components/ThemeToggle';
import Logo from '../components/Logo';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'draft' | 'quarantined'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    confirmStyle: string;
    onConfirm: () => void;
  } | null>(null);

  const [stats, setStats] = useState({ totalExecutions: 0, successRate: 0 });

  const globalHealthState = React.useMemo(() => {
    if (stats.totalExecutions === 0) return 'healthy';
    if (stats.successRate < 80) return 'incident';
    if (stats.successRate < 95) return 'degraded';
    return 'healthy';
  }, [stats]);

  const fetchWorkflows = async () => {
    if (!user) return;
    try {
      const [wfRes, statsRes] = await Promise.all([
        axios.get('http://localhost:3000/api/v1/workflows', { withCredentials: true }),
        axios.get('http://localhost:3000/api/v1/workflows/stats', { withCredentials: true })
      ]);
      setWorkflows(wfRes.data.workflows || []);
      setStats(statsRes.data || { totalExecutions: 0, successRate: 0 });
    } catch (err) {
      console.error(err);
      toast.error('Failed to load workflows');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, [user]);

  const handleCreateWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkflowName.trim()) return;
    setIsCreating(true);
    try {
      const res = await axios.post(
        'http://localhost:3000/api/v1/workflows', 
        { name: newWorkflowName, prompt: aiPrompt.trim() || undefined }, 
        { withCredentials: true }
      );
      toast.success(aiPrompt.trim() ? 'AI generated workflow!' : 'Workflow created!');
      setIsCreateModalOpen(false);
      setNewWorkflowName('');
      setAiPrompt('');
      navigate(`/editor/${res.data.workflow.id}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to create workflow');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmModal({
      isOpen: true,
      title: 'Delete Workflow',
      message: 'Are you sure you want to delete this workflow? This action cannot be undone.',
      confirmText: 'Delete',
      confirmStyle: 'bg-rose-500 hover:bg-rose-600 text-base-content',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await axios.delete(`http://localhost:3000/api/v1/workflows/${id}`, { withCredentials: true });
          toast.success('Workflow deleted successfully');
          fetchWorkflows();
          } catch (err: any) {
            console.error(err);
            toast.error(`Delete failed: ${err.response?.data?.error || err.message}`);
          }
      }
    });
  };

  const handleLogout = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Sign Out',
      message: 'Are you sure you want to sign out of FlowForge Console?',
      confirmText: 'Sign Out',
      confirmStyle: 'bg-base-300 hover:bg-base-300/80 border border-base-300 text-base-content',
      onConfirm: () => {
        setConfirmModal(null);
        logout();
        navigate('/');
      }
    });
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <div className="animate-pulse"><Logo size="lg" showText={false} /></div>
      </div>
    );
  }

  const activeCount = workflows.filter(w => w.status === 'active').length;
  const draftCount = workflows.filter(w => w.status === 'draft').length;
  const quarantinedCount = 0;

  const filteredWorkflows = workflows
    .filter(w => filter === 'all' || (filter === 'quarantined' ? false : w.status === filter))
    .filter(w => w.name?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-base-300 bg-base-100/90 backdrop-blur-md px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <a className="flex items-center gap-2.5 group" href="#">
            <Logo />
          </a>
          <nav className="hidden md:flex items-center gap-6 text-[13px] font-medium text-base-content/60">
            <a className="text-base-content font-semibold" href="#">Workflows</a>
            <a className="hover:text-base-content/80 transition-colors" href="#">Queues</a>
            <a className="hover:text-base-content/80 transition-colors" href="#">Telemetry</a>
            <a className="hover:text-base-content/80 transition-colors" href="#">Docs</a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-base-300 border border-base-300">
              <span className={`w-1.5 h-1.5 rounded-full ${globalHealthState === 'incident' ? 'bg-rose-500 animate-pulse' : globalHealthState === 'degraded' ? 'bg-amber-500' : 'bg-emerald-400'}`}></span>
              <span className={`text-[11px] font-bold uppercase ${globalHealthState === 'incident' ? 'text-rose-400' : globalHealthState === 'degraded' ? 'text-amber-400' : 'text-base-content/60'}`}>{globalHealthState}</span>
            </div>
          <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-primary hover:bg-primary-focus text-base-content text-xs font-medium transition-all shadow-sm">
            <span className="material-symbols-outlined text-[15px]">add</span>
            <span>New Workflow</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 57px)"}}>
        <aside className="hidden lg:flex w-60 border-r border-base-300 bg-base-100 flex-col justify-between p-5 select-none shrink-0 h-full overflow-y-auto">
          <div className="space-y-6">
            <div>
              <div className="w-full flex items-center justify-between p-2.5 rounded-lg border border-base-300 bg-base-100 hover:bg-white/[0.02] transition-colors group">
                <div className="flex items-center gap-2.5 truncate">
                  <div className="w-6 h-6 rounded bg-white/[0.05] border border-base-300 flex items-center justify-center text-base-content/70">
                    <span className="material-symbols-outlined text-[14px]">grid_view</span>
                  </div>
                  <div className="text-left truncate">
                    <div className="text-xs font-medium text-base-content/80 truncate">Default Workspace</div>
                    <div className="text-[10px] text-base-content/50 font-mono">Personal</div>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium text-base-content/50 uppercase tracking-wider px-2 mb-2">Orchestration</div>
              <nav className="space-y-1">
                <button onClick={() => setFilter('all')} className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors ${filter === 'all' ? 'bg-white/[0.08] text-base-content' : 'text-base-content/60 hover:text-base-content/80 hover:bg-white/[0.03]'}`}>
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-rose-400 text-[16px]">account_tree</span>
                    <span>All Workflows</span>
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-white/[0.06] text-base-content/70">{workflows.length}</span>
                </button>
                <button onClick={() => setFilter('active')} className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors ${filter === 'active' ? 'bg-white/[0.08] text-base-content' : 'text-base-content/60 hover:text-base-content/80 hover:bg-white/[0.03]'}`}>
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-emerald-400 text-[16px]">bolt</span>
                    <span>Active</span>
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-white/[0.06] text-base-content/70">{activeCount}</span>
                </button>
                <button onClick={() => setFilter('draft')} className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors ${filter === 'draft' ? 'bg-white/[0.08] text-base-content' : 'text-base-content/60 hover:text-base-content/80 hover:bg-white/[0.03]'}`}>
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-amber-400 text-[16px]">edit_note</span>
                    <span>Drafts</span>
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-white/[0.06] text-base-content/70">{draftCount}</span>
                </button>
                <button onClick={() => setFilter('quarantined')} className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors ${filter === 'quarantined' ? 'bg-white/[0.08] text-base-content' : 'text-base-content/60 hover:text-base-content/80 hover:bg-white/[0.03]'}`}>
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-rose-500 text-[16px]">report_problem</span>
                    <span>Quarantined</span>
                  </div>
                  <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">{quarantinedCount}</span>
                </button>
              </nav>
            </div>
            <div>
              <div className="text-[11px] font-medium text-base-content/50 uppercase tracking-wider px-2 mb-2">Subsystems</div>
              <nav className="space-y-1 text-xs">
                <a className="flex items-center gap-2.5 px-3 py-1.5 rounded-md text-base-content/60 hover:text-base-content/80 hover:bg-white/[0.03] transition-colors" href="#">
                  <span className="material-symbols-outlined text-base-content/50 text-[15px]">memory</span>
                  <span>Redis Memory Mesh</span>
                </a>
                <a className="flex items-center gap-2.5 px-3 py-1.5 rounded-md text-base-content/60 hover:text-base-content/80 hover:bg-white/[0.03] transition-colors" href="#">
                  <span className="material-symbols-outlined text-base-content/50 text-[15px]">hub</span>
                  <span>Ingress Gateways</span>
                </a>
                <a className="flex items-center gap-2.5 px-3 py-1.5 rounded-md text-base-content/60 hover:text-base-content/80 hover:bg-white/[0.03] transition-colors" href="#">
                  <span className="material-symbols-outlined text-base-content/50 text-[15px]">security</span>
                  <span>HMAC Key Vault</span>
                </a>
              </nav>
            </div>
          </div>
        <div className="pt-4 mt-6 border-t border-base-300 flex flex-col gap-3">
          <div 
            onClick={() => navigate('/account')}
            className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/[0.03] transition-colors cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-full bg-white/[0.06] border border-base-300 text-xs font-bold text-base-content/80 flex items-center justify-center select-none group-hover:border-primary/50 group-hover:text-primary transition-colors">
              {user?.name ? user.name.charAt(0).toUpperCase() : (user?.email?.charAt(0).toUpperCase() || 'U')}
            </div>
            <div className="flex-1 truncate">
              <div className="text-xs font-medium text-base-content/80 truncate group-hover:text-base-content transition-colors">{user?.name || user?.email || 'Developer'}</div>
              <div className="text-[10px] text-base-content/50 truncate flex items-center gap-1 group-hover:text-primary/70">
                <span>Account Settings</span>
              </div>
            </div>
            <span className="material-symbols-outlined text-[16px] text-base-content/40 group-hover:text-primary transition-colors">manage_accounts</span>
          </div>
          
          <div className="flex items-center justify-between text-[10px] text-base-content/50 px-1">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              BullMQ Sync OK
            </span>
            <span className="font-mono text-base-content/40">v2.4.1</span>
          </div>
        </div>
      </aside>

        <main className="flex-1 overflow-y-auto bg-base-100">
          <div className="max-w-6xl mx-auto px-6 sm:px-10 py-8 lg:py-10 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-display font-semibold text-base-content tracking-tight flex items-center gap-2.5">
                  Workflows
                  <span className="text-xs font-normal text-base-content/50 font-mono px-2 py-0.5 rounded border border-base-300 bg-white/[0.02]">
                    {workflows.length} configured
                  </span>
                </h1>
                <p className="text-sm text-base-content/60 mt-1">
                  Event-driven automations across multi-region serverless clusters.
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <button onClick={() => setIsCreateModalOpen(true)} className="px-3.5 py-1.5 rounded-md bg-primary hover:bg-primary-focus text-base-content text-xs font-medium transition-all shadow-sm flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px]">add</span>
                  <span>New Workflow</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 p-5 rounded-2xl border border-base-300 bg-base-100 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-base-content/60 font-medium">
                  <span>Active Workflows</span>
                  <span className="material-symbols-outlined text-base-content/50 text-[16px]">schema</span>
                </div>
                <div className="mt-4">
                  <div className="text-2xl font-semibold font-display text-base-content">{activeCount} active</div>
                  <div className="mt-1 text-xs text-emerald-400 font-medium flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">trending_up</span>
                    <span>Processing</span>
                  </div>
                </div>
              </div>
              <div className="card shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 p-5 rounded-2xl border border-base-300 bg-base-100 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-base-content/60 font-medium">
                  <span>Total Executions</span>
                  <span className="material-symbols-outlined text-base-content/50 text-[16px]">bolt</span>
                </div>
                <div className="mt-4">
                  <div className="text-2xl font-semibold font-display text-base-content">{stats.totalExecutions.toLocaleString()}</div>
                  <div className="mt-1 text-xs text-base-content/60 font-mono">total runs</div>
                </div>
              </div>
              <div className="card shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 p-5 rounded-2xl border border-base-300 bg-base-100 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-base-content/60 font-medium">
                  <span>Success Rate</span>
                  <span className="material-symbols-outlined text-base-content/50 text-[16px]">check_circle</span>
                </div>
                <div className="mt-4">
                  <div className="text-2xl font-semibold font-display text-base-content">{stats.successRate}<span className="text-sm font-normal text-base-content/50 ml-0.5">%</span></div>
                  <div className="mt-1 text-xs text-emerald-400 font-mono">Completed Runs</div>
                </div>
              </div>
              <div className="card shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 p-5 rounded-2xl border border-base-300 bg-base-100 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-base-content/60 font-medium">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                    Dead-Letter Traps
                  </span>
                  <span className="material-symbols-outlined text-rose-400 text-[16px]">notification_important</span>
                </div>
                <div className="mt-4 flex items-baseline justify-between">
                  <div className="text-2xl font-semibold font-display text-base-content">{quarantinedCount}</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              <div className="relative w-full sm:w-72">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50 text-[16px]">search</span>
                <input 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-base-300 bg-base-100 text-xs text-base-content placeholder:text-base-content/50 focus:outline-none focus:border-rose-500/50 transition-colors" 
                  placeholder="Search workflows by name..." 
                  type="text"
                />
              </div>
            </div>

            <div className="rounded-xl border border-base-300 bg-base-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-base-300 text-[11px] font-medium text-base-content/60 uppercase tracking-wider">
                      <th className="py-3 px-6 font-medium">Workflow & Pipeline</th>
                      <th className="py-3 px-4 font-medium">Status</th>
                      <th className="py-3 px-4 font-medium">Endpoint</th>
                      <th className="py-3 px-4 font-medium">Last Modified</th>
                      <th className="py-3 px-6 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04] text-xs">
                    {filteredWorkflows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-base-content/50">
                          No workflows found.
                        </td>
                      </tr>
                    ) : (
                      filteredWorkflows.map((wf) => (
                        <tr 
                          key={wf.id}
                          onClick={() => navigate(`/editor/${wf.id}`)}
                          className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                        >
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3.5">
                              <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-base-300 flex items-center justify-center text-base-content/70 group-hover:border-base-300 transition-colors">
                                <span className="material-symbols-outlined text-[17px]">account_tree</span>
                              </div>
                              <div>
                                <div className="font-medium text-base-content text-[13px] group-hover:text-rose-400 transition-colors flex items-center gap-1.5">
                                  {wf.name}
                                </div>
                                <div className="text-[11px] text-base-content/60 mt-0.5 flex items-center gap-1.5">
                                  <span className="text-base-content/70 font-mono">ID: {wf.id.slice(0, 8)}...</span>
                                  <span className="text-base-content/40">•</span>
                                  <span>BullMQ Engine</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${wf.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'} text-[11px] font-medium`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${wf.status === 'active' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                              {wf.status === 'active' ? 'Active' : 'Draft'}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/[0.03] border border-base-300 text-[11px] font-mono text-base-content/70 hover:border-base-300 transition-colors">
                              <span className="truncate max-w-[200px]">.../v1/wh/{wf.id.slice(0, 10)}</span>
                              <button 
                                type="button"
                                className="text-base-content/60 hover:text-base-content transition-colors" 
                                onClick={(e) => { 
                                  e.stopPropagation();
                                  navigator.clipboard?.writeText(`http://localhost:3000/api/v1/wh/${wf.id}`);
                                  toast.info('Webhook endpoint copied to clipboard!');
                                }} 
                                title="Copy URL"
                              >
                                <span className="material-symbols-outlined text-[13px]">content_copy</span>
                              </button>
                            </div>
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap">
                            <div className="text-base-content/70 text-xs">
                              {new Date(wf.updatedAt || wf.createdAt || Date.now()).toLocaleDateString()}
                            </div>
                            <div className="text-[11px] text-base-content/60 font-mono">v1 — Ready</div>
                          </td>
                          <td className="py-4 px-6 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                to={`/editor/${wf.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="px-2.5 py-1 rounded border border-base-300 hover:bg-white/[0.06] text-base-content/70 hover:text-base-content text-[11px] transition-colors"
                              >
                                Edit
                              </Link>
                              <button 
                                type="button"
                                onClick={(e) => handleDelete(wf.id, e)}
                                className="px-2.5 py-1 rounded border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 text-[11px] transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-base-100 border border-base-300 rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-base-300 flex items-center justify-between bg-white/[0.02]">
              <h2 className="text-base-content font-semibold text-[15px]">Create New Workflow</h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-base-content/60 hover:text-base-content transition-colors">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateWorkflow} className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-base-content/70">Workflow Name</label>
                <input 
                  type="text" 
                  autoFocus 
                  required 
                  placeholder="e.g., Customer Onboarding Pipeline" 
                  value={newWorkflowName} 
                  onChange={(e) => setNewWorkflowName(e.target.value)} 
                  className="w-full bg-base-200 border border-base-300 rounded-lg px-3 py-2 text-sm text-base-content focus:outline-none focus:border-rose-500/50 transition-colors" 
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium flex items-center justify-between">
                  <span className="text-base-content/70">AI Prompt (Optional)</span>
                  <span className="flex items-center gap-1 text-[10px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                    <span className="material-symbols-outlined text-[12px]">auto_awesome</span> Magic
                  </span>
                </label>
                <textarea 
                  rows={3}
                  placeholder="Describe what you want to automate..." 
                  value={aiPrompt} 
                  onChange={(e) => setAiPrompt(e.target.value)} 
                  className="w-full bg-base-200 border border-base-300 rounded-lg px-3 py-2 text-sm text-base-content focus:outline-none focus:border-indigo-500/50 transition-colors resize-none placeholder:text-base-content/40" 
                />
                <p className="text-[10px] text-base-content/50">
                  If provided, FlowForge AI will generate the workflow graph for you. You can edit it before activating.
                </p>
              </div>
              <div className="flex items-center justify-end gap-3 mt-2 pt-4 border-t border-base-300">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-3.5 py-1.5 rounded-md text-base-content/70 hover:text-base-content hover:bg-white/[0.05] text-xs font-medium transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isCreating || !newWorkflowName.trim()} className="px-3.5 py-1.5 rounded-md bg-primary hover:bg-primary-focus text-base-content text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {isCreating ? 'Creating...' : 'Create Workflow'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-base-100 border border-base-300 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden p-6 relative animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-base-content font-semibold text-[15px] mb-2">{confirmModal.title}</h2>
            <p className="text-base-content/60 text-sm mb-6">{confirmModal.message}</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setConfirmModal(null)} className="px-3.5 py-1.5 rounded-md text-base-content/70 hover:text-base-content hover:bg-white/[0.05] text-xs font-medium transition-colors">
                Cancel
              </button>
              <button onClick={confirmModal.onConfirm} className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${confirmModal.confirmStyle}`}>
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
