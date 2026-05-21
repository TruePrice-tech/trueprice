// Roofing FULL deep dive: estimate permutations + every fixture + compare clean+messy + mobile + print + CTAs
// Usage: BASE=https://woogoro.com node scripts/roofing-walk-full.js [phase]
//   phase: estimate | analyze | compare | mobile | print | all (default: all)
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "roofing-walk-full-2026-04-27");
const BASE = process.env.BASE || "https://woogoro.com";
const PHASE = (process.argv[2] || "all").toLowerCase();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name, full = false) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: full });
  console.log(`  shot${full ? " (full)" : ""}: ${name}`);
}

async function newPage(browser, label, mobile = false) {
  const page = await browser.newPage();
  if (mobile) {
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1");
  } else {
    await page.setViewport({ width: 1280, height: 900 });
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  }
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (req.url().includes("/api/geocode-suggest")) {
      req.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ suggestions: [] }) });
    } else {
      req.continue();
    }
  });
  page.on("console", (m) => {
    const t = m.text();
    if (/error|fail|TP_Engine|verdict|funnel|reference|undefined/i.test(t)) {
      console.log(`  [${label} console]`, m.type(), t.substring(0, 280));
    }
  });
  page.on("pageerror", (e) => console.log(`  [${label} pageerror]`, e.message));
  return page;
}

async function fillAddressAndAdvance(page, street = "17064 Laurelmont Ct", city = "Fort Mill", state = "SC", zip = "29707") {
  await page.evaluate(({ street, city, state, zip }) => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) { el.value = v; el.dispatchEvent(new Event("input", {bubbles: true})); el.dispatchEvent(new Event("change", {bubbles: true})); } };
    set("journeyStreetAddress", street);
    set("journeyCity", city);
    set("journeyState", state);
    set("journeyZipCode", zip);
  }, { street, city, state, zip });
  await sleep(500);
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const t = btns.find(b => /get my estimate/i.test((b.textContent || "").trim()));
    if (t) t.click();
  });
  await sleep(3500);
}

async function answerEstimator(page, answers, homeSize) {
  await page.evaluate(({ answers, homeSize }) => {
    Object.entries(answers).forEach(([group, val]) => {
      const card = document.querySelector(`button.est-option[data-group="${group}"][data-value="${val}"]`);
      if (card) card.click();
    });
    const sz = document.getElementById("estHomeSize");
    if (sz) { sz.value = String(homeSize); sz.dispatchEvent(new Event("input", {bubbles: true})); }
  }, { answers, homeSize });
  await sleep(700);
}

async function clickSubmitAndWait(page, prefix, label, fullShot = true) {
  await page.evaluate(() => {
    const btn = document.getElementById("estSubmitBtn");
    if (btn) btn.click();
  });
  console.log(`  ${label}: clicked submit`);
  await sleep(5000);
  await shot(page, `${prefix}-result-top`);
  if (fullShot) await shot(page, `${prefix}-result-full`, true);
}

// ── ESTIMATE PERMUTATIONS ─────────────────────────────────────────────
const ESTIMATE_SCENARIOS = [
  {
    id: "01-baseline-replacement-architectural",
    label: "Baseline: replacement / fall / two-story / architectural / normal / complex / no insurance / 3200 sqft",
    answers: { workType: "replacement", season: "fall", propertyType: "two_story", material: "architectural", steepness: "normal", complexity: "complex", insurance: "no", ownership: "yes" },
    homeSize: 3200,
    expected: "Lane's home, $14K-22K range expected (3200 sqft × $5.25 base × 1.03 SC × 1.12 normal × 1.15 complex × 0.55 two_story = ~$11K, but adjustments may push higher)"
  },
  {
    id: "02-repair-asphalt-asap",
    label: "Repair / asap / single-story / asphalt / flat / normal / yes insurance / 1800 sqft",
    answers: { workType: "repair", season: "asap", propertyType: "single", material: "asphalt", steepness: "flat", complexity: "normal", insurance: "yes", ownership: "yes" },
    homeSize: 1800,
    expected: "Repair scope = 35% × asphalt $4.25/sqft × 1800 = ~$2,400 (with multipliers)"
  },
  {
    id: "03-metal-premium-very-steep",
    label: "Replacement / spring / two-story / metal / steep / very-complex / no / 2800 sqft",
    answers: { workType: "replacement", season: "spring", propertyType: "two_story", material: "metal", steepness: "steep", complexity: "very_complex", insurance: "no", ownership: "yes" },
    homeSize: 2800,
    expected: "Metal $11.50/sqft × 2800 × 1.25 steep × 1.30 very-complex × 0.55 two-story = ~$28K-35K"
  },
  {
    id: "04-townhome-budget",
    label: "Replacement / unsure / townhome / asphalt / normal / normal / no / 1200 sqft",
    answers: { workType: "replacement", season: "unsure", propertyType: "townhome", material: "asphalt", steepness: "normal", complexity: "normal", insurance: "no", ownership: "yes" },
    homeSize: 1200,
    expected: "Asphalt townhome $4.25 × 1200 × 0.45 = small ($2K-4K)"
  },
  {
    id: "05-tile-luxury-very-steep",
    label: "Replacement / summer / single / tile / very-steep / very-complex / maybe insurance / 4500 sqft",
    answers: { workType: "replacement", season: "summer", propertyType: "single", material: "tile", steepness: "very_steep", complexity: "very_complex", insurance: "maybe", ownership: "yes" },
    homeSize: 4500,
    expected: "Tile $12/sqft × 4500 × 1.40 very-steep × 1.30 very-complex × 1.0 single = ~$98K"
  },
  {
    id: "06-cedar-rental-winter",
    label: "Replacement / winter / two-story / cedar / steep / complex / no insurance / 2400 sqft / RENTAL",
    answers: { workType: "replacement", season: "winter", propertyType: "two_story", material: "cedar", steepness: "steep", complexity: "complex", insurance: "no", ownership: "no" },
    homeSize: 2400,
    expected: "Cedar $9/sqft × 2400 × 1.25 steep × 1.15 complex × 0.55 two-story × 0.97 winter = ~$17K, plus rental UX state"
  },
  {
    id: "07-flat-membrane-proactive",
    label: "Proactive / fall / single / flat / flat / normal / no / 1500 sqft",
    answers: { workType: "proactive", season: "fall", propertyType: "single", material: "flat", steepness: "flat", complexity: "normal", insurance: "no", ownership: "yes" },
    homeSize: 1500,
    expected: "Flat $5.50/sqft × 1500 × 1.0 × 1.0 × 1.0 = ~$8.5K"
  }
];

async function runEstimateScenarios(browser) {
  for (const sc of ESTIMATE_SCENARIOS) {
    const page = await newPage(browser, `est-${sc.id}`);
    console.log(`\n=== ESTIMATE ${sc.id} ===\n${sc.label}\nExpected: ${sc.expected}`);
    await page.goto(`${BASE}/roofing-quote-analyzer.html?mode=estimator`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(2500);
    await fillAddressAndAdvance(page);
    await answerEstimator(page, sc.answers, sc.homeSize);
    await shot(page, `est-${sc.id}-answers`, true);
    await clickSubmitAndWait(page, `est-${sc.id}`, sc.id);
    await page.close();
  }
}

// ── ANALYZE FIXTURES ─────────────────────────────────────────────────
const ANALYZE_FIXTURES = [
  { id: "fx-real-03-metal", file: "03-how-over-priced-is-this-estimate-for-a-metal-roof.jpeg", expected: "Metal standing seam $136,375. Without size, plausibility is hard. Should ask for size or warn about size unknown." },
  { id: "fx-real-07-2000sqft", file: "07-2000sqft-home-roof-estimate-is-this-a-decent-price.jpg", expected: "Architectural + 12/12 steep on 2000 sqft, $10,500 — slightly LOW given steep premium ($12-18K expected). Should flag steep undersold." },
  { id: "fx-syn-01-low-budget", file: "comparison-roof-01-low.png", expected: "$7,565 OC Oakridge 2200 sqft. Should detect: weak warranty (25/1 labor), no ice/water shield, no kick-out flashing." },
  { id: "fx-syn-02-mid-heritage", file: "comparison-roof-02-mid.png", expected: "$11,895 CertainTeed full system. Should rate FAIR-PRICED with strong scope detection." },
  { id: "fx-syn-03-high-pinnacle", file: "comparison-roof-03-high.png", expected: "$17,500 GAF premium. Premium tier. Long-warranty justification expected." },
  { id: "fx-msy-01-low-budget", file: "messy-comparison-roof-01-low.jpg", expected: "Same as 01 but rotated/skewed scan — OCR robustness check" },
  { id: "fx-msy-02-mid-heritage", file: "messy-comparison-roof-02-mid.jpg", expected: "Same as 02, OCR robustness check" },
  { id: "fx-msy-03-high-pinnacle", file: "messy-comparison-roof-03-high.jpg", expected: "Same as 03, OCR robustness check" }
];

async function runAnalyzeFixtures(browser) {
  for (const fx of ANALYZE_FIXTURES) {
    const page = await newPage(browser, fx.id);
    console.log(`\n=== ANALYZE ${fx.id} ===\nFile: ${fx.file}\nExpected: ${fx.expected}`);
    await page.goto(`${BASE}/roofing-quote-analyzer.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(2500);

    let fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      // It might need to wait for analyzer-ui to render the upload UI
      await sleep(3000);
      fileInput = await page.$('input[type="file"]');
    }
    if (!fileInput) {
      const txt = await page.evaluate(() => document.body.innerText.substring(0, 400));
      console.log("  no file input. body:", txt.replace(/\n+/g, " | ").substring(0, 200));
      await shot(page, `${fx.id}-no-input`);
      await page.close();
      continue;
    }
    await fileInput.uploadFile(path.join(ROOT, "test-quotes/roofing-images", fx.file));
    console.log("  uploaded:", fx.file);

    const start1 = Date.now();
    let phase = null;
    while (Date.now() - start1 < 90000) {
      await sleep(2500);
      phase = await page.evaluate(() => {
        const visible = (e) => e && e.offsetParent !== null;
        const btns = Array.from(document.querySelectorAll("button")).filter(visible);
        const confirm = btns.find(b => /yes,?\s+analyze\s+this\s+price|confirm|continue with this/i.test((b.textContent || "").trim()));
        if (confirm && !confirm.disabled) return "confirm";
        const verdictHit = !!document.querySelector('[class*="verdict"], [data-verdict]');
        if (verdictHit) return "verdict_direct";
        // Address step? (analyzer asks for city/state for benchmark)
        const addrInput = document.getElementById("journeyStreetAddress");
        if (addrInput && addrInput.offsetParent !== null) return "address";
        return null;
      });
      if (phase) break;
    }
    console.log("  phase:", phase, "after", Math.round((Date.now() - start1) / 1000) + "s");
    await shot(page, `${fx.id}-01-after-upload`);

    if (phase === "address") {
      await fillAddressAndAdvance(page);
      // Now wait for confirm or verdict
      const start2 = Date.now();
      while (Date.now() - start2 < 60000) {
        await sleep(2500);
        const next = await page.evaluate(() => {
          const visible = (e) => e && e.offsetParent !== null;
          const btns = Array.from(document.querySelectorAll("button")).filter(visible);
          const confirm = btns.find(b => /yes,?\s+analyze\s+this\s+price|confirm|continue with this/i.test((b.textContent || "").trim()));
          if (confirm && !confirm.disabled) return "confirm";
          const verdictHit = !!document.querySelector('[class*="verdict"], [data-verdict]');
          if (verdictHit) return "verdict_direct";
          return null;
        });
        if (next === "confirm") { phase = "confirm"; break; }
        if (next === "verdict_direct") { phase = "verdict_direct"; break; }
      }
    }

    if (phase === "confirm") {
      await shot(page, `${fx.id}-02-confirm-step`);
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const t = btns.find(b => /yes,?\s+analyze\s+this\s+price|confirm|continue with this/i.test((b.textContent || "").trim()));
        if (t) t.click();
      });
      const start2 = Date.now();
      while (Date.now() - start2 < 90000) {
        await sleep(2500);
        const done = await page.evaluate(() => !!document.querySelector('[class*="verdict"], [data-verdict]'));
        if (done) break;
      }
      await sleep(1500);
    } else if (phase === "verdict_direct") {
      await sleep(1500);
    }

    await shot(page, `${fx.id}-03-result-top`);
    await shot(page, `${fx.id}-04-result-full`, true);

    // Extract verdict text for sanity check
    const verdictText = await page.evaluate(() => {
      const el = document.querySelector('[class*="verdict"], [data-verdict], .analyzer-result, .result-card');
      return el ? el.innerText.substring(0, 800) : "(no verdict)";
    });
    console.log("  verdict:", verdictText.replace(/\n+/g, " | ").substring(0, 300));

    await page.close();
  }
}

// ── COMPARE ──────────────────────────────────────────────────────────
const COMPARE_SETS = [
  { id: "cmp-clean", files: ["comparison-roof-01-low.png", "comparison-roof-02-mid.png", "comparison-roof-03-high.png"], expected: "Best value = #02 mid (Heritage CertainTeed). Low = #01 missing scope (no ice/water, weak warranty). High = #03 GAF premium with strongest warranty." },
  { id: "cmp-messy", files: ["messy-comparison-roof-01-low.jpg", "messy-comparison-roof-02-mid.jpg", "messy-comparison-roof-03-high.jpg"], expected: "Same content but rotated/skewed scans. OCR robustness." }
];

async function runCompareSets(browser) {
  for (const set of COMPARE_SETS) {
    const page = await newPage(browser, set.id);
    console.log(`\n=== COMPARE ${set.id} ===\nExpected: ${set.expected}`);
    await page.goto(`${BASE}/compare-roofing-quotes.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(2500);
    await shot(page, `${set.id}-01-landing`);

    const inputs = await page.$$('input[type="file"]');
    console.log("  file inputs:", inputs.length);
    for (let i = 0; i < Math.min(set.files.length, inputs.length); i++) {
      await inputs[i].uploadFile(path.join(ROOT, "test-quotes/roofing-images", set.files[i]));
      await sleep(900);
    }
    await shot(page, `${set.id}-02-uploaded`, true);

    const start1 = Date.now();
    let buttonReady = false;
    while (Date.now() - start1 < 150000) {
      await sleep(2000);
      buttonReady = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const t = btns.find(b => /^Compare\s+\d+\s+quotes?/i.test((b.textContent || "").trim()));
        return !!(t && !t.disabled && t.offsetParent !== null);
      });
      if (buttonReady) break;
    }
    console.log("  Compare ready:", buttonReady, "after", Math.round((Date.now()-start1)/1000)+"s");
    if (buttonReady) {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const t = btns.find(b => /^Compare\s+\d+\s+quotes?/i.test((b.textContent || "").trim()));
        if (t) t.click();
      });
      await sleep(5500);
      await shot(page, `${set.id}-03-result-top`);
      await shot(page, `${set.id}-04-result-full`, true);
    } else {
      await shot(page, `${set.id}-99-stuck`, true);
    }
    await page.close();
  }
}

// ── MOBILE PASS (smaller viewport) ─────────────────────────────────────
async function runMobilePass(browser) {
  // Estimate (mobile)
  {
    const page = await newPage(browser, "mob-est", true);
    console.log(`\n=== MOBILE: estimate ===`);
    await page.goto(`${BASE}/roofing-quote-analyzer.html?mode=estimator`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(2500);
    await shot(page, "mob-01-est-landing", true);
    await fillAddressAndAdvance(page);
    await shot(page, "mob-02-est-questions", true);
    await answerEstimator(page, ESTIMATE_SCENARIOS[0].answers, ESTIMATE_SCENARIOS[0].homeSize);
    await clickSubmitAndWait(page, "mob-03-est", "mobile estimate");
    await page.close();
  }
  // Analyze (mobile)
  {
    const page = await newPage(browser, "mob-ana", true);
    console.log(`\n=== MOBILE: analyze ===`);
    await page.goto(`${BASE}/roofing-quote-analyzer.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(2500);
    await shot(page, "mob-10-ana-landing", true);
    let fi = await page.$('input[type="file"]');
    if (!fi) { await sleep(3000); fi = await page.$('input[type="file"]'); }
    if (fi) {
      await fi.uploadFile(path.join(ROOT, "test-quotes/roofing-images/comparison-roof-02-mid.png"));
      await sleep(35000);
      // Try to advance through the address/confirm step
      const phase = await page.evaluate(() => {
        const visible = (e) => e && e.offsetParent !== null;
        const btns = Array.from(document.querySelectorAll("button")).filter(visible);
        const confirm = btns.find(b => /yes,?\s+analyze\s+this\s+price|confirm|continue with this/i.test((b.textContent || "").trim()));
        if (confirm && !confirm.disabled) return "confirm";
        const addrInput = document.getElementById("journeyStreetAddress");
        if (addrInput && addrInput.offsetParent !== null) return "address";
        const verdictHit = !!document.querySelector('[class*="verdict"], [data-verdict]');
        if (verdictHit) return "verdict_direct";
        return null;
      });
      console.log("  mob-ana phase:", phase);
      if (phase === "address") {
        await fillAddressAndAdvance(page);
        await sleep(15000);
      }
      // Click confirm if present
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const t = btns.find(b => /yes,?\s+analyze\s+this\s+price|confirm/i.test((b.textContent || "").trim()));
        if (t) t.click();
      });
      await sleep(20000);
      await shot(page, "mob-11-ana-result", true);
    }
    await page.close();
  }
  // Compare (mobile)
  {
    const page = await newPage(browser, "mob-cmp", true);
    console.log(`\n=== MOBILE: compare ===`);
    await page.goto(`${BASE}/compare-roofing-quotes.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(2500);
    await shot(page, "mob-20-cmp-landing", true);
    await page.close();
  }
}

// ── PRINT/PDF PASS ──────────────────────────────────────────────────
async function runPrintPass(browser) {
  // Run an estimate, then capture print mode + PDF body text
  {
    const page = await newPage(browser, "print-est");
    console.log(`\n=== PRINT: estimate ===`);
    await page.goto(`${BASE}/roofing-quote-analyzer.html?mode=estimator`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(2500);
    await fillAddressAndAdvance(page);
    await answerEstimator(page, ESTIMATE_SCENARIOS[0].answers, ESTIMATE_SCENARIOS[0].homeSize);
    await page.evaluate(() => { const btn = document.getElementById("estSubmitBtn"); if (btn) btn.click(); });
    await sleep(6000);
    await page.emulateMediaType("print");
    await sleep(500);
    await shot(page, "print-01-est-print-css", true);
    const pdfPath = path.join(OUT, "print-02-est.pdf");
    await page.pdf({ path: pdfPath, format: "Letter", printBackground: true });
    console.log("  pdf saved:", pdfPath);
    const printText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
    fs.writeFileSync(path.join(OUT, "print-est-body-text.txt"), printText);
    console.log("  body text len:", printText.length);
    await page.close();
  }
  // Analyze print
  {
    const page = await newPage(browser, "print-ana");
    console.log(`\n=== PRINT: analyze ===`);
    await page.goto(`${BASE}/roofing-quote-analyzer.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(2500);
    let fi = await page.$('input[type="file"]'); if (!fi) { await sleep(3000); fi = await page.$('input[type="file"]'); }
    if (fi) {
      await fi.uploadFile(path.join(ROOT, "test-quotes/roofing-images/comparison-roof-02-mid.png"));
      await sleep(35000);
      const phase = await page.evaluate(() => {
        const visible = (e) => e && e.offsetParent !== null;
        const btns = Array.from(document.querySelectorAll("button")).filter(visible);
        const confirm = btns.find(b => /yes,?\s+analyze\s+this\s+price|confirm|continue with this/i.test((b.textContent || "").trim()));
        if (confirm && !confirm.disabled) return "confirm";
        const addrInput = document.getElementById("journeyStreetAddress");
        if (addrInput && addrInput.offsetParent !== null) return "address";
        return "other";
      });
      if (phase === "address") {
        await fillAddressAndAdvance(page);
        await sleep(15000);
      }
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const t = btns.find(b => /yes,?\s+analyze\s+this\s+price|confirm/i.test((b.textContent || "").trim()));
        if (t) t.click();
      });
      await sleep(20000);
    }
    await page.emulateMediaType("print");
    await sleep(500);
    await shot(page, "print-10-ana-print-css", true);
    const pdfPath = path.join(OUT, "print-11-ana.pdf");
    await page.pdf({ path: pdfPath, format: "Letter", printBackground: true });
    console.log("  pdf saved:", pdfPath);
    const printText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
    fs.writeFileSync(path.join(OUT, "print-ana-body-text.txt"), printText);
    await page.close();
  }
}

// ── CTA exercise: Save PDF / Share / Start Over / Compare CTA on estimate result ────
async function runCtaPass(browser) {
  const page = await newPage(browser, "cta-est");
  console.log(`\n=== CTA: estimate result page ===`);
  await page.goto(`${BASE}/roofing-quote-analyzer.html?mode=estimator`, { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(2500);
  await fillAddressAndAdvance(page);
  await answerEstimator(page, ESTIMATE_SCENARIOS[0].answers, ESTIMATE_SCENARIOS[0].homeSize);
  await page.evaluate(() => { const btn = document.getElementById("estSubmitBtn"); if (btn) btn.click(); });
  await sleep(6000);

  // Enumerate every CTA button on result
  const ctas = await page.evaluate(() => {
    const visible = (e) => e && e.offsetParent !== null;
    return Array.from(document.querySelectorAll("button, a")).filter(visible).map(el => ({
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || el.textContent || "").trim().substring(0, 80),
      href: el.getAttribute("href") || "",
      id: el.id || "",
      cls: (el.className || "").substring(0, 80)
    })).filter(b => b.text && b.text.length > 1);
  });
  console.log("  CTAs found:", ctas.length);
  fs.writeFileSync(path.join(OUT, "cta-list-estimate.json"), JSON.stringify(ctas, null, 2));

  // Click Save PDF (or "Download PDF" or print)
  const pdfClickResult = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button, a")).filter(e => e.offsetParent !== null);
    const pdfBtn = btns.find(b => /save\s+as\s+pdf|download\s+pdf|save\s+pdf|print/i.test((b.innerText || b.textContent || "").trim()));
    if (!pdfBtn) return { found: false };
    return { found: true, text: pdfBtn.innerText.trim() };
  });
  console.log("  Save PDF button:", pdfClickResult);

  // Click Share — capture clipboard or share UI
  const shareClickResult = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button, a")).filter(e => e.offsetParent !== null);
    const sb = btns.find(b => /share|copy\s+link/i.test((b.innerText || b.textContent || "").trim()));
    if (!sb) return { found: false };
    sb.click();
    return { found: true, text: sb.innerText.trim() };
  });
  await sleep(2500);
  await shot(page, "cta-11-after-share-click", true);
  console.log("  Share button result:", shareClickResult);

  await page.close();
}

(async () => {
  console.log("Phase:", PHASE, "Output:", OUT, "Base:", BASE);
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  try {
    if (PHASE === "all" || PHASE === "estimate") await runEstimateScenarios(browser);
    if (PHASE === "all" || PHASE === "analyze") await runAnalyzeFixtures(browser);
    if (PHASE === "all" || PHASE === "compare") await runCompareSets(browser);
    if (PHASE === "all" || PHASE === "mobile") await runMobilePass(browser);
    if (PHASE === "all" || PHASE === "print") await runPrintPass(browser);
    if (PHASE === "all" || PHASE === "cta") await runCtaPass(browser);
  } finally {
    await browser.close();
  }
  console.log("\nDONE. Output:", OUT);
})().catch(e => { console.error("FATAL:", e); process.exit(1); });
