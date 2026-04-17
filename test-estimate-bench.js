const puppeteer = require("puppeteer");

const TESTS = [
  { name: "Plumbing: WH, NC", url: "/plumbing-estimate.html", state: "NC", realRange: [1800, 3500] },
  { name: "HVAC: AC, FL", url: "/hvac-estimate.html", state: "FL", realRange: [5500, 12000] },
  { name: "Electrical: Panel, CA", url: "/electrical-estimate.html", state: "CA", realRange: [2500, 5000] },
  { name: "Fencing: Fence, MO", url: "/fencing-estimate.html", state: "MO", realRange: [2000, 9000] },
  { name: "Concrete: Driveway, IN", url: "/concrete-estimate.html", state: "IN", realRange: [2000, 12000] },
];

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  console.log("=== ESTIMATE ACCURACY BENCHMARK ===\n");
  let pass = 0;

  for (const t of TESTS) {
    const p = await browser.newPage();
    await p.goto("https://woogoro.com" + t.url, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise(r => setTimeout(r, 1500));

    // Already on estimate page via URL
    await p.type("#addrState", t.state).catch(() => {});
    await p.click("#btnEstimate").catch(() => {});
    await new Promise(r => setTimeout(r, 2000));

    // Click through steps
    for (let step = 0; step < 8; step++) {
      const done = await p.evaluate(() => document.body.innerText.indexOf("ESTIMATED COST") !== -1);
      if (done) { console.log("  Step " + step + ": RESULT FOUND"); break; }
      const q = await p.evaluate(() => { const h = document.querySelector("h3"); return h && h.offsetParent ? h.innerText : "no h3"; });
      console.log("  Step " + step + ": " + q);

      const filled = await p.evaluate(() => {
        const inp = document.getElementById("sqftInput");
        if (inp && inp.offsetParent) { inp.value = "2000"; return true; }
        return false;
      });
      if (filled) {
        await p.click("#sqftNext").catch(() => {});
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }

      const clicked = await p.evaluate(() => {
        for (const o of document.querySelectorAll("[data-val]")) {
          if (o.offsetParent) { o.click(); return true; }
        }
        return false;
      });
      if (!clicked) break;
      await new Promise(r => setTimeout(r, 1500));
    }

    await new Promise(r => setTimeout(r, 2000));

    // Extract price - find the big dollar amount after "ESTIMATED COST"
    const estimate = await p.evaluate(() => {
      const text = document.body.innerText;
      const idx = text.indexOf("ESTIMATED COST");
      if (idx === -1) return null;
      const chunk = text.substring(idx, idx + 60);
      const match = chunk.match(/\$([\d,]+)/);
      return match ? parseFloat(match[1].replace(/,/g, "")) : null;
    });

    const inRange = estimate && estimate >= t.realRange[0] && estimate <= t.realRange[1];
    if (inRange) pass++;

    console.log(t.name);
    console.log("  Woogoro: " + (estimate ? "$" + estimate.toLocaleString() : "NONE"));
    console.log("  Real:      $" + t.realRange[0].toLocaleString() + " - $" + t.realRange[1].toLocaleString());
    console.log("  " + (inRange ? "IN RANGE" : estimate ? "OUT OF RANGE" : "FAILED") + "\n");
    await p.close();
  }

  console.log("ESTIMATE ACCURACY: " + pass + "/5 (" + Math.round(100 * pass / 5) + "%)");
  await browser.close();
})();
