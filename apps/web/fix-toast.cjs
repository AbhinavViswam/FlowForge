const fs = require('fs');
const path = require('path');

const cssPath = 'apps/web/src/index.css';
let css = fs.readFileSync(cssPath, 'utf8');

const overrides = `
/* av-toastx DaisyUI Overrides */
html, html[data-theme="light"], html[data-theme="dark"] {
  --toast-border: 1px solid oklch(var(--b3));
  --toast-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);

  /* Success */
  --success-bg: oklch(var(--b1));
  --success-accent: oklch(var(--su));
  --success-text: oklch(var(--bc));
  --success-sub: oklch(var(--bc) / 0.7);
  --success-border: oklch(var(--su) / 0.3);
  --success-glow: transparent;

  /* Error */
  --error-bg: oklch(var(--b1));
  --error-accent: oklch(var(--er));
  --error-text: oklch(var(--bc));
  --error-sub: oklch(var(--bc) / 0.7);
  --error-border: oklch(var(--er) / 0.3);
  --error-glow: transparent;

  /* Info */
  --info-bg: oklch(var(--b1));
  --info-accent: oklch(var(--in));
  --info-text: oklch(var(--bc));
  --info-sub: oklch(var(--bc) / 0.7);
  --info-border: oklch(var(--in) / 0.3);
  --info-glow: transparent;

  /* Default */
  --default-bg: oklch(var(--b1));
  --default-accent: oklch(var(--bc));
  --default-text: oklch(var(--bc));
  --default-sub: oklch(var(--bc) / 0.7);
  --default-border: oklch(var(--b3));
  --default-glow: transparent;
}
`;

if (!css.includes('av-toastx DaisyUI Overrides')) {
  fs.writeFileSync(cssPath, css + '\n' + overrides, 'utf8');
  console.log('Appended toast overrides');
} else {
  console.log('Overrides already exist');
}

