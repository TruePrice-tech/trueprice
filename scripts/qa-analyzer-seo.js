#!/usr/bin/env node
/**
 * qa-analyzer-seo.js — verify the SEO injection rendered cleanly and
 * didn't break the analyzer UI.  Loads each page over http://localhost
 * (served by the dev server) and reports:
 *   - JS errors, failed requests
 *   - appRoot hydrated (analyzer UI loaded)
 *   - SEO section present with expected headings
 *   - FAQPage schema parseable
 */
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const http = require("http");

const ROOT = path.dirname(__dirname);
const PORT = 4321;

function serve() {
  const server = http.createServer((req, res) => {
    let urlPath = req.url.split("?")[0];
    if (urlPath === "/" || urlPath === "") urlPath = "/index.html";
    const fp = path.join(ROOT, urlPath);
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404);
      res.end("404");
      return;
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

const PAGES = [
  "roofing-quote-analyzer.html",
  "hvac-quote-analyzer.html",
  "plumbing-quote-analyzer.html",
  "solar-quote-analyzer.html",
  "medical-bill-analyzer.html",
  "legal-fee-analyzer.html",
];

(async () => {
  const server = await serve();
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox"],
  });

  const results = [];
  for (const p of PAGES) {
    const page = await browser.newPage();
    const errors = [];
    const reqFails = [];
    page.on("pageerror", e => errors.push(String(e.message).slice(0, 200)));
    page.on("console", msg => { if (msg.type() === "error") errors.push("console: " + msg.text().slice(0, 200)); });
    page.on("requestfailed", req => reqFails.push(req.url()));

    try {
      await page.goto(`http://127.0.0.1:${PORT}/${p}`, { waitUntil: "networkidle2", timeout: 20000 });
    } catch (e) {
      results.push({ page: p, ok: false, error: "nav: " + e.message });
      await page.close();
      continue;
    }
    // wait a bit for analyzer UI to hydrate
    await new Promise(r => setTimeout(r, 1500));

    const data = await page.evaluate(() => {
      const main = document.querySelector("main");
      const seoSection = document.querySelector('section section, main > section:last-of-type') || null;
      const hasMarker = document.documentElement.innerHTML.includes("TP-ANALYZER-SEO-V1");
      const h2s = [...document.querySelectorAll("h2")].map(h => h.textContent.trim()).slice(0, 10);
      const faqItems = document.querySelectorAll("details.faq-item").length;
      const schemas = [...document.querySelectorAll('script[type="application/ld+json"]')];
      let faqSchemaOk = false;
      for (const s of schemas) {
        try {
          const o = JSON.parse(s.textContent);
          if (o["@type"] === "FAQPage") { faqSchemaOk = true; break; }
        } catch (e) {}
      }
      const appRoot = document.getElementById("appRoot");
      const appHydrated = appRoot && appRoot.children.length > 0 && !appRoot.innerText.includes("Loading analyzer");
      const title = document.title;
      const bodyText = document.body.innerText.slice(0, 100);
      return { hasMarker, h2s, faqItems, faqSchemaOk, appHydrated, title, bodyText };
    });

    results.push({ page: p, errors, reqFails, ...data });
    await page.close();
  }

  await browser.close();
  server.close();

  console.log("\n=== ANALYZER SEO QA ===\n");
  for (const r of results) {
    const ok = r.hasMarker && r.faqSchemaOk && r.faqItems >= 5 && r.h2s.length >= 3 && r.errors.length === 0;
    console.log(`${ok ? "OK " : "FAIL"} ${r.page}`);
    console.log(`  marker=${r.hasMarker} faqItems=${r.faqItems} faqSchema=${r.faqSchemaOk} appHydrated=${r.appHydrated} h2s=${r.h2s.length}`);
    if (r.errors && r.errors.length) console.log(`  js-errors: ${r.errors.slice(0, 3).join(" | ")}`);
    if (r.reqFails && r.reqFails.length) console.log(`  req-fails: ${r.reqFails.slice(0, 3).join(" | ")}`);
    if (r.h2s && r.h2s.length) console.log(`  first-h2: "${r.h2s[0]}"`);
  }
})();
