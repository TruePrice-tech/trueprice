const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const files = [
  'js/analyzer-core.js',
  'js/analyzer-parser.js',
  'js/analyzer-scope.js',
  'js/analyzer-ocr.js',
  'js/analyzer-ui.js'
];

let bundle = '';
files.forEach(f => {
  const content = fs.readFileSync(path.join(ROOT, f), 'utf8');
  bundle += '\n// === ' + f + ' ===\n' + content;
});

// Basic minification: remove comments, collapse whitespace
const minified = bundle
  .replace(/\/\/[^\n]*\n/g, '\n')  // Remove single-line comments
  .replace(/\n\s*\n/g, '\n')       // Collapse blank lines
  .trim();

const outPath = path.join(ROOT, 'js', 'analyzer-bundle.js');
fs.writeFileSync(outPath, minified, 'utf8');

const originalSize = files.reduce((sum, f) => sum + fs.statSync(path.join(ROOT, f)).size, 0);
const bundleSize = fs.statSync(outPath).size;

console.log('Bundle created: js/analyzer-bundle.js');
console.log('Original: ' + (originalSize / 1024).toFixed(0) + 'KB (' + files.length + ' files)');
console.log('Bundle: ' + (bundleSize / 1024).toFixed(0) + 'KB (1 file)');
console.log('Note: For full minification, use terser or uglify-js');
