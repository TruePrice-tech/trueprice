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
      rangeLow: entry.rangeLow || 0.85,
      rangeHigh: entry.rangeHigh || 1.18,
      lat: coord?.lat,
      lng: coord?.lng,
      source: entry.source,
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
