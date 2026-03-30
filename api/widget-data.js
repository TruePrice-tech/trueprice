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
  roofing:       { file: 'pricing-model.json', label: 'Roof Replacement', urlSlug: 'roof', refSize: '2,000 sq ft home' },
  hvac:          { file: 'hvac-pricing-model.json', label: 'HVAC Replacement', urlSlug: 'hvac', refSize: '2,000 sq ft home' },
  plumbing:      { file: 'plumbing-pricing-model.json', label: 'Plumbing', urlSlug: 'plumbing', refSize: 'typical project' },
  electrical:    { file: 'electrical-pricing-model.json', label: 'Electrical', urlSlug: 'electrical', refSize: 'typical project' },
  windows:       { file: 'window-pricing-model.json', label: 'Window Replacement', urlSlug: 'window', refSize: '10 windows' },
  siding:        { file: 'siding-pricing-model.json', label: 'Siding Installation', urlSlug: 'siding', refSize: '2,000 sq ft' },
  painting:      { file: 'painting-pricing-model.json', label: 'House Painting', urlSlug: 'painting', refSize: '2,000 sq ft exterior' },
  solar:         { file: 'solar-pricing-model.json', label: 'Solar Installation', urlSlug: 'solar', refSize: '10 kW system' },
  'garage-doors':{ file: 'garage-door-pricing-model.json', label: 'Garage Door', urlSlug: 'garage-door', refSize: 'per unit' },
  fencing:       { file: 'fencing-pricing-model.json', label: 'Fence Installation', urlSlug: 'fence', refSize: '200 linear feet' },
  concrete:      { file: 'concrete-pricing-model.json', label: 'Concrete Work', urlSlug: 'concrete', refSize: '600 sq ft' },
  landscaping:   { file: 'landscaping-pricing-model.json', label: 'Landscaping', urlSlug: 'landscaping', refSize: 'typical project' },
  foundation:    { file: 'foundation-pricing-model.json', label: 'Foundation Repair', urlSlug: 'foundation', refSize: 'moderate repair' },
  kitchen:       { file: 'kitchen-pricing-model.json', label: 'Kitchen Remodel', urlSlug: 'kitchen-remodel', refSize: 'average kitchen' },
  insulation:    { file: 'insulation-pricing-model.json', label: 'Insulation', urlSlug: 'insulation', refSize: '1,500 sq ft' },
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
};

module.exports = async (req, res) => {
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
    const region = getRegion(stateUpper);
    const model = loadJson(config.file);
    const cityKey = city + "|" + stateUpper;
    const cityMultipliers = getCityMultipliers();
    const cityMult = cityMultipliers[cityKey] ? cityMultipliers[cityKey].multiplier : null;
    const laborMult = cityMult || ((model.laborMultiplierByRegion || {})[region] || 1.0);
    const computeFn = COMPUTE_MAP[service];
    const result = computeFn(model, laborMult);

    // Apply inflation and seasonal adjustments
    const inflationMult = getInflationMultiplier();
    const seasonalMult = getSeasonalMultiplier(service);
    const timeMult = inflationMult * seasonalMult;

    const adjustedMaterials = result.materials.map(m => ({
      label: m.label,
      low: smartRound(m.low * timeMult),
      high: smartRound(m.high * timeMult),
    }));
    const adjustedLow = smartRound(result.overallLow * timeMult);
    const adjustedHigh = smartRound(result.overallHigh * timeMult);

    const cityPageUrl = `https://truepricehq.com/${slugify(city)}-${stateUpper.toLowerCase()}-${config.urlSlug}-cost.html`;

    return res.status(200).json({
      city,
      state: stateUpper,
      service,
      serviceLabel: config.label,
      materials: adjustedMaterials,
      overallLow: adjustedLow,
      overallHigh: adjustedHigh,
      referenceSize: config.refSize,
      cityPageUrl,
      updated: new Date().toISOString().split('T')[0],
    });
  } catch (err) {
    console.error('widget-data error:', err);
    return res.status(500).json({ error: 'Failed to compute pricing data' });
  }
};
