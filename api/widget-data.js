const fs = require('fs');
const path = require('path');

// Inflation and seasonal adjustments
let _adjustments = null;
function getAdjustments() {
  if (!_adjustments) {
    try { _adjustments = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'pricing-adjustments.json'), 'utf-8')); }
    catch(e) { _adjustments = { inflationBaseline: { year: 2025, annualRate: 0.03 }, seasonalMultipliers: {} }; }
  }
  return _adjustments;
}

function getInflationMultiplier() {
  const adj = getAdjustments();
  const now = new Date();
  const yearsElapsed = now.getFullYear() - adj.inflationBaseline.year + (now.getMonth() / 12);
  return Math.pow(1 + adj.inflationBaseline.annualRate, Math.max(0, yearsElapsed));
}

function getSeasonalMultiplier(service) {
  const adj = getAdjustments();
  const month = String(new Date().getMonth() + 1);
  const serviceSeasonal = adj.seasonalMultipliers[service];
  if (!serviceSeasonal) return 1.0;
  return serviceSeasonal[month] || 1.0;
}

const SERVICE_CONFIG = {
  roofing:       { file: 'pricing-model.json', label: 'Roof Replacement', urlSlug: 'roof', refSize: '2,000 sq ft home', category: 'home' },
  hvac:          { file: 'hvac-pricing-model.json', label: 'HVAC Replacement', urlSlug: 'hvac', refSize: '2,000 sq ft home', category: 'home' },
  plumbing:      { file: 'plumbing-pricing-model.json', label: 'Plumbing', urlSlug: 'plumbing', refSize: 'typical project', category: 'home' },
  electrical:    { file: 'electrical-pricing-model.json', label: 'Electrical', urlSlug: 'electrical', refSize: 'typical project', category: 'home' },
  windows:       { file: 'window-pricing-model.json', label: 'Window Replacement', urlSlug: 'window', refSize: '10 windows', category: 'home' },
  siding:        { file: 'siding-pricing-model.json', label: 'Siding Installation', urlSlug: 'siding', refSize: '2,000 sq ft', category: 'home' },
  painting:      { file: 'painting-pricing-model.json', label: 'House Painting', urlSlug: 'painting', refSize: '2,000 sq ft exterior', category: 'home' },
  solar:         { file: 'solar-pricing-model.json', label: 'Solar Installation', urlSlug: 'solar', refSize: '10 kW system', category: 'home' },
  'garage-doors':{ file: 'garage-door-pricing-model.json', label: 'Garage Door', urlSlug: 'garage-door', refSize: 'per unit', category: 'home' },
  fencing:       { file: 'fencing-pricing-model.json', label: 'Fence Installation', urlSlug: 'fence', refSize: '200 linear feet', category: 'home' },
  concrete:      { file: 'concrete-pricing-model.json', label: 'Concrete Work', urlSlug: 'concrete', refSize: '600 sq ft', category: 'home' },
  landscaping:   { file: 'landscaping-pricing-model.json', label: 'Landscaping', urlSlug: 'landscaping', refSize: 'typical project', category: 'home' },
  foundation:    { file: 'foundation-pricing-model.json', label: 'Foundation Repair', urlSlug: 'foundation', refSize: 'moderate repair', category: 'home' },
  kitchen:       { file: 'kitchen-pricing-model.json', label: 'Kitchen Remodel', urlSlug: 'kitchen-remodel', refSize: 'average kitchen', category: 'home' },
  insulation:    { file: 'insulation-pricing-model.json', label: 'Insulation', urlSlug: 'insulation', refSize: '1,500 sq ft', category: 'home' },
  gutters:       { file: 'gutters-pricing-model.json', label: 'Gutter Installation', urlSlug: 'gutter', refSize: '150 linear feet', category: 'home' },
  'auto-repair': { file: 'auto-repair-common-jobs.json', label: 'Auto Repair', urlSlug: null, refSize: null, category: 'auto' },
  medical:       { file: 'medical-common-procedures.json', label: 'Medical Costs', urlSlug: null, refSize: null, category: 'medical' },
  legal:         { file: 'legal-fee-pricing.json', label: 'Legal Fees', urlSlug: null, refSize: null, category: 'legal' },
};

function roundPrice(value, roundTo) {
  if (!roundTo) roundTo = value >= 1000 ? 100 : 50;
  return Math.round(value / roundTo) * roundTo;
}

function smartRound(value) {
  if (value >= 1000) return Math.round(value / 100) * 100;
  return Math.round(value / 50) * 50;
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function loadJson(filename) {
  const filePath = path.join(process.cwd(), 'data', filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

let _cityMultipliers = null;
function getCityMultipliers() {
  if (!_cityMultipliers) {
    try { _cityMultipliers = loadJson('city-cost-multipliers.json'); } catch (e) { _cityMultipliers = {}; }
  }
  return _cityMultipliers;
}

function getRegion(state) {
  const regions = loadJson('state-regions.json');
  return regions[state.toUpperCase()] || 'south';
}

function computeRoofing(model, mult) {
  const roofSquares = 24;
  const waste = model.wasteFactor || 1.1;
  const overhead = model.overheadMultiplier || 1.12;
  const types = model.basePricePerSquare;
  const materials = Object.entries(types).map(([key, base]) => {
    const total = base * roofSquares * waste * mult * overhead;
    return { label: key.charAt(0).toUpperCase() + key.slice(1), low: smartRound(total * 0.95), high: smartRound(total * 1.05) };
  });
  const allPrices = Object.values(types).map(b => b * roofSquares * waste * mult * overhead);
  return {
    materials,
    overallLow: smartRound(Math.min(...allPrices)),
    overallHigh: smartRound(Math.max(...allPrices)),
  };
}

function computeHvac(model, mult) {
  const tons = 2.5;
  const overhead = model.overheadMultiplier || 1.15;
  const systems = model.basePriceBySystem;
  const show = [
    { key: 'central_ac', seer: '16_seer' },
    { key: 'heat_pump', seer: '16_seer' },
    { key: 'full_system', seer: '16_seer_90_afue' },
  ];
  const materials = show.map(({ key, seer }) => {
    const sys = systems[key];
    const price = sys.pricePerTon[seer];
    const total = price * tons * mult * overhead;
    return { label: sys.label, low: smartRound(total * 0.9), high: smartRound(total * 1.1) };
  });
  const allTotals = materials.map(m => [m.low, m.high]).flat();
  return {
    materials,
    overallLow: Math.min(...allTotals),
    overallHigh: Math.max(...allTotals),
  };
}

function computePlumbing(model, mult) {
  const overhead = model.overheadMultiplier || 1.15;
  const services = model.basePriceByService;
  const top4 = ['water_heater', 'repipe', 'sewer_line', 'drain_cleaning'];
  const materials = top4.map(key => {
    const svc = services[key];
    const priceObj = svc.priceByType || svc.priceByMaterial || svc.priceByMethod;
    const prices = Object.values(priceObj);
    const sorted = [...prices].sort((a, b) => a - b);
    const low = sorted[0] * mult * overhead;
    const high = sorted[sorted.length - 1] * mult * overhead;
    return { label: svc.label, low: smartRound(low), high: smartRound(high) };
  });
  const allLows = materials.map(m => m.low);
  const allHighs = materials.map(m => m.high);
  return {
    materials,
    overallLow: Math.min(...allLows),
    overallHigh: Math.max(...allHighs),
  };
}

function computeElectrical(model, mult) {
  const overhead = model.overheadMultiplier || 1.15;
  const services = model.basePriceByService;
  const top4 = ['panel_upgrade', 'whole_house_rewire', 'ev_charger', 'generator'];
  const materials = top4.map(key => {
    const svc = services[key];
    const low = svc.low * mult * overhead;
    const high = svc.high * mult * overhead;
    return { label: svc.label, low: smartRound(low), high: smartRound(high) };
  });
  const allLows = materials.map(m => m.low);
  const allHighs = materials.map(m => m.high);
  return {
    materials,
    overallLow: Math.min(...allLows),
    overallHigh: Math.max(...allHighs),
  };
}

function computeWindows(model, mult) {
  const count = 10;
  const overhead = model.overheadMultiplier || 1.15;
  const types = model.basePriceByType;
  const windowTypes = ['vinyl', 'wood', 'fiberglass'];
  const materials = windowTypes.map(key => {
    const t = types[key];
    const low = t.lowPerUnit * count * mult * overhead;
    const high = t.highPerUnit * count * mult * overhead;
    return { label: t.label, low: smartRound(low), high: smartRound(high) };
  });
  const allLows = materials.map(m => m.low);
  const allHighs = materials.map(m => m.high);
  return {
    materials,
    overallLow: Math.min(...allLows),
    overallHigh: Math.max(...allHighs),
  };
}

function computeSiding(model, mult) {
  const sqft = 2000;
  const overhead = model.overheadMultiplier || 1.15;
  const types = model.basePriceByType;
  const materials = Object.entries(types).map(([key, t]) => {
    const low = t.lowPerSqft * sqft * mult * overhead;
    const high = t.highPerSqft * sqft * mult * overhead;
    return { label: t.label, low: smartRound(low), high: smartRound(high) };
  });
  const allLows = materials.map(m => m.low);
  const allHighs = materials.map(m => m.high);
  return {
    materials,
    overallLow: Math.min(...allLows),
    overallHigh: Math.max(...allHighs),
  };
}

function computePainting(model, mult) {
  const sqft = 2000;
  const overhead = model.overheadMultiplier || 1.15;
  const types = model.basePricePerSqft;
  const materials = Object.entries(types).map(([key, t]) => {
    if (t.flatLow !== undefined) {
      const low = t.flatLow * mult * overhead;
      const high = t.flatHigh * mult * overhead;
      return { label: t.label, low: smartRound(low), high: smartRound(high) };
    }
    const low = t.low * sqft * mult * overhead;
    const high = t.high * sqft * mult * overhead;
    return { label: t.label, low: smartRound(low), high: smartRound(high) };
  });
  const allLows = materials.map(m => m.low);
  const allHighs = materials.map(m => m.high);
  return {
    materials,
    overallLow: Math.min(...allLows),
    overallHigh: Math.max(...allHighs),
  };
}

function computeSolar(model, mult) {
  const watts = 10000;
  const overhead = model.overheadMultiplier || 1.15;
  const types = model.pricePerWatt;
  const materials = Object.entries(types).map(([key, t]) => {
    const low = t.low * watts * mult * overhead;
    const high = t.high * watts * mult * overhead;
    return { label: t.label, low: smartRound(low), high: smartRound(high) };
  });
  const allLows = materials.map(m => m.low);
  const allHighs = materials.map(m => m.high);
  return {
    materials,
    overallLow: Math.min(...allLows),
    overallHigh: Math.max(...allHighs),
  };
}

function computeGarageDoors(model, mult) {
  const overhead = model.overheadMultiplier || 1.15;
  const types = model.basePriceByType;
  const top3 = ['single_car', 'double_car', 'custom_carriage'];
  const materials = top3.map(key => {
    const t = types[key];
    const total = t.basePrice * mult * overhead;
    return { label: t.label, low: smartRound(total * 0.9), high: smartRound(total * 1.1) };
  });
  const allLows = materials.map(m => m.low);
  const allHighs = materials.map(m => m.high);
  return {
    materials,
    overallLow: Math.min(...allLows),
    overallHigh: Math.max(...allHighs),
  };
}

function computeFencing(model, mult) {
  const lf = 200;
  const overhead = model.overheadMultiplier || 1.15;
  const types = model.basePricePerLinearFoot;
  const materials = Object.entries(types).map(([key, t]) => {
    const low = t.low * lf * mult * overhead;
    const high = t.high * lf * mult * overhead;
    return { label: t.label, low: smartRound(low), high: smartRound(high) };
  });
  const allLows = materials.map(m => m.low);
  const allHighs = materials.map(m => m.high);
  return {
    materials,
    overallLow: Math.min(...allLows),
    overallHigh: Math.max(...allHighs),
  };
}

function computeConcrete(model, mult) {
  const sqft = 600;
  const overhead = model.overheadMultiplier || 1.15;
  const types = model.basePricePerSqft;
  const materials = Object.entries(types).map(([key, t]) => {
    const low = t.low * sqft * mult * overhead;
    const high = t.high * sqft * mult * overhead;
    return { label: t.label, low: smartRound(low), high: smartRound(high) };
  });
  const allLows = materials.map(m => m.low);
  const allHighs = materials.map(m => m.high);
  return {
    materials,
    overallLow: Math.min(...allLows),
    overallHigh: Math.max(...allHighs),
  };
}

function computeLandscaping(model, mult) {
  const overhead = model.overheadMultiplier || 1.15;
  const types = model.basePricing;
  const typicalSizes = {
    paver_patio: 300,
    retaining_wall: 200,
    sod_installation: 2000,
    landscape_design_install: 1,
  };
  const show = ['paver_patio', 'retaining_wall', 'sod_installation', 'landscape_design_install'];
  const materials = show.map(key => {
    const t = types[key];
    const qty = typicalSizes[key];
    const low = t.low * qty * mult * overhead;
    const high = t.high * qty * mult * overhead;
    return { label: t.label, low: smartRound(low), high: smartRound(high) };
  });
  const allLows = materials.map(m => m.low);
  const allHighs = materials.map(m => m.high);
  return {
    materials,
    overallLow: Math.min(...allLows),
    overallHigh: Math.max(...allHighs),
  };
}

function computeFoundation(model, mult) {
  const overhead = model.overheadMultiplier || 1.15;
  const types = model.basePriceByType;
  const moderate = 1.0; // projectSizes moderate multiplier
  const materials = Object.entries(types).map(([key, t]) => {
    const total = t.basePrice * moderate * mult * overhead;
    return { label: t.label, low: smartRound(total * 0.9), high: smartRound(total * 1.1) };
  });
  const allLows = materials.map(m => m.low);
  const allHighs = materials.map(m => m.high);
  return {
    materials,
    overallLow: Math.min(...allLows),
    overallHigh: Math.max(...allHighs),
  };
}

function computeKitchen(model, mult) {
  const overhead = model.overheadMultiplier || 1.15;
  const tiers = model.basePriceByTier;
  const materials = Object.entries(tiers).map(([key, t]) => {
    const low = t.low * mult * overhead;
    const high = t.high * mult * overhead;
    return { label: t.label, low: smartRound(low), high: smartRound(high) };
  });
  const allLows = materials.map(m => m.low);
  const allHighs = materials.map(m => m.high);
  return {
    materials,
    overallLow: Math.min(...allLows),
    overallHigh: Math.max(...allHighs),
  };
}

function computeInsulation(model, mult) {
  const sqft = 1500;
  const overhead = model.overheadMultiplier || 1.15;
  const types = model.basePriceByType;
  const materials = Object.entries(types).map(([key, t]) => {
    const low = t.lowPerSqft * sqft * mult * overhead;
    const high = t.highPerSqft * sqft * mult * overhead;
    return { label: t.label, low: smartRound(low), high: smartRound(high) };
  });
  const allLows = materials.map(m => m.low);
  const allHighs = materials.map(m => m.high);
  return {
    materials,
    overallLow: Math.min(...allLows),
    overallHigh: Math.max(...allHighs),
  };
}

function computeGutters(model, mult) {
  const lf = 150;
  const overhead = model.overheadMultiplier || 1.0;
  const types = model.basePricePerLinearFoot;
  const show = ['aluminum_seamless', 'vinyl', 'steel', 'copper'];
  const materials = show.filter(k => types[k]).map(key => {
    const t = types[key];
    const low = t.low * lf * mult * overhead;
    const high = t.high * lf * mult * overhead;
    return { label: t.label, low: smartRound(low), high: smartRound(high) };
  });
  const allLows = materials.map(m => m.low);
  const allHighs = materials.map(m => m.high);
  return {
    materials,
    overallLow: Math.min(...allLows),
    overallHigh: Math.max(...allHighs),
  };
}

function computeAutoRepair(data, mult) {
  const repairs = data.commonRepairs;
  const show = ['brakes_front', 'oil_change_synthetic', 'timing_belt', 'alternator', 'ac_compressor', 'transmission_rebuild'];
  const materials = show.filter(k => repairs[k]).map(key => {
    const r = repairs[key];
    return { label: r.label, low: smartRound(r.totalRange.low * mult), high: smartRound(r.totalRange.high * mult) };
  });
  const allLows = materials.map(m => m.low);
  const allHighs = materials.map(m => m.high);
  return { materials, overallLow: Math.min(...allLows), overallHigh: Math.max(...allHighs) };
}

function computeMedical(data) {
  const procs = data.commonProcedures;
  const show = ['er_visit_moderate', 'mri_brain', 'blood_work_basic', 'knee_replacement', 'colonoscopy_diagnostic', 'therapy_session'];
  const materials = show.filter(k => procs[k]).map(key => {
    const p = procs[key];
    return { label: p.label, low: p.totalCostRange.low, high: p.totalCostRange.high };
  });
  const allLows = materials.map(m => m.low);
  const allHighs = materials.map(m => m.high);
  return { materials, overallLow: Math.min(...allLows), overallHigh: Math.max(...allHighs) };
}

function computeLegal(data, mult) {
  const areas = data.hourlyRatesByPracticeArea;
  // Show a mix: some with flat fees (most useful for readers), some hourly
  const show = [
    { key: 'estate_planning', fee: 'simple_will', feeLabel: 'Simple Will' },
    { key: 'criminal_defense', fee: 'dui_first', feeLabel: 'DUI Defense' },
    { key: 'family_law', fee: null },
    { key: 'bankruptcy', fee: 'chapter_7', feeLabel: 'Chapter 7 Bankruptcy' },
    { key: 'immigration', fee: 'naturalization', feeLabel: 'Naturalization' },
    { key: 'business_law', fee: 'llc_formation', feeLabel: 'LLC Formation' },
  ];
  const materials = show.filter(s => areas[s.key]).map(s => {
    const a = areas[s.key];
    if (s.fee && a.flatFees && a.flatFees[s.fee]) {
      const f = a.flatFees[s.fee];
      return { label: s.feeLabel, low: smartRound(f[0] * mult), high: smartRound(f[1] * mult) };
    }
    if (a.rates && a.rates.low > 0) {
      return { label: a.label, low: smartRound(a.rates.low * mult), high: smartRound(a.rates.high * mult), hourly: true };
    }
    return null;
  }).filter(Boolean);
  const allRates = Object.values(areas).map(a => a.rates).filter(r => r && r.low > 0);
  return {
    materials,
    overallLow: Math.min(...allRates.map(r => smartRound(r.low * mult))),
    overallHigh: Math.max(...allRates.map(r => smartRound(r.high * mult))),
    isHourly: true
  };
}

const COMPUTE_MAP = {
  roofing: computeRoofing,
  hvac: computeHvac,
  plumbing: computePlumbing,
  electrical: computeElectrical,
  windows: computeWindows,
  siding: computeSiding,
  painting: computePainting,
  solar: computeSolar,
  'garage-doors': computeGarageDoors,
  fencing: computeFencing,
  concrete: computeConcrete,
  landscaping: computeLandscaping,
  foundation: computeFoundation,
  kitchen: computeKitchen,
  insulation: computeInsulation,
  gutters: computeGutters,
  'auto-repair': computeAutoRepair,
  medical: computeMedical,
  legal: computeLegal,
};

module.exports = async (req, res) => {
  // Wildcard CORS required: this endpoint serves embeddable pricing widgets on third-party sites
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=86400');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { city, state, service } = req.query;

  if (!city || !state || !service) {
    return res.status(400).json({ error: 'Missing required query params: city, state, service' });
  }

  const stateUpper = state.toUpperCase();
  if (!/^[A-Z]{2}$/.test(stateUpper)) {
    return res.status(400).json({ error: 'State must be a 2-letter code' });
  }

  const config = SERVICE_CONFIG[service];
  if (!config) {
    return res.status(400).json({ error: 'Invalid service. Valid: ' + Object.keys(SERVICE_CONFIG).join(', ') });
  }

  try {
    const model = loadJson(config.file);
    const computeFn = COMPUTE_MAP[service];
    const category = config.category;

    // Non-home verticals: simpler multiplier logic
    let laborMult = 1.0;
    if (category === 'home' || category === 'auto') {
      const region = getRegion(stateUpper);
      if (category === 'auto') {
        laborMult = (model.laborMultiplierByRegion || {})[region] || 1.0;
      } else {
        const cityKey = city + "|" + stateUpper;
        const cityMultipliers = getCityMultipliers();
        const cityMult = cityMultipliers[cityKey] ? cityMultipliers[cityKey].multiplier : null;
        laborMult = cityMult || ((model.laborMultiplierByRegion || {})[region] || 1.0);
      }
    } else if (category === 'legal') {
      const region = getRegion(stateUpper);
      laborMult = (model.regionalMultipliers || {})[region] || 1.0;
    }
    // medical: no regional multiplier (prices vary by facility, not region)

    const result = computeFn(model, laborMult);

    // Apply inflation and seasonal adjustments (home services only)
    let totalMult = 1.0;
    let calData = null;
    if (category === 'home') {
      const inflationMult = getInflationMultiplier();
      const seasonalMult = getSeasonalMultiplier(service);
      totalMult = inflationMult * seasonalMult;

      // Check for calibration data from real quotes
      try {
        const { Redis } = await import("@upstash/redis");
        const redis = Redis.fromEnv();
        const calKey = `cal:${city.toLowerCase()}:${stateUpper}:${service}`;
        calData = await redis.get(calKey);
        if (calData && calData.quotes >= 1 && calData.avgPrice > 0 && result.overallLow > 0) {
          const modelMid = (result.overallLow + result.overallHigh) / 2;
          const realAvg = calData.avgPrice;
          const calWeight = Math.min(calData.quotes / 5, 1.0) * 0.3;
          let calibrationFactor = 1.0 + (realAvg / modelMid - 1.0) * calWeight;
          calibrationFactor = Math.max(0.7, Math.min(1.3, calibrationFactor));
          totalMult *= calibrationFactor;
        }
      } catch(e) { /* calibration unavailable */ }
    }

    // Determine confidence level
    const cityKey = city + "|" + stateUpper;
    const confidenceLabels = {
      verified: 'Based on verified local quotes',
      calibrated: 'Adjusted with local quote data',
      modeled: 'Based on local cost data',
      estimated: 'Based on regional averages',
    };
    let confidence;
    if (calData && calData.quotes >= 5) {
      confidence = 'verified';
    } else if (calData && calData.quotes >= 1) {
      confidence = 'calibrated';
    } else if (getCityMultipliers()[cityKey]) {
      confidence = 'modeled';
    } else {
      confidence = 'estimated';
    }

    const adjustedMaterials = result.materials.map(m => {
      const item = {
        label: m.label,
        low: typeof m.low === 'number' ? smartRound(m.low * totalMult) : m.low,
        high: typeof m.high === 'string' ? m.high : smartRound(m.high * totalMult),
      };
      if (m.hourly) item.hourly = true;
      return item;
    });
    const adjustedLow = smartRound(result.overallLow * totalMult);
    const adjustedHigh = smartRound(result.overallHigh * totalMult);

    // Build appropriate URLs per category
    let cityPageUrl, analyzerUrl;
    if (category === 'home') {
      cityPageUrl = `https://truepricehq.com/${slugify(city)}-${stateUpper.toLowerCase()}-${config.urlSlug}-cost.html`;
      analyzerUrl = 'https://truepricehq.com/analyze-quote.html';
    } else if (category === 'auto') {
      cityPageUrl = 'https://truepricehq.com/auto-repair-cost-guide.html';
      analyzerUrl = 'https://truepricehq.com/auto-repair-quote-analyzer.html';
    } else if (category === 'medical') {
      cityPageUrl = 'https://truepricehq.com/medical-cost-guide.html';
      analyzerUrl = 'https://truepricehq.com/medical-bill-analyzer.html';
    } else if (category === 'legal') {
      cityPageUrl = 'https://truepricehq.com/legal-cost-guide.html';
      analyzerUrl = 'https://truepricehq.com/legal-fee-analyzer.html';
    }

    return res.status(200).json({
      city,
      state: stateUpper,
      service,
      serviceLabel: config.label,
      category,
      materials: adjustedMaterials,
      overallLow: adjustedLow,
      overallHigh: adjustedHigh,
      referenceSize: config.refSize,
      isHourly: result.isHourly || false,
      confidence,
      confidenceLabel: confidenceLabels[confidence],
      cityPageUrl,
      analyzerUrl,
      updated: new Date().toISOString().split('T')[0],
    });
  } catch (err) {
    console.error('widget-data error:', err);
    return res.status(500).json({ error: 'Failed to compute pricing data' });
  }
};
