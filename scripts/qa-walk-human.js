#!/usr/bin/env node
/**
 * qa-walk-human.js — full human-like walkthrough against the LIVE site.
 *
 * For each of 5-6 verticals (including roofing), walks all 3 paths from
 * homepage to results, using real messy images with varied formats.
 *
 * Critical improvements vs earlier scripts:
 *   - Runs against truepricehq.com (latest deployed code, working APIs)
 *   - Handles the multi-step analyze flow (address -> confirm -> upload)
 *   - Uses page.waitForFileChooser for user-equivalent file upload
 *   - Waits for OCR + analysis (up to 60s per quote)
 *   - Screenshots every critical state for later review
 */
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = path.dirname(__dirname);
const OUT = path.join(ROOT, "output", "qa-human");
const BASE = "https://truepricehq.com";

const ALL = [
  { slug: "roofing", label: "Roofing", fxDir: "roofing-images" },
  { slug: "hvac", label: "HVAC", fxDir: "hvac-images" },
  { slug: "plumbing", label: "Plumbing", fxDir: "plumbing-images" },
  { slug: "electrical", label: "Electrical", fxDir: "electrical-images" },
  { slug: "solar", label: "Solar", fxDir: "solar-images" },
  { slug: "painting", label: "Painting", fxDir: "painting-images" },
  { slug: "siding", label: "Siding", fxDir: "siding-images" },
  { slug: "concrete", label: "Concrete", fxDir: "concrete-images" },
  { slug: "fencing", label: "Fence", altLabel: "Fencing", fxDir: "fencing-images" },
  { slug: "gutters", label: "Gutter", altLabel: "Gutters", fxDir: "gutters-images" },
  { slug: "insulation", label: "Insulation", fxDir: "insulation-images" },
  { slug: "kitchen", label: "Kitchen", fxDir: "kitchen-images" },
  { slug: "landscaping", label: "Landscaping", fxDir: "landscaping-images" },
  { slug: "moving", label: "Moving", fxDir: "moving-images" },
  { slug: "auto-repair", label: "Auto Repair", altLabel: "Auto", fxDir: "auto-images" },
  { slug: "medical", label: "Medical", fxDir: "medical-images" },
  { slug: "legal", label: "Legal", fxDir: "legal-images" },
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
const isImage = f => /\.(jpe?g|png|webp)$/i.test(f);

// Pick real fixtures: one messy (if available) + varied formats
function pickFixtures(v, count = 3) {
  const main = path.join(ROOT, "test-quotes", v.fxDir);
  const messy = path.join(ROOT, "test-quotes", "messy");
  const mainImgs = fs.existsSync(main)
    ? fs.readdirSync(main).filter(isImage).map(f => path.join(main, f))
    : [];
  const messyImgs = fs.existsSync(messy)
    ? fs.readdirSync(messy).filter(f => isImage(f) && f.startsWith(v.slug.replace("auto-repair", "auto") + "--"))
                              .map(f => path.join(messy, f))
    : [];
  const picks = [];
  if (messyImgs.length) picks.push(messyImgs[0]);
  // Try to get varied extensions
  const byExt = {};
  for (const f of mainImgs) {
    const ext = path.extname(f).toLowerCase();
    (byExt[ext] ||= []).push(f);
  }
  const exts = Object.keys(byExt);
  for (let i = 0; picks.length < count && i < 10; i++) {
    const ext = exts[i % Math.max(1, exts.length)];
    const pool = (byExt[ext] || []).filter(f => !picks.includes(f));
    if (pool.length) picks.push(pool[0]);
  }
  return picks.slice(0, count);
}

async function shot(page, name) {
  try { await page.screenshot({ path: path.join(OUT, name + ".png"), fullPage: false }); } catch (e) {}
}

async function shotFull(page, name) {
  try { await page.screenshot({ path: path.join(OUT, name + ".png"), fullPage: true }); } catch (e) {}
}

function attachErrors(page) {
  const errs = [];
  const reqFails = [];
  page.on("pageerror", e => errs.push("pageerror: " + String(e.message).slice(0, 200)));
  page.on("console", msg => {
    if (msg.type() === "error") {
      const t = msg.text();
      if (t.includes("Failed to load resource") && t.includes("status of 404")) return;
      errs.push("console: " + t.slice(0, 200));
    }
  });
  page.on("requestfailed", req => {
    const url = req.url();
    if (url.includes("impactcdn") || url.includes("googletag") || url.includes("google-analytics")) return;
    reqFails.push(url.slice(0, 180));
  });
  return { errs, reqFails };
}

// Click anchor or button whose visible text matches
async function clickByText(page, selector, patterns) {
  return await page.evaluate((sel, pats) => {
    const regexes = pats.map(s => new RegExp(s, "i"));
    const els = [...document.querySelectorAll(sel)];
    for (const el of els) {
      if (el.offsetParent === null) continue;
      const t = ((el.textContent || "") + " " + (el.ariaLabel || "")).trim();
      if (regexes.some(r => r.test(t))) {
        el.click();
        return { clicked: true, text: t.slice(0, 80) };
      }
    }
    return { clicked: false };
  }, selector, patterns);
}

// Click an element matching a CSS selector directly (most reliable)
async function clickSelector(page, selector) {
  return await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el && el.offsetParent !== null) {
      el.click();
      return { clicked: true, href: el.href || "", text: (el.textContent || "").trim().slice(0, 80) };
    }
    return { clicked: false, reason: "not found or not visible" };
  }, selector);
}

// Wait for a condition to be true (polling)
async function waitFor(page, fn, maxMs = 20000, intervalMs = 500, label = "") {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const v = await page.evaluate(fn);
      if (v) return { ok: true, ms: Date.now() - start };
    } catch (e) {}
    await sleep(intervalMs);
  }
  return { ok: false, ms: Date.now() - start, label };
}

// Fill address form (handles single field or split street/city/state/zip)
async function fillAddress(page, address = { street: "17064 Laurelmont Ct", city: "Fort Mill", state: "SC", zip: "29707" }) {
  return await page.evaluate((addr) => {
    function setField(sels, val) {
      for (const sel of sels) {
        const els = [...document.querySelectorAll(sel)];
        for (const el of els) {
          if (el.offsetParent === null) continue;
          el.focus();
          if (el.tagName === "SELECT") {
            el.value = val;
          } else {
            el.value = val;
          }
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          return sel;
        }
      }
      return null;
    }
    const r = {};
    r.street = setField([
      "input[placeholder*='street' i]", "input[id*='street' i]", "input[name*='street' i]",
      "input[placeholder*='address' i]", "input[id*='address' i]", "input[name*='address' i]",
    ], addr.street);
    r.city = setField([
      "input[placeholder*='city' i]", "input[id*='city' i]", "input[name*='city' i]",
    ], addr.city);
    r.state = setField([
      "input[placeholder*='state' i]", "input[id*='state' i]", "input[name*='state' i]",
      "select[name*='state' i]", "select[id*='state' i]",
    ], addr.state);
    r.zip = setField([
      "input[placeholder*='zip' i]", "input[id*='zip' i]", "input[name*='zip' i]",
      "input[inputmode='numeric']",
    ], addr.zip);
    return r;
  }, address);
}

// Upload a file by triggering the file chooser the way a user would.
// Puppeteer's waitForFileChooser captures the native dialog that would
// open when a button or hidden input.click() fires, and lets us supply
// the file path as if the user picked it.
async function uploadAsUser(page, filePath, triggerSelector) {
  try {
    // Try fileChooser approach first (real user-click pattern)
    const [chooser] = await Promise.all([
      page.waitForFileChooser({ timeout: 5000 }).catch(() => null),
      page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) el.click();
      }, triggerSelector),
    ]);
    if (chooser) {
      await chooser.accept([filePath]);
      return { ok: true, method: "fileChooser" };
    }
  } catch (e) {}

  // Fallback: find the underlying file input and assign directly
  const inputHandle = await page.$("input[type='file']");
  if (!inputHandle) return { ok: false, reason: "no file input found" };
  try {
    await inputHandle.uploadFile(filePath);
    await page.evaluate((inp) => {
      inp.dispatchEvent(new Event("change", { bubbles: true }));
    }, inputHandle);
    return { ok: true, method: "uploadFile-fallback" };
  } catch (e) {
    return { ok: false, reason: e.message.slice(0, 120) };
  }
}

async function describe(page) {
  return await page.evaluate(() => {
    const h1 = document.querySelector("h1")?.textContent?.trim() || "";
    const h2s = [...document.querySelectorAll("h2")].map(h => (h.textContent || "").trim()).slice(0, 5);
    const buttons = [...document.querySelectorAll("button")]
      .filter(b => b.offsetParent !== null && !b.disabled)
      .map(b => (b.textContent || "").trim()).filter(Boolean).slice(0, 8);
    const fileInputs = document.querySelectorAll("input[type='file']").length;
    const body = (document.body.innerText || "").slice(0, 300);
    return { url: location.href, title: document.title, h1, h2s, buttons, fileInputs, bodySnippet: body };
  });
}

// Advance past any address/confirm steps to reach an upload widget or
// estimator questions, depending on mode.
async function advanceJourneySteps(page, vertical, mode, bucket) {
  // Step 1: if address form visible, fill and submit
  const hasAddress = await page.evaluate(() =>
    !!document.querySelector("input[placeholder*='street' i], input[id*='street' i]")
  );
  if (hasAddress) {
    const f = await fillAddress(page);
    bucket.steps.push({ step: "fill-address", ...f });
    await sleep(600);
    const c = await clickByText(page, "button", ["^get my estimate", "^get estimate", "^continue", "^next", "^go"]);
    bucket.steps.push({ step: "submit-address", ...c });
    await sleep(5000);
    await shot(page, `${vertical.slug}-${mode}-addr-submitted`);
  }

  // Step 2: if confirm step visible, click confirm
  const confirmClick = await clickByText(page, "button", [
    "yes.*this.*(home|address|property|my)",
    "confirm.*(address|property)",
    "looks right", "^confirm\\b", "^yes\\b",
    "this is (my|our|the) (home|house|property)",
  ]);
  if (confirmClick.clicked) {
    bucket.steps.push({ step: "click-confirm", ...confirmClick });
    await sleep(3500);
    await shot(page, `${vertical.slug}-${mode}-after-confirm`);
  }

  // Step 3: wait for the appropriate next UI
  if (mode === "analyze") {
    const ok = await waitFor(page, () => {
      // Look for ANY sign of an upload widget: visible file input, drop zone
      const visibleDropzone = [...document.querySelectorAll(
        "[class*='upload'], [class*='drop'], [class*='dropzone'], [class*='cmp-slot'], [class*='cq-slot']"
      )].some(el => el.offsetParent !== null);
      const hasInput = !!document.querySelector("input[type='file']");
      return visibleDropzone || hasInput;
    }, 20000, 600, "upload-widget");
    bucket.steps.push({ step: "wait-upload-widget", ...ok });
    return ok.ok;
  }

  return true;
}

// ==================== ESTIMATE PATH ====================
async function walkEstimate(page, vertical, findings) {
  const bucket = { path: "estimate", steps: [] };
  const { errs, reqFails } = attachErrors(page);

  await page.goto(BASE + "/", { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(1500);
  await shot(page, `${vertical.slug}-e-01-home`);

  // Click the estimate intent card — use href for reliability
  const c1 = await clickSelector(page, 'a[href="/get-an-estimate.html"].tp-intent-card');
  bucket.steps.push({ step: "click-estimate-card", ...c1 });
  if (!c1.clicked) {
    findings.push({ sev: "HIGH", vertical: vertical.slug, path: "estimate", issue: "no estimate intent card found on homepage" });
    bucket.errs = errs; bucket.reqFails = reqFails; return bucket;
  }
  await sleep(2500);
  await shot(page, `${vertical.slug}-e-02-picker`);

  // Click vertical
  const labels = [vertical.label];
  if (vertical.altLabel) labels.push(vertical.altLabel);
  const c2 = await clickByText(page, "a", labels.map(l => `\\b${l}\\b`));
  bucket.steps.push({ step: "click-vertical", ...c2 });
  if (!c2.clicked) {
    findings.push({ sev: "HIGH", vertical: vertical.slug, path: "estimate", issue: `cannot find ${vertical.label} card on estimate picker` });
    bucket.errs = errs; bucket.reqFails = reqFails; return bucket;
  }
  await sleep(3500);
  await shot(page, `${vertical.slug}-e-03-landed`);

  const d = await describe(page);
  bucket.steps.push({ step: "landed", url: d.url, h1: d.h1, buttons: d.buttons.slice(0, 4) });

  // Fill address (estimate path always starts with address)
  const addr = await fillAddress(page);
  bucket.steps.push({ step: "fill-address", fields: addr });
  await sleep(700);

  // Submit
  const sub = await clickByText(page, "button, a.btn, .btn-primary, .btn-cta", [
    "^get my estimate", "^get estimate", "^see my estimate", "^see estimate",
    "^estimate\\b", "^next\\b", "^continue\\b", "^calculate\\b",
  ]);
  bucket.steps.push({ step: "submit-estimate", ...sub });
  await sleep(6000);
  await shot(page, `${vertical.slug}-e-04-after-submit`);

  // Possibly a confirm step
  const confirm = await clickByText(page, "button", [
    "yes.*this.*(home|address|my)", "^confirm\\b", "looks right",
  ]);
  if (confirm.clicked) {
    bucket.steps.push({ step: "click-confirm", ...confirm });
    await sleep(5000);
    await shot(page, `${vertical.slug}-e-05-after-confirm`);
  }

  // Wait for either: estimator questions (sqft/stories) OR final dollar result
  const waitResult = await waitFor(page, () => {
    const b = document.body.innerText || "";
    return /\$[\d,]+/.test(b) || /how big|stories|square feet|sq ft|sq\. ft|home size/i.test(b);
  }, 30000, 700);
  bucket.steps.push({ step: "wait-estimator-or-result", ...waitResult });

  // If estimator questions appear, fill home-size and continue
  const hasSqft = await page.evaluate(() =>
    !!document.querySelector("input[placeholder*='square' i], input[id*='sqft' i], input[id*='home' i], input[id*='size' i]")
  );
  if (hasSqft) {
    await page.evaluate(() => {
      const el = document.querySelector("input[placeholder*='square' i], input[id*='sqft' i], input[id*='home' i], input[id*='size' i]");
      if (el) {
        el.focus(); el.value = "2400";
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await sleep(400);
    await clickByText(page, "button", ["^continue", "^next", "^see.*estimate", "^get.*estimate", "^calculate"]);
    await sleep(6000);
    await shot(page, `${vertical.slug}-e-06-after-sqft`);
  }

  await shotFull(page, `${vertical.slug}-e-07-final`);
  const final = await page.evaluate(() => {
    const b = document.body.innerText || "";
    return {
      hasDollar: /\$\s*\d[\d,]*/.test(b),
      hasRange: /\$[\d,]+\s*[-\u2013\u2014to]+\s*\$?[\d,]+/i.test(b),
      hasEstimate: /estimate|typical|average|range/i.test(b),
      snippet: b.slice(0, 300),
    };
  });
  bucket.steps.push({ step: "final-state", ...final });

  if (!final.hasDollar) {
    findings.push({
      sev: "MED", vertical: vertical.slug, path: "estimate",
      issue: `estimate path didn't render a dollar amount. Snippet: "${final.snippet.slice(0, 120)}..."`
    });
  }

  bucket.errs = errs; bucket.reqFails = reqFails; return bucket;
}

// ==================== ANALYZE PATH ====================
async function walkAnalyze(page, vertical, fixture, findings) {
  const bucket = { path: "analyze", fixture: path.basename(fixture), steps: [] };
  const { errs, reqFails } = attachErrors(page);

  await page.goto(BASE + "/", { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(1500);

  const c1 = await clickSelector(page, 'a[href="/analyze-my-quote.html"].tp-intent-card');
  bucket.steps.push({ step: "click-analyze-card", ...c1 });
  if (!c1.clicked) {
    findings.push({ sev: "HIGH", vertical: vertical.slug, path: "analyze", issue: "no analyze intent card on homepage" });
    bucket.errs = errs; bucket.reqFails = reqFails; return bucket;
  }
  await sleep(2500);
  await shot(page, `${vertical.slug}-a-01-picker`);

  const labels = [vertical.label];
  if (vertical.altLabel) labels.push(vertical.altLabel);
  const c2 = await clickByText(page, "a", labels.map(l => `\\b${l}\\b`));
  bucket.steps.push({ step: "click-vertical", ...c2 });
  if (!c2.clicked) {
    findings.push({ sev: "HIGH", vertical: vertical.slug, path: "analyze", issue: `cannot find ${vertical.label} on analyze picker` });
    bucket.errs = errs; bucket.reqFails = reqFails; return bucket;
  }
  await sleep(4000);
  await shot(page, `${vertical.slug}-a-02-landed`);

  // Analyze page typically shows upload CTA primary + address secondary.
  // Look for a file input — if it exists (hidden or visible), use the
  // uploadAsUser pattern by clicking the upload BUTTON (not the hidden input).
  const uploadReady = await page.evaluate(() => !!document.querySelector("input[type='file']"));
  bucket.steps.push({ step: "upload-widget-present", ok: uploadReady });

  let up;
  if (uploadReady) {
    // On analyzer pages the upload button id is uploadQuoteBtn, or the file
    // input itself is inside a clickable dropzone. Prefer clicking the
    // visible button trigger so puppeteer's waitForFileChooser fires.
    up = await uploadAsUser(page, fixture, "#uploadQuoteBtn, [id*='uploadDropZone'], #quoteFile, input[type='file']");
  } else {
    // Fall back to address-first flow (some verticals may still be estimator-only)
    const reached = await advanceJourneySteps(page, vertical, "analyze", bucket);
    await shot(page, `${vertical.slug}-a-03-ready-to-upload`);
    if (!reached) {
      findings.push({ sev: "HIGH", vertical: vertical.slug, path: "analyze", issue: "no upload widget and address fallback also failed" });
      bucket.errs = errs; bucket.reqFails = reqFails; return bucket;
    }
    up = await uploadAsUser(page, fixture, "input[type='file']");
  }
  bucket.steps.push({ step: "upload", ...up });
  if (!up.ok) {
    findings.push({ sev: "HIGH", vertical: vertical.slug, path: "analyze", issue: `upload failed: ${up.reason}` });
    bucket.errs = errs; bucket.reqFails = reqFails; return bucket;
  }

  // Wait for OCR + analysis (can take 30-60s on first load due to Tesseract + API)
  await sleep(45000);
  await shotFull(page, `${vertical.slug}-a-04-results`);

  const result = await page.evaluate(() => {
    const b = document.body.innerText || "";
    return {
      hasDollar: /\$\s*\d[\d,]*/.test(b),
      hasVerdict: /verdict|confidence|fair|high|low|overpriced|reasonable|below expected|above expected/i.test(b),
      hasScope: /tear[\s-]?off|underlayment|flashing|drip edge|ice.*water|ridge/i.test(b),
      hasError: /couldn.?t parse|invalid|failed|try another|error/i.test(b),
      snippet: b.slice(0, 400),
    };
  });
  bucket.steps.push({ step: "results-state", ...result });

  if (result.hasError && !result.hasDollar) {
    findings.push({
      sev: "MED", vertical: vertical.slug, path: "analyze",
      issue: `error after upload. Snippet: "${result.snippet.slice(0, 150)}"`
    });
  } else if (!result.hasDollar) {
    findings.push({
      sev: "MED", vertical: vertical.slug, path: "analyze",
      issue: `no dollar rendered after upload+45s wait. Snippet: "${result.snippet.slice(0, 150)}"`
    });
  }

  bucket.errs = errs; bucket.reqFails = reqFails; return bucket;
}

// ==================== COMPARE PATH ====================
async function walkCompare(page, vertical, fixtures, findings) {
  const bucket = { path: "compare", fixtures: fixtures.slice(0, 2).map(f => path.basename(f)), steps: [] };
  const { errs, reqFails } = attachErrors(page);

  await page.goto(BASE + "/", { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(1500);

  const c1 = await clickSelector(page, 'a[href="/compare-quotes-picker.html"].tp-intent-card');
  bucket.steps.push({ step: "click-compare-card", ...c1 });
  if (!c1.clicked) {
    findings.push({ sev: "HIGH", vertical: vertical.slug, path: "compare", issue: "no compare intent card on homepage" });
    bucket.errs = errs; bucket.reqFails = reqFails; return bucket;
  }
  await sleep(2500);
  await shot(page, `${vertical.slug}-c-01-picker`);

  const labels = [vertical.label];
  if (vertical.altLabel) labels.push(vertical.altLabel);
  const c2 = await clickByText(page, "a", labels.map(l => `\\b${l}\\b`));
  bucket.steps.push({ step: "click-vertical", ...c2 });
  if (!c2.clicked) {
    findings.push({ sev: "HIGH", vertical: vertical.slug, path: "compare", issue: `cannot find ${vertical.label} on compare picker` });
    bucket.errs = errs; bucket.reqFails = reqFails; return bucket;
  }
  await sleep(5000); // redirect/router settle
  await shot(page, `${vertical.slug}-c-02-landed`);

  const d = await describe(page);
  bucket.steps.push({ step: "landed", url: d.url, h1: d.h1, fileInputs: d.fileInputs });
  if (d.fileInputs < 2) {
    findings.push({ sev: "HIGH", vertical: vertical.slug, path: "compare", issue: `compare page has only ${d.fileInputs} file input(s); expected 2+` });
  }

  // Upload 2 fixtures — click slot 0 then slot 1 like a user
  let uploaded = 0;
  for (let i = 0; i < Math.min(2, fixtures.length); i++) {
    // Try fileChooser pattern for each slot click
    try {
      const [chooser] = await Promise.all([
        page.waitForFileChooser({ timeout: 5000 }).catch(() => null),
        page.evaluate((idx) => {
          const slot = document.getElementById("slot" + idx);
          if (slot) slot.click();
          else {
            // fallback: find Nth visible upload-ish element
            const cand = [...document.querySelectorAll("[class*='slot'], [class*='upload'], [class*='drop']")].filter(e => e.offsetParent !== null);
            if (cand[idx]) cand[idx].click();
          }
        }, i),
      ]);
      if (chooser) {
        await chooser.accept([fixtures[i]]);
        uploaded++;
      } else {
        // Fallback: get Nth input[type=file]
        const inputs = await page.$$("input[type='file']");
        if (inputs[i]) {
          await inputs[i].uploadFile(fixtures[i]);
          await page.evaluate((inp) => inp.dispatchEvent(new Event("change", { bubbles: true })), inputs[i]);
          uploaded++;
        }
      }
      bucket.steps.push({ step: `upload-slot-${i}`, file: path.basename(fixtures[i]), ok: true });
      await sleep(2500); // slight pause between uploads
    } catch (e) {
      bucket.steps.push({ step: `upload-slot-${i}`, ok: false, error: e.message.slice(0, 120) });
    }
  }
  bucket.uploaded = uploaded;
  if (uploaded < 2) {
    findings.push({ sev: "HIGH", vertical: vertical.slug, path: "compare", issue: `only ${uploaded}/2 uploads succeeded` });
  }

  // Allow OCR for both (client-side Tesseract + API parse)
  await sleep(60000);
  await shot(page, `${vertical.slug}-c-03-after-parse`);

  // Click Compare button
  const clickCmp = await clickByText(page, "button", ["^compare\\s+\\d", "^compare\\b"]);
  bucket.steps.push({ step: "click-compare", ...clickCmp });
  await sleep(4000);
  await shotFull(page, `${vertical.slug}-c-04-results`);

  const after = await page.evaluate(() => {
    const b = document.body.innerText || "";
    return {
      hasDollar: /\$\s*\d/.test(b),
      hasTable: document.querySelectorAll("table").length > 0,
      hasScore: /score|winner|best.*value|\/100\b/i.test(b),
      hasError: /couldn.?t parse|error|failed|try another/i.test(b),
      snippet: b.slice(0, 300),
    };
  });
  bucket.steps.push({ step: "compare-result", ...after });

  if (uploaded === 2 && !after.hasDollar) {
    findings.push({
      sev: "MED", vertical: vertical.slug, path: "compare",
      issue: `2 uploads completed but no dollar rendered in comparison. Snippet: "${after.snippet.slice(0, 120)}"`
    });
  }

  bucket.errs = errs; bucket.reqFails = reqFails; return bucket;
}

// ==================== MAIN ====================
(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) { try { fs.unlinkSync(path.join(OUT, f)); } catch (e) {} }

  // Ensure roofing is included; pick 4-5 others at random
  const roofing = ALL.find(v => v.slug === "roofing");
  const others = pickRandom(ALL.filter(v => v.slug !== "roofing"), 5);
  const selected = [roofing, ...others];
  console.log("Verticals:", selected.map(v => v.slug).join(", "));

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const report = {};
  const findings = [];

  for (const v of selected) {
    const fixtures = pickFixtures(v, 3);
    console.log(`\n=== ${v.slug} (${v.label}) ===  fixtures: [${fixtures.map(f => path.basename(f)).join(", ")}]`);
    report[v.slug] = { label: v.label, fixtures: fixtures.map(f => path.basename(f)) };
    if (fixtures.length === 0) {
      findings.push({ sev: "INFO", vertical: v.slug, path: "setup", issue: "no fixtures available; will skip upload tests" });
    }

    // Fresh page per path to avoid cached state
    for (const [fn, label, needsFixtures] of [
      [walkEstimate, "estimate", 0],
      [walkAnalyze, "analyze", 1],
      [walkCompare, "compare", 2],
    ]) {
      if (fixtures.length < needsFixtures) {
        findings.push({ sev: "INFO", vertical: v.slug, path: label, issue: `insufficient fixtures (${fixtures.length} of ${needsFixtures} needed)` });
        continue;
      }
      const page = await browser.newPage();
      await page.setViewport({ width: 1366, height: 900 });
      console.log(`  ${label}...`);
      try {
        if (fn === walkEstimate) report[v.slug].estimate = await fn(page, v, findings);
        else if (fn === walkAnalyze) report[v.slug].analyze = await fn(page, v, fixtures[0], findings);
        else report[v.slug].compare = await fn(page, v, fixtures.slice(0, 2), findings);
      } catch (e) {
        findings.push({ sev: "HIGH", vertical: v.slug, path: label, issue: "walker exception: " + e.message.slice(0, 200) });
      }
      await page.close();
    }
  }

  await browser.close();

  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ verticals: report, findings }, null, 2));

  console.log("\n\n====== FINDINGS ======\n");
  if (findings.length === 0) {
    console.log("(no issues)");
  } else {
    for (const f of findings) console.log(`[${f.sev}] ${f.vertical} / ${f.path}: ${f.issue}`);
  }
  console.log(`\n${findings.length} findings. Report + screenshots in ${OUT}`);
})();
