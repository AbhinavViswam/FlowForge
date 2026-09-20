const fs = require('fs');
const path = require('path');

const nodesDir = 'apps/web/src/components/nodes';
const files = ['ActionNode.tsx', 'LogicNode.tsx', 'TriggerNode.tsx', 'GhostNode.tsx'];

const replacements = [
  { from: /shadow-\[0_0_15px_rgba\(244,63,94,0\.4\)\]/g, to: 'shadow-lg shadow-rose-500/20' },
  { from: /shadow-\[0_0_15px_rgba\(16,185,129,0\.35\)\]/g, to: 'shadow-lg shadow-emerald-500/20' },
  { from: /shadow-\[0_0_16px_rgba\(225,29,72,0\.25\)\]/g, to: 'shadow-xl shadow-primary/20' },
  { from: /shadow-\[0_0_15px_rgba\(225,29,72,0\.4\)\]/g, to: 'shadow-xl shadow-primary/30' },
  { from: /border-primary-container/g, to: 'border-primary' },
  { from: /text-primary-container/g, to: 'text-primary' },
  { from: /ring-primary-container/g, to: 'ring-primary' },
  { from: /!border-primary-container/g, to: '!border-primary' },
];

files.forEach(file => {
  const filePath = path.join(nodesDir, file);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  replacements.forEach(r => {
    content = content.replace(r.from, r.to);
  });

  fs.writeFileSync(filePath, content, 'utf8');
});

console.log('Done fixing node glows');

