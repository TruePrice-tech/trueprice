// Solar deep dive: estimate (Lane's address) + 7 real Reddit fixtures + compare
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "solar-walk-2026-04-27");
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
    if (/error|fail|TP_Engine|400|verdict/i.test(t)) console.log(`  [${label} console]`, m.type(), t.substring(0, 240));
  });
  page.on("pageerror", (e) => console.log(`  [${label} pageerror]`, e.message));
  return page;
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  // ─── PATH 1: ESTIMATE — Lane's address ─────────────────────────────
  {
    const page = await newPage(browser, "estimate");
    console.log("\n=== PATH 1: SOLAR ESTIMATE — Fort Mill SC, 8 kW medium mid-tier Enphase no-battery good-roof ===");
    await page.goto(`${BASE}/solar-estimate.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);
    await shot(page, "01-estimate-landing");

    await page.waitForSelector("#addrStreet", { timeout: 10000 });
    await page.evaluate(() => {
      document.getElementById("addrStreet").value = "17064 Laurelmont Ct";
      document.getElementById("addrCity").value = "Fort Mill";
      document.getElementById("addrState").value = "SC";
      document.getElementById("addrZip").value = "29707";
    });
    await sleep(300);
    await shot(page, "02-estimate-address-filled");

    await page.click("#btnEstimate");
    await sleep(2500); // OSM lookup
    await shot(page, "03-estimate-step1-size");

    // Step 1: Medium (7-9 kW)
    await page.evaluate(() => { const o = document.querySelector('#optSize [data-val="medium"]'); if (o) o.click(); });
    await sleep(800);
    await shot(page, "04-estimate-step2-tier");

    // Step 2: Mid tier
    await page.evaluate(() => { const o = document.querySelector('#optTier [data-val="mid"]'); if (o) o.click(); });
    await sleep(800);
    await shot(page, "05-estimate-step3-inverter");

    // Step 3: microinverter (Enphase)
    await page.evaluate(() => { const o = document.querySelector('#optInverter [data-val="microinverter"]'); if (o) o.click(); });
    await sleep(800);
    await shot(page, "06-estimate-step4-battery");

    // Step 4: no battery
    await page.evaluate(() => { const o = document.querySelector('#optBattery [data-val="none"]'); if (o) o.click(); });
    await sleep(800);
    await shot(page, "07-estimate-step5-roof");

    // Step 5: good roof
    await page.evaluate(() => { const o = document.querySelector('#optRoof [data-val="good"]'); if (o) o.click(); });
    await sleep(800);
    await shot(page, "08-estimate-step6-urgency");

    // Step 6: this_year
    await page.evaluate(() => { const o = document.querySelector('#optUrg [data-val="this_year"]'); if (o) o.click(); });
    await sleep(2500);
    await shot(page, "09-estimate-result-top");
    await shot(page, "10-estimate-result-full", true);

    await page.close();
  }

  // ─── PATH 2: ANALYZE — 7 real Reddit fixtures ──────────────────────
  const fixtures = [
    { id: "03", file: "03-power-bill-is-ridiculous-talk-me-out-of-a-solar-le.jpeg", note: "LightReach lease, 8 kW, $148/mo" },
    { id: "04", file: "04-how-does-my-solar-quote-look-thx-in-advance-nc-duk.jpg", note: "8MSolar 13.14 kW, $31,993 gross / $23,674 net, $2.43/W" },
    { id: "05", file: "05-has-any-seen-huge-differences-in-solar-panel-quote.png", note: "Sunrun comparison side-by-side" },
    { id: "06", file: "06-17600kw-system-with-2-powerwalls-98k-central-flori.png", note: "17.6 kW + 2 Powerwalls $98K, $5.59/W (overpriced)" },
    { id: "08", file: "08-a-quote-from-alibabacom-for-solar-panels.jpeg", note: "Alibaba 10 panels parts only $1,779.82" },
    { id: "09", file: "09-just-getting-started-heres-my-first-quote-after-pe.jpg", note: "Cal Sun 13.6 kW WA, $67,028 loan, $4.93/W" },
    { id: "10", file: "10-am-i-getting-ripped-off.jpeg", note: "Sunnova lease/PPA, $445/mo" }
  ];

  for (const fx of fixtures) {
    const page = await newPage(browser, `analyze-${fx.id}`);
    console.log(`\n=== PATH 2.${fx.id}: ANALYZE — ${fx.note} ===`);
    await page.goto(`${BASE}/solar-quote-analyzer.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);

    const fixture = path.join(ROOT, "test-quotes/solar-images", fx.file);
    await (await page.$('input[type="file"]')).uploadFile(fixture);
    console.log("  uploaded:", fx.file);

    const start1 = Date.now();
    let phase = null; // "confirm" | "verdict_direct"
    while (Date.now() - start1 < 90000) {
      await sleep(2000);
      phase = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const confirmBtn = btns.find(b => /yes,?\s+analyze\s+this\s+price/i.test((b.textContent || "").trim()));
        if (confirmBtn && !confirmBtn.disabled && confirmBtn.offsetParent !== null) return "confirm";
        // Solar lease/wholesale path skips confirmation — verdict renders directly
        const verdictBox = document.querySelector('[class*="-verdict"]');
        const txt = document.body.innerText;
        if (verdictBox && /(Lease|PPA|Parts Only|Fair Price|Above Average|Below Average|Overpriced|Unusually Low|Service Quote|Needs Review)/i.test(txt)) return "verdict_direct";
        return null;
      });
      if (phase) break;
    }
    console.log("  phase:", phase, "after", Math.round((Date.now() - start1) / 1000) + "s");
    await shot(page, `${fx.id}-21-confirm-step`);

    if (phase === "verdict_direct") {
      await sleep(1500);
      await shot(page, `${fx.id}-22-result-top`);
      await shot(page, `${fx.id}-23-result-full`, true);
    } else if (phase === "confirm") {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const target = btns.find(b => /yes,?\s+analyze\s+this\s+price/i.test((b.textContent || "").trim()));
        if (target) target.click();
      });
      const start2 = Date.now();
      let done = false;
      while (Date.now() - start2 < 90000) {
        await sleep(2500);
        done = await page.evaluate(() => {
          const txt = document.body.innerText;
          const inVerdictBox = !!document.querySelector('[class*="-verdict"]');
          const hasVerdict = inVerdictBox && /(Fair Price|Above Average|Higher Than Expected|Below Average|Overpriced|Unusually Low|Service Quote|Needs Review|Estimated Cost|Lease|PPA)/i.test(txt);
          return hasVerdict;
        });
        if (done) break;
      }
      console.log("  rendered:", done, "after", Math.round((Date.now() - start2) / 1000) + "s");
      await sleep(1500);
      await shot(page, `${fx.id}-22-result-top`);
      await shot(page, `${fx.id}-23-result-full`, true);
    }
    await page.close();
  }

  // ─── PATH 3: COMPARE — 3 synthetic real-style fixtures ──────────────
  {
    const page = await newPage(browser, "compare");
    console.log("\n=== PATH 3: COMPARE — 3 synthetic Las Vegas solar quotes ===");
    await page.goto(`${BASE}/compare-solar-quotes.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);

    const cmpFixtures = [
      "comparison-solar-01-low.png",
      "comparison-solar-02-mid.png",
      "comparison-solar-03-high.png"
    ];
    const fileInputs = await page.$$('input[type="file"]');
    for (let i = 0; i < Math.min(cmpFixtures.length, fileInputs.length); i++) {
      await fileInputs[i].uploadFile(path.join(ROOT, "test-quotes/solar-images", cmpFixtures[i]));
      await sleep(700);
    }

    const start1 = Date.now();
    let buttonReady = false;
    while (Date.now() - start1 < 120000) {
      await sleep(2000);
      buttonReady = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const target = btns.find(b => /^Compare\s+3\s+quotes?/i.test((b.textContent || "").trim()));
        return !!(target && !target.disabled && target.offsetParent !== null);
      });
      if (buttonReady) break;
    }
    console.log("  Compare button ready:", buttonReady);
    if (buttonReady) {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const target = btns.find(b => /^Compare\s+3\s+quotes?/i.test((b.textContent || "").trim()));
        if (target) target.click();
      });
      await sleep(4000);
      await shot(page, "30-compare-result-top");
      await shot(page, "31-compare-result-full", true);
    }
    await page.close();
  }

  await browser.close();
  console.log("\nDONE. Output:", OUT);
})().catch(e => { console.error("FATAL:", e); process.exit(1); });
