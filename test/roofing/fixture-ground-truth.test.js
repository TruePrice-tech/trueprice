// Roofing fixture ground-truth harness.
// Reads the 10 hand-curated fixtures, uploads each through the live analyzer,
// and asserts price/contractor/scope/state vs. ground truth captured by Lane in 2026-05-02.
//
// Run: node test/roofing/fixture-ground-truth.test.js
// Run --baseline to write a baseline JSON snapshot of current results (used to
// keep regressions visible while fixes are in flight).

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const BASE = process.env.WOOGORO_BASE || "https://woogoro.com";
const FIXTURES_DIR = path.resolve(__dirname, "..", "..");
const BASELINE_PATH = path.join(__dirname, "fixture-ground-truth.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");

const FIXTURES = [
  {
    id: "f1-gaf",
    file: "test/receipt/ocr-cache/fixtures/roofing-gaf-quote.jpeg",
    expect: {
      price: 16765.79,
      contractorRegex: /green\s*ladder/i,
      stateCode: null,
      scopeFound: ["drip edge", "ridge cap", "disposal", "permit"],
      // wood substrate replacement is a contingent allowance — we want this surfaced not flagged absent
      scopeContingent: ["decking"],
    },
  },
  {
    id: "f2-scope-doc",
    file: "test/receipt/ocr-cache/fixtures/roofing-scope-doc.png",
    expect: {
      price: 14800.0,
      contractorRegex: null, // signed/redacted
      stateCode: null,        // no state token in document
    },
  },
  {
    id: "f3-budget",
    file: "test-quotes/roofing-images/comparison-roof-01-low.png",
    expect: {
      price: 7565,
      contractorRegex: /budget\s*roofing/i,
      stateCode: "NC",
      scopeFound: ["tear off", "underlayment", "drip edge", "ridge cap", "ridge vent", "starter strip", "flashing", "disposal", "permit"],
      scopeAbsent: ["ice", "decking"],
    },
  },
  {
    id: "f4-heritage",
    file: "test-quotes/roofing-images/comparison-roof-02-mid.png",
    expect: {
      price: 11895,
      contractorRegex: /heritage\s*roofing/i,
      stateCode: "NC",
      scopeFound: ["tear off", "underlayment", "ice", "drip edge", "ridge cap", "starter strip", "flashing", "decking", "disposal", "permit", "ventilation"],
    },
  },
  {
    id: "f5-pinnacle",
    file: "test-quotes/roofing-images/comparison-roof-03-high.png",
    expect: {
      price: 17500,
      contractorRegex: /pinnacle\s*premium/i,
      stateCode: "NC",
      scopeFound: ["tear off", "underlayment", "ice", "drip edge", "ridge cap", "ridge vent", "starter strip", "flashing", "decking", "disposal", "permit"],
    },
  },
  {
    id: "f6-metal-136k",
    file: "test-quotes/roofing-images/03-how-over-priced-is-this-estimate-for-a-metal-roof.jpeg",
    expect: { price: 136375.0, contractorRegex: null, stateCode: null },
  },
  {
    id: "f7-handwritten",
    file: "test-quotes/roofing-images/07-2000sqft-home-roof-estimate-is-this-a-decent-price.jpg",
    expect: { price: 10500, contractorRegex: null, stateCode: null },
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

  await page.goto(BASE + "/roofing-quote-analyzer.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));

  const inp = await page.$('input[type="file"]');
  await inp.uploadFile(path.join(FIXTURES_DIR, fixture.file));
  await new Promise(r => setTimeout(r, 35000));

  const display = await page.evaluate(() => {
    const text = document.body.innerText;
    // "Quote total detected: $X" or "$X" near "YOUR QUOTE"
    const detectedMatch = text.match(/Quote total detected:\s*\$?([\d,]+(?:\.\d+)?)/i);
    const yourQuoteMatch = text.match(/YOUR QUOTE\s*\$?([\d,]+(?:\.\d+)?)/i);
    const found = [];
    document.querySelectorAll(".scope-pill, [data-scope-status=found], .tp-scope-found").forEach(el => found.push((el.innerText || "").toLowerCase().trim()));
    if (!found.length) {
      // Fallback: parse the "What we found in your quote" section
      const bodyParts = text.split("What we found in your quote");
      if (bodyParts.length > 1) {
        const after = bodyParts[1];
        const beforeNotFound = after.split("Not found")[0] || after.split("missing items")[0] || "";
        beforeNotFound.split("\n").forEach(line => {
          const m = line.match(/^\s*[✓✓]\s*(.+?)$/);
          if (m) found.push(m[1].toLowerCase().trim());
        });
      }
    }
    return {
      displayPrice: detectedMatch ? parseFloat(detectedMatch[1].replace(/,/g, "")) : (yourQuoteMatch ? parseFloat(yourQuoteMatch[1].replace(/,/g, "")) : null),
      contractor: window.__latestAnalysis?.contractor || null,
      scopeFound: Array.from(new Set(found)),
      bodyTextSlice: text.slice(0, 2200),
    };
  });

  let parseQuote = null;
  for (const r of apiResponses) {
    if (r.url.includes("/api/parse-quote")) {
      try { parseQuote = JSON.parse(r.body); } catch {}
    }
  }

  await page.close();
  return { display, parseQuote };
}

function compare(label, actual, expected) {
  const failures = [];
  if (typeof expected.price === "number") {
    const tol = Math.max(10, expected.price * PRICE_TOLERANCE_PCT);
    if (actual.display.displayPrice == null) {
      failures.push(`displayPrice: expected ~${expected.price}, got null`);
    } else if (Math.abs(actual.display.displayPrice - expected.price) > tol) {
      failures.push(`displayPrice: expected ${expected.price} ±${tol}, got ${actual.display.displayPrice}`);
    }
  }
  if (expected.contractorRegex) {
    if (!actual.display.contractor || !expected.contractorRegex.test(actual.display.contractor)) {
      failures.push(`contractor: expected match /${expected.contractorRegex.source}/, got ${JSON.stringify(actual.display.contractor)}`);
    }
  }
  if ("stateCode" in expected && actual.parseQuote?.data) {
    const got = actual.parseQuote.data.stateCode;
    if ((got || null) !== (expected.stateCode || null)) {
      failures.push(`stateCode: expected ${JSON.stringify(expected.stateCode)}, got ${JSON.stringify(got)}`);
    }
  }
  if (Array.isArray(expected.scopeFound)) {
    const have = (actual.display.scopeFound || []).join(" | ");
    expected.scopeFound.forEach(item => {
      if (!have.toLowerCase().includes(item.toLowerCase())) {
        failures.push(`scopeFound missing: "${item}" (have: ${have || "<none>"})`);
      }
    });
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
        displayPrice: actual.display.displayPrice,
        contractor: actual.display.contractor,
        stateCode: actual.parseQuote?.data?.stateCode || null,
        scopeFound: actual.display.scopeFound,
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

  let newFailsCount = 0;
  let newPassesCount = 0;
  if (fs.existsSync(BASELINE_PATH)) {
    const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
    const newFails = [];
    const newPasses = [];
    for (const id of Object.keys(out.results)) {
      const before = baseline.results[id]?.failures || [];
      const after = out.results[id]?.failures || [];
      after.forEach(f => { if (!before.includes(f)) newFails.push(`${id}: ${f}`); });
      before.forEach(f => { if (!after.includes(f)) newPasses.push(`${id}: ${f}`); });
    }
    newFailsCount = newFails.length;
    newPassesCount = newPasses.length;
    console.log("\n=== vs baseline ===");
    if (newPasses.length) {
      console.log("NEW PASSES (fixes landed):");
      newPasses.forEach(p => console.log("  + " + p));
    }
    if (newFails.length) {
      console.log("NEW FAILURES (regressions):");
      newFails.forEach(f => console.log("  - " + f));
    }
    if (!newPasses.length && !newFails.length) console.log("No deltas vs baseline.");
  }

  console.log(`\nTotal failures: ${totalFails}`);

  // Exit policy:
  //   - When a baseline exists: pass only if no NEW regressions vs baseline.
  //     Existing known-fail items don't fail CI (they're tracked in the
  //     baseline until each Block fix lands and the baseline is refreshed).
  //   - When no baseline exists: any failure fails CI.
  if (fs.existsSync(BASELINE_PATH)) {
    process.exit(newFailsCount > 0 ? 1 : 0);
  } else {
    process.exit(totalFails > 0 ? 1 : 0);
  }
})();
