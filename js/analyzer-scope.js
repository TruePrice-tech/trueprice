function detectScopeItems(text) {
  const normalized = String(text || "").toLowerCase();

  const scopeCatalog = [
    { key: "tear_off", label: "Tear off existing shingles", patterns: [/tear.?off/, /remove existing/, /replace.?existing/, /strip existing/, /remov(?:e|al).*(?:old|existing|current).*roof/, /replace.*(?:old|existing|current).*roof/, /roof(?:ing)?\s+remov/] },
    { key: "underlayment", label: "Underlayment", patterns: [/underlayment/, /felt paper/, /synthetic underlayment/, /ice.*water.*shield/, /weather\s*lock/, /deck\s*armor/, /deck\s*defense/, /tiger\s*paw/, /roof\s*deck\s*protect/] },
    { key: "drip_edge", label: "Drip edge", patterns: [/drip edge/, /drip\s*edge/, /edge\s*metal/, /eave\s*metal/] },
    { key: "flashing", label: "Flashing replacement", patterns: [/flashing/, /step flash/, /counter flash/, /wall flash/, /chimney flash/, /pipe flash/, /roof flash/, /damaged flash/, /repair.*flash/, /flash.*repair/, /new flash/] },
    { key: "ice_barrier", label: "Ice and water barrier", patterns: [/ice.?water/, /ice barrier/, /ice shield/, /weather\s*lock/, /storm\s*guard/, /leak\s*barrier/] },
    { key: "ridge_vent", label: "Ridge ventilation", patterns: [/ridge vent/, /ridge ventilation/, /ventilation/, /vent(?:s|ing)?\b/, /exhaust vent/, /attic vent/, /roof vent/, /additional ventilation/, /install.*vent/] },
    { key: "starter", label: "Starter shingles", patterns: [/starter shingle/, /starter strip/, /starter course/, /eave starter/] },
    { key: "ridge_cap", label: "Ridge cap shingles", patterns: [/ridge cap/, /hip.*cap/, /cap shingle/] },
    { key: "valley_metal", label: "Valley metal", patterns: [/valley metal/, /metal valley/, /valley/, /open valley/, /woven valley/] },
    { key: "deck_repair", label: "Deck repair allowance", patterns: [/deck(?:ing)?\s*repair/, /replace plywood/, /replace osb/, /rotten.*(?:wood|deck|board|plywood|sheet)/, /damaged.*(?:wood|deck|board|framework|roof)/, /repair.*(?:wood|deck|framework|plywood|board|roof\s*framework)/, /(?:wood|deck|plywood|osb)\s*repair/, /per\s*sheet/, /roof\s*(?:deck|sheathing)/] },
    { key: "disposal", label: "Debris disposal", patterns: [/dumpster/, /debris remov/, /haul away/, /disposal/, /clean.?up/, /dispose/, /waste remov/, /dump fee/] },
    { key: "permit", label: "Permit included", patterns: [/permit/, /inspection/, /building permit/, /code complian/] }
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