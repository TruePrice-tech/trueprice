export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://truepricehq.com");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "public, max-age=86400");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const googleKey = process.env.GOOGLE_VISION_API_KEY;
  if (!googleKey) return res.status(200).json({ available: false, error: "Google API not configured" });

  const { lat, lng, address, zoom } = req.query;

  if (!lat && !lng && !address) {
    return res.status(400).json({ error: "Provide lat/lng or address" });
  }

  try {
    let centerLat = parseFloat(lat);
    let centerLng = parseFloat(lng);

    // If no lat/lng, geocode the address via Mapbox
    if (isNaN(centerLat) || isNaN(centerLng)) {
      const mapboxToken = process.env.MAPBOX_TOKEN;
      if (!mapboxToken) return res.status(200).json({ available: false, error: "Geocoding not configured" });

      const geoRes = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxToken}&country=us&types=address&limit=1`);
      if (!geoRes.ok) return res.status(200).json({ available: false, error: "Geocoding failed" });

      const geoData = await geoRes.json();
      const feature = geoData.features?.[0];
      if (!feature?.center) return res.status(200).json({ available: false, error: "Address not found" });

      centerLng = feature.center[0];
      centerLat = feature.center[1];
    }

    const zoomLevel = parseInt(zoom) || 20;
    const mapWidth = 600;
    const mapHeight = 400;

    // Google Static Maps API URL
    const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${centerLat},${centerLng}&zoom=${zoomLevel}&size=${mapWidth}x${mapHeight}&maptype=satellite&key=${googleKey}`;

    // Google Maps Embed URL (for interactive map)
    const embedUrl = `https://www.google.com/maps/embed/v1/view?key=${googleKey}&center=${centerLat},${centerLng}&zoom=${zoomLevel}&maptype=satellite`;

    return res.status(200).json({
      available: true,
      lat: centerLat,
      lng: centerLng,
      staticMapUrl,
      embedUrl,
      zoom: zoomLevel
    });

  } catch (error) {
    console.error("[satellite-view] Error:", error.message);
    return res.status(200).json({ available: false, error: "Lookup failed" });
  }
}
