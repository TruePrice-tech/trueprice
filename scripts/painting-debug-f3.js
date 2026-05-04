// One-off: upload f3 fixture to live painting analyzer and dump
// engineResult.ocrText + aiData + price so we can see whether $9,035
// came from regex OCR garble or AI hallucination.
const { launchHarnessBrowser, preparePage } = require("../test/lib/harness-browser");
const path = require("path");

(async () => {
  const browser = await launchHarnessBrowser();
  const page = await browser.newPage();
  await preparePage(page, "https://woogoro.com");
  await page.setViewport({ width: 1440, height: 900 });

  const apiResponses = [];
  page.on("response", async res => {
    if (res.url().includes("/api/painting-estimate") || res.url().includes("/api/parse-quote")) {
      let body = "";
      try { body = await res.text(); } catch {}
      apiResponses.push({ url: res.url(), status: res.status(), body });
    }
  });

  await page.goto("https://woogoro.com/painting-quote-analyzer.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));

  const inp = await page.$('input[type="file"]');
  await inp.uploadFile(path.resolve(__dirname, "..", "test-quotes/painting-test-images/08-quote-feedback--primer-only-job.png"));

  // Wait long enough for Tesseract + AI roundtrip.
  await new Promise(r => setTimeout(r, 45000));

  const dump = await page.evaluate(() => {
    const winLastEng = window.__TP_LAST_ENGINE_RESULT || null;
    return {
      ocrText: (winLastEng && winLastEng.ocrText) || (window.__TP_LAST_OCR_TEXT || null),
      enginePrice: winLastEng ? winLastEng.price : null,
      aiData: winLastEng ? winLastEng.aiData : null,
      contractor: winLastEng ? winLastEng.contractor : null,
      bodyText: document.body.innerText.slice(0, 1500),
    };
  });

  console.log("=== api responses ===");
  for (const r of apiResponses) {
    console.log(r.url, r.status);
    console.log(r.body.slice(0, 2000));
    console.log("---");
  }
  console.log("=== window dump ===");
  console.log(JSON.stringify(dump, null, 2).slice(0, 5000));

  await browser.close();
})();
