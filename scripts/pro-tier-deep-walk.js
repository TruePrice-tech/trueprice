// scripts/pro-tier-deep-walk.js
//
// Drives a real user flow on roofing/hvac/plumbing/electrical/solar
// (analyzer + compare) and captures multiple screenshots per page so I
// can visually inspect each phase. Compare pages upload to multiple
// file inputs so the result actually renders.
//
// Captures per analyzer:
//   <slug>-analyze-1-upload.png       upload state, blank
//   <slug>-analyze-2-after-upload.png  immediately after fileInput.uploadFile
//   <slug>-analyze-3-30s.png           30s after upload (intermediate state)
//   <slug>-analyze-4-final.png         after attempt to drive past intermediate
//   <slug>-analyze-5-pdf.png           after clicking "View full report" if available
//
// Captures per compare:
//   <slug>-compare-1-upload.png    blank state
//   <slug>-compare-2-after-uploads.png  after uploading 2 fixtures
//   <slug>-compare-3-results.png   after compare button + 30s wait

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const BASE = "https://woogoro.com";
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "output", "pro-tier-deep-walk", new Date().toISOString().replace(/[:.]/g, "-"));
const FIX = path.join(ROOT, "test", "receipt", "ocr-cache", "fixtures");

const VERTICALS = [
  { slug: "roofing",    analyzer: "/roofing-quote-analyzer.html",    compare: "/compare-roofing-quotes.html",    fixture: "roofing-gaf-quote.jpeg" },
  { slug: "hvac",       analyzer: "/hvac-quote-analyzer.html",       compare: "/compare-hvac-quotes.html",       fixture: "hvac-clean-invoice.jpeg" },
  { slug: "plumbing",   analyzer: "/plumbing-quote-analyzer.html",   compare: "/compare-plumbing-quotes.html",   fixture: "roofing-gaf-quote.jpeg" },
  { slug: "electrical", analyzer: "/electrical-quote-analyzer.html", compare: "/compare-electrical-quotes.html", fixture: "roofing-gaf-quote.jpeg" },
  { slug: "solar",      analyzer: "/solar-quote-analyzer.html",      compare: "/compare-solar-quotes.html",      fixture: "roofing-gaf-quote.jpeg" },
];

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function findFileInputs(page) {
  return await page.$$('input[type="file"]');
}

async function tryClickByText(page, texts) {
  // Click the first visible button or link that matches any of the texts
  return await page.evaluate((texts) => {
    const candidates = Array.from(document.querySelectorAll("button, a, [role=button], .btn, .ar-btn, [onclick]"));
    for (const t of texts) {
      const tl = t.toLowerCase();
      for (const el of candidates) {
        const txt = (el.textContent || "").trim().toLowerCase();
        if (txt && txt === tl || (txt && txt.includes(tl))) {
          if (el.offsetParent) {
            el.click();
            return { clicked: t, found: true };
          }
        }
      }
    }
    return { found: false };
  }, texts);
}

async function fillRoofingSize(page, sqft) {
  // Try to fill a sqft input
  return await page.evaluate((val) => {
    const inputs = Array.from(document.querySelectorAll("input[type=number], input[type=text]"));
    for (const inp of inputs) {
      const ph = (inp.placeholder || "").toLowerCase();
      const lab = (inp.previousElementSibling?.textContent || "").toLowerCase();
      const id = (inp.id || "").toLowerCase();
      if (id.match(/sqft|size|area/) || ph.match(/sq.?ft|2200|3000/) || lab.match(/sq.?ft|size|area/)) {
        inp.value = String(val);
        inp.dispatchEvent(new Event("input", { bubbles: true }));
        inp.dispatchEvent(new Event("change", { bubbles: true }));
        return { filled: true, id: inp.id };
      }
    }
    return { filled: false };
  }, sqft);
}

async function walkAnalyzer(browser, v) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1800 });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  console.log(`\n[${v.slug}] analyzer ${v.analyzer}`);
  await page.goto(BASE + v.analyzer, { waitUntil: "domcontentloaded", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 2500));
  await shot(page, `${v.slug}-analyze-1-upload.png`);

  // Upload the fixture
  const inputs = await findFileInputs(page);
  if (inputs.length === 0) {
    await shot(page, `${v.slug}-analyze-X-no-input.png`);
    console.log(`  no file input — likely picker page`);
    await page.close();
    return { ok: false, reason: "no_file_input" };
  }
  const fixturePath = path.join(FIX, v.fixture);
  await inputs[0].uploadFile(fixturePath);
  console.log(`  uploaded ${v.fixture}`);
  await new Promise((r) => setTimeout(r, 3000));
  await shot(page, `${v.slug}-analyze-2-after-upload.png`);

  // Wait 25s for analysis chunks
  await new Promise((r) => setTimeout(r, 25000));
  await shot(page, `${v.slug}-analyze-3-30s.png`);

  // Try to drive past intermediate states. Multiple attempts:
  // (a) HVAC/etc confirmation: "Yes, analyze this price"
  // (b) Roofing size prompt: fill a sqft input
  // (c) Generic "Continue"/"Get Verdict"/"Analyze" buttons
  for (let i = 0; i < 3; i++) {
    const filled = await fillRoofingSize(page, 2200);
    if (filled.filled) console.log(`  filled sqft input (#${filled.id})`);
    const click = await tryClickByText(page, [
      "Yes, analyze this price",
      "Yes, this is right",
      "Get my verdict",
      "Get verdict",
      "Analyze this price",
      "Continue",
    ]);
    if (click.found) console.log(`  clicked: ${click.clicked}`);
    if (!click.found && !filled.filled) break;
    await new Promise((r) => setTimeout(r, 5000));
  }
  await new Promise((r) => setTimeout(r, 8000));
  await shot(page, `${v.slug}-analyze-4-final.png`);

  // Try "View full report" / showShareScreen
  const sharedClicked = await page.evaluate(() => {
    if (typeof window.showShareScreen === "function") {
      window.showShareScreen();
      return true;
    }
    return false;
  });
  if (sharedClicked) {
    await new Promise((r) => setTimeout(r, 3000));
    await shot(page, `${v.slug}-analyze-5-pdf.png`);
    console.log(`  captured pdf/share view`);
  }

  await page.close();
  return { ok: true, errors };
}

async function walkCompare(browser, v) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1800 });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  console.log(`\n[${v.slug}] compare ${v.compare}`);
  await page.goto(BASE + v.compare, { waitUntil: "domcontentloaded", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 2500));
  await shot(page, `${v.slug}-compare-1-upload.png`);

  // Find all file inputs and upload to first 2
  const inputs = await findFileInputs(page);
  console.log(`  found ${inputs.length} file inputs`);
  const fixturePath = path.join(FIX, v.fixture);
  if (inputs.length >= 1) await inputs[0].uploadFile(fixturePath);
  if (inputs.length >= 2) {
    await new Promise((r) => setTimeout(r, 1500));
    await inputs[1].uploadFile(fixturePath);
  }
  await new Promise((r) => setTimeout(r, 3000));
  await shot(page, `${v.slug}-compare-2-after-uploads.png`);

  // Click "Compare" / equivalent
  const click = await tryClickByText(page, [
    "Compare quotes",
    "Compare these quotes",
    "Compare 2 quotes",
    "Compare 3 quotes",
    "Show comparison",
    "Show me the comparison",
    "See comparison",
    "Compare",
  ]);
  if (click.found) console.log(`  clicked: ${click.clicked}`);

  await new Promise((r) => setTimeout(r, 30000));
  await shot(page, `${v.slug}-compare-3-results.png`);

  await page.close();
  return { ok: true, errors };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  console.log(`Deep walk -> ${OUT}`);
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  for (const v of VERTICALS) {
    try { await walkAnalyzer(browser, v); } catch (e) { console.error(`analyzer ${v.slug}:`, e.message); }
    try { await walkCompare(browser, v); } catch (e) { console.error(`compare ${v.slug}:`, e.message); }
  }

  await browser.close();
  console.log(`\nDone. Screenshots: ${OUT}`);
})();
