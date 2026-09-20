const fs = require('fs');
const path = require('path');

const targetFile = 'apps/web/src/pages/Editor.tsx';
let content = fs.readFileSync(targetFile, 'utf8');

const replacements = [
  { from: /bg-background/g, to: 'bg-base-200' },
  { from: /<Background color="\#ffffff" gap=\{24\} size=\{1\} \/>/g, to: '<Background color="#9ca3af" gap={32} size={1} />' },
  { from: /style=\{\{ stroke: '\#e11d48', strokeWidth: 2 \}\}/g, to: "style: { stroke: '#3b82f6', strokeWidth: 3 }" }, // make edges look nicer (blue)
  { from: /bg-surface-container/g, to: 'bg-base-200' },
  { from: /text-on-surface/g, to: 'text-base-content' },
];

replacements.forEach(r => {
  content = content.replace(r.from, r.to);
});

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Done cleaning up Editor.tsx layout background');

