#!/usr/bin/env node
/**
 * Sample-based uniqueness measurement against Google's near-duplicate
 * detection model. Picks N random pages from a glob, computes pairwise
 * Jaccard similarity on word-bigrams of the body text, reports uniqueness
 * (= 100% * (1 - avg_jaccard)).
 *
 * Usage:
 *   node _seo-measure-uniqueness.js <glob> [sample]
 *
 * Example:
 *   node _seo-measure-uniqueness.js '*-roof-cost.html' 30
 *
 * Used to verify that template fixes don't push pages below the 80%
 * uniqueness floor.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function listGlob(pattern) {
  // Use git ls-files to enumerate root-level matches
  const out = execSync(
    `git ls-files -- ${JSON.stringify(pattern)}`,
    { cwd: ROOT, encoding: 'utf8' }
  );
  return out.split('\n').filter(Boolean).filter(p => !p.includes('/'));
}

function extractText(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function bigrams(text) {
  const words = text.split(' ').filter(w => w.length > 1);
  const out = new Set();
  for (let i = 0; i < words.length - 1; i++) {
    out.add(words[i] + ' ' + words[i + 1]);
  }
  return out;
}

function jaccard(a, b) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function sample(arr, n) {
  const out = [];
  const used = new Set();
  while (out.length < n && used.size < arr.length) {
    const i = Math.floor(Math.random() * arr.length);
    if (!used.has(i)) { used.add(i); out.push(arr[i]); }
  }
  return out;
}

function main() {
  const pattern = process.argv[2];
  const N = parseInt(process.argv[3] || '30', 10);
  if (!pattern) {
    console.error('Usage: node _seo-measure-uniqueness.js <glob> [sample]');
    process.exit(1);
  }
  const files = listGlob(pattern);
  if (files.length < 2) {
    console.error(`Only ${files.length} files match pattern; need >=2`);
    process.exit(1);
  }
  const picked = sample(files, Math.min(N, files.length));
  console.log(`Pattern: ${pattern}  total=${files.length}  sample=${picked.length}`);

  const grams = picked.map(f => bigrams(extractText(path.join(ROOT, f))));

  let sum = 0, pairs = 0, max = 0, min = 1;
  for (let i = 0; i < grams.length; i++) {
    for (let j = i + 1; j < grams.length; j++) {
      const s = jaccard(grams[i], grams[j]);
      sum += s; pairs++;
      if (s > max) max = s;
      if (s < min) min = s;
    }
  }
  const avgJac = sum / pairs;
  const uniqPct = 100 * (1 - avgJac);
  console.log(`pairs=${pairs}  avg_jaccard=${avgJac.toFixed(4)}  max_jac=${max.toFixed(4)}  min_jac=${min.toFixed(4)}`);
  console.log(`Uniqueness: ${uniqPct.toFixed(2)}%`);
  console.log(`Threshold:  80.00%  ${uniqPct >= 80 ? 'PASS' : 'FAIL'}`);
}

main();
