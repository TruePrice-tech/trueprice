const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const imagesDir = path.join(__dirname, '..', 'images');

async function compress() {
  const files = fs.readdirSync(imagesDir).filter(f => f.startsWith('trudy') && f.endsWith('.png'));
  console.log(`Found ${files.length} trudy PNG files`);

  for (const file of files) {
    const filePath = path.join(imagesDir, file);
    const input = fs.readFileSync(filePath);
    const metadata = await sharp(input).metadata();

    let pipeline = sharp(input);

    if (metadata.width > 500) {
      console.log(`  Resizing ${file} from ${metadata.width}px to 500px wide`);
      pipeline = pipeline.resize({ width: 500 });
    }

    const output = await pipeline.png({ compressionLevel: 9, quality: 80 }).toBuffer();

    const savedKB = ((input.length - output.length) / 1024).toFixed(1);
    console.log(`  ${file}: ${(input.length / 1024).toFixed(1)}KB -> ${(output.length / 1024).toFixed(1)}KB (saved ${savedKB}KB)`);

    fs.writeFileSync(filePath, output);
  }

  console.log('Done.');
}

compress().catch(err => { console.error(err); process.exit(1); });
