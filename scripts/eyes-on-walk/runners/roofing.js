// Roofing uses a different journey UI than every other vertical: address
// fields are #journeyStreetAddress / #journeyCity / #journeyState / #journeyZipCode
// (not #addrStreet / #addrCity / etc), the estimator options use
// `button.est-option[data-group="X"][data-value="Y"]` (not `#optX [data-val="Y"]`),
// home size goes into #estHomeSize, and submit is #estSubmitBtn.
// Per scripts/roofing-walk-full.js.

const path = require("path");
const puppeteer = require("puppeteer");
const { ROOT, BASE, HEADLESS, sleep, newPage, shot, dumpResultText } = require("../lib/walker");
const { loadFixtureManifest, pickAnalyzeFixtures, pickCompareFixtures } = require("../lib/fixtures");
const { examinePath } = require("../lib/eyes");
const { runAnalyzePath, runComparePath } = require("../lib/paths");

const VERTICAL = "roofing";
const RESULT_SELECTOR = "#estimateResult, main";
const ESTIMATE_URL = "/roofing-estimate.html";
const ANALYZER_URL = "/roofing-quote-analyzer.html";
const COMPARE_URL = "/compare-roofing-quotes.html";

const ESTIMATE_PERMUTATIONS = [
  {
    label: "baseline-replacement-architectural-3200",
    answers: { workType: "replacement", season: "fall", propertyType: "two_story", material: "architectural", steepness: "normal", complexity: "complex", insurance: "no", ownership: "yes" },
    homeSize: 3200,
  },
  {
    label: "repair-asphalt-asap-1800",
    answers: { workType: "repair", season: "asap", propertyType: "single", material: "asphalt", steepness: "flat", complexity: "normal", insurance: "yes", ownership: "yes" },
    homeSize: 1800,
  },
  {
    label: "metal-very-steep-2800",
    answers: { workType: "replacement", season: "spring", propertyType: "two_story", material: "metal", steepness: "steep", complexity: "very_complex", insurance: "no", ownership: "yes" },
    homeSize: 2800,
  },
];

async function fillRoofingAddress(page) {
  await page.evaluate(() => {
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) {
        el.value = v;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    };
    set("journeyStreetAddress", "17064 Laurelmont Ct");
    set("journeyCity", "Fort Mill");
    set("journeyState", "SC");
    set("journeyZipCode", "29707");
  });
  await sleep(500);
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const t = btns.find((b) => /get my estimate/i.test((b.textContent || "").trim()));
    if (t) t.click();
  });
  await sleep(3500);
}

async function runEstimate(browser, outDir, perm) {
  const label = `estimate-${perm.label}`;
  const page = await newPage(browser, label, { outDir });
  const shots = [];
  let walkError = null;
  try {
    await page.goto(`${BASE}${ESTIMATE_URL}`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);
    shots.push(await shot(page, outDir, `${label}-01-landing`));

    await fillRoofingAddress(page);
    shots.push(await shot(page, outDir, `${label}-02-after-address`));

    await page.evaluate(({ answers, homeSize }) => {
      Object.entries(answers).forEach(([group, val]) => {
        const card = document.querySelector(`button.est-option[data-group="${group}"][data-value="${val}"]`);
        if (card) card.click();
      });
      const sz = document.getElementById("estHomeSize");
      if (sz) {
        sz.value = String(homeSize);
        sz.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }, { answers: perm.answers, homeSize: perm.homeSize });
    await sleep(700);
    shots.push(await shot(page, outDir, `${label}-03-answers-filled`, true));

    await page.evaluate(() => {
      const btn = document.getElementById("estSubmitBtn");
      if (btn) btn.click();
    });
    await sleep(5000);
    shots.push(await shot(page, outDir, `${label}-04-result-top`));
    shots.push(await shot(page, outDir, `${label}-05-result-full`, true));
    await dumpResultText(page, outDir, `${label}-result`, RESULT_SELECTOR);
  } catch (e) {
    walkError = e.message;
  } finally {
    await page.close();
  }

  if (walkError) return { walkPath: `estimate (${perm.label})`, error: walkError, shots, issues: [] };
  const examined = await examinePath({
    vertical: VERTICAL,
    walkPath: `estimate (${perm.label})`,
    contextNotes: `User answers: ${JSON.stringify(perm.answers)}, home ${perm.homeSize}sqft. Lane's address: 17064 Laurelmont Ct, Fort Mill SC 29707.`,
    screenshots: shots,
  }).catch((e) => ({ issues: [{ severity: "low", screenshot: "(eyes-error)", summary: "vision call failed", detail: e.message }] }));
  return { walkPath: `estimate (${perm.label})`, ...examined };
}

async function run({ outDir }) {
  const manifestResult = loadFixtureManifest(VERTICAL, ROOT);
  const analyze = pickAnalyzeFixtures(manifestResult, { max: 2 });
  const compare = pickCompareFixtures(manifestResult, VERTICAL);

  const browser = await puppeteer.launch({
    headless: HEADLESS,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled", "--disable-features=IsolateOrigins,site-per-process"],
  });
  const paths = [];
  const walkErrors = [];
  try {
    for (const perm of ESTIMATE_PERMUTATIONS) {
      const r = await runEstimate(browser, outDir, perm);
      if (r.error) walkErrors.push(`estimate(${perm.label}): ${r.error}`);
      paths.push(r);
    }
    for (const fx of analyze) {
      const r = await runAnalyzePath(browser, outDir, {
        vertical: VERTICAL,
        resultSelector: RESULT_SELECTOR,
        url: ANALYZER_URL,
        fixture: fx,
      });
      if (r.error) walkErrors.push(`analyze(${fx.file}): ${r.error}`);
      paths.push(r);
    }
    const cmp = await runComparePath(browser, outDir, {
      vertical: VERTICAL,
      resultSelector: RESULT_SELECTOR,
      url: COMPARE_URL,
      compareFixtures: compare,
    });
    if (cmp.error) walkErrors.push(`compare: ${cmp.error}`);
    paths.push(cmp);
  } finally {
    await browser.close();
  }

  return { vertical: VERTICAL, paths, walkErrors, fixtureErrors: manifestResult.errors };
}

module.exports = { run, VERTICAL };
