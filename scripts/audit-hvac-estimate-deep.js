// HVAC estimate — thorough audit
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const URL = "https://woogoro.com/hvac-estimate.html";
const OUT = path.resolve(__dirname, "..", "output", "audits", "hvac-2026-04-29", "estimate");
fs.mkdirSync(OUT, { recursive: true });
const STEP = process.argv[2] || "1";
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

async function describePage(page) {
  return await page.evaluate(() => {
    function rect(el) { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }
    function visible(el) { const r = el.getBoundingClientRect(); const s = window.getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && parseFloat(s.opacity) > 0.01; }
    const interactive = [];
    document.querySelectorAll("a, button, input, textarea, select, [role=button], [onclick]").forEach(el => {
      if (!visible(el)) return;
      interactive.push({
        tag: el.tagName, type: el.type || null, id: el.id || null,
        cls: typeof el.className === "string" ? el.className.slice(0, 80) : null,
        href: el.href || null,
        text: (el.innerText || el.value || "").slice(0, 100).trim(),
        placeholder: el.placeholder || null,
        rect: rect(el),
      });
    });
    return {
      url: location.href, title: document.title,
      bodyTextStart: document.body.innerText.slice(0, 1000),
      interactive,
    };
  });
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

  if (STEP === "1") {
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await $w(2000);
    await page.screenshot({ path: path.join(OUT, "01-deep-initial.png"), fullPage: true });
    fs.writeFileSync(path.join(OUT, "01-deep-initial.json"), JSON.stringify(await describePage(page), null, 2));
    console.log("Step 1 done.");
  }

  if (STEP === "2") {
    // Fill ZIP and submit
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await $w(2000);
    // Find ZIP input
    const filled = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input"));
      let zipInput = inputs.find(i => /zip/i.test((i.placeholder || "") + (i.id || "") + (i.name || "")));
      if (zipInput) {
        zipInput.value = "29710";
        zipInput.dispatchEvent(new Event("input", { bubbles: true }));
        zipInput.dispatchEvent(new Event("change", { bubbles: true }));
        return { ok: true, set: zipInput.value };
      }
      return { ok: false };
    });
    console.log("ZIP filled:", JSON.stringify(filled));
    await $w(500);
    // Click "Get HVAC Estimate"
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, input[type=submit]"));
      const t = btns.find(b => /get\s+hvac\s+estimate|get\s+estimate/i.test(b.innerText || b.value || ""));
      if (t) { t.click(); return true; }
      return false;
    });
    console.log("Clicked submit:", clicked);
    await $w(20000);
    await page.screenshot({ path: path.join(OUT, "02-deep-after-submit.png"), fullPage: true });
    const text = await page.evaluate(() => document.querySelector("main")?.innerText || "");
    fs.writeFileSync(path.join(OUT, "02-deep-result-text.txt"), text);
    console.log("Step 2 done. textLen=", text.length);
  }

  if (STEP === "wizard") {
    // Walk through all 5 wizard steps to capture final estimate
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await $w(2000);
    // Address step: fill ZIP + click Get Estimate
    await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input"));
      const zip = inputs.find(i => /zip/i.test((i.placeholder || "") + (i.name || "")));
      if (zip) { zip.value = "29710"; zip.dispatchEvent(new Event("input",{bubbles:true})); }
      const city = inputs.find(i => /city/i.test((i.placeholder || "") + (i.name || "")));
      if (city) { city.value = "Fort Mill"; city.dispatchEvent(new Event("input",{bubbles:true})); }
      const st = inputs.find(i => /^state$/i.test((i.placeholder || "") + (i.name || "")));
      if (st) { st.value = "SC"; st.dispatchEvent(new Event("input",{bubbles:true})); }
    });
    await $w(500);
    await page.evaluate(() => {
      const t = Array.from(document.querySelectorAll("button, input[type=submit]")).find(b => /get\s+hvac\s+estimate/i.test(b.innerText || b.value || ""));
      if (t) t.click();
    });
    await $w(3000);
    await page.screenshot({ path: path.join(OUT, "wizard-step1.png"), fullPage: false });

    // Wizard steps 1-5: HVAC uses .hvac-option divs (NOT buttons).
    // Click first option in each step.
    for (let stepIdx = 1; stepIdx <= 6; stepIdx++) {
      const advanced = await page.evaluate(() => {
        const opts = document.querySelectorAll(".hvac-option");
        if (opts && opts.length > 0) {
          opts[0].click();
          return { clicked: ".hvac-option", text: (opts[0].innerText || "").slice(0, 80), count: opts.length };
        }
        // Some steps may need an input + a Submit/Continue
        const numIn = document.querySelectorAll("input[type=number], input[placeholder*='sq']");
        if (numIn && numIn.length > 0) {
          numIn[0].value = "2200";
          numIn[0].dispatchEvent(new Event("input", { bubbles: true }));
          numIn[0].dispatchEvent(new Event("change", { bubbles: true }));
          return { clicked: "filled-numeric", val: numIn[0].value };
        }
        return { clicked: null };
      });
      console.log("Step", stepIdx, "->", JSON.stringify(advanced));
      await $w(2500);
      // Some steps require a Continue/Next/Build/Looks-right button click
      await page.evaluate(() => {
        const allBtns = Array.from(document.querySelectorAll("button, .hvac-btn, a.hvac-btn, [role=button]"));
        const next = allBtns.find(b => /^(next|continue|build my estimate|get estimate|see my estimate|show my estimate|looks right.{0,15}continue|confirm|submit)$/i.test((b.innerText || "").trim()));
        if (next) next.click();
      });
      await $w(2500);
      await page.screenshot({ path: path.join(OUT, "wizard-after-step" + stepIdx + ".png"), fullPage: false });
      // Check if we reached final estimate
      const reached = await page.evaluate(() => /estimated cost|midpoint|expected range|cost per sq|your estimate/i.test(document.body.innerText));
      if (reached) {
        console.log("Final estimate reached at step", stepIdx);
        break;
      }
    }
    await $w(3000);
    await page.screenshot({ path: path.join(OUT, "wizard-final.png"), fullPage: true });
    const finalText = await page.evaluate(() => document.querySelector("main")?.innerText || "");
    fs.writeFileSync(path.join(OUT, "wizard-final.txt"), finalText);
    console.log("Wizard done. final textLen=", finalText.length);
  }

  if (STEP === "3") {
    // Empty submit (validation)
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await $w(2000);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, input[type=submit]"));
      const t = btns.find(b => /get\s+hvac\s+estimate|get\s+estimate/i.test(b.innerText || b.value || ""));
      if (t) t.click();
    });
    await $w(3000);
    await page.screenshot({ path: path.join(OUT, "03-deep-empty-submit.png"), fullPage: true });
    console.log("Step 3 (empty submit) done.");
  }

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
