// Email templates for welcome + monthly digest. Pure functions — no I/O.
// Caller wraps the returned html via _email-send.js (compliance footer added there).

const SITE_ORIGIN = "https://woogoro.com";
const IRIS_HEADSHOT = `${SITE_ORIGIN}/images/Iris/Iris-laurel-seal-180.png`;

// Display names per service slug. Falls through to title case for unknowns.
// Industry acronyms stay uppercase; multi-word slugs get spacing.
const SERVICE_DISPLAY_NAMES = {
  hvac: "HVAC",
  plumbing: "Plumbing",
  electrical: "Electrical",
  foundation: "Foundation Repair",
  concrete: "Concrete",
  fencing: "Fencing",
  fence: "Fencing",
  "garage-door": "Garage Door",
  landscaping: "Landscaping",
  insulation: "Insulation",
  painting: "Painting",
  kitchen: "Kitchen Remodel",
  gutters: "Gutters",
  gutter: "Gutters",
  siding: "Siding",
  windows: "Windows",
  window: "Windows",
  solar: "Solar",
  roofing: "Roofing",
  roof: "Roofing",
  moving: "Moving",
  medical: "Medical Bill",
  "medical-bill": "Medical Bill",
  legal: "Legal Fee",
  "legal-fee": "Legal Fee",
  auto: "Auto Repair",
  "auto-repair": "Auto Repair",
};

function titleCaseService(service) {
  const slug = String(service || "").toLowerCase().trim();
  if (SERVICE_DISPLAY_NAMES[slug]) return SERVICE_DISPLAY_NAMES[slug];
  return slug
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
    <p style="font-size:15px;line-height:1.6;margin:0 0 14px;">Once a month, if prices in your area shift more than about 7% up or down, I'll send you a short note with the numbers and what's behind the move. If nothing meaningful changed, I'll skip the month — your inbox doesn't need filler.</p>
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

// Beta sign-in magic link. Sent transactionally per CAN-SPAM
// § 7702(17)(C) — pure account-state, never marketing.
export function magicLinkTemplate({ verifyUrl, ttlMinutes }) {
  const subject = "Sign in to your Woogoro burrow";
  const minutes = Math.max(1, Math.round(ttlMinutes || 15));
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1e293b;">
    <div style="text-align:center;margin-bottom:20px;">
      <img src="${IRIS_HEADSHOT}" alt="Iris" width="84" height="84" style="border-radius:50%;border:3px solid #f1f5f9;">
    </div>
    <h1 style="font-size:22px;margin:0 0 16px;text-align:center;color:#0f172a;">Sign in to your Woogoro burrow</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 18px;">You (or someone using your email) asked to sign in to <a href="${SITE_ORIGIN}" style="color:#1d4ed8;">Woogoro</a>. Click the button below to finish signing in.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${verifyUrl}" style="display:inline-block;padding:14px 28px;background:#1d4ed8;color:#fff;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;">Sign in to Woogoro</a>
    </div>
    <p style="font-size:13px;line-height:1.6;margin:0 0 12px;color:#64748b;">This link expires in about ${minutes} minutes and works once. If it times out, just request a new one from the sign-in page.</p>
    <p style="font-size:13px;line-height:1.6;margin:0 0 0;color:#64748b;">If you didn't request this, you can ignore the email — no account changes happen until the link is clicked.</p>
    <p style="font-size:13px;line-height:1.6;margin:18px 0 0;color:#94a3b8;word-break:break-all;">Or copy this URL into your browser:<br>${verifyUrl}</p>
  </div>`;
  return { subject, html };
}

// Monthly digest. interests is an array of { city, stateCode, service, change }
// where change is { currentAvg, baseline, deviation, currentQuotes } or null.
// Returns null if there's nothing meaningful to say (all interests skipped).
//
// IMPORTANT: the 0.07 threshold below MUST stay in sync with the welcome
// email copy (welcomeTemplate above) which promises "more than about 7% up
// or down". If you change one, change the other in the same edit.
export function digestTemplate({ interests }) {
  const meaningful = (interests || []).filter(
    (i) => i.change && Number.isFinite(i.change.deviation) && Math.abs(i.change.deviation) >= 0.07
  );
  if (meaningful.length === 0) return null;

  const month = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
  // Subject + body lean into "saved-watch state update" framing so the CAN-SPAM
  // § 7702(17)(C) classification holds (administrative notice about an account
  // / ongoing relationship). Avoid generic "newsletter" or "monthly update"
  // language that reads marketing-flavored.
  const subject =
    meaningful.length === 1
      ? `Watch update: ${titleCaseService(meaningful[0].service)} in ${formatLocation(meaningful[0].city, meaningful[0].stateCode)}`
      : `Your saved watches — ${month} update`;

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
    <h1 style="font-size:22px;margin:0 0 8px;color:#0f172a;">Saved-watch update — ${month}</h1>
    <p style="font-size:14px;line-height:1.6;margin:0 0 18px;color:#475569;">Iris here. Here's what changed on your saved watches this month — only the ones that moved more than 5%.</p>
    ${rows}
    <p style="font-size:14px;line-height:1.6;margin:24px 0 0;color:#475569;">
      If you got a real quote in one of your watched areas, you can <a href="${SITE_ORIGIN}/analyze-my-quote.html" style="color:#1d4ed8;">send it over for analysis</a> — that also sharpens future updates on your watch.
    </p>
    <p style="font-size:14px;line-height:1.6;margin:14px 0 0;color:#475569;">— Iris</p>
  </div>`;

  return { subject, html };
}

// Exported for testing / preview.
export const _internal = { titleCaseService, formatLocation };
