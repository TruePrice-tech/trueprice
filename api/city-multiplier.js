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

  const key = city + '|' + state.toUpperCase();
  const multipliers = getMultipliers();
  const entry = multipliers[key];

  if (entry) {
    return res.status(200).json({ multiplier: entry.multiplier, source: entry.source });
  }

  return res.status(200).json({ multiplier: 1.0, source: 'default' });
};
