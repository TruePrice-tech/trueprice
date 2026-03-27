function detectScopeItems(text) {
  const normalized = String(text || "").toLowerCase();

  const scopeCatalog = [
    { key: "tear_off", label: "Tear off existing shingles", costLow: 300, costHigh: 800, patterns: [/tear.?off/, /remove existing/, /replace.?existing/, /strip existing/, /remov(?:e|al).*(?:old|existing|current).*roof/, /replace.*(?:old|existing|current).*roof/, /roof(?:ing)?\s+remov/] },
    { key: "underlayment", label: "Underlayment", costLow: 200, costHigh: 600, patterns: [/underlayment/, /felt paper/, /synthetic underlayment/, /ice.*water.*shield/, /weather\s*lock/, /deck\s*armor/, /deck\s*defense/, /tiger\s*paw/, /roof\s*deck\s*protect/] },
    { key: "drip_edge", label: "Drip edge", costLow: 100, costHigh: 300, patterns: [/drip edge/, /drip\s*edge/, /edge\s*metal/, /eave\s*metal/] },
    { key: "flashing", label: "Flashing replacement", costLow: 200, costHigh: 600, patterns: [/flashing/, /step flash/, /counter flash/, /wall flash/, /chimney flash/, /pipe flash/, /roof flash/, /damaged flash/, /repair.*flash/, /flash.*repair/, /new flash/] },
    { key: "ice_barrier", label: "Ice and water barrier", costLow: 150, costHigh: 500, patterns: [/ice.?water/, /ice barrier/, /ice shield/, /weather\s*lock/, /storm\s*guard/, /leak\s*barrier/] },
    { key: "ridge_vent", label: "Ridge ventilation", costLow: 150, costHigh: 450, patterns: [/ridge vent/, /ridge ventilation/, /ventilation/, /vent(?:s|ing)?\b/, /exhaust vent/, /attic vent/, /roof vent/, /additional ventilation/, /install.*vent/] },
    { key: "starter", label: "Starter shingles", costLow: 75, costHigh: 200, patterns: [/starter shingle/, /starter strip/, /starter course/, /eave starter/] },
    { key: "ridge_cap", label: "Ridge cap shingles", costLow: 100, costHigh: 350, patterns: [/ridge cap/, /hip.*cap/, /cap shingle/] },
    { key: "valley_metal", label: "Valley metal", costLow: 100, costHigh: 400, patterns: [/valley metal/, /metal valley/, /valley/, /open valley/, /woven valley/] },
    { key: "deck_repair", label: "Deck repair allowance", costLow: 200, costHigh: 1000, patterns: [/deck(?:ing)?\s*repair/, /replace plywood/, /replace osb/, /rotten.*(?:wood|deck|board|plywood|sheet)/, /damaged.*(?:wood|deck|board|framework|roof)/, /repair.*(?:wood|deck|framework|plywood|board|roof\s*framework)/, /(?:wood|deck|plywood|osb)\s*repair/, /per\s*sheet/, /roof\s*(?:deck|sheathing)/] },
    { key: "disposal", label: "Debris disposal", costLow: 150, costHigh: 500, patterns: [/dumpster/, /debris remov/, /haul away/, /disposal/, /clean.?up/, /dispose/, /waste remov/, /dump fee/] },
    { key: "permit", label: "Permit included", costLow: 100, costHigh: 400, patterns: [/permit/, /inspection/, /building permit/, /code complian/] }
  ];

  const detected = [];

  for (const item of scopeCatalog) {
    const found = item.patterns.some(pattern => pattern.test(normalized));

    detected.push({
      key: item.key,
      label: item.label,
      detected: found,
      costLow: item.costLow,
      costHigh: item.costHigh
    });
  }

  return detected;
}

function calculateScopeScore(scopeItems) {
  const total = scopeItems.length;
  const detected = scopeItems.filter(i => i.detected).length;
  const missing = scopeItems.filter(i => !i.detected);
  const missingCostLow = missing.reduce((sum, i) => sum + (i.costLow || 0), 0);
  const missingCostHigh = missing.reduce((sum, i) => sum + (i.costHigh || 0), 0);

  return {
    detected,
    total,
    score: Math.round((detected / total) * 100),
    missingCount: missing.length,
    missingCostLow,
    missingCostHigh,
    missingItems: missing
  };
}

window.detectScopeItems = detectScopeItems;
window.calculateScopeScore = calculateScopeScore;
