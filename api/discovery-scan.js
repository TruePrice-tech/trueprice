// /api/discovery-scan
//
// Weekly cron that mines real user-traffic signals for content gaps —
// without auto-generating any content. Output is a hand-write queue
// emailed to hello@woogoro.com.
//
// Sources scanned:
//   1. tp:404_log     real users who hit a missing page (last ~5000 entries)
//   2. tp:events      site-internal events containing search-like signals
//
// Each unique attempted-URL or query is run through match-engine. The
// engine's gapType field drives the output bucket:
//   - consider_size_page_<v>  vertical match + sqft modifier, no size page
//   - out_of_scope            no vertical detected (ignore)
//   - null                    matched a real page (no action)
//
// Aggregated by gapType + vertical, top 10 emailed weekly.
//
// State written:
//   - tp:discovery_report:<YYYY-MM-DD>  full report (90-day TTL)
//
// Cron: 0 14 * * 0 (Sundays 14:00 UTC, after weekly audits at 03:00 / 04:00).

import { Redis } from "@upstash/redis";
import { gate } from "./_usage-gate.js";
import matchEngine from "../js/match-engine.js";

const redis = Redis.fromEnv();

const REPORT_PREFIX = "tp:discovery_report:";
const REPORT_TTL = 90 * 24 * 60 * 60;

function escape(s) {
  return String(s).replace(/[<>&"']/g, (c) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;", "'": "&#39;"
  }[c]));
}

export default async function handler(req, res) {
  const auth = req.headers["authorization"] || "";
  const cronSecret = process.env.CRON_SECRET || "";
  if (!cronSecret) return res.status(503).json({ error: "CRON_SECRET not configured" });
  if (auth !== `Bearer ${cronSecret}`) return res.status(401).json({ error: "Unauthorized" });
  if (await gate(req, res, 2)) return;

  const today = new Date().toISOString().substring(0, 10);

  // ---- 1. Pull 404 log -----------------------------------------------------
  const raw404 = await redis.lrange("tp:404_log", 0, 4999);
  const events404 = raw404.map((r) => (typeof r === "string" ? JSON.parse(r) : r));

  // ---- 2. Pull recent search-style events from analytics ------------------
  // We're looking for events with names like 'search', 'site_search',
  // 'unmatched_query'. Empty by default — present for forward compatibility
  // when an on-site search box is added.
  const rawEvents = await redis.lrange("tp:events", 0, 4999);
  const searchEvents = rawEvents
    .map((r) => (typeof r === "string" ? JSON.parse(r) : r))
    .filter((e) => /search|unmatched_query/i.test(e.event || ""));

  // ---- 3. Aggregate -------------------------------------------------------
  // Group by attempted query (normalized). For each, count hits and run
  // match-engine to classify.
  const counts = new Map();   // normalizedKey -> { count, attempted, lastResult }

  function bump(rawAttempted) {
    if (!rawAttempted) return;
    const normalized = matchEngine.normalize(rawAttempted);
    if (!normalized || normalized.length < 3) return;
    const key = normalized.toLowerCase();
    const cur = counts.get(key) || { count: 0, attempted: rawAttempted, normalized };
    cur.count += 1;
    counts.set(key, cur);
  }

  for (const e of events404) bump(e.attempted);
  for (const e of searchEvents) bump((e.meta && (e.meta.q || e.meta.query)) || "");

  // ---- 4. Classify each unique normalized query --------------------------
  const classified = [];
  for (const [key, entry] of counts.entries()) {
    const result = matchEngine.match(entry.attempted);
    classified.push({
      query: entry.normalized,
      attempted: entry.attempted,
      hits: entry.count,
      vertical: result.vertical,
      intent: result.intent,
      confidence: result.confidence,
      matchedPage: result.matchedPage,
      gapType: result.gapType,
    });
  }

  // ---- 5. Bucket by gapType ----------------------------------------------
  const handwriteQueue = classified
    .filter((c) => c.gapType && c.gapType.startsWith("consider_size_page_") && c.hits >= 2)
    .sort((a, b) => b.hits - a.hits);

  const matchedButFrequent = classified
    .filter((c) => !c.gapType && c.confidence >= 60 && c.hits >= 3)
    .sort((a, b) => b.hits - a.hits);

  const outOfScope = classified.filter((c) => c.gapType === "out_of_scope");

  const noVerticalLowConf = classified.filter((c) => !c.vertical && c.gapType !== "out_of_scope");

  const totalScanned = classified.length;
  const totalHits = classified.reduce((s, c) => s + c.hits, 0);

  const report = {
    date: today,
    sourceCounts: { events404: events404.length, searchEvents: searchEvents.length },
    totalUniqueQueries: totalScanned,
    totalHits,
    handwriteQueue: handwriteQueue.slice(0, 30),
    matchedButFrequent: matchedButFrequent.slice(0, 30),
    outOfScopeCount: outOfScope.length,
    noVerticalCount: noVerticalLowConf.length,
  };

  await redis.set(REPORT_PREFIX + today, JSON.stringify(report), { ex: REPORT_TTL });

  // ---- 6. Email digest ---------------------------------------------------
  let emailStatus = "no_signal";
  if (handwriteQueue.length > 0 || matchedButFrequent.length > 0) {
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const handwriteRows = handwriteQueue.slice(0, 10).map((q) => `<tr>
        <td style="padding:6px 12px 6px 0;font-family:monospace;font-size:12px;">${escape(q.query)}</td>
        <td style="padding:6px 12px 6px 0;">${escape(q.vertical || "?")}</td>
        <td style="padding:6px 12px 6px 0;text-align:right;font-weight:600;">${q.hits}</td>
        <td style="padding:6px 12px 6px 0;font-size:11px;color:#475569;">${escape(q.gapType)}</td>
      </tr>`).join("");

      const matchedRows = matchedButFrequent.slice(0, 10).map((q) => `<tr>
        <td style="padding:6px 12px 6px 0;font-family:monospace;font-size:12px;">${escape(q.query)}</td>
        <td style="padding:6px 12px 6px 0;">${escape(q.vertical || "?")}</td>
        <td style="padding:6px 12px 6px 0;text-align:right;font-weight:600;">${q.hits}</td>
        <td style="padding:6px 12px 6px 0;font-size:11px;"><a href="https://woogoro.com${escape(q.matchedPage || "/")}">${escape(q.matchedPage || "?")}</a></td>
      </tr>`).join("");

      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Woogoro Discovery <noreply@woogoro.com>",
            to: ["hello@woogoro.com"],
            subject: `[Woogoro] Weekly content gap discovery — ${today}`,
            html: `<div style="font-family:sans-serif;max-width:760px;padding:20px;">
              <h2 style="margin:0 0 8px;">Content gap discovery — ${today}</h2>
              <p style="color:#475569;font-size:14px;margin:0 0 16px;">Scanned ${totalScanned} unique queries (${totalHits} total hits) from 404 log + on-site search events.</p>

              ${handwriteQueue.length > 0 ? `
              <h3 style="margin:20px 0 8px;color:#b91c1c;">Handwrite queue (${handwriteQueue.length})</h3>
              <p style="color:#475569;font-size:12px;margin:0 0 8px;">Real-user signals where match-engine sees a vertical match but no specific page exists. These are the queries to hand-write next.</p>
              <table style="font-size:13px;border-collapse:collapse;width:100%;">
                <thead><tr style="border-bottom:2px solid #e2e8f0;">
                  <th style="padding:8px 12px 8px 0;text-align:left;">Query</th>
                  <th style="padding:8px 12px 8px 0;text-align:left;">Vertical</th>
                  <th style="padding:8px 12px 8px 0;text-align:right;">Hits</th>
                  <th style="padding:8px 12px 8px 0;text-align:left;">Gap type</th>
                </tr></thead>
                <tbody>${handwriteRows}</tbody>
              </table>` : ""}

              ${matchedButFrequent.length > 0 ? `
              <h3 style="margin:24px 0 8px;color:#1d4ed8;">Matched but heavily searched (${matchedButFrequent.length})</h3>
              <p style="color:#475569;font-size:12px;margin:0 0 8px;">Queries that DID match an existing page but are getting many hits. Worth strengthening internal links to these pages.</p>
              <table style="font-size:13px;border-collapse:collapse;width:100%;">
                <thead><tr style="border-bottom:2px solid #e2e8f0;">
                  <th style="padding:8px 12px 8px 0;text-align:left;">Query</th>
                  <th style="padding:8px 12px 8px 0;text-align:left;">Vertical</th>
                  <th style="padding:8px 12px 8px 0;text-align:right;">Hits</th>
                  <th style="padding:8px 12px 8px 0;text-align:left;">Page</th>
                </tr></thead>
                <tbody>${matchedRows}</tbody>
              </table>` : ""}

              <p style="color:#64748b;font-size:11px;margin-top:20px;">Out of scope: ${outOfScope.length}. No-vertical low confidence: ${noVerticalLowConf.length}. Full report at tp:discovery_report:${today}.</p>
            </div>`,
          }),
        });
        emailStatus = r.ok ? "sent" : ("resend_error_" + r.status);
      } catch (e) {
        emailStatus = "exception:" + e.message;
      }
    } else {
      emailStatus = "no_api_key";
    }
  }

  await redis.set("tp:cron_run:discovery-scan", new Date().toISOString());

  return res.status(200).json({ ok: true, ...report, emailStatus });
}
