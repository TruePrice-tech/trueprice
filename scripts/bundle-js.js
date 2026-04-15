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

// Just concatenate. esbuild handles real minification downstream, and
// the old regex-based // stripping mangled https:// URLs inside strings.
const outPath = path.join(ROOT, 'js', 'analyzer-bundle.js');
fs.writeFileSync(outPath, bundle.trim(), 'utf8');

const originalSize = files.reduce((sum, f) => sum + fs.statSync(path.join(ROOT, f)).size, 0);
const bundleSize = fs.statSync(outPath).size;

console.log('Bundle created: js/analyzer-bundle.js');
console.log('Original: ' + (originalSize / 1024).toFixed(0) + 'KB (' + files.length + ' files)');
console.log('Bundle: ' + (bundleSize / 1024).toFixed(0) + 'KB (1 file)');
console.log('Note: For full minification, use terser or uglify-js');
