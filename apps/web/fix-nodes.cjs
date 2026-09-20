const fs = require('fs');
const path = require('path');

const nodesDir = 'apps/web/src/components/nodes';
const files = ['ActionNode.tsx', 'LogicNode.tsx', 'TriggerNode.tsx', 'GhostNode.tsx'];

const replacements = [
  { from: /rounded-xl-xl-full/g, to: 'rounded-full' },
  { from: /rounded-xl-xl/g, to: 'rounded-xl' },
  { from: /bg-base-100est/g, to: 'bg-base-200' },
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

console.log('Done fixing rounded-xl bugs in nodes');

