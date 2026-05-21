// CMP-1 verification: upload 3 auto-repair quotes back-to-back to
// /compare-auto-quotes.html and confirm all 3 reach "uploaded" state.
// Pre-fix: third stuck at "Parsing quote — This may take a moment".
// Post-fix: all three render the green check + name + price.

const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const BASE = process.env.WOOGORO_BASE || "https://woogoro.com";
const FIXTURES_DIR = path.resolve(__dirname, "..");
const OUT = path.resolve(__dirname, "..", "output", "cmp1-verify");
fs.mkdirSync(OUT, { recursive: true });

const FILES = [
  "test-quotes/auto-images/comparison-brake-01-shop-a-low.png",
  "test-quotes/auto-images/comparison-brake-02-shop-b-mid.png",
  "test-quotes/auto-images/comparison-brake-03-shop-c-high.png",
];

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  page.setDefaultTimeout(180000);
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + "/compare-auto-quotes.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));
  await page.screenshot({ path: path.join(OUT, "01-initial.png"), fullPage: false });

  // Upload all 3 files near-simultaneously (the bug repro condition).
  const inputs = await page.$$('input[type="file"]');
  console.log(`Found ${inputs.length} file inputs`);
  for (let i = 0; i < 3 && i < inputs.length; i++) {
    await inputs[i].uploadFile(path.join(FIXTURES_DIR, FILES[i]));
    // Tiny stagger to ensure each upload kicks off before the next; this is
    // the "uploads need to wait for the prior OCR to finish" repro condition.
    await new Promise(r => setTimeout(r, 200));
  }

  // Snapshot at 5s, 30s, 60s, 120s to track progression.
  for (const t of [5, 30, 60, 90, 120, 180]) {
    await new Promise(r => setTimeout(r, t * 1000 - (t === 5 ? 0 : (t - (t === 30 ? 5 : t === 60 ? 30 : t === 90 ? 60 : t === 120 ? 90 : 120)) * 1000)));
    const status = await page.evaluate(() => {
      const slots = [];
      for (let i = 0; i < 3; i++) {
        const slot = document.getElementById("slot" + i);
        slots.push({
          idx: i,
          uploaded: slot ? slot.classList.contains("uploaded") : false,
          uploading: slot ? slot.classList.contains("uploading") : false,
          shopName: slot ? (slot.querySelector(".slot-edit-name") || {}).value : "",
          price: slot ? (slot.querySelector(".slot-edit-price") || {}).value : "",
        });
      }
      return slots;
    });
    console.log(`t+${t}s:`, JSON.stringify(status));
    await page.screenshot({ path: path.join(OUT, `02-after-${t}s.png`), fullPage: false });
    if (status.every(s => s.uploaded)) {
      console.log(`✅ ALL 3 UPLOADED by t+${t}s`);
      break;
    }
  }

  await page.screenshot({ path: path.join(OUT, "03-final.png"), fullPage: true });
  await browser.close();
  console.log(`\nOutput: ${OUT}`);
})();
