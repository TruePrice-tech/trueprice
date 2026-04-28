// Shared puppeteer helpers used by every vertical runner. Mirrors the patterns
// already in scripts/<vertical>-walk.js so the eyes-on-walk verticals walk
// the live site with the same setup as Lane's manual deep-dive walks.

const path = require("path");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const BASE = process.env.BASE || "https://woogoro.com";
const HEADLESS = process.env.WALK_HEADLESS !== "false"; // default headless for CI
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newPage(browser, label, { outDir }) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
  );
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    window.chrome = { runtime: {} };
  });
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (req.url().includes("/api/geocode-suggest")) {
      req.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ suggestions: [] }) });
    } else {
      req.continue();
    }
  });
  const consoleLog = path.join(outDir, `${label}.console.log`);
  page.on("console", (m) => {
    const t = m.text();
    if (/error|fail|verdict|TP_Engine|400|500/i.test(t)) {
      fs.appendFileSync(consoleLog, `[${m.type()}] ${t}\n`);
    }
  });
  page.on("pageerror", (e) => fs.appendFileSync(consoleLog, `[pageerror] ${e.message}\n`));
  return page;
}

async function shot(page, outDir, name, full = false) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: full });
  return { label: name, file };
}

async function dumpResultText(page, outDir, name, selector) {
  const sel = selector || "main";
  const txt = await page.evaluate((s) => {
    const el = document.querySelector(s);
    return el ? (el.innerText || "").slice(0, 5000) : "(no main)";
  }, sel);
  fs.writeFileSync(path.join(outDir, `${name}.txt`), txt);
  return txt;
}

async function fillStandardAddress(page) {
  // Lane's standard answer set per project_deep_dive_status.md
  await page.waitForSelector("#addrStreet", { timeout: 10000 });
  await page.evaluate(() => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set("addrStreet", "17064 Laurelmont Ct");
    set("addrCity", "Fort Mill");
    set("addrState", "SC");
    set("addrZip", "29707");
  });
  await sleep(300);
}

async function pickOption(page, containerId, val) {
  const ok = await page.evaluate(
    (cid, v) => {
      const o = document.querySelector(`#${cid} [data-val="${v}"]`);
      if (o) { o.click(); return true; }
      return false;
    },
    containerId,
    val
  );
  await sleep(700);
  return ok;
}

module.exports = {
  ROOT,
  BASE,
  HEADLESS,
  sleep,
  newPage,
  shot,
  dumpResultText,
  fillStandardAddress,
  pickOption,
};
