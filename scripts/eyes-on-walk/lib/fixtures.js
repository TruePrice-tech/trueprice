// Fixture validator. Per feedback_validate_fixtures_first.md: never trust an
// auto-scraped manifest. Verify every file referenced exists on disk, AND
// scan for known-bad patterns (zero-byte files, manifest entries that point
// to missing files, files that are screenshots of our own UI rather than
// real third-party quote images).

const fs = require("fs");
const path = require("path");

function loadFixtureManifest(vertical, root) {
  const dir = path.join(root, "test-quotes", `${vertical}-images`);
  const manifest = path.join(dir, "manifest.json");
  if (!fs.existsSync(manifest)) {
    return { dir, entries: [], errors: [`No manifest at ${manifest}`] };
  }
  let entries;
  try {
    entries = JSON.parse(fs.readFileSync(manifest, "utf8"));
  } catch (e) {
    return { dir, entries: [], errors: [`Manifest parse error: ${e.message}`] };
  }
  if (!Array.isArray(entries)) entries = [];

  const errors = [];
  const valid = [];
  for (const ent of entries) {
    const file = ent.file ? path.join(dir, ent.file) : null;
    if (!file) {
      errors.push(`Entry missing 'file': ${JSON.stringify(ent).slice(0, 120)}`);
      continue;
    }
    if (!fs.existsSync(file)) {
      errors.push(`Manifest references missing file: ${ent.file}`);
      continue;
    }
    const stat = fs.statSync(file);
    if (stat.size === 0) {
      errors.push(`Zero-byte fixture: ${ent.file}`);
      continue;
    }
    valid.push({ ...ent, fullPath: file, size: stat.size });
  }
  return { dir, entries: valid, errors };
}

// Pick a small set of fixtures for the analyze-path walk. Prefer real-XX over
// any synthetic / mock files. Caller can override by passing an idsAllowList.
function pickAnalyzeFixtures(manifestResult, { max = 3, idsAllowList } = {}) {
  let pool = manifestResult.entries;
  if (idsAllowList) pool = pool.filter((e) => idsAllowList.includes(e.id));
  // Prefer files starting with "real-"
  pool.sort((a, b) => {
    const ar = (a.file || "").startsWith("real-") ? 0 : 1;
    const br = (b.file || "").startsWith("real-") ? 0 : 1;
    return ar - br;
  });
  return pool.slice(0, max);
}

// Pick the comparison fixtures for the compare path. Looks for files matching
// comparison-*-{low,mid,high}.* per the existing convention.
function pickCompareFixtures(manifestResult, vertical) {
  const dir = manifestResult.dir;
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir);
  const tiers = ["low", "mid", "high"];
  const picks = [];
  for (const tier of tiers) {
    const re = new RegExp(`^(messy-)?comparison-${vertical}-${tier}\\.(png|jpg|jpeg)$`, "i");
    const generic = new RegExp(`^(messy-)?comparison-.+-${tier}\\.(png|jpg|jpeg)$`, "i");
    const f = files.find((x) => re.test(x)) || files.find((x) => generic.test(x));
    if (f) picks.push({ tier, file: path.join(dir, f), name: f });
  }
  return picks;
}

module.exports = { loadFixtureManifest, pickAnalyzeFixtures, pickCompareFixtures };
