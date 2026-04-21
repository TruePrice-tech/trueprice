#!/usr/bin/env node
/**
 * Run audit-uniqueness-google.js and parse its output into structured data
 * for the SEO dashboard. Captures per-vertical composite scores plus the
 * four sub-scores (template / semantic / info density / structural).
 *
 * Returns: { scoredAt, verticals: [{ vertical, pages, words, template,
 *   semantic, infoDensity, structural, composite, grade }] }
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');

function gradeFromComposite(c) {
  if (c >= 70) return 'GOOD';
  if (c >= 50) return 'OK';
  if (c >= 35) return 'THIN';
  return 'RISK';
}

function parseAuditOutput(stdout) {
  // The audit script prints rows like:
  // hvac             |    699 |   1465 |      86% |      88% |    100% |    87% |       90% | GOOD
  const rows = [];
  const lineRe = /^(\S[\S-]*)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)%\s*\|\s*(\d+)%\s*\|\s*(\d+)%\s*\|\s*(\d+)%\s*\|\s*(\d+)%\s*\|\s*(\w+)/;
  for (const line of stdout.split('\n')) {
    const m = line.match(lineRe);
    if (!m) continue;
    rows.push({
      vertical: m[1],
      pages: parseInt(m[2], 10),
      words: parseInt(m[3], 10),
      template: parseInt(m[4], 10),
      semantic: parseInt(m[5], 10),
      infoDensity: parseInt(m[6], 10),
      structural: parseInt(m[7], 10),
      composite: parseInt(m[8], 10),
      grade: m[9],
    });
  }
  return rows;
}

function collect() {
  const result = { scoredAt: new Date().toISOString(), verticals: [], errors: [] };

  // List all verticals from the audit script's VERTICALS list. We could parse
  // that, but it's simpler to call the audit once with each vertical name.
  const VERTICALS = [
    'hvac', 'roof', 'plumbing', 'electrical', 'solar', 'kitchen', 'window',
    'siding', 'painting', 'garage-door', 'fence', 'concrete', 'landscaping',
    'foundation', 'insulation', 'gutter', 'auto-repair', 'medical', 'legal', 'moving',
  ];

  for (const v of VERTICALS) {
    try {
      const stdout = execSync(`node scripts/audit-uniqueness-google.js ${v}`, {
        cwd: ROOT, encoding: 'utf8', timeout: 60000,
      });
      const rows = parseAuditOutput(stdout);
      if (rows.length === 0) {
        result.errors.push({ vertical: v, error: 'no rows parsed' });
        continue;
      }
      // Audit prints two rows per vertical (non-flagship + flagship). Average them.
      const ws = rows.filter(r => r.vertical === v);
      if (ws.length === 0) continue;
      const avg = (key) => Math.round(ws.reduce((a, r) => a + r[key], 0) / ws.length);
      result.verticals.push({
        vertical: v,
        pages: ws.reduce((a, r) => a + r.pages, 0),
        words: avg('words'),
        template: avg('template'),
        semantic: avg('semantic'),
        infoDensity: avg('infoDensity'),
        structural: avg('structural'),
        composite: avg('composite'),
        grade: gradeFromComposite(avg('composite')),
      });
    } catch (e) {
      result.errors.push({ vertical: v, error: e.message.slice(0, 200) });
    }
  }

  return result;
}

if (require.main === module) {
  const out = collect();
  console.log(JSON.stringify(out, null, 2));
}

module.exports = { collect };
