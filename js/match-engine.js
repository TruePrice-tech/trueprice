// Woogoro Match Engine — single source of truth for query→page matching.
//
// Same module is used by:
//   1. /404.html — "Did you mean…?" routing on bad URLs
//   2. js/vertical-detect.js — OCR text → vertical (existing flow, now delegates here)
//   3. api/discovery-scan.js — server-side classifier for the weekly discovery cron
//      (Node imports this file; the WoogoroMatch global doubles as module.exports)
//
// Why one engine: vertical patterns were previously duplicated across 4 files
// (vertical-detect.js, aggregate-and-filter.js, harvest-bing.js, this 404 script).
// Adding a new vertical meant touching all four. Now: touch this file.
//
// Pure-pattern matching only — no Redis, no network. Safe to ship to the client.

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.WoogoroMatch = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ---- Vertical patterns ---------------------------------------------------
  // Order matters: longer/more-specific phrases first so they win on tie.
  var VERTICALS = [
    {
      name: "hvac",
      patterns: /\b(hvac|heat pump|air condition|a\/c|ac unit|ac install|ac replac|furnace|mini.?split|seer|tonnage|condenser|air handler|refrigerant|ductwork|hvac install|hvac replac)\b/i,
      estimatePage: "/hvac-estimate.html",
      analyzerPage: "/hvac-quote-analyzer.html",
      sizePage: "/hvac-cost-by-home-size.html",
    },
    {
      name: "plumbing",
      // Stems use \w* so plumb, plumber, plumbing, plumbed all match.
      patterns: /\b(plumb\w*|water heater|tankless|repipe\w*|sewer line|drain clog|toilet replac\w*|faucet|fixture|garbage disposal|sump pump|pex|copper pipe)\b/i,
      estimatePage: "/plumbing-estimate.html",
      analyzerPage: "/plumbing-quote-analyzer.html",
      sizePage: null,
    },
    {
      name: "roofing",
      patterns: /\b(roof\w*|shingle\w*|tear.?off|underlayment|flashing|ridge vent|3.?tab|architectural shingle|metal roof|standing seam|tile roof|cedar shake|re.?roof\w*)\b/i,
      estimatePage: "/roofing-quote-analyzer.html?mode=estimator",
      analyzerPage: "/roofing-quote-analyzer.html",
      sizePage: "/roofing-cost-by-home-size.html",
    },
    {
      name: "electrical",
      patterns: /\b(electric\w*|panel upgrade|amp service|circuit breaker|rewire\w*|ev charger|generator install|electrical panel|romex|conduit|outlet install|switch install)\b/i,
      estimatePage: "/electrical-estimate.html",
      analyzerPage: "/electrical-quote-analyzer.html",
      sizePage: null,
    },
    {
      name: "solar",
      patterns: /\b(solar panel\w*|solar install\w*|photovoltaic|net meter|sunpower|enphase|microinverter|solar array|pv system|solar power|solar cost\w*)\b/i,
      estimatePage: "/solar-estimate.html",
      analyzerPage: "/solar-quote-analyzer.html",
      sizePage: null,
    },
    {
      name: "windows",
      patterns: /\b(windows?|window replac\w*|new window\w*|double.?hung|casement|low.?e|argon|pella|andersen|egress window|bay window|window install\w*|window unit\w*)\b/i,
      estimatePage: "/windows-estimate.html",
      analyzerPage: "/window-quote-analyzer.html",
      sizePage: null,
    },
    {
      name: "siding",
      patterns: /\b(siding|hardie|vinyl siding|fiber cement|lap siding|housewrap|exterior clad\w*|stucco|lp smartside|cedar siding)\b/i,
      estimatePage: "/siding-estimate.html",
      analyzerPage: "/siding-quote-analyzer.html",
      sizePage: "/siding-cost-by-home-size.html",
    },
    {
      name: "painting",
      patterns: /\b(paint\w*|primer|coat of paint|sherwin|benjamin moore|eggshell|wall paint\w*|ceiling paint\w*|exterior paint\w*|interior paint\w*|cabinet paint\w*|trim paint\w*)\b/i,
      estimatePage: "/painting-estimate.html",
      analyzerPage: "/painting-quote-analyzer.html",
      sizePage: "/painting-cost-by-home-size.html",
    },
    {
      name: "garage-doors",
      patterns: /\b(garage door\w*|garage opener\w*|torsion spring|extension spring|garage panel|roll.?up door|carriage door|overhead door|liftmaster)\b/i,
      estimatePage: "/garage-door-estimate.html",
      analyzerPage: "/garage-door-quote-analyzer.html",
      sizePage: null,
    },
    {
      name: "fencing",
      patterns: /\b(fenc\w*|post hole|picket|chain.?link|gate install\w*|cedar fence\w*|vinyl fence\w*|wrought iron fence\w*|privacy fence\w*|wood fence\w*)\b/i,
      estimatePage: "/fencing-estimate.html",
      analyzerPage: "/fencing-quote-analyzer.html",
      sizePage: null,
    },
    {
      name: "concrete",
      patterns: /\b(concrete|driveway|patio pour|sidewalk|slab pour|stamped concrete|rebar|footing|flatwork|concrete pad|curb)\b/i,
      estimatePage: "/concrete-estimate.html",
      analyzerPage: "/concrete-quote-analyzer.html",
      sizePage: null,
    },
    {
      name: "landscaping",
      patterns: /\b(landscap\w*|hardscap\w*|paver\w*|retaining wall|irrigation|sprinkler\w*|sod|mulch|grading|drainage|turf)\b/i,
      estimatePage: "/landscaping-estimate.html",
      analyzerPage: "/landscaping-quote-analyzer.html",
      sizePage: null,
    },
    {
      name: "foundation",
      patterns: /\b(foundation|pier and beam|underpin\w*|helical pier|crawlspace\w*|slab repair|crack repair|waterproof\w*|french drain|mudjack\w*|basement repair)\b/i,
      estimatePage: "/foundation-estimate.html",
      analyzerPage: "/foundation-quote-analyzer.html",
      sizePage: null,
    },
    {
      name: "insulation",
      patterns: /\b(insulat\w*|blown.?in|spray foam|batt insulation|r.?value|attic insulat\w*|cellulose|fiberglass batt|radiant barrier|vapor barrier|attic seal\w*)\b/i,
      estimatePage: "/insulation-estimate.html",
      analyzerPage: "/insulation-quote-analyzer.html",
      sizePage: null,
    },
    {
      name: "gutters",
      patterns: /\b(gutter\w*|downspout\w*|seamless|leaf guard|rain gutter\w*|fascia board)\b/i,
      estimatePage: "/gutters-estimate.html",
      analyzerPage: "/gutters-quote-analyzer.html",
      sizePage: null,
    },
    {
      name: "kitchen",
      patterns: /\b(kitchen remodel|kitchen renovation|kitchen cabinet|countertop|backsplash|granite|quartz countertop|kitchen island|kitchen install)\b/i,
      estimatePage: "/kitchen-estimate.html",
      analyzerPage: "/kitchen-quote-analyzer.html",
      sizePage: null,
    },
    {
      name: "moving",
      patterns: /\b(moving|movers|moving company|packing service|loading service|interstate move|local move|storage unit|moving estimate|usdot|piano mover)\b/i,
      estimatePage: "/moving-estimate.html",
      analyzerPage: "/moving-quote-analyzer.html",
      sizePage: null,
    },
    {
      name: "auto-repair",
      patterns: /\b(auto repair|car repair|brake (pad|job|rotor)|transmission repair|alternator|spark plug|timing belt|engine repair|muffler|exhaust|catalytic|cv axle|mechanic|wheel bearing|oil change)\b/i,
      estimatePage: "/auto-repair.html",
      analyzerPage: "/auto-repair.html?mode=quote",
      sizePage: null,
    },
    {
      name: "medical",
      patterns: /\b(medical bill|hospital bill|surgery cost|er bill|emergency room|insurance claim|medical claim|deductible|coinsurance|hospital pricing|medical procedure|cataract|lasik|bariatric)\b/i,
      estimatePage: "/medical-bill-analyzer.html",
      analyzerPage: "/medical-bill-analyzer.html",
      sizePage: null,
    },
    {
      name: "legal",
      patterns: /\b(lawyer|attorney|legal fee|divorce lawyer|estate planning|probate|criminal lawyer|immigration lawyer|legal retainer|hourly rate attorney)\b/i,
      estimatePage: "/legal-fee-analyzer.html",
      analyzerPage: "/legal-fee-analyzer.html",
      sizePage: null,
    },
  ];

  // ---- Modifier signals ----------------------------------------------------
  // These are detected on top of the vertical match and steer to a more
  // specific page when one exists.
  var MODIFIERS = {
    sqft: /\b(sq ?ft|square foot|square feet|home size|house size|by size|\d{3,4} ?(sq ?ft|square foot))\b/i,
    quote: /\b(quote|estimate analyz|analyze quote|review quote|check quote|is my quote)\b/i,
    estimate: /\b(estimate|calculator|how much|cost of|average cost|typical cost|cost to)\b/i,
    nearMe: /\bnear me\b/i,
    perUnit: /\bper (square foot|sq ?ft|linear foot|hour|gallon|kwh)\b/i,
  };

  // ---- Intent classification -----------------------------------------------
  function classifyIntent(text) {
    var t = text.toLowerCase();
    if (/\b(quote|estimate|analyz|calculator|near me|hire|book|schedule)\b/.test(t)) return "transactional";
    if (/\b(cost|price|how much|average|typical|per (sq|linear|hour))\b/.test(t)) return "commercial";
    if (/\b(what|why|when|how to|why is|when should|why does)\b/.test(t)) return "informational";
    return "commercial"; // default — most pricing-platform queries are commercial
  }

  // ---- Slug → text normalization -------------------------------------------
  // Input may be a URL slug like "/how-much-hvac-cost-1500-sqft.html". Strip
  // path/extension/separators so the matcher sees something resembling natural text.
  function normalize(input) {
    if (!input) return "";
    var s = String(input);
    // Drop query string and fragment
    s = s.split("?")[0].split("#")[0];
    // Drop leading slashes and .html extension
    s = s.replace(/^\/+/, "").replace(/\.html?$/i, "");
    // Slugified URLs use - and _ as separators
    s = s.replace(/[-_/]+/g, " ");
    // Strip extra punctuation, collapse whitespace
    s = s.replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
    return s;
  }

  // ---- Confidence scoring --------------------------------------------------
  // Base 0. Vertical detected: +60. Intent classified: +15. Modifier match
  // pointing to a specific page: +15. Multiple vertical signals: +10.
  // Capped at 100.
  function scoreMatch(textLower, vertical, hits, modifiers) {
    var score = 0;
    if (vertical) score += 60;
    if (hits >= 2) score += 10;
    if (modifiers.sqft || modifiers.perUnit) score += 15;
    if (modifiers.estimate || modifiers.quote) score += 15;
    return Math.min(100, score);
  }

  // ---- Main entry point ----------------------------------------------------
  function match(input) {
    var text = normalize(input);
    var lower = text.toLowerCase();

    var bestVertical = null;
    var bestHits = 0;
    var allMatches = [];

    for (var i = 0; i < VERTICALS.length; i++) {
      var v = VERTICALS[i];
      var matches = lower.match(v.patterns);
      if (matches && matches.length > 0) {
        allMatches.push({ vertical: v, hits: matches.length });
        if (matches.length > bestHits) {
          bestVertical = v;
          bestHits = matches.length;
        }
      }
    }

    var modifiers = {};
    for (var key in MODIFIERS) {
      if (MODIFIERS[key].test(lower)) modifiers[key] = true;
    }

    var intent = classifyIntent(lower);

    if (!bestVertical) {
      return {
        vertical: null,
        intent: intent,
        confidence: 0,
        matchedPage: null,
        matchReason: "no_vertical_match",
        fallbackPage: "/",
        gapType: lower.length > 0 ? "out_of_scope" : "empty_input",
        tokens: lower.split(" ").filter(Boolean),
      };
    }

    // Pick the most specific page available for this vertical+modifier combo
    var matchedPage = null;
    var matchReason = "vertical_only";

    if (modifiers.sqft && bestVertical.sizePage) {
      matchedPage = bestVertical.sizePage;
      matchReason = "vertical+sqft";
    } else if (modifiers.quote && bestVertical.analyzerPage) {
      matchedPage = bestVertical.analyzerPage;
      matchReason = "vertical+quote_intent";
    } else if (modifiers.estimate || intent === "commercial") {
      matchedPage = bestVertical.estimatePage;
      matchReason = "vertical+estimate_intent";
    } else {
      matchedPage = bestVertical.estimatePage;
      matchReason = "vertical_default";
    }

    var confidence = scoreMatch(lower, bestVertical, bestHits, modifiers);

    // Gap detection: a strong vertical match with a sqft modifier but no
    // size page means we should hand-write one.
    var gapType = null;
    if (modifiers.sqft && !bestVertical.sizePage && confidence >= 60) {
      gapType = "consider_size_page_" + bestVertical.name;
    }

    return {
      vertical: bestVertical.name,
      intent: intent,
      confidence: confidence,
      matchedPage: matchedPage,
      matchReason: matchReason,
      fallbackPage: bestVertical.estimatePage,
      gapType: gapType,
      tokens: lower.split(" ").filter(Boolean),
      modifiers: Object.keys(modifiers),
    };
  }

  return {
    match: match,
    normalize: normalize,
    verticals: VERTICALS.map(function (v) { return v.name; }),  // for tests/discovery
  };
});
