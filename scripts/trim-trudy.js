/**
 * Auto-trim transparent padding from all Trudy PNG images.
 * Uses sharp to detect bounding box and crop to content + small margin.
 *
 * Usage: node scripts/trim-trudy.js
 */

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const IMAGES_DIR = path.join(__dirname, "..", "images");
const MARGIN = 10; // pixels of padding to keep around the character

async function trimImage(filePath) {
  const name = path.basename(filePath);
  try {
    const img = sharp(filePath);
    const meta = await img.metadata();

    // Use sharp's trim to find bounding box of non-transparent content
    const trimmed = await img
      .trim({ threshold: 10 })
      .toBuffer({ resolveWithObject: true });

    const trimInfo = trimmed.info;

    // Check if significant trimming occurred
    const origPixels = meta.width * meta.height;
    const newPixels = trimInfo.width * trimInfo.height;
    const reduction = Math.round((1 - newPixels / origPixels) * 100);

    if (reduction < 5) {
      console.log(`  ${name}: only ${reduction}% reducible, skipping`);
      return { name, skipped: true, reduction };
    }

    // Add margin back
    const finalWidth = trimInfo.width + MARGIN * 2;
    const finalHeight = trimInfo.height + MARGIN * 2;

    const final = await sharp(trimmed.data)
      .extend({
        top: MARGIN,
        bottom: MARGIN,
        left: MARGIN,
        right: MARGIN,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer();

    // Overwrite original
    fs.writeFileSync(filePath, final);
    console.log(`  ${name}: ${meta.width}x${meta.height} -> ${finalWidth}x${finalHeight} (${reduction}% smaller)`);
    return { name, before: `${meta.width}x${meta.height}`, after: `${finalWidth}x${finalHeight}`, reduction };
  } catch (e) {
    console.log(`  ${name}: error - ${e.message}`);
    return { name, error: e.message };
  }
}

async function main() {
  const files = fs.readdirSync(IMAGES_DIR)
    .filter(f => f.startsWith("trudy") && f.endsWith(".png"))
    .map(f => path.join(IMAGES_DIR, f));

  console.log(`Trimming ${files.length} Trudy PNG images...\n`);

  const results = [];
  for (const file of files) {
    results.push(await trimImage(file));
  }

  const trimmed = results.filter(r => !r.skipped && !r.error);
  const skipped = results.filter(r => r.skipped);
  const errors = results.filter(r => r.error);

  console.log(`\nDone: ${trimmed.length} trimmed, ${skipped.length} skipped, ${errors.length} errors`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
