// Electrical deep-dive walk: estimate (Lane's address, 4 service types) + analyze (real fixtures) + compare (3 fixtures)
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "electrical-walk-2026-04-27");
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
    if (/error|fail|verdict|TP_Engine|400|500/i.test(t)) console.log(`  [${label} console]`, m.type(), t.substring(0, 240));
  });
  page.on("pageerror", (e) => console.log(`  [${label} pageerror]`, e.message));
  return page;
}

async function dumpResultText(page, name) {
  const txt = await page.evaluate(() => {
    const el = document.getElementById("elecApp") || document.querySelector("main");
    return el ? (el.innerText || "").slice(0, 4000) : "(no elecApp)";
  });
  fs.writeFileSync(path.join(OUT, `${name}.txt`), txt);
  console.log(`  dump: ${name}.txt (${txt.length} chars)`);
}

async function fillAddress(page) {
  await page.waitForSelector("#addrStreet", { timeout: 10000 });
  await page.evaluate(() => {
    document.getElementById("addrStreet").value = "17064 Laurelmont Ct";
    document.getElementById("addrCity").value = "Fort Mill";
    document.getElementById("addrState").value = "SC";
    document.getElementById("addrZip").value = "29707";
  });
  await sleep(300);
}

async function pickOption(page, containerSel, val) {
  await page.evaluate(({ containerSel, val }) => {
    const o = document.querySelector(`${containerSel} [data-val="${val}"]`);
    if (o) o.click();
  }, { containerSel, val });
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  // ─── PATH 1: ESTIMATE — multiple service types ────────────────────
  const estimateScenarios = [
    { id: "panel", svc: "panel_upgrade", age: "2000_plus", urgency: "soon", note: "Panel upgrade, modern home, soon" },
    { id: "ev",    svc: "ev_charger",    age: "2000_plus", urgency: "routine", note: "EV charger, modern home" },
    { id: "gen",   svc: "generator",     age: "2000_plus", urgency: "routine", note: "Whole-home generator" },
    { id: "rewire",svc: "whole_house_rewire", age: "pre1970", urgency: "routine", note: "Whole-house rewire pre1970 K&T" }
  ];

  for (const sc of estimateScenarios) {
    const page = await newPage(browser, `est-${sc.id}`);
    console.log(`\n=== EST ${sc.id} — ${sc.note} ===`);
    await page.goto(`${BASE}/electrical-estimate.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);
    await fillAddress(page);
    await shot(page, `est-${sc.id}-01-address`);

    await page.click("#btnEstimate");
    await sleep(1500);

    // Step 1: service type
    await pickOption(page, "#optService", sc.svc);
    await sleep(800);
    await shot(page, `est-${sc.id}-02-step2`);

    // Step 2: home sqft (use sqftNext button)
    const sqftBtn = await page.$("#sqftNext");
    if (sqftBtn) {
      // Manual entry fallback
      await page.evaluate(() => {
        const inp = document.getElementById("sqftInput");
        if (inp) { inp.value = 3200; inp.dispatchEvent(new Event("input", {bubbles:true})); }
      });
      await sleep(400);
      await page.click("#sqftNext");
      await sleep(1000);
    }
    await shot(page, `est-${sc.id}-03-step3`);

    // Step 3: home age
    await pickOption(page, "#optAge", sc.age);
    await sleep(800);
    await shot(page, `est-${sc.id}-04-step4`);

    // Step 4: urgency (auto-calculates)
    await pickOption(page, "#optUrg", sc.urgency);
    await sleep(2500);
    await shot(page, `est-${sc.id}-05-result-top`);
    await shot(page, `est-${sc.id}-05-result-full`, true);
    await dumpResultText(page, `est-${sc.id}-05-result`);

    await page.close();
  }

  // ─── PATH 2: ANALYZE — real fixtures ────────────────────
  const fixtures = [
    { id: "extra-11", file: "real-world/electrical-extra-11.png",  note: "$9,432 description-of-work table, panel + service entrance + bonding" },
    { id: "extra-12", file: "real-world/electrical-extra-12.jpg",  note: "$3,487.53 estimate, 25x recessed lights + 250' 14/2 + GFI bell box" },
    { id: "extra-13", file: "real-world/electrical-extra-13.jpg",  note: "ugly old fuse panel photo (NOT a quote)" },
    { id: "extra-14", file: "real-world/electrical-extra-14.png",  note: "bootleg-electrician text post (NOT a quote, dup of -02)" },
    { id: "rw-01",    file: "real-world/electrical-01.jpg",        note: "Cutler-Hammer panel sticker (NOT a quote)" },
    { id: "rw-03",    file: "real-world/electrical-03.jpg",        note: "Estimate Details for 125A panel + subpanel Zinsco replacement (no total visible)" },
    { id: "messy-07", file: "messy/electrical--07-did-i-lowball-myself-on-this-side-job.jpeg", note: "$4,588.74 hand-drawn 125A panel install side job" }
  ];

  for (const fx of fixtures) {
    const page = await newPage(browser, `ana-${fx.id}`);
    console.log(`\n=== ANALYZE ${fx.id} — ${fx.note} ===`);
    await page.goto(`${BASE}/electrical-quote-analyzer.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);
    // Fill address before upload (analyzer uses it for benchmark city mult)
    try { await fillAddress(page); } catch (_e) {}

    const fixture = path.join(ROOT, "test-quotes", fx.file);
    if (!fs.existsSync(fixture)) {
      console.log(`  [skip ${fx.id}] fixture not found at ${fixture}`);
      await page.close();
      continue;
    }
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) { console.log(`  [skip ${fx.id}] no file input`); await page.close(); continue; }
    await fileInput.uploadFile(fixture);
    console.log(`  uploaded: ${fx.file}`);

    const start = Date.now();
    let got = false;
    while (Date.now() - start < 90000) {
      await sleep(1500);
      const seen = await page.evaluate(() => {
        const t = (document.getElementById("elecApp")?.innerText || "");
        return /Verdict|Fair Price|Above Average|Below Average|Overpriced|Unusually|couldn|manual|Confirm/i.test(t);
      });
      if (seen) { got = true; break; }
    }
    // If price-confirm screen, accept the suggested price
    const hasConfirm = await page.evaluate(() => /Confirm|Looks right|Continue/i.test(document.getElementById("elecApp")?.innerText || ""));
    if (hasConfirm) {
      await shot(page, `ana-${fx.id}-priceconfirm`, true);
      await dumpResultText(page, `ana-${fx.id}-priceconfirm`);
      // try to click confirm/continue button
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const b = btns.find(x => /confirm|looks right|continue/i.test(x.textContent || ""));
        if (b) b.click();
      });
      await sleep(2500);
    }
    await shot(page, `ana-${fx.id}-result`, true);
    await dumpResultText(page, `ana-${fx.id}-result`);
    if (!got) console.log(`  [${fx.id}] timed out waiting for result`);

    await page.close();
  }

  // ─── PATH 3: COMPARE — 3 synthetic comparison fixtures ────────────────────
  {
    const page = await newPage(browser, "compare");
    console.log(`\n=== COMPARE — comparison-panel low/mid/high ===`);
    await page.goto(`${BASE}/compare-electrical-quotes.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);
    await shot(page, "cmp-01-landing");

    const cmpFiles = [
      "comparison-panel-01-low.png",
      "comparison-panel-02-mid.png",
      "comparison-panel-03-high.png"
    ];
    for (let i = 0; i < cmpFiles.length; i++) {
      const fixture = path.join(ROOT, "test-quotes/electrical-images", cmpFiles[i]);
      const inp = await page.$(`#file${i}`);
      if (!inp) { console.log(`  [skip] no #file${i}`); continue; }
      await inp.uploadFile(fixture);
      console.log(`  uploaded slot ${i}: ${cmpFiles[i]}`);
      await sleep(2500);
    }
    await shot(page, "cmp-02-after-uploads", true);

    const start = Date.now();
    let clicked = false;
    while (Date.now() - start < 60000) {
      const ok = await page.evaluate(() => {
        const btn = document.querySelector(".cmp-compare-btn, button[onclick*='compare'], #compareBtn");
        if (btn && !btn.disabled) { btn.click(); return true; }
        return false;
      });
      if (ok) { clicked = true; break; }
      await sleep(1500);
    }
    if (clicked) {
      console.log("  clicked compare button");
      await sleep(8000);
    } else {
      console.log("  could not find/click compare button");
    }
    await shot(page, "cmp-03-results", true);
    await dumpResultText(page, "cmp-03-results");
    await page.close();
  }

  await browser.close();
  console.log(`\nDONE — output: ${OUT}`);
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
