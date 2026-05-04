const puppeteer = require("puppeteer");
const path = require("path");
const FIXTURES_DIR = process.env.FIX_DIR;

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  // ── Estimate path ──
  console.log("\n=== ESTIMATE PATH ===");
  let page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto("https://woogoro.com/insulation-estimate.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 1500));
  const estTitle = await page.evaluate(() => document.title);
  const estH1 = await page.evaluate(() => (document.querySelector("h1") || {}).innerText || "");
  const hasFile = await page.evaluate(() => !!document.querySelector('input[type="file"]'));
  console.log("title:", estTitle);
  console.log("h1:", estH1);
  console.log("hasFileInput:", hasFile);
  // Capture all visible text headings on initial view
  const sections = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("h1, h2, h3, h4, [data-step]")).slice(0, 30).map(el => ({
      tag: el.tagName,
      text: (el.innerText || "").trim().slice(0, 100),
    }));
  });
  console.log("sections:");
  sections.forEach(s => console.log(`  ${s.tag}: ${s.text}`));
  // Try to see what initial step renders
  const initialBody = await page.evaluate(() => document.body.innerText.slice(0, 800));
  console.log("body slice:", initialBody.slice(0, 500));
  await page.close();

  // ── Compare path ──
  console.log("\n=== COMPARE PATH ===");
  page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto("https://woogoro.com/compare-insulation-quotes.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 1500));
  const cmpTitle = await page.evaluate(() => document.title);
  const cmpH1 = await page.evaluate(() => (document.querySelector("h1") || {}).innerText || "");
  console.log("title:", cmpTitle);
  console.log("h1:", cmpH1);
  const cmpInputs = await page.evaluate(() => document.querySelectorAll('input[type="file"]').length);
  console.log("file inputs:", cmpInputs);
  const cmpBody = await page.evaluate(() => document.body.innerText.slice(0, 600));
  console.log("body slice:", cmpBody.slice(0, 400));

  // Upload all 3 clean fixtures and trigger compare
  const inputs = await page.$$('input[type="file"]');
  if (inputs.length >= 3) {
    await inputs[0].uploadFile(path.join(FIXTURES_DIR, "test-quotes/insulation-images/comparison-insul-high.png"));
    await new Promise(r => setTimeout(r, 1000));
    await inputs[1].uploadFile(path.join(FIXTURES_DIR, "test-quotes/insulation-images/comparison-insul-mid.png"));
    await new Promise(r => setTimeout(r, 1000));
    await inputs[2].uploadFile(path.join(FIXTURES_DIR, "test-quotes/insulation-images/comparison-insul-low.png"));
    await new Promise(r => setTimeout(r, 1500));
    // Find the "Compare" / "Analyze" button
    const cmpBtnText = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      return btns.map(b => (b.innerText || "").trim()).slice(0, 20);
    });
    console.log("buttons after upload:", cmpBtnText);
    // Click first non-disabled button that says compare/analyze/get
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const target = btns.find(b => /compare|analy[sz]e|get\s+verdict|see\s+results|continue/i.test(b.innerText || "") && !b.disabled);
      if (target) target.click();
    });
    await new Promise(r => setTimeout(r, 90000)); // wait up to 90s for compare to finish
    const cmpResultBody = await page.evaluate(() => document.body.innerText.slice(0, 4000));
    console.log("\n--- compare result body ---");
    console.log(cmpResultBody.slice(0, 3500));
  } else {
    console.log("Could not find 3 file inputs on compare page");
  }
  await page.close();

  await browser.close();
})();
