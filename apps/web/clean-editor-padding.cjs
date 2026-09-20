const fs = require('fs');
const path = require('path');

const targetFile = 'apps/web/src/pages/Editor.tsx';
let content = fs.readFileSync(targetFile, 'utf8');

const replacements = [
  { from: /p-space-sm/g, to: 'p-4' },
  { from: /p-space-xs/g, to: 'p-2' },
  { from: /p-space-md/g, to: 'p-6' },
  { from: /gap-space-xs/g, to: 'gap-2' },
  { from: /gap-space-sm/g, to: 'gap-4' },
  { from: /gap-space-md/g, to: 'gap-6' },
  { from: /pb-space-xs/g, to: 'pb-2' },
  { from: /pt-space-xs/g, to: 'pt-2' },
  { from: /mb-space-xs/g, to: 'mb-2' },
  { from: /mt-space-xs/g, to: 'mt-2' },
];

replacements.forEach(r => {
  content = content.replace(r.from, r.to);
});

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Done refactoring Editor padding');

