const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'web', 'src', 'app', 'knowledge.css');
let css = fs.readFileSync(cssPath, 'utf8');

css = css.replace(/font-size\s*:\s*(\d+)px/g, (match, sizeStr) => {
  let size = parseInt(sizeStr, 10);
  if (size < 12) {
    size = Math.max(12, size + 4);
  } else if (size >= 36) {
    size = Math.floor(size * 0.85); 
  } else if (size >= 12 && size < 16) {
    size = size + 2;
  }
  return `font-size:${size}px`;
});

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
console.log('Updated font sizes in knowledge.css');
