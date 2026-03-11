async function estimateRoofSize() {
  const address = document.getElementById("address-input").value;

  if (!address) {
    alert("Enter an address first.");
    return;
  }

  const geoUrl =
    "https://nominatim.openstreetmap.org/search?format=json&q=" +
    encodeURIComponent(address);

  const geoResponse = await fetch(geoUrl);
  const geoData = await geoResponse.json();

  if (!geoData.length) {
    alert("Address not found.");
    return;
  }

  const lat = geoData[0].lat;
  const lon = geoData[0].lon;

  const overpassQuery = `
  [out:json];
  (
    way["building"](around:30,${lat},${lon});
  );
  out geom;
  `;

  const overpassUrl =
    "https://overpass-api.de/api/interpreter?data=" +
    encodeURIComponent(overpassQuery);

  const response = await fetch(overpassUrl);
  const data = await response.json();

  if (!data.elements.length) {
    alert("Building footprint not found.");
    return;
  }

  const coords = data.elements[0].geometry;

  let area = 0;

  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;

    area +=
      coords[i].lon * coords[j].lat -
      coords[j].lon * coords[i].lat;
  }

  area = Math.abs(area / 2) * 111139 * 111139;

    const roofSizeInput = document.getElementById("roofSize");

    if (!roofSizeInput) {
    alert("Roof size field not found on page.");
    return;
  }

    roofSizeInput.value = roofSize;
  }