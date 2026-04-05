/**
 * Reddit Quote Seeder
 *
 * Searches Reddit for contractor quote posts and uses Claude Haiku
 * to extract structured data, then seeds into the calibration DB.
 *
 * Uses public Reddit JSON feeds (no API key needed).
 * Rate limited to ~8 req/min to be respectful.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-xxx CAL_ADMIN_KEY=1111 node scripts/reddit-seed.js
 *
 * Options:
 *   --subreddit=roofing     (default: cycles through roofing,hvac,plumbing,solar)
 *   --max-posts=100         (default: 500)
 *   --max-age-days=730      (default: 730, i.e. 2 years)
 *   --dry-run               (parse but don't seed)
 */

const fs = require("fs");
const path = require("path");

const CALIBRATION_URL = "https://truepricehq.com/api/calibration";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const INFLATION_RATE = 0.03; // 3% annual

const SUBREDDITS = [
  // Home services
  { name: "roofing", service: "roofing" },
  { name: "hvac", service: "hvac" },
  { name: "hvacadvice", service: "hvac" },
  { name: "plumbing", service: "plumbing" },
  { name: "solar", service: "solar" },
  { name: "HomeImprovement", service: "general" },
  { name: "electricians", service: "electrical" },
  { name: "askanelectrician", service: "electrical" },
  { name: "landscaping", service: "landscaping" },
  { name: "Concrete", service: "concrete" },
  { name: "Fencing", service: "fencing" },
  { name: "painting", service: "painting" },
  { name: "GarageDoorService", service: "garage-doors" },
  { name: "KitchenRemodel", service: "kitchen" },
  { name: "homeowners", service: "general" },
  // Auto repair
  { name: "MechanicAdvice", service: "auto-repair" },
  { name: "autorepair", service: "auto-repair" },
  { name: "Cartalk", service: "auto-repair" },
  { name: "AskMechanics", service: "auto-repair" },
  // Medical bills
  { name: "personalfinance", service: "medical" },
  { name: "HealthInsurance", service: "medical" },
  { name: "MedicalBill", service: "medical" },
  { name: "Insurance", service: "medical" },
  // Legal fees
  { name: "legaladvice", service: "legal" },
  { name: "Ask_Lawyers", service: "legal" },
  { name: "legal", service: "legal" }
];

const SEARCH_TERMS = ["quote", "quoted", "estimate", "bid", "price", "cost", "paid"];

const SEEDED_IDS_PATH = path.join(__dirname, "..", "data", "seeded-reddit-ids.json");

function loadSeededIds() {
  try {
    return new Set(JSON.parse(fs.readFileSync(SEEDED_IDS_PATH, "utf8")));
  } catch (e) {
    return new Set();
  }
}

function saveSeededIds(ids) {
  fs.writeFileSync(SEEDED_IDS_PATH, JSON.stringify([...ids], null, 0));
}

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

async function fetchRedditJSON(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "TruePrice-QuoteSeed/1.0 (research; truepricehq.com)"
    }
  });
  if (!res.ok) {
    if (res.status === 429) {
      console.log("  Rate limited, waiting 60s...");
      await sleep(60000);
      return fetchRedditJSON(url);
    }
    throw new Error(`Reddit HTTP ${res.status}: ${url}`);
  }
  return res.json();
}

async function searchSubreddit(subreddit, query, after, maxAgeDays) {
  const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=on&sort=new&t=all&limit=25${after ? "&after=" + after : ""}`;
  const data = await fetchRedditJSON(url);

  if (!data || !data.data || !data.data.children) return { posts: [], after: null };

  const cutoff = Date.now() / 1000 - (maxAgeDays * 86400);
  const posts = data.data.children
    .filter(c => c.kind === "t3" && c.data.selftext && c.data.created_utc > cutoff)
    .map(c => ({
      id: c.data.id,
      title: c.data.title || "",
      text: (c.data.selftext || "").slice(0, 4000),
      created: c.data.created_utc,
      subreddit: c.data.subreddit,
      url: `https://reddit.com${c.data.permalink}`
    }))
    .filter(p => /\$[\d,]+/.test(p.title + " " + p.text)); // Must contain a dollar amount

  return { posts, after: data.data.after };
}

async function parseWithHaiku(post, service, apiKey) {
  const prompt = `Extract contractor quote data from this Reddit post. Return ONLY valid JSON, no markdown.

Post from r/${post.subreddit}:
Title: ${post.title}
Body: ${post.text}

Extract ALL quotes mentioned (there may be multiple). For each quote, extract:
- price (number, USD, the total project price - NOT per unit or per sqft prices)
- city (string, US city if mentioned, empty string if not)
- stateCode (string, 2-letter US state code if determinable, empty string if not)
- material (string, e.g. "architectural", "metal", "tile", "3-tab", or equipment model for HVAC)
- roofSize (number, in sqft if mentioned, 0 if not - for roofing only)
- warrantyYears (number, workmanship warranty years, 0 if not mentioned)
- contractor (string, contractor name if mentioned, "Reddit poster" if not)
- service (string, one of: roofing, hvac, plumbing, solar, electrical, insulation, windows, painting)
- isRepair (boolean, true if this is a repair not a full replacement/installation)
- confidence (string, "high" if price+location are clear, "medium" if price is clear but location vague, "low" if uncertain)
- notes (string, brief description of the job)

Rules:
- Only extract ACTUAL quotes the poster received, not averages, estimates from commenters, or hypothetical prices
- Skip non-US quotes
- Skip repair jobs under $2,000
- The service type is likely "${service}" based on the subreddit, but override if the post is clearly about something else
- If the post mentions a US state or region but not a specific city, use the largest city in that state/region for the city field

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
    throw new Error(`Anthropic API ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || "";

  try {
    // Extract JSON from response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { quotes: [] };
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.log("  Failed to parse Haiku response:", text.slice(0, 200));
    return { quotes: [] };
  }
}

function inflationAdjust(price, postTimestamp) {
  const ageMs = Date.now() - (postTimestamp * 1000);
  const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
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
  const maxPosts = parseInt(args["max-posts"] || "500");
  const maxAgeDays = parseInt(args["max-age-days"] || "730");
  const targetSubreddit = args["subreddit"] || null;

  if (!apiKey) {
    console.log("Set ANTHROPIC_API_KEY environment variable.");
    process.exit(1);
  }
  if (!adminKey && !dryRun) {
    console.log("Set CAL_ADMIN_KEY environment variable (or use --dry-run).");
    process.exit(1);
  }

  const subreddits = targetSubreddit
    ? SUBREDDITS.filter(s => s.name.toLowerCase() === targetSubreddit.toLowerCase())
    : SUBREDDITS;

  if (subreddits.length === 0) {
    console.log("Unknown subreddit:", targetSubreddit);
    process.exit(1);
  }

  const seenIds = new Set();
  const seededIds = loadSeededIds();
  console.log(`  Previously seeded: ${seededIds.size} posts`);
  let totalPosts = 0;
  let totalQuotes = 0;
  let totalSeeded = 0;
  let totalSkipped = 0;

  console.log(`Reddit Quote Seeder`);
  console.log(`  Subreddits: ${subreddits.map(s => "r/" + s.name).join(", ")}`);
  console.log(`  Max posts: ${maxPosts}`);
  console.log(`  Max age: ${maxAgeDays} days`);
  console.log(`  Dry run: ${dryRun}`);
  console.log("");

  for (const sub of subreddits) {
    console.log(`\n--- r/${sub.name} (service: ${sub.service}) ---`);

    for (const term of SEARCH_TERMS) {
      if (totalPosts >= maxPosts) break;

      let after = null;
      let pages = 0;
      const maxPages = Math.ceil((maxPosts / subreddits.length / SEARCH_TERMS.length) / 25);

      while (pages < maxPages && totalPosts < maxPosts) {
        console.log(`  Searching "${term}" page ${pages + 1}...`);

        let result;
        try {
          result = await searchSubreddit(sub.name, term, after, maxAgeDays);
        } catch (e) {
          console.log(`  Error: ${e.message}`);
          break;
        }

        if (result.posts.length === 0) break;

        for (const post of result.posts) {
          if (seenIds.has(post.id)) continue;
          seenIds.add(post.id);
          if (seededIds.has(post.id)) {
            console.log(`\n  [skip] ${post.title.slice(0, 50)}... (already seeded)`);
            continue;
          }
          totalPosts++;

          if (totalPosts >= maxPosts) break;

          console.log(`\n  [${totalPosts}] ${post.title.slice(0, 60)}...`);
          console.log(`       ${post.url}`);

          // Rate limit: wait between Haiku calls
          await sleep(1500);

          let parsed;
          try {
            parsed = await parseWithHaiku(post, sub.service, apiKey);
          } catch (e) {
            console.log(`       Haiku error: ${e.message}`);
            continue;
          }

          if (!parsed.quotes || parsed.quotes.length === 0) {
            console.log("       No valid quotes found.");
            continue;
          }

          for (const q of parsed.quotes) {
            totalQuotes++;

            // Filter
            var minPrice = (sub.service === "auto-repair" || sub.service === "medical" || sub.service === "legal") ? 200 : 2000;
            if (!q.price || q.price < minPrice) {
              console.log(`       Skip: price too low ($${q.price})`);
              totalSkipped++;
              continue;
            }
            if (q.confidence === "low") {
              console.log(`       Skip: low confidence`);
              totalSkipped++;
              continue;
            }
            var minRepair = (sub.service === "auto-repair") ? 200 : 3000;
            if (q.isRepair && q.price < minRepair) {
              console.log(`       Skip: small repair ($${q.price})`);
              totalSkipped++;
              continue;
            }

            // Inflation adjust
            const originalPrice = q.price;
            q.price = inflationAdjust(q.price, post.created);

            const label = `$${originalPrice.toLocaleString()}${q.price !== originalPrice ? " -> $" + q.price.toLocaleString() + " (adj)" : ""} | ${q.city || "?"}, ${q.stateCode || "?"} | ${q.service} | ${q.confidence}`;
            console.log(`       Quote: ${label}`);

            if (dryRun) {
              console.log("       [DRY RUN] Would seed this quote.");
              totalSeeded++;
              seededIds.add(post.id);
              continue;
            }

            try {
              const seedResult = await seedQuote({
                price: q.price,
                contractor: q.contractor || "Reddit poster",
                city: q.city || "",
                stateCode: q.stateCode || "",
                material: q.material || "",
                roofSize: q.roofSize || 0,
                warrantyYears: q.warrantyYears || 0,
                service: q.service || sub.service,
                notes: `Reddit r/${post.subreddit} auto-seed. ${q.notes || ""}. Original price: $${originalPrice}. Post: ${post.url}`
              }, adminKey);

              if (seedResult.ok) {
                console.log(`       Seeded OK (trust: ${seedResult.trustScore})`);
                totalSeeded++;
                seededIds.add(post.id);
                if (totalSeeded % 5 === 0) saveSeededIds(seededIds);
              } else {
                console.log(`       Seed failed:`, seedResult);
                totalSkipped++;
              }
            } catch (e) {
              console.log(`       Seed error: ${e.message}`);
              totalSkipped++;
            }
          }
        }

        after = result.after;
        if (!after) break;
        pages++;

        // Rate limit between Reddit pages
        await sleep(8000);
      }
    }
  }

  saveSeededIds(seededIds);
  console.log("\n\n=== Summary ===");
  console.log(`Posts scanned:  ${totalPosts}`);
  console.log(`Quotes found:  ${totalQuotes}`);
  console.log(`Quotes seeded: ${totalSeeded}`);
  console.log(`Quotes skipped: ${totalSkipped}`);
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
