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
    const maxAgeMs = 1000 * 60 * 60 * 24 * 30; // 30 days

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
    // ignore cache failures
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

          // ---------- LIVING AREA FALLBACK ----------
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

        // ---------- PRICE BASED FALLBACK ----------
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

          // ---------- FINAL FALLBACK ----------
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