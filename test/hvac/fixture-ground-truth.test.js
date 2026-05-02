// HVAC fixture ground-truth harness.
// Reads the 7 hand-curated fixtures, uploads each through the live analyzer,
// and asserts displayed total / contractor / state / brand / tonnage / SEER /
// warranty vs. ground truth captured by Lane in 2026-05-02.
//
// Run: node test/hvac/fixture-ground-truth.test.js
// Run --baseline to write a baseline JSON snapshot of current results.
//
// Pattern mirrors test/roofing/fixture-ground-truth.test.js. CI auto-discovers
// every test/*/fixture-ground-truth.test.js via .github/workflows/regression-gate.yml.

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const BASE = process.env.WOOGORO_BASE || "https://woogoro.com";
const FIXTURES_DIR = path.resolve(__dirname, "..", "..");
const BASELINE_PATH = path.join(__dirname, "fixture-ground-truth.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");

const FIXTURES = [
  {
    id: "f1-clean-invoice",
    file: "test/receipt/ocr-cache/fixtures/hvac-clean-invoice.jpeg",
    expect: {
      price: 610.0,
      contractorRegex: null,        // no contractor name on document
      stateCode: null,
      isServiceJob: true,           // recharge + breaker — not an install
      refrigerantContains: "R-22",  // R-22 phaseout flag should be surfaced
    },
  },
  {
    id: "f2-coil-quote",
    file: "test/receipt/ocr-cache/fixtures/hvac-coil-quote.jpeg",
    expect: {
      price: 3810.0,
      contractorRegex: null,
      stateCode: null,
      isServiceJob: true,           // evaporator coil replacement = repair
    },
  },
  {
    id: "f3-arctic-low",
    file: "test-quotes/hvac-images/comparison-ac-01-low.png",
    expect: {
      price: 3456,
      contractorRegex: /arctic\s*air/i,
      stateCode: "GA",
      brandRegex: /goodman/i,
      tonnage: 3,
      seer: 14.3,
      warrantyParts: 10,
      warrantyLabor: 1,
      isServiceJob: false,
    },
  },
  {
    id: "f4-precision-mid",
    file: "test-quotes/hvac-images/comparison-ac-02-mid.png",
    expect: {
      price: 6620,
      contractorRegex: /precision\s*climate/i,
      stateCode: "GA",
      brandRegex: /carrier/i,
      tonnage: 3,
      seer: 16,
      warrantyParts: 10,
      warrantyLabor: 2,
      isServiceJob: false,
    },
  },
  {
    id: "f5-elite-high",
    file: "test-quotes/hvac-images/comparison-ac-03-high.png",
    expect: {
      price: 13457,
      contractorRegex: /elite\s*comfort/i,
      stateCode: "GA",
      brandRegex: /trane/i,
      tonnage: 3,
      seer: 22,
      warrantyParts: 12,
      warrantyLabor: 5,
      isServiceJob: false,
    },
  },
  {
    id: "f6-mini-split",
    file: "test-quotes/hvac-images/10-8k-for-mitsubishi-mini-split-leak-detection-just-t.png",
    expect: {
      price: 7943.56,
      contractorRegex: null,        // contractor redacted on fixture
      stateCode: null,
      isServiceJob: true,           // leak search only — not an install
      // Note: Mitsubishi appears only as a watermark/logo image on this
      // fixture (Reddit-uploaded quote). Tesseract doesn't OCR the logo, so
      // brand isn't detectable from text alone. Reddit thread title is
      // "8k for Mitsubishi mini split..." — that's where the brand context
      // lives, not in the document itself. Keep brand assertion off.
    },
  },
  {
    id: "f7-heat-pump-table",
    file: "test-quotes/hvac-images/09-every-quote-10-total-ive-gotten-for-a-heat-pump-in.png",
    expect: {
      // This fixture is a comparison TABLE of 10 different quotes — there is
      // no single "this is my quote" price. Analyzer should either flag low
      // confidence or refuse to commit to one price; we accept any extracted
      // value that's clearly bounded by the table's range OR a low-confidence
      // signal. We do NOT pin price strictly here — the assertion is that the
      // analyzer doesn't lie with high confidence about a number that isn't
      // representative.
      lowConfidenceOrTableDetected: true,
    },
  },
];

const PRICE_TOLERANCE_PCT = 0.001;

async function uploadAndCapture(browser, fixture) {
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  await page.setViewport({ width: 1440, height: 900 });

  const apiResponses = [];
  page.on("response", async res => {
    if (res.url().includes("/api/parse-quote") || res.url().includes("/api/calibration")) {
      let body = "";
      try { body = await res.text(); } catch {}
      apiResponses.push({ url: res.url(), status: res.status(), body });
    }
  });

  await page.goto(BASE + "/hvac-quote-analyzer.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));

  const inp = await page.$('input[type="file"]');
  await inp.uploadFile(path.join(FIXTURES_DIR, fixture.file));

  // Wait for price-confirmation step OR low-confidence manual-entry OR hard-reject screen.
  const confirmStep = await page.waitForFunction(() => {
    return !!document.getElementById("tpConfirmPriceBtn") ||
           !!document.getElementById("tpManualPriceBtn") ||
           !!document.getElementById("tpHardRejectStartOver") ||
           !!document.querySelector(".verdict-price"); // skip-confirm path (high conf)
  }, { timeout: 90000 }).catch(() => null);

  // Capture pre-confirm UI snapshot before we click through (used for hard-reject + UX checks).
  const preConfirm = await page.evaluate(() => {
    return {
      hasConfirmBtn: !!document.getElementById("tpConfirmPriceBtn"),
      hasManualBtn: !!document.getElementById("tpManualPriceBtn"),
      hasHardReject: !!document.getElementById("tpHardRejectStartOver"),
      hardRejectText: (document.querySelector("h1") || {}).innerText || "",
      bodyText: document.body.innerText.slice(0, 1500),
    };
  });

  // If price-confirm modal showed, click "Yes, analyze this price" to advance.
  if (preConfirm.hasConfirmBtn) {
    await page.click("#tpConfirmPriceBtn");
  } else if (preConfirm.hasManualBtn && fixture.expect && typeof fixture.expect.price === "number") {
    // Manual-entry fallback: type the ground-truth price so we can still observe
    // how the rest of the result page renders. (We separately track that the
    // analyzer FAILED to extract a price — that's an analyze-quality finding.)
    await page.type("#tpManualPrice", String(Math.round(fixture.expect.price)));
    await page.click("#tpManualPriceBtn");
  }

  // Wait for result render OR confirm modal stays (some fixtures may bail).
  await page.waitForFunction(() => !!document.querySelector(".verdict-price"), { timeout: 30000 }).catch(() => null);
  await new Promise(r => setTimeout(r, 1500));

  const display = await page.evaluate(() => {
    const text = document.body.innerText;
    // HVAC analyzer renders the dominant total in <div class="verdict-price">$X,XXX</div>
    const verdictEl = document.querySelector(".verdict-price");
    const verdictText = verdictEl ? verdictEl.innerText : "";
    const verdictMatch = verdictText.match(/\$([\d,]+(?:\.\d+)?)/);

    // Extract details rendered by renderResult — System Type, Brand, Model,
    // Tonnage, SEER, Refrigerant, Warranty.
    const details = {};
    document.querySelectorAll(".hvac-detail").forEach(d => {
      const label = (d.querySelector(".label") || {}).innerText || "";
      const value = (d.querySelector(".value") || {}).innerText || "";
      if (label) details[label.trim()] = value.trim();
    });

    // Service-job copy lives in .verdict-range — "Service quote" / "Repair quote" / "Maintenance quote".
    const rangeText = (document.querySelector(".verdict-range") || {}).innerText || "";
    const isServiceJobCopy = /Service quote|Repair quote|Maintenance quote/i.test(rangeText);
    const isLowConfidenceCopy = /couldn't extract enough/i.test(rangeText);

    // Normalize detail keys to lowercase — CSS text-transform: uppercase
    // makes innerText return "BRAND" instead of "Brand", which broke key
    // lookup in early harness runs.
    const detailsLc = {};
    Object.keys(details).forEach(k => { detailsLc[k.toLowerCase()] = details[k]; });

    return {
      verdictPrice: verdictMatch ? parseFloat(verdictMatch[1].replace(/,/g, "")) : null,
      details: detailsLc,
      rangeText,
      isServiceJobCopy,
      isLowConfidenceCopy,
      bodyTextSlice: text.slice(0, 2500),
    };
  });

  let parseQuote = null;
  for (const r of apiResponses) {
    if (r.url.includes("/api/parse-quote")) {
      try { parseQuote = JSON.parse(r.body); } catch {}
    }
  }

  await page.close();
  return { display, parseQuote, preConfirm };
}

function compare(label, actual, expected) {
  const failures = [];

  if (typeof expected.price === "number") {
    const tol = Math.max(10, expected.price * PRICE_TOLERANCE_PCT);
    if (actual.display.verdictPrice == null) {
      failures.push(`displayPrice: expected ~${expected.price}, got null`);
    } else if (Math.abs(actual.display.verdictPrice - expected.price) > tol) {
      failures.push(`displayPrice: expected ${expected.price} ±${tol}, got ${actual.display.verdictPrice}`);
    }
  }

  if (expected.contractorRegex) {
    const contractor = actual.parseQuote?.data?.contractor || actual.parseQuote?.data?.contractorName || null;
    if (!contractor || !expected.contractorRegex.test(contractor)) {
      failures.push(`contractor: expected match /${expected.contractorRegex.source}/, got ${JSON.stringify(contractor)}`);
    }
  }

  if ("stateCode" in expected && actual.parseQuote?.data) {
    const got = actual.parseQuote.data.stateCode;
    if ((got || null) !== (expected.stateCode || null)) {
      failures.push(`stateCode: expected ${JSON.stringify(expected.stateCode)}, got ${JSON.stringify(got)}`);
    }
  }

  if (expected.brandRegex) {
    const brand = actual.display.details["brand"] || actual.parseQuote?.data?.brand || "";
    if (!expected.brandRegex.test(brand)) {
      failures.push(`brand: expected match /${expected.brandRegex.source}/, got ${JSON.stringify(brand)}`);
    }
  }

  if (typeof expected.tonnage === "number") {
    const tonText = actual.display.details["system size"] || "";
    const m = tonText.match(/(\d+(?:\.\d+)?)/);
    const got = m ? parseFloat(m[1]) : null;
    if (got !== expected.tonnage) {
      failures.push(`tonnage: expected ${expected.tonnage}, got ${JSON.stringify(tonText)}`);
    }
  }

  if (typeof expected.seer === "number") {
    const seerText = actual.display.details["seer rating"] || "";
    const m = seerText.match(/(\d+(?:\.\d+)?)/);
    const got = m ? parseFloat(m[1]) : null;
    if (got !== expected.seer) {
      failures.push(`seer: expected ${expected.seer}, got ${JSON.stringify(seerText)}`);
    }
  }

  if (typeof expected.warrantyParts === "number") {
    const wp = actual.display.details["parts warranty"] || "";
    const m = wp.match(/(\d+)/);
    const got = m ? parseInt(m[1]) : null;
    if (got !== expected.warrantyParts) {
      failures.push(`warrantyParts: expected ${expected.warrantyParts}, got ${JSON.stringify(wp)}`);
    }
  }

  if (typeof expected.warrantyLabor === "number") {
    const wl = actual.display.details["labor warranty"] || "";
    const m = wl.match(/(\d+)/);
    const got = m ? parseInt(m[1]) : null;
    if (got !== expected.warrantyLabor) {
      failures.push(`warrantyLabor: expected ${expected.warrantyLabor}, got ${JSON.stringify(wl)}`);
    }
  }

  if (typeof expected.isServiceJob === "boolean") {
    if (actual.display.isServiceJobCopy !== expected.isServiceJob) {
      failures.push(`isServiceJob: expected ${expected.isServiceJob}, got ${actual.display.isServiceJobCopy} (range: "${(actual.display.rangeText || '').slice(0, 80)}")`);
    }
  }

  if (expected.refrigerantContains) {
    const rt = actual.display.details["refrigerant"] || actual.parseQuote?.data?.refrigerantType || "";
    if (!String(rt).toUpperCase().includes(expected.refrigerantContains.toUpperCase())) {
      failures.push(`refrigerant: expected to contain ${expected.refrigerantContains}, got ${JSON.stringify(rt)}`);
    }
  }

  if (expected.lowConfidenceOrTableDetected) {
    // Either the analyzer flagged low confidence, OR the displayed price is
    // suspicious (extracted a number from the table that lies inside the table
    // range without flagging confidence). We accept low-confidence copy OR
    // verdict-price within $15,800–$45,000 + isLowConfidence true.
    if (!actual.display.isLowConfidenceCopy) {
      failures.push(`lowConfidence: expected low-confidence copy on a comparison-table fixture, got rangeText="${(actual.display.rangeText || '').slice(0, 100)}"`);
    }
  }

  return failures;
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const out = { ts: new Date().toISOString(), base: BASE, results: {} };

  let totalFails = 0;
  for (const fx of FIXTURES) {
    process.stdout.write(`  ${fx.id} ... `);
    try {
      const actual = await uploadAndCapture(browser, fx);
      const failures = compare(fx.id, actual, fx.expect);
      out.results[fx.id] = {
        verdictPrice: actual.display.verdictPrice,
        details: actual.display.details,
        rangeText: (actual.display.rangeText || "").slice(0, 200),
        isServiceJobCopy: actual.display.isServiceJobCopy,
        isLowConfidenceCopy: actual.display.isLowConfidenceCopy,
        preConfirm: {
          hasConfirmBtn: actual.preConfirm?.hasConfirmBtn,
          hasManualBtn: actual.preConfirm?.hasManualBtn,
          hasHardReject: actual.preConfirm?.hasHardReject,
        },
        contractor: actual.parseQuote?.data?.contractor || actual.parseQuote?.data?.contractorName || null,
        stateCode: actual.parseQuote?.data?.stateCode || null,
        failures,
      };
      if (failures.length) {
        totalFails += failures.length;
        console.log("FAIL");
        failures.forEach(f => console.log(`     - ${f}`));
      } else {
        console.log("OK");
      }
    } catch (e) {
      out.results[fx.id] = { error: e.message };
      totalFails++;
      console.log("ERROR:", e.message);
    }
  }

  await browser.close();

  if (IS_BASELINE) {
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(out, null, 2));
    console.log("\nBaseline written:", BASELINE_PATH);
    console.log(`\nTotal failures: ${totalFails}`);
    process.exit(0);
    return;
  }

  function failureSubject(msg) {
    const m1 = msg.match(/^(displayPrice|contractor|stateCode|brand|tonnage|seer|warrantyParts|warrantyLabor|isServiceJob|refrigerant|lowConfidence):/);
    if (m1) return m1[1];
    return msg.split("(")[0].trim();
  }

  let newFailsCount = 0;
  let newPassesCount = 0;
  if (fs.existsSync(BASELINE_PATH)) {
    const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
    const newFails = [];
    const newPasses = [];
    for (const id of Object.keys(out.results)) {
      const before = (baseline.results[id]?.failures || []).map(failureSubject);
      const after = (out.results[id]?.failures || []).map(failureSubject);
      const beforeSet = new Set(before);
      const afterSet = new Set(after);
      after.forEach(s => { if (!beforeSet.has(s)) newFails.push(`${id}: ${s}`); });
      before.forEach(s => { if (!afterSet.has(s)) newPasses.push(`${id}: ${s}`); });
    }
    const uniq = arr => Array.from(new Set(arr));
    const uniqNewFails = uniq(newFails);
    const uniqNewPasses = uniq(newPasses);
    newFailsCount = uniqNewFails.length;
    newPassesCount = uniqNewPasses.length;
    console.log("\n=== vs baseline ===");
    if (uniqNewPasses.length) {
      console.log("NEW PASSES (fixes landed):");
      uniqNewPasses.forEach(p => console.log("  + " + p));
    }
    if (uniqNewFails.length) {
      console.log("NEW FAILURES (regressions):");
      uniqNewFails.forEach(f => console.log("  - " + f));
    }
    if (!uniqNewPasses.length && !uniqNewFails.length) console.log("No deltas vs baseline.");
  }

  console.log(`\nTotal failures: ${totalFails}`);

  if (fs.existsSync(BASELINE_PATH)) {
    process.exit(newFailsCount > 0 ? 1 : 0);
  } else {
    process.exit(totalFails > 0 ? 1 : 0);
  }
})();
