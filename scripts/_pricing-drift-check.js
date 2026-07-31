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
// claude-haiku-4-5 with the web_search server tool so the model can actually
// read the source URLs (~$0.011/pinpoint = $0.001 token + $0.01 search).
// Full 44-pinpoint catalog runs at ~$0.50/month = ~$6/yr.
//
// Fixed 2026-05-15: original ship sent URLs in the prompt body without
// enabling any browsing tool, so every pinpoint returned "I can't read URLs"
// and the digest read "0/N over threshold ✓". See PRICE-DRIFT-FIX-1.
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

// Throttle to stay under haiku's 50K input-tokens-per-minute org limit.
// Each pinpoint with web_search consumes ~15-25K input tokens because
// search results get fed back into the model as input on subsequent
// rounds. ~18s spacing keeps us comfortably under the cap.
const PINPOINT_DELAY_MS = 18_000;
const MAX_RETRIES_429 = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

// Floor below which the run is considered untrustworthy. Two prior ship
// regressions (web_search disabled, then no-credit 400s) both reported
// "0/N over threshold ✓" while every single pinpoint had silently failed.
// Anything below this success rate is louder than a drift flag — the
// instrument itself is broken.
const EXTRACTION_SUCCESS_FLOOR = 0.8;

let totalPinpoints = 0;
let totalDriftFlags = 0;
let totalExtracted = 0;
let totalUnresolvedBands = 0;
const verticalSummaries = [];

// [PRICE-DRIFT-FIX-3] Resolve the comparison band from the ACTUAL harness.
//
// This file's header claims it compares industry against "the bands
// hard-coded in our test/<v>/calculator-spot-check.test.js harnesses". It
// did not. It compared against `pinpoint.currentBand`, a hand-copied
// duplicate living in data/pricing-drift-sources.json with no linkage to the
// harness at all. Audited 2026-07-30: only 5 of 44 pinpoints still matched
// the live harness band. The 2026-06-09 report's "25/44 over threshold"
// therefore measured the CATALOG drifting from the harness as much as our
// pricing drifting from industry, and several flagged pinpoints were
// comparing against bands we had already corrected weeks earlier.
//
// Now: read the band out of the harness by spec id, and when that fails, say
// so loudly in the digest instead of silently reporting a stale number.
const harnessSrcCache = new Map();
function harnessBands(harnessPath) {
  if (!harnessPath) return [];
  if (harnessSrcCache.has(harnessPath)) return harnessSrcCache.get(harnessPath);
  let bands = [];
  try {
    const src = fs.readFileSync(harnessPath, "utf8");
    bands = [...src.matchAll(
      /id:\s*["']([A-Za-z0-9._-]+)["'][\s\S]{0,900}?band:\s*\{\s*low:\s*([0-9]+),\s*high:\s*([0-9]+)/g
    )].map((m) => ({ id: m[1], low: +m[2], high: +m[3] }));
  } catch (e) {
    console.error(`harness unreadable: ${harnessPath}: ${e.message}`);
  }
  harnessSrcCache.set(harnessPath, bands);
  return bands;
}

// Returns { band, source, note }. `source` is "harness" or "catalog-fallback".
function resolveBand(vData, pinpoint) {
  const bands = harnessBands(vData.harnessPath);
  const want = pinpoint.harnessSpecId || pinpoint.id;
  const hit =
    bands.find((b) => b.id === want) ||
    bands.find((b) => b.id.startsWith(want)) ||
    bands.find((b) => want.startsWith(b.id));
  if (hit) {
    const cb = pinpoint.currentBand;
    const diverged = cb && (cb.low !== hit.low || cb.high !== hit.high);
    return {
      band: { low: hit.low, high: hit.high },
      source: "harness",
      note: diverged
        ? `resolved from ${vData.harnessPath} spec \`${hit.id}\` (catalog copy said $${cb.low.toLocaleString()}–$${cb.high.toLocaleString()} and was stale)`
        : `resolved from ${vData.harnessPath} spec \`${hit.id}\``,
    };
  }
  return {
    band: pinpoint.currentBand,
    source: "catalog-fallback",
    note: `⚠️ could NOT resolve a harness band for this pinpoint (no spec id matching \`${want}\` in ${vData.harnessPath || "?"}). Falling back to the hand-copied catalog band, which may be stale — treat the drift below as unverified. Fix by adding \`"harnessSpecId": "<spec id>"\` to this pinpoint in ${SOURCES_PATH}.`,
  };
}

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
    for (let attempt = 0; attempt <= MAX_RETRIES_429; attempt++) {
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
            max_tokens: 1500,
            tools: [{
              type: "web_search_20250305",
              name: "web_search",
              max_uses: 2,
            }],
            messages: [{ role: "user", content: prompt }],
          }),
        });
        if (r.status === 429 && attempt < MAX_RETRIES_429) {
          const retryAfter = parseInt(r.headers.get("retry-after") || "30", 10);
          console.log(`429 on ${pinpoint.id} attempt ${attempt + 1}, sleeping ${retryAfter}s`);
          await sleep((retryAfter + 2) * 1000);
          continue;
        }
        if (!r.ok) {
          claudeError = `Claude ${r.status}: ${(await r.text()).slice(0, 300)}`;
          break;
        }
        const body = await r.json();
        // With web_search enabled, response has multiple content blocks:
        // tool_use, web_search_tool_result, then text. We want the final text block.
        const textBlocks = (body?.content || []).filter((c) => c.type === "text");
        const text = textBlocks.length ? textBlocks[textBlocks.length - 1].text : "";
        const jsonMatch = text.match(/\{[\s\S]*?"low"[\s\S]*?"high"[\s\S]*?\}/);
        if (jsonMatch) {
          try { extracted = JSON.parse(jsonMatch[0]); } catch (e) { claudeError = `parse: ${e.message}`; }
        } else {
          claudeError = `no JSON in response: ${text.slice(0, 200)}`;
        }
        break;
      } catch (e) {
        claudeError = `fetch: ${e.message}`;
        break;
      }
    }

    // Throttle: stay under haiku's 50K input-tpm cap. Skip the delay on the
    // last pinpoint so we don't waste workflow runtime.
    await sleep(PINPOINT_DELAY_MS);

    digest.push(`### ${pinpoint.id} — ${pinpoint.label}`);
    digest.push("");
    const resolved = resolveBand(vData, pinpoint);
    const currentBand = resolved.band;
    if (resolved.source !== "harness") totalUnresolvedBands++;
    digest.push(`- **Current band**: $${currentBand.low.toLocaleString()} – $${currentBand.high.toLocaleString()}`);
    digest.push(`- **Band source**: ${resolved.note}`);

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
    totalExtracted++;
    const indMid = (extracted.low + extracted.high) / 2;
    const ourMid = (currentBand.low + currentBand.high) / 2;
    const driftPct = Math.round(((indMid - ourMid) / ourMid) * 100);
    const lowDriftPct = Math.round(((extracted.low - currentBand.low) / currentBand.low) * 100);
    const highDriftPct = Math.round(((extracted.high - currentBand.high) / currentBand.high) * 100);
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

const extractionRate = totalPinpoints ? totalExtracted / totalPinpoints : 0;
const instrumentBroken = extractionRate < EXTRACTION_SUCCESS_FLOOR;

digest.unshift("");
// [PRICE-DRIFT-FIX-3] Unresolved bands are their own trust signal: a pinpoint
// compared against the hand-copied catalog band tells you nothing reliable
// about the band the calculator is actually gated on.
if (totalUnresolvedBands > 0) {
  digest.unshift(
    `**⚠️ ${totalUnresolvedBands}/${totalPinpoints} pinpoints could not resolve a live harness band** and fell back to the hand-copied \`currentBand\` in ${SOURCES_PATH}. Those rows are unverified — add a \`harnessSpecId\` to each before trusting its drift number.`,
  );
}
if (instrumentBroken) {
  digest.unshift(
    `**🚨 INSTRUMENT FAILURE**: only ${totalExtracted}/${totalPinpoints} pinpoints extracted (${Math.round(extractionRate * 100)}%, floor ${Math.round(EXTRACTION_SUCCESS_FLOOR * 100)}%). Drift findings below are NOT trustworthy — investigate API key, rate limits, web_search tool, and source-page reachability before acting on any flagged band.`,
  );
} else {
  digest.unshift(
    `**Summary**: ${totalDriftFlags}/${totalPinpoints} pinpoints over ${driftThresholdPct}% drift threshold (${totalExtracted}/${totalPinpoints} extracted).` +
    (totalDriftFlags ? " 🚩" : " ✓"),
  );
}

fs.writeFileSync(digestPath, digest.join("\n"));
console.log("Digest written:", digestPath);

// Email digest if Resend key present AND (drift to report OR instrument
// failure). Silent runs are now impossible: broken-instrument emails fire
// even with zero drift, ensuring we hear about extraction collapse.
if (process.env.RESEND_API_KEY && (totalDriftFlags > 0 || instrumentBroken)) {
  const subject = instrumentBroken
    ? `[Woogoro] 🚨 Pricing-drift instrument failure ${today} (${totalExtracted}/${totalPinpoints} extracted)`
    : `[Woogoro] Pricing drift detected on ${today} (${totalDriftFlags}/${totalPinpoints})`;
  const headline = instrumentBroken
    ? `<strong>🚨 INSTRUMENT FAILURE</strong>: only ${totalExtracted}/${totalPinpoints} pinpoints extracted (${Math.round(extractionRate * 100)}%, floor ${Math.round(EXTRACTION_SUCCESS_FLOOR * 100)}%). Drift findings are NOT trustworthy.`
    : `<strong>${totalDriftFlags}/${totalPinpoints}</strong> pinpoints over ${driftThresholdPct}% drift. Verticals affected: ${verticalSummaries.filter(v => v.drifted.length).map(v => `${v.vertical} (${v.drifted.length})`).join(", ") || "none"}.`;
  const html = `<div style="font-family:sans-serif;max-width:900px;padding:20px;">
    <h2>Pricing-drift report &mdash; ${today}</h2>
    <p style="color:#475569;">${headline}</p>
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
      subject,
      html,
    }),
  });
  if (r.ok) console.log(instrumentBroken ? "Instrument-failure alert emailed." : "Drift digest emailed.");
  else console.error("Resend error:", r.status, await r.text());
}

// Loud failure: workflow goes red whenever the instrument can't read its
// sources, so silent no-op runs (the 2026-05-04→05-15 regression) become
// impossible to ship past. Drift findings remain informational unless
// PRICING_DRIFT_HARD_FAIL=1.
if (instrumentBroken) {
  console.error(`Instrument failure: extraction rate ${Math.round(extractionRate * 100)}% below floor ${Math.round(EXTRACTION_SUCCESS_FLOOR * 100)}%.`);
  process.exit(2);
}
if (process.env.PRICING_DRIFT_HARD_FAIL === "1" && totalDriftFlags > 0) {
  console.error(`Hard fail: ${totalDriftFlags} drift findings.`);
  process.exit(1);
}
