async function estimateRoofSize() {
  const address = document.getElementById("address-input").value.trim();

  if (!address) {
    alert("Enter an address first.");
    return;
  }

  try {
    const geoUrl =
      "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=" +
      encodeURIComponent(address);

    const geoResponse = await fetch(geoUrl, {
      headers: {
        Accept: "application/json"
      }
    });

    if (!geoResponse.ok) {
      throw new Error(`Geocoding request failed: ${geoResponse.status}`);
    }

    const geoData = await geoResponse.json();

    if (!Array.isArray(geoData) || geoData.length === 0) {
      alert("Address not found. Try street, city, state, and ZIP.");
      return;
    }

    const lat = parseFloat(geoData[0].lat);
    const lon = parseFloat(geoData[0].lon);

    const overpassQuery = `
      [out:json][timeout:25];
      (
        way["building"](around:30,${lat},${lon});
      );
      out geom;
    `;

    const overpassUrl =
      "https://overpass-api.de/api/interpreter?data=" +
      encodeURIComponent(overpassQuery);

    const response = await fetch(overpassUrl);

    if (!response.ok) {
      alert("Address found, but building lookup timed out. Please enter roof size manually for now.");
      return;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      alert("Address found, but building data is temporarily unavailable. Please enter roof size manually for now.");
      return;
    }

    const data = await response.json();

    if (!data.elements || !data.elements.length) {
      alert("Address found, but building footprint was not found. Please enter roof size manually.");
      return;
    }

    const coords = data.elements[0].geometry;

    if (!coords || coords.length < 3) {
      alert("Building shape not available. Please enter roof size manually.");
      return;
    }

    let area = 0;

    for (let i = 0; i < coords.length; i++) {
      const j = (i + 1) % coords.length;
      area += coords[i].lon * coords[j].lat - coords[j].lon * coords[i].lat;
    }

    area = Math.abs(area / 2) * 111139 * 111139;

    const roofSize = Math.round(area * 1.15);

    const roofSizeInput = document.getElementById("roofSize");

    if (!roofSizeInput) {
      alert("Roof size field not found on page.");
      return;
    }

    roofSizeInput.value = roofSize;

    alert("Estimated roof size: " + roofSize.toLocaleString() + " sq ft");
  } catch (error) {
    console.error("Roof estimator error:", error);
    alert("Could not estimate roof size right now. Please enter roof size manually.");
  }
}