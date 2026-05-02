// Woogoro HVAC Quote Parser
// Detects system type, SEER rating, tonnage, brand, scope items from HVAC quotes

const HVAC_SYSTEM_PATTERNS = [
  { value: "heat_pump", label: "Heat Pump", score: 96, patterns: [/\bheat pump\b/i, /\bheat\s*pump\b/i, /\bair source heat pump\b/i, /\bground source\b/i] },
  { value: "mini_split", label: "Ductless Mini-Split", score: 94, patterns: [/\bmini[\s-]*split\b/i, /\bductless\b/i, /\bmulti[\s-]*zone\b/i] },
  { value: "central_ac", label: "Central Air Conditioning", score: 90, patterns: [/\bcentral a\/?c\b/i, /\bcentral air\b/i, /\bair condition/i, /\bcondenser\b/i, /\bsplit system\b/i] },
  { value: "furnace", label: "Gas Furnace", score: 88, patterns: [/\bfurnace\b/i, /\bgas furnace\b/i, /\bforced air\b/i] },
  { value: "full_system", label: "Full HVAC System", score: 92, patterns: [/\bhvac system\b/i, /\bcomplete system\b/i, /\bfurnace.*(?:and|&).*(?:ac|air|condenser)/i, /\b(?:ac|air|condenser).*(?:and|&).*furnace/i] }
];

const HVAC_BRAND_PATTERNS = [
  { brand: "Carrier", tier: "premium", pattern: /\bcarrier\b/i },
  { brand: "Trane", tier: "premium", pattern: /\btrane\b/i },
  { brand: "Lennox", tier: "premium", pattern: /\blennox\b/i },
  { brand: "Daikin", tier: "premium", pattern: /\bdaikin\b/i },
  { brand: "Mitsubishi", tier: "premium", pattern: /\bmitsubishi(?:\s+electric)?\b/i },
  { brand: "Fujitsu", tier: "premium", pattern: /\bfujitsu(?:\s+general)?\b/i },
  { brand: "LG", tier: "mid", pattern: /\bLG\b/ },
  { brand: "Rheem", tier: "mid", pattern: /\brheem\b/i },
  { brand: "Ruud", tier: "mid", pattern: /\bruud\b/i },
  { brand: "York", tier: "mid", pattern: /\byork\b/i },
  { brand: "Bryant", tier: "mid", pattern: /\bbryant\b/i },
  { brand: "American Standard", tier: "mid", pattern: /\bamerican standard\b/i },
  { brand: "Amana", tier: "mid", pattern: /\bamana\b/i },
  { brand: "Goodman", tier: "value", pattern: /\bgoodman\b/i },
  { brand: "Payne", tier: "value", pattern: /\bpayne\b/i },
  { brand: "Heil", tier: "value", pattern: /\bheil\b/i },
  { brand: "Comfortmaker", tier: "value", pattern: /\bcomfortmaker\b/i }
];

const HVAC_SCOPE_DEFINITIONS = {
  equipment: {
    label: "Equipment",
    positive: [/\bcondenser\b/g, /\bair handler\b/g, /\bevaporator\b/g, /\bcompressor\b/g, /\boutdoor unit\b/g, /\bindoor unit\b/g, /\bfurnace\b/g, /\bheat pump\b/g, /\ba\/c\b/g, /\bac install/g, /\bcoil\b/g, /\bair.?handler/g, /\bdaikin\b/g, /\bcarrier\b/g, /\btrane\b/g, /\blennox\b/g, /\brheem\b/g, /\bgoodman\b/g],
    negative: [/\bequipment not included\b/g]
  },
  lineSet: {
    label: "Refrigerant line set",
    positive: [/\bline set\b/g, /\blineset\b/g, /\brefrigerant line/g, /\bcopper line/g, /\bsuction line/g, /\bflush copper/g, /\bcop(?:per)?\s*line/g],
    negative: [/\bline set not included\b/g, /\breuse existing line/g]
  },
  thermostat: {
    label: "Thermostat",
    positive: [/\bthermostat\b/g, /\bnest\b/g, /\becobee\b/g, /\bhoneywell\b/g, /\bsmart thermostat/g, /\bprogrammable thermostat/g, /\bdaikin one\b/g],
    negative: [/\bthermostat not included\b/g, /\bhomeowner.*thermostat/g]
  },
  ductwork: {
    label: "Ductwork",
    positive: [/\bductwork\b/g, /\bduct\s*work\b/g, /\bduct modification/g, /\bduct seal/g, /\breturn air/g, /\bsupply duct/g, /\bflex duct/g, /\bplenum\b/g],
    negative: [/\bductwork not included\b/g, /\bno duct/g, /\bductless\b/g]
  },
  electrical: {
    label: "Electrical",
    positive: [/\belectrical disconnect\b/g, /\bdisconnect\b/g, /\belectrical wir/g, /\bbreaker\b/g, /\bwhip\b/g, /\b220v\b/g, /\b240v\b/g, /\b115v\b/g, /\belectrical connect/g, /\bsafety switch/g, /\belec\b/g, /\bconvert.*(?:115|220|240)/g, /\bsurge protect/g],
    negative: [/\belectrical not included\b/g, /\belectrician by owner/g]
  },
  pad: {
    label: "Equipment pad",
    positive: [/\bconcrete pad\b/g, /\bcomposite pad\b/g, /\bequipment pad\b/g, /\bcondenser pad/g, /\bhurricane pad/g, /\bpad\/anchor/g, /\banchors?\b/g, /\bplywood deck/g],
    negative: [/\bpad not included\b/g, /\bexisting pad/g]
  },
  drainLine: {
    label: "Drain line",
    positive: [/\bdrain line\b/g, /\bcondensate\b/g, /\bcondensate pump/g, /\bcondensate drain/g, /\bp-trap\b/g, /\bdrain pan/g],
    negative: [/\bdrain not included\b/g]
  },
  filterRack: {
    label: "Filter rack",
    positive: [/\bfilter rack\b/g, /\bfilter\b/g, /\breturn filter/g, /\bmedia filter/g, /\bair cleaner/g, /\bfilter drier/g],
    negative: [/\bfilter not included\b/g]
  },
  permit: {
    label: "Permit",
    positive: [/\bpermit\b/g, /\bbuilding permit\b/g, /\binspection\b/g, /\bcode complian/g],
    negative: [/\bpermit not included\b/g, /\bpermit by owner/g]
  },
  disposal: {
    label: "Old equipment removal",
    positive: [/\bremov(?:e|al)\b.*(?:old|existing)/g, /\bdisposal\b/g, /\bhaul away\b/g, /\brecycle\b/g, /\brefrigerant recovery/g, /\bold unit\b/g, /\bdispose\b/g, /\bremove and dispose/g, /\bunit replacement/g, /\breplacement.*old/g],
    negative: [/\bdisposal not included\b/g]
  },
  warranty: {
    label: "Warranty",
    positive: [/\bwarranty\b/g, /\bguarantee\b/g, /\byear.*parts/g, /\byear.*labor/g, /\bmanufacturer.*warranty/g, /\b\d+\s*year\b/g, /\bgarrantee\b/g, /\bwarranty excluding/g],
    negative: []
  },
  loadCalc: {
    label: "Load calculation",
    positive: [/\bmanual j\b/g, /\bload calc/g, /\bheat load/g, /\bcooling load/g, /\bload calculation/g, /\bproperly sized/g],
    negative: []
  }
};

function detectHvacSystemType(text) {
  const normalized = String(text || "").toLowerCase();
  const matches = [];

  HVAC_SYSTEM_PATTERNS.forEach(function(item) {
    item.patterns.forEach(function(pattern) {
      if (pattern.test(normalized)) {
        matches.push({ value: item.value, label: item.label, score: item.score });
      }
    });
  });

  if (matches.length === 0) return { value: "central_ac", label: "Central Air Conditioning" };

  // Check for full system (AC + furnace mentioned together)
  const hasAC = /\b(?:ac|air condition|condenser|cool)\b/i.test(normalized);
  const hasFurnace = /\bfurnace\b/i.test(normalized);
  if (hasAC && hasFurnace) {
    return { value: "full_system", label: "Full HVAC System" };
  }

  matches.sort(function(a, b) { return b.score - a.score; });
  return { value: matches[0].value, label: matches[0].label };
}

function detectSeerRating(text) {
  const normalized = String(text || "");
  // SEER2 (modern 2023+ rating) takes priority over plain SEER. The system
  // spec on a modern quote is "22 SEER2" or "16 SEER2"; "14 SEER baseline"
  // tends to appear in energy-savings footnotes. f5 baseline 2026-05-02 was
  // returning 14 (from "vs 14 SEER baseline" footnote) instead of 22 (the
  // actual system spec) because pattern 1 ran first and the SEER2 pattern
  // never got a chance.
  const seer2Match = normalized.match(/\b(\d{2}(?:\.\d)?)\s*(?:SEER2|seer2)\b/);
  if (seer2Match) return Number(seer2Match[1]);

  // Plain SEER fallback for older quotes. Skip clearly comparative tokens like
  // "vs 14 SEER baseline" / "14 SEER baseline" / "compared to 14 SEER" so a
  // footnote doesn't override the headline rating when both exist.
  const seerMatches = Array.from(normalized.matchAll(/\b(\d{2}(?:\.\d)?)\s*(?:SEER|seer)\b/g));
  for (var i = 0; i < seerMatches.length; i++) {
    var m = seerMatches[i];
    var tail = normalized.slice(m.index + m[0].length, m.index + m[0].length + 40).toLowerCase();
    var head = normalized.slice(Math.max(0, m.index - 40), m.index).toLowerCase();
    var compar = /^\s*(?:baseline|comparison|compared|industry|minimum|standard|legacy)/.test(tail) || /\bvs\b|\bversus\b|compared to|baseline|minimum|legacy|previous|industry/.test(head);
    if (!compar) return Number(m[1]);
  }

  return null;
}

// Companion to detectSeerRating — returns whether the rating Lane is using
// for the result is a SEER2 reading (modern 2023+) or plain SEER. Drives the
// label suffix in renderResult so a "16 SEER2" quote reads "16 SEER2", not
// "16 SEER" (which would suggest the unit is rated under the old standard).
function detectSeerStandard(text) {
  const normalized = String(text || "");
  if (/\b\d{2}(?:\.\d)?\s*(?:SEER2|seer2)\b/.test(normalized)) return "SEER2";
  if (/\b\d{2}(?:\.\d)?\s*(?:SEER|seer)\b/.test(normalized)) return "SEER";
  return null;
}

function detectTonnage(text) {
  const normalized = String(text || "");

  // "3 ton" or "3-ton" or "3.0 ton"
  const tonMatch = normalized.match(/\b(\d(?:\.\d)?)\s*[\s-]*ton\b/i);
  if (tonMatch) return Number(tonMatch[1]);

  // BTU to tons: 12000 BTU = 1 ton
  const btuMatch = normalized.match(/\b(\d{2,3}),?000\s*(?:BTU|btu)\b/);
  if (btuMatch) return Math.round(Number(btuMatch[1]) * 1000 / 12000 * 10) / 10;

  return null;
}

function detectAfueRating(text) {
  const normalized = String(text || "");
  const afueMatch = normalized.match(/\b(\d{2,3}(?:\.\d)?)\s*%?\s*(?:AFUE|afue)\b/);
  if (afueMatch) return Number(afueMatch[1]);
  return null;
}

function detectHvacBrand(text) {
  const normalized = String(text || "");
  for (var i = 0; i < HVAC_BRAND_PATTERNS.length; i++) {
    if (HVAC_BRAND_PATTERNS[i].pattern.test(normalized)) {
      return { brand: HVAC_BRAND_PATTERNS[i].brand, tier: HVAC_BRAND_PATTERNS[i].tier };
    }
  }
  return null;
}

// Detect refrigerant type. R-22 is the trust-critical one — it was phased out
// in 2020 and recharging an R-22 system runs $500-$2,000 in refrigerant alone.
// R-410A is the legacy modern standard; R-454B and R-32 are the post-2025
// next-gen lower-GWP refrigerants. Surfacing the type lets the verdict copy
// flag the R-22 phaseout cost AND the impending R-410A phasedown.
function detectRefrigerant(text) {
  const normalized = String(text || "");
  // Order matters: more specific (R-410A, R-454B) before plain "R-22" so a
  // doc mentioning both an old R-22 system and a new R-410A install picks
  // the new refrigerant. The first explicit refrigerant token wins.
  const patterns = [
    { label: "R-454B", pattern: /\bR[\s\-]?454B\b/i },
    { label: "R-32", pattern: /\bR[\s\-]?32\b/i },
    { label: "R-410A", pattern: /\bR[\s\-]?410[\s\-]?A?\b|\b410a\b/i },
    { label: "R-22", pattern: /\bR[\s\-]?22\b|\bfreon\b/i },
  ];
  // Scan in original order — but pick the lowest-index match in the text so
  // a system that says "Replacing old R-22 with new R-410A" returns R-410A
  // (the new refrigerant) not R-22 (the legacy one).
  let best = null;
  patterns.forEach(p => {
    p.pattern.lastIndex = 0;
    const m = normalized.match(p.pattern);
    if (m) {
      const idx = normalized.indexOf(m[0]);
      // Prefer R-22 only when it's the ONLY refrigerant in the doc — that's
      // the "still on R-22" trust flag. Otherwise pick the modern one.
      if (!best || (best.label === "R-22" && p.label !== "R-22")) {
        best = { label: p.label, idx };
      } else if (p.label !== "R-22" && idx < best.idx) {
        best = { label: p.label, idx };
      }
    }
  });
  return best ? best.label : null;
}

function detectHvacScopeSignals(text) {
  const normalized = String(text || "").toLowerCase();
  const results = {};

  Object.keys(HVAC_SCOPE_DEFINITIONS).forEach(function(key) {
    var def = HVAC_SCOPE_DEFINITIONS[key];
    var found = false;
    var excluded = false;

    def.negative.forEach(function(pattern) {
      pattern.lastIndex = 0;
      if (pattern.test(normalized)) excluded = true;
    });

    if (!excluded) {
      def.positive.forEach(function(pattern) {
        pattern.lastIndex = 0;
        if (pattern.test(normalized)) found = true;
      });
    }

    results[key] = {
      label: def.label,
      status: excluded ? "excluded" : found ? "included" : "unclear"
    };
  });

  return results;
}

// Export for use in analyzer
if (typeof window !== "undefined") {
  window.detectHvacSystemType = detectHvacSystemType;
  window.detectSeerRating = detectSeerRating;
  window.detectSeerStandard = detectSeerStandard;
  window.detectTonnage = detectTonnage;
  window.detectAfueRating = detectAfueRating;
  window.detectHvacBrand = detectHvacBrand;
  window.detectRefrigerant = detectRefrigerant;
  window.detectHvacScopeSignals = detectHvacScopeSignals;
  window.HVAC_SYSTEM_PATTERNS = HVAC_SYSTEM_PATTERNS;
  window.HVAC_BRAND_PATTERNS = HVAC_BRAND_PATTERNS;
}

