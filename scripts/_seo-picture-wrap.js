// Wrap <img> references to /images/Iris/*.png and /images/Worker%20Woogoro/*.png
// in <picture> with .webp source, and add width/height attributes from actual file dims.
// Idempotent: skips imgs already inside <picture> and skips imgs that already have width=.

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const IMAGES_ROOT = path.join(ROOT, 'images');

const IMG_TAG = /<img\b([^>]*?)\/?>/g;
const ATTR = name => new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, 'i');

const dimsCache = new Map();

function decodePath(urlPath) {
  // urlPath like "/images/Iris/Iris%20estimate.png"
  return urlPath.replace(/^\//, '').replace(/%20/g, ' ').split('/').join(path.sep);
}

async function getDims(urlPath) {
  if (dimsCache.has(urlPath)) return dimsCache.get(urlPath);
  const filePath = path.join(ROOT, decodePath(urlPath));
  if (!fs.existsSync(filePath)) {
    dimsCache.set(urlPath, null);
    return null;
  }
  try {
    const meta = await sharp(filePath).metadata();
    const dims = { w: meta.width, h: meta.height };
    dimsCache.set(urlPath, dims);
    return dims;
  } catch (e) {
    dimsCache.set(urlPath, null);
    return null;
  }
}

function srcMatches(src) {
  return /^\/images\/(Iris|Worker%20Woogoro)\//.test(src) && /\.png(\?|$)/i.test(src);
}

async function transformOne(html) {
  // First pass: find all img tags inside <picture> blocks so we skip them
  const pictureRanges = [];
  const PICTURE_RE = /<picture\b[\s\S]*?<\/picture>/g;
  let m;
  while ((m = PICTURE_RE.exec(html)) !== null) {
    pictureRanges.push([m.index, m.index + m[0].length]);
  }
  const inPicture = idx => pictureRanges.some(([a, b]) => idx >= a && idx < b);

  // Collect replacements
  const replacements = [];
  IMG_TAG.lastIndex = 0;
  while ((m = IMG_TAG.exec(html)) !== null) {
    const attrs = m[1];
    const srcMatch = ATTR('src').exec(attrs);
    if (!srcMatch) continue;
    const src = srcMatch[1];
    if (!srcMatches(src)) continue;
    if (inPicture(m.index)) continue;

    const start = m.index;
    const end = m.index + m[0].length;
    const tag = m[0];

    const hasWidth = /\swidth\s*=/i.test(attrs);
    const hasHeight = /\sheight\s*=/i.test(attrs);

    const dims = await getDims(src);
    let newAttrs = attrs;
    if (dims && !hasWidth) newAttrs += ` width="${dims.w}"`;
    if (dims && !hasHeight) newAttrs += ` height="${dims.h}"`;

    const newImg = `<img${newAttrs}/>`;
    const webpSrc = src.replace(/\.png(\?|$)/i, '.webp$1');
    const wrapped = `<picture><source srcset="${webpSrc}" type="image/webp"/>${newImg}</picture>`;

    replacements.push({ start, end, replacement: wrapped });
  }

  if (replacements.length === 0) return { html, count: 0 };

  // Apply in reverse to keep indices valid
  replacements.sort((a, b) => b.start - a.start);
  for (const r of replacements) {
    html = html.slice(0, r.start) + r.replacement + html.slice(r.end);
  }
  return { html, count: replacements.length };
}

function listHtmlFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip a few heavy / off-limits dirs
      if (['node_modules', '.git', 'images', 'experiments', 'datasets'].includes(entry.name)) continue;
      listHtmlFiles(p, out);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      out.push(p);
    }
  }
  return out;
}

(async () => {
  const files = listHtmlFiles(ROOT);
  console.log(`Scanning ${files.length} HTML files...`);
  let touched = 0;
  let totalReplacements = 0;
  for (const f of files) {
    const before = fs.readFileSync(f, 'utf8');
    const { html, count } = await transformOne(before);
    if (count > 0) {
      fs.writeFileSync(f, html);
      touched++;
      totalReplacements += count;
      if (touched <= 5 || touched % 500 === 0) {
        console.log(`  ${path.relative(ROOT, f)}: ${count} imgs wrapped`);
      }
    }
  }
  console.log(`\nDone. ${touched} files modified. ${totalReplacements} <img> tags wrapped.`);
})().catch(err => { console.error(err); process.exit(1); });
