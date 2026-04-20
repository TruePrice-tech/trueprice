#!/usr/bin/env node
/**
 * Cluster semantically-similar queries and classify intent.
 *
 * Clustering: tokens are normalized (lowercased, stopwords removed, numbers
 * bucketed) and two queries end up in the same cluster if their token sets
 * Jaccard-overlap ≥ 0.67. Each cluster gets a canonical query (the highest-
 * priority member) plus a list of variants used as H2/H3/FAQ material.
 *
 * Intent classification is rule-based on token presence:
 *   transactional  — analyzer/quote/estimate/calculator tokens present
 *   commercial     — cost/price/how much/average/per sq ft (buyer research)
 *   informational  — what/why/when/how to (no buy tokens) — descriptive
 *
 * Output:
 *   scripts/keyword-research/output/clusters.json
 *   scripts/keyword-research/output/clusters.csv
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'output');
const IN_FILE = path.join(OUT_DIR, 'keywords-filtered.json');
const OUT_JSON = path.join(OUT_DIR, 'clusters.json');
const OUT_CSV = path.join(OUT_DIR, 'clusters.csv');

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
  'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'from',
  'how', 'much', 'what', 'why', 'when', 'where', 'which', 'who',
  'does', 'do', 'did', 'and', 'or', 'but', 'not', 'no',
  'i', 'my', 'me', 'you', 'your', 'it', 'its',
  'this', 'that', 'these', 'those',
  'has', 'have', 'had',
  'should', 'would', 'could', 'can', 'will', 'may', 'might',
  'new',  // ultra-common, not distinguishing
]);

function tokenize(q) {
  return q.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 0 && !STOPWORDS.has(t));
}

function jaccard(a, b) {
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

const THRESHOLD = 0.67;

function classifyIntent(q) {
  const qn = q.toLowerCase();
  if (/\b(analyzer|quote|estimate|calculator|tool|check)\b/.test(qn)) return 'transactional';
  if (/\b(cost|price|fee|rate|how much|average|per square foot|per sq ft|per linear foot|per ton)\b/.test(qn)) return 'commercial';
  if (/\b(how to|why|when|what|best time|should i|vs|versus|compare)\b/.test(qn)) return 'informational';
  return 'commercial'; // default: cost/price queries where tokens aren't obvious
}

function pickTemplate(intent, query) {
  const qn = query.toLowerCase();
  if (intent === 'transactional') return 'transactional';
  if (qn.includes(' vs ') || qn.includes('versus') || qn.includes('compare')) return 'comparison';
  if (qn.startsWith('how to') || qn.includes('how to ') || qn.includes('guide')) return 'how-to';
  if (qn.includes('should i') || qn.includes('when to') || qn.includes('best time')) return 'decision';
  return 'table-led';  // default for cost queries
}

// --- Main ---

if (!fs.existsSync(IN_FILE)) {
  console.error('Missing', IN_FILE);
  process.exit(1);
}

const queries = JSON.parse(fs.readFileSync(IN_FILE, 'utf8'));

// Tokenize each query once
const tokenized = queries.map(q => ({ ...q, tokens: tokenize(q.normalized) }));

// Greedy clustering: iterate sorted by priority, put each query into the
// first existing cluster it's similar to, else start a new cluster.
tokenized.sort((a, b) => b.priority - a.priority);

const clusters = [];
for (const q of tokenized) {
  let placed = false;
  for (const c of clusters) {
    // Compare against cluster's canonical (first/highest-priority) query
    if (jaccard(q.tokens, c.canonical.tokens) >= THRESHOLD) {
      c.members.push(q);
      placed = true;
      break;
    }
  }
  if (!placed) {
    clusters.push({
      canonical: q,
      members: [q],
    });
  }
}

// For each cluster: pick the canonical query (by highest value among 'top' kind),
// classify intent, pick template, collect variant list.
const enriched = clusters.map(c => {
  // Sort members: 'top' kind first, then by value desc
  c.members.sort((a, b) => {
    if (a.kind === 'top' && b.kind !== 'top') return -1;
    if (b.kind === 'top' && a.kind !== 'top') return 1;
    return b.value - a.value;
  });
  const canonical = c.members[0];
  const intent = classifyIntent(canonical.query);
  const template = pickTemplate(intent, canonical.query);

  // Only gaps are interesting — if any member has an existing page, mark it.
  const anyHasPage = c.members.find(m => !m.newPageNeeded);

  return {
    canonicalQuery: canonical.query,
    vertical: canonical.vertical,
    priority: canonical.priority,
    kind: canonical.kind,
    value: canonical.value,
    intent,
    template,
    memberCount: c.members.length,
    variants: c.members.map(m => m.query),
    newPageNeeded: !anyHasPage,
    existingPage: anyHasPage?.existingPage || null,
  };
});

enriched.sort((a, b) => b.priority - a.priority);

fs.writeFileSync(OUT_JSON, JSON.stringify(enriched, null, 2), 'utf8');

const csvHeader = 'priority,canonicalQuery,vertical,intent,template,memberCount,newPageNeeded,existingPage,variants\n';
const csvRows = enriched.map(c => {
  const q = c.canonicalQuery.replace(/"/g, '""');
  const vars = c.variants.join(' | ').replace(/"/g, '""');
  return `${c.priority.toFixed(1)},"${q}",${c.vertical},${c.intent},${c.template},${c.memberCount},${c.newPageNeeded},${c.existingPage || ''},"${vars}"`;
});
fs.writeFileSync(OUT_CSV, csvHeader + csvRows.join('\n'), 'utf8');

// Report
const gaps = enriched.filter(c => c.newPageNeeded);
const intents = {};
const templates = {};
for (const c of enriched) {
  intents[c.intent] = (intents[c.intent] || 0) + 1;
  templates[c.template] = (templates[c.template] || 0) + 1;
}

console.log('--- Clustering summary ---');
console.log('Input queries:', queries.length);
console.log('Clusters formed:', enriched.length);
console.log('Reduction: ' + (100 - (enriched.length / queries.length * 100)).toFixed(1) + '%');
console.log('\nIntent breakdown:');
for (const [k, v] of Object.entries(intents)) console.log(`  ${k.padEnd(15)} ${v}`);
console.log('\nTemplate breakdown:');
for (const [k, v] of Object.entries(templates)) console.log(`  ${k.padEnd(15)} ${v}`);
console.log('\nGap clusters (need new page):', gaps.length);

console.log('\nTop 30 gap clusters by priority:');
gaps.slice(0, 30).forEach((c, i) => {
  const varCount = c.memberCount > 1 ? ` [+${c.memberCount - 1} variants]` : '';
  console.log(`${(i+1).toString().padStart(3,' ')}. [${c.vertical.padEnd(13)}] [${c.intent.padEnd(13)}] [${c.template.padEnd(12)}] ${c.canonicalQuery}${varCount}`);
});

console.log('\nOutput:');
console.log('  ', OUT_JSON);
console.log('  ', OUT_CSV);
