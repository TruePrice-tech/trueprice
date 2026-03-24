// TruePrice Plumbing Quote Parser
// Detects service type, equipment, brand, scope items from plumbing quotes

const PLUMBING_SERVICE_PATTERNS = [
  { value: "water_heater", label: "Water Heater Replacement", score: 96, patterns: [/\bwater heater\b/i, /\bhot water\b/i, /\btankless\b/i, /\btank type\b/i, /\bheat pump water/i] },
  { value: "repipe", label: "Whole House Repipe", score: 94, patterns: [/\brepipe\b/i, /\bre-pipe\b/i, /\bwhole house.*pipe/i, /\bcopper repipe/i, /\bpex repipe/i] },
  { value: "sewer_line", label: "Sewer Line", score: 92, patterns: [/\bsewer line\b/i, /\bsewer replac/i, /\bmain sewer/i, /\btrenchless\b/i, /\bpipe lining\b/i, /\bpipe burst/i] },
  { value: "drain_cleaning", label: "Drain Cleaning", score: 88, patterns: [/\bdrain clean/i, /\bclog\b/i, /\bsnake\b/i, /\bhydro jet/i, /\bjetting\b/i, /\bcamera inspect/i] },
  { value: "bathroom_rough_in", label: "Bathroom Plumbing", score: 90, patterns: [/\bbathroom.*plumb/i, /\brough[\s-]*in\b/i, /\bnew bathroom\b/i, /\bbath remodel.*plumb/i] },
  { value: "gas_line", label: "Gas Line", score: 86, patterns: [/\bgas line\b/i, /\bgas pipe\b/i, /\bgas install/i, /\bnatural gas\b/i] }
];

const PLUMBING_BRAND_PATTERNS = [
  { brand: "Rinnai", tier: "premium", pattern: /\brinnai\b/i },
  { brand: "Navien", tier: "premium", pattern: /\bnavien\b/i },
  { brand: "Noritz", tier: "premium", pattern: /\bnoritz\b/i },
  { brand: "Kohler", tier: "premium", pattern: /\bkohler\b/i },
  { brand: "Rheem", tier: "mid", pattern: /\brheem\b/i },
  { brand: "A.O. Smith", tier: "mid", pattern: /\ba\.?o\.?\s*smith\b/i },
  { brand: "Bradford White", tier: "mid", pattern: /\bbradford white\b/i },
  { brand: "State", tier: "mid", pattern: /\bstate water heater\b/i },
  { brand: "Whirlpool", tier: "value", pattern: /\bwhirlpool\b/i },
  { brand: "GE", tier: "value", pattern: /\bge\s+water\b/i },
  { brand: "Reliance", tier: "value", pattern: /\breliance\b/i }
];

const PLUMBING_SCOPE_DEFINITIONS = {
  permits: {
    label: "Permits",
    positive: [/\bpermit\b/g, /\binspection\b/g, /\bcode compliance\b/g],
    negative: [/\bpermit not included\b/g, /\bpermit by owner/g]
  },
  shutoff: {
    label: "Shut-off valves",
    positive: [/\bshut[\s-]*off\b/g, /\bball valve\b/g, /\bgate valve\b/g, /\bisolation valve/g],
    negative: []
  },
  cleanup: {
    label: "Cleanup",
    positive: [/\bcleanup\b/g, /\bclean up\b/g, /\bdebris remov/g, /\bhaul away/g],
    negative: [/\bcleanup not included\b/g]
  },
  drywall: {
    label: "Drywall repair",
    positive: [/\bdrywall\b/g, /\bwall repair\b/g, /\bpatch\b/g, /\bwall patch/g, /\baccess panel/g],
    negative: [/\bdrywall not included\b/g, /\bdrywall by owner/g, /\bno drywall/g]
  },
  testing: {
    label: "Pressure testing",
    positive: [/\bpressure test/g, /\bleak test/g, /\bhydrostatic test/g],
    negative: []
  },
  warranty: {
    label: "Warranty",
    positive: [/\bwarranty\b/g, /\bguarantee\b/g, /\byear.*parts/g, /\byear.*labor/g],
    negative: []
  },
  disposal: {
    label: "Old equipment disposal",
    positive: [/\bdisposal\b/g, /\bremov(?:e|al).*old/g, /\bhaul away/g, /\brecycle/g],
    negative: [/\bdisposal not included\b/g]
  },
  codeCompliance: {
    label: "Code compliance",
    positive: [/\bcode\b/g, /\bup to code/g, /\bcode compliance/g, /\bcode upgrade/g],
    negative: []
  },
  expansion_tank: {
    label: "Expansion tank",
    positive: [/\bexpansion tank\b/g, /\bthermal expansion/g],
    negative: [/\bexpansion tank not included\b/g]
  },
  supply_lines: {
    label: "Supply lines",
    positive: [/\bsupply line/g, /\bflex line/g, /\bconnector/g, /\bwater line/g],
    negative: []
  },
  drain_pan: {
    label: "Drain pan",
    positive: [/\bdrain pan\b/g, /\boverflow pan/g, /\bcatch pan/g],
    negative: []
  },
  venting: {
    label: "Venting",
    positive: [/\bvent\b/g, /\bflue\b/g, /\bexhaust\b/g, /\bpower vent/g, /\bdirect vent/g, /\bvent pipe/g],
    negative: [/\bvent not included\b/g]
  }
};

function detectPlumbingServiceType(text) {
  const normalized = String(text || "").toLowerCase();
  const matches = [];

  PLUMBING_SERVICE_PATTERNS.forEach(function(item) {
    item.patterns.forEach(function(pattern) {
      if (pattern.test(normalized)) {
        matches.push({ value: item.value, label: item.label, score: item.score });
      }
    });
  });

  if (matches.length === 0) return { value: "water_heater", label: "Water Heater Replacement" };
  matches.sort(function(a, b) { return b.score - a.score; });
  return { value: matches[0].value, label: matches[0].label };
}

function detectWaterHeaterType(text) {
  const normalized = String(text || "").toLowerCase();
  if (/\btankless\b/.test(normalized) && /\bgas\b/.test(normalized)) return "tankless_gas";
  if (/\btankless\b/.test(normalized)) return "tankless_electric";
  if (/\bheat pump\b/.test(normalized) || /\bhybrid\b/.test(normalized)) return "hybrid_heat_pump";
  if (/\b50\s*gal/i.test(normalized) && /\bgas\b/.test(normalized)) return "tank_50_gas";
  if (/\b50\s*gal/i.test(normalized)) return "tank_50_electric";
  if (/\b40\s*gal/i.test(normalized) && /\bgas\b/.test(normalized)) return "tank_40_gas";
  if (/\b40\s*gal/i.test(normalized)) return "tank_40_electric";
  if (/\bgas\b/.test(normalized)) return "tank_50_gas";
  return "tank_50_electric";
}

function detectPipeMaterial(text) {
  const normalized = String(text || "").toLowerCase();
  if (/\bcopper\b/.test(normalized)) return "copper";
  if (/\bpex\b/.test(normalized)) return "pex";
  if (/\bcpvc\b/.test(normalized)) return "cpvc";
  return null;
}

function detectPlumbingBrand(text) {
  const normalized = String(text || "");
  for (var i = 0; i < PLUMBING_BRAND_PATTERNS.length; i++) {
    if (PLUMBING_BRAND_PATTERNS[i].pattern.test(normalized)) {
      return { brand: PLUMBING_BRAND_PATTERNS[i].brand, tier: PLUMBING_BRAND_PATTERNS[i].tier };
    }
  }
  return null;
}

function detectPlumbingScopeSignals(text) {
  const normalized = String(text || "").toLowerCase();
  const results = {};

  Object.keys(PLUMBING_SCOPE_DEFINITIONS).forEach(function(key) {
    var def = PLUMBING_SCOPE_DEFINITIONS[key];
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

if (typeof window !== "undefined") {
  window.detectPlumbingServiceType = detectPlumbingServiceType;
  window.detectWaterHeaterType = detectWaterHeaterType;
  window.detectPipeMaterial = detectPipeMaterial;
  window.detectPlumbingBrand = detectPlumbingBrand;
  window.detectPlumbingScopeSignals = detectPlumbingScopeSignals;
}

console.log("PLUMBING PARSER LOADED");
