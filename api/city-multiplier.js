const fs = require('fs');
const path = require('path');

let _multipliers = null;
function getMultipliers() {
  if (!_multipliers) {
    try {
      _multipliers = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'city-cost-multipliers.json'), 'utf-8'));
    } catch(e) {
      _multipliers = {};
    }
  }
  return _multipliers;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=86400');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { city, state } = req.query;
  if (!city || !state) {
    return res.status(400).json({ error: 'Missing city or state' });
  }

  const stateUpper = state.toUpperCase();
  const key = city + '|' + stateUpper;
  const multipliers = getMultipliers();
  const entry = multipliers[key];

  if (entry) {
    return res.status(200).json({ multiplier: entry.multiplier, rangeLow: entry.rangeLow || 0.85, rangeHigh: entry.rangeHigh || 1.18, source: entry.source });
  }

  // City not in list - find best match from same state
  // Apply small-city discount for unlisted cities (likely smaller markets)
  const stateCities = Object.entries(multipliers).filter(([k]) => k.endsWith('|' + stateUpper));
  if (stateCities.length > 0) {
    // Average the state's city multipliers
    const avgMult = stateCities.reduce((sum, [, v]) => sum + v.multiplier, 0) / stateCities.length;
    // Unlisted cities are typically smaller - apply small market discount
    const smallCityMult = Math.round(avgMult * 0.94 * 1000) / 1000;
    return res.status(200).json({ multiplier: smallCityMult, rangeLow: 0.75, rangeHigh: 1.30, source: 'state_avg_small_city' });
  }

  return res.status(200).json({ multiplier: 1.0, rangeLow: 0.75, rangeHigh: 1.30, source: 'default' });
};
