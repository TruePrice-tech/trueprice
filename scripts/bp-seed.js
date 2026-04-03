/**
 * BiggerPockets Forum Quote Seeder
 *
 * Fetches BiggerPockets forum threads about contractor costs and uses
 * Claude Haiku to extract structured data, then seeds into calibration DB.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-xxx CAL_ADMIN_KEY=1111 node scripts/bp-seed.js
 *
 * Options:
 *   --max-threads=100    (default: 200)
 *   --dry-run            (parse but don't seed)
 */

const CALIBRATION_URL = "https://truepricehq.com/api/calibration";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const INFLATION_RATE = 0.03;

// Known BiggerPockets forum threads with cost/quote discussions
// Format: { url, service }
const THREAD_SOURCES = [
  // Roofing
  { path: "/forums/52/topics/620386-i-just-got-a-30k-quote-for-a-new-roof-lol", service: "roofing" },
  { path: "/forums/899/topics/1099211-what-is-a-reasonable-price-for-replacing-roof-on-a-duplex", service: "roofing" },
  { path: "/forums/548/topics/717948-minimum-11-500-for-roof-replacement-in-san-jose", service: "roofing" },
  { path: "/forums/44/topics/906036-roof-replacement-cost-los-angeles", service: "roofing" },
  { path: "/forums/52/topics/1113390-roof-replacement-cost-alabama", service: "roofing" },
  { path: "/forums/52/topics/1054974-contractor-wants-to-take-most-of-insurance-money-to-replace-roof", service: "roofing" },
  { path: "/forums/44/topics/893134-roof-replacement-cost-per-square", service: "roofing" },
  { path: "/forums/44/topics/633725-roof-replacement-cost", service: "roofing" },
  { path: "/forums/52/topics/70087-how-much-should-a-new-roof-cost", service: "roofing" },
  { path: "/forums/641/topics/635370-quote-for-roof-replacement-in-jax", service: "roofing" },
  // HVAC
  { path: "/forums/67/topics/1083219-hvac-quotes-inflated-or-expected", service: "hvac" },
  { path: "/forums/52/topics/225779-heat-pump-pricing", service: "hvac" },
  { path: "/forums/647/topics/957527-recent-hvac-replacement-costs", service: "hvac" },
  { path: "/forums/52/topics/371891-repair-or-replace-hvac-in-rental-property", service: "hvac" },
  { path: "/forums/52/topics/196047-ac-unit-replacement", service: "hvac" },
  { path: "/forums/52/topics/824687-would-like-your-opinion-on-hvac-cost", service: "hvac" },
  { path: "/forums/575/topics/431581-new-hvac-for-under-4k-should-i-be-worried", service: "hvac" },
  { path: "/forums/903/topics/1013187-bought-house-found-ac-issues-after", service: "hvac" },
];

// Search queries to discover more threads
const SEARCH_QUERIES = [
  { q: "roof replacement cost quote", service: "roofing" },
  { q: "roofing quote fair price", service: "roofing" },
  { q: "new roof cost per square", service: "roofing" },
  { q: "hvac replacement cost quote", service: "hvac" },
  { q: "ac replacement cost", service: "hvac" },
  { q: "furnace replacement cost", service: "hvac" },
  { q: "plumbing cost quote repipe", service: "plumbing" },
  { q: "water heater replacement cost", service: "plumbing" },
  { q: "sewer line replacement cost", service: "plumbing" },
  { q: "solar panel installation cost", service: "solar" },
  { q: "electrical panel upgrade cost", service: "electrical" },
  { q: "rehab cost breakdown", service: "roofing" },
  { q: "painting cost quote exterior", service: "painting" },
  { q: "foundation repair cost", service: "foundation" },
  { q: "window replacement cost", service: "windows" },
];

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

async function searchBP(query) {
  const url = `https://www.biggerpockets.com/forums/search?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml"
      },
      redirect: "follow"
    });
    if (!res.ok) return [];
    const html = await res.text();

    const paths = new Set();
    const pattern = /\/forums\/\d+\/topics\/\d+-[^"&\s<]+/g;
    let match;
    while ((match = pattern.exec(html)) !== null) {
      paths.add(match[0]);
    }
    return Array.from(paths);
  } catch (e) {
    return [];
  }
}

async function fetchThread(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml"
    },
    redirect: "follow"
  });

  if (!res.ok) return null;
  const html = await res.text();

  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/ \| BiggerPockets.*$/, "").replace(/\s+/g, " ").trim() : "";

  // Extract text content
  const bodyText = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const startIdx = Math.max(0, bodyText.indexOf(title) - 100);
  const content = bodyText.substring(startIdx, startIdx + 6000);

  const dateMatch = html.match(/datetime="(\d{4}-\d{2}-\d{2})/);
  const postDate = dateMatch ? new Date(dateMatch[1]) : null;

  return { url, title, text: content.slice(0, 5000), date: postDate };
}

async function parseWithHaiku(thread, service, apiKey) {
  const prompt = `Extract contractor quote data from this BiggerPockets forum discussion. These are real estate investors discussing actual costs. Return ONLY valid JSON, no markdown.

Title: ${thread.title}
Content: ${thread.text}

Extract ALL real quotes/costs mentioned (there may be multiple from different investors). For each, extract:
- price (number, USD, total project cost - NOT per unit)
- city (string, US city if mentioned, empty string if not)
- stateCode (string, 2-letter US state code if determinable, empty string if not)
- material (string, e.g. "architectural", "metal", "3-tab" for roofing, or equipment details for HVAC)
- roofSize (number, sqft if mentioned, 0 if not)
- warrantyYears (number, 0 if not mentioned)
- contractor (string, contractor name if mentioned, "BP investor" if not)
- service (string, one of: roofing, hvac, plumbing, solar, electrical, painting, windows, siding, concrete, fencing, foundation, kitchen, insulation)
- isRepair (boolean, true if repair not full replacement)
- confidence (string, "high" if price+location clear, "medium" if price clear but location vague, "low" if uncertain)
- notes (string, brief description)

Rules:
- Extract ACTUAL costs investors paid or were quoted, not estimated ranges or advice
- Skip non-US
- Skip repairs under $2,000
- Real estate investors often mention city/state in their posts - look for location clues
- The service is likely "${service}" but override if clearly about something else

Return JSON: { "quotes": [...] } or { "quotes": [] } if none found.`;

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || "";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { quotes: [] };
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.log("  Failed to parse Haiku response:", text.slice(0, 200));
    return { quotes: [] };
  }
}

function inflationAdjust(price, postDate) {
  if (!postDate) return price;
  const ageMs = Date.now() - postDate.getTime();
  const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
  if (ageYears > 3) return null;
  return Math.round(price * Math.pow(1 + INFLATION_RATE, ageYears));
}

async function seedQuote(quote, adminKey) {
  const res = await fetch(CALIBRATION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...quote, adminKey })
  });
  return res.json();
}

async function main() {
  const args = parseArgs();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const adminKey = process.env.CAL_ADMIN_KEY;
  const dryRun = args["dry-run"] || false;
  const maxThreads = parseInt(args["max-threads"] || "200");

  if (!apiKey) { console.log("Set ANTHROPIC_API_KEY"); process.exit(1); }
  if (!adminKey && !dryRun) { console.log("Set CAL_ADMIN_KEY (or --dry-run)"); process.exit(1); }

  const seenUrls = new Set();
  let totalThreads = 0;
  let totalQuotes = 0;
  let totalSeeded = 0;
  let totalSkipped = 0;

  console.log("BiggerPockets Forum Quote Seeder");
  console.log(`  Max threads: ${maxThreads}`);
  console.log(`  Dry run: ${dryRun}`);
  console.log("");

  // Phase 1: Process known threads
  console.log("--- Phase 1: Known threads ---");
  for (const src of THREAD_SOURCES) {
    if (totalThreads >= maxThreads) break;
    const url = `https://www.biggerpockets.com${src.path}`;
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    totalThreads++;

    console.log(`\n  [${totalThreads}] ${src.path.split("/topics/")[1] || src.path}`);
    await sleep(2500);

    let thread;
    try {
      thread = await fetchThread(url);
    } catch (e) {
      console.log(`    Fetch error: ${e.message}`);
      continue;
    }

    if (!thread || !thread.text || thread.text.length < 100) {
      console.log("    No usable content");
      continue;
    }

    if (!/\$[\d,]+/.test(thread.text)) {
      console.log("    No prices found");
      continue;
    }

    console.log(`    Title: ${thread.title.slice(0, 60)}`);
    await sleep(1500);

    let parsed;
    try {
      parsed = await parseWithHaiku(thread, src.service, apiKey);
    } catch (e) {
      console.log(`    Haiku error: ${e.message}`);
      continue;
    }

    if (!parsed.quotes || parsed.quotes.length === 0) {
      console.log("    No valid quotes");
      continue;
    }

    for (const q of parsed.quotes) {
      totalQuotes++;
      if (!q.price || q.price < 2000) { totalSkipped++; continue; }
      if (q.confidence === "low") { totalSkipped++; continue; }
      if (q.isRepair && q.price < 3000) { totalSkipped++; continue; }

      const originalPrice = q.price;
      const adjusted = inflationAdjust(q.price, thread.date);
      if (adjusted === null) { console.log("    Skip: too old"); totalSkipped++; continue; }
      q.price = adjusted;

      console.log(`    Quote: $${originalPrice.toLocaleString()}${q.price !== originalPrice ? " -> $" + q.price.toLocaleString() : ""} | ${q.city || "?"}, ${q.stateCode || "?"} | ${q.service} | ${q.confidence}`);

      if (dryRun) { totalSeeded++; continue; }

      try {
        const result = await seedQuote({
          price: q.price,
          contractor: q.contractor || "BP investor",
          city: q.city || "",
          stateCode: q.stateCode || "",
          material: q.material || "",
          roofSize: q.roofSize || 0,
          warrantyYears: q.warrantyYears || 0,
          service: q.service || src.service,
          notes: `BiggerPockets auto-seed. ${q.notes || ""}. Original: $${originalPrice}. Source: ${url}`
        }, adminKey);

        if (result.ok) { console.log(`    Seeded OK (trust: ${result.trustScore})`); totalSeeded++; }
        else { totalSkipped++; }
      } catch (e) { totalSkipped++; }
    }
  }

  // Phase 2: Search for more threads
  console.log("\n--- Phase 2: Search discovery ---");
  for (const sq of SEARCH_QUERIES) {
    if (totalThreads >= maxThreads) break;

    console.log(`\n  Searching: "${sq.q}"...`);
    await sleep(4000);

    let paths;
    try {
      paths = await searchBP(sq.q);
    } catch (e) {
      console.log(`  Search error: ${e.message}`);
      continue;
    }

    console.log(`  Found ${paths.length} threads`);

    for (const p of paths) {
      if (totalThreads >= maxThreads) break;
      const url = `https://www.biggerpockets.com${p}`;
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);
      totalThreads++;

      console.log(`\n  [${totalThreads}] ${p.split("/topics/")[1] || p}`);
      await sleep(2500);

      let thread;
      try {
        thread = await fetchThread(url);
      } catch (e) { console.log(`    Fetch error: ${e.message}`); continue; }

      if (!thread || !thread.text || thread.text.length < 100) { console.log("    No content"); continue; }
      if (!/\$[\d,]+/.test(thread.text)) { console.log("    No prices"); continue; }

      console.log(`    Title: ${thread.title.slice(0, 60)}`);
      await sleep(1500);

      let parsed;
      try {
        parsed = await parseWithHaiku(thread, sq.service, apiKey);
      } catch (e) { console.log(`    Haiku error: ${e.message}`); continue; }

      if (!parsed.quotes || parsed.quotes.length === 0) { console.log("    No valid quotes"); continue; }

      for (const q of parsed.quotes) {
        totalQuotes++;
        if (!q.price || q.price < 2000) { totalSkipped++; continue; }
        if (q.confidence === "low") { totalSkipped++; continue; }
        if (q.isRepair && q.price < 3000) { totalSkipped++; continue; }

        const originalPrice = q.price;
        const adjusted = inflationAdjust(q.price, thread.date);
        if (adjusted === null) { totalSkipped++; continue; }
        q.price = adjusted;

        console.log(`    Quote: $${originalPrice.toLocaleString()}${q.price !== originalPrice ? " -> $" + q.price.toLocaleString() : ""} | ${q.city || "?"}, ${q.stateCode || "?"} | ${q.service} | ${q.confidence}`);

        if (dryRun) { totalSeeded++; continue; }

        try {
          const result = await seedQuote({
            price: q.price,
            contractor: q.contractor || "BP investor",
            city: q.city || "",
            stateCode: q.stateCode || "",
            material: q.material || "",
            roofSize: q.roofSize || 0,
            warrantyYears: q.warrantyYears || 0,
            service: q.service || sq.service,
            notes: `BiggerPockets auto-seed. ${q.notes || ""}. Original: $${originalPrice}. Source: ${url}`
          }, adminKey);

          if (result.ok) { console.log(`    Seeded OK (trust: ${result.trustScore})`); totalSeeded++; }
          else { totalSkipped++; }
        } catch (e) { totalSkipped++; }
      }
    }
  }

  console.log("\n\n=== Summary ===");
  console.log(`Threads scanned: ${totalThreads}`);
  console.log(`Quotes found:    ${totalQuotes}`);
  console.log(`Quotes seeded:   ${totalSeeded}`);
  console.log(`Quotes skipped:  ${totalSkipped}`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
