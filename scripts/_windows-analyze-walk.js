// Windows analyze-path human walk: upload every fixture, capture full
// rendered verdict text + screenshot, dump for human review.
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const BASE = "https://woogoro.com";
const ROOT = "C:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = "c:/tmp/windows-analyze-walk";
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const FIXTURES = [
  { id: "f1-ecoview", file: "test-quotes/windows-images/real/reddit-img-1-fair-quote.jpg" },
  { id: "c1-pacific-low", file: "test-quotes/windows-images/comparison-windows-low.png" },
  { id: "c2-cascade-mid", file: "test-quotes/windows-images/comparison-windows-mid.png" },
  { id: "c3-evergreen-high", file: "test-quotes/windows-images/comparison-windows-high.png" },
];

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--enable-features=SharedArrayBuffer",
      "--disable-features=IsolateOrigins,site-per-process",
      "--disable-web-security",
    ],
  });

  for (const fx of FIXTURES) {
    const page = await browser.newPage();
    page.setDefaultTimeout(180000);
    await page.setViewport({ width: 1440, height: 900 });
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
    await page.setExtraHTTPHeaders({ "x-woogoro-test": "1", "Origin": BASE });

    const apiResponses = [];
    page.on("response", async res => {
      if (res.url().includes("/api/windows-estimate")) {
        let body = ""; try { body = await res.text(); } catch {}
        apiResponses.push({ status: res.status(), body });
      }
    });

    console.log(`\n=== ${fx.id} ===`);
    await page.goto(BASE + "/window-quote-analyzer.html", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 2500));
    const inp = await page.$("#fileInput");
    await inp.uploadFile(path.join(ROOT, fx.file));

    await page.waitForFunction(() => {
      return !!document.querySelector(".win-verdict") ||
             !!document.getElementById("tpConfirmPriceBtn") ||
             !!document.getElementById("winHardRejectStartOver");
    }, { timeout: 180000 });
    if (await page.evaluate(() => !!document.getElementById("tpConfirmPriceBtn"))) {
      await page.evaluate(() => document.getElementById("tpConfirmPriceBtn").click());
      await page.waitForFunction(() => !!document.querySelector(".win-verdict"), { timeout: 60000 });
    }
    await new Promise(r => setTimeout(r, 2000));

    const cap = await page.evaluate(() => {
      const v = document.querySelector(".win-verdict");
      const fullText = (document.querySelector("#winApp") || document.body).innerText;
      const ctas = Array.from(document.querySelectorAll("#winApp a, #winApp button"))
        .map(el => ({ tag: el.tagName, text: (el.innerText || "").trim().slice(0, 80), href: el.getAttribute("href") || "" }))
        .filter(c => c.text.length > 0);
      return {
        verdictLabel: v?.querySelector(".verdict-label")?.innerText,
        verdictPrice: v?.querySelector(".verdict-price")?.innerText,
        verdictRange: v?.querySelector(".verdict-range")?.innerText,
        bodyText: fullText,
        ctas,
        anyDollarUndefined: /\$undefined|\$NaN|\$null/i.test(fullText),
        anyDoubleSpace: /  /.test(fullText),
        anyHtmlEntity: /&[a-z]+;|&#\d+;/.test(fullText),
      };
    });

    await page.screenshot({ path: path.join(OUT, fx.id + "-1440.png"), fullPage: true });
    await page.setViewport({ width: 390, height: 844 });
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(OUT, fx.id + "-mobile.png"), fullPage: true });

    let api = null;
    if (apiResponses[0]) try { api = JSON.parse(apiResponses[0].body); } catch {}
    fs.writeFileSync(path.join(OUT, fx.id + ".json"), JSON.stringify({
      verdictLabel: cap.verdictLabel, verdictPrice: cap.verdictPrice, verdictRange: cap.verdictRange,
      anyDollarUndefined: cap.anyDollarUndefined,
      ctas: cap.ctas,
      api: api ? api.data : null,
      bodyText: cap.bodyText.slice(0, 4000),
    }, null, 2));
    console.log("verdict:", cap.verdictLabel, "/", cap.verdictPrice, "/", cap.verdictRange);
    console.log("api fields:", JSON.stringify({
      contractor: api?.data?.contractor, brand: api?.data?.brand, brandTier: api?.data?.brandTier,
      windowCount: api?.data?.windowCount, material: api?.data?.material,
      glassPackage: api?.data?.glassPackage, uFactor: api?.data?.uFactor,
      city: api?.data?.city, stateCode: api?.data?.stateCode,
      redFlags: (api?.data?.redFlags || []).slice(0, 3),
    }));
    console.log("CTA count:", cap.ctas.length, "$undefined?", cap.anyDollarUndefined);
    if (cap.anyDollarUndefined) console.log("!!! $undefined / $NaN / $null in body");

    await page.close();
  }
  await browser.close();
  console.log("\nScreenshots + JSON saved to", OUT);
})().catch(e => { console.error(e); process.exit(1); });
