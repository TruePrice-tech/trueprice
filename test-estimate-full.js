// Full estimate path test: click through every step like a real user
const puppeteer = require("puppeteer");

const BASE = "https://truepricehq.com";
function pause(ms) { return new Promise(r => setTimeout(r, ms)); }

async function clickOption(page, val) {
  return page.evaluate(v => {
    var el = document.querySelector('[data-val="' + v + '"]');
    if (el && el.offsetParent) { el.click(); return true; }
    return false;
  }, val);
}

async function clickAnyOption(page) {
  return page.evaluate(() => {
    var opts = document.querySelectorAll('[data-val]');
    for (var o of opts) { if (o.offsetParent && !o.classList.contains('selected')) { o.click(); return o.getAttribute('data-val'); } }
    return null;
  });
}

async function clickButton(page, pattern) {
  return page.evaluate(p => {
    var re = new RegExp(p, 'i');
    var btns = document.querySelectorAll('button, a.btn, [role=button]');
    for (var b of btns) { if (b.offsetParent && re.test(b.innerText)) { b.click(); return b.innerText.trim().slice(0,30); } }
    return null;
  }, pattern);
}

async function hasResult(page) {
  return page.evaluate(() => {
    var b = document.body.innerText;
    return /estimated cost|your.*estimate|verdict|expected range|benchmark/i.test(b) && /\$[\d,]+/.test(b);
  });
}

async function getResult(page) {
  return page.evaluate(() => {
    var b = document.body.innerText;
    var prices = (b.match(/\$[\d,]+(?:\.\d{2})?/g) || [])
      .map(p => parseFloat(p.replace(/[$,]/g, '')))
      .filter(v => v >= 100 && v <= 200000);
    var hasVerdict = /fair|overpriced|below|above|good deal/i.test(b);
    return { prices: prices.slice(0, 5), hasVerdict, snippet: b.slice(0, 300) };
  });
}

const VERTICALS = [
  {
    label: "Plumbing", url: "/plumbing-quote-analyzer.html",
    estimateLink: /free estimate/i, submitBtn: "btnEstimate",
    state: "NC", zip: "28202",
    options: ["water_heater", "tank_50_gas", "garage", "asap"]
  },
  {
    label: "Roofing", url: "/roofing-quote-analyzer.html",
    estimateLink: /get my estimate|free estimate/i, submitBtn: null,
    state: "TX", zip: "75201",
    options: [] // roofing uses analyzer-ui, different flow
  },
  {
    label: "HVAC", url: "/hvac-quote-analyzer.html",
    estimateLink: /free estimate/i, submitBtn: "btnEstimate",
    state: "FL", zip: "33101",
    options: ["ac_replacement", "central_split", "2000_plus", "asap"]
  },
  {
    label: "Electrical", url: "/electrical-quote-analyzer.html",
    estimateLink: /free estimate/i, submitBtn: "btnEstimate",
    state: "CA", zip: "90001",
    options: ["panel_upgrade", "2000_plus", "asap"]
  },
  {
    label: "Auto", url: "/auto-repair.html",
    estimateLink: null, submitBtn: null,
    state: null, zip: null,
    options: [] // auto may not have estimate path
  },
  {
    label: "Medical", url: "/medical-bill-analyzer.html",
    estimateLink: null, submitBtn: null,
    state: null, zip: null,
    options: []
  },
  {
    label: "Legal", url: "/legal-fee-analyzer.html",
    estimateLink: null, submitBtn: null,
    state: null, zip: null,
    options: []
  },
  {
    label: "Moving", url: "/moving-quote-analyzer.html",
    estimateLink: /free estimate/i, submitBtn: null,
    state: null, zip: null,
    options: ["local"]
  },
  {
    label: "Solar", url: "/solar-quote-analyzer.html",
    estimateLink: /free estimate/i, submitBtn: "btnEstimate",
    state: "AZ", zip: "85001",
    options: ["residential", "asap"]
  },
  {
    label: "Painting", url: "/painting-quote-analyzer.html",
    estimateLink: /free estimate/i, submitBtn: "btnEstimate",
    state: "TN", zip: "37201",
    options: ["interior", "1500_2500", "asap"]
  },
];

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"], timeout: 60000 });

  console.log("=".repeat(80));
  console.log("ESTIMATE PATH: Full click-through as real user");
  console.log("=".repeat(80));

  let pass = 0, fail = 0;
  const issues = [];

  for (const v of VERTICALS) {
    console.log("\n--- " + v.label + " ---");
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    const jsErrors = [];
    page.on("pageerror", e => jsErrors.push(e.message.slice(0, 100)));

    try {
      await page.goto(BASE + v.url, { waitUntil: "networkidle2", timeout: 15000 });
      await pause(1500);

      // Click estimate link if exists
      if (v.estimateLink) {
        await page.evaluate(pattern => {
          var re = new RegExp(pattern, 'i');
          document.querySelectorAll('a, span, div, button').forEach(el => {
            if (re.test(el.innerText) && el.offsetParent) el.click();
          });
        }, v.estimateLink.source);
        await pause(1500);
        console.log("  1. Clicked estimate link");
      } else {
        console.log("  1. No estimate path (upload-only vertical)");
        if (v.label === "Auto" || v.label === "Medical" || v.label === "Legal") {
          console.log("  SKIP: " + v.label + " is upload-only, no estimate calculator");
          await page.close();
          continue;
        }
      }

      // Fill state/zip if needed
      if (v.state) {
        await page.type("#addrState", v.state).catch(() => {});
        if (v.zip) await page.type("#addrZip", v.zip).catch(() => {});
        console.log("  2. Filled address: " + v.state + " " + (v.zip || ""));
      }

      // Click submit button
      if (v.submitBtn) {
        await page.click("#" + v.submitBtn).catch(() => {});
        await pause(2000);
        console.log("  3. Clicked submit");
      }

      // Click through options
      let step = 4;
      for (const opt of v.options) {
        var clicked = await clickOption(page, opt);
        if (clicked) {
          console.log("  " + step + ". Selected: " + opt);
        } else {
          // Try clicking any available option
          var anyOpt = await clickAnyOption(page);
          if (anyOpt) console.log("  " + step + ". Selected (fallback): " + anyOpt);
          else console.log("  " + step + ". No option '" + opt + "' found");
        }
        await pause(1500);
        step++;

        // Check if result appeared
        if (await hasResult(page)) break;
      }

      // If no result yet, keep clicking options
      if (!await hasResult(page)) {
        for (var extra = 0; extra < 5; extra++) {
          var anyOpt = await clickAnyOption(page);
          if (!anyOpt) {
            // Try clicking a button
            var btn = await clickButton(page, "next|continue|calculate|estimate|see|get");
            if (!btn) break;
            console.log("  " + step + ". Clicked button: " + btn);
          } else {
            console.log("  " + step + ". Selected: " + anyOpt);
          }
          await pause(1500);
          step++;
          if (await hasResult(page)) break;
        }
      }

      // Report result
      if (await hasResult(page)) {
        var result = await getResult(page);
        console.log("  RESULT: " + result.prices.map(p => "$" + p.toLocaleString()).join(", "));
        if (result.prices.length === 0) {
          issues.push(v.label + ": result screen but no prices");
          fail++;
        } else {
          pass++;
        }
      } else {
        var body = await page.evaluate(() => document.body.innerText.slice(0, 200));
        console.log("  NO RESULT. Screen: " + body.replace(/\n/g, " | ").slice(0, 150));
        issues.push(v.label + ": estimate did not produce a result");
        fail++;
      }

      // JS errors
      if (jsErrors.length) {
        console.log("  JS ERRORS: " + jsErrors.join("; "));
        issues.push(v.label + ": " + jsErrors.length + " JS errors");
      }

    } catch (e) {
      console.log("  ERROR: " + e.message.slice(0, 80));
      issues.push(v.label + ": " + e.message.slice(0, 60));
      fail++;
    }

    await page.close();
  }

  console.log("\n" + "=".repeat(80));
  console.log("ESTIMATE RESULTS: " + pass + " passed, " + fail + " failed");
  if (issues.length) {
    console.log("\nISSUES:");
    issues.forEach(i => console.log("  - " + i));
  }
  await browser.close();
})();
