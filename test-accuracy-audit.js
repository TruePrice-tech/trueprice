// Accuracy audit: run parser on ALL real fixtures (including messy ones)
// and check what percentage of fields are correctly extracted.
// Focus on: price, contractor, location, material, warranty.
// Also test messy (blurred/darkened/rotated) fixtures separately.

const fs = require("fs");
const path = require("path");

const verticals = fs.readdirSync("test").filter(d => {
  return fs.existsSync(path.join("test", d, "load-parser.js")) &&
         fs.existsSync(path.join("test", d, "ocr-cache"));
});

let totalClean = 0, totalMessy = 0;
const cleanStats = { price: 0, contractor: 0, location: 0, warranty: 0, confidence: 0 };
const messyStats = { price: 0, contractor: 0, location: 0, warranty: 0, confidence: 0 };
const perVertical = {};

for (const v of verticals) {
  const load = require("./test/" + v + "/load-parser");
  const cacheDir = path.join("test", v, "ocr-cache");
  const files = fs.readdirSync(cacheDir).filter(f => f.endsWith(".txt"));

  const vStats = { clean: { total: 0, price: 0, contractor: 0, location: 0, warranty: 0, highConf: 0 },
                   messy: { total: 0, price: 0, contractor: 0, location: 0, warranty: 0, highConf: 0 } };

  for (const f of files) {
    const text = fs.readFileSync(path.join(cacheDir, f), "utf8");
    if (text.trim().length < 30) continue;
    // Must have at least one dollar amount to be a real quote
    if (!/\$\s?[\d,]+/.test(text)) continue;
    if (!/total|estimate|quote|subtotal|balance|amount/i.test(text)) continue;

    const isMessy = f.includes("messy");
    const bucket = isMessy ? vStats.messy : vStats.clean;
    const globalBucket = isMessy ? messyStats : cleanStats;

    if (isMessy) totalMessy++; else totalClean++;
    bucket.total++;

    let r;
    try { r = load.parseExtractedTextMultiStrategy(text, v); } catch(e) { continue; }
    if (!r) continue;

    if (r.finalPrice > 0) { bucket.price++; globalBucket.price++; }
    if (r.contractor && r.contractor !== "Not detected") { bucket.contractor++; globalBucket.contractor++; }
    if (r.city || r.stateCode) { bucket.location++; globalBucket.location++; }
    if (r.warranty || r.warrantyYears > 0) { bucket.warranty++; globalBucket.warranty++; }
    if (r.priceConfidence === "high") { bucket.highConf++; globalBucket.confidence++; }
  }

  perVertical[v] = vStats;
}

function pct(n, d) { return d === 0 ? "N/A" : Math.round(n / d * 100) + "%"; }
function pad(s, n) { return (s + " ".repeat(n)).slice(0, n); }

console.log("=" .repeat(80));
console.log("PARSER ACCURACY AUDIT");
console.log("=".repeat(80));

console.log("\n--- CLEAN FIXTURES (synthetic, well-formatted) ---");
console.log("Total: " + totalClean);
console.log("Price:      " + pct(cleanStats.price, totalClean) + " (" + cleanStats.price + "/" + totalClean + ")");
console.log("Contractor: " + pct(cleanStats.contractor, totalClean) + " (" + cleanStats.contractor + "/" + totalClean + ")");
console.log("Location:   " + pct(cleanStats.location, totalClean) + " (" + cleanStats.location + "/" + totalClean + ")");
console.log("Warranty:   " + pct(cleanStats.warranty, totalClean) + " (" + cleanStats.warranty + "/" + totalClean + ")");
console.log("High conf:  " + pct(cleanStats.confidence, totalClean) + " (" + cleanStats.confidence + "/" + totalClean + ")");

console.log("\n--- MESSY FIXTURES (blurred, darkened, rotated phone photos) ---");
console.log("Total: " + totalMessy);
console.log("Price:      " + pct(messyStats.price, totalMessy) + " (" + messyStats.price + "/" + totalMessy + ")");
console.log("Contractor: " + pct(messyStats.contractor, totalMessy) + " (" + messyStats.contractor + "/" + totalMessy + ")");
console.log("Location:   " + pct(messyStats.location, totalMessy) + " (" + messyStats.location + "/" + totalMessy + ")");
console.log("Warranty:   " + pct(messyStats.warranty, totalMessy) + " (" + messyStats.warranty + "/" + totalMessy + ")");
console.log("High conf:  " + pct(messyStats.confidence, totalMessy) + " (" + messyStats.confidence + "/" + totalMessy + ")");

console.log("\n--- PER VERTICAL BREAKDOWN ---");
console.log(pad("VERTICAL", 14) + pad("CLEAN", 8) + pad("PRICE", 8) + pad("CONTR", 8) + pad("LOC", 8) + pad("MESSY", 8) + pad("M-PRICE", 8) + "M-CONF");
console.log("-".repeat(78));

for (const v of verticals) {
  const s = perVertical[v];
  const c = s.clean, m = s.messy;
  console.log(
    pad(v, 14) +
    pad(c.total + "", 8) +
    pad(pct(c.price, c.total), 8) +
    pad(pct(c.contractor, c.total), 8) +
    pad(pct(c.location, c.total), 8) +
    pad(m.total + "", 8) +
    pad(m.total > 0 ? pct(m.price, m.total) : "-", 8) +
    (m.total > 0 ? pct(m.highConf, m.total) : "-")
  );
}
