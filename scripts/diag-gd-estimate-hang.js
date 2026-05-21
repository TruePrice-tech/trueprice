// Diagnostic: walk GD estimate, log all console + network activity,
// screenshot every 30s, identify where the user-reported 20-min hang occurs.
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const URL_ESTIMATE = "https://woogoro.com/garage-door-estimate.html";
const OUT = path.resolve(__dirname, "..", "output", "diag", "gd-estimate-hang-" + Date.now());
fs.mkdirSync(OUT, { recursive: true });

function $w(s) { return new Promise(r => setTimeout(r, s)); }

async function passCheckpoint(page) {
  for (let i = 0; i < 30; i++) {
    await $w(1000);
    try {
      const isCheck = await page.evaluate(() => /Vercel Security Checkpoint|verifying your browser|Failed to verify/i.test(document.body && document.body.innerText || ""));
      if (!isCheck) return true;
    } catch (e) {}
  }
  return false;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
    defaultViewport: null,
  });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1280, height: 900 });

  const consoleLog = [];
  const networkLog = [];
  const errorLog = [];

  page.on("console", msg => {
    consoleLog.push({ t: Date.now(), type: msg.type(), text: msg.text().slice(0, 500) });
  });
  page.on("pageerror", err => {
    errorLog.push({ t: Date.now(), msg: String(err).slice(0, 500) });
  });
  page.on("requestfailed", req => {
    networkLog.push({ t: Date.now(), kind: "FAIL", url: req.url(), reason: req.failure() && req.failure().errorText });
  });
  page.on("response", res => {
    const url = res.url();
    const status = res.status();
    // Log non-200 responses + XHR/fetch only
    if (status >= 400 || /\/api\/|estimate|geocode|tesseract/i.test(url)) {
      networkLog.push({ t: Date.now(), kind: "RESP", status, url: url.slice(0, 200) });
    }
  });

  console.log("=== Loading", URL_ESTIMATE);
  const t0 = Date.now();
  await page.goto(URL_ESTIMATE, { waitUntil: "networkidle2", timeout: 60000 });
  await passCheckpoint(page);
  await $w(2000);
  await page.screenshot({ path: path.join(OUT, "01-loaded.png"), fullPage: true });
  console.log("=== Loaded at +", ((Date.now() - t0) / 1000).toFixed(1), "s");

  // Type address character-by-character to catch autocomplete-blocking hangs
  console.log("=== Typing address (real input simulation)");
  const addrInput = await page.$('input[type=text], input[type=search]');
  if (addrInput) {
    await addrInput.click();
    const tType0 = Date.now();
    for (const ch of "123 Maple St Fort Mill SC") {
      await page.keyboard.type(ch, { delay: 80 });
    }
    console.log("=== Address typed in", ((Date.now() - tType0) / 1000).toFixed(1), "s");
    await $w(2000);
    await page.screenshot({ path: path.join(OUT, "01b-addr-typed.png"), fullPage: true });
  } else {
    console.log("=== No address input found, skipping typing");
  }

  // Click "Get Garage Door Estimate" CTA on landing
  console.log("=== Clicking 'Get Garage Door Estimate' CTA");
  await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll("button, input[type=submit]")).find(b => /get\s+garage.door.estimate|get\s+estimate/i.test(b.innerText || b.value || ""));
    if (t) t.click();
  });
  await $w(3000);
  await page.screenshot({ path: path.join(OUT, "02-after-cta.png"), fullPage: true });
  console.log("=== State at +", ((Date.now() - t0) / 1000).toFixed(1), "s:", (await page.evaluate(() => (document.querySelector("h1") || {}).innerText)));

  // Walk wizard: Single Car -> Basic Steel -> Yes
  for (let i = 1; i <= 4; i++) {
    console.log("=== Wizard step", i);
    await page.evaluate(() => {
      const els = document.querySelectorAll(".gd-option");
      if (els && els.length > 0) els[0].click();
    });
    await $w(1500);
    await page.evaluate(() => {
      const next = Array.from(document.querySelectorAll("button, [role=button]")).find(b => /^(next|continue|build|see my estimate|get estimate|looks right.{0,15}continue|confirm)$/i.test((b.innerText || "").trim()));
      if (next) next.click();
    });
    await $w(2000);
    await page.screenshot({ path: path.join(OUT, "03-wizard-step-" + i + ".png"), fullPage: true });
    const state = await page.evaluate(() => ({
      h1: (document.querySelector("h1") || {}).innerText || "",
      stepMarker: (document.body.innerText.match(/Step \d of \d/) || [])[0] || "",
      hasResult: /your garage door estimate|estimated cost|expected range/i.test(document.body.innerText),
      hasSpinner: /loading|building|analyzing|calculating/i.test(document.body.innerText),
    }));
    console.log("=== State at +", ((Date.now() - t0) / 1000).toFixed(1), "s:", JSON.stringify(state));
    if (state.hasResult) { console.log("=== Result reached at step", i); break; }
  }

  // Watch the page for additional 60 seconds, screenshotting every 15s
  console.log("=== Post-wizard watch loop (60s × 15s ticks)");
  for (let t = 1; t <= 4; t++) {
    await $w(15000);
    await page.screenshot({ path: path.join(OUT, "04-post-wizard-t" + (t * 15) + "s.png"), fullPage: true });
    const sample = await page.evaluate(() => ({
      h1: (document.querySelector("h1") || {}).innerText || "",
      hasResult: /your garage door estimate|estimated cost|expected range/i.test(document.body.innerText),
      hasSpinner: /loading|building|analyzing|calculating/i.test(document.body.innerText),
      bodyHead: document.body.innerText.slice(0, 300),
    }));
    console.log("=== t+" + (t * 15) + "s post-wizard:", JSON.stringify(sample, null, 2));
  }

  fs.writeFileSync(path.join(OUT, "console.json"), JSON.stringify(consoleLog, null, 2));
  fs.writeFileSync(path.join(OUT, "network.json"), JSON.stringify(networkLog, null, 2));
  fs.writeFileSync(path.join(OUT, "errors.json"), JSON.stringify(errorLog, null, 2));
  console.log("=== Total elapsed", ((Date.now() - t0) / 1000).toFixed(1), "s");
  console.log("=== Output dir:", OUT);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
