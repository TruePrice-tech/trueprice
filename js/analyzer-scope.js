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