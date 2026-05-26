#!/usr/bin/env node
// scripts/_audit-handwritten-drift.js
//
// Finds city pages whose line count drifts significantly above the
// per-vertical median, then reports which of those drifted pages lack
// the HANDWRITTEN-PROTECTED marker. Drifted-but-unmarked pages are at
// risk of being silently overwritten by the next mass regen.
//
// Born from 2026-05-25 LA roofing flagship loss: marker was advisory,
// not enforced on build-site.js; 4+ mass regens since flagship ship
// could have destroyed it. This audit surfaces any other handwritten
// work currently in the same vulnerable state.
//
// Read-only. Outputs a markdown report.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MARKER = "HANDWRITTEN-PROTECTED";
const DRIFT_FLAG_PCT = 0.15; // 15% above vertical median triggers a flag
const DRIFT_URGENT_PCT = 0.25; // 25% above flags as flagship-likely

// Known verticals; the trailing slug always matches one of these.
// Listed longest-first so multi-word verticals (kitchen-remodel,
// garage-door, auto-repair) match before their single-word prefixes.
const VERTICALS = [
  "kitchen-remodel", "garage-door", "auto-repair",
  "roof", "hvac", "electrical", "plumbing", "painting", "siding",
  "insulation", "concrete", "foundation", "fence", "landscaping",
  "solar", "window", "gutter", "medical", "legal", "moving"
];

function extractVertical(file) {
  for (const v of VERTICALS) {
    if (file.endsWith(`-${v}-cost.html`)) return v;
  }
  return null;
}

function hasMarker(absPath) {
  try {
    const fd = fs.openSync(absPath, "r");
    const buf = Buffer.alloc(4096);
    fs.readSync(fd, buf, 0, 4096, 0);
    fs.closeSync(fd);
    return buf.toString("utf8").indexOf(MARKER) !== -1;
  } catch (e) {
    return false;
  }
}

function countLines(absPath) {
  try {
    return fs.readFileSync(absPath, "utf8").split(/\r?\n/).length;
  } catch (e) {
    return 0;
  }
}

function median(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function main() {
  const allHtml = fs.readdirSync(ROOT).filter((f) => f.endsWith("-cost.html"));

  // Bucket files by vertical. Only include city pages — skip
  // state-level (e.g. alabama-roof-cost.html) and material-level
  // (e.g. metal-roof-cost.html) pages by requiring a 2-letter state
  // code immediately before the vertical slug.
  const buckets = {};
  for (const f of allHtml) {
    const vertical = extractVertical(f);
    if (!vertical) continue;
    const stem = f.slice(0, -`-${vertical}-cost.html`.length);
    const parts = stem.split("-");
    const stateCodeCandidate = parts[parts.length - 1];
    if (!stateCodeCandidate || stateCodeCandidate.length !== 2) continue;
    (buckets[vertical] = buckets[vertical] || []).push(f);
  }

  const report = [];
  report.push(`# Handwritten Drift Audit — ${new Date().toISOString().slice(0, 10)}`);
  report.push("");
  report.push(`Drift flag: >${(DRIFT_FLAG_PCT * 100).toFixed(0)}% above vertical median line count.`);
  report.push(`Flagship-likely flag: >${(DRIFT_URGENT_PCT * 100).toFixed(0)}% above vertical median.`);
  report.push("");

  let totalAtRisk = 0;
  let totalSafelyMarked = 0;
  let totalBorderline = 0;

  const sortedVerticals = Object.keys(buckets).sort();

  for (const vertical of sortedVerticals) {
    const files = buckets[vertical];
    if (files.length < 5) continue; // skip thin verticals (no useful median)

    const measured = files.map((f) => {
      const abs = path.join(ROOT, f);
      return { file: f, lines: countLines(abs), marked: hasMarker(abs) };
    });
    const med = median(measured.map((m) => m.lines));

    const flagged = measured
      .map((m) => ({ ...m, drift: (m.lines - med) / med }))
      .filter((m) => m.drift > DRIFT_FLAG_PCT)
      .sort((a, b) => b.drift - a.drift);

    if (flagged.length === 0) continue;

    report.push(`## ${vertical} (median ${med} lines, ${files.length} pages)`);
    report.push("");
    report.push("| file | lines | drift | marker | status |");
    report.push("|---|---:|---:|---|---|");

    for (const f of flagged) {
      const driftPct = (f.drift * 100).toFixed(0) + "%";
      const markerCell = f.marked ? "✓" : "✗";
      let status;
      if (f.drift > DRIFT_URGENT_PCT && !f.marked) {
        status = "**AT RISK — mark immediately**";
        totalAtRisk++;
      } else if (f.drift > DRIFT_URGENT_PCT && f.marked) {
        status = "safely marked";
        totalSafelyMarked++;
      } else if (!f.marked) {
        status = "borderline — likely city-context expansion";
        totalBorderline++;
      } else {
        status = "marked, mild drift";
      }
      report.push(`| ${f.file} | ${f.lines} | +${driftPct} | ${markerCell} | ${status} |`);
    }
    report.push("");
  }

  report.push("## Summary");
  report.push("");
  report.push(`- **At risk** (>25% drift, unmarked): ${totalAtRisk}`);
  report.push(`- Safely marked flagships (>25% drift, marked): ${totalSafelyMarked}`);
  report.push(`- Borderline (15-25% drift, unmarked — likely city-context, not flagship): ${totalBorderline}`);

  const outPath = path.join(ROOT, "handwritten-drift-audit.md");
  fs.writeFileSync(outPath, report.join("\n") + "\n", "utf8");

  console.log(`Audit complete. AT RISK: ${totalAtRisk}, safely marked: ${totalSafelyMarked}, borderline: ${totalBorderline}.`);
  console.log(`Report written to: ${outPath}`);
}

main();
