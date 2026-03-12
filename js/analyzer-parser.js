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

  const moneyRegex = /\$?\s?([0-9]{3,6}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/g;

  let match;

  while ((match = moneyRegex.exec(text)) !== null) {
    const raw = match[0];
    const value = parseMoneyToNumber(raw);

    if (!isFinite(value)) continue;

    const start = Math.max(0, match.index - 40);
    const end = Math.min(text.length, match.index + 40);
    const context = text.slice(start, end);

    const score = scoreMoneyCandidate(value, context);

    candidates.push({
      value,
      raw,
      context,
      score
    });
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
  const candidates = [];

  const sqFtRegex = /\b([0-9]{3,5})\s*(sq\.?\s*ft|square feet|sf)\b/i;

  const match = text.match(sqFtRegex);

  if (match) {
    candidates.push({
      value: Number(match[1]),
      source: "sqft"
    });
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