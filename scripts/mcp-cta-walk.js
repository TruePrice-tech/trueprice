// Quick visual walk of the MCP CTA changes: ai-tools hub + 3 analyzer pages.
// Spins up a local static server, screenshots each page (full + fold), saves
// to output/mcp-cta-walk-2026-05-02/. Read each PNG visually as a human after.
const puppeteer = require("puppeteer");
const http = require("http");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "mcp-cta-walk-2026-05-02");
const PORT = 8741;

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let url = decodeURIComponent(req.url.split("?")[0]);
      if (url === "/") url = "/index.html";
      const file = path.resolve(path.join(ROOT, url));
      const rootResolved = path.resolve(ROOT);
      if (!file.toLowerCase().startsWith(rootResolved.toLowerCase())) { res.statusCode = 403; return res.end(); }
      fs.readFile(file, (err, data) => {
        if (err) { res.statusCode = 404; return res.end("not found: " + url); }
        const ext = path.extname(file).toLowerCase();
        res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
        res.end(data);
      });
    });
    server.listen(PORT, () => resolve(server));
  });
}

async function shot(page, name, full = false) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  console.log(`  shot${full ? " (full)" : ""}: ${name}`);
}

async function walk(browser, slug, anchor) {
  const url = `http://localhost:${PORT}/${slug}${anchor ? "#" + anchor : ""}`;
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(`console.error: ${msg.text()}`); });
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1200));
    await shot(page, `${slug.replace(/\.html$/, "")}-fold`);
    await page.evaluate(() => {
      const el = document.querySelector(".wg-mcp-cta, .ai-mcp-grid, #medical, #roofing, #hvac, #auto-repair");
      if (el) el.scrollIntoView({ block: "start", behavior: "instant" });
    });
    await new Promise((r) => setTimeout(r, 600));
    await shot(page, `${slug.replace(/\.html$/, "")}-mcp-section`);
    await shot(page, `${slug.replace(/\.html$/, "")}-full`, true);
  } catch (e) {
    consoleErrors.push(`nav error: ${e.message}`);
  }
  if (consoleErrors.length) {
    console.log(`  errors on ${slug}:`);
    consoleErrors.forEach((e) => console.log(`    - ${e}`));
  } else {
    console.log(`  ${slug} clean (no console/page errors)`);
  }
  await page.close();
  return consoleErrors;
}

(async () => {
  console.log("starting local server on port " + PORT);
  const server = await startServer();
  console.log("launching puppeteer");
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  const pages = [
    ["ai-tools.html", null],
    ["medical-bill-analyzer.html", null],
    ["roofing-quote-analyzer.html", null],
    ["auto-repair.html", null],
  ];

  const allErrors = {};
  for (const [slug, anchor] of pages) {
    console.log(`walking ${slug}`);
    allErrors[slug] = await walk(browser, slug, anchor);
  }

  await browser.close();
  server.close();
  console.log("\ndone. screenshots in: " + OUT);
  console.log("error summary:");
  for (const [slug, errs] of Object.entries(allErrors)) {
    console.log(`  ${slug}: ${errs.length} error(s)`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
