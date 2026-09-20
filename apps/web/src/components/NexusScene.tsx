import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, Html, Line } from '@react-three/drei';
import { useRef, useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';

// Node type shapes
const geometryByShape = {
  trigger: new THREE.OctahedronGeometry(1.2, 0),
  action: new THREE.BoxGeometry(1.5, 1.5, 1.5),
  logic: new THREE.ConeGeometry(1.2, 2, 4),
};

const colorByType = {
  trigger: '#3b82f6', // blue
  action: '#10b981', // emerald
  logic: '#f59e0b', // amber
  failed: '#f43f5e', // rose
};

function NexusNode({ node, position, activeEvent, status }: { node: any, position: [number, number, number], activeEvent: any, status: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  const isExecuting = activeEvent?.nodeId === node.id && activeEvent?.type === 'node_complete';
  const isFailed = status === 'failed';

  useFrame((state) => {
    if (meshRef.current) {
      if (isExecuting) {
        meshRef.current.rotation.y += 0.1;
        meshRef.current.rotation.x += 0.05;
        const scale = 1 + Math.sin(state.clock.elapsedTime * 15) * 0.1;
        meshRef.current.scale.set(scale, scale, scale);
      } else {
        meshRef.current.rotation.y += 0.005;
        meshRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
      }
    }
  });

  const geometry = geometryByShape[node.type as keyof typeof geometryByShape] || new THREE.SphereGeometry(1, 32, 32);

  return (
    <group position={position}>
      <mesh ref={meshRef} geometry={geometry}>
        <meshStandardMaterial 
          ref={materialRef} 
          color={colorByType[node.type as keyof typeof colorByType] || '#94a3b8'} 
          roughness={0.2}
          metalness={0.8}
          emissiveIntensity={0.5}
        />
      </mesh>
      
      <Html position={[0, -2, 0]} center style={{ pointerEvents: 'none', transition: 'all 0.2s' }}>
        <div className="flex flex-col items-center bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 shadow-xl w-max">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">{node.type}</span>
          <span className="text-xs font-medium text-white">{node.data?.label || node.id}</span>
          {isExecuting && (
            <span className="mt-1 text-[9px] font-code-snippet text-emerald-400 animate-pulse">EXECUTING...</span>
          )}
          {isFailed && (
            <span className="mt-1 text-[9px] font-code-snippet text-rose-400">FAILED</span>
          )}
        </div>
      </Html>
    </group>
  );
}

function ConnectionEdge({ start, end, active }: { start: [number, number, number], end: [number, number, number], active: boolean }) {
  const lineRef = useRef<any>(null);
  
  useFrame(() => {
    if (lineRef.current?.material) {
      const targetOpacity = active ? 1 : 0.2;
      lineRef.current.material.opacity += (targetOpacity - lineRef.current.material.opacity) * 0.1;
      
      if (active) {
        lineRef.current.material.color = new THREE.Color('#3b82f6');
      } else {
        lineRef.current.material.color = new THREE.Color('#ffffff');
      }
    }
  });

  return (
    <Line
      ref={lineRef}
      points={[start, end]}
      color="#ffffff"
      lineWidth={active ? 3 : 1}
      transparent
      opacity={0.2}
    />
  );
}

function Particles({ healthState }: { healthState: string }) {
  const count = 150;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 40;
      const y = (Math.random() - 0.5) * 40;
      const z = (Math.random() - 0.5) * 40 - 10;
      const speed = Math.random() * 0.02 + 0.01;
      temp.push({ x, y, z, speed });
    }
    return temp;
  }, [count]);

  useFrame(() => {
    if (meshRef.current) {
      const isIncident = healthState === 'incident';
      const isDegraded = healthState === 'degraded';
      
      const speedMult = isIncident ? 5 : isDegraded ? 2 : 1;
      
      particles.forEach((p, i) => {
        // Move particles along Z axis to create flow
        p.z += p.speed * speedMult;
        
        // Loop back when they go too far
        if (p.z > 10) p.z = -30;
        
        dummy.position.set(p.x, p.y, p.z);
        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(i, dummy.matrix);
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
      
      if (isIncident) {
        (meshRef.current.material as THREE.MeshBasicMaterial).color = new THREE.Color('#ef4444');
      } else if (isDegraded) {
        (meshRef.current.material as THREE.MeshBasicMaterial).color = new THREE.Color('#f59e0b');
      } else {
        (meshRef.current.material as THREE.MeshBasicMaterial).color = new THREE.Color('#475569');
      }
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[new THREE.SphereGeometry(0.05), new THREE.MeshBasicMaterial({ color: '#475569', transparent: true, opacity: 0.6 }), count]}>
    </instancedMesh>
  );
}

export default function NexusScene({ nodes, edges, activeEvent, healthState = 'healthy' }: { nodes: any[], edges: any[], activeEvent: any, healthState?: 'healthy' | 'degraded' | 'incident' }) {
  // Layout nodes in 3D space
  const nodePositions = useMemo(() => {
    const pos: Record<string, [number, number, number]> = {};
    nodes.forEach((n) => {
      // Map 2D XY to 3D XY, pushing Z out slightly for depth
      const x = (n.position.x - 400) / 50;
      const y = -(n.position.y - 300) / 50;
      const z = Math.sin(x * y) * 2;
      pos[n.id] = [x, y, z];
    });
    return pos;
  }, [nodes]);

  // Track node status manually for visual effects
  const [nodeStatus, setNodeStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    if (activeEvent?.type === 'node_complete') {
      const data = activeEvent.payload;
      setNodeStatus(prev => ({
        ...prev,
        [data.nodeId]: data.status
      }));
    } else if (activeEvent?.type === 'execution_started') {
      setNodeStatus({});
    }
  }, [activeEvent]);

  // Determine colors based on health state
  const ambientColor = healthState === 'incident' ? '#ef4444' : healthState === 'degraded' ? '#f59e0b' : '#ffffff';
  const ambientIntensity = healthState === 'incident' ? 1.5 : 0.4;
  const pointColor = healthState === 'incident' ? '#dc2626' : '#3b82f6';

  return (
    <div className="w-full h-full bg-[#050505] rounded-xl overflow-hidden relative shadow-inner border border-white/[0.05]">
      <Canvas camera={{ position: [0, 0, 15], fov: 45 }}>
        <ambientLight intensity={ambientIntensity} color={ambientColor} />
        <directionalLight position={[10, 10, 10]} intensity={1.5} color="#ffffff" />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color={pointColor} />
        
        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          maxDistance={30}
          minDistance={5}
        />

        {/* Render edges */}
        {edges.map((edge) => {
          const start = nodePositions[edge.source];
          const end = nodePositions[edge.target];
          if (!start || !end) return null;
          
          const isEdgeActive = activeEvent?.payload?.nodeId === edge.target || 
                               (activeEvent?.payload?.nodeId === edge.source && activeEvent?.type === 'node_complete');

          return <ConnectionEdge key={edge.id} start={start} end={end} active={isEdgeActive} />;
        })}

        {/* Render nodes */}
        {nodes.map((node) => (
          <NexusNode 
            key={node.id} 
            node={node} 
            position={nodePositions[node.id] || [0,0,0]} 
            activeEvent={activeEvent}
            status={nodeStatus[node.id] || 'idle'}
          />
        ))}

        {/* Background stars / particles */}
        <Particles healthState={healthState} />
      </Canvas>
      
      <div className="absolute top-4 left-4 flex flex-col gap-1 pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">view_in_ar</span>
          <span className="text-white font-display font-semibold tracking-wide">NEXUS VISUALIZER</span>
          {activeEvent && activeEvent.type === 'execution_started' && (
            <span className="ml-3 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase border border-emerald-500/30 animate-pulse">
              Live Execution
            </span>
          )}
        </div>
        
        {healthState !== 'healthy' && (
          <div className="flex items-center gap-1 mt-1">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border animate-pulse ${healthState === 'incident' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}`}>
              System: {healthState}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

