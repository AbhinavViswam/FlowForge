const fs = require('fs');

const mdPath = 'C:\\DILSHA\\ABHI\\flowforge\\scratch\\homepage_v2.html';
const content = fs.readFileSync(mdPath, 'utf8');

// Extract everything between <body...> and </body>
const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

if (!bodyMatch) {
  console.log("No body found");
  process.exit(1);
}

let bodyHtml = bodyMatch[1];

// Convert class to className
bodyHtml = bodyHtml.replace(/class="/g, 'className="');

// Fix self-closing tags (img, input, hr, br)
bodyHtml = bodyHtml.replace(/<img([^>]+[^\/])>/g, '<img$1/>');
bodyHtml = bodyHtml.replace(/<input([^>]+[^\/])>/g, '<input$1/>');
bodyHtml = bodyHtml.replace(/<br>/g, '<br/>');
bodyHtml = bodyHtml.replace(/<hr>/g, '<hr/>');
bodyHtml = bodyHtml.replace(/onclick="/g, 'onClick="');
bodyHtml = bodyHtml.replace(/readonly/g, 'readOnly');
bodyHtml = bodyHtml.replace(/readOnly="readOnly"/g, 'readOnly={true}');
bodyHtml = bodyHtml.replace(/readOnly=""/g, 'readOnly={true}');

// Replace simple click handlers
bodyHtml = bodyHtml.replace(/onClick="([^"]+)"/g, (match, p1) => {
    return `onClick={() => { ${p1} }}`;
});

// Convert inline styles to React style objects.
bodyHtml = bodyHtml.replace(/style="([^"]+)"/g, (match, p1) => {
  const styles = p1.split(';').filter(s => s.trim().length > 0);
  const styleObj = {};
  styles.forEach(s => {
    const [key, val] = s.split(':');
    if (key && val) {
      const camelKey = key.trim().replace(/-([a-z])/g, g => g[1].toUpperCase());
      styleObj[camelKey] = val.trim();
    }
  });
  return `style={${JSON.stringify(styleObj)}}`;
});

// Remove <script> tags
bodyHtml = bodyHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '{/* Script tag removed */}');

// Remove HTML comments
bodyHtml = bodyHtml.replace(/<!--[\s\S]*?-->/g, '');

const componentCode = `import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function App() {
  const heroThreeJsRef = useRef<HTMLDivElement>(null);
  const nexusThreeJsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Basic setup for Hero 3D (to ensure it doesn't crash, simplified from raw script)
    if (heroThreeJsRef.current && !heroThreeJsRef.current.hasChildNodes()) {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, heroThreeJsRef.current.clientWidth / 450, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(heroThreeJsRef.current.clientWidth, 450);
      heroThreeJsRef.current.appendChild(renderer.domElement);
      renderer.render(scene, camera);
    }
    if (nexusThreeJsRef.current && !nexusThreeJsRef.current.hasChildNodes()) {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, nexusThreeJsRef.current.clientWidth / 520, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(nexusThreeJsRef.current.clientWidth, 520);
      nexusThreeJsRef.current.appendChild(renderer.domElement);
      renderer.render(scene, camera);
    }
  }, []);

  return (
    <div className="bg-surface text-on-surface font-body-md text-body-md antialiased cyber-grid min-h-screen selection:bg-primary-container selection:text-on-primary-container">
      ${bodyHtml.replace(/id="threejs-container-ANIMATION_7"/, 'id="threejs-container-ANIMATION_7" ref={heroThreeJsRef}').replace(/id="threejs-container-ANIMATION_6"/, 'id="threejs-container-ANIMATION_6" ref={nexusThreeJsRef}')}
    </div>
  );
}
`;

fs.writeFileSync('C:\\DILSHA\\ABHI\\flowforge\\apps\\web\\src\\App.tsx', componentCode);
console.log("Wrote App.tsx successfully.");
