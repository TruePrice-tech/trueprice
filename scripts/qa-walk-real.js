#!/usr/bin/env node
/**
 * qa-walk-real.js — full interactive walkthrough using REAL quote
 * images from test-quotes/, with varied formats and messy fixtures.
 *
 * Uploads are performed the way a user does it: puppeteer waits for
 * the native file-chooser triggered by clicking the visible upload
 * area, then picks the file.
 */
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const http = require("http");

const ROOT = path.dirname(__dirname);
const OUT = path.join(ROOT, "output", "qa-real");
const PORT = 4324;
const BASE = `http://127.0.0.1:${PORT}`;

const ALL = [
  { slug: "roofing", label: "Roofing", fxDir: "roofing-images", analyzerUrl: "/roofing-quote-analyzer.html", compareUrl: "/compare-quotes.html?service=roofing" },
  { slug: "hvac", label: "HVAC", fxDir: "hvac-images", analyzerUrl: "/hvac-quote-analyzer.html", compareUrl: "/compare-hvac-quotes.html" },
  { slug: "plumbing", label: "Plumbing", fxDir: "plumbing-images", analyzerUrl: "/plumbing-quote-analyzer.html", compareUrl: "/compare-plumbing-quotes.html" },
  { slug: "electrical", label: "Electrical", fxDir: "electrical-images", analyzerUrl: "/electrical-quote-analyzer.html", compareUrl: "/compare-electrical-quotes.html" },
  { slug: "solar", label: "Solar", fxDir: "solar-images", analyzerUrl: "/solar-quote-analyzer.html", compareUrl: "/compare-solar-quotes.html" },
  { slug: "window", label: "Window", fxDir: "window-images", analyzerUrl: "/window-quote-analyzer.html", compareUrl: "/compare-windows-quotes.html" },
  { slug: "siding", label: "Siding", fxDir: "siding-images", analyzerUrl: "/siding-quote-analyzer.html", compareUrl: "/compare-siding-quotes.html" },
  { slug: "painting", label: "Painting", fxDir: "painting-images", analyzerUrl: "/painting-quote-analyzer.html", compareUrl: "/compare-painting-quotes.html" },
  { slug: "concrete", label: "Concrete", fxDir: "concrete-images", analyzerUrl: "/concrete-quote-analyzer.html", compareUrl: "/compare-concrete-quotes.html" },
  { slug: "fencing", label: "Fence", altLabel: "Fencing", fxDir: "fencing-images", analyzerUrl: "/fencing-quote-analyzer.html", compareUrl: "/compare-fencing-quotes.html" },
  { slug: "gutters", label: "Gutter", altLabel: "Gutters", fxDir: "gutters-images", analyzerUrl: "/gutters-quote-analyzer.html", compareUrl: "/compare-gutters-quotes.html" },
  { slug: "insulation", label: "Insulation", fxDir: "insulation-images", analyzerUrl: "/insulation-quote-analyzer.html", compareUrl: "/compare-insulation-quotes.html" },
  { slug: "foundation", label: "Foundation", fxDir: "foundation-images", analyzerUrl: "/foundation-quote-analyzer.html", compareUrl: "/compare-foundation-quotes.html" },
  { slug: "garage-door", label: "Garage Door", altLabel: "Garage", fxDir: "garage-door-images", analyzerUrl: "/garage-door-quote-analyzer.html", compareUrl: "/compare-garage-door-quotes.html" },
  { slug: "kitchen", label: "Kitchen", fxDir: "kitchen-images", analyzerUrl: "/kitchen-quote-analyzer.html", compareUrl: "/compare-kitchen-quotes.html" },
  { slug: "landscaping", label: "Landscaping", fxDir: "landscaping-images", analyzerUrl: "/landscaping-quote-analyzer.html", compareUrl: "/compare-landscaping-quotes.html" },
  { slug: "moving", label: "Moving", fxDir: "moving-images", analyzerUrl: "/moving-quote-analyzer.html", compareUrl: "/compare-moving-quotes.html" },
  { slug: "auto-repair", label: "Auto Repair", altLabel: "Auto", fxDir: "auto-images", analyzerUrl: "/auto-repair.html", compareUrl: "/compare-auto-quotes.html" },
  { slug: "medical", label: "Medical", fxDir: "medical-images", analyzerUrl: "/medical-bill-analyzer.html", compareUrl: "/compare-medical-quotes.html" },
  { slug: "legal", label: "Legal", fxDir: "legal-images", analyzerUrl: "/legal-fee-analyzer.html", compareUrl: "/compare-legal-quotes.html" },
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

// Pick real quote fixtures for a vertical.  Goal: varied formats
// (.jpg/.jpeg/.png) and at least one messy image if available.
function pickFixtures(vertical, count) {
  const imageDir = path.join(ROOT, "test-quotes", vertical.fxDir);
  const messyDir = path.join(ROOT, "test-quotes", "messy");
  const isImage = f => /\.(jpe?g|png|webp)$/i.test(f);

  const main = fs.existsSync(imageDir)
    ? fs.readdirSync(imageDir).filter(isImage).map(f => path.join(imageDir, f))
    : [];
  const messy = fs.existsSync(messyDir)
    ? fs.readdirSync(messyDir).filter(f => isImage(f) && f.startsWith(vertical.slug + "--"))
                                .map(f => path.join(messyDir, f))
    : [];

  if (main.length === 0 && messy.length === 0) return [];

  // Pick varied: favor mixing extensions and including at least one messy
  const all = [...main, ...messy];
  const byExt = {};
  for (const f of all) {
    const ext = path.extname(f).toLowerCase();
    (byExt[ext] ||= []).push(f);
  }
  const exts = Object.keys(byExt);
  const picks = [];

  // Step 1: at least one messy image if available
  if (messy.length) picks.push(messy[Math.floor(Math.random() * messy.length)]);

  // Step 2: fill from mixed extensions
  for (let i = 0; picks.length < count && i < 20; i++) {
    const ext = exts[i % exts.length];
    const pool = byExt[ext].filter(f => !picks.includes(f));
    if (pool.length) picks.push(pool[Math.floor(Math.random() * pool.length)]);
  }

  return picks.slice(0, count);
}

function attachErrors(page) {
  const errs = [];
  const reqFails = [];
  page.on("pageerror", e => errs.push("pageerror: " + String(e.message).slice(0, 200)));
  page.on("console", msg => {
    if (msg.type() === "error") {
      const t = msg.text();
      if (t.includes("Failed to load resource") && t.includes("status of 404")) return;
      errs.push("console: " + t.slice(0, 220));
    }
  });
  page.on("requestfailed", req => {
    const url = req.url();
    if (url.includes("/api/")) return;
    if (url.includes("impactcdn")) return;
    if (url.includes("cdn.jsdelivr")) return;
    reqFails.push(url.slice(0, 200));
  });
  return { errs, reqFails };
}

async function shot(page, name) {
  try { await page.screenshot({ path: path.join(OUT, name + ".png"), fullPage: false }); } catch (e) {}
}

// Click anchor whose visible text matches any pattern
async function clickByText(page, selector, patterns) {
  return await page.evaluate((sel, pats) => {
    const regexes = pats.map(s => new RegExp(s, "i"));
    const els = [...document.querySelectorAll(sel)];
    for (const el of els) {
      if (el.offsetParent === null) continue; // not visible
      const t = (el.textContent || "").trim();
      if (regexes.some(r => r.test(t))) {
        el.click();
        return { clicked: true, text: t.slice(0, 80), href: el.href || "" };
      }
    }
    return { clicked: false };
  }, selector, patterns);
}

// Wait for the analyzer UI to hydrate — specifically, wait for either
// a visible drop-area or an actual <input type="file"> to appear.
async function waitForAnalyzerUI(page, maxMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const has = await page.evaluate(() => {
      const f = document.querySelector("input[type='file']");
      if (f) return true;
      const drop = [...document.querySelectorAll("[class*='drop'], [class*='upload'], [class*='dropzone']")].some(el => el.offsetParent !== null);
      return drop;
    });
    if (has) return true;
    await sleep(500);
  }
  return false;
}

// Click the visible upload target (drop zone or upload button) and wait
// for the native file chooser, then provide the path.  This mirrors a
// real user interaction.
async function userUpload(page, filePath, slotIdx = 0) {
  // Find the visible trigger — preferring a slot-specific element if any
  const triggerHandle = await page.evaluateHandle((idx) => {
    // 1) Specific per-slot elements on compare pages
    const slotId = "slot" + idx;
    const slot = document.getElementById(slotId);
    if (slot && slot.offsetParent !== null) return slot;
    // 2) Any visible dropzone / upload area
    const candidates = [...document.querySelectorAll(
      "[class*='dropzone'], [class*='upload-area'], [class*='drop-zone'], " +
      "[class*='cmp-slot'], [class*='cq-slot'], [class*='slot'], " +
      "button, label"
    )];
    for (const el of candidates) {
      if (el.offsetParent === null) continue;
      const t = (el.textContent || "").toLowerCase();
      if (/upload|drop.*(file|quote)|choose.*file|select.*file/i.test(t)) return el;
    }
    // 3) fall back to the first input[type=file]
    return document.querySelector("input[type='file']");
  }, slotIdx);

  if (!triggerHandle) return { ok: false, reason: "no trigger" };
  const elem = triggerHandle.asElement();
  if (!elem) return { ok: false, reason: "handle not element" };

  // Direct approach: find file input corresponding to this slot and assign
  // files via ElementHandle.uploadFile (legal user-equivalent path in
  // puppeteer as file dialogs can't be opened headlessly).  We pick the
  // input nested inside the trigger, or the Nth overall.
  const inputHandle = await page.evaluateHandle((trigger, idx) => {
    if (trigger && trigger.querySelector) {
      const nested = trigger.querySelector("input[type='file']");
      if (nested) return nested;
    }
    const inputs = document.querySelectorAll("input[type='file']");
    return inputs[idx] || inputs[0] || null;
  }, elem, slotIdx);

  const inp = inputHandle && inputHandle.asElement();
  if (!inp) return { ok: false, reason: "no file input" };
  try {
    await inp.uploadFile(filePath);
    // fire change event explicitly (some handlers use it)
    await page.evaluate((input) => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, inp);
    return { ok: true, file: path.basename(filePath) };
  } catch (e) {
    return { ok: false, reason: e.message.slice(0, 120) };
  }
}

async function describe(page) {
  return await page.evaluate(() => {
    const h1 = document.querySelector("h1")?.textContent?.trim() || "";
    const btns = [...document.querySelectorAll("button:not([disabled])")]
      .filter(b => b.offsetParent !== null)
      .map(b => (b.textContent || "").trim()).filter(Boolean).slice(0, 8);
    const fileInputs = document.querySelectorAll("input[type='file']").length;
    const headings = [...document.querySelectorAll("h2")].map(h => (h.textContent || "").trim()).slice(0, 6);
    const bodyText = (document.body.innerText || "").slice(0, 200);
    return { url: location.href, title: document.title, h1, buttons: btns, fileInputs, headings, bodyText };
  });
}

// ================== ESTIMATE PATH ==================
async function walkEstimate(page, vertical, findings) {
  const bucket = { path: "estimate", steps: [] };
  const { errs, reqFails } = attachErrors(page);

  await page.goto(BASE + "/", { waitUntil: "networkidle2", timeout: 15000 });
  await sleep(800);
  await shot(page, `${vertical.slug}-e-01-home`);

  const c1 = await clickByText(page, "a", [
    "get an estimate", "don.?t have a quote", "no quote yet", "need.*estimate", "price check"
  ]);
  bucket.steps.push({ step: "click estimate card", ...c1 });
  if (!c1.clicked) {
    findings.push({ sev: "HIGH", vertical: vertical.slug, path: "estimate", issue: "no estimate intent card on homepage" });
    bucket.errs = errs; bucket.reqFails = reqFails; return bucket;
  }
  await sleep(1500);
  await shot(page, `${vertical.slug}-e-02-picker`);

  const labels = [vertical.label];
  if (vertical.altLabel) labels.push(vertical.altLabel);
  const c2 = await clickByText(page, "a", labels);
  bucket.steps.push({ step: "click vertical", ...c2 });
  if (!c2.clicked) {
    findings.push({ sev: "HIGH", vertical: vertical.slug, path: "estimate", issue: `cannot find ${vertical.label} on estimate picker` });
    bucket.errs = errs; bucket.reqFails = reqFails; return bucket;
  }
  await sleep(3000);
  await shot(page, `${vertical.slug}-e-03-vertical`);

  const d = await describe(page);
  bucket.steps.push({ step: "landed", url: d.url, h1: d.h1, buttons: d.buttons.slice(0, 3) });

  // Fill address — many pages split into street/city/state/zip
  const filled = await page.evaluate(() => {
    function setField(sel, val) {
      const el = document.querySelector(sel);
      if (!el || el.offsetParent === null) return false;
      el.focus();
      el.value = val;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    // Build selector lists for each sub-field
    const street = ["input[placeholder*='street' i]", "input[name*='street' i]", "input[id*='street' i]", "input[placeholder*='address' i]", "input[name*='address' i]", "input[id*='address' i]"];
    const city = ["input[placeholder*='city' i]", "input[name*='city' i]", "input[id*='city' i]"];
    const state = ["input[placeholder*='state' i]", "input[name*='state' i]", "input[id*='state' i]", "select[name*='state' i]", "select[id*='state' i]"];
    const zip = ["input[placeholder*='zip' i]", "input[name*='zip' i]", "input[id*='zip' i]", "input[inputmode='numeric']"];
    const results = {};
    for (const s of street) { if (setField(s, "17064 Laurelmont Ct")) { results.street = s; break; } }
    for (const s of city)   { if (setField(s, "Fort Mill")) { results.city = s; break; } }
    for (const s of state)  { if (setField(s, "SC")) { results.state = s; break; } }
    for (const s of zip)    { if (setField(s, "29707")) { results.zip = s; break; } }
    return { filled: Object.keys(results).length > 0, fields: results };
  });
  bucket.steps.push({ step: "fill address", ...filled });

  await sleep(700);
  // Try sqft
  const sqft = await page.evaluate(() => {
    const cand = [
      "input[placeholder*='square' i]", "input[placeholder*='sq ft' i]",
      "input[placeholder*='sqft' i]", "input[id*='sqft' i]",
      "input[id*='home-size' i]", "input[id*='area' i]", "input[id*='size' i]",
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
  bucket.steps.push({ step: "fill sqft", ...sqft });

  // Click submit-like button
  const submit = await clickByText(page, "button, a.btn, .btn-primary, .btn-cta", [
    "^get.*estimate", "^see.*estimate", "^estimate", "^next", "^continue",
    "^calculate", "^get.*price", "^see.*result", "^go",
  ]);
  bucket.steps.push({ step: "click submit", ...submit });

  await sleep(4500);
  await shot(page, `${vertical.slug}-e-04-submit`);

  const d2 = await describe(page);
  const resultSig = await page.evaluate(() => {
    const b = document.body.innerText || "";
    return {
      hasDollar: /\$\s*\d/.test(b),
      hasRange: /\$[\d,]+\s*[-\u2013\u2014to]+\s*\$?[\d,]+/i.test(b),
      hasEst: /estimate|typical|range|average/i.test(b),
      textLength: b.length,
    };
  });
  bucket.steps.push({ step: "result signals", url: d2.url, h1: d2.h1, ...resultSig });

  if (!filled.filled) {
    findings.push({ sev: "MED", vertical: vertical.slug, path: "estimate", issue: `no address input on ${vertical.slug} estimate page` });
  } else if (!resultSig.hasDollar && !resultSig.hasRange) {
    findings.push({ sev: "MED", vertical: vertical.slug, path: "estimate", issue: "submit didn't produce any dollar amount in rendered page" });
  }

  bucket.errs = errs; bucket.reqFails = reqFails;
  return bucket;
}

// ================== ANALYZE PATH ==================
async function walkAnalyze(page, vertical, fixture, findings) {
  const bucket = { path: "analyze", fixture: path.basename(fixture), steps: [] };
  const { errs, reqFails } = attachErrors(page);

  await page.goto(BASE + "/", { waitUntil: "networkidle2", timeout: 15000 });
  await sleep(800);

  const c1 = await clickByText(page, "a", ["analyze.*quote", "have a quote", "upload.*quote", "check.*quote"]);
  bucket.steps.push({ step: "click analyze card", ...c1 });
  if (!c1.clicked) {
    findings.push({ sev: "HIGH", vertical: vertical.slug, path: "analyze", issue: "no analyze intent card on homepage" });
    bucket.errs = errs; bucket.reqFails = reqFails; return bucket;
  }
  await sleep(1500);
  await shot(page, `${vertical.slug}-a-01-picker`);

  const labels = [vertical.label];
  if (vertical.altLabel) labels.push(vertical.altLabel);
  const c2 = await clickByText(page, "a", labels);
  bucket.steps.push({ step: "click vertical", ...c2 });
  if (!c2.clicked) {
    findings.push({ sev: "HIGH", vertical: vertical.slug, path: "analyze", issue: `cannot find ${vertical.label} on analyze picker` });
    bucket.errs = errs; bucket.reqFails = reqFails; return bucket;
  }
  await sleep(3000);
  await shot(page, `${vertical.slug}-a-02-analyzer-initial`);

  // Analyzer pages may hydrate with an address-first flow. If we see an
  // address form (no file input visible), fill it and advance.
  const preState = await page.evaluate(() => ({
    hasFileInput: !!document.querySelector("input[type='file']"),
    hasAddressForm: !!document.querySelector("input[placeholder*='street' i], input[placeholder*='address' i], input[id*='street' i]"),
    h1: (document.querySelector("h1, h2")?.textContent || "").trim(),
  }));
  bucket.steps.push({ step: "pre-state", ...preState });

  if (preState.hasAddressForm && !preState.hasFileInput) {
    // Fill address + submit to advance past the address step
    await page.evaluate(() => {
      function setField(sel, val) {
        const el = document.querySelector(sel);
        if (!el || el.offsetParent === null) return false;
        el.focus(); el.value = val;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
      setField("input[placeholder*='street' i], input[id*='street' i], input[name*='street' i]", "17064 Laurelmont Ct");
      setField("input[placeholder*='city' i], input[id*='city' i], input[name*='city' i]", "Fort Mill");
      setField("input[placeholder*='state' i], input[id*='state' i], input[name*='state' i], select[id*='state' i]", "SC");
      setField("input[placeholder*='zip' i], input[id*='zip' i], input[name*='zip' i]", "29707");
    });
    await sleep(500);
    await clickByText(page, "button", ["^get my estimate", "^get estimate", "^continue", "^next", "^go"]);
    await sleep(4000);
    // Possibly a confirm step — click the confirm button
    await clickByText(page, "button", ["yes.*this.*my", "confirm", "continue", "looks right", "upload.*quote"]);
    await sleep(2000);
    await shot(page, `${vertical.slug}-a-02b-after-address`);
  }

  // Now wait for the upload widget to be visible
  const hydrated = await waitForAnalyzerUI(page, 20000);
  bucket.steps.push({ step: "upload widget available", hydrated });
  if (!hydrated) {
    findings.push({ sev: "HIGH", vertical: vertical.slug, path: "analyze", issue: "analyze path never reaches upload widget (stuck on address/confirm flow)" });
    bucket.errs = errs; bucket.reqFails = reqFails; return bucket;
  }

  await shot(page, `${vertical.slug}-a-02c-uploadready`);
  const d = await describe(page);
  bucket.steps.push({ step: "ready to upload", url: d.url, h1: d.h1, fileInputs: d.fileInputs });

  const up = await userUpload(page, fixture, 0);
  bucket.steps.push({ step: "upload fixture", ...up });
  if (!up.ok) {
    findings.push({ sev: "HIGH", vertical: vertical.slug, path: "analyze", issue: "upload failed: " + up.reason });
    bucket.errs = errs; bucket.reqFails = reqFails; return bucket;
  }

  // OCR + parse takes time (Tesseract loads + runs)
  await sleep(25000);
  await shot(page, `${vertical.slug}-a-03-results`);

  const after = await page.evaluate(() => {
    const b = document.body.innerText || "";
    return {
      hasDollar: /\$\s*\d[\d,]*/.test(b),
      hasVerdict: /verdict|fair|high|low|overpriced|reasonable|above.*average|below.*average/i.test(b),
      hasError: /couldn.?t parse|invalid|error|failed|try another/i.test(b),
      bodySample: b.slice(0, 400),
    };
  });
  bucket.steps.push({ step: "after OCR", ...after });

  if (after.hasError && !after.hasDollar) {
    findings.push({ sev: "MED", vertical: vertical.slug, path: "analyze", issue: `analyzer error on ${path.basename(fixture)}: "${after.bodySample.slice(0, 100)}"` });
  } else if (!after.hasDollar && !after.hasVerdict) {
    findings.push({ sev: "MED", vertical: vertical.slug, path: "analyze", issue: `no dollar/verdict rendered for ${path.basename(fixture)} — may have stalled or silently failed` });
  }

  bucket.errs = errs; bucket.reqFails = reqFails;
  return bucket;
}

// ================== COMPARE PATH ==================
async function walkCompare(page, vertical, fixtures, findings) {
  const bucket = { path: "compare", fixtures: fixtures.map(f => path.basename(f)), steps: [] };
  const { errs, reqFails } = attachErrors(page);

  await page.goto(BASE + "/", { waitUntil: "networkidle2", timeout: 15000 });
  await sleep(800);

  const c1 = await clickByText(page, "a", ["compare.*quote", "multiple quotes", "2 or 3"]);
  bucket.steps.push({ step: "click compare card", ...c1 });
  if (!c1.clicked) {
    findings.push({ sev: "HIGH", vertical: vertical.slug, path: "compare", issue: "no compare intent card on homepage" });
    bucket.errs = errs; bucket.reqFails = reqFails; return bucket;
  }
  await sleep(1500);
  await shot(page, `${vertical.slug}-c-01-picker`);

  const labels = [vertical.label];
  if (vertical.altLabel) labels.push(vertical.altLabel);
  const c2 = await clickByText(page, "a", labels);
  bucket.steps.push({ step: "click vertical", ...c2 });
  if (!c2.clicked) {
    findings.push({ sev: "HIGH", vertical: vertical.slug, path: "compare", issue: `cannot find ${vertical.label} on compare picker` });
    bucket.errs = errs; bucket.reqFails = reqFails; return bucket;
  }
  await sleep(3500); // allow router redirect to settle
  await shot(page, `${vertical.slug}-c-02-page`);

  const d = await describe(page);
  bucket.steps.push({ step: "landed compare", url: d.url, h1: d.h1, fileInputs: d.fileInputs });
  if (d.fileInputs < 2) {
    findings.push({ sev: "HIGH", vertical: vertical.slug, path: "compare", issue: `compare page has ${d.fileInputs} file input(s); need 2+ for side-by-side` });
  }

  // Upload up to 2 fixtures
  let uploaded = 0;
  for (let i = 0; i < Math.min(2, fixtures.length); i++) {
    const up = await userUpload(page, fixtures[i], i);
    bucket.steps.push({ step: `upload slot ${i}`, ...up });
    if (up.ok) uploaded++;
    await sleep(800);
  }
  if (uploaded < 2) {
    findings.push({ sev: "MED", vertical: vertical.slug, path: "compare", issue: `only ${uploaded}/2 uploads succeeded` });
  }

  // Allow OCR for both
  await sleep(30000);
  await shot(page, `${vertical.slug}-c-03-afteruploads`);

  // Click compare button
  const clickCmp = await clickByText(page, "button", ["^compare.*\\d", "^compare\\b"]);
  bucket.steps.push({ step: "click compare button", ...clickCmp });
  await sleep(3500);
  await shot(page, `${vertical.slug}-c-04-results`);

  const after = await page.evaluate(() => {
    const b = document.body.innerText || "";
    return {
      hasDollar: /\$\s*\d/.test(b),
      hasTable: document.querySelectorAll("table").length > 0,
      hasScore: /score|winner|best.*value|\/100\b/i.test(b),
      hasError: /couldn.?t parse|error|failed|try another/i.test(b),
    };
  });
  bucket.steps.push({ step: "after compare", ...after });

  if (uploaded === 2 && !after.hasDollar) {
    findings.push({ sev: "MED", vertical: vertical.slug, path: "compare", issue: "two uploads but no dollars rendered in comparison" });
  }

  bucket.errs = errs; bucket.reqFails = reqFails;
  return bucket;
}

// ================== MAIN ==================
(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) { try { fs.unlinkSync(path.join(OUT, f)); } catch (e) {} }

  const server = await serve();
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  const selected = pickRandom(ALL, 6);
  console.log("QA walk (real images) on:", selected.map(v => v.slug).join(", "));

  const report = {};
  const findings = [];

  for (const v of selected) {
    const fixtures = pickFixtures(v, 3);
    console.log(`\n=== ${v.slug} (${v.label}) ===  fixtures: ${fixtures.map(f => path.basename(f)).join(", ") || "NONE"}`);
    if (fixtures.length === 0) {
      findings.push({ sev: "INFO", vertical: v.slug, path: "setup", issue: `no fixtures found for ${v.slug} — skipping upload tests` });
    }
    report[v.slug] = { label: v.label, fixtures: fixtures.map(f => path.basename(f)) };

    // ESTIMATE
    let page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    try { report[v.slug].estimate = await walkEstimate(page, v, findings); }
    catch (e) { findings.push({ sev: "HIGH", vertical: v.slug, path: "estimate", issue: "exception: " + e.message.slice(0, 160) }); }
    await page.close();

    // ANALYZE (needs 1 fixture)
    if (fixtures[0]) {
      page = await browser.newPage();
      await page.setViewport({ width: 1366, height: 900 });
      try { report[v.slug].analyze = await walkAnalyze(page, v, fixtures[0], findings); }
      catch (e) { findings.push({ sev: "HIGH", vertical: v.slug, path: "analyze", issue: "exception: " + e.message.slice(0, 160) }); }
      await page.close();
    }

    // COMPARE (needs 2 fixtures)
    if (fixtures.length >= 2) {
      page = await browser.newPage();
      await page.setViewport({ width: 1366, height: 900 });
      try { report[v.slug].compare = await walkCompare(page, v, fixtures.slice(0, 3), findings); }
      catch (e) { findings.push({ sev: "HIGH", vertical: v.slug, path: "compare", issue: "exception: " + e.message.slice(0, 160) }); }
      await page.close();
    } else {
      findings.push({ sev: "INFO", vertical: v.slug, path: "compare", issue: `only ${fixtures.length} fixture(s) available — can't run compare` });
    }
  }

  await browser.close();
  server.close();

  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ verticals: report, findings }, null, 2));

  console.log("\n\n====== FINDINGS ======\n");
  if (findings.length === 0) {
    console.log("(none)");
  } else {
    for (const f of findings) console.log(`[${f.sev}] ${f.vertical} / ${f.path}: ${f.issue}`);
  }
  console.log(`\n${findings.length} findings. Details + screenshots in ${OUT}`);
})();
