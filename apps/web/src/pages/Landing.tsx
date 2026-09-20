import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import Logo from '../components/Logo';

export default function Landing() {
  const { user } = useAuth();

  return (
    <>
      <header className="bg-base-100 dark:bg-base-100 docked full-width top-0 z-50 flat no shadows border-b border-base-300 dark:border-base-300 sticky backdrop-blur-md bg-base-100/90">
        <div className="flex justify-between items-center w-full max-w-[1440px] mx-auto px-margin h-16">
          <div className="flex items-center gap-6">
            <Link className="font-headline-sm text-headline-sm tracking-tight text-base-content dark:text-base-content font-semibold flex items-center gap-2" to="/">
              <Logo size="md" />
            </Link>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a className="font-label-md text-label-md text-base-content dark:text-base-content font-medium border-b-2 border-primary-container dark:border-primary pb-1" href="#features">Features</a>
<a className="font-label-md text-label-md text-base-content/70 dark:text-base-content/70 hover:text-base-content dark:hover:text-base-content transition-colors duration-150" href="#pricing">Pricing</a>
<a className="font-label-md text-label-md text-base-content/70 dark:text-base-content/70 hover:text-base-content dark:hover:text-base-content transition-colors duration-150" href="#docs">Docs</a>
</nav>

  <div className="flex items-center gap-4">
    <ThemeToggle />
    {user ? (
      <Link to="/dashboard" className="bg-primary text-primary-content text-primary-content font-label-md text-label-md px-4 py-2 rounded-lg hover:bg-primary/80 active:scale-[0.98] transition-transform duration-100 ease-out font-medium">Dashboard</Link>
    ) : (
      <>
        <Link to="/login" className="font-label-md text-label-md text-base-content/70 dark:text-base-content/70 hover:text-base-content dark:hover:text-base-content transition-colors duration-150">Sign In</Link>
        <Link to="/signup" className="bg-primary text-primary-content text-primary-content font-label-md text-label-md px-4 py-2 rounded-lg hover:bg-primary/80 active:scale-[0.98] transition-transform duration-100 ease-out font-medium">Start Building Free</Link>
      </>
    )}
  </div>
</div>
</header>

<section className="relative pt-20 pb-24 md:pt-28 md:pb-32 overflow-hidden border-b border-base-300">
<div className="max-w-[1440px] mx-auto px-margin flex flex-col items-center text-center">

<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-base-300 bg-base-200 mb-8">
<span className="w-1.5 h-1.5 rounded-full bg-primary text-primary-content animate-pulse"></span>
<span className="font-label-sm text-label-sm text-base-content/70 tracking-wider uppercase">FlowForge 2.0 • Event-Driven Automation</span>
</div>

<h1 className="hidden md:block font-display-hero text-display-hero md:text-[56px] md:leading-[64px] font-semibold tracking-tight text-base-content max-w-4xl mx-auto mb-6">
        Event-driven workflows, <br/><span className="text-primary-container">built with clarity.</span>
</h1>
<h1 className="block md:hidden font-display-hero-mobile text-display-hero-mobile text-3xl sm:text-4xl font-semibold tracking-tight text-base-content max-w-xl mx-auto mb-6">
        Event-driven workflows, <br/><span className="text-primary-container">built with clarity.</span>
</h1>

<p className="font-body-lg text-body-lg text-base-content/70 max-w-2xl mx-auto mb-10 text-balance">
        Ingest webhooks, orchestrate resilient background jobs with BullMQ and Redis, and observe execution paths in real time without the clutter.
      </p>

<div className="flex flex-col sm:flex-row items-center gap-4 mb-20">
<a className="w-full sm:w-auto bg-primary text-primary-content text-primary-content font-label-md text-label-md px-6 py-3 rounded-lg hover:bg-primary/80 active:scale-[0.98] transition-all flex items-center justify-center gap-2 font-medium" href="#start">
<span>Start Building Free</span>
<span className="material-symbols-outlined text-base">arrow_forward</span>
</a>
<a className="w-full sm:w-auto bg-base-200 border border-base-300 text-base-content font-label-md text-label-md px-6 py-3 rounded-lg hover:border-base-300 active:scale-[0.98] transition-all flex items-center justify-center gap-2 font-medium" href="#demo">
<span className="material-symbols-outlined text-base">play_circle</span>
<span>Explore Interactive Demo</span>
</a>
</div>

<div className="w-full max-w-5xl bg-base-100 border border-base-300 rounded-xl p-4 md:p-8 shadow-2xl relative">

<div className="flex items-center justify-between pb-6 border-b border-base-300 text-left">
<div className="flex items-center gap-3">
<span className="w-2.5 h-2.5 rounded-full bg-outline-variant/40"></span>
<span className="w-2.5 h-2.5 rounded-full bg-outline-variant/40"></span>
<span className="w-2.5 h-2.5 rounded-full bg-outline-variant/40"></span>
<span className="ml-2 font-code-sm text-code-sm text-base-content/70/80">pipeline-v2.prod.flw</span>
</div>
<div className="flex items-center gap-3">
<span className="px-2 py-0.5 rounded border border-base-300 bg-base-100 font-code-sm text-code-sm text-tertiary">
              Active • Redis Ack 1ms
            </span>
</div>
</div>

<div className="py-12 px-2 md:px-6 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4 relative items-center">

<div className="card bg-base-100 shadow-md hover:shadow-xl border border-base-300 rounded-2xl p-5 text-left transition-all duration-300 hover:border-primary-container/40 hover:-translate-y-1">
<div className="flex items-center justify-between mb-3">
<span className="font-label-sm text-label-sm text-base-content/70 font-medium">TRIGGER</span>
<span className="w-2 h-2 rounded-full bg-tertiary"></span>
</div>
<div className="flex items-center gap-3 mb-2">
<span className="material-symbols-outlined text-primary-container">webhook</span>
<span className="font-headline-sm text-headline-sm text-base-content">Webhook Intake</span>
</div>
<p className="font-body-sm text-body-sm text-base-content/70">HTTP POST /v1/events/stripe-charge</p>
<div className="mt-4 pt-3 border-t border-base-300 flex items-center justify-between font-code-sm text-code-sm text-base-content/70">
<span>Status: 202 Accepted</span>
<span className="text-tertiary">3.2ms</span>
</div>
</div>

<div className="hidden md:flex justify-center items-center text-outline-variant/40">
<span className="material-symbols-outlined">arrow_right_alt</span>
</div>

<div className="card bg-base-100 shadow-md hover:shadow-xl border border-base-300 rounded-2xl p-5 text-left transition-all duration-300 hover:border-primary-container/40 hover:-translate-y-1">
<div className="flex items-center justify-between mb-3">
<span className="font-label-sm text-label-sm text-base-content/70 font-medium">PIPELINE FILTER</span>
<span className="w-2 h-2 rounded-full bg-tertiary"></span>
</div>
<div className="flex items-center gap-3 mb-2">
<span className="material-symbols-outlined text-primary">filter_alt</span>
<span className="font-headline-sm text-headline-sm text-base-content">Condition Gate</span>
</div>
<p className="font-body-sm text-body-sm text-base-content/70">event.amount &gt; 50000 && verified</p>
<div className="mt-4 pt-3 border-t border-base-300 flex items-center justify-between font-code-sm text-code-sm text-base-content/70">
<span>Branch: Passed</span>
<span className="text-tertiary">0.4ms</span>
</div>
</div>

<div className="hidden md:flex justify-center items-center text-outline-variant/40">
<span className="material-symbols-outlined">arrow_right_alt</span>
</div>

<div className="card bg-base-100 shadow-lg hover:shadow-2xl border border-primary-container/40 rounded-2xl p-5 text-left transition-all duration-300 hover:-translate-y-1">
<div className="flex items-center justify-between mb-3">
<span className="font-label-sm text-label-sm text-primary-container font-medium">DISPATCH</span>
<span className="w-2 h-2 rounded-full bg-primary text-primary-content animate-ping"></span>
</div>
<div className="flex items-center gap-3 mb-2">
<span className="material-symbols-outlined text-primary-container">send</span>
<span className="font-headline-sm text-headline-sm text-base-content">HTTP Dispatch</span>
</div>
<p className="font-body-sm text-body-sm text-base-content/70">Worker Job: sync-enterprise-erp</p>
<div className="mt-4 pt-3 border-t border-base-300 flex items-center justify-between font-code-sm text-code-sm text-base-content/70">
<span className="text-primary">BullMQ Stream: 0 lag</span>
<span className="text-tertiary">14.1ms</span>
</div>
</div>
</div>
</div>
</div>
</section>

<section className="py-24 border-b border-base-300 bg-base-100" id="features">
<div className="max-w-[1440px] mx-auto px-margin">
<div className="text-center max-w-2xl mx-auto mb-16">
<span className="font-label-sm text-label-sm text-primary-container uppercase tracking-wider font-semibold">Reliability by Design</span>
<h2 className="font-headline-lg text-headline-lg text-base-content mt-2 mb-4">Built for production resilience.</h2>
<p className="font-body-md text-body-md text-base-content/70">Architected from day zero to isolate failures, neutralize backpressure, and execute without friction.</p>
</div>
<div className="grid grid-cols-1 md:grid-cols-3 gap-8">

<div className="card bg-base-100 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-base-300 rounded-3xl p-8">
<div className="card-body p-0">
<div className="w-12 h-12 rounded-2xl bg-base-200 border border-base-300 flex items-center justify-center mb-6">
<span className="material-symbols-outlined text-primary-container text-2xl">inbox</span>
</div>
<h3 className="card-title font-headline-sm text-headline-sm text-base-content mb-2">Zero Dropped Events</h3>
<p className="font-body-md text-body-md text-base-content/70 leading-relaxed">
            Instant 202 Accepted ingestion backed by distributed queues, eliminating synchronous webhook bottlenecks before they propagate.
          </p>
</div>
</div>

<div className="card bg-base-100 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-base-300 rounded-3xl p-8">
<div className="card-body p-0">
<div className="w-12 h-12 rounded-2xl bg-base-200 border border-base-300 flex items-center justify-center mb-6">
<span className="material-symbols-outlined text-primary-container text-2xl">replay</span>
</div>
<h3 className="card-title font-headline-sm text-headline-sm text-base-content mb-2">Automated Backoff & Retries</h3>
<p className="font-body-md text-body-md text-base-content/70 leading-relaxed">
            Bounded exponential retries with automatic Dead-Letter Queue (DLQ) preservation ensure downstream timeouts never cause permanent data loss.
          </p>
</div>
</div>

<div className="card bg-base-100 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-base-300 rounded-3xl p-8">
<div className="card-body p-0">
<div className="w-12 h-12 rounded-2xl bg-base-200 border border-base-300 flex items-center justify-center mb-6">
<span className="material-symbols-outlined text-primary-container text-2xl">lock</span>
</div>
<h3 className="card-title font-headline-sm text-headline-sm text-base-content mb-2">Idempotent Execution</h3>
<p className="font-body-md text-body-md text-base-content/70 leading-relaxed">
            Native Redis key locking to guarantee critical financial operations and side-effects strictly run once across redundant cluster workers.
          </p>
</div>
</div>
</div>
</div>
</section>

<section className="py-24 border-b border-base-300 bg-base-100" id="architecture">
<div className="max-w-[1440px] mx-auto px-margin space-y-24">

<div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
<div>
<span className="font-label-sm text-label-sm text-primary uppercase tracking-wider font-semibold">STATE CONTROL</span>
<h3 className="font-headline-lg text-headline-lg text-base-content mt-2 mb-4">Visual Canvas & Immutable Versioning</h3>
<p className="font-body-lg text-body-lg text-base-content/70 mb-6">
            Compose intricate dependency trees with intuitive semantic blocks. Every commit freezes state into an immutable graph snapshot, ensuring in-flight runs finish on the version they started with.
          </p>
<ul className="space-y-3 font-body-md text-body-md text-base-content">
<li className="flex items-center gap-2">
<span className="material-symbols-outlined text-primary-container text-base">check_circle</span>
<span>Zero-downtime hot reloading for active pipeline queues</span>
</li>
<li className="flex items-center gap-2">
<span className="material-symbols-outlined text-primary-container text-base">check_circle</span>
<span>Granular JSON schema validation at every transition node</span>
</li>
</ul>
</div>
<div className="bg-base-100 border border-base-300 rounded-xl p-6">
<div className="flex items-center justify-between pb-4 border-b border-base-300 text-base-content/70 font-code-sm text-code-sm mb-4">
<span>graph-spec.json</span>
<span className="text-tertiary">revision: c81b37e</span>
</div>
<pre className="font-code-sm text-code-sm text-base-content/70 overflow-x-auto leading-relaxed"><code>{"{\n"}
  <span className="text-primary">"pipeline"</span>: <span className="text-tertiary">"checkout_settlement"</span>,
  <span className="text-primary">"version"</span>: <span className="text-tertiary">"2.1.0-immutable"</span>,
  <span className="text-primary">"concurrency"</span>: 250,
  <span className="text-primary">"steps"</span>: [
    {"{ "} <span className="text-primary">"id"</span>: <span className="text-tertiary">"verify_payload"</span>, <span className="text-primary">"timeout"</span>: <span className="text-tertiary">"120ms"</span> {" },"}
    {"{ "} <span className="text-primary">"id"</span>: <span className="text-tertiary">"ledger_sync"</span>, <span className="text-primary">"retry"</span>: {"{ "} <span className="text-primary">"limit"</span>: 5, <span className="text-primary">"factor"</span>: 2 {" }"} {" }"}
  ]
{"}"}</code></pre>
</div>
</div>

<div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
<div className="order-2 md:order-1 card bg-base-100 shadow-xl border border-base-300 rounded-3xl p-6 transition-all duration-300 hover:shadow-2xl">
<div className="grid grid-cols-2 gap-4 text-left card-body p-0">
<div className="card shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 p-4 bg-base-100 border border-base-300 rounded-2xl">
<span className="font-label-sm text-label-sm text-base-content/70">P99 INGESTION</span>
<div className="font-headline-lg text-headline-lg text-base-content mt-1">&lt; 3.8ms</div>
<span className="font-code-sm text-code-sm text-tertiary">Edge Distributed</span>
</div>
<div className="card shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 p-4 bg-base-100 border border-base-300 rounded-2xl">
<span className="font-label-sm text-label-sm text-base-content/70">UPTIME SLA</span>
<div className="font-headline-lg text-headline-lg text-base-content mt-1">99.99%</div>
<span className="font-code-sm text-code-sm text-tertiary">Continuous Redundancy</span>
</div>
<div className="card shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 p-4 bg-base-100 border border-base-300 rounded-2xl">
<span className="font-label-sm text-label-sm text-base-content/70">QUEUE RETENTION</span>
<div className="font-headline-lg text-headline-lg text-base-content mt-1">30 Days</div>
<span className="font-code-sm text-code-sm text-primary">DLQ Cold Archive</span>
</div>
<div className="card shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 p-4 bg-base-100 border border-base-300 rounded-2xl">
<span className="font-label-sm text-label-sm text-base-content/70">GLOBAL POPs</span>
<div className="font-headline-lg text-headline-lg text-base-content mt-1">38</div>
<span className="font-code-sm text-code-sm text-tertiary">Active-Active</span>
</div>
</div>
</div>
<div className="order-1 md:order-2">
<span className="font-label-sm text-label-sm text-primary uppercase tracking-wider font-semibold">OBSERVABILITY</span>
<h3 className="font-headline-lg text-headline-lg text-base-content mt-2 mb-4">Real-Time Telemetry & Spatial Mesh</h3>
<p className="font-body-lg text-body-lg text-base-content/70 mb-6">
            Inspect traces with microsecond granularity. Spot execution bottlenecks before downstream databases feel strain with native OpenTelemetry export and live Redis stream inspection.
          </p>
<ul className="space-y-3 font-body-md text-body-md text-base-content">
<li className="flex items-center gap-2">
<span className="material-symbols-outlined text-primary-container text-base">check_circle</span>
<span>Standard OpenTelemetry (OTel) traces out of the box</span>
</li>
<li className="flex items-center gap-2">
<span className="material-symbols-outlined text-primary-container text-base">check_circle</span>
<span>Live streaming tail logs without third-party collector overhead</span>
</li>
</ul>
</div>
</div>
</div>
</section>

<section className="py-24 border-b border-base-300 bg-base-100">
<div className="max-w-[1440px] mx-auto px-margin">
<div className="text-center max-w-2xl mx-auto mb-12">
<span className="font-label-sm text-label-sm text-primary-container uppercase tracking-wider font-semibold">DEVELOPER FIRST</span>
<h2 className="font-headline-lg text-headline-lg text-base-content mt-2 mb-3">Integrate with one clean call.</h2>
<p className="font-body-md text-body-md text-base-content/70">Send high-velocity payloads without bloated proprietary SDKs.</p>
</div>
<div className="max-w-3xl mx-auto bg-base-100 border border-base-300 rounded-xl overflow-hidden">

<div className="bg-base-200 px-4 py-3 flex items-center justify-between border-b border-base-300">
<div className="flex items-center gap-2">
<span className="w-3 h-3 rounded-full bg-outline-variant/40"></span>
<span className="w-3 h-3 rounded-full bg-outline-variant/40"></span>
<span className="w-3 h-3 rounded-full bg-outline-variant/40"></span>
<span className="ml-2 font-code-sm text-code-sm text-base-content/70">bash — curl</span>
</div>
<span className="font-code-sm text-code-sm text-base-content/70/60">FlowForge Ingestion Gateway</span>
</div>

<div className="p-6 overflow-x-auto">
<pre className="font-code-sm text-code-sm leading-relaxed text-base-content"><code>curl -X POST https://api.flowforge.dev/v1/dispatch \
  -H <span className="text-tertiary">"Authorization: Bearer ff_live_0947ba9f"</span> \
  -H <span className="text-tertiary">"Content-Type: application/json"</span> \
  -d '{"{"}
    <span className="text-primary">"event"</span>: <span className="text-tertiary">"order.completed"</span>,
    <span className="text-primary">"idempotency_key"</span>: <span className="text-tertiary">"ord_9941a_live"</span>,
    <span className="text-primary">"payload"</span>: {"{"}
      <span className="text-primary">"account_id"</span>: <span className="text-tertiary">"usr_882"</span>,
      <span className="text-primary">"tier"</span>: <span className="text-tertiary">"enterprise"</span>
    {"}"}
  {"}"}'</code></pre>
</div>

<div className="bg-base-100 px-6 py-3 border-t border-base-300 flex items-center justify-between font-code-sm text-code-sm">
<span className="text-tertiary flex items-center gap-2">
<span className="material-symbols-outlined text-sm">check</span>
            HTTP/2 202 Accepted • Trace: tr_49f82c0b
          </span>
<span className="text-base-content/70">Response Time: 2.1ms</span>
</div>
</div>
</div>
</section>

<section className="py-24 bg-base-100 text-center">
<div className="max-w-3xl mx-auto px-margin">
<h2 className="font-headline-lg text-headline-lg text-base-content mb-4">Ready to orchestrate your pipelines?</h2>
<p className="font-body-lg text-body-lg text-base-content/70 mb-8">
        Deploy production-grade background workers and event workflows in minutes. No credit card required.
      </p>
<div className="flex flex-col sm:flex-row items-center justify-center gap-4">
<a className="w-full sm:w-auto bg-primary text-primary-content text-primary-content font-label-md text-label-md px-8 py-3.5 rounded-lg hover:bg-primary/80 active:scale-[0.98] transition-all font-medium" href="#start">
          Start Building Free
        </a>
<a className="w-full sm:w-auto font-label-md text-label-md text-base-content/70 hover:text-base-content px-6 py-3.5 transition-colors" href="#docs">
          Read Technical Documentation →
        </a>
</div>
</div>
</section>

<footer className="w-full bg-base-100 dark:bg-base-100 border-t border-base-300 dark:border-base-300 flat no shadows">
<div className="flex flex-col md:flex-row justify-between items-center w-full max-w-[1440px] mx-auto px-margin py-margin gap-4">

<div className="flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
<span className="font-headline-sm text-headline-sm text-base-content dark:text-base-content font-semibold">FlowForge</span>
<span className="font-body-sm text-body-sm text-base-content/70 dark:text-base-content/70">
          © 2025 FlowForge, Inc. Precision infrastructure for modern engineering.
        </span>
</div>

<div className="flex items-center gap-6">
<div className="flex items-center gap-2 text-tertiary font-code-sm text-code-sm mr-2">
<span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
<span>All Systems Operational</span>
</div>
<div className="flex items-center gap-4">
<a className="font-label-sm text-label-sm text-base-content/70 dark:text-base-content/70 hover:text-base-content dark:hover:text-base-content transition-colors duration-150 ease-out" href="#docs">Documentation</a>
<a className="font-label-sm text-label-sm text-base-content/70 dark:text-base-content/70 hover:text-base-content dark:hover:text-base-content transition-colors duration-150 ease-out" href="#architecture">Architecture</a>
<a className="font-label-sm text-label-sm text-base-content/70 dark:text-base-content/70 hover:text-base-content dark:hover:text-base-content transition-colors duration-150 ease-out" href="#status">Status</a>
<a className="font-label-sm text-label-sm text-base-content/70 dark:text-base-content/70 hover:text-base-content dark:hover:text-base-content transition-colors duration-150 ease-out" href="#security">Security</a>
<a className="font-label-sm text-label-sm text-base-content/70 dark:text-base-content/70 hover:text-base-content dark:hover:text-base-content transition-colors duration-150 ease-out" href="#terms">Terms</a>
<a className="font-label-sm text-label-sm text-base-content/70 dark:text-base-content/70 hover:text-base-content dark:hover:text-base-content transition-colors duration-150 ease-out" href="#privacy">Privacy</a>
</div>
</div>
</div>
</footer>

    </>
  );
}
