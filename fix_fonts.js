const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'web', 'src', 'app', 'case-management.css');
let css = fs.readFileSync(cssPath, 'utf8');

// A function to adjust font sizes:
// - If < 11px, change to 12px or 13px (minimum readable size).
// - If >= 36px, scale down a bit (e.g., 40px -> 32px).
css = css.replace(/font-size\s*:\s*(\d+)px/g, (match, sizeStr) => {
  let size = parseInt(sizeStr, 10);
  if (size < 12) {
    size = Math.max(12, size + 4); // 7px -> 12px, 8px -> 12px, 9px -> 13px, 10px -> 14px, 11px -> 15px
  } else if (size >= 36) {
    size = Math.floor(size * 0.85); // 40px -> 34px, 36px -> 30px
  } else if (size >= 12 && size < 16) {
    size = size + 2; // bump standard body texts up a bit
  }
  return `font-size:${size}px`;
});

// Also fix `font: ...` shorthands that specify font size, e.g., `font: 700 9px`
css = css.replace(/font:\s*(\d+)?\s*(\d+)px/g, (match, weight, sizeStr) => {
  let size = parseInt(sizeStr, 10);
  if (size < 12) {
    size = Math.max(12, size + 4);
  } else if (size >= 12 && size < 16) {
    size = size + 2;
  }
  return weight ? `font:${weight} ${size}px` : `font:${size}px`;
});

fs.writeFileSync(cssPath, css, 'utf8');
console.log('Updated font sizes in case-management.css');
