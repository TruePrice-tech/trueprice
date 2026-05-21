// Walk-test for concrete-compare AFTER bug 4 + bug 7 + UX 1 + UX 2 fixes.
// Tests:
//  - Bug 4: button should show "Still parsing..." while any slot is in flight
//  - UX 1: verdict should use scope-aware framing
//          (e.g. "Precision Flatwork covers X more scope items for $Y more")
//  - UX 2: Quick Pour's "Sealer NOT included" should render as red X No
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "concrete-compare-postfix-2026-04-27");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  );
  page.on("console", (m) => {
    const t = m.text();
    if (/TP_Engine|verdict|error|fail|undefined/i.test(t)) console.log("  console:", t.substring(0, 240));
  });
  page.on("pageerror", (e) => console.log("  pageerror:", e.message));

  console.log("=== concrete-compare post-fix walk ===");
  await page.goto("https://woogoro.com/compare-concrete-quotes.html", { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector('input[type="file"]', { timeout: 90000 });
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT, "00-landing.png") });

  // Upload all 3 fixtures rapidly so slot 3's parse will still be in flight
  const fixtures = ["comparison-conc-low.png", "comparison-conc-mid.png", "comparison-conc-high.png"];
  const fileInputs = await page.$$('input[type="file"]');
  for (let i = 0; i < 3; i++) {
    await fileInputs[i].uploadFile(path.join(ROOT, "test-quotes/concrete-images", fixtures[i]));
    console.log("  uploaded slot", i, "at", new Date().toISOString());
    await sleep(400); // tiny gap so slot upload events register but parses can still overlap
  }

  // Snap quickly while at least one slot is still parsing
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT, "01-while-parsing.png") });
  const btnTextWhileParsing = await page.evaluate(() => {
    const b = document.getElementById("compareBtn");
    return { text: b ? b.textContent : "MISSING", disabled: b ? b.disabled : null };
  });
  console.log("  Bug 4 check (button while parsing):", JSON.stringify(btnTextWhileParsing));

  // Wait for all 3 slots to finish parsing
  const start = Date.now();
  let allReady = false;
  while (Date.now() - start < 240000) {
    await sleep(2500);
    const state = await page.evaluate(() => {
      const b = document.getElementById("compareBtn");
      return { text: b ? b.textContent : "", disabled: b ? b.disabled : null };
    });
    if (state.text && /^Compare\s+\d/.test(state.text) && !state.disabled) {
      allReady = true;
      console.log("  all slots parsed:", state.text, "after", Math.round((Date.now() - start) / 1000) + "s");
      break;
    }
  }
  await page.screenshot({ path: path.join(OUT, "02-all-parsed.png") });

  if (allReady) {
    await page.click("#compareBtn");
    await sleep(5000);
    await page.screenshot({ path: path.join(OUT, "03-result-top.png") });
    await page.screenshot({ path: path.join(OUT, "04-result-full.png"), fullPage: true });

    const result = await page.evaluate(() => {
      const banner = document.querySelector(".cmp-winner-banner");
      const verdict = banner ? banner.innerText : "MISSING";
      // Scope cells in the table for the cheapest column (Quick Pour)
      const noSpans = Array.from(document.querySelectorAll(".cmp-scope-no")).map((e) => e.parentElement && e.parentElement.parentElement && e.parentElement.parentElement.firstElementChild ? e.parentElement.parentElement.firstElementChild.textContent.trim() : "");
      return {
        verdict: verdict,
        bodySnippet: document.body.innerText.substring(0, 4000),
        redXCount: document.querySelectorAll(".cmp-scope-no").length,
        unclearCount: document.querySelectorAll(".cmp-scope-missing").length,
        includedCount: document.querySelectorAll(".cmp-scope-check").length
      };
    });

    console.log("  UX 1 verdict text:", result.verdict.replace(/\n+/g, " | "));
    console.log("  UX 2 scope render: red X =", result.redXCount, ", unclear =", result.unclearCount, ", included =", result.includedCount);
    fs.writeFileSync(path.join(OUT, "05-result-snapshot.txt"), result.bodySnippet);
  }

  await browser.close();
  console.log("DONE. Output:", OUT);
})().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
