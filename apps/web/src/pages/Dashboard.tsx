import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Plus, Search, Zap, Activity, CheckCircle2, Workflow as WorkflowIcon,
  Copy, Pencil, Trash2, Sparkles, MousePointerClick, Play, ChevronDown, LogOut, Settings,
} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import Logo from '../components/Logo';
import { API_V1, webhookUrl } from '../config';
import { Button, Input, Textarea, Field, Card, Badge, Modal, EmptyState, Spinner } from '../components/ui';

type Filter = 'all' | 'active' | 'draft';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [workflows, setWorkflows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({ totalExecutions: 0, successRate: 0 });

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [confirmModal, setConfirmModal] = useState<null | {
    title: string; message: string; confirmText: string; onConfirm: () => void;
  }>(null);

  const fetchWorkflows = async () => {
    if (!user) return;
    try {
      const [wfRes, statsRes] = await Promise.all([
        axios.get(`${API_V1}/workflows`, { withCredentials: true }),
        axios.get(`${API_V1}/workflows/stats`, { withCredentials: true }),
      ]);
      setWorkflows(wfRes.data.workflows || []);
      setStats(statsRes.data || { totalExecutions: 0, successRate: 0 });
    } catch (err) {
      console.error(err);
      toast.error('Failed to load your automations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchWorkflows(); }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsCreating(true);
    try {
      const res = await axios.post(
        `${API_V1}/workflows`,
        { name: newName, prompt: aiPrompt.trim() || undefined },
        { withCredentials: true }
      );
      toast.success(aiPrompt.trim() ? 'Draft created from your description' : 'Automation created');
      setIsCreateOpen(false);
      setNewName('');
      setAiPrompt('');
      navigate(`/editor/${res.data.workflow.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create automation');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmModal({
      title: 'Delete automation',
      message: `"${name}" and its run history will be permanently deleted. This can't be undone.`,
      confirmText: 'Delete',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await axios.delete(`${API_V1}/workflows/${id}`, { withCredentials: true });
          toast.success('Automation deleted');
          fetchWorkflows();
        } catch (err: any) {
          toast.error(err.response?.data?.error || 'Delete failed');
        }
      },
    });
  };

  const activeCount = workflows.filter((w) => w.status === 'active').length;
  const draftCount = workflows.filter((w) => w.status !== 'active').length;

  const filtered = workflows
    .filter((w) => filter === 'all' || (filter === 'active' ? w.status === 'active' : w.status !== 'active'))
    .filter((w) => (w.name || '').toLowerCase().includes(searchTerm.toLowerCase()));

  const filterTabs: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: workflows.length },
    { key: 'active', label: 'Live', count: activeCount },
    { key: 'draft', label: 'Drafts', count: draftCount },
  ];

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="w-6 h-6" />
      </div>
    );
  }

  const stat = [
    { label: 'Live automations', value: `${activeCount}`, icon: Zap, tone: 'text-ok' },
    { label: 'Total runs', value: stats.totalExecutions.toLocaleString(), icon: Activity, tone: 'text-accent' },
    { label: 'Success rate', value: `${stats.successRate}%`, icon: CheckCircle2, tone: 'text-ok' },
  ];

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-line bg-surface/80 backdrop-blur px-4 sm:px-6 h-14 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus size={16} /> New automation
          </Button>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-1.5 pl-1 pr-1.5 h-9 rounded-lg hover:bg-surface-2 transition-colors"
            >
              <span className="w-7 h-7 rounded-full bg-accent-soft text-accent text-xs font-bold grid place-items-center">
                {(user.name || user.email || 'U').charAt(0).toUpperCase()}
              </span>
              <ChevronDown size={15} className="text-muted" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-1.5 w-52 z-20 rounded-xl border border-line bg-surface shadow-pop p-1.5 animate-scale-in">
                  <div className="px-2.5 py-2 border-b border-line mb-1">
                    <div className="text-sm font-medium text-ink truncate">{user.name || 'Your account'}</div>
                    <div className="text-xs text-muted truncate">{user.email}</div>
                  </div>
                  <button onClick={() => navigate('/account')} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-ink hover:bg-surface-2 transition-colors">
                    <Settings size={15} className="text-muted" /> Account settings
                  </button>
                  <button
                    onClick={() => setConfirmModal({
                      title: 'Sign out', message: 'Sign out of FlowForge?', confirmText: 'Sign out',
                      onConfirm: () => { setConfirmModal(null); logout(); },
                    })}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-ink hover:bg-surface-2 transition-colors"
                  >
                    <LogOut size={15} className="text-muted" /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
        {/* Heading */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-ink">Your automations</h1>
            <p className="text-sm text-muted mt-1">
              An automation runs your steps automatically whenever its trigger fires.
            </p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} className="self-start sm:self-auto">
            <Plus size={16} /> New automation
          </Button>
        </div>

        {workflows.length === 0 ? (
          <EmptyState
            icon={<WorkflowIcon size={22} />}
            title="Create your first automation"
            description="Pick a trigger (like an incoming webhook), add steps such as an HTTP request or an email, then turn it on. FlowForge runs it for you every time the trigger fires."
            action={
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus size={16} /> New automation
              </Button>
            }
          />
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {stat.map((s) => (
                <Card key={s.label} className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted">{s.label}</span>
                    <s.icon size={18} className={s.tone} />
                  </div>
                  <div className="mt-3 text-3xl font-display font-bold text-ink">{s.value}</div>
                </Card>
              ))}
            </div>

            {/* Filters + search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="inline-flex items-center gap-1 p-1 rounded-lg border border-line bg-surface w-fit">
                {filterTabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setFilter(t.key)}
                    className={`px-3 h-8 rounded-md text-[13px] font-medium transition-colors ${
                      filter === t.key ? 'bg-accent text-accent-ink' : 'text-muted hover:text-ink'
                    }`}
                  >
                    {t.label} <span className={filter === t.key ? 'opacity-80' : 'text-faint'}>{t.count}</span>
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:w-72">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search automations…"
                  className="pl-9"
                />
              </div>
            </div>

            {/* List */}
            {filtered.length === 0 ? (
              <EmptyState title="Nothing here" description="No automations match your filter or search." />
            ) : (
              <div className="flex flex-col gap-2.5">
                {filtered.map((wf) => (
                  <Card
                    key={wf.id}
                    onClick={() => navigate(`/editor/${wf.id}`)}
                    className="p-4 flex items-center gap-4 cursor-pointer hover:border-accent/40 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-surface-2 border border-line grid place-items-center text-muted shrink-0">
                      <WorkflowIcon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink truncate group-hover:text-accent transition-colors">{wf.name}</span>
                        <Badge tone={wf.status === 'active' ? 'ok' : 'neutral'} dot>
                          {wf.status === 'active' ? 'Live' : 'Draft'}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                        {wf.status === 'active' ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(webhookUrl(wf.id)); toast.info('Webhook URL copied'); }}
                            className="inline-flex items-center gap-1.5 font-mono hover:text-ink transition-colors"
                            title="Copy webhook URL"
                          >
                            <Copy size={12} /> <span className="truncate max-w-[240px]">{webhookUrl(wf.id)}</span>
                          </button>
                        ) : (
                          <span>Not live yet — open to finish and turn it on</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Link
                        to={`/editor/${wf.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-line text-sm text-muted hover:text-ink hover:bg-surface-2 transition-colors"
                      >
                        <Pencil size={14} /> <span className="hidden sm:inline">Edit</span>
                      </Link>
                      <button
                        onClick={(e) => handleDelete(wf.id, wf.name, e)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* How it works */}
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-ink mb-4">How FlowForge works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: Zap, title: '1. Pick a trigger', desc: 'A webhook, a schedule, or an incoming event that starts the automation.' },
              { icon: MousePointerClick, title: '2. Add steps', desc: 'Send an HTTP request, send an email, write to a database, or branch with a condition.' },
              { icon: Play, title: '3. Turn it on', desc: 'Test it, then activate. FlowForge runs it automatically and logs every run.' },
            ].map((s) => (
              <div key={s.title} className="flex flex-col gap-2">
                <div className="w-9 h-9 rounded-lg bg-accent-soft text-accent grid place-items-center"><s.icon size={18} /></div>
                <div className="text-sm font-medium text-ink">{s.title}</div>
                <div className="text-xs text-muted leading-relaxed">{s.desc}</div>
              </div>
            ))}
          </div>
        </Card>
      </main>

      {/* Create modal */}
      <Modal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="New automation">
        <form onSubmit={handleCreate} className="p-5 flex flex-col gap-4">
          <Field label="Name">
            <Input autoFocus required value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Notify Slack on new order" />
          </Field>
          <Field
            label="Describe it (optional)"
            hint="Write what you want to automate and we'll draft the steps for you. You can edit everything before turning it on."
          >
            <Textarea
              rows={3}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="When a webhook arrives, if the amount is over 100, send an email to the customer."
            />
          </Field>
          {aiPrompt.trim() && (
            <div className="flex items-center gap-2 text-xs text-accent">
              <Sparkles size={14} /> We'll generate a starting draft from your description.
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t border-line -mx-5 px-5 -mb-5 pb-5">
            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button type="submit" loading={isCreating} disabled={!newName.trim()}>
              {isCreating ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm modal */}
      <Modal open={!!confirmModal} onClose={() => setConfirmModal(null)} title={confirmModal?.title} size="sm">
        <div className="p-5">
          <p className="text-sm text-muted">{confirmModal?.message}</p>
          <div className="flex justify-end gap-2 mt-5">
            <Button variant="ghost" onClick={() => setConfirmModal(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmModal?.onConfirm}>{confirmModal?.confirmText}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
