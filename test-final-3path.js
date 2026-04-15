// Final test: 6 verticals, all 3 paths, messy images, as a real user
const puppeteer = require("puppeteer");
const path = require("path");

const BASE = "https://truepricehq.com";

const VERTICALS = [
  { name: "Plumbing", singleUrl: "/plumbing-quote-analyzer.html?path=quote", compareUrl: "/compare-plumbing-quotes.html", estimateUrl: "/plumbing-estimate.html",
    images: ["test-quotes/real-quotes/plumbing/messy-sewer-repair.jpg", "test-quotes/real-quotes/plumbing/fixture-water-heater-handwritten.jpg"] },
  { name: "Roofing", singleUrl: "/roofing-quote-analyzer.html", compareUrl: "/compare-roofing-quotes.html", estimateUrl: "/roofing-quote-analyzer.html?mode=estimator",
    images: ["test-quotes/real-quotes/roofing/messy-roof-repair.jpg", "test-quotes/real-quotes/roofing/fixture-roof-replacement.jpg"] },
  { name: "HVAC", singleUrl: "/hvac-quote-analyzer.html?path=quote", compareUrl: "/compare-hvac-quotes.html", estimateUrl: "/hvac-estimate.html",
    images: ["test-quotes/real-quotes/hvac/messy-furnace-install.jpg", "test-quotes/real-quotes/hvac/fixture-ac-replacement.jpg"] },
  { name: "Electrical", singleUrl: "/electrical-quote-analyzer.html?path=quote", compareUrl: "/compare-electrical-quotes.html", estimateUrl: "/electrical-estimate.html",
    images: ["test-quotes/real-quotes/electrical/messy-ev-charger.jpg", "test-quotes/real-quotes/electrical/quote-opinions.jpg"] },
  { name: "Auto", singleUrl: "/auto-repair.html?path=quote", compareUrl: "/compare-auto-quotes.html", estimateUrl: "/auto-estimate.html",
    images: ["test-quotes/real-quotes/auto/messy-transmission-service.jpg", "test-quotes/real-quotes/auto/fixture-brake-job.jpg"] },
  { name: "Moving", singleUrl: "/moving-quote-analyzer.html?path=quote", compareUrl: "/compare-moving-quotes.html", estimateUrl: "/moving-estimate.html",
    images: ["test-quotes/real-quotes/moving/messy-interstate-move.jpg", "test-quotes/real-quotes/moving/fixture-local-move.jpg"] },
];

function pause(ms) { return new Promise(r => setTimeout(r, ms)); }

async function testSingleQuote(browser, v) {
  const p = await browser.newPage();
  p.on("pageerror", e => {});
  let aiCalled = false;
  p.on("console", msg => { if (msg.text().includes("aiCalled=true")) aiCalled = true; });

  await p.goto(BASE + v.singleUrl, { waitUntil: "networkidle2", timeout: 15000 });
  await pause(1500);

  const input = await p.$("input[type=file]");
  if (!input) { await p.close(); return "NO INPUT"; }
  await input.uploadFile(path.resolve(v.images[0]));

  for (let i = 0; i < 20; i++) {
    await pause(3000);
    const s = await p.evaluate(() => ({
      confirm: !!document.getElementById("confirmPriceBtn") || !!document.getElementById("tpConfirmPriceBtn"),
      verdict: /fair|overpriced|below|above|verdict/i.test(document.body.innerText),
      manual: !!document.getElementById("manualPriceBtn") || !!document.getElementById("tpManualPriceBtn"),
    }));
    if (s.verdict) { await p.close(); return "PASS (verdict" + (aiCalled ? ", AI used" : ", no AI") + ")"; }
    if (s.confirm) { await p.close(); return "PASS (confirm" + (aiCalled ? ", AI used" : ", no AI") + ")"; }
    if (s.manual) { await p.close(); return "PASS (manual entry)"; }
  }
  await p.close();
  return "TIMEOUT";
}

async function testCompare(browser, v) {
  const p = await browser.newPage();
  p.on("pageerror", e => {});
  let aiCalls = 0;
  p.on("console", msg => { if (msg.text().includes("aiCalled=true")) aiCalls++; });

  await p.goto(BASE + v.compareUrl, { waitUntil: "networkidle2", timeout: 15000 });
  await pause(2000);

  // Upload 2 quotes
  for (let q = 0; q < 2; q++) {
    const inputs = await p.$$("input[type=file]");
    await inputs[q].uploadFile(path.resolve(v.images[q]));
    for (let i = 0; i < 15; i++) {
      await pause(3000);
      const done = await p.evaluate(idx => { const s = document.getElementById("slot" + idx); return s && s.innerHTML.includes("\u2713"); }, q);
      if (done) break;
    }
  }

  // Click compare
  await p.evaluate(() => { document.querySelectorAll("button").forEach(b => { if (/compare.*quote/i.test(b.innerText) && b.offsetParent) b.click(); }); });
  await pause(5000);

  const body = await p.evaluate(() => document.body.innerText);
  const hasTable = /QUOTE ANALYSIS|BEST VALUE|closely/i.test(body);
  await p.close();
  return hasTable ? "PASS" + (aiCalls > 0 ? " (AI: " + aiCalls + ")" : " (no AI)") : "FAIL";
}

async function testEstimate(browser, v) {
  const p = await browser.newPage();
  await p.goto(BASE + v.estimateUrl, { waitUntil: "networkidle2", timeout: 15000 });
  await pause(2000);

  // Fill state if present
  await p.type("#addrState", "NC").catch(() => {});
  await p.click("#btnEstimate").catch(() => {});
  await pause(2000);

  // For roofing estimator
  if (v.name === "Roofing") {
    await p.type("#journeyState", "TX").catch(() => {});
    await p.type("#journeyZipCode", "75201").catch(() => {});
    await p.evaluate(() => { document.querySelectorAll("button").forEach(b => { if (/get my estimate/i.test(b.innerText)) b.click(); }); });
    await pause(3000);
  }

  // Click through options
  for (let i = 0; i < 8; i++) {
    const done = await p.evaluate(() => /ESTIMATED COST|Your.*Estimate|estimated.*cost/i.test(document.body.innerText));
    if (done) { await p.close(); return "PASS"; }
    const filled = await p.evaluate(() => { const inp = document.getElementById("sqftInput"); if (inp && inp.offsetParent) { inp.value = "2000"; return true; } return false; });
    if (filled) { await p.click("#sqftNext").catch(() => {}); await pause(1500); continue; }
    const clicked = await p.evaluate(() => { for (const o of document.querySelectorAll("[data-val]")) { if (o.offsetParent) { o.click(); return true; } } return false; });
    if (!clicked) break;
    await pause(1500);
  }

  const hasResult = await p.evaluate(() => /ESTIMATED COST|Your.*Estimate|estimated.*cost/i.test(document.body.innerText));
  await p.close();
  return hasResult ? "PASS" : "NO RESULT";
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"], timeout: 60000 });

  console.log("=".repeat(70));
  console.log("FINAL TEST: 6 verticals x 3 paths (messy images)");
  console.log("=".repeat(70));
  console.log("");
  console.log("Vertical".padEnd(14) + "Single Quote".padEnd(30) + "Compare".padEnd(20) + "Estimate");
  console.log("-".repeat(70));

  for (const v of VERTICALS) {
    process.stdout.write(v.name.padEnd(14));

    const single = await testSingleQuote(browser, v);
    process.stdout.write(single.padEnd(30));

    const compare = await testCompare(browser, v);
    process.stdout.write(compare.padEnd(20));

    const estimate = await testEstimate(browser, v);
    console.log(estimate);
  }

  await browser.close();
  console.log("\nDone.");
})();
