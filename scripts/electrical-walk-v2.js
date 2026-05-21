// Electrical analyze walk v2: click past price-confirm to capture the actual verdict screen
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "electrical-walk-2026-04-27");
const BASE = process.env.BASE || "https://woogoro.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    if (/error|fail|verdict|TP_Engine|Engine|400|500/i.test(t)) console.log(`  [${label}]`, m.type(), t.substring(0, 240));
  });
  page.on("pageerror", (e) => console.log(`  [${label} pageerror]`, e.message));
  return page;
}

async function dump(page, name) {
  const txt = await page.evaluate(() => {
    const el = document.getElementById("elecApp") || document.querySelector("main");
    return el ? (el.innerText || "").slice(0, 6000) : "(no elecApp)";
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

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  const fixtures = [
    { id: "v2-extra-11", file: "real-world/electrical-extra-11.png", note: "$9,432 desc-of-work bill" },
    { id: "v2-extra-12", file: "real-world/electrical-extra-12.jpg", note: "$3,487 recessed lights" },
    { id: "v2-extra-13", file: "real-world/electrical-extra-13.jpg", note: "ugly panel photo NOT a quote" },
    { id: "v2-rw-01",    file: "real-world/electrical-01.jpg",       note: "Cutler-Hammer panel sticker NOT a quote" },
    { id: "v2-rw-03",    file: "real-world/electrical-03.jpg",       note: "Estimate Details panel+sub Zinsco NO TOTAL VISIBLE" },
    { id: "v2-messy-07", file: "messy/electrical--07-did-i-lowball-myself-on-this-side-job.jpeg", note: "$4,588 hand-drawn 125A install" }
  ];

  for (const fx of fixtures) {
    const page = await newPage(browser, fx.id);
    console.log(`\n=== ${fx.id} — ${fx.note} ===`);
    await page.goto(`${BASE}/electrical-quote-analyzer.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);
    try { await fillAddress(page); } catch (_e) {}

    const fixture = path.join(ROOT, "test-quotes", fx.file);
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) { console.log(`  [skip ${fx.id}]`); await page.close(); continue; }
    await fileInput.uploadFile(fixture);

    // wait for price-confirm or no-price screen
    const start = Date.now();
    let landed = false;
    while (Date.now() - start < 60000) {
      await sleep(1500);
      const t = await page.evaluate(() => document.getElementById("elecApp")?.innerText || "");
      if (/We found your quote total|We couldn|couldn't read/i.test(t)) { landed = true; break; }
    }
    if (!landed) { console.log(`  [${fx.id}] never landed at price-confirm`); await shot(page, `${fx.id}-stuck`, true); await page.close(); continue; }

    await shot(page, `${fx.id}-priceconfirm`, true);
    await dump(page, `${fx.id}-priceconfirm`);

    // Click "Yes, analyze this price" button if present, otherwise type a price and analyze
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const yes = btns.find(b => /Yes,? analyze this price|Analyze this price/i.test((b.textContent || "").trim()));
      if (yes) { yes.click(); return "yes-button"; }
      // No price found case: enter $1000 to drive a verdict
      const input = document.querySelector('input[type="number"], input#manualPrice');
      if (input) {
        input.value = 5000;
        input.dispatchEvent(new Event("input", {bubbles:true}));
        const analyze = btns.find(b => /Analyze (corrected )?(this )?price/i.test((b.textContent || "").trim()));
        if (analyze) { analyze.click(); return "analyze-button"; }
      }
      return "none";
    });
    console.log(`  click: ${clicked}`);
    await sleep(8000);
    await shot(page, `${fx.id}-result`, true);
    await dump(page, `${fx.id}-result`);

    await page.close();
  }

  await browser.close();
  console.log(`\nDONE`);
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
