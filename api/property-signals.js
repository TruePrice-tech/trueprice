// Property signals endpoint — proxies Mapbox geocoding + OSM building footprint
// Estimates roof size from building footprint data

export const config = {
  maxDuration: 30
};

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter"
];

// Overpass servers heavily rate-limit anonymous requests, especially from
// shared cloud egress IPs (Vercel). Identifying ourselves with a real UA
// significantly improves success rate.
const USER_AGENT = "Woogoro/1.0 (+https://woogoro.com; contact:hello@woogoro.com)";

export default async function handler(req, res) {
  const allowedOrigin = "https://woogoro.com";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const mapboxToken = process.env.MAPBOX_TOKEN;
  if (!mapboxToken) {
    return res.status(200).json({ success: false, error: "Geocoding not configured" });
  }

  try {
    const { street, city, stateCode, zip } = req.body || {};
    const addressParts = [street, city, stateCode, zip].filter(Boolean);

    if (addressParts.length < 2) {
      return res.status(400).json({ success: false, error: "Insufficient address data" });
    }

    const query = addressParts.join(", ");

    // Step 1: Geocode with Mapbox
    const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&country=us&types=address&limit=1`;
    const geocodeRes = await fetch(geocodeUrl);
    const geocodeData = await geocodeRes.json();

    const feature = geocodeData.features?.[0];
    if (!feature || !feature.center) {
      return res.status(200).json({ success: false, error: "Address not found" });
    }

    const [lon, lat] = feature.center;
    const relevance = feature.relevance || 0;

    // Step 2: Query OSM Overpass for building footprints. Sequential fallback
    // through mirrors with a real User-Agent — racing all 3 in parallel tends
    // to amplify rate-limiting (one bad request per mirror) and earlier
    // versions silently returned "no buildings" when every mirror timed out.
    const radius = 60; // meters
    const overpassQuery = `[out:json][timeout:15];way["building"](around:${radius},${lat},${lon});out body;>;out skel qt;`;

    const overpassData = await fetchOverpass(overpassQuery);

    if (!overpassData) {
      return res.status(200).json({
        success: true,
        data: {
          footprintSqFt: null,
          source: "osm_lookup_failed",
          geocodedAddress: feature.place_name,
          buildingMatchQuality: "none",
          candidateCount: 0,
          error: "Overpass mirrors unreachable"
        }
      });
    }

    const elements = overpassData?.elements || [];

    // Extract building footprints
    const nodes = {};
    elements.forEach(el => {
      if (el.type === "node") nodes[el.id] = { lat: el.lat, lon: el.lon };
    });

    const buildings = [];
    elements.forEach(el => {
      if (el.type === "way" && el.nodes) {
        const coords = el.nodes.map(nid => nodes[nid]).filter(Boolean);
        if (coords.length >= 3) {
          const area = polygonAreaSqFt(coords);
          const centroid = polygonCentroid(coords);
          if (area && centroid) {
            const dist = haversineMeters(lat, lon, centroid.lat, centroid.lon);
            buildings.push({ area, distance: dist, id: el.id });
          }
        }
      }
    });

    if (buildings.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          footprintSqFt: null,
          source: "osm_no_buildings",
          geocodedAddress: feature.place_name,
          buildingMatchQuality: "none",
          candidateCount: 0
        }
      });
    }

    // Score and rank candidates
    const scored = buildings
      .filter(b => b.area >= 400 && b.area <= 20000)
      .map(b => ({
        ...b,
        score: Math.max(0, 100 - b.distance * 2.2) + (b.area >= 800 && b.area <= 6000 ? 20 : 0)
      }))
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (!best) {
      return res.status(200).json({
        success: true,
        data: {
          footprintSqFt: null,
          source: "osm_no_viable_buildings",
          geocodedAddress: feature.place_name,
          buildingMatchQuality: "none",
          candidateCount: buildings.length
        }
      });
    }

    const matchQuality = best.distance <= 12 && best.score >= 95 && scored.length === 1
      ? "high"
      : best.distance <= 25 && best.score >= 70
        ? "medium"
        : "low";

    const ambiguous = scored.length >= 2 &&
      Math.abs(scored[0].score - scored[1].score) <= 10 &&
      Math.abs(scored[0].distance - scored[1].distance) <= 12;

    return res.status(200).json({
      success: true,
      data: {
        footprintSqFt: Math.round(best.area),
        source: "osm_footprint",
        buildingMatchQuality: ambiguous ? "low" : matchQuality,
        ambiguousBuildingMatch: ambiguous,
        candidateCount: scored.length,
        geocodedAddress: feature.place_name,
        geocodeRelevance: relevance,
        selectedBuilding: {
          footprintSqFt: Math.round(best.area),
          distanceMeters: Math.round(best.distance),
          score: Math.round(best.score)
        }
      }
    });
  } catch (e) {
    console.error("[property-signals] lookup failed:", e && e.message, e && e.stack);
    return res.status(200).json({ success: false, error: "Lookup failed", detail: (e && e.message) || String(e) });
  }
}

async function fetchOverpass(query) {
  const body = "data=" + encodeURIComponent(query);
  for (const url of OVERPASS_MIRRORS) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 9000);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
          "Accept": "application/json"
        },
        body,
        signal: ctrl.signal
      });
      clearTimeout(t);
      if (!res.ok) {
        console.warn(`[property-signals] ${new URL(url).host} returned ${res.status}`);
        continue;
      }
      const text = await res.text();
      if (!text.startsWith("{")) {
        console.warn(`[property-signals] ${new URL(url).host} returned non-JSON`);
        continue;
      }
      return JSON.parse(text);
    } catch (e) {
      console.warn(`[property-signals] ${new URL(url).host} failed: ${e.message}`);
    }
  }
  return null;
}

// Haversine distance in meters
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Polygon centroid
function polygonCentroid(coords) {
  const lat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
  const lon = coords.reduce((s, c) => s + c.lon, 0) / coords.length;
  return { lat, lon };
}

// Polygon area in sq ft (Shoelace formula with lat/lon to meters conversion)
function polygonAreaSqFt(coords) {
  if (coords.length < 3) return 0;
  const avgLat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
  const latM = 111320; // meters per degree latitude
  const lonM = 111320 * Math.cos(avgLat * Math.PI / 180);

  let area = 0;
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    const xi = coords[i].lon * lonM;
    const yi = coords[i].lat * latM;
    const xj = coords[j].lon * lonM;
    const yj = coords[j].lat * latM;
    area += xi * yj - xj * yi;
  }
  area = Math.abs(area) / 2;
  return Math.round(area * 10.764); // sq meters to sq ft
}
