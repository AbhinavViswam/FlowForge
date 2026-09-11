
(function() {
  const container = document.getElementById('threejs-container-ANIMATION_11');
  const devicePixelRatio = window.devicePixelRatio || 1;
  // Interactive FlowForge 3D Hero Topology - Developer Cluster Engine
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

// Central FlowForge Hex Core Engine
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

// Glowing wireframe aura
const cageGeo = new THREE.CylinderGeometry(1.8, 1.8, 1.2, 6);
const cageMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e, wireframe: true, transparent: true, opacity: 0.55 });
const cageMesh = new THREE.Mesh(cageGeo, cageMat);
cageMesh.rotation.x = Math.PI / 6;
clusterGroup.add(cageMesh);

// Orbiting worker queue pods & telemetry pipelines
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

// Interconnecting dynamic data stream lines
const lineMat = new THREE.LineBasicMaterial({ color: 0xe11d48, transparent: true, opacity: 0.35 });
const lines = [];
nodes.forEach(node => {
  const pts = [new THREE.Vector3(0, 0, 0), node.position.clone()];
  const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
  const line = new THREE.Line(lineGeo, lineMat);
  clusterGroup.add(line);
  lines.push({ line: line, target: node });
});

// Particle stream
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
window.addEventListener('mousemove', (e) => {
  mouseX = (e.clientX / window.innerWidth - 0.5) * 1.5;
  mouseY = (e.clientY / window.innerHeight - 0.5) * 1.5;
});

window.addEventListener('resize', () => {
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || 520;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});

let clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  coreMesh.rotation.y = t * 0.5;
  cageMesh.rotation.y = -t * 0.35;

  clusterGroup.rotation.y = t * 0.12 + mouseX * 0.4;
  clusterGroup.rotation.x = Math.sin(t * 0.15) * 0.1 - mouseY * 0.3;

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

  particles.rotation.y = -t * 0.05;
  renderer.render(scene, camera);
}
animate();

})();
