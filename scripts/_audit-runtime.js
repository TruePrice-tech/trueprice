#!/usr/bin/env node
/* Lightweight runtime stability walk — load key pages via local server,
   capture console errors + 404s + JS exceptions. No uploads, no clicks. */
const puppeteer = require("puppeteer");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const PORT = 4327;

const PAGES = [
  "/",
  "/index.html",
  "/get-an-estimate.html",
  "/analyze-my-quote.html",
  "/compare-quotes-picker.html",
  "/hvac-estimate.html",
  "/plumbing-estimate.html",
  "/roofing-quote-analyzer.html",
  "/hvac-quote-analyzer.html",
  "/medical-bill-analyzer.html",
  "/legal-fee-analyzer.html",
  "/moving-estimate.html",
  "/auto-repair.html",
  "/compare-hvac-quotes.html",
  "/compare-plumbing-quotes.html",
  "/privacy.html",
  "/terms.html",
  "/unsubscribe.html?e=0000000000000000000000000000000000000000000000000000000000000000&t=0000000000000000000000000000000000000000000000000000000000000000",
  "/hvac-replacement-cost-guide.html",
  "/roof-replacement-cost-guide.html",
  "/atlanta-ga-hvac-cost.html",
  "/guides.html",
  "/methodology.html",
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
  return new Promise(r => server.listen(PORT, "127.0.0.1", () => r(server)));
}

(async () => {
  const server = await serve();
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const results = [];

  for (const p of PAGES) {
    const page = await browser.newPage();
    const consoleErrs = [];
    const pageErrs = [];
    const netFails = [];

    page.on("console", msg => { if (msg.type() === "error") consoleErrs.push(msg.text()); });
    page.on("pageerror", err => pageErrs.push(String(err).substring(0, 150)));
    page.on("requestfailed", req => {
      const url = req.url();
      if (!url.includes("127.0.0.1")) return;
      netFails.push(req.method() + " " + url.replace("http://127.0.0.1:" + PORT, "") + " → " + req.failure().errorText);
    });
    page.on("response", resp => {
      if (resp.status() >= 400 && resp.url().includes("127.0.0.1")) {
        netFails.push(resp.request().method() + " " + resp.url().replace("http://127.0.0.1:" + PORT, "") + " → HTTP " + resp.status());
      }
    });

    let loaded = false;
    try {
      await page.goto("http://127.0.0.1:" + PORT + p, { waitUntil: "networkidle0", timeout: 15000 });
      loaded = true;
    } catch (e) {
      pageErrs.push("LOAD FAILED: " + e.message.substring(0, 80));
    }

    // Allow 1s for delayed JS
    await new Promise(r => setTimeout(r, 1000));

    results.push({ path: p, loaded, consoleErrs, pageErrs, netFails });
    await page.close();
  }

  await browser.close();
  server.close();

  // Report
  console.log("\n=== RUNTIME WALK: " + PAGES.length + " pages ===\n");
  let cleanCount = 0;
  for (const r of results) {
    const total = r.consoleErrs.length + r.pageErrs.length + r.netFails.length;
    if (total === 0 && r.loaded) {
      cleanCount++;
      continue;
    }
    console.log("[" + (r.loaded ? "LOAD OK" : "LOAD FAIL") + "] " + r.path);
    if (r.pageErrs.length) console.log("  PAGE ERRORS: " + r.pageErrs.length);
    for (const e of r.pageErrs.slice(0, 3)) console.log("    - " + e);
    if (r.consoleErrs.length) console.log("  CONSOLE ERRORS: " + r.consoleErrs.length);
    for (const e of r.consoleErrs.slice(0, 3)) console.log("    - " + e.substring(0, 140));
    if (r.netFails.length) console.log("  NET FAILS: " + r.netFails.length);
    for (const e of r.netFails.slice(0, 5)) console.log("    - " + e);
    console.log();
  }
  console.log("\nSUMMARY: " + cleanCount + "/" + PAGES.length + " pages loaded cleanly.");
})();
