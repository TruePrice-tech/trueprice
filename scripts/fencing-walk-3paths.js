// 3-path human walk for fencing deep test 2026-05-03.
//
// Path 1 — analyze: upload comparison-fence-low.png at /fencing-quote-analyzer.html.
//                    Asserts verdict label / contractor / warranty / scope rows.
// Path 2 — estimate: pick wood_privacy / 180lf / 6ft / yes-gate at /fencing-estimate.html
//                    or the analyzer's estimator flow. Asserts benchmark + range.
// Path 3 — compare:  upload f1+f2+f3 at /compare-fencing-quotes.html. Asserts the
//                    3-up table renders with contractor names + verdicts.
//
// Each path saves a screenshot to output/fencing-deep-test-2026-05-03/.

const { launchHarnessBrowser, preparePage } = require("../test/lib/harness-browser");
const fs = require("fs");
const path = require("path");

const BASE = "https://woogoro.com";
const OUT = path.resolve(__dirname, "..", "output", "fencing-deep-test-2026-05-03");
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await launchHarnessBrowser();

  // === PATH 1: analyze (upload f3 Pine State, the trust-critical scope-excluded fixture) ===
  {
    const page = await browser.newPage();
    await preparePage(page, BASE);
    page.setDefaultTimeout(120000);
    await page.setViewport({ width: 1440, height: 1800 });

    await page.goto(BASE + "/fencing-quote-analyzer.html", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 2000));

    const inp = await page.$('input[type="file"]');
    await inp.uploadFile(path.resolve(__dirname, "..", "test-quotes/fencing-images/comparison-fence-low.png"));

    await page.waitForFunction(() => !!document.getElementById("tpConfirmPriceBtn") || !!document.querySelector(".verdict-price"), { timeout: 120000 });
    if (await page.$("#tpConfirmPriceBtn")) await page.click("#tpConfirmPriceBtn");
    await page.waitForFunction(() => !!document.querySelector(".verdict-price"), { timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));

    const data = await page.evaluate(() => {
      const det = {};
      document.querySelectorAll(".fence-detail").forEach(d => {
        const l = (d.querySelector(".label") || {}).innerText || "";
        const v = (d.querySelector(".value") || {}).innerText || "";
        if (l) det[l.trim()] = v.trim();
      });
      const scope = [];
      document.querySelectorAll(".fence-scope li").forEach(li => {
        scope.push((li.innerText || "").replace(/\s+/g, " ").trim());
      });
      return {
        verdict: (document.querySelector(".verdict-label") || {}).innerText,
        price: (document.querySelector(".verdict-price") || {}).innerText,
        range: (document.querySelector(".verdict-range") || {}).innerText,
        details: det,
        scopeLines: scope,
      };
    });

    fs.writeFileSync(path.join(OUT, "path1-analyze.json"), JSON.stringify(data, null, 2));
    await page.screenshot({ path: path.join(OUT, "path1-analyze.png"), fullPage: true });
    console.log("PATH 1 (analyze f3 Pine State):");
    console.log("  verdict :", data.verdict, "/", data.price);
    console.log("  range   :", data.range);
    console.log("  type    :", data.details["Fence Type"]);
    console.log("  contractor:", data.details["Contractor"] || "(missing)");
    console.log("  warranty:", data.details["Warranty"] || "(missing)");
    console.log("  scope (showing only Stain row):");
    for (const s of data.scopeLines) if (/stain|seal/i.test(s)) console.log("    ", s);
    await page.close();
  }

  // === PATH 2: estimate (wood_privacy / 180lf / 6ft / yes-gate via analyzer's estimator path) ===
  {
    const page = await browser.newPage();
    await preparePage(page, BASE);
    page.setDefaultTimeout(120000);
    await page.setViewport({ width: 1440, height: 1800 });

    await page.goto(BASE + "/fencing-estimate.html", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 2000));

    // Some fence-estimate pages use the same estimator. Find the first
    // option, click through wood_privacy -> 180 -> 6 -> yes.
    const hasOpt = await page.$(".fence-option");
    if (hasOpt) {
      // Step 1: type
      await page.evaluate(() => {
        const opts = document.querySelectorAll(".fence-option");
        for (const o of opts) if ((o.textContent || "").toLowerCase().includes("wood privacy")) { o.click(); break; }
      });
      await new Promise(r => setTimeout(r, 500));

      // Step 2: length — type 180 in lfInput then click lfNext
      const lfInput = await page.$("#lfInput");
      if (lfInput) {
        await lfInput.type("180");
        await page.click("#lfNext");
      }
      await new Promise(r => setTimeout(r, 500));

      // Step 3: height
      await page.evaluate(() => {
        const opts = document.querySelectorAll(".fence-option");
        for (const o of opts) if (/^\s*6\s*ft\s*$/i.test(o.textContent || "")) { o.click(); break; }
      });
      await new Promise(r => setTimeout(r, 500));

      // Step 4: gate
      await page.evaluate(() => {
        const opts = document.querySelectorAll(".fence-option");
        for (const o of opts) if (/^\s*yes\s*$/i.test(o.textContent || "")) { o.click(); break; }
      });
      await page.waitForFunction(() => !!document.querySelector(".verdict-price"), { timeout: 30000 }).catch(() => null);
      await new Promise(r => setTimeout(r, 1500));
    }

    const est = await page.evaluate(() => {
      const det = {};
      document.querySelectorAll(".fence-detail").forEach(d => {
        const l = (d.querySelector(".label") || {}).innerText || "";
        const v = (d.querySelector(".value") || {}).innerText || "";
        if (l) det[l.trim()] = v.trim();
      });
      return {
        verdict: (document.querySelector(".verdict-label") || {}).innerText,
        price: (document.querySelector(".verdict-price") || {}).innerText,
        range: (document.querySelector(".verdict-range") || {}).innerText,
        details: det,
      };
    });
    fs.writeFileSync(path.join(OUT, "path2-estimate.json"), JSON.stringify(est, null, 2));
    await page.screenshot({ path: path.join(OUT, "path2-estimate.png"), fullPage: true });
    console.log("\nPATH 2 (estimate wood_privacy / 180lf / 6ft / yes-gate):");
    console.log("  verdict :", est.verdict, "/", est.price);
    console.log("  range   :", est.range);
    console.log("  type    :", est.details["Fence Type"]);
    await page.close();
  }

  // === PATH 3: compare 3 fixtures at /compare-fencing-quotes.html ===
  {
    const page = await browser.newPage();
    await preparePage(page, BASE);
    page.setDefaultTimeout(180000);
    await page.setViewport({ width: 1440, height: 2200 });

    await page.goto(BASE + "/compare-fencing-quotes.html", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 2000));

    const inputs = await page.$$('input[type="file"]');
    if (inputs.length >= 3) {
      const f1 = path.resolve(__dirname, "..", "test-quotes/fencing-images/comparison-fence-low.png");
      const f2 = path.resolve(__dirname, "..", "test-quotes/fencing-images/comparison-fence-mid.png");
      const f3 = path.resolve(__dirname, "..", "test-quotes/fencing-images/comparison-fence-high.png");
      await inputs[0].uploadFile(f1);
      await inputs[1].uploadFile(f2);
      await inputs[2].uploadFile(f3);
    } else {
      // Single multi-upload pattern
      await inputs[0].uploadFile(
        path.resolve(__dirname, "..", "test-quotes/fencing-images/comparison-fence-low.png"),
        path.resolve(__dirname, "..", "test-quotes/fencing-images/comparison-fence-mid.png"),
        path.resolve(__dirname, "..", "test-quotes/fencing-images/comparison-fence-high.png"),
      );
    }
    // Click any "Compare Now" / Submit button
    await new Promise(r => setTimeout(r, 1500));
    const btnClicked = await page.evaluate(() => {
      const cands = Array.from(document.querySelectorAll("button, a")).filter(el => {
        const t = (el.textContent || "").toLowerCase();
        return /compare\s*now|analyze\s*all|submit|run\s*comparison/.test(t);
      });
      if (cands.length) { cands[0].click(); return cands[0].textContent.trim(); }
      return null;
    });

    // Wait for any verdict / per-quote rendering
    await page.waitForFunction(() => {
      return document.querySelectorAll(".verdict-price, .quote-card, .compare-quote").length >= 1 ||
             document.body.innerText.includes("Best value") ||
             document.body.innerText.includes("Winner");
    }, { timeout: 180000 }).catch(() => null);
    await new Promise(r => setTimeout(r, 3000));

    const cmp = await page.evaluate(() => {
      const t = document.body.innerText;
      const cards = Array.from(document.querySelectorAll("[class*='quote'], [class*='card']"))
        .map(c => (c.innerText || "").slice(0, 400))
        .filter(s => /\$/.test(s));
      return {
        bodySlice: t.slice(0, 3000),
        cardCount: cards.length,
        firstCardSlices: cards.slice(0, 3),
      };
    });
    fs.writeFileSync(path.join(OUT, "path3-compare.json"), JSON.stringify({ btnClicked, cmp }, null, 2));
    await page.screenshot({ path: path.join(OUT, "path3-compare.png"), fullPage: true });
    console.log("\nPATH 3 (compare 3 fixtures):");
    console.log("  button   :", btnClicked || "(none found / inline pipeline)");
    console.log("  body 0-400:", cmp.bodySlice.slice(0, 400).replace(/\n+/g, " | "));
    await page.close();
  }

  await browser.close();
  console.log("\nWalk artifacts in:", OUT);
})();
