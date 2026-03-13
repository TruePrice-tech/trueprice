function scoreMoneyCandidate(value, contextText) {
  let score = 50;

  const ctx = String(contextText || "").toLowerCase();

  if (/total estimated cost|estimated cost|grand total|proposal total|contract total|total due|project total|total cost/.test(ctx)) {
    score += 100;
  } else if (/total|price|cost|amount|proposal|contract|investment/.test(ctx)) {
    score += 25;
  }

  if (/phone|tel|fax|mobile|call/.test(ctx)) score -= 80;
  if (/zip|address|invoice|account|claim number|policy number/.test(ctx)) score -= 40;
  if (/deductible|deposit|down payment|monthly|finance|payment|allowance|rebate|coupon|discount/.test(ctx)) {
    score -= 70;
  }

  if (value < 500) score -= 60;
  else if (value < 2000) score -= 20;
  if (value > 250000) score -= 80;

  return score;
}

function normalizeOcrNumberString(raw) {
  let value = String(raw || "").trim();

  value = value
    .replace(/[Oo]/g, "0")
    .replace(/[Il|]/g, "1")
    .replace(/[Ss]/g, "5")
    .replace(/[Bb]/g, "8")
    .replace(/[Gg]/g, "9")
    .replace(/[Zz]/g, "2")
    .replace(/A/g, "4");

  value = value.replace(/[^\d.,\s]/g, "");

  const digitsOnly = value.replace(/[^\d]/g, "");
  return digitsOnly;
}

function parsePossiblyBrokenMoney(raw) {
  const repaired = normalizeOcrNumberString(raw);
  if (!repaired) return NaN;

  const num = Number(repaired);
  return isFinite(num) ? num : NaN;
}

function extractPriceCandidates(text) {
  const candidates = [];
  const seen = new Set();
  const source = String(text || "");

  const regex = /\$?\s?[0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{2})?|\$?\s?[0-9]{4,6}(?:\.[0-9]{2})?/g;

  let match;
  while ((match = regex.exec(source)) !== null) {
    const matchText = match[0];
    const value = parseMoneyToNumber(matchText);

    if (!isFinite(value) || value < 500 || value > 250000) continue;

    const start = match.index;
    const end = match.index + matchText.length;

    const contextStart = Math.max(0, start - 140);
    const contextEnd = Math.min(source.length, end + 140);
    const context = source.slice(contextStart, contextEnd);
    const lowerContext = context.toLowerCase();

    let score = scoreMoneyCandidate(value, context);

    const lineStart = source.lastIndexOf("\n", start) + 1;
    const lineEndRaw = source.indexOf("\n", end);
    const lineEnd = lineEndRaw === -1 ? source.length : lineEndRaw;
    const lineText = source.slice(lineStart, lineEnd).trim().toLowerCase();

    if (/total estimated cost|grand total|proposal total|contract total|total due|project total|estimated cost/.test(lineText)) {
      score += 120;
    }

    if (/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(lowerContext)) {
      score -= 120;
    }

    const key = `${Math.round(value)}|${Math.round(score)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    candidates.push({
      value,
      display: matchText.trim(),
      score,
      context: normalizeEvidence(context)
    });
  }

  return candidates
    .sort((a, b) => b.score - a.score || b.value - a.value)
    .slice(0, 10);
}

function detectWarranty(text) {
  const normalized = String(text || "").toLowerCase();
  const candidates = [];
  const patterns = [
    { regex: /\blifetime\b.{0,40}\bwarranty\b/i, years: 50, label: "Lifetime warranty", score: 90 },
    { regex: /\b(5|10|15|20|25|30|40|50)\s*[- ]?\s*year\b.{0,25}\bworkmanship\b/i, years: null, score: 92 },
    { regex: /\b(5|10|15|20|25|30|40|50)\s*[- ]?\s*year\b.{0,25}\bwarranty\b/i, years: null, score: 84 },
    { regex: /\bworkmanship\b.{0,25}\b(5|10|15|20|25|30)\s*[- ]?\s*year\b/i, years: null, score: 90 },
    { regex: /\bmanufacturer warranty\b.{0,25}\b(20|25|30|40|50)\s*[- ]?\s*year\b/i, years: null, score: 84 }
  ];

  patterns.forEach(item => {
    const match = normalized.match(item.regex);
    if (match) {
      const years = item.years || Number(match[1]);
      const label = item.years ? item.label : `${years}-year warranty`;
      candidates.push({ years, label, score: item.score });
    }
  });

  if (!candidates.length) {
    return { label: "Not detected", years: "" };
  }

  candidates.sort((a, b) => b.score - a.score || b.years - a.years);
  return { label: candidates[0].label, years: candidates[0].years };
}

function detectMaterial(text) {
  const normalized = String(text || "").toLowerCase();
  const matches = [];

  MATERIAL_PATTERNS.forEach(item => {
    item.patterns.forEach(pattern => {
      if (pattern.test(normalized)) {
        matches.push({
          value: item.value,
          label: item.label,
          score: item.score
        });
      }
    });
  });

  if (!matches.length) {
    return { value: "", label: "Unknown" };
  }

  matches.sort((a, b) => b.score - a.score);
  return { value: matches[0].value, label: matches[0].label };
}

function detectContractor(text) {
  const source = String(text || "");
  const patterns = [
    /(?:proposal by|prepared by|roofing company|contractor|company)[:\s]+([A-Za-z0-9&.,' -]{4,70})/i,
    /^([A-Z][A-Za-z0-9&.,' -]{3,70}(?:Roofing|Roof|Exteriors|Construction|Contracting|Restoration))/m
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match && match[1]) {
      return normalizeWhitespace(match[1]);
    }
  }

  return "Not detected";
}

function detectRoofSize(text) {
  const normalized = String(text || "").toLowerCase();
  const candidates = [];
  let match;

  const explicitPatterns = [
    {
      regex: /\broof size\b[^0-9]{0,25}([0-9]{3,5})(?:\.[0-9]+)?\s*(?:sq\.?\s*ft|square feet|sq ft|sf)\b/g,
      source: "roof size label",
      score: 120
    },
    {
      regex: /\broof area\b[^0-9]{0,25}([0-9]{3,5})(?:\.[0-9]+)?\s*(?:sq\.?\s*ft|square feet|sq ft|sf)?\b/g,
      source: "roof area label",
      score: 115
    },
    {
      regex: /\btotal roof area\b[^0-9]{0,25}([0-9]{3,5})(?:\.[0-9]+)?\s*(?:sq\.?\s*ft|square feet|sq ft|sf)?\b/g,
      source: "total roof area",
      score: 118
    }
  ];

  explicitPatterns.forEach(({ regex, source, score }) => {
    while ((match = regex.exec(normalized)) !== null) {
      const value = Number(String(match[1]).replace(/,/g, ""));
      if (value >= 600 && value <= 12000) {
        candidates.push({ value, source, score });
      }
    }
  });

  const sqFtRegex = /\b([0-9]{3,5})(?:\.[0-9]+)?\s*(?:sq\.?\s*ft|square feet|square foot|sq ft|sf)\b/g;
  while ((match = sqFtRegex.exec(normalized)) !== null) {
    const value = Number(String(match[1]).replace(/,/g, ""));
    if (value >= 600 && value <= 12000) {
      let score = 88;
      const context = normalized.slice(Math.max(0, match.index - 80), Math.min(normalized.length, match.index + 80));
      if (/roof size|roof area|total roof area|property info/.test(context)) score += 20;
      if (/house|living|garage|lot/.test(context)) score -= 20;
      candidates.push({ value, source: "square feet", score });
    }
  }

  const squaresRegex = /\b([0-9]{1,3}(?:\.[0-9]+)?)\s*(?:squares|square|sq)\b/g;
  while ((match = squaresRegex.exec(normalized)) !== null) {
    const raw = Number(match[1]);
    const value = raw * 100;
    if (value >= 600 && value <= 12000) {
      let score = 82;
      const context = normalized.slice(Math.max(0, match.index - 80), Math.min(normalized.length, match.index + 80));
      if (/roof|roofing|shingles|replace|tear off/.test(context)) score += 15;
      if (/price|cost|total|dollars/.test(context)) score -= 10;
      candidates.push({ value, source: "roofing squares", score });
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

function detectLocation(text) {
  const compact = normalizeWhitespace(text);
  const patterns = [
    /\b([A-Z][a-z]+(?:[ .-][A-Z][a-z]+){0,3}),\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/g,
    /\b(City of\s+)?([A-Z][a-z]+(?:[ .-][A-Z][a-z]+){0,3})\s+(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/g
  ];

  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(compact)) !== null) {
      const city = normalizeWhitespace(match[1] ? match[1].replace(/^City of\s+/i, "") : match[2] || "");
      const stateCode = (match[2] && STATE_CODES.includes(match[2])) ? match[2] : match[3];
      if (!city || !stateCode) continue;

      const lower = city.toLowerCase();
      const banned = ["invoice total", "proposal total", "grand total", "roofing company", "project total"];
      if (banned.some(term => lower.includes(term))) continue;

      return {
        city: titleCase(city),
        stateCode: stateCode.toUpperCase()
      };
    }
  }

  return { city: "", stateCode: "" };
}

function hasNearbyNegation(text, index) {
  const start = Math.max(0, index - 60);
  const end = Math.min(text.length, index + 60);
  const windowText = text.slice(start, end);
  return /\b(not included|excluded|exclude|by owner|owner to provide|reuse existing|at additional cost|extra charge|optional|allowance only|if needed)\b/.test(windowText);
}

function evaluateScopeSignal(text, definition) {
  const lower = String(text || "").toLowerCase();

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
    const match = positivePattern.exec(lower);
    if (match) {
      const idx = match.index || 0;
      if (hasNearbyNegation(lower, idx)) {
        return {
          label: definition.label,
          status: "excluded",
          evidence: normalizeEvidence(match[0])
        };
      }
      return {
        label: definition.label,
        status: "included",
        evidence: normalizeEvidence(match[0])
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
  const results = {};
  Object.entries(SCOPE_DEFINITIONS).forEach(([key, definition]) => {
    results[key] = evaluateScopeSignal(text, definition);
  });

  results.premiumBrand = {
    label: "Premium brand",
    status: /\bgaf\b|\bowens corning\b|\bcertainteed\b|\bmalarkey\b|\biko\b|\btamko\b|\bdecra\b|\bmcelroy\b/i.test(text)
      ? "included"
      : "unclear",
    evidence: (() => {
      const match = String(text || "").match(/\bgaf\b|\bowens corning\b|\bcertainteed\b|\bmalarkey\b|\biko\b|\btamko\b|\bdecra\b|\bmcelroy\b/i);
      return match ? normalizeEvidence(match[0]) : "";
    })()
  };

  return results;
}

function detectPremiumSignals(text, signals, roofSize, material) {
  const lower = String(text || "").toLowerCase();
  const items = [];

  if (/\bsteep\b|\bsteep pitch\b|\bhigh pitch\b|\b12\/12\b|\b10\/12\b|\b8\/12\b/.test(lower)) {
    items.push("Steep pitch mentioned");
  }

  if (/\bmultiple layers\b|\b2 layers\b|\btwo layers\b|\bsecond layer\b/.test(lower)) {
    items.push("Multiple layers detected");
  }

  if (/\bvalley\b|\bmultiple valleys\b|\bdormer\b|\bskylight\b|\bchimney\b|\bcomplex roof\b/.test(lower)) {
    items.push("Complex roof features detected");
  }

  if (signals && signals.decking && signals.decking.status === "included") {
    items.push("Decking work mentioned");
  }

  if (signals && signals.premiumBrand && signals.premiumBrand.status === "included") {
    items.push("Premium brand mentioned");
  }

  if (material === "metal" || material === "tile") {
    items.push("Premium roofing material");
  }

  if (Number(roofSize) >= 3500) {
    items.push("Large roof size");
  }

  return items;
}

function detectTotalLinePrice(text) {
  const lines = String(text || "").split("\n");

  const patterns = [
    /total estimated cost/i,
    /grand total/i,
    /proposal total/i,
    /contract total/i,
    /total due/i,
    /total cost/i,
    /estimated cost/i,
    /project total/i
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    if (!patterns.some(p => p.test(lower))) continue;

    const candidateLines = [
      line,
      lines[i + 1] || "",
      lines[i + 2] || ""
    ];

    for (const candidateLine of candidateLines) {
      const numberLikeMatches = candidateLine.match(/[0-9OBSIGZAl.,\s]{4,20}/gi);
      if (!numberLikeMatches) continue;

      for (const raw of numberLikeMatches) {
        const value = parsePossiblyBrokenMoney(raw);
        if (isFinite(value) && value >= 1000 && value <= 200000) {
          return value;
        }
      }
    }
  }

  return null;
}

function detectTotalLinePrice(text) {
  const lines = String(text || "").split("\n");

  const patterns = [
    /total estimated cost/i,
    /grand total/i,
    /proposal total/i,
    /contract total/i,
    /total due/i,
    /total cost/i,
    /estimated cost/i,
    /project total/i
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    if (!patterns.some(p => p.test(lower))) continue;

    const candidateLines = [
      line,
      lines[i + 1] || "",
      lines[i + 2] || ""
    ];

    for (const candidateLine of candidateLines) {
      const numberMatches = candidateLine.match(/[0-9OBSIGZAl.,\s]{4,20}/gi);
      if (!numberMatches) continue;

      for (const raw of numberMatches) {
        const repaired = raw
          .replace(/[Oo]/g, "0")
          .replace(/[Il|]/g, "1")
          .replace(/[Ss]/g, "5")
          .replace(/[Bb]/g, "8")
          .replace(/[Gg]/g, "9")
          .replace(/[Zz]/g, "2")
          .replace(/A/g, "4")
          .replace(/[^\d]/g, "");

        const value = Number(repaired);

        if (isFinite(value) && value >= 1000 && value <= 200000) {
          return value;
        }
      }
    }
  }

  return null;
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