// Medical coverage walk — exercises the post-result CTAs that the prior
// 2026-04-28 walk covered (Save PDF / Share link / Notify-me / Share-
// anonymously / Thumbs feedback) on the now-current bill-analyzer.
//
// Uses the smallest fixture (f1 Valley Diagnostic, $1,225 CT bill) to
// minimize API cost and time-to-result.

const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const BASE = "https://woogoro.com";
const FIXTURES_DIR = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = "C:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice/output/medical-coverage-walk-2026-05-02";
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const findings = [];
  const log = m => { console.log(m); findings.push(m); };

  // ── Single bill-analyzer session, walk every post-result CTA ──
  const page = await browser.newPage();
  page.setDefaultTimeout(180000);
  await page.setViewport({ width: 1440, height: 900 });

  page.on("dialog", async d => { log("  [dialog] " + d.message()); await d.accept(); });
  page.on("console", msg => {
    if (msg.type() === "error" || msg.type() === "warning") {
      log("  [console " + msg.type() + "] " + msg.text().slice(0, 200));
    }
  });

  await page.goto(BASE + "/medical-bill-analyzer.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 1500));

  const inp = await page.$("#fileInput");
  await inp.uploadFile(path.join(FIXTURES_DIR, "test-quotes/medical-images/comparison-ct-01-low.png"));
  log("uploaded f1 (Valley Diagnostic CT $1,225)");

  await page.waitForFunction(() => {
    const txt = document.body.innerText || "";
    return !!document.querySelector(".mb-verdict") ||
           /could not read this bill clearly/i.test(txt) ||
           /something went wrong/i.test(txt);
  }, { timeout: 180000 }).catch(() => null);
  await new Promise(r => setTimeout(r, 1500));

  const verdict = await page.evaluate(() => ({
    hasVerdict: !!document.querySelector(".mb-verdict"),
    label: (document.querySelector(".verdict-label") || {}).innerText || "",
    title: (document.querySelector(".verdict-title") || {}).innerText || "",
  }));
  log("verdict rendered: " + JSON.stringify(verdict));

  if (!verdict.hasVerdict) {
    log("  [SKIP] no verdict — coverage walk needs a successful analyze");
    await page.screenshot({ path: path.join(OUT, "0-no-verdict.png"), fullPage: true });
    await page.close();
    await browser.close();
    fs.writeFileSync(path.join(OUT, "FINDINGS.txt"), findings.join("\n"));
    return;
  }

  await page.screenshot({ path: path.join(OUT, "1-result-rendered.png"), fullPage: true });

  // ── Inventory all post-result CTAs ──
  const ctas = await page.evaluate(() => {
    const items = [];
    const buttons = document.querySelectorAll("button, a, .tp-share-btn, [onclick]");
    buttons.forEach(b => {
      const t = (b.innerText || b.value || "").trim();
      const onclick = b.getAttribute("onclick") || "";
      const id = b.id || "";
      const cls = b.className || "";
      if (!t && !onclick) return;
      // Filter to post-result CTAs (not nav/footer/upload buttons)
      if (/save|share|email|notify|feedback|thumb|print|copy|pdf|\bdownload\b/i.test(t + " " + cls + " " + id + " " + onclick)) {
        items.push({ tag: b.tagName, text: t.slice(0, 60), id, cls: cls.slice(0, 80), onclick: onclick.slice(0, 100) });
      }
    });
    return items;
  });
  log("\npost-result CTAs found (" + ctas.length + "):");
  ctas.forEach(c => log("  - <" + c.tag + " id=" + JSON.stringify(c.id) + " cls=" + JSON.stringify(c.cls) + "> '" + c.text + "' onclick=" + JSON.stringify(c.onclick)));

  // ── Save PDF / print ──
  log("\n--- Save PDF / print ---");
  const printBtn = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll("button, a"));
    return btns.find(b => /save\s*(as\s*)?pdf|print|download/i.test(b.innerText || ""));
  });
  if (printBtn && await printBtn.evaluate(el => !!el)) {
    log("  Save PDF button found — emulating print");
    await page.emulateMediaType("print");
    const pdf = await page.pdf({ format: "Letter" });
    fs.writeFileSync(path.join(OUT, "2-saved.pdf"), pdf);
    log("  PDF written, size: " + pdf.length + " bytes");
    await page.emulateMediaType("screen");
  } else {
    log("  [BUG] no Save PDF / print / download button on result page");
  }

  // ── Share link ──
  log("\n--- Share link ---");
  const shareInfo = await page.evaluate(async () => {
    const btn = Array.from(document.querySelectorAll("button, a, .tp-share-btn")).find(b =>
      /share\s*link/i.test(b.innerText || b.title || "") ||
      /share/i.test(b.className || "")
    );
    if (!btn) return { found: false };
    let captured = null;
    const origShare = navigator.share;
    const origWriteText = navigator.clipboard ? navigator.clipboard.writeText : null;
    navigator.share = async d => { captured = { type: "share", data: d }; return; };
    if (navigator.clipboard) {
      navigator.clipboard.writeText = async t => { captured = captured || { type: "clipboard", data: t }; return; };
    }
    btn.click();
    await new Promise(r => setTimeout(r, 800));
    navigator.share = origShare;
    if (navigator.clipboard && origWriteText) navigator.clipboard.writeText = origWriteText;
    return { found: true, captured };
  });
  log("  share captured: " + JSON.stringify(shareInfo).slice(0, 300));
  if (!shareInfo.found) log("  [BUG] no Share link button on result page");

  // ── Notify me email ──
  log("\n--- Notify me ---");
  const notifyState = await page.evaluate(async () => {
    const inputs = Array.from(document.querySelectorAll("input[type=email], input[placeholder*=email i]"));
    if (!inputs.length) return { found: false };
    const inp = inputs[0];
    inp.value = "deep-test+medical@woogoro.com";
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    inp.dispatchEvent(new Event("change", { bubbles: true }));
    // Find the nearest submit / notify button
    const btn = Array.from(document.querySelectorAll("button")).find(b =>
      /notify|sign\s*up|subscribe|join/i.test(b.innerText || "")
    );
    if (!btn) return { found: true, btnFound: false };
    btn.click();
    await new Promise(r => setTimeout(r, 1500));
    const txt = document.body.innerText;
    return {
      found: true,
      btnFound: true,
      onListConfirm: /you[’']re on the list|added to|we[’']ll email you|signed up|thanks/i.test(txt),
      bodyAfterClick: txt.slice(txt.indexOf("Notify"), txt.indexOf("Notify") + 600)
    };
  });
  log("  notify state: " + JSON.stringify(notifyState).slice(0, 400));
  if (notifyState.found && notifyState.btnFound && !notifyState.onListConfirm) log("  [POTENTIAL BUG] Notify-me click did not surface confirmation copy");

  // ── Share anonymously ──
  log("\n--- Share anonymously ---");
  const anonState = await page.evaluate(async () => {
    const btn = Array.from(document.querySelectorAll("button")).find(b =>
      /share\s*anonymously/i.test(b.innerText || "")
    );
    if (!btn) return { found: false };
    // Pre-fill any city/state inputs near it (mirrors the Reddit-anon flow)
    const cityInputs = Array.from(document.querySelectorAll("input")).filter(i =>
      /city/i.test(i.placeholder || i.name || "")
    );
    const stateInputs = Array.from(document.querySelectorAll("input, select")).filter(i =>
      /state/i.test(i.placeholder || i.name || "")
    );
    if (cityInputs[0]) { cityInputs[0].value = "Phoenix"; cityInputs[0].dispatchEvent(new Event("input", { bubbles: true })); }
    if (stateInputs[0]) { stateInputs[0].value = "AZ"; stateInputs[0].dispatchEvent(new Event("change", { bubbles: true })); }
    btn.click();
    await new Promise(r => setTimeout(r, 2000));
    const txt = document.body.innerText;
    return {
      found: true,
      success: /thanks|shared|on the list|received|added/i.test(txt),
      rateLimitHit: /too many|rate limit|try again/i.test(txt),
      bodyAfter: txt.slice(0, 800),
    };
  });
  log("  anon state: " + JSON.stringify(anonState).slice(0, 400));
  if (anonState.found && !anonState.success && !anonState.rateLimitHit) log("  [POTENTIAL BUG] Share-anonymously click produced no confirmation");

  // ── Thumbs up/down feedback ──
  log("\n--- Thumbs feedback ---");
  const fbState = await page.evaluate(async () => {
    const thumbs = Array.from(document.querySelectorAll("[onclick*=submitFeedback], button")).filter(b =>
      /👍|👎|thumb|helpful/i.test(b.innerText || b.getAttribute("onclick") || "")
    );
    if (!thumbs.length) return { found: false };
    thumbs[0].click();
    await new Promise(r => setTimeout(r, 800));
    const fb = document.getElementById("estimateFeedback");
    return { found: true, ack: fb ? fb.innerText.slice(0, 200) : "" };
  });
  log("  thumbs: " + JSON.stringify(fbState));
  if (fbState.found && !fbState.ack) log("  [POTENTIAL BUG] Thumbs feedback clicked without ack copy");

  await page.screenshot({ path: path.join(OUT, "3-after-all-ctas.png"), fullPage: true });
  await page.close();
  await browser.close();
  fs.writeFileSync(path.join(OUT, "FINDINGS.txt"), findings.join("\n"));
  console.log("\n=== Coverage walk complete ===");
  console.log("Bugs found: " + findings.filter(f => /\[BUG\]|\[POTENTIAL BUG\]/.test(f)).length);
  console.log("Output: " + OUT);
})();
