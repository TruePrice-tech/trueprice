// Forward geocode an address, then query OSM for building footprint
export default async function handler(req, res) {
  const allowedOrigin = "https://truepricehq.com";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const address = req.query.address;
  if (!address) return res.status(400).json({ error: "Missing address parameter" });

  const token = process.env.MAPBOX_TOKEN;
  if (!token) return res.status(500).json({ error: "Geocoding not configured" });

  try {
    // Forward geocode via Mapbox
    const geoUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${token}&country=us&types=address&limit=1`;
    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) return res.status(502).json({ error: "Geocoding failed" });

    const geoData = await geoRes.json();
    const feature = geoData.features?.[0];
    if (!feature) return res.status(200).json({ lat: null, lng: null, footprint: null, error: "Address not found" });

    const [lng, lat] = feature.center;
    console.log("[address-lookup] Geocoded:", address, "->", lat, lng);

    // Query OSM Overpass for building footprint
    const footprint = await getOsmFootprint(lat, lng);

    return res.status(200).json({
      lat,
      lng,
      address: feature.place_name || address,
      footprint
    });
  } catch (e) {
    console.error("[address-lookup] Error:", e.message);
    return res.status(500).json({ error: e.message });
  }
}

async function getOsmFootprint(lat, lng) {
  try {
    const radius = 40;
    const overpassQuery = `[out:json][timeout:10];way["building"](around:${radius},${lat},${lng});out body;>;out skel qt;`;
    const overpassRes = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(overpassQuery)
    });
    if (!overpassRes.ok) return null;
    const overpassData = await overpassRes.json();
    const elements = overpassData.elements || [];

    const nodes = {};
    elements.forEach(el => { if (el.type === "node") nodes[el.id] = { lat: el.lat, lon: el.lon }; });

    const buildings = [];
    elements.forEach(el => {
      if (el.type !== "way" || !el.nodes) return;
      const coords = el.nodes.map(nid => nodes[nid]).filter(Boolean);
      if (coords.length < 3) return;
      const area = polygonAreaSqFt(coords);
      if (area < 400 || area > 20000) return;

      // Calculate centroid
      let cx = 0, cy = 0;
      coords.forEach(c => { cx += c.lat; cy += c.lon; });
      cx /= coords.length;
      cy /= coords.length;

      // Distance from search point to building centroid
      const dlat = (cx - lat) * 111320;
      const dlng = (cy - lng) * 111320 * Math.cos(lat * Math.PI / 180);
      const dist = Math.sqrt(dlat * dlat + dlng * dlng);

      buildings.push({ footprintSqFt: area, distance: Math.round(dist), source: "osm_footprint" });
    });

    if (buildings.length === 0) return null;

    // Return closest building
    buildings.sort((a, b) => a.distance - b.distance);
    return buildings[0];
  } catch (e) {
    console.error("[address-lookup] OSM error:", e.message);
    return null;
  }
}

function polygonAreaSqFt(coords) {
  const avgLat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
  const latM = 111320;
  const lonM = 111320 * Math.cos(avgLat * Math.PI / 180);
  let area = 0;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const xi = coords[i].lon * lonM, yi = coords[i].lat * latM;
    const xj = coords[j].lon * lonM, yj = coords[j].lat * latM;
    area += (xj + xi) * (yj - yi);
  }
  return Math.round(Math.abs(area) / 2 * 10.764);
}
