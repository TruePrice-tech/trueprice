const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const imagesDir = path.join(__dirname, '..', 'images');

const TARGETS = [
  { label: 'Trudy (legacy)', dir: '.', maxWidth: 500, match: f => f.startsWith('trudy') && f.endsWith('.png') },
  { label: 'Iris', dir: 'Iris', maxWidth: 800, match: f => /^Iris .*\.png$/i.test(f) },
  { label: 'Worker Woogoro', dir: 'Worker Woogoro', maxWidth: 800, match: f => / worker\.png$/i.test(f) },
];

async function compressOne(filePath, maxWidth) {
  const input = fs.readFileSync(filePath);
  const meta = await sharp(input).metadata();
  const targetWidth = Math.min(maxWidth, meta.width || maxWidth);

  const png = await sharp(input)
    .resize({ width: targetWidth, withoutEnlargement: true })
    .png({ compressionLevel: 9, quality: 85, palette: false })
    .toBuffer();

  const webp = await sharp(input)
    .resize({ width: targetWidth, withoutEnlargement: true })
    .webp({ quality: 82, effort: 6 })
    .toBuffer();

  return { png, webp, before: input.length, width: meta.width };
}

(async () => {
  let totalFiles = 0;
  let totalBefore = 0;
  let totalAfterPng = 0;
  let totalWebp = 0;

  for (const target of TARGETS) {
    const dir = target.dir === '.' ? imagesDir : path.join(imagesDir, target.dir);
    if (!fs.existsSync(dir)) {
      console.log(`[${target.label}] skip — directory not found: ${dir}`);
      continue;
    }
    const files = fs.readdirSync(dir).filter(target.match);
    console.log(`\n[${target.label}] ${files.length} files`);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const { png, webp, before, width } = await compressOne(filePath, target.maxWidth);

      fs.writeFileSync(filePath, png);
      const webpPath = path.join(dir, file.replace(/\.png$/i, '.webp'));
      fs.writeFileSync(webpPath, webp);

      totalFiles++;
      totalBefore += before;
      totalAfterPng += png.length;
      totalWebp += webp.length;

      const beforeKB = (before / 1024).toFixed(0);
      const pngKB = (png.length / 1024).toFixed(0);
      const webpKB = (webp.length / 1024).toFixed(0);
      console.log(`  ${file} (${width}px): ${beforeKB}KB -> PNG ${pngKB}KB / WebP ${webpKB}KB`);
    }
  }

  const savedMB = ((totalBefore - totalAfterPng) / 1024 / 1024).toFixed(1);
  console.log(`\nDone. ${totalFiles} files. PNG saved ${savedMB} MB. WebP siblings: ${(totalWebp / 1024 / 1024).toFixed(1)} MB.`);
})().catch(err => { console.error(err); process.exit(1); });
