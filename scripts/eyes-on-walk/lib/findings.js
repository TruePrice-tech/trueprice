// Aggregates per-path eyes-on findings into a single FINDINGS.md per walk run,
// and emits a one-line summary suitable for ntfy / email digests.

const fs = require("fs");
const path = require("path");

function severityRank(s) {
  return { high: 0, medium: 1, low: 2 }[s] ?? 3;
}

function writeFindings({ outDir, vertical, runDate, paths, fixtureErrors, walkErrors }) {
  const allIssues = [];
  for (const p of paths) {
    for (const issue of (p.issues || [])) {
      allIssues.push({ ...issue, walkPath: p.walkPath, fixture: p.fixture || null });
    }
  }
  allIssues.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));

  const counts = { high: 0, medium: 0, low: 0 };
  for (const i of allIssues) counts[i.severity] = (counts[i.severity] || 0) + 1;

  const lines = [];
  lines.push(`# Eyes-on walk findings: ${vertical}`);
  lines.push(`Run date: ${runDate}`);
  lines.push("");
  lines.push(`**Summary:** ${counts.high} high, ${counts.medium} medium, ${counts.low} low`);
  lines.push("");

  if (walkErrors && walkErrors.length) {
    lines.push("## Walk errors (puppeteer-level)");
    for (const e of walkErrors) lines.push(`- ${e}`);
    lines.push("");
  }
  if (fixtureErrors && fixtureErrors.length) {
    lines.push("## Fixture validation errors");
    for (const e of fixtureErrors) lines.push(`- ${e}`);
    lines.push("");
  }

  for (const sev of ["high", "medium", "low"]) {
    const subset = allIssues.filter((i) => i.severity === sev);
    if (!subset.length) continue;
    lines.push(`## ${sev.toUpperCase()} (${subset.length})`);
    for (const i of subset) {
      const fxBit = i.fixture ? ` _(fixture: ${i.fixture})_` : "";
      lines.push(`- **[${i.walkPath}]** ${i.summary}${fxBit}`);
      if (i.detail) lines.push(`  - ${i.detail}`);
      if (i.screenshot) lines.push(`  - screenshot: \`${i.screenshot}.png\``);
    }
    lines.push("");
  }

  if (!allIssues.length && !(walkErrors || []).length && !(fixtureErrors || []).length) {
    lines.push("(no issues flagged)");
  }

  const file = path.join(outDir, "FINDINGS.md");
  fs.writeFileSync(file, lines.join("\n"));
  return { file, counts, total: allIssues.length };
}

function summaryLine({ vertical, counts, total, walkErrors }) {
  if ((walkErrors || []).length) return `${vertical}: WALK ERROR (${walkErrors.length})`;
  if (total === 0) return `${vertical}: clean`;
  return `${vertical}: ${counts.high}h ${counts.medium}m ${counts.low}l`;
}

module.exports = { writeFindings, summaryLine };
