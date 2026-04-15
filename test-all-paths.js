const puppeteer = require("puppeteer");

const VERTICALS = [
  { name: "hvac", estimate: "/hvac-estimate.html", analyzer: "/hvac-quote-analyzer.html", compare: "/compare-hvac-quotes.html" },
  { name: "plumbing", estimate: "/plumbing-estimate.html", analyzer: "/plumbing-quote-analyzer.html", compare: "/compare-plumbing-quotes.html" },
  { name: "electrical", estimate: "/electrical-estimate.html", analyzer: "/electrical-quote-analyzer.html", compare: "/compare-electrical-quotes.html" },
  { name: "roofing", estimate: "/photo-estimate.html", analyzer: "/roofing-quote-analyzer.html", compare: "/compare-roofing-quotes.html" },
  { name: "solar", estimate: "/solar-estimate.html", analyzer: "/solar-quote-analyzer.html", compare: "/compare-solar-quotes.html" },
  { name: "fencing", estimate: "/fencing-estimate.html", analyzer: "/fencing-quote-analyzer.html", compare: "/compare-fencing-quotes.html" },
  { name: "concrete", estimate: "/concrete-estimate.html", analyzer: "/concrete-quote-analyzer.html", compare: "/compare-concrete-quotes.html" },
  { name: "foundation", estimate: "/foundation-estimate.html", analyzer: "/foundation-quote-analyzer.html", compare: "/compare-foundation-quotes.html" },
  { name: "garage-door", estimate: "/garage-door-estimate.html", analyzer: "/garage-door-quote-analyzer.html", compare: "/compare-garage-door-quotes.html" },
  { name: "gutters", estimate: "/gutters-estimate.html", analyzer: "/gutters-quote-analyzer.html", compare: "/compare-gutters-quotes.html" },
  { name: "insulation", estimate: "/insulation-estimate.html", analyzer: "/insulation-quote-analyzer.html", compare: "/compare-insulation-quotes.html" },
  { name: "kitchen", estimate: "/kitchen-estimate.html", analyzer: "/kitchen-quote-analyzer.html", compare: "/compare-kitchen-quotes.html" },
  { name: "landscaping", estimate: "/landscaping-estimate.html", analyzer: "/landscaping-quote-analyzer.html", compare: "/compare-landscaping-quotes.html" },
  { name: "painting", estimate: "/painting-estimate.html", analyzer: "/painting-quote-analyzer.html", compare: "/compare-painting-quotes.html" },
  { name: "siding", estimate: "/siding-estimate.html", analyzer: "/siding-quote-analyzer.html", compare: "/compare-siding-quotes.html" },
  { name: "windows", estimate: "/window-estimate.html", analyzer: "/window-quote-analyzer.html", compare: "/compare-windows-quotes.html" },
  { name: "auto", estimate: "/auto-estimate.html", analyzer: "/auto-repair.html", compare: "/compare-auto-quotes.html" },
  { name: "moving", estimate: "/moving-estimate.html", analyzer: "/moving-quote-analyzer.html", compare: "/compare-moving-quotes.html" },
  { name: "medical", estimate: "/medical-estimate.html", analyzer: "/medical-bill-analyzer.html", compare: "/compare-medical-quotes.html" },
  { name: "legal", estimate: "/legal-estimate.html", analyzer: "/legal-fee-analyzer.html", compare: "/compare-legal-quotes.html" },
];

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();

  function pad(s, n) { return (s + " ".repeat(n)).slice(0, n); }

  console.log(pad("VERTICAL", 14) + pad("ESTIMATE", 30) + pad("ANALYZER", 30) + "COMPARE");
  console.log("-".repeat(104));

  for (const v of VERTICALS) {
    const results = {};

    for (const [pathType, url] of [["estimate", v.estimate], ["analyzer", v.analyzer], ["compare", v.compare]]) {
      if (!url) { results[pathType] = "NO PAGE"; continue; }

      const errors = [];
      const errorHandler = e => errors.push(e.message.slice(0, 60));
      page.on("pageerror", errorHandler);

      try {
        await page.goto("https://truepricehq.com" + url, { waitUntil: "networkidle2", timeout: 15000 });

        const checks = await page.evaluate(() => {
          const body = document.body.innerText || "";
          const hasFileInput = !!document.querySelector("input[type='file']");
          const hasAddressInput = !!document.querySelector("input[placeholder*='address'], input[placeholder*='Start typing'], input[placeholder*='Street']");
          const hasEstimateBtn = !!document.querySelector("button");
          const is404 = body.includes("404") && body.length < 500;
          return { hasFileInput, hasAddressInput, hasEstimateBtn, is404, bodyLen: body.length };
        });

        if (checks.is404) {
          results[pathType] = "404";
        } else if (errors.length > 0) {
          results[pathType] = "JS ERR: " + errors[0].slice(0, 20);
        } else if (pathType === "estimate" && !checks.hasAddressInput && !checks.hasEstimateBtn) {
          results[pathType] = "NO ADDR INPUT";
        } else if (pathType === "analyzer" && !checks.hasFileInput && checks.bodyLen < 500) {
          results[pathType] = "NO FILE INPUT";
        } else if (pathType === "compare" && !checks.hasFileInput) {
          results[pathType] = "NO FILE INPUT";
        } else {
          results[pathType] = "OK";
        }
      } catch (e) {
        results[pathType] = "LOAD FAIL";
      }

      page.removeAllListeners("pageerror");
    }

    console.log(
      pad(v.name, 14) +
      pad(results.estimate || "?", 30) +
      pad(results.analyzer || "?", 30) +
      (results.compare || "?")
    );
  }

  await browser.close();
})();
