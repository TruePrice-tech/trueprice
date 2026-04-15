#!/usr/bin/env node
/**
 * qa-walk-interactive.js — full interactive QA walkthrough.
 *
 * For each of 6 random verticals, walks all 3 paths button-by-button
 * from homepage:
 *   ESTIMATE  : homepage -> picker -> vertical -> fill address -> submit -> verify result
 *   ANALYZE   : homepage -> picker -> vertical -> verify upload UI + try upload of synth PNG
 *   COMPARE   : homepage -> picker -> vertical -> verify 2-slot UI + try 2 synth uploads
 *
 * Against a local static server so we test freshly-pushed changes.  Any
 * error, missing element, console error, or failed request is flagged.
 */
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const http = require("http");

const ROOT = path.dirname(__dirname);
const OUT = path.join(ROOT, "output", "qa-interactive");
const PORT = 4323;
const BASE = `http://127.0.0.1:${PORT}`;

const ALL_VERTICALS = [
  { slug: "roofing", label: "Roofing" },
  { slug: "hvac", label: "HVAC" },
  { slug: "plumbing", label: "Plumbing" },
  { slug: "electrical", label: "Electrical" },
  { slug: "solar", label: "Solar" },
  { slug: "window", label: "Window" },
  { slug: "siding", label: "Siding" },
  { slug: "painting", label: "Painting" },
  { slug: "concrete", label: "Concrete" },
  { slug: "fencing", label: "Fence", altLabel: "Fencing" },
  { slug: "gutter", label: "Gutter", altLabel: "Gutters" },
  { slug: "insulation", label: "Insulation" },
  { slug: "foundation", label: "Foundation" },
  { slug: "garage", label: "Garage Door", altLabel: "Garage" },
  { slug: "kitchen", label: "Kitchen" },
  { slug: "landscaping", label: "Landscaping" },
  { slug: "moving", label: "Moving" },
  { slug: "auto", label: "Auto Repair", altLabel: "Auto" },
  { slug: "medical", label: "Medical" },
  { slug: "legal", label: "Legal" },
];

function pickRandom(arr, n) {
  const c = [...arr];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c.slice(0, n);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function serve() {
  const server = http.createServer((req, res) => {
    let urlPath = req.url.split("?")[0];
    if (urlPath === "/" || urlPath === "") urlPath = "/index.html";
    const fp = path.join(ROOT, decodeURIComponent(urlPath));
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404); res.end("404"); return;
    }
    const ext = path.extname(fp).toLowerCase();
    const types = {
      ".html": "text/html", ".js": "application/javascript",
      ".css": "text/css", ".json": "application/json",
      ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
      ".svg": "image/svg+xml", ".webp": "image/webp",
      ".woff2": "font/woff2", ".ico": "image/x-icon", ".txt": "text/plain",
    };
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    fs.createReadStream(fp).pipe(res);
  });
  return new Promise(r => server.listen(PORT, "127.0.0.1", () => r(server)));
}

async function setup() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) {
    try { fs.unlinkSync(path.join(OUT, f)); } catch (e) {}
  }
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name + ".png"), fullPage: false });
}

// Build a synthetic 1-page PNG with quote-like text we can upload
async function buildSynthQuote(browser, idx) {
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 1000 });
  await page.setContent(`<!DOCTYPE html><html><head><style>
    body{font-family:Arial,sans-serif;padding:40px;color:#000;background:#fff;}
    h1{font-size:24px;margin:0 0 20px;}
    table{width:100%;border-collapse:collapse;margin:20px 0;}
    td{padding:8px;border-bottom:1px solid #ccc;font-size:16px;}
    .total{font-weight:bold;font-size:20px;color:#000;}
  </style></head><body>
    <h1>Acme Contractor ${idx + 1} &mdash; Quote #${1000 + idx}</h1>
    <p>Date: 2026-04-15 &nbsp;&nbsp; Customer: Test Customer</p>
    <p>123 Main St, Fort Mill, SC 29707</p>
    <table>
      <tr><td>Labor (installation)</td><td style="text-align:right">$${(3200 + idx * 400).toLocaleString()}</td></tr>
      <tr><td>Materials</td><td style="text-align:right">$${(2800 + idx * 300).toLocaleString()}</td></tr>
      <tr><td>Permit &amp; disposal</td><td style="text-align:right">$${(450 + idx * 50).toLocaleString()}</td></tr>
      <tr><td class="total">Total Price</td><td class="total" style="text-align:right">$${(6450 + idx * 750).toLocaleString()}</td></tr>
    </table>
    <p>Warranty: 5 years on workmanship, manufacturer warranty on materials.</p>
  </body></html>`, { waitUntil: "networkidle0" });
  const file = path.join(OUT, `synth-quote-${idx + 1}.png`);
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 800, height: 1000 } });
  await page.close();
  return file;
}

function attachErrors(page) {
  const errs = [];
  const reqFails = [];
  page.on("pageerror", e => errs.push("pageerror: " + String(e.message).slice(0, 200)));
  page.on("console", msg => {
    if (msg.type() === "error") {
      const t = msg.text();
      // Filter out expected 404s on local dev (api endpoints, counters)
      if (t.includes("/api/") || t.includes("Failed to load resource")) return;
      errs.push("console.error: " + t.slice(0, 200));
    }
  });
  page.on("requestfailed", req => {
    const url = req.url();
    if (url.includes("/api/")) return;
    if (url.includes("impactcdn")) return;
    if (url.includes("cdn.jsdelivr")) return; // allow cdn libs to load lazily
    reqFails.push(url.slice(0, 200));
  });
  return { errs, reqFails };
}

async function clickByText(page, selector, patterns) {
  return await page.evaluate((sel, pats) => {
    const regexes = pats.map(s => new RegExp(s, "i"));
    const els = [...document.querySelectorAll(sel)];
    for (const el of els) {
      const t = (el.textContent || "").trim();
      if (regexes.some(r => r.test(t))) {
        el.click();
        return { clicked: true, text: t.slice(0, 80), href: el.href || "" };
      }
    }
    return { clicked: false };
  }, selector, patterns);
}

async function describe(page) {
  return await page.evaluate(() => {
    const main = document.querySelector("main") || document.body;
    const h1 = document.querySelector("h1")?.textContent?.trim() || "";
    const btns = [...main.querySelectorAll("button:not([disabled])")].map(b => (b.textContent || "").trim()).filter(Boolean).slice(0, 8);
    const inputs = [...main.querySelectorAll("input:not([type='hidden'])")].map(i => ({
      type: i.type, placeholder: i.placeholder, name: i.name, id: i.id,
    })).slice(0, 10);
    const fileInputs = [...main.querySelectorAll("input[type='file']")];
    const headings = [...main.querySelectorAll("h2")].map(h => (h.textContent || "").trim()).slice(0, 6);
    return {
      url: location.href,
      title: document.title,
      h1,
      buttons: btns,
      inputs,
      fileInputCount: fileInputs.length,
      headings,
    };
  });
}

// -------------- ESTIMATE PATH --------------
async function walkEstimate(page, vertical, findings) {
  const bucket = { path: "estimate", steps: [] };
  const { errs, reqFails } = attachErrors(page);

  await page.goto(BASE + "/", { waitUntil: "networkidle2", timeout: 15000 });
  await sleep(800);
  await shot(page, `${vertical.slug}-e-01-home`);

  // Click the estimate card — tolerate several variations of card text
  const c1 = await clickByText(page, "a", [
    "don.?t have a quote", "need an estimate", "get an estimate", "price check", "cost calc"
  ]);
  bucket.steps.push({ step: "click estimate card", ...c1 });
  if (!c1.clicked) {
    findings.push({ sev: "HIGH", vertical: vertical.slug, path: "estimate", issue: "cannot find estimate intent card on homepage" });
    bucket.errs = errs;
    bucket.reqFails = reqFails;
    return bucket;
  }
  await sleep(1500);
  await shot(page, `${vertical.slug}-e-02-picker`);

  // Click the vertical card
  const labelRegexes = [vertical.label];
  if (vertical.altLabel) labelRegexes.push(vertical.altLabel);
  const c2 = await clickByText(page, "a", labelRegexes);
  bucket.steps.push({ step: "click vertical card", ...c2 });
  if (!c2.clicked) {
    findings.push({ sev: "HIGH", vertical: vertical.slug, path: "estimate", issue: `cannot find ${vertical.label} on estimate picker` });
    bucket.errs = errs;
    bucket.reqFails = reqFails;
    return bucket;
  }
  await sleep(2500);
  await shot(page, `${vertical.slug}-e-03-vertical`);

  // Describe what loaded
  const d = await describe(page);
  bucket.steps.push({ step: "landed on vertical page", url: d.url, h1: d.h1, inputs: d.inputs.length, buttons: d.buttons.slice(0, 3) });

  // Try to fill address — many form patterns so we try several selectors
  const filled = await page.evaluate(() => {
    const candidates = [
      "input[placeholder*='address' i]",
      "input[placeholder*='zip' i]",
      "input[name*='address' i]",
      "input[id*='address' i]",
      "input[id*='location' i]",
      "input#zip",
      "input[inputmode='numeric']",
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) {
        el.focus();
        el.value = "17064 Laurelmont Ct, Fort Mill, SC 29707";
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return { filled: true, selector: sel, placeholder: el.placeholder || "" };
      }
    }
    return { filled: false };
  });
  bucket.steps.push({ step: "fill address", ...filled });

  // Pre-check: is there a sqft/area input? If so try to fill with 2000
  await sleep(600);
  const sqftFilled = await page.evaluate(() => {
    const cand = [
      "input[placeholder*='square' i]",
      "input[placeholder*='sq ft' i]",
      "input[placeholder*='sqft' i]",
      "input[id*='sqft' i]",
      "input[id*='home-size' i]",
      "input[id*='area' i]",
    ];
    for (const sel of cand) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) {
        el.focus();
        el.value = "2000";
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return { filled: true, selector: sel };
      }
    }
    return { filled: false };
  });
  bucket.steps.push({ step: "fill sqft", ...sqftFilled });

  // Try to click a "Next" / "Get" / "Estimate" / "Calculate" button
  const submit = await clickByText(page, "button, a.btn, a.button, .btn, .cta", [
    "^get estimate", "^estimate", "^next", "^continue", "^calculate", "^see.*result",
  ]);
  bucket.steps.push({ step: "click submit", ...submit });
  await sleep(3000);
  await shot(page, `${vertical.slug}-e-04-submit`);

  // Final state
  const d2 = await describe(page);
  bucket.steps.push({ step: "after submit", url: d2.url, h1: d2.h1, headings: d2.headings });

  // Check if results rendered — look for dollar signs or "estimate" word
  const resultSig = await page.evaluate(() => {
    const b = document.body.innerText || "";
    const hasDollar = /\$\d/.test(b);
    const hasEst = /estimate|typical|range|average/i.test(b);
    const hasCta = !!document.querySelector("button");
    return { hasDollar, hasEst, hasCta, textLength: b.length };
  });
  bucket.steps.push({ step: "check result signals", ...resultSig });
  if (filled.filled && !resultSig.hasDollar && !resultSig.hasEst) {
    findings.push({ sev: "MED", vertical: vertical.slug, path: "estimate", issue: "filled address + clicked submit but no dollar/estimate signal in rendered page" });
  }
  if (!filled.filled) {
    findings.push({ sev: "MED", vertical: vertical.slug, path: "estimate", issue: `no address/zip input found on ${vertical.slug} estimate page` });
  }

  bucket.errs = errs;
  bucket.reqFails = reqFails;
  return bucket;
}

// -------------- ANALYZE PATH --------------
async function walkAnalyze(page, vertical, synthFile, findings) {
  const bucket = { path: "analyze", steps: [] };
  const { errs, reqFails } = attachErrors(page);

  await page.goto(BASE + "/", { waitUntil: "networkidle2", timeout: 15000 });
  await sleep(800);

  const c1 = await clickByText(page, "a", [
    "analyze.*quote", "have a quote", "upload.*quote", "check.*quote",
  ]);
  bucket.steps.push({ step: "click analyze card", ...c1 });
  if (!c1.clicked) {
    findings.push({ sev: "HIGH", vertical: vertical.slug, path: "analyze", issue: "cannot find analyze intent card on homepage" });
    bucket.errs = errs;
    bucket.reqFails = reqFails;
    return bucket;
  }
  await sleep(1500);
  await shot(page, `${vertical.slug}-a-01-picker`);

  const labelRegexes = [vertical.label];
  if (vertical.altLabel) labelRegexes.push(vertical.altLabel);
  const c2 = await clickByText(page, "a", labelRegexes);
  bucket.steps.push({ step: "click vertical card", ...c2 });
  if (!c2.clicked) {
    findings.push({ sev: "HIGH", vertical: vertical.slug, path: "analyze", issue: `cannot find ${vertical.label} on analyze picker` });
    bucket.errs = errs;
    bucket.reqFails = reqFails;
    return bucket;
  }
  await sleep(2500);
  await shot(page, `${vertical.slug}-a-02-vertical`);

  const d = await describe(page);
  bucket.steps.push({ step: "landed analyzer", url: d.url, h1: d.h1, fileInputCount: d.fileInputCount });

  if (d.fileInputCount === 0) {
    findings.push({ sev: "HIGH", vertical: vertical.slug, path: "analyze", issue: `${vertical.slug} analyzer has no file upload input` });
  }

  // Find the first file input and upload the synthetic quote
  const fileInput = await page.$("input[type='file']");
  if (fileInput) {
    try {
      await fileInput.uploadFile(synthFile);
      bucket.steps.push({ step: "upload synth quote", ok: true });
      // Wait for analyzer to process (Tesseract is slow)
      await sleep(8000);
      await shot(page, `${vertical.slug}-a-03-afterupload`);
      const post = await page.evaluate(() => {
        const b = document.body.innerText || "";
        return {
          hasDollar: /\$\d/.test(b),
          hasResult: /result|verdict|analysis|total|range|fair/i.test(b),
          hasError: /error|failed|couldn.?t parse|invalid/i.test(b),
          textLen: b.length,
        };
      });
      bucket.steps.push({ step: "post-upload state", ...post });
      if (post.hasError) {
        findings.push({ sev: "MED", vertical: vertical.slug, path: "analyze", issue: "error text visible after upload (may be fixture-specific; worth checking)" });
      }
    } catch (e) {
      bucket.steps.push({ step: "upload synth quote", ok: false, error: e.message.slice(0, 200) });
      findings.push({ sev: "MED", vertical: vertical.slug, path: "analyze", issue: "upload threw: " + e.message.slice(0, 100) });
    }
  }

  bucket.errs = errs;
  bucket.reqFails = reqFails;
  return bucket;
}

// -------------- COMPARE PATH --------------
async function walkCompare(page, vertical, synthFiles, findings) {
  const bucket = { path: "compare", steps: [] };
  const { errs, reqFails } = attachErrors(page);

  await page.goto(BASE + "/", { waitUntil: "networkidle2", timeout: 15000 });
  await sleep(800);

  const c1 = await clickByText(page, "a", ["compare", "multiple quotes", "2 or 3"]);
  bucket.steps.push({ step: "click compare card", ...c1 });
  if (!c1.clicked) {
    findings.push({ sev: "HIGH", vertical: vertical.slug, path: "compare", issue: "cannot find compare intent card on homepage" });
    bucket.errs = errs;
    bucket.reqFails = reqFails;
    return bucket;
  }
  await sleep(1500);
  await shot(page, `${vertical.slug}-c-01-picker`);

  const labelRegexes = [vertical.label];
  if (vertical.altLabel) labelRegexes.push(vertical.altLabel);
  const c2 = await clickByText(page, "a", labelRegexes);
  bucket.steps.push({ step: "click vertical card", ...c2 });
  if (!c2.clicked) {
    findings.push({ sev: "HIGH", vertical: vertical.slug, path: "compare", issue: `cannot find ${vertical.label} on compare picker` });
    bucket.errs = errs;
    bucket.reqFails = reqFails;
    return bucket;
  }
  await sleep(3000); // compare router may redirect
  await shot(page, `${vertical.slug}-c-02-page`);

  const d = await describe(page);
  bucket.steps.push({ step: "landed compare", url: d.url, h1: d.h1, fileInputCount: d.fileInputCount });

  if (d.fileInputCount < 2) {
    findings.push({ sev: "HIGH", vertical: vertical.slug, path: "compare", issue: `${vertical.slug} compare page has only ${d.fileInputCount} file input(s) — expected 2+ for side-by-side` });
  }

  // Try to upload to the first 2 slots
  const fileInputs = await page.$$("input[type='file']");
  let uploaded = 0;
  for (let i = 0; i < Math.min(2, fileInputs.length, synthFiles.length); i++) {
    try {
      await fileInputs[i].uploadFile(synthFiles[i]);
      uploaded++;
      await sleep(1000);
    } catch (e) {
      bucket.steps.push({ step: `upload slot ${i}`, ok: false, error: e.message.slice(0, 100) });
    }
  }
  bucket.steps.push({ step: "uploads completed", uploaded });
  if (uploaded >= 2) {
    await sleep(10000); // give OCR time
    await shot(page, `${vertical.slug}-c-03-afteruploads`);
    // Try to click the "Compare" button
    const clickCmp = await clickByText(page, "button", ["compare.*quote", "^compare$"]);
    bucket.steps.push({ step: "click compare button", ...clickCmp });
    await sleep(2500);
    await shot(page, `${vertical.slug}-c-04-results`);
  }

  bucket.errs = errs;
  bucket.reqFails = reqFails;
  return bucket;
}

// -------------- MAIN --------------
(async () => {
  await setup();
  const server = await serve();
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  // Build 3 synth quote files
  const synthFiles = [];
  for (let i = 0; i < 3; i++) synthFiles.push(await buildSynthQuote(browser, i));
  console.log("Built synth quote fixtures:", synthFiles.length);

  const verticals = pickRandom(ALL_VERTICALS, 6);
  console.log("Selected verticals:", verticals.map(v => v.slug).join(", "));

  const report = {};
  const findings = [];

  for (const v of verticals) {
    console.log(`\n=== ${v.slug} (${v.label}) ===`);
    report[v.slug] = { label: v.label };

    for (const fn of [walkEstimate, walkAnalyze, walkCompare]) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1366, height: 900 });
      const pathName = fn.name.replace("walk", "").toLowerCase();
      try {
        if (fn === walkEstimate) report[v.slug].estimate = await fn(page, v, findings);
        else if (fn === walkAnalyze) report[v.slug].analyze = await fn(page, v, synthFiles[0], findings);
        else report[v.slug].compare = await fn(page, v, synthFiles, findings);
      } catch (e) {
        findings.push({ sev: "HIGH", vertical: v.slug, path: pathName, issue: "walker threw: " + e.message.slice(0, 200) });
      }
      await page.close();
    }
  }

  await browser.close();
  server.close();

  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ verticals: report, findings }, null, 2));

  console.log("\n\n====== FINDINGS ======\n");
  if (findings.length === 0) {
    console.log("(none — all paths completed without issues)");
  } else {
    for (const f of findings) {
      console.log(`[${f.sev}] ${f.vertical} / ${f.path}: ${f.issue}`);
    }
  }
  console.log(`\n${findings.length} total findings. Report + screenshots in ${OUT}`);
})();
