// Medical deep-dive walk: analyzer (7 real fixtures + 3 synthetic CT compare),
// cost-guide read, cost-lookup search, mobile viewport.  Reads as a human.
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "medical-walk-2026-04-27");
const BASE = process.env.BASE || "https://woogoro.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name, full = false) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  console.log(`  shot${full ? " (full)" : ""}: ${name}`);
}

async function newPage(browser, label) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on("console", (m) => {
    const t = m.text();
    if (/error|fail|verdict|TP_Engine|api|400|500|cache|prompt|enrich/i.test(t)) {
      console.log(`  [${label} console] ${m.type()}: ${t.substring(0, 280)}`);
    }
  });
  page.on("pageerror", (e) => console.log(`  [${label} pageerror]`, e.message));
  return page;
}

async function dumpInner(page, sel, name) {
  const txt = await page.evaluate((s) => {
    const el = document.querySelector(s);
    return el ? (el.innerText || "").slice(0, 8000) : "(no element)";
  }, sel);
  fs.writeFileSync(path.join(OUT, `${name}.txt`), txt);
  console.log(`  dump: ${name}.txt (${txt.length} chars)`);
}

async function uploadAndWait(page, filePath, label) {
  const input = await page.waitForSelector("#fileInput", { timeout: 15000 });
  await input.uploadFile(filePath);
  console.log(`  uploaded: ${path.basename(filePath)}`);
  // Wait for verdict card OR error fallback (max ~75s for OCR + Claude)
  for (let i = 0; i < 80; i++) {
    await sleep(1000);
    const ready = await page.evaluate(() => {
      return !!(document.getElementById("mbVerdict") ||
                document.querySelector(".mb-card .mb-btn-primary"));
    });
    if (ready) return true;
  }
  console.log(`  TIMEOUT waiting for ${label}`);
  return false;
}

const FIXTURES = [
  { id: "rw-02", file: "test-quotes/medical-images/02-2000-hospital-bill-for-a-10-minute-visit-to-er-the.jpeg",
    desc: "ER level III 99283 — $3,737 charge, $1,725 patient (after $2,012 ins adj)" },
  { id: "rw-04", file: "test-quotes/medical-images/04-need-advice-doctor-trying-to-double-bill-for-the-s.jpeg",
    desc: "Multi-X-ray + 99205 + 99244 — $988 encounter, possible double bill" },
  { id: "rw-05", file: "test-quotes/medical-images/05-just-got-the-bill-doctor-waited-to-send-stuff-unti.jpeg",
    desc: "ENT surgery 30520/30140/30465/20912 — $11,250 charges, denied medical necessity" },
  { id: "rw-07", file: "test-quotes/medical-images/07-help-complicated-medical-bill-conundrum.jpeg",
    desc: "Labcorp delinquency notice — $451 balance only, no CPTs (edge)" },
  { id: "rw-08", file: "test-quotes/medical-images/08-itemized-medical-bill.png",
    desc: "Pharmacy/IV Therapy itemized — $2,090 subtotal, many HCPCS lines" },
  { id: "rw-09", file: "test-quotes/medical-images/09-asked-for-itemized-bill.jpg",
    desc: "Office visits + collections — $535 charges, $-27 credit balance" },
  { id: "rw-10", file: "test-quotes/medical-images/10-help-international-student-with-1990-surgery-bill.jpeg",
    desc: "Myomectomy CPT 58146 — $6,138 billed, $1,992.77 patient" },
  { id: "syn-ct-low", file: "test-quotes/medical-images/comparison-ct-01-low.png",
    desc: "Synthetic Valley Diagnostic CT abd/pelvis — $1,225 billed, $390 patient" },
  { id: "syn-ct-mid", file: "test-quotes/medical-images/comparison-ct-02-mid.png",
    desc: "Synthetic Banner Outpatient CT abd/pelvis — $2,200 billed, $355 patient" },
  { id: "syn-ct-high", file: "test-quotes/medical-images/comparison-ct-03-high.png",
    desc: "Synthetic Mayo Clinic CT abd/pelvis — $5,930 billed, $579 patient" }
];

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  // ─── PATH 1: ANALYZER — each fixture ─────────────────────────
  for (const fx of FIXTURES) {
    const page = await newPage(browser, fx.id);
    console.log(`\n=== ANALYZER: ${fx.id} :: ${fx.desc} ===`);
    await page.goto(`${BASE}/medical-bill-analyzer.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);
    await shot(page, `${fx.id}-01-landing`);

    const filePath = path.join(ROOT, fx.file);
    if (!fs.existsSync(filePath)) { console.log(`  MISSING: ${filePath}`); await page.close(); continue; }

    const ok = await uploadAndWait(page, filePath, fx.id);
    if (!ok) {
      await shot(page, `${fx.id}-99-timeout`, true);
      await dumpInner(page, "#mbApp", `${fx.id}-99-timeout`);
      await page.close();
      continue;
    }

    await sleep(800);
    await shot(page, `${fx.id}-02-verdict-top`);
    await shot(page, `${fx.id}-03-result-full`, true);
    await dumpInner(page, "#mbApp", `${fx.id}-03-result`);
    await page.close();
  }

  // ─── PATH 2: BUTTONS — start over, share, PDF, email on rw-02 ─
  {
    const page = await newPage(browser, "buttons");
    console.log(`\n=== BUTTONS: rw-02 result-footer + result actions ===`);
    await page.goto(`${BASE}/medical-bill-analyzer.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1000);
    const fx = FIXTURES[0];
    const ok = await uploadAndWait(page, path.join(ROOT, fx.file), "buttons");
    if (ok) {
      await sleep(1000);

      // Result-footer block (rendered by tpRenderResultFooter)
      const buttons = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button, a.mb-btn, a"));
        return btns
          .filter((b) => /save.*pdf|share|start over|home|back to|email|cost guide|cost lookup|look up|compare|notify|feedback/i.test(b.innerText || ""))
          .map((b) => ({ text: (b.innerText || "").slice(0, 80), tag: b.tagName, href: b.href || "" }));
      });
      fs.writeFileSync(path.join(OUT, "buttons-detected.json"), JSON.stringify(buttons, null, 2));
      console.log("  detected buttons:", buttons.length);

      // Try Save PDF (window.print)
      let pdfPath = path.join(OUT, "buttons-pdf-render.pdf");
      try {
        await page.emulateMediaType("print");
        await page.pdf({ path: pdfPath, format: "Letter" });
        console.log("  pdf saved (print emulated)");
      } catch (e) { console.log("  pdf err:", e.message); }
      await page.emulateMediaType("screen");

      // Try Start Over
      try {
        await page.evaluate(() => { if (typeof window.startOver === "function") window.startOver(); });
        await sleep(1000);
        await shot(page, "buttons-after-startover");
      } catch (e) { console.log("  startover err:", e.message); }
    }
    await page.close();
  }

  // ─── PATH 3: COST GUIDE — full page read ─────────────────────
  {
    const page = await newPage(browser, "cost-guide");
    console.log(`\n=== COST GUIDE — read every section ===`);
    await page.goto(`${BASE}/medical-cost-guide.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);
    await shot(page, "guide-01-top");
    await shot(page, "guide-02-full", true);
    await dumpInner(page, "main", "guide-text");
    await page.close();
  }

  // ─── PATH 4: COST LOOKUP — search + synonym + state filter ────
  {
    const page = await newPage(browser, "cost-lookup");
    console.log(`\n=== COST LOOKUP — search MRI brain + strep + 99213 + state SC ===`);
    await page.goto(`${BASE}/medical-cost-lookup.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1000);
    await shot(page, "lookup-01-landing");

    // Direct CPT lookup
    await page.evaluate(() => { document.getElementById("searchInput").value = "99213"; document.getElementById("searchInput").dispatchEvent(new Event("input", { bubbles: true })); });
    await sleep(800);
    await shot(page, "lookup-02-99213");

    // State filter SC
    await page.evaluate(() => { document.getElementById("stateSelect").value = "SC"; document.getElementById("stateSelect").dispatchEvent(new Event("change", { bubbles: true })); });
    await sleep(500);
    await shot(page, "lookup-03-99213-SC");

    // Lay term: MRI brain
    await page.evaluate(() => { const i = document.getElementById("searchInput"); i.value = "MRI brain"; i.dispatchEvent(new Event("input", { bubbles: true })); });
    await sleep(800);
    await shot(page, "lookup-04-mri-brain");

    // Synonym route: strep
    await page.evaluate(() => { const i = document.getElementById("searchInput"); i.value = "strep"; i.dispatchEvent(new Event("input", { bubbles: true })); });
    await sleep(800);
    await shot(page, "lookup-05-strep");
    await dumpInner(page, "#results", "lookup-05-strep-results");

    // Synonym route: broken arm
    await page.evaluate(() => { const i = document.getElementById("searchInput"); i.value = "broken arm"; i.dispatchEvent(new Event("input", { bubbles: true })); });
    await sleep(800);
    await shot(page, "lookup-06-broken-arm");
    await dumpInner(page, "#results", "lookup-06-broken-arm-results");

    // Empty / unknown
    await page.evaluate(() => { const i = document.getElementById("searchInput"); i.value = "zzzqxx"; i.dispatchEvent(new Event("input", { bubbles: true })); });
    await sleep(500);
    await shot(page, "lookup-07-empty");

    await page.close();
  }

  // ─── PATH 5: MOBILE ────────────────────────────────────────
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    page.on("pageerror", (e) => console.log("  [mobile pageerror]", e.message));
    console.log(`\n=== MOBILE 390x844 — analyzer + cost-guide + lookup ===`);
    await page.goto(`${BASE}/medical-bill-analyzer.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);
    await shot(page, "mobile-01-analyzer-landing");

    // Upload one fixture on mobile
    const fx = FIXTURES[0]; // rw-02 ER bill
    const input = await page.waitForSelector("#fileInput", { timeout: 15000 });
    await input.uploadFile(path.join(ROOT, fx.file));
    let ready = false;
    for (let i = 0; i < 80; i++) {
      await sleep(1000);
      ready = await page.evaluate(() => !!document.getElementById("mbVerdict"));
      if (ready) break;
    }
    if (ready) {
      await sleep(500);
      await shot(page, "mobile-02-analyzer-result", true);
    } else {
      await shot(page, "mobile-02-analyzer-timeout", true);
    }

    await page.goto(`${BASE}/medical-cost-guide.html`, { waitUntil: "networkidle2" });
    await sleep(1500);
    await shot(page, "mobile-03-guide", true);

    await page.goto(`${BASE}/medical-cost-lookup.html`, { waitUntil: "networkidle2" });
    await sleep(1000);
    await page.evaluate(() => { const i = document.getElementById("searchInput"); i.value = "99213"; i.dispatchEvent(new Event("input", { bubbles: true })); });
    await sleep(500);
    await shot(page, "mobile-04-lookup-99213", true);

    await page.close();
  }

  await browser.close();
  console.log("\nDONE. Output dir:", OUT);
})();
