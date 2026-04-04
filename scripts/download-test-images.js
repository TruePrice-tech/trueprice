/**
 * Download test images for the photo estimate pipeline.
 * Run once to populate test-images/ folder.
 *
 * Usage: node scripts/download-test-images.js
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const DIR = path.join(__dirname, "..", "test-images");

// Free-to-use images from Unsplash (direct download URLs)
const IMAGES = [
  { name: "house-suburban.jpg", url: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80", desc: "Suburban house front view" },
  { name: "house-ranch.jpg", url: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80", desc: "Ranch style house" },
  { name: "house-twostory.jpg", url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80", desc: "Two story house" },
  { name: "house-night.jpg", url: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80", desc: "House at dusk/night" },
  { name: "hvac-unit.jpg", url: "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800&q=80", desc: "Outdoor AC condenser unit" },
  { name: "roof-aerial.jpg", url: "https://images.unsplash.com/photo-1632759145351-1d5f4d1d1108?w=800&q=80", desc: "Roof aerial view" },
  { name: "house-trees.jpg", url: "https://images.unsplash.com/photo-1598228723793-52759bba239c?w=800&q=80", desc: "House partially blocked by trees" },
  { name: "solar-panels.jpg", url: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&q=80", desc: "House with solar panels" }
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith("https") ? https : http;
    client.get(url, { headers: { "User-Agent": "TruePrice-TestImageDownloader/1.0" } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        // Follow redirect
        download(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    }).on("error", reject);
  });
}

async function main() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

  console.log(`Downloading ${IMAGES.length} test images to test-images/\n`);

  for (const img of IMAGES) {
    const dest = path.join(DIR, img.name);
    if (fs.existsSync(dest)) {
      console.log(`  SKIP  ${img.name} (already exists)`);
      continue;
    }
    process.stdout.write(`  ${img.name} (${img.desc})...`);
    try {
      await download(img.url, dest);
      const size = fs.statSync(dest).size;
      console.log(` ${Math.round(size / 1024)}KB`);
    } catch (e) {
      console.log(` FAILED: ${e.message}`);
    }
  }

  console.log("\nDone. Run test-photo-flow.js to test with these images.");
}

main();
