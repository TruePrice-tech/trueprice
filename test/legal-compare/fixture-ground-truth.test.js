// Compare-legal-quotes fixture-ground-truth harness.
//
// Mirrors test/legal/fixture-ground-truth.test.js but exercises the multi-
// upload compare path at /compare-legal-quotes.html instead of the single-
// upload analyzer. Auto-discovered by .github/workflows/regression-gate.yml
// via the test/*/fixture-ground-truth.test.js glob.
//
// LP-A3 (price-sanity round-2 2026-05-03): the compare path got the LP-3
// pricingContext fix and LP-A4 region fallback in commits b488bea1008 and
// the round-2 commit, but had no regression coverage. This harness fills
// that gap.
//
// Run: node test/legal-compare/fixture-ground-truth.test.js
// Run --baseline to write a baseline JSON snapshot of current results.
//
// Each "scenario" uploads 3 legal fixtures into the compare slots, clicks
// the Compare button, and asserts the rendered comparison table reflects
// the per-firm values. Three scenarios cover the three fee structures + a
// clean-vs-messy consistency check.

const { launchHarnessBrowser, preparePage } = require("../lib/harness-browser");
const fs = require("fs");
const path = require("path");

const BASE = process.env.WOOGORO_BASE || "https://woogoro.com";
const FIXTURES_DIR = path.resolve(__dirname, "..", "..");
const BASELINE_PATH = path.join(__dirname, "fixture-ground-truth.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");

// Three scenarios. Each uploads 3 fixtures into compare slots 0/1/2 and
// asserts comparison-table cells. Per-slot expectations match the analyzer
// harness ground truth so the two harnesses can never disagree silently.
const SCENARIOS = [
  {
    id: "scenario-trio-pi",
    description: "Three PI clean variants — verifies contingency rows + practice-area parity",
    slots: [
      {
        file: "test-quotes/legal-images/comparison-pi-01-firm-a-low.png",
        firmRegex: /brighton/i,
        feeType: "contingency",
        contingencyPct: 33,
        practiceArea: "personal_injury",
        stateCode: "NC",
      },
      {
        file: "test-quotes/legal-images/comparison-pi-02-firm-b-mid.png",
        firmRegex: /kestrel/i,
        feeType: "contingency",
        contingencyPct: 35,
        practiceArea: "personal_injury",
        stateCode: "NC",
      },
      {
        file: "test-quotes/legal-images/comparison-pi-03-firm-c-high.png",
        firmRegex: /stratton|caine/i,
        feeType: "contingency",
        contingencyPct: 40,
        practiceArea: "personal_injury",
        stateCode: "NC",
      },
    ],
  },
  {
    id: "scenario-trio-mixed",
    description: "Mixed fee structures — verifies hourly + flat + hourly cells render side-by-side",
    slots: [
      {
        file: "test-quotes/legal-images/02-hourly-retainer-litigation.png",
        firmRegex: /blackwood/i,
        // Compare-legal renders feeType from API feeStructure. Blackwood
        // ships as "hourly" or "hybrid" per Claude run; both correct.
        feeTypeRegex: /^(hourly|hybrid)$/,
        hourlyRate: 585,
        retainerAmount: 15000,
        practiceArea: "general_litigation",
        stateCode: "NC",
      },
      {
        file: "test-quotes/legal-images/06-criminal-defense-flat-fee.png",
        firmRegex: /falconer/i,
        feeType: "flat_fee",
        flatFee: 3500,
        practiceArea: "criminal_defense",
        stateCode: "AL",
      },
      {
        file: "test-quotes/real-quotes/legal/fixture-attorney-invoice.jpg",
        firmRegex: /henderson/i,
        feeType: "hourly",
        hourlyRate: 350,
        practiceArea: "estate_planning",
        stateCode: "TX",
      },
    ],
  },
  {
    id: "scenario-clean-vs-messy",
    description: "Clean vs messy variants of same firm — verifies OCR-tolerance / compare consistency",
    // LP-A7 (2026-05-04): cross-slot equality. slots[0] (Brighton clean) and
    // slots[1] (Brighton messy) MUST produce identical API output on the
    // listed fields. This is the FENCE-B2 / LP-3 spirit — clean ≠ messy on
    // the same fixture is a known bug class (e.g. Pine State chain-link
    // tagline swung the benchmark only in clean OCR). Pre-A7 the scenario
    // verified each slot in isolation but didn't compare them, leaving the
    // OCR-divergence bug class uncovered.
    crossSlotEqual: [
      { slots: [0, 1], fields: ["feeStructure", "contingencyPercent", "practiceArea", "stateCode"], firmRegex: /brighton/i },
    ],
    slots: [
      {
        file: "test-quotes/legal-images/comparison-pi-01-firm-a-low.png",
        firmRegex: /brighton/i,
        feeType: "contingency",
        contingencyPct: 33,
        practiceArea: "personal_injury",
        stateCode: "NC",
      },
      {
        file: "test-quotes/legal-images/messy-comparison-pi-01-firm-a-low.jpg",
        firmRegex: /brighton/i,
        feeType: "contingency",
        contingencyPct: 33,
        practiceArea: "personal_injury",
        stateCode: "NC",
      },
      {
        file: "test-quotes/legal-images/comparison-pi-03-firm-c-high.png",
        firmRegex: /stratton|caine/i,
        feeType: "contingency",
        contingencyPct: 40,
        practiceArea: "personal_injury",
        stateCode: "NC",
      },
    ],
  },
];

async function uploadAndCompare(browser, scenario) {
  const page = await browser.newPage();
  await preparePage(page, BASE);
  page.setDefaultTimeout(180000);
  await page.setViewport({ width: 1440, height: 1000 });

  const apiResponses = [];
  page.on("response", async res => {
    if (res.url().includes("/api/legal-fee-estimate")) {
      let body = "";
      try { body = await res.text(); } catch {}
      apiResponses.push({ url: res.url(), status: res.status(), body });
    }
  });

  await page.goto(BASE + "/compare-legal-quotes.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));

  // Upload each slot sequentially. Compare path uses #file0 / #file1 / #file2.
  for (let i = 0; i < scenario.slots.length; i++) {
    const inp = await page.$(`#file${i}`);
    if (!inp) {
      await page.close();
      throw new Error(`slot ${i} input not found on /compare-legal-quotes.html`);
    }
    await inp.uploadFile(path.join(FIXTURES_DIR, scenario.slots[i].file));
    // Wait for slot to flip from "uploading" to "uploaded" (or error).
    await page.waitForFunction(idx => {
      const slot = document.getElementById("slot" + idx);
      if (!slot) return false;
      return slot.classList.contains("uploaded") || /Could not parse|Rate limited/.test(slot.innerText);
    }, { timeout: 180000 }, i).catch(() => null);
  }

  // Click Compare button
  const compareBtn = await page.$("#compareBtn");
  if (compareBtn) {
    const isDisabled = await page.evaluate(b => b.disabled, compareBtn);
    if (!isDisabled) {
      await compareBtn.click();
      await page.waitForFunction(() => !!document.getElementById("comparisonTable"), { timeout: 30000 }).catch(() => null);
    }
  }
  await new Promise(r => setTimeout(r, 1500));

  const display = await page.evaluate(() => {
    const slots = [];
    for (let i = 0; i < 3; i++) {
      const slot = document.getElementById("slot" + i);
      slots.push({
        idx: i,
        firmName: ((slot && slot.querySelector(".slot-firm")) || {}).innerText || "",
        rateDisplay: ((slot && slot.querySelector(".slot-rate")) || {}).innerText || "",
        uploaded: !!(slot && slot.classList.contains("uploaded")),
      });
    }

    // Comparison table (when rendered): walk rows, capture row-label + cells.
    const tableRows = [];
    const table = document.getElementById("comparisonTable");
    if (table) {
      const headerCells = Array.from(table.querySelectorAll("thead th")).map(th => th.innerText.trim());
      tableRows.push({ rowLabel: "__header__", cells: headerCells });
      table.querySelectorAll("tbody tr").forEach(tr => {
        const cells = Array.from(tr.querySelectorAll("td"));
        const labelCell = cells[0];
        const dataCells = cells.slice(1).map(td => td.innerText.trim().replace(/\s+/g, " "));
        tableRows.push({
          rowLabel: labelCell ? labelCell.innerText.trim() : "",
          cells: dataCells,
        });
      });
    }

    return {
      slots,
      tableRendered: !!table,
      tableRows,
      bodyTextSlice: document.body.innerText.slice(0, 2500),
    };
  });

  // Parse each /api/legal-fee-estimate response (one per slot, in upload order).
  const apiData = apiResponses.map(r => {
    try { return (JSON.parse(r.body) || {}).data || null; } catch { return null; }
  }).filter(Boolean);

  await page.close();
  return { display, apiData };
}

function findRow(tableRows, labelMatch) {
  return tableRows.find(r =>
    typeof r.rowLabel === "string" &&
    r.rowLabel.toLowerCase().includes(labelMatch.toLowerCase())
  );
}

function compare(scenario, actual) {
  const failures = [];
  const slots = scenario.slots;

  if (!actual.display.tableRendered) {
    failures.push("comparisonTable: did not render (Compare button likely never enabled — slots may not have parsed)");
    // No table = no point checking rows. Still surface slot state below.
  }

  // Per-slot firmName + rateDisplay (from the slot card itself).
  for (let i = 0; i < slots.length; i++) {
    const expected = slots[i];
    const slotState = actual.display.slots[i];
    if (!slotState.uploaded) {
      failures.push(`slot${i}: did not reach uploaded state (got ${JSON.stringify(slotState)})`);
      continue;
    }
    if (expected.firmRegex && !expected.firmRegex.test(slotState.firmName)) {
      failures.push(`slot${i}.firmName: expected match /${expected.firmRegex.source}/, got ${JSON.stringify(slotState.firmName)}`);
    }
  }

  // API-level field assertions per slot.
  for (let i = 0; i < slots.length; i++) {
    const expected = slots[i];
    const data = actual.apiData[i];
    if (!data) {
      failures.push(`slot${i}.apiData: missing /api/legal-fee-estimate response`);
      continue;
    }
    if (expected.feeType && data.feeStructure !== expected.feeType) {
      failures.push(`slot${i}.feeStructure: expected ${expected.feeType}, got ${JSON.stringify(data.feeStructure)}`);
    }
    if (expected.feeTypeRegex && !expected.feeTypeRegex.test(data.feeStructure || "")) {
      failures.push(`slot${i}.feeStructure: expected match /${expected.feeTypeRegex.source}/, got ${JSON.stringify(data.feeStructure)}`);
    }
    if (typeof expected.contingencyPct === "number") {
      const got = Number(data.contingencyPercent);
      if (isNaN(got) || Math.abs(got - expected.contingencyPct) > 1) {
        failures.push(`slot${i}.contingencyPct: expected ~${expected.contingencyPct}, got ${JSON.stringify(data.contingencyPercent)}`);
      }
    }
    if (typeof expected.hourlyRate === "number") {
      const got = Number(data.hourlyRate);
      if (isNaN(got) || Math.abs(got - expected.hourlyRate) > 25) {
        failures.push(`slot${i}.hourlyRate: expected ~${expected.hourlyRate}, got ${JSON.stringify(data.hourlyRate)}`);
      }
    }
    if (typeof expected.flatFee === "number") {
      const got = Number(data.flatFee);
      if (isNaN(got) || Math.abs(got - expected.flatFee) > 50) {
        failures.push(`slot${i}.flatFee: expected ~${expected.flatFee}, got ${JSON.stringify(data.flatFee)}`);
      }
    }
    if (typeof expected.retainerAmount === "number") {
      const got = Number(data.retainerAmount);
      if (isNaN(got) || Math.abs(got - expected.retainerAmount) > 100) {
        failures.push(`slot${i}.retainerAmount: expected ~${expected.retainerAmount}, got ${JSON.stringify(data.retainerAmount)}`);
      }
    }
    if (expected.practiceArea && data.practiceArea !== expected.practiceArea) {
      failures.push(`slot${i}.practiceArea: expected ${expected.practiceArea}, got ${JSON.stringify(data.practiceArea)}`);
    }
    if (expected.stateCode && (data.stateCode || "").toUpperCase() !== expected.stateCode) {
      failures.push(`slot${i}.stateCode: expected ${expected.stateCode}, got ${JSON.stringify(data.stateCode)}`);
    }
  }

  // LP-A7 cross-slot equality: same-firm clean vs messy must produce
  // identical API output on the listed fields. Catches OCR-divergence bugs
  // where one variant trips a regex/parser branch the other doesn't.
  if (Array.isArray(scenario.crossSlotEqual)) {
    for (const eq of scenario.crossSlotEqual) {
      const [a, b] = eq.slots;
      const da = actual.apiData[a];
      const db = actual.apiData[b];
      if (!da || !db) {
        failures.push(`crossSlotEqual[${a},${b}]: missing apiData on one or both slots`);
        continue;
      }
      if (eq.firmRegex) {
        const aFirm = (da.firmName || "");
        const bFirm = (db.firmName || "");
        if (!eq.firmRegex.test(aFirm) || !eq.firmRegex.test(bFirm)) {
          failures.push(`crossSlotEqual[${a},${b}].firmRegex: both slots expected match /${eq.firmRegex.source}/, got slot${a}=${JSON.stringify(aFirm)} slot${b}=${JSON.stringify(bFirm)}`);
        }
      }
      for (const field of eq.fields) {
        const av = da[field];
        const bv = db[field];
        // Numeric tolerance for percent fields (Claude OCR drift can shave
        // 33.33 to 33.3); string equality for everything else.
        if (typeof av === "number" || typeof bv === "number") {
          if (Math.abs(Number(av) - Number(bv)) > 1) {
            failures.push(`crossSlotEqual[${a},${b}].${field}: slot${a}=${av} slot${b}=${bv} (diff > 1)`);
          }
        } else if (String(av || "").toUpperCase() !== String(bv || "").toUpperCase()) {
          failures.push(`crossSlotEqual[${a},${b}].${field}: slot${a}=${JSON.stringify(av)} slot${b}=${JSON.stringify(bv)}`);
        }
      }
    }
  }

  // Comparison-table sanity: when rendered, hourly-rate cells should show
  // the right $/hr per slot for hourly fixtures (LP-3 cell uses upstream
  // marketLow/marketHigh from pricingContext, so the "Within market" /
  // "Above market" note should appear when applicable).
  if (actual.display.tableRendered) {
    const hourlyRow = findRow(actual.display.tableRows, "hourly rate");
    for (let i = 0; i < slots.length; i++) {
      if (typeof slots[i].hourlyRate === "number" && hourlyRow) {
        const cell = hourlyRow.cells[i] || "";
        const dollars = (cell.match(/\$[\d,]+/g) || [])[0];
        if (!dollars) {
          failures.push(`compareTable.hourlyRate[slot${i}]: expected $/hr cell, got ${JSON.stringify(cell.slice(0, 80))}`);
        }
      }
    }
  }

  return failures;
}

(async () => {
  const browser = await launchHarnessBrowser();
  const out = { ts: new Date().toISOString(), base: BASE, results: {} };

  // LP-A3 timing: api/_abuse-guard.js BURST_MAX is 15 req in a 10s window.
  // Each compare scenario uploads 3 fixtures (3 API calls). Three scenarios
  // back-to-back = 9 calls. If they're all cache-warm and land sub-second
  // each, plus any analyzer-harness calls that ran just before, total can
  // exceed 15 in 10s and blocklist the IP for 5 min. Sleep BETWEEN scenarios
  // to fully clear the burst window. Within-scenario the slot upload waits
  // (waitForFunction) already serialize uploads through Claude latency.
  const SCENARIO_GAP_MS = 12000;

  let totalFails = 0;
  let scenarioIdx = 0;
  for (const sc of SCENARIOS) {
    if (scenarioIdx > 0) {
      await new Promise(r => setTimeout(r, SCENARIO_GAP_MS));
    }
    scenarioIdx++;
    process.stdout.write(`  ${sc.id} ... `);
    try {
      const actual = await uploadAndCompare(browser, sc);
      const failures = compare(sc, actual);
      out.results[sc.id] = {
        slots: actual.display.slots,
        tableRendered: actual.display.tableRendered,
        tableRowCount: actual.display.tableRows.length,
        apiSnapshots: actual.apiData.map(d => ({
          firmName: d.firmName || null,
          feeStructure: d.feeStructure || null,
          hourlyRate: d.hourlyRate ?? null,
          flatFee: d.flatFee ?? null,
          contingencyPercent: d.contingencyPercent ?? null,
          retainerAmount: d.retainerAmount ?? null,
          practiceArea: d.practiceArea || null,
          stateCode: d.stateCode || null,
          firmSize: d.firmSize || null,
          firmSizeMult: d.pricingContext?.firmSizeMultiplier ?? null,
          adjustedMarketRate: d.pricingContext?.adjustedMarketRate ?? null,
          contingencyRange: d.pricingContext?.contingencyRange || null,
          flatFeeComparison: d.pricingContext?.flatFeeComparison || null,
        })),
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
      out.results[sc.id] = { error: e.message };
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
    const m = msg.match(/^(slot\d|compareTable\.\w+|comparisonTable):\s*([^:]+)/);
    if (m) return m[1] + ":" + m[2].trim();
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
      console.log("NEW PASSES:");
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
