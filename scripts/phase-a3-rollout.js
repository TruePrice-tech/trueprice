#!/usr/bin/env node
// Phase A.3 — full rollout driver across remaining trade verticals.
//
// For each vertical: inject haversine neighbors → audit NF/FS → halt if
// either composite drops >2pt below baseline or below 80% floor → otherwise
// commit (one commit per vertical).
//
// Skips hvac (already shipped this session at 500/667).
//
// Usage: node scripts/phase-a3-rollout.js [--dry-run] [--verticals=concrete,roof]

const { execSync, spawnSync } = require('child_process');

// Baselines captured from `node scripts/audit-uniqueness-google.js` run
// at start of this Phase A.3 work (commit a3936e71f1e and earlier).
// HARD GATES: NF/FS must remain ≥80% AND must not drop more than 2pt below baseline.
const BASELINES = {
  roof:        { nf: 83, fs: 89 },
  plumbing:    { nf: 91, fs: 91 },
  electrical:  { nf: 92, fs: 90 },
  solar:       { nf: 84, fs: 88 },
  window:      { nf: 90, fs: 88 },
  siding:      { nf: 91, fs: 89 },
  painting:    { nf: 89, fs: 89 },
  'garage-door': { nf: 90, fs: 85 },
  fence:       { nf: 88, fs: 89 },
  concrete:    { nf: 92, fs: 88 },
  landscaping: { nf: 88, fs: 87 },
  foundation:  { nf: 90, fs: 90 },
  insulation:  { nf: 92, fs: 87 },
  gutter:      { nf: 89, fs: 88 },
};

const FLOOR = 80;
const MAX_DROP = 2;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const onlyArg = args.find(a => a.startsWith('--verticals='));
const ALL_VERTS = Object.keys(BASELINES);
const targets = onlyArg
  ? onlyArg.slice('--verticals='.length).split(',').map(s => s.trim()).filter(Boolean)
  : ALL_VERTS;

for (const v of targets) {
  if (!BASELINES[v]) {
    console.error(`unknown vertical: ${v}`);
    process.exit(2);
  }
}

function run(cmd, opts = {}) {
  console.log(`\n$ ${cmd}`);
  const r = spawnSync(cmd, { shell: true, encoding: 'utf8', stdio: ['inherit', 'pipe', 'pipe'], ...opts });
  process.stdout.write(r.stdout || '');
  process.stderr.write(r.stderr || '');
  if (r.status !== 0) {
    throw new Error(`command failed: ${cmd} (exit ${r.status})`);
  }
  return r.stdout || '';
}

function parseAuditFor(vertical, output) {
  // Match a row like:
  //   hvac             |    750 |   1310 |      85% |      91% |    100% |    84% |       90% | GOOD
  // The composite (NF or FS) is the 8th numeric column (with %).
  const lines = output.split(/\r?\n/);
  const found = { nf: null, fs: null };
  let section = null; // 'nf' or 'fs'
  for (const line of lines) {
    if (line.includes('NON-FLAGSHIP CITY PAGES')) section = 'nf';
    else if (line.includes('FLAGSHIP CITY PAGES')) section = 'fs';
    if (!section) continue;
    // Match the first column being our vertical (with possible padding)
    const m = line.match(/^([\w-]+)\s*\|.*\|\s*(\d+)%\s*\|\s*(?:GOOD|OK|THIN|RISK)/);
    if (m && m[1] === vertical) {
      const composite = parseInt(m[2], 10);
      if (section === 'nf' && found.nf === null) found.nf = composite;
      else if (section === 'fs' && found.fs === null) found.fs = composite;
    }
  }
  return found;
}

function gateCheck(vertical, postNF, postFS) {
  const base = BASELINES[vertical];
  const reasons = [];
  if (postNF === null) reasons.push('NF audit unparseable');
  if (postFS === null) reasons.push('FS audit unparseable');
  if (postNF !== null && postNF < FLOOR) reasons.push(`NF ${postNF}% < floor ${FLOOR}%`);
  if (postFS !== null && postFS < FLOOR) reasons.push(`FS ${postFS}% < floor ${FLOOR}%`);
  if (postNF !== null && (base.nf - postNF) > MAX_DROP) reasons.push(`NF dropped ${base.nf - postNF}pt (>${MAX_DROP}pt) from baseline ${base.nf}%`);
  if (postFS !== null && (base.fs - postFS) > MAX_DROP) reasons.push(`FS dropped ${base.fs - postFS}pt (>${MAX_DROP}pt) from baseline ${base.fs}%`);
  return reasons;
}

function processVertical(v) {
  console.log(`\n========== ${v.toUpperCase()} ==========`);
  const base = BASELINES[v];
  console.log(`baseline NF=${base.nf}% FS=${base.fs}%`);

  // 1. Inject
  run(`node scripts/phase-a3-inject-neighbors.js --vertical=${v}`);

  // 2. Audit
  const audit = run(`node scripts/audit-uniqueness-google.js ${v}`);
  const post = parseAuditFor(v, audit);
  console.log(`post-inject  NF=${post.nf}% FS=${post.fs}%`);

  // 3. Gate check
  const reasons = gateCheck(v, post.nf, post.fs);
  if (reasons.length) {
    console.error(`\nHALT — ${v} failed gate:`);
    for (const r of reasons) console.error(`  - ${r}`);
    console.error(`\nReverting changes to ${v} files...`);
    run(`git checkout -- "*-${v}-cost.html"`);
    process.exit(1);
  }
  console.log(`gate PASSED for ${v}`);

  // 4. Commit
  if (dryRun) {
    console.log(`(dry-run) would commit ${v}`);
    return;
  }
  // Count modified files
  // Use grep instead of glob arg — Windows cmd doesn't expand *-X-cost.html in `git status` args.
  const status = execSync(`git status -s | grep -- "-${v}-cost.html$" || true`, { encoding: 'utf8' });
  const modified = status.split('\n').filter(l => l.startsWith(' M ') || l.startsWith('M ')).length;
  if (modified === 0) {
    console.log(`(no file changes for ${v} — likely all already injected; skipping commit)`);
    return;
  }
  run(`git add "*-${v}-cost.html"`);
  const drop = (base.nf - post.nf) + (base.fs - post.fs);
  const dropNote = drop === 0 ? 'unchanged from baseline'
                              : `${drop > 0 ? '-' : '+'}${Math.abs(drop)}pt total movement`;
  const msg = `phase-a.3 ${v}: full vertical rollout (haversine neighbor swap on ${modified} city pages)\n\nAudit: NF ${base.nf}% -> ${post.nf}% / FS ${base.fs}% -> ${post.fs}% (${dropNote}). Gate passed.\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`;
  run(`git commit -m ${JSON.stringify(msg)}`);
}

console.log(`Phase A.3 rollout: ${targets.length} verticals (${dryRun ? 'DRY-RUN' : 'LIVE'})`);
for (const v of targets) {
  processVertical(v);
}
console.log('\n\nALL VERTICALS COMPLETE. Push when ready.');
