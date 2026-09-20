const fs = require('fs');
const path = require('path');

const targetFile = 'apps/web/src/pages/Editor.tsx';
let content = fs.readFileSync(targetFile, 'utf8');

const replacements = [
  { from: /bg-\[\#18191d\]/g, to: 'bg-base-200' },
  { from: /bg-\[\#0f1013\]/g, to: 'bg-base-100' },
  { from: /bg-\[\#060709\]/g, to: 'bg-base-300' },
  { from: /bg-\[\#07080a\]/g, to: 'bg-base-200' },
];

replacements.forEach(r => {
  content = content.replace(r.from, r.to);
});

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Done cleaning up more dark colors in Editor.tsx');

