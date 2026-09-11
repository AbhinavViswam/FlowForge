import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Zap, Cuboid, ShieldCheck, Gauge, Shield, Signal, ArrowRight, TimerOff, CheckCircle, WifiOff, Copy, Trash2, EyeOff, Network, FileClock, Rocket, Lock, BrainCircuit, Terminal, LayoutDashboard } from 'lucide-react';

import * as THREE from 'three';

export default function Landing() {
  const { user } = useAuth();
  const heroThreeJsRef = useRef<HTMLDivElement>(null);
  const nexusThreeJsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
    const container = heroThreeJsRef.current;
    if (!container || container.hasChildNodes()) return;

    const scene = new THREE.Scene();
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || 520;
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 1.8, 14);
    
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);
    
    const redLight = new THREE.PointLight(0xe11d48, 4.5, 35);
    redLight.position.set(6, 6, 6);
    scene.add(redLight);
    
    const cyanLight = new THREE.PointLight(0x00dce5, 3.5, 30);
    cyanLight.position.set(-6, -4, 5);
    scene.add(cyanLight);
    
    const clusterGroup = new THREE.Group();
    scene.add(clusterGroup);
    
    const coreGeo = new THREE.CylinderGeometry(1.4, 1.4, 0.8, 6);
    const coreMat = new THREE.MeshPhongMaterial({
      color: 0x101319,
      emissive: 0xe11d48,
      shininess: 100,
      flatShading: true
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.rotation.x = Math.PI / 6;
    clusterGroup.add(coreMesh);
    
    const cageGeo = new THREE.CylinderGeometry(1.8, 1.8, 1.2, 6);
    const cageMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e, wireframe: true, transparent: true, opacity: 0.55 });
    const cageMesh = new THREE.Mesh(cageGeo, cageMat);
    cageMesh.rotation.x = Math.PI / 6;
    clusterGroup.add(cageMesh);
    
    const nodes = [];
    const nodeGeo = new THREE.BoxGeometry(0.65, 0.65, 0.65);
    const matCrimson = new THREE.MeshPhongMaterial({ color: 0xe11d48, emissive: 0x9f1239, shininess: 90 });
    const matCyan = new THREE.MeshPhongMaterial({ color: 0x00dce5, emissive: 0x00666b, shininess: 85 });
    const matAmber = new THREE.MeshPhongMaterial({ color: 0xfbbf24, emissive: 0x78350f, shininess: 80 });
    
    const totalNodes = 12;
    for (let i = 0; i < totalNodes; i++) {
      const angle = (i / totalNodes) * Math.PI * 2;
      const radius = 4.4 + (i % 2 === 0 ? 0.7 : -0.5);
      const y = Math.sin(i * 1.5) * 1.4;
      const mat = i % 3 === 0 ? matCyan : (i % 3 === 1 ? matCrimson : matAmber);
      const node = new THREE.Mesh(nodeGeo, mat);
      node.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      node.userData = { angle: angle, radius: radius, speed: 0.007 + (i % 3) * 0.003, yBase: y };
      clusterGroup.add(node);
      nodes.push(node);
    }
    
    const lineMat = new THREE.LineBasicMaterial({ color: 0xe11d48, transparent: true, opacity: 0.35 });
    const lines = [];
    nodes.forEach(node => {
      const pts = [new THREE.Vector3(0, 0, 0), node.position.clone()];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(lineGeo, lineMat);
      clusterGroup.add(line);
      lines.push({ line: line, target: node });
    });
    
    const particleCount = 180;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      pPos[i] = (Math.random() - 0.5) * 18;
      pPos[i+1] = (Math.random() - 0.5) * 12;
      pPos[i+2] = (Math.random() - 0.5) * 14;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({ color: 0xfb7185, size: 0.14, transparent: true, opacity: 0.8 });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);
    
    let mouseX = 0, mouseY = 0;
    const handleMouseMove = (e) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 1.5;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 1.5;
    };
    window.addEventListener('mousemove', handleMouseMove);
    
    const handleResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || 520;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
    
    let clock = new THREE.Clock();
    let reqId;
    function animate() {
      reqId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
    
      coreMesh.rotation.y = t * 0.5;
      cageMesh.rotation.y = -t * 0.35;
    
      clusterGroup.rotation.y = t * 0.12 + mouseX * 1.5;
      clusterGroup.rotation.x = Math.sin(t * 0.15) * 0.1 - mouseY * 1.5; clusterGroup.position.y = 1.5;
    
      nodes.forEach((node, idx) => {
        node.userData.angle += node.userData.speed;
        node.position.x = Math.cos(node.userData.angle) * node.userData.radius;
        node.position.z = Math.sin(node.userData.angle) * node.userData.radius;
        node.position.y = node.userData.yBase + Math.sin(t * 2 + idx) * 0.25;
        node.rotation.x += 0.02;
        node.rotation.y += 0.025;
    
        const lineObj = lines[idx];
        const pos = lineObj.line.geometry.attributes.position.array;
        pos[3] = node.position.x;
        pos[4] = node.position.y;
        pos[5] = node.position.z;
        lineObj.line.geometry.attributes.position.needsUpdate = true;
      });
    
      particles.rotation.y = -t * 0.05; particles.position.y = 1.5;
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(reqId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="bg-surface text-on-surface font-body-md text-body-md antialiased cyber-grid min-h-screen selection:bg-primary-container selection:text-on-primary-container">
      

<header className="fixed top-0 left-0 w-full z-50 border-b border-outline-variant/60 bg-surface-container-lowest/80 backdrop-blur-xl">
<div className="max-w-7xl mx-auto px-gutter md:px-margin h-16 flex items-center justify-between gap-space-md">

<div className="flex items-center gap-space-md">
<a className="flex items-center gap-2 group" href="#">
<img alt="FlowForge Logo" className="w-8 h-8 rounded object-contain drop-shadow-[0_0_8px_rgba(225,29,72,0.6)] group-hover:scale-105 transition-transform" src="/logo.png"/>
<span className="font-headline-md text-headline-md font-bold text-on-surface tracking-tight">FlowForge</span>
</a>

</div>

<nav className="hidden lg:flex items-center gap-8">
<a className="text-on-surface-variant hover:text-on-surface text-body-md font-medium transition-colors" href="#features">Features</a>
<a className="text-on-surface-variant hover:text-on-surface text-body-md font-medium transition-colors" href="#problems">Problems We Solve</a>
<a className="text-on-surface-variant hover:text-on-surface text-body-md font-medium transition-colors" href="#architecture">Architecture</a>
<a className="text-on-surface-variant hover:text-on-surface text-body-md font-medium transition-colors flex items-center gap-1.5" href="#nexus-3d">
<span className="">Nexus 3D</span>
<span className="px-1.5 py-0.2 bg-primary-container/20 text-primary text-[10px] font-mono rounded border border-primary-container/40">LIVE</span>
</a>
</nav>

<div className="flex items-center gap-4">
{user ? (
  <Link className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-surface-container text-primary text-label-md font-label-md font-bold uppercase tracking-wider border border-outline-variant hover:bg-surface-container-high hover:border-primary/50 transition-all active:scale-[0.98]" to="/dashboard">
    <LayoutDashboard className="text-[16px]" size={16} />
    <span className="">Dashboard</span>
  </Link>
) : (
  <>
    <Link className="text-on-surface-variant hover:text-on-surface text-body-md font-medium px-2 py-1 transition-colors" to="/login">Sign In</Link>
    <Link className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-primary-container text-on-primary-container text-label-md font-label-md font-bold uppercase tracking-wider crimson-glow-strong hover:bg-secondary-container transition-all active:scale-[0.98]" to="/signup">
      <Zap className="text-[16px]" size={16} />
      <span className="">Start Building Free</span>
    </Link>
  </>
)}
</div>
</div>
</header>

<section className="relative pt-32 md:pt-36 pb-space-xl px-gutter md:px-margin max-w-7xl mx-auto hero-mesh">
<div className="text-center max-w-4xl mx-auto space-y-space-md">

<div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-surface-container-high/90 border border-outline-variant text-label-sm font-label-sm text-primary shadow-sm">
<span className="w-2 h-2 rounded-full bg-primary-container animate-ping"></span>
<span className="font-bold tracking-wide">FLOWFORGE v2.4 ENGINE</span>
<span className="text-outline">|</span>
<span className="text-on-surface-variant">Fastify, BullMQ, Redis &amp; React Flow Native</span>
</div>

<h1 className="text-3xl md:text-5xl lg:text-6xl font-headline-xl font-extrabold text-on-surface tracking-tight leading-[1.15]">
        Event-Driven Workflows with <br className="hidden sm:inline" />
<span className="bg-gradient-to-r from-primary via-primary-container to-tertiary bg-clip-text text-transparent underline decoration-primary-container/50 decoration-4">Real-Time Observability</span>
</h1>

<p className="text-base sm:text-lg md:text-xl text-on-surface-variant max-w-3xl mx-auto leading-relaxed font-body-lg">
        FlowForge is a developer-focused, event-driven automation platform. Ingest external events (like webhooks), visually orchestrate complex logic, and safely execute background jobs asynchronously with our Nexus 3D spatial observability layer.
      </p>

<div className="flex flex-wrap items-center justify-center gap-space-sm pt-2">
<a className="px-6 py-3.5 rounded bg-primary-container text-on-primary-container font-headline-sm font-bold text-headline-sm crimson-glow-strong hover:bg-secondary-container transition-all flex items-center gap-2 tracking-wide uppercase" href="/signup">
<Zap className="text-[20px]" size={20} />
<span className="">Start Building Free</span>
</a>
<a className="px-6 py-3.5 rounded bg-surface-container-low border border-outline-variant hover:border-primary-container text-on-surface font-headline-sm text-headline-sm font-semibold transition-all flex items-center gap-2 hover:bg-surface-container" href="#nexus-3d">
<Cuboid className="text-[20px] text-tertiary" size={20} />
<span className="">Explore Nexus 3D Live Demo</span>
</a>
</div>

<div className="pt-4 flex flex-wrap items-center justify-center gap-6 text-label-sm font-label-sm text-on-surface-variant">
<div className="flex items-center gap-1.5">
<ShieldCheck className="text-[18px] text-tertiary" size={18} />
<span className="">Built for high-pressure systems</span>
</div>
<div className="flex items-center gap-1.5">
<Gauge className="text-[18px] text-primary" size={18} />
<span className="">P99 &lt; 4.2ms Ingestion</span>
</div>
<div className="flex items-center gap-1.5">
<Shield className="text-[18px] text-tertiary" size={18} />
<span className="">Zero-Data-Loss Guaranteed</span>
</div>
</div>
</div>

<div className="mt-12 relative max-w-6xl mx-auto rounded-2xl border border-outline-variant/80 bg-[#090A0F] shadow-2xl overflow-hidden group">


<div className="w-full h-[460px] md:h-[500px] rounded-xl border border-outline-variant bg-[#090A0F] shadow-2xl relative overflow-hidden" style={{"display":"block"}}>
{/* Script tag removed */}
<div id="threejs-container-ANIMATION_11" ref={heroThreeJsRef} style={{ width: "100%", height: "100%" }}></div>
{/* Script tag removed */}
</div>


<div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2">
<div className="px-3 py-1.5 rounded glass-card border border-outline-variant/90 text-label-sm font-label-sm text-on-surface flex items-center gap-2 shadow-lg">
<span className="w-2 h-2 rounded-full bg-tertiary animate-ping"></span>
<span className="font-code-snippet font-semibold">Redis Cluster 99.999%</span>
<span className="text-outline">|</span>
<span className="text-primary font-bold">18 Pods Master</span>
</div>
<div className="hidden sm:flex px-3 py-1.5 rounded glass-card border border-outline-variant/80 text-label-sm font-label-sm text-on-surface-variant items-center gap-1.5">
<Signal className="text-[15px] text-tertiary" size={15} />
<span className="">Socket.IO v4.7 Egress Active</span>
</div>
</div>
<div className="absolute top-4 right-4 z-20 flex flex-col gap-2 items-end">
<div className="px-3.5 py-1 rounded glass-card border border-primary-container/50 text-right">
<div className="font-code-snippet text-[11px] text-on-surface-variant">Throughput</div>
<div className="font-code-snippet text-sm font-bold text-tertiary">1.4M jobs / sec</div>
</div>
<div className="px-3.5 py-1 rounded glass-card border border-outline-variant text-right hidden sm:block">
<div className="font-code-snippet text-[11px] text-on-surface-variant">P99 Latency</div>
<div className="font-code-snippet text-sm font-bold text-primary">&lt; 4.2ms</div>
</div>
<div className="px-3.5 py-1 rounded glass-card border border-outline-variant text-right hidden sm:block">
<div className="font-code-snippet text-[11px] text-on-surface-variant">DLQ State</div>
<div className="font-code-snippet text-sm font-bold text-on-surface">0 Dropped (100% ACK)</div>
</div>
</div>

<div className="absolute bottom-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-2 rounded glass-card border border-outline-variant/80 text-code-snippet font-code-snippet">
<div className="flex items-center gap-2">
<span className="text-label-sm font-label-sm text-primary font-bold uppercase tracking-wider">Spatial Layer:</span>
<span className="text-on-surface">WebGL2 • Interactive Dynamic Topology • 60 FPS</span>
</div>
<div className="flex items-center gap-3">
<span className="text-on-surface-variant">Click &amp; drag to rotate mesh</span>
<a className="text-primary hover:underline flex items-center gap-1 font-semibold" href="#nexus-3d">
<span className="">Full Observability View</span>
<ArrowRight className="text-[14px]" size={14} />
</a>
</div>
</div>
</div>
</section>

<section className="py-space-xl px-gutter md:px-margin max-w-7xl mx-auto space-y-12" id="problems">
<div className="text-center max-w-3xl mx-auto space-y-3">
<div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-surface-container-high border border-outline-variant text-label-sm font-label-sm text-primary uppercase font-bold tracking-widest">
<span className="">[01_ENGINEERING_PAIN_POINTS]</span>
</div>
<h2 className="text-2xl md:text-4xl font-headline-lg font-bold text-on-surface">
        Architected Specifically for What Breaks in Production
      </h2>
<p className="text-body-lg text-on-surface-variant">
        Building resilient backend automations with standard HTTP microservices creates catastrophic failure modes under load. Here is how FlowForge solves each one.
      </p>
</div>

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

<div className="p-6 rounded-xl bg-surface-container-low border border-outline-variant hover:border-primary-container transition-all flex flex-col justify-between group">
<div className="space-y-4">
<div className="flex items-center justify-between">
<span className="w-10 h-10 rounded bg-error-container/40 border border-error/30 flex items-center justify-center text-error">
<TimerOff className="text-[22px]" size={22} />
</span>
<span className="text-label-sm font-label-sm text-error font-mono px-2 py-0.5 rounded bg-error-container/20">PAIN: 504 TIMEOUTS</span>
</div>
<h3 className="text-headline-sm font-headline-sm font-bold text-on-surface">Synchronous Webhook Bottlenecks</h3>
<p className="text-body-sm text-on-surface-variant leading-relaxed">
            Directly processing webhook payloads synchronously in your HTTP handler blocks ingress worker threads and causes upstream providers (like Stripe or Shopify) to drop connections.
          </p>
</div>
<div className="mt-6 pt-4 border-t border-outline-variant/60 space-y-1">
<div className="text-label-sm font-label-sm text-tertiary font-bold uppercase flex items-center gap-1">
<CheckCircle className="text-[16px]" size={16} />
<span className="">FlowForge Solution</span>
</div>
<p className="text-code-snippet font-code-snippet text-on-surface">
            Instant <strong>202 Accepted</strong> ingestion &amp; decoupled BullMQ worker pools handling 1.4M jobs/sec.
          </p>
</div>
</div>

<div className="p-6 rounded-xl bg-surface-container-low border border-outline-variant hover:border-primary-container transition-all flex flex-col justify-between group">
<div className="space-y-4">
<div className="flex items-center justify-between">
<span className="w-10 h-10 rounded bg-error-container/40 border border-error/30 flex items-center justify-center text-error">
<WifiOff className="text-[22px]" size={22} />
</span>
<span className="text-label-sm font-label-sm text-error font-mono px-2 py-0.5 rounded bg-error-container/20">PAIN: RATE LIMIT 429</span>
</div>
<h3 className="text-headline-sm font-headline-sm font-bold text-on-surface">Transient Failures &amp; Rate Limits</h3>
<p className="text-body-sm text-on-surface-variant leading-relaxed">
            Downstream REST APIs fail or throttle unexpectedly. Naive cron retry loops hammer downstream services into deeper cascading downtime with zero backpressure awareness.
          </p>
</div>
<div className="mt-6 pt-4 border-t border-outline-variant/60 space-y-1">
<div className="text-label-sm font-label-sm text-tertiary font-bold uppercase flex items-center gap-1">
<CheckCircle className="text-[16px]" size={16} />
<span className="">FlowForge Solution</span>
</div>
<p className="text-code-snippet font-code-snippet text-on-surface">
            Bounded <strong>exponential jitter backoff</strong> &amp; atomic sliding-window rate limiters orchestrated in Redis.
          </p>
</div>
</div>

<div className="p-6 rounded-xl bg-surface-container-low border border-outline-variant hover:border-primary-container transition-all flex flex-col justify-between group">
<div className="space-y-4">
<div className="flex items-center justify-between">
<span className="w-10 h-10 rounded bg-error-container/40 border border-error/30 flex items-center justify-center text-error">
<Copy className="text-[22px]" size={22} />
</span>
<span className="text-label-sm font-label-sm text-error font-mono px-2 py-0.5 rounded bg-error-container/20">PAIN: DOUBLE CHARGES</span>
</div>
<h3 className="text-headline-sm font-headline-sm font-bold text-on-surface">Duplicate Side-Effects</h3>
<p className="text-body-sm text-on-surface-variant leading-relaxed">
            Webhooks re-deliver on intermittent network hiccups, producing duplicate database rows, double email sends, or multiple credit card charges across distributed microservices.
          </p>
</div>
<div className="mt-6 pt-4 border-t border-outline-variant/60 space-y-1">
<div className="text-label-sm font-label-sm text-tertiary font-bold uppercase flex items-center gap-1">
<CheckCircle className="text-[16px]" size={16} />
<span className="">FlowForge Solution</span>
</div>
<p className="text-code-snippet font-code-snippet text-on-surface">
<strong>Atomic idempotency keys</strong> enforced at the redis level ensuring actions execute strictly once.
          </p>
</div>
</div>

<div className="p-6 rounded-xl bg-surface-container-low border border-outline-variant hover:border-primary-container transition-all flex flex-col justify-between group">
<div className="space-y-4">
<div className="flex items-center justify-between">
<span className="w-10 h-10 rounded bg-error-container/40 border border-error/30 flex items-center justify-center text-error">
<Trash2 className="text-[22px]" size={22} />
</span>
<span className="text-label-sm font-label-sm text-error font-mono px-2 py-0.5 rounded bg-error-container/20">PAIN: SILENT DROPS</span>
</div>
<h3 className="text-headline-sm font-headline-sm font-bold text-on-surface">Silent Data Loss</h3>
<p className="text-body-sm text-on-surface-variant leading-relaxed">
            When third-party APIs change schemas or databases crash, unhandled exceptions vanish into log aggregation tools, leaving critical business transactions unrecoverable.
          </p>
</div>
<div className="mt-6 pt-4 border-t border-outline-variant/60 space-y-1">
<div className="text-label-sm font-label-sm text-tertiary font-bold uppercase flex items-center gap-1">
<CheckCircle className="text-[16px]" size={16} />
<span className="">FlowForge Solution</span>
</div>
<p className="text-code-snippet font-code-snippet text-on-surface">
            Zero-Loss <strong>Dead-Letter Queues (DLQ)</strong> with full payload snapshots and 1-click replay.
          </p>
</div>
</div>

<div className="p-6 rounded-xl bg-surface-container-low border border-outline-variant hover:border-primary-container transition-all flex flex-col justify-between group md:col-span-2 lg:col-span-2">
<div className="space-y-4">
<div className="flex items-center justify-between">
<span className="w-10 h-10 rounded bg-error-container/40 border border-error/30 flex items-center justify-center text-error">
<EyeOff className="text-[22px]" size={22} />
</span>
<span className="text-label-sm font-label-sm text-error font-mono px-2 py-0.5 rounded bg-error-container/20">PAIN: LOG OBFUSCATION</span>
</div>
<h3 className="text-headline-sm font-headline-sm font-bold text-on-surface">Observability Blindspots in Distributed Meshes</h3>
<p className="text-body-sm text-on-surface-variant leading-relaxed">
            Debugging complex directed acyclic graphs (DAGs) across dozens of asynchronous queue workers usually means piecing together disconnected correlation IDs across Datadog, CloudWatch, and local console stdout.
          </p>
</div>
<div className="mt-6 pt-4 border-t border-outline-variant/60 space-y-1">
<div className="text-label-sm font-label-sm text-tertiary font-bold uppercase flex items-center gap-1">
<CheckCircle className="text-[16px]" size={16} />
<span className="">FlowForge Solution</span>
</div>
<p className="text-code-snippet font-code-snippet text-on-surface">
<strong>Socket.IO real-time stream</strong> translated directly into the <strong>Nexus 3D spatial mesh</strong>: watch backpressure propagate and isolate stalls in true 3D coordinates.
          </p>
</div>
</div>
</div>
</section>

<section className="py-space-xl px-gutter md:px-margin max-w-7xl mx-auto space-y-16" id="features">
<div className="text-center max-w-3xl mx-auto space-y-3">
<div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-surface-container-high border border-outline-variant text-label-sm font-label-sm text-primary uppercase font-bold tracking-widest">
<span className="">[02_PLATFORM_CAPABILITIES]</span>
</div>
<h2 className="text-2xl md:text-4xl font-headline-lg font-bold text-on-surface">
        Every Layer Optimized for Developer Experience
      </h2>
<p className="text-body-lg text-on-surface-variant">
        From low-latency protocol ingestion to state-machine execution, FlowForge delivers the developer primitives you need to ship confident distributed pipelines.
      </p>
</div>

<div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-surface-container-low border border-outline-variant rounded-2xl p-6 md:p-8">
<div className="lg:col-span-5 space-y-4">
<div className="inline-flex items-center gap-2 text-label-sm font-label-sm text-primary font-bold uppercase">
<Network className="text-[18px]" size={18} />
<span className="">Studio Canvas &amp; Node Library</span>
</div>
<h3 className="text-2xl font-headline-lg font-bold text-on-surface">
          Visual Drag-and-Drop Workflow Canvas
        </h3>
<p className="text-body-md text-on-surface-variant leading-relaxed">
          Powered by React Flow, customize execution paths with interactive triggers, conditional branches, HTTP/GraphQL queries, BullMQ job queues, and AI transformation steps with live payload testing.
        </p>
<ul className="space-y-2.5 font-code-snippet text-code-snippet text-on-surface-variant pt-2">
<li className="flex items-center gap-2">
<span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
<span className="">Drag-and-drop triggers, conditions &amp; worker sinks</span>
</li>
<li className="flex items-center gap-2">
<span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
<span className="">Real-time test run execution with variable inspector</span>
</li>
<li className="flex items-center gap-2">
<span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
<span className="">Bi-directional sync with Git / JSON Schema DAGs</span>
</li>
</ul>
<div className="pt-2">
<a className="inline-flex items-center gap-2 text-primary font-label-md font-semibold hover:underline" href="/signup">
<span className="">Try the visual workflow builder</span>
<ArrowRight className="text-[16px]" size={16} />
</a>
</div>
</div>

<div className="lg:col-span-7 rounded-xl overflow-hidden border border-outline-variant shadow-2xl bg-surface-container-lowest">
<img alt="FlowForge Visual Studio Canvas" className="w-full h-auto object-cover hover:scale-[1.01] transition-transform duration-300" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBygCsW7b-DJq1BIj9Y0IWobgCa0ffSuJ6zm4PBiTT0s-IiIMw7DhmDmDFzlZoMTQKX8tbmgUzD7V1hMtxbG7-sJ-IAHtey_AuAqG2wZDWID6n-4awPtZu_qEe9YMb6x7Q7W7YN3Vxp0DSGDRgTsXNumSSBxPMgOdCrdolBGIt2uTlLWVliA4jZEJZ3X90GYiSxoFcGb6QK5kvVtJ6528XhbDGveu21VQmSX7oQB1ryudBGcyfWF1SV_Txc1ocKEf8u"/>
</div>
</div>

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" id="architecture">

<div className="p-6 rounded-xl bg-surface-container-low border border-outline-variant hover:border-primary-container transition-all flex flex-col justify-between group">
<div className="space-y-3">
<div className="w-10 h-10 rounded bg-surface-container border border-outline-variant flex items-center justify-center text-primary group-hover:crimson-glow transition-all">
<FileClock className="text-[20px]" size={20} />
</div>
<div className="text-label-sm font-label-sm text-primary uppercase font-bold">REVISION ENGINE</div>
<h4 className="text-headline-sm font-headline-sm font-bold text-on-surface">Immutable Workflow Versioning</h4>
<p className="text-body-sm text-on-surface-variant">
            Deploy hot updates without dropping in-flight jobs. Every execution is cryptographically pinned to an immutable revision snapshot.
          </p>
</div>
<div className="mt-4 pt-3 border-t border-outline-variant font-code-snippet text-[11px] text-tertiary">
          Zero inflight downtime
        </div>
</div>

<div className="p-6 rounded-xl bg-surface-container-low border border-outline-variant hover:border-primary-container transition-all flex flex-col justify-between group">
<div className="space-y-3">
<div className="w-10 h-10 rounded bg-surface-container border border-outline-variant flex items-center justify-center text-primary group-hover:crimson-glow transition-all">
<Rocket className="text-[20px]" size={20} />
</div>
<div className="text-label-sm font-label-sm text-primary uppercase font-bold">PERFORMANCE</div>
<h4 className="text-headline-sm font-headline-sm font-bold text-on-surface">High-Pressure Concurrency Engine</h4>
<p className="text-body-sm text-on-surface-variant">
            Built on top of Fastify and Redis-backed BullMQ. Scales horizontally across cluster pods to ingest 1.4 million events per second.
          </p>
</div>
<div className="mt-4 pt-3 border-t border-outline-variant font-code-snippet text-[11px] text-tertiary">
          Fastify + BullMQ Native
        </div>
</div>

<div className="p-6 rounded-xl bg-surface-container-low border border-outline-variant hover:border-primary-container transition-all flex flex-col justify-between group">
<div className="space-y-3">
<div className="w-10 h-10 rounded bg-surface-container border border-outline-variant flex items-center justify-center text-primary group-hover:crimson-glow transition-all">
<Lock className="text-[20px]" size={20} />
</div>
<div className="text-label-sm font-label-sm text-primary uppercase font-bold">SECURITY</div>
<h4 className="text-headline-sm font-headline-sm font-bold text-on-surface">Enterprise Webhook Guardrails</h4>
<p className="text-body-sm text-on-surface-variant">
            Zero-Trust egress policies with RFC 1918 private IP blocking, dynamic DNS pinning, and HMAC-SHA256 signature verification out of the box.
          </p>
</div>
<div className="mt-4 pt-3 border-t border-outline-variant font-code-snippet text-[11px] text-tertiary">
          Strict SSRF Protection
        </div>
</div>

<div className="p-6 rounded-xl bg-surface-container-low border border-outline-variant hover:border-primary-container transition-all flex flex-col justify-between group">
<div className="space-y-3">
<div className="w-10 h-10 rounded bg-surface-container border border-outline-variant flex items-center justify-center text-primary group-hover:crimson-glow transition-all">
<BrainCircuit className="text-[20px]" size={20} />
</div>
<div className="text-label-sm font-label-sm text-primary uppercase font-bold">SYNTHESIS</div>
<h4 className="text-headline-sm font-headline-sm font-bold text-on-surface">AI-Assisted Workflow Generation</h4>
<p className="text-body-sm text-on-surface-variant">
            Convert natural language instructions into fully validated Zod-schema DAGs. Review and tweak nodes visually before committing to production.
          </p>
</div>
<div className="mt-4 pt-3 border-t border-outline-variant font-code-snippet text-[11px] text-tertiary">
          Zod-Validated DAG Output
        </div>
</div>
</div>
</section>

<section className="py-space-xl px-gutter md:px-margin max-w-7xl mx-auto space-y-8" id="nexus-3d">
<div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-outline-variant pb-4">
<div>
<div className="inline-flex items-center gap-1.5 text-label-sm font-label-sm text-primary uppercase tracking-wider font-semibold">
<Cuboid className="text-[16px]" size={16} />
<span className="">SPATIAL CLUSTER TELEMETRY</span>
</div>
<h2 className="text-2xl md:text-4xl font-headline-lg font-bold text-on-surface">
          Nexus 3D Real-Time Spatial Mesh
        </h2>
<p className="text-body-md font-body-md text-on-surface-variant max-w-2xl mt-1">
          Forget flat tabular metrics. Inspect your BullMQ queues, worker nodes, and event velocity in real-time 3D space with zero telemetry overhead.
        </p>
</div>

<div className="flex flex-wrap items-center gap-2">
<button className="px-3 py-1.5 rounded bg-surface-container border border-primary-container text-primary font-label-sm text-label-sm crimson-glow font-medium">
          Latency Heatmap
        </button>
<button className="px-3 py-1.5 rounded bg-surface-container border border-outline-variant text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm transition-colors">
          Backpressure Velocity
        </button>
<button className="px-3 py-1.5 rounded bg-surface-container border border-outline-variant text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm transition-colors">
          Dead-Letter Traps
        </button>
</div>
</div>

<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

<div className="lg:col-span-7 bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between space-y-4">
<div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
<div className="flex items-center gap-2">
<span className="w-2.5 h-2.5 rounded-full bg-primary-container animate-pulse"></span>
<span className="font-code-snippet text-code-snippet font-bold text-on-surface">SPATIAL HUD • WebGL2</span>
</div>
<span className="font-code-snippet text-[11px] text-tertiary bg-surface-container px-2 py-0.5 rounded border border-outline-variant">
            P99: 3.8ms • Zero Jitter
          </span>
</div>
<div className="grid grid-cols-3 gap-3">
<div className="p-3 bg-surface-container-low border border-outline-variant rounded">
<div className="text-[11px] font-code-snippet text-on-surface-variant">Active Pods</div>
<div className="text-xl font-bold font-headline-md text-on-surface">18 Nodes</div>
<div className="text-[10px] text-tertiary font-code-snippet">Auto-balanced</div>
</div>
<div className="p-3 bg-surface-container-low border border-outline-variant rounded">
<div className="text-[11px] font-code-snippet text-on-surface-variant">Memory Footprint</div>
<div className="text-xl font-bold font-headline-md text-on-surface">142 MB</div>
<div className="text-[10px] text-primary font-code-snippet">Optimized Rust core</div>
</div>
<div className="p-3 bg-surface-container-low border border-outline-variant rounded">
<div className="text-[11px] font-code-snippet text-on-surface-variant">Stream Latency</div>
<div className="text-xl font-bold font-headline-md text-tertiary">0.8ms</div>
<div className="text-[10px] text-on-surface font-code-snippet">Socket.IO direct</div>
</div>
</div>
<div className="space-y-2 text-body-sm text-on-surface-variant">
<p className="">
            When a downstream API experiences latency spikes, Nexus 3D reflects the backpressure visually in real-time. Nodes flash from cyan to crimson as their internal BullMQ queues approach saturation limits.
          </p>
</div>
<div className="flex items-center justify-between pt-2 border-t border-outline-variant text-code-snippet text-xs text-on-surface-variant">
<span className="flex items-center gap-1.5">
<span className="w-2 h-2 rounded-full bg-tertiary"></span>
<span className="">Cluster Heartbeat OK</span>
</span>
<span className="text-primary font-medium">Replication factor: 3x</span>
</div>
</div>

<div className="lg:col-span-5 bg-[#090A0F] border border-outline-variant rounded-xl overflow-hidden flex flex-col justify-between">
<div className="flex items-center justify-between px-4 py-2.5 bg-surface-container border-b border-outline-variant">
<div className="flex items-center gap-2">
<Terminal className="text-[16px] text-primary" size={16} />
<span className="font-code-snippet text-xs font-semibold text-on-surface">Socket.IO Live Log Stream</span>
</div>
<span className="font-code-snippet text-[11px] text-tertiary animate-pulse">● LIVE 12.4k msg/s</span>
</div>
<div className="p-4 font-code-snippet text-[11px] space-y-2 text-on-surface-variant h-64 overflow-y-auto leading-relaxed">
<div className=""><span className="text-outline">16:04:10.102</span> <span className="text-tertiary">[202 ACCEPTED]</span> webhook_ingest: <span className="text-on-surface">/v1/stripe/charge.succeeded</span></div>
<div className=""><span className="text-outline">16:04:10.104</span> <span className="text-secondary">[ENQUEUE]</span> BullMQ: <span className="text-on-surface">queue=receipt_pdf job=ff_90a42</span></div>
<div className=""><span className="text-outline">16:04:10.118</span> <span className="text-primary">[RETRY:EXP]</span> Downstream API 429: backoff 120ms</div>
<div className=""><span className="text-outline">16:04:10.240</span> <span className="text-tertiary">[RESOLVED]</span> Worker node pod-04 completed job in 14ms</div>
<div className=""><span className="text-outline">16:04:10.252</span> <span className="text-on-surface">[DLQ_CHECK]</span> 0 quarantined messages • state=HEALTHY</div>
<div className=""><span className="text-outline">16:04:10.288</span> <span className="text-tertiary">[IDEMPOTENT_ACK]</span> Key: ord_9921 matched • bypassed duplicate</div>
</div>
<div className="p-3 bg-surface-container-low border-t border-outline-variant flex items-center justify-between font-code-snippet text-[11px]">
<span className="text-on-surface-variant">Auto-scrolling stream</span>
<button className="text-primary hover:underline" onClick={() => { this.innerText='Stream Paused' }}>Pause Stream</button>
</div>
</div>
</div>
</section>

<section className="py-space-xl px-gutter md:px-margin max-w-7xl mx-auto space-y-12">
<div className="text-center max-w-3xl mx-auto space-y-3">
<div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-surface-container-high border border-outline-variant text-label-sm font-label-sm text-primary uppercase font-bold tracking-widest">
<span className="">[04_FIELD_TESTED]</span>
</div>
<h2 className="text-2xl md:text-4xl font-headline-lg font-bold text-on-surface">
        Trusted by Engineers Building Under Extreme Load
      </h2>
<p className="text-body-lg text-on-surface-variant">
        See why backend architects and staff platform engineers migrate from legacy cron systems to FlowForge.
      </p>
</div>
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">

<div className="p-6 rounded-xl bg-surface-container-low border border-outline-variant hover:border-primary-container transition-all flex flex-col justify-between space-y-4">
<div className="space-y-3">
<div className="flex text-primary">
            ★★★★★
          </div>
<p className="text-body-md text-on-surface leading-relaxed italic">
            "We were dropping 2% of our payment webhooks during Black Friday flash sales using our old Lambda endpoints. Moving to FlowForge's BullMQ pipeline dropped failure rates to exactly 0.000% across 45M events."
          </p>
</div>
<div className="pt-4 border-t border-outline-variant flex items-center gap-3">
<div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center font-bold text-primary border border-outline-variant">
            MR
          </div>
<div>
<div className="font-headline-sm text-sm font-bold text-on-surface">Marcus Ray</div>
<div className="text-label-sm font-label-sm text-on-surface-variant">Staff Platform Engineer @ FinScale</div>
</div>
</div>
</div>

<div className="p-6 rounded-xl bg-surface-container-low border border-outline-variant hover:border-primary-container transition-all flex flex-col justify-between space-y-4">
<div className="space-y-3">
<div className="flex text-primary">
            ★★★★★
          </div>
<p className="text-body-md text-on-surface leading-relaxed italic">
            "The Nexus 3D observability layer sounds like a gimmick until you actually have a cascading backpressure issue at 2 AM. You can spot the bottlenecked worker pod in seconds instead of digging through 100k lines of CloudWatch logs."
          </p>
</div>
<div className="pt-4 border-t border-outline-variant flex items-center gap-3">
<div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center font-bold text-tertiary border border-outline-variant">
            SL
          </div>
<div>
<div className="font-headline-sm text-sm font-bold text-on-surface">Sarah Lin</div>
<div className="text-label-sm font-label-sm text-on-surface-variant">Tech Lead &amp; Architect @ CloudMesh</div>
</div>
</div>
</div>

<div className="p-6 rounded-xl bg-surface-container-low border border-outline-variant hover:border-primary-container transition-all flex flex-col justify-between space-y-4">
<div className="space-y-3">
<div className="flex text-primary">
            ★★★★★
          </div>
<p className="text-body-md text-on-surface leading-relaxed italic">
            "The combination of strict SSRF prevention, immutable workflow versions, and 1-click DLQ replay solved three major compliance requirements for our SOC2 Type II audit without writing custom middleware."
          </p>
</div>
<div className="pt-4 border-t border-outline-variant flex items-center gap-3">
<div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center font-bold text-secondary border border-outline-variant">
            DK
          </div>
<div>
<div className="font-headline-sm text-sm font-bold text-on-surface">Devon Keller</div>
<div className="text-label-sm font-label-sm text-on-surface-variant">VP of Infrastructure @ HealthBridge</div>
</div>
</div>
</div>
</div>
</section>

<section className="py-space-xl px-gutter md:px-margin max-w-7xl mx-auto" id="deploy">
<div className="rounded-2xl bg-gradient-to-b from-surface-container to-surface-container-lowest border border-primary-container/40 p-8 md:p-14 text-center space-y-8 crimson-glow relative overflow-hidden">

<div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-primary-container/20 blur-3xl pointer-events-none rounded-full"></div>
<div className="relative space-y-3 max-w-3xl mx-auto">
<div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-surface-container-high border border-outline-variant text-label-sm font-label-sm text-primary uppercase font-bold tracking-widest">
<span className="">ZERO CLOUD LOCK-IN • 100% OPEN ARCHITECTURE</span>
</div>
<h2 className="text-3xl md:text-5xl font-headline-xl font-bold text-on-surface tracking-tight">
          Deploy Your First Distributed Pipeline in 60 Seconds
        </h2>
<p className="text-body-lg text-on-surface-variant max-w-2xl mx-auto">Launch full-mesh visual automations or deploy straight to our multi-region managed cloud with zero infrastructure overhead.</p>
</div>



<div className="flex flex-wrap items-center justify-center gap-4 pt-2"><a className="px-8 py-3.5 rounded bg-primary-container text-on-primary-container font-headline-sm font-bold crimson-glow-strong hover:bg-secondary-container transition-all active:scale-[0.98] uppercase tracking-wider flex items-center gap-2" href="/signup"><Zap className="text-[20px]" size={20} /><span className="">Start Building Free</span></a><a className="px-8 py-3.5 rounded bg-surface-container border border-outline-variant hover:border-primary-container text-on-surface font-headline-sm font-semibold transition-all" href="#docs">Read the Documentation</a></div>
</div>
</section>

<footer className="w-full border-t border-outline-variant bg-surface-container-lowest py-12 px-gutter md:px-margin">
<div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-8 mb-12">

<div className="md:col-span-2 space-y-4">
<div className="flex items-center gap-2">
<img alt="FlowForge Logo" className="w-7 h-7 rounded object-contain" src="/logo.png"/>
<span className="font-headline-md text-headline-md font-bold text-on-surface">FlowForge</span>
</div>
<p className="text-body-sm text-on-surface-variant max-w-sm leading-relaxed">
          High-throughput distributed workflow orchestration with BullMQ, Redis, Fastify, and real-time Nexus 3D spatial observability.
        </p>
<div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-surface-container border border-outline-variant text-label-sm font-label-sm text-tertiary">
<span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
<span className="">All Systems Operational (99.999%)</span>
</div>
</div>

<div className="space-y-3">
<div className="font-headline-sm text-sm font-bold text-on-surface uppercase tracking-wider">Product</div>
<ul className="space-y-2 text-body-sm text-on-surface-variant">
<li className=""><a className="hover:text-primary transition-colors" href="#features">Studio Canvas</a></li>
<li className=""><a className="hover:text-primary transition-colors" href="#nexus-3d">Nexus 3D Telemetry</a></li>
<li className=""><a className="hover:text-primary transition-colors" href="#queues">BullMQ Workers</a></li>
<li className=""><a className="hover:text-primary transition-colors" href="#dlq">Zero-Loss DLQ</a></li>
<li className=""><a className="hover:text-primary transition-colors" href="#pricing">Pricing &amp; Plans</a></li>
</ul>
</div>

<div className="space-y-3">
<div className="font-headline-sm text-sm font-bold text-on-surface uppercase tracking-wider">Developers</div>
<ul className="space-y-2 text-body-sm text-on-surface-variant">
<li className=""><a className="hover:text-primary transition-colors" href="#docs">Documentation</a></li>
<li className=""><a className="hover:text-primary transition-colors" href="#api">REST / Fastify API</a></li>
<li className=""><a className="hover:text-primary transition-colors" href="#cli">FlowForge CLI</a></li>
<li className=""><a className="hover:text-primary transition-colors" href="#architecture">Architecture Whitepaper</a></li>
<li className=""><a className="hover:text-primary transition-colors" href="#github">GitHub Repository</a></li>
</ul>
</div>

<div className="space-y-3">
<div className="font-headline-sm text-sm font-bold text-on-surface uppercase tracking-wider">Compliance</div>
<ul className="space-y-2 text-body-sm text-on-surface-variant">
<li className=""><a className="hover:text-primary transition-colors" href="#security">SSRF Isolation</a></li>
<li className=""><a className="hover:text-primary transition-colors" href="#soc2">SOC2 Type II Report</a></li>
<li className=""><a className="hover:text-primary transition-colors" href="#privacy">Privacy Policy</a></li>
<li className=""><a className="hover:text-primary transition-colors" href="#terms">Terms of Service</a></li>
<li className=""><a className="hover:text-primary transition-colors" href="#status">Live Status Page</a></li>
</ul>
</div>
</div>
<div className="max-w-7xl mx-auto pt-6 border-t border-outline-variant/60 flex flex-col sm:flex-row justify-between items-center gap-4 text-label-sm font-label-sm text-on-surface-variant">
<div className="">
        © 2025 FlowForge Engine Inc. All rights reserved.
      </div>
<div className="flex items-center gap-4 font-code-snippet">
<span className="">v2.4.1-production</span>
<span className="">•</span>
<span className="">US-EAST / EU-CENTRAL / AP-SOUTHEAST</span>
</div>
</div>
</footer>



    </div>
  );
}
