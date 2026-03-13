import { fetchSmartQuote } from "./analyzer-smartquote.js";

let cityPricingData = [];
let cityPricingIndex = new Map();

export let latestAnalysis = null;
export let lastParsedData = {
  price: "",
  priceCandidates: [],
  material: "",
  materialLabel: "",
  warranty: "",
  warrantyYears: "",
  contractor: "",
  city: "",
  stateCode: "",
  roofSize: "",
  roofSizeSource: "",
  confidenceScore: 0,
  confidenceLabel: "Low",
  signals: {},
  premiumSignals: [],
  rawText: "",
  extractionMethod: "",
  extractedTextLength: 0
};

export function setLastParsedData(parsed) {
  lastParsedData = parsed;
}

export function setLatestAnalysis(analysis) {
  latestAnalysis = analysis;
}

export async function getSmartQuoteData(extractedText) {
  try {
    const smartQuoteData = await fetchSmartQuote(extractedText);
    console.log("SmartQuote result:", smartQuoteData);
    return smartQuoteData;
  } catch (err) {
    console.warn("SmartQuote failed, falling back to parser data", err);
    return null;
  }
}

export function buildFinalData(smartQuoteData, parsedData) {
  const parsedPrice = parseMoneyToNumber(parsedData.price);
  const parsedRoofSize = Number(parsedData.roofSize);
  const parsedWarrantyYears = Number(parsedData.warrantyYears);

  const parsedTearOff =
    parsedData.signals?.tearOff?.status === "included"
      ? true
      : parsedData.signals?.tearOff?.status === "excluded"
        ? false
        : null;

  return {
    total_price:
      smartQuoteData?.total_price ??
      (Number.isFinite(parsedPrice) ? parsedPrice : null),

    roof_size_sqft:
      smartQuoteData?.roof_size_sqft ??
      (Number.isFinite(parsedRoofSize) ? parsedRoofSize : null),

    material:
      smartQuoteData?.material ??
      parsedData.materialLabel ??
      parsedData.material ??
      null,

    warranty_years:
      smartQuoteData?.warranty_years ??
      (Number.isFinite(parsedWarrantyYears) ? parsedWarrantyYears : null),

    tear_off_included:
      smartQuoteData?.tear_off_included ??
      parsedTearOff,

    contractor_name:
      smartQuoteData?.contractor_name ??
      parsedData.contractor ??
      null,

    city:
      smartQuoteData?.city ??
      parsedData.city ??
      null,

    state:
      smartQuoteData?.state ??
      parsedData.stateCode ??
      null,

    scope_items: Array.isArray(smartQuoteData?.scope_items)
      ? smartQuoteData.scope_items
      : [],

    confidence:
      smartQuoteData?.confidence ??
      (Number(parsedData.confidenceScore) / 100) ??
      0
  };
}

const STATE_CODES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"
];

const CITY_ALIASES = {
  "st louis": "saint louis",
  "st. louis": "saint louis",
  "ft worth": "fort worth",
  "ft. worth": "fort worth",
  "st paul": "saint paul",
  "st. paul": "saint paul",
  "st petersburg": "saint petersburg",
  "st. petersburg": "saint petersburg",
  "saint pete": "saint petersburg",
  "las vegas city": "las vegas",
  "oklahoma city city": "oklahoma city",
  "kansas city city": "kansas city"
};

const MATERIAL_PATTERNS = [
  {
    value: "metal",
    label: "Standing seam metal roofing",
    score: 96,
    patterns: [/\bstanding seam\b/, /\bmechanically seamed\b/, /\bmetal roof\b/, /\bmetal roofing\b/]
  },
  {
    value: "architectural",
    label: "Architectural shingles",
    score: 94,
    patterns: [/\barchitectural\b/, /\bdimensional\b/, /\blaminate shingles?\b/, /\bhdz\b/, /\btimberline\b/]
  },
  {
    value: "tile",
    label: "Tile roofing",
    score: 90,
    patterns: [/\btile roof\b/, /\bconcrete tile\b/, /\bclay tile\b/, /\bbarrel tile\b/]
  },
  {
    value: "asphalt",
    label: "Asphalt shingles",
    score: 84,
    patterns: [/\basphalt shingles?\b/, /\b3[- ]tab\b/, /\bstrip shingles?\b/, /\bcomposition shingles?\b/]
  },
  {
    value: "metal",
    label: "Metal roofing",
    score: 80,
    patterns: [/\bmetal\b/]
  }
];

const SCOPE_DEFINITIONS = {
  tearOff: {
    label: "Tear off",
    positive: [/\btear[\s-]?off\b/, /\bremove old roof\b/, /\bremove existing shingles?\b/, /\bcomplete removal\b/],
    negative: [/\bno tear[\s-]?off\b/, /\bwithout tear[\s-]?off\b/, /\bover lay\b/, /\boverlay\b/, /\blayover\b/]
  },
  underlayment: {
    label: "Underlayment",
    positive: [/\bunderlayment\b/, /\bsynthetic felt\b/, /\bsynthetic underlayment\b/, /\bice and water\b/, /\bice & water\b/, /\bfelt\b/],
    negative: [/\bunderlayment not included\b/, /\bexclude(?:d)? underlayment\b/, /\bby owner\b/]
  },
  flashing: {
    label: "Flashing",
    positive: [/\bflashing\b/, /\bdrip edge\b/, /\bstep flashing\b/, /\bcounter flashing\b/, /\bpipe boot\b/, /\bvalley metal\b/],
    negative: [/\bflashing not included\b/, /\bexisting flashing only\b/, /\breuse flashing\b/, /\bby owner\b/]
  },
  ventilation: {
    label: "Ventilation",
    positive: [/\bventilation\b/, /\bridge vent\b/, /\bsoffit vent\b/, /\bintake vent\b/, /\bexhaust vent\b/, /\bbox vent\b/],
    negative: [/\bventilation not included\b/, /\bno ventilation\b/, /\bby owner\b/]
  },
  decking: {
    label: "Decking",
    positive: [/\bdecking\b/, /\bdeck repair\b/, /\bosb\b/, /\bplywood\b/, /\bsheathing\b/, /\bdeck replacement\b/],
    negative: [/\bdecking not included\b/, /\bdeck repair not included\b/, /\bwood replacement extra\b/, /\bas needed at additional cost\b/]
  },
  permit: {
    label: "Permit",
    positive: [/\bpermit\b/, /\bpermits\b/, /\bpermit fee\b/],
    negative: [/\bpermit not included\b/, /\bowner to pull permit\b/, /\bpermits by owner\b/]
  },
  disposal: {
    label: "Disposal",
    positive: [/\bdisposal\b/, /\bdumpster\b/, /\bhaul away\b/, /\bdebris removal\b/, /\bclean up\b/, /\bcleanup\b/],
    negative: [/\bdisposal not included\b/, /\bowner responsible for cleanup\b/]
  },
  dripEdge: {
    label: "Drip edge",
    positive: [/\bdrip edge\b/],
    negative: [/\bdrip edge not included\b/, /\breuse existing drip edge\b/]
  },
  iceWater: {
    label: "Ice and water shield",
    positive: [/\bice and water\b/, /\bice & water\b/, /\bice shield\b/, /\bwater shield\b/],
    negative: [/\bice and water not included\b/, /\bwater shield not included\b/]
  },
  starter: {
    label: "Starter strip",
    positive: [/\bstarter strip\b/, /\bstarter shingles?\b/],
    negative: [/\bstarter not included\b/]
  },
  warrantyMention: {
    label: "Warranty mention",
    positive: [/\bwarranty\b/, /\bworkmanship\b/, /\bmanufacturer warranty\b/],
    negative: []
  }
};

export function formatCurrency(value) {
  const num = Number(value);
  if (!isFinite(num)) return "$0";
  return "$" + Math.round(num).toLocaleString();
}

export function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bUsa\b/g, "USA");
}

export function normalizeWhitespace(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/[|]+/g, " ")
    .trim();
}

export function normalizeCityName(city) {
  let value = String(city || "").toLowerCase().trim();
  value = value.replace(/[.,]/g, " ");
  value = value.replace(/\bsaint\b/g, "saint");
  value = value.replace(/\bst\b/g, "saint");
  value = value.replace(/\bft\b/g, "fort");
  value = value.replace(/\bmt\b/g, "mount");
  value = value.replace(/\s+/g, " ").trim();
  if (CITY_ALIASES[value]) {
    value = CITY_ALIASES[value];
  }
  return value;
}

export function buildCityKey(city, stateCode) {
  return `${normalizeCityName(city)}|${String(stateCode || "").trim().toUpperCase()}`;
}

export function findCityPricing(city, stateCode) {
  const normalizedState = String(stateCode || "").trim().toUpperCase();
  if (!normalizedState) return null;

  const exactKey = buildCityKey(city, normalizedState);
  if (cityPricingIndex.has(exactKey)) {
    return cityPricingIndex.get(exactKey);
  }

  const cityNormalized = normalizeCityName(city);
  for (const [key, value] of cityPricingIndex.entries()) {
    const [cityKey, stateKey] = key.split("|");
    if (
      stateKey === normalizedState &&
      (cityKey === cityNormalized || cityKey.includes(cityNormalized) || cityNormalized.includes(cityKey))
    ) {
      return value;
    }
  }

  return null;
}

export function getNearestSizeLabel(cityPricing, roofSize) {
  const sizeLabels = Object.keys(cityPricing.sizes || {});
  let bestLabel = sizeLabels[0] || "";
  let smallestDiff = Infinity;

  for (const label of sizeLabels) {
    const numericSize = parseInt(String(label).replace(/[^\d]/g, ""), 10);
    if (!numericSize) continue;

    const diff = Math.abs(numericSize - roofSize);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      bestLabel = label;
    }
  }

  return bestLabel;
}

export function getMaterialBenchmarkPerSqFt(material) {
  const benchmarks = {
    architectural: 6.35,
    asphalt: 5.10,
    metal: 10.50,
    tile: 13.75
  };
  return benchmarks[material] || 6.35;
}

export function getVerdictClass(verdict) {
  return String(verdict || "unknown").toLowerCase().replace(/\s+/g, "-");
}

export function getMaterialLabel(material) {
  const materialLabelMap = {
    architectural: "architectural shingles",
    asphalt: "asphalt shingles",
    metal: "metal roofing",
    tile: "tile roofing"
  };
  return materialLabelMap[material] || "roofing";
}

export function getSignalHtml(status) {
  if (status === "included") {
    return '<span class="good-text">✓ Included</span>';
  }
  if (status === "excluded") {
    return '<span class="bad-text">✗ Excluded or extra</span>';
  }
  return '<span class="warn-text">⚠ Unclear</span>';
}

export function buildPill(text) {
  return `<span class="pill">${escapeHtml(text)}</span>`;
}

export function getConfidenceLabel(score) {
  if (score >= 75) return "High";
  if (score >= 45) return "Medium";
  return "Low";
}

export function getConfidenceClass(score) {
  if (score >= 75) return "high";
  if (score >= 45) return "medium";
  return "low";
}

export function formatNumber(value) {
  const num = Number(value);
  if (!isFinite(num)) return "";
  return num.toLocaleString();
}

export function parseMoneyToNumber(value) {
  if (value == null) return NaN;
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  const num = Number(cleaned);
  return isFinite(num) ? num : NaN;
}

export function normalizeEvidence(text) {
  return normalizeWhitespace(text).slice(0, 120);
}

/*
  These parsing helpers are referenced by analyzer-ui.js.
  Keep them in this module if they already exist elsewhere in your full file.
  If your original analyzer-core.js contains fuller implementations below this point,
  keep those implementations and export them instead of replacing them with stubs.
*/

export { STATE_CODES, CITY_ALIASES, MATERIAL_PATTERNS, SCOPE_DEFINITIONS };