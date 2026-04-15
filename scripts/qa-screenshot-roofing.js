#!/usr/bin/env node
/**
 * qa-screenshot-roofing.js — full-page screenshot of roofing analyzer
 * after SEO injection, to verify nothing visually broken.
 */
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const http = require("http");

const ROOT = path.dirname(__dirname);
const PORT = 4322;

function serve() {
  const server = http.createServer((req, res) => {
    let urlPath = req.url.split("?")[0];
    if (urlPath === "/" || urlPath === "") urlPath = "/index.html";
    const fp = path.join(ROOT, urlPath);
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404); res.end("404"); return;
    }
    const ext = path.extname(fp).toLowerCase();
    const types = { ".html": "text/html", ".js": "application/javascript",
      ".css": "text/css", ".json": "application/json",
      ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
      ".webp": "image/webp", ".woff2": "font/woff2", ".ico": "image/x-icon" };
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    fs.createReadStream(fp).pipe(res);
  });
  return new Promise(r => server.listen(PORT, "127.0.0.1", () => r(server)));
}

(async () => {
  const server = await serve();
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const out = path.join(ROOT, "output", "qa-analyzer-seo");
  fs.mkdirSync(out, { recursive: true });

  for (const p of ["roofing-quote-analyzer.html", "hvac-quote-analyzer.html", "medical-bill-analyzer.html"]) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900 });
    await page.goto(`http://127.0.0.1:${PORT}/${p}`, { waitUntil: "networkidle2", timeout: 20000 });
    await new Promise(r => setTimeout(r, 2000));
    const file = path.join(out, p.replace(".html", ".png"));
    await page.screenshot({ path: file, fullPage: true });
    console.log("screenshot:", file);
    await page.close();
  }

  await browser.close();
  server.close();
})();
