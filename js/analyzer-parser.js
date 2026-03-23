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
    // Standalone "TOTAL" near a plausible roof price — strong signal
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

  // DocuSign envelope IDs, UUIDs, and hex strings should never be prices
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
    console.log("WARRANTY DEBUG INPUT");
    console.log(text);

    console.log("WARRANTY DEBUG NORMALIZED");
    console.log(normalized);

    console.log("WARRANTY DEBUG LINES");
    console.log(lines);

    console.log("WARRANTY DEBUG CANDIDATES");
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
      console.log("WARRANTY DEBUG RESULT");
      console.log({ label: "Not detected", years: "" });
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
    console.log("WARRANTY DEBUG WINNER");
    console.log(candidates[0]);

    console.log("WARRANTY DEBUG RESULT");
    console.log(winner);
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

  // Check if metal is the actual primary install material
  const metalIsPrimary = /\binstall\b[^.]*\bmetal\b|\bmetal\s+panel|\bstanding\s+seam\b|\bmetal\s+roof\s+install/i.test(normalized);

  // Check if shingle-related terms are present
  const hasShingleSignals = /\bshingles?\b|\barchitectural\b|\b3[- ]tab\b|\basphalt\b|\bcertainteed\w*\b|\bgaf\b|\btimberline\b|\bowens\s*corning\b/i.test(normalized);

  MATERIAL_PATTERNS.forEach(item => {
    item.patterns.forEach(pattern => {
      if (pattern.test(normalized)) {
        let score = item.score;

        if (materialLine && pattern.test(materialLine)) {
          score += 80;
        }

        // Only penalize metal when shingle signals exist AND metal isn't the primary install
        if (item.value === "metal" && hasShingleSignals && !metalIsPrimary) {
          score -= 80;
        }

        // Penalize metal in boilerplate only when metal isn't the primary install
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

  // If both shingle and metal matched, filter out incidental metal
  const hasArchMatch = matches.some(m => m.value === "architectural" || m.value === "asphalt");
  const hasMetalMatch = matches.some(m => m.value === "metal");

  if (hasArchMatch && hasMetalMatch && !metalIsPrimary) {
    // Metal is incidental (drip metal, boilerplate) — remove it
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
    // OCR artifact repairs
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

  console.log("PARSER NORMALIZED TEXT START");
  console.log(normalizedText);
  console.log("PARSER NORMALIZED TEXT END");

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

  // If score difference is large (>30), prefer higher score regardless of source rank
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

  console.log("PARSER DEBUG");
  console.log({
    totalLinePrice,
    priceCandidates,
    materialResult,
    roofSizeResult,
    locationResult,
    warrantyResult,
    priceSanity,
    priceSanityFallbackUsed,
    priceSanityOriginalBestPrice,
    priceSanityOriginalStatus,
    priceSanityFallbackCandidate,
    signals,
    includedSignals,
    missingSignals,
    premiumSignals,
    parsed
  });

  console.log("TOP PRICE CANDIDATES", priceCandidates);
  console.log("FINAL BEST PRICE", finalBestPrice);

  return parsed;
}

console.log("ANALYZER PARSER LOADED");

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

  console.log("PARSER VERSION: v21")
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