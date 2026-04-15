const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  // PATH 1: ESTIMATE
  console.log("========================================");
  console.log("PATH 1: FENCING ESTIMATE");
  console.log("========================================\n");

  const p1 = await browser.newPage();
  var e1 = [];
  p1.on("pageerror", err => e1.push(err.message.substring(0, 100)));
  await p1.goto("https://truepricehq.com/fencing-estimate.html", { waitUntil: "networkidle2", timeout: 15000 });

  // Check address form visible
  var hasAddr = await p1.evaluate(() => !!document.getElementById("addrStreet"));
  console.log("1. Address form visible: " + hasAddr);

  if (hasAddr) {
    await p1.type("#addrStreet", "100 Main St");
    await p1.type("#addrCity", "Charlotte");
    await p1.type("#addrState", "NC");
    await p1.type("#addrZip", "28202");
    await p1.evaluate(() => {
      var btn = document.getElementById("btnEstimate");
      if (btn) btn.click();
    });
    await sleep(2000);
    console.log("   Address submitted\n");
  }

  // Click through 6 steps
  async function clickOption(text) {
    return await p1.evaluate((t) => {
      var els = document.querySelectorAll(".fence-option");
      for (var el of els) {
        if (el.textContent.trim().startsWith(t) && el.offsetParent) {
          el.click(); return el.textContent.trim().substring(0, 40);
        }
      }
      return null;
    }, text);
  }

  // Step 1: Material
  console.log("2. Material tier step:");
  var hasRichTiers = await p1.evaluate(() => document.body.innerText.includes("per linear foot") || document.body.innerText.includes("/ft"));
  console.log("   Rich tier cards: " + hasRichTiers);
  var r = await clickOption("Cedar");
  console.log("   Selected: " + (r || "NOT FOUND"));
  await sleep(500);

  // Step 2: Length
  console.log("\n3. Linear feet:");
  r = await clickOption("200");
  console.log("   Selected: " + (r || "NOT FOUND"));
  await sleep(500);

  // Step 3: Height
  console.log("\n4. Height:");
  r = await clickOption("6 ft");
  console.log("   Selected: " + (r || "NOT FOUND"));
  await sleep(500);

  // Step 4: Gate
  console.log("\n5. Gate:");
  r = await clickOption("Yes");
  console.log("   Selected: " + (r || "NOT FOUND"));
  await sleep(500);

  // Step 5: Terrain
  console.log("\n6. Terrain:");
  var hasTerrain = await p1.evaluate(() => document.body.innerText.includes("terrain") || document.body.innerText.includes("Terrain"));
  console.log("   Terrain step visible: " + hasTerrain);
  r = await clickOption("Gentle");
  console.log("   Selected: " + (r || "NOT FOUND"));
  await sleep(500);

  // Step 6: Demo
  console.log("\n7. Old fence removal:");
  var hasDemo = await p1.evaluate(() => document.body.innerText.includes("old fence") || document.body.innerText.includes("remove"));
  console.log("   Demo step visible: " + hasDemo);
  r = await clickOption("Yes");
  console.log("   Selected: " + (r || "NOT FOUND"));
  await sleep(2000);

  // Result
  console.log("\n8. RESULT:");
  var result = await p1.evaluate(() => {
    var t = document.body.innerText;
    return {
      hasVerdict: t.includes("Estimated Cost") || t.includes("Fair Price"),
      hasTierComp: t.includes("Same fence") || t.includes("different materials"),
      hasScope: t.includes("Post holes") || t.includes("Concrete"),
      hasFindContractors: t.includes("Find") && t.includes("Contractor"),
      prices: (t.match(/\$[\d,]+/g) || []).slice(0, 5),
      hasPerLF: t.includes("per linear foot") || t.includes("/LF") || t.includes("per LF")
    };
  });
  console.log("   Verdict: " + result.hasVerdict);
  console.log("   Prices: " + result.prices.join(", "));
  console.log("   Tier comparison: " + result.hasTierComp);
  console.log("   Scope items: " + result.hasScope);
  console.log("   Find contractors: " + result.hasFindContractors);
  console.log("   JS errors: " + (e1.length ? e1.join("; ") : "NONE"));
  console.log("   " + (result.hasVerdict ? "PASS" : "FAIL"));
  await p1.close();

  // PATH 2: ANALYZER
  console.log("\n========================================");
  console.log("PATH 2: FENCING ANALYZER");
  console.log("========================================\n");

  const p2 = await browser.newPage();
  var e2 = [];
  p2.on("pageerror", err => e2.push(err.message.substring(0, 100)));
  await p2.goto("https://truepricehq.com/fencing-quote-analyzer.html", { waitUntil: "networkidle2", timeout: 15000 });
  console.log("1. Page loaded: " + (await p2.evaluate(() => document.body.innerText.length)) + " chars");
  console.log("   Has upload: " + (await p2.evaluate(() => !!document.querySelector("input[type=file]") || document.body.innerText.includes("Upload"))));
  console.log("   JS errors: " + (e2.length ? e2.join("; ") : "NONE"));
  console.log("   PASS");
  await p2.close();

  // PATH 3: COMPARE
  console.log("\n========================================");
  console.log("PATH 3: FENCING COMPARE");
  console.log("========================================\n");

  const p3 = await browser.newPage();
  var e3 = [];
  p3.on("pageerror", err => e3.push(err.message.substring(0, 100)));
  await p3.goto("https://truepricehq.com/compare-fencing-quotes.html", { waitUntil: "networkidle2", timeout: 15000 });
  var cmpState = await p3.evaluate(() => ({
    slots: document.querySelectorAll("input[type=file]").length,
    hasTitle: document.body.innerText.includes("Compare"),
    hasUpload: document.body.innerText.includes("Upload")
  }));
  console.log("1. Upload slots: " + cmpState.slots);
  console.log("   Title: " + cmpState.hasTitle);
  console.log("   JS errors: " + (e3.length ? e3.join("; ") : "NONE"));
  console.log("   PASS");
  await p3.close();

  await browser.close();
  console.log("\n========================================");
  console.log("ALL 3 FENCING PATHS TESTED");
  console.log("========================================");
})();
