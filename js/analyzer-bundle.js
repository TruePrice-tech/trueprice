let cityPricingData = [];
let cityPricingIndex = new Map();
let latestAnalysis = null;
let lastParsedData = {
  price: "",
  priceCandidates: [],
  material: "",
  materialLabel: "",
  warranty: "",
  warrantyYears: "",
  contractor: "",
  city: "",
  stateCode: "",
  address: {
    street: "",
    city: "",
    stateCode: "",
    zip: "",
    fullAddress: ""
  },
  roofSize: "",
  roofSizeSource: "",
  roofSizeEstimate: null,
  roofSizeEstimateConfidence: "",
  roofSizeEstimateConfidenceScore: 0,
  roofSizeEstimateSource: "",
  roofSizeEstimateReasoning: "",
  confidenceScore: 0,
  confidenceLabel: "Low",
  signals: {},
  premiumSignals: [],
  rawText: "",
  extractionMethod: "",
  extractedTextLength: 0
};
function setUploadStatus(message, type = "info", percent = null) {
  const el = document.getElementById("uploadStatus");
  if (!el) return;
  let progressHtml = "";
  if (typeof percent === "number") {
    progressHtml = `
      <div class="upload-progress">
        <div class="upload-progress-bar" style="width:${percent}%"></div>
      </div>
    `;
  }
  el.className = `upload-status ${type}`;
  el.innerHTML = `
    <div>${message}</div>
    ${progressHtml}
  `;
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
    patterns: [/\barchitectural\b/, /\bdimensional\b/, /\blaminate shingles?\b/, /\bhdz\b/, /\btimberline\b/, /\bcertainteed\w*\b/, /\blandmark\b/, /\bduration\b/, /\bowens\s*corning\b/]
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
    patterns: [/\bmetal\s+(?:roof|roofing|panel|system)\b/]
  }
];
if (typeof window !== "undefined") window.MATERIAL_PATTERNS = MATERIAL_PATTERNS;
function formatCurrency(value) {
  const num = Number(value);
  if (!isFinite(num)) return "$0";
  return "$" + Math.round(num).toLocaleString();
}
function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bUsa\b/g, "USA");
}
function normalizeWhitespace(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/[|]+/g, " ")
    .trim();
}
function normalizeCityName(city) {
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
function buildCityKey(city, stateCode) {
  return `${normalizeCityName(city)}|${String(stateCode || "").trim().toUpperCase()}`;
}
function findCityPricing(city, stateCode) {
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
function getNearestSizeLabel(cityPricing, roofSize) {
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
function getMaterialBenchmarkPerSqFt(material) {
  const benchmarks = {
    architectural: 6.35,
    asphalt: 5.10,
    metal: 10.50,
    tile: 13.75
  };
  return benchmarks[material] || 6.35;
}
function getVerdictClass(verdict) {
  return String(verdict || "unknown").toLowerCase().replace(/\s+/g, "-");
}
function getMaterialLabel(material) {
  const materialLabelMap = {
    architectural: "architectural shingles",
    asphalt: "asphalt shingles",
    metal: "metal roofing",
    tile: "tile roofing"
  };
  return materialLabelMap[material] || "roofing";
}
function getSignalHtml(status) {
  if (status === "included") {
    return '<span class="good-text">✓ Included</span>';
  }
  if (status === "excluded") {
    return '<span class="bad-text">✗ Excluded or extra</span>';
  }
  return '<span class="warn-text">⚠ Unclear</span>';
}
function buildPill(text) {
  return `<span class="pill">${escapeHtml(text)}</span>`;
}
function getConfidenceLabel(score) {
  if (score >= 75) return "High";
  if (score >= 45) return "Medium";
  return "Low";
}
function getConfidenceClass(score) {
  if (score >= 75) return "high";
  if (score >= 45) return "medium";
  return "low";
}
function formatNumber(value) {
  const num = Number(value);
  if (!isFinite(num)) return "";
  return num.toLocaleString();
}
function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(num) ? num : null;
}
function normalizeRoofSizeValue(value) {
  const num = toFiniteNumber(value);
  if (!num || num <= 0) return null;
  return Math.round(num);
}
function normalizeAddressInput(address = {}) {
  const street = String(address?.street || "").trim();
  const city = String(address?.city || "").trim();
  const stateCode = String(address?.stateCode || "").trim().toUpperCase();
  const zip = String(address?.zip || "").trim();
  const fullAddress =
    String(address?.fullAddress || "").trim() ||
    [street, city, stateCode, zip].filter(Boolean).join(", ");
  return {
    street,
    city,
    stateCode,
    zip,
    fullAddress
  };
}
function hasUsableAddress(address = {}) {
  const normalized = normalizeAddressInput(address);
  return !!(
    (normalized.street && normalized.city && normalized.stateCode) ||
    (normalized.street && normalized.zip) ||
    (normalized.city && normalized.stateCode && normalized.zip)
  );
}
function buildPropertyAddressKey(address = {}) {
  const normalized = normalizeAddressInput(address);
  return [
    String(normalized.street || "").toLowerCase().trim(),
    String(normalized.city || "").toLowerCase().trim(),
    String(normalized.stateCode || "").toUpperCase().trim(),
    String(normalized.zip || "").trim()
  ].join("|");
}
function getCachedPropertyRoofSignals(address = {}) {
  try {
    const key = buildPropertyAddressKey(address);
    if (!key) return null;
    const raw = localStorage.getItem(`tp_property_signals:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const createdAt = Number(parsed.createdAt || 0);
    const maxAgeMs = 1000 * 60 * 60 * 24 * 30; 
    if (!createdAt || Date.now() - createdAt > maxAgeMs) {
      localStorage.removeItem(`tp_property_signals:${key}`);
      return null;
    }
    return parsed.data || null;
  } catch {
    return null;
  }
}
function setCachedPropertyRoofSignals(address = {}, data = null) {
  try {
    const key = buildPropertyAddressKey(address);
    if (!key || !data) return;
    localStorage.setItem(
      `tp_property_signals:${key}`,
      JSON.stringify({
        createdAt: Date.now(),
        data
      })
    );
  } catch {
  }
}
async function fetchPropertyRoofSignalsFromApi(address = {}) {
  const normalized = normalizeAddressInput(address);
  if (!hasUsableAddress(normalized)) {
    return null;
  }
  try {
    const response = await fetch("/api/property-signals", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(normalized)
    });
    if (!response.ok) {
      return null;
    }
    const payload = await response.json();
    if (!payload || !payload.success || !payload.data) {
      return null;
    }
    return payload.data;
  } catch {
    return null;
  }
}
function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function getRoofSizeMaterialBenchmark(material) {
  const normalized = String(material || "").toLowerCase().trim();
  if (normalized.includes("architectural")) return getMaterialBenchmarkPerSqFt("architectural");
  if (normalized.includes("asphalt")) return getMaterialBenchmarkPerSqFt("asphalt");
  if (normalized.includes("metal")) return getMaterialBenchmarkPerSqFt("metal");
  if (normalized.includes("tile")) return getMaterialBenchmarkPerSqFt("tile");
  return getMaterialBenchmarkPerSqFt("architectural");
}
function getRoofSizeEstimateBenchmark({
  city,
  stateCode,
  material,
  complexityFactor = 1,
  tearOffFactor = 1
}) {
  let benchmarkPerSqFt = getRoofSizeMaterialBenchmark(material);
  if (typeof findCityPricing === "function" && city && stateCode) {
    const cityPricing = findCityPricing(city, stateCode);
    if (cityPricing?.sizes) {
     const sizeKeys = Object.keys(cityPricing.sizes || {});
     const mids = [];
     const normalizedMaterial =
       String(material || "").toLowerCase().includes("architectural") ? "architectural" :
       String(material || "").toLowerCase().includes("asphalt") ? "asphalt" :
       String(material || "").toLowerCase().includes("metal") ? "metal" :
       String(material || "").toLowerCase().includes("tile") ? "tile" :
       "architectural";
      sizeKeys.forEach(sizeKey => {
        const bucket = cityPricing.sizes?.[sizeKey];
        const numericSize = Number(String(sizeKey).replace(/[^\d]/g, ""));
        const bucketMid = Number(bucket?.[normalizedMaterial]?.mid || 0);
        if (numericSize > 0 && bucketMid > 0) {
          mids.push(bucketMid / numericSize);
        }
      });
      if (mids.length) {
        const avg = mids.reduce((sum, value) => sum + value, 0) / mids.length;
        if (isFinite(avg) && avg > 0) {
          benchmarkPerSqFt = avg;
        }
      }
    }
  }
  const adjustedBenchmark = benchmarkPerSqFt * Number(complexityFactor || 1) * Number(tearOffFactor || 1);
  return {
    baseBenchmarkPerSqFt: benchmarkPerSqFt,
    adjustedBenchmarkPerSqFt: adjustedBenchmark > 0 ? adjustedBenchmark : benchmarkPerSqFt
  };
}
function calculateRoofSizeEstimateConfidence({
    estimatedRoofSize,
    parsedRoofSize,
    quotePrice,
    material,
    benchmarkPerSqFt,
    city,
    stateCode
  }) {
    let score = 68;
    const reasons = [];
    if (!estimatedRoofSize || estimatedRoofSize <= 0) {
      return {
        confidence: "Low",
        confidenceScore: 15,
        reasons: ["Roof size estimate could not be generated."]
      };
    }
    if (city && stateCode) {
      score += 8;
    } else if (stateCode) {
      score += 4;
      reasons.push("Location input was partial, so estimate precision is lower.");
    } else {
      reasons.push("No location data was available, so general pricing benchmarks were used.");
    }
    if (!quotePrice || quotePrice <= 0) {
      score -= 30;
      reasons.push("Quote price was missing or invalid.");
    }
    if (!benchmarkPerSqFt || benchmarkPerSqFt <= 0) {
      score -= 20;
      reasons.push("Benchmark pricing was unavailable.");
    }
    if (parsedRoofSize && parsedRoofSize > 0) {
      const diffPct = Math.abs(parsedRoofSize - estimatedRoofSize) / parsedRoofSize;
      if (diffPct <= 0.1) {
        score += 12;
      } else if (diffPct <= 0.2) {
        score += 4;
      } else if (diffPct <= 0.35) {
        score -= 8;
        reasons.push("Estimated roof size differs somewhat from parsed quote data.");
      } else {
        score -= 18;
        reasons.push("Estimated roof size differs materially from parsed quote data.");
      }
    } else {
      reasons.push("No parsed roof size was available for cross-checking.");
    }
    const validation = validateRoofSizeCandidate({
      roofSize: estimatedRoofSize,
      price: quotePrice,
      material
    });
    score = Math.min(score, validation.confidenceScore + 8);
    score = Math.max(score, 20);
    score = Math.min(score, 92);
    score = Math.round(score);
    return {
      confidence: getConfidenceLabel(score),
      confidenceScore: score,
      reasons: [...reasons, ...(validation.reasons || [])]
    };
  }
  function estimateRoofSizeFromPrice({
    price,
    material,
    city,
    stateCode,
    complexityFactor = 1,
    tearOffFactor = 1
  }) {
    const numericPrice = toFiniteNumber(price);
    if (!numericPrice || numericPrice <= 0) return null;
    const benchmarkInfo = getRoofSizeEstimateBenchmark({
      city,
      stateCode,
      material,
      complexityFactor,
      tearOffFactor
    });
    const benchmarkPerSqFt = benchmarkInfo.adjustedBenchmarkPerSqFt;
    if (!benchmarkPerSqFt || benchmarkPerSqFt <= 0) return null;
    const estimated = numericPrice / benchmarkPerSqFt;
    if (!isFinite(estimated) || estimated <= 0) return null;
    return {
      roofSize: Math.round(estimated),
      benchmarkPerSqFt,
      baseBenchmarkPerSqFt: benchmarkInfo.baseBenchmarkPerSqFt
    };
  }
function validateRoofSizeCandidate({ roofSize, price, material }) {
  const numericRoofSize = normalizeRoofSizeValue(roofSize);
  const numericPrice = toFiniteNumber(price);
  const benchmarkPerSqFt = getRoofSizeMaterialBenchmark(material);
  if (!numericRoofSize) {
    return {
      isValid: false,
      confidenceScore: 15,
      confidence: "Low",
      pricePerSqFt: null,
      status: "missing",
      reasons: ["Roof size was not available."]
    };
  }
  const reasons = [];
  let confidenceScore = 70;
  if (numericRoofSize < 600) {
    reasons.push("Roof size is below the normal range for a full roof replacement.");
    confidenceScore -= 30;
  } else if (numericRoofSize < 900) {
    reasons.push("Roof size is on the small side and may need review.");
    confidenceScore -= 12;
  }
  if (numericRoofSize > 8000) {
    reasons.push("Roof size is above the normal range and may need review.");
    confidenceScore -= 30;
  } else if (numericRoofSize > 5000) {
    reasons.push("Roof size is unusually large and should be sanity checked.");
    confidenceScore -= 12;
  }
  let pricePerSqFt = null;
  if (numericPrice && numericPrice > 0) {
    pricePerSqFt = numericPrice / numericRoofSize;
    if (pricePerSqFt < 2) {
      reasons.push("Implied price per sq ft is extremely low.");
      confidenceScore -= 28;
    } else if (pricePerSqFt < 3.5) {
      reasons.push("Implied price per sq ft is somewhat low.");
      confidenceScore -= 14;
    }
    if (pricePerSqFt > 30) {
      reasons.push("Implied price per sq ft is extremely high.");
      confidenceScore -= 28;
    } else if (pricePerSqFt > 20) {
      reasons.push("Implied price per sq ft is somewhat high.");
      confidenceScore -= 14;
    }
    if (benchmarkPerSqFt && benchmarkPerSqFt > 0) {
      const ratio = pricePerSqFt / benchmarkPerSqFt;
      if (ratio < 0.55) {
        reasons.push("Implied price is far below expected benchmark pricing.");
        confidenceScore -= 18;
      } else if (ratio < 0.72) {
        reasons.push("Implied price is somewhat below expected benchmark pricing.");
        confidenceScore -= 8;
      }
      if (ratio > 2.2) {
        reasons.push("Implied price is far above expected benchmark pricing.");
        confidenceScore -= 18;
      } else if (ratio > 1.7) {
        reasons.push("Implied price is somewhat above expected benchmark pricing.");
        confidenceScore -= 8;
      }
    }
  } else {
    reasons.push("Quote price was not available for validation.");
    confidenceScore -= 10;
  }
  confidenceScore = Math.round(clampNumber(confidenceScore, 0, 100));
  return {
    isValid: confidenceScore >= 45,
    confidenceScore,
    confidence: getConfidenceLabel(confidenceScore),
    pricePerSqFt: pricePerSqFt && isFinite(pricePerSqFt) ? pricePerSqFt : null,
    status: confidenceScore >= 75 ? "strong" : confidenceScore >= 45 ? "usable" : "weak",
    reasons
  };
}
function getRoofSizeReasoning({
  usedUserInput,
  usedParsedValue,
  usedEstimatedValue,
  roofSize,
  material,
  price,
  validation
}) {
  if (usedUserInput) {
    return `Using user-provided roof size of ${formatNumber(roofSize)} sq ft.`;
  }
  if (usedParsedValue) {
    return `Using roof size detected from the uploaded quote: ${formatNumber(roofSize)} sq ft.`;
  }
  if (usedEstimatedValue) {
    const priceText = toFiniteNumber(price) ? formatCurrency(price) : "the quote price";
    const materialText = getMaterialLabel(material);
    let base = `Estimated roof size at ${formatNumber(roofSize)} sq ft from ${priceText} using typical ${materialText} benchmark pricing.`;
    if (validation?.reasons?.length) {
      base += ` Validation notes: ${validation.reasons.join(" ")}`;
    }
    return base;
  }
  if (validation?.reasons?.length) {
    return validation.reasons.join(" ");
  }
  return "No reliable roof size was available from user input, parsed quote data, or estimation fallback.";
}
function evaluateRoofSizeDisagreement({
  parsedRoofSize,
  estimatedRoofSize,
  quotePrice,
  material
}) {
  const parsedValue = normalizeRoofSizeValue(parsedRoofSize);
  const estimatedValue = normalizeRoofSizeValue(estimatedRoofSize);
  if (!parsedValue || !estimatedValue) {
    return {
      hasDisagreement: false,
      severity: "none",
      diffPct: 0,
      message: ""
    };
  }
  const diffPct = Math.abs(parsedValue - estimatedValue) / parsedValue;
  let severity = "none";
  let message = "";
  if (diffPct > 0.35) {
    severity = "high";
    message = "Detected roof size differs materially from the modeled estimate and may need review.";
  } else if (diffPct > 0.2) {
    severity = "medium";
    message = "Detected roof size differs somewhat from the modeled estimate.";
  }
  if (!severity || severity === "none") {
    return {
      hasDisagreement: false,
      severity: "none",
      diffPct,
      message: ""
    };
  }
  const parsedValidation = validateRoofSizeCandidate({
    roofSize: parsedValue,
    price: quotePrice,
    material
  });
  return {
    hasDisagreement: true,
    severity,
    diffPct,
    message,
    parsedValidation
  };
}
function buildRoofSizeConsistencySummary(signals = {}) {
  const parsed = normalizeRoofSizeValue(signals.parsed);
  const property = normalizeRoofSizeValue(signals.property);
  const priceImplied = normalizeRoofSizeValue(signals.priceImplied);
  const available = [
    { key: "parsed", label: "Quote", value: parsed },
    { key: "property", label: "Property", value: property },
    { key: "priceImplied", label: "Price model", value: priceImplied }
  ].filter(item => item.value);
  if (available.length < 2) {
    return {
      hasConflict: false,
      severity: "none",
      summary: "",
      details: []
    };
  }
  const details = [];
  let maxDiffPct = 0;
  for (let i = 0; i < available.length; i++) {
    for (let j = i + 1; j < available.length; j++) {
      const a = available[i];
      const b = available[j];
      const diffPct = Math.abs(a.value - b.value) / Math.max(a.value, b.value);
      maxDiffPct = Math.max(maxDiffPct, diffPct);
      details.push({
        pair: `${a.key}_vs_${b.key}`,
        label: `${a.label} vs ${b.label}`,
        aValue: a.value,
        bValue: b.value,
        diffPct
      });
    }
  }
  let severity = "none";
  let summary = "";
  if (maxDiffPct > 0.3) {
    severity = "high";
    summary = "Roof size signals differ materially and should be reviewed before relying on the result.";
  } else if (maxDiffPct > 0.18) {
    severity = "medium";
    summary = "Roof size signals are somewhat inconsistent.";
  } else {
    severity = "low";
    summary = "Available roof size signals are reasonably aligned.";
  }
  return {
    hasConflict: severity === "medium" || severity === "high",
    severity,
    summary,
    details
  };
}
async function lookupPropertyRoofSignals(address = {}) {
  const normalized = normalizeAddressInput(address);
  if (!hasUsableAddress(normalized)) {
    return null;
  }
  const key = buildPropertyAddressKey(normalized);
  const cached = getCachedPropertyRoofSignals(normalized);
  if (cached) {
    return {
      ...cached,
      addressKey: key,
      fullAddress: normalized.fullAddress,
      cacheHit: true
    };
  }
  const apiResult = await fetchPropertyRoofSignalsFromApi(normalized);
  if (apiResult) {
    const normalizedApiResult = {
      ...apiResult,
      addressKey: key,
      fullAddress: normalized.fullAddress,
      source: apiResult.source || "property_api"
    };
    setCachedPropertyRoofSignals(normalized, normalizedApiResult);
    return normalizedApiResult;
  }
    return null;
}
function estimateRoofSizeFromLivingAreaFallback({
    propertySignals,
    complexityFactor = 1,
    tearOffFactor = 1
  }) {
    if (!propertySignals) return null;
    const livingAreaSqFt = normalizeRoofSizeValue(
      propertySignals?.livingAreaSqFt || propertySignals?.livingArea || null
    );
    if (!livingAreaSqFt || livingAreaSqFt <= 0) {
      return null;
    }
    const estimatedRoofSize = Math.round(
      livingAreaSqFt * 1.3 * Number(complexityFactor || 1) * Number(tearOffFactor || 1)
    );
    if (!estimatedRoofSize || estimatedRoofSize <= 0) {
      return null;
    }
    return {
      roofSize: estimatedRoofSize,
      livingAreaSqFt,
      method: "living_area_x_1_3"
    };
  }
function estimateRoofSizeFromPropertySignals({
  propertySignals,
  quotePrice,
  material,
  complexityFactor = 1,
  tearOffFactor = 1
}) {
  if (!propertySignals) return null;
  const footprintSqFt = toFiniteNumber(propertySignals?.footprintSqFt);
  const livingAreaSqFt = toFiniteNumber(propertySignals?.livingAreaSqFt);
  const stories = toFiniteNumber(propertySignals?.stories) || 1;
  const propertyType = String(propertySignals?.propertyType || "").toLowerCase().trim();
  let baseArea = null;
  let method = "";
  let sourceQuality = String(propertySignals?.sourceQuality || "unknown").toLowerCase();
  if (footprintSqFt && footprintSqFt > 0) {
    baseArea = footprintSqFt;
    method = "footprint";
  } else if (livingAreaSqFt && livingAreaSqFt > 0) {
    baseArea = livingAreaSqFt / Math.max(stories, 1);
    method = "living_area_proxy";
  }
  if (!baseArea || baseArea <= 0) {
    return null;
  }
  let pitchFactor = 1.12;
  let complexityMultiplier = Number(complexityFactor || 1);
  let tearOffMultiplier = Number(tearOffFactor || 1);
  if (
    propertyType.includes("townhome") ||
    propertyType.includes("condo") ||
    propertyType.includes("multi")
  ) {
    pitchFactor = 1.08;
    sourceQuality = "low";
  }
  const estimatedRoofSize = Math.round(
    baseArea * pitchFactor * complexityMultiplier * tearOffMultiplier
  );
  if (!estimatedRoofSize || estimatedRoofSize <= 0) {
    return null;
  }
  const benchmarkInfo = getRoofSizeEstimateBenchmark({
    city: propertySignals?.city || "",
    stateCode: propertySignals?.stateCode || "",
    material,
    complexityFactor,
    tearOffFactor
  });
  const candidateCount = Number(
    propertySignals?.candidateCount ||
    propertySignals?.buildingCandidateCount ||
    propertySignals?.matches?.length ||
    propertySignals?.buildings?.length ||
    0
  );
  const buildingMatchQuality =
    String(
      propertySignals?.buildingMatchQuality ||
      propertySignals?.matchQuality ||
      propertySignals?.sourceQuality ||
      "unknown"
    ).toLowerCase();
  const geocodeMatchQuality =
    String(
      propertySignals?.geocodeMatchQuality ||
      propertySignals?.geocodeQuality ||
      "unknown"
    ).toLowerCase();
  const ambiguousBuildingMatch =
    !!propertySignals?.ambiguousBuildingMatch ||
    !!propertySignals?.ambiguous ||
    candidateCount > 1;
  const confidenceModifier =
    Number(propertySignals?.confidenceModifier || 0);
  const selectedBuilding =
    propertySignals?.selectedBuilding ||
    propertySignals?.matchedBuilding ||
    propertySignals?.building ||
    null;
  return {
    roofSize: estimatedRoofSize,
    benchmarkPerSqFt: benchmarkInfo.adjustedBenchmarkPerSqFt,
    baseBenchmarkPerSqFt: benchmarkInfo.baseBenchmarkPerSqFt,
    method,
    sourceQuality,
    baseArea: Math.round(baseArea),
    pitchFactor,
    meta: {
      propertySignals: {
        buildingMatchQuality,
        confidenceModifier,
        candidateCount,
        ambiguous: ambiguousBuildingMatch,
        selectedBuilding,
        geocodeMatchQuality
      }
    }
  };
}
async function estimateRoofSize({ address = {}, parsed = {}, userInput = {} }) {
  const normalizedAddress = normalizeAddressInput(address);
  const userRoofSize = normalizeRoofSizeValue(userInput?.roofSize);
  const parsedRoofSize = normalizeRoofSizeValue(parsed?.roofSize);
  const quotePrice = toFiniteNumber(userInput?.quotePrice || parsed?.price);
  const material = userInput?.material || parsed?.material || "architectural";
  const city = normalizedAddress?.city || parsed?.city || "";
  const stateCode = normalizedAddress?.stateCode || parsed?.stateCode || "";
  const complexityFactor = Number(userInput?.complexityFactor || 1);
  const tearOffFactor = Number(userInput?.tearOffFactor || 1);
  if (userRoofSize) {
    const validation = validateRoofSizeCandidate({
      roofSize: userRoofSize,
      price: quotePrice,
      material
    });
    const confidenceScore = Math.max(validation.confidenceScore, 88);
    return {
      roofSize: userRoofSize,
      confidence: getConfidenceLabel(confidenceScore),
      confidenceScore,
      source: "user_input",
      reasoning: getRoofSizeReasoning({
        usedUserInput: true,
        usedParsedValue: false,
        usedEstimatedValue: false,
        roofSize: userRoofSize,
        material,
        price: quotePrice,
        validation
      }),
      meta: {
        address: normalizedAddress,
        fallbackUsed: false,
        parsedRoofSize: parsedRoofSize || null,
        estimatedFromPrice: false,
        validation
      }
    };
  }
  if (parsedRoofSize) {
    const validation = validateRoofSizeCandidate({
      roofSize: parsedRoofSize,
      price: quotePrice,
      material
    });
    const estimatedCrossCheck = estimateRoofSizeFromPrice({
      price: quotePrice,
      material,
      city,
      stateCode,
      complexityFactor,
      tearOffFactor
    });
    const disagreement = evaluateRoofSizeDisagreement({
      parsedRoofSize,
      estimatedRoofSize: estimatedCrossCheck?.roofSize || null,
      quotePrice,
      material
    });
    let confidenceScore = Math.max(validation.confidenceScore, 62);
    if (disagreement.hasDisagreement) {
      if (disagreement.severity === "high") {
        confidenceScore = Math.min(confidenceScore, 52);
      } else if (disagreement.severity === "medium") {
        confidenceScore = Math.min(confidenceScore, 64);
      }
    }
    const reasoningValidation = {
      ...validation,
      reasons: [
        ...(validation?.reasons || []),
        ...(disagreement?.message ? [disagreement.message] : [])
      ]
    };
    return {
      roofSize: parsedRoofSize,
      confidence: getConfidenceLabel(confidenceScore),
      confidenceScore,
      source: parsed?.roofSizeSource || "parsed_quote",
      reasoning: getRoofSizeReasoning({
        usedUserInput: false,
        usedParsedValue: true,
        usedEstimatedValue: false,
        roofSize: parsedRoofSize,
        material,
        price: quotePrice,
        validation: reasoningValidation
      }),
      meta: {
        address: normalizedAddress,
        fallbackUsed: false,
        parsedRoofSize,
        estimatedFromPrice: false,
        validation,
        disagreement: {
          hasDisagreement: disagreement.hasDisagreement,
          severity: disagreement.severity,
          diffPct: disagreement.diffPct,
          message: disagreement.message,
          estimatedCrossCheckRoofSize: estimatedCrossCheck?.roofSize || null
        },
        roofSizeSignals: {
          parsed: parsedRoofSize || null,
          property: null,
          priceImplied: estimatedCrossCheck?.roofSize || null
        }
      }
    };
  }
    const hasAddressSignal = hasUsableAddress(normalizedAddress);
      if (hasAddressSignal) {
        const propertySignals = await lookupPropertyRoofSignals(normalizedAddress);
        const propertyEstimate = estimateRoofSizeFromPropertySignals({
          propertySignals,
          quotePrice,
          material,
          complexityFactor,
          tearOffFactor
        });
        if (propertyEstimate?.roofSize) {
          const validation = validateRoofSizeCandidate({
            roofSize: propertyEstimate.roofSize,
            price: quotePrice,
            material
          });
          const propertySignalsMeta = propertyEstimate?.meta?.propertySignals || {};
          const livingAreaSqFt = normalizeRoofSizeValue(
            propertySignals?.livingAreaSqFt || propertySignals?.livingArea || null
          );
          let confidenceScore = Math.max(validation.confidenceScore, 54);
          if (propertyEstimate.sourceQuality === "high") {
            confidenceScore = Math.max(confidenceScore, 78);
          } else if (propertyEstimate.sourceQuality === "medium") {
            confidenceScore = Math.max(confidenceScore, 66);
          } else {
            confidenceScore = Math.max(confidenceScore, 54);
          }
          if (propertySignalsMeta.buildingMatchQuality === "high") {
            confidenceScore += 10;
          } else if (
            propertySignalsMeta.buildingMatchQuality === "approximate" ||
            propertySignalsMeta.buildingMatchQuality === "low"
          ) {
            confidenceScore -= 8;
          }
          if (propertySignalsMeta.ambiguous) {
            confidenceScore -= 20;
          }
          if (isFinite(Number(propertySignalsMeta.confidenceModifier))) {
            confidenceScore += Number(propertySignalsMeta.confidenceModifier);
          }
          confidenceScore = Math.round(clampNumber(confidenceScore, 0, 88));
          return {
            roofSize: propertyEstimate.roofSize,
            confidence: getConfidenceLabel(confidenceScore),
            confidenceScore,
            source: "address_estimated",
            reasoning: `Estimated roof size is about ${formatNumber(Math.round(propertyEstimate.roofSize / 50) * 50)} sq ft using property-level data tied to the address.${propertyEstimate.method === "footprint" ? " Based on building footprint." : " Based on structure proxy data."}`,
            meta: {
              address: normalizedAddress,
              fallbackUsed: false,
              parsedRoofSize: parsedRoofSize || null,
              estimatedFromPrice: false,
              estimatedFromAddress: true,
              propertySignals,
              propertySignalsMeta,
              livingAreaSqFt: livingAreaSqFt || null,
              benchmarkPerSqFt: propertyEstimate.benchmarkPerSqFt,
              baseBenchmarkPerSqFt: propertyEstimate.baseBenchmarkPerSqFt,
              method: propertyEstimate.method,
              sourceQuality: propertyEstimate.sourceQuality,
              baseArea: propertyEstimate.baseArea,
              pitchFactor: propertyEstimate.pitchFactor,
              complexityFactor,
              tearOffFactor,
              validation,
              roofSizeSignals: {
                parsed: parsedRoofSize || null,
                property: propertyEstimate.roofSize || null,
                priceImplied: quotePrice
                  ? (estimateRoofSizeFromPrice({
                      price: quotePrice,
                      material,
                      city,
                      stateCode,
                      complexityFactor,
                      tearOffFactor
                    })?.roofSize || null)
                  : null,
                metadata: {
                  propertyQuality: propertySignalsMeta.buildingMatchQuality || "unknown",
                  propertyAmbiguous: !!propertySignalsMeta.ambiguous,
                  geocodeMatchQuality: propertySignalsMeta.geocodeMatchQuality || "unknown",
                  candidateCount: Number(propertySignalsMeta.candidateCount || 0)
                }
              }
             }
            };
           }
          const livingAreaFallback = estimateRoofSizeFromLivingAreaFallback({
            propertySignals,
            complexityFactor,
            tearOffFactor
          });
          if (livingAreaFallback?.roofSize) {
            const validation = validateRoofSizeCandidate({
              roofSize: livingAreaFallback.roofSize,
              price: quotePrice,
              material
            });
            const confidenceScore = Math.round(
              clampNumber(Math.max(validation.confidenceScore, 58), 50, 72)
            );
            return {
              roofSize: livingAreaFallback.roofSize,
              confidence: getConfidenceLabel(confidenceScore),
              confidenceScore,
              source: "living_area_fallback",
              reasoning: `Estimated roof size from home size using a 1.3 multiplier on ${formatNumber(livingAreaFallback.livingAreaSqFt)} sq ft of living area.`,
              meta: {
                address: normalizedAddress,
                fallbackUsed: true,
                parsedRoofSize: parsedRoofSize || null,
                estimatedFromPrice: false,
                estimatedFromAddress: false,
                estimatedFromLivingArea: true,
                propertySignals,
                propertySignalsMeta: {
                  buildingMatchQuality: "unknown",
                  confidenceModifier: 0,
                  candidateCount: Number(
                    propertySignals?.candidateCount ||
                    propertySignals?.buildingCandidateCount ||
                    propertySignals?.matches?.length ||
                    propertySignals?.buildings?.length ||
                    0
                  ),
                  ambiguous:
                    !!propertySignals?.ambiguousBuildingMatch ||
                    !!propertySignals?.ambiguous ||
                    false,
                  selectedBuilding:
                    propertySignals?.selectedBuilding ||
                    propertySignals?.matchedBuilding ||
                    propertySignals?.building ||
                    null,
                  geocodeMatchQuality: String(
                    propertySignals?.geocodeMatchQuality ||
                    propertySignals?.geocodeQuality ||
                    "unknown"
                  ).toLowerCase()
                },
                livingAreaSqFt: livingAreaFallback.livingAreaSqFt,
                method: livingAreaFallback.method,
                complexityFactor,
                tearOffFactor,
                validation,
                roofSizeSignals: {
                  parsed: parsedRoofSize || null,
                  property: livingAreaFallback.roofSize || null,
                  priceImplied: quotePrice
                    ? (estimateRoofSizeFromPrice({
                        price: quotePrice,
                        material,
                        city,
                        stateCode,
                        complexityFactor,
                        tearOffFactor
                      })?.roofSize || null)
                    : null
                }
              }
            };
          }
        }
        const priceBasedEstimate = estimateRoofSizeFromPrice({
          price: quotePrice,
          material,
          city,
          stateCode,
          complexityFactor,
          tearOffFactor
        });
        if (priceBasedEstimate?.roofSize) {
          const validation = validateRoofSizeCandidate({
            roofSize: priceBasedEstimate.roofSize,
            price: quotePrice,
            material
          });
          const estimateConfidence = calculateRoofSizeEstimateConfidence({
            estimatedRoofSize: priceBasedEstimate.roofSize,
            parsedRoofSize,
            quotePrice,
            material,
            benchmarkPerSqFt: priceBasedEstimate.benchmarkPerSqFt,
            city,
            stateCode
          });
          return {
            roofSize: priceBasedEstimate.roofSize,
            confidence: estimateConfidence.confidence,
            confidenceScore: estimateConfidence.confidenceScore,
            source: "price_based_estimate",
            reasoning: getRoofSizeReasoning({
              usedUserInput: false,
              usedParsedValue: false,
              usedEstimatedValue: true,
              roofSize: priceBasedEstimate.roofSize,
              material,
              price: quotePrice,
              validation: {
                ...validation,
                reasons: estimateConfidence.reasons
              }
            }),
            meta: {
              address: normalizedAddress,
              fallbackUsed: true,
              parsedRoofSize: parsedRoofSize || null,
              estimatedFromPrice: true,
              benchmarkPerSqFt: priceBasedEstimate.benchmarkPerSqFt,
              baseBenchmarkPerSqFt: priceBasedEstimate.baseBenchmarkPerSqFt,
              complexityFactor,
              tearOffFactor,
              validation,
              roofSizeSignals: {
                parsed: parsedRoofSize || null,
                property: null,
                priceImplied: priceBasedEstimate.roofSize || null
              }
            }
          };
        }
        const validation = validateRoofSizeCandidate({
          roofSize: null,
          price: quotePrice,
          material
        });
        return {
          roofSize: null,
          confidence: validation.confidence,
          confidenceScore: validation.confidenceScore,
          source: "unavailable",
          reasoning: getRoofSizeReasoning({
            usedUserInput: false,
            usedParsedValue: false,
            usedEstimatedValue: false,
            roofSize: null,
            material,
            price: quotePrice,
            validation
          }),
          meta: {
            address: normalizedAddress,
            fallbackUsed: true,
            parsedRoofSize: parsedRoofSize || null,
            estimatedFromPrice: false,
            complexityFactor,
            tearOffFactor,
            validation
          }
        };
      }
window.estimateRoofSizeFromPropertySignals = estimateRoofSizeFromPropertySignals;
window.estimateRoofSizeFromLivingAreaFallback = estimateRoofSizeFromLivingAreaFallback;
window.buildPropertyAddressKey = buildPropertyAddressKey;
window.getCachedPropertyRoofSignals = getCachedPropertyRoofSignals;
window.setCachedPropertyRoofSignals = setCachedPropertyRoofSignals;
window.fetchPropertyRoofSignalsFromApi = fetchPropertyRoofSignalsFromApi;
window.buildRoofSizeConsistencySummary = buildRoofSizeConsistencySummary;
function normalizeEvidence(text) {
  return normalizeWhitespace(text).slice(0, 120);
}
function shouldPromoteAddress(parsed) {
  const addr = parsed?.address || {};
  return !!(
    addr.street &&
    (addr.city || addr.zip) &&
    addr.stateCode
  );
}
function classifyMoneyLine(lineText = "") {
  const line = String(lineText || "").toLowerCase();
  if (/grand total|final total|proposal total|contract total|project total|total estimated cost|estimate total|total estimate/.test(line)) {
    return "strong_total";
  }
  if (/amount due|total due|contract price|total cost|project amount|total investment/.test(line)) {
    return "medium_total";
  }
  if (/balance due|remaining balance|balance at completion/.test(line)) {
    return "balance";
  }
  if (/subtotal/.test(line)) {
    return "subtotal";
  }
  if (/deductible|deductible credit|deposit|down payment|rebate|discount|coupon|allowance|actual cash value|acv|depreciation/.test(line)) {
    return "non_total_money";
  }
  if (/qty|quantity|unit price|unit cost|per square|per sq|per sheet|per bundle|per item|sales tax|tax amount/.test(line)) {
    return "table_money";
  }
  return "generic";
}
function scoreMoneyCandidate(value, contextText, lineText = "") {
  let score = 50;
  const ctx = String(contextText || "").toLowerCase();
  const line = String(lineText || "").toLowerCase();
  const lineClass = classifyMoneyLine(line);
  const totalPhraseRegex =
    /grand total|total estimate|estimate total|total project cost|project total|contract total|contract price|proposal total|final total|final amount|amount due|amount owed|total due|total estimated cost|totol estimated cost|project amount|total investment|total cost/;
  const datePhraseRegex =
    /invoice date|due date|payment due date|proposal date|issue date|issued|date issued|expires|expiration date|valid through|valid until|date|signed on|customer signature date/;
  const lineItemRegex =
    /qty|quantity|unit price|unit cost|per square|per sq|per sheet|per bundle|per item|sales tax|tax amount/;
  const nonTotalMoneyRegex =
    /deductible|deposit|down payment|monthly|finance|payment|allowance|rebate|coupon|discount|remaining balance|balance at completion|balance due|actual cash value|acv|depreciation/;
  const roofSizeRegex =
    /roof size|roof area|sq\.?\s*f[tf]|square feet|square foot|\bsf\b|\bsquares\b/;
  const datePatternRegex =
    /\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b/;
  if (totalPhraseRegex.test(ctx)) {
    score += 140;
  } else if (/subtotal/.test(ctx)) {
    score -= 20;
  } else if (/\btotal\b/.test(ctx) && value >= 3000 && value <= 100000) {
    score += 120;
  } else if (/total|price|cost|amount|proposal|contract|investment/.test(ctx)) {
    score += 25;
  }
  if (totalPhraseRegex.test(line)) score += 180;
  if (/grand total|contract total|proposal total|final total|amount due|total due/.test(line)) score += 80;
  if (/subtotal/.test(line)) score -= 40;
  const hasStrongTotalContext =
    totalPhraseRegex.test(ctx) ||
    totalPhraseRegex.test(line) ||
    /total estimate|estimate total/.test(ctx) ||
    /total estimate|estimate total/.test(line);
  if (roofSizeRegex.test(ctx) && !hasStrongTotalContext) score -= 180;
  if (roofSizeRegex.test(line) && !hasStrongTotalContext) score -= 260;
  if (/phone|tel|fax|mobile|call/.test(ctx)) score -= 80;
  if (/\b(zip|zipcode|zip code|address|property address|mailing address)\b/.test(ctx)) score -= 180;
  if (/\b(account|claim number|policy number)\b/.test(ctx)) score -= 40;
  if (/license|lic #|license #|proposal number|estimate number|invoice number|reference number|check number/.test(ctx)) score -= 160;
  if (/license|lic #|license #|proposal number|estimate number|invoice number|reference number|check number/.test(line)) score -= 220;
  if (/envelope\s*id|docusign|[0-9a-f]{8}-[0-9a-f]{4}/i.test(ctx)) score -= 300;
  if (/envelope\s*id|docusign|[0-9a-f]{8}-[0-9a-f]{4}/i.test(line)) score -= 300;
  if (nonTotalMoneyRegex.test(ctx)) score -= 70;
  if (nonTotalMoneyRegex.test(line)) score -= 90;
  if (lineItemRegex.test(ctx)) score -= 20;
  if (lineItemRegex.test(line)) score -= 35;
  if (/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(ctx)) score -= 120;
  if (Number.isInteger(value) && value >= 2024 && value <= 2035) {
    score -= 220;
  }
  if (
    Number.isInteger(value) &&
    value >= 2024 &&
    value <= 2035 &&
    (datePhraseRegex.test(ctx) || datePhraseRegex.test(line) || datePatternRegex.test(ctx) || datePatternRegex.test(line))
  ) {
    score -= 260;
  }
  if (datePhraseRegex.test(ctx)) score -= 90;
  if (datePhraseRegex.test(line)) score -= 130;
  if (datePatternRegex.test(ctx)) score -= 50;
  if (datePatternRegex.test(line)) score -= 80;
  if (lineClass === "strong_total") score += 220;
  if (lineClass === "medium_total") score += 90;
  if (lineClass === "balance") score -= 70;
  if (lineClass === "subtotal") score -= 80;
  if (lineClass === "non_total_money") score -= 140;
  if (lineClass === "table_money") score -= 100;
  if (value < 500) score -= 60;
  if (value >= 500 && value < 1500) score -= 40;
  else if (value < 2000) score -= 20;
  else if (value >= 3000 && value <= 100000) score += 20;
  if (value > 250000) score -= 80;
  if (
    Number.isInteger(value) &&
    value >= 10000 &&
    value <= 99999 &&
    /\b(address|property address|mailing address|zip|zipcode|zip code)\b/i.test(ctx + " " + line) &&
    !/\$\s*\d|,\d{3}|\.\d{2}\b/.test(ctx + " " + line)
  ) {
    score -= 320;
  }
  return score;
}
function normalizeOcrNumberString(raw) {
  let value = String(raw || "").trim();
  const original = value;
  const looksNumericish =
    /^[\s$.,OIlSBZAoilsbgzaGg|]+$/.test(value) ||
    /[\d]/.test(value) ||
    /[$,\.]/.test(value);
  if (!looksNumericish) {
    return "";
  }
  value = value
    .replace(/[Oo]/g, "0")
    .replace(/[Il|]/g, "1")
    .replace(/[Ss]/g, "5")
    .replace(/[Bb]/g, "8")
    .replace(/[Zz]/g, "2");
  const hasMostlyDigitsAfterLightRepair =
    (value.match(/\d/g) || []).length >= Math.max(2, Math.floor(original.length * 0.4));
  if (hasMostlyDigitsAfterLightRepair) {
    value = value.replace(/[Gg]/g, "9");
  }
  value = value.replace(/[^\d.,\s]/g, "");
  return value.replace(/[^\d]/g, "");
}
function parseMoneyToNumber(value) {
  if (value == null) return NaN;
  const cleaned = String(value)
    .replace(/[^0-9.,]/g, "")
    .trim();
  if (!cleaned) return NaN;
  const normalized = cleaned.includes(",") && cleaned.includes(".")
    ? cleaned.replace(/,/g, "")
    : cleaned.replace(/,/g, "");
  const num = Number(normalized);
  return isFinite(num) ? num : NaN;
}
function parsePossiblyBrokenMoney(raw) {
  const repaired = normalizeOcrNumberString(raw);
  if (!repaired) return NaN;
  const num = Number(repaired);
  return isFinite(num) ? num : NaN;
}
function repairBrokenLeadingMoney(raw, contextText = "") {
  const text = String(raw || "").trim();
  const ctx = String(contextText || "").toLowerCase();
  if (!/^[,.\s]\d{3,4}$/.test(text) && !/^\$?\s*[,\.]\d{3,4}$/.test(text)) {
    return NaN;
  }
  const digits = text.replace(/[^\d]/g, "");
  if (!digits) return NaN;
  if (/grand total|total estimated cost|proposal total|contract total|total due|amount due|total cost|final total/.test(ctx)) {
    const repaired8 = Number("8" + digits);
    if (isFinite(repaired8) && repaired8 >= 3000 && repaired8 <= 250000) return repaired8;
    const repaired9 = Number("9" + digits);
    if (isFinite(repaired9) && repaired9 >= 3000 && repaired9 <= 250000) return repaired9;
    const repaired1 = Number("1" + digits);
    if (isFinite(repaired1) && repaired1 >= 3000 && repaired1 <= 250000) return repaired1;
  }
  return NaN;
}
function parseMoneyLikeValue(raw, contextText = "") {
  const trimmed = String(raw || "").trim();
  const isBrokenLeadingFragment =
    /^[,\.]\d{3,4}$/.test(trimmed) || /^\$?\s*[,\.]\d{3,4}$/.test(trimmed);
  const hasOcrLikeLetters = /[OIlSBGZAoilsbgza]/.test(trimmed);
  const direct = parseMoneyToNumber(raw);
  if (isBrokenLeadingFragment) {
    const brokenLeading = repairBrokenLeadingMoney(raw, contextText);
    if (isFinite(brokenLeading) && brokenLeading >= 500) return brokenLeading;
    const repaired = parsePossiblyBrokenMoney(raw);
    if (isFinite(repaired) && repaired >= 500) return repaired;
    return NaN;
  }
  if (hasOcrLikeLetters) {
    const repaired = parsePossiblyBrokenMoney(raw);
    if (isFinite(repaired) && repaired >= 500) {
      return repaired;
    }
  }
  if (isFinite(direct) && direct >= 500) return direct;
  const repaired = parsePossiblyBrokenMoney(raw);
  if (isFinite(repaired) && repaired >= 500) return repaired;
  const brokenLeading = repairBrokenLeadingMoney(raw, contextText);
  if (isFinite(brokenLeading) && brokenLeading >= 500) return brokenLeading;
  return NaN;
}
function extractPriceCandidates(text) {
  const candidates = [];
  const seen = new Set();
  const source = String(text || "");
  const regex =
    /\$?\s?[0-9OIlSBGZAoilsbgza]{1,3}(?:[.,][0-9OIlSBGZAoilsbgza]{3})+(?:[.,][0-9OIlSBGZAoilsbgza]{2})?|\$?\s?[0-9OIlSBGZAoilsbgza]{4,6}(?:[.,][0-9OIlSBGZAoilsbgza]{2})?/g;
  let match;
  while ((match = regex.exec(source)) !== null) {
    const matchText = match[0];
    const trimmedMatchText = matchText.trim();
    const isPlainZipLikeToken = /^\d{5}$/.test(trimmedMatchText);
    const start = match.index;
    const end = match.index + matchText.length;
    if (/^[,\.]\d{3,4}$/.test(trimmedMatchText) || /^\$\s*[,\.]\d{3,4}$/.test(trimmedMatchText)) {
      continue;
    }
    const contextStart = Math.max(0, start - 140);
    const contextEnd = Math.min(source.length, end + 140);
    const context = source.slice(contextStart, contextEnd);
    const lowerContext = context.toLowerCase();
    const value = parseMoneyLikeValue(matchText, context);
    if (/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(matchText)) continue;
    if (!isFinite(value) || value < 500 || value > 250000) continue;
    const lineStart = source.lastIndexOf("\n", start) + 1;
    const lineEndRaw = source.indexOf("\n", end);
    const lineEnd = lineEndRaw === -1 ? source.length : lineEndRaw;
    const lineText = source.slice(lineStart, lineEnd).trim().toLowerCase();
    const fullMatchContext = `${context} ${lineText}`.toLowerCase();
    let score = scoreMoneyCandidate(value, context, lineText);
    if (
      isPlainZipLikeToken &&
      /\b(address|property address|mailing address|zip|zipcode|zip code)\b/.test(fullMatchContext)
    ) {
      score -= 320;
    }
    if (/\b(phone|tel|fax|mobile|call|contact)\b/.test(fullMatchContext)) {
      score -= 400;
    }
    if (
      Number.isInteger(value) &&
      value >= 2024 &&
      value <= 2035 &&
      (
        /invoice date|due date|payment due date|proposal date|issue date|issued|expires|valid through|valid until|signed on|date/i.test(lineText) ||
        /\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b/.test(lineText)
      )
    ) {
      score -= 300;
    }
    if (/\$|,\d{3}|\.\d{2}\b/.test(matchText)) {
      score += 20;
    }
    const relativePosition = start / Math.max(1, source.length);
    if (relativePosition > 0.55) {
      score += 10;
    }
    const strongTotalLineRegex =
      /grand total|total estimate|estimate total|total project cost|project total|contract total|contract price|proposal total|total estimated cost|totol estimated cost|total due|estimated cost|total cost|final total|amount due|\btotal\b/;
    const candidateIndexInLine = start - lineStart;
    const totalPhraseIndexInLine = lineText.search(strongTotalLineRegex);
    const isNearStrongTotalPhrase =
    totalPhraseIndexInLine >= 0 &&
    candidateIndexInLine >= 0 &&
    Math.abs(candidateIndexInLine - totalPhraseIndexInLine) <= 80;
    if (isNearStrongTotalPhrase) {
    score += 220;
    }
    if (/grand total|proposal total|contract total|final total/.test(lineText) && isNearStrongTotalPhrase) {
    score += 80;
    }
    if (/amount due/.test(lineText) && isNearStrongTotalPhrase) {
      score += 40;
    }
    if (/balance due/.test(lineText) && isNearStrongTotalPhrase) {
      score -= 40;
    }
    if (/deductible|deposit|down payment/.test(lineText) && !isNearStrongTotalPhrase) {
    score -= 140;
    }
    if (/subtotal/.test(lineText) && !isNearStrongTotalPhrase) {
    score -= 80;
  }
    if (/subtotal/.test(lineText) && isNearStrongTotalPhrase) {
      score += 100;
    }
    if (/project total|total contract price|final contract total|final total|amount due/.test(lineText) && isNearStrongTotalPhrase) {
      score += 80;
    }
    const hasLineItemTableSignals =
      /description|qty|quantity|unit price|unit cost|subtotal|labor|materials|flashing replacement|ventilation upgrade/i.test(lineText);
    if (hasLineItemTableSignals && !strongTotalLineRegex.test(lineText)) {
      score -= 180;
    }
    if (/license|lic #|license #|proposal number|estimate number/.test(lineText)) {
      score -= 220;
    }
    if (/sales tax|tax amount/.test(lineText)) {
      score -= 20;
    }
    if (/deposit|down payment|deductible|deductible credit/.test(lineText)) {
    score -= 140;
    }
    if (/remaining balance|balance at completion|actual cash value|acv|depreciation/.test(lineText)) {
    score -= 120;
    }
    if (/balance due/.test(lineText) && !/grand total|final total|proposal total|contract total|project total/.test(lineText)) {
    score -= 140;
    }
    if (
      /roof size|roof area|sq\.?\s*f[tf]|square feet|square foot|\bsf\b|\bsquares\b/.test(lineText) &&
      !strongTotalLineRegex.test(lineText)
    ) {
      score -= 260;
    }
    if (
      /roof size|roof area|sq\.?\s*f[tf]|square feet|square foot|\bsf\b|\bsquares\b/.test(lowerContext) &&
      !strongTotalLineRegex.test(lineText)
    ) {
      score -= 180;
    }
    if (/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(lowerContext)) {
      score -= 120;
    }
    if (
      hasLineItemTableSignals &&
      /description|qty|quantity|unit price|unit cost|subtotal/i.test(lineText) &&
      value >= 300 &&
      value <= 50000 &&
      !strongTotalLineRegex.test(lineText)
    ) {
      score -= 120;
    }
    if (/deductible|deductible credit/.test(lineText) && value <= 5000) {
      score -= 120;
    }
    if (/balance due|remaining balance|balance at completion/.test(lineText)) {
      score -= 80;
    }
    let sourceType = "generic_money_candidate";
    if (
      Number.isInteger(value) &&
      value >= 2024 &&
      value <= 2035 &&
      (
        /invoice date|due date|payment due date|proposal date|issue date|issued|expires|valid through|valid until|signed on|date/i.test(lineText) ||
        /\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b/.test(lineText)
      )
    ) {
      sourceType = "date_like_year_candidate";
    } else if (
      /^\d{5}$/.test(matchText.trim()) &&
      /\b(address|property address|mailing address|zip|zipcode|zip code)\b/.test(fullMatchContext)
    ) {
      sourceType = "zip_or_address_candidate";
    } else if (
    /deposit|down payment|deductible|deductible credit/.test(lineText) &&
    !/qty|quantity|unit price|labor|materials/.test(lineText) &&
    !isNearStrongTotalPhrase
    ) {
  sourceType = "deposit_or_deductible";
    } else if (/remaining balance|balance at completion|balance due|actual cash value|acv|depreciation/.test(lineText) && !isNearStrongTotalPhrase) {
      sourceType = "balance_or_acv";
    } else if (/subtotal/.test(lineText) && !isNearStrongTotalPhrase) {
      sourceType = "subtotal_line";
    } else if (
    isNearStrongTotalPhrase &&
    !/deductible|deposit|credit|rebate|discount/.test(lineText)
    ) {
    sourceType = "final_total_phrase";
    } else if (
      /roof size|roof area|sq\.?\s*f[tf]|square feet|square foot|\bsf\b|\bsquares\b/.test(lineText) &&
      !strongTotalLineRegex.test(lineText)
    ) {
      sourceType = "roof_size_like";
    } else if (/[OIlSBGZAoilsbgza]/.test(matchText)) {
      sourceType = "ocr_repaired_candidate";
    }
    const key = `${Math.round(value)}|${Math.round(score)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({
      value,
      display: matchText.trim(),
      score,
      sourceType,
      context: normalizeEvidence(context)
    });
  }
  const brokenMoneyRegex = /\$?\s*[,\.]\d{3,4}\b/g;
  while ((match = brokenMoneyRegex.exec(source)) !== null) {
    const matchText = match[0];
    const start = match.index;
    const end = match.index + matchText.length;
    const contextStart = Math.max(0, start - 140);
    const contextEnd = Math.min(source.length, end + 140);
    const context = source.slice(contextStart, contextEnd);
    const lowerContext = context.toLowerCase();
    const lineStart = source.lastIndexOf("\n", start) + 1;
    const lineEndRaw = source.indexOf("\n", end);
    const lineEnd = lineEndRaw === -1 ? source.length : source.indexOf("\n", end);
    const lineText = source.slice(lineStart, lineEnd === -1 ? source.length : lineEnd).trim().toLowerCase();
    const value = parseMoneyLikeValue(matchText, `${context} ${lineText}`);
    if (/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(matchText)) continue;
    if (!isFinite(value) || value < 500 || value > 250000) continue;
    if (/\$\s*\d{1,3}(?:,\d{3})+(?:\.\d{2})?\b/.test(lineText)) {
      continue;
    }
    const hasStrongTotalContext =
      /grand total|total estimated cost|proposal total|contract total|amount due|total due|total cost|final total/.test(lowerContext);
    if (!hasStrongTotalContext) continue;
    let score = scoreMoneyCandidate(value, context, lineText);
    score += 180;
    const key = `${Math.round(value)}|broken|${Math.round(score)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({
      value,
      display: matchText.trim(),
      score,
      sourceType: "broken_leading_money_repair",
      context: normalizeEvidence(context)
    });
  }
  return candidates
    .sort((a, b) => b.score - a.score || b.value - a.value)
    .slice(0, 10);
}
const WARRANTY_DEBUG = true;
function isWarrantyDebugEnabled() {
  return Boolean(window.__TP_WARRANTY_DEBUG__);
}
function normalizeWarrantyText(text) {
  return String(text || "")
    .replace(/[–—]/g, "-")
    .replace(/\byears\b/gi, "year")
    .replace(/\byrs?\b/gi, "year")
    .replace(/\byr\b/gi, "year")
    .replace(/\blife\s+time\b/gi, "lifetime")
    .replace(/\bworkman\s*ship\b/gi, "workmanship")
    .replace(/\bmaterials\b/gi, "material")
    .replace(/\bshingles\b/gi, "shingle")
    .replace(/[|]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}
function scoreWarrantyCandidate(line, value, years, type) {
  const lineLower = String(line || "").toLowerCase();
  const valueLower = String(value || "").toLowerCase();
  let score = 0;
  if (/\bwarranty\b/.test(lineLower)) score += 35;
  if (/\bguarantee(d)?\b/.test(lineLower)) score += 14;
  if (/\b\d{1,2}\s*-?\s*year\b/.test(valueLower)) score += 24;
  if (/\blifetime\b/.test(valueLower)) score += 28;
  if (/\blimited lifetime\b/.test(valueLower)) score += 10;
  if (years >= 5 && years <= 50) score += 8;
  if (/\b(workmanship|labor|material|manufacturer|shingle|leak|watertight|wind)\b/.test(valueLower)) {
    score += 22;
  }
  if (/\b(workmanship|labor|material|manufacturer|shingle|leak|watertight|wind)\b/.test(lineLower)) {
    score += 10;
  }
  if (/\b(warranty|guarantee)\b/.test(lineLower) && /\b(workmanship|labor|material|manufacturer|shingle|leak|watertight|wind)\b/.test(lineLower)) {
    score += 12;
  }
  if (type === "limited_lifetime") score += 10;
  if (type === "lifetime") score += 6;
  if (type === "typed_numeric") score += 8;
  if (type === "generic_numeric") score += 2;
  if (value.length >= 18) score += 4;
  if (value.length >= 28) score += 4;
  if (line.length > 160) score -= 8;
  return score;
}
function extractWarrantyCandidate(line) {
  const source = String(line || "").trim();
  if (!source) return null;
  const normalizedLine = normalizeWarrantyText(source);
  const lower = normalizedLine.toLowerCase();
  if (
    !/\bwarranty\b|\bguarantee\b|\bguaranteed\b|\bworkmanship\b|\blabor\b|\bmaterial\b|\bmanufacturer\b|\bshingle\b|\bleak\b|\blifetime\b/.test(lower)
  ) {
    return null;
  }
  const patterns = [
  {
    type: "typed_numeric",
    regex: /\bwarranty\s*:?\s*(\d{1,2})\s*-?\s*years?\s+(workmanship|labor|material|manufacturer|shingle|leak|watertight|wind)\b/i
  },
  {
    type: "typed_numeric",
    regex: /\bwarranty\s*:?\s*(workmanship|labor|material|manufacturer|shingle|leak|watertight|wind)\s*:?\s*(\d{1,2})\s*-?\s*years?\b/i
  },
  {
    type: "typed_numeric",
    regex: /\b(workmanship|labor|material|manufacturer|shingle|leak|watertight|wind)\s+(warranty|guarantee)\s*:?\s*(\d{1,2})\s*-?\s*years?\b/i
  },
  {
    type: "typed_numeric",
    regex: /\b(\d{1,2})\s*-?\s*years?\s+(workmanship|labor|material|manufacturer|shingle|leak|watertight|wind)\s+(warranty|guarantee)\b/i
  },
  {
    type: "typed_numeric",
    regex: /\b(\d{1,2})\s*-?\s*years?\s+(workmanship|labor|material|manufacturer|shingle|leak|watertight|wind)\b/i
  },
  {
    type: "generic_numeric",
    regex: /\b(\d{1,2})\s*-?\s*years?\s+(warranty|guarantee)\b/i
  }
];  
  let best = null;
  for (const pattern of patterns) {
    const match = normalizedLine.match(pattern.regex);
    if (!match) continue;
    let years = "";
    let label = "";
    let typeLabel = "";
    const type = pattern.type;
    if (type === "typed_numeric") {
      let numericYears = null;
      let typedValue = "";
      if (/^\d/.test(match[1] || "")) {
        numericYears = Number(match[1]);
        typedValue = (match[2] || "").toLowerCase();
      } else {
        typedValue = (match[1] || "").toLowerCase();
        numericYears = Number(match[3] || match[2]);
      }
      if (!numericYears || numericYears < 1 || numericYears > 75) continue;
      years = numericYears;
      typeLabel = typedValue;
      label = `${years}-year ${typeLabel} warranty`;
    } else if (type === "generic_numeric") {
      const numericYears = Number(match[1]);
      if (!numericYears || numericYears < 1 || numericYears > 75) continue;
      years = numericYears;
      label = `${years}-year warranty`;
    } else if (type === "limited_lifetime") {
      const typedValue = (match[1] || "").toLowerCase();
      years = 50;
      label = typedValue ? `Limited lifetime ${typedValue} warranty` : "Limited lifetime warranty";
    } else if (type === "lifetime") {
      years = 50;
      if (/\bmanufacturer\s+lifetime\s+(warranty|guarantee)\b/i.test(normalizedLine)) {
        label = "Manufacturer lifetime warranty";
      } else {
        const typedValue = (match[1] || "").toLowerCase();
        if (typedValue && typedValue !== "warranty" && typedValue !== "guarantee") {
          label = `Lifetime ${typedValue} warranty`;
        } else {
          label = "Lifetime warranty";
        }
      }
    }
    label = label
      .replace(/\bmaterials\b/gi, "material")
      .replace(/\bshingles\b/gi, "shingle")
      .replace(/\s+/g, " ")
      .trim();
    label = label.charAt(0).toUpperCase() + label.slice(1);
    const score = scoreWarrantyCandidate(normalizedLine, label, years, type);
    const candidate = {
      label,
      years,
      score,
      debug: {
        inputLine: source,
        normalizedLine,
        matchText: match[0],
        patternType: type,
        regex: pattern.regex.toString()
      }
    };
    if (!best || candidate.score > best.score) {
      best = candidate;
    }
  }
  return best;
}
function detectWarranty(text) {
  const normalized = normalizeWarrantyText(text);
  if (!normalized) {
    return { label: "Not detected", years: "" };
  }
  const lines = normalized
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean);
  const candidates = [];
  for (let i = 0; i < lines.length; i++) {
  const currentLine = lines[i];
  const nextLine = lines[i + 1] || "";
  const single = extractWarrantyCandidate(currentLine);
  if (single) candidates.push(single);
  const currentLower = currentLine.toLowerCase();
  const nextLower = nextLine.toLowerCase();
  const currentLooksIncomplete =
    /\bwarranty\s*:?\s*$|\bguarantee\s*:?\s*$|\bworkmanship\s*:?\s*$|\blabor\s*:?\s*$|\bmaterial\s*:?\s*$|\bmanufacturer\s*:?\s*$|\bshingle\s*:?\s*$|\bleak\s*:?\s*$|\bwatertight\s*:?\s*$|\bwind\s*:?\s*$|\b\d{1,2}\s*-?\s*year\s*$|\blifetime\s*$/.test(currentLower);
  const nextStartsFreshWarranty =
    /\b(workmanship|labor|material|manufacturer|shingle|leak|watertight|wind)\b.*\b(warranty|guarantee)\b|\bwarranty\b|\bguarantee\b/.test(nextLower);
  if (i < lines.length - 1 && currentLooksIncomplete && !nextStartsFreshWarranty) {
    const joined = `${currentLine} ${nextLine}`.trim();
    const combined = extractWarrantyCandidate(joined);
    if (combined) candidates.push(combined);
  }
}
  if (isWarrantyDebugEnabled()) {
    console.table(
      candidates.map(c => ({
        label: c.label,
        years: c.years,
        score: c.score,
        patternType: c.debug?.patternType || "",
        matchText: c.debug?.matchText || "",
        inputLine: c.debug?.inputLine || ""
      }))
    );
  }
  if (!candidates.length) {
    if (isWarrantyDebugEnabled()) {
    }
    return { label: "Not detected", years: "" };
  }
  candidates.sort((a, b) => {
    const aYears = Number(a.years || 0);
    const bYears = Number(b.years || 0);
    return b.score - a.score || bYears - aYears || b.label.length - a.label.length;
  });
  const winner = {
    label: candidates[0].label,
    years: candidates[0].years
  };
  if (isWarrantyDebugEnabled()) {
  }
  return winner;
}
function detectMaterial(text) {
  const source = String(text || "");
  const repairedSource = source
    .replace(/0/g, "o")
    .replace(/[1|]/g, "i")
    .replace(/5/g, "s")
    .replace(/8/g, "b")
    .replace(/\bmaterlal\b/gi, "material")
    .replace(/\bmateriai\b/gi, "material")
    .replace(/\barch1tectural\b/gi, "architectural")
    .replace(/\bsh1ngles\b/gi, "shingles");
  const normalized = repairedSource.toLowerCase();
  const matches = [];
  const materialLineRegex = /\bmaterial(?: proposed)?[:\s]+([^\n]+)/i;
  const materialLineMatch = repairedSource.match(materialLineRegex);
  const materialLine = materialLineMatch ? materialLineMatch[1].toLowerCase() : "";
  const metalIsPrimary = /\binstall\b[^.]*\bmetal\b|\bmetal\s+panel|\bstanding\s+seam\b|\bmetal\s+roof\s+install/i.test(normalized);
  const hasShingleSignals = /\bshingles?\b|\barchitectural\b|\b3[- ]tab\b|\basphalt\b|\bcertainteed\w*\b|\bgaf\b|\btimberline\b|\bowens\s*corning\b/i.test(normalized);
  MATERIAL_PATTERNS.forEach(item => {
    item.patterns.forEach(pattern => {
      if (pattern.test(normalized)) {
        let score = item.score;
        if (materialLine && pattern.test(materialLine)) {
          score += 80;
        }
        if (item.value === "metal" && hasShingleSignals && !metalIsPrimary) {
          score -= 80;
        }
        if (item.value === "metal" && !materialLine && !metalIsPrimary) {
          const metalContext = normalized.match(/(?:metal\s+roof|metal\s+roofing).{0,80}/);
          if (metalContext && /payment|cancellation|policy|order material|siding/i.test(metalContext[0])) {
            score -= 60;
          }
        }
        matches.push({
          value: item.value,
          label: item.label,
          score
        });
      }
    });
  });
  const hasArchMatch = matches.some(m => m.value === "architectural" || m.value === "asphalt");
  const hasMetalMatch = matches.some(m => m.value === "metal");
  if (hasArchMatch && hasMetalMatch && !metalIsPrimary) {
    const filtered = matches.filter(m => m.value !== "metal");
    if (filtered.length > 0) {
      matches.length = 0;
      filtered.forEach(m => matches.push(m));
    }
  }
  if (!matches.length) {
    const fuzzyMaterialLine = materialLine || normalized;
    if (
      /\barchitectural\b/.test(fuzzyMaterialLine) &&
      /\bshingles?\b/.test(fuzzyMaterialLine)
    ) {
      return { value: "architectural", label: "Architectural shingles" };
    }
    if (
      /\barch[a-z]*\b/.test(fuzzyMaterialLine) &&
      /\bshingles?\b/.test(fuzzyMaterialLine)
    ) {
      return { value: "architectural", label: "Architectural shingles" };
    }
    if (/\bthree[\s-]?tab\b|\b3[\s-]?tab\b/.test(fuzzyMaterialLine)) {
      return { value: "three_tab", label: "3-tab asphalt shingles" };
    }
    if (/\bmetal\b/.test(fuzzyMaterialLine)) {
      return { value: "metal", label: "Metal roofing" };
    }
    if (/\btile\b/.test(fuzzyMaterialLine)) {
      return { value: "tile", label: "Tile roofing" };
    }
    if (/\bslate\b/.test(fuzzyMaterialLine)) {
      return { value: "slate", label: "Slate roofing" };
    }
    return { value: "", label: "Unknown" };
  }
  matches.sort((a, b) => b.score - a.score);
  return {
    value: matches[0].value,
    label: matches[0].label
  };
}
function detectContractor(text) {
  const source = String(text || "");
  const lines = source
    .split("\n")
    .map(line => normalizeWhitespace(line))
    .filter(Boolean);
  function cleanCompanyName(value) {
    let name = normalizeWhitespace(value || "");
    name = name.replace(
      /\b(roof replacement|replacement estimate|estimate|proposal|proposal date|payment due date|invoice date|customer|property address|description|qty|quantity|unit price|unit cost|subtotal|grand total|final total|amount due|total due|total project cost|warranty|material|roof size|roof area|scope of work)\b.*$/i,
      ""
    );
    name = name
      .replace(/^\s*(contractor|company|roofing company|proposal by|prepared by)\s*[:\-]\s*/i, "")
      .replace(/[:\-|,\s]+$/g, "")
      .trim();
    return name;
  }
  function looksLikeCompanyName(value) {
    const name = String(value || "").trim();
    if (name.length < 4) return false;
    if (name.length > 100) return false;
    const normalizedForMatch = name
      .toLowerCase()
      .replace(/0/g, "o")
      .replace(/[1|]/g, "i")
      .replace(/5/g, "s")
      .replace(/8/g, "b");
    if (
      /(customer|property address|proposal date|invoice date|description|qty|quantity|unit price|unit cost|subtotal|grand total|final total|amount due|total due|roof size|roof area|scope of work|material|warranty)/i.test(normalizedForMatch)
    ) {
      return false;
    }
    if (/\$|,\d{3}|\.\d{2}\b/.test(name)) {
      return false;
    }
    if (/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(name)) {
      return false;
    }
    if (
      /\b(qty|quantity|unit price|unit cost|subtotal|labor|materials|flashing replacement|ventilation upgrade|tear off|underlayment|shingles|permit|sales tax)\b/i.test(normalizedForMatch)
    ) {
      return false;
    }
    if (
  /\b(roof replacement|replacement estimate|roof estimate|estimate|proposal)\b/i.test(normalizedForMatch) &&
  !/(roofing|exteriors|construction|contracting|restoration|builders|roof solutions|home improvement)/i.test(normalizedForMatch)
) {
  return false;
}
    const digitCount = (name.match(/\d/g) || []).length;
    if (digitCount >= 6) return false;
    const wordCount = name.split(/\s+/).filter(Boolean).length;
    if (wordCount > 8) return false;
    return /(roofing|roof|exteriors|construction|contracting|restoration|builders|roof solutions|home improvement)/i.test(normalizedForMatch);
  }
  const labeledPatterns = [
    /(?:contractor|company|roofing company|proposal by|prepared by)[:\s]+([A-Za-z0-9&.,' -]{4,100})/i
  ];
  for (const pattern of labeledPatterns) {
    const match = source.match(pattern);
    if (match && match[1]) {
      const cleaned = cleanCompanyName(match[1]);
      if (looksLikeCompanyName(cleaned)) return cleaned;
    }
  }
  for (const line of lines.slice(0, 10)) {
    const cleaned = cleanCompanyName(line);
    if (looksLikeCompanyName(cleaned)) return cleaned;
  }
   const fallbackMatch = source.match(
    /\b([A-Z][A-Za-z0-9&.' -]{2,70}?(?:Roofing|Roof|Exteriors|Construction|Contracting|Restoration|Builders))\b/
  );
  if (fallbackMatch && fallbackMatch[1]) {
    const cleaned = cleanCompanyName(fallbackMatch[1]);
    if (
      cleaned &&
      !/\$|,\d{3}|\.\d{2}\b/.test(cleaned) &&
      !/\b(qty|quantity|unit price|unit cost|subtotal|labor|materials|flashing replacement|ventilation upgrade|tear off|underlayment|shingles|permit|sales tax)\b/i.test(cleaned) &&
      looksLikeCompanyName(cleaned)
    ) {
      return cleaned;
    }
  }
  return "Not detected";
}
function normalizeSizeNumber(raw) {
  const cleaned = String(raw || "")
    .trim()
    .replace(/[Oo]/g, "0")
    .replace(/[Il|]/g, "1")
    .replace(/[Ss]/g, "5")
    .replace(/[Bb]/g, "8")
    .replace(/[Gg]/g, "9")
    .replace(/[Zz]/g, "2")
    .replace(/A/g, "4");
  if (/^\d{1,2}[,.\s]\d{3}$/.test(cleaned)) {
    return Number(cleaned.replace(/[,\.\s]/g, ""));
  }
  return Number(cleaned.replace(/[^\d]/g, ""));
}
function detectRoofSize(text) {
  const normalized = String(text || "").toLowerCase();
  const candidates = [];
  let match;
  const ocrNumberPattern = "[0-9OIlSBGZAoilsbgza]";
  const ocrSizePattern = `${ocrNumberPattern}{1,2}[,.\\s]${ocrNumberPattern}{3}|${ocrNumberPattern}{3,5}`;
  const explicitPatterns = [
    {
      regex: new RegExp(`\\broof size\\b[^0-9OIlSBGZAoilsbgza]{0,25}(${ocrSizePattern})(?:\\.[0-9OIlSBGZAoilsbgza]+)?\\s*(?:sq\\.?\\s*f[tf]|sqft|sq ft|square feet|square foot)?\\b`, "g"),
      source: "roof size label",
      score: 130
    },
    {
      regex: new RegExp(`\\broof area\\b[^0-9OIlSBGZAoilsbgza]{0,25}(${ocrSizePattern})(?:\\.[0-9OIlSBGZAoilsbgza]+)?\\s*(?:sq\\.?\\s*f[tf]|sqft|sq ft|square feet|square foot)?\\b`, "g"),
      source: "roof area label",
      score: 125
    },
    {
      regex: new RegExp(`\\btotal roof area\\b[^0-9OIlSBGZAoilsbgza]{0,25}(${ocrSizePattern})(?:\\.[0-9OIlSBGZAoilsbgza]+)?\\s*(?:sq\\.?\\s*f[tf]|sqft|sq ft|square feet|square foot)?\\b`, "g"),
      source: "total roof area",
      score: 128
    },
    {
      regex: /\broof size\b[^0-9OIlSBGZAoilsbgza]{0,25}([1-9][0-9]?(?:\.[0-9]+)?)\s*(?:roofing\s+)?(?:squares|square|sq)\b/g,
      source: "roof size squares label",
      score: 138,
      transform: "squares_to_sqft"
    },
    {
      regex: /\broof area\b[^0-9OIlSBGZAoilsbgza]{0,25}([1-9][0-9]?(?:\.[0-9]+)?)\s*(?:roofing\s+)?(?:squares|square|sq)\b/g,
      source: "roof area squares label",
      score: 136,
      transform: "squares_to_sqft"
    },
    {
      regex: /\btotal roof area\b[^0-9OIlSBGZAoilsbgza]{0,25}([1-9][0-9]?(?:\.[0-9]+)?)\s*(?:roofing\s+)?(?:squares|square|sq)\b/g,
      source: "total roof area squares label",
      score: 137,
      transform: "squares_to_sqft"
    }
  ];
    explicitPatterns.forEach(({ regex, source, score, transform }) => {
    while ((match = regex.exec(normalized)) !== null) {
        let value;
    if (transform === "squares_to_sqft") {
          value = Number(match[1]) * 100;
        } else {
          value = normalizeSizeNumber(match[1]);
        }
      if (value >= 600 && value <= 12000) {
          candidates.push({ value, source, score });
        }
      }
    });
  const sqFtRegex = new RegExp(`\\b(${ocrSizePattern})(?:\\.[0-9OIlSBGZAoilsbgza]+)?\\s*(?:sq\\.?\\s*f[tf]|sqft|sq ft|square feet|square foot)\\b`, "g");
  while ((match = sqFtRegex.exec(normalized)) !== null) {
    const value = normalizeSizeNumber(match[1]);
    if (value >= 600 && value <= 12000) {
      let score = 92;
      const context = normalized.slice(Math.max(0, match.index - 100), Math.min(normalized.length, match.index + 100));
      if (/roof size|roof area|total roof area|property info/.test(context)) score += 24;
      if (/house|living|garage|lot|price|cost|total dollars/.test(context)) score -= 18;
      candidates.push({ value, source: "square feet", score });
    }
  }
   const roofLine = normalized.match(new RegExp(`roof[^0-9OIlSBGZAoilsbgza]{0,24}(${ocrSizePattern})`));
  if (roofLine) {
    const value = normalizeSizeNumber(roofLine[1]);
    if (value >= 600 && value <= 12000) {
      candidates.push({
        value,
        source: "roof line fallback",
        score: 78
      });
    }
  }
  const squaresRegex = /\b([1-9][0-9]?(?:\.[0-9]+)?)\s*(?:roofing\s+)?(?:squares|square|sq)(?!\s*ft|\s*feet|\s*foot|\s*in|\s*inch|\s*inches)\b/g;
  while ((match = squaresRegex.exec(normalized)) !== null) {
    const raw = Number(match[1]);
    const value = raw * 100;
    if (value >= 600 && value <= 12000) {
      let score = 92;
      const context = normalized.slice(
        Math.max(0, match.index - 100),
        Math.min(normalized.length, match.index + 100)
      );
      if (/roof|roofing|shingles|replace|tear off|underlayment|flashing/.test(context)) score += 22;
      if (/roof size|roof area|total roof area/.test(context)) score += 18;
      if (/price|cost|total|dollars|amount due|grand total/.test(context)) score -= 18;
      if (/sq ft|square feet|square foot/.test(context)) score -= 25;
      candidates.push({ value, source: "roofing squares", score });
    }
  }
  const roofAreaLoose = normalized.match(new RegExp(`(roof|roof area|roof size)[^0-9OIlSBGZAoilsbgza]{0,30}(${ocrSizePattern})`));
  if (roofAreaLoose) {
    const value = normalizeSizeNumber(roofAreaLoose[2]);
    if (value >= 600 && value <= 12000) {
      candidates.push({
        value,
        source: "roof loose fallback",
        score: 82
      });
    }
  }
  if (!candidates.length) {
    return { value: "", source: "" };
  }
  candidates.sort((a, b) => b.score - a.score || a.value - b.value);
  return {
    value: Math.round(candidates[0].value),
    source: candidates[0].source
  };
}
function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b\w/g, ch => ch.toUpperCase());
}
function detectLocation(text) {
  const source = String(text || "");
  const compact = normalizeWhitespace(source);
  const statePattern =
    "(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)";
  const bannedCities = new Set([
    "Customer",
    "Homeowner",
    "Property",
    "Address",
    "Claim",
    "Date",
    "Roof",
    "Material",
    "Office",
    "Proposal",
    "Estimate",
    "Page",
    "Scope",
    "Project",
    "Location",
    "Description",
    "Qty",
    "Quantity",
    "Unit",
    "Price",
    "Subtotal",
    "Payment",
    "Account",
    "Routing",
    "Information",
    "Labor",
    "Materials",
    "Docusign",
    "Envelope",
    "Signature",
    "Authorization",
    "Company",
    "Representative",
    "Certificate",
    "Insurance",
    "Agreement",
    "Contract",
    "Invoice",
    "Receipt",
    "Authorized"
  ]);
  function cleanCity(value) {
    let city = String(value || "")
      .replace(/^[,\s]+|[,\s]+$/g, "")
      .replace(/\b(customer|homeowner|property|address|claim|date|roof|material|office|proposal|estimate|page|scope|project|location|description|qty|quantity|unit|price|subtotal|payment|account|routing|information)\b/gi, "")
      .replace(/[,\s]+/g, " ")
      .trim();
    city = city.replace(
      /^(?:\d+\s+)?(?:[A-Za-z0-9.'-]+\s+){0,6}(st|street|rd|road|ave|avenue|blvd|boulevard|dr|drive|ln|lane|ct|court|cir|circle|way|pkwy|parkway)\.?\s+/i,
      ""
    );
    return titleCase(city);
  }
  function isValidCity(city) {
    if (!city) return false;
    if (city.length < 2 || city.length > 40) return false;
    if (bannedCities.has(city)) return false;
    if (/\d/.test(city)) return false;
    const lowerCity = String(city || "").toLowerCase();
    if (
      /\b(description|qty|quantity|unit|price|subtotal|payment|account|routing|information|labor|materials|docusign|envelope|signature|authorization|company|representative|certificate|insurance|agreement|contract|invoice)\b/.test(lowerCity)
    ) {
      return false;
    }
    if (lowerCity.split(/\s+/).length > 3) return false;
    return true;
  }
  function buildResult(city, stateCode) {
    const cleanedCity = cleanCity(city);
    const cleanedState = String(stateCode || "").toUpperCase().trim();
    if (!isValidCity(cleanedCity)) return null;
    if (!cleanedState) return null;
    return {
      city: cleanedCity,
      stateCode: cleanedState
    };
  }
  const labeledPatterns = [
    new RegExp(`\\b(?:location|city|property address|address|job address|project address)\\s*:\\s*([A-Za-z][A-Za-z .'-]{1,40}?)\\s*,?\\s+${statePattern}\\b`, "i"),
    new RegExp(`\\b(?:location|city|property address|address|job address|project address)\\s*:\\s*.*?,\\s*([A-Za-z][A-Za-z .'-]{1,40}?)\\s*,?\\s+${statePattern}\\b`, "i"),
    new RegExp(`\\b(?:location|city|property address|address|job address|project address)\\s*:\\s*([A-Za-z][A-Za-z .'-]{1,40}?)\\s*,\\s*${statePattern}\\b`, "i")
  ];
  for (const pattern of labeledPatterns) {
    const match = compact.match(pattern);
    if (match) {
      const city = match[1];
      const stateCode = match[2];
      const result = buildResult(city, stateCode);
      if (result) return result;
    }
  }
  const cityStateZipRegex = new RegExp(
    `\\b([A-Za-z][A-Za-z .'-]{1,40}?)\\s*,?\\s+${statePattern}(?:\\s+\\d{5}(?:-\\d{4})?)?\\b`,
    "g"
  );
  const lines = source
    .split("\n")
    .map(line => normalizeWhitespace(line))
    .filter(Boolean);
  const lineCityStateRegex = new RegExp(
    `\\b([A-Za-z][A-Za-z .'-]{1,40}?)\\s*,?\\s+${statePattern}(?:\\s+\\d{5}(?:-\\d{4})?)?\\b`,
    "i"
  );
  for (const line of lines) {
    if (!/\b(address|property address|job address|project address|location|city)\b/i.test(line)) {
      continue;
    }
    const match = line.match(lineCityStateRegex);
    if (match) {
      const city = match[1];
      const stateCode = match[2];
      const result = buildResult(city, stateCode);
      if (result) return result;
    }
  }
  for (const line of lines) {
    const match = line.match(lineCityStateRegex);
    if (match) {
      const city = match[1];
      const stateCode = match[2];
      const result = buildResult(city, stateCode);
      if (result) return result;
    }
  }
  const matches = [...compact.matchAll(cityStateZipRegex)];
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const city = match[1];
    const stateCode = match[2];
    const result = buildResult(city, stateCode);
    if (result) return result;
  }
  return { city: "", stateCode: "" };
}
const SCOPE_DEFINITIONS = {
  tearOff: {
    label: "Tear-off",
    positive: [
      /\btear\s*off\b/g,
      /\bremove existing roof\b/g,
      /\bremove existing\b.*\bshingles\b/g,
      /\broof removal\b/g,
      /\bcomplete removal\b/g,
      /\bstrip existing roof\b/g,
      /\bremove\b.*\basphalt\b/g,
      /\bremove\b.*\broof\b/g
    ],
    negative: [
      /\bno tear[\s-]?off\b/g,
      /\bover lay\b/g,
      /\boverlay\b/g,
      /\blayover\b/g,
      /\broof over\b/g
    ]
  },
  flashing: {
    label: "Flashing",
    positive: [
      /\bflashing\b/g,
      /\bpipe flashing\b/g,
      /\bstep flashing\b/g,
      /\bcounter flashing\b/g,
      /\bwall flashing\b/g,
      /\bapron flashing\b/g
    ],
    negative: [
      /\bflashing not included\b/g,
      /\bexclude flashing\b/g,
      /\bexisting flashing reused\b/g,
      /\breuse existing flashing\b/g
    ]
  },
  dripEdge: {
    label: "Drip edge",
    positive: [
      /\bdrip edge\b/g,
      /\bdripedge\b/g,
      /\bedge metal\b/g,
      /\bmetal edge\b/g,
      /\bdrip metal\b/g,
      /\baluminum drip\b/g
    ],
    negative: [
      /\bdrip edge not included\b/g,
      /\bexclude drip edge\b/g,
      /\breuse existing drip edge\b/g
    ]
  },
  underlayment: {
    label: "Underlayment",
    positive: [
      /\bunderlayment\b/g,
      /\bsynthetic underlayment\b/g,
      /\bfelt\b/g,
      /\bfelt paper\b/g,
      /\broofing felt\b/g,
      /\bsynthetic felt\b/g,
      /\binstall\s+(?:synthetic\s+)?underlayment\b/g,
      /\bunderlayment\s*\(/g
    ],
    negative: [
      /\bunderlayment not included\b/g,
      /\bexclude underlayment\b/g
    ]
  },
  iceShield: {
    label: "Ice and water shield",
    positive: [
      /\bice and water\b/g,
      /\bice & water\b/g,
      /\bice water shield\b/g,
      /\bice shield\b/g,
      /\bleak barrier\b/g,
      /\bwater shield\b/g,
      /\bice\s+(?:and|&)\s+water\s+shield\b/g,
      /\binstall\s+ice\s+and\s+water\b/g,
      /\bself[- ]adhesive.*membrane\b/g
    ],
    negative: [
      /\bice and water not included\b/g,
      /\bexclude ice and water\b/g,
      /\bno ice and water\b/g
    ]
  },
  ventilation: {
    label: "Ventilation",
    positive: [
      /\bventilation\b/g,
      /\bvent\b/g,
      /\broof vent\b/g,
      /\bbox vent\b/g,
      /\bstatic vent\b/g,
      /\bturtle vent\b/g,
      /\bpower vent\b/g,
      /\bsoffit vent\b/g,
      /\battic\s+(?:space\s+)?ventilation\b/g,
      /\bair\s*flow\b/g
    ],
    negative: [
      /\bventilation not included\b/g,
      /\bexclude ventilation\b/g,
      /\bno ventilation\b/g
    ]
  },
  ridgeVent: {
    label: "Ridge vent",
    positive: [
      /\bridge vent\b/g,
      /\bridgevent\b/g,
      /\bcontinuous ridge vent\b/g,
      /\bridge venting\b/g,
      /\bcontinuous\s+ridge\s+vent\b/g,
      /\bridge ventilation\b/g,
      /\bridge\s+ventilation\s+system\b/g
    ],
    negative: [
      /\bridge vent not included\b/g,
      /\bexclude ridge vent\b/g
    ]
  },
  starterStrip: {
    label: "Starter strip",
    positive: [
      /\bstarter strip\b/g,
      /\bstarter course\b/g,
      /\bstarter shingle\b/g
    ],
    negative: [
      /\bstarter strip not included\b/g,
      /\bexclude starter strip\b/g
    ]
  },
  ridgeCap: {
    label: "Ridge cap",
    positive: [
      /\bridge cap\b/g,
      /\bridgecap\b/g,
      /\bhip and ridge\b/g,
      /\bhip\/ridge\b/g
    ],
    negative: [
      /\bridge cap not included\b/g,
      /\bexclude ridge cap\b/g
    ]
  },
  decking: {
    label: "Decking",
    positive: [
      /\bdecking\b/g,
      /\broof deck\b/g,
      /\bdeck replacement\b/g,
      /\breplace damaged decking\b/g,
      /\bwood decking\b/g,
      /\bplywood\b/g,
      /\bosb\b/g,
      /\bcdx\b/g
    ],
    negative: [
      /\bdecking not included\b/g,
      /\bexclude decking\b/g,
      /\bdecking extra\b/g,
      /\bdecking at additional cost\b/g,
      /\bdecking if needed\b/g
    ]
  },
  disposal: {
    label: "Disposal",
    positive: [
      /\bdisposal\b/g,
      /\bdebris removal\b/g,
      /\bdebris disposal\b/g,
      /\bhaul away\b/g,
      /\bhaul off\b/g,
      /\bdumpster\b/g,
      /\bcleanup\b/g,
      /\bclean up\b/g,
      /\bmagnetic sweep\b/g,
      /\bdispose\b/g
    ],
    negative: [
      /\bdisposal not included\b/g,
      /\bdisposal extra\b/g
    ]
  },
  permit: {
    label: "Permit",
    positive: [
      /\bpermit\b/g,
      /\bbuilding permit\b/g,
      /\bcounty permit\b/g,
      /\bcity permit\b/g,
      /\bpermit included\b/g,
      /\bpull permit\b/g,
      /\bbuy a permit\b/g
    ],
    negative: [
      /\bpermit not included\b/g,
      /\bpermit extra\b/g,
      /\bpermit by owner\b/g,
      /\bhomeowner.*permit\b/g
    ]
  }
};
function normalizeScopeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\broo\s*f?\s*ng\b/g, "roofing")
    .replace(/\bashi?ng\b/g, "ashing")
    .replace(/\b[ffi]+ashing\b/g, "flashing")
    .replace(/\bventila\s*tion\b/g, "ventilation")
    .replace(/\bunder\s*lay\s*ment\b/g, "underlayment")
    .replace(/\barchitec\s*tural\b/g, "architectural")
    .replace(/\bsyn\s*thetic\b/g, "synthetic")
    .replace(/[–—]/g, "-")
    .replace(/\bridge[\s-]*vent(?:ing)?\b/g, "ridge vent")
    .replace(/\bcontinuous\s+ridge\s+vent\b/g, "ridge vent")
    .replace(/\bdrip[\s-]*(?:edge|metal)\b/g, "drip edge")
    .replace(/\baluminum\s+drip\b/g, "drip edge")
    .replace(/\bice\s*(?:&|and)\s*water\b/g, "ice and water")
    .replace(/\bstarter[\s-]*strip\b/g, "starter strip")
    .replace(/\bridge[\s-]*cap\b/g, "ridge cap")
    .replace(/\bdeck\s*ing\b/g, "decking")
    .replace(/[|]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}
function hasNearbyNegation(text, index) {
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + 40);
  const windowText = text.slice(start, end);
  return /\b(not included|excluded|exclude|by owner|owner to provide|reuse existing|at additional cost|extra charge|optional|allowance only)\b/.test(windowText);
}
function evaluateScopeSignal(text, definition) {
  const lower = normalizeScopeText(text);
  for (const negativePattern of definition.negative) {
    const negativeMatch = lower.match(negativePattern);
    if (negativeMatch) {
      return {
        label: definition.label,
        status: "excluded",
        evidence: normalizeEvidence(negativeMatch[0])
      };
    }
  }
  for (const positivePattern of definition.positive) {
    const positiveMatch = lower.match(positivePattern);
    if (positiveMatch && positiveMatch[0]) {
      const plainRegex = new RegExp(
        positivePattern.source,
        positivePattern.flags.replace(/g/g, "")
      );
      const idx = lower.search(plainRegex);
      if (idx >= 0 && hasNearbyNegation(lower, idx)) {
        return {
          label: definition.label,
          status: "excluded",
          evidence: normalizeEvidence(positiveMatch[0])
        };
      }
      return {
        label: definition.label,
        status: "included",
        evidence: normalizeEvidence(positiveMatch[0])
      };
    }
  }
  return {
    label: definition.label,
    status: "unclear",
    evidence: ""
  };
}
function detectScopeSignals(text) {
  const source = String(text || "");
  const normalized = normalizeScopeText(source);
  const results = {};
  Object.entries(SCOPE_DEFINITIONS).forEach(([key, definition]) => {
    results[key] = evaluateScopeSignal(normalized, definition);
  });
  results.premiumBrand = {
    label: "Premium brand",
    status: /\bgaf\b|\bowens corning\b|\bcertainteed\b|\bmalarkey\b|\biko\b|\btamko\b|\bdecra\b|\bmcelroy\b/i.test(normalized)
      ? "included"
      : "unclear",
    evidence: (() => {
      const match = normalized.match(/\bgaf\b|\bowens corning\b|\bcertainteed\b|\bmalarkey\b|\biko\b|\btamko\b|\bdecra\b|\bmcelroy\b/i);
      return match ? normalizeEvidence(match[0]) : "";
    })()
  };
  return results;
}
function buildMissingSignalList(signals) {
  const items = [];
  if (!signals || typeof signals !== "object") return items;
  const importantKeys = ["flashing", "dripEdge", "underlayment", "ventilation"];
  importantKeys.forEach(key => {
    const item = signals[key];
    if (!item || item.status === "included") return;
    if (key === "flashing") items.push("Flashing not mentioned");
    if (key === "dripEdge") items.push("Drip edge not specified");
    if (key === "underlayment") items.push("Underlayment not mentioned");
    if (key === "ventilation") items.push("Ventilation not specified");
  });
  return items;
}
function buildIncludedSignalList(signals) {
  const items = [];
  if (!signals || typeof signals !== "object") return items;
  Object.values(signals).forEach(item => {
    if (!item || item.status !== "included") return;
    items.push(item.label);
  });
  return items;
}
function detectTotalLinePrice(text) {
  const lines = String(text || "")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);
  const totalPatterns = [
    /total estimate/i,
    /estimate total/i,
    /total estimated cost/i,
    /totol estimated cost/i,
    /grand total/i,
    /proposal total/i,
    /contract total/i,
    /final total/i,
    /amount due/i,
    /total due/i,
    /total cost/i,
    /estimated cost/i,
    /project total/i
  ];
  const badContextPatterns =
    /invoice date|due date|payment due date|proposal date|issue date|issued|expires|valid through|valid until|roof size|roof area|sq\.?\s*f[tf]|square feet|claim number|policy number|invoice number|estimate number|proposal number/i;
  const moneyRegex =
    /\$?\s?[0-9OIlSBGZAoilsbgza]{1,3}(?:[.,][0-9OIlSBGZAoilsbgza]{3})+(?:[.,][0-9OIlSBGZAoilsbgza]{2})?|\$?\s?[0-9OIlSBGZAoilsbgza]{4,6}(?:[.,][0-9OIlSBGZAoilsbgza]{2})?/g;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!totalPatterns.some(p => p.test(line))) continue;
    const candidateLines = [line, lines[i + 1] || ""];
    for (const candidateLine of candidateLines) {
      const lineLower = candidateLine.toLowerCase();
      if (badContextPatterns.test(lineLower)) continue;
      if (/\b(address|property address|mailing address|zip|zipcode|zip code)\b/.test(lineLower)) continue;
      const matches = [...candidateLine.matchAll(moneyRegex)];
      if (!matches.length) continue;
      const totalPhraseIndex = candidateLine.search(
        /total estimate|estimate total|total estimated cost|totol estimated cost|grand total|proposal total|contract total|final total|amount due|total due|total cost|estimated cost|project total/i
      );
      let bestMatch = null;
      let bestScore = -Infinity;
      for (const match of matches) {
        const raw = match[0];
        const value = parseMoneyLikeValue(raw);
        if (!isFinite(value) || value < 1000 || value > 200000) continue;
        if (Number.isInteger(value) && value >= 2024 && value <= 2035) continue;
        const matchIndex = match.index ?? 0;
        let candidateScore = 0;
        if (/\$|,\d{3}|\.\d{2}\b/.test(raw)) candidateScore += 20;
        if (totalPhraseIndex >= 0 && matchIndex > totalPhraseIndex) candidateScore += 30;
        if (/grand total|contract total|proposal total|final total|amount due|total due/i.test(candidateLine)) candidateScore += 40;
        if (/subtotal/i.test(candidateLine)) candidateScore -= 20;
        if (candidateScore > bestScore) {
          bestScore = candidateScore;
          bestMatch = value;
        }
      }
      if (bestMatch != null) {
        return bestMatch;
      }
    }
  }
  return null;
}
function detectPremiumSignals(text, signals, roofSize, material) {
  const lower = String(text || "").toLowerCase();
  const items = [];
  function add(label, condition) {
    if (condition && !items.includes(label)) {
      items.push(label);
    }
  }
  add(
    "Synthetic underlayment mentioned",
    /\bsynthetic underlayment\b|\bsynthetic felt\b/.test(lower)
  );
  add(
    "Ice and water shield mentioned",
    /\bice and water\b|\bice & water\b|\bice water shield\b|\bleak barrier\b|\bwater shield\b/.test(lower)
  );
  add(
    "Ridge vent system mentioned",
    /\bridge vent\b|\bridgevent\b/.test(lower)
  );
  add(
    "Starter strip mentioned",
    /\bstarter strip\b|\bstarter course\b|\bstarter shingle\b/.test(lower)
  );
  add(
    "Ridge cap mentioned",
    /\bridge cap\b|\bridgecap\b|\bhip and ridge\b|\bhip\/ridge\b/.test(lower)
  );
  add(
    "Flashing upgrades mentioned",
    /\bflashing upgrade\b|\bflashing upgrades\b|\bnew flashing\b|\breplace flashing\b|\bflashing replacement\b/.test(lower)
  );
  add(
    "Premium shingle wording detected",
    /\bpremium shingle\b|\bpremium shingles\b|\bdesigner shingle\b|\barchitectural shingle\b|\bdimensional shingle\b/.test(lower)
  );
  add(
    "Steep pitch mentioned",
    /\bsteep\b|\bsteep pitch\b|\bhigh pitch\b|\b12\/12\b|\b10\/12\b|\b8\/12\b/.test(lower)
  );
  add(
    "Multiple layers detected",
    /\bmultiple layers\b|\b2 layers\b|\btwo layers\b|\bsecond layer\b/.test(lower)
  );
  add(
    "Complex roof features detected",
    /\bvalley\b|\bmultiple valleys\b|\bdormer\b|\bskylight\b|\bchimney\b|\bcomplex roof\b/.test(lower)
  );
  add(
    "Decking work mentioned",
    Boolean(signals && signals.decking && signals.decking.status === "included")
  );
  add(
    "Premium brand mentioned",
    Boolean(signals && signals.premiumBrand && signals.premiumBrand.status === "included")
  );
  add(
    "Premium roofing material",
    material === "metal" || material === "tile" || material === "slate"
  );
  add(
    "Large roof size",
    Number(roofSize) >= 3500
  );
  return items;
}
function calculateParserConfidence(parsed) {
  let score = 0;
  if (parsed.price) score += 28;
  if (parsed.priceCandidates && parsed.priceCandidates[0] && parsed.priceCandidates[0].score >= 55) score += 10;
  if (parsed.material) score += 14;
  if (parsed.warrantyYears) score += 8;
  if (parsed.roofSize) score += 12;
  if (parsed.city && parsed.stateCode) score += 10;
  const signals = parsed.signals || {};
  const includedCount = Object.values(signals).filter(item => item && item.status === "included").length;
  if (includedCount >= 3) score += 10;
  if (includedCount >= 5) score += 8;
  if (parsed.extractedTextLength >= 300) score += 5;
  if (parsed.extractionMethod === "pdf_text") score += 4;
  if (parsed.extractionMethod === "pdf_ocr_fallback" || parsed.extractionMethod === "image_ocr") score += 2;
  return Math.min(100, score);
}
function getConfidenceLabelFromScore(score) {
  if (score >= 75) return "High";
  if (score >= 45) return "Medium";
  return "Low";
}
function validatePriceSanity(finalPrice, roofSizeSqFt) {
  const price = Number(finalPrice);
  const roofSize = Number(roofSizeSqFt);
  if (!Number.isFinite(price) || !Number.isFinite(roofSize) || roofSize <= 0) {
    return {
      status: "unknown",
      pricePerSqFt: null,
      confidencePenalty: 0,
      reason: ""
    };
  }
  const pricePerSqFt = price / roofSize;
  if (pricePerSqFt < 1.25) {
    return {
      status: "implausible_low",
      pricePerSqFt,
      confidencePenalty: 45,
      reason: "Selected price appears far too low relative to detected roof size"
    };
  }
  if (pricePerSqFt < 2.0) {
    return {
      status: "borderline_low",
      pricePerSqFt,
      confidencePenalty: 20,
      reason: "Selected price appears unusually low relative to detected roof size"
    };
  }
  if (pricePerSqFt > 25.0) {
    return {
      status: "implausible_high",
      pricePerSqFt,
      confidencePenalty: 45,
      reason: "Selected price appears far too high relative to detected roof size"
    };
  }
  if (pricePerSqFt > 20.0) {
    return {
      status: "borderline_high",
      pricePerSqFt,
      confidencePenalty: 20,
      reason: "Selected price appears unusually high relative to detected roof size"
    };
  }
  return {
    status: "plausible",
    pricePerSqFt,
    confidencePenalty: 0,
    reason: ""
  };
}
function isImplausiblePriceSanityStatus(status) {
  return status === "implausible_low" || status === "implausible_high";
}
function findSanityFallbackCandidate(priceCandidates, roofSizeSqFt, currentBestPrice) {
  const candidates = Array.isArray(priceCandidates) ? priceCandidates : [];
  const currentValue = Number(currentBestPrice);
  const roofSize = Number(roofSizeSqFt);
  if (!Number.isFinite(roofSize) || roofSize <= 0) {
    return null;
  }
  for (const candidate of candidates) {
    if (!candidate) continue;
    const candidateValue = Number(candidate.value);
    if (!Number.isFinite(candidateValue)) continue;
    if (candidateValue === currentValue) continue;
    if (candidate.score < 80) continue;
    if (candidateValue < 3000 || candidateValue > 250000) continue;
    const sanity = validatePriceSanity(candidateValue, roofSize);
    if (sanity.status === "plausible") {
      return {
        candidate,
        sanity
      };
    }
    if (sanity.status === "borderline_low" || sanity.status === "borderline_high") {
      return {
        candidate,
        sanity
      };
    }
  }
  return null;
}
function detectQuoteStructure(text) {
  const source = String(text || "");
  const lower = source.toLowerCase();
  const hasTableSignals =
    /description\s+qty\s+unit price\s+(subtotal|amount)/i.test(source) ||
    (/subtotal/.test(lower) && /qty|unit price|amount/.test(lower)) ||
    (/description/.test(lower) && /amount/.test(lower));
  const hasInsuranceSignals =
    /replacement cost value|actual cash value|acv|rcv|depreciation|deductible|claim number/i.test(source);
  const hasProposalSignals =
    /proposal|investment for this project|the investment for this project|thank you for the opportunity|scope of work/i.test(source);
  if (hasInsuranceSignals) return "insurance_quote";
  if (hasTableSignals) return "table_quote";
  if (hasProposalSignals) return "proposal_quote";
  return "unknown";
}
function reconstructTotalFromLineItems(text) {
  const lines = String(text || "")
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);
  const lineItemValues = [];
  const moneyRegex =
    /\$?\s?(?:[0-9OIlSBGZAoilsbgza]{1,3}(?:[.,][0-9OIlSBGZAoilsbgza]{3})+(?:[.,][0-9OIlSBGZAoilsbgza]{2})?|[0-9OIlSBGZAoilsbgza]{3,6}(?:[.,][0-9OIlSBGZAoilsbgza]{2})?)/g;
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (/total|grand total|project total|contract total|final total|amount due|total due/.test(lower)) continue;
    if (/roof size|roof area|sq\.?\s*f[tf]|square feet/.test(lower)) continue;
    if (!/qty|quantity|unit price|subtotal|labor|materials|tear off|underlayment|shingles|flashing|ventilation/i.test(lower)) continue;
    const matches = [...line.matchAll(moneyRegex)];
    if (!matches.length) continue;
    const lastMatch = matches[matches.length - 1];
    const value = parseMoneyLikeValue(lastMatch[0], line);
    if (!isFinite(value)) continue;
    if (value < 300 || value > 50000) continue;
    lineItemValues.push(value);
  }
  if (lineItemValues.length < 2) return null;
  const total = lineItemValues.reduce((sum, v) => sum + v, 0);
  if (total < 1500 || total > 250000) return null;
  return total;
}
function normalizeOcrMoneySpacing(text) {
  return String(text || "")
    .replace(/(\$\s*\d+)\.\s+(\d{3}\b)/g, "$1.$2")
    .replace(/(\$\s*\d+),\s+(\d{3}\b)/g, "$1,$2")
    .replace(/(\$\s*\d+)\s+(\d{3}\b)/g, "$1$2")
    .replace(/\b(\d+)\.\s+(\d{3}\b)/g, "$1.$2")
    .replace(/\b(\d+),\s+(\d{3}\b)/g, "$1,$2")
    .replace(/\b(\d+)\s+(\d{3}\b)/g, "$1$2");
}
function detectExplicitTotalFromFullText(text) {
  const source = String(text || "");
  const patterns = [
    /total estimate[^0-9$,.]{0,40}(\$?\s*(?:[,\.]\d{3,4}|[0-9OIlSBGZAoilsbgza]{1,3}(?:[.,][0-9OIlSBGZAoilsbgza]{3})+(?:[.,][0-9OIlSBGZAoilsbgza]{2})?|[0-9OIlSBGZAoilsbgza]{4,6}(?:[.,][0-9OIlSBGZAoilsbgza]{2})?))/i,
    /estimate total[^0-9$,.]{0,40}(\$?\s*(?:[,\.]\d{3,4}|[0-9OIlSBGZAoilsbgza]{1,3}(?:[.,][0-9OIlSBGZAoilsbgza]{3})+(?:[.,][0-9OIlSBGZAoilsbgza]{2})?|[0-9OIlSBGZAoilsbgza]{4,6}(?:[.,][0-9OIlSBGZAoilsbgza]{2})?))/i,
    /grand total[^0-9$]{0,40}(\$?\s?[0-9OIlSBGZAoilsbgza]{1,3}(?:[.,][0-9OIlSBGZAoilsbgza]{3})+(?:[.,][0-9OIlSBGZAoilsbgza]{2})?|\$?\s?[0-9OIlSBGZAoilsbgza]{4,6}(?:[.,][0-9OIlSBGZAoilsbgza]{2})?)/i,
    /final total[^0-9$]{0,40}(\$?\s?[0-9OIlSBGZAoilsbgza]{1,3}(?:[.,][0-9OIlSBGZAoilsbgza]{3})+(?:[.,][0-9OIlSBGZAoilsbgza]{2})?|\$?\s?[0-9OIlSBGZAoilsbgza]{4,6}(?:[.,][0-9OIlSBGZAoilsbgza]{2})?)/i,
    /proposal total[^0-9$]{0,40}(\$?\s?[0-9OIlSBGZAoilsbgza]{1,3}(?:[.,][0-9OIlSBGZAoilsbgza]{3})+(?:[.,][0-9OIlSBGZAoilsbgza]{2})?|\$?\s?[0-9OIlSBGZAoilsbgza]{4,6}(?:[.,][0-9OIlSBGZAoilsbgza]{2})?)/i,
    /contract total[^0-9$]{0,40}(\$?\s?[0-9OIlSBGZAoilsbgza]{1,3}(?:[.,][0-9OIlSBGZAoilsbgza]{3})+(?:[.,][0-9OIlSBGZAoilsbgza]{2})?|\$?\s?[0-9OIlSBGZAoilsbgza]{4,6}(?:[.,][0-9OIlSBGZAoilsbgza]{2})?)/i,
    /amount due[^0-9$]{0,40}(\$?\s?[0-9OIlSBGZAoilsbgza]{1,3}(?:[.,][0-9OIlSBGZAoilsbgza]{3})+(?:[.,][0-9OIlSBGZAoilsbgza]{2})?|\$?\s?[0-9OIlSBGZAoilsbgza]{4,6}(?:[.,][0-9OIlSBGZAoilsbgza]{2})?)/i,
    /total due[^0-9$]{0,40}(\$?\s?[0-9OIlSBGZAoilsbgza]{1,3}(?:[.,][0-9OIlSBGZAoilsbgza]{3})+(?:[.,][0-9OIlSBGZAoilsbgza]{2})?|\$?\s?[0-9OIlSBGZAoilsbgza]{4,6}(?:[.,][0-9OIlSBGZAoilsbgza]{2})?)/i
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (!match || !match[1]) continue;
    const wholeMatch = String(match[0] || "").toLowerCase();
const value = parseMoneyLikeValue(match[1], wholeMatch);
    if (!isFinite(value)) continue;
    if (value < 1000 || value > 250000) continue;
    if (Number.isInteger(value) && value >= 2024 && value <= 2035) continue;
    if (/deductible|deposit|rebate|discount|coupon|remaining balance|balance due|acv|depreciation/.test(wholeMatch)) continue;
  return value;
  }
  return null;
}
function normalizeWhitespacePreserveLines(text) {
  return String(text || "")
    .split("\n")
    .map(line => line.replace(/[ \t]+/g, " ").trim())
    .filter((line, index, arr) => line !== "" || (index > 0 && arr[index - 1] !== ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
function parseExtractedText(extractedText, options = {}) {
  const rawText = String(extractedText || "");
  let normalizedText = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[|]+/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  normalizedText = normalizeWhitespacePreserveLines(normalizedText);
  normalizedText = normalizeOcrMoneySpacing(normalizedText);
  const quoteStructure = detectQuoteStructure(normalizedText);
  const totalLinePrice = detectTotalLinePrice(normalizedText);
  const explicitTextTotal = detectExplicitTotalFromFullText(normalizedText);
  let priceCandidates = extractPriceCandidates(normalizedText);
  priceCandidates = priceCandidates.sort((a, b) => {
  const sourceRank = {
    explicit_total_full_text: 6,
    explicit_total_line: 5,
    final_total_phrase: 4,
    broken_leading_money_repair: 3,
    ocr_repaired_candidate: 1,
    generic_money_candidate: 2,
    balance_or_acv: -1,
    subtotal_line: -2,
    deposit_or_deductible: -3,
    roof_size_like: -4,
    zip_or_address_candidate: -5,
    date_like_year_candidate: -6
  };
  const aRank = sourceRank[a.sourceType] ?? 0;
  const bRank = sourceRank[b.sourceType] ?? 0;
  const scoreDiff = b.score - a.score;
  if (Math.abs(scoreDiff) > 30) return scoreDiff;
  return bRank - aRank || scoreDiff || b.value - a.value;
});
  const reconstructedTotal = reconstructTotalFromLineItems(normalizedText);
  if (
    Number.isFinite(explicitTextTotal) &&
    !priceCandidates.some(candidate => Number(candidate.value) === Number(explicitTextTotal))
  ) {
    priceCandidates.push({
      value: explicitTextTotal,
      display: String(explicitTextTotal),
      score: 1200,
      sourceType: "explicit_total_full_text",
      context: "Explicit total phrase found in full normalized text"
    });
  }
  if (
    reconstructedTotal &&
    !priceCandidates.some(c => Number(c.value) === reconstructedTotal)
  ) {
    priceCandidates.push({
      value: reconstructedTotal,
      display: String(reconstructedTotal),
      score: 95,
      sourceType: "line_item_reconstruction",
      context: "Reconstructed from line items"
    });
  }
  if (
    Number.isFinite(totalLinePrice) &&
    !priceCandidates.some(candidate => Number(candidate.value) === Number(totalLinePrice))
  ) {
    priceCandidates.push({
      value: totalLinePrice,
      display: String(totalLinePrice),
      score: 999,
      sourceType: "explicit_total_line",
      context: "Explicit total line match"
    });
  }
  const materialResult = detectMaterial(normalizedText);
  const warrantyResult = detectWarranty(normalizedText);
  const roofSizeResult = detectRoofSize(normalizedText);
  const locationResult = detectLocation(normalizedText);
  const signals = detectScopeSignals(normalizedText);
  const includedSignals = buildIncludedSignalList(signals);
  const missingSignals = buildMissingSignalList(signals);
  const premiumSignals = detectPremiumSignals(
    normalizedText,
    signals,
    roofSizeResult?.value,
    materialResult?.value
  );
  const bestPrice =
    Number.isFinite(totalLinePrice)
      ? totalLinePrice
      : Number.isFinite(explicitTextTotal)
        ? explicitTextTotal
        : priceCandidates.length
          ? priceCandidates[0].value
          : "";
  let finalBestPrice = bestPrice;
  function isLikelyYear(value) {
    const n = Number(value);
    return Number.isInteger(n) && n >= 2024 && n <= 2035;
  }
  function findSaferFallback(candidates, roofSizeValue) {
    return candidates.find(candidate => {
      const candidateValue = Number(candidate.value);
      if (!Number.isFinite(candidateValue)) return false;
      if (isLikelyYear(candidateValue)) return false;
      if (roofSizeValue && candidateValue === Number(roofSizeValue)) return false;
      if (candidate.score < 80) return false;
      if (candidateValue < 3000) return false;
      return true;
    });
  }
  const roofSizeNumeric = Number(roofSizeResult?.value || 0);
  if (
    Number(finalBestPrice) &&
    roofSizeNumeric &&
    Number(finalBestPrice) === roofSizeNumeric
  ) {
    const nextCandidate = findSaferFallback(priceCandidates, roofSizeNumeric);
    if (nextCandidate) {
      finalBestPrice = nextCandidate.value;
    } else {
      finalBestPrice = "";
    }
  }
  if (isLikelyYear(finalBestPrice)) {
    const nextCandidate = findSaferFallback(priceCandidates, roofSizeNumeric);
    if (nextCandidate) {
      finalBestPrice = nextCandidate.value;
    } else {
      finalBestPrice = "";
    }
  }
  let priceSanity = validatePriceSanity(finalBestPrice, roofSizeNumeric);
  let priceSanityFallbackUsed = false;
  let priceSanityOriginalBestPrice = finalBestPrice ? Number(finalBestPrice) : null;
  let priceSanityOriginalStatus = priceSanity.status || "unknown";
  let priceSanityFallbackCandidate = null;
  if (isImplausiblePriceSanityStatus(priceSanity.status)) {
    const sanityFallback = findSanityFallbackCandidate(
      priceCandidates,
      roofSizeNumeric,
      finalBestPrice
    );
    if (sanityFallback && sanityFallback.candidate) {
      finalBestPrice = sanityFallback.candidate.value;
      priceSanity = sanityFallback.sanity;
      priceSanityFallbackUsed = true;
      priceSanityFallbackCandidate = sanityFallback.candidate;
    }
  }
  const parsed = {
    price: finalBestPrice ? String(finalBestPrice) : "",
    finalBestPrice: finalBestPrice ? Number(finalBestPrice) : null,
    totalLinePrice: Number.isFinite(totalLinePrice) ? totalLinePrice : null,
    priceCandidates,
    quoteStructure,
    material: materialResult?.value || "",
    materialLabel: materialResult?.label || "Unknown",
    warranty: warrantyResult?.label || "Not detected",
    warrantyYears:
      warrantyResult?.years !== undefined &&
      warrantyResult?.years !== null &&
      warrantyResult?.years !== ""
        ? String(warrantyResult.years)
        : "",
    contractor: detectContractor(normalizedText),
    city: locationResult?.city || "",
    stateCode: locationResult?.stateCode || "",
    roofSize:
      roofSizeResult?.value !== undefined &&
      roofSizeResult?.value !== null &&
      roofSizeResult?.value !== ""
        ? String(roofSizeResult.value)
        : "",
    roofSizeSource: roofSizeResult?.source || "",
    pricePerSqFt:
      Number.isFinite(priceSanity.pricePerSqFt)
        ? Number(priceSanity.pricePerSqFt.toFixed(2))
        : null,
    priceSanityStatus: priceSanity.status || "unknown",
    priceSanityReason: priceSanity.reason || "",
    priceSanityFallbackUsed,
    priceSanityOriginalBestPrice,
    priceSanityOriginalStatus,
    priceSanityFallbackCandidate: priceSanityFallbackCandidate
      ? {
          value: Number(priceSanityFallbackCandidate.value),
          score: Number(priceSanityFallbackCandidate.score),
          sourceType: priceSanityFallbackCandidate.sourceType || "",
          display: priceSanityFallbackCandidate.display || ""
        }
      : null,
    warnings: [
      ...(priceSanityFallbackUsed
        ? ["Original selected price was replaced because it appeared implausible relative to detected roof size"]
        : []),
      ...(priceSanity.reason ? [priceSanity.reason] : [])
    ],
    confidenceScore: 0,
    confidenceLabel: "Low",
    signals,
    includedSignals,
    missingSignals,
    premiumSignals,
    rawText: normalizedText,
    extractionMethod: options.extractionMethod || "ocr_cache",
    extractedTextLength: normalizedText.length
  };
  parsed.confidenceScore = calculateParserConfidence(parsed);
  parsed.confidenceScore = Math.max(
    0,
    parsed.confidenceScore - (priceSanity.confidencePenalty || 0)
  );
  parsed.confidenceLabel = getConfidenceLabelFromScore(parsed.confidenceScore);
  return parsed;
}
window.__TP_PARSER_TESTS__ = function () {
  const cases = [
    {
      name: "Grand total basic",
      text: `
        Roof Replacement Estimate
        Roof size: 2,050 sq ft
        Material: Architectural shingles
        Grand Total: $11,300
      `,
      expect: { price: 11300, roofSize: 2050 }
    },
    {
      name: "Squares labeled",
      text: `
        Proposal
        Roof size: 24 squares
        Material: Architectural shingles
        Contract Total: $14,800
      `,
      expect: { price: 14800, roofSize: 2400 }
    },
    {
      name: "Avoid zip as price",
      text: `
        Property Address: 123 Main Street, Dallas TX 75204
        Roof size: 2,400 sq ft
        Proposal Total: $15,400
      `,
      expect: { price: 15400, roofSize: 2400 }
    },
    {
      name: "Avoid deductible over total",
      text: `
        Replacement Cost Value: $12,800
        Deductible: $1,000
        Amount Due: $12,800
        Roof size: 2,000 sq ft
      `,
      expect: { price: 12800, roofSize: 2000 }
    }
  ];
  const results = cases.map(testCase => {
    const parsed = parseExtractedText(testCase.text, { extractionMethod: "test_fixture" });
    return {
      name: testCase.name,
      expectedPrice: testCase.expect.price,
      actualPrice: parsed.finalBestPrice,
      expectedRoofSize: testCase.expect.roofSize,
      actualRoofSize: Number(parsed.roofSize || 0),
      pass:
        Number(parsed.finalBestPrice) === Number(testCase.expect.price) &&
        Number(parsed.roofSize || 0) === Number(testCase.expect.roofSize)
    };
  });
  console.table(results);
  return results;
};
window.extractPriceCandidates = extractPriceCandidates;
window.parseExtractedText = parseExtractedText;
window.detectMaterial = detectMaterial;
window.detectRoofSize = detectRoofSize;
window.detectWarranty = detectWarranty;
window.detectLocation = detectLocation;
window.detectScopeSignals = detectScopeSignals;
function detectScopeItems(text) {
  const normalized = String(text || "").toLowerCase();
  const scopeCatalog = [
    { key: "tear_off", label: "Tear off existing shingles", patterns: [/tear.?off/, /remove existing roof/] },
    { key: "underlayment", label: "Underlayment", patterns: [/underlayment/, /felt paper/, /synthetic underlayment/] },
    { key: "drip_edge", label: "Drip edge", patterns: [/drip edge/] },
    { key: "flashing", label: "Flashing replacement", patterns: [/flashing/, /step flashing/, /counter flashing/] },
    { key: "ice_barrier", label: "Ice and water barrier", patterns: [/ice.?water/, /ice barrier/, /ice shield/] },
    { key: "ridge_vent", label: "Ridge ventilation", patterns: [/ridge vent/, /ridge ventilation/] },
    { key: "starter", label: "Starter shingles", patterns: [/starter shingle/, /starter strip/] },
    { key: "ridge_cap", label: "Ridge cap shingles", patterns: [/ridge cap/] },
    { key: "valley_metal", label: "Valley metal", patterns: [/valley metal/, /metal valley/] },
    { key: "deck_repair", label: "Deck repair allowance", patterns: [/deck repair/, /replace plywood/, /replace osb/] },
    { key: "disposal", label: "Debris disposal", patterns: [/dumpster/, /debris removal/, /haul away/] },
    { key: "permit", label: "Permit included", patterns: [/permit/] }
  ];
  const detected = [];
  for (const item of scopeCatalog) {
    const found = item.patterns.some(pattern => pattern.test(normalized));
    detected.push({
      key: item.key,
      label: item.label,
      detected: found
    });
  }
  return detected;
}
function calculateScopeScore(scopeItems) {
  const total = scopeItems.length;
  const detected = scopeItems.filter(i => i.detected).length;
  return {
    detected,
    total,
    score: Math.round((detected / total) * 100)
  };
}
window.detectScopeItems = detectScopeItems;
window.calculateScopeScore = calculateScopeScore;
async function fileToImageDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
async function preprocessImageForOcr(imageSource, mode = "soft") {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const maxDimension = 2400;
      const longestSide = Math.max(img.width, img.height);
      const upscaleRatio = longestSide < maxDimension ? maxDimension / longestSide : 1;
      const scale = Math.max(1.5, Math.min(2.5, upscaleRatio));
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not create canvas context for OCR preprocessing."));
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;
      if (mode === "soft") {
        for (let i = 0; i < data.length; i += 4) {
          let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          gray = (gray - 128) * 1.3 + 128;
          gray = Math.max(0, Math.min(255, gray));
          data[i] = gray; data[i + 1] = gray; data[i + 2] = gray;
        }
      } else if (mode === "strong") {
        for (let i = 0; i < data.length; i += 4) {
          let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          gray = (gray - 128) * 1.6 + 128;
          gray = gray > 170 ? 255 : gray < 85 ? 0 : gray;
          gray = Math.max(0, Math.min(255, gray));
          data[i] = gray; data[i + 1] = gray; data[i + 2] = gray;
        }
      } else if (mode === "adaptive") {
        const grayArr = new Uint8Array(width * height);
        for (let i = 0; i < data.length; i += 4) {
          grayArr[i / 4] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        }
        const blockSize = 31;
        const halfBlock = Math.floor(blockSize / 2);
        const offset = 12;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            let sum = 0, count = 0;
            const y0 = Math.max(0, y - halfBlock);
            const y1 = Math.min(height - 1, y + halfBlock);
            const x0 = Math.max(0, x - halfBlock);
            const x1 = Math.min(width - 1, x + halfBlock);
            for (let sy = y0; sy <= y1; sy += 3) {
              for (let sx = x0; sx <= x1; sx += 3) {
                sum += grayArr[sy * width + sx];
                count++;
              }
            }
            const localMean = sum / count;
            const idx = (y * width + x) * 4;
            const val = grayArr[y * width + x] > localMean - offset ? 255 : 0;
            data[idx] = val; data[idx + 1] = val; data[idx + 2] = val;
          }
        }
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = imageSource;
  });
}
async function runOcrOnImageSource(imageSource, progressCallback, options = {}) {
  const result = await Tesseract.recognize(imageSource, "eng", {
    logger: message => {
      if (typeof progressCallback === "function" && message.status === "recognizing text") {
        progressCallback(message.progress || 0);
      }
    },
    tessedit_pageseg_mode: options.psm || 6,
    preserve_interword_spaces: "1",
    tessedit_char_whitelist: "",
    tessjs_create_hocr: "0",
    tessjs_create_tsv: "0"
  });
  return (result && result.data && result.data.text ? result.data.text : "").trim();
}
async function createImageRegionsForOcr(imageSource) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      const fullCanvas = document.createElement("canvas");
      const fullCtx = fullCanvas.getContext("2d");
      if (!fullCtx) {
        reject(new Error("Could not create canvas context for OCR regions."));
        return;
      }
      fullCanvas.width = img.width;
      fullCanvas.height = img.height;
      fullCtx.drawImage(img, 0, 0);
      function cropRegion(x, y, width, height) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        canvas.width = Math.max(1, Math.round(width));
        canvas.height = Math.max(1, Math.round(height));
        ctx.drawImage(
          fullCanvas,
          Math.round(x),
          Math.round(y),
          Math.round(width),
          Math.round(height),
          0,
          0,
          canvas.width,
          canvas.height
        );
        return canvas.toDataURL("image/png");
      }
      const w = img.width;
      const h = img.height;
      resolve([
        { label: "full page", src: imageSource, psm: 6 },
        { label: "top half", src: cropRegion(0, 0, w, h * 0.55), psm: 6 },
        { label: "middle body", src: cropRegion(w * 0.08, h * 0.20, w * 0.84, h * 0.42), psm: 6 },
        { label: "right info panel", src: cropRegion(w * 0.50, h * 0.18, w * 0.42, h * 0.28), psm: 6 },
        { label: "description block", src: cropRegion(w * 0.08, h * 0.22, w * 0.84, h * 0.30), psm: 6 },
        { label: "bottom total area", src: cropRegion(w * 0.48, h * 0.48, w * 0.44, h * 0.22), psm: 6 }
      ].filter(region => region.src));
    };
    img.onerror = reject;
    img.src = imageSource;
  });
}
async function extractTextFromPdfNative(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let lastY = null;
    let lastX = null;
    let lastWidth = null;
    let pageText = "";
    for (const item of content.items) {
      if (!("str" in item) || !item.str) continue;
      const x = item.transform ? item.transform[4] : null;
      const y = item.transform ? item.transform[5] : null;
      const fontSize = item.transform ? Math.abs(item.transform[0]) : 12;
      const itemWidth = item.width || (item.str.length * fontSize * 0.5);
      if (lastY !== null && y !== null && Math.abs(y - lastY) > fontSize * 0.4) {
        pageText += "\n";
      } else if (lastX !== null && x !== null && lastWidth !== null) {
        const gap = x - (lastX + lastWidth);
        const spaceThreshold = fontSize * 0.25;
        if (gap > spaceThreshold) {
          if (!pageText.endsWith(" ") && !pageText.endsWith("\n")) {
            pageText += " ";
          }
        }
      } else if (pageText.length > 0 && !pageText.endsWith("\n") && !pageText.endsWith(" ")) {
        pageText += " ";
      }
      pageText += item.str;
      lastY = y;
      lastX = x;
      lastWidth = itemWidth;
    }
    fullText += "\n" + pageText;
  }
  fullText = fullText
    .replace(/Roo\s*fi\s*ng/gi, "Roofing")
    .replace(/Ar\s*chitectur\s*al/gi, "Architectural")
    .replace(/under\s*la\s*y\s*ment/gi, "underlayment")
    .replace(/Underla\s*yment/gi, "Underlayment")
    .replace(/v\s*entila\s*tion/gi, "ventilation")
    .replace(/syn\s*thetic/gi, "synthetic")
    .replace(/Cer\s*tain\s*T\s*eed/gi, "CertainTeed")
    .replace(/Ice and W\s*ater/gi, "Ice and Water")
    .replace(/ice and w\s*ater/gi, "ice and water")
    .replace(/ridge\s+v\s*ent/gi, "ridge vent")
    .replace(/Ridge\s+v\s*ent/gi, "Ridge vent")
    .replace(/fl\s*ashing/gi, "flashing")
    .replace(/v\s*alle\s*ys/gi, "valleys")
    .replace(/penetr\s*ations/gi, "penetrations")
    .replace(/warr\s*anty/gi, "warranty")
    .replace(/T\s*O\s*T\s*AL/g, "TOTAL")
    .replace(/drip\s+metal/gi, "drip edge")
    .replace(/Drip\s+metal/gi, "Drip edge");
  fullText = fullText.replace(/\bfi ([a-z])/g, 'fi$1');
  fullText = fullText.replace(/\bfl ([a-z])/g, 'fl$1');
  fullText = fullText.replace(/\bff ([a-z])/g, 'ff$1');
  for (let i = 0; i < 5; i++) {
    fullText = fullText.replace(/ ([a-z]) ([a-z])/g, ' $1$2');
    fullText = fullText.replace(/\b([A-Z]) ([a-z])/g, '$1$2');
  }
  return fullText.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
function normalizeOcrWhitespace(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
function scoreOcrTextQuality(text) {
  const cleaned = normalizeWhitespace(String(text || ""));
  if (!cleaned) return 0;
  let score = 0;
  score += Math.min(cleaned.length, 1500) * 0.02;
  const strongSignals = [
    "roofing estimate",
    "roof estimate",
    "total estimated cost",
    "total",
    "roof size",
    "sq ft",
    "asphalt shingles",
    "material",
    "description of work",
    "flashing",
    "ventilation",
    "warranty",
    "property information",
    "customer information"
  ];
  strongSignals.forEach(signal => {
    if (cleaned.toLowerCase().includes(signal)) score += 18;
  });
  const moneyMatches = cleaned.match(/\$\s?\d[\d,.\s]{2,}/g) || [];
  score += moneyMatches.length * 12;
  const numericRoofSizeMatch = cleaned.match(/\b\d{3,5}\s*(sq\.?\s*ft|sqft|square feet|squares?)\b/i);
  if (numericRoofSizeMatch) score += 25;
  const weirdGlyphPenalty = (cleaned.match(/[{}[\]|\\^~]/g) || []).length;
  score -= weirdGlyphPenalty * 4;
  const alphaNumNoisePenalty = (cleaned.match(/[A-Z]{2,}[0-9]{1,}|[0-9]{1,}[A-Z]{2,}/g) || []).length;
  score -= alphaNumNoisePenalty * 3;
  return score;
}
function shouldAcceptFastOcrText(text) {
  const cleaned = normalizeWhitespace(String(text || ""));
  if (!cleaned) return false;
  const hasStrongPrice =
    /\$\s?\d[\d,]{2,}(\.\d{2})?\b/.test(cleaned) ||
    /total estimated cost\s*\$?\s?\d[\d,]{2,}/i.test(cleaned) ||
    /grand total\s*[:\-]?\s*\$?\s?\d[\d,]{2,}/i.test(cleaned);
  const roofingSignals = [
    "roof",
    "roofing",
    "estimate",
    "proposal",
    "total",
    "material",
    "warranty",
    "shingles"
  ];
  const signalHits = roofingSignals.filter(term =>
    cleaned.toLowerCase().includes(term)
  ).length;
  const score = scoreOcrTextQuality(cleaned);
  if (score >= 70) return true;
  if (hasStrongPrice && signalHits >= 2) return true;
  return false;
}
async function runBestOcrFromVariants(
  imageVariants,
  progressLabel = "Running OCR",
  progressOptions = {}
) {
  const candidates = [];
  const startPercent =
  typeof progressOptions.startPercent === "number" ? progressOptions.startPercent : 35;
  const endPercent =
     typeof progressOptions.endPercent === "number" ? progressOptions.endPercent : 70;
  const totalVariants = Math.max(imageVariants.length, 1);
  for (let i = 0; i < imageVariants.length; i++) {
    const variant = imageVariants[i];
    const text = await runOcrOnImageSource(
      variant.src,
      progress => {
    const variantBaseStart =
      startPercent + ((endPercent - startPercent) * i) / totalVariants;
    const variantBaseEnd =
      startPercent + ((endPercent - startPercent) * (i + 1)) / totalVariants;
    const mappedProgress =
      variantBaseStart + (variantBaseEnd - variantBaseStart) * (progress || 0);
    if (typeof setSmartUploadStatus === "function") {
      setSmartUploadStatus("identify", Math.round(mappedProgress));
    } else {
      setUploadStatus("Identifying key details from your quote...", "info");
    }
  },
      { psm: variant.psm || 6 }
    );
    candidates.push({
      label: variant.label,
      text,
      score: scoreOcrTextQuality(text)
    });
  }
  candidates.sort((a, b) => b.score - a.score);
  const mergedText = normalizeWhitespace(
    candidates
      .map(candidate => candidate.text || "")
      .filter(Boolean)
      .join("\n")
  );
  return {
    best: candidates[0] || { text: "", score: 0, label: "none" },
    mergedText,
    candidates
  };
}
function isWeakExtractedText(text) {
  const cleaned = normalizeWhitespace(text);
  if (!cleaned || cleaned.length < 120) return true;
  const signals = [
    "roof",
    "roofing",
    "shingle",
    "estimate",
    "proposal",
    "total",
    "price",
    "cost",
    "warranty",
    "flashing",
    "underlayment",
    "tear off",
    "square",
    "sq ft",
    "contractor"
  ];
  const hits = signals.filter(term => cleaned.toLowerCase().includes(term)).length;
  return hits < 2;
}
async function renderPdfPagesToImages(file, scale = 2.5) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const images = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({
      canvasContext: context,
      viewport
    }).promise;
    images.push(canvas.toDataURL("image/png"));
  }
  return images;
}
async function extractTextFromPdfWithOcrFallback(file) {
  if (typeof setSmartUploadStatus === "function") {
    setSmartUploadStatus("extract", 25);
  } else {
    setUploadStatus("Extracting text from your quote...", "info");
  }
  const nativeText = await extractTextFromPdfNative(file);
  if (!isWeakExtractedText(nativeText)) {
    return {
      text: nativeText,
      method: "pdf_text"
    };
  }
  if (typeof setSmartUploadStatus === "function") {
    setSmartUploadStatus("identify", 45);
  } else {
    setUploadStatus("Identifying key details from your quote...", "info");
  }
  const pageImages = await renderPdfPagesToImages(file);
  const ocrPages = [];
  for (let i = 0; i < pageImages.length; i++) {
    const pageImage = pageImages[i];
    const softPageImage = await preprocessImageForOcr(pageImage, "soft");
    const strongPageImage = await preprocessImageForOcr(pageImage, "strong");
    const adaptivePageImage = await preprocessImageForOcr(pageImage, "adaptive");
    const originalRegions = await createImageRegionsForOcr(pageImage);
    const softRegions = await createImageRegionsForOcr(softPageImage);
    const adaptiveRegions = await createImageRegionsForOcr(adaptivePageImage);
    const totalPages = Math.max(pageImages.length, 1);
const pageStartPercent = 45 + Math.round((35 * i) / totalPages);
const pageEndPercent = 45 + Math.round((35 * (i + 1)) / totalPages);
const ocrResult = await runBestOcrFromVariants(
  [
    { label: `page ${i + 1} original`, src: pageImage, psm: 6 },
    { label: `page ${i + 1} enhanced`, src: softPageImage, psm: 6 },
    { label: `page ${i + 1} high contrast`, src: strongPageImage, psm: 6 },
    { label: `page ${i + 1} adaptive`, src: adaptivePageImage, psm: 6 },
    ...originalRegions.map(region => ({
      label: `page ${i + 1} original ${region.label}`,
      src: region.src,
      psm: region.psm || 6
    })),
    ...softRegions.map(region => ({
      label: `page ${i + 1} enhanced ${region.label}`,
      src: region.src,
      psm: region.psm || 6
    })),
    ...adaptiveRegions.map(region => ({
      label: `page ${i + 1} adaptive ${region.label}`,
      src: region.src,
      psm: region.psm || 6
    }))
  ],
  "Identifying key details from your quote",
  { startPercent: pageStartPercent, endPercent: pageEndPercent }
);
    const bestPageText = normalizeOcrWhitespace(
      ocrResult.mergedText || ocrResult.best.text || ""
    );
    if (bestPageText) {
      ocrPages.push(bestPageText);
    }
  }
  const mergedText = normalizeWhitespace(
    [nativeText, ...ocrPages].filter(Boolean).join("\n\n")
  );
  return {
    text: mergedText,
    method: "pdf_ocr_fallback"
  };
}
async function extractTextFromUploadedFile(file) {
  const name = String(file.name || "").toLowerCase();
  const mimeType = String(file.type || "").toLowerCase();
  const isPdf = mimeType === "application/pdf" || name.endsWith(".pdf");
  const isImage =
    mimeType.startsWith("image/") ||
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".webp") ||
    name.endsWith(".bmp") ||
    name.endsWith(".gif");
  if (isPdf) {
    if (typeof setSmartUploadStatus === "function") {
      setSmartUploadStatus("upload", 10); 
    }
    return await extractTextFromPdfWithOcrFallback(file);
  }
  if (isImage) {
    if (typeof setSmartUploadStatus === "function") {
    setSmartUploadStatus("upload", 10);
    setSmartUploadStatus("extract", 25);
  } else {
    setUploadStatus("Uploading your quote...", "info");
  }
    const imageDataUrl = await fileToImageDataUrl(file);
    const softImageDataUrl = await preprocessImageForOcr(imageDataUrl, "soft");
    const strongImageDataUrl = await preprocessImageForOcr(imageDataUrl, "strong");
    const originalRegions = await createImageRegionsForOcr(imageDataUrl);
const softRegions = await createImageRegionsForOcr(softImageDataUrl);
const fastOriginalRegions = originalRegions.filter(region =>
  region.label === "middle body" || region.label === "bottom total area"
);
const fastSoftRegions = softRegions.filter(region =>
  region.label === "middle body" || region.label === "bottom total area"
);
const fastOcrResult = await runBestOcrFromVariants(
  [
    { label: "original image", src: imageDataUrl, psm: 6 },
    { label: "enhanced image", src: softImageDataUrl, psm: 6 },
    ...fastOriginalRegions.map(region => ({
      label: `original ${region.label}`,
      src: region.src,
      psm: region.psm || 6
    })),
    ...fastSoftRegions.map(region => ({
      label: `enhanced ${region.label}`,
      src: region.src,
      psm: region.psm || 6
    }))
  ],
  "Identifying key details from your quote",
  { startPercent: 35, endPercent: 68 }
);
const fastBestText = normalizeOcrWhitespace(
  fastOcrResult.best.text || fastOcrResult.mergedText || ""
);
if (shouldAcceptFastOcrText(fastBestText)) {
  return {
    text: fastBestText,
    method: "image_ocr"
  };
} 
const rescueOcrResult = await runBestOcrFromVariants(
  [
    { label: "high contrast image", src: strongImageDataUrl, psm: 6 },
    ...originalRegions
      .filter(region => region.label !== "middle body" && region.label !== "bottom total area")
      .map(region => ({
        label: `original ${region.label}`,
        src: region.src,
        psm: region.psm || 6
      })),
    ...softRegions
      .filter(region => region.label !== "middle body" && region.label !== "bottom total area")
      .map(region => ({
        label: `enhanced ${region.label}`,
        src: region.src,
        psm: region.psm || 6
      }))
  ],
  "Identifying key details from your quote",
  { startPercent: 68, endPercent: 78 }
);
const finalText = normalizeOcrWhitespace(
  rescueOcrResult.best.text ||
  fastBestText ||
  rescueOcrResult.mergedText ||
  fastOcrResult.mergedText ||
  ""
);
return {
  text: finalText,
  method: "image_ocr"
};
  }
  throw new Error("Unsupported file type. Please upload a PDF or image.");
}
  async function parseUploadedComparisonFile(file) {
    if (!file) return null;
    if (typeof loadVendorLibs === "function") {
      await loadVendorLibs();
    }
    const extractionResult = await extractTextFromUploadedFile(file);
    const rawText = extractionResult && extractionResult.text ? extractionResult.text : "";
    const normalizedText = normalizeWhitespace(rawText);
    const parsed = parseExtractedText(normalizedText || "", {
  extractionMethod: extractionResult ? extractionResult.method : "ocr_cache"
});
    return {
      fileName: file.name || "",
      method: extractionResult ? extractionResult.method : "",
      rawText: rawText || "",
    normalizedText: normalizedText || "",
    parsed: parsed || {}
  };
}
async function parseQuote() {
  const fileInput = document.getElementById("quoteFile");
  const output = document.getElementById("analysisOutput");
  const aiOutput = document.getElementById("aiAnalysisOutput");
  if (!fileInput.files.length) {
    output.innerHTML = "Please upload a roofing quote file first.";
    aiOutput.innerHTML = "Upload a quote or run the manual analysis to receive an expert explanation.";
    setUploadStatus("No file selected yet.", "error");
    return;
  }
  const file = fileInput.files[0];
  try {
    if (typeof setSmartUploadStatus === "function") {
    setSmartUploadStatus("upload", 10);
  } else {
    setUploadStatus("Uploading your quote...", "info");
  }
    const extractionResult = await extractTextFromUploadedFile(file);
    const parsedText = normalizeWhitespace(extractionResult.text || "");
    if (!parsedText) {
      throw new Error("We could not read usable text from that file.");
    }
    analyzeParsedText(parsedText, extractionResult.method);
  } catch (error) {
    console.error(error);
    output.innerHTML = "Unable to read this file. Please try a clearer PDF, screenshot, photo, or use manual analysis below.";
    aiOutput.innerHTML = "The uploaded file could not be parsed. Enter the key quote numbers manually to receive an expert explanation.";
    setUploadStatus(error.message || "Unable to parse uploaded file.", "error");
  }
}
window.parseUploadedComparisonFile = parseUploadedComparisonFile;
  function repairDisplayText(text) {
    let t = String(text || "");
    t = t.replace(/Roo\s*fi\s*ng/gi, "Roofing");
    t = t.replace(/Cr\s*osb\s*y/gi, "Crosby");
    t = t.replace(/Ar\s*chitectur\s*al/gi, "Architectural");
    t = t.replace(/under\s*la\s*y\s*ment/gi, "Underlayment");
    t = t.replace(/Cer\s*tain\s*T\s*eed/gi, "CertainTeed");
    t = t.replace(/fl\s*ashing/gi, "flashing");
    t = t.replace(/v\s*entila\s*tion/gi, "ventilation");
    t = t.replace(/\bfi ([a-z])/g, 'fi$1');
    t = t.replace(/\bfl ([a-z])/g, 'fl$1');
    t = t.replace(/\bff ([a-z])/g, 'ff$1');
    for (let i = 0; i < 5; i++) {
      t = t.replace(/ ([a-z]) ([a-z])/g, ' $1$2');
      t = t.replace(/\b([A-Z]) ([a-z])/g, '$1$2');
    }
    t = t.replace(/\s{2,}/g, ' ').trim();
    return t;
  }
  ;(function () {
    let journeyState = {
      step: "address",
      propertyPreview: null,
      propertyConfirmed: false,
      propertyLookupAttempted: false,
      propertyLookupFailed: false,
      propertyLookupMessage: ""
    };
    let latestParsed = null;
    let latestSmartQuote = null;
    let latestAnalysis = null;
    window.__tpDebug = window.__tpDebug || {};
    window.__tpDebug.getLatestAnalysis = () => window.__latestAnalysis || null;
    let latestExtractedText = "";
    let secondParsed = null;
    let thirdParsed = null;
    const TP_TRACKING_KEY = "tp_tracking_events";
    const TP_SESSION_KEY = "tp_tracking_session";
    function escapeHtml(text) {
      const div = document.createElement("div");
      div.appendChild(document.createTextNode(String(text || "")));
      return div.innerHTML;
    }
    function generateSessionId() {
      return "tp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
    }
    function getTrackingSession() {
      try {
        let session = JSON.parse(localStorage.getItem(TP_SESSION_KEY) || "null");
        if (!session || !session.sessionId) {
          session = {
            sessionId: generateSessionId(),
            startedAt: new Date().toISOString(),
            pagePath: window.location.pathname,
            userAgent: navigator.userAgent,
            analysesRun: 0
          };
          localStorage.setItem(TP_SESSION_KEY, JSON.stringify(session));
        }
        return session;
      } catch (err) {
        console.warn("Tracking session load failed", err);
        return {
          sessionId: generateSessionId(),
          startedAt: new Date().toISOString(),
          pagePath: window.location.pathname,
          userAgent: navigator.userAgent,
          analysesRun: 0
        };
      }
    }
    function saveTrackingSession(session) {
      try {
        localStorage.setItem(TP_SESSION_KEY, JSON.stringify(session));
      } catch (err) {
        console.warn("Tracking session save failed", err);
      }
    }
    function getTrackingEvents() {
      try {
        return JSON.parse(localStorage.getItem(TP_TRACKING_KEY) || "[]");
      } catch (err) {
        console.warn("Tracking events load failed", err);
        return [];
      }
    }
    function track(event, data = {}) {
      try {
        const session = getTrackingSession();
        const payload = {
          event,
          timestamp: new Date().toISOString(),
          sessionId: session.sessionId,
          page: window.location.pathname,
          ...data
        };
        const existing = getTrackingEvents();
        existing.push(payload);
        localStorage.setItem(TP_TRACKING_KEY, JSON.stringify(existing));
        return payload;
      } catch (err) {
        console.warn("Tracking failed", err);
        return null;
      }
    }
    function clearTrackingEvents() {
      try {
        localStorage.removeItem(TP_TRACKING_KEY);
      } catch (err) {
        console.warn("Could not clear tracking events", err);
      }
    }
    function byId(id) {
      return document.getElementById(id);
    }
    function safeFormatCurrency(value) {
      const num = Number(value);
      if (!isFinite(num)) return "Not available";
      if (typeof formatCurrency === "function") return formatCurrency(num);
      return "$" + Math.round(num).toLocaleString();
    }
    function safeFormatCurrencyPrecise(value, decimals = 2) {
      const num = Number(value);
      if (!isFinite(num)) return "Not available";
      return "$" + num.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
    }
    function safeFormatNumber(value) {
      const num = Number(value);
      if (!isFinite(num)) return "";
      if (typeof formatNumber === "function") return formatNumber(num);
      return num.toLocaleString();
    }
    function formatRoofSizeForDisplay(value, source, confidence = "") {
      const num = Number(value);
      if (!isFinite(num) || num <= 0) return "Not available";
      const normalizedSource = String(source || "").toLowerCase();
      const normalizedConfidence = String(confidence || "").toLowerCase();
      if (normalizedSource === "address_estimated") {
        const rounded = Math.round(num / 50) * 50;
        if (normalizedConfidence === "high") {
          return `${safeFormatNumber(rounded)} sq ft`;
        }
        return `about ${safeFormatNumber(rounded)} sq ft`;
      }
      if (normalizedSource === "living_area_fallback") {
        return `about ${safeFormatNumber(Math.round(num))} sq ft`;
      }
      if (normalizedSource === "price_based_estimate") {
        return `estimated ${safeFormatNumber(Math.round(num))} sq ft`;
      }
      return `${safeFormatNumber(num)} sq ft`;
    }
    function displayMaterial(value) {
      if (!value) return "Not detected";
      const key = String(value).toLowerCase();
      const map = {
        architectural: "Architectural shingles",
        asphalt: "Asphalt shingles",
        three_tab: "3-tab asphalt shingles",
        metal: "Metal roofing",
        tile: "Tile roofing",
        slate: "Slate roofing",
        "architectural shingles": "Architectural shingles",
        "asphalt shingles": "Asphalt shingles"
      };
      return map[key] || value;
    }
    function displayWarranty(value) {
      const normalized = String(value || "").trim().toLowerCase();
      if (!normalized || normalized === "not detected") return "Not listed in quote";
      return value;
    }
    function displayDetectedValue(value, fallback = "Not detected") {
      if (value === null || value === undefined || value === "") return fallback;
      return value;
    }
    function getVerdictClassName(verdict) {
        const normalized = String(verdict || "").toLowerCase();
        if (normalized.includes("excellent")) return "excellent-value";
        if (normalized.includes("fair")) return "fair-price";
        if (normalized.includes("higher than expected")) return "slightly-high";
        if (normalized.includes("overpriced")) return "overpriced";
        if (normalized.includes("possible scope risk")) return "potential-red-flag";
        if (normalized.includes("unusually low")) return "unusually-low";
        return "unknown";
    }
    function softenVerdictForRoofSizeTrust(verdict, consistency) {
        const baseVerdict = String(verdict || "").trim();
        const severity = String(consistency?.severity || "").toLowerCase();
        if (!baseVerdict) return baseVerdict;
        if (severity !== "medium" && severity !== "high") return baseVerdict;
        const high = severity === "high";
        if (baseVerdict === "Overpriced") {
          return high ? "Possibly Overpriced" : "May Be Overpriced";
        }
        if (baseVerdict === "Higher Than Expected") {
          return high ? "Possibly Higher Than Expected" : "May Be Higher Than Expected";
        }
        if (baseVerdict === "Fair Price") {
          return high ? "Fair Price, But Roof Size Needs Review" : "Fair Price, With Some Uncertainty";
        }
        if (baseVerdict === "Unusually Low") {
          return high ? "Possibly Unusually Low" : "May Be Unusually Low";
        }
        if (baseVerdict === "Possible Scope Risk") {
          return high ? "Low Price, But Roof Size Needs Review" : "Possible Scope Risk, With Some Uncertainty";
        }
        return baseVerdict;
      }
    function getVerdictTrustNote(consistency) {
        const severity = String(consistency?.severity || "").toLowerCase();
        if (severity === "high") {
          return "Roof size signals conflict, so this verdict should be treated as provisional until roof size is verified.";
        }
        if (severity === "medium") {
          return "Roof size signals are mixed, so treat this verdict as directional rather than exact.";
        }
        return "";
}
    function getConfidenceBadgeClass(label) {
      const normalized = String(label || "").toLowerCase();
      if (normalized === "high") return "high";
      if (normalized === "medium") return "medium";
      return "low";
    }
    function formatRoofSizeValue(value, source = "", confidence = "") {
      const num = Number(value);
      if (!isFinite(num) || num <= 0) return "Not available";
      const normalizedSource = String(source || "").toLowerCase();
      const normalizedConfidence = String(confidence || "").toLowerCase();
      if (normalizedSource === "address_estimated") {
        const rounded = Math.round(num / 50) * 50;
        return normalizedConfidence === "high"
          ? `${safeFormatNumber(rounded)} sq ft`
          : `about ${safeFormatNumber(rounded)} sq ft`;
      }
      if (normalizedSource === "living_area_fallback") {
        return `about ${safeFormatNumber(Math.round(num))} sq ft`;
      }
      if (normalizedSource === "price_based_estimate") {
        return `estimated ${safeFormatNumber(Math.round(num))} sq ft`;
      }
      return `${safeFormatNumber(Math.round(num))} sq ft`;
    }
function buildRoofSizeSuggestionHtml(a) {
    if (!a?.roofSizeEstimate || a?.userEnteredRoofSize) return "";
    const source = String(a?.roofSizeEstimateSource || "").toLowerCase();
    const confidence = a.roofSizeEstimateConfidence || "Low";
    const score = a.roofSizeEstimateConfidenceScore || "";
    let helperText = "Used only to improve this analysis. Verify with the contractor if possible.";
    if (source === "living_area_fallback") {
      helperText = "Estimated from home size — you can edit if needed.";
    } else if (source === "address_estimated") {
      helperText = "Estimated from property-level address data.";
    } else if (source === "price_based_estimate") {
      helperText = "Estimated from quote pricing only — verify before relying on it.";
    }
    return `
      <div class="panel" style="margin:0 0 12px; padding:12px 14px; background:#f8fafc; border-color:#e5e7eb;">
        <p class="small" style="margin:0 0 4px;">
          <strong>Estimated roof size:</strong> ${formatRoofSizeForDisplay(
            a.roofSizeEstimate,
            a.roofSizeEstimateSource,
            a.roofSizeEstimateConfidence
          )}
        </p>
        <p class="small muted" style="margin:0 0 8px;">
          ${helperText}
        </p>
        <button 
          type="button" 
          class="btn secondary" 
          id="useRoofSizeEstimateBtn"
          style="padding:6px 10px; font-size:13px; min-width:160px;"
        >
          Use this estimate
        </button>
      </div>
    `;
  }
function buildRoofCalculatorHtml(analysis) {
  const currentLength = byId("roofCalcLength")?.value || "";
  const currentWidth = byId("roofCalcWidth")?.value || "";
  const currentPitch = byId("roofCalcPitch")?.value || "6_12";
  const currentWaste = byId("roofCalcWaste")?.value || "medium";
  return `
    <div class="panel" style="margin:0 0 14px; padding:14px 16px; background:#f8fafc; border-color:#e5e7eb;">
      <p style="margin:0 0 6px; font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:#334155;">
        DIY roof size calculator
      </p>
      <h4 style="margin:0 0 10px;">Estimate roof size yourself</h4>
      <p class="small muted" style="margin:0 0 12px;">
        Use simple home dimensions as a reality check before relying on quote pricing.
      </p>
      <div class="analysis-grid" style="margin-top:0;">
        <div>
          <label for="roofCalcLength"><strong>Home length (ft)</strong></label>
          <input
            id="roofCalcLength"
            type="number"
            min="1"
            step="1"
            placeholder="e.g. 50"
            value="${currentLength}"
          />
        </div>
        <div>
          <label for="roofCalcWidth"><strong>Home width (ft)</strong></label>
          <input
            id="roofCalcWidth"
            type="number"
            min="1"
            step="1"
            placeholder="e.g. 30"
            value="${currentWidth}"
          />
        </div>
        <div>
          <label for="roofCalcPitch"><strong>Roof pitch</strong></label>
          <select id="roofCalcPitch">
            <option value="flat" ${currentPitch === "flat" ? "selected" : ""}>Flat / very low</option>
            <option value="3_12" ${currentPitch === "3_12" ? "selected" : ""}>3/12</option>
            <option value="4_12" ${currentPitch === "4_12" ? "selected" : ""}>4/12</option>
            <option value="5_12" ${currentPitch === "5_12" ? "selected" : ""}>5/12</option>
            <option value="6_12" ${currentPitch === "6_12" ? "selected" : ""}>6/12</option>
            <option value="7_12" ${currentPitch === "7_12" ? "selected" : ""}>7/12</option>
            <option value="8_12" ${currentPitch === "8_12" ? "selected" : ""}>8/12</option>
            <option value="9_12" ${currentPitch === "9_12" ? "selected" : ""}>9/12</option>
            <option value="10_12" ${currentPitch === "10_12" ? "selected" : ""}>10/12</option>
            <option value="12_12" ${currentPitch === "12_12" ? "selected" : ""}>12/12</option>
          </select>
        </div>
        <div>
          <label for="roofCalcWaste"><strong>Complexity / waste</strong></label>
          <select id="roofCalcWaste">
            <option value="low" ${currentWaste === "low" ? "selected" : ""}>Low</option>
            <option value="medium" ${currentWaste === "medium" ? "selected" : ""}>Medium</option>
            <option value="high" ${currentWaste === "high" ? "selected" : ""}>High</option>
          </select>
        </div>
      </div>
      <div style="margin-top:12px;">
        <button type="button" class="btn secondary" id="calculateRoofSizeBtn">
          Calculate roof size
        </button>
      </div>
      <div id="roofCalcOutput"></div>
    </div>
  `;
}
function bindRoofSizeSuggestionActions(analysis) {
    const btn = byId("useRoofSizeEstimateBtn");
    if (!btn || !analysis) return;
    btn.addEventListener("click", async function () {
      const input = byId("roofSize");
      const estimate = Number(analysis.roofSizeEstimate);
      if (!input || !isFinite(estimate) || estimate <= 0) return;
      input.value = String(Math.round(estimate));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      btn.disabled = true;
      btn.textContent = "Estimate applied";
      track("roof_size_estimate_applied", {
        estimatedRoofSqFt: Math.round(estimate),
        source: analysis?.roofSizeEstimateSource || "unknown"
      });
      renderAnalyzingState();
setTimeout(() => {
  const bar = document.getElementById("analysisProgressBar");
  if (bar) bar.style.width = "65%";
}, 300);
setTimeout(async () => {
  await analyzeQuote();
}, 700);
  });
}
    function getVerdictExplanation(verdict) {
  const normalized = String(verdict || "").toLowerCase();
  if (normalized.includes("possible scope risk")) {
    return "This quote is well below the expected range and may be missing important scope items.";
  }
  if (normalized.includes("unusually low")) {
    return "This quote is below the expected range and should be checked carefully for omissions or shortcuts.";
  }
  if (normalized.includes("overpriced")) {
    return "This quote is materially above the expected range for this type of roofing job.";
  }
  if (normalized.includes("higher than expected")) {
    return "This quote is above the expected range, though the difference may be explained by scope or materials.";
  }
  if (normalized.includes("fair")) {
    return "This quote is within the expected range based on the available details.";
  }
  if (normalized.includes("excellent")) {
    return "This quote appears to offer strong value relative to the expected range.";
  }
  return "This quote was compared against expected pricing using the available quote details.";
}
    function getDecisionGuidance(analysisOrReport) {
      if (!analysisOrReport) return "";
      const recommendationAction = String(
        analysisOrReport?.recommendation?.action || ""
      ).toUpperCase();
      const rawVerdict = String(
        analysisOrReport?.rawVerdict || analysisOrReport?.verdict || ""
      ).toLowerCase();
      const confidenceScore = Number(
        analysisOrReport?.confidenceScore ??
        analysisOrReport?.roofSizeEstimateConfidenceScore ??
        0
      );
      const reliabilityTier = String(
        analysisOrReport?.reliabilityTier || ""
      ).toUpperCase();
      const severity = String(
        analysisOrReport?.roofSizeConsistency?.severity || "low"
      ).toLowerCase();
      const needsReview = !!analysisOrReport?.roofSizeNeedsReview;
      const riskFlags = Array.isArray(analysisOrReport?.riskFlags)
        ? analysisOrReport.riskFlags
        : [];
      const highRiskCount = riskFlags.filter(
        flag => String(flag?.severity || "").toLowerCase() === "high"
      ).length;
      const lowConfidence =
        confidenceScore > 0 && confidenceScore < 60;
      const moderateConfidence =
        confidenceScore >= 60 && confidenceScore < 80;
      const hardUncertainty =
        needsReview ||
        severity === "high" ||
        reliabilityTier === "LOW_CONFIDENCE";
      const moderateUncertainty =
        severity === "medium" ||
        reliabilityTier === "ESTIMATED" ||
        moderateConfidence;
      if (hardUncertainty) {
        return "Do not make a contractor decision yet. Verify roof size, confirm scope in writing, then run this again.";
      }
      if (recommendationAction === "PROCEED") {
        if (highRiskCount > 0 || moderateUncertainty) {
          return "Pricing is acceptable, but do not sign until the flagged items are answered in writing.";
        }
        return "This quote is in a reasonable range. Pressure test it once, then move forward if scope and warranty check out.";
      }
      if (recommendationAction === "NEGOTIATE") {
        if (rawVerdict.includes("overpriced")) {
          return "This quote is overpriced. Push back on price, demand a line by line explanation, and do not accept the number as is.";
        }
        return "This quote is above market. Challenge the price and use competing quotes to force movement.";
      }
      if (recommendationAction === "REVIEW") {
        if (rawVerdict.includes("possible scope risk") || rawVerdict.includes("unusually low")) {
          return "This low price is not a green light yet. Audit scope, exclusions, and change order exposure before trusting it.";
        }
        if (lowConfidence) {
          return "The model does not trust the inputs enough yet. Fix the missing or conflicting data before acting.";
        }
        return "This quote still has unresolved issues. Get written answers before you decide.";
      }
      if (rawVerdict.includes("overpriced")) {
        return "This quote is overpriced. Negotiate hard or move on.";
      }
      if (rawVerdict.includes("higher than expected")) {
        return "This quote is high. Make the contractor defend the premium.";
      }
      if (rawVerdict.includes("possible scope risk") || rawVerdict.includes("unusually low")) {
        return "Low price alone is not a win. Confirm the scope before you trust it.";
      }
      if (rawVerdict.includes("fair")) {
        return "This quote is defensible on price. Final check the scope and then move.";
      }
      return "Do not drift into a decision. Resolve the open issues, then choose deliberately.";
    }
    function getSharePrompt(report) {
      if (!report) return "Share this result with someone you trust before you decide.";
      const recommendationAction = String(
        report?.recommendation?.action || ""
      ).toUpperCase();
      const rawVerdict = String(
        report?.rawVerdict || report?.verdict || ""
      ).toLowerCase();
      const severity = String(
        report?.roofSizeConsistency?.severity || "low"
      ).toLowerCase();
      const needsReview = !!report?.roofSizeNeedsReview;
      const contractor = displayDetectedValue(report?.contractor, "this contractor");
      if (needsReview || severity === "high") {
        return "Share this with the contractor and ask them to confirm the exact roof size they priced.";
      }
      if (recommendationAction === "NEGOTIATE") {
        if (rawVerdict.includes("overpriced")) {
          return `Send this to ${contractor} and make them explain the premium in writing.`;
        }
        return `Send this to ${contractor} and use it to challenge the price before you move.`;
      }
      if (recommendationAction === "REVIEW") {
        if (rawVerdict.includes("possible scope risk") || rawVerdict.includes("unusually low")) {
          return "Share this with a contractor or knowledgeable friend and ask what may be missing from the quote.";
        }
        return "Share this with the contractor and ask them to answer the flagged questions in writing.";
      }
      if (recommendationAction === "PROCEED") {
        return "Share this with a spouse, friend, or advisor for a final sanity check before signing.";
      }
      if (rawVerdict.includes("overpriced") || rawVerdict.includes("higher than expected")) {
        return "Share this before you accept the price. A second set of eyes can stop a bad overpay.";
      }
      if (rawVerdict.includes("possible scope risk") || rawVerdict.includes("unusually low")) {
        return "Share this before choosing the low bid. Cheap is dangerous when scope is unclear.";
      }
      return "Share this with someone you trust to pressure test the decision.";
    }
    function scrollToElementBySelector(selector) {
      const el = document.querySelector(selector);
      if (!el) return false;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    }
    function focusRoofSizeField() {
      const manualEntryDetails = byId("manualEntryDetails");
      const roofSizeInput = byId("roofSize");
      if (manualEntryDetails) manualEntryDetails.open = true;
      if (!roofSizeInput) return;
      roofSizeInput.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        roofSizeInput.focus();
        if (typeof roofSizeInput.select === "function") {
          roofSizeInput.select();
        }
      }, 250);
    }
    function shouldUseRoofReviewCta(analysis) {
      if (!analysis) return false;
      const severity = String(analysis?.roofSizeConsistency?.severity || "low").toLowerCase();
      const needsReview = !!analysis?.roofSizeNeedsReview;
      const hasSuggestion = shouldShowRoofSizeSuggestion(analysis);
      return hasSuggestion || severity === "high" || needsReview;
    }
    function getPrimaryCtaConfig(analysis) {
      if (!analysis) return null;
      const recommendedAction = String(
        analysis?.recommendation?.action || ""
      ).toUpperCase();
      const rawVerdict = String(
        analysis?.rawVerdict || analysis?.verdict || ""
      ).toLowerCase();
      const confidenceScore = Number(
        analysis?.confidenceScore ??
        analysis?.roofSizeEstimateConfidenceScore ??
        0
      );
      const severity = String(
        analysis?.roofSizeConsistency?.severity || "low"
      ).toLowerCase();
      const needsReview = !!analysis?.roofSizeNeedsReview;
      const riskFlags = Array.isArray(analysis?.riskFlags) ? analysis.riskFlags : [];
      const highRiskCount = riskFlags.filter(
        flag => String(flag?.severity || "").toLowerCase() === "high"
      ).length;
      const lowConfidence = confidenceScore > 0 && confidenceScore < 60;
      const moderateConfidence = confidenceScore >= 60 && confidenceScore < 80;
      if (shouldUseRoofReviewCta(analysis) || severity === "high" || needsReview) {
        return {
          mode: "verify",
          eyebrow: "Required next step",
          headline: "Verify roof size",
          body: "Do not make a contractor decision until roof size is confirmed.",
          primaryLabel: "Verify roof size",
          primaryAction: "review_roof_size"
        };
      }
      if (recommendedAction === "NEGOTIATE") {
        if (rawVerdict.includes("overpriced")) {
          return {
            mode: "negotiate",
            eyebrow: "Recommended next step",
            headline: "Push back on price",
            body: "This quote is overpriced. Demand a breakdown and force the contractor to defend the number.",
            primaryLabel: "Push back on price",
            primaryAction: "copy_contractor_questions"
          };
        }
        return {
          mode: "negotiate",
          eyebrow: "Recommended next step",
          headline: "Challenge this quote",
          body: "This quote is above market. Use direct questions and competing bids to pressure the price down.",
          primaryLabel: "Challenge this quote",
          primaryAction: "copy_contractor_questions"
        };
      }
      if (recommendedAction === "REVIEW") {
        if (rawVerdict.includes("possible scope risk") || rawVerdict.includes("unusually low")) {
          return {
            mode: "review",
            eyebrow: "Recommended next step",
            headline: "Resolve the low bid risk",
            body: "Do not trust this low price until exclusions, missing scope, and change order exposure are clear.",
            primaryLabel: "Resolve flagged issues",
            primaryAction: "copy_contractor_questions"
          };
        }
        if (lowConfidence || highRiskCount > 0) {
          return {
            mode: "review",
            eyebrow: "Recommended next step",
            headline: "Resolve flagged issues",
            body: "This quote is not clean enough to trust yet. Get answers before you move.",
            primaryLabel: "Resolve flagged issues",
            primaryAction: "copy_contractor_questions"
          };
        }
        return {
          mode: "review",
          eyebrow: "Recommended next step",
          headline: "Get answers in writing",
          body: "This quote is close, but not decision ready until the open questions are resolved.",
          primaryLabel: "Get answers in writing",
          primaryAction: "copy_contractor_questions"
        };
      }
      if (recommendedAction === "PROCEED") {
        if (highRiskCount > 0 || moderateConfidence) {
          return {
            mode: "review",
            eyebrow: "Recommended next step",
            headline: "Pressure test this quote",
            body: "Pricing is acceptable, but you should close the remaining issues before signing.",
            primaryLabel: "Pressure test this quote",
            primaryAction: "copy_contractor_questions"
          };
        }
        return {
          mode: "proceed",
          eyebrow: "Recommended next step",
          headline: "Advance this quote",
          body: "The price is defensible. Compare once more or move forward if scope and warranty check out.",
          primaryLabel: "Advance this quote",
          primaryAction: "compare_quotes"
        };
      }
      if (rawVerdict.includes("overpriced")) {
        return {
          mode: "negotiate",
          eyebrow: "Recommended next step",
          headline: "Push back on price",
          body: "This quote looks overpriced relative to the model.",
          primaryLabel: "Push back on price",
          primaryAction: "copy_contractor_questions"
        };
      }
      if (rawVerdict.includes("higher than expected")) {
        return {
          mode: "compare",
          eyebrow: "Recommended next step",
          headline: "Force a price check",
          body: "This quote is high enough that you should challenge it before moving forward.",
          primaryLabel: "Force a price check",
          primaryAction: "compare_quotes"
        };
      }
      if (rawVerdict.includes("possible scope risk") || rawVerdict.includes("unusually low")) {
        return {
          mode: "review",
          eyebrow: "Recommended next step",
          headline: "Do not trust the low bid yet",
          body: "Low price without scope clarity is where bad decisions happen.",
          primaryLabel: "Resolve flagged issues",
          primaryAction: "copy_contractor_questions"
        };
      }
      return {
        mode: "share",
        eyebrow: "Recommended next step",
        headline: "Pressure test the decision",
        body: "Use one more set of eyes before you commit.",
        primaryLabel: "Copy share summary",
        primaryAction: "copy_summary"
      };
    }
        function buildPrimaryCtaHtml(analysis) {
          const config = getPrimaryCtaConfig(analysis);
          if (!config) return "";
          return `
            <div class="panel primary-cta ${config.mode}" style="margin:0 0 18px; padding:18px 18px 16px; border-width:2px;">
              <div class="primary-cta-eyebrow">${config.eyebrow}</div>
              <h4 style="margin:0 0 8px;">${config.headline}</h4>
              <p style="margin:0 0 12px;">${config.body}</p>
              <div class="primary-cta-actions">
                <button type="button" class="btn" data-cta-action="${config.primaryAction}" style="min-width:220px;">
                  ${config.primaryLabel}
                </button>
              </div>
            </div>
          `;
        }
      function handlePrimaryCtaAction(action, analysis) {
        if (!action) return;
        const ctaConfig = getPrimaryCtaConfig(analysis);
        track("cta_clicked", {
          action,
          mode: ctaConfig?.mode || "unknown",
          verdict: analysis?.verdict || "",
          rawVerdict: analysis?.rawVerdict || "",
          roofSizeNeedsReview: !!analysis?.roofSizeNeedsReview,
          roofSizeConsistencySeverity: analysis?.roofSizeConsistency?.severity || "low"
        });
        if (action === "review_roof_size") {
          focusRoofSizeField();
          return;
        }
        if (action === "use_suggested_roof_size") {
          const btn = byId("useRoofSizeEstimateBtn");
          if (btn) {
            btn.click();
          } else {
            focusRoofSizeField();
          }
          return;
        }
        if (action === "copy_contractor_questions") {
          track("cta_copy_contractor_questions_clicked", {
            verdict: analysis?.verdict || "",
            rawVerdict: analysis?.rawVerdict || ""
          });
          if (typeof copyContractorQuestions === "function") {
            try {
              copyContractorQuestions();
            } catch (e) {
              console.error(e);
              viewShareableResult();
            }
          } else {
            viewShareableResult();
          }
          return;
        }
        if (action === "request_quote") {
          scrollToElementBySelector(".lead-box");
          return;
        }
        if (action === "view_report") {
          viewShareableResult();
          const output = getShareReportOutputElement();
          if (output) {
            setTimeout(() => {
              output.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 150);
          }
          return;
        }
        if (action === "copy_summary") {
          copyShareableReportText();
          return;
        }
        if (action === "compare_quotes") {
          compareQuotes();
          return;
        }
    }
    function bindPrimaryCtaActions(analysis) {
      const buttons = document.querySelectorAll("[data-cta-action]");
      if (!buttons.length) return;
      buttons.forEach(button => {
        if (button.dataset.ctaBound === "true") return;
        button.addEventListener("click", function () {
          handlePrimaryCtaAction(button.dataset.ctaAction, analysis);
        });
        button.dataset.ctaBound = "true";
      });
    }
    function getRoofPitchMultiplier(pitchLabel) {
  const map = {
    "flat": 1.00,
    "3_12": 1.03,
    "4_12": 1.05,
    "5_12": 1.08,
    "6_12": 1.12,
    "7_12": 1.16,
    "8_12": 1.20,
    "9_12": 1.25,
    "10_12": 1.30,
    "12_12": 1.41
  };
  return map[String(pitchLabel || "").toLowerCase()] || 1.12;
}
function getRoofWasteMultiplier(wasteLabel) {
  const map = {
    "low": 1.05,
    "medium": 1.10,
    "high": 1.15
  };
  return map[String(wasteLabel || "").toLowerCase()] || 1.10;
}
function calculateManualRoofSizeEstimate({
    length,
    width,
    pitch,
    waste
  }) {
    const numericLength = Number(length);
    const numericWidth = Number(width);
    if (!isFinite(numericLength) || numericLength <= 0 || !isFinite(numericWidth) || numericWidth <= 0) {
      return null;
    }
    const footprintSqFt = numericLength * numericWidth;
    const pitchMultiplier = getRoofPitchMultiplier(pitch);
    const wasteMultiplier = getRoofWasteMultiplier(waste);
    const estimatedRoofSqFt = footprintSqFt * pitchMultiplier * wasteMultiplier;
    return {
      footprintSqFt: Math.round(footprintSqFt),
      estimatedRoofSqFt: Math.round(estimatedRoofSqFt),
      pitchMultiplier,
      wasteMultiplier,
      confidence: "Manual estimate",
      methodology: "Footprint × pitch factor × waste factor"
  };
}
function buildRoofCalculatorResultHtml(result) {
  if (!result) return "";
  return `
    <div class="panel" style="margin:12px 0 0; background:#f8fafc; border-color:#e5e7eb;">
      <p style="margin:0 0 8px;"><strong>DIY roof size estimate</strong></p>
      <div class="analysis-grid" style="margin-top:0;">
        <div><strong>Footprint</strong></div>
        <div>${safeFormatNumber(result.footprintSqFt)} sq ft</div>
        <div><strong>Estimated roof size</strong></div>
        <div>${safeFormatNumber(result.estimatedRoofSqFt)} sq ft</div>
        <div><strong>Confidence</strong></div>
        <div>${result.confidence}</div>
      </div>
      <p class="small muted" style="margin:10px 0 0;">
        Method: ${result.methodology}
      </p>
      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
        <button type="button" class="btn secondary" id="useManualRoofCalcBtn">
          Use this roof size
        </button>
      </div>
    </div>
  `;
}
function renderRoofCalculatorOutput() {
  const output = byId("roofCalcOutput");
  if (!output) return;
  const length = byId("roofCalcLength")?.value || "";
  const width = byId("roofCalcWidth")?.value || "";
  const pitch = byId("roofCalcPitch")?.value || "6_12";
  const waste = byId("roofCalcWaste")?.value || "medium";
  const result = calculateManualRoofSizeEstimate({
    length,
    width,
    pitch,
    waste
  });
  if (!result) {
    output.innerHTML = `
      <div class="panel" style="margin-top:12px; background:#fff7ed; border-color:#fdba74;">
        <p style="margin:0;">
          Enter home length and width to generate a roof size estimate.
        </p>
      </div>
    `;
    return;
  }
  output.innerHTML = buildRoofCalculatorResultHtml(result);
  const useBtn = byId("useManualRoofCalcBtn");
  if (useBtn && useBtn.dataset.bound !== "true") {
    useBtn.addEventListener("click", async function () {
      const roofSizeInput = byId("roofSize");
      if (!roofSizeInput) return;
      roofSizeInput.value = String(result.estimatedRoofSqFt);
      roofSizeInput.dataset.source = "manual_calculator";
      roofSizeInput.dataset.confidence = "manual_estimate";
      roofSizeInput.dispatchEvent(new Event("input", { bubbles: true }));
      roofSizeInput.dispatchEvent(new Event("change", { bubbles: true }));
      setUploadStatus("DIY roof size estimate applied. Re-running analysis.", "success");
      await analyzeQuote();
    });
    useBtn.dataset.bound = "true";
  }
}
function bindRoofCalculatorActions() {
  const triggerIds = [
    "roofCalcLength",
    "roofCalcWidth",
    "roofCalcPitch",
    "roofCalcWaste"
  ];
  triggerIds.forEach(id => {
    const el = byId(id);
    if (!el || el.dataset.bound === "true") return;
    const handler = function () {
      renderRoofCalculatorOutput();
    };
    el.addEventListener("input", handler);
    el.addEventListener("change", handler);
    el.dataset.bound = "true";
  });
  const calculateBtn = byId("calculateRoofSizeBtn");
  if (calculateBtn && calculateBtn.dataset.bound !== "true") {
    calculateBtn.addEventListener("click", function () {
      renderRoofCalculatorOutput();
    });
    calculateBtn.dataset.bound = "true";
  }
}
    function setUploadStatus(message, type = "info") {
      const el = byId("uploadStatus");
      if (!el) return;
      el.className = `upload-status ${type}`;
      el.innerText = message;
    }
    function setSmartUploadStatus(stage, percent) {
      const map = {
        upload: {
          title: "Uploading your quote",
          percent: 10,
          type: "info"
        },
        extract: {
          title: "Extracting text from your quote",
          percent: 35,
          type: "info"
        },
        identify: {
          title: "Identifying key details from your quote",
          percent: 60,
          type: "info"
        },
        analyze: {
          title: "Analyzing pricing",
          percent: 85,
          type: "info"
        },
        done: {
          title: "Analysis complete",
          percent: 100,
          type: "success"
        }
      };
      const config = map[stage] || {
        title: String(stage || "Working on your quote"),
        percent: typeof percent === "number" ? percent : 50,
        type: "info"
      };
      const pct = typeof percent === "number" ? percent : config.percent;
      setUploadStatus(
        `[${"█".repeat(Math.max(0, Math.min(12, Math.round(pct / 8.333))))}${"░".repeat(12 - Math.max(0, Math.min(12, Math.round(pct / 8.333))))}] ${Math.round(pct)}%\n${config.title}\nThis usually takes a few seconds\nWe do not store or share your documents.`,
        config.type
      );
    }
    function normalizeMaterialForForm(materialValue, materialLabel) {
      const combined = `${materialValue || ""} ${materialLabel || ""}`.toLowerCase();
      if (combined.includes("architectural")) return "architectural";
      if (combined.includes("metal")) return "metal";
      if (combined.includes("tile")) return "tile";
      if (combined.includes("asphalt")) return "asphalt";
      return "architectural";
    }
    function normalizeTearOffForUi(parsed) {
      const status = parsed?.signals?.tearOff?.status;
      if (status === "included") return "1.05";
      if (status === "excluded") return "0.97";
      return "1.00";
    }
    function getMissingManualFields(parsed) {
      const missing = [];
      const hasPrice = isFinite(Number(parsed?.price)) && Number(parsed.price) > 0;
      const hasRoofSize = isFinite(Number(parsed?.roofSize)) && Number(parsed.roofSize) > 0;
      const materialValue = String(parsed?.material || "").trim().toLowerCase();
      const materialLabel = String(parsed?.materialLabel || "").trim().toLowerCase();
      const hasMaterial =
        !!materialValue ||
        (!!materialLabel && materialLabel !== "unknown" && materialLabel !== "not detected");
      const hasCity = !!String(parsed?.city || "").trim();
      const hasState = !!String(parsed?.stateCode || "").trim();
      if (!hasPrice) missing.push("quotePrice");
      if (!hasRoofSize) missing.push("roofSize");
      if (!hasMaterial) missing.push("materialType");
      if (!hasCity) missing.push("cityName");
      if (!hasState) missing.push("stateCode");
      return missing;
    }
    function clearManualFieldHighlights() {
      ["quotePrice", "roofSize", "materialType", "cityName", "stateCode"].forEach(id => {
        const el = byId(id);
        if (!el) return;
        el.style.borderColor = "";
        el.style.background = "";
        el.style.boxShadow = "";
        el.style.transition = "";
        el.style.outline = "";
        el.style.outlineOffset = "";
        const label = document.querySelector(`label[for="${id}"]`);
        if (label) {
          label.style.color = "";
          label.style.fontWeight = "";
        }
      });
      const roofCue = byId("roofSizePriorityCue");
      if (roofCue) roofCue.textContent = "";
      const manualFieldJumpStatus = byId("manualFieldJumpStatus");
      if (manualFieldJumpStatus) manualFieldJumpStatus.innerHTML = "";
    }
    function highlightManualFields(fieldIds = [], options = {}) {
      const ordered = Array.isArray(fieldIds) ? fieldIds : [];
      const isJump = !!options.isJump;
      const primaryId = options.primaryId || ordered[0] || null;
      ordered.forEach(id => {
        const el = byId(id);
        if (!el) return;
        const isPrimary = id === primaryId;
        const label = document.querySelector(`label[for="${id}"]`);
        el.style.borderColor = isPrimary ? "#ea580c" : "#f59e0b";
        el.style.background = isPrimary ? "#fff7ed" : "#fffdf5";
        el.style.outline = isPrimary ? "3px solid rgba(234, 88, 12, 0.22)" : "none";
        el.style.outlineOffset = "1px";
        el.style.boxShadow = isPrimary
          ? "0 0 0 2px rgba(234, 88, 12, 0.16)"
          : "0 0 0 1px rgba(245, 158, 11, 0.14)";
        el.style.transition =
          "box-shadow 0.2s ease, background 0.2s ease, border-color 0.2s ease, outline 0.2s ease";
        if (label) {
          label.style.color = isPrimary ? "#c2410c" : "";
          label.style.fontWeight = isPrimary ? "800" : "";
        }
      });
  if (!options.isJump && primaryId) {
    const primaryEl = byId(primaryId);
    if (primaryEl) {
      setTimeout(() => {
        primaryEl.focus();
        if (
          typeof primaryEl.select === "function" &&
          (primaryEl.tagName === "INPUT" || primaryEl.tagName === "TEXTAREA")
        ) {
          primaryEl.select();
        }
      }, 150);
    }
  }
      if (isJump && primaryId) {
        setTimeout(() => {
          const primary = byId(primaryId);
          if (primary) {
            primary.style.outline = "2px solid rgba(234, 88, 12, 0.16)";
          }
        }, 900);
      }
    }
    function buildPartialExtractionNotice(parsed) {
      const missing = [];
      const hasPrice = isFinite(Number(parsed?.price)) && Number(parsed.price) > 0;
      const hasRoofSize = isFinite(Number(parsed?.roofSize)) && Number(parsed.roofSize) > 0;
      const materialValue = String(parsed?.material || "").trim().toLowerCase();
      const materialLabel = String(parsed?.materialLabel || "").trim().toLowerCase();
      const hasMaterial =
        !!materialValue ||
        (!!materialLabel && materialLabel !== "unknown" && materialLabel !== "not detected");
      const hasLocation =
        !!String(parsed?.city || "").trim() || !!String(parsed?.stateCode || "").trim();
      if (!hasPrice) return "";
      if (!hasRoofSize) missing.push("roof size");
      if (!hasMaterial) missing.push("material");
      if (!hasLocation) missing.push("location");
      if (!missing.length) return "";
      return `
        <div class="panel" style="margin:0 0 14px; background:#fff7ed; border-color:#fdba74;">
          <h4 style="margin:0 0 8px;">Partial quote read</h4>
          <p style="margin:0 0 8px;">
            We found the quoted price, but some other details were hard to read from the uploaded file.
          </p>
          <p class="small muted" style="margin:0;">
            Add ${missing.join(", ")} below to finish a more accurate price check.
          </p>
        </div>
      `;
    }
    function buildManualEntryPromptHtml(parsed) {
      const price = parsed?.finalBestPrice || parsed?.price || null;
      const missingFieldIds = getMissingManualFields(parsed);
      const primaryId = missingFieldIds.includes("roofSize")
        ? "roofSize"
        : (missingFieldIds[0] || null);
      const primaryLabel =
        primaryId === "roofSize" ? "roof size" :
        primaryId === "materialType" ? "material" :
        primaryId === "cityName" ? "city" :
        primaryId === "stateCode" ? "state" :
        primaryId === "quotePrice" ? "quote price" :
        "first highlighted field";
      const priceText = price
    ? `We found a quoted price of <strong>${safeFormatCurrency(price)}</strong>, but we still need a few details to finish the analysis.`
    : `We could not clearly detect the quote total yet.`;
      return `
        <div class="panel" style="margin-bottom:12px; background:#fff7ed; border-color:#fdba74;">
          <h3 style="margin-top:0;">Complete the missing quote details</h3>
          <p>${priceText}</p>
          <p class="small" style="margin-bottom:0;">
            Start with <strong>${primaryLabel}</strong>, then complete the remaining highlighted fields and click <strong>Analyze Quote</strong> again.
          </p>
        </div>
      `;
    }
    function jumpToMissingManualFields(parsed) {
      const missingFieldIds = getMissingManualFields(parsed);
      const prioritizedFirstId = missingFieldIds.includes("roofSize")
        ? "roofSize"
        : (missingFieldIds[0] || null);
      const first = prioritizedFirstId ? byId(prioritizedFirstId) : null;
      const manualEntryDetails = byId("manualEntryDetails");
      const manualFieldJumpStatus = byId("manualFieldJumpStatus");
      const roofCue = byId("roofSizePriorityCue");
      if (roofCue) {
        roofCue.textContent = prioritizedFirstId === "roofSize" ? "← start here" : "";
      }
      if (manualEntryDetails) {
        manualEntryDetails.open = true;
      }
      clearManualFieldHighlights();
      highlightManualFields(missingFieldIds, {
        isJump: true,
        primaryId: prioritizedFirstId
      });
      if (manualFieldJumpStatus) {
        const primaryLabel =
          prioritizedFirstId === "roofSize" ? "roof size" :
          prioritizedFirstId === "materialType" ? "material" :
          prioritizedFirstId === "cityName" ? "city" :
          prioritizedFirstId === "stateCode" ? "state" :
          prioritizedFirstId === "quotePrice" ? "quote price" :
          "first highlighted field";
        manualFieldJumpStatus.innerHTML = `
          <div class="panel" style="margin:0 0 12px; background:#fff7ed; border-color:#fdba74;">
            <p style="margin:0;">
              <strong>Next step:</strong> enter your <strong>${primaryLabel}</strong> first, then complete the remaining highlighted fields.
            </p>
          </div>
        `;
      }
      const target = first || byId("quotePrice") || byId("materialType");
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => {
          target.focus();
          if (
            typeof target.select === "function" &&
            (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
          ) {
            target.select();
          }
        }, 250);
      }
    }
    function calculateScopeRisk(missingItems = []) {
      const count = Array.isArray(missingItems) ? missingItems.length : 0;
      if (count === 0) {
        return {
          level: "Low",
          color: "#15803d",
          description: "No likely missing items were flagged based on the available quote details."
        };
      }
      if (count <= 2) {
        return {
          level: "Medium",
          color: "#b45309",
          description: "This quote does not mention some common roofing components that sometimes show up later as change orders."
        };
      }
      return {
        level: "High",
        color: "#b91c1c",
        description: "This quote is missing several common roofing components. Review the scope carefully before relying on the price."
      };
    }
    function buildRecommendation(analysis) {
  if (!analysis) {
    return {
      action: "REVIEW",
      reasoning: "Review the quote details before making a decision.",
      strength: "medium"
    };
  }
  const rawVerdict = String(analysis.rawVerdict || analysis.verdict || "").toLowerCase();
  const reliabilityTier = String(analysis.reliabilityTier || "").toUpperCase();
  const roofSizeSeverity = String(analysis?.roofSizeConsistency?.severity || "none").toLowerCase();
  const propertyMeta = analysis?.propertySignalsMeta || {};
  const riskFlags = Array.isArray(analysis?.riskFlags)
    ? analysis.riskFlags
    : buildRiskFlags(analysis);
  const decisionDelta = analysis?.decisionDelta || null;
  const hasHighRisk = riskFlags.some(
    flag => String(flag?.severity || "").toLowerCase() === "high"
  );
  const hasMediumRisk = riskFlags.some(
    flag => String(flag?.severity || "").toLowerCase() === "medium"
  );
  const hasAmbiguousProperty = !!propertyMeta?.ambiguous;
  const hasLowReliability = reliabilityTier === "LOW_CONFIDENCE";
  const hasEstimatedReliability = reliabilityTier === "ESTIMATED";
  const roofSizeSource = String(analysis?.roofSizeEstimateSource || "").toLowerCase();
  const fallbackUsed = !!analysis?.roofSizeEstimateMeta?.fallbackUsed;
  const isUnavailable = roofSizeSource === "unavailable";
  if (
    roofSizeSeverity === "high" ||
    hasAmbiguousProperty ||
    hasLowReliability ||
    fallbackUsed ||
    isUnavailable
  ) {
    return {
      action: "REVIEW",
      reasoning: "Key pricing inputs are uncertain. Verify roof size and scope before acting on this result.",
      strength: "high"
    };
  }
  if (rawVerdict.includes("overpriced")) {
    return {
      action: "NEGOTIATE",
      reasoning: "This quote appears materially above expected pricing. Ask for a line-by-line explanation and compare another quote.",
      strength: "high"
    };
  }
  if (rawVerdict.includes("higher than expected")) {
    return {
      action: "NEGOTIATE",
      reasoning: "This quote appears above expected pricing. Compare another quote before accepting the premium.",
      strength: hasHighRisk ? "high" : "medium"
    };
  }
  if (rawVerdict.includes("possible scope risk") || rawVerdict.includes("unusually low")) {
    return {
      action: "REVIEW",
      reasoning: "This quote is low enough that missing scope or later change orders are possible. Confirm inclusions before moving forward.",
      strength: "high"
    };
  }
  if (rawVerdict.includes("fair")) {
    return {
      action: "PROCEED",
      reasoning: hasMediumRisk || hasEstimatedReliability
        ? "Pricing looks reasonable, but review flagged items before signing."
        : "Pricing looks reasonable relative to expected market range.",
      strength: hasMediumRisk ? "medium" : "high"
    };
  }
  return {
    action: "REVIEW",
    reasoning: "Review the quote details and compare another quote before making a final decision.",
    strength: "medium"
  };
}
    function buildRecommendationHtml(analysis) {
      const recommendation = analysis?.recommendation || buildRecommendation(analysis);
      if (!recommendation) return "";
      const action = String(recommendation.action || "REVIEW").toUpperCase();
      const reasoningText = getRecommendationReasoningText(analysis);
      const riskFlags = Array.isArray(analysis?.riskFlags) ? analysis.riskFlags : [];
      const topFlags = riskFlags
        .filter(flag => String(flag?.key || "").toLowerCase() !== "no_major_risks")
        .slice(0, 2);
      const decisionDelta = analysis?.decisionDelta || null;
      const deltaText = decisionDelta ? softenClaim(buildDecisionDeltaText(decisionDelta), analysis) : "";
      const accent =
        action === "PROCEED"
          ? { bg: "#f0fdf4", border: "#86efac", text: "#166534" }
          : action === "NEGOTIATE"
            ? { bg: "#fff7ed", border: "#fdba74", text: "#9a3412" }
            : action === "AVOID"
              ? { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b" }
              : { bg: "#eff6ff", border: "#93c5fd", text: "#1d4ed8" };
      const bullets = [];
      if (deltaText) {
        bullets.push(deltaText);
      }
      if (reasoningText) {
        bullets.push(reasoningText);
      }
      topFlags.forEach(flag => {
        if (flag?.impact) bullets.push(flag.impact);
      });
      const uniqueBullets = [];
      const seen = new Set();
      bullets.forEach(item => {
        const clean = String(item || "").trim();
        const key = clean.toLowerCase();
        if (!clean || seen.has(key)) return;
        seen.add(key);
        uniqueBullets.push(clean);
      });
      return `
        <div class="panel" style="margin:0 0 14px; padding:14px 16px; background:${accent.bg}; border-color:${accent.border};">
          <p style="margin:0 0 8px; font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:${accent.text};">
            Why this decision
          </p>
          <ul class="mini-list" style="margin:0; color:#111827;">
            ${uniqueBullets.slice(0, 3).map(item => `<li>${item}</li>`).join("")}
          </ul>
        </div>
      `;
    }
      function buildDecisionLockHtml(a) {
        if (!a || !a.recommendation) return "";
        const action = String(a.recommendation.action || "").toUpperCase();
        const confidence = Number(
          a.confidenceScore ??
          a.roofSizeEstimateConfidenceScore ??
          0
        );
        let color = "#1d4ed8";
        let bg = "#eff6ff";
        let border = "#93c5fd";
        if (action === "PROCEED") {
          color = "#166534";
          bg = "#f0fdf4";
          border = "#86efac";
        }
        if (action === "NEGOTIATE") {
          color = "#9a3412";
          bg = "#fff7ed";
          border = "#fdba74";
        }
        if (action === "REVIEW") {
          color = "#1e40af";
          bg = "#eff6ff";
          border = "#93c5fd";
        }
        if (action === "AVOID") {
          color = "#991b1b";
          bg = "#fef2f2";
          border = "#fca5a5";
        }
        const confidenceLabel =
          confidence >= 80 ? "HIGH CONFIDENCE" :
          confidence >= 60 ? "MODERATE CONFIDENCE" :
          "LOW CONFIDENCE";
        const actionTextMap = {
          PROCEED: "Proceed",
          NEGOTIATE: "Do not accept this price",
          REVIEW: "Do not decide yet",
          AVOID: "Walk away"
        };
        const subTextMap = {
          PROCEED: "The price is defensible. Final check the scope, then move.",
          NEGOTIATE: "The quote is above market or poorly positioned. Push back before moving.",
          REVIEW: "The result is not decision ready yet. Resolve the flagged issues first.",
          AVOID: "The quote is too risky or too weak to advance as is."
        };
        const actionText = actionTextMap[action] || "Do not decide yet";
        const subText = subTextMap[action] || "Review the quote before making a decision.";
        return `
          <div class="panel" style="
            margin:0 0 16px;
            padding:16px;
            border:2px solid ${border};
            background:${bg};
          ">
            <div style="font-size:12px; font-weight:700; letter-spacing:.04em; color:${color}; margin-bottom:6px;">
              SYSTEM DECISION
            </div>
            <div style="font-size:24px; line-height:1.1; font-weight:800; color:${color}; margin-bottom:6px;">
              ${actionText}
            </div>
            <div style="font-size:13px; color:#374151; margin-bottom:8px;">
              ${confidenceLabel} • Score: ${Math.round(confidence)}/100
            </div>
            <div style="font-size:14px; color:#111827;">
              ${subText}
            </div>
          </div>
        `;
      }
      function buildContractorQuestions(analysis) {
        if (!analysis) return [];
        const questions = [];
        const seen = new Set();
        function addQuestion(text) {
          const clean = String(text || "").trim();
          const key = clean.toLowerCase();
          if (!clean || seen.has(key)) return;
          seen.add(key);
          questions.push(clean);
        }
        const recommendationAction = String(
          analysis?.recommendation?.action || ""
        ).toUpperCase();
        const riskFlags = Array.isArray(analysis?.riskFlags) ? analysis.riskFlags : [];
        const decisionDelta = analysis?.decisionDelta || null;
        const roofSizeConsistency = analysis?.roofSizeConsistency || null;
        const propertyMeta = analysis?.propertySignalsMeta || {};
        const reliabilityTier = String(analysis?.reliabilityTier || "").toUpperCase();
        const rawVerdict = String(analysis?.rawVerdict || analysis?.verdict || "").toLowerCase();
        if (decisionDelta?.position === "above_range" && decisionDelta?.absDelta) {
          addQuestion(
            `Can you explain why this quote is about ${safeFormatCurrency(decisionDelta.absDelta)} above the modeled midpoint?`
          );
        }
        if (decisionDelta?.position === "below_range" && decisionDelta?.absDelta) {
          addQuestion(
            `This quote appears about ${safeFormatCurrency(decisionDelta.absDelta)} below expected pricing. Can you confirm what is included so I can compare it fairly?`
          );
        }
        riskFlags.forEach(flag => {
          const key = String(flag?.key || "").toLowerCase();
          if (key === "potential_overpricing") {
            addQuestion("Can you provide a line by line breakdown showing what is driving the higher price?");
            addQuestion("Are there any premium materials, upgrades, or extra scope items in this quote that explain the price difference?");
          }
          if (key === "roof_size_conflict" || key === "roof_size_variance") {
            addQuestion("What roof size are you using for this quote, and how was it measured?");
            addQuestion("Can you show the measurement report or diagram used to calculate the roof size?");
          }
          if (key === "ambiguous_property_match" || key === "low_quality_property_match") {
            addQuestion("Can you confirm the final quoted roof size in squares or square feet so I can compare quotes using the same measurement?");
          }
          if (key === "missing_flashing") {
            addQuestion("Can you confirm whether flashing replacement is included, and where it appears in the estimate?");
          }
          if (
            key === "missing_water_barrier" ||
            key === "missing_underlayment"
          ) {
            addQuestion("What underlayment or water barrier is included, and how much of the roof does it cover?");
          }
          if (key === "missing_ventilation") {
            addQuestion("Can you confirm whether ventilation or ridge vent work is included in this quote?");
          }
          if (key === "low_bid_scope_risk" || key === "suspiciously_low_price") {
            addQuestion("Is anything excluded that could later become a change order or add-on cost?");
            addQuestion("Does this quote include tear off, disposal, underlayment, flashing, ventilation, and permit related work?");
          }
        });
        if (String(roofSizeConsistency?.severity || "").toLowerCase() === "high") {
          addQuestion("Before I compare this quote to others, can you confirm the exact roof size you are pricing?");
        }
        if (propertyMeta?.ambiguous) {
          addQuestion("I found mixed property signals. Can you confirm the exact structure and roof area this quote is based on?");
        }
        if (recommendationAction === "NEGOTIATE") {
          addQuestion("Is there any flexibility in the price if scope and materials stay the same?");
        }
        if (recommendationAction === "REVIEW") {
          addQuestion("Can you update the estimate so all major scope items are clearly shown in writing?");
        }
        if (reliabilityTier === "LOW_CONFIDENCE" || reliabilityTier === "ESTIMATED") {
          addQuestion("Can you confirm the main pricing assumptions in writing so I can validate the comparison?");
        }
        if (
          rawVerdict.includes("fair") &&
          questions.length < 3
        ) {
          addQuestion("Can you confirm the main included scope items and warranty terms in writing?");
          addQuestion("Are there any conditions that could cause the final price to increase after work begins?");
        }
        return questions.slice(0, 6);
      }
  function buildContractorQuestionsText(analysis) {
    const questions = buildContractorQuestions(analysis);
    if (!questions.length) return "";
    return questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
  }
  function buildContractorQuestionsHtml(analysis) {
    const questions = buildContractorQuestions(analysis);
    if (!questions.length) return "";
    return `
      <div class="panel" style="margin:0 0 14px; padding:14px 16px; background:#eff6ff; border-color:#93c5fd;">
        <p style="margin:0 0 6px; font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:#1d4ed8;">
          Contractor questions
        </p>
        <h4 style="margin:0 0 10px;">Questions to send before you decide</h4>
        <p class="small muted" style="margin:0 0 10px;">
          These are based on the pricing result, flagged risks, and quote confidence.
        </p>
        <ul class="mini-list" style="margin:0 0 12px;">
          ${questions.map(q => `<li>${q}</li>`).join("")}
        </ul>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button type="button" class="btn secondary" id="copyContractorQuestionsBtn">
            Copy questions
          </button>
        </div>
        <div id="contractorQuestionsCopyStatus"></div>
      </div>
    `;
  }
  function getConfidenceLanguageMode(analysis) {
    const reliabilityTier = String(analysis?.reliabilityTier || "").toUpperCase();
    const severity = String(analysis?.roofSizeConsistency?.severity || "low").toLowerCase();
    const needsReview = !!analysis?.roofSizeNeedsReview;
    if (severity === "high" || needsReview || reliabilityTier === "LOW_CONFIDENCE") {
      return "cautious";
    }
    if (severity === "medium" || reliabilityTier === "ESTIMATED") {
      return "measured";
    }
    return "direct";
}
function softenClaim(text, analysis) {
  const value = String(text || "").trim();
  if (!value) return value;
  const mode = getConfidenceLanguageMode(analysis);
  if (mode === "direct") return value;
  if (mode === "measured") {
    return value
      .replace(/^This quote is /, "This quote appears to be ")
      .replace(/^This quote appears /, "This quote appears ")
      .replace(/^You may be overpaying by /, "Model suggests you may be overpaying by ")
      .replace(/^You may be /, "You may be ")
      .replace(/^Pricing looks reasonable/, "Pricing appears reasonable");
  }
  return value
    .replace(/^This quote is /, "This result may indicate this quote is ")
    .replace(/^This quote appears to be /, "This result may indicate this quote is ")
    .replace(/^This quote appears /, "This result may indicate this quote appears ")
    .replace(/^You may be overpaying by /, "The model suggests you may be overpaying by ")
    .replace(/^This quote is /, "This result may indicate this quote is ")
    .replace(/^Pricing looks reasonable/, "Pricing may be reasonable");
}
function getRecommendationReasoningText(analysis) {
  const recommendation =
    analysis?.recommendation || buildRecommendation(analysis);
  return softenClaim(recommendation?.reasoning || "", analysis);
}
  async function copyContractorQuestions() {
    const analysis = latestAnalysis;
    if (!analysis) {
      setUploadStatus("Run the quote analysis before copying contractor questions.", "warn");
      return;
    }
    const text = buildContractorQuestionsText(analysis);
    if (!text) {
      setUploadStatus("No contractor questions were available for this quote.", "warn");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      const status = byId("contractorQuestionsCopyStatus");
      if (status) {
        status.innerHTML = `
          <div class="panel" style="margin-top:12px; background:#f0fdf4; border-color:#86efac;">
            <p style="margin:0;">
              <strong>Copied.</strong> Contractor questions copied to clipboard.
            </p>
          </div>
        `;
      }
      track("contractor_questions_copied", {
        verdict: analysis?.verdict || "",
        rawVerdict: analysis?.rawVerdict || "",
        recommendation: analysis?.recommendation?.action || ""
      });
      setUploadStatus("Contractor questions copied to clipboard.", "success");
    } catch (err) {
      console.error(err);
      track("contractor_questions_copy_failed", {
        verdict: analysis?.verdict || "",
        rawVerdict: analysis?.rawVerdict || "",
        recommendation: analysis?.recommendation?.action || ""
      });
      setUploadStatus("Could not copy contractor questions.", "error");
    }
  }
    function bindContractorQuestionsActions() {
      const btn = byId("copyContractorQuestionsBtn");
      if (!btn || btn.dataset.bound === "true") return;
      btn.addEventListener("click", function () {
        copyContractorQuestions();
      });
      btn.dataset.bound = "true";
    }
      function getSignalComparisonSelectionLabel(source) {
        const normalized = String(source || "").toLowerCase();
        if (normalized === "user_input") return "Entered by you";
        if (normalized === "parsed_quote") return "Quote";
        if (normalized === "address_estimated") return "Property";
        if (normalized === "price_based_estimate") return "Price model";
        return "Not available";
      }
    function buildSignalComparisonReasoning(analysis) {
      const selected =
        analysis?.signalComparison?.selected ||
        analysis?.roofSizeEstimateSource ||
        "";
      const source = String(selected).toLowerCase();
      const propertyMeta = analysis?.propertySignalsMeta || {};
      const disagreement = analysis?.roofSizeEstimateMeta?.disagreement || null;
      if (source === "user_input") {
        return "Using the roof size you entered directly.";
      }
      if (source === "parsed_quote") {
        if (disagreement?.hasDisagreement) {
          return "Quote roof size was used, but other signals did not fully agree.";
        }
        return "Quote roof size was clearly detected and used.";
      }
      if (source === "manual_calculator") {
        return "DIY calculator estimate was used based on home dimensions, pitch, and waste assumptions.";
      }
      if (source === "address_estimated") {
        const quality = String(propertyMeta?.buildingMatchQuality || "unknown").toLowerCase();
        if (propertyMeta?.ambiguous) {
          return "Property data was used, but the building match was ambiguous and should be reviewed.";
        }
        if (quality === "high") {
          return "Property data aligns best with the address and available match signals.";
        }
        if (quality === "approximate" || quality === "medium") {
          return "Property data was used as the best available fit, but precision may be limited.";
        }
        if (quality === "low") {
          return "Property data provided an estimate, but the building match quality was weak.";
        }
        return "Property data provided the best available roof size estimate.";
      }
      if (source === "price_based_estimate") {
        return "Roof size was estimated from quote price and local pricing benchmarks.";
      }
      return "No strong signal explanation was available.";
}
    function buildSignalComparisonHtml(analysis) {
      if (!analysis) return "";
      const signals = analysis?.roofSizeSignals || {};
      const parsed = Number(signals?.parsed || 0);
      const property = Number(signals?.property || 0);
      const priceImplied = Number(signals?.priceImplied || 0);
      const hasAny =
        (isFinite(parsed) && parsed > 0) ||
        (isFinite(property) && property > 0) ||
        (isFinite(priceImplied) && priceImplied > 0);
      if (!hasAny) return "";
      const selectedLabel = getSignalComparisonSelectionLabel(analysis?.roofSizeEstimateSource);
      const reasoning = buildSignalComparisonReasoning(analysis);
      return `
    <div class="panel" style="margin:0 0 14px; padding:14px 16px; background:#f8fafc; border-color:#e5e7eb;">
      <h4 style="margin:0 0 10px;">Roof size signal comparison</h4>
      <div class="analysis-grid" style="margin-top:0;">
        <div><strong>Quote</strong></div>
        <div>${isFinite(parsed) && parsed > 0 ? `${safeFormatNumber(parsed)} sq ft` : "Not available"}</div>
        <div><strong>Property</strong></div>
        <div>${isFinite(property) && property > 0 ? `${safeFormatNumber(property)} sq ft` : "Not available"}</div>
        <div><strong>Price model</strong></div>
        <div>${isFinite(priceImplied) && priceImplied > 0 ? `${safeFormatNumber(priceImplied)} sq ft` : "Not available"}</div>
        <div><strong>Selected signal</strong></div>
        <div>${selectedLabel}</div>
      </div>
      <p class="small muted" style="margin:10px 0 0;">
        <strong>Why this signal won:</strong> ${reasoning}
      </p>
    </div>
  `;
}
    function getRiskFlagAccent(severity) {
      const normalized = String(severity || "").toLowerCase();
      if (normalized === "high") {
        return {
          bg: "#fef2f2",
          border: "#fca5a5",
          text: "#991b1b",
          icon: "⚠"
        };
      }
      if (normalized === "medium") {
        return {
          bg: "#fff7ed",
          border: "#fdba74",
          text: "#9a3412",
          icon: "⚠"
        };
      }
      return {
        bg: "#f8fafc",
        border: "#cbd5e1",
        text: "#334155",
        icon: "•"
      };
    }
    function buildRiskFlagsHtml(analysis) {
      const flags = Array.isArray(analysis?.riskFlags)
        ? analysis.riskFlags
        : buildRiskFlags(analysis);
      if (!flags.length) return "";
      return `
        <div style="display:grid; gap:10px; margin:0 0 14px;">
          ${flags.slice(0, 2).map(flag => {
            const accent = getRiskFlagAccent(flag?.severity);
            return `
              <div class="panel" style="margin:0; background:${accent.bg}; border-color:${accent.border};">
                <p style="margin:0 0 6px; font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:${accent.text};">
                  ${accent.icon} ${flag.title}
                </p>
                <p class="small" style="margin:0 0 6px; color:${accent.text};">
                  ${flag.impact || ""}
                </p>
                ${
                  flag.action
                    ? `<p class="small muted" style="margin:0;"><strong>Next move:</strong> ${flag.action}</p>`
                    : ""
                }
              </div>
            `;
          }).join("")}
        </div>
      `;
    }
    function buildConflictSignals(analysis) {
      const quotePrice = Number(analysis?.quotePrice);
      const low = Number(analysis?.low);
      const high = Number(analysis?.high);
      const roofSize = Number(analysis?.roofSize);
      const confidenceScore = Number(
        analysis?.confidenceScore ??
        analysis?.roofSizeEstimateConfidenceScore ??
        0
      );
      const items = [];
      if (
        isFinite(quotePrice) &&
        isFinite(low) &&
        isFinite(high) &&
        high > 0 &&
        quotePrice < low
      ) {
        items.push({
          key: "price_vs_expected",
          title: "Price and modeled cost disagree",
          detail: "Quote total is materially below the expected range for this project."
        });
      }
      if (!isFinite(roofSize) || roofSize <= 0) {
        items.push({
          key: "roof_size_uncertain",
          title: "Roof size confidence is limited",
          detail: "Roof size could not be strongly validated, which reduces confidence in the pricing model."
        });
      }
      if (confidenceScore > 0 && confidenceScore < 75) {
        items.push({
          key: "low_confidence_inputs",
          title: "Some inputs are reducing confidence",
          detail: "The result uses weaker or incomplete signals, so the final recommendation should be reviewed carefully."
        });
      }
      let severity = "none";
      if (items.length >= 3) severity = "high";
      else if (items.length >= 1) severity = "medium";
      return {
        hasConflict: items.length > 0,
        severity,
        summary:
          items.length > 0
            ? "Some pricing or roof size signals are not fully aligned."
            : "",
        details: items
      };
    }
    function buildRiskFlags(analysis) {
      const flags = [];
      if (!analysis) return flags;
      const rawVerdict = String(analysis.rawVerdict || "").toLowerCase();
      const verdict = String(analysis.verdict || "").toLowerCase();
      const roofSizeSeverity = String(
        analysis?.roofSizeConsistency?.severity || "none"
      ).toLowerCase();
      const propertyMeta = analysis?.propertySignalsMeta || {};
      const missingSignals = Array.isArray(analysis?.missingSignals)
        ? analysis.missingSignals
        : Array.isArray(latestParsed?.missingSignals)
          ? latestParsed.missingSignals
          : [];
      if (
        rawVerdict.includes("overpriced") ||
        rawVerdict.includes("higher than expected")
      ) {
        flags.push({
          key: "potential_overpricing",
          title: "Potential overpricing",
          severity: rawVerdict.includes("overpriced") ? "high" : "medium",
          impact: "You may be paying above normal market pricing",
          action: "Request a breakdown and compare at least one additional quote"
        });
      }
      if (
        rawVerdict.includes("possible scope risk") ||
        rawVerdict.includes("unusually low")
      ) {
        flags.push({
          key: "low_bid_scope_risk",
          title: "Low bid scope risk",
          severity: "high",
          impact: "This quote is far below expected pricing and may be missing scope or lead to change orders later.",
          action: "Confirm inclusions, exclusions, and change order exposure before trusting the price",
          highlight: true
        });
      }
      if (roofSizeSeverity === "high") {
        flags.push({
          key: "roof_size_conflict",
          title: "Roof size conflict",
          severity: "high",
          impact: "Different data sources disagree on roof size, which affects pricing accuracy",
          action: "Verify roof size before making a decision"
        });
      } else if (roofSizeSeverity === "medium") {
        flags.push({
          key: "roof_size_variance",
          title: "Roof size variance",
          severity: "medium",
          impact: "Some inconsistency detected in roof size signals",
          action: "Double check measurements in the quote"
        });
      }
      if (propertyMeta?.ambiguous) {
        flags.push({
          key: "ambiguous_property_match",
          title: "Ambiguous property match",
          severity: "medium",
          impact: "Property data may be tied to multiple possible structures",
          action: "Confirm roof size manually or review satellite measurement"
        });
      }
      if (propertyMeta?.buildingMatchQuality === "low") {
        flags.push({
          key: "low_quality_property_match",
          title: "Low quality property match",
          severity: "medium",
          impact: "Property-based estimate may not accurately reflect your home",
          action: "Do not rely solely on automated roof size estimates"
        });
      }
      if (missingSignals.includes("flashing")) {
        flags.push({
          key: "missing_flashing",
          title: "Missing flashing",
          severity: "high",
          impact: "Missing flashing can lead to leaks and structural damage",
          action: "Ask contractor to confirm flashing is included"
        });
      }
      if (missingSignals.includes("ventilation")) {
        flags.push({
          key: "missing_ventilation",
          title: "Missing ventilation",
          severity: "medium",
          impact: "Poor ventilation reduces roof lifespan and efficiency",
          action: "Confirm ridge vents or other ventilation systems are included"
        });
      }
      if (missingSignals.includes("underlayment")) {
        flags.push({
          key: "missing_underlayment",
          title: "Missing underlayment details",
          severity: "medium",
          impact: "Underlayment is critical for waterproofing",
          action: "Ask what type and coverage of underlayment is included"
        });
      }
      const normalizedRawVerdict = String(rawVerdict || "").toLowerCase();
      const hasVerdictConcern =
        normalizedRawVerdict.includes("possible scope risk") ||
        normalizedRawVerdict.includes("unusually low") ||
        normalizedRawVerdict.includes("overpriced") ||
        normalizedRawVerdict.includes("higher than expected");
      if (flags.length === 0 && !hasVerdictConcern) {
        flags.push({
          key: "no_major_risks",
          title: "No major risks detected",
          severity: "low",
          impact: "Quote appears generally consistent with expected pricing and scope",
          action: "You can proceed, but comparing one additional quote is still recommended"
        });
      }
      return flags;
    }
    function buildScopeRiskHtml(missingItems = []) {
      const scopeRisk = calculateScopeRisk(missingItems);
      return `
        <div class="signal-summary-wrap" style="margin-top:14px;">
          <h5 style="margin:0 0 8px;">Scope Risk</h5>
          <div style="font-weight:700; color:${scopeRisk.color}; margin-bottom:6px;">
            ${scopeRisk.level} Risk
          </div>
          <p class="small" style="margin:0 0 8px;">
            ${scopeRisk.description}
          </p>
          ${
            missingItems.length
              ? `
                <ul class="mini-list signal-summary-warn" style="margin-top:8px;">
                  ${missingItems.map(item => `<li>${item}</li>`).join("")}
                </ul>
              `
              : `
                <p class="small muted" style="margin:0;">No likely missing items were flagged.</p>
              `
          }
        </div>
      `;
    }
    function normalizeScopeLabel(label) {
      const value = String(label || "").trim().toLowerCase();
      const map = {
        "tear off": "Tear off",
        "tear-off": "Tear off",
        flashing: "Flashing",
        "drip edge": "Drip edge",
        underlayment: "Underlayment",
        "ice and water shield": "Ice and water shield",
        "ice & water shield": "Ice and water shield",
        "ice shield": "Ice and water shield",
        ventilation: "Ventilation",
        "ridge vent": "Ridge vent",
        "starter strip": "Starter strip",
        "ridge cap": "Ridge cap",
        decking: "Decking",
        "premium shingles": "Premium shingles",
        "synthetic underlayment": "Synthetic underlayment",
        "flashing upgrades": "Flashing upgrades",
        "ridge vent system": "Ridge vent system"
      };
      return map[value] || label;
    }
    function dedupeScopeLabels(items = []) {
      const seen = new Set();
      const output = [];
      (Array.isArray(items) ? items : []).forEach(item => {
        const normalized = normalizeScopeLabel(item);
        const key = String(normalized || "").trim().toLowerCase();
        if (!key || seen.has(key)) return;
        seen.add(key);
        output.push(normalized);
      });
      return output;
    }
    function buildScopeCheckHtml({
      includedSignals = [],
      missingSignals = [],
      premiumSignals = []
    } = {}) {
      const normalizedIncluded = dedupeScopeLabels(includedSignals);
      const normalizedMissing = dedupeScopeLabels(missingSignals);
      const normalizedPremium = dedupeScopeLabels(premiumSignals);
      const curatedMissingOrder = [
        "Flashing",
        "Drip edge",
        "Underlayment",
        "Ice and water shield",
        "Ventilation",
        "Ridge vent",
        "Starter strip",
        "Ridge cap",
        "Decking",
        "Tear off"
      ];
      const curatedIncludedOrder = [
        "Tear off",
        "Flashing",
        "Drip edge",
        "Underlayment",
        "Ice and water shield",
        "Ventilation",
        "Ridge vent",
        "Starter strip",
        "Ridge cap",
        "Decking"
      ];
      function sortByOrder(items, order) {
        return [...items].sort((a, b) => {
          const aIndex = order.indexOf(a);
          const bIndex = order.indexOf(b);
          const safeA = aIndex === -1 ? 999 : aIndex;
          const safeB = bIndex === -1 ? 999 : bIndex;
          if (safeA !== safeB) return safeA - safeB;
          return a.localeCompare(b);
        });
      }
      const included = sortByOrder(normalizedIncluded, curatedIncludedOrder);
      const missing = sortByOrder(
        normalizedMissing.filter(item => curatedMissingOrder.includes(item)),
        curatedMissingOrder
      ).slice(0, 5);
      const premium = normalizedPremium.slice(0, 4);
      const includedHtml = included.length
        ? `
          <div class="signal-summary-block">
            <h5>Clearly mentioned in the quote</h5>
            <ul class="mini-list signal-summary-good">
              ${included.map(item => `<li>✓ ${item}</li>`).join("")}
            </ul>
          </div>
        `
        : `
          <div class="signal-summary-block">
            <h5>Clearly mentioned in the quote</h5>
            <p class="small muted" style="margin:0;">
              The quote did not clearly list many common roofing scope items.
            </p>
          </div>
        `;
      const missingHtml = missing.length
        ? `
          <div class="signal-summary-block">
            <h5>Often included but not clearly listed</h5>
            <ul class="mini-list signal-summary-warn">
              ${missing.map(item => `<li>⚠ ${item}</li>`).join("")}
            </ul>
          </div>
        `
        : "";
      const premiumHtml = premium.length
        ? `
          <div class="signal-summary-block">
            <h5>Higher quality or complexity signals</h5>
            <ul class="mini-list signal-summary-premium">
              ${premium.map(item => `<li>${item}</li>`).join("")}
            </ul>
          </div>
        `
        : "";
      return `
        <div class="signal-summary-wrap">
          <h4 style="margin:0 0 10px;">Scope Check</h4>
          <p class="small muted" style="margin:0 0 12px;">
            This section highlights scope items clearly listed in the quote and common items that may need clarification.
          </p>
          ${includedHtml}
          ${missingHtml}
          ${premiumHtml}
        </div>
      `;
    }
    function clampNumber(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }
    function calculateContractorPriceScore(quotePrice, mid) {
      const price = Number(quotePrice);
      const midpoint = Number(mid);
      if (!isFinite(price) || !isFinite(midpoint) || midpoint <= 0) {
        return {
          score: null,
          label: "Not available",
          color: "#6b7280",
          description: "A score could not be calculated from the current quote data."
        };
      }
      const pctDiff = ((price - midpoint) / midpoint) * 100;
      const absPctDiff = Math.abs(pctDiff);
      let score;
      if (pctDiff >= -8 && pctDiff <= 5) {
        score = 95 - absPctDiff * 1.5;
      } else if (pctDiff >= -15 && pctDiff < -8) {
        score = 82 - (Math.abs(pctDiff) - 8) * 2.0;
      } else if (pctDiff < -15) {
        score = 68 - (Math.abs(pctDiff) - 15) * 1.8;
      } else if (pctDiff > 5 && pctDiff <= 15) {
        score = 86 - (pctDiff - 5) * 2.0;
      } else if (pctDiff > 15 && pctDiff <= 30) {
        score = 66 - (pctDiff - 15) * 1.6;
      } else {
        score = 42 - (pctDiff - 30) * 1.2;
      }
      score = Math.round(clampNumber(score, 0, 100));
      if (pctDiff < -20) {
        return {
          score,
          label: "Very low bid",
          color: "#b45309",
          description: "This quote is far below the modeled midpoint. Low pricing can reflect missing scope, future change orders, or contractor risk."
        };
      }
      if (pctDiff < -10) {
        return {
          score,
          label: "Low bid",
          color: "#a16207",
          description: "This quote is materially below the modeled midpoint. Review scope details carefully before treating it as strong value."
        };
      }
      if (score >= 90) {
        return {
          score,
          label: "Strong pricing",
          color: "#15803d",
          description: "This quote appears well positioned relative to the modeled midpoint."
        };
      }
      if (score >= 75) {
        return {
          score,
          label: "Fair pricing",
          color: "#65a30d",
          description: "This quote appears reasonably aligned with expected market pricing."
        };
      }
          if (score >= 55) {
        return {
          score,
          label: "Higher than expected",
          color: "#b45309",
          description: "This quote is somewhat above the modeled midpoint."
        };
      }
      if (score >= 35) {
        return {
          score,
          label: "High pricing",
          color: "#dc2626",
          description: "This quote appears materially above the modeled midpoint."
        };
      }
      return {
        score,
        label: "Very high pricing",
        color: "#991b1b",
        description: "This quote appears far above the modeled midpoint."
      };
    }
    function getContractorPriceScoreContext(quotePrice, mid) {
      const result = calculateContractorPriceScore(quotePrice, mid);
      if (result.score === null) return "Score not available";
      return `${result.score} / 100 • ${result.label}`;
    }
    function buildTypicalPriceSummary({ city, stateCode, roofSize, low, high, mid }) {
      const hasRange = isFinite(Number(low)) && isFinite(Number(high));
      if (!hasRange) return "Typical local pricing was not available.";
      const locationLabel = [city, stateCode].filter(Boolean).join(", ") || "your area";
      const roofSizeLabel =
        isFinite(Number(roofSize)) && Number(roofSize) > 0
          ? `${safeFormatNumber(roofSize)} sq ft`
          : "similar-sized";
      const midpointText =
        isFinite(Number(mid)) && Number(mid) > 0
          ? `. Midpoint: ${safeFormatCurrency(mid)}`
          : "";
      return `${locationLabel}: ${safeFormatCurrency(low)} to ${safeFormatCurrency(high)}${midpointText}.`;
    }
    function buildMidpointDollarText(quotePrice, mid) {
      const price = Number(quotePrice);
      const midpoint = Number(mid);
      if (!isFinite(price) || !isFinite(midpoint) || midpoint <= 0) {
        return "Difference from midpoint not available";
      }
      const diff = price - midpoint;
      const absDiff = Math.abs(diff);
      if (absDiff < 50) {
        return "Within about $50 of modeled midpoint";
      }
      if (diff < 0) return `${safeFormatCurrency(absDiff)} below modeled midpoint`;
      return `${safeFormatCurrency(absDiff)} above modeled midpoint`;
    }
    function buildMarketPositionText(quotePrice, mid) {
      const price = Number(quotePrice);
      const midpoint = Number(mid);
      if (!isFinite(price) || !isFinite(midpoint) || midpoint <= 0) {
        return "Market position not available";
      }
      const pctDiff = ((price - midpoint) / midpoint) * 100;
      const absPctDiff = Math.abs(pctDiff).toFixed(1);
      if (Math.abs(pctDiff) < 2) {
        return "In line with modeled market midpoint";
      }
      if (pctDiff < 0) return `${absPctDiff}% below modeled market midpoint`;
      return `${absPctDiff}% above modeled market midpoint`;
    }
    function buildPriceGaugeHtml(price, low, mid, high) {
      const numericPrice = Number(price);
      const numericLow = Number(low);
      const numericMid = Number(mid);
      const numericHigh = Number(high);
      if (
        !isFinite(numericPrice) ||
        !isFinite(numericLow) ||
        !isFinite(numericHigh) ||
        numericHigh <= numericLow
      ) {
        return "";
      }
      const range = numericHigh - numericLow;
      let position = ((numericPrice - numericLow) / range) * 100;
      position = Math.max(0, Math.min(100, position));
      let positionLabel = "Within expected range";
      if (numericPrice < numericLow) positionLabel = "Below expected range";
      if (numericPrice > numericHigh) positionLabel = "Above expected range";
      return `
        <div class="panel" style="margin:0 0 12px; padding:12px 14px; background:#f8fafc; border-color:#e5e7eb;">
          <p style="margin:0 0 4px;"><strong>Where your quote falls</strong></p>
          <p class="small muted" style="margin:0 0 8px;">
            ${positionLabel}
          </p>
          <div class="price-gauge">
            <div class="price-gauge-bar">
              <div class="price-gauge-marker" style="left:${position}%"></div>
            </div>
            <div class="price-gauge-labels">
              <span>${safeFormatCurrency(numericLow)}</span>
              <span>${isFinite(numericMid) ? safeFormatCurrency(numericMid) : ""}</span>
              <span>${safeFormatCurrency(numericHigh)}</span>
            </div>
          </div>
      `;
    }
function buildDecisionDelta({ quotePrice, low, mid, high }) {
    const price = Number(quotePrice);
    const lowVal = Number(low);
    const midVal = Number(mid);
    const highVal = Number(high);
    if (![price, lowVal, midVal, highVal].every(isFinite) || highVal <= lowVal) {
      return null;
    }
    const delta = price - midVal;
    const absDelta = Math.abs(delta);
    let position = "within_range";
    if (price < lowVal) position = "below_range";
    if (price > highVal) position = "above_range";
    return {
      delta,
      absDelta,
      position,
      low: lowVal,
      mid: midVal,
      high: highVal
  };
}
function getDecisionDeltaStrength(absDelta) {
  const amount = Number(absDelta);
  if (!isFinite(amount)) return "weak";
  if (amount < 500) return "weak";
  if (amount < 2000) return "moderate";
  return "strong";
}
function buildDecisionDeltaText(decisionDelta) {
  if (!decisionDelta) return "";
  const absDelta = Number(decisionDelta.absDelta) || 0;
  if (absDelta < 100) {
    return "This quote is in line with expected pricing";
  }
  const amt = safeFormatCurrency(absDelta);
  if (decisionDelta.position === "above_range") {
    return `You may be overpaying by ~${amt}`;
  }
  if (decisionDelta.position === "below_range") {
    return `This quote is ~${amt} below expected pricing`;
  }
  return `This quote is within ~${amt} of expected pricing`;
}
function buildDecisionDeltaHtml(analysis) {
  const decisionDelta = buildDecisionDelta(analysis);
  if (!decisionDelta) return "";
  const text = softenClaim(buildDecisionDeltaText(decisionDelta), analysis);
  const strength = getDecisionDeltaStrength(decisionDelta.absDelta);
  const background =
    strength === "strong"
      ? "#fef2f2"
      : strength === "moderate"
        ? "#f8fafc"
        : "#f9fafb";
  return `
    <div class="panel" style="margin:0 0 14px; padding:16px 18px; background:${background}; border-color:#e5e7eb;">
      <div style="font-size:30px; line-height:1.1; font-weight:800; margin:0 0 8px;">
        ${text}
      </div>
      <p class="small muted" style="margin:0;">
        Typical range: ${safeFormatCurrency(decisionDelta.low)} to ${safeFormatCurrency(decisionDelta.high)}
      </p>
    </div>
  `;
}
    function buildDifferenceDisplay(quotePrice, mid) {
      const price = Number(quotePrice);
      const midpoint = Number(mid);
      if (!isFinite(price) || !isFinite(midpoint) || midpoint <= 0) {
        return "Not available";
      }
      const diff = price - midpoint;
      const diffPct = (diff / midpoint) * 100;
      const absDiff = Math.abs(diff);
      const absPct = Math.abs(diffPct);
      if (absPct < 1) {
        return "In line with modeled midpoint";
      }
      if (absPct < 3) {
        return diff < 0
          ? `Slightly below midpoint`
          : `Slightly above midpoint`;
      }
      return `${diff < 0 ? "-" : ""}${safeFormatCurrency(absDiff)} (${diffPct.toFixed(1)}%)`;
}
    function getFileNameBase(name) {
      return String(name || "")
        .replace(/\.[^/.]+$/, "")
        .replace(/[_-]+/g, " ")
        .trim();
    }
    function inferContractorNameFromParsed(parsedObj, fallbackFileName) {
      if (!parsedObj || typeof parsedObj !== "object") {
        return getFileNameBase(fallbackFileName || "");
      }
      const candidate =
        String(
          parsedObj.contractorName ||
          parsedObj.companyName ||
          parsedObj.contractor ||
          parsedObj.company ||
          parsedObj.vendor ||
          ""
        ).trim();
      if (candidate) return candidate;
      return getFileNameBase(fallbackFileName || "");
    }
    function getParsedComparisonPrice(parsedObj) {
      if (!parsedObj || typeof parsedObj !== "object") return null;
      const candidates = [
        parsedObj.price,
        parsedObj.totalLinePrice,
        parsedObj.finalBestPrice,
        parsedObj.totalPrice,
        parsedObj.total,
        parsedObj.quotePrice,
        parsedObj.grandTotal,
        parsedObj.amount
      ];
      for (const value of candidates) {
        const num = Number(value);
        if (isFinite(num) && num > 0) return num;
      }
      return null;
    }
    function buildComparisonQuoteFromUpload(parsedBundle, manualName, manualPrice, fallbackLabel) {
      const parsed = parsedBundle?.parsed || parsedBundle || null;
      const manualPriceNum = Number(manualPrice);
      const parsedPrice = getParsedComparisonPrice(parsed);
      const total =
        isFinite(manualPriceNum) && manualPriceNum > 0
          ? manualPriceNum
          : parsedPrice;
      const inferredContractor = inferContractorNameFromParsed(
        parsed,
        parsedBundle?.fileName || fallbackLabel
      );
      const contractor =
        String(manualName || "").trim() ||
        inferredContractor ||
        fallbackLabel;
      const parsedRoofSize = Number(
        parsed?.roofSize ||
        parsed?.measurements?.roofSize ||
        parsed?.roof_area ||
        parsed?.sqft
      );
      return {
        label: fallbackLabel,
        contractor,
        total: isFinite(total) && total > 0 ? total : null,
        roofSize: isFinite(parsedRoofSize) && parsedRoofSize > 0 ? parsedRoofSize : null,
        material: parsed?.materialLabel || parsed?.material || "Not detected",
        warranty: displayWarranty(parsed?.warranty || ""),
        source: parsedBundle ? "upload" : "manual",
        fileName: parsedBundle?.fileName || ""
      };
    }
    function buildPrimaryComparisonQuote() {
      const parsed = latestParsed || {};
      const analysis = latestAnalysis || {};
      const contractor =
        inferContractorNameFromParsed(parsed, "Quote 1") || "Quote 1";
      const total =
        getParsedComparisonPrice(parsed) ||
        (isFinite(Number(analysis.quotePrice)) && Number(analysis.quotePrice) > 0
          ? Number(analysis.quotePrice)
          : null);
      const roofSize =
        isFinite(Number(parsed?.roofSize)) && Number(parsed.roofSize) > 0
          ? Number(parsed.roofSize)
          : isFinite(Number(analysis?.roofSize)) && Number(analysis.roofSize) > 0
            ? Number(analysis.roofSize)
            : null;
      return {
        label: inferContractorNameFromParsed(parsed, "Contractor"),
        contractor,
        total,
        roofSize,
        material: parsed?.materialLabel || parsed?.material || analysis?.material || "Not detected",
        warranty: displayWarranty(parsed?.warranty || ""),
        source: "primary"
      };
    }
    function renderComparisonSourceLabel(source) {
      if (source === "primary") return "Primary analyzed quote";
      if (source === "upload") return "Parsed from upload";
      return "Manual entry";
    }
    function normalizeComparisonQuote(raw, fallbackLabel) {
      if (!raw || typeof raw !== "object") return null;
      const parsedTotal = Number(raw.total);
      const total = isFinite(parsedTotal) && parsedTotal > 0 ? parsedTotal : null;
      const parsedRoofSize = Number(raw.roofSize);
      const roofSize = isFinite(parsedRoofSize) && parsedRoofSize > 0 ? parsedRoofSize : null;
      const contractor =
        String(raw.contractor || raw.name || raw.label || "").trim() || fallbackLabel;
      const source =
        String(raw.source || "").trim() || "manual";
      return {
        label: raw.label || fallbackLabel,
        contractor,
        total,
        roofSize,
        material: raw.material || "Not detected",
        warranty: raw.warranty || "Not listed in quote",
        source,
        fileName: raw.fileName || "",
        pricePerSqFt: total && roofSize ? total / roofSize : null,
        isValid: !!total,
        isPartial: !total
      };
    }
function getComparisonScopeScore(quote) {
    let score = 0;
    const material = String(quote?.material || "").toLowerCase();
    const warranty = String(quote?.warranty || "").toLowerCase();
    if (material && material !== "not detected") score += 10;
    if (warranty && warranty !== "not listed in quote" && warranty !== "not detected") score += 10;
    return score;
  }
function getComparisonWarrantyScore(quote) {
  const warranty = String(quote?.warranty || "").toLowerCase();
  if (!warranty || warranty === "not listed in quote" || warranty === "not detected") {
    return 0;
  }
  const yearsMatch = warranty.match(/(\d+)/);
  const years = yearsMatch ? Number(yearsMatch[1]) : 0;
  if (years >= 25) return 15;
  if (years >= 10) return 10;
  if (years > 0) return 6;
  return 8;
}
function scoreComparisonQuote(quote, analysis) {
  const price = Number(quote?.total || 0);
  const mid = Number(analysis?.mid || 0);
  if (!isFinite(price) || price <= 0 || !isFinite(mid) || mid <= 0) {
    return {
      totalScore: 0,
      priceScore: 0,
      scopeScore: 0,
      warrantyScore: 0,
      riskPenalty: 0,
      confidencePenalty: 0,
      band: "unscored",
      reasons: ["Quote price could not be scored reliably."],
      warnings: ["Comparison score is incomplete because price could not be evaluated."]
    };
  }
  const pctOffMid = ((price - mid) / mid) * 100;
  const absPctOffMid = Math.abs(pctOffMid);
  let priceScore = 0;
  let riskPenalty = 0;
  let confidencePenalty = 0;
  let band = "fair";
  const reasons = [];
  const warnings = [];
  if (price < mid * 0.78) {
    priceScore = 18;
    riskPenalty = 24;
    band = "suspicious_low";
    reasons.push("Price is far below modeled midpoint");
    warnings.push("Very low bid may reflect missing scope, change orders, or contractor risk");
  } else if (price < mid * 0.88) {
    priceScore = 52;
    riskPenalty = 10;
    band = "low";
    reasons.push("Price is below modeled midpoint");
    warnings.push("Lower bid should be checked for omissions before treating it as best value");
  } else if (price <= mid * 1.05) {
    priceScore = 94;
    band = "strong";
    reasons.push("Price is close to modeled midpoint");
  } else if (price <= mid * 1.15) {
    priceScore = 78;
    band = "fair";
    reasons.push("Price is somewhat above modeled midpoint");
  } else if (price <= mid * 1.30) {
    priceScore = 54;
    riskPenalty = 8;
    band = "high";
    reasons.push("Price is materially above modeled midpoint");
  } else {
    priceScore = 28;
    riskPenalty = 16;
    band = "very_high";
    reasons.push("Price is far above modeled midpoint");
    warnings.push("This quote is expensive relative to modeled pricing");
  }
  const rawScopeScore = getComparisonScopeScore(quote);
  const rawWarrantyScore = getComparisonWarrantyScore(quote);
  const scopeScore = Math.min(rawScopeScore, 8);
  const warrantyScore = Math.min(rawWarrantyScore, 10);
  if (scopeScore >= 8) {
    reasons.push("More quote details were clearly identified");
  }
  if (warrantyScore >= 10) {
    reasons.push("Warranty appears stronger or more clearly stated");
  } else if (warrantyScore >= 6) {
    reasons.push("Warranty information was present");
  }
  if (!quote?.roofSize || quote.roofSize <= 0) {
    confidencePenalty += 4;
    warnings.push("Roof size was not detected for this quote");
  }
  const totalScore = Math.round(
    Math.max(0, Math.min(100, priceScore + scopeScore + warrantyScore - riskPenalty - confidencePenalty))
  );
  return {
    totalScore,
    priceScore: Math.round(priceScore),
    scopeScore,
    warrantyScore,
    riskPenalty,
    confidencePenalty,
    band,
    reasons,
    warnings
  };
}
function buildComparisonWinnerSummary(quotes, analysis) {
  const validQuotes = (Array.isArray(quotes) ? quotes : []).filter(q => q?.isValid);
  if (validQuotes.length < 2 || !analysis) return null;
  const scored = validQuotes.map(quote => {
    const score = scoreComparisonQuote(quote, analysis);
    return {
      ...quote,
      comparisonScore: score.totalScore,
      comparisonBreakdown: score
    };
  });
  const ranked = [...scored].sort((a, b) => {
    if (b.comparisonScore !== a.comparisonScore) {
      return b.comparisonScore - a.comparisonScore;
    }
    const aDist = Math.abs((Number(a.total) || 0) - (Number(analysis.mid) || 0));
    const bDist = Math.abs((Number(b.total) || 0) - (Number(analysis.mid) || 0));
    return aDist - bDist;
  });
  const winner = ranked[0];
  const runnerUp = ranked[1] || null;
  const winnerBand = String(winner?.comparisonBreakdown?.band || "");
  const winnerWarnings = Array.isArray(winner?.comparisonBreakdown?.warnings)
    ? winner.comparisonBreakdown.warnings
    : [];
  const blockingWarningPatterns = [
  /very low bid/i,
  /missing scope/i,
  /change orders/i,
  /contractor risk/i,
  /far above modeled midpoint/i,
  /expensive relative to modeled pricing/i
];
const hasBlockingWarning = winnerWarnings.some(warning =>
  blockingWarningPatterns.some(pattern => pattern.test(String(warning || "")))
);
const shouldSoftenWinner =
  winnerBand === "suspicious_low" ||
  winnerBand === "very_high" ||
  hasBlockingWarning;
  const losers = ranked.slice(1).map(q => ({
    name: q.contractor,
    reasons: q.comparisonBreakdown.reasons.slice(0, 2),
    warnings: q.comparisonBreakdown.warnings.slice(0, 1),
    score: q.comparisonScore
  }));
  return {
    winner: winner.contractor,
    winnerQuote: winner,
    runnerUp,
    losers,
    ranked,
    shouldSoftenWinner,
    winnerWarnings
  };
}
function buildComparisonWinnerHtml(summary) {
  if (!summary?.winnerQuote) return "";
  const winner = summary.winnerQuote;
  const runnerUp = summary?.runnerUp || null;
  const softened = !!summary.shouldSoftenWinner;
  const warnings = Array.isArray(summary.winnerWarnings) ? summary.winnerWarnings : [];
  const reasons = Array.isArray(winner?.comparisonBreakdown?.reasons)
    ? winner.comparisonBreakdown.reasons.slice(0, 2)
    : [];
  const title = softened
    ? "Current leader"
    : "Comparison decision";
  const headline = softened
    ? `${winner.contractor} is in front, but not decision ready`
    : `${winner.contractor} wins`;
  const nextStep = softened
    ? "Do not select this quote yet. Resolve the warning first."
    : "Advance this contractor unless new scope issues appear.";
  const shellBg = softened ? "#fff7ed" : "#f0fdf4";
  const shellBorder = softened ? "#fdba74" : "#86efac";
  const shellText = softened ? "#9a3412" : "#166534";
  const runnerUpLine = runnerUp
    ? `<p class="small muted" style="margin:0 0 10px;">
        <strong>Runner up:</strong> ${runnerUp.contractor} (${runnerUp.comparisonScore}/100)
      </p>`
    : "";
  const warningHtml = warnings.length
    ? `
      <div class="panel" style="margin:0 0 10px; background:#fff7ed; border-color:#fdba74;">
        <p style="margin:0;">
          <strong>Do not ignore this:</strong> ${warnings[0]}.
        </p>
      </div>
    `
    : "";
  const whyWonHtml = reasons.length
    ? `
      <div class="panel" style="margin:0 0 10px; background:#f8fafc; border-color:#e5e7eb;">
        <p style="margin:0 0 6px; font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:#334155;">
          Why it won
        </p>
        <ul class="mini-list" style="margin:0;">
          ${reasons.map(reason => `<li>${reason}</li>`).join("")}
        </ul>
      </div>
    `
    : "";
  const othersHtml = summary.losers.length
    ? `
      <div class="small muted" style="margin-top:8px;">
        <strong>Other quotes:</strong>
        <ul class="mini-list" style="margin-top:6px;">
          ${summary.losers.map(loser => `
            <li>
              <strong>${loser.name}:</strong>
              Score ${loser.score}/100.
              ${loser.reasons.join(". ")}
              ${loser.warnings?.length ? ` Warning: ${loser.warnings[0]}` : ""}
            </li>
          `).join("")}
        </ul>
      </div>
    `
    : "";
  return `
    <div class="panel" style="margin:0 0 14px; padding:14px 16px; background:${shellBg}; border-color:${shellBorder};">
      <p style="margin:0 0 6px; font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:${shellText};">
        ${title}
      </p>
      <div style="margin:0 0 6px; font-size:30px; line-height:1.05; font-weight:800; color:${shellText};">
        ${headline}
      </div>
      <p style="margin:0 0 8px;">
        <strong>Score:</strong> ${winner.comparisonScore} / 100
      </p>
      <p style="margin:0 0 12px;">
        <strong>Quoted price:</strong> ${safeFormatCurrency(winner.total)}
      </p>
      ${runnerUpLine}
      ${warningHtml}
      ${whyWonHtml}
      <div class="panel" style="margin:0 0 10px; background:#eff6ff; border-color:#93c5fd;">
        <p style="margin:0;">
          <strong>Next step:</strong> ${nextStep}
        </p>
      </div>
      ${othersHtml}
      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
        <button type="button" class="btn secondary" id="copyComparisonWinnerBtn">
          Copy winner summary
        </button>
        <button type="button" class="btn secondary" id="copyContractorQuestionsFromCompareBtn">
          Copy contractor questions
        </button>
        <button type="button" class="btn secondary" id="viewShareReportFromCompareBtn">
          View share report
        </button>
      </div>
    </div>
  `;
}
      function buildComparisonWinnerText(summary) {
        if (!summary?.winnerQuote) return "";
        const winner = summary.winnerQuote;
        const runnerUp = summary?.runnerUp || null;
        const softened = !!summary.shouldSoftenWinner;
        const warnings = Array.isArray(summary.winnerWarnings) ? summary.winnerWarnings : [];
        const reasons = Array.isArray(winner?.comparisonBreakdown?.reasons)
          ? winner.comparisonBreakdown.reasons.slice(0, 2)
          : [];
        const nextStep = softened
          ? "Do not select this quote yet. Resolve the warning first."
          : "This is the quote to advance unless new scope issues appear.";
        const lines = [
          "TruePrice Comparison Decision",
          "",
          softened
            ? `Current leader: ${winner.contractor}`
            : `Winner: ${winner.contractor}`,
          `Score: ${winner.comparisonScore} / 100`,
          `Quoted price: ${safeFormatCurrency(winner.total)}`,
        ];
        if (runnerUp?.contractor) {
          const scoreGap =
            Number(winner.comparisonScore || 0) - Number(runnerUp.comparisonScore || 0);
          lines.push(
            `Runner up: ${runnerUp.contractor}${isFinite(scoreGap) ? ` (${Math.abs(scoreGap)} points behind)` : ""}`
          );
        }
        if (reasons.length) {
          lines.push(
            "",
            `Why it won: ${reasons[0]}${reasons[1] ? `. ${reasons[1]}` : ""}`
          );
        }
        if (warnings.length) {
          lines.push(
            `Warning: ${warnings[0]}`
          );
        }
        lines.push(
          `Next step: ${nextStep}`
        );
        if (summary.losers?.length) {
          lines.push(
            "",
            "Other quotes:"
          );
          summary.losers.forEach(loser => {
            const loserReasons = Array.isArray(loser?.reasons) ? loser.reasons.slice(0, 2) : [];
            const loserWarnings = Array.isArray(loser?.warnings) ? loser.warnings.slice(0, 1) : [];
            lines.push(
              `- ${loser.name}: Score ${loser.score}/100.${loserReasons.length ? ` ${loserReasons.join(". ")}.` : ""}${loserWarnings.length ? ` Warning: ${loserWarnings[0]}.` : ""}`
            );
          });
        }
        return lines.join("\n");
      }
      function bindComparisonWinnerActions(summary) {
        const copyWinnerBtn = byId("copyComparisonWinnerBtn");
        const copyQuestionsBtn = byId("copyContractorQuestionsFromCompareBtn");
        const viewReportBtn = byId("viewShareReportFromCompareBtn");
        if (copyWinnerBtn && copyWinnerBtn.dataset.bound !== "true") {
          copyWinnerBtn.addEventListener("click", async function () {
            const text = buildComparisonWinnerText(summary);
            if (!text) return;
            try {
              await navigator.clipboard.writeText(text);
              setUploadStatus("Comparison winner summary copied to clipboard.", "success");
            } catch (err) {
              console.error(err);
              setUploadStatus("Could not copy comparison winner summary.", "error");
            }
          });
          copyWinnerBtn.dataset.bound = "true";
        }
        if (copyQuestionsBtn && copyQuestionsBtn.dataset.bound !== "true") {
          copyQuestionsBtn.addEventListener("click", function () {
            copyContractorQuestions();
          });
          copyQuestionsBtn.dataset.bound = "true";
        }
        if (viewReportBtn && viewReportBtn.dataset.bound !== "true") {
          viewReportBtn.addEventListener("click", function () {
            viewShareableResult();
            const output = byId("inlineShareReportOutput");
            if (output) {
              setTimeout(() => {
                output.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 150);
            }
          });
          viewReportBtn.dataset.bound = "true";
        }
      }
      function getComparisonBandLabel(band) {
        const normalized = String(band || "").toLowerCase();
        if (normalized === "strong") return "Strong";
        if (normalized === "fair") return "Fair";
        if (normalized === "low") return "Low bid";
        if (normalized === "suspicious_low") return "Suspiciously low";
        if (normalized === "high") return "High";
        if (normalized === "very_high") return "Very high";
        return "Unscored";
      }
      function buildComparisonScoreCellHtml(quote) {
        const breakdown = quote?.comparisonBreakdown || null;
        if (!breakdown) return "Not available";
        const score = Number(breakdown.totalScore);
        const bandLabel = getComparisonBandLabel(breakdown.band);
        return `
          <div>
            <strong>${isFinite(score) ? `${score} / 100` : "Not available"}</strong>
          </div>
          <div class="small muted" style="margin-top:4px;">
            ${bandLabel}
          </div>
        `;
      }
      function renderParsedSignalSection(parsed) {
        const container = byId("parsedSignalSection");
        if (!container) return;
        container.innerHTML = "";
      }
      function buildAIExplanation(analysis) {
        const {
          verdict,
          quotePrice,
          low,
          mid,
          high,
          material,
          roofSize,
          city,
          stateCode,
          localDataUsed,
          sizeLabelUsed,
          tearOffLabel,
          warrantyYears,
          premiumSignals,
          analysisConfidenceLabel,
          roofSizeNeedsReview,
          roofSizeConsistency,
          reliabilityTier
        } = analysis || {};
        const materialLabel =
          material === "architectural"
            ? "architectural shingles"
            : material === "asphalt"
              ? "asphalt shingles"
              : material === "metal"
                ? "metal roofing"
                : material === "tile"
                  ? "tile roofing"
                  : "roofing";
        const locationLabel =
          city && stateCode ? `${city}, ${stateCode}` : stateCode || city || "your area";
        const confidenceLabel = analysisConfidenceLabel || "Low";
        const consistencySeverity = String(roofSizeConsistency?.severity || "low").toLowerCase();
        const confidenceModeAnalysis = {
          reliabilityTier,
          roofSizeNeedsReview,
          roofSizeConsistency
        };
        const benchmarkText = localDataUsed
          ? `We compared it against local benchmark pricing for ${locationLabel}${sizeLabelUsed ? ` using the nearest size bucket (${sizeLabelUsed})` : ""}.`
          : `We compared it against benchmark pricing for ${materialLabel} in ${locationLabel}.`;
        const trustPrefix =
          consistencySeverity === "high"
            ? "This result should be treated as provisional until roof size is verified. "
            : consistencySeverity === "medium"
              ? "This result is directionally useful, but roof size signals are mixed. "
              : "";
        const trustSuffix =
          consistencySeverity === "high"
            ? " Verify roof size before relying on the price result."
            : consistencySeverity === "medium"
              ? " Treat the verdict as directional rather than exact."
              : roofSizeNeedsReview
                ? " Roof size may need review before relying on this result."
                : "";
        const premiumText =
          Array.isArray(premiumSignals) && premiumSignals.length
            ? ` Premium or complexity signals were detected: ${premiumSignals.join(", ")}.`
            : "";
        const tearOffText =
          tearOffLabel === "yes"
            ? " Tear off appears to be included."
            : tearOffLabel === "no"
              ? " Tear off does not appear to be included."
              : "";
        const warrantyText =
          warrantyYears && Number(warrantyYears) > 0
            ? ` Detected warranty: ${warrantyYears} years.`
            : "";
        if (!roofSize || !material || material === "unknown") {
          return `${trustPrefix}We found a usable quote price, but some important quote details were unclear. Add roof size, material, and location details to improve accuracy. Analysis confidence: ${confidenceLabel}.${trustSuffix}`;
        }
        if (verdict === "Fair Price") {
          return `${trustPrefix}${softenClaim(`This quote aligns with expected pricing for this type of project in ${locationLabel}.`, confidenceModeAnalysis)} ${benchmarkText} Confidence: ${confidenceLabel}.${trustSuffix}`;
        }
        if (
          verdict === "Higher Than Expected" ||
          verdict === "May Be Higher Than Expected" ||
          verdict === "Possibly Higher Than Expected"
        ) {
          return `${trustPrefix}${softenClaim(`This quote is above expected pricing for this type of project in ${locationLabel}.`, confidenceModeAnalysis)} ${benchmarkText} Confidence: ${confidenceLabel}.${trustSuffix}`;
        }
        if (
          verdict === "Overpriced" ||
          verdict === "May Be Overpriced" ||
          verdict === "Possibly Overpriced"
        ) {
          return `${trustPrefix}${softenClaim(`This quote is materially above expected pricing.`, confidenceModeAnalysis)} ${benchmarkText} Confidence: ${confidenceLabel}.${trustSuffix}`;
        }
        if (
          verdict === "Possible Scope Risk" ||
          verdict === "Possible Scope Risk, With Some Uncertainty" ||
          verdict === "Low Price, But Roof Size Needs Review"
        ) {
          return `${trustPrefix}${softenClaim(`This quote is below expected pricing and may be missing scope items.`, confidenceModeAnalysis)} ${benchmarkText} Confidence: ${confidenceLabel}.${trustSuffix}`;
        }
        if (
          verdict === "Unusually Low" ||
          verdict === "May Be Unusually Low" ||
          verdict === "Possibly Unusually Low"
        ) {
          return `${trustPrefix}${softenClaim(`This quote is below expected pricing for a ${roofSize || "similar-sized"} ${materialLabel} project in ${locationLabel}.`, confidenceModeAnalysis)} ${benchmarkText}${tearOffText}${warrantyText} Double check that the quote includes underlayment, flashing, ventilation, disposal, and warranty details. Analysis confidence: ${confidenceLabel}.${trustSuffix}${premiumText}`;
        }
        return `${trustPrefix}${softenClaim(`This quote was compared against expected pricing for a ${roofSize || "similar-sized"} ${materialLabel} project in ${locationLabel}.`, confidenceModeAnalysis)} ${benchmarkText} Analysis confidence: ${confidenceLabel}.${trustSuffix}${premiumText}`;
      }
      function renderAnalysisPanels(parsed) {
        const container = byId("analysisPanels");
      if (!container) return;
      const analysis = latestAnalysis || {};
      const confidenceLabel = analysis?.analysisConfidenceLabel || parsed?.confidenceLabel || "Low";
      const confidenceClass = getConfidenceBadgeClass(confidenceLabel);
      const parserWarnings = Array.isArray(parsed?.warnings) ? parsed.warnings : [];
      const parserWarningsHtml = parserWarnings.length
        ? `<ul class="mini-list signal-summary-warn">${parserWarnings.map(item => `<li>${item}</li>`).join("")}</ul>`
        : `<p class="small muted" style="margin:0;">No major parsing warnings.</p>`;
      const includedSignals = Array.isArray(parsed?.includedSignals) ? parsed.includedSignals : [];
      const missingSignals = Array.isArray(parsed?.missingSignals) ? parsed.missingSignals : [];
      const premiumSignals = Array.isArray(parsed?.premiumSignals) ? parsed.premiumSignals : [];
      const scopeCheckHtml = buildScopeCheckHtml({
        includedSignals,
        missingSignals,
        premiumSignals
      });
      const scopeRiskHtml = buildScopeRiskHtml(missingSignals);
      const roofSizeDisplay =
        analysis?.roofSize
          ? formatRoofSizeForDisplay(
              analysis.roofSize,
              analysis.roofSizeEstimateSource,
              analysis.roofSizeEstimateConfidence
            )
          : "Not detected";
      const materialDisplay =
        parsed?.materialLabel && parsed.materialLabel !== "Unknown"
          ? parsed.materialLabel
          : analysis?.material
            ? displayMaterial(analysis.material)
            : "Not detected";
      const warrantyDisplay =
        parsed?.warranty && String(parsed.warranty).trim().toLowerCase() !== "not detected"
          ? displayWarranty(parsed.warranty)
          : analysis?.warrantyYears
            ? `${analysis.warrantyYears} years`
            : "Not listed in quote";
      const locationDisplay =
        [analysis?.city, analysis?.stateCode].filter(Boolean).join(", ") || "Not detected";
      container.innerHTML = `
        <div class="panel" style="margin-top:18px;">
          <button
            type="button"
            class="btn btn-ghost"
            id="toggleDetailsBtn"
            style="width:100%; text-align:left;"
          >
            See details behind this result
          </button>
          <div id="analysisDetailsContent" style="display:none; margin-top:12px;">
            <div>
              <h4>What we used to analyze your quote</h4>
              <ul class="mini-list">
                <li><strong>Material:</strong> ${materialDisplay}</li>
                <li><strong>Roof size:</strong> ${roofSizeDisplay}</li>
                <li><strong>Warranty:</strong> ${warrantyDisplay}</li>
                <li><strong>Location:</strong> ${locationDisplay}</li>
              </ul>
            </div>
            <div>
              <h4>Scope and risk signals</h4>
              <p style="margin:0 0 10px;">
                <span class="confidence-badge ${confidenceClass}">
                  Confidence: ${confidenceLabel}
                </span>
              </p>
              ${
                parserWarnings.length
                  ? `
                    <div class="signal-summary-wrap">
                      <h5 style="margin:0 0 8px;">Things we were less certain about</h5>
                      ${parserWarningsHtml}
                    </div>
                  `
                  : ""
              }
              <div style="margin-top:14px;">
                ${scopeCheckHtml}
              </div>
              ${scopeRiskHtml}
            </div>
          </div>
        </div>
      `;
      const toggleBtn = byId("toggleDetailsBtn");
  const content = byId("analysisDetailsContent");
  if (toggleBtn && content) {
    toggleBtn.addEventListener("click", () => {
      const isOpen = content.style.display === "block";
      content.style.display = isOpen ? "none" : "block";
      toggleBtn.innerText = isOpen
        ? "See details behind this result"
        : "Hide details";
      toggleBtn.setAttribute("aria-expanded", isOpen ? "false" : "true");
  });
}
    }
    function getRoofSizeSourceDisplay(source) {
  const normalized = String(source || "").toLowerCase();
  if (normalized === "user_input") return "Entered by you";
  if (normalized === "parsed_quote") return "Found in the quote";
  if (normalized === "address_estimated") return "Estimated from property data";
  if (normalized === "price_based_estimate") return "Estimated from pricing signals";
  if (normalized === "manual_calculator") return "Estimated with DIY calculator";
  if (normalized === "unavailable") return "Not available";
  return "Not available";
}
      function getReliabilityTier({ source, confidenceScore, disagreement }) {
        const normalizedSource = String(source || "").toLowerCase();
        const score = Number(confidenceScore);
        const hasDisagreement = !!disagreement?.hasDisagreement;
        if (normalizedSource === "user_input" || normalizedSource === "parsed_quote") {
          return "VERIFIED";
        }
        if (normalizedSource === "manual_calculator") {
          return hasDisagreement ? "ESTIMATED" : "HIGH_CONFIDENCE";
        }
        if (isFinite(score) && score >= 80 && !hasDisagreement) {
          return "HIGH_CONFIDENCE";
        }
        if (isFinite(score) && score >= 60) {
          return "ESTIMATED";
        }
        return "LOW_CONFIDENCE";
      }
      function getReliabilityTierLabel(tier) {
        if (tier === "VERIFIED") return "Verified";
        if (tier === "HIGH_CONFIDENCE") return "High confidence estimate";
        if (tier === "ESTIMATED") return "Estimated using modeling";
        return "Low confidence – review inputs";
      }
      function getReliabilityTierClass(tier) {
        if (tier === "VERIFIED") return "high";
        if (tier === "HIGH_CONFIDENCE") return "high";
        if (tier === "ESTIMATED") return "medium";
        return "low";
      }
      function getReliabilityTierExplanation(tier) {
        if (tier === "VERIFIED") {
          return "Key pricing inputs were directly entered or clearly found in the quote.";
        }
        if (tier === "HIGH_CONFIDENCE") {
          return "The estimate is supported by strong signals with low disagreement.";
        }
        if (tier === "ESTIMATED") {
          return "This result depends partly on modeled inputs, so treat it as directional.";
        }
        return "Important inputs are uncertain or conflicting. Review inputs before relying on this result.";
      }
      function getPropertyMatchQualityLabel(value) {
        const normalized = String(value || "").toLowerCase();
        if (normalized === "high") return "High";
        if (normalized === "medium") return "Moderate";
        if (normalized === "approximate") return "Approximate";
        if (normalized === "low") return "Low";
        return "Unknown";
      }
      function buildPropertyMetadataTrustHtml(analysis) {
        const source = String(analysis?.roofSizeEstimateSource || "").toLowerCase();
        const meta = analysis?.propertySignalsMeta || {};
        if (source !== "address_estimated") return "";
        const quality = getPropertyMatchQualityLabel(meta.buildingMatchQuality);
        const geocodeQuality = String(meta.geocodeMatchQuality || "unknown");
        const candidateCount = Number(meta.candidateCount || 0);
        const ambiguous = !!meta.ambiguous;
        return `
          <div class="small muted" style="margin:8px 0 0;">
            <div><strong>Property match quality:</strong> ${quality}</div>
            <div><strong>Geocode match quality:</strong> ${geocodeQuality}</div>
            ${
              candidateCount > 0
                ? `<div><strong>Candidate buildings reviewed:</strong> ${candidateCount}</div>`
                : ""
            }
            ${
              ambiguous
                ? `<div style="margin-top:4px;"><strong>Warning:</strong> Property match was ambiguous and may reduce confidence.</div>`
                : ""
            }
          </div>
        `;
      }
      function buildResultTrustHtml(analysis) {
        if (!analysis) return "";
        const roofSizeSource = getRoofSizeSourceDisplay(analysis.roofSizeEstimateSource);
        const trustNote = getVerdictTrustNote(analysis.roofSizeConsistency);
        const reliabilityTier = getReliabilityTier({
          source: analysis.roofSizeEstimateSource,
          confidenceScore: analysis.roofSizeEstimateConfidenceScore,
          disagreement: analysis.roofSizeEstimateMeta?.disagreement || analysis.roofSizeConsistency || null
        });
        const reliabilityLabel = getReliabilityTierLabel(reliabilityTier);
        const reliabilityClass = getReliabilityTierClass(reliabilityTier);
        const reliabilityExplanation = getReliabilityTierExplanation(reliabilityTier);
        return `
          <div class="panel" style="margin:0 0 12px; padding:12px 14px; background:#f8fafc; border-color:#e5e7eb;">
            <p style="margin:0 0 6px;">
              <span class="confidence-badge ${reliabilityClass}">
                ${reliabilityLabel}
              </span>
            </p>
            <p class="small muted" style="margin:0 0 6px;">
              ${reliabilityExplanation}
            </p>
            <p class="small muted" style="margin:0;">
              <strong>Roof size source:</strong> ${roofSizeSource}
            </p>
            ${buildPropertyMetadataTrustHtml(analysis)}
            ${
              trustNote
                ? `<p class="small muted" style="margin:6px 0 0;">${trustNote}</p>`
                : ""
            }
          </div>
        `;
}
      function getVerdictCardClass(verdict) {
        const v = String(verdict || "").toLowerCase();
        if (v.includes("fair")) return "verdict-card--fair";
        if (v.includes("overpriced") || v.includes("possibly overpriced") || v.includes("may be overpriced")) return "verdict-card--overpriced";
        if (v.includes("higher") || v.includes("high")) return "verdict-card--high";
        if (v.includes("scope risk")) return "verdict-card--risk";
        if (v.includes("low")) return "verdict-card--low";
        return "verdict-card--unknown";
      }
      function getVerdictHeadline(verdict) {
        const v = String(verdict || "").toLowerCase();
        if (v.includes("fair")) return "This quote looks fair";
        if (v.includes("overpriced")) return "This quote looks overpriced";
        if (v.includes("higher")) return "This quote looks high";
        if (v.includes("scope risk")) return "This quote may be missing items";
        if (v.includes("low")) return "This price seems low — check what's included";
        return verdict || "Analysis complete";
      }
      function renderVerdictCard(a) {
        if (!a) return "";
        const meta = a?.meta || {};
        const pricingMeta = meta?.pricing || {};
        const confidenceMeta = meta?.confidence || {};
        const roofMeta = meta?.roofSize || {};
        const confidenceLabel = confidenceMeta?.overallTier || a?.confidenceLabel || "Low";
        const deltaFromMid = pricingMeta?.deltaFromMid ?? (a.quotePrice - a.mid);
        const deltaAbs = Math.abs(deltaFromMid);
        const city = a?.city || journeyState?.propertyPreview?.city || "";
        const state = a?.stateCode || journeyState?.propertyPreview?.state || "";
        const location = city && state ? `${city}, ${state}` : city || "your area";
        const roofSizeValue = roofMeta?.value ?? a?.roofSize ?? null;
        const roofSizeSource = roofMeta?.source || a?.roofSizeEstimateSource || "";
        const materialLabel = a.material && typeof getMaterialLabel === "function"
          ? getMaterialLabel(a.material).toLowerCase()
              .replace(/\s*shingles?$/i, "")
              .replace(/\s*roofing$/i, "")
          : "";
        const contractorName = latestParsed?.contractor && latestParsed.contractor !== "Not detected"
          ? latestParsed.contractor
          : "";
        let deltaText = "";
        if (isFinite(deltaAbs) && deltaAbs >= 100) {
          const direction = deltaFromMid > 0 ? "above" : "below";
          const sizePart = roofSizeValue ? Number(roofSizeValue).toLocaleString() + " sq ft roof" : "";
          const matPart = materialLabel ? "using " + materialLabel + " shingles" : "";
          const locPart = location && location !== "your area" ? "in " + location : "";
          const suffix = [sizePart, matPart, locPart].filter(Boolean).join(" ");
          deltaText = "This quote is " + safeFormatCurrency(deltaAbs) + " " + direction + " expected" + (suffix ? " for a " + suffix : "");
        }
        return `
          <div class="verdict-card ${getVerdictCardClass(a.verdict)}">
            <div style="display:inline-block; padding:4px 12px; border-radius:999px; background:rgba(255,255,255,0.7); border:1px solid rgba(0,0,0,0.06); font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:var(--muted); margin-bottom:12px;">
              Confidence: ${escapeHtml(confidenceLabel)}
            </div>
            <div class="verdict-headline">${getVerdictHeadline(a.verdict)}</div>
            ${deltaText ? `<div class="verdict-delta">${escapeHtml(deltaText)}</div>` : ""}
            <div class="verdict-range">
              <div class="verdict-range-item">
                <span class="verdict-range-label">Your quote</span>
                <span class="verdict-range-value verdict-range-value--quote">${safeFormatCurrency(a.quotePrice)}</span>
              </div>
              <div class="verdict-range-item">
                <span class="verdict-range-label">Expected low</span>
                <span class="verdict-range-value">${safeFormatCurrency(a.low)}</span>
              </div>
              <div class="verdict-range-item">
                <span class="verdict-range-label">Midpoint</span>
                <span class="verdict-range-value">${safeFormatCurrency(a.mid)}</span>
              </div>
              <div class="verdict-range-item">
                <span class="verdict-range-label">Expected high</span>
                <span class="verdict-range-value">${safeFormatCurrency(a.high)}</span>
              </div>
            </div>
            <div class="verdict-meta">
              ${roofSizeValue ? `Roof size: ${formatRoofSizeForDisplay(roofSizeValue, roofSizeSource, roofMeta?.confidence || "Low")}` : ""}
              ${a.material ? ` &middot; ${escapeHtml(typeof getMaterialLabel === "function" ? getMaterialLabel(a.material) : a.material)}` : ""}
            </div>
          </div>
        `;
      }
      function renderActionCard(a) {
        if (!a) return "";
        const recommendation = a?.recommendation || {};
        const action = String(recommendation.action || "").toUpperCase();
        const questions = buildContractorQuestions(a);
        let mode = "review";
        let eyebrow = "Recommended action";
        let title = "";
        let body = "";
        let questionsHtml = "";
        let buttonsHtml = "";
        if (action === "NEGOTIATE") {
          mode = "negotiate";
          title = "Push back on this price";
          body = questions.length > 0
            ? `Your quote is above expected. Send these ${questions.length} questions to your contractor:`
            : "Your quote is above expected. Request a line-by-line breakdown.";
        } else if (action === "PROCEED") {
          mode = "proceed";
          title = "This quote looks reasonable";
          body = "Before you sign, confirm these items in writing:";
        } else if (action === "REVIEW") {
          mode = "review";
          title = "Verify before deciding";
          body = "Key inputs need confirmation before trusting this result:";
        } else if (action === "AVOID") {
          mode = "avoid";
          title = "Get another quote before signing";
          const flagCount = Array.isArray(a.riskFlags) ? a.riskFlags.filter(f => f.severity === "high").length : 0;
          body = flagCount > 0
            ? `This quote has ${flagCount} high-severity risk flag${flagCount > 1 ? "s" : ""}. We recommend getting at least one competing bid.`
            : "This quote raises concerns. Get a competing bid before committing.";
        }
        if (questions.length > 0 && (action === "NEGOTIATE" || action === "REVIEW" || action === "AVOID")) {
          questionsHtml = `
            <ol class="action-questions">
              ${questions.slice(0, 4).map((q, i) => `<li><strong>Q${i + 1}</strong>${escapeHtml(q)}</li>`).join("")}
            </ol>
          `;
          buttonsHtml = `
            <div class="action-buttons">
              <button class="btn" onclick="copyContractorQuestions()">Copy these questions</button>
              <button class="btn secondary" onclick="showCompareScreen()">Upload another quote</button>
            </div>
          `;
        } else if (action === "PROCEED") {
          const checkItems = [];
          const parsed = latestParsed || {};
          const signals = parsed.signals || {};
          if (!signals.tearOff || signals.tearOff.status !== "included") checkItems.push("Confirm tear-off is included");
          if (!signals.flashing || signals.flashing.status !== "included") checkItems.push("Confirm flashing replacement is included");
          if (!signals.ventilation || signals.ventilation.status !== "included") checkItems.push("Confirm ventilation work is included");
          if (!parsed.warrantyYears) checkItems.push("Get warranty terms in writing");
          if (checkItems.length === 0) checkItems.push("Confirm scope and warranty in writing");
          questionsHtml = `
            <ol class="action-questions">
              ${checkItems.map((item, i) => `<li><strong>${i + 1}</strong>${escapeHtml(item)}</li>`).join("")}
            </ol>
          `;
          buttonsHtml = `
            <div class="action-buttons">
              <button class="btn" onclick="showShareScreen()">Share this result</button>
              <button class="btn secondary" onclick="showCompareScreen()">Compare another quote</button>
            </div>
          `;
        } else {
          buttonsHtml = `
            <div class="action-buttons">
              <button class="btn" onclick="showCompareScreen()">Upload another quote</button>
              <button class="btn secondary" onclick="showShareScreen()">Share this result</button>
            </div>
          `;
        }
        return `
          <div class="action-card action-card--${mode}">
            <div class="action-eyebrow">${escapeHtml(eyebrow)}</div>
            <div class="action-title">${escapeHtml(title)}</div>
            <div class="action-body">${escapeHtml(body)}</div>
            ${questionsHtml}
            ${buttonsHtml}
          </div>
        `;
      }
      function renderRiskFlagsModule(a) {
        if (!a) return "";
        const flags = Array.isArray(a.riskFlags) ? a.riskFlags : [];
        if (flags.length === 0 || (flags.length === 1 && flags[0].key === "no_major_risks")) {
          return `
            <div class="risk-flags-module">
              <div class="risk-flag risk-flag--none">
                <div class="risk-flag-title">No major risks detected</div>
                <div class="risk-flag-impact">Quote appears consistent with expected pricing and scope.</div>
              </div>
            </div>
          `;
        }
        return `
          <div class="risk-flags-module">
            <h3 style="margin:0 0 12px; font-size:16px;">Risk Flags</h3>
            ${flags.filter(f => f.key !== "no_major_risks").map(flag => `
              <div class="risk-flag risk-flag--${flag.severity || "low"}">
                <div class="risk-flag-title">
                  ${escapeHtml(flag.title)}
                  <span class="risk-flag-severity">${escapeHtml(String(flag.severity || "").toUpperCase())}</span>
                </div>
                <div class="risk-flag-impact">${escapeHtml(flag.impact || "")}</div>
                ${flag.action ? `<div class="risk-flag-action">${escapeHtml(flag.action)}</div>` : ""}
              </div>
            `).join("")}
          </div>
        `;
      }
      function renderScopeScorecard(a) {
        const parsed = latestParsed || {};
        const signals = parsed.signals || {};
        const premiumSignals = Array.isArray(parsed.premiumSignals) ? parsed.premiumSignals : [];
        const tiers = [
          {
            label: "Critical",
            color: "#991b1b",
            items: [
              { key: "tearOff", label: "Tear off", weight: 20, why: "Without tear off, problems hide under the new roof" },
              { key: "underlayment", label: "Underlayment", weight: 18, why: "The waterproofing layer — no underlayment means leaks" },
              { key: "flashing", label: "Flashing", weight: 18, why: "#1 cause of roof leaks at walls, pipes, and valleys" }
            ]
          },
          {
            label: "Important",
            color: "#92400e",
            items: [
              { key: "iceShield", label: "Ice & water shield", weight: 12, why: "Required by code in most areas for valleys and penetrations" },
              { key: "dripEdge", label: "Drip edge", weight: 10, why: "Required by code, prevents fascia rot and water intrusion" },
              { key: "ventilation", label: "Ventilation", weight: 10, why: "Poor ventilation cuts shingle lifespan 20-30%" },
              { key: "ridgeVent", label: "Ridge vent", weight: 8, why: "Primary ventilation system for most roofs" }
            ]
          },
          {
            label: "Standard",
            color: "#374151",
            items: [
              { key: "starterStrip", label: "Starter strip", weight: 4, why: "Affects wind resistance at roof edges" },
              { key: "ridgeCap", label: "Ridge cap", weight: 4, why: "Seals and finishes the ridge line" },
              { key: "decking", label: "Decking", weight: 4, why: "Repair allowance — not always needed" },
              { key: "disposal", label: "Disposal", weight: 3, why: "Debris removal and cleanup" },
              { key: "permit", label: "Permit", weight: 2, why: "Building permit — required by code" }
            ]
          }
        ];
        let totalWeight = 0;
        let earnedWeight = 0;
        let criticalMissing = [];
        function renderItem(item) {
          const signal = signals[item.key];
          const status = signal?.status || "unclear";
          totalWeight += item.weight;
          if (status === "included") {
            earnedWeight += item.weight;
            return `<div class="scope-item scope-item--included"><span class="scope-item-icon">&#10003;</span>${escapeHtml(item.label)}</div>`;
          }
          if (status === "excluded") {
            if (item.weight >= 15) criticalMissing.push(item);
            return `<div class="scope-item scope-item--missing"><span class="scope-item-icon">&#10007;</span>${escapeHtml(item.label)}</div>`;
          }
          if (item.weight >= 15) criticalMissing.push(item);
          return `<div class="scope-item scope-item--unclear"><span class="scope-item-icon">?</span>${escapeHtml(item.label)}</div>`;
        }
        const tiersHtml = tiers.map(tier => {
          const itemsHtml = tier.items.map(renderItem).join("");
          return `
            <div style="margin-bottom:16px;">
              <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:${tier.color}; margin-bottom:8px;">${tier.label}</div>
              <div class="scope-grid">${itemsHtml}</div>
            </div>
          `;
        }).join("");
        const scorePct = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;
        const badgeClass = scorePct >= 75 ? "scope-score-badge--good" : scorePct >= 45 ? "scope-score-badge--warn" : "scope-score-badge--bad";
        const scoreLabel = scorePct >= 75 ? "Strong" : scorePct >= 45 ? "Gaps found" : "Weak";
        let warningHtml = "";
        if (criticalMissing.length > 0) {
          warningHtml = `
            <div style="margin-top:14px; padding:12px 16px; background:var(--bad-bg, #fef2f2); border:1px solid var(--bad-line, #fecaca); border-radius:8px;">
              <div style="font-size:14px; font-weight:700; color:#991b1b; margin-bottom:6px;">
                ${criticalMissing.length === 1 ? "1 critical item" : criticalMissing.length + " critical items"} not confirmed
              </div>
              ${criticalMissing.map(item => `
                <div style="font-size:13px; color:#374151; margin-bottom:4px;">
                  <strong>${escapeHtml(item.label)}</strong> &mdash; ${escapeHtml(item.why)}
                </div>
              `).join("")}
            </div>
          `;
        }
        const premiumHtml = premiumSignals.length > 0
          ? `<div class="scope-premium">Premium signals: ${premiumSignals.map(s => escapeHtml(s)).join(", ")}</div>`
          : "";
        return `
          <div class="scope-scorecard">
            <div class="scope-header">
              <h3>Scope Check</h3>
              <span class="scope-score-badge ${badgeClass}">${scoreLabel} (${scorePct}%)</span>
            </div>
            ${tiersHtml}
            ${warningHtml}
            ${premiumHtml}
          </div>
        `;
      }
      const scopeReviewState = {};
      function renderBeforeYouSign(a) {
        if (!a) return "";
        const parsed = latestParsed || {};
        const signals = parsed.signals || {};
        const scopeItems = [
          { key: "tearOff", label: "Tear off", why: "Removes old roof to inspect decking" },
          { key: "underlayment", label: "Underlayment", why: "Waterproofing layer under shingles" },
          { key: "flashing", label: "Flashing", why: "#1 source of roof leaks" },
          { key: "iceShield", label: "Ice & water shield", why: "Code-required in valleys" },
          { key: "dripEdge", label: "Drip edge", why: "Protects fascia from water" },
          { key: "ventilation", label: "Ventilation", why: "Extends shingle lifespan" },
          { key: "ridgeVent", label: "Ridge vent", why: "Primary roof ventilation" },
          { key: "starterStrip", label: "Starter strip", why: "Wind resistance at edges" },
          { key: "ridgeCap", label: "Ridge cap", why: "Seals the ridge line" },
          { key: "decking", label: "Decking", why: "Repair allowance if needed" },
          { key: "disposal", label: "Disposal", why: "Debris removal and cleanup" },
          { key: "permit", label: "Permit", why: "Building permit" }
        ];
        scopeItems.forEach(item => {
          if (!(item.key in scopeReviewState)) {
            scopeReviewState[item.key] = signals[item.key]?.status === "included";
          }
        });
        const confirmed = scopeItems.filter(i => scopeReviewState[i.key]);
        const unconfirmed = scopeItems.filter(i => !scopeReviewState[i.key]);
        const confirmedHtml = confirmed.length > 0
          ? confirmed.map(item =>
              `<button onclick="toggleScopeItem('${item.key}')" style="display:inline-flex; align-items:center; gap:4px; padding:6px 12px; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:999px; font-size:13px; color:#166534; font-weight:500; cursor:pointer; transition:all 0.15s;" title="Click to mark as not included">&#10003; ${escapeHtml(item.label)}</button>`
            ).join(" ")
          : "";
        const unconfirmedHtml = unconfirmed.length > 0
          ? unconfirmed.map(item =>
              `<button onclick="toggleScopeItem('${item.key}')" style="display:inline-flex; align-items:center; gap:4px; padding:6px 12px; background:#fffbeb; border:1px solid #fde68a; border-radius:999px; font-size:13px; color:#92400e; font-weight:500; cursor:pointer; transition:all 0.15s;" title="Click if this IS in your quote">? ${escapeHtml(item.label)}</button>`
            ).join(" ")
          : "";
        let contextLine = "";
        const pricingMeta = a?.meta?.pricing || {};
        const deltaFromMid = pricingMeta?.deltaFromMid ?? (a.quotePrice - a.mid);
        if (deltaFromMid < -500 && unconfirmed.length > 0) {
          contextLine = `<div style="font-size:13px; color:#92400e; padding:8px 12px; background:rgba(217,119,6,0.06); border-radius:6px; margin-top:14px;">Your quote is below expected. Low bids often exclude items above.</div>`;
        }
        const contractorName = parsed.contractor && parsed.contractor !== "Not detected" ? repairDisplayText(parsed.contractor) : "contractor";
        const emailCount = unconfirmed.length;
        return `
          <div id="scopeReviewCard" style="padding:24px; border:1px solid ${unconfirmed.length === 0 ? "#a7f3d0" : unconfirmed.length <= 3 ? "#fde68a" : "#fecaca"}; border-radius:14px; margin-bottom:16px; background:#fff;">
            <div style="font-size:18px; font-weight:700; margin-bottom:6px;">What we found in your quote</div>
            <div style="font-size:13px; color:var(--muted); margin-bottom:14px;">Tap any item to correct it</div>
            ${confirmedHtml ? `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px;">${confirmedHtml}</div>` : ""}
            ${unconfirmedHtml ? `
              <div style="font-size:13px; font-weight:600; color:#92400e; margin-bottom:8px;">Not found — tap if included in your quote:</div>
              <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:4px;">${unconfirmedHtml}</div>
            ` : `
              <div style="padding:10px; text-align:center; color:#166534; font-weight:600; background:#ecfdf5; border-radius:8px; margin-top:8px;">All items confirmed. Quote looks complete.</div>
            `}
            ${contextLine}
            <div class="action-buttons" style="margin-top:16px;">
              ${emailCount > 0
                ? `<button class="btn" id="emailContractorBtn" onclick="emailContractorQuestions()">Email ${escapeHtml(contractorName)} about ${emailCount} item${emailCount !== 1 ? "s" : ""}</button>`
                : `<button class="btn" onclick="showShareScreen()">Share this result</button>`
              }
              <button class="btn secondary" onclick="showCompareScreen()">Upload another quote</button>
            </div>
          </div>
        `;
      }
      window.toggleScopeItem = function toggleScopeItem(key) {
        scopeReviewState[key] = !scopeReviewState[key];
        const a = window.__latestAnalysis;
        if (!a) return;
        const card = document.getElementById("scopeReviewCard");
        if (card) {
          const temp = document.createElement("div");
          temp.innerHTML = renderBeforeYouSign(a);
          const newCard = temp.firstElementChild;
          if (newCard) card.replaceWith(newCard);
        }
      };
      window.emailContractorQuestions = function emailContractorQuestions() {
        const a = window.__latestAnalysis || {};
        const parsed = latestParsed || {};
        const contractorName = parsed.contractor && parsed.contractor !== "Not detected" ? repairDisplayText(parsed.contractor) : "your team";
        const quotePrice = a.quotePrice ? safeFormatCurrency(a.quotePrice) : "my estimate";
        const scopeItems = [
          { key: "tearOff", label: "Tear off (removal of existing roof)" },
          { key: "underlayment", label: "Underlayment (waterproofing layer)" },
          { key: "flashing", label: "Flashing replacement (walls, pipes, valleys)" },
          { key: "iceShield", label: "Ice and water shield" },
          { key: "dripEdge", label: "Drip edge" },
          { key: "ventilation", label: "Ventilation" },
          { key: "ridgeVent", label: "Ridge vent" },
          { key: "starterStrip", label: "Starter strip" },
          { key: "ridgeCap", label: "Ridge cap" },
          { key: "decking", label: "Decking repair allowance" }
        ];
        const missing = scopeItems.filter(i => !scopeReviewState[i.key]);
        if (missing.length === 0) return;
        const itemList = missing.map(i => "- " + i.label).join("\n");
        const subject = encodeURIComponent("Questions about my roofing estimate (" + (a.quotePrice ? "$" + Number(a.quotePrice).toLocaleString() : "") + ")");
        const body = encodeURIComponent(
          "Hi " + contractorName + ",\n\n" +
          "Before I move forward with the " + quotePrice + " estimate, can you confirm whether the following items are included?\n\n" +
          itemList + "\n\n" +
          "If any of these are not included, can you let me know what the additional cost would be?\n\n" +
          "Also, can you provide the warranty terms in writing?\n\n" +
          "Thank you"
        );
        window.open("mailto:?subject=" + subject + "&body=" + body, "_self");
      };
      window.emailReport = function emailReport() {
        const a = window.__latestAnalysis || {};
        const report = typeof buildShareableReportData === "function" ? buildShareableReportData() : null;
        const reportText = report && typeof buildShareableReportText === "function" ? buildShareableReportText(report) : "";
        if (!reportText) return;
        const verdict = a.verdict || "Analysis";
        const price = a.quotePrice ? "$" + Number(a.quotePrice).toLocaleString() : "";
        const subject = encodeURIComponent("Roof Quote Analysis" + (price ? " (" + price + ")" : "") + " - TruePrice");
        const body = encodeURIComponent(reportText);
        window.open("mailto:?subject=" + subject + "&body=" + body, "_self");
      };
      window.copyBeforeYouSignChecklist = function copyBeforeYouSignChecklist() {
        const scopeItems = [
          { key: "tearOff", label: "Tear off" },
          { key: "underlayment", label: "Underlayment" },
          { key: "flashing", label: "Flashing" },
          { key: "iceShield", label: "Ice & water shield" },
          { key: "dripEdge", label: "Drip edge" },
          { key: "ventilation", label: "Ventilation" },
          { key: "ridgeVent", label: "Ridge vent" },
          { key: "starterStrip", label: "Starter strip" },
          { key: "ridgeCap", label: "Ridge cap" },
          { key: "decking", label: "Decking" },
          { key: "disposal", label: "Disposal" },
          { key: "permit", label: "Permit" },
        ];
        const missing = scopeItems.filter(i => !scopeReviewState[i.key]);
        const text = "Items to confirm with contractor:\n" + missing.map((t, i) => (i + 1) + ". " + t.label).join("\n");
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(() => alert("Copied.")).catch(() => prompt("Copy:", text));
        } else {
          prompt("Copy:", text);
        }
      };
      function renderMarketContext(a) {
        if (!a) return "";
        const city = a?.city || "";
        const state = a?.stateCode || "";
        const location = city && state ? `${escapeHtml(city)}, ${escapeHtml(state)}` : "your area";
        const roofMeta = a?.meta?.roofSize || {};
        const roofSizeValue = roofMeta?.value ?? a?.roofSize ?? null;
        const roofSizeSource = roofMeta?.source || a?.roofSizeEstimateSource || "";
        const ppsf = a.roofSize > 0 ? (a.quotePrice / a.roofSize).toFixed(2) : null;
        const analysisCount = parseInt(localStorage.getItem('tp_analysis_count') || '0', 10);
        const communityNote = analysisCount > 3
          ? `<div style="margin-top:12px; padding:10px 14px; background:var(--bg-subtle, #f8fafc); border-radius:8px; font-size:13px; color:var(--text-muted);">Based on TruePrice pricing models covering 1,000+ U.S. cities. You have analyzed ${analysisCount} quotes.</div>`
          : `<div style="margin-top:12px; padding:10px 14px; background:var(--bg-subtle, #f8fafc); border-radius:8px; font-size:13px; color:var(--text-muted);">Based on TruePrice pricing models covering 1,000+ U.S. cities.</div>`;
        return `
          <div class="market-panel">
            <h3>Market Context — ${location}</h3>
            <table class="market-table">
              <tr><td>Your quote</td><td>${safeFormatCurrency(a.quotePrice)}${ppsf ? ` ($${ppsf}/sqft)` : ""}</td></tr>
              <tr><td>Expected midpoint</td><td>${safeFormatCurrency(a.mid)}</td></tr>
              <tr><td>Expected range</td><td>${safeFormatCurrency(a.low)} &ndash; ${safeFormatCurrency(a.high)}</td></tr>
              <tr><td>Material</td><td>${escapeHtml(typeof getMaterialLabel === "function" ? getMaterialLabel(a.material) : a.material || "Unknown")}</td></tr>
              <tr><td>Roof size</td><td>${roofSizeValue ? formatRoofSizeForDisplay(roofSizeValue, roofSizeSource, roofMeta?.confidence || "Low") : "Unknown"}</td></tr>
              ${a.warrantyYears ? `<tr><td>Warranty</td><td>${escapeHtml(String(a.warrantyYears))} years</td></tr>` : ""}
            </table>
            ${communityNote}
          </div>
        `;
      }
      function renderShareModule(a) {
        const analysisCount = parseInt(localStorage.getItem('tp_analysis_count') || '0', 10);
        const historyHtml = (() => {
          try {
            const history = JSON.parse(localStorage.getItem("tp_quote_history") || "[]");
            if (history.length <= 1) return "";
            return '<div style="margin-bottom:12px; font-size:13px; color:var(--muted);"><strong>Your past analyses:</strong><br>' +
              history.slice(0, 5).map(h =>
                escapeHtml((h.contractor || "Quote") + " — " + safeFormatCurrency(h.price) + " — " + (h.verdict || ""))
              ).join("<br>") + '</div>';
          } catch(e) { return ""; }
        })();
        return `
          <div class="share-module">
            <div style="font-size:16px; font-weight:600; margin-bottom:12px;">Save or share this result</div>
            <div style="font-size:12px; color:var(--muted); margin-bottom:8px;">${analysisCount > 0 ? 'You have analyzed ' + analysisCount + ' quote' + (analysisCount > 1 ? 's' : '') + ' with TruePrice' : ''}</div>
            ${historyHtml}
            <div class="action-buttons">
              <button class="btn secondary" onclick="copyShareableReportText()">Copy result</button>
              <button class="btn secondary" onclick="showShareScreen()">View full report</button>
              <a class="btn secondary" href="/roofing-quote-analyzer.html" style="text-decoration:none;">Start over</a>
            </div>
          </div>
        `;
      }
      function renderMainAnalysisResult(a) {
        if (!a) return "";
        const meta = a?.meta || {};
        const roofMeta = meta?.roofSize || {};
        const pricingMeta = meta?.pricing || {};
        const confidenceMeta = meta?.confidence || {};
        const confidenceLabel = confidenceMeta?.overallTier || a?.confidenceLabel || "Low";
        const confidenceScore = confidenceMeta?.overallScore ?? a?.confidenceScore ?? 0;
        const deltaFromMid = pricingMeta?.deltaFromMid ?? (a.quotePrice - a.mid);
        const deltaAbs = Math.abs(deltaFromMid);
        const deltaDirection = deltaFromMid > 0 ? "above" : "below";
        const deltaText =
          isFinite(deltaAbs) && deltaAbs > 0
            ? `You are ${formatCurrency(deltaAbs)} ${deltaDirection} expected`
            : "";
        const roofSizeValue = roofMeta?.value ?? a?.roofSize ?? null;
        const roofSizeSource = roofMeta?.source || a?.roofSizeEstimateSource || "";
        const roofSizeConfidence = roofMeta?.confidence || a?.roofSizeEstimateConfidence || "Low";
        const roofSizeEstimated =
          typeof roofMeta?.estimated === "boolean"
            ? roofMeta.estimated
            : ["living_area_fallback", "price_based_estimate", "address_estimated"].includes(
                String(roofSizeSource).toLowerCase()
              );
        const verdictClass = getVerdictClassName(a?.verdict);
        const decisionDeltaHtml =
          String(a?.verdict || "").toLowerCase().includes("fair")
            ? ""
            : (
                typeof buildDecisionDeltaHtml === "function"
                  ? buildDecisionDeltaHtml(a)
                  : ""
              );
        const recommendation = a?.recommendation || {};
        const action = String(recommendation.action || "").toUpperCase();
        let primaryCta = "";
        let secondaryCta = "";
        if (action === "NEGOTIATE") {
          primaryCta = `<button class="btn" onclick="showNegotiateScreen()">Negotiate this quote</button>`;
          secondaryCta = `<button class="btn secondary" onclick="showCompareScreen()">Compare another quote</button>`;
        } else if (action === "AVOID") {
          primaryCta = `<button class="btn" onclick="showCompareScreen()">Compare another quote</button>`;
          secondaryCta = `<button class="btn secondary" onclick="showNegotiateScreen()">Ask contractor questions</button>`;
        } else if (action === "PROCEED") {
          primaryCta = `<button class="btn" onclick="showCompareScreen()">Compare another quote</button>`;
          secondaryCta = `<button class="btn secondary" onclick="showShareScreen()">Share this result</button>`;
        } else {
          primaryCta = `<button class="btn" onclick="showNegotiateScreen()">Review this quote</button>`;
          secondaryCta = `<button class="btn secondary" onclick="showCompareScreen()">Compare another quote</button>`;
        }
        return `
          <div style="max-width:640px; margin:40px auto;">
            <div class="verdict ${verdictClass}" style="font-size:44px; font-weight:800; margin:0 0 6px;">
              ${a.verdict === "Overpriced"
              ? "This quote looks overpriced"
              : a.verdict === "Higher Than Expected"
                ? "This quote looks high"
                : a.verdict === "Fair Price"
                  ? "This quote looks fair"
                  : a.verdict === "Unusually Low"
                    ? "This quote looks unusually low"
                    : a.verdict}
                        </div>
            <div style="margin:0 0 10px;">
              <span class="pill" style="
                background:#f1f5f9;
                color:#0f172a;
                font-weight:600;
              ">
                Confidence: ${escapeHtml(confidenceLabel)}
              </span>
            </div>
            ${
              deltaText
                ? `
                  <div style="margin:0 0 14px; font-size:18px; font-weight:600;">
                    ${deltaText}
                  </div>
                `
                : ""
            }
            <div class="small muted" style="margin:0 0 14px; font-size:13px;">
              ${
                [
                  roofMeta?.source ? `Roof size derived from ${roofMeta.source.replaceAll("_", " ")}` : null,
                  roofMeta?.consistency?.status === "aligned"
                    ? "Multiple signals agree on roof size"
                    : roofMeta?.consistency?.hasConflict
                      ? "Some data signals conflict - review recommended"
                      : null
                ]
                  .filter(Boolean)
                  .slice(0, 2)
                  .map(x => `• ${escapeHtml(x)}`)
                  .join("<br>")
              }
            </div>
            <p class="small muted" style="margin:0 0 6px; font-size:14px;">
              ${buildLocalizedVerdictExplanation(a)}
            </p>
            <div class="small muted" style="margin:0 0 8px; font-size:14px;">
              ${buildRangeLine(a)}
            </div>
            <div class="small muted" style="margin:0 0 20px; font-size:14px;">
            Roof size used: ${formatRoofSizeForDisplay(
              roofSizeValue,
              roofSizeSource,
              roofSizeConfidence
            )}
            ${
              String(roofSizeSource).toLowerCase() === "living_area_fallback"
                ? " · Estimated from home size — you can edit if needed."
                : String(roofSizeSource).toLowerCase() === "price_based_estimate"
                  ? " · Estimated from pricing only — verify for accuracy."
                  : roofSizeEstimated
                    ? " · Estimated value."
                    : ""
            }
          </div>
            ${
              String(a?.verdict || "").toLowerCase().includes("fair")
                ? ""
                : `
                  <div style="margin:0 0 24px;">
                    ${decisionDeltaHtml}
                  </div>
                `
            }
            <div style="display:flex; gap:10px; flex-wrap:wrap; margin:0 0 20px;">
              ${primaryCta}
              ${secondaryCta}
            </div>
            <div style="display:flex; gap:16px; flex-wrap:wrap; font-size:14px;">
              <a href="#" onclick="showDetailsScreen(); return false;" class="muted">See how we analyzed this</a>
              <a href="#" onclick="showShareScreen(); return false;" class="muted">Share this result</a>
            </div>
          </div>
        `;
      }
      function buildLocalizedVerdictExplanation(a) {
        const city =
          a?.city ||
          journeyState?.propertyPreview?.city ||
          "";
        const verdict = String(a?.verdict || "").toLowerCase();
        if (!city) {
          return `This quote is in line with typical pricing.`;
        }
        if (verdict.includes("fair")) {
          return `In the ${city} area, this quote is right in line with typical pricing.`;
        }
        if (verdict.includes("higher") || verdict.includes("over")) {
          return `In the ${city} area, this quote appears higher than typical pricing.`;
        }
        if (verdict.includes("low") || verdict.includes("below")) {
          return `In the ${city} area, this quote appears lower than typical pricing.`;
        }
        return `In the ${city} area, this quote reflects typical pricing conditions.`;
      }
      function buildRangeLine(a) {
        const low = safeFormatCurrency(Math.round(a?.low || 0));
        const high = safeFormatCurrency(Math.round(a?.high || 0));
        return `Typical range: ${low} – ${high}`;
      }
      function copyParsedToForm() {
        clearManualFieldHighlights();
        if (!latestParsed) {
          setUploadStatus("No parsed quote data is available yet.", "warn");
          return;
        }
        const cityName = byId("cityName");
        const stateCode = byId("stateCode");
        const roofSize = byId("roofSize");
        const quotePrice = byId("quotePrice");
        const materialType = byId("materialType");
        const warrantyYears = byId("warrantyYears");
        const tearOffIncluded = byId("tearOffIncluded");
        if (shouldPromoteAddress(latestParsed)) {
        if (cityName && !cityName.value) cityName.value = latestParsed.city || latestParsed.address?.city || "";
        if (stateCode && !stateCode.value) stateCode.value = latestParsed.stateCode || latestParsed.address?.stateCode || "";
      }
        if (roofSize) roofSize.value = latestParsed.roofSize || "";
        if (quotePrice) {
          quotePrice.value =
            latestParsed.finalBestPrice ||
            latestParsed.totalLinePrice ||
            latestParsed.price ||
            "";
        }
        if (materialType) {
          materialType.value = normalizeMaterialForForm(latestParsed.material, latestParsed.materialLabel);
        }
        if (warrantyYears) warrantyYears.value = latestParsed.warrantyYears || "";
        if (tearOffIncluded) tearOffIncluded.value = normalizeTearOffForUi(latestParsed);
      }
      async function analyzeParsedText(parsedText, extractionMethod) {
          latestExtractedText = String(parsedText || "");
          setSmartUploadStatus("identify", 68);
          if (typeof parseExtractedText !== "function") {
            throw new Error("parseExtractedText is not available.");
          }
          const parsed = parseExtractedText(latestExtractedText, {
            extractionMethod: extractionMethod || "image_ocr"
          });
          latestParsed = parsed;
          copyParsedToForm();
          if (parsed?.address) {
            const addr = parsed.address;
            const hasAddress =
              addr.street && (addr.city || addr.zip) && addr.stateCode;
            if (hasAddress) {
              journeyState.propertyPreview = {
                street: addr.street || "",
                apt: "",
                city: addr.city || "",
                state: addr.stateCode || "",
                zip: addr.zip || ""
              };
              journeyState.propertyConfirmed = true;
            }
          }
          const parsedAddress = {
            street: parsed?.address?.street || "",
            city: parsed?.city || parsed?.address?.city || "",
            state: parsed?.stateCode || parsed?.address?.stateCode || "",
            zip: parsed?.address?.zip || ""
          };
          const hasStrongAddress =
            parsedAddress.street &&
            parsedAddress.city &&
            parsedAddress.state &&
            String(parsedAddress.state).length === 2;
          journeyState.propertyPreview = {
            street: parsedAddress.street,
            apt: "",
            city: parsedAddress.city,
            state: parsedAddress.state,
            zip: parsedAddress.zip
          };
          if (hasStrongAddress) {
            setJourneyStep("confirm");
            return;
          } else {
            setJourneyStep("address");
            return;
          }
          if (typeof getSmartQuoteData === "function") {
            try {
              latestSmartQuote = await getSmartQuoteData(latestExtractedText);
            } catch {
              latestSmartQuote = null;
            }
          }
          setSmartUploadStatus("done", 100);
        }
    function renderAnalysisResultUi(analysis, parsed) {
      const resultContainer = byId("analysisOutput");
      const aiOutput = byId("aiAnalysisOutput");
      if (!resultContainer || !aiOutput || !analysis) return;
      resultContainer.innerHTML = renderMainAnalysisResult(analysis);
      aiOutput.innerHTML = `
        <div class="panel" style="margin-top:18px;">
          <button 
            type="button" 
            class="btn btn-ghost" 
            id="toggleAiExplanationBtn"
            style="width:100%; text-align:left;"
          >
            See how this was calculated
          </button>
          <div id="aiExplanationContent" style="display:none; margin-top:12px;">
            <p class="small muted" style="margin:0;">
              ${buildAIExplanation(analysis)}
            </p>
          </div>
        </div>
      `;
      renderAnalysisPanels(parsed || {});
      bindRenderedAnalysisUi();
      const aiToggleBtn = byId("toggleAiExplanationBtn");
      const aiContent = byId("aiExplanationContent");
      if (aiToggleBtn && aiContent && aiToggleBtn.dataset.bound !== "true") {
        aiToggleBtn.addEventListener("click", () => {
          const isOpen = aiContent.style.display === "block";
          aiContent.style.display = isOpen ? "none" : "block";
          aiToggleBtn.innerText = isOpen
            ? "See how this was calculated"
            : "Hide explanation";
        });
        aiToggleBtn.dataset.bound = "true";
      }
    }
    function buildRoofSizeConsistencySummary(signals = {}) {
      const parsed = normalizeRoofSizeValue(signals?.parsed);
      const property = normalizeRoofSizeValue(signals?.property);
      const priceImplied = normalizeRoofSizeValue(signals?.priceImplied);
      const values = [
        { key: "parsed", value: parsed, label: "Quote" },
        { key: "property", value: property, label: "Property" },
        { key: "priceImplied", value: priceImplied, label: "Price model" }
      ].filter(item => item.value && item.value > 0);
      if (!values.length) {
        return {
          hasConflict: false,
          severity: "none",
          status: "unavailable",
          summary: "No roof size signals were available.",
          details: []
        };
      }
      if (values.length === 1) {
        return {
          hasConflict: false,
          severity: "none",
          status: "single_signal",
          summary: `${values[0].label} was the only roof size signal available.`,
          details: values
        };
      }
      const numericValues = values.map(v => v.value);
      const min = Math.min(...numericValues);
      const max = Math.max(...numericValues);
      const spreadPct = min > 0 ? (max - min) / min : 0;
      if (spreadPct <= 0.12) {
        return {
          hasConflict: false,
          severity: "low",
          status: "aligned",
          summary: "Roof size signals are generally aligned.",
          details: values
        };
      }
      if (spreadPct <= 0.25) {
        return {
          hasConflict: true,
          severity: "medium",
          status: "mixed",
          summary: "Roof size signals are directionally similar but not fully aligned.",
          details: values
        };
      }
      return {
        hasConflict: true,
        severity: "high",
        status: "conflicting",
        summary: "Roof size signals conflict materially and should be reviewed.",
        details: values
      };
    }
    function shouldShowRoofSizeSuggestion(analysis) {
      const roofMeta = analysis?.meta?.roofSize || null;
      const value = roofMeta?.value ?? analysis?.roofSizeEstimate ?? analysis?.roofSize ?? null;
      const source = String(roofMeta?.source || analysis?.roofSizeEstimateSource || "").toLowerCase();
      const estimated = roofMeta?.estimated ?? (
        source === "living_area_fallback" ||
        source === "price_based_estimate" ||
        source === "address_estimated"
      );
      return !!(value && estimated);
    }
    function buildNormalizedAnalysisMeta({
      effectiveRoofSize,
      effectiveRoofSizeSource,
      effectiveRoofSizeConfidence,
      effectiveRoofSizeConfidenceScore,
      roofSizeEstimate,
      roofSizeSignals,
      roofSizeConsistency,
      quotePrice,
      low,
      mid,
      high,
      derivedAnalysisConfidenceLabel,
      derivedConfidenceScore,
      reliabilityTier
    }) {
      const normalizedSource = String(effectiveRoofSizeSource || "unavailable").toLowerCase();
      const estimated =
        normalizedSource !== "user_input" &&
        normalizedSource !== "manual_calculator" &&
        normalizedSource !== "parsed_quote";
      const benchmarkLow = Number(low || 0);
      const benchmarkMid = Number(mid || 0);
      const benchmarkHigh = Number(high || 0);
      const quote = Number(quotePrice || 0);
      const deltaFromMid = quote - benchmarkMid;
      const deltaFromLow = quote - benchmarkLow;
      const deltaPctFromMid =
        benchmarkMid > 0 ? Number((((quote - benchmarkMid) / benchmarkMid) * 100).toFixed(1)) : null;
      return {
        roofSize: {
          value: normalizeRoofSizeValue(effectiveRoofSize),
          source: normalizedSource,
          confidence: effectiveRoofSizeConfidence || "Low",
          confidenceScore: Number(effectiveRoofSizeConfidenceScore || 0),
          estimated,
          reasoning: String(roofSizeEstimate?.reasoning || ""),
          signals: {
            userInput: normalizedSource === "user_input" || normalizedSource === "manual_calculator"
              ? normalizeRoofSizeValue(effectiveRoofSize)
              : null,
            parsed: normalizeRoofSizeValue(roofSizeSignals?.parsed),
            property: normalizeRoofSizeValue(roofSizeSignals?.property),
            priceImplied: normalizeRoofSizeValue(roofSizeSignals?.priceImplied)
          },
          consistency: {
            status: roofSizeConsistency?.status || "unavailable",
            severity: roofSizeConsistency?.severity || "none",
            hasConflict: !!roofSizeConsistency?.hasConflict,
            summary: roofSizeConsistency?.summary || "",
            details: Array.isArray(roofSizeConsistency?.details) ? roofSizeConsistency.details : []
          }
        },
        pricing: {
          quotePrice: quote,
          benchmarkLow,
          benchmarkMid,
          benchmarkHigh,
          deltaFromMid,
          deltaFromLow,
          deltaPctFromMid
        },
        confidence: {
          overallTier: reliabilityTier?.label || derivedAnalysisConfidenceLabel || "Low",
          overallScore: Number(derivedConfidenceScore || 0),
          reasons: Array.isArray(roofSizeEstimate?.reasons)
            ? roofSizeEstimate.reasons
            : []
        }
      };
    }
    async function analyzeQuote() {
        const analyzingEl = document.getElementById("inlineAnalyzingState");
        if (analyzingEl) analyzingEl.innerHTML = "";
        track("analysis_started");
        const city = (byId("cityName")?.value || "").trim();
        const stateCode = (byId("stateCode")?.value || "").trim().toUpperCase();
        const streetAddress = (byId("streetAddress")?.value || "").trim();
        const zipCode = (byId("zipCode")?.value || "").trim();
        const roofSize = Number(byId("roofSize")?.value || 0);
        const quotePrice = Number(byId("quotePrice")?.value || 0);
        const material = byId("materialType")?.value || "architectural";
        const complexityFactor = Number(byId("complexityFactor")?.value || 1.0);
        const tearOffFactor = Number(byId("tearOffIncluded")?.value || 1.0);
        const warrantyYears = Number(byId("warrantyYears")?.value || 0);
        const resultContainer = byId("analysisOutput");
        const aiOutput = byId("aiAnalysisOutput");
        if (!resultContainer || !aiOutput) return;
        const roofSizeEstimate =
          typeof estimateRoofSize === "function"
            ? await estimateRoofSize({
                address: {
                  street: streetAddress,
                  city,
                  stateCode,
                  zip: zipCode,
                  fullAddress: [streetAddress, city, stateCode, zipCode].filter(Boolean).join(", ")
                },
                parsed: latestParsed || {},
                userInput: {
                  roofSize,
                  quotePrice,
                  material,
                  complexityFactor,
                  tearOffFactor
                }
              })
            : {
                roofSize: roofSize || null,
                confidence: roofSize ? "High" : "Low",
                confidenceScore: roofSize ? 95 : 20,
                source: roofSize ? "user_input" : "unavailable",
                reasoning: roofSize
                  ? `Using user provided roof size of ${safeFormatNumber(roofSize)} sq ft.`
                  : "No reliable roof size was available.",
                meta: {
                  fallbackUsed: true
                }
              };
        const roofSizeInput = byId("roofSize");
        const enteredRoofSize = Number(roofSizeInput?.value || 0);
        const roofSizeInputSource = roofSizeInput?.dataset?.source || "";
        const roofSizeInputConfidence = roofSizeInput?.dataset?.confidence || "";
        const userEnteredRoofSize =
          isFinite(enteredRoofSize) && enteredRoofSize > 0 ? enteredRoofSize : null;
        const effectiveRoofSize =
          userEnteredRoofSize && userEnteredRoofSize > 0
            ? userEnteredRoofSize
            : (roofSizeEstimate?.roofSize || 0);
        if (!effectiveRoofSize || !quotePrice) {
          const parsed = latestParsed || {};
          const missingFieldIds = getMissingManualFields(parsed);
          const manualEntryPromptHtml = buildManualEntryPromptHtml(parsed);
          track("analysis_blocked_missing_fields", {
            hasQuotePrice: !!quotePrice,
            hasEffectiveRoofSize: !!effectiveRoofSize,
            parsedPrice: Number(parsed?.price || 0) > 0,
            parsedRoofSize: Number(parsed?.roofSize || 0) > 0,
            missingFields: missingFieldIds
          });
          clearManualFieldHighlights();
          highlightManualFields(missingFieldIds, {
            isJump: false,
            primaryId: missingFieldIds.includes("roofSize") ? "roofSize" : missingFieldIds[0]
          });
          const detectedPriceText =
            isFinite(Number(parsed?.price)) && Number(parsed.price) > 0
              ? `We detected a quote price of ${safeFormatCurrency(parsed.price)}, but cannot finish the analysis yet.`
              : `We could not confidently detect the full quote price yet.`;
          resultContainer.innerHTML = `
            ${manualEntryPromptHtml}
            <div class="panel" style="background:#fff7ed;border-color:#fdba74;">
              <h4>We found the quote price. Finish the missing details.</h4>
              <p style="margin:0 0 8px;">
                ${detectedPriceText}
              </p>
              <p style="margin:0 0 12px;">
                Add the highlighted fields below, then click Analyze Quote again to finish your pricing result.
              </p>
              <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button type="button" class="btn" id="jumpToMissingFieldsBtn">Jump to missing fields</button>
              </div>
            </div>
          `;
          const jumpBtn = byId("jumpToMissingFieldsBtn");
          if (jumpBtn) {
            jumpBtn.addEventListener("click", () => {
              jumpToMissingManualFields(parsed);
            });
          }
          aiOutput.innerHTML = "We need a few more quote details before generating the full assessment.";
          return;
        }
        const benchmarkMap = {
          architectural: 5.10,
          asphalt: 4.60,
          metal: 10.50,
          tile: 13.75
        };
        let benchmarkPerSqFt =
          typeof getMaterialBenchmarkPerSqFt === "function"
            ? getMaterialBenchmarkPerSqFt(material)
            : benchmarkMap[material] || 5.10;
        let localDataUsed = false;
        let sizeLabelUsed = "";
        if (typeof findCityPricing === "function" && city && stateCode) {
          const cityPricing = findCityPricing(city, stateCode);
          if (cityPricing) {
            localDataUsed = true;
            if (typeof getNearestSizeLabel === "function") {
              sizeLabelUsed = getNearestSizeLabel(cityPricing, effectiveRoofSize);
              const bucket = cityPricing?.sizes?.[sizeLabelUsed];
              const normalizedMaterial =
                String(material || "").toLowerCase().includes("architectural")
                  ? "architectural"
                  : String(material || "").toLowerCase().includes("asphalt")
                    ? "asphalt"
                    : String(material || "").toLowerCase().includes("metal")
                      ? "metal"
                      : String(material || "").toLowerCase().includes("tile")
                        ? "tile"
                        : "architectural";
              if (bucket && bucket[normalizedMaterial]?.mid) {
                benchmarkPerSqFt =
                  Number(bucket[normalizedMaterial].mid) /
                    Number(String(sizeLabelUsed).replace(/[^\d]/g, "")) || benchmarkPerSqFt;
              }
            }
          }
        }
        const adjustedBenchmark = benchmarkPerSqFt * complexityFactor * tearOffFactor;
        const mid = adjustedBenchmark * effectiveRoofSize;
        const low = mid * 0.9;
        const high = mid * 1.12;
        const pricePerSqFt = quotePrice / effectiveRoofSize;
        const pricePerSquare = pricePerSqFt * 100;
        const diff = quotePrice - mid;
        const diffPct = (diff / mid) * 100;
        let verdict = "Fair Price";
        if (quotePrice < low * 0.78) {
          verdict = "Possible Scope Risk";
        } else if (quotePrice < low) {
          verdict = "Unusually Low";
        } else if (quotePrice <= high) {
          verdict = "Fair Price";
        } else if (quotePrice <= high * 1.12) {
          verdict = "Higher Than Expected";
        } else {
          verdict = "Overpriced";
        }
        const roofSizeSignals = {
          userInput: userEnteredRoofSize || null,
          parsed:
            normalizeRoofSizeValue(
              roofSizeEstimate?.meta?.roofSizeSignals?.parsed ||
              latestParsed?.roofSize ||
              null
            ),
          property:
            normalizeRoofSizeValue(
              roofSizeEstimate?.meta?.roofSizeSignals?.property ||
              roofSizeEstimate?.meta?.propertySignals?.footprintSqFt ||
              roofSizeEstimate?.meta?.propertySignals?.livingAreaSqFt ||
              null
            ),
          priceImplied:
            normalizeRoofSizeValue(
              roofSizeEstimate?.meta?.roofSizeSignals?.priceImplied ||
              (String(roofSizeEstimate?.source || "").toLowerCase() === "price_based_estimate"
                ? roofSizeEstimate?.roofSize
                : null)
            )
        };
        const roofSizeConsistency =
          typeof buildRoofSizeConsistencySummary === "function"
            ? buildRoofSizeConsistencySummary(roofSizeSignals)
            : {
                hasConflict: false,
                severity: "none",
                summary: "",
                details: []
              };
        const displayVerdict = softenVerdictForRoofSizeTrust(verdict, roofSizeConsistency);
        const disagreement = roofSizeEstimate?.meta?.disagreement;
        const roofSizeSource = String(roofSizeEstimate?.source || "").toLowerCase();
        const isLivingAreaFallback = roofSizeSource === "living_area_fallback";
        const isUnavailable = roofSizeSource === "unavailable";
        const fallbackUsed = !!roofSizeEstimate?.meta?.fallbackUsed;
        const derivedAnalysisConfidenceLabel =
          isUnavailable
            ? "Low"
            : isLivingAreaFallback
              ? (roofSizeEstimate?.confidence || "Medium")
              : fallbackUsed
                ? "Low"
                : disagreement?.hasDisagreement
                  ? (disagreement.severity === "high" ? "Low" : "Medium")
                  : (roofSizeEstimate?.confidence || latestParsed?.confidenceLabel || "Low");
        const derivedConfidenceScore =
          isUnavailable
            ? 35
            : isLivingAreaFallback
              ? (roofSizeEstimate?.confidenceScore ?? 58)
              : fallbackUsed
                ? 35
                : disagreement?.hasDisagreement
                  ? (disagreement.severity === "high" ? 35 : 55)
                  : (roofSizeEstimate?.confidenceScore ?? latestParsed?.confidenceScore ?? 50);
        const propertySignalsMeta =
          roofSizeEstimate?.meta?.propertySignalsMeta ||
          roofSizeEstimate?.meta?.propertySignals ||
          {};
        const effectiveRoofSizeSource =
          userEnteredRoofSize && roofSizeInputSource === "manual_calculator"
            ? "manual_calculator"
            : (roofSizeEstimate?.source || "unavailable");
        const effectiveRoofSizeConfidence =
          userEnteredRoofSize && roofSizeInputConfidence === "manual_estimate"
            ? "Medium"
            : (roofSizeEstimate?.confidence || "Low");
        const effectiveRoofSizeConfidenceScore =
          userEnteredRoofSize && roofSizeInputSource === "manual_calculator"
            ? Math.max(65, Number(derivedConfidenceScore || 0))
            : derivedConfidenceScore;
        const reliabilityTier = getReliabilityTier({
          source: effectiveRoofSizeSource,
          confidenceScore: effectiveRoofSizeConfidenceScore,
          disagreement: roofSizeEstimate?.meta?.disagreement || null
        });
        const decisionDelta = buildDecisionDelta({
          quotePrice,
          low,
          mid,
          high
        });
        const riskFlags = buildRiskFlags({
        rawVerdict: verdict,
        verdict: displayVerdict,
        roofSizeConsistency,
        propertySignalsMeta,
        pricePerSqFt,
        reliabilityTier,
        missingSignals: latestParsed?.missingSignals || []
      });
        const recommendation = buildRecommendation({
          rawVerdict: verdict,
          verdict: displayVerdict,
          reliabilityTier,
          roofSizeConsistency,
          propertySignalsMeta,
          riskFlags,
          decisionDelta
        });
       const previewAnalysis = {
        verdict: displayVerdict,
        rawVerdict: verdict,
        quotePrice,
        low,
        mid,
        high,
        riskFlags,
        recommendation,
        decisionDelta,
        reliabilityTier,
        missingSignals: latestParsed?.missingSignals || [],
        material,
        roofSize: effectiveRoofSize,
        city,
        stateCode,
        localDataUsed,
        sizeLabelUsed,
        warrantyYears,
        analysisConfidenceLabel: derivedAnalysisConfidenceLabel,
        confidenceScore: derivedConfidenceScore,
        confidenceLabel: derivedAnalysisConfidenceLabel,
        pricePerSqFt,
        pricePerSquare,
        roofSizeEstimate: roofSizeEstimate?.roofSize ?? null,
        roofSizeEstimateConfidence: effectiveRoofSizeConfidence,
        roofSizeEstimateConfidenceScore: effectiveRoofSizeConfidenceScore,
        roofSizeEstimateSource: effectiveRoofSizeSource,
        roofSizeEstimateReasoning: roofSizeEstimate?.reasoning || "",
        roofSizeEstimateMeta: roofSizeEstimate?.meta || {},
        meta: buildNormalizedAnalysisMeta({
          effectiveRoofSize,
          effectiveRoofSizeSource,
          effectiveRoofSizeConfidence,
          effectiveRoofSizeConfidenceScore,
          roofSizeEstimate,
          roofSizeSignals,
          roofSizeConsistency,
          quotePrice,
          low,
          mid,
          high,
          derivedAnalysisConfidenceLabel,
          derivedConfidenceScore,
          reliabilityTier
      }),
        propertySignalsMeta,
        livingAreaSqFt:
        roofSizeEstimate?.meta?.livingAreaSqFt ||
        roofSizeEstimate?.meta?.propertySignals?.livingAreaSqFt ||
        null,
        roofSizeNeedsReview:
          !!roofSizeEstimate?.meta?.disagreement?.hasDisagreement ||
          !!propertySignalsMeta?.ambiguous ||
          !!roofSizeEstimate?.meta?.fallbackUsed ||
          String(roofSizeEstimate?.source || "").toLowerCase() === "unavailable",
        roofSizeSignals,
        signalComparison: {
          parsed: roofSizeSignals?.parsed || null,
          property: roofSizeSignals?.property || null,
          priceImplied: roofSizeSignals?.priceImplied || null,
          selected: effectiveRoofSizeSource,
          explanation: buildSignalComparisonReasoning({
            roofSizeEstimateSource: effectiveRoofSizeSource,
            propertySignalsMeta,
            roofSizeEstimateMeta: roofSizeEstimate?.meta || {}
          })
        },
        roofSizeConsistency,
        roofSizeInputSource,
        roofSizeInputConfidence,
        userEnteredRoofSize
      };
        const tearOffValue = byId("tearOffIncluded")?.value || "1.00";
        const tearOffLabel =
          tearOffValue === "1.05" ? "yes" : tearOffValue === "0.97" ? "no" : "unknown";
        latestAnalysis = {
          verdict: displayVerdict,
          rawVerdict: verdict,
          quotePrice,
          low,
          mid,
          high,
          riskFlags,
          recommendation,
          decisionDelta,
          reliabilityTier,
          missingSignals: latestParsed?.missingSignals || [],
          material,
          roofSize: effectiveRoofSize,
          userEnteredRoofSize,
          roofSizeInputSource,
          roofSizeInputConfidence,
          city,
          stateCode,
          localDataUsed,
          sizeLabelUsed,
          tearOffLabel,
          warrantyYears,
          premiumSignals: latestParsed?.premiumSignals || [],
          analysisConfidenceLabel: derivedAnalysisConfidenceLabel,
          confidenceScore: derivedConfidenceScore,
          confidenceLabel: derivedAnalysisConfidenceLabel,
          pricePerSqFt,
          pricePerSquare,
          roofSizeEstimate: roofSizeEstimate?.roofSize ?? null,
          roofSizeEstimateConfidence: effectiveRoofSizeConfidence,
          roofSizeEstimateConfidenceScore: effectiveRoofSizeConfidenceScore,
          roofSizeEstimateSource: effectiveRoofSizeSource,
          roofSizeEstimateReasoning: roofSizeEstimate?.reasoning || "",
          roofSizeEstimateMeta: roofSizeEstimate?.meta || {},
          meta: buildNormalizedAnalysisMeta({
            effectiveRoofSize,
            effectiveRoofSizeSource,
            effectiveRoofSizeConfidence,
            effectiveRoofSizeConfidenceScore,
            roofSizeEstimate,
            roofSizeSignals,
            roofSizeConsistency,
            quotePrice,
            low,
            mid,
            high,
            derivedAnalysisConfidenceLabel,
            derivedConfidenceScore,
            reliabilityTier
        }),
          propertySignalsMeta,
          livingAreaSqFt:
          roofSizeEstimate?.meta?.livingAreaSqFt ||
          roofSizeEstimate?.meta?.propertySignals?.livingAreaSqFt ||
          null,
          roofSizeNeedsReview:
            !!roofSizeEstimate?.meta?.disagreement?.hasDisagreement ||
            !!propertySignalsMeta?.ambiguous ||
            !!roofSizeEstimate?.meta?.fallbackUsed ||
            String(roofSizeEstimate?.source || "").toLowerCase() === "unavailable",
          roofSizeSignals,
          signalComparison: {
            parsed: roofSizeSignals?.parsed || null,
            property: roofSizeSignals?.property || null,
            priceImplied: roofSizeSignals?.priceImplied || null,
            selected: effectiveRoofSizeSource,
            explanation: buildSignalComparisonReasoning({
              roofSizeEstimateSource: effectiveRoofSizeSource,
              propertySignalsMeta,
              roofSizeEstimateMeta: roofSizeEstimate?.meta || {}
            })
          },
          roofSizeConsistency
        };
        latestAnalysis.roofSizeSource =
        latestAnalysis?.meta?.roofSize?.source ||
        latestAnalysis?.roofSizeEstimateSource ||
        "unavailable";
        latestAnalysis.conflictSignals = buildConflictSignals({
        quotePrice: latestAnalysis.quotePrice,
        low: latestAnalysis.low,
        high: latestAnalysis.high,
        roofSize: latestAnalysis.roofSize,
        confidenceScore: latestAnalysis.confidenceScore
      });
        window.__latestAnalysis = latestAnalysis;
        setJourneyStep("result");
        const session = getTrackingSession();
        session.analysesRun = (session.analysesRun || 0) + 1;
        saveTrackingSession(session);
        track("analysis_completed", {
          verdict: latestAnalysis?.verdict || "",
          rawVerdict: latestAnalysis?.rawVerdict || "",
          confidence: latestAnalysis?.analysisConfidenceLabel || "",
          roofSizeSource: latestAnalysis?.roofSizeEstimateSource || "",
          roofSizeNeedsReview: !!latestAnalysis?.roofSizeNeedsReview,
          roofSizeConsistencySeverity: latestAnalysis?.roofSizeConsistency?.severity || "low",
          quotePrice: latestAnalysis?.quotePrice || null,
          roofSize: latestAnalysis?.roofSize || null,
          material: latestAnalysis?.material || ""
        });
        }
        window.handleAnalyzeClick = function handleAnalyzeClick() {
          const fileInput = document.getElementById("quoteFile");
          const file = fileInput?.files?.[0];
          const price = Number(document.getElementById("quotePrice")?.value || 0);
          if (file && typeof parseUploadedComparisonFile === "function") {
            parseUploadedComparisonFile(file)
              .then(parsedBundle => {
                const parsed = parsedBundle?.parsed || parsedBundle || {};
                latestParsed = parsed;
                copyParsedToForm();
                analyzeQuote();
              })
              .catch(err => {
                console.error(err);
                setUploadStatus("Could not read the uploaded quote.", "error");
              });
            return;
          }
          if (price > 0) {
            analyzeQuote();
            return;
          }
          setUploadStatus(
            "Upload a quote to get started, or enter your price below.",
            "info"
          );
        };
    function buildComparisonSummaryLines() {
      const lines = [];
      const primaryQuote = normalizeComparisonQuote(buildPrimaryComparisonQuote(), "Quote 1");
      if (primaryQuote?.isValid) {
        lines.push(`${primaryQuote.contractor}: ${safeFormatCurrency(primaryQuote.total)}`);
      }
      const secondManualName = (byId("secondContractorName")?.value || "").trim();
      const secondManualPrice = byId("secondQuotePrice")?.value || "";
      const secondQuote = normalizeComparisonQuote(
        buildComparisonQuoteFromUpload(
          secondParsed,
          secondManualName,
          secondManualPrice,
          "Quote 2"
        ),
        "Quote 2"
      );
      const thirdManualName = (byId("thirdContractorName")?.value || "").trim();
      const thirdManualPrice = byId("thirdQuotePrice")?.value || "";
      const thirdQuote = normalizeComparisonQuote(
        buildComparisonQuoteFromUpload(
          thirdParsed,
          thirdManualName,
          thirdManualPrice,
          "Quote 3"
        ),
        "Quote 3"
      );
      if (secondQuote?.isValid) {
        lines.push(`${secondQuote.contractor}: ${safeFormatCurrency(secondQuote.total)}`);
      }
      if (thirdQuote?.isValid) {
        lines.push(`${thirdQuote.contractor}: ${safeFormatCurrency(thirdQuote.total)}`);
      }
      return lines;
    }
    function buildShareableReportData() {
      const analysis =
        latestAnalysis ||
        (typeof window !== "undefined" && window.__tpDebug?.getLatestAnalysis?.()) ||
        null;
      if (!analysis) return null;
      const parsed = latestParsed || {};
      const comparisonLines = buildComparisonSummaryLines();
      const manualSignals = [
        !!analysis?.quotePrice && (!parsed?.price || Number(parsed.price) <= 0),
        !!analysis?.roofSize && (!parsed?.roofSize || Number(parsed.roofSize) <= 0),
        !!analysis?.material && (!parsed?.materialLabel || parsed.materialLabel === "Unknown"),
        !!analysis?.city && !parsed?.city,
        !!analysis?.stateCode && !parsed?.stateCode
      ];
      const manualCount = manualSignals.filter(Boolean).length;
      let shareConfidenceLabel =
        analysis?.analysisConfidenceLabel ||
        parsed?.confidenceLabel ||
        "Low";
      let shareConfidenceScore =
        analysis?.roofSizeEstimateConfidenceScore ??
        parsed?.confidenceScore ??
        "Unknown";
      if (manualCount >= 2) {
        shareConfidenceLabel = "Medium";
        shareConfidenceScore = "Manual or mixed input";
      } else if (manualCount === 1) {
        shareConfidenceScore = parsed?.confidenceScore ?? "1 field confirmed manually";
      }
      return {
        verdict: analysis.verdict || "Quote analyzed",
        rawVerdict: analysis.rawVerdict || analysis.verdict || "Quote analyzed",
        riskFlags: analysis?.riskFlags || [],
        recommendation: analysis?.recommendation || null,
        decisionDelta: analysis?.decisionDelta || null,
        conflictSignals: analysis?.conflictSignals || null,
        quotePrice: analysis.quotePrice || null,
        contractorPriceScore:
          analysis.quotePrice && analysis.mid
            ? calculateContractorPriceScore(analysis.quotePrice, analysis.mid).score
            : null,
        contractorPriceScoreLabel:
          analysis.quotePrice && analysis.mid
            ? calculateContractorPriceScore(analysis.quotePrice, analysis.mid).label
            : "Not available",
        low: analysis.low || null,
        mid: analysis.mid || null,
        high: analysis.high || null,
        roofSize: analysis.roofSize || parsed.roofSize || null,
        material: parsed?.materialLabel || analysis.material || "Not detected",
        warranty: displayWarranty(parsed?.warranty || ""),
        contractor:
        parsed?.contractor && parsed.contractor !== "Not detected"
          ? parsed.contractor
          : inferContractorNameFromParsed(parsed, "Contractor"),
        city: analysis.city || parsed.city || "",
        stateCode: analysis.stateCode || parsed.stateCode || "",
        typicalPriceSummary: buildTypicalPriceSummary({
          city: analysis.city || parsed.city || "",
          stateCode: analysis.stateCode || parsed.stateCode || "",
          roofSize: analysis.roofSize || parsed.roofSize || null,
          low: analysis.low || null,
          high: analysis.high || null,
          mid: analysis.mid || null
        }),
        pricePerSqFt: analysis.pricePerSqFt || parsed.pricePerSqFt || null,
        confidenceLabel: shareConfidenceLabel,
        confidenceScore: shareConfidenceScore,
        roofSizeEstimateSource: analysis?.roofSizeEstimateSource || "unavailable",
        roofSizeEstimateReasoning: analysis?.roofSizeEstimateReasoning || "",
        roofSizeEstimateConfidence: analysis?.roofSizeEstimateConfidence || "Low",
        roofSizeNeedsReview: !!analysis?.roofSizeNeedsReview,
        roofSizeSignals: analysis?.roofSizeSignals || {},
        roofSizeConsistency: analysis?.roofSizeConsistency || null,
        priceSanityStatus: parsed?.priceSanityStatus || "unknown",
        includedSignals: Array.isArray(parsed?.includedSignals) ? parsed.includedSignals : [],
        missingSignals: Array.isArray(analysis?.missingSignals)
          ? analysis.missingSignals
          : Array.isArray(parsed?.missingSignals)
            ? parsed.missingSignals
            : [],
        premiumSignals: Array.isArray(parsed?.premiumSignals) ? parsed.premiumSignals : [],
        comparisonLines,
        contractorQuestions: buildContractorQuestions(analysis).slice(0, 3),
        partialExtractionNoticeHtml: buildPartialExtractionNotice(parsed)
      };
    }
     function buildShareableReportText(report) {
      if (!report) return "";
      const locationLine =
        [report.city, report.stateCode].filter(Boolean).join(", ") || "Location not detected";
      const recommendationAction = String(report?.recommendation?.action || "REVIEW").toUpperCase();
      const recommendationReasoning = softenClaim(
        report?.recommendation?.reasoning || getDecisionGuidance(report),
        latestAnalysis || report
      );
      const decisionDeltaText = report?.decisionDelta
        ? softenClaim(buildDecisionDeltaText(report.decisionDelta), latestAnalysis || report)
        : softenClaim(buildMarketPositionText(report.quotePrice, report.mid), latestAnalysis || report);
      const consistencySeverity = String(report?.roofSizeConsistency?.severity || "low").toLowerCase();
      const trustLine =
        consistencySeverity === "high"
          ? "Trust note: Treat this result as provisional until roof size is verified."
          : consistencySeverity === "medium"
            ? "Trust note: Treat this result as directional because roof size signals are mixed."
            : "";
      const riskFlags = Array.isArray(report?.riskFlags) ? report.riskFlags : [];
      const topRiskFlags = riskFlags
        .filter(flag => String(flag?.key || "").toLowerCase() !== "no_major_risks")
        .slice(0, 2);
      const contractorQuestions = Array.isArray(report?.contractorQuestions)
        ? report.contractorQuestions.slice(0, 3)
        : [];
      const sections = [
        "TruePrice Roofing Quote Decision Report",
        "",
        `${recommendationAction}`,
        recommendationReasoning,
        "",
        `Decision delta: ${decisionDeltaText}`,
        `Verdict: ${report.verdict}`,
        ...(report.rawVerdict && report.rawVerdict !== report.verdict
          ? [`Original modeled verdict: ${report.rawVerdict}`]
          : []),
        ...(trustLine ? [trustLine] : []),
        `Next step: ${getDecisionGuidance(report)}`
      ];
      if (topRiskFlags.length) {
        sections.push(
          "",
          "Top risk flags:",
          ...topRiskFlags.map(flag => {
            const title = flag?.title || "Risk flag";
            const impact = flag?.impact || "";
            const action = flag?.action || "";
            return `- ${title}: ${impact}${action ? ` Next move: ${action}.` : ""}`;
          })
        );
      }
      sections.push(
        "",
        "Pricing summary:",
        `- Quote price: ${report.quotePrice ? safeFormatCurrency(report.quotePrice) : "Not available"}`,
        `- Expected range: ${
          report.low && report.high
            ? `${safeFormatCurrency(report.low)} to ${safeFormatCurrency(report.high)}`
            : "Not available"
        }`,
        `- Expected midpoint: ${report.mid ? safeFormatCurrency(report.mid) : "Not available"}`,
        `- Market position: ${softenClaim(buildMarketPositionText(report.quotePrice, report.mid), latestAnalysis || report)}`,
        `- Difference vs midpoint: ${buildDifferenceDisplay(report.quotePrice, report.mid)}`,
        `- Contractor Price Score: ${
          report.contractorPriceScore !== null && report.contractorPriceScore !== undefined
            ? `${report.contractorPriceScore} / 100${report.contractorPriceScoreLabel ? ` (${report.contractorPriceScoreLabel})` : ""}`
            : "Not available"
        }`,
        `- Typical local price: ${report.typicalPriceSummary || "Not available"}`
      );
      sections.push(
        "",
        "Quote details:",
        `- Roof size: ${
          report.roofSize
            ? formatRoofSizeForDisplay(
                report.roofSize,
                report.roofSizeEstimateSource,
                report.roofSizeEstimateConfidence
              )
            : "Not detected"
        }`,
        `- Roof size source: ${getRoofSizeSourceDisplay(report.roofSizeEstimateSource) || "Not available"}`,
        `- Price per sq ft: ${report.pricePerSqFt ? `${safeFormatCurrencyPrecise(report.pricePerSqFt)} / sq ft` : "Not available"}`,
        `- Material: ${displayMaterial(report.material)}`,
        `- Warranty: ${displayWarranty(report.warranty)}`,
        `- Contractor: ${report.contractor || "Quote 1"}`,
        `- Location: ${locationLine}`,
        `- Quote confidence: ${report.confidenceLabel} (${report.confidenceScore})`
      );
      if (report.roofSizeNeedsReview) {
        sections.push("- Roof size review: Recommended before relying on this result");
      }
      if (report.roofSizeConsistency?.summary) {
        sections.push(`- Roof size consistency: ${report.roofSizeConsistency.summary}`);
      }
      if (contractorQuestions.length) {
        sections.push(
          "",
          "Questions to send the contractor:",
          ...contractorQuestions.map((question, index) => `${index + 1}. ${question}`)
        );
      }
      if (report.includedSignals.length) {
        sections.push(
          "",
          "Clearly mentioned in the quote:",
          ...report.includedSignals.map(item => `- ${item}`)
        );
      }
      if (report.missingSignals.length) {
        sections.push(
          "",
          "Possible missing items to clarify:",
          ...report.missingSignals.map(item => `- ${item}`)
        );
      }
      if (report.premiumSignals.length) {
        sections.push(
          "",
          "Higher quality or complexity signals:",
          ...report.premiumSignals.map(item => `- ${item}`)
        );
      }
      if (report.comparisonLines.length > 1) {
        sections.push(
          "",
          "Quote comparison:",
          ...report.comparisonLines.map(line => `- ${line}`)
        );
      }
      sections.push(
        "",
        getBrandFooterText()
      );
      return sections.join("\n");
    }
    function buildTopRiskFlagsHtml(report) {
      const riskFlags = Array.isArray(report?.riskFlags) ? report.riskFlags : [];
      const topRiskFlags = riskFlags
        .filter(flag => String(flag?.key || "").toLowerCase() !== "no_major_risks")
        .slice(0, 2);
      if (!topRiskFlags.length) return "";
      return `
        <div style="display:grid; gap:10px; margin:0 0 12px;">
          ${topRiskFlags.map(flag => {
            const accent = getRiskFlagAccent(flag?.severity);
            return `
              <div class="panel" style="margin:0; background:${accent.bg}; border-color:${accent.border};">
                <p style="margin:0 0 6px; font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:${accent.text};">
                  ${accent.icon} ${flag.title}
                </p>
                <p class="small" style="margin:0 0 6px; color:${accent.text};">
                  ${flag.impact || ""}
                </p>
                ${
                  flag.action
                    ? `<p class="small muted" style="margin:0;"><strong>Next move:</strong> ${flag.action}</p>`
                    : ""
                }
              </div>
            `;
          }).join("")}
        </div>
      `;
    }
    function buildShareContractorQuestionsHtml(report) {
      const questions = Array.isArray(report?.contractorQuestions)
        ? report.contractorQuestions.slice(0, 3)
        : [];
      if (!questions.length) return "";
      return `
        <div class="panel" style="margin:0 0 12px; padding:12px 14px; background:#f8fafc; border-color:#e5e7eb;">
          <p style="margin:0 0 6px; font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:#475569;">
            Contractor questions
          </p>
          <p class="small muted" style="margin:0 0 10px;">
            Use these to pressure test the decision before you sign.
          </p>
          <ul class="mini-list" style="margin:0;">
            ${questions.map(q => `<li>${q}</li>`).join("")}
          </ul>
        </div>
      `;
    }
    async function copyShareableReportText() {
      const report = buildShareableReportData();
      if (!report) {
        setUploadStatus("Run the quote analysis before copying a report.", "warn");
        return;
      }
      const text = buildShareableReportText(report);
      track("report_copy_attempted", {
        verdict: report?.verdict || "",
        rawVerdict: report?.rawVerdict || "",
        recommendation: report?.recommendation?.action || "",
        hasContractorQuestions: !!buildContractorQuestions(latestAnalysis || {}).length
      });
      try {
        await navigator.clipboard.writeText(text);
        track("report_copied", {
          verdict: report?.verdict || "",
          rawVerdict: report?.rawVerdict || "",
          recommendation: report?.recommendation?.action || "",
          hasContractorQuestions: !!buildContractorQuestions(latestAnalysis || {}).length
        });
        const copyStatus = getShareReportOutputElement();
        if (copyStatus) {
          copyStatus.innerHTML = `
            <div class="panel" style="margin-top:12px; background:#f0fdf4; border-color:#86efac;">
              <p style="margin:0 0 6px;"><strong>Copied.</strong> Share summary copied to clipboard.</p>
              <p class="small muted" style="margin:0;">Paste it into a text, Facebook group, Reddit post, or email to get a second opinion.</p>
            </div>
          `;
        }
        setUploadStatus("Shareable quote summary copied to clipboard.", "success");
      } catch (err) {
        console.error(err);
        track("report_copy_failed", {
          verdict: report?.verdict || "",
          rawVerdict: report?.rawVerdict || "",
          recommendation: report?.recommendation?.action || "",
          hasContractorQuestions: !!buildContractorQuestions(latestAnalysis || {}).length
        });
        setUploadStatus("Could not copy the shareable summary.", "error");
      }
    }
    function renderShareableReport(output, report) {
      if (!output || !report) return;
      const locationDisplay =
        [report.city, report.stateCode].filter(Boolean).join(", ") || "Not detected";
      const recommendationAction = String(report?.recommendation?.action || "REVIEW").toUpperCase();
      const recommendationReasoning = softenClaim(
        report?.recommendation?.reasoning || getDecisionGuidance(report),
        latestAnalysis || report
      );
      const decisionDeltaText = report?.decisionDelta
        ? softenClaim(buildDecisionDeltaText(report.decisionDelta), latestAnalysis || report)
        : softenClaim(buildMarketPositionText(report.quotePrice, report.mid), latestAnalysis || report);
      const differenceDisplay = buildDifferenceDisplay(report.quotePrice, report.mid);
      const partialExtractionNoticeHtml = report.partialExtractionNoticeHtml || "";
      const scopeCheckHtml = buildScopeCheckHtml({
        includedSignals: report.includedSignals,
        missingSignals: report.missingSignals,
        premiumSignals: report.premiumSignals
      });
      const scopeRiskHtml = buildScopeRiskHtml(report.missingSignals);
      const topRiskFlagsHtml = buildTopRiskFlagsHtml(report);
      const contractorQuestionsHtml = buildShareContractorQuestionsHtml(report);
      const comparisonHtml = report.comparisonLines.length > 1
        ? `
            <div class="panel" style="margin:0 0 12px; background:#f8fafc; border-color:#e5e7eb;">
              <p style="margin:0 0 8px;"><strong>Quote comparison</strong></p>
              <ul class="mini-list" style="margin:0;">
                ${report.comparisonLines.map(line => `<li>${line}</li>`).join("")}
              </ul>
            </div>
          `
        : "";
                output.innerHTML = `
            <div class="panel" style="margin-top:8px; border-width:2px;">
              <p style="margin:0 0 6px; font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:#334155;">
                TruePrice decision report
              </p>
              <div style="margin:0 0 10px; font-size:32px; line-height:1.05; font-weight:800;">
                ${recommendationAction}
              </div>
              <p class="small muted" style="margin:0 0 14px;">
                ${recommendationReasoning}
              </p>
              <div class="panel" style="margin:0 0 12px; padding:16px 18px; background:#f8fafc; border-color:#e5e7eb;">
                <div style="font-size:30px; line-height:1.1; font-weight:800; margin:0 0 8px;">
                  ${decisionDeltaText}
                </div>
                <p class="small muted" style="margin:0;">
                  Typical range: ${
                    report.low && report.high
                      ? `${safeFormatCurrency(report.low)} to ${safeFormatCurrency(report.high)}`
                      : "Not available"
                  }
                </p>
              </div>
              <div class="verdict ${getVerdictClassName(report.verdict)}" style="margin-bottom:12px;">
                ${report.verdict}
              </div>
          ${report.rawVerdict && report.rawVerdict !== report.verdict ? `
            <p class="small muted" style="margin:0 0 12px;">
              <strong>Original modeled verdict:</strong> ${report.rawVerdict}
            </p>
          ` : ""}
          ${report.roofSizeConsistency?.severity === "high" ? `
            <div class="panel" style="margin:0 0 12px; background:#fff7ed; border-color:#fdba74;">
              <p style="margin:0;">
                <strong>Trust note:</strong> Treat this result as provisional until roof size is verified.
              </p>
            </div>
          ` : report.roofSizeConsistency?.severity === "medium" ? `
            <div class="panel" style="margin:0 0 12px; background:#fff7ed; border-color:#fdba74;">
              <p style="margin:0;">
                <strong>Trust note:</strong> Treat this result as directional because roof size signals are mixed.
              </p>
            </div>
          ` : ""}
          ${topRiskFlagsHtml}
          <div class="panel" style="margin:0 0 12px; background:#f8fafc; border-color:#dbeafe;">
            <p style="margin:0 0 8px;"><strong>Next step</strong></p>
            <p class="small" style="margin:0;">
              ${getDecisionGuidance(report)}
            </p>
          </div>
          ${contractorQuestionsHtml}
          <div class="panel" style="margin:0 0 12px; background:#f8fafc; border-color:#e5e7eb;">
            <p class="small muted" style="margin:0;">
              <strong>Share prompt:</strong> ${getSharePrompt(report)}
            </p>
          </div>
          <div class="panel" style="margin:0 0 12px; background:#f9fafb; border-color:#e5e7eb;">
            <p class="small muted" style="margin:0;">
              <strong>Market context:</strong> ${report.typicalPriceSummary || "Not available"}
            </p>
          </div>
          ${partialExtractionNoticeHtml}
          ${report.roofSizeNeedsReview ? `
            <div class="panel" style="margin:0 0 12px; background:#fff7ed; border-color:#fdba74;">
              <p style="margin:0;">
                <strong>Roof size review:</strong> Recommended before relying on this result.
              </p>
            </div>
          ` : ""}
          ${report.roofSizeConsistency?.summary ? `
            <div class="panel" style="margin:0 0 12px; background:#f8fafc; border-color:#dbeafe;">
              <p style="margin:0;">
                <strong>Roof size consistency:</strong> ${report.roofSizeConsistency.summary}
              </p>
            </div>
          ` : ""}
          <div class="analysis-grid">
            <div><strong>Quote price</strong></div>
            <div>${report.quotePrice ? safeFormatCurrency(report.quotePrice) : "Not available"}</div>
            <div><strong>Contractor Price Score</strong></div>
            <div>${
              report.contractorPriceScore !== null && report.contractorPriceScore !== undefined
                ? `${report.contractorPriceScore} / 100${report.contractorPriceScoreLabel ? ` (${report.contractorPriceScoreLabel})` : ""}`
                : "Not available"
            }</div>
            <div><strong>Expected range</strong></div>
            <div>${report.low && report.high ? `${safeFormatCurrency(report.low)} to ${safeFormatCurrency(report.high)}` : "Not available"}</div>
            <div><strong>Expected midpoint</strong></div>
            <div>${report.mid ? safeFormatCurrency(report.mid) : "Not available"}</div>
            <div><strong>Difference vs midpoint</strong></div>
            <div>${differenceDisplay}</div>
            <div><strong>Roof size</strong></div>
            <div>${
              report.roofSize
                ? formatRoofSizeForDisplay(
                    report.roofSize,
                    report.roofSizeEstimateSource,
                    report.roofSizeEstimateConfidence
                  )
                : "Not detected"
            }</div>
            <div><strong>Roof size source</strong></div>
            <div>${getRoofSizeSourceDisplay(report.roofSizeEstimateSource) || "Not available"}</div>
            <div><strong>Price per sq ft</strong></div>
            <div>${report.pricePerSqFt ? `${safeFormatCurrencyPrecise(report.pricePerSqFt)} / sq ft` : "Not available"}</div>
            <div><strong>Material</strong></div>
            <div>${displayMaterial(report.material)}</div>
            <div><strong>Warranty</strong></div>
            <div>${displayWarranty(report.warranty)}</div>
            <div><strong>Contractor</strong></div>
            <div>${displayDetectedValue(report.contractor, "Quote 1")}</div>
            <div><strong>Location</strong></div>
            <div>${locationDisplay}</div>
            <div><strong>Quote Confidence</strong></div>
            <div>${report.confidenceLabel} (${report.confidenceScore})</div>
          </div>
          <div style="margin-top:14px;">
            ${scopeCheckHtml}
          </div>
          ${scopeRiskHtml}
          ${comparisonHtml}
          <p class="small muted" style="margin:16px 0 0;">
            ${getBrandFooterText()}
          </p>
        </div>
      `;
    }
    function getShareReportOutputElement() {
      return byId("inlineShareReportOutput");
    }
    function viewShareableResult() {
      const output = getShareReportOutputElement();
      const comparisonOutput = byId("comparisonOutput");
      if (comparisonOutput) {
        comparisonOutput.innerHTML = "";
      }
      if (!output) {
        setUploadStatus("Share report output container not found.", "warn");
        return;
      }
      if (!latestAnalysis) {
        output.innerHTML = "Run the main quote analysis before viewing a shareable result.";
        setUploadStatus("Run the main quote analysis before viewing a shareable result.", "warn");
        return;
      }
      const report = buildShareableReportData();
      if (!report) {
        output.innerHTML = "Run the main quote analysis before viewing a shareable result.";
        setUploadStatus("Could not build the share report from the current analysis.", "warn");
        return;
      }
      track("report_viewed", {
        verdict: report?.verdict || "",
        rawVerdict: report?.rawVerdict || ""
      });
      renderShareableReport(output, report);
      setTimeout(() => {
      output.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    }
    function getWinningComparisonLabel(comparisonSummary) {
      return String(comparisonSummary?.winnerQuote?.label || "").trim();
    }
    function getComparisonCellStyle(quote, winningLabel) {
      const isWinner = String(quote?.label || "").trim() === String(winningLabel || "").trim();
      if (isWinner) {
        return 'padding:8px; border-bottom:1px solid #d1fae5; background:#f0fdf4;';
      }
      return 'padding:8px; border-bottom:1px solid #eee;';
    }
    function renderComparisonResults({
      output,
      sortedQuotes,
      comparisonSummary,
      winningLabel,
      lowest,
      highest,
      spread,
      spreadPct
    }) {
      if (!output) return;
      const winnerHtml = buildComparisonWinnerHtml(comparisonSummary);
      const tableHtml = `
        ${winnerHtml}
        <div class="panel" style="margin:0 0 12px; background:#f8fafc; border-color:#e5e7eb;">
          <p style="margin:0;" class="small muted">
            Quotes are ordered by <strong>best overall position</strong>, not lowest price alone.
          </p>
        </div>
        <table style="width:100%; border-collapse:collapse; margin-top:12px;">
          <thead>
            <tr>
              <th style="text-align:left; border-bottom:1px solid #ddd; padding:8px;">Category</th>
              ${sortedQuotes.map(q => `
                <th style="text-align:left; border-bottom:1px solid #ddd; padding:8px; ${
                  q.label === winningLabel ? "background:#dcfce7;" : ""
                }">
                  ${q.contractor}
                  ${q.label === winningLabel ? `<div class="small" style="margin-top:4px; color:#166534;"><strong>Recommended</strong></div>` : ""}
                </th>
              `).join("")}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding:8px; border-bottom:1px solid #eee;">Quote label</td>
              ${sortedQuotes.map(q => `<td style="${getComparisonCellStyle(q, winningLabel)}">${q.label}</td>`).join("")}
            </tr>
            <tr>
              <td style="padding:8px; border-bottom:1px solid #eee;">Total price</td>
              ${sortedQuotes.map(q => `<td style="${getComparisonCellStyle(q, winningLabel)}">${safeFormatCurrency(q.total)}</td>`).join("")}
            </tr>
            <tr>
              <td style="padding:8px; border-bottom:1px solid #eee;">Comparison score</td>
              ${sortedQuotes.map(q => `<td style="${getComparisonCellStyle(q, winningLabel)}">${buildComparisonScoreCellHtml(q)}</td>`).join("")}
            </tr>
            <tr>
              <td style="padding:8px; border-bottom:1px solid #eee;">Roof size</td>
              ${sortedQuotes.map(q => `<td style="${getComparisonCellStyle(q, winningLabel)}">${q.roofSize ? safeFormatNumber(q.roofSize) + " sq ft" : "Not detected"}</td>`).join("")}
            </tr>
            <tr>
              <td style="padding:8px; border-bottom:1px solid #eee;">Price per square foot</td>
              ${sortedQuotes.map(q => `<td style="${getComparisonCellStyle(q, winningLabel)}">${q.pricePerSqFt ? `${safeFormatCurrencyPrecise(q.pricePerSqFt)} / sq ft` : "Not available"}</td>`).join("")}
            </tr>
            <tr>
              <td style="padding:8px; border-bottom:1px solid #eee;">Material</td>
              ${sortedQuotes.map(q => `<td style="${getComparisonCellStyle(q, winningLabel)}">${displayDetectedValue(q.material)}</td>`).join("")}
            </tr>
            <tr>
              <td style="padding:8px; border-bottom:1px solid #eee;">Warranty</td>
              ${sortedQuotes.map(q => `<td style="${getComparisonCellStyle(q, winningLabel)}">${displayWarranty(q.warranty)}</td>`).join("")}
            </tr>
            <tr>
              <td style="padding:8px; border-bottom:1px solid #eee;">Decision notes</td>
              ${sortedQuotes.map(q => `
                <td style="${getComparisonCellStyle(q, winningLabel)}">
                  ${
                    q?.comparisonBreakdown?.warnings?.length
                      ? `<div class="small" style="color:#9a3412;"><strong>Warning:</strong> ${q.comparisonBreakdown.warnings[0]}</div>`
                      : q?.comparisonBreakdown?.reasons?.length
                        ? `<div class="small muted">${q.comparisonBreakdown.reasons.slice(0, 2).join(". ")}</div>`
                        : "Not available"
                  }
                </td>
              `).join("")}
            </tr>
            <tr>
              <td style="padding:8px; border-bottom:1px solid #eee;">Source</td>
              ${sortedQuotes.map(q => `<td style="${getComparisonCellStyle(q, winningLabel)}">${renderComparisonSourceLabel(q.source)}</td>`).join("")}
            </tr>
          </tbody>
        </table>
        <div style="margin-top:16px;">
          <p><strong>Lowest total quote:</strong> ${safeFormatCurrency(lowest.total)} (${lowest.contractor})</p>
          <p><strong>Highest total quote:</strong> ${safeFormatCurrency(highest.total)} (${highest.contractor})</p>
          <p><strong>Quote spread:</strong> ${safeFormatCurrency(spread)} (${spreadPct.toFixed(1)}%)</p>
          <p class="muted">
            A lower quote is not automatically the best value. Compare scope, materials, warranty,
            flashing, ventilation, tear off assumptions, and change order language before choosing a contractor.
          </p>
        </div>
      `;
      output.innerHTML = tableHtml;
      bindComparisonWinnerActions(comparisonSummary);
    }
    function renderComparisonResultScreen(summary, sortedQuotes, spread, spreadPct) {
      const root = document.getElementById("appRoot");
      if (!root) return;
      const w = summary.winnerQuote || {};
      const wb = w.comparisonBreakdown || {};
      const softened = summary.shouldSoftenWinner;
      const mid = latestAnalysis?.mid || 0;
      const winnerBg = softened ? "#fff7ed" : "#f0fdf4";
      const winnerBorder = softened ? "#fdba74" : "#86efac";
      const winnerColor = softened ? "#9a3412" : "#166534";
      const winnerTitle = softened
        ? `${escapeHtml(summary.winner)} is in front, but needs verification`
        : `${escapeHtml(summary.winner)} is the best value`;
      const reasons = (wb.reasons || []).slice(0, 3);
      const warnings = (wb.warnings || []).slice(0, 2);
      let runnerUpHtml = "";
      if (summary.runnerUp) {
        const rb = summary.runnerUp.comparisonBreakdown || {};
        const rReasons = (rb.reasons || []).slice(0, 2);
        runnerUpHtml = `
          <div style="padding:16px; border:1px solid #e2e8f0; border-radius:12px; margin:0 0 16px;">
            <div style="display:flex; justify-content:space-between; align-items:baseline; flex-wrap:wrap; gap:8px;">
              <div>
                <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:var(--muted, #6b7280);">Runner-up</div>
                <div style="font-size:18px; font-weight:700; margin-top:4px;">${escapeHtml(summary.runnerUp.contractor || summary.runnerUp.label)}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:20px; font-weight:700;">${safeFormatCurrency(summary.runnerUp.total)}</div>
                <div style="font-size:13px; color:var(--muted, #6b7280);">Score: ${summary.runnerUp.comparisonScore || 0}/100</div>
              </div>
            </div>
            ${rReasons.length > 0 ? `<ul style="margin:10px 0 0; padding-left:18px; font-size:14px; color:#374151;">${rReasons.map(r => `<li>${escapeHtml(r)}</li>`).join("")}</ul>` : ""}
          </div>
        `;
      }
      let losersHtml = "";
      const losers = (summary.losers || []).filter(l => l.name !== summary.runnerUp?.contractor && l.name !== summary.runnerUp?.label);
      if (losers.length > 0) {
        losersHtml = losers.map(l => `
          <div style="padding:12px 16px; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <span style="font-weight:600;">${escapeHtml(l.name)}</span>
              <span style="font-size:13px; color:var(--muted, #6b7280); margin-left:8px;">${l.score}/100</span>
            </div>
            ${l.reasons?.[0] ? `<span style="font-size:13px; color:var(--muted, #6b7280);">${escapeHtml(l.reasons[0])}</span>` : ""}
          </div>
        `).join("");
      }
      root.innerHTML = `
        <div style="max-width:800px; margin:40px auto; padding:0 24px;">
          <div style="padding:28px; background:${winnerBg}; border:2px solid ${winnerBorder}; border-radius:16px; margin:0 0 16px; text-align:center;">
            <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:${winnerColor}; margin:0 0 8px;">
              ${softened ? "Current leader" : "Comparison winner"}
            </div>
            <div style="font-size:32px; font-weight:800; line-height:1.1; margin:0 0 12px; color:#111827;">
              ${winnerTitle}
            </div>
            <div style="display:flex; justify-content:center; gap:24px; flex-wrap:wrap; margin:0 0 16px;">
              <div>
                <div style="font-size:28px; font-weight:700;">${safeFormatCurrency(w.total)}</div>
                <div style="font-size:12px; color:var(--muted, #6b7280);">Quoted price</div>
              </div>
              <div>
                <div style="font-size:28px; font-weight:700;">${w.comparisonScore || 0}<span style="font-size:16px; font-weight:400; color:var(--muted, #6b7280);">/100</span></div>
                <div style="font-size:12px; color:var(--muted, #6b7280);">Score</div>
              </div>
            </div>
            ${warnings.length > 0 ? `
              <div style="padding:12px 16px; background:#fff7ed; border:1px solid #fdba74; border-radius:10px; margin:0 0 16px; text-align:left; font-size:14px; color:#9a3412;">
                ${warnings.map(w => `<div>${escapeHtml(w)}</div>`).join("")}
              </div>
            ` : ""}
            ${reasons.length > 0 ? `
              <div style="text-align:left; margin:0 0 4px;">
                <div style="font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:${winnerColor}; margin:0 0 8px;">Why this quote won</div>
                <ul style="margin:0; padding-left:18px; font-size:14px; color:#374151;">
                  ${reasons.map(r => `<li style="margin-bottom:4px;">${escapeHtml(r)}</li>`).join("")}
                </ul>
              </div>
            ` : ""}
            ${mid > 0 ? `<div style="margin-top:12px; font-size:13px; color:var(--muted, #6b7280);">Expected midpoint for this market: ${safeFormatCurrency(mid)}</div>` : ""}
          </div>
          ${runnerUpHtml}
          ${losersHtml}
          <div style="padding:16px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; margin:0 0 16px;">
            <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:12px; font-size:14px; color:#374151;">
              <div>Spread: <strong>${safeFormatCurrency(spread)}</strong> (${Number(spreadPct).toFixed(0)}%)</div>
              <div>Quotes compared: <strong>${sortedQuotes.length}</strong></div>
            </div>
          </div>
          <div class="action-buttons" style="margin:20px 0;">
            <button class="btn" onclick="copyComparisonWinnerSummary()">Copy winner summary</button>
            <button class="btn secondary" onclick="showCompareScreen()">Edit quotes</button>
            <button class="btn secondary" onclick="setJourneyStep('result')">Back to result</button>
          </div>
        </div>
      `;
    }
    window.copyComparisonWinnerSummary = function copyComparisonWinnerSummary() {
      const summary = latestAnalysis?.comparisonSummary;
      if (!summary) return;
      const text = typeof buildComparisonWinnerText === "function" ? buildComparisonWinnerText(summary) : "";
      if (text && navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          alert("Winner summary copied to clipboard.");
        }).catch(() => {
          prompt("Copy this text:", text);
        });
      } else if (text) {
        prompt("Copy this text:", text);
      }
    };
    function compareQuotes() {
      track("compare_quotes_started", {
        hasPrimaryAnalysis: !!latestAnalysis
      });
      const output = byId("comparisonOutput");
      if (!output) return;
      const primaryRaw = buildPrimaryComparisonQuote();
      if (!primaryRaw.total || primaryRaw.total <= 0) {
        output.innerHTML = "Upload and analyze your first quote before comparing.";
        return;
      }
      const secondManualName = (byId("secondContractorName")?.value || "").trim();
      const secondManualPrice = byId("secondQuotePrice")?.value || "";
      const thirdManualName = (byId("thirdContractorName")?.value || "").trim();
      const thirdManualPrice = byId("thirdQuotePrice")?.value || "";
      const secondRaw = buildComparisonQuoteFromUpload(
        secondParsed,
        secondManualName,
        secondManualPrice,
        "Quote 2"
      );
      const thirdRaw = buildComparisonQuoteFromUpload(
        thirdParsed,
        thirdManualName,
        thirdManualPrice,
        "Quote 3"
      );
      const quotes = [
        normalizeComparisonQuote(primaryRaw, "Quote 1")
      ];
      if (secondParsed || secondManualName || secondManualPrice) {
        quotes.push(normalizeComparisonQuote(secondRaw, "Quote 2"));
      }
      if (thirdParsed || thirdManualName || thirdManualPrice) {
        quotes.push(normalizeComparisonQuote(thirdRaw, "Quote 3"));
      }
      const validQuotes = quotes.filter(q => q && q.isValid);
      const partialQuotes = quotes.filter(q => q && q.isPartial);
      track("compare_quotes_ready_state", {
        totalQuotesEntered: quotes.length,
        validQuotes: validQuotes.length
      });
      if (partialQuotes.length > 0) {
        console.warn("TruePrice compare: partial quotes excluded from comparison", partialQuotes);
      }
      if (validQuotes.length < 2) {
        output.innerHTML = "Add at least one more quote manually or via upload to compare.";
        return;
      }
      validQuotes.forEach(q => {
        q.pricePerSqFt =
          q.roofSize && q.roofSize > 0
            ? q.total / q.roofSize
            : null;
      });
      const lowest = [...validQuotes].sort((a, b) => a.total - b.total)[0];
      const highest = [...validQuotes].sort((a, b) => b.total - a.total)[0];
      const spread = highest.total - lowest.total;
      const spreadPct = lowest.total > 0 ? (spread / lowest.total) * 100 : 0;
      track("compare_quotes_completed", {
        validQuotes: validQuotes.length,
        lowestTotal: lowest.total,
        highestTotal: highest.total,
        spread,
        spreadPct: Number(spreadPct.toFixed(1))
      });
      const scoredQuotes = validQuotes.map(q => {
        const breakdown =
          q.comparisonBreakdown || scoreComparisonQuote(q, latestAnalysis);
        return {
          ...q,
          comparisonBreakdown: breakdown,
          comparisonScore: breakdown.totalScore
        };
      });
      const sortedQuotes = [...scoredQuotes].sort((a, b) => {
        if ((b.comparisonScore || 0) !== (a.comparisonScore || 0)) {
          return (b.comparisonScore || 0) - (a.comparisonScore || 0);
        }
        const aMidDistance = Math.abs((Number(a.total) || 0) - (Number(latestAnalysis?.mid) || 0));
        const bMidDistance = Math.abs((Number(b.total) || 0) - (Number(latestAnalysis?.mid) || 0));
        if (aMidDistance !== bMidDistance) {
          return aMidDistance - bMidDistance;
        }
        return (Number(a.total) || 0) - (Number(b.total) || 0);
      });
      const comparisonSummary = buildComparisonWinnerSummary(scoredQuotes, latestAnalysis);
      const winningLabel = getWinningComparisonLabel(comparisonSummary);
      if (latestAnalysis) {
        latestAnalysis.comparisonSummary = comparisonSummary;
      }
      renderComparisonResultScreen(comparisonSummary, sortedQuotes, spread, spreadPct);
      if (output) {
        renderComparisonResults({
          output,
          sortedQuotes,
          comparisonSummary,
          winningLabel,
          lowest,
          highest,
          spread,
          spreadPct
        });
      }
    }
    function resetAnalyzer() {
      track("reset_clicked", {
        hadAnalysis: !!latestAnalysis,
        hadParsedQuote: !!latestParsed
      });
      const analysisOutput = byId("analysisOutput");
      const aiOutput = byId("aiAnalysisOutput");
      const analysisPanels = byId("analysisPanels");
      const parsedSignalSection = byId("parsedSignalSection");
      const comparisonOutput = byId("comparisonOutput");
      const inlineShareReportOutput = byId("inlineShareReportOutput");
      const inlineShareCopyStatus = byId("inlineShareCopyStatus");
      if (analysisOutput) {
        analysisOutput.innerHTML =
          "Upload a roofing quote above or enter values manually to analyze the quote.";
      }
      if (aiOutput) {
        aiOutput.innerHTML =
          "Run the quote analysis to receive an expert explanation.";
      }
      if (analysisPanels) analysisPanels.innerHTML = "";
      if (parsedSignalSection) parsedSignalSection.innerHTML = "";
      if (comparisonOutput) {
        comparisonOutput.innerHTML = "Enter additional quotes to compare against the analyzed quote above.";
      }
      if (inlineShareReportOutput) inlineShareReportOutput.innerHTML = "";
      if (inlineShareCopyStatus) inlineShareCopyStatus.innerHTML = "";
      [ 
        "streetAddress",
        "zipCode",
        "cityName",
        "stateCode",
        "roofSize",
        "quotePrice",
        "warrantyYears",
        "secondQuotePrice",
        "thirdQuotePrice",
        "secondContractorName",
        "thirdContractorName",
        "leadName",
        "leadEmail",
        "leadPhone",
        "leadZip"
      ].forEach(id => {
        const el = byId(id);
        if (el) el.value = "";
      });
      ["secondQuoteFile", "thirdQuoteFile", "quoteFile"].forEach(id => {
        const el = byId(id);
        if (el) el.value = "";
      });
      ["secondQuoteUploadStatus", "thirdQuoteUploadStatus"].forEach(id => {
        const el = byId(id);
        if (el) el.innerText = "";
      });
      const materialType = byId("materialType");
      if (materialType) materialType.value = "architectural";
      const complexityFactor = byId("complexityFactor");
      if (complexityFactor) complexityFactor.value = "1.00";
      const tearOffIncluded = byId("tearOffIncluded");
      if (tearOffIncluded) tearOffIncluded.value = "1.00";
      latestParsed = null;
      latestSmartQuote = null;
      latestAnalysis = null;
      latestExtractedText = "";
      secondParsed = null;
      thirdParsed = null;
      clearManualFieldHighlights();
      setUploadStatus("Ready to analyze PDF or image uploads.", "info");
    }
    function showLeadPlaceholder() {
      const name = (document.getElementById("leadName")?.value || "").trim();
      const email = (document.getElementById("leadEmail")?.value || "").trim();
      const phone = (document.getElementById("leadPhone")?.value || "").trim();
      const zip = (document.getElementById("leadZip")?.value || "").trim();
      const output = byId("leadPlaceholderOutput");
      if (!email || !email.includes("@")) {
        if (output) output.innerHTML = '<span style="color:#b91c1c;">Please enter a valid email address.</span>';
        return;
      }
      try {
        const leads = JSON.parse(localStorage.getItem("tp_leads") || "[]");
        leads.push({ name, email, phone, zip, timestamp: new Date().toISOString() });
        localStorage.setItem("tp_leads", JSON.stringify(leads));
      } catch(e) {}
      if (output) output.innerHTML = '<span style="color:#166534;">Thanks! We\'ll connect you with vetted local roofers.</span>';
    }
    function bindComparisonUploadInputs() {
      const secondFileInput = byId("secondQuoteFile");
      const thirdFileInput = byId("thirdQuoteFile");
      if (secondFileInput && !secondFileInput.dataset.bound) {
        secondFileInput.addEventListener("change", async function (event) {
          const file = event.target?.files?.[0];
          if (!file || typeof parseUploadedComparisonFile !== "function") return;
          const statusEl = byId("secondQuoteUploadStatus");
          try {
            if (statusEl) statusEl.innerText = "Parsing uploaded quote...";
            const parsedBundle = await parseUploadedComparisonFile(file);
            secondParsed = parsedBundle;
            const parsed = parsedBundle?.parsed || {};
            const inferredName = inferContractorNameFromParsed(parsed, parsedBundle?.fileName);
            const inferredPrice = getParsedComparisonPrice(parsed);
            const secondNameEl = byId("secondContractorName");
            const secondPriceEl = byId("secondQuotePrice");
            if (secondNameEl && inferredName && !secondNameEl.value.trim()) {
              secondNameEl.value = inferredName;
            }
            if (secondPriceEl && inferredPrice && !secondPriceEl.value) {
              secondPriceEl.value = inferredPrice;
            }
            if (statusEl) {
              statusEl.innerText = inferredPrice
                ? "Upload parsed successfully."
                : "Upload parsed, but price was not confidently detected.";
            }
          } catch (error) {
            console.error(error);
            if (statusEl) statusEl.innerText = "Could not parse this upload.";
          }
        });
        secondFileInput.dataset.bound = "true";
      }
      if (thirdFileInput && !thirdFileInput.dataset.bound) {
        thirdFileInput.addEventListener("change", async function (event) {
          const file = event.target?.files?.[0];
          if (!file || typeof parseUploadedComparisonFile !== "function") return;
          const statusEl = byId("thirdQuoteUploadStatus");
          try {
            if (statusEl) statusEl.innerText = "Parsing uploaded quote...";
            const parsedBundle = await parseUploadedComparisonFile(file);
            thirdParsed = parsedBundle;
            const parsed = parsedBundle?.parsed || {};
            const inferredName = inferContractorNameFromParsed(parsed, parsedBundle?.fileName);
            const inferredPrice = getParsedComparisonPrice(parsed);
            const thirdNameEl = byId("thirdContractorName");
            const thirdPriceEl = byId("thirdQuotePrice");
            if (thirdNameEl && inferredName && !thirdNameEl.value.trim()) {
              thirdNameEl.value = inferredName;
            }
            if (thirdPriceEl && inferredPrice && !thirdPriceEl.value) {
              thirdPriceEl.value = inferredPrice;
            }
            if (statusEl) {
              statusEl.innerText = inferredPrice
                ? "Upload parsed successfully."
                : "Upload parsed, but price was not confidently detected.";
            }
          } catch (error) {
            console.error(error);
            if (statusEl) statusEl.innerText = "Could not parse this upload.";
          }
        });
        thirdFileInput.dataset.bound = "true";
      }
    }
    function mountExistingAnalyzer(targetId) {
      const target = document.getElementById(targetId);
      if (!target) return;
      target.innerHTML = `
         <div class="panel" style="margin:0 0 14px;">
          <p style="margin:0 0 6px; font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:#475569;">
            Quote upload
          </p>
          <h3 style="margin:0 0 10px; font-size:24px; line-height:1.15; color:#0f172a;">
            Upload your quote
          </h3>
          <p class="small muted" style="margin:0 0 12px;">
            We’ll extract pricing, estimate roof size if needed, and give you a decision.
          </p>
          </h3>
          <p class="small muted" style="margin:0 0 12px;">
            We’ll extract pricing, estimate roof size if needed, and give you a decision.
          </p>
          <div style="margin:0 0 14px; padding:14px 16px; background:#f8fafc; border:1px solid #e5e7eb; border-radius:14px;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin:0 0 6px;">
              <div class="small muted" style="font-size:13px; font-weight:600;">
                Estimated roof size
              </div>
              <button
                type="button"
                class="btn btn-ghost"
                id="editRoofSizeBtn"
                style="padding:4px 8px; min-width:auto; font-size:13px;"
              >
                Edit
              </button>
            </div>
            <div id="estimatedRoofSizeDisplay" style="font-size:30px; line-height:1.1; font-weight:800; color:#111827; margin:0 0 4px;">
              --
            </div>
            <div id="estimatedRoofSizeHint" class="small muted" style="font-size:13px;">
              We’ll use this unless you change it.
            </div>
            <div id="roofSizeInlineEditor" style="display:none; margin-top:12px;">
              <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                <input
                  id="inlineRoofSizeInput"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 2400"
                  style="max-width:160px;"
                />
                <span class="small muted">sq ft</span>
                <button type="button" class="btn secondary" id="saveRoofSizeBtn">Save</button>
                <button type="button" class="btn btn-ghost" id="cancelRoofSizeBtn">Cancel</button>
              </div>
            </div>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin:0 0 12px;">
            <input
              id="quoteFile"
              type="file"
              accept=".pdf,image/*"
              style="max-width:320px;"
            />
            <button
              type="button"
              class="btn secondary"
              id="scanQuoteBtn"
              disabled
              style="opacity:0.5; cursor:not-allowed;"
            >
              Scan quote →
            </button>
          </div>
        </div>
        <div id="uploadStatus" class="upload-status info" style="margin:0 0 12px; background:#eff6ff; border-color:#93c5fd;">
          Upload your quote to get started, or enter your price below.
        </div>
        <div id="inlineAnalyzingState"></div>
        <details id="manualEntryDetails" style="margin:0 0 14px;">
          <summary style="cursor:pointer; font-weight:700; margin:0 0 10px;">Manual quote entry</summary>
          <div id="manualFieldJumpStatus"></div>
          <div class="analysis-grid" style="margin-top:12px;">
            <div>
              <label for="quotePrice"><strong>Quote price</strong></label>
              <input id="quotePrice" type="number" min="0" step="1" placeholder="e.g. 12000" />
            </div>
            <div>
              <label for="roofSize"><strong>Roof size</strong> <span id="roofSizePriorityCue" style="color:#c2410c;"></span></label>
              <input id="roofSize" type="number" min="0" step="1" placeholder="e.g. 2200" />
            </div>
            <div>
              <label for="materialType"><strong>Material</strong></label>
              <select id="materialType">
                <option value="architectural">Architectural shingles</option>
                <option value="asphalt">Asphalt shingles</option>
                <option value="metal">Metal roofing</option>
                <option value="tile">Tile roofing</option>
              </select>
            </div>
            <div>
              <label for="complexityFactor"><strong>Complexity</strong></label>
              <select id="complexityFactor">
                <option value="1.00">Standard</option>
                <option value="1.08">Moderate</option>
                <option value="1.15">Complex</option>
              </select>
            </div>
            <div>
              <label for="tearOffIncluded"><strong>Tear off</strong></label>
              <select id="tearOffIncluded">
                <option value="1.00">Unknown</option>
                <option value="1.05">Included</option>
                <option value="0.97">Not included</option>
              </select>
            </div>
            <div>
              <label for="warrantyYears"><strong>Warranty years</strong></label>
              <input id="warrantyYears" type="number" min="0" step="1" placeholder="e.g. 25" />
            </div>
            <div>
              <label for="cityName"><strong>City</strong></label>
              <input id="cityName" type="text" placeholder="e.g. Dallas" />
            </div>
            <div>
              <label for="stateCode"><strong>State</strong></label>
              <input id="stateCode" type="text" maxlength="2" placeholder="e.g. TX" />
            </div>
            <div>
              <label for="streetAddress"><strong>Street address</strong></label>
              <input id="streetAddress" type="text" placeholder="123 Main St" />
            </div>
            <div>
              <label for="zipCode"><strong>ZIP code</strong></label>
              <input id="zipCode" type="text" placeholder="75201" />
            </div>
          </div>
        </details>
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin:0 0 14px;">
          <button type="button" class="btn secondary" id="resetAnalyzerBtn">Reset</button>
        </div>
        <div id="analysisOutput"></div>
        <div id="aiAnalysisOutput"></div>
        <div id="analysisPanels"></div>
        <div id="parsedSignalSection"></div>
        <div id="comparisonOutput"></div>
          <div id="inlineShareReportOutput"></div>
          <div id="inlineShareCopyStatus"></div>
          <div id="leadPlaceholderOutput"></div>
        `;
        const street = journeyState?.propertyPreview?.street || "";
        const apt = journeyState?.propertyPreview?.apt || "";
        const city = journeyState?.propertyPreview?.city || "";
        const state = journeyState?.propertyPreview?.state || "";
        const zip = journeyState?.propertyPreview?.zip || "";
        const streetInput = document.getElementById("streetAddress");
        const cityInput = document.getElementById("cityName");
        const stateInput = document.getElementById("stateCode");
        const zipInput = document.getElementById("zipCode");
        if (streetInput && !streetInput.value) {
          streetInput.value = [street, apt].filter(Boolean).join(" ");
        }
        if (cityInput && !cityInput.value) {
          cityInput.value = city;
        }
        if (stateInput && !stateInput.value) {
          stateInput.value = state;
        }
        if (zipInput && !zipInput.value) {
          zipInput.value = zip;
        }
        const roofSizeDisplayEl = document.getElementById("estimatedRoofSizeDisplay");
        const roofSizeHintEl = document.getElementById("estimatedRoofSizeHint");
        const editRoofSizeBtn = document.getElementById("editRoofSizeBtn");
        const roofSizeInlineEditor = document.getElementById("roofSizeInlineEditor");
        const inlineRoofSizeInput = document.getElementById("inlineRoofSizeInput");
        const saveRoofSizeBtn = document.getElementById("saveRoofSizeBtn");
        const cancelRoofSizeBtn = document.getElementById("cancelRoofSizeBtn");
        const roofSizeInput = document.getElementById("roofSize");
        const inferredRoofSize =
          Number(latestAnalysis?.roofSize || 0) > 0
            ? Number(latestAnalysis.roofSize)
            : Number(latestAnalysis?.roofSizeEstimate || 0) > 0
              ? Number(latestAnalysis.roofSizeEstimate)
              : Number(roofSizeInput?.value || 0) > 0
                ? Number(roofSizeInput.value)
                : 0;
        if (roofSizeDisplayEl) {
          roofSizeDisplayEl.textContent = inferredRoofSize > 0
            ? `${safeFormatNumber(Math.round(inferredRoofSize))} sq ft`
            : "Not available";
        }
        if (roofSizeHintEl) {
          roofSizeHintEl.textContent = inferredRoofSize > 0
            ? "We’ll use this unless you change it."
            : "Add roof size manually if you want to improve accuracy.";
        }
        if (roofSizeInput && inferredRoofSize > 0 && !roofSizeInput.value) {
          roofSizeInput.value = String(Math.round(inferredRoofSize));
        }
        if (editRoofSizeBtn && roofSizeInlineEditor && inlineRoofSizeInput && roofSizeInput) {
          if (editRoofSizeBtn.dataset.bound !== "true") {
            editRoofSizeBtn.addEventListener("click", function () {
              const currentValue = Number(roofSizeInput.value || inferredRoofSize || 0);
              inlineRoofSizeInput.value = currentValue > 0 ? String(Math.round(currentValue)) : "";
              roofSizeInlineEditor.style.display = "block";
              inlineRoofSizeInput.focus();
              if (typeof inlineRoofSizeInput.select === "function") {
                inlineRoofSizeInput.select();
              }
            });
            editRoofSizeBtn.dataset.bound = "true";
          }
          if (saveRoofSizeBtn && saveRoofSizeBtn.dataset.bound !== "true") {
            saveRoofSizeBtn.addEventListener("click", function () {
              const newValue = Number(inlineRoofSizeInput.value || 0);
              if (!newValue || newValue <= 0) return;
              roofSizeInput.value = String(Math.round(newValue));
              roofSizeInput.dataset.source = "user_input";
              roofSizeInput.dataset.confidence = "high";
              if (roofSizeDisplayEl) {
                roofSizeDisplayEl.textContent = `${safeFormatNumber(Math.round(newValue))} sq ft`;
              }
              if (roofSizeHintEl) {
                roofSizeHintEl.textContent = "Using your edited roof size.";
              }
              roofSizeInlineEditor.style.display = "none";
            });
            saveRoofSizeBtn.dataset.bound = "true";
          }
          if (cancelRoofSizeBtn && cancelRoofSizeBtn.dataset.bound !== "true") {
            cancelRoofSizeBtn.addEventListener("click", function () {
              roofSizeInlineEditor.style.display = "none";
            });
            cancelRoofSizeBtn.dataset.bound = "true";
          }
        }
        const fileInput = document.getElementById("quoteFile");
        const scanBtn = document.getElementById("scanQuoteBtn");
        const uploadBtn = document.getElementById("uploadQuoteBtn");
      if (uploadBtn && fileInput && !uploadBtn.dataset.bound) {
          uploadBtn.addEventListener("click", () => {
          fileInput.click();
        });
        fileInput.addEventListener("change", async function () {
          const file = fileInput.files?.[0];
          if (!file) return;
          setJourneyStep("analyze");
          setTimeout(() => {
            setSmartUploadStatus("upload", 10);
            renderInlineAnalyzingState(10, "Uploading your quote…");
          }, 0);
          try {
            const parsedBundle = await parseUploadedComparisonFile(file);
            const parsed = parsedBundle?.parsed || parsedBundle || {};
            latestParsed = parsed;
            setSmartUploadStatus("extract", 40);
            renderInlineAnalyzingState(40, "Extracting text from your quote…");
            setTimeout(() => {
              setSmartUploadStatus("identify", 65);
              renderInlineAnalyzingState(65, "Identifying key details…");
            }, 200);
            if (shouldPromoteAddress(latestParsed)) {
              journeyState.propertyPreview = {
                street: latestParsed.address?.street || "",
                apt: "",
                city: latestParsed.city || latestParsed.address?.city || "",
                state: latestParsed.stateCode || latestParsed.address?.stateCode || "",
                zip: latestParsed.address?.zip || ""
              };
              journeyState.propertyConfirmed = false;
              setJourneyStep("confirm");
              return;
            }
            setTimeout(() => {
              copyParsedToForm();
            }, 0);
            setTimeout(async () => {
              setSmartUploadStatus("analyze", 85);
              renderInlineAnalyzingState(85, "Analyzing pricing…");
              await analyzeQuote();
            }, 400);
          } catch (err) {
            console.error(err);
            setUploadStatus("Could not read the uploaded quote.", "error");
          }
        });
        uploadBtn.dataset.bound = "true";
        fileInput.dataset.bound = "true";
      }
        if (fileInput && scanBtn && fileInput.dataset.bound !== "true") {
          fileInput.addEventListener("change", function () {
            const hasFile = !!fileInput.files?.length;
            scanBtn.disabled = !hasFile;
            scanBtn.style.opacity = hasFile ? "1" : "0.5";
            scanBtn.style.cursor = hasFile ? "pointer" : "not-allowed";
          });
          fileInput.dataset.bound = "true";
        }
        if (scanBtn && scanBtn.dataset.bound !== "true") {
          scanBtn.addEventListener("click", async function () {
            const file = fileInput?.files?.[0];
            if (!file) return;
            try {
              setSmartUploadStatus("upload", 10);
              if (typeof parseUploadedComparisonFile === "function") {
                const parsedBundle = await parseUploadedComparisonFile(file);
                const parsed = parsedBundle?.parsed || parsedBundle || {};
                latestParsed = parsed;
                copyParsedToForm();
                if (parsed?.address) {
                  const addr = parsed.address;
                  const hasAddress =
                    addr.street && (addr.city || addr.zip) && addr.stateCode;
                  if (hasAddress) {
                    journeyState.propertyPreview = {
                      street: addr.street || "",
                      apt: "",
                      city: addr.city || "",
                      state: addr.stateCode || "",
                      zip: addr.zip || ""
                    };
                    journeyState.propertyConfirmed = true;
                  }
                }
                const hasPromotedAddress =
                  !!journeyState.propertyPreview?.street &&
                  (!!journeyState.propertyPreview?.city || !!journeyState.propertyPreview?.zip) &&
                  !!journeyState.propertyPreview?.state;
                if (hasPromotedAddress) {
                  setJourneyStep("confirm");
                  return;
                }
                setJourneyStep("address");
                return;
              }
              setUploadStatus("Quote upload parser is not available yet.", "error");
            } catch (err) {
              console.error(err);
              setUploadStatus("Could not read the uploaded quote.", "error");
            }
          });
          scanBtn.dataset.bound = "true";
        }
        const resetBtn = document.getElementById("resetAnalyzerBtn");
        if (resetBtn && resetBtn.dataset.bound !== "true") {
          resetBtn.addEventListener("click", function () {
            resetAnalyzer();
          });
          resetBtn.dataset.bound = "true";
        }
        bindRenderedAnalysisUi();
        initAnalyzerUI();
      }
      function initAnalyzerUI() {
        bindComparisonUploadInputs();
        if (typeof injectComparisonFieldHints === "function") {
          injectComparisonFieldHints();
        }
        setTimeout(() => {
          const btn = document.getElementById("uploadQuoteBtn");
          const input = document.getElementById("quoteFile");
          if (btn && input && !input.dataset.bound) {
            btn.addEventListener("click", () => input.click());
            input.addEventListener("change", async function () {
              const file = input.files?.[0];
              if (!file) return;
              const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'];
              if (!validTypes.includes(file.type) && !file.name.match(/\.(pdf|jpg|jpeg|png|webp|gif)$/i)) {
                alert('Please upload a PDF or image file (JPG, PNG, or PDF).');
                return;
              }
              if (file.size > 20 * 1024 * 1024) {
                alert('File is too large. Please upload a file under 20MB.');
                return;
              }
              setJourneyStep("analyze");
              setTimeout(() => {
                setSmartUploadStatus("upload", 10);
                renderInlineAnalyzingState(10, "Uploading your quote…");
              }, 0);
              try {
                const parsedBundle = await parseUploadedComparisonFile(file);
                const parsed = parsedBundle?.parsed || parsedBundle || {};
                latestParsed = parsed;
                setSmartUploadStatus("extract", 40);
                renderInlineAnalyzingState(40, "Extracting text from your quote…");
                setTimeout(() => {
                  setSmartUploadStatus("identify", 65);
                  renderInlineAnalyzingState(65, "Identifying key details…");
                }, 200);
                if (shouldPromoteAddress(latestParsed)) {
                  journeyState.propertyPreview = {
                    street: latestParsed.address?.street || "",
                    apt: "",
                    city: latestParsed.city || latestParsed.address?.city || "",
                    state: latestParsed.stateCode || latestParsed.address?.stateCode || "",
                    zip: latestParsed.address?.zip || ""
                  };
                }
                setTimeout(() => {
                  copyParsedToForm();
                }, 0);
                setTimeout(async () => {
                  setSmartUploadStatus("analyze", 85);
                  renderInlineAnalyzingState(85, "Analyzing pricing…");
                  await analyzeQuote();
                }, 400);
              } catch (err) {
                console.error(err);
                setUploadStatus("Could not read the uploaded quote.", "error");
              }
            });
            btn.dataset.bound = "true";
            input.dataset.bound = "true";
          }
        }, 0);
      }
    function bindRenderedAnalysisUi() {
      bindRoofSizeSuggestionActions(latestAnalysis);
      bindPrimaryCtaActions(latestAnalysis);
      bindContractorQuestionsActions();
      bindRoofCalculatorActions();
      renderRoofCalculatorOutput();
    }
    window.__tpDebug = {
      setLatestParsed(value) {
        latestParsed = value;
      },
      getLatestParsed() {
        return latestParsed;
      },
      getLatestAnalysis() {
        return latestAnalysis;
      },
      softenVerdictForRoofSizeTrust,
      getVerdictTrustNote,
      getTrackingEvents,
      clearTrackingEvents,
      getTrackingSession
    };
    window.showNegotiateScreen = function showNegotiateScreen() {
      const root = document.getElementById("appRoot");
      if (!root) return;
      const questions = typeof buildContractorQuestions === "function"
        ? buildContractorQuestions(latestAnalysis)
        : [];
      const a = latestAnalysis || {};
      const verdictSummary = `${safeFormatCurrency(a.quotePrice)} | ${a.verdict || "Unknown"} | ${a.city || ""}${a.stateCode ? ", " + a.stateCode : ""}`;
      root.innerHTML = `
        <div style="max-width:800px; margin:40px auto; padding:0 24px;">
          <div style="font-size:13px; color:var(--muted, #6b7280); margin-bottom:16px; padding:10px 14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;">
            ${escapeHtml(verdictSummary)}
          </div>
          <h2 style="margin:0 0 16px; font-size:24px;">Questions for your contractor</h2>
          ${questions.length > 0 ? `
            <ol class="action-questions">
              ${questions.map((q, i) => `<li><strong>Q${i + 1}</strong>${escapeHtml(q)}</li>`).join("")}
            </ol>
          ` : "<p>No specific questions generated for this analysis.</p>"}
          <div class="action-buttons" style="margin-top:20px;">
            <button class="btn" onclick="copyContractorQuestions()">Copy questions</button>
            <button class="btn secondary" onclick="setJourneyStep('result')">Back to result</button>
          </div>
        </div>
      `;
    }
    const compareState = { q2: null, q3: null, scopeOverrides: {} };
    function getScopeStatus(label, key, signals) {
      const overrideKey = label + "|" + key;
      if (overrideKey in compareState.scopeOverrides) {
        return compareState.scopeOverrides[overrideKey] ? "included" : "unclear";
      }
      return signals[key]?.status || "unclear";
    }
    function buildQuoteSummary(parsed, label) {
      if (!parsed) return null;
      const signals = parsed.signals || {};
      const scopeKeys = ["tearOff","underlayment","flashing","iceShield","dripEdge","ventilation","ridgeVent","starterStrip","ridgeCap","decking","disposal","permit"];
      const confirmed = scopeKeys.filter(k => getScopeStatus(label, k, signals) === "included").length;
      const price = Number(parsed.finalBestPrice || parsed.totalLinePrice || parsed.price || 0);
      return {
        label,
        contractor: repairDisplayText(parsed.contractor && parsed.contractor !== "Not detected" ? parsed.contractor : label),
        price,
        material: parsed.materialLabel || parsed.material || "Unknown",
        warranty: parsed.warranty || "",
        warrantyYears: parsed.warrantyYears || "",
        roofSize: Number(parsed.roofSize || 0),
        scopeConfirmed: confirmed,
        scopeTotal: scopeKeys.length,
        signals,
        parsed
      };
    }
    function renderCompareGrid(quotes) {
      const scopeItems = [
        { key: "tearOff", label: "Tear off" },
        { key: "underlayment", label: "Underlayment" },
        { key: "flashing", label: "Flashing" },
        { key: "iceShield", label: "Ice & water" },
        { key: "dripEdge", label: "Drip edge" },
        { key: "ventilation", label: "Ventilation" },
        { key: "ridgeVent", label: "Ridge vent" },
        { key: "starterStrip", label: "Starter" },
        { key: "ridgeCap", label: "Ridge cap" },
        { key: "decking", label: "Decking" },
          { key: "disposal", label: "Disposal" },
          { key: "permit", label: "Permit" },
      ];
      const mid = latestAnalysis?.mid || 0;
      const maxPrice = Math.max(...quotes.map(q => q.price), 1);
      let bestIdx = 0;
      let bestScore = -1;
      quotes.forEach((q, i) => {
        const scopeScore = q.scopeConfirmed * 10; 
        const priceScore = Math.round((1 - q.price / maxPrice) * 100);
        const isSuspicious = mid > 0 && q.price < mid * 0.5 && q.scopeConfirmed < 5;
        const suspiciousPenalty = isSuspicious ? 30 : 0;
        const warrantyScore = q.warrantyYears ? Math.min(Number(q.warrantyYears), 50) : 0;
        q.totalScore = Math.max(0, Math.round(scopeScore * 0.45 + priceScore * 0.35 + warrantyScore * 0.2 - suspiciousPenalty));
        if (q.totalScore > bestScore) { bestScore = q.totalScore; bestIdx = i; }
      });
      const cols = quotes.length;
      const colW = Math.floor(100 / (cols + 1));
      const hdr = (label) => `<div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:var(--muted); padding:8px 0;">${label}</div>`;
      const cell = (val, isWinner) => `<div style="padding:8px 12px; font-size:14px; ${isWinner ? "background:#ecfdf5;" : ""}">${val}</div>`;
      const check = (status, quoteLabel, scopeKey) => {
        const isIncluded = status === "included";
        return `<span onclick="toggleCompareScope('${quoteLabel}','${scopeKey}')" style="cursor:pointer; display:inline-block; padding:2px 6px; border-radius:4px; transition:all 0.1s; ${isIncluded ? "color:#16a34a; font-weight:700; background:#ecfdf5;" : "color:#d97706; background:#fffbeb;"}" title="Click to toggle">${isIncluded ? "&#10003;" : "?"}</span>`;
      };
      let rows = "";
      rows += `<div style="display:grid; grid-template-columns:120px repeat(${cols}, 1fr); border-bottom:1px solid #f1f5f9;">`;
      rows += hdr("Contractor");
      quotes.forEach((q, i) => rows += cell(`<strong>${escapeHtml(q.contractor)}</strong>${i === bestIdx ? ' <span style="background:#16a34a; color:#fff; font-size:10px; padding:2px 6px; border-radius:999px; font-weight:700;">BEST</span>' : ''}`, i === bestIdx));
      rows += "</div>";
      rows += `<div style="display:grid; grid-template-columns:120px repeat(${cols}, 1fr); border-bottom:1px solid #f1f5f9;">`;
      rows += hdr("Price");
      quotes.forEach((q, i) => rows += cell(`<strong>${safeFormatCurrency(q.price)}</strong>`, i === bestIdx));
      rows += "</div>";
      rows += `<div style="display:grid; grid-template-columns:120px repeat(${cols}, 1fr); border-bottom:1px solid #f1f5f9;">`;
      rows += hdr("$/sq ft");
      quotes.forEach((q, i) => rows += cell(q.roofSize > 0 ? "$" + (q.price / q.roofSize).toFixed(2) : "—", i === bestIdx));
      rows += "</div>";
      rows += `<div style="display:grid; grid-template-columns:120px repeat(${cols}, 1fr); border-bottom:1px solid #f1f5f9;">`;
      rows += hdr("Material");
      quotes.forEach((q, i) => rows += cell(escapeHtml(q.material), i === bestIdx));
      rows += "</div>";
      rows += `<div style="display:grid; grid-template-columns:120px repeat(${cols}, 1fr); border-bottom:1px solid #f1f5f9;">`;
      rows += hdr("Warranty");
      quotes.forEach((q, i) => rows += cell(q.warrantyYears ? q.warrantyYears + " yr" : "?", i === bestIdx));
      rows += "</div>";
      rows += `<div style="display:grid; grid-template-columns:120px repeat(${cols}, 1fr); border-bottom:1px solid #f1f5f9;">`;
      rows += hdr("Scope");
      quotes.forEach((q, i) => {
        const liveConfirmed = scopeItems.filter(si => getScopeStatus(q.label, si.key, q.signals) === "included").length;
        q.scopeConfirmed = liveConfirmed;
        const pct = Math.round((liveConfirmed / q.scopeTotal) * 100);
        const color = pct >= 70 ? "#16a34a" : pct >= 40 ? "#d97706" : "#dc2626";
        rows += cell(`<strong style="color:${color};">${liveConfirmed}/${q.scopeTotal}</strong>`, i === bestIdx);
      });
      rows += "</div>";
      scopeItems.forEach(item => {
        rows += `<div style="display:grid; grid-template-columns:120px repeat(${cols}, 1fr); border-bottom:1px solid #f8fafc;">`;
        rows += `<div style="font-size:12px; color:var(--muted); padding:4px 0;">${item.label}</div>`;
        quotes.forEach((q, i) => {
          const status = getScopeStatus(q.label, item.key, q.signals);
          rows += `<div style="padding:4px 12px; ${i === bestIdx ? "background:#ecfdf5;" : ""}">${check(status, q.label, item.key)}</div>`;
        });
        rows += "</div>";
      });
      rows += `<div style="display:grid; grid-template-columns:120px repeat(${cols}, 1fr); border-top:2px solid #e2e8f0; margin-top:4px;">`;
      rows += hdr("Score");
      quotes.forEach((q, i) => rows += cell(`<strong style="font-size:18px;">${q.totalScore}</strong><span style="font-size:12px; color:var(--muted);">/100</span>`, i === bestIdx));
      rows += "</div>";
      const winner = quotes[bestIdx];
      const reasons = [];
      if (winner.scopeConfirmed >= 7) reasons.push("Most complete scope (" + winner.scopeConfirmed + " of " + winner.scopeTotal + " items)");
      else if (winner.scopeConfirmed === Math.max(...quotes.map(q => q.scopeConfirmed))) reasons.push("Best scope coverage among all quotes");
      if (mid > 0) {
        const dist = Math.abs(winner.price - mid);
        const isClosest = quotes.every(q => Math.abs(q.price - mid) >= dist - 1);
        if (isClosest) reasons.push("Price closest to market midpoint (" + safeFormatCurrency(mid) + ")");
      }
      if (winner.warrantyYears && Number(winner.warrantyYears) >= 10) reasons.push("Strong warranty (" + winner.warrantyYears + " years)");
      if (reasons.length === 0) reasons.push("Best overall value based on price, scope, and warranty");
      const cheapest = [...quotes].sort((a, b) => a.price - b.price)[0];
      let cheapWarning = "";
      if (cheapest !== winner && cheapest.scopeConfirmed < 5) {
        cheapWarning = `<div style="margin-top:12px; padding:10px 14px; background:#fffbeb; border:1px solid #fde68a; border-radius:8px; font-size:13px; color:#92400e;">${escapeHtml(cheapest.contractor)} (${safeFormatCurrency(cheapest.price)}) is cheapest but only confirms ${cheapest.scopeConfirmed} scope items — likely incomplete.</div>`;
      }
      const winnerCard = `
        <div style="margin-top:20px; padding:20px; background:#ecfdf5; border:2px solid #a7f3d0; border-radius:14px;">
          <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#166534; margin-bottom:6px;">Winner</div>
          <div style="font-size:24px; font-weight:800; margin-bottom:8px;">${escapeHtml(winner.contractor)} is the best value</div>
          <div style="font-size:20px; font-weight:700; margin-bottom:12px;">${safeFormatCurrency(winner.price)} <span style="font-size:14px; color:var(--muted);">Score: ${winner.totalScore}/100</span></div>
          <ul style="margin:0 0 8px; padding-left:18px; font-size:14px; color:#374151;">
            ${reasons.map(r => `<li style="margin-bottom:4px;">${escapeHtml(r)}</li>`).join("")}
          </ul>
          ${cheapWarning}
        </div>
      `;
      const hint = `<div style="font-size:12px; color:var(--muted); text-align:center; margin-top:8px;">Tap any ✓ or ? to correct scope items. Winner recalculates automatically.</div>`;
      return `<div style="border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; overflow-x:auto; background:#fff;">${rows}</div>${hint}${winnerCard}`;
    }
    window.showCompareScreen = function showCompareScreen() {
      const root = document.getElementById("appRoot");
      if (!root) return;
      const a = latestAnalysis || {};
      const parsed = latestParsed || {};
      const q1 = buildQuoteSummary(parsed, "Quote 1");
      if (q1) { q1.price = a.quotePrice || q1.price; }
      const scopeKeys = ["tearOff","underlayment","flashing","iceShield","dripEdge","ventilation","ridgeVent","starterStrip","ridgeCap","decking","disposal","permit"];
      const q1Confirmed = scopeKeys.filter(k => (parsed.signals || {})[k]?.status === "included").length;
      function renderUploadCard(num, state) {
        const p = state;
        if (p) {
          const contractor = repairDisplayText(p.contractor && p.contractor !== "Not detected" ? p.contractor : "Quote " + num);
          const price = Number(p.finalBestPrice || p.totalLinePrice || p.price || 0);
          const confirmed = scopeKeys.filter(k => (p.signals || {})[k]?.status === "included").length;
          return `
            <div style="padding:16px; border:1px solid #a7f3d0; border-radius:12px; background:#ecfdf5;">
              <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:#166534; margin-bottom:4px;">Quote ${num} — Parsed</div>
              <div style="font-size:20px; font-weight:700;">${safeFormatCurrency(price)}</div>
              <div style="font-size:13px; color:#374151; margin-top:4px;">${escapeHtml(contractor)}</div>
              <div style="font-size:12px; color:var(--muted); margin-top:2px;">${confirmed}/${scopeKeys.length} scope items</div>
              <button class="btn secondary" style="margin-top:8px; font-size:12px; padding:6px 12px;" onclick="clearCompareQuote(${num})">Remove</button>
            </div>`;
        }
        return `
          <div style="padding:20px; border:2px dashed #e2e8f0; border-radius:12px; text-align:center;">
            <div style="font-size:14px; font-weight:700; margin-bottom:8px;">Quote ${num}${num === 3 ? " (optional)" : ""}</div>
            <div style="font-size:13px; color:var(--muted); margin-bottom:12px;">Upload a PDF or image of the competing quote</div>
            <input id="compareFile${num}" type="file" accept=".pdf,image/*" style="display:none;">
            <button class="btn secondary" onclick="document.getElementById('compareFile${num}').click()">Upload quote</button>
            <div id="compareStatus${num}" style="font-size:12px; color:var(--muted); margin-top:8px;"></div>
            <div style="margin-top:10px; font-size:12px; color:var(--muted);">or enter manually:</div>
            <input id="comparePrice${num}" type="number" placeholder="Total price" style="width:60%; padding:8px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; margin-top:6px;">
          </div>`;
      }
      root.innerHTML = `
        <div style="max-width:900px; margin:40px auto; padding:0 24px;">
          <h2 style="margin:0 0 8px; font-size:28px;">Compare your quotes</h2>
          <p style="color:var(--muted); margin:0 0 24px;">Upload competing bids. We'll parse each one and compare scope, price, and warranty side by side.</p>
          <div style="display:grid; grid-template-columns:repeat(${compareState.q3 || true ? 3 : 2}, 1fr); gap:12px; margin-bottom:24px;">
            <div style="padding:16px; border:1px solid #e2e8f0; border-radius:12px; background:#f8fafc;">
              <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--muted); margin-bottom:4px;">Your quote</div>
              <div style="font-size:20px; font-weight:700;">${safeFormatCurrency(a.quotePrice || 0)}</div>
              <div style="font-size:13px; color:#374151; margin-top:4px;">${escapeHtml(repairDisplayText(q1?.contractor || "Your quote"))}</div>
              <div style="font-size:12px; color:var(--muted); margin-top:2px;">${q1Confirmed}/${scopeKeys.length} scope items</div>
            </div>
            ${renderUploadCard(2, compareState.q2)}
            ${renderUploadCard(3, compareState.q3)}
          </div>
          <div id="compareGridOutput"></div>
          <div class="action-buttons" style="margin-top:20px;">
            <button class="btn" id="runCompareBtn" onclick="runFullComparison()">Compare and pick winner</button>
            <button class="btn secondary" onclick="setJourneyStep('result')">Back to result</button>
          </div>
        </div>
      `;
      [2, 3].forEach(num => {
        const fileInput = document.getElementById("compareFile" + num);
        if (fileInput) {
          fileInput.addEventListener("change", async function() {
            const file = fileInput.files?.[0];
            if (!file) return;
            const status = document.getElementById("compareStatus" + num);
            if (status) status.innerHTML = '<span style="color:var(--brand);">Parsing<span class="parsing-dots">...</span></span>';
            if (typeof loadVendorLibs === "function") await loadVendorLibs();
            try {
              const bundle = await parseUploadedComparisonFile(file);
              const p = bundle?.parsed || bundle || {};
              compareState["q" + num] = p;
              if (num === 2) secondParsed = p;
              if (num === 3) thirdParsed = p;
              showCompareScreen(); 
            } catch (e) {
              if (status) status.textContent = "Could not read this file. Try another.";
            }
          });
        }
      });
    }
    window.toggleCompareScope = function toggleCompareScope(quoteLabel, scopeKey) {
      const overrideKey = quoteLabel + "|" + scopeKey;
      const current = compareState.scopeOverrides[overrideKey];
      if (current === undefined) {
        compareState.scopeOverrides[overrideKey] = true; 
      } else {
        compareState.scopeOverrides[overrideKey] = !current;
      }
      runFullComparison();
      setTimeout(function() {
        var winnerCard = document.querySelector('[style*="border:2px solid #a7f3d0"]');
        if (winnerCard) {
          winnerCard.style.transition = 'box-shadow 0.3s';
          winnerCard.style.boxShadow = '0 0 0 4px rgba(16,185,129,0.3)';
          setTimeout(function() { winnerCard.style.boxShadow = ''; }, 800);
        }
      }, 100);
    };
    window.clearCompareQuote = function clearCompareQuote(num) {
      compareState["q" + num] = null;
      if (num === 2) secondParsed = null;
      if (num === 3) thirdParsed = null;
      showCompareScreen();
    };
    window.runFullComparison = function runFullComparison() {
      const a = latestAnalysis || {};
      const parsed = latestParsed || {};
      const quotes = [];
      const q1 = buildQuoteSummary(parsed, "Quote 1");
      if (q1) { q1.price = a.quotePrice || q1.price; quotes.push(q1); }
      if (compareState.q2) {
        const q2 = buildQuoteSummary(compareState.q2, "Quote 2");
        if (q2 && q2.price > 0) quotes.push(q2);
      } else {
        const manualPrice = Number(document.getElementById("comparePrice2")?.value || 0);
        if (manualPrice > 0) {
          quotes.push({ label: "Quote 2", contractor: "Quote 2", price: manualPrice, material: "Unknown", warranty: "", warrantyYears: "", roofSize: 0, scopeConfirmed: 0, scopeTotal: 10, signals: {}, totalScore: 0 });
        }
      }
      if (compareState.q3) {
        const q3 = buildQuoteSummary(compareState.q3, "Quote 3");
        if (q3 && q3.price > 0) quotes.push(q3);
      } else {
        const manualPrice = Number(document.getElementById("comparePrice3")?.value || 0);
        if (manualPrice > 0) {
          quotes.push({ label: "Quote 3", contractor: "Quote 3", price: manualPrice, material: "Unknown", warranty: "", warrantyYears: "", roofSize: 0, scopeConfirmed: 0, scopeTotal: 10, signals: {}, totalScore: 0 });
        }
      }
      if (quotes.length < 2) {
        const output = document.getElementById("compareGridOutput");
        if (output) output.innerHTML = '<div style="padding:16px; color:#b91c1c; text-align:center;">Upload or enter at least one competing quote to compare.</div>';
        return;
      }
      const output = document.getElementById("compareGridOutput");
      if (output) output.innerHTML = renderCompareGrid(quotes);
    };
    window.showShareScreen = function showShareScreen() {
      const root = document.getElementById("appRoot");
      if (!root) return;
      const a = window.__latestAnalysis || {};
      const parsed = latestParsed || {};
      const signals = parsed.signals || {};
      const contractor = parsed.contractor && parsed.contractor !== "Not detected" ? repairDisplayText(parsed.contractor) : "";
      const city = a.city || "";
      const state = a.stateCode || "";
      const location = city && state ? city + ", " + state : city || "your area";
      const materialLabel = a.material && typeof getMaterialLabel === "function" ? getMaterialLabel(a.material) : a.material || "Unknown";
      const roofMeta = a?.meta?.roofSize || {};
      const roofSize = roofMeta?.value ?? a?.roofSize ?? null;
      const ppsf = roofSize > 0 ? (a.quotePrice / roofSize).toFixed(2) : null;
      const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const scopeItems = [
        { key: "tearOff", label: "Tear off" },
        { key: "underlayment", label: "Underlayment" },
        { key: "flashing", label: "Flashing" },
        { key: "iceShield", label: "Ice & water shield" },
        { key: "dripEdge", label: "Drip edge" },
        { key: "ventilation", label: "Ventilation" },
        { key: "ridgeVent", label: "Ridge vent" },
        { key: "starterStrip", label: "Starter strip" },
        { key: "ridgeCap", label: "Ridge cap" },
        { key: "decking", label: "Decking" },
          { key: "disposal", label: "Disposal" },
          { key: "permit", label: "Permit" },
      ];
      const foundItems = scopeItems.filter(i => scopeReviewState[i.key] || signals[i.key]?.status === "included");
      const missingItems = scopeItems.filter(i => !scopeReviewState[i.key] && signals[i.key]?.status !== "included");
      const scopeHtml = `
        <div class="report-scope-grid">
          ${foundItems.map(i => `<span class="report-scope-item report-scope-item--found">&#10003; ${escapeHtml(i.label)}</span>`).join("")}
          ${missingItems.map(i => `<span class="report-scope-item report-scope-item--missing">? ${escapeHtml(i.label)}</span>`).join("")}
        </div>
      `;
      const deltaFromMid = a.quotePrice - a.mid;
      const deltaAbs = Math.abs(deltaFromMid);
      const deltaDir = deltaFromMid > 0 ? "above" : "below";
      root.innerHTML = `
        <div class="report-container">
          <div class="report-card">
            <div class="report-header">
              <div class="tp-logo--report">TruePrice</div>
              <div class="report-header-meta">
                Quote Analysis Report<br>${escapeHtml(date)}
              </div>
            </div>
            <div class="report-body">
              <div class="report-section">
                <div class="report-section-title">Verdict</div>
                <div class="report-verdict">${escapeHtml(getVerdictHeadline(a.verdict))}</div>
                ${deltaAbs >= 100 ? `<div class="report-delta">${safeFormatCurrency(deltaAbs)} ${deltaDir} expected midpoint</div>` : ""}
              </div>
              <div class="report-section">
                <div class="report-section-title">Quote Details</div>
                <div class="report-stat-grid">
                  <div class="report-stat">
                    <div class="report-stat-label">Quote Price</div>
                    <div class="report-stat-value">${safeFormatCurrency(a.quotePrice)}</div>
                  </div>
                  <div class="report-stat">
                    <div class="report-stat-label">Expected Range</div>
                    <div class="report-stat-value">${safeFormatCurrency(a.low)} &ndash; ${safeFormatCurrency(a.high)}</div>
                  </div>
                  <div class="report-stat">
                    <div class="report-stat-label">Material</div>
                    <div class="report-stat-value">${escapeHtml(materialLabel)}</div>
                  </div>
                  <div class="report-stat">
                    <div class="report-stat-label">Roof Size</div>
                    <div class="report-stat-value">${roofSize ? Number(roofSize).toLocaleString() + " sq ft" : "Unknown"}</div>
                  </div>
                  ${ppsf ? `<div class="report-stat"><div class="report-stat-label">Price / Sq Ft</div><div class="report-stat-value">$${ppsf}</div></div>` : ""}
                  ${a.warrantyYears ? `<div class="report-stat"><div class="report-stat-label">Warranty</div><div class="report-stat-value">${escapeHtml(String(a.warrantyYears))} years</div></div>` : ""}
                </div>
              </div>
              ${contractor ? `
                <div class="report-section">
                  <div class="report-section-title">Contractor</div>
                  <div style="font-size:16px; font-weight:600;">${escapeHtml(contractor)}</div>
                  ${location !== "your area" ? `<div style="font-size:14px; color:var(--muted);">${escapeHtml(location)}</div>` : ""}
                </div>
              ` : ""}
              <div class="report-section">
                <div class="report-section-title">Scope Items</div>
                ${scopeHtml}
                ${missingItems.length > 0 ? `<div style="margin-top:10px; font-size:13px; color:#92400e;">${missingItems.length} item${missingItems.length > 1 ? "s" : ""} not confirmed in quote</div>` : `<div style="margin-top:10px; font-size:13px; color:#166534;">All scope items confirmed</div>`}
              </div>
              <div class="report-section">
                <div class="report-section-title">Market Context</div>
                <div style="font-size:14px; color:var(--text); line-height:1.6;">
                  ${location !== "your area" ? `Based on pricing data for ${escapeHtml(location)}. ` : ""}Expected midpoint for this roof: ${safeFormatCurrency(a.mid)}.
                  ${deltaAbs >= 100 ? ` This quote is ${safeFormatCurrency(deltaAbs)} ${deltaDir} the midpoint.` : " This quote is in line with expected pricing."}
                </div>
              </div>
            </div>
            <div class="report-footer">
              Generated by TruePrice &bull; truepricehq.com &bull; ${escapeHtml(date)}
            </div>
          </div>
          <div class="action-buttons report-actions" style="margin-top:20px; justify-content:center;">
            <button class="btn" onclick="emailReport()">Email this report</button>
            <button class="btn secondary" onclick="copyShareableReportText()">Copy as text</button>
            <button class="btn secondary" onclick="window.print()">Print / Save PDF</button>
            <button class="btn secondary" onclick="setJourneyStep('result')">Back to result</button>
          </div>
        </div>
      `;
    }
    window.showDetailsScreen = function showDetailsScreen() {
      const output = document.getElementById("analysisOutput");
      if (!output) return;
      output.innerHTML = `
        <div>
          ${buildResultTrustHtml(latestAnalysis)}
          ${buildRiskFlagsHtml(latestAnalysis)}
          <button class="btn secondary" onclick="renderApp()">← Back</button>
        </div>
      `;
    }
    function getBrandFooterText() {
      return "Generated by TruePrice Roofing Quote Analyzer";
    }
    window.setUploadStatus = setUploadStatus;
    window.analyzeParsedText = analyzeParsedText;
    window.analyzeQuote = analyzeQuote;
    window.resetAnalyzer = resetAnalyzer;
    window.copyParsedToForm = copyParsedToForm;
    window.compareQuotes = compareQuotes;
    window.viewShareableResult = viewShareableResult;
    window.showLeadPlaceholder = showLeadPlaceholder;
    window.buildAIExplanation = buildAIExplanation;
    window.copyShareableReportText = copyShareableReportText;
    window.copyContractorQuestions = copyContractorQuestions;
    window.buildShareableReportData = buildShareableReportData;
    window.setSmartUploadStatus = setSmartUploadStatus;
    window.formatRoofSizeForDisplay = formatRoofSizeForDisplay;
    window.getBrandFooterText = getBrandFooterText; 
    window.initAnalyzerUI = initAnalyzerUI;
    window.bindRenderedAnalysisUi = bindRenderedAnalysisUi;
    window.renderComparisonResults = renderComparisonResults;
    window.renderShareableReport = renderShareableReport;
    window.renderAnalysisResultUi = renderAnalysisResultUi;
    window.mountExistingAnalyzer = mountExistingAnalyzer;
    window.renderApp = function renderApp() {
      const root = document.getElementById("appRoot");
      if (!root) return;
      if (journeyState.step === "address") {
        root.innerHTML = renderAddressStep();
        setTimeout(() => {
          const btn = document.getElementById("uploadQuoteBtn");
          const input = document.getElementById("quoteFile");
          if (btn && input && !btn.dataset.bound) {
            btn.dataset.bound = "true";
            btn.addEventListener("click", () => input.click());
            input.addEventListener("change", async function () {
              const file = input.files?.[0];
              if (!file) return;
              renderAnalyzingState();
              try {
                const parsedBundle = await parseUploadedComparisonFile(file);
                const parsed = parsedBundle?.parsed || parsedBundle || {};
                latestParsed = parsed;
                if (shouldPromoteAddress(latestParsed)) {
                  journeyState.propertyPreview = {
                    street: latestParsed.address?.street || "",
                    apt: "",
                    city: latestParsed.city || latestParsed.address?.city || "",
                    state: latestParsed.stateCode || latestParsed.address?.stateCode || "",
                    zip: latestParsed.address?.zip || ""
                  };
                }
                journeyState.propertyConfirmed = true;
                confirmProperty();
              } catch (err) {
                console.error("Upload parse error:", err);
                journeyState.propertyConfirmed = true;
                confirmProperty();
              }
            });
          }
          const addrInput = document.getElementById("journeyStreetAddress");
          const sugBox = document.getElementById("addressSuggestions");
          if (addrInput && sugBox) {
            let debounceTimer = null;
            addrInput.addEventListener("input", function() {
              clearTimeout(debounceTimer);
              const q = addrInput.value.trim();
              if (q.length < 4) { sugBox.style.display = "none"; return; }
              debounceTimer = setTimeout(async function() {
                try {
                  const res = await fetch("/api/geocode-suggest?q=" + encodeURIComponent(q));
                  const data = await res.json();
                  if (!data.suggestions || data.suggestions.length === 0) { sugBox.style.display = "none"; return; }
                  sugBox.innerHTML = data.suggestions.map(function(s, i) {
                    return '<div data-idx="' + i + '" style="padding:10px 14px; cursor:pointer; font-size:14px; border-bottom:1px solid #f1f5f9; transition:background 0.1s;" onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'#fff\'">' + escapeHtml(s.label) + '</div>';
                  }).join("");
                  sugBox.style.display = "block";
                  sugBox.querySelectorAll("[data-idx]").forEach(function(el) {
                    el.addEventListener("click", function() {
                      const idx = parseInt(el.dataset.idx);
                      const s = data.suggestions[idx];
                      if (!s) return;
                      addrInput.value = s.street || s.label.split(",")[0] || "";
                      var cityEl = document.getElementById("journeyCity");
                      var stateEl = document.getElementById("journeyState");
                      var zipEl = document.getElementById("journeyZipCode");
                      if (cityEl) cityEl.value = s.city || "";
                      if (stateEl) stateEl.value = s.state || "";
                      if (zipEl) zipEl.value = s.zip || "";
                      sugBox.style.display = "none";
                    });
                  });
                } catch (e) { sugBox.style.display = "none"; }
              }, 300);
            });
            document.addEventListener("click", function(e) {
              if (!addrInput.contains(e.target) && !sugBox.contains(e.target)) {
                sugBox.style.display = "none";
              }
            });
          }
        }, 0);
        return;
      }
      if (journeyState.step === "confirm") {
        root.innerHTML = renderConfirmStep();
        return;
      }
      if (journeyState.step === "property_not_found") {
        root.innerHTML = renderPropertyNotFoundStep();
        return;
      }
      if (journeyState.step === "analyze") {
        root.innerHTML = renderAnalyzeStep();
        if (typeof mountExistingAnalyzer === "function") {
          setTimeout(() => {
            mountExistingAnalyzer("analyzeMount");
          }, 0);
        }
        return;
      }
      if (journeyState.step === "result") {
      root.innerHTML = renderResultStep();
      return;
    }
    };
    window.renderAddressStep = function renderAddressStep() {
      const urlParams = new URLSearchParams(window.location.search);
      const prefillCity = urlParams.get("city") || "";
      const prefillState = urlParams.get("state") || "";
      const localContext = prefillCity && prefillState
        ? `<div style="margin:0 0 18px; padding:10px 14px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; font-size:14px; color:#166534; font-weight:500;">Showing local pricing for ${escapeHtml(prefillCity)}, ${escapeHtml(prefillState)}</div>`
        : "";
      return `
        <div class="journey-start">
          <div class="journey-start-card" style="max-width:720px; margin:48px auto; padding:30px; background:#ffffff; border:1px solid #e5e7eb; border-radius:24px; box-shadow:0 10px 30px rgba(15,23,42,0.06);">
            ${localContext}
            <h1 style="margin:0 0 10px; font-size:38px; line-height:1.05; letter-spacing:-0.03em; color:#0f172a;">
              Is your roofing quote fair?
            </h1>
            <p class="muted" style="margin:0 0 24px; font-size:16px;">
              Upload your quote. Get your answer in 30 seconds. Free, private, no signup.
            </p>
            <!-- PRIMARY: UPLOAD -->
            <div style="border:2px solid #bfdbfe; border-radius:18px; padding:28px; text-align:center; margin:0 0 24px; background:#f8fbff;">
              <div style="font-size:22px; font-weight:700; margin-bottom:8px; color:#0f172a;">
                Upload your roofing quote
              </div>
              <div class="small muted" style="margin-bottom:16px;">
                PDF, screenshot, or phone photo
              </div>
              <input
                id="quoteFile"
                type="file"
                accept=".pdf,image/*"
                style="display:none;"
              />
              <button
                type="button"
                class="btn"
                id="uploadQuoteBtn"
                style="font-size:16px; padding:14px 28px;"
              >
                Upload quote
              </button>
              <div class="small muted" style="margin-top:12px; font-size:12px;">
                Private &bull; No spam &bull; No signup
              </div>
            </div>
            <!-- SECONDARY: ADDRESS -->
            <div style="border-top:1px solid #e5e7eb; padding-top:18px;">
              <p class="small muted" style="margin:0 0 12px;">
                No quote handy? Enter your address instead:
              </p>
              <div class="journey-address-grid">
                <div class="journey-address-full" style="position:relative;">
                  <input id="journeyStreetAddress" type="text" placeholder="Start typing your address..." autocomplete="off" />
                  <div id="addressSuggestions" style="display:none; position:absolute; top:100%; left:0; right:0; z-index:50; background:#fff; border:1px solid #e2e8f0; border-top:none; border-radius:0 0 10px 10px; box-shadow:0 8px 24px rgba(0,0,0,0.1); max-height:220px; overflow-y:auto;"></div>
                </div>
                <div>
                  <input id="journeyCity" type="text" placeholder="City" value="${escapeHtml(prefillCity)}" />
                </div>
                <div>
                  <input id="journeyState" type="text" maxlength="2" placeholder="State" value="${escapeHtml(prefillState)}" />
                </div>
                <div>
                  <input id="journeyZipCode" type="text" placeholder="ZIP code" />
                </div>
              </div>
              <button class="btn secondary" style="margin-top:12px;" onclick="handleAddressSubmit()">
                Check my property →
              </button>
              <div id="journeyAddressError" class="small" style="margin-top:10px; color:#b91c1c;"></div>
            </div>
          </div>
        </div>
      `;
    };
    window.renderConfirmStep = function renderConfirmStep() {
      const preview = journeyState.propertyPreview || {};
      const fullStreet = [preview.street, preview.apt].filter(Boolean).join(" ");
      const cityStateZip = [preview.city, preview.state, preview.zip].filter(Boolean).join(", ").replace(", ,", ",");
      return `
        <div class="wrap" style="max-width:720px; margin:56px auto;">
          <div class="panel" style="padding:28px; border:1px solid #e5e7eb; border-radius:20px; background:#ffffff; box-shadow:0 10px 30px rgba(15,23,42,0.06);">
            <div style="font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#2563eb; margin:0 0 10px;">
              Confirm property
            </div>
            <h2 style="margin:0 0 10px; font-size:34px; line-height:1.08; letter-spacing:-0.03em; color:#0f172a;">
              Is this the right property?
            </h2>
            <p class="muted" style="margin:0 0 18px; font-size:16px; line-height:1.5; color:#475569;">
              We’ll use this address to estimate roof size and improve quote accuracy before showing your decision.
            </p>
            <div style="margin:0 0 18px; padding:18px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px;">
              <div style="font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:#475569; margin:0 0 8px;">
                Property address
              </div>
              <div style="font-size:24px; line-height:1.2; font-weight:700; color:#0f172a; margin:0 0 6px;">
                ${escapeHtml(fullStreet || "Address not available")}
              </div>
              <div style="font-size:15px; color:#475569;">
                ${escapeHtml(cityStateZip || "City / state not available")}
              </div>
            </div>
            <div style="display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:10px; margin:0 0 20px;">
              <div style="padding:14px; background:#f8fafc; border:1px solid #e5e7eb; border-radius:14px;">
                <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:#64748b; margin:0 0 4px;">
                  Step 1
                </div>
                <div style="font-size:14px; font-weight:600; color:#0f172a;">
                  Estimate roof size
                </div>
              </div>
              <div style="padding:14px; background:#f8fafc; border:1px solid #e5e7eb; border-radius:14px;">
                <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:#64748b; margin:0 0 4px;">
                  Step 2
                </div>
                <div style="font-size:14px; font-weight:600; color:#0f172a;">
                  Scan your quote
                </div>
              </div>
              <div style="padding:14px; background:#f8fafc; border:1px solid #e5e7eb; border-radius:14px;">
                <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:#64748b; margin:0 0 4px;">
                  Step 3
                </div>
                <div style="font-size:14px; font-weight:600; color:#0f172a;">
                  Get decision
                </div>
              </div>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button class="btn" onclick="confirmProperty()" style="min-width:180px;">
                Looks correct
              </button>
              <button class="btn secondary" onclick="setJourneyStep('address')" style="min-width:120px;">
                Edit
              </button>
            </div>
          </div>
        </div>
      `;
    };
    window.renderPropertyNotFoundStep = function renderPropertyNotFoundStep() {
      const preview = journeyState.propertyPreview || {};
      const fullStreet = [preview.street, preview.apt].filter(Boolean).join(" ");
      const cityStateZip = [preview.city, preview.state, preview.zip].filter(Boolean).join(", ").replace(", ,", ",");
      return `
        <div class="wrap" style="max-width:720px; margin:56px auto;">
          <div class="panel" style="padding:28px; border:1px solid #fcd34d; border-radius:20px; background:#fffbeb; box-shadow:0 10px 30px rgba(15,23,42,0.04);">
            <div style="font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#b45309; margin:0 0 10px;">
              Property check
            </div>
            <h2 style="margin:0 0 10px; font-size:34px; line-height:1.08; letter-spacing:-0.03em; color:#0f172a;">
              We couldn’t confirm this property automatically
            </h2>
            <p style="margin:0 0 18px; font-size:16px; line-height:1.5; color:#475569;">
              You can still continue. We’ll fall back to quote details, home size, and pricing signals to estimate roof size.
            </p>
            <div style="margin:0 0 18px; padding:18px; background:#ffffff; border:1px solid #fde68a; border-radius:16px;">
              <div style="font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:#475569; margin:0 0 8px;">
                Entered address
              </div>
              <div style="font-size:22px; line-height:1.2; font-weight:700; color:#0f172a; margin:0 0 6px;">
                ${escapeHtml(fullStreet || "Address not available")}
              </div>
              <div style="font-size:15px; color:#475569;">
                ${escapeHtml(cityStateZip || "City / state not available")}
              </div>
            </div>
            ${
              journeyState.propertyLookupMessage
                ? `
                  <div class="panel" style="margin:0 0 16px; background:#fff7ed; border-color:#fdba74;">
                    <p style="margin:0;">
                      <strong>Note:</strong> ${escapeHtml(journeyState.propertyLookupMessage)}
                    </p>
                  </div>
                `
                : ""
            }
            <div style="display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:10px; margin:0 0 20px;">
              <div style="padding:14px; background:#ffffff; border:1px solid #f3f4f6; border-radius:14px;">
                <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:#64748b; margin:0 0 4px;">
                  Fallback 1
                </div>
                <div style="font-size:14px; font-weight:600; color:#0f172a;">
                  Read quote details
                </div>
              </div>
              <div style="padding:14px; background:#ffffff; border:1px solid #f3f4f6; border-radius:14px;">
                <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:#64748b; margin:0 0 4px;">
                  Fallback 2
                </div>
                <div style="font-size:14px; font-weight:600; color:#0f172a;">
                  Estimate from home size
                </div>
              </div>
              <div style="padding:14px; background:#ffffff; border:1px solid #f3f4f6; border-radius:14px;">
                <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:#64748b; margin:0 0 4px;">
                  Fallback 3
                </div>
                <div style="font-size:14px; font-weight:600; color:#0f172a;">
                  Price model estimate
                </div>
              </div>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button class="btn" onclick="continueWithoutPropertyMatch()" style="min-width:220px;">
                Continue anyway
              </button>
              <button class="btn secondary" onclick="setJourneyStep('address')" style="min-width:120px;">
                Edit address
              </button>
            </div>
          </div>
        </div>
      `;
    };
    window.renderAnalyzeStep = function renderAnalyzeStep() {
      const preview = journeyState.propertyPreview || {};
      const fullStreet = [preview.street, preview.apt].filter(Boolean).join(" ");
      const cityStateZip = [preview.city, preview.state, preview.zip].filter(Boolean).join(", ").replace(", ,", ",");
      return `
        <div class="wrap" style="max-width:960px; margin:40px auto;">
          <div style="margin:0 0 18px;">
            <div style="font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#2563eb; margin:0 0 8px;">
              Step 3 of 3
            </div>
            <h2 style="margin:0 0 8px; font-size:34px; line-height:1.08; letter-spacing:-0.03em; color:#0f172a;">
              Analyze your quote
            </h2>
            <p class="muted" style="margin:0 0 14px; font-size:16px; line-height:1.5; color:#475569;">
              Upload your quote or complete any missing fields below. We’ll compare it against expected local pricing and tell you what to do next.
            </p>
            ${
              fullStreet || cityStateZip
                ? `
                  <div class="panel" style="margin:0; padding:14px 16px; background:#f8fafc; border-color:#e5e7eb;">
                    <p style="margin:0 0 4px; font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:#475569;">
                      Property
                    </p>
                    <p style="margin:0; font-size:15px; color:#0f172a; font-weight:600;">
                      ${escapeHtml(fullStreet || "Address not available")}
                    </p>
                    <p style="margin:4px 0 0; font-size:14px; color:#64748b;">
                      ${escapeHtml(cityStateZip || "")}
                    </p>
                  </div>
                `
                : ""
            }
          </div>
          <div id="analyzeMount"></div>
        </div>
      `;
    };
    function renderInlineAnalyzingState(percent = 30, message = "Analyzing your quote…") {
      const el = document.getElementById("inlineAnalyzingState");
      if (!el) return;
      el.innerHTML = `
        <div class="panel" style="margin:0 0 14px; text-align:center;">
          <img src="/images/trudy-working.png" alt="Trudy" width="80" class="trudy-bounce" style="margin-bottom:10px;" />
          <div style="font-size:24px; font-weight:800; margin-bottom:8px;">${message}</div>
          <p class="small muted" style="margin:0 0 14px;">Extracting price, roof size, and risk signals</p>
          <div style="height:8px; background:#e5e7eb; border-radius:999px; overflow:hidden;">
            <div id="analysisProgressBar" style="width:${percent}%; height:100%; background:#2563eb; transition:width .4s;"></div>
          </div>
        </div>
      `;
    }
    function renderAnalyzingState() {
      const root = document.getElementById("appRoot");
      if (!root) return;
      root.innerHTML = `
        <div style="max-width:720px; margin:80px auto; text-align:center; padding:0 24px;">
          <img src="/images/trudy-working.png" alt="Trudy" width="140" class="trudy-bounce" style="margin-bottom:16px;" />
          <div class="progress-phase" id="analysisPhaseLabel">
            Reading your document...
          </div>
          <div class="progress-sub" id="analysisPhaseDetail">
            Extracting price, material, and scope details
          </div>
          <div style="height:8px; background:#e5e7eb; border-radius:999px; overflow:hidden; margin-bottom:18px;">
            <div id="analysisProgressBar" style="width:10%; height:100%; background:var(--brand); transition:width .4s;"></div>
          </div>
          <div class="small muted" style="margin-bottom:24px;">
            This takes ~5-10 seconds
          </div>
          <div class="extraction-preview" id="extractionPreview"></div>
        </div>
      `;
      const phases = [
        { pct: 20, label: "Extracting price, material, and scope...", detail: "Scanning document for key pricing signals", delay: 1500 },
        { pct: 45, label: "Looking up your property...", detail: "Estimating roof size from address data", delay: 3500 },
        { pct: 65, label: "Comparing against local pricing...", detail: "Matching to city-level benchmarks", delay: 5000 },
        { pct: 85, label: "Checking for risks and missing items...", detail: "Reviewing scope signals and risk flags", delay: 7000 },
        { pct: 95, label: "Generating your decision...", detail: "Assembling your personalized result", delay: 8500 }
      ];
      phases.forEach(phase => {
        setTimeout(() => {
          const bar = document.getElementById("analysisProgressBar");
          const label = document.getElementById("analysisPhaseLabel");
          const detail = document.getElementById("analysisPhaseDetail");
          if (bar) bar.style.width = phase.pct + "%";
          if (label) label.textContent = phase.label;
          if (detail) detail.textContent = phase.detail;
          const preview = document.getElementById("extractionPreview");
          if (preview && latestParsed) {
            let items = [];
            if (latestParsed.price) items.push({ label: "Price", value: "$" + Number(latestParsed.price).toLocaleString() });
            if (latestParsed.materialLabel) items.push({ label: "Material", value: latestParsed.materialLabel });
            if (latestParsed.roofSize) items.push({ label: "Roof size", value: latestParsed.roofSize + " sq ft" });
            if (latestParsed.city) items.push({ label: "Location", value: latestParsed.city + (latestParsed.stateCode ? ", " + latestParsed.stateCode : "") });
            if (items.length > 0) {
              preview.innerHTML = items.map(item =>
                `<div class="extraction-item">
                  <span class="extraction-item-label">${escapeHtml(item.label)}</span>
                  <span class="extraction-item-value">${escapeHtml(item.value)}</span>
                </div>`
              ).join("");
            }
          }
        }, phase.delay);
      });
    }
    window.setJourneyStep = function setJourneyStep(step) {
      journeyState.step = step;
      renderApp();
      if (step === "result") {
        setTimeout(function() { window.scrollTo({ top: 0, behavior: 'smooth' }); }, 50);
      }
    };
    window.continueWithoutPropertyMatch = function continueWithoutPropertyMatch() {
      journeyState.propertyConfirmed = true;
      confirmProperty();
    };
    window.handleAddressSubmit = function handleAddressSubmit() {
      const street = document.getElementById("journeyStreetAddress")?.value?.trim() || "";
      const apt = document.getElementById("journeyAptUnit")?.value?.trim() || "";
      const city = document.getElementById("journeyCity")?.value?.trim() || "";
      const state = document.getElementById("journeyState")?.value?.trim().toUpperCase() || "";
      const zip = document.getElementById("journeyZipCode")?.value?.trim() || "";
      const errorEl = document.getElementById("journeyAddressError");
      if (!street || !city || !state) {
        if (errorEl) {
          errorEl.style.display = "block";
          errorEl.textContent = "Please enter street, city, and state.";
        }
        return;
      }
      if (errorEl) {
        errorEl.style.display = "none";
        errorEl.textContent = "";
      }
      journeyState.propertyPreview = {
        street,
        apt,
        city,
        state,
        zip
      };
      journeyState.propertyLookupAttempted = true;
      journeyState.propertyLookupFailed = false;
      journeyState.propertyLookupMessage = "";
      const looksWeak =
        street.length < 5 ||
        city.length < 2 ||
        state.length !== 2;
      if (looksWeak) {
        journeyState.propertyLookupFailed = true;
        journeyState.propertyLookupMessage = "This address may be incomplete or hard to verify.";
        setJourneyStep("property_not_found");
        return;
      }
      setJourneyStep("confirm");
    };
    window.confirmProperty = function confirmProperty() {
      journeyState.propertyConfirmed = true;
      const root = document.getElementById("appRoot");
      if (!root) return;
      const hasQuoteData = latestParsed && (latestParsed.price || latestParsed.finalBestPrice || latestParsed.totalLinePrice);
      if (!hasQuoteData) {
        const preview = journeyState.propertyPreview || {};
        const addr = [preview.street, preview.city, preview.state, preview.zip].filter(Boolean).join(", ");
        root.innerHTML = `
          <div style="max-width:720px; margin:60px auto; padding:0 24px;">
            <div style="padding:28px; background:#fff; border:1px solid #e2e8f0; border-radius:18px; box-shadow:0 4px 16px rgba(15,23,42,0.06); text-align:center;">
              ${addr ? `<div style="font-size:13px; color:var(--muted); margin-bottom:12px; padding:8px 14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; display:inline-block;">${repairDisplayText(escapeHtml(addr))}</div>` : ""}
              <h2 style="margin:12px 0 8px; font-size:28px; letter-spacing:-0.02em;">Now upload your quote</h2>
              <p style="color:var(--muted); margin:0 0 20px;">We saved your address. Upload your contractor's estimate and we'll compare it against local pricing.</p>
              <input id="quoteFile" type="file" accept=".pdf,image/*" style="display:none;" />
              <button type="button" class="btn" id="uploadQuoteBtn" style="font-size:16px; padding:14px 28px;" onclick="document.getElementById('quoteFile').click()">Upload quote</button>
              <div style="margin-top:14px; font-size:13px; color:var(--muted);">PDF, screenshot, or phone photo</div>
            </div>
          </div>
        `;
        const input = document.getElementById("quoteFile");
        if (input) {
          input.addEventListener("change", async function() {
            const file = input.files?.[0];
            if (!file) return;
            const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'];
            if (!validTypes.includes(file.type) && !file.name.match(/\.(pdf|jpg|jpeg|png|webp|gif)$/i)) {
              alert('Please upload a PDF or image file (JPG, PNG, or PDF).');
              return;
            }
            if (file.size > 20 * 1024 * 1024) {
              alert('File is too large. Please upload a file under 20MB.');
              return;
            }
            if (typeof loadVendorLibs === "function") await loadVendorLibs();
            root.innerHTML = '<div style="max-width:720px; margin:80px auto; text-align:center; padding:0 24px;"><div class="progress-phase">Reading your quote...</div><div style="height:8px; background:#e5e7eb; border-radius:999px; overflow:hidden; margin:18px 0;"><div style="width:30%; height:100%; background:var(--brand, #1d4ed8); transition:width .4s;"></div></div></div>';
            try {
              const parsedBundle = await parseUploadedComparisonFile(file);
              latestParsed = parsedBundle?.parsed || parsedBundle || {};
              confirmProperty();
            } catch (err) {
              root.innerHTML = '<div style="max-width:720px; margin:80px auto; text-align:center; padding:24px;"><p>Could not read the quote. Please try again.</p><button class="btn secondary" onclick="setJourneyStep(\'address\')">Back</button></div>';
            }
          });
        }
        return;
      }
      let previewHtml = "";
      if (latestParsed) {
        let items = [];
        if (latestParsed.price) items.push({ label: "Price", value: "$" + Number(latestParsed.price).toLocaleString() });
        if (latestParsed.materialLabel) items.push({ label: "Material", value: latestParsed.materialLabel });
        if (latestParsed.roofSize) items.push({ label: "Roof size", value: latestParsed.roofSize + " sq ft" });
        const loc = latestParsed.city || journeyState?.propertyPreview?.city || "";
        const st = latestParsed.stateCode || journeyState?.propertyPreview?.state || "";
        if (loc) items.push({ label: "Location", value: loc + (st ? ", " + st : "") });
        if (items.length > 0) {
          previewHtml = items.map(item =>
            `<div class="extraction-item">
              <span class="extraction-item-label">${escapeHtml(item.label)}</span>
              <span class="extraction-item-value">${escapeHtml(item.value)}</span>
            </div>`
          ).join("");
        }
      }
      const preview = journeyState.propertyPreview || {};
      const p = latestParsed || {};
      root.innerHTML = `
        <div style="max-width:720px; margin:80px auto; text-align:center; padding:0 24px;">
          <div class="progress-phase" id="analysisPhaseLabel">Analyzing your quote...</div>
          <div class="progress-sub" id="analysisPhaseDetail">Comparing against local pricing data</div>
          <div style="height:8px; background:#e5e7eb; border-radius:999px; overflow:hidden; margin-bottom:18px;">
            <div id="analysisProgressBar" style="width:30%; height:100%; background:var(--brand, #1d4ed8); transition:width .4s;"></div>
          </div>
          <div class="small muted">This takes ~5-10 seconds</div>
          <div class="extraction-preview" id="extractionPreview">${previewHtml}</div>
          <div style="max-width:640px; margin:24px auto 0; opacity:0.3;">
            <div style="height:120px; background:#e2e8f0; border-radius:14px; margin-bottom:12px;"></div>
            <div style="height:80px; background:#e2e8f0; border-radius:14px; margin-bottom:12px;"></div>
            <div style="height:60px; background:#e2e8f0; border-radius:14px;"></div>
          </div>
        </div>
        <!-- Hidden form elements for analyzeQuote() to read from -->
        <div style="position:absolute; left:-9999px; top:-9999px;">
          <input id="cityName" value="${escapeHtml(preview.city || p.city || p.address?.city || "")}">
          <input id="stateCode" value="${escapeHtml(preview.state || p.stateCode || p.address?.stateCode || "")}">
          <input id="streetAddress" value="${escapeHtml(preview.street || p.address?.street || "")}">
          <input id="zipCode" value="${escapeHtml(preview.zip || p.address?.zip || "")}">
          <input id="roofSize" value="${escapeHtml(String(p.roofSize || ""))}">
          <input id="quotePrice" value="${escapeHtml(String(p.finalBestPrice || p.totalLinePrice || p.price || ""))}">
          <select id="materialType"><option value="${escapeHtml(p.material || "architectural")}" selected></option></select>
          <select id="complexityFactor"><option value="1.00" selected></option></select>
          <select id="tearOffIncluded"><option value="1.00" selected></option></select>
          <input id="warrantyYears" value="${escapeHtml(String(p.warrantyYears || ""))}">
          <div id="analysisOutput"></div>
          <div id="aiAnalysisOutput"></div>
          <div id="analysisPanels"></div>
          <div id="parsedSignalSection"></div>
          <div id="inlineAnalyzingState"></div>
          <div id="inlineShareReportOutput"></div>
          <div id="inlineShareCopyStatus"></div>
        </div>
      `;
      setTimeout(() => {
        if (typeof analyzeQuote === "function") {
          analyzeQuote();
        }
      }, 50);
    };
      window.renderResultStep = function renderResultStep() {
        const a = window.__latestAnalysis;
        if (!a) {
          return `<div style="max-width:800px; margin:40px auto; text-align:center; padding:24px;"><p>No analysis yet.</p></div>`;
        }
        try { var c = parseInt(localStorage.getItem('tp_analysis_count') || '0', 10); if (!window.__lastCountedAnalysis || window.__lastCountedAnalysis !== a) { localStorage.setItem('tp_analysis_count', String(c + 1)); window.__lastCountedAnalysis = a; } } catch(e) {}
        try {
          const history = JSON.parse(localStorage.getItem("tp_quote_history") || "[]");
          const entry = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            price: a.quotePrice,
            verdict: a.verdict,
            material: a.material,
            city: a.city || "",
            state: a.stateCode || "",
            contractor: (latestParsed?.contractor || "").substring(0, 50)
          };
          if (!history.some(h => h.price === entry.price && h.verdict === entry.verdict)) {
            history.unshift(entry);
            if (history.length > 20) history.pop(); 
            localStorage.setItem("tp_quote_history", JSON.stringify(history));
          }
        } catch(e) {}
        return `
          <div style="max-width:800px; margin:40px auto; padding:0 24px;">
            ${renderVerdictCard(a)}
            ${renderBeforeYouSign(a)}
            ${renderMarketContext(a)}
            ${renderShareModule(a)}
            <div style="text-align:center; margin-top:20px;">
              <a href="/roofing-quote-analyzer.html" style="font-size:14px; color:var(--muted, #6b7280);">Start a new analysis</a>
            </div>
          </div>
        `;
      };
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
          if (typeof window.renderApp === "function") {
            window.renderApp();
          }
        });
      } else {
        if (typeof window.renderApp === "function") {
          window.renderApp();
        }
      }
      })();