// /api/discovery-scan
//
// Weekly cron that mines real user-traffic signals for content gaps —
// without auto-generating any content. Output is a hand-write queue
// emailed to hello@woogoro.com.
//
// Sources scanned:
//   1. tp:404_log     real users who hit a missing page (last ~5000 entries)
//   2. tp:events      site-internal events containing search-like signals
//   3. Google Search Console — top queries by impressions over last 28 days,
//                              filtered to those with low CTR or no clicks
//                              (real demand the site isn't serving well).
//                              Optional: requires GSC_* env vars; cron skips
//                              GSC silently if not configured.
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
//
// GSC env vars (all optional — missing = skip GSC):
//   - GSC_CLIENT_EMAIL   service-account email
//   - GSC_PRIVATE_KEY    RSA private key (escape \n as \\n in Vercel UI)
//   - GSC_SITE_URL       e.g. "https://woogoro.com/" (trailing slash required)

import { Redis } from "@upstash/redis";
import crypto from "crypto";
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

// ---- Google Search Console fetcher --------------------------------------
// Service-account JWT auth (no OAuth user flow needed for scheduled jobs).
// Returns [] if env vars missing, on auth failure, or on API failure — the
// rest of the cron continues without GSC. Never throws.

function base64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getGscAccessToken() {
  const clientEmail = process.env.GSC_CLIENT_EMAIL;
  const privateKey = (process.env.GSC_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const headerB64 = base64url(JSON.stringify(header));
  const claimB64 = base64url(JSON.stringify(claim));
  const signingInput = headerB64 + "." + claimB64;
  let signature;
  try {
    signature = crypto.sign("RSA-SHA256", Buffer.from(signingInput), privateKey);
  } catch (e) {
    console.error("[discovery-scan] GSC JWT sign failed:", e.message);
    return null;
  }
  const jwt = signingInput + "." + base64url(signature);

  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=" + encodeURIComponent(jwt),
    });
    if (!r.ok) {
      console.error("[discovery-scan] GSC token endpoint:", r.status);
      return null;
    }
    const data = await r.json();
    return data.access_token || null;
  } catch (e) {
    console.error("[discovery-scan] GSC token fetch error:", e.message);
    return null;
  }
}

async function fetchGscQueries() {
  const siteUrl = process.env.GSC_SITE_URL;
  if (!siteUrl) return { rows: [], reason: "no_site_url" };

  const token = await getGscAccessToken();
  if (!token) return { rows: [], reason: "no_token" };

  const today = new Date();
  const startDate = new Date(today.getTime() - 28 * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().substring(0, 10);

  const body = {
    startDate: fmt(startDate),
    endDate: fmt(today),
    dimensions: ["query"],
    rowLimit: 200,
    aggregationType: "byProperty",
  };

  try {
    const r = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );
    if (!r.ok) {
      const text = await r.text();
      console.error("[discovery-scan] GSC query failed:", r.status, text.slice(0, 200));
      return { rows: [], reason: "gsc_" + r.status };
    }
    const data = await r.json();
    return { rows: data.rows || [], reason: null };
  } catch (e) {
    console.error("[discovery-scan] GSC query error:", e.message);
    return { rows: [], reason: "exception" };
  }
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

  // ---- 3. Pull Google Search Console queries (optional) ------------------
  const gscResult = await fetchGscQueries();
  const gscRows = gscResult.rows;

  // ---- 4. Aggregate -------------------------------------------------------
  // Group by attempted query (normalized). For each, count hits and run
  // match-engine to classify. GSC entries carry impressions/clicks separately
  // since "hit count" doesn't apply (they're query-position records).
  const counts = new Map();   // normalizedKey -> { count, attempted, normalized, gsc? }

  function bump(rawAttempted, gscData) {
    if (!rawAttempted) return;
    const normalized = matchEngine.normalize(rawAttempted);
    if (!normalized || normalized.length < 3) return;
    const key = normalized.toLowerCase();
    const cur = counts.get(key) || { count: 0, attempted: rawAttempted, normalized, gsc: null };
    cur.count += 1;
    if (gscData) {
      cur.gsc = {
        impressions: (cur.gsc?.impressions || 0) + (gscData.impressions || 0),
        clicks: (cur.gsc?.clicks || 0) + (gscData.clicks || 0),
        position: gscData.position,
      };
    }
    counts.set(key, cur);
  }

  for (const e of events404) bump(e.attempted);
  for (const e of searchEvents) bump((e.meta && (e.meta.q || e.meta.query)) || "");
  for (const row of gscRows) {
    const q = row.keys && row.keys[0];
    if (!q) continue;
    bump(q, {
      impressions: row.impressions || 0,
      clicks: row.clicks || 0,
      position: row.position || 0,
    });
  }

  // ---- 5. Classify each unique normalized query --------------------------
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
      gsc: entry.gsc,
    });
  }

  // ---- 6. Bucket by gapType ----------------------------------------------
  const handwriteQueue = classified
    .filter((c) => c.gapType && c.gapType.startsWith("consider_size_page_") && c.hits >= 2)
    .sort((a, b) => b.hits - a.hits);

  const matchedButFrequent = classified
    .filter((c) => !c.gapType && c.confidence >= 60 && c.hits >= 3)
    .sort((a, b) => b.hits - a.hits);

  // GSC-specific: queries with real Google impressions but few/no clicks.
  // These are real demand the site is failing to capture — top-tier signal.
  // Filter: 50+ impressions and (no clicks OR average position > 10).
  const gscOpportunities = classified
    .filter((c) => c.gsc && c.gsc.impressions >= 50 && (c.gsc.clicks === 0 || (c.gsc.position || 0) > 10))
    .sort((a, b) => (b.gsc?.impressions || 0) - (a.gsc?.impressions || 0));

  const outOfScope = classified.filter((c) => c.gapType === "out_of_scope");

  const noVerticalLowConf = classified.filter((c) => !c.vertical && c.gapType !== "out_of_scope");

  const totalScanned = classified.length;
  const totalHits = classified.reduce((s, c) => s + c.hits, 0);

  const report = {
    date: today,
    sourceCounts: {
      events404: events404.length,
      searchEvents: searchEvents.length,
      gscRows: gscRows.length,
      gscReason: gscResult.reason,
    },
    totalUniqueQueries: totalScanned,
    totalHits,
    handwriteQueue: handwriteQueue.slice(0, 30),
    matchedButFrequent: matchedButFrequent.slice(0, 30),
    gscOpportunities: gscOpportunities.slice(0, 30),
    outOfScopeCount: outOfScope.length,
    noVerticalCount: noVerticalLowConf.length,
  };

  await redis.set(REPORT_PREFIX + today, JSON.stringify(report), { ex: REPORT_TTL });

  // ---- 7. Email digest ---------------------------------------------------
  let emailStatus = "no_signal";
  if (handwriteQueue.length > 0 || matchedButFrequent.length > 0 || gscOpportunities.length > 0) {
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

      const gscRowsHtml = gscOpportunities.slice(0, 15).map((q) => `<tr>
        <td style="padding:6px 12px 6px 0;font-family:monospace;font-size:12px;">${escape(q.query)}</td>
        <td style="padding:6px 12px 6px 0;">${escape(q.vertical || "—")}</td>
        <td style="padding:6px 12px 6px 0;text-align:right;font-weight:600;">${q.gsc?.impressions || 0}</td>
        <td style="padding:6px 12px 6px 0;text-align:right;color:${(q.gsc?.clicks || 0) === 0 ? "#b91c1c" : "#1e293b"};">${q.gsc?.clicks || 0}</td>
        <td style="padding:6px 12px 6px 0;text-align:right;">${q.gsc?.position ? q.gsc.position.toFixed(1) : "—"}</td>
        <td style="padding:6px 12px 6px 0;font-size:11px;">${q.matchedPage ? `<a href="https://woogoro.com${escape(q.matchedPage)}">${escape(q.matchedPage)}</a>` : "<em>no page</em>"}</td>
      </tr>`).join("");

      const sourcesLine = `404 log: ${events404.length}, search events: ${searchEvents.length}, GSC queries: ${gscRows.length}${gscResult.reason ? ` (skipped: ${gscResult.reason})` : ""}`;

      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Woogoro Discovery <noreply@woogoro.com>",
            to: ["hello@woogoro.com"],
            subject: `[Woogoro] Weekly content gap discovery — ${today}`,
            html: `<div style="font-family:sans-serif;max-width:840px;padding:20px;">
              <h2 style="margin:0 0 8px;">Content gap discovery — ${today}</h2>
              <p style="color:#475569;font-size:14px;margin:0 0 6px;">Scanned ${totalScanned} unique queries (${totalHits} aggregate signals).</p>
              <p style="color:#94a3b8;font-size:12px;margin:0 0 16px;">Sources — ${sourcesLine}</p>

              ${gscOpportunities.length > 0 ? `
              <h3 style="margin:20px 0 8px;color:#7c2d12;">GSC opportunities (${gscOpportunities.length})</h3>
              <p style="color:#475569;font-size:12px;margin:0 0 8px;">Real Google impressions but few/no clicks — meaning Woogoro is showing in results but not winning the click. These are the highest-leverage gaps: real demand the site isn't serving well. Filter: 50+ impressions, 0 clicks OR average position > 10.</p>
              <table style="font-size:13px;border-collapse:collapse;width:100%;">
                <thead><tr style="border-bottom:2px solid #e2e8f0;">
                  <th style="padding:8px 12px 8px 0;text-align:left;">Query</th>
                  <th style="padding:8px 12px 8px 0;text-align:left;">Vertical</th>
                  <th style="padding:8px 12px 8px 0;text-align:right;">Impr.</th>
                  <th style="padding:8px 12px 8px 0;text-align:right;">Clicks</th>
                  <th style="padding:8px 12px 8px 0;text-align:right;">Avg Pos</th>
                  <th style="padding:8px 12px 8px 0;text-align:left;">Best page</th>
                </tr></thead>
                <tbody>${gscRowsHtml}</tbody>
              </table>` : ""}

              ${handwriteQueue.length > 0 ? `
              <h3 style="margin:24px 0 8px;color:#b91c1c;">Handwrite queue (${handwriteQueue.length})</h3>
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
