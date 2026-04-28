// Add a one-line LLC entity disclosure line to every page's site-footer.
// Per project_legal_dive_followups.md HIGH 1.
//
// Pattern: insert just before the closing </footer>. Skip pages that
// already have the disclosure (idempotent).
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const DISCLOSURE = '<p style="font-size:12px;color:#94a3b8;margin-top:16px;">Operated by <strong>Woogoro LLC</strong>, a South Carolina limited liability company &middot; 17064 Laurelmont Court, Fort Mill, SC 29707</p>';

// Idempotency: skip files that already contain this exact text.
const SENTINEL = "Operated by <strong>Woogoro LLC</strong>";

// Standalone wrapper used when a page has no <footer> at all (some calculator
// and shared-result pages). Same disclosure text, just self-contained.
const DISCLOSURE_STANDALONE =
  '<div style="max-width:1200px;margin:24px auto;padding:0 20px;text-align:center;">' +
  DISCLOSURE +
  '</div>';

// Match: closing </div> immediately before </footer>. Inject the disclosure
// just inside the </footer> closing block, after the existing inner </div>.
const pat = /(\r?\n\s*<\/div>\s*\r?\n\s*<\/footer>)/;
// Some pages collapse the footer onto a single line: ...</p></div></footer>
// or ...</div></footer>. Handle that variant too.
const patSingleLine = /(<\/(?:p|div)>\s*)<\/footer>/;

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules, output, datasets, snapshots
      if (/node_modules|output|datasets|\.git|test-quotes|images|memory/.test(full)) continue;
      walk(full, files);
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(full);
    }
  }
  return files;
}

// Pages we deliberately do NOT touch: admin dashboards and the Google
// Search Console verification token (which isn't a real user-facing page).
const SKIP_BASENAMES = new Set([
  "analytics-dashboard.html",
  "seo-dashboard.html",
  "googlef1f12025490e6d42.html",
]);

const files = walk(ROOT);
let touched = 0, skipped = 0, missing = 0;
for (const f of files) {
  if (SKIP_BASENAMES.has(path.basename(f))) { skipped++; continue; }
  let txt;
  try { txt = fs.readFileSync(f, "utf8"); } catch (_) { continue; }
  if (txt.includes(SENTINEL)) { skipped++; continue; }
  // Strategy 1: multi-line footer
  if (pat.test(txt)) {
    fs.writeFileSync(f, txt.replace(pat, "\n      " + DISCLOSURE + "$1"));
    touched++;
    continue;
  }
  // Strategy 2: single-line footer
  if (patSingleLine.test(txt)) {
    fs.writeFileSync(f, txt.replace(patSingleLine, "$1" + DISCLOSURE + "</footer>"));
    touched++;
    continue;
  }
  // Strategy 3: no footer at all — inject standalone before </body>
  if (txt.includes("</body>")) {
    fs.writeFileSync(f, txt.replace("</body>", "  " + DISCLOSURE_STANDALONE + "\n</body>"));
    touched++;
    continue;
  }
  missing++;
}
console.log("Touched:", touched, "Skipped (already had / admin):", skipped, "Skipped (no insertion point):", missing);
