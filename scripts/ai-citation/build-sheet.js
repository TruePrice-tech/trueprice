#!/usr/bin/env node
/**
 * Generate the manual scoring sheet for the AI-citation test, and score a filled one.
 *
 *   node scripts/ai-citation/build-sheet.js                  # write the blank sheet
 *   node scripts/ai-citation/build-sheet.js --score <sheet>  # summarize a filled sheet
 *
 * No network calls, no API keys. The test is deliberately manual: answer engines
 * personalize and rate-limit, and the cited-domains column needs a human read.
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', '..', 'data', 'ai-citation-baseline');
const SRC = path.join(DIR, 'queries-2026-07-31.json');
const ENGINES = [['chatgpt', 'ChatGPT'], ['perplexity', 'Perplexity'], ['google_aio', 'Google AIO']];

function buildSheet() {
  const spec = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const byStratum = new Map();
  for (const q of spec.queries) {
    if (!byStratum.has(q.stratum)) byStratum.set(q.stratum, []);
    byStratum.get(q.stratum).push(q);
  }

  const out = [];
  out.push(`# AI citation baseline — ${spec.baselineDate}`);
  out.push('');
  out.push('Logged-out / incognito. Do not click a woogoro result before recording it.');
  out.push('');
  out.push('Columns: **AI?** did an AI answer appear (y/n) · **Cited?** was woogoro.com cited (y/n) ·');
  out.push('**Cited domains** top 3 sources the answer actually cited · **$?** did it give a specific dollar figure (y/n)');
  out.push('');
  out.push(`Priority if short on time: ${spec.priorityIfTimeShort.join(' → ')}`);
  out.push('');

  for (const [stratum, queries] of byStratum) {
    out.push(`## ${stratum}`);
    out.push('');
    out.push(`_${spec.strata[stratum]}_`);
    out.push('');
    for (const q of queries) {
      out.push(`### ${q.id}. ${q.phrase}`);
      out.push('');
      out.push('| Engine | AI? | Cited? | Cited domains | $? |');
      out.push('|---|---|---|---|---|');
      for (const [, label] of ENGINES) out.push(`| ${label} |  |  |  |  |`);
      out.push('');
    }
  }

  out.push('## Interpretation (fill the sheet first, then read)');
  out.push('');
  for (const [k, v] of Object.entries(spec.interpretation)) out.push(`- **${k}**: ${v}`);
  out.push('');

  const dest = path.join(DIR, `sheet-${spec.baselineDate}.md`);
  fs.writeFileSync(dest, out.join('\n'), 'utf8');
  console.log(`wrote ${dest}`);
  console.log(`${spec.queries.length} queries x ${ENGINES.length} engines = ${spec.queries.length * ENGINES.length} checks`);
}

function scoreSheet(file) {
  const spec = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const stratumOf = new Map(spec.queries.map((q) => [q.id, q.stratum]));
  const lines = fs.readFileSync(file, 'utf8').split('\n');

  const tally = {};
  const domains = new Map();
  let id = null;

  for (const line of lines) {
    const h = line.match(/^###\s+(\d+)\./);
    if (h) { id = Number(h[1]); continue; }
    const row = line.match(/^\|\s*(ChatGPT|Perplexity|Google AIO)\s*\|(.*)\|\s*$/);
    if (!row || id === null) continue;

    const cells = row[2].split('|').map((c) => c.trim());
    const [ai, cited, citedDomains, dollar] = cells;
    if (!ai) continue; // unfilled row

    const stratum = stratumOf.get(id) || 'unknown';
    const engine = row[1];
    const key = `${stratum}|${engine}`;
    tally[key] = tally[key] || { checked: 0, aiAnswer: 0, cited: 0, dollar: 0 };
    tally[key].checked++;
    if (/^y/i.test(ai)) tally[key].aiAnswer++;
    if (/^y/i.test(cited)) tally[key].cited++;
    if (/^y/i.test(dollar)) tally[key].dollar++;

    for (const d of (citedDomains || '').split(/[,;]/).map((s) => s.trim().toLowerCase()).filter(Boolean)) {
      domains.set(d, (domains.get(d) || 0) + 1);
    }
  }

  const rows = Object.entries(tally);
  if (!rows.length) return console.log('No filled rows found. Fill the sheet, then re-run.');

  console.log('\nstratum / engine              checked  AI ans   cited   $ fig');
  let totC = 0, totCited = 0;
  for (const [key, v] of rows.sort()) {
    totC += v.checked; totCited += v.cited;
    console.log(`${key.padEnd(30)} ${String(v.checked).padStart(5)} ${String(v.aiAnswer).padStart(7)} ${String(v.cited).padStart(7)} ${String(v.dollar).padStart(7)}`);
  }
  console.log(`\nwoogoro cited in ${totCited} of ${totC} filled checks (${(100 * totCited / totC).toFixed(1)}%)`);

  const top = [...domains.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  if (top.length) {
    console.log('\nWho owns the citation slot:');
    for (const [d, n] of top) console.log(`  ${String(n).padStart(3)}  ${d}`);
  }
}

const scoreIdx = process.argv.indexOf('--score');
if (scoreIdx !== -1) scoreSheet(process.argv[scoreIdx + 1]);
else buildSheet();
