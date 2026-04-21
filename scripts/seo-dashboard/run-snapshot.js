#!/usr/bin/env node
/**
 * Orchestrator: run all SEO collectors and write a single snapshot JSON
 * the dashboard reads. Designed to run via cron (daily) or on demand.
 *
 * Output:
 *   data/seo-snapshot.json     — current snapshot (overwritten each run)
 *   data/seo-history/<date>.json — per-day history (kept for trend graphs)
 *
 * Each collector is wrapped in try/catch — one failing collector doesn't
 * kill the run.
 *
 * Usage:
 *   node scripts/seo-dashboard/run-snapshot.js
 *   node scripts/seo-dashboard/run-snapshot.js --skip=lighthouse,bwt
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SNAPSHOT_PATH = path.join(ROOT, 'data', 'seo-snapshot.json');
const HISTORY_DIR = path.join(ROOT, 'data', 'seo-history');

const { collect: collectUniqueness } = require('./collect-uniqueness');
const { collect: collectSchemas } = require('./collect-schemas');
const { collect: collectLighthouse } = require('./collect-lighthouse');
const { collect: collectIndexation } = require('./collect-indexation');
const { collect: collectBwt } = require('./collect-bwt');

const args = process.argv.slice(2);
const skipArg = args.find(a => a.startsWith('--skip='));
const skips = new Set(skipArg ? skipArg.split('=')[1].split(',') : []);

function shouldRun(name) { return !skips.has(name); }

async function withTimeout(promise, ms, label) {
  return new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => {
      if (done) return;
      done = true;
      resolve({ error: `timeout after ${ms}ms`, label });
    }, ms);
    promise.then(v => { if (!done) { done = true; clearTimeout(t); resolve(v); } })
      .catch(e => { if (!done) { done = true; clearTimeout(t); resolve({ error: e.message, label }); } });
  });
}

(async () => {
  console.log('Collecting SEO snapshot...\n');
  const snapshot = { scoredAt: new Date().toISOString(), collectors: {} };

  const collectors = [
    { name: 'schemas',    label: 'JSON-LD schema validation', sync: true,  fn: collectSchemas },
    { name: 'indexation', label: 'Bing/DDG indexation count', sync: false, fn: collectIndexation, timeout: 30000 },
    { name: 'bwt',        label: 'Bing Webmaster Tools API',  sync: false, fn: collectBwt,        timeout: 60000 },
    { name: 'uniqueness', label: 'Uniqueness audit',          sync: true,  fn: collectUniqueness, timeout: 600000 },
    { name: 'lighthouse', label: 'Core Web Vitals lab data',  sync: false, fn: collectLighthouse, timeout: 300000 },
  ];

  for (const c of collectors) {
    if (!shouldRun(c.name)) {
      console.log(`  ${c.name.padEnd(12)} SKIPPED`);
      snapshot.collectors[c.name] = { skipped: true };
      continue;
    }
    process.stdout.write(`  ${c.name.padEnd(12)} `);
    const start = Date.now();
    let data;
    try {
      if (c.sync) {
        data = c.fn();
      } else {
        data = await withTimeout(c.fn(), c.timeout || 60000, c.name);
      }
      snapshot.collectors[c.name] = data;
      const ms = Date.now() - start;
      const note = data?.error ? `ERROR: ${data.error.slice(0, 80)}` : `OK (${ms}ms)`;
      console.log(note);
    } catch (e) {
      snapshot.collectors[c.name] = { error: e.message };
      console.log(`FAIL: ${e.message}`);
    }
  }

  // Write current snapshot
  if (!fs.existsSync(path.dirname(SNAPSHOT_PATH))) {
    fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
  }
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2), 'utf8');

  // Write to history (one per day, overwrite same-day runs)
  if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true });
  const day = snapshot.scoredAt.slice(0, 10);
  fs.writeFileSync(path.join(HISTORY_DIR, day + '.json'), JSON.stringify(snapshot, null, 2), 'utf8');

  console.log(`\nSnapshot written: ${SNAPSHOT_PATH}`);
  console.log(`History: ${path.join(HISTORY_DIR, day + '.json')}`);
})();
