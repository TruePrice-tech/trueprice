// Diagnose why analyzer hangs: longer timeout, capture all console + final progress text
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const BASE = process.env.BASE || "https://woogoro.com";
const FIXTURE = process.env.FIX || "10-thoughts-on-this-quote-from-our-lawn-company.jpeg";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const logs = [];
  page.on("console", (m) => { logs.push(`[console.${m.type()}] ${m.text()}`); });
  page.on("pageerror", (e) => { logs.push(`[pageerror] ${e.message}`); });
  page.on("requestfailed", (req) => { logs.push(`[reqfail] ${req.url()} -- ${req.failure()?.errorText}`); });
  page.on("response", (res) => {
    if (res.status() >= 400) logs.push(`[response ${res.status()}] ${res.url().substring(0, 200)}`);
  });

  await page.goto(`${BASE}/landscaping-quote-analyzer.html`, { waitUntil: "networkidle2", timeout: 30000 });
  console.log("Navigated. Uploading fixture...");
  await sleep(1500);

  const fixture = path.join(ROOT, "test-quotes/landscaping-test-images", FIXTURE);
  console.log("Fixture:", fixture, "exists:", fs.existsSync(fixture), "size:", fs.statSync(fixture).size);

  const fileInput = await page.$('input[type="file"]');
  await fileInput.uploadFile(fixture);
  console.log("Upload done. Polling progress...");

  const start = Date.now();
  let lastProgress = "";
  let lastBody = "";
  let resolved = false;
  while (Date.now() - start < 240000) {
    await sleep(2000);
    const snap = await page.evaluate(() => {
      const fill = document.getElementById("progFill");
      const txt = document.getElementById("progText");
      const app = document.getElementById("landApp");
      const ocrLen = window.__TP_LAST_OCR_TEXT ? window.__TP_LAST_OCR_TEXT.length : 0;
      return {
        progPct: fill ? fill.style.width : "(no fill)",
        progText: txt ? txt.textContent : "(no text)",
        bodyChars: app ? app.innerText.length : 0,
        bodyHead: app ? app.innerText.substring(0, 200) : "",
        ocrLen
      };
    });
    if (snap.progText !== lastProgress) {
      console.log(`  t=${((Date.now() - start) / 1000).toFixed(0)}s | ${snap.progPct} | ${snap.progText} | bodyChars=${snap.bodyChars} | ocrLen=${snap.ocrLen}`);
      lastProgress = snap.progText;
    }
    if (snap.bodyChars > 200 && snap.bodyHead !== lastBody) {
      console.log(`  body changed: ${snap.bodyHead.substring(0, 200).replace(/\n/g, " | ")}`);
      lastBody = snap.bodyHead;
    }
    if (/Verdict|Quote Analysis|couldn|enter the quote|Confirm/i.test(snap.bodyHead)) {
      console.log("  RESOLVED to result/manual/confirm step");
      resolved = true;
      break;
    }
  }

  console.log("\n=== CONSOLE LOG (last 50) ===");
  console.log(logs.slice(-50).join("\n"));

  if (!resolved) console.log("\n!! Hung. Final body innertext: !!");
  const final = await page.evaluate(() => document.getElementById("landApp")?.innerText.substring(0, 1500));
  console.log(final);

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
