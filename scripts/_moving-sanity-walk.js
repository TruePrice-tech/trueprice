// Sanity check: does the moving analyzer work right now on a known fixture?
// If moving works but windows doesn't, the bug is windows-specific.
const puppeteer = require("puppeteer");

const FIXTURE = "C:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice/test-quotes/moving-images/comparison-move-low.png";

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
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  await page.setViewport({ width: 1440, height: 900 });
  await page.setExtraHTTPHeaders({ "x-woogoro-test": "1" });
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");

  page.on("pageerror", err => console.log("[pageerror]", err.stack || err.message));
  page.on("console", msg => {
    if (msg.type() === "error" || msg.type() === "warn") {
      console.log("[browser-" + msg.type() + "]", msg.text().slice(0, 400));
    }
  });
  page.on("requestfailed", req => console.log("[reqfail]", req.failure()?.errorText, req.method(), req.url().slice(0, 160)));
  page.on("response", async res => {
    const u = res.url();
    if (u.includes("/api/")) {
      let body = "";
      try { body = await res.text(); } catch {}
      console.log("[net]", res.status(), u.slice(0, 80), body.slice(0, 200));
    } else if (u.includes("tesseract") || u.includes(".traineddata") || u.includes(".wasm")) {
      console.log("[net]", res.status(), u.slice(0, 160));
    }
  });
  // Log outgoing request headers so we can see why the abuse guard might 403.
  page.on("request", req => {
    const u = req.url();
    if (u.includes("/api/moving-estimate") || u.includes("/api/windows-estimate")) {
      console.log("[req-headers]", req.method(), u.slice(0, 80), JSON.stringify({
        origin: req.headers().origin,
        ua: (req.headers()["user-agent"] || "").slice(0, 80),
        ref: req.headers().referer,
        ct: req.headers()["content-type"],
      }));
    }
  });

  await page.goto("https://woogoro.com/moving-quote-analyzer.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));
  console.log("→ uploading moving fixture");
  const inp = await page.$('input[type="file"]');
  await inp.uploadFile(FIXTURE);

  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const s = await page.evaluate(() => ({
      hasVerdict: !!document.querySelector(".mv-verdict"),
      hasConfirm: !!document.getElementById("tpConfirmPriceBtn"),
      progText: (document.getElementById("progText") || {}).textContent ||
                Array.from(document.querySelectorAll("p,div")).map(e => e.textContent).find(t => /Reading|Loading|Analyzing/.test(t || "")),
    }));
    console.log(`t+${i*2}s`, JSON.stringify(s));
    if (s.hasVerdict || s.hasConfirm) { console.log("→ moving advanced"); break; }
  }
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
