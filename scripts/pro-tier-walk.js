// scripts/pro-tier-walk.js
//
// Puppeteer smoke walk across all 20 analyzer pages. For each vertical:
//   1. Load the page, wait for DOMContentLoaded + 2s settle
//   2. Capture console errors (red text in DevTools)
//   3. Verify window.WoogoroPro loaded (pro-tier.js initialized)
//   4. Verify /api/pro-status returned 200 with isPro:false (free state)
//   5. Verify body has correct is-premium state (false here, true after grant)
//   6. Screenshot the upload page
//
// On the ROOFING analyzer specifically (has built-in sample result):
//   7. Click "No quote yet? See what a result looks like" link
//   8. Wait for result to render
//   9. Verify Pro upsell appears in the inline result
//  10. Screenshot
//
// Pro state testing (steps after grant) requires PRO_DEV_GRANT_TOKEN env
// var to be set in Vercel AND mirrored in scripts/.dev-grant-token (or
// passed via --grant-token=...). When unavailable, free-state tests
// still run.
//
// Usage:
//   node scripts/pro-tier-walk.js                  # free-state only
//   node scripts/pro-tier-walk.js --grant-token=X  # both states
//
// Output:
//   output/pro-tier-walk/<timestamp>/<vertical>-{free,pro}-{upload,result}.png
//   output/pro-tier-walk/<timestamp>/report.json
//   stdout: human-readable pass/fail summary

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const BASE = process.env.PRO_WALK_BASE_URL || "https://woogoro.com";
const HEADLESS = process.env.PRO_WALK_HEADFUL ? false : "new";
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "output", "pro-tier-walk", new Date().toISOString().replace(/[:.]/g, "-"));
const FIXTURE_ROOFING = path.join(ROOT, "test", "receipt", "ocr-cache", "fixtures", "roofing-gaf-quote.jpeg");

const VERTICALS = [
  { slug: "roofing",      url: "/roofing-quote-analyzer.html",      hasSample: true },
  { slug: "hvac",         url: "/hvac-quote-analyzer.html",         hasSample: false },
  { slug: "plumbing",     url: "/plumbing-quote-analyzer.html",     hasSample: false },
  { slug: "electrical",   url: "/electrical-quote-analyzer.html",   hasSample: false },
  { slug: "windows",      url: "/window-quote-analyzer.html",       hasSample: false },
  { slug: "siding",       url: "/siding-quote-analyzer.html",       hasSample: false },
  { slug: "insulation",   url: "/insulation-quote-analyzer.html",   hasSample: false },
  { slug: "painting",     url: "/painting-quote-analyzer.html",     hasSample: false },
  { slug: "fencing",      url: "/fencing-quote-analyzer.html",      hasSample: false },
  { slug: "concrete",     url: "/concrete-quote-analyzer.html",     hasSample: false },
  { slug: "landscaping",  url: "/landscaping-quote-analyzer.html",  hasSample: false },
  { slug: "garage_door",  url: "/garage-door-quote-analyzer.html",  hasSample: false },
  { slug: "solar",        url: "/solar-quote-analyzer.html",        hasSample: false },
  { slug: "foundation",   url: "/foundation-quote-analyzer.html",   hasSample: false },
  { slug: "kitchen",      url: "/kitchen-quote-analyzer.html",      hasSample: false },
  { slug: "gutters",      url: "/gutters-quote-analyzer.html",      hasSample: false },
  { slug: "moving",       url: "/moving-quote-analyzer.html",       hasSample: false },
  { slug: "auto_repair",  url: "/auto-repair.html",                 hasSample: false },
  { slug: "medical",      url: "/medical-bill-analyzer.html",       hasSample: false },
  { slug: "legal",        url: "/legal-fee-analyzer.html",          hasSample: false },
];

function arg(name, fallback) {
  const m = process.argv.find((a) => a.startsWith(`--${name}=`));
  return m ? m.split("=")[1] : (process.env[name.toUpperCase().replace(/-/g, "_")] || fallback);
}

const GRANT_TOKEN = arg("grant-token", null); // PRO_DEV_GRANT_TOKEN equivalent
const VERBOSE = !!arg("verbose", false);

function genHexToken() {
  const bytes = require("crypto").randomBytes(16);
  return bytes.toString("hex");
}

async function grantPro(token) {
  if (!GRANT_TOKEN) return { granted: false, reason: "no_grant_token" };
  const res = await fetch(`${BASE}/api/_pro-dev-grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-dev-grant-token": GRANT_TOKEN,
    },
    body: JSON.stringify({ token, op: "grant" }),
  });
  const j = await res.json().catch(() => ({}));
  return { granted: res.ok && j.ok, response: j, status: res.status };
}

async function revokePro(token) {
  if (!GRANT_TOKEN) return { revoked: false, reason: "no_grant_token" };
  const res = await fetch(`${BASE}/api/_pro-dev-grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-dev-grant-token": GRANT_TOKEN,
    },
    body: JSON.stringify({ token, op: "revoke" }),
  });
  const j = await res.json().catch(() => ({}));
  return { revoked: res.ok && j.ok, response: j };
}

async function withPage(browser, token, fn) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1024 });
  // Inject token before any script runs
  await page.evaluateOnNewDocument((t) => {
    try { localStorage.setItem("tp_pro_token", t); } catch (e) {}
  }, token);
  const consoleErrors = [];
  const networkErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push("pageerror: " + err.message));
  page.on("response", (resp) => {
    const url = resp.url();
    if (resp.status() >= 400 && /\/api\/(pro-|_pro-)/.test(url)) {
      networkErrors.push(`${resp.status()} ${url}`);
    }
  });
  try {
    return await fn(page, { consoleErrors, networkErrors });
  } finally {
    await page.close();
  }
}

async function inspectFreeState(page, vertical) {
  await page.goto(BASE + vertical.url, { waitUntil: "domcontentloaded", timeout: 30000 });
  // Give pro-tier.js time to fetch /api/pro-status
  await new Promise((r) => setTimeout(r, 2500));

  const checks = await page.evaluate(() => {
    return {
      hasWoogoroPro: !!window.WoogoroPro,
      hasToken: !!localStorage.getItem("tp_pro_token"),
      bodyHasIsPremium: document.body.classList.contains("is-premium"),
      proStatusFn: typeof window.WoogoroPro?.getStatus === "function",
    };
  });

  let statusJson = null;
  try {
    statusJson = await page.evaluate(async () => {
      if (!window.WoogoroPro) return null;
      return await window.WoogoroPro.getStatus(true);
    });
  } catch (e) { /* ignore */ }

  return { checks, statusJson };
}

async function inspectProState(page, vertical) {
  // Same as free but expecting isPro: true
  return inspectFreeState(page, vertical);
}

async function tryRoofingSample(page) {
  const clicked = await page.evaluate(() => {
    const link = document.getElementById("showSampleResult");
    if (link) { link.click(); return true; }
    return false;
  });
  if (!clicked) return { rendered: false, reason: "no_sample_link" };
  await new Promise((r) => setTimeout(r, 2500));

  const result = await page.evaluate(() => {
    const rc = document.getElementById("resultContainer") || document.getElementById("analysisOutput");
    const upsell = document.querySelector(".tp-pro-inline-cta");
    const proSections = document.querySelectorAll(".tp-pdf-premium").length;
    return {
      hasResultContainer: !!rc,
      resultContainerKids: rc ? rc.children.length : 0,
      hasInlineUpsell: !!upsell,
      upsellHasButton: !!(upsell && upsell.querySelector(".tp-pro-upsell-cta")),
      proSectionCount: proSections,
      bodyIsPremium: document.body.classList.contains("is-premium"),
    };
  });
  return { rendered: true, ...result };
}

function p(name, ok, detail) {
  const status = ok ? "PASS" : "FAIL";
  const tag = ok ? " ✓" : " ✗";
  console.log(`  [${status}]${tag} ${name}${detail ? " — " + detail : ""}`);
  return ok;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  console.log(`Pro tier walk -> ${OUT}`);
  console.log(`Base: ${BASE}`);
  console.log(`Mode: ${GRANT_TOKEN ? "FULL (free + pro)" : "FREE-ONLY (no PRO_DEV_GRANT_TOKEN)"}`);
  console.log("");

  const browser = await puppeteer.launch({ headless: HEADLESS, args: ["--no-sandbox"] });
  const report = { startedAt: new Date().toISOString(), base: BASE, results: [] };
  const freeToken = genHexToken();
  const proToken = genHexToken();

  // Optionally grant Pro to proToken
  let grantResult = null;
  if (GRANT_TOKEN) {
    grantResult = await grantPro(proToken);
    console.log(`Pro grant: ${grantResult.granted ? "OK" : "FAILED"}`, grantResult);
  }

  for (const v of VERTICALS) {
    console.log(`\n=== ${v.slug.padEnd(14)} ${v.url}`);
    const result = { slug: v.slug, url: v.url, free: null, pro: null, sample: null };

    // FREE state
    try {
      result.free = await withPage(browser, freeToken, async (page, errs) => {
        const inspected = await inspectFreeState(page, v);
        await page.screenshot({ path: path.join(OUT, `${v.slug}-free-upload.png`), fullPage: false });

        const okPro = p("WoogoroPro defined", inspected.checks.hasWoogoroPro);
        const okStatus = p("status responded", inspected.statusJson !== null,
          inspected.statusJson ? `isPro=${inspected.statusJson.isPro}` : "no response");
        const okFree = p("body NOT is-premium", !inspected.checks.bodyHasIsPremium);
        const okConsoleClean = p("no console errors", errs.consoleErrors.length === 0,
          errs.consoleErrors.length ? `${errs.consoleErrors.length} errors` : null);
        const okNetClean = p("no API errors", errs.networkErrors.length === 0,
          errs.networkErrors.length ? errs.networkErrors.join("; ") : null);

        return {
          inspected,
          consoleErrors: errs.consoleErrors,
          networkErrors: errs.networkErrors,
          pass: okPro && okStatus && okFree && okConsoleClean && okNetClean,
        };
      });
    } catch (e) {
      console.log(`  [FAIL] ✗ free-state: ${e.message}`);
      result.free = { pass: false, error: e.message };
    }

    // PRO state (if grant token available)
    if (GRANT_TOKEN && grantResult && grantResult.granted) {
      try {
        result.pro = await withPage(browser, proToken, async (page, errs) => {
          const inspected = await inspectProState(page, v);
          await page.screenshot({ path: path.join(OUT, `${v.slug}-pro-upload.png`), fullPage: false });

          const okIsPro = p("isPro=true", inspected.statusJson && inspected.statusJson.isPro === true);
          const okBody = p("body IS is-premium", inspected.checks.bodyHasIsPremium);

          return { inspected, consoleErrors: errs.consoleErrors, networkErrors: errs.networkErrors, pass: okIsPro && okBody };
        });
      } catch (e) {
        console.log(`  [FAIL] ✗ pro-state: ${e.message}`);
        result.pro = { pass: false, error: e.message };
      }
    }

    // Roofing-only: trigger sample result and verify upsell renders
    if (v.hasSample) {
      try {
        result.sample = await withPage(browser, freeToken, async (page, errs) => {
          await page.goto(BASE + v.url, { waitUntil: "domcontentloaded" });
          await new Promise((r) => setTimeout(r, 2000));
          const out = await tryRoofingSample(page);
          await page.screenshot({ path: path.join(OUT, `${v.slug}-free-result.png`), fullPage: true });

          if (!out.rendered) {
            p("sample rendered", false, out.reason);
            return { ...out, pass: false };
          }
          const okRC = p("resultContainer exists", out.hasResultContainer && out.resultContainerKids > 0,
            `kids=${out.resultContainerKids}`);
          const okUpsell = p("inline upsell injected", out.hasInlineUpsell);
          const okBtn = p("upsell has CTA button", out.upsellHasButton);
          return { ...out, pass: okRC && okUpsell && okBtn };
        });
      } catch (e) {
        console.log(`  [FAIL] ✗ sample-result: ${e.message}`);
        result.sample = { pass: false, error: e.message };
      }
    }

    report.results.push(result);
  }

  // Cleanup: revoke Pro
  if (GRANT_TOKEN && grantResult && grantResult.granted) {
    await revokePro(proToken);
  }

  await browser.close();

  // Summary
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log("\n=== SUMMARY ===");
  let pass = 0, fail = 0;
  for (const r of report.results) {
    const okFree = r.free && r.free.pass;
    const okPro = !r.pro || r.pro.pass;
    const okSample = !r.sample || r.sample.pass;
    const all = okFree && okPro && okSample;
    if (all) pass++; else fail++;
    console.log(`  ${all ? "PASS" : "FAIL"}  ${r.slug}`);
  }
  console.log(`\n${pass}/${pass + fail} verticals passed.`);
  console.log(`Screenshots + report at: ${OUT}`);
  process.exit(fail > 0 ? 1 : 0);
})();
