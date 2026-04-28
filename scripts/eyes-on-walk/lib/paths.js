// Generic walkers for the 3 paths every vertical has: estimate / analyze /
// compare. Each runner provides a tight config; this module handles puppeteer
// setup, screenshotting, fixture upload, and the vision-examination call.
//
// A runner can override any of these by exporting its own walk function and
// using these as fallbacks. See runners/fencing.js for the simple case and
// runners/hvac.js for one with a custom mid-step (manualSqft).

const path = require("path");
const fs = require("fs");
const { ROOT, BASE, sleep, newPage, shot, dumpResultText, fillStandardAddress, pickOption } = require("./walker");
const { examinePath } = require("./eyes");

async function gotoWithSettle(page, url, settleMs = 1500) {
  await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(settleMs);
}

// Run the estimate path for one permutation. Config:
//   {
//     vertical, resultSelector, url,
//     permLabel, picks: { containerId: val, ... } OR steps: [{type, ...}],
//     postLanding: async (page) => {} (optional, runs after landing screenshot)
//   }
async function runEstimatePath(browser, outDir, config) {
  const label = `estimate-${config.permLabel}`;
  const page = await newPage(browser, label, { outDir });
  const shots = [];
  let walkError = null;
  try {
    await gotoWithSettle(page, `${BASE}${config.url}`);
    shots.push(await shot(page, outDir, `${label}-01-landing`));

    if (config.postLanding) await config.postLanding(page);

    if (config.addressFiller) {
      await config.addressFiller(page);
    } else {
      await fillStandardAddress(page);
    }
    const startBtn = config.estimateStartButton || "#btnEstimate";
    await page.click(startBtn).catch(() => {});
    await sleep(1500);
    shots.push(await shot(page, outDir, `${label}-02-after-address`));

    const steps = config.steps || Object.entries(config.picks || {}).map(([container, val]) => ({ type: "pick", container, val }));
    let i = 3;
    for (const step of steps) {
      if (step.type === "pick") {
        const ok = await pickOption(page, step.container, step.val);
        if (!ok && step.required !== false) console.log(`  [${label}] missed ${step.container}=${step.val}`);
      } else if (step.type === "pickClass") {
        // For verticals using class-based options instead of #containerId children
        await page.evaluate((cls, v) => {
          const opts = document.querySelectorAll(`.${cls}`);
          for (const o of opts) {
            if ((o.getAttribute("data-val") || "").toLowerCase() === String(v).toLowerCase()) { o.click(); return; }
          }
        }, step.cls, step.val).catch(() => {});
        await sleep(700);
      } else if (step.type === "numericInput") {
        await page.evaluate((sel, v) => {
          const inp = document.querySelector(sel);
          if (inp) { inp.value = String(v); inp.dispatchEvent(new Event("input", { bubbles: true })); inp.dispatchEvent(new Event("change", { bubbles: true })); }
        }, step.selector, step.value).catch(() => {});
        await sleep(300);
        if (step.nextSelector) await page.evaluate((sel) => { const b = document.querySelector(sel); if (b) b.click(); }, step.nextSelector).catch(() => {});
        await sleep(800);
      } else if (step.type === "custom" && step.run) {
        await step.run(page);
      } else if (step.type === "manualSqft") {
        await sleep(1500);
        await page.evaluate(() => { const link = document.getElementById("manualSqftLink"); if (link) link.click(); }).catch(() => {});
        await sleep(400);
        await page.evaluate((v) => {
          const sq = document.getElementById("sqftInput");
          if (sq) { sq.value = v; sq.dispatchEvent(new Event("input", { bubbles: true })); }
        }, step.value || "2000").catch(() => {});
        await sleep(300);
        await page.evaluate(() => { const b = document.getElementById("sqftNext"); if (b) b.click(); }).catch(() => {});
        await sleep(800);
      }
      shots.push(await shot(page, outDir, `${label}-${String(i).padStart(2, "0")}-step`));
      i++;
    }
    await sleep(2500);
    shots.push(await shot(page, outDir, `${label}-${String(i).padStart(2, "0")}-result-top`));
    shots.push(await shot(page, outDir, `${label}-${String(i + 1).padStart(2, "0")}-result-full`, true));
    await dumpResultText(page, outDir, `${label}-result`, config.resultSelector);
  } catch (e) {
    walkError = e.message;
  } finally {
    await page.close();
  }

  if (walkError) return { walkPath: `estimate (${config.permLabel})`, error: walkError, shots, issues: [] };

  const examined = await examinePath({
    vertical: config.vertical,
    walkPath: `estimate (${config.permLabel})`,
    contextNotes: `User answers: ${JSON.stringify(config.picks || config.steps)}. Lane's standard address: 17064 Laurelmont Ct, Fort Mill SC 29707.`,
    screenshots: shots,
  }).catch((e) => ({ issues: [{ severity: "low", screenshot: "(eyes-error)", summary: "vision call failed", detail: e.message }] }));
  return { walkPath: `estimate (${config.permLabel})`, ...examined };
}

// Run the analyzer path for one fixture. Config:
//   {
//     vertical, resultSelector, url,
//     fixture: { fullPath, file, title? },
//     readyTextRe: /Quote Analysis|Verdict|couldn|manual/, (default)
//     priceConfirm: false (default) — set true if vertical has a "Yes, analyze this price" step
//   }
async function runAnalyzePath(browser, outDir, config) {
  const baseLabel = path.basename(config.fixture.file).replace(/\..+$/, "").slice(0, 60);
  const label = `analyze-${baseLabel}`;
  const page = await newPage(browser, label, { outDir });
  const shots = [];
  let walkError = null;
  try {
    await gotoWithSettle(page, `${BASE}${config.url}`);
    shots.push(await shot(page, outDir, `${label}-01-landing`));

    const inputSel = config.fileInputSelector || 'input[type="file"]';
    const fileInput = await page.$(inputSel);
    if (!fileInput) throw new Error(`no file input matching ${inputSel}`);
    await fileInput.uploadFile(config.fixture.fullPath);

    const readyRe = config.readyTextRe || /Quote Analysis|Verdict|couldn|manual|We found your quote total/i;
    const start = Date.now();
    let landed = false;
    while (Date.now() - start < 120000) {
      await sleep(2000);
      const t = await page.evaluate((sel) => {
        const el = document.querySelector(sel) || document.querySelector("main");
        return el ? (el.innerText || "") : "";
      }, config.resultSelector);
      if (readyRe.test(t)) { landed = true; break; }
    }
    shots.push(await shot(page, outDir, `${label}-02-after-upload`, true));

    if (config.priceConfirm && landed) {
      // Click "Yes, analyze this price" or a custom confirm-button selector
      const clicked = await page.evaluate((sel) => {
        if (sel) {
          const direct = document.querySelector(sel);
          if (direct && !direct.disabled) { direct.click(); return true; }
        }
        const btns = Array.from(document.querySelectorAll("button"));
        const yes = btns.find((b) => /Yes,? analyze this price|Analyze this price/i.test((b.textContent || "").trim()));
        if (yes && !yes.disabled) { yes.click(); return true; }
        return false;
      }, config.confirmButtonSelector || null);
      if (clicked) {
        await sleep(8000);
        shots.push(await shot(page, outDir, `${label}-03-verdict`, true));
      }
    }
    await dumpResultText(page, outDir, `${label}-result`, config.resultSelector);
  } catch (e) {
    walkError = e.message;
  } finally {
    await page.close();
  }

  if (walkError) return { walkPath: "analyze", fixture: config.fixture.file, error: walkError, shots, issues: [] };

  const examined = await examinePath({
    vertical: config.vertical,
    walkPath: "analyze",
    fixture: config.fixture.file,
    contextNotes: config.fixture.title || config.fixture.note || "",
    screenshots: shots,
  }).catch((e) => ({ issues: [{ severity: "low", screenshot: "(eyes-error)", summary: "vision call failed", detail: e.message }] }));
  return { walkPath: "analyze", fixture: config.fixture.file, ...examined };
}

// Run the compare path. Config:
//   { vertical, resultSelector, url, compareFixtures: [{tier, file, name}, ...] }
async function runComparePath(browser, outDir, config) {
  if (!config.compareFixtures || !config.compareFixtures.length) {
    return { walkPath: "compare", error: "no comparison fixtures found", shots: [], issues: [] };
  }
  const label = "compare";
  const page = await newPage(browser, label, { outDir });
  const shots = [];
  let walkError = null;
  try {
    await gotoWithSettle(page, `${BASE}${config.url}`);
    shots.push(await shot(page, outDir, `${label}-01-landing`));

    for (let i = 0; i < config.compareFixtures.length && i < 3; i++) {
      const inp = await page.$(`#file${i}`);
      if (!inp) continue;
      await inp.uploadFile(config.compareFixtures[i].file);
      await sleep(3500);
    }
    shots.push(await shot(page, outDir, `${label}-02-after-uploads`, true));

    const start = Date.now();
    let clicked = false;
    while (Date.now() - start < 60000) {
      const ok = await page.evaluate(() => {
        const btn = document.querySelector(".cmp-compare-btn, button[onclick*='compare'], #compareBtn, button[data-action='compare']");
        if (btn && !btn.disabled) { btn.click(); return true; }
        return false;
      });
      if (ok) { clicked = true; break; }
      await sleep(1500);
    }
    if (clicked) await sleep(8000);
    shots.push(await shot(page, outDir, `${label}-03-results`, true));
    await dumpResultText(page, outDir, `${label}-result`, config.resultSelector);
  } catch (e) {
    walkError = e.message;
  } finally {
    await page.close();
  }

  if (walkError) return { walkPath: "compare", error: walkError, shots, issues: [] };

  const examined = await examinePath({
    vertical: config.vertical,
    walkPath: "compare",
    contextNotes: `Three comparison fixtures: ${config.compareFixtures.map((c) => c.tier).join(", ")}.`,
    screenshots: shots,
  }).catch((e) => ({ issues: [{ severity: "low", screenshot: "(eyes-error)", summary: "vision call failed", detail: e.message }] }));
  return { walkPath: "compare", ...examined };
}

// Standard runner skeleton. A runner can call this with a config; verticals
// with custom flow override individual paths.
//   config: {
//     vertical, resultSelector,
//     estimateUrl, analyzerUrl, compareUrl,
//     estimatePermutations: [{ label, picks } | { label, steps, postLanding? }, ...],
//     analyzerPriceConfirm: bool, analyzerReadyTextRe: regex,
//     analyzeMax: 2 (default)
//   }
async function runStandardVertical({ browser, outDir, config, manifestResult, pickAnalyzeFixtures, pickCompareFixtures }) {
  const analyze = pickAnalyzeFixtures(manifestResult, { max: config.analyzeMax || 2 });
  const compare = pickCompareFixtures(manifestResult, config.vertical);
  const paths = [];
  const walkErrors = [];

  for (const perm of config.estimatePermutations) {
    const r = await runEstimatePath(browser, outDir, {
      vertical: config.vertical,
      resultSelector: config.resultSelector,
      url: config.estimateUrl,
      permLabel: perm.label,
      picks: perm.picks,
      steps: perm.steps,
      postLanding: perm.postLanding,
    });
    if (r.error) walkErrors.push(`estimate(${perm.label}): ${r.error}`);
    paths.push(r);
  }

  for (const fx of analyze) {
    const r = await runAnalyzePath(browser, outDir, {
      vertical: config.vertical,
      resultSelector: config.resultSelector,
      url: config.analyzerUrl,
      fixture: fx,
      priceConfirm: !!config.analyzerPriceConfirm,
      readyTextRe: config.analyzerReadyTextRe,
    });
    if (r.error) walkErrors.push(`analyze(${fx.file}): ${r.error}`);
    paths.push(r);
  }

  const cmp = await runComparePath(browser, outDir, {
    vertical: config.vertical,
    resultSelector: config.resultSelector,
    url: config.compareUrl,
    compareFixtures: compare,
  });
  if (cmp.error) walkErrors.push(`compare: ${cmp.error}`);
  paths.push(cmp);

  return { paths, walkErrors };
}

module.exports = { runEstimatePath, runAnalyzePath, runComparePath, runStandardVertical };
