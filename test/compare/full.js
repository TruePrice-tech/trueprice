#!/usr/bin/env node
// Full compare path test harness.
// Uploads 2 fixtures to each compare page, clicks Compare, then verifies:
//   - Prices extracted (within tolerance of expected)
//   - Results section rendered (winner banner, score bars, table, scope checklist)
//   - Winner verdict present (either "closely matched" or "best overall value")
//   - Scope checklist items rendered for each vertical
//   - Score bars with numeric labels
//
// Usage:
//   node test/compare/full.js                    # all verticals
//   node test/compare/full.js hvac roofing       # specific verticals
//   BASE_URL=http://localhost:3000 node test/compare/full.js

const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "https://truepricehq.com";
const FIXTURES_ROOT = path.resolve(__dirname, "..", "..", "test-quotes");

// Per-vertical config: page, fixtures, expected prices (approximate)
// Prices are approximate -- we allow +/- 30% tolerance since OCR + API parsing varies.
const VERTICALS = {
  hvac: {
    page: "/compare-hvac-quotes.html",
    fixtures: "hvac-images",
    files: ["comparison-ac-01-low.png", "comparison-ac-02-mid.png"],
    expectedPrices: [3456, 6620],
    priceTolerance: 0.30,
    minScopeItems: 6,
    minRows: 6
  },
  plumbing: {
    page: "/compare-plumbing-quotes.html",
    fixtures: "plumbing-images",
    files: ["comparison-wh-01-low.png", "comparison-wh-02-mid.png"],
    expectedPrices: [null, null], // unknown -- just verify > 0
    priceTolerance: 0.30,
    minScopeItems: 4,
    minRows: 4
  },
  roofing: {
    page: "/compare-roofing-quotes.html",
    fixtures: "roofing-images",
    files: ["comparison-roof-01-low.png", "comparison-roof-02-mid.png"],
    expectedPrices: [null, null],
    priceTolerance: 0.30,
    minScopeItems: 8,
    minRows: 6
  },
  auto: {
    page: "/compare-auto-quotes.html",
    fixtures: "auto-images",
    files: ["comparison-brake-01-shop-a-low.png", "comparison-brake-02-shop-b-mid.png"],
    expectedPrices: [null, null],
    priceTolerance: 0.30,
    minScopeItems: 6,
    minRows: 0  // auto has hardcoded table, no ROWS array
  },
  siding: {
    page: "/compare-siding-quotes.html",
    fixtures: "siding-images",
    files: ["comparison-siding-low.png", "comparison-siding-mid.png"],
    expectedPrices: [null, null],
    priceTolerance: 0.30,
    minScopeItems: 4,
    minRows: 4
  },
  concrete: {
    page: "/compare-concrete-quotes.html",
    fixtures: "concrete-images",
    files: ["comparison-conc-low.png", "comparison-conc-mid.png"],
    expectedPrices: [null, null],
    priceTolerance: 0.30,
    minScopeItems: 4,
    minRows: 4
  },
  electrical: {
    page: "/compare-electrical-quotes.html",
    fixtures: "electrical-images",
    files: ["comparison-panel-01-low.png", "comparison-panel-02-mid.png"],
    expectedPrices: [null, null],
    priceTolerance: 0.30,
    minScopeItems: 4,
    minRows: 4
  },
  fencing: {
    page: "/compare-fencing-quotes.html",
    fixtures: "fencing-images",
    files: ["comparison-fence-low.png", "comparison-fence-mid.png"],
    expectedPrices: [null, null],
    priceTolerance: 0.30,
    minScopeItems: 4,
    minRows: 4
  },
  foundation: {
    page: "/compare-foundation-quotes.html",
    fixtures: "foundation-images",
    files: ["comparison-pier-low.png", "comparison-pier-mid.png"],
    expectedPrices: [null, null],
    priceTolerance: 0.30,
    minScopeItems: 4,
    minRows: 4
  },
  "garage-door": {
    page: "/compare-garage-door-quotes.html",
    fixtures: "garage-door-images",
    files: ["comparison-garage-low.png", "comparison-garage-mid.png"],
    expectedPrices: [null, null],
    priceTolerance: 0.30,
    minScopeItems: 4,
    minRows: 4
  },
  gutters: {
    page: "/compare-gutters-quotes.html",
    fixtures: "gutters-images",
    files: ["comparison-gutters-low.png", "comparison-gutters-mid.png"],
    expectedPrices: [null, null],
    priceTolerance: 0.30,
    minScopeItems: 4,
    minRows: 4
  },
  insulation: {
    page: "/compare-insulation-quotes.html",
    fixtures: "insulation-images",
    files: ["comparison-insul-low.png", "comparison-insul-mid.png"],
    expectedPrices: [null, null],
    priceTolerance: 0.30,
    minScopeItems: 4,
    minRows: 4
  },
  kitchen: {
    page: "/compare-kitchen-quotes.html",
    fixtures: "kitchen-images",
    files: ["comparison-kitchen-low.png", "comparison-kitchen-mid.png"],
    expectedPrices: [null, null],
    priceTolerance: 0.30,
    minScopeItems: 4,
    minRows: 4
  },
  landscaping: {
    page: "/compare-landscaping-quotes.html",
    fixtures: "landscaping-images",
    files: ["comparison-land-low.png", "comparison-land-mid.png"],
    expectedPrices: [null, null],
    priceTolerance: 0.30,
    minScopeItems: 4,
    minRows: 4
  },
  moving: {
    page: "/compare-moving-quotes.html",
    fixtures: "moving-images",
    files: ["comparison-move-low.png", "comparison-move-mid.png"],
    expectedPrices: [null, null],
    priceTolerance: 0.30,
    minScopeItems: 4,
    minRows: 4
  },
  painting: {
    page: "/compare-painting-quotes.html",
    fixtures: "painting-images",
    files: ["comparison-paint-low.png", "comparison-paint-mid.png"],
    expectedPrices: [null, null],
    priceTolerance: 0.30,
    minScopeItems: 4,
    minRows: 4
  },
  solar: {
    page: "/compare-solar-quotes.html",
    fixtures: "solar-images",
    files: ["comparison-solar-01-low.png", "comparison-solar-02-mid.png"],
    expectedPrices: [null, null],
    priceTolerance: 0.30,
    minScopeItems: 4,
    minRows: 4
  },
  windows: {
    page: "/compare-windows-quotes.html",
    fixtures: "windows-images",
    files: ["comparison-windows-low.png", "comparison-windows-mid.png"],
    expectedPrices: [null, null],
    priceTolerance: 0.30,
    minScopeItems: 4,
    minRows: 4
  }
};

const requested = process.argv.slice(2);
const toTest = requested.length ? requested : Object.keys(VERTICALS);

function pad(s, n) { return (s + " ".repeat(n)).slice(0, n); }

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const results = [];

  for (const v of toTest) {
    const cfg = VERTICALS[v];
    if (!cfg) { console.log("UNKNOWN  " + v); continue; }

    const img1 = path.join(FIXTURES_ROOT, cfg.fixtures, cfg.files[0]);
    const img2 = path.join(FIXTURES_ROOT, cfg.fixtures, cfg.files[1]);

    if (!fs.existsSync(img1) || !fs.existsSync(img2)) {
      console.log("SKIP     " + pad(v, 15) + "fixtures missing");
      results.push({ v, status: "SKIP" });
      continue;
    }

    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message.slice(0, 120)));
    page.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0, 120)); });

    const t0 = Date.now();
    const checks = { upload: false, prices: false, compare: false, winner: false, scores: false, table: false, scope: false };
    let reason = "";
    let priceInfo = "";

    try {
      // Step 1: Load page
      await page.goto(BASE_URL + cfg.page, { waitUntil: "networkidle2", timeout: 30000 });
      const inputs = await page.$$('input[type="file"]');
      if (inputs.length < 2) throw new Error("no file inputs found");

      // Step 2: Upload both fixtures
      await inputs[0].uploadFile(img1);
      await new Promise(r => setTimeout(r, 2000));
      await inputs[1].uploadFile(img2);

      // Wait for both slots to finish parsing
      await page.waitForFunction(() => {
        const a = document.getElementById("slot0");
        const b = document.getElementById("slot1");
        if (!a || !b) return false;
        return (a.classList.contains("uploaded") || a.innerText.includes("Could not")) &&
               (b.classList.contains("uploaded") || b.innerText.includes("Could not"));
      }, { timeout: 120000 });

      const uploadState = await page.evaluate(() => ({
        s0ok: document.getElementById("slot0")?.classList.contains("uploaded"),
        s1ok: document.getElementById("slot1")?.classList.contains("uploaded")
      }));

      if (!uploadState.s0ok || !uploadState.s1ok) {
        reason = "upload parse failed: s0=" + uploadState.s0ok + " s1=" + uploadState.s1ok;
        throw new Error(reason);
      }
      checks.upload = true;

      // Step 3: Check extracted prices
      const priceData = await page.evaluate(() => {
        const prices = [];
        for (let i = 0; i < 2; i++) {
          const el = document.querySelector(`#slot${i} .slot-edit-price`);
          if (el) {
            const v = parseFloat(el.value.replace(/[^0-9.]/g, "")) || 0;
            prices.push(v);
          } else {
            prices.push(0);
          }
        }
        return prices;
      });

      let priceOk = true;
      const priceDetails = [];
      for (let i = 0; i < 2; i++) {
        const got = priceData[i];
        const exp = cfg.expectedPrices[i];
        if (exp !== null) {
          const lo = exp * (1 - cfg.priceTolerance);
          const hi = exp * (1 + cfg.priceTolerance);
          if (got < lo || got > hi) {
            priceOk = false;
            priceDetails.push(`s${i}: $${got} (expected ~$${exp})`);
          } else {
            priceDetails.push(`s${i}: $${got} OK`);
          }
        } else {
          if (got <= 0) {
            priceOk = false;
            priceDetails.push(`s${i}: $0 (expected >0)`);
          } else {
            priceDetails.push(`s${i}: $${got}`);
          }
        }
      }
      priceInfo = priceDetails.join(", ");
      checks.prices = priceOk;

      // Step 4: Click Compare button
      const btnEnabled = await page.evaluate(() => {
        const btn = document.querySelector(".cmp-compare-btn") || document.querySelector(".caq-compare-btn");
        return btn && !btn.disabled;
      });
      if (!btnEnabled) throw new Error("compare button disabled after uploads");

      await page.evaluate(() => {
        const btn = document.querySelector(".cmp-compare-btn") || document.querySelector(".caq-compare-btn");
        if (btn) btn.click();
      });

      // Wait for results to render
      await page.waitForFunction(() => {
        const rc = document.getElementById("resultsContent");
        return rc && rc.innerHTML.length > 100;
      }, { timeout: 10000 });
      checks.compare = true;

      // Step 5: Verify winner verdict
      const verdictInfo = await page.evaluate(() => {
        const rc = document.getElementById("resultsContent");
        if (!rc) return { found: false };
        const text = rc.innerText || "";
        const hasBestValue = text.includes("best overall value") || text.includes("Best Overall Value");
        const hasCloseMatch = text.includes("closely matched") || text.includes("Closely Matched");
        const hasBadge = !!rc.querySelector(".cmp-badge, .caq-badge");
        return {
          found: hasBestValue || hasCloseMatch,
          bestValue: hasBestValue,
          closeMatch: hasCloseMatch,
          hasBadge: hasBadge
        };
      });
      checks.winner = verdictInfo.found;

      // Step 6: Verify score bars
      const scoreInfo = await page.evaluate(() => {
        const labels = document.querySelectorAll(".cmp-score-label, .caq-score-label");
        const scores = [];
        labels.forEach(l => {
          const n = parseInt(l.textContent);
          if (!isNaN(n)) scores.push(n);
        });
        const fills = document.querySelectorAll(".cmp-score-bar-fill, .caq-score-bar-fill");
        return { scores, barCount: fills.length };
      });
      checks.scores = scoreInfo.scores.length >= 2 && scoreInfo.scores.every(s => s >= 0 && s <= 100);

      // Step 7: Verify comparison table
      const tableInfo = await page.evaluate(() => {
        const table = document.querySelector(".cmp-table, .caq-table");
        if (!table) return { found: false, rows: 0, hasTotalPrice: false };
        const rows = table.querySelectorAll("tbody tr");
        const text = table.innerText || "";
        return {
          found: true,
          rows: rows.length,
          hasTotalPrice: text.includes("Total Price"),
          hasMoneyValues: (text.match(/\$[\d,]+/g) || []).length >= 2
        };
      });
      checks.table = tableInfo.found && tableInfo.hasTotalPrice && tableInfo.hasMoneyValues;

      // Step 8: Verify scope checklist
      const scopeInfo = await page.evaluate(() => {
        const rc = document.getElementById("resultsContent");
        if (!rc) return { found: false };
        const checks = rc.querySelectorAll(".cmp-scope-check, .caq-scope-check");
        const missing = rc.querySelectorAll(".cmp-scope-missing, .caq-scope-missing");
        const no = rc.querySelectorAll(".cmp-scope-no, .caq-scope-no");
        const hasTransparency = (rc.innerText || "").includes("Transparency") || (rc.innerText || "").includes("Scope Score");
        return {
          found: hasTransparency,
          yesCount: checks.length,
          unclearCount: missing.length,
          noCount: no.length,
          totalItems: checks.length + missing.length + no.length
        };
      });
      // Scope items: at least minScopeItems total scope verdict marks across both quotes
      checks.scope = scopeInfo.found && scopeInfo.totalItems >= cfg.minScopeItems;

    } catch (e) {
      reason = reason || e.message.slice(0, 80);
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    await page.close();

    const allPass = Object.values(checks).every(c => c);
    const status = allPass ? "PASS" : "FAIL";
    const failedChecks = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);

    results.push({ v, status, checks, elapsed, errors: errors.length, reason, priceInfo, failedChecks });

    // Print result line
    const icon = status === "PASS" ? "PASS" : "FAIL";
    let detail = priceInfo;
    if (!allPass) detail += (detail ? " | " : "") + "FAILED: " + failedChecks.join(",");
    if (reason && !allPass) detail += " | " + reason;
    console.log(
      pad(icon, 6) +
      pad(v, 15) +
      pad(elapsed + "s", 8) +
      detail
    );
  }

  await browser.close();

  // Summary
  console.log("\n" + "=".repeat(80));
  const pass = results.filter(r => r.status === "PASS").length;
  const fail = results.filter(r => r.status === "FAIL").length;
  const skip = results.filter(r => r.status === "SKIP").length;
  console.log(pass + "/" + (pass + fail) + " PASS   " + fail + " FAIL   " + skip + " SKIP\n");

  if (fail > 0) {
    console.log("FAILURES:");
    results.filter(r => r.status === "FAIL").forEach(r => {
      console.log("  " + r.v + ": " + r.failedChecks.join(", ") + (r.reason ? " (" + r.reason + ")" : ""));
      if (r.priceInfo) console.log("    prices: " + r.priceInfo);
    });
    console.log("");
  }

  process.exit(fail > 0 ? 1 : 0);
})();
