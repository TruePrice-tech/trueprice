// Focused re-test for REDO fixes shipped 2026-04-30:
//   ce1a9294db — Insulation analyzer #main scope (trust banner)
//   55e97e1fbd — Auto-repair analyzer H1 sentence-case
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const FIX_ROOF = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "roofing-gaf-quote.jpeg");

const OUT_AUTO = path.resolve(__dirname, "..", "output", "audits", "auto-repair-2026-04-30");
const OUT_INS = path.resolve(__dirname, "..", "output", "audits", "insulation-2026-04-29");
const OUT_KIT = path.resolve(__dirname, "..", "output", "audits", "kitchen-2026-04-29");
fs.mkdirSync(path.join(OUT_AUTO, "analyze"), { recursive: true });
fs.mkdirSync(path.join(OUT_INS, "analyze"), { recursive: true });
fs.mkdirSync(path.join(OUT_KIT, "analyze"), { recursive: true });

function $w(ms) { return new Promise(r => setTimeout(r, ms)); }

async function gotoSafe(page, url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      // Wait for body
      await page.waitForSelector("body", { timeout: 30000 });
      // Settle
      await $w(4000);
      return;
    } catch (e) {
      console.log(`goto attempt ${attempt + 1} failed:`, e.message);
      await $w(3000);
    }
  }
  throw new Error("gotoSafe: all attempts failed for " + url);
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1280, height: 900 });

  // ===========================
  // 1. Auto-repair: verify H1 sentence-case post-fix
  // ===========================
  console.log("=== AUTO-REPAIR: re-test H1 case ===");
  await gotoSafe(page, "https://woogoro.com/auto-repair.html?path=quote");
  // Wait for the file input to be in the DOM
  await page.waitForSelector('input[type=file]', { timeout: 30000 });
  await $w(2000);
  const arInput = await page.$('input[type=file]');
  if (!arInput) { console.log("AUTO: no file input"); await browser.close(); return; }
  await arInput.uploadFile(FIX_ROOF);
  // Wait for reject H1 to appear
  try {
    await page.waitForFunction(() => {
      return Array.from(document.querySelectorAll("h1")).some(h => /This is not/i.test(h.innerText));
    }, { timeout: 75000 });
  } catch (e) {
    console.log("AUTO: timed out waiting for reject H1");
  }
  await $w(2000);
  const arData = await page.evaluate(() => {
    const h = Array.from(document.querySelectorAll("h1")).find(el => /This is not/i.test(el.innerText));
    return { h1: h ? h.innerText : "(no reject H1)" };
  });
  console.log("AUTO H1:", arData.h1);
  await page.screenshot({ path: path.join(OUT_AUTO, "analyze", "redo-04-precta-roof-rejected.png"), fullPage: true });
  fs.writeFileSync(path.join(OUT_AUTO, "analyze", "redo-h1-text.txt"), arData.h1);

  // ===========================
  // 2. Insulation: verify trust banner visible post-fix
  // ===========================
  console.log("=== INSULATION: re-test trust banner state ===");
  await gotoSafe(page, "https://woogoro.com/insulation-quote-analyzer.html");
  await page.waitForSelector('input[type=file]', { timeout: 30000 });
  await $w(2000);
  const insInput = await page.$('input[type=file]');
  if (!insInput) { console.log("INS: no file input"); await browser.close(); return; }
  await insInput.uploadFile(FIX_ROOF);
  try {
    await page.waitForFunction(() => {
      return Array.from(document.querySelectorAll("h1")).some(h => /This is not/i.test(h.innerText));
    }, { timeout: 75000 });
  } catch (e) {
    console.log("INS: timed out waiting for reject H1");
  }
  await $w(2000);
  const insState = await page.evaluate(() => {
    const banner = Array.from(document.querySelectorAll("div")).find(el => /No email.*No phone.*No signup.*never sell/i.test(el.innerText || ""));
    const bannerVisible = banner ? (banner.offsetParent !== null && banner.offsetHeight > 0) : false;
    const h = Array.from(document.querySelectorAll("h1")).find(el => /This is not/i.test(el.innerText));
    return {
      h1: h ? h.innerText : "(none)",
      trustBannerVisible: bannerVisible,
      bannerText: banner ? banner.innerText.replace(/\s+/g, " ").trim().slice(0, 100) : "(none)"
    };
  });
  console.log("INS state:", JSON.stringify(insState, null, 2));
  await page.screenshot({ path: path.join(OUT_INS, "analyze", "redo-04-precta-roof-rejected.png"), fullPage: true });
  fs.writeFileSync(path.join(OUT_INS, "analyze", "redo-state.json"), JSON.stringify(insState, null, 2));

  // ===========================
  // 4. Moving: verify article fix + SEO-hide + trust banner
  // ===========================
  console.log("=== MOVING: re-test inline-guard fixes ===");
  const OUT_MOV = path.resolve(__dirname, "..", "output", "audits", "moving-2026-04-30");
  fs.mkdirSync(path.join(OUT_MOV, "analyze"), { recursive: true });
  // Test HVAC fixture (vowel-start, was "looks like a HVAC" - should now be "an HVAC")
  await gotoSafe(page, "https://woogoro.com/moving-quote-analyzer.html");
  await page.waitForSelector('input[type=file]', { timeout: 30000 });
  await $w(2000);
  const movInput = await page.$('input[type=file]');
  if (!movInput) { console.log("MOV: no file input"); await browser.close(); return; }
  const FIX_HVAC = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "hvac-coil-quote.jpeg");
  await movInput.uploadFile(FIX_HVAC);
  try {
    await page.waitForFunction(() => {
      return Array.from(document.querySelectorAll("h1")).some(h => /This is not/i.test(h.innerText));
    }, { timeout: 75000 });
  } catch (e) {
    console.log("MOV: timed out waiting for reject H1");
  }
  await $w(2000);
  const movState = await page.evaluate(() => {
    const banner = Array.from(document.querySelectorAll("div")).find(el => /No email.*No phone.*No signup.*never sell/i.test(el.innerText || ""));
    const bannerVisible = banner ? (banner.offsetParent !== null && banner.offsetHeight > 0) : false;
    const h = Array.from(document.querySelectorAll("h1")).find(el => /This is not/i.test(el.innerText));
    const bodyP = Array.from(document.querySelectorAll("p")).find(el => /document you uploaded looks like/i.test(el.innerText));
    const seoVisible = Array.from(document.querySelectorAll("h2")).filter(h => /What to look for|Red flags|Common hidden/i.test(h.innerText)).map(h => h.offsetParent !== null);
    return {
      h1: h ? h.innerText : "(none)",
      bodyText: bodyP ? bodyP.innerText : "(none)",
      trustBannerVisible: bannerVisible,
      bannerText: banner ? banner.innerText.replace(/\s+/g, " ").trim().slice(0, 100) : "(none)",
      seoVisibleArr: seoVisible,
      seoAnyVisible: seoVisible.some(v => v === true)
    };
  });
  console.log("MOV state:", JSON.stringify(movState, null, 2));
  await page.screenshot({ path: path.join(OUT_MOV, "analyze", "redo-04-precta-hvac-rejected.png"), fullPage: true });
  fs.writeFileSync(path.join(OUT_MOV, "analyze", "redo-state.json"), JSON.stringify(movState, null, 2));

  // ===========================
  // 3. Kitchen: verify trust banner visible post-fix on analyzer
  // ===========================
  console.log("=== KITCHEN: re-test trust banner state on analyzer ===");
  await gotoSafe(page, "https://woogoro.com/kitchen-quote-analyzer.html");
  await page.waitForSelector('input[type=file]', { timeout: 30000 });
  await $w(2000);
  const kitInput = await page.$('input[type=file]');
  if (!kitInput) { console.log("KIT: no file input"); await browser.close(); return; }
  await kitInput.uploadFile(FIX_ROOF);
  try {
    await page.waitForFunction(() => {
      return Array.from(document.querySelectorAll("h1")).some(h => /This is not/i.test(h.innerText));
    }, { timeout: 75000 });
  } catch (e) {
    console.log("KIT: timed out waiting for reject H1");
  }
  await $w(2000);
  const kitState = await page.evaluate(() => {
    const banner = Array.from(document.querySelectorAll("div")).find(el => /No email.*No phone.*No signup.*never sell/i.test(el.innerText || ""));
    const bannerVisible = banner ? (banner.offsetParent !== null && banner.offsetHeight > 0) : false;
    const h = Array.from(document.querySelectorAll("h1")).find(el => /This is not/i.test(el.innerText));
    return {
      h1: h ? h.innerText : "(none)",
      trustBannerVisible: bannerVisible,
      bannerText: banner ? banner.innerText.replace(/\s+/g, " ").trim().slice(0, 100) : "(none)"
    };
  });
  console.log("KIT state:", JSON.stringify(kitState, null, 2));
  await page.screenshot({ path: path.join(OUT_KIT, "analyze", "redo-04-precta-roof-rejected.png"), fullPage: true });
  fs.writeFileSync(path.join(OUT_KIT, "analyze", "redo-state.json"), JSON.stringify(kitState, null, 2));

  await browser.close();
  console.log("=== DONE ===");
})();
