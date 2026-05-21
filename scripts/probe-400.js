const puppeteer = require("puppeteer");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (req.url().includes("/api/geocode-suggest")) {
      req.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ suggestions: [] }) });
    } else { req.continue(); }
  });
  page.on("response", async (resp) => {
    const url = resp.url();
    const status = resp.status();
    if (url.includes("/api/") && status >= 400) {
      let body = "";
      try { body = (await resp.text()).substring(0, 200); } catch (e) {}
      console.log("[" + status + "]", url.replace(/^https?:\/\/[^/]+/, ""), "BODY:", body);
    }
  });
  await page.goto("https://woogoro.com/roofing-quote-analyzer.html?mode=estimator", { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(2500);
  await page.evaluate(() => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) { el.value = v; el.dispatchEvent(new Event("input", {bubbles: true})); el.dispatchEvent(new Event("change", {bubbles: true})); } };
    set("journeyStreetAddress", "17064 Laurelmont Ct"); set("journeyCity", "Fort Mill"); set("journeyState", "SC"); set("journeyZipCode", "29707");
  });
  await sleep(500);
  await page.evaluate(() => { const btns = Array.from(document.querySelectorAll("button")); const t = btns.find(b => /get my estimate/i.test((b.textContent || "").trim())); if (t) t.click(); });
  await sleep(3500);
  await page.evaluate(() => {
    const ans = { workType: "replacement", season: "fall", propertyType: "two_story", material: "architectural", steepness: "normal", complexity: "complex", insurance: "no", ownership: "yes" };
    Object.entries(ans).forEach(([g, v]) => { const c = document.querySelector(`button.est-option[data-group="${g}"][data-value="${v}"]`); if (c) c.click(); });
    const sz = document.getElementById("estHomeSize"); if (sz) { sz.value = "3200"; sz.dispatchEvent(new Event("input", {bubbles: true})); }
  });
  await sleep(700);
  await page.evaluate(() => { const btn = document.getElementById("estSubmitBtn"); if (btn) btn.click(); });
  await sleep(8000);
  await browser.close();
})().catch(e => { console.error("FATAL:", e); process.exit(1); });
