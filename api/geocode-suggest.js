export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const mapboxToken = process.env.MAPBOX_TOKEN;
  if (!mapboxToken) {
    return res.status(200).json({ suggestions: [] });
  }

  const query = (req.query.q || "").trim();
  if (!query || query.length < 3) {
    return res.status(200).json({ suggestions: [] });
  }

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&country=us&types=address&limit=5&autocomplete=true`;

    const response = await fetch(url);
    if (!response.ok) {
      return res.status(200).json({ suggestions: [] });
    }

    const data = await response.json();
    const suggestions = (data.features || []).map(feature => {
      const context = feature.context || [];
      let city = "";
      let state = "";
      let postcode = "";

      for (const ctx of context) {
        const id = ctx.id || "";
        if (id.startsWith("place")) city = ctx.text || "";
        else if (id.startsWith("region")) state = (ctx.short_code || "").replace("US-", "");
        else if (id.startsWith("postcode")) postcode = ctx.text || "";
      }

      const street = feature.address
        ? feature.address + " " + (feature.text || "")
        : (feature.place_name || "").split(",")[0];

      return {
        label: feature.place_name || "",
        street: street.trim(),
        city,
        state,
        zip: postcode
      };
    });

    return res.status(200).json({ suggestions });
  } catch (e) {
    return res.status(200).json({ suggestions: [] });
  }
}
