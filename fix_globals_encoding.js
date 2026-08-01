const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'web', 'src', 'app', 'globals.css');
let css = fs.readFileSync(cssPath, 'utf8');

// Strip weird encoding parts (after line 23)
const lines = css.split('\n');
const cleanLines = lines.slice(0, 23);

const a11yCss = `
/* A11y Settings */
body.font-large { font-size: 110%; }
body.font-xlarge { font-size: 125%; }
body.theme-high-contrast {
  --ink: #000;
  --muted: #000;
  --paper: #fff;
  --teal: #0000ee;
  --teal-dark: #000088;
  --mint: #fff;
  --gold: #aa5500;
  --line: #000;
  --glass-bg: #fff;
  --glass-border: #000;
}
body.theme-dark {
  --ink: #f8fafc;
  --muted: #94a3b8;
  --paper: #0f172a;
  --white: #1e293b;
  --teal: #38bdf8;
  --teal-dark: #7dd3fc;
  --mint: #1e293b;
  --gold: #fbbf24;
  --line: #334155;
  --glass-bg: rgba(15, 23, 42, 0.8);
  --glass-border: rgba(148, 163, 184, 0.2);
}
body.theme-dark .hero { background: var(--paper); }
body.theme-dark .hero h1, body.theme-dark .empty h3 { color: var(--ink); }
`;

cleanLines.push(a11yCss);
fs.writeFileSync(cssPath, cleanLines.join('\n'));
console.log('Fixed globals.css encoding issues.');
