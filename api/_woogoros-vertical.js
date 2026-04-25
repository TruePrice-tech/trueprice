// /api/_woogoros-vertical.js
//
// Vertical classification + sanity check for user submissions.
//
// On submit, the user declares which vertical the quote/receipt belongs
// to (UI dropdown). We score the OCR text against per-vertical keyword
// dictionaries and:
//   1. Verify the declared vertical is plausible given the text. If the
//      score is zero, the submission is flagged "vertical_mismatch" and
//      held for review (no Woo grant).
//   2. Suggest the best-scoring vertical when the user picks "unsure",
//      so the orchestrator can attribute the right Woogoro.
//
// This is intentionally simple: keyword presence + count, no ML. It's
// good enough for Phase 2 anti-fraud (catches the obvious "I claimed
// roofing but uploaded a Walmart grocery receipt" case). Theia's
// receipt LoRA will replace this for receipts; quote text stays here.

export const VERTICALS = [
  "roofing", "hvac", "plumbing", "electrical", "windows", "siding",
  "gutters", "insulation", "painting", "concrete", "foundation",
  "fencing", "garage_door", "landscaping", "kitchen", "solar",
  "moving", "auto_repair", "medical", "legal",
];

const VERTICAL_LABELS = {
  roofing: "Roofing", hvac: "HVAC", plumbing: "Plumbing",
  electrical: "Electrical", windows: "Windows", siding: "Siding",
  gutters: "Gutters", insulation: "Insulation", painting: "Painting",
  concrete: "Concrete", foundation: "Foundation", fencing: "Fencing",
  garage_door: "Garage Door", landscaping: "Landscaping",
  kitchen: "Kitchen Remodel", solar: "Solar", moving: "Moving",
  auto_repair: "Auto Repair", medical: "Medical", legal: "Legal",
};

// Each vertical: words/phrases that strongly indicate this vertical was
// the subject of the quote or receipt. Lowercased, matched as whole
// words via word-boundary regex. Multi-word phrases match as substrings.
const KEYWORDS = {
  roofing: ["roof", "shingle", "shingles", "underlayment", "ridge cap", "asphalt roof", "metal roof", "tile roof", "drip edge", "rafter", "decking", "tearoff", "tear-off", "flashing"],
  hvac: ["hvac", "furnace", "air conditioner", "ac unit", "ac install", "heat pump", "thermostat", "ductwork", "duct work", "mini split", "mini-split", "evaporator", "condenser", "compressor", "refrigerant", "freon", "btu", "ton ac", "seer"],
  plumbing: ["plumb", "plumbing", "pipe", "pex", "copper pipe", "drain", "sewer", "faucet", "toilet", "water heater", "tankless", "valve", "p-trap", "p trap", "rooter", "snake", "leak"],
  electrical: ["electric", "electrical", "wire", "wiring", "breaker", "panel", "subpanel", "outlet", "receptacle", "fixture", "ev charger", "ev charging", "circuit", "amp service", "amperage", "gfci", "afci", "rewire"],
  windows: ["window", "windows", "double hung", "casement", "sash", "glazing", "glass replacement", "vinyl window", "wood window", "bay window", "bow window", "egress window"],
  siding: ["siding", "vinyl siding", "fiber cement", "hardie", "hardieboard", "lap siding", "board and batten", "stucco", "wood siding", "soffit", "fascia"],
  gutters: ["gutter", "gutters", "downspout", "leaf guard", "leafguard", "gutter guard", "k-style", "half round", "fascia gutter"],
  insulation: ["insulation", "blown in", "blown-in", "spray foam", "spray-foam", "fiberglass batt", "rockwool", "cellulose", "r-value", "rvalue", "attic insulation", "wall insulation"],
  painting: ["paint", "painting", "primer", "sherwin", "sherwin-williams", "behr", "benjamin moore", "interior paint", "exterior paint", "stain", "drywall paint"],
  concrete: ["concrete", "driveway", "sidewalk", "patio", "stamped concrete", "broom finish", "rebar", "footing", "slab"],
  foundation: ["foundation", "pier", "piering", "slabjacking", "mudjacking", "wall stabilization", "crack injection", "underpinning", "settling"],
  fencing: ["fence", "fencing", "wood fence", "vinyl fence", "chain link", "chainlink", "aluminum fence", "wrought iron", "post hole", "picket"],
  garage_door: ["garage door", "garage opener", "torsion spring", "extension spring", "garage door opener", "liftmaster", "chamberlain"],
  landscaping: ["landscape", "landscaping", "sod", "mulch", "retaining wall", "paver", "pavers", "sprinkler", "irrigation", "tree removal", "stump grind", "lawn install"],
  kitchen: ["kitchen", "cabinet", "cabinets", "countertop", "quartz", "granite countertop", "backsplash", "kitchen island", "kitchen remodel"],
  solar: ["solar", "solar panel", "solar panels", "photovoltaic", "pv system", "tesla powerwall", "enphase", "sunrun", "sunpower"],
  moving: ["moving", "movers", "u-haul", "uhaul", "two men", "atlas van", "mayflower", "long distance move", "local move", "packing service"],
  auto_repair: ["auto repair", "mechanic", "brake", "brakes", "rotor", "rotors", "transmission", "alternator", "starter", "spark plug", "oil change", "tune up", "tune-up", "diagnostic fee", "labor hours", "engine repair", "tire", "tires", "wheel alignment", "alignment"],
  medical: ["copay", "co-pay", "deductible", "icd", "icd-10", "cpt code", "cpt-", "patient responsibility", "claim", "explanation of benefits", "eob", "billing dept", "anesthesia", "radiology", "pathology"],
  legal: ["retainer", "billable hours", "attorney fee", "law firm", "esq", "esq.", "trust account", "filing fee", "court fee", "deposition"],
};

// Merchants that strongly skew toward home services in general. We use
// these to tip-the-scales when the line items are ambiguous.
const HOME_IMPROVEMENT_MERCHANTS = [
  "home depot", "homedepot", "lowes", "lowe's", "menards", "ace hardware",
  "ferguson", "harbor freight", "hd supply",
];

const AUTO_MERCHANTS = [
  "autozone", "advance auto", "o'reilly", "oreilly", "napa", "pep boys",
  "jiffy lube", "valvoline", "midas", "meineke", "firestone",
];

function lowerText(text) {
  return String(text || "").toLowerCase();
}

function countMatches(text, words) {
  const t = lowerText(text);
  let count = 0;
  for (const w of words) {
    const wl = w.toLowerCase();
    if (wl.includes(" ")) {
      // Phrase match (substring)
      let i = 0;
      while ((i = t.indexOf(wl, i)) !== -1) { count++; i += wl.length; }
    } else {
      // Word boundary match
      const re = new RegExp("\\b" + wl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "g");
      const m = t.match(re);
      if (m) count += m.length;
    }
  }
  return count;
}

export function scoreVerticals(text) {
  const t = lowerText(text);
  const scores = {};
  for (const v of VERTICALS) {
    scores[v] = countMatches(t, KEYWORDS[v] || []);
  }

  // Merchant nudges
  const homeImpr = HOME_IMPROVEMENT_MERCHANTS.some((m) => t.includes(m));
  const isAuto = AUTO_MERCHANTS.some((m) => t.includes(m));

  if (homeImpr) {
    // Boost any home-services vertical that has at least one keyword hit.
    const homeVerticals = ["roofing","hvac","plumbing","electrical","windows","siding","gutters","insulation","painting","concrete","foundation","fencing","garage_door","landscaping","kitchen","solar"];
    for (const v of homeVerticals) if (scores[v] > 0) scores[v] += 2;
  }
  if (isAuto) {
    scores.auto_repair += 5;
  }

  return scores;
}

export function bestVertical(text) {
  const scores = scoreVerticals(text);
  let best = null;
  let bestScore = 0;
  for (const v of VERTICALS) {
    if (scores[v] > bestScore) { best = v; bestScore = scores[v]; }
  }
  return { vertical: best, score: bestScore, scores };
}

// Confirms the user's declared vertical is plausible given the text.
// Returns {ok, declared, suggested, score, reason}.
//   ok=true  -> declared vertical has a positive score OR is the top-1
//   ok=false -> text contains zero matches for declared vertical
export function checkDeclaredVertical(text, declared) {
  if (!VERTICALS.includes(declared)) {
    return { ok: false, declared, suggested: null, score: 0, reason: "unknown_vertical" };
  }
  const { vertical: best, score: bestScore, scores } = bestVertical(text);
  const declaredScore = scores[declared] || 0;
  if (declaredScore === 0 && bestScore === 0) {
    return { ok: false, declared, suggested: null, score: 0, reason: "no_signal" };
  }
  if (declaredScore === 0 && bestScore > 0) {
    return { ok: false, declared, suggested: best, score: 0, reason: "vertical_mismatch" };
  }
  return { ok: true, declared, suggested: best !== declared ? best : null, score: declaredScore, reason: null };
}

export function verticalLabel(slug) {
  return VERTICAL_LABELS[slug] || slug;
}
