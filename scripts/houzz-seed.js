/**
 * Houzz Forum Quote Seeder
 *
 * Searches Houzz discussion forums for contractor quote posts and uses
 * Claude Haiku to extract structured data, then seeds into calibration DB.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-xxx CAL_ADMIN_KEY=1111 node scripts/houzz-seed.js
 *
 * Options:
 *   --service=roofing      (default: cycles through roofing,hvac,plumbing,solar,electrical,painting)
 *   --max-threads=100      (default: 200)
 *   --dry-run              (parse but don't seed)
 */

const CALIBRATION_URL = "https://truepricehq.com/api/calibration";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const INFLATION_RATE = 0.03;

const SERVICES = [
  {
    name: "roofing",
    searches: [
      "roofing quote cost",
      "roof replacement cost",
      "roofing pricing",
      "new roof quote",
      "are we being ripped off roofing",
      "roof estimate fair"
    ]
  },
  {
    name: "hvac",
    searches: [
      "hvac quote cost",
      "ac replacement cost",
      "furnace replacement quote",
      "hvac estimate fair",
      "heat pump cost",
      "mini split quote"
    ]
  },
  {
    name: "plumbing",
    searches: [
      "plumbing quote cost",
      "water heater replacement cost",
      "repipe cost",
      "plumbing estimate fair",
      "sewer line cost"
    ]
  },
  {
    name: "solar",
    searches: [
      "solar panel cost",
      "solar installation quote",
      "solar estimate fair",
      "solar panel price"
    ]
  },
  {
    name: "electrical",
    searches: [
      "electrical panel upgrade cost",
      "electrician quote",
      "rewiring cost",
      "electrical estimate"
    ]
  },
  {
    name: "painting",
    searches: [
      "house painting cost",
      "exterior painting quote",
      "interior painting estimate",
      "painter quote fair"
    ]
  }
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

// Known Houzz discussion thread IDs with quote/cost discussions
// These were found via web search and can be expanded over time
const KNOWN_THREADS = [
  // Roofing
  "6093121/roof-replacement-costs",
  "5982718/cost-of-roofing-repair",
  "2589463/roofing-pricingburst-my-bubbleand-wallet",
  "2461834/approximate-cost-of-full-roof-replacement",
  "6125083/cost-for-a-new-roof",
  "4253759/are-we-being-ripped-off-with-roofing",
  "4851481/how-to-evaluate-roof-estimates",
  "5811445/roofing-replacement-issues-and-equitable-resolution",
  // HVAC
  "2428883/a-website-for-sharing-hvac-quotes-costs",
  "2306076/hvac-quotes-what-should-i-expect",
  "1548858/how-much-should-a-new-hvac-system-cost",
  "2648098/new-hvac-system-cost",
  "5180632/hvac-replacement-cost",
  "3108477/are-these-hvac-quotes-fair",
  // Plumbing
  "2117639/plumbing-costs",
  "4581934/water-heater-replacement-cost",
  "2891774/repipe-cost",
  "3674521/plumber-cost-fair",
  // Solar
  "3209845/solar-panel-installation-cost",
  "4127893/solar-quotes-comparison",
  // General
  "6242449/what-is-a-reasonable-price-to-replace-a-porch",
  "6305742/cost-of-front-porch-roof-addition",
  "2601267/anyone-give-me-an-idea-of-how-much-this-roof-repair-might-cost"
];

async function searchHouzz(query) {
  // Return known thread URLs matching the service query
  // Filter by keywords in the slug
  const keywords = query.toLowerCase().split(/\s+/);
  const matching = KNOWN_THREADS.filter(t => {
    const slug = t.split("/")[1] || "";
    return keywords.some(kw => slug.includes(kw));
  });

  // Also try to discover new threads by browsing Houzz search
  try {
    const houzzSearchUrl = `https://www.houzz.com/discussions?search=${encodeURIComponent(query)}`;
    const res = await fetch(houzzSearchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (res.ok) {
      const html = await res.text();
      const urlPattern = /\/discussions\/(\d+)\/([^"&\s<]+)/g;
      let match;
      while ((match = urlPattern.exec(html)) !== null) {
        const thread = `${match[1]}/${match[2]}`;
        if (!KNOWN_THREADS.includes(thread)) {
          matching.push(thread);
        }
      }
    }
  } catch (e) {
    // Houzz search failed, use known threads only
  }

  return [...new Set(matching)].map(t => `https://www.houzz.com/discussions/${t}`);
}

async function fetchHouzzThread(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });

  if (!res.ok) return null;

  const html = await res.text();

  // Extract title
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/ \| Houzz.*$/, "").trim() : "";

  // Extract text content from discussion posts (strip HTML tags)
  // Look for discussion body content
  const bodyText = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Get a relevant chunk (first 4000 chars of meaningful content)
  const startIdx = bodyText.indexOf(title);
  const content = startIdx >= 0
    ? bodyText.substring(startIdx, startIdx + 5000)
    : bodyText.substring(0, 5000);

  // Try to extract a date
  const dateMatch = html.match(/datetime="(\d{4}-\d{2}-\d{2})/);
  const postDate = dateMatch ? new Date(dateMatch[1]) : null;

  return {
    url,
    title,
    text: content.slice(0, 4000),
    date: postDate
  };
}

async function parseWithHaiku(thread, service, apiKey) {
  const prompt = `Extract contractor quote data from this Houzz forum discussion. Return ONLY valid JSON, no markdown.

Title: ${thread.title}
Content: ${thread.text}

Extract ALL real quotes mentioned (there may be multiple from different users). For each quote, extract:
- price (number, USD, the total project price - NOT per unit prices)
- city (string, US city if mentioned, empty string if not)
- stateCode (string, 2-letter US state code if determinable, empty string if not)
- material (string, e.g. "architectural", "metal", "tile" for roofing, or equipment details for HVAC)
- roofSize (number, in sqft if mentioned, 0 if not - for roofing only)
- warrantyYears (number, workmanship warranty years, 0 if not mentioned)
- contractor (string, contractor name if mentioned, "Houzz poster" if not)
- service (string, one of: roofing, hvac, plumbing, solar, electrical, painting, windows, siding, concrete, fencing)
- isRepair (boolean, true if this is a repair not a full replacement/installation)
- confidence (string, "high" if price+location are clear, "medium" if price is clear but location vague, "low" if uncertain)
- notes (string, brief description of the job)

Rules:
- Only extract ACTUAL quotes homeowners received, not general advice or estimated ranges from commenters
- Skip non-US quotes
- Skip repairs under $2,000
- The service type is likely "${service}" based on the search, but override if the post is clearly about something else
- If the post mentions a US state or region but not a specific city, use the largest city in that state/region

Return JSON: { "quotes": [...] } or { "quotes": [] } if no valid quotes found.`;

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
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
  if (!postDate) return price; // No date, assume recent
  const ageMs = Date.now() - postDate.getTime();
  const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
  if (ageYears > 3) return null; // Too old, skip
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
  const targetService = args["service"] || null;

  if (!apiKey) { console.log("Set ANTHROPIC_API_KEY"); process.exit(1); }
  if (!adminKey && !dryRun) { console.log("Set CAL_ADMIN_KEY (or use --dry-run)"); process.exit(1); }

  const services = targetService
    ? SERVICES.filter(s => s.name === targetService)
    : SERVICES;

  if (services.length === 0) { console.log("Unknown service:", targetService); process.exit(1); }

  const seenUrls = new Set();
  let totalThreads = 0;
  let totalQuotes = 0;
  let totalSeeded = 0;
  let totalSkipped = 0;

  console.log("Houzz Forum Quote Seeder");
  console.log(`  Services: ${services.map(s => s.name).join(", ")}`);
  console.log(`  Max threads: ${maxThreads}`);
  console.log(`  Dry run: ${dryRun}`);
  console.log("");

  for (const svc of services) {
    console.log(`\n--- ${svc.name} ---`);

    for (const query of svc.searches) {
      if (totalThreads >= maxThreads) break;

      console.log(`  Searching: "${query}"...`);
      await sleep(3000); // Respect Google rate limits

      let urls;
      try {
        urls = await searchHouzz(query);
      } catch (e) {
        console.log(`  Search error: ${e.message}`);
        continue;
      }

      console.log(`  Found ${urls.length} threads`);

      for (const url of urls) {
        if (seenUrls.has(url)) continue;
        seenUrls.add(url);
        totalThreads++;
        if (totalThreads > maxThreads) break;

        console.log(`\n  [${totalThreads}] ${url}`);
        await sleep(2000); // Rate limit Houzz fetches

        let thread;
        try {
          thread = await fetchHouzzThread(url);
        } catch (e) {
          console.log(`    Fetch error: ${e.message}`);
          continue;
        }

        if (!thread || !thread.text || thread.text.length < 100) {
          console.log("    No usable content");
          continue;
        }

        // Check for dollar amounts
        if (!/\$[\d,]+/.test(thread.text)) {
          console.log("    No prices found in text");
          continue;
        }

        console.log(`    Title: ${thread.title.slice(0, 60)}`);
        await sleep(1500); // Rate limit Haiku calls

        let parsed;
        try {
          parsed = await parseWithHaiku(thread, svc.name, apiKey);
        } catch (e) {
          console.log(`    Haiku error: ${e.message}`);
          continue;
        }

        if (!parsed.quotes || parsed.quotes.length === 0) {
          console.log("    No valid quotes found");
          continue;
        }

        for (const q of parsed.quotes) {
          totalQuotes++;

          if (!q.price || q.price < 2000) {
            console.log(`    Skip: price too low ($${q.price})`);
            totalSkipped++;
            continue;
          }
          if (q.confidence === "low") {
            console.log("    Skip: low confidence");
            totalSkipped++;
            continue;
          }
          if (q.isRepair && q.price < 3000) {
            console.log(`    Skip: small repair ($${q.price})`);
            totalSkipped++;
            continue;
          }

          // Inflation adjust
          const originalPrice = q.price;
          const adjusted = inflationAdjust(q.price, thread.date);
          if (adjusted === null) {
            console.log(`    Skip: post too old (>3 years)`);
            totalSkipped++;
            continue;
          }
          q.price = adjusted;

          const label = `$${originalPrice.toLocaleString()}${q.price !== originalPrice ? " -> $" + q.price.toLocaleString() + " (adj)" : ""} | ${q.city || "?"}, ${q.stateCode || "?"} | ${q.service} | ${q.confidence}`;
          console.log(`    Quote: ${label}`);

          if (dryRun) {
            console.log("    [DRY RUN] Would seed");
            totalSeeded++;
            continue;
          }

          try {
            const result = await seedQuote({
              price: q.price,
              contractor: q.contractor || "Houzz poster",
              city: q.city || "",
              stateCode: q.stateCode || "",
              material: q.material || "",
              roofSize: q.roofSize || 0,
              warrantyYears: q.warrantyYears || 0,
              service: q.service || svc.name,
              notes: `Houzz forum auto-seed. ${q.notes || ""}. Original: $${originalPrice}. Source: ${url}`
            }, adminKey);

            if (result.ok) {
              console.log(`    Seeded OK (trust: ${result.trustScore})`);
              totalSeeded++;
            } else {
              console.log("    Seed failed:", result);
              totalSkipped++;
            }
          } catch (e) {
            console.log(`    Seed error: ${e.message}`);
            totalSkipped++;
          }
        }
      }
    }
  }

  console.log("\n\n=== Summary ===");
  console.log(`Threads scanned: ${totalThreads}`);
  console.log(`Quotes found:    ${totalQuotes}`);
  console.log(`Quotes seeded:   ${totalSeeded}`);
  console.log(`Quotes skipped:  ${totalSkipped}`);
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
