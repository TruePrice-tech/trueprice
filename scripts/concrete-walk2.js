// Re-walk: click "Yes" on fixture 06 confirmation; let compare finish all 3; mobile snapshot
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "concrete-walk-2026-04-27");
const BASE = process.env.BASE || "https://woogoro.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name, full = false) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  console.log(`  shot${full ? " (full)" : ""}: ${name}`);
}

async function dump(page, name) {
  const txt = await page.evaluate(() => (document.querySelector("main")?.innerText || "").slice(0, 6000));
  fs.writeFileSync(path.join(OUT, `${name}.txt`), txt);
  console.log(`  dump: ${name}.txt (${txt.length} chars)`);
}

async function newPage(browser, label) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (req.url().includes("/api/geocode-suggest")) {
      req.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ suggestions: [] }) });
    } else {
      req.continue();
    }
  });
  page.on("console", (m) => {
    const t = m.text();
    if (/error|fail|verdict|TP_Engine|400|500/i.test(t)) console.log(`  [${label}]`, m.type(), t.substring(0, 220));
  });
  page.on("pageerror", (e) => console.log(`  [${label} pageerror]`, e.message));
  return page;
}

(async () => {
  const browser = await puppeteer.launch({ headless: false, args: ["--no-sandbox"], defaultViewport: null });

  // ── PATH 2.06 RETRY: click "Yes" to confirm and see the full verdict ──
  {
    const page = await newPage(browser, "06-retry");
    console.log("\n=== PATH 2.06 retry: click Yes on $12,637 confirmation ===");
    await page.goto(`${BASE}/concrete-quote-analyzer.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await sleep(4000);
    const inp = await page.$('input[type="file"]');
    if (!inp) {
      const html = await page.content();
      console.log("  no file input, page snippet:", html.slice(0, 400));
      await shot(page, "06-retry-NOINPUT");
      await page.close();
      return;
    }
    const fixture = path.join(ROOT, "test-quotes/concrete-images", "06-quote-to-widen-driveway-pour-cement-pad-for-shed-p.png");
    await inp.uploadFile(fixture);
    // Wait for "Yes, analyze this price" button to appear
    let foundYes = false;
    for (let i = 0; i < 40; i++) {
      const ok = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const yes = btns.find((b) => /yes,? analyze/i.test(b.innerText));
        if (yes) { yes.click(); return true; }
        return false;
      });
      if (ok) { foundYes = true; break; }
      await sleep(1000);
    }
    if (!foundYes) console.log("  ! never found Yes button");
    else console.log("  clicked Yes, waiting for verdict...");
    await sleep(4000);
    await shot(page, "analyze-06-confirmed-result", true);
    await dump(page, "analyze-06-confirmed-result");
    await page.close();
  }

  // ── PATH 3 RETRY: wait for all 3 slots to finish parsing before compare ──
  {
    const page = await newPage(browser, "compare-retry");
    console.log("\n=== PATH 3 retry: wait for ALL 3 OCRs before compare ===");
    await page.goto(`${BASE}/compare-concrete-quotes.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);

    const cmpFiles = [
      "comparison-conc-low.png",
      "comparison-conc-mid.png",
      "comparison-conc-high.png"
    ];
    for (let i = 0; i < cmpFiles.length; i++) {
      const fixture = path.join(ROOT, "test-quotes/concrete-images", cmpFiles[i]);
      const inp = await page.$(`#file${i}`);
      if (!inp) continue;
      await inp.uploadFile(fixture);
      console.log(`  uploaded slot ${i}: ${cmpFiles[i]}`);
      await sleep(1500);
    }
    // Wait for "Parsing" to disappear from all slots OR up to 60s
    console.log("  waiting for all parsings to finish...");
    for (let i = 0; i < 60; i++) {
      const stillParsing = await page.evaluate(() => {
        return Array.from(document.querySelectorAll(".cmp-slot")).some((s) => /parsing/i.test(s.innerText || ""));
      });
      if (!stillParsing) { console.log(`  all parsed at ${i}s`); break; }
      await sleep(1000);
    }
    await shot(page, "compare-02b-all-parsed", true);

    // Click compare
    const clicked = await page.evaluate(() => {
      const btn = document.querySelector(".cmp-compare-btn");
      if (btn && !btn.disabled) { btn.click(); return true; }
      return false;
    });
    console.log(`  compare clicked: ${clicked}`);
    await sleep(8000);
    await shot(page, "compare-03b-results", true);
    await dump(page, "compare-03b-results");
    await page.close();
  }

  // ── MOBILE: estimate path on iPhone 14 Pro (390x844) ──
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (req.url().includes("/api/geocode-suggest")) {
        req.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ suggestions: [] }) });
      } else { req.continue(); }
    });
    console.log("\n=== MOBILE: estimate path 390x844 ===");
    await page.goto(`${BASE}/concrete-estimate.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);
    await shot(page, "mobile-01-estimate-landing", true);

    await page.waitForSelector("#addrStreet", { timeout: 10000 });
    await page.evaluate(() => {
      document.getElementById("addrStreet").value = "17064 Laurelmont Ct";
      document.getElementById("addrCity").value = "Fort Mill";
      document.getElementById("addrState").value = "SC";
      document.getElementById("addrZip").value = "29707";
    });
    await page.click("#btnEstimate");
    await sleep(1200);
    await page.evaluate(() => { const o = document.querySelector('#optProject [data-val="concrete_patio"]'); if (o) o.click(); });
    await sleep(500);
    await page.evaluate(() => { const o = document.querySelector('#optSize [data-val="800"]'); if (o) o.click(); });
    await sleep(500);
    await page.evaluate(() => { const o = document.querySelector('#optThick [data-val="4"]'); if (o) o.click(); });
    await sleep(500);
    await page.evaluate(() => { const o = document.querySelector('#optDemo [data-val="no"]'); if (o) o.click(); });
    await sleep(2000);
    await shot(page, "mobile-02-estimate-result", true);
    await page.close();
  }

  await browser.close();
  console.log("\nDONE2 — output:", OUT);
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
