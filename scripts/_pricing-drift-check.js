// Pricing-drift checker — reads industry pricing pages monthly, asks Claude
// to extract typical-installed-cost ranges, compares against the bands
// hard-coded in our test/<v>/calculator-spot-check.test.js harnesses, and
// flags any vertical where industry has moved >driftThresholdPct outside
// our band on either edge.
//
// Built 2026-05-04 as Layer 3 of the auto-pricing-realism gate stack.
// Layer 1: 17 verticals still need spot-check rollout (per-vertical thread).
// Layer 2: regression-gate.yml weekly cron (heartbeat for infra rot).
// Layer 3 (this): catches when industry MOVED while our static bands didn't.
//
// Wired to .github/workflows/pricing-drift-check.yml monthly cron. Uses
// claude-haiku-4-5 (cheap, ~$0.001 per pinpoint) so a 9-pinpoint run costs
// ~$0.01. Even quarterly with 50 pinpoints stays under $0.10/yr.
//
// Output: writes a markdown digest to output/pricing-drift/<date>.md and
// emails it via Resend (same pipeline as regression-gate.yml). When drift
// fires, Lane decides whether to:
//   (a) update the band in test/<v>/calculator-spot-check.test.js
//   (b) update the calc table value in js/<v>-calc.js
//   (c) wait for flywheel cal:* aggregates to override the static band

import fs from "node:fs";
import path from "node:path";

const SOURCES_PATH = "data/pricing-drift-sources.json";
const OUT_DIR = "output/pricing-drift";
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("ANTHROPIC_API_KEY not set — cannot run drift check.");
  process.exit(1);
}

const sources = JSON.parse(fs.readFileSync(SOURCES_PATH, "utf8"));
const driftThresholdPct = sources.metadata.driftThresholdPct ?? 15;

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const today = new Date().toISOString().substring(0, 10);
const digestPath = path.join(OUT_DIR, `${today}.md`);

const digest = [
  `# Pricing-drift report — ${today}`,
  "",
  `Compares industry-published 2026 pricing against the bands in our calculator-spot-check harnesses. Drift threshold: **${driftThresholdPct}%** outside band on either edge.`,
  "",
  `Sources catalog: \`${SOURCES_PATH}\` (last updated ${sources.metadata.lastUpdated}).`,
  "",
];

let totalPinpoints = 0;
let totalDriftFlags = 0;
const verticalSummaries = [];

for (const [vertical, vData] of Object.entries(sources.verticals)) {
  const verticalDrift = [];
  digest.push(`## ${vertical}`);
  digest.push("");

  for (const pinpoint of vData.pinpoints) {
    totalPinpoints++;
    const sourceList = vData.sources
      .map((u, i) => `${i + 1}. ${u}`)
      .join("\n");

    const prompt = [
      `You are a pricing-data extractor. Read the following industry sources and answer ONE question.`,
      ``,
      `Question: ${pinpoint.askClaude}`,
      ``,
      `Sources to consult (quote from any of them — pick the most recent / most specific):`,
      sourceList,
      ``,
      `If the sources don't contain a clear range, return {"low": null, "high": null, "sourceQuote": "<explain why">}. Do not guess.`,
      ``,
      `Return ONLY valid JSON, no markdown fences, no commentary.`,
    ].join("\n");

    let extracted = null;
    let claudeError = null;
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 400,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!r.ok) {
        claudeError = `Claude ${r.status}: ${(await r.text()).slice(0, 300)}`;
      } else {
        const body = await r.json();
        const text = body?.content?.[0]?.text || "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try { extracted = JSON.parse(jsonMatch[0]); } catch (e) { claudeError = `parse: ${e.message}`; }
        } else {
          claudeError = `no JSON in response: ${text.slice(0, 200)}`;
        }
      }
    } catch (e) {
      claudeError = `fetch: ${e.message}`;
    }

    digest.push(`### ${pinpoint.id} — ${pinpoint.label}`);
    digest.push("");
    digest.push(`- **Current band**: $${pinpoint.currentBand.low.toLocaleString()} – $${pinpoint.currentBand.high.toLocaleString()}`);

    if (claudeError) {
      digest.push(`- **Industry**: extraction failed (${claudeError})`);
      digest.push("");
      continue;
    }
    if (!extracted || extracted.low == null || extracted.high == null) {
      digest.push(`- **Industry**: sources unclear — ${extracted?.sourceQuote || "no data"}`);
      digest.push("");
      continue;
    }
    const indMid = (extracted.low + extracted.high) / 2;
    const ourMid = (pinpoint.currentBand.low + pinpoint.currentBand.high) / 2;
    const driftPct = Math.round(((indMid - ourMid) / ourMid) * 100);
    const lowDriftPct = Math.round(((extracted.low - pinpoint.currentBand.low) / pinpoint.currentBand.low) * 100);
    const highDriftPct = Math.round(((extracted.high - pinpoint.currentBand.high) / pinpoint.currentBand.high) * 100);
    const flag =
      Math.abs(driftPct) > driftThresholdPct ||
      Math.abs(lowDriftPct) > driftThresholdPct ||
      Math.abs(highDriftPct) > driftThresholdPct;
    if (flag) {
      totalDriftFlags++;
      verticalDrift.push(pinpoint.id);
    }
    digest.push(`- **Industry**: $${extracted.low.toLocaleString()} – $${extracted.high.toLocaleString()} (mid $${Math.round(indMid).toLocaleString()})`);
    digest.push(`- **Drift**: mid ${driftPct >= 0 ? "+" : ""}${driftPct}%, low ${lowDriftPct >= 0 ? "+" : ""}${lowDriftPct}%, high ${highDriftPct >= 0 ? "+" : ""}${highDriftPct}% ${flag ? "🚩 **OVER THRESHOLD**" : "ok"}`);
    if (extracted.sourceQuote) digest.push(`- **Source quote**: > ${extracted.sourceQuote}`);
    digest.push("");
  }

  verticalSummaries.push({ vertical, drifted: verticalDrift });
}

digest.unshift("");
digest.unshift(
  `**Summary**: ${totalDriftFlags}/${totalPinpoints} pinpoints over ${driftThresholdPct}% drift threshold.` +
  (totalDriftFlags ? " 🚩" : " ✓")
);

fs.writeFileSync(digestPath, digest.join("\n"));
console.log("Digest written:", digestPath);

// Email digest if Resend key present and there's drift to report.
if (process.env.RESEND_API_KEY && totalDriftFlags > 0) {
  const html = `<div style="font-family:sans-serif;max-width:900px;padding:20px;">
    <h2>Pricing-drift report &mdash; ${today}</h2>
    <p style="color:#475569;"><strong>${totalDriftFlags}/${totalPinpoints}</strong> pinpoints over ${driftThresholdPct}% drift. Verticals affected: ${verticalSummaries.filter(v => v.drifted.length).map(v => `${v.vertical} (${v.drifted.length})`).join(", ") || "none"}.</p>
    <pre style="background:#f8fafc;border:1px solid #e2e8f0;padding:10px;font-size:11px;white-space:pre-wrap;max-height:800px;overflow:auto;">${digest.join("\n").replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>
    <p style="color:#475569;font-size:12px;">Source catalog: data/pricing-drift-sources.json. Update bands by editing test/&lt;v&gt;/calculator-spot-check.test.js or rate tables in js/&lt;v&gt;-calc.js.</p>
  </div>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.RESEND_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Woogoro Pricing Drift <noreply@woogoro.com>",
      to: ["hello@woogoro.com"],
      subject: `[Woogoro] Pricing drift detected on ${today} (${totalDriftFlags}/${totalPinpoints})`,
      html,
    }),
  });
  if (r.ok) console.log("Drift digest emailed.");
  else console.error("Resend error:", r.status, await r.text());
}

// Exit non-zero only if drift fires AND we're in CI hard-mode. By default
// this is informational — it fills an inbox, not a build.
if (process.env.PRICING_DRIFT_HARD_FAIL === "1" && totalDriftFlags > 0) {
  console.error(`Hard fail: ${totalDriftFlags} drift findings.`);
  process.exit(1);
}
