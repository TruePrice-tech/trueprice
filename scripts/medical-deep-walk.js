// Medical deep walk — exercises the 3 non-rate-limited surfaces:
//   1. medical-cost-lookup.html — type queries, verify SYNONYMS coverage
//   2. medical-cost-guide.html  — read every section, check for broken/stale copy
//   3. compare-medical-quotes.html — upload 2 fixtures, click compare, verify
//      no 100x parsing bug (prior memo flagged this on CT compare set)
//
// Also exercises mobile (390x844) on the bill-analyzer landing page (no
// upload — just verifies layout) and wrong-vertical hard-reject.

const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const BASE = "https://woogoro.com";
const FIXTURES_DIR = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = "C:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice/output/medical-deep-walk-2026-05-02";

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const findings = [];
  const log = m => { console.log(m); findings.push(m); };

  // ── Walk 1: medical-cost-lookup.html ──
  log("=== WALK 1: medical-cost-lookup.html ===");
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + "/medical-cost-lookup.html", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 1500));

    // Test queries — common lay-person searches that should hit SYNONYMS
    const queries = [
      "broken arm",
      "ct scan",        // synonym → "ct "
      "mri",
      "blood test",
      "uti",
      "appendix",       // synonym → appendectomy
      "knee replacement",
      "c-section",
      "broken collarbone",  // NO synonym — see if exact-match works
      "vasectomy",          // NO synonym — common procedure
      "mole removal",       // synonym "mole" → skin biopsy
      "ozempic",            // common drug query — likely no match
      "tooth extraction",   // synonym "tooth" → crown/root canal/extraction
    ];

    for (const q of queries) {
      // Find search input
      const inputSel = 'input[type="search"], input#searchInput, input[placeholder*="search" i], input[placeholder*="procedure" i]';
      const input = await page.$(inputSel);
      if (!input) {
        log(`  [BUG] cost-lookup: no search input found (selector: ${inputSel})`);
        break;
      }
      await page.evaluate(s => { const el = document.querySelector(s); if (el) el.value = ""; }, inputSel);
      await input.click({ clickCount: 3 });
      await input.type(q);
      await new Promise(r => setTimeout(r, 800));

      // Capture results: any visible row count + first row text
      const result = await page.evaluate((q3) => {
        const txt = document.body.innerText;
        const rows = document.querySelectorAll(".result-row, .lookup-row, tr.match, [data-procedure]");
        const noMatch = /no (results|matches)|nothing found|couldn[’']t find/i.test(txt);
        const idx = txt.indexOf(q3);
        return {
          rowCount: rows.length,
          noMatch,
          firstRow: rows[0] ? rows[0].innerText.slice(0, 200) : "",
          bodyTextSample: idx > 0 ? txt.slice(idx, idx + 600) : txt.slice(0, 600)
        };
      }, q.slice(0, 3));
      log(`  query="${q}" rows=${result.rowCount} noMatch=${result.noMatch}` + (result.firstRow ? `  first="${result.firstRow.replace(/\n/g, " | ").slice(0, 150)}"` : ""));
    }

    await page.screenshot({ path: path.join(OUT, "1-cost-lookup-final.png"), fullPage: true });
    await page.close();
  }

  // ── Walk 2: medical-cost-guide.html ──
  log("\n=== WALK 2: medical-cost-guide.html ===");
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + "/medical-cost-guide.html", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 1500));

    const guide = await page.evaluate(() => {
      const sections = document.querySelectorAll("h2, h3");
      const links = document.querySelectorAll("a[href]");
      const broken = [];
      links.forEach(a => {
        const h = a.getAttribute("href") || "";
        if (h.startsWith("javascript:") || h === "#") broken.push(h);
      });
      return {
        title: document.title,
        h1: (document.querySelector("h1") || {}).innerText || "",
        sectionCount: sections.length,
        sectionTitles: Array.from(sections).map(s => s.innerText.trim()).slice(0, 30),
        linkCount: links.length,
        brokenHrefs: broken,
        bodyLength: document.body.innerText.length,
        hasIris: /iris/i.test(document.body.innerText),
        hasWoogoro: /woogoro/i.test(document.body.innerText),
        h1HasIris: /iris/i.test((document.querySelector("h1") || {}).innerText || ""),
      };
    });
    log("  title: " + guide.title);
    log("  H1: " + guide.h1);
    log("  sections (" + guide.sectionCount + "): " + guide.sectionTitles.join(" | "));
    log("  links: " + guide.linkCount + ", broken (#/javascript): " + guide.brokenHrefs.length);
    log("  body chars: " + guide.bodyLength);
    log("  mentions Iris: " + guide.hasIris + " | Woogoro: " + guide.hasWoogoro);
    if (guide.hasIris) log("  [POTENTIAL BUG] Iris reference on medical page (Iris is rainbow-only; medical = Worker Woogoro)");
    if (guide.h1HasIris) log("  [BUG] H1 mentions Iris on medical page");

    await page.screenshot({ path: path.join(OUT, "2-cost-guide.png"), fullPage: true });
    await page.close();
  }

  // ── Walk 3: compare-medical-quotes.html (CT compare set) ──
  log("\n=== WALK 3: compare-medical-quotes.html ===");
  {
    const page = await browser.newPage();
    page.setDefaultTimeout(180000);
    await page.setViewport({ width: 1440, height: 900 });

    const apiResponses = [];
    page.on("response", async res => {
      if (res.url().includes("/api/medical-bill-estimate") || res.url().includes("/api/parse-quote")) {
        let body = "";
        try { body = await res.text(); } catch {}
        apiResponses.push({ url: res.url(), status: res.status(), bodyLen: body.length });
      }
    });

    await page.goto(BASE + "/compare-medical-quotes.html", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 2000));

    const f0 = await page.$("#file0");
    const f1 = await page.$("#file1");
    if (!f0 || !f1) {
      log("  [BUG] compare-medical-quotes: file0/file1 inputs not found");
    } else {
      // Upload f1 (low) + f3 (high) — biggest spread to surface scoring bugs
      await f0.uploadFile(path.join(FIXTURES_DIR, "test-quotes/medical-images/comparison-ct-01-low.png"));
      await new Promise(r => setTimeout(r, 1500));
      await f1.uploadFile(path.join(FIXTURES_DIR, "test-quotes/medical-images/comparison-ct-03-high.png"));
      await new Promise(r => setTimeout(r, 1500));

      // Wait for compare button to enable, then click
      await page.waitForFunction(() => {
        const btn = document.getElementById("compareBtn");
        return btn && !btn.disabled;
      }, { timeout: 90000 }).catch(() => null);

      const btnState = await page.evaluate(() => {
        const btn = document.getElementById("compareBtn");
        return { exists: !!btn, disabled: btn ? btn.disabled : null, text: btn ? btn.innerText : null };
      });
      log("  compare button state: " + JSON.stringify(btnState));

      if (btnState.exists && !btnState.disabled) {
        await page.click("#compareBtn");
        // Wait for results render
        await page.waitForFunction(() => {
          const results = document.getElementById("resultsContent");
          return results && results.innerText.trim().length > 50;
        }, { timeout: 180000 }).catch(() => null);
        await new Promise(r => setTimeout(r, 2000));

        const cmp = await page.evaluate(() => {
          const r = document.getElementById("resultsContent");
          return {
            text: r ? r.innerText : "",
            html: r ? r.innerHTML.slice(0, 3000) : "",
          };
        });
        log("  compare result text (first 1500): " + cmp.text.slice(0, 1500).replace(/\n/g, " | "));

        // Check for 100x bug: if any displayed price is in $100,000+ range when fixtures are $1,225 and $5,930
        const matches = cmp.text.match(/\$[\d,]+/g) || [];
        const tooHigh = matches.filter(m => {
          const n = parseInt(m.replace(/[$,]/g, ""), 10);
          return n > 50000;  // any displayed price > $50K is suspect for these fixtures
        });
        if (tooHigh.length) log("  [POTENTIAL BUG] compare displays unexpectedly high prices: " + tooHigh.join(", "));
      }

      log("  apiResponses: " + apiResponses.map(r => `${r.url.split("/").pop()}=${r.status}`).join(", "));
    }

    await page.screenshot({ path: path.join(OUT, "3-compare-medical.png"), fullPage: true });
    await page.close();
  }

  // ── Walk 4: mobile (390x844) bill-analyzer landing ──
  log("\n=== WALK 4: mobile bill-analyzer landing ===");
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(BASE + "/medical-bill-analyzer.html", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 1500));

    const m = await page.evaluate(() => {
      const upload = document.getElementById("uploadZone");
      const heroImg = document.querySelector(".mb-hero picture img, .mb-hero img");
      return {
        title: document.title,
        h1: (document.querySelector("h1") || {}).innerText || "",
        uploadZoneVisible: !!upload && upload.offsetWidth > 0,
        heroImgWidth: heroImg ? heroImg.offsetWidth : null,
        heroImgHeight: heroImg ? heroImg.offsetHeight : null,
        heroOverflows: heroImg ? heroImg.offsetWidth > 390 : false,
        bodyScrollWidth: document.body.scrollWidth,
        viewportWidth: window.innerWidth,
        horizontalScroll: document.body.scrollWidth > window.innerWidth,
      };
    });
    log("  H1: " + m.h1);
    log("  upload zone visible: " + m.uploadZoneVisible);
    log("  hero img: " + m.heroImgWidth + "x" + m.heroImgHeight + " (overflows 390: " + m.heroOverflows + ")");
    log("  body scrollWidth=" + m.bodyScrollWidth + " viewport=" + m.viewportWidth + " (horizontal scroll: " + m.horizontalScroll + ")");
    if (m.horizontalScroll) log("  [BUG] Mobile page has horizontal scroll — layout overflow");

    await page.screenshot({ path: path.join(OUT, "4-mobile-bill-analyzer.png"), fullPage: true });
    await page.close();
  }

  // ── Walk 5: wrong-vertical hard-reject (upload roofing fixture to medical) ──
  log("\n=== WALK 5: wrong-vertical hard-reject ===");
  {
    const page = await browser.newPage();
    page.setDefaultTimeout(120000);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + "/medical-bill-analyzer.html", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 2000));

    const inp = await page.$("#fileInput");
    if (!inp) {
      log("  [BUG] no fileInput on medical-bill-analyzer");
    } else {
      // Upload a roofing fixture
      await inp.uploadFile(path.join(FIXTURES_DIR, "test-quotes/roofing-images/comparison-roof-01-low.png"));

      // Wait for either: hard-reject UI | API fallback | error
      await page.waitForFunction(() => {
        const txt = document.body.innerText || "";
        return /not a medical (bill|quote)/i.test(txt) ||
               /this doesn[’']t look like a medical/i.test(txt) ||
               !!document.querySelector(".mb-verdict") ||
               /could not read this bill clearly/i.test(txt);
      }, { timeout: 120000 }).catch(() => null);

      await new Promise(r => setTimeout(r, 1000));

      const reject = await page.evaluate(() => {
        const txt = document.body.innerText;
        const isHardReject = /not a medical (bill|quote)/i.test(txt) ||
                             /this doesn[’']t look like a medical/i.test(txt);
        const hasVerdict = !!document.querySelector(".mb-verdict");
        const isUnreadable = /could not read this bill clearly/i.test(txt);
        // Capture the rejection or whatever rendered
        const h1 = (document.querySelector("h1") || {}).innerText || "";
        return { isHardReject, hasVerdict, isUnreadable, h1, sample: txt.slice(0, 600) };
      });
      log("  isHardReject: " + reject.isHardReject + " | hasVerdict: " + reject.hasVerdict + " | isUnreadable: " + reject.isUnreadable);
      log("  H1: " + reject.h1);
      if (!reject.isHardReject) log("  [BUG] Roofing fixture uploaded to medical analyzer did NOT trigger wrong-vertical hard-reject");
    }

    await page.screenshot({ path: path.join(OUT, "5-wrong-vertical-reject.png"), fullPage: true });
    await page.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, "FINDINGS.txt"), findings.join("\n"));
  console.log("\n\n=== Walk complete. Findings: " + findings.filter(f => f.includes("[BUG]") || f.includes("[POTENTIAL BUG]")).length + " ===");
  console.log("Screenshots + log: " + OUT);
})();
