// Walk Plumbing estimate end-to-end as a human:
// land → enter address → click Get Estimate → walk all wizard steps → see verdict
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const URL = "https://woogoro.com/plumbing-estimate.html";
const OUT = path.resolve(__dirname, "..", "output", "audits", "plumbing-2026-04-30", "estimate");
fs.mkdirSync(OUT, { recursive: true });

function $w(ms) { return new Promise(r => setTimeout(r, ms)); }

async function snap(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: true });
  console.log("captured: " + name);
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

  console.log("Navigate");
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await $w(8000);
  await snap(page, "walk-01-landing.png");

  // Type address into each input via real keyboard typing (triggers validation)
  console.log("Type address fields");
  // Find input ids
  const inputIds = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input")).map(i => ({ id: i.id, placeholder: i.placeholder, type: i.type }));
  });
  console.log("Inputs found:", JSON.stringify(inputIds));

  // Type into each one by clicking and typing
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
        console.log(`  typed "${val}" into ${sel}`);
      } catch (e) {
        console.log(`  failed to type into ${sel}: ${e.message}`);
      }
    }
  }
  await $w(1500);
  await snap(page, "walk-02-address-typed.png");

  // Click Get Estimate
  console.log("Click Get Estimate");
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button, a, input[type=submit]"))
      .find(b => /get.*estimate/i.test((b.innerText || b.value || "").trim()));
    if (btn) btn.click();
  });
  await $w(4000);
  await snap(page, "walk-03-after-get-estimate.png");

  // Walk through wizard — keep clicking first .plumb-option (or Next button) for up to 10 iters
  for (let i = 1; i <= 10; i++) {
    console.log(`Wizard iter ${i}`);
    const result = await page.evaluate(() => {
      const opts = document.querySelectorAll(".plumb-option");
      if (opts.length > 0) {
        opts[0].click();
        return { type: "option", label: opts[0].innerText, count: opts.length };
      }
      const btn = Array.from(document.querySelectorAll("button"))
        .find(b => /next|continue|see.*estimate|view.*estimate|calculate|get.*estimate/i.test(b.innerText));
      if (btn) {
        btn.click();
        return { type: "button", label: btn.innerText };
      }
      return { type: "none" };
    });
    console.log(`  → ${JSON.stringify(result)}`);
    await $w(2200);
    await snap(page, `walk-04-iter${i}.png`);
    if (result.type === "none") {
      console.log("No more clickable advance — stopping");
      break;
    }
  }

  // Read final state of #plumbApp
  await $w(2000);
  const final = await page.evaluate(() => {
    const app = document.getElementById("plumbApp");
    return app ? app.innerText.slice(0, 4000) : "(no plumbApp)";
  });
  console.log("===FINAL #plumbApp TEXT===");
  console.log(final);
  fs.writeFileSync(path.join(OUT, "walk-final-text.txt"), final);
  await snap(page, "walk-05-final.png");

  await browser.close();
  console.log("DONE");
})();
