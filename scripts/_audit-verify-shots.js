#!/usr/bin/env node
/* Visual verification walk for yesterday's fixes. Captures screenshots
   of pages that were edited so Lane / Claude can read them as a human. */
const puppeteer = require("puppeteer");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const OUT = path.join(ROOT, "output", "audit-verify");
const PORT = 4329;

const PAGES = [
  { path: "/fencing-cost-guide.html", label: "fencing-cost-guide", reason: "JSON-LD fix" },
  { path: "/kitchen-remodel-cost-guide.html", label: "kitchen-remodel-cost-guide", reason: "JSON-LD fix" },
  { path: "/painting-cost-guide.html", label: "painting-cost-guide", reason: "JSON-LD fix" },
  { path: "/siding-cost-guide.html", label: "siding-cost-guide", reason: "JSON-LD fix" },
  { path: "/how-to-compare-roofing-quotes.html", label: "how-to-compare-roofing", reason: "orphan JSON-LD fix" },
  { path: "/columbus-oh-roof-cost.html", label: "columbus-roof", reason: "double-html truncation" },
  { path: "/texas-roof-cost.html", label: "texas-roof", reason: "stray </script> removal" },
  { path: "/solar-cost.html", label: "solar-cost", reason: "stray </script> removal" },
  { path: "/compare-hvac-quotes.html", label: "compare-hvac", reason: "cost-guide link fix + how-to-compare removal" },
  { path: "/compare-windows-quotes.html", label: "compare-windows", reason: "analyzer typo + cost-guide fix" },
  { path: "/compare-legal-quotes.html", label: "compare-legal", reason: "analyzer typo fix" },
  { path: "/compare-medical-quotes.html", label: "compare-medical", reason: "analyzer typo fix" },
  { path: "/compare-roofing-quotes.html", label: "compare-roofing", reason: "cost-guide repoint" },
  { path: "/st-louis-mo-auto-repair-cost.html", label: "stlouis-auto", reason: "canonical state-code fix" },
  { path: "/roof-replacement-cost-guide.html", label: "roof-redirect-stub", reason: "new redirect stub" },
  { path: "/get-an-estimate.html", label: "get-estimate", reason: "contact → mailto fix" },
  { path: "/hvac-estimate.html", label: "hvac-estimate", reason: "quote capture card still renders" },
];

async function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function serve() {
  const server = http.createServer((req, res) => {
    let urlPath = req.url.split("?")[0];
    if (urlPath === "/" || urlPath === "") urlPath = "/index.html";
    const fp = path.join(ROOT, decodeURIComponent(urlPath));
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404);
      return res.end("404");
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
  await ensureDir(OUT);
  const server = await serve();
  const browser = await puppeteer.launch({ headless: "new" });
  const report = [];

  for (const p of PAGES) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    const errs = [];
    page.on("pageerror", e => errs.push(String(e).substring(0, 120)));

    let finalUrl = "";
    try {
      await page.goto("http://127.0.0.1:" + PORT + p.path, { waitUntil: "networkidle2", timeout: 15000 });
      await new Promise(r => setTimeout(r, 800));
      finalUrl = page.url();
    } catch (e) {
      errs.push("LOAD FAIL: " + e.message.substring(0, 80));
    }

    const shotPath = path.join(OUT, p.label + ".png");
    try { await page.screenshot({ path: shotPath, fullPage: false }); }
    catch (e) { errs.push("SHOT FAIL: " + e.message.substring(0, 80)); }

    const title = await page.title().catch(() => "?");
    const h1 = await page.evaluate(() => document.querySelector("h1")?.textContent?.trim() || "").catch(() => "");
    report.push({ ...p, title, h1, finalUrl, errs });
    await page.close();
  }

  await browser.close();
  server.close();
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log("shots written to " + OUT);
  for (const r of report) {
    const tag = r.errs.length ? " [errs=" + r.errs.length + "]" : "";
    console.log(" ", r.label + ".png", "← " + r.reason, tag);
    if (r.finalUrl && !r.finalUrl.endsWith(r.path.split("?")[0])) {
      console.log("      redirected to", r.finalUrl.replace("http://127.0.0.1:" + PORT, ""));
    }
    if (r.errs.length) for (const e of r.errs) console.log("      ERR:", e);
  }
})();
