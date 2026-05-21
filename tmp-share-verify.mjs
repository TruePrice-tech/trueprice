import puppeteer from "puppeteer";
import http from "http";
import fs from "fs";
import path from "path";

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const PORT = 4812;

const server = http.createServer(async (req, res) => {
  let p = req.url.split("?")[0];
  if (p.startsWith("/s/")) p = "/shared-estimate.html";
  if (p === "/" || p === "") p = "/index.html";
  if (p.startsWith("/api/")) {
    const upstream = "https://woogoro.com" + req.url;
    const r = await fetch(upstream, { headers: { "User-Agent": "Mozilla/5.0", "Origin": "https://woogoro.com" } });
    res.writeHead(r.status, { "Content-Type": r.headers.get("content-type") || "application/json" });
    res.end(await r.text());
    return;
  }
  const fp = path.join(ROOT, decodeURIComponent(p));
  if (!fp.startsWith(path.resolve(ROOT)) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
    res.writeHead(404); return res.end("404");
  }
  const types = { ".html":"text/html",".css":"text/css",".js":"application/javascript",".png":"image/png",".webp":"image/webp",".svg":"image/svg+xml",".ico":"image/x-icon",".woff2":"font/woff2",".jpg":"image/jpeg",".jpeg":"image/jpeg" };
  res.writeHead(200, { "Content-Type": types[path.extname(fp).toLowerCase()] || "application/octet-stream" });
  fs.createReadStream(fp).pipe(res);
});
await new Promise(r => server.listen(PORT, "127.0.0.1", r));

const browser = await puppeteer.launch({ headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 1100, deviceScaleFactor: 2 });
page.on("console", (m) => console.log(`[console.${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => console.log(`[pageerror] ${e.message}\n${e.stack || ""}`));

// Inject a global error capture to see what renderEstimate throws
await page.evaluateOnNewDocument(() => {
  window.addEventListener("error", (e) => console.log("[winerr]", e.message, e.filename + ":" + e.lineno + ":" + e.colno));
  window.addEventListener("unhandledrejection", (e) => console.log("[unhandled]", String(e.reason && (e.reason.stack || e.reason.message || e.reason))));
});

await page.goto(`http://127.0.0.1:${PORT}/s/21a2chgi`, { waitUntil: "networkidle2" });
await new Promise(r => setTimeout(r, 800));
const text = await page.evaluate(() => document.body.innerText.substring(0, 600));
console.log("=== rendered after fix ===\n" + text);
await page.screenshot({ path: "c:/tmp/share-after-fix.png", fullPage: false });
await browser.close();
server.close();
