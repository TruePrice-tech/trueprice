import fs from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
import { readCalibration } from "./_flywheel-read.js";

let _redis = null;
function getRedis() {
  if (_redis) return _redis;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  try { _redis = Redis.fromEnv(); } catch (_) { _redis = null; }
  return _redis;
}

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

let _cityCoords = null;
function getCityCoords() {
  if (!_cityCoords) {
    try {
      _cityCoords = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'city-coordinates.json'), 'utf-8'));
    } catch(e) {
      _cityCoords = {};
    }
  }
  return _cityCoords;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// KIT-CITY-FUZZY: Levenshtein with early-exit at threshold. Used to correct
// OCR-drift typos like "Napervile" -> "Naperville" within the same state
// before they propagate to the analyzer's "<city> local pricing" label.
function _levenshtein(a, b, max) {
  if (a === b) return 0;
  const al = a.length, bl = b.length;
  if (Math.abs(al - bl) > max) return max + 1;
  if (al === 0) return bl;
  if (bl === 0) return al;
  let prev = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;
  for (let i = 1; i <= al; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= bl; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      const v = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      curr.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[bl];
}

// Find the closest known city in the same state within `max` edits. Domain
// is the ~740 cities already in city-cost-multipliers.json (top US cities by
// population), which is what we'd geocode against anyway. Returns the full
// "City|ST" key on hit, or null. Distance 0 acts as a case-insensitive
// canonical-capitalization lookup.
function findFuzzyCityKey(city, stateUpper, multipliers, max) {
  if (!city || String(city).length < 3) return null;
  const target = String(city).toLowerCase();
  const suffix = '|' + stateUpper;
  const limit = typeof max === 'number' ? max : 2;
  let bestKey = null;
  let bestDist = limit + 1;
  for (const k of Object.keys(multipliers)) {
    if (!k.endsWith(suffix)) continue;
    const candidate = k.slice(0, k.length - suffix.length).toLowerCase();
    const d = _levenshtein(target, candidate, limit);
    if (d < bestDist) {
      bestDist = d;
      bestKey = k;
      if (d === 0) break;
    }
  }
  return bestDist <= limit ? bestKey : null;
}

// Best-effort flywheel lookup. Always resolves; never throws.
async function lookupServiceCalibration(city, state, service, repair) {
  if (!service) return null;
  const redis = getRedis();
  if (!redis) return null;
  try {
    const calData = await readCalibration(redis, { city, state, service, repair });
    if (!calData || !calData.avgPrice || !calData.quotes) return null;
    return {
      avgPrice: calData.avgPrice,
      quotes: calData.quotes,
      lastUpdated: calData.lastUpdated || null,
      source: calData.source || null
    };
  } catch (_) {
    return null;
  }
}

export default async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://woogoro.com');
  // Cache 24h: per-edge-region origin pulls stay at ~30/day total. Flywheel
  // signal propagates with up to a 24h lag, which is fine — verdicts only
  // shift when a city accumulates enough quotes to cross a confidence band,
  // and waiting a day for that to reach all users is cheaper than 24x the
  // function invocations.
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { city, state, service, repair } = req.query;
  if (!city || !state) {
    return res.status(200).json({ multiplier: 1.0, rangeLow: 0.85, rangeHigh: 1.18, source: 'no_address' });
  }

  const stateUpper = state.toUpperCase();
  const key = city + '|' + stateUpper;
  const multipliers = getMultipliers();
  const entry = multipliers[key];

  // Kick off the calibration lookup in parallel with any geocode fallback work below.
  const calPromise = lookupServiceCalibration(city, stateUpper, service, repair);

  // Direct match
  if (entry) {
    const coords = getCityCoords();
    const coord = coords[key] || null;
    const svcMult = service && entry.serviceMultipliers?.[service] ? entry.serviceMultipliers[service] : null;
    const serviceCalibration = await calPromise;
    return res.status(200).json({
      multiplier: entry.multiplier,
      svcMult,
      canonicalCity: city,
      rangeLow: entry.rangeLow || 0.85,
      rangeHigh: entry.rangeHigh || 1.18,
      lat: coord?.lat,
      lng: coord?.lng,
      source: entry.source,
      serviceCalibration
    });
  }

  // KIT-CITY-FUZZY: typo correction within the same state. "Napervile|IL"
  // (OCR drift on a real quote) -> "Naperville|IL" with Lev=1. Treat as a
  // direct match against the canonical city's multipliers; surface
  // canonicalCity so downstream UIs can render the corrected name. Skipping
  // when state was not provided is intentional: fuzzy across all 50 states
  // would mis-correct legitimate small-town names that happen to be 2 edits
  // from a major city in another state.
  const fuzzyKey = findFuzzyCityKey(city, stateUpper, multipliers, 2);
  if (fuzzyKey) {
    const fEntry = multipliers[fuzzyKey];
    const fCanonicalCity = fuzzyKey.slice(0, fuzzyKey.length - ('|' + stateUpper).length);
    const coords = getCityCoords();
    const coord = coords[fuzzyKey] || null;
    const svcMult = service && fEntry.serviceMultipliers?.[service] ? fEntry.serviceMultipliers[service] : null;
    const serviceCalibration = await calPromise;
    return res.status(200).json({
      multiplier: fEntry.multiplier,
      svcMult,
      canonicalCity: fCanonicalCity,
      rangeLow: fEntry.rangeLow || 0.85,
      rangeHigh: fEntry.rangeHigh || 1.18,
      lat: coord?.lat,
      lng: coord?.lng,
      source: 'fuzzy_match',
      serviceCalibration
    });
  }

  // Not in list - geocode the unknown city, find nearest city in our list by coordinates
  const mapboxToken = process.env.MAPBOX_TOKEN;
  if (mapboxToken) {
    try {
      const query = encodeURIComponent(city + ', ' + stateUpper);
      const geoRes = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${mapboxToken}&country=us&types=place&limit=1`);
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        const feature = geoData.features?.[0];
        if (feature && feature.center) {
          const [lng, lat] = feature.center;

          // Find nearest city using pre-built coordinates
          const coords = getCityCoords();
          let bestKey = null;
          let bestDist = Infinity;

          for (const [ck, cv] of Object.entries(coords)) {
            if (!multipliers[ck]) continue;
            const dist = haversineKm(lat, lng, cv.lat, cv.lng);
            if (dist < bestDist) {
              bestDist = dist;
              bestKey = ck;
            }
          }

          if (bestKey && multipliers[bestKey] && bestDist < 200) {
            const nearest = multipliers[bestKey];
            const rangeLow = bestDist > 80 ? 0.75 : bestDist > 40 ? 0.78 : nearest.rangeLow || 0.82;
            const rangeHigh = bestDist > 80 ? 1.30 : bestDist > 40 ? 1.25 : nearest.rangeHigh || 1.22;
            const svcMult = service && nearest.serviceMultipliers?.[service] ? nearest.serviceMultipliers[service] : null;
            const serviceCalibration = await calPromise;
            // canonicalCity intentionally omitted: KIT-CITY-FUZZY contract is
            // "exact OR within 2 edits of a known city". Geocode-nearest is a
            // useful multiplier signal but isn't the user's actual city, so
            // callers that key the "<city> local pricing" label off
            // canonicalCity fall back to region/national here.
            return res.status(200).json({
              multiplier: nearest.multiplier,
              svcMult,
              rangeLow,
              rangeHigh,
              lat, lng,
              nearestCity: bestKey,
              distanceKm: Math.round(bestDist),
              source: 'nearest_city',
              serviceCalibration
            });
          }
        }
      }
    } catch(e) {
      // Geocode failed, fall through to state average
    }
  }

  // Final fallback: state average
  const stateCities = Object.entries(multipliers).filter(([k]) => k.endsWith('|' + stateUpper));
  if (stateCities.length > 0) {
    const avgMult = Math.round(stateCities.reduce((sum, [, v]) => sum + v.multiplier, 0) / stateCities.length * 1000) / 1000;
    const serviceCalibration = await calPromise;
    return res.status(200).json({ multiplier: avgMult, rangeLow: 0.75, rangeHigh: 1.30, source: 'state_avg', serviceCalibration });
  }

  const serviceCalibration = await calPromise;
  return res.status(200).json({ multiplier: 1.0, rangeLow: 0.75, rangeHigh: 1.30, source: 'default', serviceCalibration });
};
