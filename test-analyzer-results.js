const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const VERTICALS = [
  { name: "hvac", url: "/hvac-quote-analyzer.html", fixture: "hvac-images/comparison-ac-01-low.png" },
  { name: "plumbing", url: "/plumbing-quote-analyzer.html", fixture: "plumbing-images/comparison-wh-01-low.png" },
  { name: "electrical", url: "/electrical-quote-analyzer.html", fixture: "electrical-images/comparison-panel-01-low.png" },
  { name: "fencing", url: "/fencing-quote-analyzer.html", fixture: "fencing-images/comparison-fence-low.png" },
  { name: "concrete", url: "/concrete-quote-analyzer.html", fixture: "concrete-images/comparison-conc-low.png" },
  { name: "moving", url: "/moving-quote-analyzer.html", fixture: "moving-images/comparison-move-low.png" },
  { name: "roofing", url: "/roofing-quote-analyzer.html", fixture: "roofing-images/comparison-roof-01-low.png" },
];

const requested = process.argv.slice(2);
const toTest = requested.length ? VERTICALS.filter(v => requested.includes(v.name)) : VERTICALS;

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--window-size=1280,900"] });

  for (const v of toTest) {
    console.log("\n" + "=".repeat(60));
    console.log("TESTING: " + v.name.toUpperCase());
    console.log("=".repeat(60));

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    const errors = [];
    page.on("pageerror", e => errors.push(e.message.slice(0, 100)));

    try {
      await page.goto("https://truepricehq.com" + v.url, { waitUntil: "networkidle2", timeout: 20000 });

      const fileInput = await page.$("input[type='file']");
      if (!fileInput) { console.log("  NO FILE INPUT"); await page.close(); continue; }

      await fileInput.uploadFile(path.resolve("test-quotes", v.fixture));

      // Wait for price/result (up to 60s)
      let foundResult = false;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const hasPrice = await page.evaluate(() => /\$[\d,]+/.test(document.body.innerText));
        if (hasPrice) { foundResult = true; break; }
      }

      if (!foundResult) { console.log("  TIMEOUT: no price found"); await page.close(); continue; }

      // If there's a confirm button, click it
      await page.evaluate(() => {
        const btns = document.querySelectorAll("button");
        for (const b of btns) {
          if (b.innerText.includes("Yes") && b.innerText.includes("analyze")) { b.click(); return; }
        }
      });
      await new Promise(r => setTimeout(r, 3000));

      // Get full result page content
      const resultData = await page.evaluate(() => {
        const body = document.body.innerText;
        return {
          // Price
          priceFound: /\$[\d,]+/.test(body),
          firstPrice: (body.match(/\$[\d,]+/) || [""])[0],

          // Key sections
          hasVerdict: /fair|high|low|ESTIMATED|Verdict/i.test(body),
          hasRange: /Expected range|range:/i.test(body),
          hasDetails: /Details|SERVICE TYPE|SYSTEM TYPE|Material|Brand/i.test(body),
          hasScope: /Scope|Includes|Checklist|✓/i.test(body),
          hasNextSteps: /Next [Ss]teps|before you sign/i.test(body),
          hasDownload: /PDF|Download|Save/i.test(body),
          hasFeedback: /helpful|thumbs|👍/i.test(body),
          hasCompareLink: /Compare|compare|multiple quotes/i.test(body),
          hasEstimateLink: /estimate|Get.*estimate/i.test(body),
          hasCostGuide: /Cost Guide|cost guide/i.test(body),

          // Confirm step?
          isConfirmStep: body.includes("We found") || body.includes("Is this your"),

          bodyLength: body.length,
        };
      });

      console.log("  Price: " + resultData.firstPrice);
      console.log("  Confirm step: " + (resultData.isConfirmStep ? "YES (needs click)" : "no"));
      console.log("  Verdict:      " + (resultData.hasVerdict ? "YES" : "MISSING"));
      console.log("  Range:        " + (resultData.hasRange ? "YES" : "MISSING"));
      console.log("  Details:      " + (resultData.hasDetails ? "YES" : "MISSING"));
      console.log("  Scope:        " + (resultData.hasScope ? "YES" : "MISSING"));
      console.log("  Next steps:   " + (resultData.hasNextSteps ? "YES" : "MISSING"));
      console.log("  Download/PDF: " + (resultData.hasDownload ? "YES" : "MISSING"));
      console.log("  Feedback:     " + (resultData.hasFeedback ? "YES" : "MISSING"));
      console.log("  Compare link: " + (resultData.hasCompareLink ? "YES" : "MISSING"));

    } catch (e) {
      console.log("  ERROR: " + e.message.slice(0, 100));
    }

    if (errors.length) console.log("  JS ERRORS: " + errors.join(" | "));
    await page.close();
  }

  await browser.close();
})();
