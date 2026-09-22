import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ArrowRight, Zap, GitBranch, Send, Webhook, Clock, Database,
  Mail, Sparkles, Play, ShieldCheck, History,
} from 'lucide-react';
import Logo from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';
import { Button } from '../components/ui';

const steps = [
  { icon: Zap, title: 'Pick a trigger', desc: 'A webhook call, a schedule, or an incoming event kicks things off.' },
  { icon: GitBranch, title: 'Add steps & logic', desc: 'Chain actions together and branch with simple if/then conditions.' },
  { icon: Play, title: 'Turn it on', desc: 'Test it live, activate, and watch every run in your history.' },
];

const features = [
  { icon: Webhook, title: 'Webhook triggers', desc: 'Every automation gets a URL. Point Stripe, GitHub, or your app at it.' },
  { icon: Clock, title: 'Schedules', desc: 'Run automations on a cron schedule — hourly, daily, or your own expression.' },
  { icon: Send, title: 'HTTP requests', desc: 'Call any API with methods, headers, and a templated JSON body.' },
  { icon: Mail, title: 'Email & database', desc: 'Send emails or write rows to Postgres as part of a flow.' },
  { icon: Sparkles, title: 'AI drafting', desc: 'Describe what you want in plain English and get a starting workflow.' },
  { icon: History, title: 'Run history & retries', desc: 'Inspect every step, see inputs and outputs, and retry failures.' },
];

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-line bg-surface/80 backdrop-blur px-4 sm:px-6 h-14 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <Link to="/dashboard"><Button size="sm">Go to dashboard <ArrowRight size={16} /></Button></Link>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium text-muted hover:text-ink px-3 h-9 inline-flex items-center transition-colors">
                Sign in
              </Link>
              <Link to="/signup"><Button size="sm">Get started</Button></Link>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="px-4 sm:px-6 pt-16 pb-12 sm:pt-24 sm:pb-16">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-line bg-surface text-xs font-medium text-muted">
            <Sparkles size={13} className="text-accent" /> Visual automation, no code required
          </span>
          <h1 className="mt-5 text-4xl sm:text-5xl font-display font-bold tracking-tight text-ink leading-[1.1]">
            Automate anything with a<br className="hidden sm:block" /> trigger and a few steps
          </h1>
          <p className="mt-5 text-lg text-muted max-w-xl mx-auto leading-relaxed">
            FlowForge connects your apps and APIs. When something happens — a webhook, a schedule —
            it runs the steps you built, automatically. Drag, drop, done.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to={user ? '/dashboard' : '/signup'}>
              <Button size="lg">{user ? 'Open dashboard' : 'Start building free'} <ArrowRight size={18} /></Button>
            </Link>
            <Link to="/login"><Button size="lg" variant="secondary">Sign in</Button></Link>
          </div>
        </div>

        {/* Visual: a workflow at a glance */}
        <div className="max-w-3xl mx-auto mt-14">
          <div className="rounded-2xl border border-line bg-surface shadow-card p-6 sm:p-10">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-2">
              <FlowCard icon={Webhook} label="Webhook" sub="Order received" tone="accent" />
              <Connector />
              <FlowCard icon={GitBranch} label="If amount > 100" sub="Condition" tone="warn" />
              <Connector />
              <FlowCard icon={Mail} label="Send email" sub="Notify customer" tone="ok" />
            </div>
            <p className="text-center text-xs text-muted mt-6">
              A simple automation: when an order webhook arrives, check the amount, then email the customer.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 sm:px-6 py-14 border-t border-line">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-display font-bold text-ink text-center">How it works</h2>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {steps.map((s, i) => (
              <div key={s.title} className="rounded-2xl border border-line bg-surface p-6">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-accent-soft text-accent grid place-items-center"><s.icon size={20} /></div>
                  <span className="text-3xl font-display font-bold text-line">{i + 1}</span>
                </div>
                <h3 className="mt-4 font-semibold text-ink">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 sm:px-6 py-14 border-t border-line">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-display font-bold text-ink text-center">Everything you need to automate</h2>
          <p className="text-center text-muted mt-2">Triggers, actions, and the tools to run them reliably.</p>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-line bg-surface p-5">
                <div className="w-9 h-9 rounded-lg bg-surface-2 text-accent grid place-items-center"><f.icon size={18} /></div>
                <h3 className="mt-3 font-semibold text-ink text-[15px]">{f.title}</h3>
                <p className="mt-1 text-sm text-muted leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 sm:px-6 py-16 border-t border-line">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-12 h-12 rounded-xl bg-accent text-accent-ink grid place-items-center mx-auto"><Database size={22} /></div>
          <h2 className="mt-5 text-2xl sm:text-3xl font-display font-bold text-ink">Build your first automation in minutes</h2>
          <p className="mt-3 text-muted">No credit card. No code. Just connect a trigger and go.</p>
          <div className="mt-7 flex items-center justify-center gap-3">
            <Link to={user ? '/dashboard' : '/signup'}><Button size="lg">{user ? 'Open dashboard' : 'Get started free'} <ArrowRight size={18} /></Button></Link>
          </div>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted">
            <ShieldCheck size={14} className="text-ok" /> Your credentials are hashed and your runs are private to you.
          </div>
        </div>
      </section>

      <footer className="px-4 sm:px-6 py-8 border-t border-line">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <Logo size="sm" />
          <p className="text-xs text-muted">© {new Date().getFullYear()} FlowForge. Built for automating the boring parts.</p>
        </div>
      </footer>
    </div>
  );
}

function FlowCard({ icon: Icon, label, sub, tone }: { icon: any; label: string; sub: string; tone: 'accent' | 'ok' | 'warn' }) {
  const toneClass = { accent: 'text-accent bg-accent-soft', ok: 'text-ok bg-ok/10', warn: 'text-warn bg-warn/10' }[tone];
  return (
    <div className="flex-1 rounded-xl border border-line bg-surface-2 p-4 min-w-[140px]">
      <div className={`w-8 h-8 rounded-lg grid place-items-center ${toneClass}`}><Icon size={16} /></div>
      <div className="mt-2.5 text-sm font-semibold text-ink truncate">{label}</div>
      <div className="text-xs text-muted truncate">{sub}</div>
    </div>
  );
}

function Connector() {
  return (
    <div className="flex items-center justify-center text-faint shrink-0 rotate-90 sm:rotate-0">
      <ArrowRight size={18} />
    </div>
  );
}
