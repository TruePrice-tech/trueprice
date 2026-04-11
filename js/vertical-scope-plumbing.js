// vertical-scope-plumbing.js
// Regex-based structured field extraction for plumbing quotes.
// Extracts fields that previously required AI: warranty, labor rate,
// brand, pipe type, job type, line items, location, scope items.
// Used by both single-quote and compare paths.

(function () {
  "use strict";

  // ── Scope items specific to plumbing ──
  var PLUMBING_SCOPE = [
    { key: "permit", label: "Permit included", patterns: [/permit/i, /inspection fee/i, /building permit/i, /city permit/i] },
    { key: "warranty_parts", label: "Parts warranty stated", patterns: [/(\d+)\s*(?:yr|year).*(?:warranty|guarantee).*(?:part|tank|equipment|manufacturer)/i, /manufacturer.*warranty/i, /tank warranty/i, /parts warranty/i] },
    { key: "warranty_labor", label: "Labor warranty stated", patterns: [/(\d+)\s*(?:yr|year).*(?:warranty|guarantee).*labor/i, /labor warranty/i, /workmanship warranty/i, /installation warranty/i] },
    { key: "disposal", label: "Old unit disposal", patterns: [/disposal/i, /haul away/i, /remove.*old/i, /dispose/i, /removal.*existing/i, /clean.*disposal/i] },
    { key: "labor_rate", label: "Labor rate disclosed", patterns: [/\$\s*\d+\s*\/\s*h(?:ou)?r/i, /\$\s*\d+\s*per\s*hour/i, /hourly.*\$\s*\d+/i, /\d+\s*hrs?\s*@\s*\$/i, /labor.*\(\d+\s*hrs?/i] },
    { key: "itemized", label: "Parts itemized separately", patterns: [/parts?\s*(?:cost|total|subtotal)/i, /materials?\s*(?:cost|total)/i] },
    { key: "code_compliance", label: "Code compliance mentioned", patterns: [/code req/i, /to code/i, /code complian/i, /building code/i, /up to code/i] },
    { key: "camera_inspection", label: "Camera inspection", patterns: [/camera inspect/i, /video inspect/i, /scope.*line/i, /sewer camera/i] },
    { key: "backflow", label: "Backflow preventer", patterns: [/backflow/i, /back.?flow/i, /anti.?siphon/i] },
    { key: "expansion_tank", label: "Expansion tank", patterns: [/expansion tank/i, /thermal expansion/i] },
    { key: "shutoff_valve", label: "Shut-off valve", patterns: [/shut.?off/i, /shutoff/i, /shut off valve/i, /ball valve/i] },
    { key: "cleanup", label: "Cleanup included", patterns: [/clean.?up/i, /cleanup/i, /site clean/i, /backfill/i, /restoration/i, /sod patch/i] },
  ];

  // ── Known plumbing brands ──
  var PLUMBING_BRANDS = [
    { pattern: /rheem/i, brand: "Rheem", tier: "mid" },
    { pattern: /bradford\s*white/i, brand: "Bradford White", tier: "premium" },
    { pattern: /a\.?\s*o\.?\s*smith/i, brand: "A.O. Smith", tier: "mid" },
    { pattern: /rinnai/i, brand: "Rinnai", tier: "premium" },
    { pattern: /navien/i, brand: "Navien", tier: "premium" },
    { pattern: /noritz/i, brand: "Noritz", tier: "premium" },
    { pattern: /state\s*water/i, brand: "State", tier: "budget" },
    { pattern: /kenmore/i, brand: "Kenmore", tier: "budget" },
    { pattern: /whirlpool/i, brand: "Whirlpool", tier: "budget" },
    { pattern: /takagi/i, brand: "Takagi", tier: "premium" },
    { pattern: /ecosmart/i, brand: "EcoSmart", tier: "mid" },
    { pattern: /bosch/i, brand: "Bosch", tier: "premium" },
    { pattern: /moen/i, brand: "Moen", tier: "mid" },
    { pattern: /kohler/i, brand: "Kohler", tier: "premium" },
    { pattern: /delta/i, brand: "Delta", tier: "mid" },
    { pattern: /american\s*standard/i, brand: "American Standard", tier: "mid" },
    { pattern: /insinkerator/i, brand: "InSinkErator", tier: "mid" },
    { pattern: /carrier/i, brand: "Carrier", tier: "mid" },
    { pattern: /roto.?rooter/i, brand: "Roto-Rooter", tier: "franchise" },
  ];

  // ── Pipe type detection ──
  var PIPE_TYPES = [
    { pattern: /\bpex\b/i, value: "PEX", label: "PEX" },
    { pattern: /\bcopper\b/i, value: "copper", label: "Copper" },
    { pattern: /\bpvc\b/i, value: "PVC", label: "PVC" },
    { pattern: /\bcpvc\b/i, value: "CPVC", label: "CPVC" },
    { pattern: /cast\s*iron/i, value: "cast_iron", label: "Cast Iron" },
    { pattern: /galvanized/i, value: "galvanized", label: "Galvanized" },
    { pattern: /\bcipp\b/i, value: "CIPP", label: "CIPP Liner" },
    { pattern: /\babs\b/i, value: "ABS", label: "ABS" },
  ];

  // ── Job type detection ──
  var JOB_TYPES = [
    { pattern: /water\s*heater.*(?:replac|install|swap)/i, value: "water_heater_tank", label: "Water Heater Replacement" },
    { pattern: /tankless.*(?:water|install|replac)/i, value: "water_heater_tankless", label: "Tankless Water Heater" },
    { pattern: /indirect.*water\s*heater/i, value: "water_heater_tank", label: "Indirect Water Heater" },
    { pattern: /sewer\s*line.*(?:repair|replac)/i, value: "sewer_line", label: "Sewer Line Repair" },
    { pattern: /trenchless/i, value: "sewer_trenchless", label: "Trenchless Sewer Repair" },
    { pattern: /pipe\s*lining|cipp/i, value: "sewer_lining", label: "Pipe Lining" },
    { pattern: /drain\s*clean/i, value: "drain_cleaning", label: "Drain Cleaning" },
    { pattern: /repipe|re-pipe|whole\s*house\s*pipe/i, value: "repipe", label: "Whole House Repipe" },
    { pattern: /toilet.*(?:install|replac)/i, value: "toilet", label: "Toilet Installation" },
    { pattern: /faucet.*(?:install|replac)/i, value: "faucet", label: "Faucet Installation" },
    { pattern: /garbage\s*disposal/i, value: "disposal", label: "Garbage Disposal" },
    { pattern: /sump\s*pump/i, value: "sump_pump", label: "Sump Pump" },
    { pattern: /gas\s*line/i, value: "gas_line", label: "Gas Line" },
    { pattern: /leak\s*repair/i, value: "leak_repair", label: "Leak Repair" },
    { pattern: /water\s*soften/i, value: "water_softener", label: "Water Softener" },
    { pattern: /backflow/i, value: "backflow", label: "Backflow Preventer" },
    { pattern: /clean.?out.*install/i, value: "cleanout", label: "Cleanout Installation" },
  ];

  // ── Extract warranty years ──
  // OCR often splits "6 yr manufacturer warranty" across lines, so we
  // normalize newlines to spaces and search the flattened text.
  function extractWarranty(text) {
    var result = { parts: null, labor: null, text: null };
    // Flatten newlines so cross-line matches work
    var t = String(text || "").replace(/\n/g, " ").replace(/\s+/g, " ");

    // "X yr/year manufacturer/tank/parts/equipment warranty/guarantee"
    var partsMatch = t.match(/(\d+)\s*(?:yr|year)s?\s*(?:manufacturer|tank|parts?|equipment|compressor|heat exchanger)\s*(?:warranty|guarantee)/i) ||
                     t.match(/(?:manufacturer|tank|parts?|equipment)\s*(?:warranty|guarantee)\s*[:=\-]?\s*(\d+)\s*(?:yr|year)/i) ||
                     t.match(/(\d+)\s*(?:yr|year)s?\s*(?:warranty|guarantee)\s*(?:on\s+)?(?:tank|parts?|manufacturer|equipment)/i);
    if (partsMatch) result.parts = parseInt(partsMatch[1]);

    // "X yr/year labor/workmanship/installation warranty/guarantee"
    var laborMatch = t.match(/(\d+)\s*(?:yr|year)s?\s*(?:labor|workmanship|installation)\s*(?:warranty|guarantee)/i) ||
                     t.match(/(?:labor|workmanship|installation)\s*(?:warranty|guarantee)\s*[:=\-]?\s*(\d+)\s*(?:yr|year)/i) ||
                     t.match(/(\d+)\s*(?:yr|year)s?\s*(?:warranty|guarantee)\s*(?:on\s+)?(?:labor|workmanship|installation)/i);
    if (laborMatch) result.labor = parseInt(laborMatch[1] || laborMatch[2]);

    // Compact format: "6 yr tank warranty. 1 yr labor warranty."
    var compactParts = t.match(/(\d+)\s*(?:yr|year)s?\s+(?:tank|manufacturer|parts?)\b/i);
    var compactLabor = t.match(/(\d+)\s*(?:yr|year)s?\s+labor\b/i);
    if (compactParts && !result.parts) result.parts = parseInt(compactParts[1]);
    if (compactLabor && !result.labor) result.labor = parseInt(compactLabor[1]);

    // "X year warranty on CIPP liner" / "X year warranty on pipe"
    var onMatch = t.match(/(\d+)\s*(?:yr|year)s?\s*(?:warranty|guarantee)\s+on\s+\w+/i);
    if (onMatch && !result.parts) result.parts = parseInt(onMatch[1]);

    // Generic "X year warranty" if nothing specific found
    if (!result.parts && !result.labor) {
      var genericMatch = t.match(/(\d+)\s*(?:yr|year)s?\s*(?:warranty|guarantee)/i);
      if (genericMatch) {
        result.parts = parseInt(genericMatch[1]);
        result.text = genericMatch[0];
      }
    }

    // "lifetime warranty"
    if (/lifetime\s*(?:warranty|guarantee)/i.test(t)) {
      if (!result.parts) { result.parts = 99; result.text = "Lifetime warranty"; }
    }

    // "12 month" / "30 day" warranty
    if (!result.labor) {
      var monthMatch = t.match(/(\d+)\s*(?:month|mo)\s*(?:labor|workmanship|installation)?\s*(?:warranty|guarantee)/i);
      if (monthMatch) {
        var months = parseInt(monthMatch[1]);
        result.labor = months >= 12 ? Math.round(months / 12) : 0;
        if (!result.labor) result.text = monthMatch[0];
      }
    }
    if (!result.labor) {
      var dayMatch = t.match(/(\d+)\s*(?:day)\s*(?:labor|workmanship)?\s*(?:warranty|guarantee)/i);
      if (dayMatch) {
        result.labor = 0; // less than 1 year
        result.text = dayMatch[0];
      }
    }

    return result;
  }

  // ── Extract labor rate ──
  function extractLaborRate(text) {
    var t = String(text || "");

    // "$X/hr" or "$X per hour"
    var match = t.match(/\$\s*(\d+(?:\.\d{2})?)\s*\/\s*h(?:ou)?r/i) ||
                t.match(/\$\s*(\d+(?:\.\d{2})?)\s*per\s*hour/i) ||
                t.match(/(\d+(?:\.\d{2})?)\s*\/\s*h(?:ou)?r/i);
    if (match) return parseFloat(match[1]);

    // "X hrs @ $Y"
    var atMatch = t.match(/(\d+(?:\.\d+)?)\s*hrs?\s*@\s*\$?\s*(\d+(?:\.\d{2})?)/i);
    if (atMatch) return parseFloat(atMatch[2]);

    // "labor (X hrs @ $Y/hr)"
    var laborMatch = t.match(/labor.*?(\d+(?:\.\d+)?)\s*hrs?\s*@\s*\$?\s*(\d+)/i);
    if (laborMatch) return parseFloat(laborMatch[2]);

    return null;
  }

  // ── Extract labor hours ──
  function extractLaborHours(text) {
    var t = String(text || "");
    var match = t.match(/(\d+(?:\.\d+)?)\s*hrs?\s*(?:@|\bat\b)/i) ||
                t.match(/labor.*?(\d+(?:\.\d+)?)\s*(?:hrs?|hours?)/i);
    return match ? parseFloat(match[1]) : null;
  }

  // ── Extract brand ──
  function extractBrand(text) {
    var t = String(text || "");
    for (var i = 0; i < PLUMBING_BRANDS.length; i++) {
      if (PLUMBING_BRANDS[i].pattern.test(t)) {
        return { brand: PLUMBING_BRANDS[i].brand, tier: PLUMBING_BRANDS[i].tier };
      }
    }
    return null;
  }

  // ── Extract pipe type ──
  function extractPipeType(text) {
    var t = String(text || "");
    for (var i = 0; i < PIPE_TYPES.length; i++) {
      if (PIPE_TYPES[i].pattern.test(t)) {
        return { value: PIPE_TYPES[i].value, label: PIPE_TYPES[i].label };
      }
    }
    return null;
  }

  // ── Extract job type ──
  function extractJobType(text) {
    var t = String(text || "");
    for (var i = 0; i < JOB_TYPES.length; i++) {
      if (JOB_TYPES[i].pattern.test(t)) {
        return { value: JOB_TYPES[i].value, label: JOB_TYPES[i].label };
      }
    }
    return { value: "other", label: "Plumbing Service" };
  }

  // ── Extract line items (lines with dollar amounts) ──
  function extractLineItems(text) {
    var t = String(text || "");
    var lines = t.split("\n");
    var items = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      var priceMatch = line.match(/\$\s*([\d,]+(?:\.\d{2})?)/);
      if (!priceMatch) continue;
      var amount = parseFloat(priceMatch[1].replace(/,/g, ""));
      if (amount < 1 || amount > 200000) continue;
      // Skip lines that are clearly totals/subtotals
      if (/^\s*(?:total|subtotal|tax|grand total|balance|amount due)/i.test(line)) continue;
      var desc = line.replace(/\$\s*[\d,.]+/, "").replace(/\s+/g, " ").trim();
      if (desc.length < 3) continue;
      items.push({ description: desc, amount: amount });
    }
    return items;
  }

  // ── Detect location ──
  // OCR often mangles punctuation. Try multiple patterns from strict to loose.
  function extractLocation(text) {
    var t = String(text || "").replace(/\n/g, " ");

    // Standard: "City, ST XXXXX"
    var match = t.match(/([A-Z][a-zA-Z\s.]+),\s*([A-Z]{2})\s*(\d{5})?/);
    if (match && match[1].trim().length > 2) {
      return { city: match[1].trim(), stateCode: match[2], zip: match[3] || null };
    }

    // OCR drops comma: "City ST XXXXX"
    var noComma = t.match(/([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)\s+([A-Z]{2})\s+(\d{5})/);
    if (noComma && noComma[1].trim().length > 2) {
      return { city: noComma[1].trim(), stateCode: noComma[2], zip: noComma[3] };
    }

    // Look for known state abbreviations near a capitalized word
    var statePattern = t.match(/([A-Z][a-zA-Z\s.]{2,20})\s*[,.]?\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/);
    if (statePattern && statePattern[1].trim().length > 2) {
      // Filter out false positives like "Plumbing CO" or "Electric OR"
      var city = statePattern[1].trim();
      if (!/plumbing|electric|roofing|heating|service|repair|master|drain|total|subtotal|amount|price|estimate/i.test(city)) {
        return { city: city, stateCode: statePattern[2], zip: null };
      }
    }

    return null;
  }

  // ── Detect scope items ──
  function detectPlumbingScope(text) {
    var t = String(text || "").toLowerCase();
    var results = [];
    for (var i = 0; i < PLUMBING_SCOPE.length; i++) {
      var item = PLUMBING_SCOPE[i];
      var found = item.patterns.some(function (p) { return p.test(t); });
      results.push({ key: item.key, label: item.label, detected: found });
    }
    return results;
  }

  // ── Main extraction: all structured fields from OCR text ──
  function extractPlumbingFields(text) {
    var warranty = extractWarranty(text);
    var laborRate = extractLaborRate(text);
    var laborHours = extractLaborHours(text);
    var brand = extractBrand(text);
    var pipeType = extractPipeType(text);
    var jobType = extractJobType(text);
    var lineItems = extractLineItems(text);
    var location = extractLocation(text);
    var scope = detectPlumbingScope(text);

    return {
      warranty: warranty,
      laborRate: laborRate,
      laborHours: laborHours,
      laborTotal: (laborRate && laborHours) ? laborRate * laborHours : null,
      brand: brand,
      pipeType: pipeType,
      jobType: jobType,
      lineItems: lineItems,
      lineItemCount: lineItems.length,
      location: location,
      scope: scope,
      scopeDetected: scope.filter(function (s) { return s.detected; }).length,
      scopeTotal: scope.length,
    };
  }

  // ── Public API ──
  window.TP_PlumbingScope = {
    extractFields: extractPlumbingFields,
    detectScope: detectPlumbingScope,
    extractWarranty: extractWarranty,
    extractLaborRate: extractLaborRate,
    extractBrand: extractBrand,
    extractPipeType: extractPipeType,
    extractJobType: extractJobType,
    extractLineItems: extractLineItems,
    extractLocation: extractLocation,
  };

})();
