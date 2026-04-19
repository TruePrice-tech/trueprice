const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const pattern = '-plumbing-cost.html';
const files = fs.readdirSync(ROOT).filter(f => f.endsWith(pattern) && !f.includes('cost-guide'));
const step = Math.floor(files.length / 10);
const sample = [];
for (let i = 0; i < 10; i++) sample.push(files[i * step]);

function extractBody(html) {
  const bodyStart = html.indexOf('<body');
  const bodyEnd = html.indexOf('</body>');
  if (bodyStart < 0 || bodyEnd < 0) return html;
  return html.slice(bodyStart, bodyEnd);
}

function extractText(html) {
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function normalize(s, cityName) {
  let n = s.toLowerCase();
  n = n.replace(new RegExp(cityName.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), 'CITY');
  n = n.replace(/\$[\d,.]+[km]?/gi, 'DOLLAR');
  n = n.replace(/\d+(\.\d+)?%/g, 'PCT');
  n = n.replace(/\b\d[\d,.]*\b/g, 'NUM');
  return n.trim();
}

const allHashes = {};
const pages = sample.map(f => {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const text = extractText(extractBody(html));
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.length > 20);
  const prefix = f.replace(pattern, '');
  const parts = prefix.split('-');
  const stateCode = parts.pop().toUpperCase();
  const cityName = parts.map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
  const hashes = sentences.map(s => {
    const n = normalize(s, cityName);
    return crypto.createHash('md5').update(n).digest('hex').slice(0, 12);
  });
  hashes.forEach(h => { allHashes[h] = (allHashes[h] || 0) + 1; });
  return { f, sentences, hashes, cityName };
});

const boilerplate = new Set(Object.entries(allHashes).filter(([, c]) => c >= 5).map(([h]) => h));
console.log('Boilerplate sentences (appear in 5+/10 pages):');
console.log('Total boilerplate hashes:', boilerplate.size);
console.log('');

const p0 = pages[0];
let bpCount = 0;
for (let i = 0; i < p0.hashes.length; i++) {
  if (boilerplate.has(p0.hashes[i])) {
    bpCount++;
    console.log('  BP: ' + p0.sentences[i].slice(0, 140));
  }
}
console.log('');
console.log('Total sentences on page 0 (' + p0.f + '):', p0.sentences.length);
console.log('Boilerplate on page 0:', bpCount);
console.log('Template ratio: ' + Math.round((1 - bpCount / p0.sentences.length) * 100) + '%');
