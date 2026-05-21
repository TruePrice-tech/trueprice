// Generic estimate-walk harness for any vertical with a `.<prefix>-option` wizard.
// Usage: node scripts/walk-estimate.js <vertical> <optionClass> [date]
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const vertical = process.argv[2];
const optionClass = process.argv[3];  // e.g. "elec-option", "solar-option", "ins-option"
const OUT_DATE = process.argv[4] || "2026-04-30";
if (!vertical || !optionClass) { console.error("Usage: node walk-estimate.js <vertical> <optionClass> [date]"); process.exit(1); }

const URL_MAP = {
  plumbing: "plumbing-estimate.html",
  electrical: "electrical-estimate.html",
  solar: "solar-estimate.html",
  windows: "window-estimate.html",
  painting: "painting-estimate.html",
  siding: "siding-estimate.html",
  fencing: "fencing-estimate.html",
  concrete: "concrete-estimate.html",
  landscaping: "landscaping-estimate.html",
  kitchen: "kitchen-estimate.html",
  insulation: "insulation-estimate.html",
};
const URL = "https://woogoro.com/" + URL_MAP[vertical];
const OUT = path.resolve(__dirname, "..", "output", "audits", vertical + "-" + OUT_DATE, "estimate");
fs.mkdirSync(OUT, { recursive: true });

function $w(ms) { return new Promise(r => setTimeout(r, ms)); }
async function snap(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: true });
  console.log("  captured: " + name);
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1280, height: 900 });

  console.log(`[${vertical}] Navigate ${URL}`);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await $w(8000);
  await snap(page, "walk-01-landing.png");

  // Type address
  console.log(`[${vertical}] Type address`);
  const inputIds = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input")).map(i => ({ id: i.id, placeholder: i.placeholder, type: i.type }));
  });
  for (const inp of inputIds) {
    let val = "";
    const ph = (inp.placeholder || "").toLowerCase();
    if (inp.id === "addrStreet" || ph.includes("street") || ph.includes("address")) val = "17064 Laurelmont Court";
    else if (inp.id === "addrCity" || ph === "city") val = "Fort Mill";
    else if (inp.id === "addrState" || ph === "state") val = "SC";
    else if (inp.id === "addrZip" || ph.includes("zip")) val = "29707";
    if (val) {
      const sel = inp.id ? `#${inp.id}` : `input[placeholder="${inp.placeholder}"]`;
      try {
        await page.click(sel, { clickCount: 3 });
        await page.keyboard.type(val, { delay: 30 });
        // Press Escape to dismiss any geocode-suggest overlay before moving to
        // next field (overlay covers next field, click can land on a suggestion).
        await page.keyboard.press("Escape");
      } catch (e) { /* skip */ }
    }
  }
  await $w(1500);
  await snap(page, "walk-02-address-typed.png");

  // Click Get Estimate
  console.log(`[${vertical}] Click Get Estimate`);
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button, a, input[type=submit]"))
      .find(b => /get.*estimate/i.test((b.innerText || b.value || "").trim()));
    if (btn) btn.click();
  });
  await $w(4000);
  await snap(page, "walk-03-after-get-estimate.png");

  // Walk wizard — click first .<prefix>-option each iter; if none, try number input + Continue; fall back to Next button
  for (let i = 1; i <= 10; i++) {
    const result = await page.evaluate((cls) => {
      const opts = document.querySelectorAll("." + cls);
      if (opts.length > 0) {
        opts[0].click();
        return { type: "option", label: opts[0].innerText.slice(0, 50), count: opts.length };
      }
      // Look for visible number input that needs filling
      const numInput = Array.from(document.querySelectorAll("input[type=number]"))
        .find(inp => inp.offsetParent !== null && !inp.value);
      if (numInput) {
        numInput.value = "500";
        numInput.dispatchEvent(new Event("input", { bubbles: true }));
        numInput.dispatchEvent(new Event("change", { bubbles: true }));
        // Then find Continue/Next button
        const btn2 = Array.from(document.querySelectorAll("button"))
          .find(b => b.offsetParent !== null && /continue|next|see.*estimate|calculate/i.test(b.innerText));
        if (btn2) btn2.click();
        return { type: "numberInput", label: numInput.placeholder + "=500", clickedBtn: btn2 ? btn2.innerText : "(none)" };
      }
      const btn = Array.from(document.querySelectorAll("button"))
        .find(b => b.offsetParent !== null && /next|continue|see.*estimate|view.*estimate|calculate|get.*estimate/i.test(b.innerText));
      if (btn) {
        btn.click();
        return { type: "button", label: btn.innerText.slice(0, 50) };
      }
      return { type: "none" };
    }, optionClass);
    console.log(`  iter ${i}: ${JSON.stringify(result)}`);
    await $w(2200);
    await snap(page, `walk-04-iter${i}.png`);
    if (result.type === "none") break;
  }

  // Final state
  await $w(2000);
  const final = await page.evaluate(() => {
    // Try common app ids
    const candidates = ["plumbApp", "elecApp", "solarApp", "winApp", "paintApp", "sideApp", "fenceApp", "concApp", "landApp", "kitchApp", "insApp"];
    for (const id of candidates) {
      const el = document.getElementById(id);
      if (el && el.innerText.length > 100) return el.innerText.slice(0, 4000);
    }
    return (document.querySelector("main") || document.body).innerText.slice(0, 4000);
  });
  console.log("===FINAL APP TEXT===");
  console.log(final);
  fs.writeFileSync(path.join(OUT, "walk-final-text.txt"), final);
  await snap(page, "walk-05-final.png");

  await browser.close();
  console.log("DONE: " + vertical);
})();
