// Fencing eyes-on walk. Mirrors scripts/fencing-walk.js but routes every
// screenshot batch through lib/eyes.js so visual issues get flagged the way
// a human reviewer would catch them.

const path = require("path");
const fs = require("fs");
const puppeteer = require("puppeteer");

const { ROOT, BASE, HEADLESS, sleep, newPage, shot, dumpResultText, fillStandardAddress, pickOption } = require("../lib/walker");
const { loadFixtureManifest, pickAnalyzeFixtures, pickCompareFixtures } = require("../lib/fixtures");
const { examinePath } = require("../lib/eyes");

const VERTICAL = "fencing";
const RESULT_SELECTOR = "#fenceApp, main";

const ESTIMATE_PERMUTATIONS = [
  { label: "cedar-priv", picks: { fenceType: "cedar", length: "200", height: "6", gate: "yes", terrain: "flat", demo: "yes" } },
  { label: "wood-priv", picks: { fenceType: "wood_privacy", length: "150", height: "6", gate: "no", terrain: "flat", demo: "no" } },
  { label: "chain-link", picks: { fenceType: "chain_link", length: "100", height: "4", gate: "no", terrain: "flat", demo: "no" } },
];

async function walkEstimate(browser, outDir, perm) {
  const label = `estimate-${perm.label}`;
  const page = await newPage(browser, label, { outDir });
  const shots = [];
  try {
    await page.goto(`${BASE}/fencing-estimate.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);
    shots.push(await shot(page, outDir, `${label}-01-landing`));

    await fillStandardAddress(page);
    await page.click("#btnEstimate");
    await sleep(1500);
    shots.push(await shot(page, outDir, `${label}-02-step1-fenceType`));

    await pickOption(page, "optType", perm.picks.fenceType);
    shots.push(await shot(page, outDir, `${label}-03-step2-length`));

    await pickOption(page, "optLength", perm.picks.length);
    shots.push(await shot(page, outDir, `${label}-04-step3-height`));

    await pickOption(page, "optHeight", perm.picks.height);
    shots.push(await shot(page, outDir, `${label}-05-step4-gate`));

    await pickOption(page, "optGate", perm.picks.gate);
    shots.push(await shot(page, outDir, `${label}-06-step5-terrain`));

    await pickOption(page, "optTerrain", perm.picks.terrain);
    shots.push(await shot(page, outDir, `${label}-07-step6-demo`));

    await pickOption(page, "optDemo", perm.picks.demo);
    await sleep(2500);
    shots.push(await shot(page, outDir, `${label}-08-result-top`));
    shots.push(await shot(page, outDir, `${label}-09-result-full`, true));
    await dumpResultText(page, outDir, `${label}-09-result`, RESULT_SELECTOR);
  } catch (e) {
    return { walkPath: `estimate (${perm.label})`, error: e.message, shots, issues: [] };
  } finally {
    await page.close();
  }

  const examined = await examinePath({
    vertical: VERTICAL,
    walkPath: `estimate (${perm.label})`,
    contextNotes: `User answers: ${JSON.stringify(perm.picks)}. Lane's standard address: 17064 Laurelmont Ct, Fort Mill SC 29707.`,
    screenshots: shots,
  });
  return { walkPath: `estimate (${perm.label})`, ...examined };
}

async function walkAnalyze(browser, outDir, fixture) {
  const label = `analyze-${path.basename(fixture.file).replace(/\..+$/, "")}`;
  const page = await newPage(browser, label, { outDir });
  const shots = [];
  try {
    await page.goto(`${BASE}/fencing-quote-analyzer.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);
    shots.push(await shot(page, outDir, `${label}-01-landing`));

    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) throw new Error("no file input on analyzer page");
    await fileInput.uploadFile(fixture.fullPath);

    const start = Date.now();
    let got = false;
    while (Date.now() - start < 120000) {
      await sleep(2000);
      const seen = await page.evaluate(() => {
        const t = (document.querySelector("#fenceApp, main")?.innerText || "");
        return t.includes("Quote Analysis") || t.includes("Verdict") || t.includes("couldn") || t.includes("manual");
      });
      if (seen) { got = true; break; }
    }
    shots.push(await shot(page, outDir, `${label}-02-result`, true));
    await dumpResultText(page, outDir, `${label}-02-result`, RESULT_SELECTOR);
    if (!got) shots.push({ label: `${label}-TIMEOUT`, file: shots[shots.length - 1].file });
  } catch (e) {
    return { walkPath: "analyze", fixture: fixture.file, error: e.message, shots, issues: [] };
  } finally {
    await page.close();
  }

  const examined = await examinePath({
    vertical: VERTICAL,
    walkPath: "analyze",
    fixture: fixture.file,
    contextNotes: fixture.title || fixture.note || "",
    screenshots: shots,
  });
  return { walkPath: "analyze", fixture: fixture.file, ...examined };
}

async function walkCompare(browser, outDir, compareFiles) {
  if (!compareFiles.length) return { walkPath: "compare", error: "no comparison fixtures found", shots: [], issues: [] };
  const label = "compare";
  const page = await newPage(browser, label, { outDir });
  const shots = [];
  try {
    await page.goto(`${BASE}/compare-fencing-quotes.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);
    shots.push(await shot(page, outDir, `${label}-01-landing`));

    for (let i = 0; i < compareFiles.length && i < 3; i++) {
      const inp = await page.$(`#file${i}`);
      if (!inp) continue;
      await inp.uploadFile(compareFiles[i].file);
      await sleep(3500);
    }
    shots.push(await shot(page, outDir, `${label}-02-after-uploads`, true));

    const start = Date.now();
    let clicked = false;
    while (Date.now() - start < 60000) {
      const ok = await page.evaluate(() => {
        const btn = document.querySelector(".cmp-compare-btn, button[onclick*='compare'], #compareBtn");
        if (btn && !btn.disabled) { btn.click(); return true; }
        return false;
      });
      if (ok) { clicked = true; break; }
      await sleep(1500);
    }
    if (clicked) await sleep(8000);
    shots.push(await shot(page, outDir, `${label}-03-results`, true));
    await dumpResultText(page, outDir, `${label}-03-results`, RESULT_SELECTOR);
  } catch (e) {
    return { walkPath: "compare", error: e.message, shots, issues: [] };
  } finally {
    await page.close();
  }

  const examined = await examinePath({
    vertical: VERTICAL,
    walkPath: "compare",
    contextNotes: `Three comparison fixtures uploaded: ${compareFiles.map((c) => c.tier).join(", ")}.`,
    screenshots: shots,
  });
  return { walkPath: "compare", ...examined };
}

async function run({ outDir }) {
  const manifest = loadFixtureManifest(VERTICAL, ROOT);
  const analyzeFixtures = pickAnalyzeFixtures(manifest, { max: 2 });
  const compareFixtures = pickCompareFixtures(manifest, VERTICAL);

  const browser = await puppeteer.launch({
    headless: HEADLESS,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled", "--disable-features=IsolateOrigins,site-per-process"],
  });

  const paths = [];
  const walkErrors = [];
  try {
    for (const perm of ESTIMATE_PERMUTATIONS) {
      const r = await walkEstimate(browser, outDir, perm);
      if (r.error) walkErrors.push(`estimate(${perm.label}): ${r.error}`);
      paths.push(r);
    }
    for (const fx of analyzeFixtures) {
      const r = await walkAnalyze(browser, outDir, fx);
      if (r.error) walkErrors.push(`analyze(${fx.file}): ${r.error}`);
      paths.push(r);
    }
    const r = await walkCompare(browser, outDir, compareFixtures);
    if (r.error) walkErrors.push(`compare: ${r.error}`);
    paths.push(r);
  } finally {
    await browser.close();
  }

  return { vertical: VERTICAL, paths, walkErrors, fixtureErrors: manifest.errors };
}

module.exports = { run, VERTICAL };
