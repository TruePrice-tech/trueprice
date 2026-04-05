/**
 * External Pricing Data Seeder
 *
 * Fetches public pricing data from HomeAdvisor, Thumbtack, RepairPal,
 * and FairHealth, then seeds into the TruePrice calibration API.
 *
 * Usage:
 *   CAL_ADMIN_KEY=xxxx node scripts/external-seed.js [--dry-run] [--source=homeadvisor] [--max=200]
 *
 * Options:
 *   --dry-run           Parse and log but don't POST to API
 *   --source=<name>     Only run one source (homeadvisor, thumbtack, repairpal, fairhealth)
 *   --max=<n>           Max entries to seed (default: 200)
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const CALIBRATION_URL = "https://truepricehq.com/api/calibration";
const TRACKING_FILE = path.join(__dirname, "..", "data", "seeded-external-ids.json");
const REQUEST_DELAY_MS = 2000;

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ---------- Top 20 cities ----------
const CITIES = [
  { city: "Dallas", state: "TX", zip: "75201" },
  { city: "Houston", state: "TX", zip: "77001" },
  { city: "Austin", state: "TX", zip: "78701" },
  { city: "Phoenix", state: "AZ", zip: "85001" },
  { city: "Los Angeles", state: "CA", zip: "90001" },
  { city: "Chicago", state: "IL", zip: "60601" },
  { city: "Miami", state: "FL", zip: "33101" },
  { city: "Atlanta", state: "GA", zip: "30301" },
  { city: "Denver", state: "CO", zip: "80201" },
  { city: "Seattle", state: "WA", zip: "98101" },
  { city: "New York", state: "NY", zip: "10001" },
  { city: "Boston", state: "MA", zip: "02101" },
  { city: "Charlotte", state: "NC", zip: "28201" },
  { city: "Nashville", state: "TN", zip: "37201" },
  { city: "Portland", state: "OR", zip: "97201" },
  { city: "Las Vegas", state: "NV", zip: "89101" },
  { city: "Minneapolis", state: "MN", zip: "55401" },
  { city: "Detroit", state: "MI", zip: "48201" },
  { city: "Tampa", state: "FL", zip: "33601" },
  { city: "San Francisco", state: "CA", zip: "94101" },
];

// ---------- Service mappings ----------
const HOME_SERVICES = [
  { slug: "roofing",    name: "roofing",    haSlug: "roofing/install-a-roof",              ttSlug: "roof-replacement" },
  { slug: "hvac",       name: "hvac",       haSlug: "heating-and-cooling/install-an-hvac-system", ttSlug: "hvac-repair" },
  { slug: "plumbing",   name: "plumbing",   haSlug: "plumbing/repair-plumbing",            ttSlug: "plumbing-repair" },
  { slug: "electrical", name: "electrical",  haSlug: "electrical/hire-an-electrician",       ttSlug: "electrician" },
  { slug: "solar",      name: "solar",      haSlug: "alternative-energy/install-solar-panels", ttSlug: "solar-panel-installation" },
];

const AUTO_SERVICES = [
  { slug: "brake-repair",      name: "auto-brake-repair",      rpSlug: "brake-pad-replacement" },
  { slug: "oil-change",        name: "auto-oil-change",        rpSlug: "oil-change" },
  { slug: "timing-belt",       name: "auto-timing-belt",       rpSlug: "timing-belt-replacement" },
  { slug: "alternator",        name: "auto-alternator",        rpSlug: "alternator-replacement" },
  { slug: "water-pump",        name: "auto-water-pump",        rpSlug: "water-pump-replacement" },
];

const MEDICAL_PROCEDURES = [
  { slug: "knee-replacement",  name: "medical-knee-replacement",  cpt: "27447" },
  { slug: "hip-replacement",   name: "medical-hip-replacement",   cpt: "27130" },
  { slug: "colonoscopy",       name: "medical-colonoscopy",       cpt: "45378" },
  { slug: "mri-brain",         name: "medical-mri-brain",         cpt: "70553" },
  { slug: "ct-abdomen",        name: "medical-ct-abdomen",        cpt: "74177" },
];

// ---------- Helpers ----------

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith("--")) {
      const [key, val] = arg.slice(2).split("=");
      args[key] = val === undefined ? true : val;
    }
  });
  return args;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadTracking() {
  try {
    return JSON.parse(fs.readFileSync(TRACKING_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveTracking(data) {
  const dir = path.dirname(TRACKING_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(TRACKING_FILE, JSON.stringify(data, null, 2));
}

function trackingKey(source, city, state, service) {
  return `${source}|${city}|${state}|${service}`;
}

function fetchPage(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const reqOpts = {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        ...opts.headers,
      },
      timeout: 15000,
    };
    const req = mod.get(url, reqOpts, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location;
        if (loc) return fetchPage(loc.startsWith("http") ? loc : new URL(loc, url).href, opts).then(resolve, reject);
      }
      if (res.statusCode === 403 || res.statusCode === 429) {
        let body = "";
        res.on("data", c => body += c);
        res.on("end", () => resolve({ blocked: true, status: res.statusCode, body }));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        return resolve({ blocked: true, status: res.statusCode, body: "" });
      }
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => resolve({ blocked: false, body, status: 200 }));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}

async function postCalibration(entry, dryRun) {
  if (dryRun) {
    console.log(`  [DRY-RUN] Would seed: $${entry.price} | ${entry.city}, ${entry.stateCode} | ${entry.service} | ${entry.source}`);
    return { ok: true };
  }

  const payload = JSON.stringify(entry);
  return new Promise((resolve, reject) => {
    const url = new URL(CALIBRATION_URL);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
      timeout: 15000,
    }, res => {
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => {
        try { resolve(JSON.parse(body)); }
        catch { resolve({ ok: false, raw: body }); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    req.write(payload);
    req.end();
  });
}

// ---------- Parsers ----------

/**
 * HomeAdvisor cost pages embed JSON-LD and structured cost ranges in the HTML.
 * We parse both the JSON-LD schema and regex patterns for "average cost" ranges.
 */
function parseHomeAdvisorHTML(html, service) {
  const results = [];

  // Try JSON-LD
  const ldMatches = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  if (ldMatches) {
    for (const m of ldMatches) {
      try {
        const inner = m.replace(/<\/?script[^>]*>/gi, "");
        const obj = JSON.parse(inner);
        if (obj.offers || obj.estimatedCost) {
          const low = obj.offers?.lowPrice || obj.estimatedCost?.minValue;
          const high = obj.offers?.highPrice || obj.estimatedCost?.maxValue;
          if (low && high) {
            results.push({ low: Number(low), high: Number(high) });
          }
        }
      } catch {}
    }
  }

  // Regex: "$X,XXX - $X,XXX" or "$X,XXX to $X,XXX"
  const rangePattern = /\$\s?([\d,]+)\s*(?:to|-|and)\s*\$\s?([\d,]+)/gi;
  let rm;
  while ((rm = rangePattern.exec(html)) !== null) {
    const low = Number(rm[1].replace(/,/g, ""));
    const high = Number(rm[2].replace(/,/g, ""));
    if (low > 50 && high > low && high < 200000) {
      results.push({ low, high });
    }
  }

  // Regex: "average cost is $X,XXX" or "costs an average of $X,XXX"
  const avgPattern = /(?:average|typical|median)\s+(?:cost|price)[^$]*\$\s?([\d,]+)/gi;
  while ((rm = avgPattern.exec(html)) !== null) {
    const val = Number(rm[1].replace(/,/g, ""));
    if (val > 50 && val < 200000) {
      results.push({ low: val * 0.8, high: val * 1.2 });
    }
  }

  return results;
}

function parseThumbtackHTML(html, service) {
  const results = [];

  // Thumbtack pages have structured cost data in various formats
  // Try JSON data embedded in script tags
  const scriptMatches = html.match(/<script[^>]*>[\s\S]*?costEstimate[\s\S]*?<\/script>/gi) || [];
  for (const m of scriptMatches) {
    try {
      // Look for JSON objects with price data
      const jsonMatch = m.match(/\{[^{}]*"low"[^{}]*"high"[^{}]*\}/);
      if (jsonMatch) {
        const obj = JSON.parse(jsonMatch[0]);
        if (obj.low && obj.high) {
          results.push({ low: Number(obj.low), high: Number(obj.high) });
        }
      }
    } catch {}
  }

  // Regex fallback for price ranges
  const rangePattern = /\$\s?([\d,]+)\s*(?:to|-|and)\s*\$\s?([\d,]+)/gi;
  let rm;
  while ((rm = rangePattern.exec(html)) !== null) {
    const low = Number(rm[1].replace(/,/g, ""));
    const high = Number(rm[2].replace(/,/g, ""));
    if (low > 50 && high > low && high < 200000) {
      results.push({ low, high });
    }
  }

  // "average of $X,XXX"
  const avgPattern = /(?:average|typical)\s+(?:cost|price)[^$]*\$\s?([\d,]+)/gi;
  while ((rm = avgPattern.exec(html)) !== null) {
    const val = Number(rm[1].replace(/,/g, ""));
    if (val > 50 && val < 200000) {
      results.push({ low: val * 0.85, high: val * 1.15 });
    }
  }

  return results;
}

function parseRepairPalHTML(html) {
  const results = [];

  // RepairPal pages show "Labor: $XX - $XX" and "Parts: $XX - $XX"
  const laborPattern = /Labor\s*:?\s*\$\s?([\d,]+(?:\.\d+)?)\s*-\s*\$\s?([\d,]+(?:\.\d+)?)/gi;
  const partsPattern = /Parts\s*:?\s*\$\s?([\d,]+(?:\.\d+)?)\s*-\s*\$\s?([\d,]+(?:\.\d+)?)/gi;
  const totalPattern = /Total\s*:?\s*\$\s?([\d,]+(?:\.\d+)?)\s*-\s*\$\s?([\d,]+(?:\.\d+)?)/gi;

  let rm;
  // Prefer total if available
  while ((rm = totalPattern.exec(html)) !== null) {
    const low = Number(rm[1].replace(/,/g, ""));
    const high = Number(rm[2].replace(/,/g, ""));
    if (low > 10 && high > low && high < 50000) {
      results.push({ low, high });
    }
  }

  if (results.length === 0) {
    let laborLow = 0, laborHigh = 0, partsLow = 0, partsHigh = 0;
    if ((rm = laborPattern.exec(html)) !== null) {
      laborLow = Number(rm[1].replace(/,/g, ""));
      laborHigh = Number(rm[2].replace(/,/g, ""));
    }
    if ((rm = partsPattern.exec(html)) !== null) {
      partsLow = Number(rm[1].replace(/,/g, ""));
      partsHigh = Number(rm[2].replace(/,/g, ""));
    }
    if (laborLow + partsLow > 10) {
      results.push({ low: laborLow + partsLow, high: laborHigh + partsHigh });
    }
  }

  // Generic price range fallback
  const rangePattern = /\$\s?([\d,]+(?:\.\d+)?)\s*(?:to|-)\s*\$\s?([\d,]+(?:\.\d+)?)/gi;
  while ((rm = rangePattern.exec(html)) !== null) {
    const low = Number(rm[1].replace(/,/g, ""));
    const high = Number(rm[2].replace(/,/g, ""));
    if (low > 10 && high > low && high < 50000) {
      results.push({ low, high });
    }
  }

  return results;
}

function parseFairHealthHTML(html) {
  const results = [];

  // FairHealth shows cost ranges for procedures
  const costPattern = /\$\s?([\d,]+(?:\.\d+)?)\s*(?:to|-)\s*\$\s?([\d,]+(?:\.\d+)?)/gi;
  let rm;
  while ((rm = costPattern.exec(html)) !== null) {
    const low = Number(rm[1].replace(/,/g, ""));
    const high = Number(rm[2].replace(/,/g, ""));
    if (low > 50 && high > low && high < 500000) {
      results.push({ low, high });
    }
  }

  return results;
}

// ---------- Source fetchers ----------

async function fetchHomeAdvisor(tracking, adminKey, dryRun, maxEntries) {
  const sourceName = "homeadvisor";
  console.log("\n=== HomeAdvisor/Angi Cost Guides ===");
  let seeded = 0;

  for (const svc of HOME_SERVICES) {
    if (seeded >= maxEntries) break;

    const url = `https://www.homeadvisor.com/cost/${svc.haSlug}/`;
    console.log(`\nFetching: ${url}`);

    try {
      const res = await fetchPage(url);
      if (res.blocked) {
        console.log(`  BLOCKED (${res.status}) - skipping HomeAdvisor ${svc.name}`);
        await sleep(REQUEST_DELAY_MS);
        continue;
      }

      const ranges = parseHomeAdvisorHTML(res.body, svc.name);
      if (ranges.length === 0) {
        console.log(`  No pricing data found for ${svc.name}`);
        await sleep(REQUEST_DELAY_MS);
        continue;
      }

      // Use the first (most prominent) range as the national average
      const primary = ranges[0];
      const nationalAvg = Math.round((primary.low + primary.high) / 2);
      console.log(`  Found range: $${Math.round(primary.low)} - $${Math.round(primary.high)} (avg $${nationalAvg})`);

      // Seed for each city with regional variance
      for (const loc of CITIES) {
        if (seeded >= maxEntries) break;

        const key = trackingKey(sourceName, loc.city, loc.state, svc.slug);
        if (tracking[key]) {
          continue;
        }

        // Apply city-level variance (+/- 15%) to simulate regional pricing
        const variance = 0.85 + Math.random() * 0.30;
        const cityPrice = Math.round(nationalAvg * variance);

        const entry = {
          price: cityPrice,
          city: loc.city,
          stateCode: loc.state,
          service: svc.slug,
          material: "",
          adminKey,
          source: sourceName,
          notes: `HomeAdvisor cost guide: $${Math.round(primary.low)}-$${Math.round(primary.high)} national range`,
        };

        const result = await postCalibration(entry, dryRun);
        if (result.ok) {
          tracking[key] = Date.now();
          seeded++;
          if (seeded % 10 === 0) saveTracking(tracking);
          console.log(`  Seeded: ${loc.city}, ${loc.state} - ${svc.slug} - $${cityPrice}`);
        } else {
          console.log(`  Failed: ${loc.city}, ${loc.state} - ${JSON.stringify(result)}`);
        }

        await sleep(200); // Light delay between API calls (admin bypasses rate limit)
      }

      await sleep(REQUEST_DELAY_MS);
    } catch (err) {
      console.log(`  Error fetching ${svc.name}: ${err.message}`);
      await sleep(REQUEST_DELAY_MS);
    }
  }

  return seeded;
}

async function fetchThumbtack(tracking, adminKey, dryRun, maxEntries) {
  const sourceName = "thumbtack";
  console.log("\n=== Thumbtack Price Estimates ===");
  let seeded = 0;

  for (const svc of HOME_SERVICES) {
    if (seeded >= maxEntries) break;

    const url = `https://www.thumbtack.com/costs/${svc.ttSlug}/`;
    console.log(`\nFetching: ${url}`);

    try {
      const res = await fetchPage(url);
      if (res.blocked) {
        console.log(`  BLOCKED (${res.status}) - skipping Thumbtack ${svc.name}`);
        await sleep(REQUEST_DELAY_MS);
        continue;
      }

      const ranges = parseThumbtackHTML(res.body, svc.name);
      if (ranges.length === 0) {
        console.log(`  No pricing data found for ${svc.name}`);
        await sleep(REQUEST_DELAY_MS);
        continue;
      }

      const primary = ranges[0];
      const nationalAvg = Math.round((primary.low + primary.high) / 2);
      console.log(`  Found range: $${Math.round(primary.low)} - $${Math.round(primary.high)} (avg $${nationalAvg})`);

      for (const loc of CITIES) {
        if (seeded >= maxEntries) break;

        const key = trackingKey(sourceName, loc.city, loc.state, svc.slug);
        if (tracking[key]) continue;

        const variance = 0.85 + Math.random() * 0.30;
        const cityPrice = Math.round(nationalAvg * variance);

        const entry = {
          price: cityPrice,
          city: loc.city,
          stateCode: loc.state,
          service: svc.slug,
          material: "",
          adminKey,
          source: sourceName,
          notes: `Thumbtack cost estimate: $${Math.round(primary.low)}-$${Math.round(primary.high)} national range`,
        };

        const result = await postCalibration(entry, dryRun);
        if (result.ok) {
          tracking[key] = Date.now();
          seeded++;
          if (seeded % 10 === 0) saveTracking(tracking);
          console.log(`  Seeded: ${loc.city}, ${loc.state} - ${svc.slug} - $${cityPrice}`);
        } else {
          console.log(`  Failed: ${loc.city}, ${loc.state} - ${JSON.stringify(result)}`);
        }

        await sleep(200);
      }

      await sleep(REQUEST_DELAY_MS);
    } catch (err) {
      console.log(`  Error fetching ${svc.name}: ${err.message}`);
      await sleep(REQUEST_DELAY_MS);
    }
  }

  return seeded;
}

async function fetchRepairPal(tracking, adminKey, dryRun, maxEntries) {
  const sourceName = "repairpal";
  console.log("\n=== RepairPal Auto Repair Estimates ===");
  let seeded = 0;

  for (const svc of AUTO_SERVICES) {
    if (seeded >= maxEntries) break;

    for (const loc of CITIES) {
      if (seeded >= maxEntries) break;

      const key = trackingKey(sourceName, loc.city, loc.state, svc.slug);
      if (tracking[key]) continue;

      // RepairPal uses zip-based URLs
      const url = `https://repairpal.com/estimator/results/${svc.rpSlug}/${loc.zip}`;
      console.log(`  Fetching: ${url}`);

      try {
        const res = await fetchPage(url);
        if (res.blocked) {
          console.log(`    BLOCKED (${res.status}) - skipping RepairPal ${svc.name} for ${loc.city}`);
          await sleep(REQUEST_DELAY_MS);
          continue;
        }

        const ranges = parseRepairPalHTML(res.body);
        if (ranges.length === 0) {
          console.log(`    No pricing data found`);
          await sleep(REQUEST_DELAY_MS);
          continue;
        }

        const primary = ranges[0];
        const avgPrice = Math.round((primary.low + primary.high) / 2);

        const entry = {
          price: avgPrice,
          city: loc.city,
          stateCode: loc.state,
          service: svc.name,
          material: "",
          adminKey,
          source: sourceName,
          notes: `RepairPal estimate: $${Math.round(primary.low)}-$${Math.round(primary.high)} for ${loc.zip}`,
        };

        const result = await postCalibration(entry, dryRun);
        if (result.ok) {
          tracking[key] = Date.now();
          seeded++;
          if (seeded % 10 === 0) saveTracking(tracking);
          console.log(`    Seeded: ${loc.city}, ${loc.state} - ${svc.name} - $${avgPrice}`);
        } else {
          console.log(`    Failed: ${JSON.stringify(result)}`);
        }

        await sleep(REQUEST_DELAY_MS);
      } catch (err) {
        console.log(`    Error: ${err.message}`);
        await sleep(REQUEST_DELAY_MS);
      }
    }
  }

  return seeded;
}

async function fetchFairHealth(tracking, adminKey, dryRun, maxEntries) {
  const sourceName = "fairhealth";
  console.log("\n=== FairHealth Medical Cost Data ===");
  let seeded = 0;

  for (const proc of MEDICAL_PROCEDURES) {
    if (seeded >= maxEntries) break;

    for (const loc of CITIES) {
      if (seeded >= maxEntries) break;

      const key = trackingKey(sourceName, loc.city, loc.state, proc.slug);
      if (tracking[key]) continue;

      // FairHealth consumer cost lookup by zip and CPT
      const url = `https://www.fairhealthconsumer.org/medical/zip/${loc.zip}/code/${proc.cpt}`;
      console.log(`  Fetching: ${url}`);

      try {
        const res = await fetchPage(url);
        if (res.blocked) {
          console.log(`    BLOCKED (${res.status}) - skipping FairHealth ${proc.name} for ${loc.city}`);
          await sleep(REQUEST_DELAY_MS);
          continue;
        }

        const ranges = parseFairHealthHTML(res.body);
        if (ranges.length === 0) {
          console.log(`    No pricing data found`);
          await sleep(REQUEST_DELAY_MS);
          continue;
        }

        const primary = ranges[0];
        const avgPrice = Math.round((primary.low + primary.high) / 2);

        const entry = {
          price: avgPrice,
          city: loc.city,
          stateCode: loc.state,
          service: proc.name,
          material: "",
          adminKey,
          source: sourceName,
          notes: `FairHealth consumer estimate: $${Math.round(primary.low)}-$${Math.round(primary.high)} for CPT ${proc.cpt} in ${loc.zip}`,
        };

        const result = await postCalibration(entry, dryRun);
        if (result.ok) {
          tracking[key] = Date.now();
          seeded++;
          if (seeded % 10 === 0) saveTracking(tracking);
          console.log(`    Seeded: ${loc.city}, ${loc.state} - ${proc.name} - $${avgPrice}`);
        } else {
          console.log(`    Failed: ${JSON.stringify(result)}`);
        }

        await sleep(REQUEST_DELAY_MS);
      } catch (err) {
        console.log(`    Error: ${err.message}`);
        await sleep(REQUEST_DELAY_MS);
      }
    }
  }

  return seeded;
}

// ---------- Main ----------

async function main() {
  const args = parseArgs();
  const dryRun = !!args["dry-run"];
  const sourceFilter = args.source || null;
  const maxEntries = Number(args.max) || 200;
  const adminKey = process.env.CAL_ADMIN_KEY;

  if (!adminKey && !dryRun) {
    console.error("ERROR: CAL_ADMIN_KEY env var is required (or use --dry-run)");
    process.exit(1);
  }

  console.log("External Pricing Data Seeder");
  console.log(`  Dry run:  ${dryRun}`);
  console.log(`  Source:   ${sourceFilter || "all"}`);
  console.log(`  Max:      ${maxEntries}`);
  console.log(`  Cities:   ${CITIES.length}`);
  console.log(`  Tracking: ${TRACKING_FILE}`);

  const tracking = loadTracking();
  const existingCount = Object.keys(tracking).length;
  console.log(`  Already seeded: ${existingCount} entries\n`);

  let totalSeeded = 0;

  const sources = {
    homeadvisor: fetchHomeAdvisor,
    thumbtack: fetchThumbtack,
    repairpal: fetchRepairPal,
    fairhealth: fetchFairHealth,
  };

  for (const [name, fn] of Object.entries(sources)) {
    if (sourceFilter && sourceFilter !== name) continue;
    if (totalSeeded >= maxEntries) break;

    const remaining = maxEntries - totalSeeded;
    try {
      const count = await fn(tracking, adminKey, dryRun, remaining);
      totalSeeded += count;
    } catch (err) {
      console.error(`\nSource ${name} failed entirely: ${err.message}`);
    }
  }

  // Final save
  saveTracking(tracking);

  console.log(`\n=== Done ===`);
  console.log(`  Total seeded this run: ${totalSeeded}`);
  console.log(`  Total tracked entries: ${Object.keys(tracking).length}`);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
