/**
 * Inject cost guide links into all city cost pages.
 * Adds a link to the relevant cost guide after the first CTA box.
 *
 * Usage: node scripts/inject-guide-links.js
 *   --dry-run    (show what would change without writing)
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const dryRun = process.argv.includes("--dry-run");

const SERVICE_MAP = {
  "roof-cost": { guide: "/roof-replacement-cost-guide.html", label: "Roofing Cost Guide" },
  "hvac-cost": { guide: "/hvac-replacement-cost-guide.html", label: "HVAC Cost Guide" },
  "plumbing-cost": { guide: "/plumbing-cost-guide.html", label: "Plumbing Cost Guide" },
  "electrical-cost": { guide: "/electrical-cost-guide.html", label: "Electrical Cost Guide" },
  "solar-cost": { guide: "/solar-installation-cost-guide.html", label: "Solar Cost Guide" },
  "window-cost": { guide: "/window-replacement-cost-guide.html", label: "Window Cost Guide" },
  "siding-cost": { guide: "/siding-cost-guide.html", label: "Siding Cost Guide" },
  "painting-cost": { guide: "/painting-cost-guide.html", label: "Painting Cost Guide" },
  "insulation-cost": { guide: "/insulation-cost-guide.html", label: "Insulation Cost Guide" },
  "fence-cost": { guide: "/fencing-cost-guide.html", label: "Fencing Cost Guide" },
  "concrete-cost": { guide: "/concrete-cost-guide.html", label: "Concrete Cost Guide" },
  "landscaping-cost": { guide: "/landscaping-cost-guide.html", label: "Landscaping Cost Guide" },
  "garage-door-cost": { guide: "/garage-door-cost-guide.html", label: "Garage Door Cost Guide" },
  "foundation-cost": { guide: "/foundation-repair-cost-guide.html", label: "Foundation Cost Guide" },
  "kitchen-cost": { guide: "/kitchen-remodel-cost-guide.html", label: "Kitchen Cost Guide" },
  "gutter-cost": { guide: "/gutter-installation-cost-guide.html", label: "Gutter Cost Guide" }
};

const GUIDE_LINK_MARKER = "<!-- guide-link -->";

let modified = 0, skipped = 0, already = 0;

const files = fs.readdirSync(ROOT).filter(f =>
  f.endsWith("-cost.html") && !f.startsWith("roof-replacement") && !f.startsWith("hvac-replacement")
);

console.log(`Found ${files.length} city cost pages\n`);

for (const file of files) {
  const filePath = path.join(ROOT, file);
  let html = fs.readFileSync(filePath, "utf-8");

  // Skip if already has guide link
  if (html.includes(GUIDE_LINK_MARKER)) {
    already++;
    continue;
  }

  // Detect service type from filename
  let serviceKey = null;
  for (const key of Object.keys(SERVICE_MAP)) {
    if (file.includes(key)) {
      serviceKey = key;
      break;
    }
  }

  if (!serviceKey) {
    skipped++;
    continue;
  }

  const svc = SERVICE_MAP[serviceKey];

  // Inject after first </div> that closes the cta-box
  const guideHtml = `${GUIDE_LINK_MARKER}\n<p style="text-align:center; margin-top:12px; font-size:14px;"><a href="${svc.guide}" style="color:var(--brand);">Read our ${svc.label}</a> for national averages, material comparisons, and money-saving tips.</p>`;

  // Find the first cta-box closing pattern
  const ctaBoxEnd = html.indexOf('</div>\n\n<div class="cta-box"');
  if (ctaBoxEnd === -1) {
    // Try alternate pattern
    const altPattern = html.indexOf('</div>\n</div>\n\n<div class="cta-box"');
    if (altPattern !== -1) {
      html = html.slice(0, altPattern + 6) + "\n" + guideHtml + html.slice(altPattern + 6);
    } else {
      // Inject before site-footer as fallback
      const footerIdx = html.indexOf('<footer class="site-footer">');
      if (footerIdx !== -1) {
        html = html.slice(0, footerIdx) + guideHtml + "\n\n" + html.slice(footerIdx);
      } else {
        skipped++;
        continue;
      }
    }
  } else {
    html = html.slice(0, ctaBoxEnd + 6) + "\n" + guideHtml + html.slice(ctaBoxEnd + 6);
  }

  if (!dryRun) {
    fs.writeFileSync(filePath, html);
  }
  modified++;
  if (modified <= 5) console.log(`  ${file} -> ${svc.label}`);
}

if (modified > 5) console.log(`  ... and ${modified - 5} more`);
console.log(`\nDone: ${modified} modified, ${already} already had links, ${skipped} skipped`);
if (dryRun) console.log("(dry run - no files written)");
