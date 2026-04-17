#!/usr/bin/env node
// Pre-push smoke test: verifies all analyzer and compare pages load without JS errors.
// Run: node test-pre-push.js
// Exit code 0 = all clear, 1 = failures found
const puppeteer = require("puppeteer");

const BASE = "https://woogoro.com";

const PAGES = [
  "/plumbing-quote-analyzer.html",
  "/roofing-quote-analyzer.html",
  "/hvac-quote-analyzer.html",
  "/electrical-quote-analyzer.html",
  "/auto-repair.html",
  "/solar-quote-analyzer.html",
  "/moving-quote-analyzer.html",
  "/painting-quote-analyzer.html",
  "/fencing-quote-analyzer.html",
  "/concrete-quote-analyzer.html",
  "/foundation-quote-analyzer.html",
  "/gutters-quote-analyzer.html",
  "/insulation-quote-analyzer.html",
  "/kitchen-quote-analyzer.html",
  "/siding-quote-analyzer.html",
  "/window-quote-analyzer.html",
  "/garage-door-quote-analyzer.html",
  "/medical-bill-analyzer.html",
  "/legal-fee-analyzer.html",
  "/landscaping-quote-analyzer.html",
  "/compare-plumbing-quotes.html",
  "/compare-roofing-quotes.html",
  "/compare-hvac-quotes.html",
  "/compare-electrical-quotes.html",
  "/compare-auto-quotes.html",
  "/compare-solar-quotes.html",
  "/compare-moving-quotes.html",
  "/compare-painting-quotes.html",
  "/compare-fencing-quotes.html",
  "/compare-concrete-quotes.html",
  "/compare-foundation-quotes.html",
  "/compare-gutters-quotes.html",
  "/compare-insulation-quotes.html",
  "/compare-kitchen-quotes.html",
  "/compare-siding-quotes.html",
  "/compare-windows-quotes.html",
  "/compare-garage-door-quotes.html",
  "/compare-medical-quotes.html",
  "/compare-legal-quotes.html",
  "/compare-landscaping-quotes.html",
];

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"], timeout: 30000 });
  let pass = 0, fail = 0;
  const failures = [];

  for (const url of PAGES) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message.slice(0, 100)));

    try {
      await page.goto(BASE + url, { waitUntil: "networkidle2", timeout: 15000 });
      if (errors.length) {
        console.log("FAIL " + url + " (" + errors.length + " JS errors)");
        errors.forEach(e => console.log("  " + e));
        failures.push(url);
        fail++;
      } else {
        pass++;
      }
    } catch (e) {
      console.log("FAIL " + url + " (load error: " + e.message.slice(0, 60) + ")");
      failures.push(url);
      fail++;
    }
    await page.close();
  }

  await browser.close();

  console.log("\n" + pass + "/" + PAGES.length + " pages OK" + (fail ? ", " + fail + " FAILED" : ""));
  if (failures.length) {
    console.log("Failures:");
    failures.forEach(f => console.log("  " + f));
    process.exit(1);
  }
  process.exit(0);
})();
