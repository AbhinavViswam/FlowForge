const fs = require('fs');
const path = require('path');

const targetFile = 'apps/web/src/pages/Editor.tsx';
let content = fs.readFileSync(targetFile, 'utf8');

const replacements = [
  { from: /bg-\[\#111215\]/g, to: 'bg-base-200' }, // Sidebar bg
  { from: /bg-\[\#15161a\]/g, to: 'bg-base-300' }, // Sidebar header/footer
  { from: /bg-\[\#0e0f12\]/g, to: 'bg-base-300' }, // Tabs bg
  { from: /bg-\[\#090a0c\]/g, to: 'bg-base-100' }, // Input bg
  { from: /bg-\[\#131417\]/g, to: 'bg-base-200' }, // Code blocks
  { from: /border-\[\#ffffff14\]/g, to: 'border-base-300' },
  { from: /bg-obsidian/g, to: 'bg-base-100' },
  { from: /border-white\/\[0\.08\]/g, to: 'border-base-300' },
  { from: /border-white\/10/g, to: 'border-base-300' },
  { from: /bg-\[\#0c0d10\]/g, to: 'bg-base-200' },
  { from: /text-slate-400/g, to: 'text-base-content/70' },
  { from: /text-slate-300/g, to: 'text-base-content/80' },
];

replacements.forEach(r => {
  content = content.replace(r.from, r.to);
});

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Done refactoring Editor.tsx colors');
