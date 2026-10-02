import { useEffect, useState } from 'react';
import axios from 'axios';
import { useToast } from 'av-toastx';
import { Mail, Plus, Trash2, ShieldCheck, ChevronDown } from 'lucide-react';
import { API_V1 } from '../config';
import { Button, Input, Field, Card, Select, Toggle, Badge } from './ui';

type Conn = {
  id: string;
  name: string;
  username: string;
  host: string;
  port: number;
  secure: boolean;
  fromAddress: string;
};

const EMPTY = { name: '', username: '', password: '', host: 'smtp.gmail.com', port: 587, secure: false, fromAddress: '' };

export default function Connections() {
  const { toast } = useToast();
  const [list, setList] = useState<Conn[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...EMPTY });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    try {
      const res = await axios.get(`${API_V1}/connections`, { withCredentials: true });
      setList(res.data.connections || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.username || !form.password) {
      toast.error('Name, account email and app password are required.');
      return;
    }
    setSaving(true);
    try {
      await axios.post(`${API_V1}/connections`, form, { withCredentials: true });
      toast.success('Connection saved');
      setForm({ ...EMPTY });
      setShowAdvanced(false);
      setAdding(false);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save connection');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await axios.delete(`${API_V1}/connections/${id}`, { withCredentials: true });
      toast.success('Connection removed');
      setList((l) => l.filter((c) => c.id !== id));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to remove connection');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-accent-soft text-accent flex items-center justify-center">
            <Mail size={18} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-ink">Email connections</h2>
            <p className="text-xs text-muted">Saved email accounts your automations can send from.</p>
          </div>
        </div>
        {!adding && (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}><Plus size={15} /> Add</Button>
        )}
      </div>

      {/* Security note */}
      <div className="flex items-start gap-2 rounded-lg border border-ok/25 bg-ok/10 px-3 py-2 text-[11px] text-muted mb-5">
        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-ok" />
        <span>App passwords are <b className="text-ink">encrypted</b> before they're stored and are never shown again or sent back to the browser.</span>
      </div>

      {/* Existing connections */}
      {loading ? (
        <div className="text-sm text-muted">Loading…</div>
      ) : list.length === 0 && !adding ? (
        <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
          No connections yet. Click <b className="text-ink">Add</b> to connect a Gmail or SMTP account.
        </div>
      ) : (
        <div className="flex flex-col gap-2 mb-5">
          {list.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink truncate">{c.name}</span>
                  <Badge tone="neutral">{c.host}</Badge>
                </div>
                <div className="text-xs text-muted truncate mt-0.5">
                  {c.username}{c.fromAddress && c.fromAddress !== c.username ? ` · from ${c.fromAddress}` : ''} · port {c.port}{c.secure ? ' (SSL)' : ''}
                </div>
              </div>
              <Button size="sm" variant="ghost" className="text-danger" loading={deletingId === c.id} onClick={() => handleDelete(c.id)}>
                <Trash2 size={15} />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {adding && (
        <form onSubmit={handleCreate} className="flex flex-col gap-4 rounded-xl border border-line p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Connection name" hint="A label you'll recognise.">
              <Input placeholder="My Gmail" value={form.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label="Account email" hint="The Gmail/SMTP username.">
              <Input placeholder="you@gmail.com" value={form.username} onChange={(e) => set('username', e.target.value)} />
            </Field>
          </div>
          <Field label="App password" hint="Gmail → 2-Step Verification → App passwords. Spaces are fine.">
            <Input type="password" placeholder="abcd efgh ijkl mnop" value={form.password} onChange={(e) => set('password', e.target.value)} />
          </Field>

          <button type="button" onClick={() => setShowAdvanced((s) => !s)} className="flex items-center gap-1 text-xs text-accent hover:underline w-fit">
            <ChevronDown size={14} className={showAdvanced ? 'rotate-180 transition-transform' : 'transition-transform'} /> Advanced (non-Gmail SMTP)
          </button>
          {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg bg-surface-2 border border-line p-3">
              <Field label="SMTP host"><Input className="font-mono" value={form.host} onChange={(e) => set('host', e.target.value)} /></Field>
              <Field label="Port"><Input type="number" value={form.port} onChange={(e) => set('port', Number(e.target.value))} /></Field>
              <Field label="From address" hint="Defaults to the account email."><Input placeholder="you@yourdomain.com" value={form.fromAddress} onChange={(e) => set('fromAddress', e.target.value)} /></Field>
              <Field label="SSL (port 465)">
                <div className="flex items-center gap-2 h-10"><Toggle checked={form.secure} onChange={(v) => set('secure', v)} /><span className="text-sm text-muted">{form.secure ? 'On (465)' : 'Off (587 STARTTLS)'}</span></div>
              </Field>
            </div>
          )}

          <div className="flex items-center gap-3 justify-end">
            <Button type="button" variant="ghost" onClick={() => { setAdding(false); setForm({ ...EMPTY }); setShowAdvanced(false); }}>Cancel</Button>
            <Button type="submit" loading={saving}>{saving ? 'Saving…' : 'Save connection'}</Button>
          </div>
        </form>
      )}
    </Card>
  );
}
