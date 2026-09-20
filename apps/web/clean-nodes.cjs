const fs = require('fs');
const path = require('path');

const nodesDir = 'apps/web/src/components/nodes';
const files = ['ActionNode.tsx', 'LogicNode.tsx', 'TriggerNode.tsx', 'GhostNode.tsx'];

const replacements = [
  { from: /bg-surface-container-low/g, to: 'bg-base-100' },
  { from: /bg-surface-container-highest/g, to: 'bg-base-200' },
  { from: /border-surface-container-highest/g, to: 'border-base-300' },
  { from: /text-on-surface-variant/g, to: 'text-base-content/70' },
  { from: /text-on-surface/g, to: 'text-base-content' },
  { from: /p-space-sm/g, to: 'p-4' },
  { from: /pb-space-xs/g, to: 'pb-3' },
  { from: /pt-space-xs/g, to: 'pt-3' },
  { from: /p-space-xs/g, to: 'p-3' },
  { from: /text-label-sm font-label-sm/g, to: 'text-sm font-semibold' },
  { from: /text-code-snippet font-code-snippet/g, to: 'font-mono' },
  { from: /rounded/g, to: 'rounded-xl' }, // Note: may match rounded-full etc, but we'll use a safer regex for exact "rounded"
];

files.forEach(file => {
  const filePath = path.join(nodesDir, file);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Safe exact "rounded" to "rounded-xl"
  content = content.replace(/\brounded\b/g, 'rounded-xl');
  
  replacements.forEach(r => {
    content = content.replace(r.from, r.to);
  });
  
  // Ensure the card has solid styling
  content = content.replace(/className={`w-52/g, "className={`w-64"); // wider
  content = content.replace(/shadow-lg/g, "shadow-xl hover:shadow-2xl");

  fs.writeFileSync(filePath, content, 'utf8');
});

console.log('Done refactoring nodes');

