// Roofing estimate audit. Tests /roofing-quote-analyzer.html?mode=estimator
// Run: node scripts/audit-roofing-estimate.js [step]

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const URL = "https://woogoro.com/roofing-quote-analyzer.html?mode=estimator";
const OUT = path.resolve(__dirname, "..", "output", "audits", "roofing-2026-04-29", "estimate");
fs.mkdirSync(OUT, { recursive: true });

const STEP = process.argv[2] || "1";
function $w(s) { return new Promise(r => setTimeout(r, s)); }

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
        rect: rect(el),
      });
    });
    return {
      url: location.href, title: document.title,
      bodyTextStart: document.body.innerText.slice(0, 800),
      interactive,
    };
  });
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  await page.setViewport({ width: 1280, height: 900 });

  if (STEP === "1") {
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await $w(2000);
    await page.screenshot({ path: path.join(OUT, "01-initial.png"), fullPage: true });
    const desc = await describePage(page);
    fs.writeFileSync(path.join(OUT, "01-initial.json"), JSON.stringify(desc, null, 2));
    console.log("Step 1 done.", desc.interactive.length, "interactive elements.");
  }

  if (STEP === "2") {
    // Fill plausible inputs and submit
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await $w(2000);
    // Common estimate inputs: address, zip, roof size, material
    const filled = await page.evaluate(() => {
      const fills = [];
      const inputs = Array.from(document.querySelectorAll("input[type=text], input[type=number], select"));
      inputs.forEach(inp => {
        const ph = (inp.placeholder || "").toLowerCase();
        const id = (inp.id || "").toLowerCase();
        const name = (inp.name || "").toLowerCase();
        const ctx = ph + " " + id + " " + name;
        if (/address|street/.test(ctx) && inp.type === "text") {
          inp.value = "123 Maple St";
          fills.push({field: "address", set: inp.value});
        } else if (/zip/.test(ctx)) {
          inp.value = "29710";
          fills.push({field: "zip", set: inp.value});
        } else if (/(roof.*size|sq.*ft|sqft|square)/.test(ctx)) {
          inp.value = "2200";
          fills.push({field: "roof size", set: inp.value});
        } else if (/material|shingle/.test(ctx) && inp.tagName === "SELECT") {
          if (inp.options.length > 1) inp.selectedIndex = 1;
          fills.push({field: "material", set: inp.value});
        } else if (/city/.test(ctx)) {
          inp.value = "Fort Mill";
          fills.push({field: "city", set: inp.value});
        } else if (/state/.test(ctx)) {
          inp.value = "SC";
          fills.push({field: "state", set: inp.value});
        }
        inp.dispatchEvent(new Event("input", { bubbles: true }));
        inp.dispatchEvent(new Event("change", { bubbles: true }));
      });
      return fills;
    });
    console.log("Filled fields:", JSON.stringify(filled));
    await $w(500);
    await page.screenshot({ path: path.join(OUT, "02-after-fill.png"), fullPage: true });
    // Click "Get my estimate" / submit
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, input[type=submit]"));
      const t = btns.find(b => /get\s+my\s+estimate|get\s+estimate|calculate/i.test(b.innerText || b.value || ""));
      if (t) { t.click(); return t.innerText || t.value; }
      return null;
    });
    console.log("Clicked submit:", clicked);
    await $w(15000);
    await page.screenshot({ path: path.join(OUT, "03-result.png"), fullPage: true });
    const desc = await describePage(page);
    fs.writeFileSync(path.join(OUT, "03-result.json"), JSON.stringify(desc, null, 2));
    const resultText = await page.evaluate(() => {
      const r = document.querySelector("#resultContainer, #estimatorResult, .estimator-result, .estimate-result, main");
      return r ? r.innerText : "(none)";
    });
    fs.writeFileSync(path.join(OUT, "03-result.txt"), resultText);
    console.log("Step 2 done. resultLen=", resultText.length);
  }

  if (STEP === "4") {
    // Full e2e: address → multi-step form → final estimate
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await $w(2000);
    // Fill address
    await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input[type=text]"));
      inputs.forEach(inp => {
        const ph = (inp.placeholder || "").toLowerCase();
        if (/address|street/.test(ph)) inp.value = "123 Maple St";
        else if (/city/.test(ph)) inp.value = "Fort Mill";
        else if (/state/.test(ph)) inp.value = "SC";
        else if (/zip/.test(ph)) inp.value = "29710";
        inp.dispatchEvent(new Event("input", { bubbles: true }));
        inp.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
    await $w(500);
    // Click first Get my estimate
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, input[type=submit]"));
      const t = btns.find(b => /get\s+my\s+estimate/i.test(b.innerText || b.value || ""));
      if (t) t.click();
    });
    // Wait for multi-step form to load
    await $w(8000);
    // Click one .est-option per category group. Buttons are emitted in
    // category-order, so pick the first index of each group by walking
    // siblings.
    const filled2 = await page.evaluate(() => {
      const result = { categoryClicks: 0, sqftSet: false };
      const all = Array.from(document.querySelectorAll("button.est-option"));
      // Walk: click first button in each contiguous group with same parent.
      let lastParent = null;
      for (const btn of all) {
        if (btn.parentElement !== lastParent) {
          try { btn.click(); result.categoryClicks++; } catch(e) {}
          lastParent = btn.parentElement;
        }
      }
      const sqftInputs = Array.from(document.querySelectorAll("input[type=number], input[placeholder*='sq']"));
      if (sqftInputs.length) {
        sqftInputs[0].value = "2200";
        sqftInputs[0].dispatchEvent(new Event("input", { bubbles: true }));
        sqftInputs[0].dispatchEvent(new Event("change", { bubbles: true }));
        result.sqftSet = true;
      }
      return result;
    });
    console.log("Multi-step fill:", JSON.stringify(filled2));
    await $w(1000);
    await page.screenshot({ path: path.join(OUT, "05-after-multistep-fill.png"), fullPage: true });
    // Click Build my estimate
    const finalClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, input[type=submit]"));
      const t = btns.find(b => /build\s+my\s+estimate/i.test(b.innerText || b.value || ""));
      if (t) { t.click(); return t.innerText; }
      return null;
    });
    console.log("Build clicked:", finalClicked);
    await $w(15000);
    await page.screenshot({ path: path.join(OUT, "06-final-estimate.png"), fullPage: true });
    const resultText = await page.evaluate(() => {
      const r = document.querySelector("#resultContainer, #estimatorResult, .estimator-result, main");
      return r ? r.innerText : "(none)";
    });
    fs.writeFileSync(path.join(OUT, "06-final-estimate.txt"), resultText);
    console.log("Step 4 done. Final resultLen=", resultText.length);
  }

  if (STEP === "3") {
    // Unhappy path: empty submit (validation)
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await $w(2000);
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, input[type=submit]"));
      const t = btns.find(b => /get\s+my\s+estimate|get\s+estimate|calculate/i.test(b.innerText || b.value || ""));
      if (t) { t.click(); return true; }
      return false;
    });
    await $w(3000);
    await page.screenshot({ path: path.join(OUT, "04-empty-submit.png"), fullPage: true });
    const desc = await describePage(page);
    fs.writeFileSync(path.join(OUT, "04-empty-submit.json"), JSON.stringify(desc, null, 2));
    console.log("Step 3 (empty submit) clicked=", clicked);
  }

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
