// One-shot: upload f1 + f3 to compare-medical-quotes, verify M3 fix
// (compare must NOT show $122,500; should show ~$1,225 for low fixture).

const puppeteer = require("puppeteer");

(async () => {
  const b = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const p = await b.newPage();
  p.setDefaultTimeout(180000);
  await p.setViewport({ width: 1440, height: 900 });

  const apiCalls = [];
  p.on("response", r => {
    if (r.url().includes("/api/medical-bill-estimate") || r.url().includes("/api/parse-quote")) {
      apiCalls.push({ url: r.url().split("/").pop(), status: r.status() });
    }
  });

  await p.goto("https://woogoro.com/compare-medical-quotes.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 1500));

  await p.$eval("#file0", el => el.removeAttribute("style"));
  await p.$eval("#file1", el => el.removeAttribute("style"));

  const f0 = await p.$("#file0");
  const f1 = await p.$("#file1");
  await f0.uploadFile("test-quotes/medical-images/comparison-ct-01-low.png");
  await new Promise(r => setTimeout(r, 1500));
  await f1.uploadFile("test-quotes/medical-images/comparison-ct-03-high.png");

  await p.waitForFunction(
    () => { const btn = document.getElementById("compareBtn"); return btn && !btn.disabled; },
    { timeout: 180000 }
  ).catch(() => null);

  const btnState = await p.evaluate(() => {
    const b = document.getElementById("compareBtn");
    return { disabled: b ? b.disabled : null, text: b ? b.innerText : null };
  });
  console.log("compare button:", JSON.stringify(btnState));
  console.log("API calls during upload:", JSON.stringify(apiCalls));

  // Also probe the slot price inputs for what was extracted
  const slotPrices = await p.evaluate(() => {
    return Array.from(document.querySelectorAll(".slot-edit-price")).map(el => el.value);
  });
  console.log("slot prices (post-OCR):", slotPrices);

  if (btnState && !btnState.disabled) {
    await p.click("#compareBtn");
    await p.waitForFunction(
      () => { const r = document.getElementById("resultsContent"); return r && r.innerText.length > 50; },
      { timeout: 60000 }
    ).catch(() => null);
    await new Promise(r => setTimeout(r, 1500));

    const result = await p.evaluate(() => {
      const r = document.getElementById("resultsContent");
      const text = r ? r.innerText : "";
      const matches = text.match(/\$[\d,]+/g) || [];
      const tooHigh = matches.filter(m => parseInt(m.replace(/[$,]/g, ""), 10) > 50000);
      return {
        textHead: text.slice(0, 1000),
        allDollarMatches: matches,
        suspectHighs: tooHigh,
      };
    });
    console.log("\nresult head:", result.textHead.replace(/\n/g, " | "));
    console.log("\nall $ matches:", result.allDollarMatches.join(", "));
    console.log("\nsuspect highs (>$50K — expected NONE):", result.suspectHighs.join(", ") || "NONE — fix verified");
  }

  await b.close();
})();
