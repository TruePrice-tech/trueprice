function scoreMoneyCandidate(value, contextText) {
  let score = 50;

  const ctx = contextText.toLowerCase();

  if (/total|grand total|total cost|project total|estimated cost/.test(ctx)) score += 40;
  if (/price|cost|amount|proposal|contract/.test(ctx)) score += 20;

  if (/phone|tel|fax|mobile|call/.test(ctx)) score -= 60;
  if (/zip|address|invoice|account/.test(ctx)) score -= 30;

  if (value < 2000) score -= 30;
  if (value > 200000) score -= 30;

  return score;
}

function extractPriceCandidates(text) {
  const candidates = [];
  const seen = new Set();
  const regex = /\$?\s?[0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{2})?|\$?\s?[0-9]{4,6}(?:\.[0-9]{2})?/g;

  let match;
  while ((match = regex.exec(text)) !== null) {
    const matchText = match[0];
    const value = parseMoneyToNumber(matchText);
    if (!isFinite(value) || value < 500 || value > 250000) continue;

    const start = match.index;
    const end = match.index + matchText.length;

    const contextStart = Math.max(0, start - 140);
    const contextEnd = Math.min(text.length, end + 140);
    const context = text.slice(contextStart, contextEnd);
    const lowerContext = context.toLowerCase();

    let score = scoreMoneyCandidate(value, context);

    const veryStrongPositive = [
      "total estimated cost",
      "estimated cost",
      "grand total",
      "proposal total",
      "contract total",
      "total due",
      "project total",
      "total cost",
      "amount due",
      "total"
    ];

    const strongNegative = [
      "deductible",
      "deposit",
      "down payment",
      "monthly",
      "finance",
      "payment",
      "claim",
      "allowance",
      "phone",
      "tel",
      "call",
      "fax"
    ];

    veryStrongPositive.forEach(term => {
      if (lowerContext.includes(term)) score += 90;
    });

    strongNegative.forEach(term => {
      if (lowerContext.includes(term)) score -= 70;
    });

    if (/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(lowerContext)) {
      score -= 100;
    }

    const lineStart = text.lastIndexOf("\n", start) + 1;
    const lineEndRaw = text.indexOf("\n", end);
    const lineEnd = lineEndRaw === -1 ? text.length : lineEndRaw;
    const lineText = text.slice(lineStart, lineEnd).trim().toLowerCase();

    if (/total estimated cost|grand total|proposal total|contract total|total due|project total|estimated cost/.test(lineText)) {
      score += 120;
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

  candidates.sort((a, b) => b.score - a.score);

  return candidates;
}

function detectWarranty(text) {
  const regex = /(\d{1,2})\s*(year|yr)/i;
  const match = text.match(regex);

  if (!match) return { years: "", raw: "" };

  return {
    years: Number(match[1]),
    raw: match[0]
  };
}

function detectMaterial(text) {
  const lower = text.toLowerCase();

  for (const material of MATERIAL_PATTERNS) {
    for (const pattern of material.patterns) {
      if (pattern.test(lower)) {
        return {
          value: material.value,
          label: material.label,
          confidence: material.score
        };
      }
    }
  }

  return {
    value: "",
    label: "",
    confidence: 0
  };
}

function detectContractor(text) {
  const lines = text.split("\n");

  for (const line of lines.slice(0, 10)) {
    if (/roof|construction|contracting|roofing|company/i.test(line)) {
      return line.trim();
    }
  }

  return "";
}

function detectRoofSize(text) {
  const normalized = text.toLowerCase();
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

  const squaresRegex = /\b([0-9]{2,3})\s*(squares?)\b/i;
  const sqMatch = text.match(squaresRegex);

  if (sqMatch) {
    candidates.push({
      value: Number(sqMatch[1]) * 100,
      source: "squares"
    });
  }

  if (!candidates.length) return { value: "", source: "" };

  return candidates[0];
}

function detectLocation(text) {
  const lines = text.split("\n");

  for (const line of lines) {
    const parts = line.split(",");

    if (parts.length >= 2) {
      const city = parts[0].trim();
      const statePart = parts[1].trim().split(" ")[0];

      if (STATE_CODES.includes(statePart.toUpperCase())) {
        return {
          city: titleCase(city),
          stateCode: statePart.toUpperCase()
        };
      }
    }
  }

  return { city: "", stateCode: "" };
}

function hasNearbyNegation(text, index) {
  const start = Math.max(0, index - 40);
  const context = text.slice(start, index).toLowerCase();

  return /not|exclude|without|owner/.test(context);
}

function evaluateScopeSignal(text, definition) {
  const lower = text.toLowerCase();

  for (const neg of definition.negative) {
    if (neg.test(lower)) {
      return {
        status: "excluded",
        evidence: neg.source
      };
    }
  }

  for (const pos of definition.positive) {
    if (pos.test(lower)) {
      return {
        status: "included",
        evidence: pos.source
      };
    }
  }

  return { status: "unclear" };
}

function detectScopeSignals(text) {
  const results = {};

  for (const key in SCOPE_DEFINITIONS) {
    const def = SCOPE_DEFINITIONS[key];

    const res = evaluateScopeSignal(text, def);

    results[key] = {
      label: def.label,
      status: res.status,
      evidence: normalizeEvidence(res.evidence || "")
    };
  }

  return results;
}

function detectPremiumSignals(text) {
  const signals = [];

  if (/steep|12\/12|10\/12|high pitch/i.test(text)) signals.push("steep pitch");
  if (/complex|multiple valley/i.test(text)) signals.push("complex roof");
  if (/skylight/i.test(text)) signals.push("skylight");
  if (/chimney/i.test(text)) signals.push("chimney flashing");

  return signals;
}

function calculateParserConfidence(parsed) {
  let score = 0;

  if (parsed.price) score += 30;
  if (parsed.roofSize) score += 20;
  if (parsed.material) score += 15;
  if (parsed.city) score += 10;

  const includedSignals = Object.values(parsed.signals || {}).filter(s => s.status === "included").length;

  score += Math.min(includedSignals * 3, 15);

  return Math.min(score, 100);
}