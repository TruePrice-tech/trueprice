// Roofing UNIQUE PAGES walk: cost calculator, material/state pages, guides, city pages.
// Roofing has way more SEO surface than other verticals (12K city pages, material pages,
// state pages, guides). Sample key pages, screenshot, and check for content/layout issues.
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "roofing-walk-full-2026-04-27", "pages");
const BASE = process.env.BASE || "https://woogoro.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  // Calculators / landing
  { slug: "roof-cost-calculator.html", label: "Cost calculator landing" },
  { slug: "roof-replacement-cost-calculator.html", label: "Replacement calculator" },
  // Material pages
  { slug: "metal-roof-cost.html", label: "Metal roof cost" },
  { slug: "asphalt-roof-cost.html", label: "Asphalt roof cost" },
  { slug: "tile-roof-cost.html", label: "Tile roof cost" },
  { slug: "cedar-roof-cost.html", label: "Cedar shake roof cost" },
  { slug: "flat-roof-cost.html", label: "Flat / membrane roof cost" },
  { slug: "slate-roof-cost.html", label: "Slate roof cost" },
  { slug: "standing-seam-metal-roof-cost.html", label: "Standing seam metal" },
  { slug: "metal-vs-shingle-roof-cost.html", label: "Metal vs shingle comparison" },
  // Hub pages
  { slug: "roof-cost-by-state.html", label: "Cost by state hub" },
  { slug: "roof-cost-by-material.html", label: "Cost by material hub" },
  { slug: "roof-cost-by-house-size.html", label: "Cost by house size hub" },
  { slug: "roofing-cost-by-home-size.html", label: "Cost by home size (alt)" },
  // Guides
  { slug: "how-to-compare-roofing-quotes.html", label: "How to compare guide" },
  { slug: "how-to-negotiate-roofing-quote.html", label: "How to negotiate guide" },
  { slug: "what-should-a-roofing-quote-include.html", label: "What should include guide" },
  { slug: "roof-replacement-vs-roof-repair.html", label: "Replace vs repair guide" },
  { slug: "roof-replacement-insurance-claim.html", label: "Insurance claim guide" },
  { slug: "roof-replacement-cost-guide.html", label: "Replacement cost guide" },
  { slug: "roof-replacement-cost-per-square-foot.html", label: "Cost per sqft" },
  { slug: "signs-you-need-new-roof.html", label: "Signs you need new roof" },
  // Quote/example/template
  { slug: "roofing-quote-examples.html", label: "Quote examples" },
  { slug: "roofing-quote-template.html", label: "Quote template" },
  { slug: "roof-quote-example-charlotte-2100.html", label: "Charlotte 2100 example" },
  // State page
  { slug: "south-carolina-roof-cost.html", label: "South Carolina state" },
  // City pages (Lane's metro and a few more)
  { slug: "fort-mill-charlotte-roof-cost.html", label: "Fort Mill (Lane's metro)" },
  { slug: "charlotte-nc-roof-cost.html", label: "Charlotte NC" },
  { slug: "ballantyne-charlotte-roof-cost.html", label: "Ballantyne Charlotte (flagship)" }
];

(async () => {
  console.log("Output:", OUT, "Base:", BASE);
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on("console", (m) => {
    const t = m.text();
    if (/error|fail|reference|undefined/i.test(t) && !t.includes("favicon")) {
      console.log("  [console]", m.type(), t.substring(0, 200));
    }
  });
  page.on("pageerror", (e) => console.log("  [pageerror]", e.message.substring(0, 200)));

  for (const p of PAGES) {
    console.log(`\n=== ${p.slug} === ${p.label}`);
    try {
      const resp = await page.goto(`${BASE}/${p.slug}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      console.log("  status:", resp ? resp.status() : "no-response");
      await sleep(800);
      const safeName = p.slug.replace(/\.html$/, "").substring(0, 60);
      await page.screenshot({ path: path.join(OUT, `${safeName}.png`), fullPage: true });
      const title = await page.title();
      const h1 = await page.evaluate(() => (document.querySelector("h1") || {}).innerText || "(no h1)").catch(() => "(error)");
      console.log("  title:", title.substring(0, 80));
      console.log("  h1:", String(h1).substring(0, 80));
    } catch (e) {
      console.log("  ERROR:", e.message.substring(0, 200));
    }
  }
  await browser.close();
  console.log("\nDONE.");
})().catch(e => { console.error("FATAL:", e); process.exit(1); });
