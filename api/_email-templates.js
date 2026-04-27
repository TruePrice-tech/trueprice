// Email templates for welcome + monthly digest. Pure functions — no I/O.
// Caller wraps the returned html via _email-send.js (compliance footer added there).

const SITE_ORIGIN = "https://woogoro.com";
const IRIS_HEADSHOT = `${SITE_ORIGIN}/images/Iris/Iris-laurel-seal-180.png`;

function titleCaseService(service) {
  return String(service || "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatLocation(city, stateCode) {
  const c = (city || "").trim();
  const s = (stateCode || "").trim().toUpperCase();
  if (c && s) return `${c}, ${s}`;
  if (c) return c;
  if (s) return s;
  return "your area";
}

// One-time welcome on signup.
// interest: { city, stateCode, service }
export function welcomeTemplate({ city, stateCode, service }) {
  const svc = titleCaseService(service);
  const where = formatLocation(city, stateCode);
  const subject = `Hi from Iris — your ${svc} price watch is on`;

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1e293b;">
    <div style="text-align:center;margin-bottom:20px;">
      <img src="${IRIS_HEADSHOT}" alt="Iris" width="84" height="84" style="border-radius:50%;border:3px solid #f1f5f9;">
    </div>
    <h1 style="font-size:22px;margin:0 0 16px;text-align:center;color:#0f172a;">You're in.</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 14px;">Hi, I'm Iris. I'll keep an eye on <strong>${svc}</strong> prices in <strong>${where}</strong> for you.</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 14px;">Once a month, if prices in your area shift more than about 10% up or down, I'll send you a short note with the numbers and what's behind the move. If nothing meaningful changed, I'll skip the month — your inbox doesn't need filler.</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 14px;">Two things you can do right now:</p>
    <ul style="font-size:15px;line-height:1.7;margin:0 0 18px;padding-left:20px;">
      <li><a href="${SITE_ORIGIN}/${service}-cost.html" style="color:#1d4ed8;">Run another estimate</a> for a different service or city.</li>
      <li><a href="${SITE_ORIGIN}/analyze-my-quote.html" style="color:#1d4ed8;">Send me a real quote you got</a> — I'll tell you if it's fair, and it sharpens our numbers for everyone in ${where}.</li>
    </ul>
    <p style="font-size:14px;line-height:1.6;margin:18px 0 0;color:#475569;">Reply to this email if you have questions. It hits a real human (Lane, Woogoro's founder).</p>
    <p style="font-size:14px;line-height:1.6;margin:14px 0 0;color:#475569;">— Iris</p>
  </div>`;

  return { subject, html };
}

// Monthly digest. interests is an array of { city, stateCode, service, change }
// where change is { currentAvg, baseline, deviation, currentQuotes } or null.
// Returns null if there's nothing meaningful to say (all interests skipped).
export function digestTemplate({ interests }) {
  const meaningful = (interests || []).filter(
    (i) => i.change && Number.isFinite(i.change.deviation) && Math.abs(i.change.deviation) >= 0.05
  );
  if (meaningful.length === 0) return null;

  const month = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
  const subject =
    meaningful.length === 1
      ? `${titleCaseService(meaningful[0].service)} prices in ${formatLocation(meaningful[0].city, meaningful[0].stateCode)} — ${month}`
      : `Your monthly Woogoro price update — ${month}`;

  const rows = meaningful
    .map((i) => {
      const svc = titleCaseService(i.service);
      const where = formatLocation(i.city, i.stateCode);
      const dev = i.change.deviation;
      const pct = (Math.abs(dev) * 100).toFixed(1);
      const dir = dev > 0 ? "up" : "down";
      const arrow = dev > 0 ? "&#9650;" : "&#9660;";
      const color = dev > 0 ? "#b91c1c" : "#15803d";
      const cur = `$${Math.round(i.change.currentAvg).toLocaleString()}`;
      const prior = `$${Math.round(i.change.baseline).toLocaleString()}`;
      const sample = i.change.currentQuotes || 0;
      const sampleNote =
        sample >= 20 ? "high confidence" : sample >= 10 ? "medium confidence" : "small sample";
      return `<div style="padding:18px 0;border-bottom:1px solid #e2e8f0;">
        <div style="font-size:15px;font-weight:600;color:#0f172a;margin-bottom:6px;">${svc} in ${where}</div>
        <div style="font-size:14px;color:#475569;margin-bottom:6px;">
          <span style="color:${color};font-weight:600;">${arrow} ${pct}% ${dir}</span>
          &middot; now ${cur} (was ${prior})
        </div>
        <div style="font-size:12px;color:#94a3b8;">${sample} recent quote${sample === 1 ? "" : "s"} &middot; ${sampleNote}</div>
      </div>`;
    })
    .join("");

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1e293b;">
    <h1 style="font-size:22px;margin:0 0 8px;color:#0f172a;">Price update — ${month}</h1>
    <p style="font-size:14px;line-height:1.6;margin:0 0 18px;color:#475569;">Iris here. Here's what moved more than 5% in your areas this month.</p>
    ${rows}
    <p style="font-size:14px;line-height:1.6;margin:24px 0 0;color:#475569;">
      Got a real quote? <a href="${SITE_ORIGIN}/analyze-my-quote.html" style="color:#1d4ed8;">Send it over</a> and I'll tell you if it's fair. Every submission sharpens the numbers for your neighbors.
    </p>
    <p style="font-size:14px;line-height:1.6;margin:14px 0 0;color:#475569;">— Iris</p>
  </div>`;

  return { subject, html };
}

// Exported for testing / preview.
export const _internal = { titleCaseService, formatLocation };
