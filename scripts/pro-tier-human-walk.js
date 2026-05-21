// scripts/pro-tier-human-walk.js
//
// Human-style walk: for each analyzer page, find the upload control,
// upload a fixture (best vertical match), wait for the result to render,
// scroll through, take a fullPage screenshot. Then I (the human or Claude
// reviewing screenshots after the run) can visually verify:
//   - Pro upsell appears in the right place
//   - Layout is sane (Iris not huge, text not clipped, no overflow)
//   - Vertical-specific content is correct
//   - Verdict/data shape makes sense
//   - No JS errors visible to user
//
// Different from pro-tier-walk.js (which is a smoke harness): this one
// drives the actual user flow, not just page-load assertions.
//
// Usage:
//   node scripts/pro-tier-human-walk.js [--grant-token=X] [--only=roofing,hvac,...]
//
// Output:
//   output/pro-tier-human-walk/<timestamp>/<slug>-{free,pro}-{upload,result}.png
//   output/pro-tier-human-walk/<timestamp>/report.json

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const BASE = process.env.PRO_WALK_BASE_URL || "https://woogoro.com";
const HEADLESS = process.env.PRO_WALK_HEADFUL ? false : "new";
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "output", "pro-tier-human-walk", new Date().toISOString().replace(/[:.]/g, "-"));
const FIXTURE_DIR = path.join(ROOT, "test", "receipt", "ocr-cache", "fixtures");

function arg(name, fallback) {
  const m = process.argv.find((a) => a.startsWith(`--${name}=`));
  return m ? m.split("=")[1] : (process.env[name.toUpperCase().replace(/-/g, "_")] || fallback);
}

const GRANT_TOKEN = arg("grant-token", null);
const ONLY = arg("only", "").split(",").filter(Boolean);

// Fixture mapping per vertical. Where we have a vertical-specific fixture,
// use it. Otherwise fall back to a roofing quote (the analyzer will still
// try to OCR/parse and produce SOME result, which is enough for UI smoke).
const FIXTURES = {
  roofing:    "roofing-gaf-quote.jpeg",
  hvac:       "hvac-clean-invoice.jpeg",
  auto_repair:"auto-equinox-quote.jpeg",
  // Fallback to roofing for verticals without specific fixtures
  _default:   "roofing-gaf-quote.jpeg",
};

const VERTICALS = [
  { slug: "roofing",      url: "/roofing-quote-analyzer.html",      fixture: "roofing" },
  { slug: "hvac",         url: "/hvac-quote-analyzer.html",         fixture: "hvac" },
  { slug: "plumbing",     url: "/plumbing-quote-analyzer.html",     fixture: "_default" },
  { slug: "electrical",   url: "/electrical-quote-analyzer.html",   fixture: "_default" },
  { slug: "windows",      url: "/window-quote-analyzer.html",       fixture: "_default" },
  { slug: "siding",       url: "/siding-quote-analyzer.html",       fixture: "_default" },
  { slug: "insulation",   url: "/insulation-quote-analyzer.html",   fixture: "_default" },
  { slug: "painting",     url: "/painting-quote-analyzer.html",     fixture: "_default" },
  { slug: "fencing",      url: "/fencing-quote-analyzer.html",      fixture: "_default" },
  { slug: "concrete",     url: "/concrete-quote-analyzer.html",     fixture: "_default" },
  { slug: "landscaping",  url: "/landscaping-quote-analyzer.html",  fixture: "_default" },
  { slug: "garage_door",  url: "/garage-door-quote-analyzer.html",  fixture: "_default" },
  { slug: "solar",        url: "/solar-quote-analyzer.html",        fixture: "_default" },
  { slug: "foundation",   url: "/foundation-quote-analyzer.html",   fixture: "_default" },
  { slug: "kitchen",      url: "/kitchen-quote-analyzer.html",      fixture: "_default" },
  { slug: "gutters",      url: "/gutters-quote-analyzer.html",      fixture: "_default" },
  { slug: "moving",       url: "/moving-quote-analyzer.html",       fixture: "_default" },
  { slug: "auto_repair",  url: "/auto-repair.html",                 fixture: "auto_repair" },
  { slug: "medical",      url: "/medical-bill-analyzer.html",       fixture: "_default" },
  { slug: "legal",        url: "/legal-fee-analyzer.html",          fixture: "_default" },
];

function genHexToken() {
  return require("crypto").randomBytes(16).toString("hex");
}

async function grantPro(token) {
  if (!GRANT_TOKEN) return { granted: false };
  const res = await fetch(`${BASE}/api/pro-dev-grant`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-dev-grant-token": GRANT_TOKEN },
    body: JSON.stringify({ token, op: "grant" }),
  });
  return { granted: res.ok };
}

async function revokePro(token) {
  if (!GRANT_TOKEN) return;
  await fetch(`${BASE}/api/pro-dev-grant`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-dev-grant-token": GRANT_TOKEN },
    body: JSON.stringify({ token, op: "revoke" }),
  });
}

async function findFileInput(page) {
  // Try a few common selectors. The analyzer's hidden input is usually
  // inside the .upload-card or just after the "Upload it here" button.
  const selectors = [
    'input[type="file"]',
    'input[accept*="image"]',
    'input[accept*="pdf"]',
  ];
  for (const sel of selectors) {
    const el = await page.$(sel);
    if (el) return el;
  }
  return null;
}

async function uploadFixture(page, fixturePath) {
  const input = await findFileInput(page);
  if (!input) return { uploaded: false, reason: "no_file_input" };
  await input.uploadFile(fixturePath);
  return { uploaded: true };
}

async function waitForResult(page, timeoutMs) {
  // Wait for either resultContainer/analysisOutput/etc to populate, OR for
  // ~ a max timeout. Whichever comes first.
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ready = await page.evaluate(() => {
      const ids = ["analysisOutput", "resultContainer"];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.children && el.children.length > 0) return id;
      }
      return null;
    });
    if (ready) return { ready: true, container: ready, ms: Date.now() - start };
    await new Promise((r) => setTimeout(r, 500));
  }
  return { ready: false, ms: timeoutMs };
}

async function captureBodyState(page) {
  return await page.evaluate(() => ({
    bodyClasses: Array.from(document.body.classList),
    isPremium: document.body.classList.contains("is-premium"),
    proUpsell: !!document.querySelector(".tp-pro-inline-cta"),
    proSections: document.querySelectorAll(".tp-pdf-premium").length,
    title: document.title,
    h1: (document.querySelector("h1, .verdict, .report-verdict")?.textContent || "").trim().slice(0, 200),
  }));
}

async function run(browser, vertical, mode, token, fixturePath) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1600 });
  await page.evaluateOnNewDocument((t) => {
    try { localStorage.setItem("tp_pro_token", t); } catch (e) {}
  }, token);

  const consoleErrors = [];
  const networkErrors = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("pageerror", (err) => consoleErrors.push("pageerror: " + err.message));
  page.on("response", (resp) => {
    if (resp.status() >= 400 && /\/api\//.test(resp.url())) {
      networkErrors.push(`${resp.status()} ${resp.url()}`);
    }
  });

  const result = { mode, slug: vertical.slug };

  try {
    await page.goto(BASE + vertical.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 3000)); // let pro-tier.js init

    // Screenshot the upload state
    await page.screenshot({ path: path.join(OUT, `${vertical.slug}-${mode}-upload.png`), fullPage: true });
    result.uploadStateCaptured = true;

    // Upload the fixture
    const upload = await uploadFixture(page, fixturePath);
    result.upload = upload;

    if (upload.uploaded) {
      const wait = await waitForResult(page, 60000);
      result.wait = wait;
      // Settle a bit longer for async chunks (affiliate links, etc.)
      await new Promise((r) => setTimeout(r, 2500));
      await page.screenshot({ path: path.join(OUT, `${vertical.slug}-${mode}-result.png`), fullPage: true });
    }

    result.body = await captureBodyState(page);
    result.consoleErrors = consoleErrors;
    result.networkErrors = networkErrors;

    // Pass criteria:
    //   free: page rendered, no API errors, body NOT is-premium, upsell appeared
    //   pro:  page rendered, no API errors, body IS is-premium, no upsell
    if (mode === "free") {
      result.pass =
        consoleErrors.length === 0 &&
        networkErrors.length === 0 &&
        !result.body.isPremium &&
        (upload.uploaded ? result.body.proUpsell : true);
    } else {
      result.pass =
        consoleErrors.length === 0 &&
        networkErrors.length === 0 &&
        result.body.isPremium &&
        !result.body.proUpsell;
    }
  } catch (e) {
    result.error = e.message;
    result.pass = false;
  } finally {
    await page.close();
  }

  return result;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  console.log(`Human walk -> ${OUT}`);
  console.log(`Mode: ${GRANT_TOKEN ? "FULL (free + pro)" : "FREE-ONLY"}`);

  const browser = await puppeteer.launch({ headless: HEADLESS, args: ["--no-sandbox"] });
  const report = { startedAt: new Date().toISOString(), base: BASE, results: [] };

  const targets = ONLY.length ? VERTICALS.filter((v) => ONLY.includes(v.slug)) : VERTICALS;

  const freeToken = genHexToken();
  const proToken = genHexToken();
  if (GRANT_TOKEN) {
    const g = await grantPro(proToken);
    console.log(`Pro grant: ${g.granted ? "OK" : "FAILED"}`);
  }

  for (const v of targets) {
    const fixtureName = FIXTURES[v.fixture] || FIXTURES._default;
    const fixturePath = path.join(FIXTURE_DIR, fixtureName);

    console.log(`\n=== ${v.slug.padEnd(14)} ${v.url} (fixture: ${fixtureName})`);

    const free = await run(browser, v, "free", freeToken, fixturePath);
    console.log(`  free: ${free.pass ? "PASS" : "FAIL"}  uploaded=${free.upload?.uploaded}  resultReady=${free.wait?.ready}  upsell=${free.body?.proUpsell}  errs=${free.consoleErrors?.length || 0}`);
    if (free.consoleErrors?.length) console.log(`    console: ${free.consoleErrors.slice(0, 3).join(" | ")}`);

    let pro = null;
    if (GRANT_TOKEN) {
      pro = await run(browser, v, "pro", proToken, fixturePath);
      console.log(`  pro:  ${pro.pass ? "PASS" : "FAIL"}  uploaded=${pro.upload?.uploaded}  resultReady=${pro.wait?.ready}  premium=${pro.body?.isPremium}  proSections=${pro.body?.proSections}`);
      if (pro.consoleErrors?.length) console.log(`    console: ${pro.consoleErrors.slice(0, 3).join(" | ")}`);
    }

    report.results.push({ slug: v.slug, url: v.url, fixture: fixtureName, free, pro });
  }

  if (GRANT_TOKEN) await revokePro(proToken);
  await browser.close();

  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));

  console.log("\n=== SUMMARY ===");
  let pass = 0, fail = 0;
  for (const r of report.results) {
    const okFree = r.free && r.free.pass;
    const okPro = !r.pro || r.pro.pass;
    const all = okFree && okPro;
    if (all) pass++; else fail++;
    console.log(`  ${all ? "PASS" : "FAIL"}  ${r.slug}`);
  }
  console.log(`\n${pass}/${pass + fail} verticals passed.`);
  console.log(`Screenshots: ${OUT}`);
  process.exit(fail > 0 ? 1 : 0);
})();
