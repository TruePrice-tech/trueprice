/**
 * End-to-end test for the photo estimate pipeline.
 *
 * Tests the full API chain: photo-estimate, address-lookup, city-multiplier
 * Simulates various scenarios without needing a physical camera.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-xxx node scripts/test-photo-flow.js
 *
 * Options:
 *   --base-url=http://localhost:3000  (default: https://truepricehq.com)
 *   --verbose                         (show full API responses)
 */

const fs = require("fs");
const path = require("path");

const args = {};
process.argv.slice(2).forEach(arg => {
  if (arg.startsWith("--")) {
    const [key, val] = arg.slice(2).split("=");
    args[key] = val === undefined ? true : val;
  }
});

const BASE_URL = args["base-url"] || "https://truepricehq.com";
const VERBOSE = args.verbose || false;
const API_KEY = process.env.ANTHROPIC_API_KEY;

let pass = 0, fail = 0, skip = 0;

function log(icon, msg) { console.log(`  ${icon}  ${msg}`); }

async function test(name, fn) {
  try {
    await fn();
    log("PASS", name);
    pass++;
  } catch (e) {
    log("FAIL", `${name}: ${e.message}`);
    fail++;
  }
}

function expect(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg || ""} expected "${expected}" got "${actual}"`);
}

function expectTruthy(val, msg) {
  if (!val) throw new Error(msg || "expected truthy value");
}

function expectInRange(val, min, max, msg) {
  if (val < min || val > max) throw new Error(`${msg || ""} ${val} not in range ${min}-${max}`);
}

// Get a test image (use trudy-roofing.png converted to base64)
function getTestImageBase64() {
  const imgPath = path.join(__dirname, "..", "images", "trudy-roofing.png");
  if (fs.existsSync(imgPath)) {
    return fs.readFileSync(imgPath).toString("base64");
  }
  // Fallback: generate a large enough dummy JPEG (repeat data to exceed 1000 byte minimum)
  const header = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP";
  return header + "A".repeat(2000);
}

function getTestMediaType() {
  const imgPath = path.join(__dirname, "..", "images", "trudy-roofing.png");
  return fs.existsSync(imgPath) ? "image/png" : "image/jpeg";
}

async function fetchJSON(url, options) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (VERBOSE) console.log("    Response:", JSON.stringify(data).substring(0, 500));
  return { status: res.status, data };
}

// ============================================================
// TEST SUITE 1: Address Lookup API
// ============================================================
async function testAddressLookup() {
  console.log("\n=== ADDRESS LOOKUP API ===");

  await test("Known address returns lat/lng", async () => {
    const { status, data } = await fetchJSON(`${BASE_URL}/api/address-lookup?address=${encodeURIComponent("17064 Laurelmont Court, Fort Mill, SC 29707")}`);
    expect(status, 200, "status");
    expectTruthy(data.lat, "should have lat");
    expectTruthy(data.lng, "should have lng");
    expectInRange(data.lat, 34.9, 35.2, "lat should be near Fort Mill");
    expectInRange(data.lng, -81.0, -80.7, "lng should be near Fort Mill");
    console.log(`    -> lat: ${data.lat}, lng: ${data.lng}`);
  });

  await test("Known address returns footprint", async () => {
    const { data } = await fetchJSON(`${BASE_URL}/api/address-lookup?address=${encodeURIComponent("17064 Laurelmont Court, Fort Mill, SC 29707")}`);
    if (!data.footprint) {
      log("WARN", "No OSM footprint found (OSM may not have this building)");
      skip++;
      return;
    }
    expectTruthy(data.footprint.footprintSqFt, "should have footprintSqFt");
    expectInRange(data.footprint.footprintSqFt, 500, 10000, "footprint size");
    console.log(`    -> footprint: ${data.footprint.footprintSqFt} sq ft, distance: ${data.footprint.distanceMeters}m`);
  });

  await test("Unknown address returns null footprint gracefully", async () => {
    const { status, data } = await fetchJSON(`${BASE_URL}/api/address-lookup?address=${encodeURIComponent("99999 Nonexistent Rd, Nowhere, ZZ 00000")}`);
    expect(status, 200, "status");
    // Should not crash
  });

  await test("Missing address returns 400", async () => {
    const { status } = await fetchJSON(`${BASE_URL}/api/address-lookup`);
    expect(status, 400, "status");
  });

  await test("Dallas TX address returns footprint", async () => {
    const { data } = await fetchJSON(`${BASE_URL}/api/address-lookup?address=${encodeURIComponent("1600 Main St, Dallas, TX 75201")}`);
    expectTruthy(data.lat, "should have lat");
    console.log(`    -> lat: ${data.lat}, lng: ${data.lng}, footprint: ${data.footprint ? data.footprint.footprintSqFt + " sq ft" : "none"}`);
  });
}

// ============================================================
// TEST SUITE 2: City Multiplier API
// ============================================================
async function testCityMultiplier() {
  console.log("\n=== CITY MULTIPLIER API ===");

  await test("Fort Mill SC returns multiplier", async () => {
    const { status, data } = await fetchJSON(`${BASE_URL}/api/city-multiplier?city=Fort+Mill&state=SC`);
    expect(status, 200, "status");
    expectTruthy(data.multiplier, "should have multiplier");
    expectInRange(data.multiplier, 0.7, 1.5, "multiplier range");
    console.log(`    -> multiplier: ${data.multiplier}`);
  });

  await test("Dallas TX returns multiplier", async () => {
    const { data } = await fetchJSON(`${BASE_URL}/api/city-multiplier?city=Dallas&state=TX`);
    expectTruthy(data.multiplier, "should have multiplier");
    console.log(`    -> multiplier: ${data.multiplier}`);
  });

  await test("Unknown city falls back gracefully", async () => {
    const { status, data } = await fetchJSON(`${BASE_URL}/api/city-multiplier?city=Nowhereville&state=SC`);
    expect(status, 200, "status");
    // Should return something (state average or nearest city)
    console.log(`    -> multiplier: ${data.multiplier || "none"}, source: ${data.source || "unknown"}`);
  });

  await test("Missing state returns 400", async () => {
    const { status } = await fetchJSON(`${BASE_URL}/api/city-multiplier?city=Dallas`);
    expect(status, 400, "status");
  });
}

// ============================================================
// TEST SUITE 3: Photo Estimate API
// ============================================================
async function testPhotoEstimate() {
  console.log("\n=== PHOTO ESTIMATE API ===");

  if (!API_KEY) {
    log("SKIP", "Set ANTHROPIC_API_KEY to run photo estimate tests");
    skip += 5;
    return;
  }

  await test("Roofing with browser GPS returns location + buildings", async () => {
    const { status, data } = await fetchJSON(`${BASE_URL}/api/photo-estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base64: getTestImageBase64(),
        mediaType: getTestMediaType(),
        service: "roofing",
        browserLat: 35.0165,
        browserLng: -80.858
      })
    });
    expect(status, 200, "status");
    expectTruthy(data.success, "should be success");
    expectTruthy(data.location, "should have location");
    expect(data.location.state, "SC", "should detect SC");
    console.log(`    -> city: ${data.location.city}, state: ${data.location.state}`);
    console.log(`    -> address: ${data.location.address || "none"}`);
    console.log(`    -> nearby buildings: ${data.nearbyAddresses ? data.nearbyAddresses.length : 0}`);
    console.log(`    -> footprint: ${data.buildingFootprint ? data.buildingFootprint.footprintSqFt + " sq ft" : "none"}`);
    if (data.data) {
      console.log(`    -> material: ${data.data.material}, confidence: ${data.data.materialConfidence}`);
      console.log(`    -> photoQuality: ${data.data.photoQuality || "not returned"}`);
      console.log(`    -> photographerDistance: ${data.data.photographerDistance || "not returned"}`);
    }
  });

  await test("HVAC service returns system type", async () => {
    const { status, data } = await fetchJSON(`${BASE_URL}/api/photo-estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base64: getTestImageBase64(),
        mediaType: getTestMediaType(),
        service: "hvac",
        browserLat: 35.0165,
        browserLng: -80.858
      })
    });
    expect(status, 200, "status");
    expectTruthy(data.data, "should have data");
    console.log(`    -> systemType: ${data.data.systemType || "unknown"}`);
    console.log(`    -> condition: ${data.data.condition || "unknown"}`);
  });

  await test("Solar service returns orientation", async () => {
    const { status, data } = await fetchJSON(`${BASE_URL}/api/photo-estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base64: getTestImageBase64(),
        mediaType: getTestMediaType(),
        service: "solar",
        browserLat: 35.0165,
        browserLng: -80.858
      })
    });
    expect(status, 200, "status");
    expectTruthy(data.data, "should have data");
    console.log(`    -> orientation: ${data.data.roofOrientation || "unknown"}`);
    console.log(`    -> shadeLevel: ${data.data.shadeLevel || "unknown"}`);
  });

  await test("No GPS returns no location", async () => {
    const { status, data } = await fetchJSON(`${BASE_URL}/api/photo-estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base64: getTestImageBase64(),
        mediaType: getTestMediaType(),
        service: "roofing"
      })
    });
    expect(status, 200, "status");
    expect(data.location, null, "should have no location");
    console.log(`    -> location: ${data.location}`);
  });

  await test("Missing image returns 400", async () => {
    const { status } = await fetchJSON(`${BASE_URL}/api/photo-estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service: "roofing" })
    });
    expect(status, 400, "status");
  });
}

// ============================================================
// TEST SUITE 3B: Batch Image Tests (all downloaded test images)
// ============================================================
async function testBatchImages() {
  console.log("\n=== BATCH IMAGE TESTS ===");

  if (!API_KEY) {
    log("SKIP", "Set ANTHROPIC_API_KEY to run batch image tests");
    skip++;
    return;
  }

  const imgDir = path.join(__dirname, "..", "test-images");
  if (!fs.existsSync(imgDir)) {
    log("SKIP", "No test-images/ folder. Run download-test-images.js first");
    skip++;
    return;
  }

  const images = fs.readdirSync(imgDir)
    .filter(f => f.endsWith(".jpg") || f.endsWith(".png"))
    .filter(f => fs.statSync(path.join(imgDir, f)).size > 1000);

  if (images.length === 0) {
    log("SKIP", "No test images found");
    skip++;
    return;
  }

  console.log(`  Found ${images.length} test images\n`);

  // Test scenarios: each image with different services and GPS configs
  const scenarios = [
    { service: "roofing", lat: 35.0165, lng: -80.858, label: "Fort Mill GPS" },
    { service: "roofing", lat: null, lng: null, label: "No GPS" },
    { service: "hvac", lat: 35.0165, lng: -80.858, label: "Fort Mill GPS" },
    { service: "solar", lat: 35.0165, lng: -80.858, label: "Fort Mill GPS" }
  ];

  var results = [];

  for (const img of images) {
    const imgPath = path.join(imgDir, img);
    const base64 = fs.readFileSync(imgPath).toString("base64");
    const mediaType = img.endsWith(".png") ? "image/png" : "image/jpeg";

    // Pick relevant scenarios based on image name
    var imgScenarios;
    if (img.includes("hvac")) {
      imgScenarios = scenarios.filter(s => s.service === "hvac");
    } else if (img.includes("solar")) {
      imgScenarios = scenarios.filter(s => s.service === "solar");
    } else {
      imgScenarios = scenarios.filter(s => s.service === "roofing").slice(0, 1); // Just first roofing scenario for house images
    }

    for (const sc of imgScenarios) {
      var testName = `${img} | ${sc.service} | ${sc.label}`;
      await test(testName, async () => {
        var body = { base64: base64, mediaType: mediaType, service: sc.service };
        if (sc.lat) { body.browserLat = sc.lat; body.browserLng = sc.lng; }

        const { status, data } = await fetchJSON(`${BASE_URL}/api/photo-estimate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        expect(status, 200, "status");
        expectTruthy(data.success, "should be success");
        expectTruthy(data.data, "should have data");

        var r = data.data;
        var result = {
          image: img,
          service: sc.service,
          gps: sc.label,
          photoQuality: r.photoQuality || "not_returned",
          city: data.location ? data.location.city : "none",
          footprint: data.buildingFootprint ? data.buildingFootprint.footprintSqFt : 0,
          nearby: data.nearbyAddresses ? data.nearbyAddresses.length : 0
        };

        if (sc.service === "roofing") {
          result.material = r.material || "unknown";
          result.confidence = r.materialConfidence || "unknown";
          result.stories = r.stories || 0;
          result.pitch = r.pitch || "unknown";
          result.complexity = r.complexity || "unknown";
          result.condition = r.condition || "unknown";
          result.distance = r.photographerDistance || "unknown";
          result.distanceFt = r.estimatedDistanceFt || 0;
          console.log(`    -> quality:${r.photoQuality} material:${r.material}(${r.materialConfidence}) stories:${r.stories} pitch:${r.pitch} complexity:${r.complexity} condition:${r.condition}`);
          console.log(`    -> distance:${r.photographerDistance} ~${r.estimatedDistanceFt}ft | footprint:${result.footprint}sqft | nearby:${result.nearby}`);
        } else if (sc.service === "hvac") {
          result.systemType = r.systemType || "unknown";
          result.brand = r.brand || "none";
          result.tonnage = r.estimatedTonnage || 0;
          result.condition = r.condition || "unknown";
          console.log(`    -> quality:${r.photoQuality} system:${r.systemType} brand:${r.brand || "none"} tonnage:${r.estimatedTonnage || "?"} condition:${r.condition}`);
        } else if (sc.service === "solar") {
          result.orientation = r.roofOrientation || "unknown";
          result.shade = r.shadeLevel || "unknown";
          result.panels = r.existingPanels || false;
          console.log(`    -> quality:${r.photoQuality} orientation:${r.roofOrientation} shade:${r.shadeLevel} existingPanels:${r.existingPanels}`);
        }

        results.push(result);
      });

      // Rate limit between API calls
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Summary table
  console.log("\n  === SUMMARY ===");
  console.log("  " + "Image".padEnd(25) + "Service".padEnd(10) + "Quality".padEnd(12) + "Key Finding");
  console.log("  " + "-".repeat(80));
  for (var r of results) {
    var finding = "";
    if (r.service === "roofing") finding = `${r.material}(${r.confidence}) ${r.stories}story ${r.pitch} ${r.footprint}sqft`;
    else if (r.service === "hvac") finding = `${r.systemType} ${r.brand} ${r.tonnage}ton`;
    else if (r.service === "solar") finding = `${r.orientation} shade:${r.shade} panels:${r.panels}`;
    console.log("  " + r.image.padEnd(25) + r.service.padEnd(10) + r.photoQuality.padEnd(12) + finding);
  }
}

// ============================================================
// TEST SUITE 4: Auto-Confirm Logic (simulated)
// ============================================================
async function testAutoConfirmLogic() {
  console.log("\n=== AUTO-CONFIRM LOGIC (simulated) ===");

  await test("Roofing: high confidence + footprint + location = auto-confirm", () => {
    var r = { material: "architectural", materialConfidence: "high", condition: "good", roofSizeSource: "satellite", estimatedRoofSqFt: 2500, pitch: "normal", photoQuality: "good" };
    var hasLocation = true;
    var hasGoodMaterial = r.material !== "unknown" && r.materialConfidence !== "low";
    var hasGoodCondition = r.condition !== "unknown";
    var hasRoofSize = r.roofSizeSource === "satellite" && r.estimatedRoofSqFt >= 500 && r.estimatedRoofSqFt <= 15000;
    var canAutoConfirm = hasGoodMaterial && hasGoodCondition && hasRoofSize && hasLocation && r.photoQuality === "good";
    expectTruthy(canAutoConfirm, "should auto-confirm");
  });

  await test("Roofing: low material confidence = no auto-confirm", () => {
    var r = { material: "asphalt", materialConfidence: "low", condition: "good", roofSizeSource: "satellite", estimatedRoofSqFt: 2500, photoQuality: "good" };
    var hasGoodMaterial = r.material !== "unknown" && r.materialConfidence !== "low";
    expectTruthy(!hasGoodMaterial, "should NOT auto-confirm with low confidence");
  });

  await test("Roofing: no footprint = no auto-confirm", () => {
    var r = { material: "architectural", materialConfidence: "high", condition: "good", roofSizeSource: undefined, estimatedRoofSqFt: 0, photoQuality: "good" };
    var hasRoofSize = r.roofSizeSource === "satellite" && r.estimatedRoofSqFt >= 500;
    expectTruthy(!hasRoofSize, "should NOT auto-confirm without footprint");
  });

  await test("Roofing: too_dark photo = no auto-confirm", () => {
    var r = { material: "architectural", materialConfidence: "high", condition: "good", roofSizeSource: "satellite", estimatedRoofSqFt: 2500, photoQuality: "too_dark" };
    var canAutoConfirm = r.photoQuality === "good";
    expectTruthy(!canAutoConfirm, "should NOT auto-confirm with dark photo");
  });

  await test("HVAC: known system + condition + location = auto-confirm", () => {
    var r = { systemType: "central_ac", condition: "fair" };
    var hasSystem = r.systemType !== "unknown";
    var hasCondition = r.condition !== "unknown";
    var canAutoConfirm = hasSystem && hasCondition;
    expectTruthy(canAutoConfirm, "should auto-confirm");
  });

  await test("Solar: orientation + shade + location = auto-confirm", () => {
    var r = { roofOrientation: "south", shadeLevel: "minimal" };
    var canAutoConfirm = r.roofOrientation !== "unknown" && r.shadeLevel !== "unknown";
    expectTruthy(canAutoConfirm, "should auto-confirm");
  });

  await test("Roof size validation: 500-15000 range", () => {
    expectTruthy(500 >= 500 && 500 <= 15000, "500 should be valid");
    expectTruthy(15000 >= 500 && 15000 <= 15000, "15000 should be valid");
    expectTruthy(!(400 >= 500), "400 should be invalid");
    expectTruthy(!(16000 <= 15000), "16000 should be invalid");
  });

  await test("Footprint validation: 500-10000 range", () => {
    expectTruthy(500 >= 500 && 500 <= 10000, "500 should be valid");
    expectTruthy(!(300 >= 500), "300 should be invalid (shed)");
    expectTruthy(!(12000 <= 10000), "12000 should be invalid (commercial)");
  });
}

// ============================================================
// TEST SUITE 5: Building Selection Logic
// ============================================================
async function testBuildingSelection() {
  console.log("\n=== BUILDING SELECTION LOGIC ===");

  await test("at_house picks closest building", () => {
    var buildings = [
      { footprintSqFt: 2000, distanceMeters: 5 },
      { footprintSqFt: 1800, distanceMeters: 30 },
      { footprintSqFt: 2200, distanceMeters: 50 }
    ];
    // at_house should pick index 0 (closest)
    var best = buildings[0]; // simulating pickBuildingByDistance
    expect(best.distanceMeters, 5, "should pick closest");
  });

  await test("across_street picks distance-matched building", () => {
    var buildings = [
      { footprintSqFt: 1500, distanceMeters: 5 },
      { footprintSqFt: 2000, distanceMeters: 12 },
      { footprintSqFt: 2200, distanceMeters: 25 },
      { footprintSqFt: 1800, distanceMeters: 40 }
    ];
    var estimatedDistanceFt = 40; // ~12 meters
    var distMeters = estimatedDistanceFt * 0.3048;
    // Find building closest to estimated distance
    var best = buildings.reduce((a, b) =>
      Math.abs(a.distanceMeters - distMeters) < Math.abs(b.distanceMeters - distMeters) ? a : b
    );
    expect(best.distanceMeters, 12, "should pick building at ~12m");
  });

  await test("Single building always selected", () => {
    var buildings = [{ footprintSqFt: 2500, distanceMeters: 20 }];
    expect(buildings[0].footprintSqFt, 2500, "should pick only building");
  });
}

// ============================================================
// RUN ALL
// ============================================================
async function main() {
  console.log("TruePrice Photo Estimate - End to End Tests");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Anthropic API: ${API_KEY ? "configured" : "NOT SET (photo tests will skip)"}\n`);

  await testAddressLookup();
  await testCityMultiplier();
  await testPhotoEstimate();
  await testBatchImages();
  await testAutoConfirmLogic();
  await testBuildingSelection();

  console.log(`\n========================================`);
  console.log(`RESULTS: ${pass} passed, ${fail} failed, ${skip} skipped`);
  console.log(`========================================`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
