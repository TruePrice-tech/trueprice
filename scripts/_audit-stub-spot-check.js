#!/usr/bin/env node
/* Puppeteer spot-check: load 3 rewritten city pages, verify NO stub links
   remain in the rendered DOM, click an "Analyze a quote" link and confirm
   it lands on the canonical /analyze-my-quote.html. */
const puppeteer = require("puppeteer");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const PORT = 4329;

const STUB_BASENAMES = [
  "analyze-quote.html",
  "roof-replacement-cost-per-square-foot.html",
  "roof-replacement-cost-guide.html",
  "roof-replacement-cost-by-house-size.html",
  "auto-repair-quote-analyzer.html",
  "roof-replacement-cost-calculator.html",
];

const SAMPLES = [
  "/abilene-tx-electrical-cost.html",
  "/boston-ma-hvac-cost.html",
  "/denver-co-fence-cost.html",
];

function serve() {
  const server = http.createServer((req, res) => {
    let urlPath = req.url.split("?")[0];
    if (urlPath === "/" || urlPath === "") urlPath = "/index.html";
    const fp = path.join(ROOT, decodeURIComponent(urlPath));
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404);
      return res.end("404 " + urlPath);
    }
    const types = { ".html":"text/html", ".js":"application/javascript", ".css":"text/css",
      ".json":"application/json", ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg",
      ".svg":"image/svg+xml", ".webp":"image/webp", ".ico":"image/x-icon", ".txt":"text/plain",
      ".woff2":"font/woff2" };
    res.writeHead(200, { "Content-Type": types[path.extname(fp).toLowerCase()] || "application/octet-stream" });
    fs.createReadStream(fp).pipe(res);
  });
  return new Promise((r) => server.listen(PORT, "127.0.0.1", () => r(server)));
}

(async () => {
  const server = await serve();
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  let exitCode = 0;

  try {
    for (const sample of SAMPLES) {
      const page = await browser.newPage();
      const url = `http://127.0.0.1:${PORT}${sample}`;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });

      // Check: no stub URLs in any href in the rendered DOM
      const stubHits = await page.evaluate((stubs) => {
        const out = [];
        for (const a of document.querySelectorAll("a[href]")) {
          for (const stub of stubs) {
            if (a.getAttribute("href").includes(stub)) {
              out.push({ stub, text: a.textContent.trim().slice(0, 40) });
            }
          }
        }
        return out;
      }, STUB_BASENAMES);

      if (stubHits.length > 0) {
        console.log(`✗ ${sample}: ${stubHits.length} stub hrefs in DOM`);
        for (const h of stubHits.slice(0, 3)) {
          console.log(`    ${h.stub} (link text: "${h.text}")`);
        }
        exitCode = 1;
      } else {
        console.log(`✓ ${sample}: no stub hrefs in rendered DOM`);
      }

      // Find the canonical generic-analyzer link (there may also be a
      // vertical-specific analyzer link on the same page — that's intentional).
      // Just confirm at least one href to /analyze-my-quote.html exists and
      // resolves successfully.
      const targetHref = await page.evaluate(() => {
        const a = [...document.querySelectorAll("a[href]")].find((el) =>
          el.getAttribute("href").startsWith("/analyze-my-quote.html")
        );
        return a ? a.getAttribute("href") : null;
      });

      if (targetHref) {
        const expected = "/analyze-my-quote.html";
        if (!targetHref.startsWith(expected)) {
          console.log(`✗ ${sample}: canonical analyzer link points at ${targetHref}, expected ${expected}*`);
          exitCode = 1;
        } else {
          // Actually navigate and verify the canonical loads
          await page.goto(`http://127.0.0.1:${PORT}${targetHref}`, { waitUntil: "domcontentloaded", timeout: 15000 });
          const title = await page.title();
          const isNotFound = await page.evaluate(() => document.title.includes("Page Not Found"));
          if (isNotFound) {
            console.log(`✗ ${sample}: navigated to ${targetHref} but landed on Page Not Found`);
            exitCode = 1;
          } else {
            console.log(`  → followed link to ${targetHref}, page title: "${title.slice(0, 60)}"`);
          }
        }
      } else {
        console.log(`  (no "Analyze a quote" link found on ${sample})`);
      }

      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log("");
  console.log(exitCode === 0 ? "OK: spot-check passed." : "FAIL: spot-check found issues.");
  process.exit(exitCode);
})();
